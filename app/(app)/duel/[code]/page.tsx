'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { reponseJuste, pointsReponse, type MatchQuestion } from '@/lib/match'
import { enregistrerActivite } from '@/lib/streaks'

type Match = {
  id: string; code: string; hote_id: string; titre: string | null; statut: string
  deck: MatchQuestion[]; secondes_par_question: number; started_at: string | null
}
type Joueur = { user_id: string; pseudo: string; score: number; repondu: number; justes: number; termine: boolean }

const FONT = "'Hanken Grotesk', sans-serif"
const DISPLAY = "'Bricolage Grotesque', sans-serif"

export default function SalleDuel() {
  const { code } = useParams()
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [match, setMatch] = useState<Match | null>(null)
  const [joueurs, setJoueurs] = useState<Joueur[]>([])
  const [introuvable, setIntrouvable] = useState(false)

  // État de jeu local
  const [idx, setIdx] = useState(0)
  const [reste, setReste] = useState(0)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [verrou, setVerrou] = useState(false)        // a validé cette question
  const [fini, setFini] = useState(false)

  // Accumulateurs (refs pour rester stables dans le tick)
  const score = useRef(0), justes = useRef(0), repondu = useRef(0)
  const traitees = useRef<Set<number>>(new Set())
  const idxRef = useRef(0)
  const finiRef = useRef(false)
  const selectionRef = useRef<Set<number>>(new Set())
  useEffect(() => { selectionRef.current = selection }, [selection])

  const codeStr = String(code).toUpperCase()

  // --- Chargement initial du match + abonnements temps réel ---
  const chargerJoueurs = useCallback(async (matchId: string) => {
    const { data } = await supabase.from('match_joueurs').select('*').eq('match_id', matchId).order('score', { ascending: false })
    setJoueurs((data || []) as Joueur[])
  }, [])

  useEffect(() => {
    let canalMatch: ReturnType<typeof supabase.channel> | null = null
    let canalJoueurs: ReturnType<typeof supabase.channel> | null = null

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUid(user.id)

      const { data: m } = await supabase.from('matchs').select('*').eq('code', codeStr).maybeSingle()
      if (!m) { setIntrouvable(true); return }
      const mm = m as Match
      setMatch(mm)

      // Rejoint le match (le trigger force pseudo = vrai nom).
      await supabase.from('match_joueurs').upsert(
        { match_id: mm.id, user_id: user.id, pseudo: '' },
        { onConflict: 'match_id,user_id', ignoreDuplicates: true },
      )

      // Reprise : on amorce les accumulateurs depuis la ligne en base, sinon
      // un rafraîchissement en cours de partie écraserait le score par 0.
      const { data: moi } = await supabase.from('match_joueurs')
        .select('score, justes, repondu').eq('match_id', mm.id).eq('user_id', user.id).maybeSingle()
      if (moi) { score.current = moi.score; justes.current = moi.justes; repondu.current = moi.repondu }
      // Les questions déjà écoulées ne doivent pas pouvoir être re-notées.
      if (mm.statut === 'en_cours' && mm.started_at) {
        const cur = Math.floor((Date.now() - Date.parse(mm.started_at)) / 1000 / mm.secondes_par_question)
        for (let i = 0; i < cur; i++) traitees.current.add(i)
        idxRef.current = Math.max(0, cur)
      }
      chargerJoueurs(mm.id)

      canalMatch = supabase.channel(`match-${mm.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matchs', filter: `id=eq.${mm.id}` },
          payload => setMatch(prev => ({ ...(prev as Match), ...(payload.new as Match) })))
        .subscribe()

      canalJoueurs = supabase.channel(`joueurs-${mm.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'match_joueurs', filter: `match_id=eq.${mm.id}` },
          () => chargerJoueurs(mm.id))
        .subscribe()
    }
    load()
    return () => { if (canalMatch) supabase.removeChannel(canalMatch); if (canalJoueurs) supabase.removeChannel(canalJoueurs) }
  }, [codeStr, chargerJoueurs])

  // --- Enregistre la réponse à une question (manuel ou par expiration) ---
  const valider = useCallback(async (qIdx: number, sel: Set<number>, resteSec: number) => {
    if (!match || traitees.current.has(qIdx) || !match.deck[qIdx]) return
    traitees.current.add(qIdx)
    const juste = reponseJuste(match.deck[qIdx], sel)
    const pts = pointsReponse(juste, resteSec, match.secondes_par_question)
    score.current += pts
    if (juste) justes.current += 1
    if (sel.size > 0) repondu.current += 1
    await supabase.from('match_joueurs')
      .update({ score: score.current, justes: justes.current, repondu: repondu.current })
      .eq('match_id', match.id).eq('user_id', uid)
  }, [match, uid])

  // --- Horloge synchronisée : l'index de question découle de started_at ---
  useEffect(() => {
    if (!match || match.statut !== 'en_cours' || !match.started_at) return
    const startMs = Date.parse(match.started_at)
    const secs = match.secondes_par_question
    const total = match.deck.length

    const tick = () => {
      if (finiRef.current) return
      const elapsed = (Date.now() - startMs) / 1000
      const cur = Math.floor(elapsed / secs)

      if (cur >= total) {
        // Finalise la dernière question éventuelle puis termine.
        if (idxRef.current < total) valider(idxRef.current, selectionRef.current, 0)
        finir()
        return
      }
      if (cur !== idxRef.current) {
        // On a changé de question : finalise la précédente (réponse en cours ou vide).
        valider(idxRef.current, selectionRef.current, 0)
        idxRef.current = cur
        setIdx(cur)
        setSelection(new Set()); selectionRef.current = new Set()
        setVerrou(false)
      }
      setReste(Math.max(0, secs - (elapsed % secs)))
    }
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.statut, match?.started_at])

  const finir = useCallback(async () => {
    if (finiRef.current) return
    finiRef.current = true
    setFini(true)
    if (match) {
      await supabase.from('match_joueurs').update({ termine: true }).eq('match_id', match.id).eq('user_id', uid)
      enregistrerActivite(uid)
      // L'hôte clôt officiellement le match.
      if (match.hote_id === uid && match.statut !== 'termine') {
        await supabase.from('matchs').update({ statut: 'termine', ended_at: new Date().toISOString() }).eq('id', match.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fini, match, uid])

  // --- Actions ---
  const lancer = async () => {
    if (!match) return
    await supabase.from('matchs').update({ statut: 'en_cours', started_at: new Date().toISOString() }).eq('id', match.id)
  }

  const choisir = (oi: number, multi: boolean) => {
    if (verrou) return
    setSelection(s => {
      const n = new Set(s)
      if (multi) { n.has(oi) ? n.delete(oi) : n.add(oi) } else { n.clear(); n.add(oi) }
      return n
    })
  }

  const validerManuel = () => {
    if (verrou || !match) return
    setVerrou(true)
    valider(idx, selection, reste)
  }

  // ===================== RENDU =====================
  if (introuvable) return (
    <div style={{ paddingTop: 60, textAlign: 'center', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22 }}>Salon introuvable</div>
      <p style={{ color: '#8A7E68', fontSize: 14 }}>Le code « {codeStr} » ne correspond à aucun match.</p>
      <button onClick={() => router.push('/duel')} style={{ marginTop: 10, padding: '11px 22px', border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Retour aux duels</button>
    </div>
  )
  if (!match) return <div style={{ paddingTop: 40, textAlign: 'center', color: '#9A8D72', fontFamily: FONT }}>Chargement…</div>

  const estHote = match.hote_id === uid
  const classement = [...joueurs].sort((a, b) => b.score - a.score || b.justes - a.justes)
  const total = match.deck.length

  // ---- LOBBY ----
  if (match.statut === 'attente') return (
    <div style={{ paddingTop: 34, maxWidth: 620, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ background: '#FFC02E', borderRadius: 20, padding: 26, textAlign: 'center', marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: '#FFCE54', right: -40, top: -50 }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7A5E14' }}>Code du salon</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, letterSpacing: 8, margin: '6px 0 4px' }}>{match.code}</div>
          <div style={{ fontSize: 13.5, color: '#5C4A22', fontWeight: 600 }}>{match.titre} · {total} questions · {match.secondes_par_question}s/question</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17 }}>Joueurs ({joueurs.length})</div>
        <button onClick={() => { navigator.clipboard?.writeText(`${location.origin}/duel/${match.code}`) }} style={{ border: '1px solid #EADFC9', background: '#fff', color: '#8A7E68', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Copier le lien</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
        {joueurs.map(j => (
          <div key={j.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '11px 16px' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#DC4A2B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{j.pseudo.slice(0, 1).toUpperCase()}</span>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{j.pseudo}{j.user_id === uid && ' (toi)'}</span>
            {j.user_id === match.hote_id && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#8A5A10', background: '#FCEFD3', padding: '2px 9px', borderRadius: 999 }}>Hôte</span>}
          </div>
        ))}
      </div>

      {estHote ? (
        <button onClick={lancer} disabled={joueurs.length < 2} style={{ width: '100%', height: 52, border: 'none', borderRadius: 14, background: '#DC4A2B', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: joueurs.length < 2 ? 0.5 : 1, fontFamily: FONT }}>
          {joueurs.length < 2 ? 'En attente d\'un second joueur…' : 'Lancer le match →'}
        </button>
      ) : (
        <div style={{ textAlign: 'center', color: '#8A7E68', fontSize: 14, padding: '14px 0' }}>En attente du lancement par l&apos;hôte…</div>
      )}
    </div>
  )

  // ---- RÉSULTATS ----
  if (fini || match.statut === 'termine') return (
    <div style={{ paddingTop: 34, maxWidth: 560, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 46 }}>🏁</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26 }}>Match terminé</div>
        <div style={{ fontSize: 14, color: '#8A7E68' }}>{match.titre} · {total} questions</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {classement.map((j, i) => (
          <div key={j.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14,
            background: j.user_id === uid ? '#FCE9E3' : '#fff', border: `1px solid ${j.user_id === uid ? '#F3C6BC' : '#F0E7D6'}`,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, width: 36, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{j.pseudo}{j.user_id === uid && ' (toi)'}</div>
              <div style={{ fontSize: 12.5, color: '#9A8D72' }}>{j.justes}/{total} bonnes réponses</div>
            </div>
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: '#DC4A2B' }}>{j.score}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button onClick={() => router.push('/duel')} style={{ flex: 1, height: 48, border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Nouveau duel</button>
      </div>
    </div>
  )

  // ---- JEU (statut en_cours) ----
  const q = match.deck[idx]
  if (!q) return <div style={{ paddingTop: 40, textAlign: 'center', color: '#9A8D72', fontFamily: FONT }}>…</div>
  const multi = q.options.filter(o => o.c).length > 1
  const pctTemps = (reste / match.secondes_par_question) * 100

  return (
    <div style={{ paddingTop: 34, maxWidth: 640, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      {/* Barre de temps + progression */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8A7E68' }}>Question {idx + 1} / {total}</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: reste <= 5 ? '#DC4A2B' : '#2A2018' }}>{Math.ceil(reste)}s</span>
      </div>
      <div style={{ height: 8, background: '#F0E7D6', borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ height: '100%', width: `${pctTemps}%`, background: reste <= 5 ? '#DC4A2B' : '#2DAE83', borderRadius: 999, transition: 'width .25s linear' }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: 22, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: q.cat === 'fiche' ? '#0F6E56' : '#8A5A10', marginBottom: 8 }}>{q.cat === 'fiche' ? 'FICHE' : 'QCM'}</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }}>{q.enonce}</div>
        {multi && <div style={{ fontSize: 12, color: '#0F6E56', fontWeight: 600, marginTop: 6 }}>☑ Plusieurs réponses possibles</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
        {q.options.map((o, oi) => {
          const sel = selection.has(oi)
          return (
            <button key={oi} onClick={() => choisir(oi, multi)} disabled={verrou} style={{
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: verrou ? 'default' : 'pointer',
              border: `1.5px solid ${sel ? '#E8A11E' : '#EADFC9'}`, background: sel ? '#FCEFD3' : '#FFFBF2',
              borderRadius: 12, padding: '13px 16px', fontSize: 15, fontFamily: FONT, color: '#2A2018', opacity: verrou && !sel ? 0.6 : 1,
            }}>
              <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: multi ? 5 : '50%', border: `2px solid ${sel ? '#E8A11E' : '#C0B7A4'}`, background: sel ? '#E8A11E' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>{sel ? '✓' : ''}</span>
              <span style={{ flex: 1 }}>{o.t}</span>
            </button>
          )
        })}
      </div>

      {verrou ? (
        <div style={{ textAlign: 'center', color: '#0F6E56', fontWeight: 700, fontSize: 14.5 }}>✓ Réponse enregistrée — en attente de la prochaine question…</div>
      ) : (
        <button onClick={validerManuel} disabled={selection.size === 0} style={{ width: '100%', height: 50, border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: selection.size === 0 ? 0.5 : 1, fontFamily: FONT }}>
          Valider
        </button>
      )}

      {/* Mini classement live */}
      <div style={{ marginTop: 26 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9A8D72', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Classement live</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {classement.map((j, i) => (
            <div key={j.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, padding: '7px 12px', borderRadius: 9, background: j.user_id === uid ? '#FCE9E3' : '#fff', border: '1px solid #F0E7D6' }}>
              <span style={{ width: 22, fontWeight: 700, color: '#9A8D72' }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: j.user_id === uid ? 700 : 600 }}>{j.pseudo}{j.user_id === uid && ' (toi)'}</span>
              <span style={{ fontWeight: 700, color: '#DC4A2B' }}>{j.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
