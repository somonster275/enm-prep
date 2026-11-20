'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { enregistrerActivite } from '@/lib/streaks'
import { activable } from '@/lib/a11y'

const FONT = "'Hanken Grotesk', sans-serif"
const DISPLAY = "'Bricolage Grotesque', sans-serif"

type OptionPub = { t: string; full?: string }
type QuestionPub = { enonce: string; options: OptionPub[]; cat: 'qcm' | 'fiche'; multi: boolean }
export type MatchAsync = {
  id: string; code: string; titre: string | null
  deck: QuestionPub[]; secondes_par_question: number; expire_at: string | null; hote_id: string
}
type Joueur = { user_id: string; pseudo: string; score: number; repondu: number; justes: number; termine: boolean }
type CorrectionQ = { enonce: string; cat: string; options: string[]; optionsCompletes?: string[]; correct: number[]; choix: number[]; repondu: boolean; juste: boolean }
type Correction = { correction: CorrectionQ[]; nbErreurs: number; nbFichesRangees: number; nbQcmRangees: number }

type Repondu = { juste: boolean; choix: number[]; correct: number[] }

// Duel ASYNCHRONE : le joueur rejoue le paquet figé à son rythme, avec feedback
// immédiat après chaque question (le serveur corrige et verrouille sa réponse).
// À la fin, comparaison des scores + débrief (mêmes routes serveur que le temps réel).
export default function DuelAsync({ match, uid, joueurs }: { match: MatchAsync; uid: string; joueurs: Joueur[] }) {
  const router = useRouter()
  const total = match.deck.length
  const expire = !!match.expire_at && Date.parse(match.expire_at) < Date.now()

  const [answered, setAnswered] = useState<Record<number, Repondu>>({})
  const [idx, setIdx] = useState(0)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [verrou, setVerrou] = useState(false)   // question courante corrigée (feedback affiché)
  const [envoi, setEnvoi] = useState(false)
  const [fini, setFini] = useState(false)
  const [correction, setCorrection] = useState<Correction | null>(null)
  const [deplie, setDeplie] = useState<Set<string>>(new Set())
  const initialise = useRef(false)

  // Reprise : charge les réponses déjà données pour repartir à la 1re question non traitée.
  useEffect(() => {
    if (initialise.current) return
    initialise.current = true
    const charger = async () => {
      const { data } = await supabase.from('match_reponses')
        .select('q_index, juste, choix').eq('match_id', match.id).eq('user_id', uid)
      const map: Record<number, Repondu> = {}
      for (const r of (data || []) as { q_index: number; juste: boolean; choix: number[] | null }[]) {
        map[r.q_index] = { juste: !!r.juste, choix: Array.isArray(r.choix) ? r.choix : [], correct: [] }
      }
      setAnswered(map)
      let premier = 0
      while (premier < total && map[premier]) premier++
      if (premier >= total) { setFini(true); chargerCorrection() } else setIdx(premier)
    }
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chargerCorrection = async () => {
    try {
      const res = await fetch('/api/duel/correction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: match.code }),
      })
      const j = await res.json().catch(() => null)
      if (res.ok && j) setCorrection(j as Correction)
    } catch { /* silencieux */ }
  }

  const choisir = (oi: number, multi: boolean) => {
    if (verrou) return
    setSelection(s => { const n = new Set(s); if (multi) { n.has(oi) ? n.delete(oi) : n.add(oi) } else { n.clear(); n.add(oi) } return n })
  }

  const valider = async () => {
    if (verrou || envoi || selection.size === 0) return
    setEnvoi(true)
    try {
      const res = await fetch('/api/duel/repondre', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: match.code, qIndex: idx, choix: [...selection] }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setEnvoi(false); return }
      const correct: number[] = Array.isArray(j.correct) ? j.correct : []
      setAnswered(a => ({ ...a, [idx]: { juste: !!j.juste, choix: [...selection], correct } }))
      setVerrou(true)
    } finally {
      setEnvoi(false)
    }
  }

  const suivant = async () => {
    let n = idx + 1
    while (n < total && answered[n]) n++
    if (n >= total) {
      setFini(true)
      enregistrerActivite(uid)
      chargerCorrection()
      window.scrollTo({ top: 0 })
      return
    }
    setIdx(n); setSelection(new Set()); setVerrou(false); setDeplie(new Set())
  }

  const basculer = (cle: string) => setDeplie(s => { const n = new Set(s); n.has(cle) ? n.delete(cle) : n.add(cle); return n })

  const moi = joueurs.find(j => j.user_id === uid)
  const adversaires = joueurs.filter(j => j.user_id !== uid)
  const nbRepondu = Object.keys(answered).length

  // ---------- Résultats + comparaison + débrief ----------
  if (fini) {
    const monScore = moi?.score ?? 0
    const mesJustes = moi?.justes ?? Object.values(answered).filter(a => a.juste).length
    return (
      <div style={{ paddingTop: 34, maxWidth: 560, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 46 }}>🏁</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>Duel terminé</div>
          <div style={{ fontSize: 14, color: '#8A7E68' }}>{match.titre} · {total} questions</div>
        </div>

        {/* Ton score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, background: '#FCE9E3', border: '1px solid #F3C6BC', marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>🧑‍⚖️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Toi</div>
            <div style={{ fontSize: 12.5, color: '#9A8D72' }}>{mesJustes}/{total} bonnes réponses</div>
          </div>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: '#DC4A2B' }}>{monScore}</span>
        </div>

        {/* Adversaires */}
        {adversaires.length === 0 ? (
          <div style={{ background: '#FFF8EE', border: '1px solid #F2D9A0', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, color: '#8A5A10' }}>
            Personne n&apos;a encore relevé ton défi. Partage le code <b>{match.code}</b> — tu seras notifié de son score ici.
          </div>
        ) : adversaires.map(a => (
          <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, background: '#fff', border: '1px solid #F0E7D6', marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>{a.termine ? (a.score > monScore ? '👑' : '🎓') : '⌛'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{a.pseudo}</div>
              <div style={{ fontSize: 12.5, color: '#9A8D72' }}>{a.termine ? `${a.justes}/${total} bonnes réponses` : 'n\'a pas encore terminé'}</div>
            </div>
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: a.termine ? '#2A2018' : '#C0B7A4' }}>{a.termine ? a.score : '—'}</span>
          </div>
        ))}

        {/* Inviter */}
        <button onClick={() => navigator.clipboard?.writeText(`${location.origin}/duel/${match.code}`)}
          style={{ width: '100%', marginTop: 12, height: 44, border: '1px solid #EADFC9', borderRadius: 12, background: '#fff', color: '#8A7E68', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          🔗 Copier le lien du défi (code {match.code})
        </button>

        {/* Débrief : cartes interrogées + rangement des erreurs */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 19, marginBottom: 8 }}>Revois tes questions</div>
          {!correction && <div style={{ color: '#9A8D72', fontSize: 14, padding: '10px 0' }}>Préparation du débrief…</div>}
          {correction && (
            <>
              {(correction.nbFichesRangees > 0 || correction.nbQcmRangees > 0) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FCE9E3', border: '1px solid #F3C6BC', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                  <span style={{ fontSize: 22 }}>📌</span>
                  <div style={{ fontSize: 13.5, color: '#A8453B', lineHeight: 1.45 }}>
                    <b>{correction.nbErreurs} erreur{correction.nbErreurs > 1 ? 's' : ''}</b> rangée{correction.nbErreurs > 1 ? 's' : ''} dans tes cartes à réviser
                    {correction.nbFichesRangees > 0 && <> · <a href="/carnet" style={{ color: '#C0392B', fontWeight: 700 }}>voir mon carnet →</a></>}
                    {correction.nbQcmRangees > 0 && <> · <a href="/qcm" style={{ color: '#C0392B', fontWeight: 700 }}>réviser mes erreurs QCM →</a></>}
                  </div>
                </div>
              ) : (
                <div style={{ background: '#ECF7F0', border: '1px solid #BFE6CF', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13.5, color: '#0E5A47' }}>
                  🎉 Aucune erreur — rien à ranger en révision, bravo !
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {correction.correction.map((c, i) => (
                  <div key={i} style={{ background: '#fff', border: `1px solid ${c.juste ? '#BFE6CF' : '#F3C6BC'}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.4 }}>{i + 1}. {c.enonce}</div>
                      <span style={{ flexShrink: 0, fontSize: 13 }}>{c.juste ? '✅' : '❌'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {c.options.map((t, oi) => {
                        const estCorrect = c.correct.includes(oi)
                        const choisi = c.choix.includes(oi)
                        let bg = '#FFFBF2', bd = '#EADFC9', col = '#2A2018'
                        if (estCorrect) { bg = '#ECF7F0'; bd = '#BFE6CF'; col = '#0E5A47' }
                        else if (choisi) { bg = '#FCEEEA'; bd = '#F3C6BC'; col = '#A8453B' }
                        const complet = c.optionsCompletes?.[oi] || t
                        const tronquee = / \[…\]$/.test(t) || complet.length > t.length
                        const cle = `${i}-${oi}`
                        const ouvert = deplie.has(cle)
                        return (
                          <div key={oi} {...activable} onClick={() => tronquee && basculer(cle)} style={{ border: `1.5px solid ${bd}`, background: bg, borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: col, cursor: tronquee ? 'pointer' : 'default' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                              <span style={{ flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{ouvert ? complet : t}</span>
                              {estCorrect && <span style={{ fontSize: 11, fontWeight: 800, color: '#0F6E56', flexShrink: 0 }}>BONNE RÉPONSE</span>}
                              {!estCorrect && choisi && <span style={{ fontSize: 11, fontWeight: 800, color: '#C0392B', flexShrink: 0 }}>TON CHOIX</span>}
                            </div>
                            {tronquee && <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8A7E68', marginTop: 5 }}>{ouvert ? '▲ Réduire' : '▼ Voir toute la carte'}</div>}
                          </div>
                        )
                      })}
                    </div>
                    {!c.repondu && <div style={{ fontSize: 12, color: '#B0855A', marginTop: 8 }}>⏱️ Pas de réponse</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <button onClick={() => router.push('/duel')} style={{ width: '100%', height: 48, marginTop: 22, border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Nouveau duel</button>
      </div>
    )
  }

  // ---------- Expiré (et pas terminé) ----------
  if (expire) return (
    <div style={{ paddingTop: 60, textAlign: 'center', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>⌛</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22 }}>Défi expiré</div>
      <p style={{ color: '#8A7E68', fontSize: 14 }}>Ce duel asynchrone a dépassé son délai de 48 h.</p>
      <button onClick={() => router.push('/duel')} style={{ marginTop: 10, padding: '11px 22px', border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Retour aux duels</button>
    </div>
  )

  // ---------- Jeu auto-rythmé ----------
  const q = match.deck[idx]
  if (!q) return <div style={{ paddingTop: 40, textAlign: 'center', color: '#9A8D72', fontFamily: FONT }}>…</div>
  const rep = answered[idx]

  return (
    <div style={{ paddingTop: 34, maxWidth: 640, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => router.push('/duel')} style={{ border: 'none', background: 'transparent', color: '#9A8D72', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: FONT }}>← Quitter</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8A7E68' }}>Question {idx + 1} / {total}</span>
      </div>
      <div style={{ height: 8, background: '#F0E7D6', borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ height: '100%', width: `${(nbRepondu / total) * 100}%`, background: '#2DAE83', borderRadius: 999, transition: 'width .25s' }} />
      </div>
      <div style={{ fontSize: 11.5, color: '#9A8D72', marginBottom: 14 }}>🕒 Duel asynchrone — joue à ton rythme, ton adversaire fera de même sous 48 h.</div>

      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: 22, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: q.cat === 'fiche' ? '#0F6E56' : '#8A5A10', marginBottom: 8 }}>{q.cat === 'fiche' ? 'FICHE' : 'QCM'}</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{q.enonce}</div>
        {q.multi && <div style={{ fontSize: 12, color: '#0F6E56', fontWeight: 600, marginTop: 6 }}>☑ Plusieurs réponses possibles</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
        {q.options.map((o, oi) => {
          const sel = selection.has(oi)
          let bg = '#FFFBF2', bd = '#EADFC9'
          if (verrou && rep) {
            if (rep.correct.includes(oi)) { bg = '#ECF7F0'; bd = '#BFE6CF' }
            else if (rep.choix.includes(oi)) { bg = '#FCEEEA'; bd = '#F3C6BC' }
          } else if (sel) { bg = '#FCEFD3'; bd = '#E8A11E' }
          return (
            <button key={oi} onClick={() => choisir(oi, q.multi)} disabled={verrou} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', cursor: verrou ? 'default' : 'pointer',
              border: `1.5px solid ${bd}`, background: bg, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontFamily: FONT, color: '#2A2018',
            }}>
              <span style={{ flexShrink: 0, width: 20, height: 20, marginTop: 1, borderRadius: q.multi ? 5 : '50%', border: `2px solid ${sel || (verrou && rep?.correct.includes(oi)) ? '#2DAE83' : '#C0B7A4'}`, background: (sel || (verrou && rep?.correct.includes(oi))) ? '#2DAE83' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>{(sel || (verrou && rep?.correct.includes(oi))) ? '✓' : ''}</span>
              <span style={{ flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{verrou && o.full ? o.full : o.t}</span>
              {verrou && rep?.correct.includes(oi) && <span style={{ fontSize: 11, fontWeight: 800, color: '#0F6E56', flexShrink: 0 }}>BONNE</span>}
            </button>
          )
        })}
      </div>

      {verrou && rep ? (
        <>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: rep.juste ? '#0F6E56' : '#C0392B', marginBottom: 12 }}>
            {rep.juste ? '✅ Bonne réponse !' : '❌ Raté — la bonne réponse est en vert.'}
          </div>
          <button onClick={suivant} style={{ width: '100%', height: 50, border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
            {idx + 1 >= total ? 'Voir mes résultats →' : 'Question suivante →'}
          </button>
        </>
      ) : (
        <button onClick={valider} disabled={selection.size === 0 || envoi} style={{ width: '100%', height: 50, border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: selection.size === 0 || envoi ? 0.5 : 1, fontFamily: FONT }}>
          {envoi ? '…' : 'Valider'}
        </button>
      )}
    </div>
  )
}
