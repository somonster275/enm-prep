'use client'
import { useState } from 'react'
import { normaliserTag } from '@/lib/tags'

const FONT = "'Hanken Grotesk', sans-serif"

// Saisie de tags sous forme de pastilles « # ». Tape un mot puis Entrée, espace
// ou virgule pour l'ajouter ; clique × pour retirer.
export default function TagsInput({
  value, onChange, accent = '#7C5CBF', placeholder = 'Ajouter un tag puis Entrée…',
}: {
  value: string[]
  onChange: (tags: string[]) => void
  accent?: string
  placeholder?: string
}) {
  const [saisie, setSaisie] = useState('')

  const ajouter = (brut: string) => {
    const t = normaliserTag(brut)
    if (t && !value.includes(t)) onChange([...value, t])
    setSaisie('')
  }
  const retirer = (t: string) => onChange(value.filter(x => x !== t))

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
      border: '1.5px solid #EADFC9', borderRadius: 11, padding: '7px 10px',
      background: '#FFFBF2', fontFamily: FONT, minHeight: 44, boxSizing: 'border-box',
    }}>
      {value.map(t => (
        <span key={t} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700,
          color: accent, background: accent + '18', borderRadius: 999, padding: '3px 6px 3px 10px',
        }}>
          #{t}
          <button type="button" onClick={() => retirer(t)} title="Retirer" style={{
            border: 'none', background: 'none', color: accent, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
          }}>×</button>
        </span>
      ))}
      <input
        value={saisie}
        onChange={e => {
          const v = e.target.value
          // Espace ou virgule => on valide le tag en cours.
          if (/[\s,]/.test(v)) ajouter(v)
          else setSaisie(v)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); ajouter(saisie) }
          else if (e.key === 'Backspace' && !saisie && value.length) retirer(value[value.length - 1])
        }}
        placeholder={value.length ? '' : placeholder}
        style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, fontFamily: FONT, color: '#2A2018' }}
      />
    </div>
  )
}
