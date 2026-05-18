'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useSearchParams } from 'next/navigation'
import type { Fiche, Progression, Espace } from '@/types'
import { NIVEAUX, prochaineRevision, estDue } from '@/lib/spaced-repetition'
import Link from 'next/link'

export default function RevisionPage() {
  const { slug } = useParams()
  const searchParams = useSearchParams()
  const modeAlea = searchParams.get('mode') === 'tout'
  const [espace, setEspace] = useState<Espace | null>(null)
  const [deck, setDeck] = useState<Fiche[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [progressions, setProgressions] = useState<Record<string, Progression>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: esp } = await supabase.from('espaces').select('*').eq('slug', slug).single()
      if (!esp) return
      setEspace(esp)
      const { data: mods } = await supabase.from('modules').select('id').eq('espace_id', esp.id)
      const modIds = (mods || []).map((m: any) => m.id)
      const { data: fich } = await supabase.from('fiches').select('*').in('module_id', modIds)
      const fichList = fich || []
      const { data: prog } = await supabase.from('progression').select('*').eq('utilisateur_id', user.id).in('fiche_id', fichList.map((f: Fiche) => f.id))
      const progMap: Record<string, Progression> = {}
      ;(prog || []).forEach((p: Progression) => { progMap[p.fiche_id] = p })
      setProgressions(progMap)
      let d = modeAlea
        ? [...fichList].sort(() => Math.random() - 0.5)
        : fichList.filter((f: Fiche) => { const p = progMap[f.id]; return !p || estDue(p.prochaine_revision) }).sort(() => Math.random() - 0.5)
      if (d.length === 0) d = [...fichList].sort(() => Math.random() - 0.5)
      setDeck(d)
    }
    load()
  }, [slug, modeAlea])

  const rateCard = async (niveau: number) => {
    if (!userId || !deck[idx]) return
    const fiche = deck[idx]
    const nextRev = prochaineRevision(niveau)
    const prog = {
      utilisateur_id: userId,
      fiche_id: fiche.id,
      niveau,
      prochaine_revision: nextRev.toISOString(),
      derniere_revision: new Date().toISOString()
    }
    await supabase.from('progression').upsert(prog, { onConflict: 'utilisateur_id,fiche_id' })
    setProgressions(prev => ({ ...prev, [fiche.id]: prog as Progression }))
    if (idx + 1 < deck.length) { setIdx(i => i + 1); setFlipped(false) }
    else setDone(true)
  }

  if (!espace || deck.length === 0) return <div style={{ padding: '2rem', color: '#888', textAlign: 'center' }}>Chargement...</div>

  if (done) return (
    <div style={{ padding: '2rem', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Session terminée</h2>
      <p style={{ fontSize: 14, color: '#888', margin: '0 0 2rem' }}>{deck.length} fiches révisées</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={() => { setIdx(0); setFlipped(false); setDone(false) }}
          style={{ padding: '10px 20px', borderRadius: 8, background: espace.couleur, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Recommencer
        </button>
        <Link href={`/espaces/${slug}`}
          style={{ padding: '10px 20px', borderRadius: 8, background: '#F5F5F5', color: '#555', textDecoration: 'none', fontSize: 13 }}>
          Retour
        </Link>
      </div>
    </div>
  )

  const card = deck[idx]
  const prog = progressions[card.id]

  return (
    <div style={{ padding: '1.5rem', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Link href={`/espaces/${slug}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← Retour</Link>
        <span style={{ fontSize: 13, color: '#888' }}>{idx + 1} / {deck.length}</span>
      </div>
      <div style={{ height: 4, background: '#F0F0F0', borderRadius: 4, marginBottom: '1rem', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(idx / deck.length) * 100}%`, background: espace.couleur, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      {prog && (
        <div style={{ marginBottom: 8, textAlign: 'right', fontSize: 11, color: '#999' }}>
          Niveau actuel : <span style={{ color: NIVEAUX[prog.niveau].couleur, fontWeight: 600 }}>{NIVEAUX[prog.niveau].label}</span>
        </div>
      )}
      <div onClick={() => setFlipped(f => !f)}
        style={{ background: '#fff', border: '0.5px solid #E5E5E5', borderRadius: 16, padding: '2rem', minHeight: 240, cursor: 'pointer', marginBottom: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        {!flipped
          ? (<><div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>Question — cliquez pour voir la réponse</div><div style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 600, color: '#1A1A1A' }}>{card.question}</div></>)
          : (<><div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>Réponse</div><div style={{ fontSize: 14, lineHeight: 1.8, color: '#444' }}>{card.reponse}</div></>)
        }
      </div>
      {flipped ? (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10, textAlign: 'center' }}>Comment évaluez-vous votre réponse ?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {NIVEAUX.map((n, i) => (
              <button key={n.label} onClick={() => rateCard(i)}
                style={{ padding: '10px 4px', borderRadius: 10, border: `1px solid ${n.couleur}33`, background: n.bg, color: n.couleur, cursor: 'pointer', fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                {n.label}
                <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>
                  {i === 0 ? 'Maintenant' : i === 1 ? '+3 j' : i === 2 ? '+7 j' : '+21 j'}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => setFlipped(true)}
          style={{ width: '100%', padding: '13px', borderRadius: 10, background: espace.couleur, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          Voir la réponse
        </button>
      )}
    </div>
  )
}