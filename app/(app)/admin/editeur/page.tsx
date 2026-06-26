'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace, Module, Fiche } from '@/types'
import RichEditor from '@/components/RichEditor'

type Onglet = 'fiches' | 'modules'

export default function Editeur() {
  const [onglet, setOnglet] = useState<Onglet>('fiches')
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [fiches, setFiches] = useState<Fiche[]>([])
  const [espaceId, setEspaceId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState('')
  const [editFiche, setEditFiche] = useState<Fiche | null>(null)
  const [msg, setMsg] = useState('')

  // États gestion modules
  const [nomModule, setNomModule] = useState('')
  const [creatingModule, setCreatingModule] = useState(false)
  const [editModule, setEditModule] = useState<Module | null>(null)
  const [editNomModule, setEditNomModule] = useState('')

  useEffect(() => {
    supabase.from('espaces').select('*').order('ordre').then(({ data }) => setEspaces(data || []))
  }, [])

  useEffect(() => {
    if (!espaceId) { setModules([]); setFiches([]); setModuleId(''); return }
    supabase.from('modules').select('*').eq('espace_id', espaceId).is('deleted_at', null).order('ordre')
      .then(({ data }) => setModules(data || []))
    setModuleId('')
    setFiches([])
  }, [espaceId])

  useEffect(() => {
    if (!moduleId) { setFiches([]); return }
    supabase.from('fiches').select('*').eq('module_id', moduleId).is('deleted_at', null).order('created_at')
      .then(({ data }) => setFiches(data || []))
  }, [moduleId])

  const afficherMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const creerModule = async () => {
    if (!nomModule.trim() || !espaceId) return
    const ordre = modules.length + 1
    const { data, error } = await supabase.from('modules')
      .insert({ espace_id: espaceId, nom: nomModule.trim(), ordre })
      .select().single()
    if (error) { afficherMsg('❌ Erreur : ' + error.message); return }
    if (data) {
      setModules(m => [...m, data])
      setModuleId(data.id)
      setNomModule('')
      setCreatingModule(false)
      afficherMsg('✅ Module créé')
    }
  }

  const renommerModule = async (mod: Module) => {
    if (!editNomModule.trim()) return
    const { error } = await supabase.from('modules').update({ nom: editNomModule.trim() }).eq('id', mod.id)
    if (error) { afficherMsg('❌ Erreur : ' + error.message); return }
    setModules(ms => ms.map(m => m.id === mod.id ? { ...m, nom: editNomModule.trim() } : m))
    setEditModule(null)
    setEditNomModule('')
    afficherMsg('✅ Module renommé')
  }

  const supprimerModule = async (mod: Module) => {
    const { count } = await supabase.from('fiches').select('*', { count: 'exact', head: true }).eq('module_id', mod.id)
    const nbFiches = count ?? 0
    const msg = nbFiches > 0
      ? `Mettre le module "${mod.nom}" et ses ${nbFiches} fiches à la corbeille ?`
      : `Mettre le module "${mod.nom}" à la corbeille ?`
    if (!confirm(msg)) return
    const now = new Date().toISOString()
    // Soft delete : marque les fiches puis le module
    if (nbFiches > 0) await supabase.from('fiches').update({ deleted_at: now }).eq('module_id', mod.id)
    const { error } = await supabase.from('modules').update({ deleted_at: now }).eq('id', mod.id)
    if (error) { afficherMsg('❌ Erreur : ' + error.message); return }
    setModules(ms => ms.filter(m => m.id !== mod.id))
    if (moduleId === mod.id) { setModuleId(''); setFiches([]) }
    afficherMsg('✅ Module mis à la corbeille')
  }

  const sauvegarder = async () => {
    if (!question || !reponse || !moduleId) return
    if (editFiche) {
      const { error } = await supabase.from('fiches').update({ question, reponse, updated_at: new Date().toISOString() }).eq('id', editFiche.id)
      if (error) { afficherMsg('❌ Erreur : ' + error.message); return }
      setFiches(f => f.map(fc => fc.id === editFiche.id ? { ...fc, question, reponse } : fc))
      afficherMsg('✅ Fiche modifiée')
    } else {
      const { data, error } = await supabase.from('fiches').insert({ module_id: moduleId, question, reponse }).select().single()
      if (error) { afficherMsg('❌ Erreur : ' + error.message); return }
      if (data) setFiches(f => [...f, data])
      afficherMsg('✅ Fiche ajoutée')
    }
    setQuestion(''); setReponse(''); setEditFiche(null)
  }

  const supprimerFiche = async (id: string) => {
    if (!confirm('Mettre cette fiche à la corbeille ?')) return
    await supabase.from('fiches').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setFiches(f => f.filter(fc => fc.id !== id))
  }

  const font = "'Hanken Grotesk', sans-serif"
  const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: '1.25rem', marginBottom: 16 }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #EADFC9', fontSize: 13, boxSizing: 'border-box', fontFamily: font, background: '#FFFBF2', outline: 'none' }
  const labelStyle: React.CSSProperties = { fontSize: 12, display: 'block', marginBottom: 6, color: '#8A7E68', fontWeight: 600 }
  const msgStyle: React.CSSProperties = {
    fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 12,
    color: msg.startsWith('❌') ? '#D94A30' : '#0E7C63',
    background: msg.startsWith('❌') ? '#FCE9E3' : '#DDF3EE',
  }

  return (
    <div style={{ paddingTop: '34px', maxWidth: 900, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26, marginBottom: '1.5rem' }}>
        Éditeur de fiches
      </div>

      {/* Sélecteur espace */}
      <div style={cardStyle}>
        <label style={labelStyle}>Espace</label>
        <select value={espaceId} onChange={e => { setEspaceId(e.target.value); setOnglet('fiches') }} style={{ ...inputStyle, maxWidth: 360 }}>
          <option value="">Choisir un espace…</option>
          {espaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
      </div>

      {/* Onglets */}
      {espaceId && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['fiches', 'modules'] as Onglet[]).map(o => (
            <button key={o} onClick={() => setOnglet(o)} style={{
              padding: '9px 20px', borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: font,
              background: onglet === o ? '#DC4A2B' : '#fff',
              color: onglet === o ? '#fff' : '#8A7E68',
              border: onglet === o ? '2px solid #DC4A2B' : '1px solid #F0E7D6',
            } as React.CSSProperties}>
              {o === 'fiches' ? 'Fiches' : `Modules (${modules.length})`}
            </button>
          ))}
        </div>
      )}

      {/* ===== ONGLET MODULES ===== */}
      {espaceId && onglet === 'modules' && (
        <div>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Modules de cet espace</h2>
              {!creatingModule && (
                <button onClick={() => setCreatingModule(true)} style={{
                  padding: '8px 16px', borderRadius: 8, background: '#DC4A2B', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font,
                }}>
                  + Nouveau module
                </button>
              )}
            </div>

            {/* Formulaire création */}
            {creatingModule && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, padding: '12px', background: '#FDF6EA', borderRadius: 10 }}>
                <input
                  value={nomModule} onChange={e => setNomModule(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') creerModule(); if (e.key === 'Escape') { setCreatingModule(false); setNomModule('') } }}
                  placeholder="Nom du nouveau module…"
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                />
                <button onClick={creerModule} disabled={!nomModule.trim()} style={{
                  padding: '10px 18px', borderRadius: 10, background: '#DC4A2B', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font,
                  opacity: !nomModule.trim() ? 0.5 : 1,
                }}>Créer</button>
                <button onClick={() => { setCreatingModule(false); setNomModule('') }} style={{
                  padding: '10px 14px', borderRadius: 10, background: '#fff', color: '#8A7E68',
                  border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 13, fontFamily: font,
                }}>Annuler</button>
              </div>
            )}

            {/* Liste des modules */}
            {modules.length === 0 ? (
              <div style={{ fontSize: 14, color: '#9A8D72', textAlign: 'center', padding: '2rem 0' }}>
                Aucun module dans cet espace. Créez-en un ci-dessus.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modules.map(mod => (
                  <div key={mod.id} style={{
                    padding: '12px 14px', background: '#FDF6EA', borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    {editModule?.id === mod.id ? (
                      <div style={{ display: 'flex', gap: 8, flex: 1, alignItems: 'center' }}>
                        <input
                          value={editNomModule} onChange={e => setEditNomModule(e.target.value)} autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') renommerModule(mod); if (e.key === 'Escape') setEditModule(null) }}
                          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                        />
                        <button onClick={() => renommerModule(mod)} style={{
                          padding: '8px 14px', borderRadius: 8, background: '#DC4A2B', color: '#fff',
                          border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
                        }}>Sauver</button>
                        <button onClick={() => setEditModule(null)} style={{
                          padding: '8px 12px', borderRadius: 8, background: '#fff', color: '#8A7E68',
                          border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 12, fontFamily: font,
                        }}>Annuler</button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#2A2018' }}>{mod.nom}</div>
                          <div style={{ fontSize: 12, color: '#9A8D72', marginTop: 2 }}>ordre {mod.ordre}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setModuleId(mod.id); setOnglet('fiches') }} style={{
                            padding: '6px 12px', borderRadius: 8, background: '#fff', color: '#DC4A2B',
                            border: '1px solid #F2C4B5', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
                          }}>Voir les fiches</button>
                          <button onClick={() => { setEditModule(mod); setEditNomModule(mod.nom) }} style={{
                            padding: '6px 12px', borderRadius: 8, background: '#fff', color: '#8A7E68',
                            border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 12, fontFamily: font,
                          }}>Renommer</button>
                          <button onClick={() => supprimerModule(mod)} style={{
                            padding: '6px 12px', borderRadius: 8, background: '#FCE9E3', color: '#D94A30',
                            border: '1px solid #FCE9E3', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
                          }}>Supprimer</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {msg && <div style={msgStyle}>{msg}</div>}
        </div>
      )}

      {/* ===== ONGLET FICHES ===== */}
      {(!espaceId || onglet === 'fiches') && (
        <div>
          {/* Sélecteur module + création rapide */}
          {espaceId && (
            <div style={cardStyle}>
              <label style={labelStyle}>Module</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <select value={moduleId} onChange={e => setModuleId(e.target.value)} style={{ ...inputStyle, flex: '1 1 200px', minWidth: 0 }}>
                  <option value="">Choisir un module…</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
                {!creatingModule && (
                  <button onClick={() => setCreatingModule(true)} style={{
                    padding: '10px 14px', borderRadius: 10, background: '#FDF6EA', color: '#DC4A2B',
                    border: '1px solid #F2C4B5', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font, whiteSpace: 'nowrap',
                  }}>+ Nouveau module</button>
                )}
              </div>
              {creatingModule && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                  <input value={nomModule} onChange={e => setNomModule(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') creerModule(); if (e.key === 'Escape') { setCreatingModule(false); setNomModule('') } }}
                    placeholder="Nom du module…" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                  <button onClick={creerModule} disabled={!nomModule.trim()} style={{
                    padding: '10px 16px', borderRadius: 10, background: '#DC4A2B', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font, opacity: !nomModule.trim() ? 0.5 : 1,
                  }}>Créer</button>
                  <button onClick={() => { setCreatingModule(false); setNomModule('') }} style={{
                    padding: '10px 12px', borderRadius: 10, background: '#fff', color: '#8A7E68',
                    border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 13, fontFamily: font,
                  }}>✕</button>
                </div>
              )}
              {!moduleId && modules.length === 0 && (
                <p style={{ fontSize: 12, color: '#9A8D72', marginTop: 8 }}>Cet espace n'a pas encore de module. Créez-en un pour ajouter des fiches.</p>
              )}
            </div>
          )}

          {/* Formulaire fiche */}
          {espaceId && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>
                {editFiche ? 'Modifier la fiche' : 'Nouvelle fiche'}
              </h2>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Question</label>
                <RichEditor key={editFiche?.id ?? 'new-q'} value={question} onChange={setQuestion} placeholder="Intitulé de la question…" minHeight={70} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Réponse</label>
                <RichEditor key={editFiche?.id ?? 'new-r'} value={reponse} onChange={setReponse} placeholder="Contenu de la réponse…" minHeight={120} />
              </div>
              {msg && <div style={msgStyle}>{msg}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={sauvegarder} disabled={!question || !reponse || !moduleId} style={{
                  padding: '11px 22px', borderRadius: 10, background: '#DC4A2B', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font,
                  opacity: (!question || !reponse || !moduleId) ? 0.4 : 1,
                }}>
                  {editFiche ? 'Enregistrer' : 'Ajouter la fiche'}
                </button>
                {editFiche && (
                  <button onClick={() => { setEditFiche(null); setQuestion(''); setReponse('') }} style={{
                    padding: '11px 16px', borderRadius: 10, background: '#FDF6EA', color: '#8A7E68',
                    border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 13, fontFamily: font,
                  }}>Annuler</button>
                )}
              </div>
            </div>
          )}

          {/* Liste des fiches */}
          {fiches.length > 0 && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>
                Fiches du module ({fiches.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fiches.map(f => (
                  <div key={f.id} style={{
                    padding: '12px 14px', background: '#FDF6EA', borderRadius: 10,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                  }}>
                    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{f.question.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setEditFiche(f); setQuestion(f.question); setReponse(f.reponse); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #EADFC9', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font }}>
                        Modifier
                      </button>
                      <button onClick={() => supprimerFiche(f.id)}
                        style={{ padding: '5px 12px', borderRadius: 7, background: '#FCE9E3', color: '#D94A30', border: '1px solid #FCE9E3', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font }}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
