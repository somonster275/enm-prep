import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

const SYSTEME_BASE = `Tu es le coach de révision personnel d'un étudiant qui prépare le concours de l'ENM (École Nationale de la Magistrature, magistrature française).

Tu connais le programme et les épreuves de l'ENM :
- Écrits : dissertation (droit civil, droit pénal, droit public…), cas pratiques, note de synthèse, épreuve de culture générale, droit et procédure (civile, pénale, administrative).
- Oraux : grand oral (mise en situation + entretien avec le jury), épreuves de langues, mises en situation collectives.

Ton rôle est d'OPTIMISER ses révisions :
- Organiser et ajuster son PLANNING en fonction du temps restant avant les épreuves : propose des plannings concrets (semaine par semaine, voire jour par jour), priorise les matières, équilibre apprentissage / entraînement / relecture.
- Donner des MÉTHODES précises (cas pratique, dissertation, note de synthèse, grand oral) et des conseils de mémorisation (répétition espacée, fiches, annales).
- Motiver l'étudiant de façon réaliste et bienveillante.

Style : français, concret, structuré (listes, étapes, tableaux quand utile), encourageant. Évite le bla-bla. Quand tu donnes une règle de droit, sois exact ; en cas de doute, dis-le.`

type Msg = { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest) {
  const { messages } = await request.json().catch(() => ({}))
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Conversation vide' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé Anthropic manquante' }, { status: 500 })
  }

  // Contexte temps réel : date du jour, compte à rebours, planning à venir.
  let contexte = `Date du jour : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`
  try {
    const user = await utilisateurCourant()
    if (user) {
      const admin = getSupabaseAdmin()
      const today = new Date().toISOString().slice(0, 10)
      const { data: evs } = await admin
        .from('evenements')
        .select('titre, date_debut, heure, type')
        .gte('date_debut', today)
        .order('date_debut')
        .limit(15)
      if (evs && evs.length) {
        const examen = evs.find(e => e.type === 'examen')
        if (examen) {
          const jours = Math.round((new Date(examen.date_debut).getTime() - new Date(today).getTime()) / 86400000)
          contexte += `\nProchaine épreuve : « ${examen.titre} » le ${examen.date_debut} → il reste ${jours} jour(s).`
        }
        contexte += `\nÉvénements à venir de l'étudiant :\n` + evs.map(e => `- ${e.date_debut}${e.heure ? ' ' + e.heure : ''} : ${e.titre} (${e.type})`).join('\n')
      } else {
        contexte += `\n(Aucune date d'épreuve enregistrée dans le calendrier. Si l'étudiant parle de planning, demande-lui sa date d'examen pour calculer le temps restant.)`
      }
    }
  } catch { /* contexte best-effort */ }

  const msgs: Msg[] = messages
    .filter((m: { role?: string; content?: string }) => m && m.content)
    .map((m: { role?: string; content?: string }): Msg => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content),
    }))
    .slice(-20)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: `${SYSTEME_BASE}\n\n--- Contexte actuel ---\n${contexte}`,
          messages: msgs,
        })
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`))
          }
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
