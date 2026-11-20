'use client'
import { useEffect, useState } from 'react'
import { supabase, toutesLesLignes } from '@/lib/supabase'
import type { Espace, Progression, Profil } from '@/types'
import { estDue, PALIER_MAX } from '@/lib/spaced-repetition'
import {
  chargerActivite, calculerStreak, derniers7Jours, cartesAujourdhui, OBJECTIF_QUOTIDIEN,
  chargerPauses, ymd, type Pause,
} from '@/lib/streaks'
import { calculerProgression } from '@/lib/progression'
import Link from 'next/link'
import NotesWidget from '@/components/NotesWidget'
import ModeVacances from '@/components/ModeVacances'
import ProgressionCard from '@/components/ProgressionCard'
import OnboardingModal from '@/components/OnboardingModal'
import AccesRapide from '@/components/AccesRapide'

type Evenement = { id: string; titre: string; date_debut: string; heure: string | null; type: string; couleur: string }
const TYPE_LABELS: Record<string, string> = { cours: 'Cours', examen: 'Examen', deadline: 'Deadline', autre: 'Autre' }

const MESSAGES = [
  'Une petite session vous attend. Un peu chaque jour, et ça avance tout seul.',
  'Chaque fiche compte. Avancez à votre rythme, c\'est déjà très bien.',
  'Quelques minutes aujourd\'hui valent mieux qu\'une longue séance demain.',
  'Votre régularité paie. Continuez, une fiche après l\'autre.',
  'Pas besoin de tout faire — l\'important, c\'est de revenir.',
]

