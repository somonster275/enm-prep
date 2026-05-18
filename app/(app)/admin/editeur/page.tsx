'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace, Module, Fiche } from '@/types'

export default function Editeur() {
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [fiches, setFiches] = useState<Fiche[]>([])
  const [espaceId, setEspaceId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState('')
  const [editFiche, setEditFiche] = useState<Fiche | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('espaces').select('*').order('ordre').then(({ data }) => setEspaces(data || []))
  }, [])

  useEffect(() => {
    if (!espaceId) { setModules([]); setFiches([]); return }
    supabase.from('modules').select('*').eq('espace_id', espaceId).order('ordre').then(({ data }) => setModules(data || []))
  }, [espaceId])

  useEffect(() => {
    if (!moduleId) { setFiches([]); return }
    supabase.from('fiches').select('*').eq('module_id', moduleId).order('created_at').then(({ data }) => setFiches(data || []))
  }, [moduleId])

  const sauvegarder = async () => {
    if (!question || !reponse || !moduleId) return
    if (editFiche) {
      await supabase.from('fiches').update({ question, reponse, updated_at: new Date().toISOString() }).eq('id', editFiche.id)
      setFiches(f => f.map(fc => fc.id === editFiche.id ? { ...fc, question, reponse } : fc))
      setMsg('Fiche modifiée')
    } else {
      const { data } = await supabase.from('fiches').insert({ module_id: moduleId, question, reponse }).select().single()
      if (data) setFiches(f => [...f, data])
      setMsg('Fiche ajoutée')
    }
    setQuestion(''); setReponse(''); setEditFiche(null)
    setTimeout(() => setMsg(''), 3000)
  }

  const supprimer = async (id: string) => {
    if (!confirm('Supprimer cette fiche ?')) return
    await supabase.from('fiches').delete().eq('id', id)
    setFiches(f => f.filter(fc => fc.id !== id))
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 1.5rem' }}>Éditeur de fiches</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Espace</label>
          <select value={espaceId} onChange={e => { setEspaceId(e.target.value); setModuleId('') }}
            style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13, boxSizing: 'border-box' }}>
            <option value="">Choisir un espace...</option>
            {espaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Module</label>
          <select value={moduleId} onChange={e => setModuleId(e.target.value)} disabled={!espaceId}
            style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13, boxSizing: 'border-box', opacity: !espaceId ? 0.5 : 1 }}>
            <option value="">Choisir un module...</option>
            {modules.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </div>
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #E5E5E5', borderRadius: 12, padding: '1.25rem', marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>{editFiche ? 'Modifier la fiche' : 'Nouvelle fiche'}</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Question</label>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} placeholder="Intitulé de la fiche..."
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13, lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Réponse</label>
          <textarea value={reponse} onChange={e => setReponse(e.target.value)} rows={5} placeholder="Contenu de la réponse..."
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13, lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        {msg && <div style={{ fontSize: 12, color: '#0F6E56', marginBottom: 10 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={sauvegarder} disabled={!question || !reponse || !moduleId}
            style={{ padding: '10px 20px', borderRadius: 8, background: '#534AB7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (!question || !reponse || !moduleId) ? 0.5 : 1 }}>
            {editFiche ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editFiche && (
            <button onClick={() => { setEditFiche(null); setQuestion(''); setReponse('') }}
              style={{ padding: '10px 16px', borderRadius: 8, background: '#F5F5F5', color: '#555', border: 'none', cursor: 'pointer', fontSize: 13 }}>
              Annuler
            </button>
          )}
        </div>
      </div>
      {fiches.length > 0 && (
        <div style={{ background: '#fff', border: '0.5px solid #E5E5E5', borderRadius: 12, padding: '1.25rem' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>Fiches du module ({fiches.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fiches.map(f => (
              <div key={f.id} style={{ padding: '10px 12px', background: '#F9F9F9', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{f.question}</div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setEditFiche(f); setQuestion(f.question); setReponse(f.reponse) }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E0E0E0', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Modifier</button>
                  <button onClick={() => supprimer(f.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FCC', background: '#FFF5F5', color: '#E24B4A', cursor: 'pointer', fontSize: 12 }}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}