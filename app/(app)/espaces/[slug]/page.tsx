'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import type { Espace, Module, Fiche, Progression } from '@/types'
import { scoreGlobal, estDue } from '@/lib/spaced-repetition'
import Link from 'next/link'

type ToolItem = { id: string; titre: string; url: string | null; type?: string | null }

const TOOLS = [
  { key: 'mindmaps', titre: 'Mind maps', icone: '🧠', accent: '#2DAE83', href: '/mind-maps' },
  { key: 'medias', titre: 'Audio & Vidéo', icone: '🎧', accent: '#3B82D9', href: '/media' },
  { key: 'qcm', titre: 'QCM', icone: '✅', accent: '#E8A11E', href: '/qcm' },
] as const

export default function EspacePage() {
  const { slug } = useParams()
  const [espace, setEspace] = useState<Espace | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [fiches, setFiches] = useState<Fiche[]>([])
  const [progressions, setProgressions] = useState<Progression[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [tools, setTools] = useState<Record<string, ToolItem[]>>({ mindmaps: [], medias: [], qcm: [] })
  const [cours, setCours] = useState<{ id: string; titre: string; type: string | null; module_id: string | null }[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profils').select('role').eq('id', user.id).single()
      setIsAdmin(prof?.role === 'admin' || prof?.role === 'editeur')

      const { data: esp } = await supabase.from('espaces').select('*').eq('slug', slug).single()
      if (!esp) return
      setEspace(esp)

      const { data: mods } = await supabase.from('modules').select('*').eq('espace_id', esp.id).is('parent_id', null).is('deleted_at', null).order('ordre')
      setModules(mods || [])
      const modIds = (mods || []).map((m: Module) => m.id)
      const { data: fich } = await supabase.from('fiches').select('*').in('module_id', modIds).is('deleted_at', null).eq('suspendu', false)
      setFiches(fich || [])
      const fichIds = (fich || []).map((f: Fiche) => f.id)
      const { data: prog } = await supabase.from('progression').select('*').eq('utilisateur_id', user.id).in('fiche_id', fichIds)
      setProgressions(prog || [])

      // Contenus des autres outils, filtrés sur cette matière (#). Robuste si la table n'existe pas encore.
      const fetchTool = async (table: string): Promise<ToolItem[]> => {
        const { data } = await supabase.from(table).select('id, titre, url, type').eq('espace_id', esp.id).is('deleted_at', null).order('created_at', { ascending: false })
        return (data as ToolItem[]) || []
      }
      const [mm, md, qc] = await Promise.all([fetchTool('mindmaps'), fetchTool('medias'), fetchTool('qcm')])
      setTools({ mindmaps: mm, medias: md, qcm: qc })

      // Cours rattachés à cette matière.
      const { data: cs } = await supabase.from('cours').select('id, titre, type, module_id').eq('espace_id', esp.id).order('created_at', { ascending: false })
      setCours((cs || []) as { id: string; titre: string; type: string | null; module_id: string | null }[])
    }
    load()
  }, [slug])

  if (!espace) return <div style={{ padding: '2rem', color: '#888', fontFamily: "'Hanken Grotesk', sans-serif" }}>Chargement...</div>

  const score = scoreGlobal(progressions)
  const due = progressions.filter(p => estDue(p.prochaine_revision)).length
  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"

  return (
    <div style={{ paddingTop: '34px', maxWidth: 800, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 13, color: '#9A8D72', marginBottom: 6 }}>
            <Link href="/espaces" style={{ color: '#9A8D72', textDecoration: 'none' }}>Espaces</Link> / {espace.nom}
          </div>
          <h1 style={{ fontFamily: display, fontSize: 26, fontWeight: 800, margin: '0 0 4px', color: espace.couleur }}>
            {espace.nom}
          </h1>
          <p style={{ fontSize: 14, color: '#9A8D72', margin: 0 }}>{modules.length} module{modules.length > 1 ? 's' : ''}</p>
        </div>
        {score > 0 && (
          <div style={{ textAlign: 'center', background: espace.couleur + '18', borderRadius: 14, padding: '14px 22px' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: espace.couleur, fontFamily: display }}>{score}%</div>
            <div style={{ fontSize: 11, color: '#9A8D72' }}>Fiches maîtrisées</div>
          </div>
        )}
      </div>

      {/* ===== FICHES ===== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🗂️</span>
        <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, margin: 0 }}>Fiches</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <Link href={`/espaces/${slug}/revision`} style={{
          flex: 1, padding: '12px', borderRadius: 10, background: espace.couleur, color: '#fff',
          fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center', fontFamily: font,
        }}>Réviser ({due} dues)</Link>
        <Link href={`/espaces/${slug}/revision?mode=tout`} style={{
          flex: 1, padding: '12px', borderRadius: 10, background: '#fff', color: '#8A7E68',
          fontSize: 13, textDecoration: 'none', textAlign: 'center', fontFamily: font,
          border: '1px solid #F0E7D6',
        }}>Tout réviser (aléatoire)</Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
        {modules.map(mod => {
          const fichMod = fiches.filter(f => f.module_id === mod.id)
          const progMod = progressions.filter(p => fichMod.find(f => f.id === p.fiche_id))
          const scoreMod = scoreGlobal(progMod)
          const dueMod = progMod.filter(p => estDue(p.prochaine_revision)).length
          const vues = progMod.length
          const maitrisees = progMod.filter(p => (p.palier ?? 0) >= 4).length
          return (
            <Link key={mod.id} href={`/espaces/${slug}/modules/${mod.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '1rem 1.25rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{mod.nom}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {dueMod > 0 && <span style={{ fontSize: 11, padding: '2px 8px', background: '#FAEEDA', color: '#854F0B', borderRadius: 20 }}>{dueMod} à revoir</span>}
                    <span style={{ fontSize: 13, fontWeight: 700, color: espace.couleur }}>{scoreMod}%</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>
                <div style={{ height: 4, background: '#F1E4CE', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${scoreMod}%`, background: espace.couleur, borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9A8D72' }}>
                  <span>{vues}/{fichMod.length} vues</span>
                  <span>{maitrisees} maîtrisées</span>
                </div>
              </div>
            </Link>
          )
        })}
        {modules.length === 0 && (
          <div style={{ fontSize: 14, color: '#9A8D72', padding: '1rem 0' }}>
            Aucun module dans cette matière. Créez-en depuis l'éditeur.
          </div>
        )}
      </div>

      {/* ===== COURS (rattachés à cette matière) ===== */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📘</span>
            <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, margin: 0 }}>Cours</h2>
          </div>
          {isAdmin && <Link href="/cours" style={{ fontSize: 13, fontWeight: 600, color: '#3B82D9', textDecoration: 'none' }}>+ Ajouter</Link>}
        </div>
        {cours.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9A8D72', padding: '0.5rem 0' }}>Aucun cours dans cette matière pour l&apos;instant.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cours.map(c => (
              <Link key={c.id} href={`/cours?c=${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
                    <span>{c.type === 'pdf' ? '📕' : '📘'}</span>{c.titre}
                  </div>
                  <span style={{ fontSize: 12, color: '#3B82D9', fontWeight: 600, flexShrink: 0 }}>Consulter →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ===== AUTRES OUTILS (filtrés sur cette matière) ===== */}
      {TOOLS.map(t => {
        const items = tools[t.key]
        return (
          <div key={t.key} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{t.icone}</span>
                <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, margin: 0 }}>{t.titre}</h2>
              </div>
              {isAdmin && (
                <Link href={t.href} style={{
                  fontSize: 13, fontWeight: 600, color: t.accent, textDecoration: 'none',
                }}>+ Ajouter</Link>
              )}
            </div>
            {items.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9A8D72', padding: '0.5rem 0' }}>
                Aucun contenu dans cette matière pour l'instant.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(it => (
                  <div key={it.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {it.titre}
                      {it.type && <span style={{ fontSize: 11, color: '#8A7E68', marginLeft: 8 }}>· {it.type}</span>}
                    </div>
                    {it.url && <a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: t.accent, textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>Ouvrir →</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
