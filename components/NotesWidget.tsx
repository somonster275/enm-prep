'use client'
import { useEffect, useState } from 'react'
import { supabase, ecrire } from '@/lib/supabase'

type Note = { id: string; contenu: string; fait: boolean; created_at: string }

export default function NotesWidget({ titre = 'Mes tâches' }: { titre?: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [userId, setUserId] = useState('')
  const [texte, setTexte] = useState('')
  const font = "var(--font-texte)"

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: n } = await supabase.from('notes').select('*').order('fait').order('created_at', { ascending: false })
      setNotes((n as Note[]) || [])
    })
  }, [])

  const ajouter = async () => {
    if (!texte.trim() || !userId) return
    const { data, error } = await supabase.from('notes').insert({ user_id: userId, contenu: texte.trim() }).select().single()
    if (!error && data) { setNotes(ns => [data as Note, ...ns]); setTexte('') }
  }
  const basculer = async (n: Note) => {
    if (!(await ecrire(supabase.from('notes').update({ fait: !n.fait }).eq('id', n.id).select('id')))) return
    setNotes(ns => ns.map(x => x.id === n.id ? { ...x, fait: !x.fait } : x).sort((a, b) => Number(a.fait) - Number(b.fait)))
  }
  const supprimer = async (id: string) => {
    if (!(await ecrire(supabase.from('notes').delete().eq('id', id).select('id')))) return
    setNotes(ns => ns.filter(x => x.id !== id))
  }

  const restantes = notes.filter(n => !n.fait).length

  return (
    <div style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '22px 24px', fontFamily: font }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "var(--font-titre)", fontWeight: 600, fontSize: 19 }}>{titre}</span>
        </div>
        {restantes > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-encre)', background: 'var(--c-surligneur)', borderRadius: 2, padding: '1px 6px' }}>{restantes}</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input value={texte} onChange={e => setTexte(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ajouter() }}
          placeholder="Ajouter une tâche…"
          style={{ flex: 1, minWidth: 0, padding: '8px 11px', borderRadius: 6, border: '1px solid var(--c-filet-fort)', background: '#FFFEFB', fontSize: 14, outline: 'none', fontFamily: font }} />
        <button onClick={ajouter} disabled={!texte.trim()} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--c-encre)', color: 'var(--c-papier)', border: 'none', fontSize: 16, fontWeight: 700, cursor: texte.trim() ? 'pointer' : 'default', opacity: texte.trim() ? 1 : 0.5, lineHeight: 1 }}>+</button>
      </div>

      {notes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--c-annotation-clair)', textAlign: 'center', padding: '10px 0' }}>Aucune tâche pour l&apos;instant.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
          {notes.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 4, background: n.fait ? 'transparent' : 'var(--c-papier)' }}>
              <button onClick={() => basculer(n)} aria-label="Terminer" style={{
                width: 18, height: 18, flexShrink: 0, borderRadius: 3, cursor: 'pointer',
                border: n.fait ? 'none' : '1.5px solid var(--c-discret)', background: n.fait ? 'var(--c-encre)' : '#FFFEFB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {n.fait && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
              <span style={{ flex: 1, fontSize: 14, color: n.fait ? 'var(--c-discret)' : 'var(--c-encre)', textDecoration: n.fait ? 'line-through' : 'none', wordBreak: 'break-word' }}>{n.contenu}</span>
              <button onClick={() => supprimer(n.id)} aria-label="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C2B7A0', fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
