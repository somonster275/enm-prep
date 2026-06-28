'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import RichContent from '@/components/RichContent'

type Item = {
  id: string
  question: string
  modules: { nom: string; espaces: { nom: string } | null } | null
}

export default function CarnetPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prog } = await supabase.from('progression').select('fiche_id').eq('utilisateur_id', user.id).lte('niveau', 1)
      const ids = (prog || []).map((p: { fiche_id: string }) => p.fiche_id)
      if (ids.length === 0) { setLoading(false); return }
      const { data: fich } = await supabase
        .from('fiches')
        .select('id, question, modules(nom, espaces(nom))')
        .in('id', ids).is('deleted_at', null)
      setItems((fich || []) as unknown as Item[])
      setLoading(false)
    }
    load()
  }, [])

  const font = "'Hanken Grotesk', sans-serif"

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>Mon carnet d&apos;erreurs</h1>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 22px', maxWidth: 600 }}>
        Les fiches que tu as trouvées difficiles (mal notées) se rassemblent ici automatiquement. Revois-les en priorité.
      </p>

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#6E6456' }}>Ton carnet est vide.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Tu n&apos;as rien raté récemment — continue comme ça !</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#8A7E68' }}><b style={{ color: '#C0392B' }}>{items.length}</b> fiche{items.length > 1 ? 's' : ''} à revoir</div>
            <Link href="/espaces/_/revision?carnet=1" style={{ padding: '11px 22px', borderRadius: 12, background: '#C0392B', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 700 }}>
              Réviser mon carnet →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(it => (
              <div key={it.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14, padding: 16 }}>
                {it.modules?.espaces && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9A8D72', marginBottom: 6 }}>
                    {it.modules.espaces.nom}{it.modules?.nom ? ` › ${it.modules.nom}` : ''}
                  </div>
                )}
                <RichContent html={it.question} style={{ fontSize: 14, fontWeight: 600, color: '#2A2018', lineHeight: 1.5 }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
