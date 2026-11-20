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
        .in('id', ids).is('deleted_at', null).eq('suspendu', false)
      setItems((fich || []) as unknown as Item[])
      setLoading(false)
    }
    load()
  }, [])

  const font = "var(--font-texte)"

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 28, margin: 0 }}>Mon carnet d&apos;erreurs</h1>
      <p style={{ fontSize: 15, color: 'var(--c-annotation)', margin: '8px 0 22px', maxWidth: 600 }}>
        Les fiches que tu as trouvées difficiles (mal notées) se rassemblent ici automatiquement. Revois-les en priorité.
      </p>

      {loading ? (
        <div style={{ color: 'var(--c-annotation-clair)', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-annotation-clair)', background: 'var(--c-papier)', border: '1px dashed var(--c-filet-fort)', borderRadius: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--c-texte-doux)' }}>Ton carnet est vide.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Tu n&apos;as rien raté récemment — continue comme ça !</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--c-annotation)' }}><b style={{ color: '#C0392B' }}>{items.length}</b> fiche{items.length > 1 ? 's' : ''} à revoir</div>
            <Link href="/espaces/_/revision?carnet=1" style={{ padding: '11px 22px', borderRadius: 12, background: '#C0392B', color: '#fff', textDecoration: 'none', fontSize: 14.5, fontWeight: 700 }}>
              Réviser mon carnet →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(it => (
              <div key={it.id} style={{ background: '#fff', border: '1px solid var(--c-filet)', borderRadius: 14, padding: 16 }}>
                {it.modules?.espaces && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-annotation-clair)', marginBottom: 6 }}>
                    {it.modules.espaces.nom}{it.modules?.nom ? ` › ${it.modules.nom}` : ''}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <RichContent html={it.question} style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-encre)', lineHeight: 1.5, flex: 1 }} />
                  <a
                    href={`/dashboard#coach`}
                    onClick={() => {
                      const q = it.question.replace(/<[^>]+>/g, '').slice(0, 120)
                      localStorage.setItem('codex-coach-question', `Peux-tu m'expliquer : ${q}`)
                    }}
                    style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: '#7C5CBF', textDecoration: 'none', whiteSpace: 'nowrap', marginTop: 2 }}
                  >Poser au coach →</a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
