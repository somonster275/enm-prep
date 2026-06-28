'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Resultat = {
  id: string
  question: string
  reponse: string
  module_id: string
  modules: { nom: string; espaces: { nom: string; slug: string } | null } | null
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

export default function RecherchePage() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Resultat[]>([])
  const [loading, setLoading] = useState(false)
  const [cherche, setCherche] = useState(false)

  const lancer = async () => {
    const terme = q.trim().replace(/[,()%*]/g, ' ').trim()
    if (terme.length < 2) return
    setLoading(true); setCherche(true)
    const { data } = await supabase
      .from('fiches')
      .select('id, question, reponse, module_id, modules(nom, espaces(nom, slug))')
      .or(`question.ilike.%${terme}%,reponse.ilike.%${terme}%`)
      .is('deleted_at', null)
      .limit(50)
    setRes((data || []) as unknown as Resultat[])
    setLoading(false)
  }

  const font = "'Hanken Grotesk', sans-serif"

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>Rechercher une fiche</h1>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 20px' }}>Retrouve une notion par mot-clé dans toutes tes fiches.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lancer() }} autoFocus
          placeholder="Ex. « prescription », « dol », « légitime défense »…"
          style={{ flex: 1, border: '1.5px solid #EADFC9', borderRadius: 12, padding: '12px 16px', background: '#FFFBF2', fontSize: 15, outline: 'none', fontFamily: font }} />
        <button onClick={lancer} disabled={q.trim().length < 2} style={{ padding: '0 22px', borderRadius: 12, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14.5, fontWeight: 700, opacity: q.trim().length < 2 ? 0.5 : 1, fontFamily: font }}>Chercher</button>
      </div>

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Recherche…</div>
      ) : cherche && res.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>Aucune fiche ne correspond à « {q} ».</div>
      ) : res.length > 0 ? (
        <>
          <div style={{ fontSize: 13, color: '#9A8D72', marginBottom: 12 }}>{res.length} résultat{res.length > 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {res.map(r => {
              const href = r.modules?.espaces ? `/espaces/${r.modules.espaces.slug}/modules/${r.module_id}` : '#'
              return (
                <Link key={r.id} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14, padding: 16, cursor: 'pointer' }}>
                    {r.modules?.espaces && <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9A8D72', marginBottom: 6 }}>{r.modules.espaces.nom}{r.modules?.nom ? ` › ${r.modules.nom}` : ''}</div>}
                    <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4 }}>{stripHtml(r.question).slice(0, 160)}</div>
                    <div style={{ fontSize: 13, color: '#8A7E68', marginTop: 5, lineHeight: 1.5 }}>{stripHtml(r.reponse).slice(0, 180)}{stripHtml(r.reponse).length > 180 ? '…' : ''}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
