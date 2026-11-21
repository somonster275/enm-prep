'use client'
import { useEffect, useState } from 'react'
import { supabase, ecrire } from '@/lib/supabase'
import { ymd } from '@/lib/streaks'

type PauseRow = { id: string; debut: string; fin: string }

function ajouterJours(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Samedi + dimanche du week-end à venir (ou en cours). */
function prochainWeekend(): [string, string] {
  const d = new Date()
  const toSat = (6 - d.getDay() + 7) % 7 // jours jusqu'au prochain samedi
  const sam = ajouterJours(d, toSat)
  return [ymd(sam), ymd(ajouterJours(sam, 1))]
}

function formatFr(jour: string): string {
  return new Date(jour + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

/**
 * Mode vacances : l'étudiant déclare une période de pause pendant laquelle sa série
 * (ses flammes) est protégée. S'appuie sur la table `pauses` (migration 0031). Tant que
 * la migration n'est pas exécutée, le composant se masque au lieu d'afficher une erreur.
 */
export default function ModeVacances({ onChange }: { onChange?: () => void }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [pauses, setPauses] = useState<PauseRow[]>([])
  const [indispo, setIndispo] = useState(false)
  const [ouvert, setOuvert] = useState(false)
  const [debut, setDebut] = useState(ymd(new Date()))
  const [fin, setFin] = useState(ymd(ajouterJours(new Date(), 2)))
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data, error } = await supabase.from('pauses').select('id, debut, fin').eq('user_id', user.id).order('debut')
    if (error) { setIndispo(true); return }
    const today = ymd(new Date())
    // On ne garde que les pauses en cours ou à venir.
    setPauses(((data || []) as PauseRow[]).filter(p => p.fin >= today))
  }
  useEffect(() => { charger() }, [])

  const preset = (d: string, f: string) => { setDebut(d); setFin(f); setErreur(null) }

  const planifier = async () => {
    if (!userId) return
    if (fin < debut) { setErreur('La date de fin doit être après le début.'); return }
    const { error } = await supabase.from('pauses').insert({ user_id: userId, debut, fin })
    if (error) { setErreur('Impossible d\'enregistrer la pause pour le moment.'); return }
    setOuvert(false); setErreur(null)
    await charger()
    onChange?.()
  }

  const reprendre = async (id: string) => {
    if (!(await ecrire(supabase.from('pauses').delete().eq('id', id).select('id')))) return
    await charger()
    onChange?.()
  }

  if (indispo) return null // migration 0031 pas encore exécutée → on masque

  const today = ymd(new Date())
  const enCours = pauses.find(p => p.debut <= today && p.fin >= today) || null
  const [samD, samF] = prochainWeekend()

  const boxStyle: React.CSSProperties = {
    background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6,
    padding: '12px 18px', marginBottom: 20, fontFamily: "var(--font-texte)",
  }
  const boutonPrincipal: React.CSSProperties = {
    fontSize: 13.5, fontWeight: 600, color: 'var(--c-papier)', background: 'var(--c-encre)',
    border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
  }
  const boutonLeger: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: 'var(--c-encre)', background: 'transparent',
    border: '1px solid var(--c-filet-fort)', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit',
  }

  // === Pause en cours : on rassure, on propose de reprendre ===
  if (enCours) {
    return (
      <div style={{ ...boxStyle, background: '#EAF7F0', border: '1px solid #BFE6CF', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0F6E56' }}>En pause jusqu&apos;au {formatFr(enCours.fin)}</div>
          <div style={{ fontSize: 13, color: '#4E6A5C', marginTop: 1 }}>Ta série est protégée — profite de ta pause, tes flammes t&apos;attendent.</div>
        </div>
        <button onClick={() => reprendre(enCours.id)} style={{ ...boutonLeger, color: '#0F6E56', borderColor: '#BFE6CF' }}>Reprendre maintenant</button>
      </div>
    )
  }

  // === Pas de pause en cours ===
  return (
    <div style={boxStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--c-encre)' }}>Besoin d&apos;une pause ?</div>
          <div style={{ fontSize: 13, color: 'var(--c-annotation)', marginTop: 1 }}>
            {pauses.length > 0
              ? `Pause prévue du ${formatFr(pauses[0].debut)} au ${formatFr(pauses[0].fin)}.`
              : 'Vacances, week-end… mets ta série en pause sans perdre tes flammes.'}
          </div>
        </div>
        {pauses.length > 0 && !ouvert && (
          <button onClick={() => reprendre(pauses[0].id)} style={boutonLeger}>Annuler la pause</button>
        )}
        <button onClick={() => setOuvert(o => !o)} style={boutonPrincipal}>{ouvert ? 'Fermer' : 'Planifier une pause'}</button>
      </div>

      {ouvert && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-filet)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => preset(samD, samF)} style={boutonLeger}>Ce week-end</button>
            <button onClick={() => preset(ymd(new Date()), ymd(ajouterJours(new Date(), 6)))} style={boutonLeger}>1 semaine</button>
            <button onClick={() => preset(ymd(new Date()), ymd(ajouterJours(new Date(), 13)))} style={boutonLeger}>2 semaines</button>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--c-annotation)', fontWeight: 600 }}>
              Du<br />
              <input type="date" value={debut} onChange={e => setDebut(e.target.value)}
                style={{ marginTop: 4, border: '1px solid var(--c-filet-fort)', borderRadius: 6, padding: '7px 10px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--c-encre)', background: '#FFFEFB' }} />
            </label>
            <label style={{ fontSize: 13, color: 'var(--c-annotation)', fontWeight: 600 }}>
              Au<br />
              <input type="date" value={fin} min={debut} onChange={e => setFin(e.target.value)}
                style={{ marginTop: 4, border: '1px solid var(--c-filet-fort)', borderRadius: 6, padding: '7px 10px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--c-encre)', background: '#FFFEFB' }} />
            </label>
            <button onClick={planifier} style={{ ...boutonPrincipal, padding: '9px 18px' }}>Confirmer</button>
          </div>
          {erreur && <div style={{ fontSize: 11.5, color: '#C0392B', marginTop: 8 }}>{erreur}</div>}
        </div>
      )}
    </div>
  )
}
