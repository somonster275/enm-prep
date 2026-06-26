'use client'
import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

const COULEURS_TEXTE = ['#2A2018', '#DC4A2B', '#D94A30', '#0E7C63', '#1D4ED8', '#BE185D']
const COULEURS_SURLIGNAGE = ['#FFF3A3', '#C8F5DE', '#FAD9D0', '#D9E4FF', '#F3D9FB']

export default function RichEditor({ value, onChange, placeholder, minHeight = 120 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [showColors, setShowColors] = useState(false)
  const [showHighlight, setShowHighlight] = useState(false)

  // Initialise le contenu une seule fois (évite de casser le curseur à chaque frappe)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = () => { if (ref.current) onChange(ref.current.innerHTML) }

  const cmd = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    emit()
  }

  const insererImage = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      ref.current?.focus()
      document.execCommand('insertImage', false, reader.result as string)
      emit()
    }
    reader.readAsDataURL(file)
  }

  const font = "'Hanken Grotesk', sans-serif"
  const fileRef = useRef<HTMLInputElement>(null)

  const Btn = ({ onClick, title, children, active }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) => (
    <button
      type="button" title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      style={{
        minWidth: 32, height: 32, padding: '0 8px', borderRadius: 7,
        border: '1px solid #EADFC9', background: active ? '#FCE3D3' : '#fff',
        color: '#2A2018', cursor: 'pointer', fontSize: 14, fontFamily: font,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >{children}</button>
  )

  return (
    <div style={{ border: '1.5px solid #EADFC9', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      {/* Barre d'outils */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8, borderBottom: '1px solid #F0E7D6', background: '#FFFBF2', position: 'relative' }}>
        <Btn onClick={() => cmd('bold')} title="Gras"><b>G</b></Btn>
        <Btn onClick={() => cmd('italic')} title="Italique"><i>I</i></Btn>
        <Btn onClick={() => cmd('underline')} title="Souligné"><u>S</u></Btn>
        <Btn onClick={() => cmd('strikeThrough')} title="Barré"><s>B</s></Btn>

        <div style={{ width: 1, background: '#EADFC9', margin: '2px 4px' }} />

        {/* Couleur du texte */}
        <div style={{ position: 'relative' }}>
          <Btn onClick={() => { setShowColors(s => !s); setShowHighlight(false) }} title="Couleur du texte"><span style={{ color: '#DC4A2B', fontWeight: 700 }}>A</span></Btn>
          {showColors && (
            <div style={{ position: 'absolute', top: 36, left: 0, zIndex: 30, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 10, padding: 8, boxShadow: '0 6px 18px -6px rgba(40,30,60,.2)', display: 'flex', gap: 6 }}>
              {COULEURS_TEXTE.map(c => (
                <button key={c} type="button" onMouseDown={e => { e.preventDefault(); cmd('foreColor', c); setShowColors(false) }}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '2px solid #fff', boxShadow: '0 0 0 1px #EADFC9', cursor: 'pointer' }} />
              ))}
            </div>
          )}
        </div>

        {/* Surlignage */}
        <div style={{ position: 'relative' }}>
          <Btn onClick={() => { setShowHighlight(s => !s); setShowColors(false) }} title="Surligner"><span style={{ background: '#FFF3A3', padding: '0 3px', borderRadius: 3 }}>H</span></Btn>
          {showHighlight && (
            <div style={{ position: 'absolute', top: 36, left: 0, zIndex: 30, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 10, padding: 8, boxShadow: '0 6px 18px -6px rgba(40,30,60,.2)', display: 'flex', gap: 6, alignItems: 'center' }}>
              {COULEURS_SURLIGNAGE.map(c => (
                <button key={c} type="button" onMouseDown={e => { e.preventDefault(); cmd('hiliteColor', c); setShowHighlight(false) }}
                  style={{ width: 22, height: 22, borderRadius: 6, background: c, border: '1px solid #EADFC9', cursor: 'pointer' }} />
              ))}
              <button type="button" onMouseDown={e => { e.preventDefault(); cmd('hiliteColor', 'transparent'); setShowHighlight(false) }}
                title="Retirer le surlignage"
                style={{ width: 22, height: 22, borderRadius: 6, background: '#fff', border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
          )}
        </div>

        <div style={{ width: 1, background: '#EADFC9', margin: '2px 4px' }} />

        <Btn onClick={() => cmd('insertUnorderedList')} title="Liste à puces">≔</Btn>
        <Btn onClick={() => cmd('insertOrderedList')} title="Liste numérotée">1.</Btn>
        <Btn onClick={() => fileRef.current?.click()} title="Insérer une image">🖼️</Btn>
        <Btn onClick={() => cmd('removeFormat')} title="Effacer la mise en forme">⌫</Btn>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) insererImage(f); e.target.value = '' }} />
      </div>

      {/* Zone éditable */}
      <div
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || 'Saisis ton texte…'}
        onInput={emit}
        onBlur={emit}
        style={{
          minHeight, padding: '12px 14px', fontSize: 14, lineHeight: 1.7,
          color: '#2A2018', fontFamily: font, background: '#fff',
        }}
      />
    </div>
  )
}
