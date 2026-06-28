'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { construireDeck } from '@/lib/match'

type Qcm = { id: string; titre: string; matiere: string | null }
type Espace = { id: string; nom: string }
type MatchOuvert = { code: string; titre: string | null; hote: string; n: number }

const FONT = "'Hanken Grotesk', sans-serif"
const DISPLAY = "'Bricolage Grotesque', sans-serif"

export default function DuelAccueil() {
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [qcms, setQcms] = useState<Qcm[]>([])
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [ouverts, setOuverts] = useState<MatchOuvert[]>([])

  // Formulaire de création
  const [qcmId, setQcmId] = useState('')
  const [espaceId, setEspaceId] = useState('')
  const [nb, setNb] = useState(10)
  const [secs, setSecs] = useState(20)
  const [creating, setCreating] = useState(false)
  const [erreur, setErreur] = useState('')

  // Rejoindre par code
  const [code, setCode] = useState('')

  const chargerOuverts = async () => {
    const { data } = await supabase.from('matchs')
      .select('code, titre, statut, hote_id, match_joueurs(count)')
      .eq('statut', 'attente').order('created_at', { ascending: false }).limit(12)
    const lignes = (data || []).map((m: any) => ({
      code: m.code, titre: m.titre, hote: '', n: m.match_joueurs?.[0]?.count ?? 0,
    })) as MatchOuvert[]
    setOuverts(lignes)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUid(user.id)
      const [{ data: q }, { data: e }] = await Promise.all([
        supabase.from('qcm').select('id, titre, matiere').order('created_at', { ascending: false }),
        supabase.from('espaces').select('id, nom').order('ordre'),
      ])
      setQcms((q || []) as Qcm[])
      setEspaces((e || []) as Espace[])
      chargerOuverts()
    }
    load()
    // Rafraîchit la liste des salons en attente en temps réel.
    const canal = supabase.channel('matchs-ouverts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchs' }, chargerOuverts)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  const creer = async () => {
    setErreur('')
    if (!qcmId && !espaceId) { setErreur('Choisis au moins un QCM ou une matière.'); return }
    setCreating(true)
    try {
      const deck = await construireDeck({ qcmId: qcmId || null, espaceId: espaceId || null, nb })
      if (deck.length < 2) { setErreur('Pas assez de questions disponibles pour cette sélection.'); setCreating(false); return }
      const titre = [qcms.find(q => q.id === qcmId)?.titre, espaces.find(e => e.id === espaceId)?.nom].filter(Boolean).join(' + ') || 'Match'

      // La création passe par le serveur : il sépare le paquet public des
      // solutions (jamais envoyées aux clients) et génère le code.
      const res = await fetch('/api/duel/creer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre, deck, secondes: secs }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.code) { setErreur(j.error || 'Impossible de créer le salon, réessaie.'); setCreating(false); return }
      router.push(`/duel/${j.code}`)
    } catch {
      setErreur('Erreur lors de la création.'); setCreating(false)
    }
  }

  const rejoindre = (c: string) => {
    const v = c.trim().toUpperCase()
    if (v.length < 4) return
    router.push(`/duel/${v}`)
  }

  const champ: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #EADFC9', borderRadius: 12, padding: '11px 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', fontFamily: FONT }

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, margin: 0 }}>Duel</h1>
        <Link href="/duel/historique" style={{ fontSize: 13.5, fontWeight: 600, color: '#9A8D72', textDecoration: 'none' }}>Mes duels →</Link>
      </div>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 24px', maxWidth: 560 }}>
        Affronte d&apos;autres candidats en temps réel sur les mêmes questions — QCM et fiches mélangés, chrono et classement live. À deux ou en groupe.
      </p>

      {/* Rejoindre par code */}
      <div style={{ background: '#2A2018', borderRadius: 18, padding: 22, marginBottom: 20, color: '#fff', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Rejoindre un match</div>
          <div style={{ fontSize: 13, color: '#CDBFA6', marginTop: 2 }}>Entre le code partagé par l&apos;organisateur.</div>
        </div>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') rejoindre(code) }}
          placeholder="CODE" maxLength={6}
          style={{ width: 140, textAlign: 'center', letterSpacing: 4, fontWeight: 800, fontSize: 18, border: 'none', borderRadius: 12, padding: '12px 10px', background: '#fff', color: '#2A2018', outline: 'none', fontFamily: DISPLAY }} />
        <button onClick={() => rejoindre(code)} disabled={code.trim().length < 4} style={{ height: 48, padding: '0 22px', border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', opacity: code.trim().length < 4 ? 0.5 : 1, fontFamily: FONT }}>Rejoindre</button>
      </div>

      {/* Créer un match */}
      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: 22, marginBottom: 26 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Créer un match</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 220px', fontSize: 13, color: '#8A7E68' }}>
              QCM (facultatif)
              <select value={qcmId} onChange={e => setQcmId(e.target.value)} style={{ ...champ, marginTop: 5 }}>
                <option value="">— Aucun —</option>
                {qcms.map(q => <option key={q.id} value={q.id}>{q.titre}{q.matiere ? ` · ${q.matiere}` : ''}</option>)}
              </select>
            </label>
            <label style={{ flex: '1 1 220px', fontSize: 13, color: '#8A7E68' }}>
              Fiches d&apos;une matière (facultatif)
              <select value={espaceId} onChange={e => setEspaceId(e.target.value)} style={{ ...champ, marginTop: 5 }}>
                <option value="">— Aucune —</option>
                {espaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 160px', fontSize: 13, color: '#8A7E68' }}>
              Nombre de questions
              <select value={nb} onChange={e => setNb(parseInt(e.target.value))} style={{ ...champ, marginTop: 5 }}>
                {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n} questions</option>)}
              </select>
            </label>
            <label style={{ flex: '1 1 160px', fontSize: 13, color: '#8A7E68' }}>
              Temps par question
              <select value={secs} onChange={e => setSecs(parseInt(e.target.value))} style={{ ...champ, marginTop: 5 }}>
                {[10, 15, 20, 30, 45].map(s => <option key={s} value={s}>{s} secondes</option>)}
              </select>
            </label>
          </div>
          {erreur && <div style={{ fontSize: 13.5, color: '#D94A30' }}>{erreur}</div>}
          <button onClick={creer} disabled={creating} style={{ alignSelf: 'flex-start', height: 48, padding: '0 26px', border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.7 : 1, fontFamily: FONT }}>
            {creating ? 'Création…' : 'Créer le salon →'}
          </button>
        </div>
      </div>

      {/* Salons ouverts */}
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Salons en attente</div>
      {ouverts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>
          Aucun salon ouvert. Crée le tien et partage le code !
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ouverts.map(m => (
            <div key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 16, letterSpacing: 2, color: '#DC4A2B' }}>{m.code}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{m.titre || 'Match'}</span>
              <span style={{ fontSize: 12.5, color: '#9A8D72' }}>{m.n} joueur{m.n > 1 ? 's' : ''}</span>
              <button onClick={() => rejoindre(m.code)} style={{ border: 'none', background: '#FCEFD3', color: '#8A5A10', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Rejoindre</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
