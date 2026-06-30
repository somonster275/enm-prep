'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import TagsInput from './TagsInput'
import { nettoyerTags } from '@/lib/tags'

const FONT = "'Hanken Grotesk', sans-serif"

// Édite les tags d'une ressource déjà enregistrée (cours, média, mind map, QCM…).
// Affiche les tags ; en mode admin, permet de les modifier et d'enregistrer
// directement (update sur la table). Pour les non-admins : pastilles en lecture.
export default function TagsEditeur({
  table, id, initial, accent = '#7C5CBF', canEdit,
}: {
  table: string
  id: string
  initial: unknown
  accent?: string
  canEdit: boolean
}) {
  const [tags, setTags] = useState<string[]>(nettoyerTags(initial))
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [enregistre, setEnregistre] = useState(false)

  const enregistrer = async () => {
    setSaving(true)
    const { error } = await supabase.from(table).update({ tags }).eq('id', id)
    setSaving(false)
    if (!error) { setEdit(false); setEnregistre(true); setTimeout(() => setEnregistre(false), 2000) }
  }

  const chips = (interactif: boolean) => tags.map(t => (
    <span key={t} style={{ fontSize: 11, fontWeight: 700, color: accent, background: accent + '18', borderRadius: 999, padding: '2px 9px' }}>#{t}</span>
  ))

  if (!canEdit) {
    if (tags.length === 0) return null
    return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>{chips(false)}</div>
  }

  if (edit) {
    return (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }} onClick={e => e.stopPropagation()}>
        <TagsInput value={tags} onChange={setTags} accent={accent} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={enregistrer} disabled={saving} style={{ height: 34, padding: '0 16px', border: 'none', borderRadius: 9, background: accent, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, opacity: saving ? 0.6 : 1 }}>{saving ? 'Enregistrement…' : 'Enregistrer les tags'}</button>
          <button onClick={() => { setTags(nettoyerTags(initial)); setEdit(false) }} style={{ height: 34, padding: '0 12px', border: '1px solid #EADFC9', borderRadius: 9, background: '#fff', color: '#8A7E68', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Annuler</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }} onClick={e => e.stopPropagation()}>
      {chips(true)}
      <button onClick={() => setEdit(true)} style={{
        fontSize: 11.5, fontWeight: 700, color: accent, background: 'transparent',
        border: `1px dashed ${accent}66`, borderRadius: 999, padding: '2px 10px', cursor: 'pointer', fontFamily: FONT,
      }}>
        {tags.length ? '✎ Tags' : '+ Ajouter des tags'}
      </button>
      {enregistre && <span style={{ fontSize: 11.5, color: '#0F6E56', fontWeight: 700 }}>✓ enregistré</span>}
    </div>
  )
}