export default function Dashboard() {
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [progressions, setProgressions] = useState<Progression[]>([])
  const [fiches, setFiches] = useState<{ id: string, espace_id: string, module_id: string }[]>([])
  const [modulesTotal, setModulesTotal] = useState(0)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [activite, setActivite] = useState<Record<string, number>>({})
  const [pauses, setPauses] = useState<Pause[]>([])
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [dateExamen, setDateExamen] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: esp }, { data: prog }, { data: fich }, { data: prof }, act, evs, { data: mods }, pz] = await Promise.all([
        supabase.from('espaces').select('*').order('ordre'),
        toutesLesLignes<Progression>((de, a) => supabase.from('progression').select('*').eq('utilisateur_id', user.id).order('fiche_id').range(de, a)),
        toutesLesLignes((de, a) => supabase.from('fiches').select('id, module_id, modules(espace_id)').is('deleted_at', null).eq('suspendu', false).order('id').range(de, a)),
        supabase.from('profils').select('*').eq('id', user.id).single(),
        chargerActivite(user.id),
        supabase.from('evenements').select('id,titre,date_debut,heure,type,couleur').gte('date_debut', new Date().toISOString().slice(0,10)).order('date_debut').limit(4),
        supabase.from('modules').select('id').is('deleted_at', null),
        chargerPauses(user.id),
      ])
      // Prochain examen (toutes dates), pour le compte à rebours — indépendant des 4 events affichés.
      const { data: exam } = await supabase.from('evenements').select('date_debut').eq('type', 'examen').gte('date_debut', new Date().toISOString().slice(0,10)).order('date_debut').limit(1).maybeSingle()
      setDateExamen((exam as { date_debut: string } | null)?.date_debut ?? null)
      setEspaces(esp || [])
      setProgressions(prog || [])
      setModulesTotal((mods || []).length)
      setFiches((fich || []).map((f: any) => ({ id: f.id, espace_id: f.modules?.espace_id, module_id: f.module_id })))
      setProfil(prof)
      setActivite(act)
      setPauses(pz)
      setEvenements((evs as any)?.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Recharge les pauses après un changement (planification / annulation) pour
  // recalculer immédiatement la série protégée.
  const rechargerPauses = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setPauses(await chargerPauses(user.id))
  }

  const font = "var(--font-texte)"
  const display = "var(--font-titre)"

  if (loading) return (
    <div style={{ paddingTop: '4rem', textAlign: 'center', color: 'var(--c-annotation-clair)', fontFamily: font }}>Chargement…</div>
  )

  const modulesAbordes = new Set(progressions.map(p => fiches.find(f => f.id === p.fiche_id)?.module_id).filter(Boolean)).size
  const detailProg = calculerProgression({ progressions, modulesTotal, modulesAbordes, activite })
  const score = detailProg.global
  const totalDue = progressions.filter(p => estDue(p.prochaine_revision)).length
  const prenom = profil?.prenom?.trim() || profil?.email?.split('@')[0] || 'vous'

  const streak = calculerStreak(activite, pauses)
  const semaine = derniers7Jours(activite)
  const cartesJour = cartesAujourdhui(activite)
  const totalSemaine = semaine.reduce((s, j) => s + j.cartes, 0)
  const objectifPct = Math.min(100, Math.round((cartesJour / OBJECTIF_QUOTIDIEN) * 100))

  const espaceDue = espaces.find(e => {
    const fichesE = fiches.filter(f => f.espace_id === e.id)
    const progsE = progressions.filter(p => fichesE.find(f => f.id === p.fiche_id))
    return progsE.some(p => estDue(p.prochaine_revision))
  })

  // Fiches dues par matière → utilisé pour la priorité ET le widget d'accès rapide.
  const matieresAvecDues = espaces.map(e => {
    const fichesE = fiches.filter(f => f.espace_id === e.id)
    const dues = progressions.filter(p => fichesE.find(f => f.id === p.fiche_id) && estDue(p.prochaine_revision)).length
    return { slug: e.slug, nom: e.nom, dues }
  })
  // Matières triées : les plus urgentes d'abord (pour les raccourcis).
  const matieres = [...matieresAvecDues].sort((a, b) => b.dues - a.dues)
  // Matière avec le plus de fiches dues → suggestion prioritaire
  const priorite = matieres.filter(x => x.dues > 0)[0] ?? null

  // Rayon des matières : maîtrise = avancement moyen des paliers sur TOUTES les fiches de la matière (non vues = 0).
  const progParFiche = new Map(progressions.map(p => [p.fiche_id, p]))
  const rayon = espaces.map(e => {
    const fichesE = fiches.filter(f => f.espace_id === e.id)
    const progsE = fichesE.map(f => progParFiche.get(f.id)).filter((p): p is Progression => !!p)
    const paliers = progsE.reduce((s, p) => s + Math.min(p.palier ?? 0, PALIER_MAX), 0)
    return {
      slug: e.slug, nom: e.nom,
      maitrise: fichesE.length ? Math.round(paliers / (fichesE.length * PALIER_MAX) * 100) : 0,
      dues: progsE.filter(p => estDue(p.prochaine_revision)).length,
    }
  })

  // Compte à rebours ENM : prochain examen (récupéré séparément, toutes dates)
  const joursRestants = dateExamen
    ? Math.max(0, Math.round((new Date(dateExamen + 'T12:00:00').getTime() - Date.now()) / 86400000))
    : null
  const totalFiches = fiches.length
  const fichesVues = new Set(progressions.map(p => p.fiche_id)).size
  const fichesPourSuivre = totalFiches > 0 && joursRestants && joursRestants > 0
    ? Math.ceil((totalFiches - fichesVues) / joursRestants)
    : null

  const bloc: React.CSSProperties = { background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '22px 24px', minWidth: 0 }
  const titreBloc: React.CSSProperties = { fontFamily: display, fontWeight: 600, fontSize: 19, margin: '0 0 14px' }
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 46, padding: '0 20px', borderRadius: 6, fontFamily: font, fontWeight: 600, fontSize: 15, color: '#fff', background: 'var(--c-accent)', textDecoration: 'none' }

  return (
    <div style={{ paddingTop: '34px', fontFamily: font, color: 'var(--c-encre)' }}>
      <OnboardingModal />

      {/* Mode vacances : mettre sa série en pause sans perdre ses flammes */}
      <ModeVacances onChange={rechargerPauses} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 20, marginBottom: 20 }}>

        {/* Bloc principal : les fiches du jour */}
        <div style={{ ...bloc, padding: '30px 32px' }}>
          <p style={{ color: 'var(--c-annotation)', margin: '0 0 6px', fontSize: 15.5 }}>Bonjour {prenom},</p>
          <p style={{ fontFamily: display, fontWeight: 'var(--titre-poids)', fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)', lineHeight: 1.12, letterSpacing: '-.015em', margin: '0 0 22px', textWrap: 'balance' }}>
            {totalDue > 0
              ? <>{totalDue} fiche{totalDue > 1 ? 's' : ''} vous attend{totalDue > 1 ? 'ent' : ''} aujourd&apos;hui{priorite && rayon.filter(r => r.dues > 0).length > 1 ? <>, dont {priorite.dues} en {priorite.nom}</> : null}.</>
              : <>Vous êtes à jour. {message}</>}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', alignItems: 'center' }}>
            {espaceDue
              ? <Link href={`/espaces/${(priorite?.slug ?? espaceDue.slug)}/revision`} style={btn}>Réviser maintenant</Link>
              : <Link href="/espaces" style={btn}>Choisir une matière</Link>}
            {totalDue > 0 && <Link href="/espaces/_/revision?mixte=1" style={{ fontSize: 14.5, color: 'var(--c-annotation)' }}>Révision mixte, toutes matières</Link>}
          </div>
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--c-annotation)', marginBottom: 8 }}>
              <span>Objectif du jour</span>
              <span><b style={{ color: 'var(--c-encre)', fontVariantNumeric: 'tabular-nums' }}>{cartesJour}</b> sur {OBJECTIF_QUOTIDIEN} cartes</span>
            </div>
            <div role="img" aria-label={`${cartesJour} cartes sur ${OBJECTIF_QUOTIDIEN}`} style={{ height: 10, background: 'var(--c-papier)', border: '1px solid var(--c-filet)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${objectifPct}%`, height: '100%', background: 'var(--c-surligneur)' }} />
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--c-annotation)', margin: '10px 0 0' }}>Progression globale : {score} %. {totalSemaine} cartes revues ces 7 derniers jours.</p>
          </div>
        </div>

        {/* Colonne : série + à venir */}
        <div style={{ display: 'grid', gap: 20, alignContent: 'start', minWidth: 0 }}>
          <div style={bloc}>
            <h2 style={titreBloc}>Votre série</h2>
            <p style={{ fontFamily: display, fontSize: 17, margin: '0 0 12px' }}>
              {streak > 0 ? <><b style={{ fontWeight: 600 }}>{streak} jour{streak > 1 ? 's' : ''}</b> d&apos;affilée.</> : 'Révisez aujourd’hui pour lancer une série.'}
            </p>
            <div className="no-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6, textAlign: 'center', fontSize: 12, color: 'var(--c-annotation)' }}>
              {semaine.map((j, i) => (
                <div key={i} title={`${j.cartes} carte${j.cartes > 1 ? 's' : ''}`}>
                  <div style={{
                    height: 30, borderRadius: 3, marginBottom: 4,
                    background: j.cartes > 0 ? 'var(--c-encre)' : 'var(--c-papier)',
                    border: j.estAujourdhui && j.cartes === 0 ? '2px dashed var(--c-accent)' : `1px solid ${j.cartes > 0 ? 'var(--c-encre)' : 'var(--c-filet)'}`,
                  }} />
                  {j.lettre}
                </div>
              ))}
            </div>
          </div>

          <div style={bloc}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={titreBloc}>À venir</h2>
              <Link href="/calendrier" style={{ fontSize: 13.5, color: 'var(--c-annotation)' }}>Calendrier</Link>
            </div>
            {evenements.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--c-annotation)', margin: 0 }}>Aucun événement à venir.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
                {evenements.map(ev => {
                  const d = new Date(ev.date_debut + 'T12:00:00')
                  const diff = Math.round((d.getTime() - new Date(ymd(new Date()) + 'T12:00:00').getTime()) / 86400000)
                  return (
                    <li key={ev.id}>
                      <Link href="/calendrier" className="no-collapse" style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                        <span style={{ textAlign: 'center', border: '1px solid var(--c-filet)', borderTop: `3px solid ${ev.couleur}`, borderRadius: 4, padding: '3px 0', lineHeight: 1.1 }}>
                          <b style={{ display: 'block', fontFamily: display, fontSize: 19, fontWeight: 600 }}>{d.getDate()}</b>
                          <span style={{ fontSize: 11.5, color: 'var(--c-annotation)' }}>{d.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <b style={{ display: 'block', fontWeight: 600, fontSize: 14.5 }}>{ev.titre}</b>
                          <span style={{ fontSize: 13, color: 'var(--c-annotation)' }}>
                            {TYPE_LABELS[ev.type] ?? ev.type}{ev.heure && `, ${ev.heure}`}
                            {diff === 0 && <b style={{ marginLeft: 6, color: 'var(--c-accent)' }}>aujourd&apos;hui</b>}
                            {diff > 0 && diff <= 7 && <span style={{ marginLeft: 6 }}>dans {diff} j</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            {joursRestants !== null && (
              <p style={{ fontSize: 14, color: 'var(--c-annotation)', margin: '16px 0 0' }}>
                Prochain examen dans <b style={{ fontFamily: display, fontSize: 17, fontWeight: 600, color: 'var(--c-encre)' }}>{joursRestants} jours</b>
                {fichesPourSuivre && fichesPourSuivre > 0 ? <>. {fichesPourSuivre} nouvelle{fichesPourSuivre > 1 ? 's' : ''} fiche{fichesPourSuivre > 1 ? 's' : ''} par jour pour tout voir d&apos;ici là.</> : '.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Rayon des matières : une tranche de code par matière */}
      {rayon.length > 0 && (
        <div style={{ ...bloc, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            <h2 style={{ ...titreBloc, margin: 0 }}>Vos matières</h2>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--c-annotation)' }}>La hauteur rouge montre votre maîtrise. En jaune, les fiches à réviser.</p>
          </div>
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', minWidth: Math.max(rayon.length * 64, 300), borderBottom: '6px solid var(--c-filet-fort)', padding: '0 8px' }}>
              {rayon.map((r, k) => (
                <Link key={r.slug} href={`/espaces/${r.slug}`} aria-label={`${r.nom} : ${r.maitrise} % maîtrisé, ${r.dues} fiches à réviser`} style={{
                  flex: '1 1 0', minWidth: 0, height: 200 + (k % 3) * 18, position: 'relative', overflow: 'hidden', textDecoration: 'none',
                  borderRadius: '3px 3px 0 0', background: '#F4E3E5', border: '1px solid rgba(163,18,42,.3)', borderBottom: 0,
                }}>
                  <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${r.maitrise}%`, background: 'var(--c-accent)' }} />
                  <span style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px' }}>
                    <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: display, fontWeight: 600, fontSize: 14, lineHeight: 1.1, color: 'var(--c-encre)', background: '#FFFEFB', padding: '8px 3px', borderRadius: 2, maxHeight: 130, overflow: 'hidden' }}>{r.nom}</span>
                    <span style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                      {r.dues > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, background: 'var(--c-surligneur)', color: 'var(--c-encre)', borderRadius: 2, padding: '1px 5px' }}>{r.dues}</span>}
                      <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.maitrise >= 12 ? '#fff' : 'var(--c-encre)' }}>{r.maitrise} %</span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Raccourcis + tâches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}><AccesRapide matieres={matieres} /></div>
        <div style={{ minWidth: 0 }}><NotesWidget titre="Mes tâches" /></div>
      </div>

      {/* Progression globale — en bas de page */}
      <div style={{ marginTop: 28 }}>
        <ProgressionCard detail={detailProg} />
      </div>
    </div>
  )
}
