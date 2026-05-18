'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import type { Espace, Module, Fiche, Progression } from '@/types'
import { scoreGlobal, estDue } from '@/lib/spaced-repetition'
import Link from 'next/link'

export default function EspacePage() {
  const { slug } = useParams()
  const [espace, setEspace] = useState<Espace | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [fiches, setFiches] = useState<Fiche[]>([])
  const [progressions, setProgressions] = useState<Progression[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: esp } = await supabase.from('espaces').select('*').eq('slug', slug).single()
      if (!esp) return
      setEspace(esp)
      const { data: mods } = await supabase.from('modules').select('*').eq('espace_id', esp.id).order('ordre')
      setModules(mods || [])
      const modIds = (mods || []).map((m: Module) => m.id)
      const { data: fich } = await supabase.from('fiches').select('*').in('module_id', modIds)
      setFiches(fich || [])
      const fichIds = (fich || []).map((f: Fiche) => f.id)
      const { data: prog } = await supabase.from('progression').select('*').eq('utilisateur_id', user.id).in('fiche_id', fichIds)
      setProgressions(prog || [])
    }
    load()
  }, [slug])

  if (!espace) return <div style={{ padding: '2rem', color: '#888' }}>Chargement...</div>

  const score = scoreGlobal(progressions)
  const due = progressions.filter(p => estDue(p.prochaine_revision)).length

  return (
    <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            <Link href="/dashboard" style={{ color: '#888', textDecoration: 'none' }}>Accueil</Link> / {espace.nom}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: espace.couleur }}>{espace.nom}</h1>
          <p style={{ fontSize: 14, color: '#888', margin: 0 }}>{fiches.length} fiches · {modules.length} modules</p>
        </div>
        <div style={{ textAlign: 'center', background: '#EEEDFE', borderRadius: 12, padding: '12px 20px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: espace.couleur }}>{score}%</div>
          <div style={{ fontSize: 11, color: '#888' }}>Score</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        <Link href={`/espaces/${slug}/revision`}
          style={{ flex: 1, padding: '11px', borderRadius: 8, background: espace.couleur, color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
          Réviser ({due} dues)
        </Link>
        <Link href={`/espaces/${slug}/revision?mode=tout`}
          style={{ flex: 1, padding: '11px', borderRadius: 8, background: '#F5F5F5', color: '#555', fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
          Tout réviser (aléatoire)
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {modules.map(mod => {
          const fichMod = fiches.filter(f => f.module_id === mod.id)
          const progMod = progressions.filter(p => fichMod.find(f => f.id === p.fiche_id))
          const scoreMod = scoreGlobal(progMod)
          const dueMod = progMod.filter(p => estDue(p.prochaine_revision)).length
          const vues = progMod.length
          const maitrisees = progMod.filter(p => p.niveau === 3).length
          return (
            <div key={mod.id} style={{ background: '#fff', border: '0.5px solid #E5E5E5', borderRadius: 12, padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{mod.nom}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {dueMod > 0 && <span style={{ fontSize: 11, padding: '2px 8px', background: '#FAEEDA', color: '#854F0B', borderRadius: 20 }}>{dueMod} à revoir</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, color: espace.couleur }}>{scoreMod}%</span>
                </div>
              </div>
              <div style={{ height: 4, background: '#F0F0F0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${scoreMod}%`, background: espace.couleur, borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999' }}>
                <span>{vues}/{fichMod.length} vues</span>
                <span>{maitrisees} maîtrisées</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}