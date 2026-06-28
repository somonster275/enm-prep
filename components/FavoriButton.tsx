'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Étoile pour ajouter/retirer une fiche des favoris.
export default function FavoriButton({ ficheId, uid, initial }: { ficheId: string; uid: string; initial: boolean }) {
  const [fav, setFav] = useState(initial)
  const [busy, setBusy] = useState(false)

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (busy || !uid) return
    const next = !fav
    setFav(next); setBusy(true)
    if (next) await supabase.from('favoris').upsert({ user_id: uid, fiche_id: ficheId }, { onConflict: 'user_id,fiche_id' })
    else await supabase.from('favoris').delete().eq('user_id', uid).eq('fiche_id', ficheId)
    setBusy(false)
  }

  return (
    <button onClick={toggle} title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} style={{
      border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1,
      color: fav ? '#E8A11E' : '#C0B7A4', padding: 2,
    }}>{fav ? '★' : '☆'}</button>
  )
}
