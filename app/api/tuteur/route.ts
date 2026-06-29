import { NextResponse, type NextRequest } from 'next/server'
import { streamIA, iaConfiguree, CHATBOT_PROVIDER } from '@/lib/ia'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { estDue, PALIER_MAX } from '@/lib/spaced-repetition'
import { calculerProgression } from '@/lib/progression'

export const dynamic = 'force-dynamic'

const SYSTEME_BASE = `Tu es le coach de révision personnel d'un étudiant qui prépare le concours de l'ENM (École Nationale de la Magistrature, magistrature française).

Tu connais le programme et les épreuves de l'ENM :
- Écrits : dissertation (droit civil, droit pénal, droit public…), cas pratiques, note de synthèse, épreuve de culture générale, droit et procédure (civile, pénale, administrative).
- Oraux : grand oral (mise en situation + entretien avec le jury), épreuves de langues, mises en situation collectives.

Ton rôle est d'OPTIMISER ses révisions :
- Organiser et ajuster son PLANNING en fonction du temps restant avant les épreuves : propose des plannings concrets (semaine par semaine, voire jour par jour), priorise les matières, équilibre apprentissage / entraînement / relecture.
- Donner des MÉTHODES précises (cas pratique, dissertation, note de synthèse, grand oral) et des conseils de mémorisation (répétition espacée, fiches, annales).
- Motiver l'étudiant de façon réaliste et bienveillante.

Tu as accès, dans le contexte ci-dessous, à l'AVANCEMENT RÉEL de l'étudiant : score de mémorisation, nombre de fiches à réviser / maîtrisées, détail par matière, activité récente et tâches en attente. Quand il demande « où j'en suis ? », fais un bilan clair à partir de ces chiffres ; quand il demande quoi réviser, priorise les matières en retard (beaucoup de fiches dues, peu maîtrisées) et le temps restant. Ne réclame pas ces informations : tu les as déjà.

Style : français, concret, structuré (listes, étapes, tableaux quand utile), encourageant. Évite le bla-bla. Quand tu donnes une règle de droit, sois exact ; en cas de doute, dis-le.

Quand tu proposes des tâches concrètes et actionnables (ex. « Réviser le chapitre X », « Faire un cas pratique sur Y »), tu PEUX les regrouper TOUT À LA FIN de ta réponse dans un bloc au format EXACT, que l'étudiant pourra ajouter à sa liste de tâches d'un clic :
<TACHES>
- première tâche courte
- deuxième tâche courte
</TACHES>
N'utilise ce bloc que pour des tâches courtes et concrètes. N'y mets pas de phrases longues ni d'explications.`

