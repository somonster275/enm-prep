'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace, Progression } from '@/types'
import { scoreGlobal, estDue } from '@/lib/spaced-repetition'
import Link from 'next/link'

const COULEURS_BG: Record<string, string> = {
  '#534AB7': '#EEEDFE', '#185FA5': '#E6F1FB', '#0F6E56': '#E1F5EE',
  '#854F0B': '#FAEEDA', '#993C1D': '#FAECE7', '#993556': '#FBEAF0', '#3B6D11': '#EAF3DE',
}

export default function Dashboard() {
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [progressions, setProgressions] = useState<Progression[]>([])
  const [fiches, setFiches] = useState<{id: string, espace_id: string}[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: esp }, { data: prog }, { data: fich }] = await Promise.all([
        supabase.from('espaces').select('*').order('ordre'),
        supabase.from('progression').select('*').eq('utilisateur_id', user.id),
        supabase.from('fiches').select('id, modules(espace_id)'),
      ])
      setEspaces(esp || [])
      setProgressions(prog || [])
      setFiches((fich || []).map((f: any) => ({ id: f.id, espace_id: f.modules?.espace_id })))
      setLoading(false)
    }
    load()
  }, [])

  const score = scoreGlobal(progressions)
  const totalDue = progressions.filter(p => estDue(p.prochaine_revision)).length

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Chargement...</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Tableau de bord</h1>
          <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Préparation ENM</p>
        </div>
        <div style={{ textAlign: 'center', background: '#EEEDFE', borderRadius: 16, padding: '16px 24px' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#534AB7' }}>{score}%</div>
          <div style={{ fontSize: 12, color: '#534AB7' }}>Score global</div>
        </div>
      </div>

      {totalDue > 0 && (
        <div style={{ background: '#EEEDFE', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#534AB7' }}>{totalDue} fiches à réviser</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Des révisions sont dues aujourd'hui</div>
          </div>
          <Link href="/revision/toutes" style={{ padding: '8px 16px', borderRadius: 8, background: '#534AB7', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Réviser maintenant
          </Link>
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Mes espaces</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {espaces.map(espace => {
          const fichesEspace = fiches.filter(f => f.espace_id === espace.id)
          const progsEspace = progressions.filter(p => fichesEspace.find(f => f.id === p.fiche_id))
          const score = scoreGlobal(progsEspace)
          const due = progsEspace.filter(p => estDue(p.prochaine_revision)).length
          const bg = COULEURS_BG[espace.couleur] || '#EEEDFE'
          return (
            <Link key={espace.id} href={`/espaces/${espace.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '0.5px solid #E5E5E5', borderLeft: `4px solid ${espace.couleur}`, borderRadius: 12, padding: '1rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{espace.nom}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: espace.couleur, background: bg, padding: '3px 10px', borderRadius: 20 }}>{score}%</div>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{espace.description}</div>
                <div style={{ height: 4, background: '#F0F0F0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${score}%`, background: espace.couleur, borderRadius: 4 }} />
                </div>
                {due > 0 && <div style={{ fontSize: 11, color: '#854F0B', background: '#FAEEDA', padding: '2px 8px', borderRadius: 20, display: 'inline-block' }}>{due} à revoir</div>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
