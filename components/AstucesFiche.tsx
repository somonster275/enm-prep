'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Astuce = { id: string; user_id: string; auteur: string | null; texte: string; created_at: string }
const FONT = "'Hanken Grotesk', sans-serif"

// Astuces / mnémotechniques partagées sous une fiche (visibles de tous).
export default function AstucesFiche({ ficheId, uid, auteur, isAdmin }: { ficheId: string; uid: string; auteur: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Astuce[] | null>(null)
  const [texte, setTexte] = useState('')
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (items === null) {
      const { data } = await supabase.from('astuces').select('*').eq('fiche_id', ficheId).order('created_at')
      setItems((data || []) as Astuce[])
    }
  }

  const ajouter = async () => {
    if (!texte.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('astuces')
      .insert({ fiche_id: ficheId, user_id: uid, auteur, texte: texte.trim().slice(0, 500) })
      .select().single()
    setSaving(false)
    if (error) return
    setItems(it => [...(it || []), data as Astuce])
    setTexte('')
  }

  const supprimer = async (id: string) => {
    setItems(it => (it || []).filter(x => x.id !== id))
    await supabase.from('astuces').delete().eq('id', id)
  }

  const n = items?.length ?? 0

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid #F5EEE0', paddingTop: 10 }}>
      <button onClick={toggle} style={{ background: 'none', border: 'none', color: '#8A5A10', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: FONT }}>
        💡 Astuces{open ? '' : (items !== null && n ? ` (${n})` : '')} {open ? '▴' : '▾'}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {items === null ? (
            <div style={{ fontSize: 12.5, color: '#9A8D72' }}>Chargement…</div>
          ) : n === 0 ? (
            <div style={{ fontSize: 12.5, color: '#9A8D72', marginBottom: 8 }}>Aucune astuce — partage la tienne pour aider les autres.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {items.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 8, background: '#FFF8EE', border: '1px solid #F2D9A0', borderRadius: 10, padding: '8px 10px' }}>
                  <span style={{ flexShrink: 0 }}>💡</span>
                  <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45, color: '#3A3226' }}>
                    {a.texte}
                    <span style={{ color: '#B6A98C', fontSize: 11, marginLeft: 6 }}>— {a.auteur || 'Étudiant'}</span>
                  </div>
                  {(isAdmin || a.user_id === uid) && (
                    <button onClick={() => supprimer(a.id)} title="Supprimer" style={{ border: 'none', background: 'transparent', color: '#C0B7A4', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={texte} onChange={e => setTexte(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ajouter() }}
              placeholder="Une astuce, un moyen mnémotechnique…"
              style={{ flex: 1, border: '1.5px solid #EADFC9', borderRadius: 9, padding: '8px 10px', background: '#FFFBF2', fontSize: 12.5, outline: 'none', fontFamily: FONT }} />
            <button onClick={ajouter} disabled={saving || !texte.trim()} style={{ padding: '0 14px', borderRadius: 9, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, opacity: saving || !texte.trim() ? 0.5 : 1, fontFamily: FONT }}>Ajouter</button>
          </div>
        </div>
      )}
    </div>
  )
}
