'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { PersoModule } from '@/lib/espace-perso'
import { rafraichir, muter, preparerPages } from '@/lib/hors-ligne'

const LIBELLES = { module: 'Module', qcm: 'QCM', mindmap: 'Mind map' } as const

export default function MonEspacePage() {
  const [modules, setModules] = useState<(PersoModule & { nb: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [tableManquante, setTableManquante] = useState(false)

  useEffect(() => {
    // Copie locale (rechargée depuis Supabase si le réseau est là) : la page marche aussi hors ligne.
    rafraichir().then(s => {
      if (!s) setTableManquante(true)
      setModules((s?.modules || []).map(m => ({ ...m, nb: s!.elements.filter(e => e.perso_module_id === m.id && !e.supprime).length })))
      setLoading(false)
      if (s) preparerPages(s.modules.map(m => m.id)) // pages gardées pour les ouvrir sans réseau
    })
  }, [])

  const supprimer = async (m: PersoModule) => {
    if (!confirm(`Retirer « ${m.nom} » de ton espace ? Tes modifications et ta progression sur cette copie seront perdues.`)) return
    await muter({ table: 'perso_modules', action: 'delete', filtre: { id: m.id } })
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
        <div role="alert" style={{ color: 'var(--c-accent)', padding: 20 }}>Mon espace n&apos;a pas pu être chargé. Connecte-toi à internet une première fois pour le télécharger sur cet appareil.</div>
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
