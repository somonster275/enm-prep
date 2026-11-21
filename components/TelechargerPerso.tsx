'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { copieExistante, telecharger, type SourceType } from '@/lib/espace-perso'
import { rafraichir, preparerPages } from '@/lib/hors-ligne'

/** Bouton « Télécharger dans mon espace » ; devient un lien vers la copie une fois téléchargé. */
export default function TelechargerPerso({ type, id }: { type: SourceType; id: string }) {
  const [copie, setCopie] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => { copieExistante(type, id).then(setCopie) }, [type, id])

  const style: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-texte)',
    whiteSpace: 'nowrap', textDecoration: 'none', cursor: 'pointer',
    background: 'var(--c-papier-teinte)', color: 'var(--c-encre)', border: '1px solid var(--c-filet-fort)',
  }

  if (copie) return <Link href={`/mon-espace/${copie}`} style={style}>Dans mon espace →</Link>

  const lancer = async () => {
    setEnCours(true); setErreur('')
    try {
      const pid = await telecharger(type, id)
      setCopie(pid)
      rafraichir().then(() => preparerPages([pid])) // disponible hors ligne tout de suite
    }
    catch (e) { setErreur('Erreur : ' + (e as Error).message) }
    setEnCours(false)
  }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button onClick={lancer} disabled={enCours} style={{ ...style, opacity: enCours ? 0.6 : 1 }}>
        {enCours ? 'Téléchargement…' : 'Télécharger dans mon espace'}
      </button>
      {erreur && <span role="alert" style={{ fontSize: 12, color: 'var(--c-accent)' }}>{erreur}</span>}
    </span>
  )
}
