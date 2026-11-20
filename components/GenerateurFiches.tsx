'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fiche } from '@/types'
import { activable } from '@/lib/a11y'

type FicheGen = { question: string; reponse: string; selected: boolean }

export default function GenerateurFiches({ moduleId, onAjoutees }: {
  moduleId: string
  onAjoutees: (nouvelles: Fiche[]) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const [nombre, setNombre] = useState(8)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<FicheGen[]>([])
  const [msg, setMsg] = useState('')

  const font = "var(--font-texte)"
  const coral = '#A3122A'
  const champ: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid var(--c-filet-fort)', fontSize: 13, boxSizing: 'border-box', fontFamily: font, background: 'var(--c-papier)', outline: 'none' }

  const generer = async () => {
    if (!texte.trim()) { setMsg('❌ Indique un sujet ou colle un texte de cours.'); return }
    setLoading(true); setMsg(''); setItems([])
    const res = await fetch('/api/ia/generer-fiches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texte, nombre }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setMsg('❌ ' + (json.error || 'Erreur de génération')); return }
    setItems((json.fiches || []).map((f: { question: string; reponse: string }) => ({ ...f, selected: true })))
  }

  const maj = (i: number, champ: 'question' | 'reponse', v: string) =>
    setItems(arr => arr.map((it, j) => j === i ? { ...it, [champ]: v } : it))

  const ajouter = async () => {
    const choisies = items.filter(it => it.selected && it.question.trim() && it.reponse.trim())
    if (choisies.length === 0) { setMsg('❌ Aucune fiche sélectionnée.'); return }
    setSaving(true); setMsg('')
    const rows = choisies.map(c => ({ module_id: moduleId, question: c.question.trim(), reponse: c.reponse.trim() }))
    const { data, error } = await supabase.from('fiches').insert(rows).select()
    setSaving(false)
    if (error) { setMsg('❌ ' + error.message); return }
    onAjoutees((data as Fiche[]) || [])
    setItems([]); setTexte('')
    setMsg(`✅ ${rows.length} fiche${rows.length > 1 ? 's' : ''} ajoutée${rows.length > 1 ? 's' : ''} au module.`)
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div style={{ background: 'var(--c-papier-chaud)', border: '1px solid #F2D9A0', borderRadius: 6, padding: '1.1rem 1.25rem', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} {...activable} aria-expanded={ouvert} onClick={() => setOuvert(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: '#8A5A10' }}>Générer des fiches avec l&apos;IA</span>
        </div>
        <span style={{ color: 'var(--c-discret)', fontSize: 13 }}>{ouvert ? '▲' : '▼'}</span>
      </div>

      {ouvert && (
        <div style={{ marginTop: 14 }}>
          <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={4}
            placeholder="Un thème (ex. « La responsabilité du fait des choses »), ou colle un extrait de cours à transformer en fiches…"
            style={{ ...champ, resize: 'vertical', marginBottom: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'var(--c-texte-doux)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Nombre de fiches
              <input type="number" min={1} max={20} value={nombre} onChange={e => setNombre(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{ ...champ, width: 70, padding: '7px 9px' }} />
            </label>
            <button onClick={generer} disabled={loading} style={{ padding: '10px 20px', borderRadius: 6, background: coral, color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1, fontFamily: font }}>
              {loading ? 'Génération…' : 'Générer'}
            </button>
          </div>

          {msg && <div style={{ fontSize: 13, marginBottom: 10, color: msg.startsWith('❌') ? 'var(--c-accent)' : '#0E7C63' }}>{msg}</div>}

          {items.length > 0 && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--c-annotation)', marginBottom: 10 }}>
                Relis et ajuste avant d&apos;ajouter. Décoche celles que tu ne veux pas.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {items.map((it, i) => (
                  <div key={i} style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: 12, opacity: it.selected ? 1 : 0.5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--c-annotation)', marginBottom: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={it.selected} onChange={() => setItems(arr => arr.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} />
                      Fiche {i + 1}
                    </label>
                    <input value={it.question} onChange={e => maj(i, 'question', e.target.value)} style={{ ...champ, fontWeight: 600, marginBottom: 6 }} />
                    <textarea value={it.reponse} onChange={e => maj(i, 'reponse', e.target.value)} rows={3} style={{ ...champ, resize: 'vertical' }} />
                  </div>
                ))}
              </div>
              <button onClick={ajouter} disabled={saving} style={{ padding: '11px 22px', borderRadius: 6, background: '#0F6E56', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, fontFamily: font }}>
                {saving ? 'Ajout…' : `Ajouter ${items.filter(i => i.selected).length} fiche(s) au module`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
