'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace } from '@/types'
import Link from 'next/link'

export default function EspacesPage() {
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: esp } = await supabase.from('espaces').select('*').order('ordre')
      setEspaces(esp || [])
      setLoading(false)
    }
    load()
  }, [])

  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"

  if (loading) return (
    <div style={{ paddingTop: '4rem', textAlign: 'center', color: '#9A8D72', fontFamily: font }}>Chargement…</div>
  )

  return (
    <div style={{ paddingTop: '34px', fontFamily: font, color: '#2A2018' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: '-.01em' }}>
          Vos espaces
        </div>
        <div style={{ fontSize: 15, color: '#8A7E68', marginTop: 4 }}>
          {espaces.length} matière{espaces.length > 1 ? 's' : ''} à réviser.
        </div>
      </div>

      {espaces.length === 0 ? (
        <div style={{ fontSize: 14, color: '#9A8D72', textAlign: 'center', padding: '4rem 0' }}>
          Aucun espace pour le moment.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {/* Carte « Révision mixte » — accès direct à 40 fiches dues, toutes matières mélangées */}
          <Link href="/espaces/_/revision?mixte=1" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#FCEFE9', borderRadius: 18, padding: 22, border: '1.5px solid #F3C6BC', cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#DC4A2B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>🔀</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Révision mixte</div>
              <div style={{ fontSize: 13, color: '#A8705F', marginTop: 4 }}>40 fiches dues tirées au hasard, toutes matières mélangées — l&apos;entraînement le plus efficace.</div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#DC4A2B', padding: '3px 10px', borderRadius: 999 }}>Démarrer →</span>
              </div>
            </div>
          </Link>

          {espaces.map(espace => (
            <Link key={espace.id} href={`/espaces/${espace.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ background: '#fff', borderRadius: 18, padding: 22, border: '1px solid #F0E7D6', cursor: 'pointer' }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: espace.couleur + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>⚖️</div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{espace.nom}</div>
                {espace.description && (
                  <div style={{ fontSize: 13, color: '#9A8D72', marginTop: 4 }}>{espace.description}</div>
                )}
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: espace.couleur, background: espace.couleur + '18', padding: '3px 10px', borderRadius: 999 }}>Voir le contenu →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
