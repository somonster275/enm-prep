'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, ecrire } from '@/lib/supabase'
import type { PersoModule } from '@/lib/espace-perso'

const LIBELLES = { module: 'Module', qcm: 'QCM', mindmap: 'Mind map' } as const

export default function MonEspacePage() {
  const [modules, setModules] = useState<(PersoModule & { nb: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [tableManquante, setTableManquante] = useState(false)

  useEffect(() => {
    supabase.from('perso_modules').select('*, perso_elements(count)').eq('perso_elements.supprime', false).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setTableManquante(true) // migration 0048 pas encore passée
        setModules(((data || []) as (PersoModule & { perso_elements: { count: number }[] })[])
          .map(m => ({ ...m, nb: m.perso_elements?.[0]?.count ?? 0 })))
        setLoading(false)
      })
  }, [])

  const supprimer = async (m: PersoModule) => {
    if (!confirm(`Retirer « ${m.nom} » de ton espace ? Tes modifications et ta progression sur cette copie seront perdues.`)) return
    if (!(await ecrire(supabase.from('perso_modules').delete().eq('id', m.id).select('id')))) return
    setModules(l => l.filter(x => x.id !== m.id))
  }

  const font = 'var(--font-texte)'
  return (
    <div style={{ paddingTop: 34, maxWidth: 820, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      <h1 style={{ fontFamily: 'var(--font-titre)', fontWeight: 'var(--titre-poids)', fontSize: 28, margin: 0 }}>Mon espace</h1>
      <p style={{ fontSize: 15, color: 'var(--c-annotation)', margin: '8px 0 20px' }}>
        Tes copies personnelles des modules, QCM et mind maps. Modifie-les librement : toi seul les vois.
        Pour en ajouter, ouvre un module, un QCM ou une mind map et choisis « Télécharger dans mon espace ».
      </p>

      {loading ? (
        <div style={{ color: 'var(--c-annotation-clair)', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : tableManquante ? (
        <div role="alert" style={{ color: 'var(--c-accent)', padding: 20 }}>Mon espace n&apos;est pas encore activé (migration 0048 à exécuter).</div>
      ) : modules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-annotation-clair)', background: 'var(--c-papier)', border: '1px dashed var(--c-filet-fort)', borderRadius: 6 }}>
          Ton espace est vide. <Link href="/espaces" style={{ color: 'var(--c-accent)', fontWeight: 600 }}>Parcourir les espaces</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modules.map(m => (
            <div key={m.id} style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link href={`/mon-espace/${m.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{m.nom}</div>
                <div style={{ fontSize: 12.5, color: 'var(--c-annotation)', marginTop: 2 }}>
                  {m.source_type ? LIBELLES[m.source_type] : 'Perso'} · {m.nb} élément{m.nb > 1 ? 's' : ''}
                </div>
              </Link>
              <button onClick={() => supprimer(m)} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--c-accent-pale)', color: 'var(--c-accent)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font }}>Retirer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
