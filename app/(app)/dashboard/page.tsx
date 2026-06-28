'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace, Progression, Profil } from '@/types'
import { estDue } from '@/lib/spaced-repetition'
import {
  chargerActivite, calculerStreak, derniers7Jours, cartesAujourdhui, OBJECTIF_QUOTIDIEN,
} from '@/lib/streaks'
import { calculerProgression } from '@/lib/progression'
import Link from 'next/link'
import NotesWidget from '@/components/NotesWidget'
import ProgressionCard from '@/components/ProgressionCard'
import OnboardingModal from '@/components/OnboardingModal'

const OUTILS = [
  { href: '/espaces', icone: '🗂️', couleur: '#DC4A2B', titre: 'Fiches', desc: 'Réviser vos fiches par matière, en répétition espacée.' },
  { href: '/mind-maps', icone: '🧠', couleur: '#2DAE83', titre: 'Mind maps', desc: 'Cartes mentales et schémas par sujet.' },
  { href: '/media', icone: '🎧', couleur: '#3B82D9', titre: 'Audio & Vidéo', desc: 'Écouter et regarder les ressources importées.' },
  { href: '/qcm', icone: '✅', couleur: '#E8A11E', titre: 'QCM', desc: "S'entraîner avec des questions à choix multiples." },
]

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
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [loading, setLoading] = useState(true)
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: esp }, { data: prog }, { data: fich }, { data: prof }, act, evs, { data: mods }] = await Promise.all([
        supabase.from('espaces').select('*').order('ordre'),
        supabase.from('progression').select('*').eq('utilisateur_id', user.id),
        supabase.from('fiches').select('id, module_id, modules(espace_id)').is('deleted_at', null),
        supabase.from('profils').select('*').eq('id', user.id).single(),
        chargerActivite(user.id),
        supabase.from('evenements').select('id,titre,date_debut,heure,type,couleur').gte('date_debut', new Date().toISOString().slice(0,10)).order('date_debut').limit(4),
        supabase.from('modules').select('id').is('deleted_at', null),
      ])
      setEspaces(esp || [])
      setProgressions(prog || [])
      setModulesTotal((mods || []).length)
      setFiches((fich || []).map((f: any) => ({ id: f.id, espace_id: f.modules?.espace_id, module_id: f.module_id })))
      setProfil(prof)
      setActivite(act)
      setEvenements((evs as any)?.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"

  if (loading) return (
    <div style={{ paddingTop: '4rem', textAlign: 'center', color: '#9A8D72', fontFamily: font }}>Chargement…</div>
  )

  const modulesAbordes = new Set(progressions.map(p => fiches.find(f => f.id === p.fiche_id)?.module_id).filter(Boolean)).size
  const detailProg = calculerProgression({ progressions, modulesTotal, modulesAbordes, activite })
  const score = detailProg.global
  const totalDue = progressions.filter(p => estDue(p.prochaine_revision)).length
  const prenom = profil?.prenom?.trim() || profil?.email?.split('@')[0] || 'vous'

  const streak = calculerStreak(activite)
  const semaine = derniers7Jours(activite)
  const cartesJour = cartesAujourdhui(activite)
  const totalSemaine = semaine.reduce((s, j) => s + j.cartes, 0)
  const objectifPct = Math.min(100, Math.round((cartesJour / OBJECTIF_QUOTIDIEN) * 100))
  const maxBarre = Math.max(1, ...semaine.map(j => j.cartes))

  const espaceDue = espaces.find(e => {
    const fichesE = fiches.filter(f => f.espace_id === e.id)
    const progsE = progressions.filter(p => fichesE.find(f => f.id === p.fiche_id))
    return progsE.some(p => estDue(p.prochaine_revision))
  })

  const statCard: React.CSSProperties = { background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: 22 }
  const statHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
  const statIcon = (bg: string): React.CSSProperties => ({ width: 38, height: 38, borderRadius: 11, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 })
  const statLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#8A7E68' }
  const statBig: React.CSSProperties = { fontFamily: display, fontWeight: 800, fontSize: 30, marginTop: 14 }

  return (
    <div style={{ paddingTop: '34px', fontFamily: font, color: '#2A2018' }}>
      <OnboardingModal />

      {/* Salutation */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: '-.01em' }}>
          Bonjour, {prenom}.
        </div>
        <div style={{ fontSize: 15, color: '#8A7E68', marginTop: 4 }}>
          {streak > 0 ? `${streak} jour${streak > 1 ? 's' : ''} d'affilée — ${message}` : message}
        </div>
      </div>

      {/* Stats : série · objectif · semaine */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <div style={statCard}>
          <div style={statHead}><div style={statIcon('#FCE9E3')}>🔥</div><span style={statLabel}>Série en cours</span></div>
          <div style={statBig}>{streak} <span style={{ fontSize: 16, color: '#9A8D72', fontWeight: 700 }}>jour{streak > 1 ? 's' : ''}</span></div>
        </div>
        <div style={statCard}>
          <div style={statHead}><div style={statIcon('#FCEFD3')}>🎯</div><span style={statLabel}>Objectif du jour</span></div>
          <div style={statBig}>{cartesJour}<span style={{ color: '#9A8D72' }}>/{OBJECTIF_QUOTIDIEN}</span></div>
          <div style={{ height: 6, background: '#F1E4CE', borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: `${objectifPct}%`, height: '100%', background: '#DC4A2B', borderRadius: 999 }} />
          </div>
        </div>
        <div style={statCard}>
          <div style={statHead}><div style={statIcon('#DDF3EE')}>✨</div><span style={statLabel}>Cette semaine</span></div>
          <div style={statBig}>{totalSemaine} <span style={{ fontSize: 16, color: '#9A8D72', fontWeight: 700 }}>cartes</span></div>
        </div>
      </div>

      {/* Hero : révisions du jour + momentum */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18, marginBottom: 34 }}>

        {/* Révisions du jour — bloc soleil */}
        <div style={{ position: 'relative', background: '#FFC02E', borderRadius: 20, padding: 32, color: '#2A2018', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: '#FFCE54', right: -30, top: -50 }} />
          <div style={{ position: 'absolute', width: 90, height: 90, borderRadius: 20, background: '#DC4A2B', right: 90, bottom: -28, transform: 'rotate(16deg)' }} />
          <div style={{ position: 'absolute', width: 56, height: 56, borderRadius: '50%', background: '#2DAE83', right: 210, top: 24 }} />
          <div style={{ position: 'relative' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7A5E14' }}>Révisions du jour</span>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 28, lineHeight: 1.1, marginTop: 12, maxWidth: 320 }}>
              {totalDue > 0 ? `${totalDue} fiches dues, ne prenez pas de retard` : 'Vous êtes à jour — continuez comme ça !'}
            </div>
            <div style={{ fontSize: 14, color: '#5C4A22', marginTop: 10, fontWeight: 600 }}>Score global : {score}%</div>
            {espaceDue ? (
              <Link href={`/espaces/${espaceDue.slug}/revision`} style={{
                display: 'inline-block', marginTop: 22, fontFamily: font, fontWeight: 700, fontSize: 15,
                color: '#fff', background: '#2A2018', borderRadius: 12, padding: '13px 24px', textDecoration: 'none',
              }}>Réviser maintenant →</Link>
            ) : (
              <Link href="/espaces" style={{
                display: 'inline-block', marginTop: 22, fontFamily: font, fontWeight: 700, fontSize: 15,
                color: '#fff', background: '#2A2018', borderRadius: 12, padding: '13px 24px', textDecoration: 'none',
              }}>Choisir un espace →</Link>
            )}
          </div>
        </div>

        {/* Momentum 7 jours */}
        <div style={{ position: 'relative', background: '#2A2018', borderRadius: 20, padding: 28, color: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ position: 'absolute', width: 130, height: 130, borderRadius: '50%', background: '#DC4A2B', right: -36, top: -44, opacity: 0.7 }} />
          <div style={{ position: 'relative' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#FFD9CC' }}>Votre momentum · 7 jours</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 38, lineHeight: 1 }}>{totalSemaine}</div>
              <div style={{ fontSize: 13, color: '#CDBFA6' }}>cartes revues</div>
            </div>
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 7, height: 80, marginTop: 18 }}>
            {semaine.map((j, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: '100%', height: `${Math.max(6, (j.cartes / maxBarre) * 64)}px`, borderRadius: 5,
                  background: j.estAujourdhui ? '#FFC02E' : (j.cartes > 0 ? '#E8694D' : '#4A3A2A'),
                }} />
                <span style={{ fontSize: 11, color: j.estAujourdhui ? '#E8694D' : '#9A8D72', fontWeight: j.estAujourdhui ? 700 : 400 }}>{j.lettre}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Outils + Calendrier côte à côte */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

        <div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 20, marginBottom: 16 }}>Vos outils</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {OUTILS.map(o => (
              <Link key={o.href} href={o.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #F0E7D6', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: o.couleur + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{o.icone}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{o.titre}</div>
                    <div style={{ fontSize: 12, color: '#8A7E68', marginTop: 3, lineHeight: 1.5 }}>{o.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Colonne droite : à venir + tâches */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Mini calendrier — événements à venir */}
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📅</span>
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 15 }}>À venir</span>
            </div>
            <Link href="/calendrier" style={{ fontSize: 11, fontWeight: 600, color: '#7C5CBF', textDecoration: 'none' }}>Voir tout →</Link>
          </div>
          {evenements.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9A8D72', textAlign: 'center', padding: '12px 0' }}>Aucun événement à venir.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evenements.map(ev => {
                const d = new Date(ev.date_debut + 'T12:00:00')
                const todayKey = new Date().toISOString().slice(0, 10)
                const diff = Math.round((d.getTime() - new Date(todayKey).getTime()) / 86400000)
                return (
                  <Link key={ev.id} href="/calendrier" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ borderLeft: `3px solid ${ev.couleur}`, paddingLeft: 10, paddingTop: 2, paddingBottom: 2 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#2A2018' }}>{ev.titre}</div>
                      <div style={{ fontSize: 11, color: '#9A8D72', marginTop: 1 }}>
                        {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {ev.heure && ` · ${ev.heure}`}
                        {diff === 0 && <span style={{ marginLeft: 6, color: '#DC4A2B', fontWeight: 700 }}>auj.</span>}
                        {diff > 0 && diff <= 7 && <span style={{ marginLeft: 6, color: '#E8A11E', fontWeight: 600 }}>J-{diff}</span>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: ev.couleur }}>{TYPE_LABELS[ev.type] ?? ev.type}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <NotesWidget titre="Mes tâches" />
        </div>
      </div>

      {/* Progression globale — en bas de page */}
      <div style={{ marginTop: 28 }}>
        <ProgressionCard detail={detailProg} />
      </div>
    </div>
  )
}