type Msg = { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest) {
  const { messages } = await request.json().catch(() => ({}))
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Conversation vide' }, { status: 400 })
  }
  if (!iaConfiguree(CHATBOT_PROVIDER)) {
    return NextResponse.json({ error: 'Clé IA manquante' }, { status: 500 })
  }

  // Rate-limiting persistant (partagé entre instances) : max 20 messages / minute.
  const user0 = await utilisateurCourant()
  if (user0) {
    const { data: ok } = await getSupabaseAdmin().rpc('consommer_quota', {
      p_user: user0.id, p_action: 'coach', p_max: 20, p_fenetre: '1 minute',
    })
    if (ok === false) {
      return NextResponse.json({ error: 'Trop de messages — attends une minute avant de continuer.' }, { status: 429 })
    }
  }

  // Contexte temps réel : date, compte à rebours, planning ET progression de l'étudiant.
  let contexte = `Date du jour : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`
  try {
    const user = await utilisateurCourant()
    if (user) {
      const admin = getSupabaseAdmin()
      const today = new Date().toISOString().slice(0, 10)
      const il7j = new Date(); il7j.setDate(il7j.getDate() - 6)

      const [profilRes, evRes, espRes, fichesRes, progRes, actRes, notesRes, modsRes] = await Promise.all([
        admin.from('profils').select('prenom, nom').eq('id', user.id).single(),
        admin.from('evenements').select('titre, date_debut, heure, type').gte('date_debut', today).order('date_debut').limit(15),
        admin.from('espaces').select('id, nom').order('ordre'),
        admin.from('fiches').select('id, module_id, modules(espace_id)').is('deleted_at', null).eq('suspendu', false),
        admin.from('progression').select('fiche_id, palier, prochaine_revision').eq('utilisateur_id', user.id),
        admin.from('activite_jours').select('jour, cartes').eq('utilisateur_id', user.id).gte('jour', il7j.toISOString().slice(0, 10)),
        admin.from('notes').select('contenu').eq('user_id', user.id).eq('fait', false).limit(20),
        admin.from('modules').select('id').is('deleted_at', null),
      ])

      // --- Identité : s'adresser à l'étudiant par son prénom ---
      const prenom = (profilRes.data?.prenom || '').trim()
      if (prenom) {
        contexte += `\nPrénom de l'étudiant : ${prenom}. Adresse-toi à lui par son prénom de temps en temps, de façon naturelle (pas à chaque phrase).`
      }

      // --- Planning / compte à rebours ---
      const evs = evRes.data || []
      if (evs.length) {
        const examen = evs.find(e => e.type === 'examen')
        if (examen) {
          const jours = Math.round((new Date(examen.date_debut).getTime() - new Date(today).getTime()) / 86400000)
          contexte += `\nProchaine épreuve : « ${examen.titre} » le ${examen.date_debut} → il reste ${jours} jour(s).`
        }
        contexte += `\nÉvénements à venir :\n` + evs.map(e => `- ${e.date_debut}${e.heure ? ' ' + e.heure : ''} : ${e.titre} (${e.type})`).join('\n')
      } else {
        contexte += `\n(Aucune date d'épreuve dans le calendrier — si l'étudiant parle de planning, demande-lui sa date d'examen.)`
      }

      // --- Progression dans les révisions ---
      type Prog = { fiche_id: string; palier: number | null; prochaine_revision: string }
      const progs = (progRes.data || []) as Prog[]
      const espaces = (espRes.data || []) as { id: string; nom: string }[]
      const ficheEspace: Record<string, string> = {}
      const ficheModule: Record<string, string> = {}
      for (const f of (fichesRes.data || []) as { id: string; module_id: string; modules: { espace_id: string } | { espace_id: string }[] | null }[]) {
        const mod = Array.isArray(f.modules) ? f.modules[0] : f.modules
        if (mod?.espace_id) ficheEspace[f.id] = mod.espace_id
        if (f.module_id) ficheModule[f.id] = f.module_id
      }
      const totalFiches = Object.keys(ficheEspace).length
      const due = progs.filter(p => estDue(p.prochaine_revision)).length
      const maitrisees = progs.filter(p => (p.palier ?? 0) >= PALIER_MAX).length

      // Activité (7 jours) + progression composite (maîtrise / couverture / régularité)
      const act: Record<string, number> = {}
      for (const r of (actRes.data || []) as { jour: string; cartes: number }[]) act[r.jour] = r.cartes
      const modulesTotal = (modsRes.data || []).length
      const modulesAbordes = new Set(progs.map(p => ficheModule[p.fiche_id]).filter(Boolean)).size
      const prog = calculerProgression({ progressions: progs, modulesTotal, modulesAbordes, activite: act })

      contexte += `\n\nPROGRESSION DE L'ÉTUDIANT :`
      contexte += `\n- Progression globale : ${prog.global} % (maîtrise ${prog.maitrise} %, couverture du programme ${prog.couverture} %, régularité ${prog.regularite} %).`
      contexte += `\n- Fiches : ${totalFiches} au total, ${progs.length} déjà travaillées, ${due} à réviser maintenant, ${maitrisees} bien maîtrisées.`

      if (espaces.length) {
        const parMatiere = espaces.map(e => {
          const fichesE = Object.keys(ficheEspace).filter(fid => ficheEspace[fid] === e.id)
          if (fichesE.length === 0) return null
          const progsE = progs.filter(p => ficheEspace[p.fiche_id] === e.id)
          const dueE = progsE.filter(p => estDue(p.prochaine_revision)).length
          const maitrE = progsE.filter(p => (p.palier ?? 0) >= PALIER_MAX).length
          return `  - ${e.nom} : ${fichesE.length} fiches, ${dueE} à réviser, ${maitrE} maîtrisées`
        }).filter(Boolean)
        if (parMatiere.length) contexte += `\n- Par matière :\n${parMatiere.join('\n')}`
      }

      // --- Activité (7 derniers jours) ---
      const semaine = Object.values(act).reduce((s, n) => s + n, 0)
      contexte += `\n- Activité : ${act[today] ?? 0} carte(s) révisée(s) aujourd'hui, ${semaine} sur les 7 derniers jours.`

      // --- Tâches en attente ---
      const notes = (notesRes.data || []) as { contenu: string }[]
      contexte += notes.length
        ? `\n- Tâches en attente :\n${notes.map(n => `  - ${n.contenu}`).join('\n')}`
        : `\n- Aucune tâche en attente dans sa liste.`
    }
  } catch { /* contexte best-effort */ }

  const msgs: Msg[] = messages
    .filter((m: { role?: string; content?: string }) => m && m.content)
    .map((m: { role?: string; content?: string }): Msg => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content),
    }))
    .slice(-20)

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const tok of streamIA({
          provider: CHATBOT_PROVIDER,
          system: `${SYSTEME_BASE}\n\n--- Contexte actuel ---\n${contexte}`,
          messages: msgs,
          maxTokens: 2000,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: tok })}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
