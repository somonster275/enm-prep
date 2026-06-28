'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Espace, Module, Fiche, Profil } from '@/types'
import { scoreGlobal, estDue } from '@/lib/spaced-repetition'
import Link from 'next/link'
import RichContent from '@/components/RichContent'
import RichEditor from '@/components/RichEditor'
import RemarqueButton from '@/components/RemarqueButton'
import AstucesFiche from '@/components/AstucesFiche'
import FavoriButton from '@/components/FavoriButton'

export default function ModulePage() {
  const { slug, moduleId } = useParams() as { slug: string; moduleId: string }
  const router = useRouter()

  const [espace, setEspace] = useState<Espace | null>(null)
  const [module, setModule] = useState<Module | null>(null)
  const [sousModules, setSousModules] = useState<Module[]>([])
  const [fiches, setFiches] = useState<Fiche[]>([])
  const [progressions, setProgressions] = useState<any[]>([])
  const [profil, setProfil] = useState<Profil | null>(null)
  const [favSet, setFavSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Données pour le déplacement
  const [allEspaces, setAllEspaces] = useState<Espace[]>([])
  const [allModules, setAllModules] = useState<Module[]>([])

  // Création sous-module
  const [nomSousModule, setNomSousModule] = useState('')
  const [creatingSousModule, setCreatingSousModule] = useState(false)

  // Édition fiche
  const [editFiche, setEditFiche] = useState<Fiche | null>(null)
  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState('')
  const [msg, setMsg] = useState('')

  // Suppression module
  const [confirmDeleteModule, setConfirmDeleteModule] = useState(false)

  // Déplacement module
  const [showMove, setShowMove] = useState(false)
  const [moveEspaceId, setMoveEspaceId] = useState('')
  const [moveParentId, setMoveParentId] = useState('') // '' = racine de l'espace
  const [moving, setMoving] = useState(false)

  const isAdmin = profil?.role === 'admin' || profil?.role === 'editeur'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [
        { data: esp },
        { data: mod },
        { data: sousMods },
        { data: fich },
        { data: prof },
        { data: esps },
        { data: mods },
      ] = await Promise.all([
        supabase.from('espaces').select('*').eq('slug', slug).single(),
        supabase.from('modules').select('*').eq('id', moduleId).single(),
        supabase.from('modules').select('*').eq('parent_id', moduleId).is('deleted_at', null).order('ordre'),
        supabase.from('fiches').select('*').eq('module_id', moduleId).is('deleted_at', null).order('created_at'),
        supabase.from('profils').select('*').eq('id', user.id).single(),
        supabase.from('espaces').select('*').order('ordre'),
        supabase.from('modules').select('*').is('deleted_at', null).order('nom'),
      ])

      setEspace(esp)
      setModule(mod)
      setSousModules(sousMods || [])
      setFiches(fich || [])
      setProfil(prof)
      setAllEspaces(esps || [])
      setAllModules(mods || [])
      if (esp) setMoveEspaceId(esp.id)

      if (fich && fich.length > 0) {
        const { data: prog } = await supabase.from('progression').select('*')
          .eq('utilisateur_id', user.id).in('fiche_id', fich.map((f: Fiche) => f.id))
        setProgressions(prog || [])
      }

      const { data: fav } = await supabase.from('favoris').select('fiche_id').eq('user_id', user.id)
      setFavSet(new Set((fav || []).map((x: { fiche_id: string }) => x.fiche_id)))

      setLoading(false)
    }
    load()
  }, [slug, moduleId])

  const afficherMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  // Calcule récursivement tous les descendants d'un module (pour éviter de le déplacer dans son propre enfant)
  const getDescendantIds = (rootId: string): string[] => {
    const result: string[] = []
    const walk = (id: string) => {
      for (const m of allModules) {
        if (m.parent_id === id) { result.push(m.id); walk(m.id) }
      }
    }
    walk(rootId)
    return result
  }

  const creerSousModule = async () => {
    if (!nomSousModule.trim() || !espace) return
    const { data, error } = await supabase.from('modules').insert({
      espace_id: espace.id,
      nom: nomSousModule.trim(),
      parent_id: moduleId,
      ordre: sousModules.length + 1,
    }).select().single()
    if (error) { afficherMsg('❌ Erreur : ' + error.message); return }
    if (data) { setSousModules(s => [...s, data]); setNomSousModule(''); setCreatingSousModule(false); afficherMsg('✅ Sous-module créé') }
  }

  const supprimerSousModule = async (mod: Module) => {
    const { count } = await supabase.from('fiches').select('*', { count: 'exact', head: true }).eq('module_id', mod.id)
    const nb = count ?? 0
    if (!confirm(`Mettre "${mod.nom}"${nb > 0 ? ` et ses ${nb} fiches` : ''} à la corbeille ?`)) return
    const now = new Date().toISOString()
    if (nb > 0) await supabase.from('fiches').update({ deleted_at: now }).eq('module_id', mod.id)
    await supabase.from('modules').update({ deleted_at: now }).eq('id', mod.id)
    setSousModules(s => s.filter(m => m.id !== mod.id))
    afficherMsg('✅ Sous-module mis à la corbeille')
  }

  const deplacerModule = async () => {
    if (!moveEspaceId) return
    setMoving(true)

    // Met à jour l'espace de ce module et de tous ses descendants (les fiches suivent via module_id)
    const descendants = getDescendantIds(moduleId)
    const idsToUpdate = [moduleId, ...descendants]
    const { error: espErr } = await supabase.from('modules').update({ espace_id: moveEspaceId }).in('id', idsToUpdate)
    if (espErr) { afficherMsg('❌ Erreur : ' + espErr.message); setMoving(false); return }

    // Met à jour le parent du module déplacé
    const newParent = moveParentId || null
    const { error: parErr } = await supabase.from('modules').update({ parent_id: newParent }).eq('id', moduleId)
    if (parErr) { afficherMsg('❌ Erreur : ' + parErr.message); setMoving(false); return }

    setMoving(false)
    setShowMove(false)

    // Redirige vers la nouvelle localisation
    const espCible = allEspaces.find(e => e.id === moveEspaceId)
    if (espCible) router.push(`/espaces/${espCible.slug}/modules/${moduleId}`)
    else router.refresh()
  }

  const sauvegarderFiche = async () => {
    if (!editFiche || !question || !reponse) return
    const { error } = await supabase.from('fiches').update({ question, reponse }).eq('id', editFiche.id)
    if (error) { afficherMsg('❌ Erreur : ' + error.message); return }
    setFiches(f => f.map(fc => fc.id === editFiche.id ? { ...fc, question, reponse } : fc))
    setEditFiche(null); setQuestion(''); setReponse('')
    afficherMsg('✅ Fiche modifiée')
  }

  const supprimerFiche = async (id: string) => {
    if (!confirm('Mettre cette fiche à la corbeille ?')) return
    await supabase.from('fiches').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setFiches(f => f.filter(fc => fc.id !== id))
  }

  const supprimerModule = async () => {
    const now = new Date().toISOString()
    // Soft delete récursif : ce module + tous ses descendants + leurs fiches
    const ids = [moduleId, ...getDescendantIds(moduleId)]
    await supabase.from('fiches').update({ deleted_at: now }).in('module_id', ids)
    await supabase.from('modules').update({ deleted_at: now }).in('id', ids)
    router.push(`/espaces/${slug}`)
  }

  const font = "'Hanken Grotesk', sans-serif"
  const score = scoreGlobal(progressions)
  const due = progressions.filter(p => estDue(p.prochaine_revision)).length
  const totalFiches = fiches.length

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 10, border: '1.5px solid #EADFC9',
    fontSize: 13, fontFamily: font, background: '#FFFBF2', outline: 'none',
  }

  if (loading) return <div style={{ paddingTop: '4rem', textAlign: 'center', color: '#9A8D72', fontFamily: font }}>Chargement…</div>
  if (!espace || !module) return <div style={{ paddingTop: '4rem', textAlign: 'center', color: '#9A8D72', fontFamily: font }}>Module introuvable.</div>

  // Options de module parent : modules de l'espace cible, sauf ce module et ses descendants
  const descendantSet = new Set(getDescendantIds(moduleId))
  const parentOptions = allModules.filter(m =>
    m.espace_id === moveEspaceId && m.id !== moduleId && !descendantSet.has(m.id)
  )

  return (
    <div style={{ paddingTop: '34px', maxWidth: 820, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>

      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: '#9A8D72', marginBottom: 16 }}>
        <Link href="/dashboard" style={{ color: '#9A8D72', textDecoration: 'none' }}>Accueil</Link>
        {' / '}
        <Link href={`/espaces/${slug}`} style={{ color: '#9A8D72', textDecoration: 'none' }}>{espace.nom}</Link>
        {' / '}
        <span style={{ color: '#2A2018', fontWeight: 600 }}>{module.nom}</span>
      </div>

      {/* En-tête */}
      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 24, color: espace.couleur }}>
              {module.nom}
            </div>
            <div style={{ fontSize: 13, color: '#8A7E68', marginTop: 4 }}>
              {sousModules.length > 0 && <span>{sousModules.length} sous-module{sousModules.length > 1 ? 's' : ''} · </span>}
              {totalFiches} fiche{totalFiches !== 1 ? 's' : ''} directes
            </div>
            {totalFiches > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 6, width: 200, background: '#F0E7D6', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: espace.couleur, borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: 11, color: '#9A8D72', marginTop: 4 }}>Score : {score}%{due > 0 && ` · ${due} dues`}</div>
              </div>
            )}
          </div>

          {/* Boutons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Link href={`/espaces/${slug}/revision?module=${moduleId}`} style={{
              padding: '10px 18px', borderRadius: 10, background: espace.couleur, color: '#fff',
              fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: font, whiteSpace: 'nowrap',
            }}>
              Réviser tout{due > 0 ? ` (${due} dues)` : ''}
            </Link>
            <Link href={`/espaces/${slug}/revision?module=${moduleId}&mode=tout`} style={{
              padding: '10px 18px', borderRadius: 10, background: '#FDF6EA', color: '#8A7E68',
              fontSize: 13, textDecoration: 'none', fontFamily: font, border: '1px solid #EADFC9', whiteSpace: 'nowrap',
            }}>
              Mode aléatoire
            </Link>

            {isAdmin && (
              <button onClick={() => { setShowMove(v => !v); setConfirmDeleteModule(false) }} style={{
                padding: '10px 14px', borderRadius: 10, background: showMove ? '#DC4A2B' : '#FCE3D3',
                color: showMove ? '#fff' : '#DC4A2B', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: font,
              }}>Déplacer</button>
            )}

            {isAdmin && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => { setConfirmDeleteModule(v => !v); setShowMove(false) }} style={{
                  padding: '10px 14px', borderRadius: 10, background: '#FCE9E3', color: '#D94A30',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font,
                }}>Supprimer</button>
                {confirmDeleteModule && (
                  <div style={{
                    position: 'absolute', top: 46, right: 0, width: 260, zIndex: 50,
                    background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12,
                    boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)', padding: '14px',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Supprimer ce module ?</div>
                    <div style={{ fontSize: 12, color: '#8A7E68', marginBottom: 12 }}>
                      Supprime le module{sousModules.length > 0 ? `, ses ${sousModules.length} sous-modules` : ''}{totalFiches > 0 ? ` et ses ${totalFiches} fiches` : ''}. Irréversible.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={supprimerModule} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#D94A30', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font }}>Confirmer</button>
                      <button onClick={() => setConfirmDeleteModule(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#FDF6EA', color: '#8A7E68', border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 13, fontFamily: font }}>Annuler</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Panneau de déplacement */}
        {showMove && isAdmin && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #F0E7D6' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Déplacer ce module</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#8A7E68', display: 'block', marginBottom: 5 }}>Espace de destination</label>
                <select value={moveEspaceId} onChange={e => { setMoveEspaceId(e.target.value); setMoveParentId('') }}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' } as React.CSSProperties}>
                  {allEspaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#8A7E68', display: 'block', marginBottom: 5 }}>Module parent (optionnel)</label>
                <select value={moveParentId} onChange={e => setMoveParentId(e.target.value)}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' } as React.CSSProperties}>
                  <option value="">— Racine de l'espace —</option>
                  {parentOptions.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
              <button onClick={deplacerModule} disabled={moving} style={{
                padding: '10px 20px', borderRadius: 10, background: '#DC4A2B', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font,
                opacity: moving ? 0.6 : 1, whiteSpace: 'nowrap',
              }}>{moving ? 'Déplacement…' : 'Confirmer'}</button>
            </div>
            <div style={{ fontSize: 12, color: '#9A8D72', marginTop: 10 }}>
              Les sous-modules et toutes les fiches suivront automatiquement.
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 10, marginBottom: 16, color: msg.startsWith('❌') ? '#D94A30' : '#0E7C63', background: msg.startsWith('❌') ? '#FCE9E3' : '#DDF3EE' }}>{msg}</div>
      )}

      {/* ===== SOUS-MODULES ===== */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 18 }}>
            Sous-modules {sousModules.length > 0 && <span style={{ fontSize: 14, color: '#9A8D72', fontFamily: font, fontWeight: 400 }}>({sousModules.length})</span>}
          </div>
          {isAdmin && !creatingSousModule && (
            <button onClick={() => setCreatingSousModule(true)} style={{
              padding: '8px 14px', borderRadius: 8, background: '#DC4A2B', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font,
            }}>+ Ajouter</button>
          )}
        </div>

        {creatingSousModule && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: '12px', background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12 }}>
            <input value={nomSousModule} onChange={e => setNomSousModule(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') creerSousModule(); if (e.key === 'Escape') { setCreatingSousModule(false); setNomSousModule('') } }}
              placeholder="Nom du sous-module…"
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={creerSousModule} disabled={!nomSousModule.trim()} style={{
              padding: '10px 16px', borderRadius: 10, background: '#DC4A2B', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font,
              opacity: !nomSousModule.trim() ? 0.5 : 1,
            }}>Créer</button>
            <button onClick={() => { setCreatingSousModule(false); setNomSousModule('') }} style={{
              padding: '10px 12px', borderRadius: 10, background: '#FDF6EA', color: '#8A7E68',
              border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 13, fontFamily: font,
            }}>✕</button>
          </div>
        )}

        {sousModules.length === 0 && !creatingSousModule ? (
          <div style={{ fontSize: 13, color: '#9A8D72', padding: '1rem 0' }}>
            Aucun sous-module.{isAdmin ? ' Clique sur "+ Ajouter" pour en créer un.' : ''}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sousModules.map(sm => (
              <div key={sm.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, overflow: 'hidden' }}>
                <Link href={`/espaces/${slug}/modules/${sm.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 4, height: 28, borderRadius: 4, background: espace.couleur, flexShrink: 0 }} />
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{sm.nom}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(`/espaces/${slug}/revision?module=${sm.id}`) }} style={{
                        padding: '6px 12px', borderRadius: 8, background: espace.couleur + '18',
                        color: espace.couleur, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: font,
                      }}>Réviser</button>
                      {isAdmin && (
                        <button onClick={e => { e.preventDefault(); supprimerSousModule(sm) }} style={{
                          padding: '6px 10px', borderRadius: 8, background: '#FCE9E3', color: '#D94A30',
                          border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: font,
                        }}>Supprimer</button>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== FICHES DIRECTES ===== */}
      <div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
          Fiches {totalFiches > 0 && <span style={{ fontSize: 14, color: '#9A8D72', fontFamily: font, fontWeight: 400 }}>({totalFiches})</span>}
        </div>

        {totalFiches === 0 ? (
          <div style={{ fontSize: 13, color: '#9A8D72', padding: '1rem 0' }}>Aucune fiche directe dans ce module.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fiches.map((fiche, i) => (
              <div key={fiche.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14 }}>
                {isAdmin && editFiche?.id === fiche.id ? (
                  <div style={{ padding: '16px' }}>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#8A7E68', display: 'block', marginBottom: 4 }}>Question</label>
                      <RichEditor value={question} onChange={setQuestion} placeholder="Question…" minHeight={70} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#8A7E68', display: 'block', marginBottom: 4 }}>Réponse</label>
                      <RichEditor value={reponse} onChange={setReponse} placeholder="Réponse…" minHeight={120} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={sauvegarderFiche} style={{ padding: '9px 20px', borderRadius: 8, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font }}>Enregistrer</button>
                      <button onClick={() => { setEditFiche(null); setQuestion(''); setReponse('') }} style={{ padding: '9px 14px', borderRadius: 8, background: '#FDF6EA', color: '#8A7E68', border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 13, fontFamily: font }}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9A8D72', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fiche {i + 1}</div>
                        <RichContent html={fiche.question} style={{ fontSize: 14, fontWeight: 600, color: '#2A2018', lineHeight: 1.5, marginBottom: 10 }} />
                        <div style={{ height: 1, background: '#F0E7D6', marginBottom: 10 }} />
                        <RichContent html={fiche.reponse} style={{ fontSize: 13, color: '#8A7E68', lineHeight: 1.7 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                        <FavoriButton ficheId={fiche.id} uid={profil?.id || ''} initial={favSet.has(fiche.id)} />
                        {isAdmin ? (
                          <>
                            <button onClick={() => { setEditFiche(fiche); setQuestion(fiche.question); setReponse(fiche.reponse) }}
                              style={{ padding: '6px 12px', borderRadius: 8, background: '#fff', color: '#8A7E68', border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font }}>
                              Modifier
                            </button>
                            <button onClick={() => supprimerFiche(fiche.id)}
                              style={{ padding: '6px 12px', borderRadius: 8, background: '#FCE9E3', color: '#D94A30', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font }}>
                              Supprimer
                            </button>
                          </>
                        ) : (
                          <RemarqueButton ficheId={fiche.id} />
                        )}
                      </div>
                    </div>
                    <AstucesFiche
                      ficheId={fiche.id}
                      uid={profil?.id || ''}
                      auteur={[profil?.prenom, profil?.nom].filter(Boolean).join(' ') || 'Étudiant'}
                      isAdmin={profil?.role === 'admin'}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
