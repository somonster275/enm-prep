'use client' // Les error boundaries sont des Client Components

import { useEffect } from 'react'

// Page affichée quand une page plante (au lieu de l'écran d'erreur brut de Next.js).
export default function Erreur({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  const ref = error instanceof Error && 'digest' in error ? String((error as Error & { digest?: string }).digest) : null

  return (
    <div role="alert" style={{ maxWidth: 460, margin: '12vh auto', padding: '0 16px', textAlign: 'center', fontFamily: "var(--font-texte)", color: '#211C19' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
      <h1 style={{ fontFamily: "var(--font-titre)", fontSize: 22, fontWeight: 'var(--titre-poids)', margin: '0 0 8px' }}>Un problème est survenu</h1>
      <p style={{ fontSize: 14.5, color: '#574F47', lineHeight: 1.55, margin: '0 0 22px' }}>
        La page n&apos;a pas pu s&apos;afficher. Ta progression enregistrée n&apos;est pas perdue : réessaie, ou reviens au tableau de bord.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => retry()} style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 11, background: '#A3122A', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Réessayer</button>
        <a href="/dashboard" style={{ height: 44, padding: '0 22px', display: 'inline-flex', alignItems: 'center', border: '1.5px solid #DCD5C9', borderRadius: 11, color: '#211C19', fontSize: 14.5, fontWeight: 600, textDecoration: 'none' }}>Tableau de bord</a>
      </div>
      {ref && <p style={{ fontSize: 11.5, color: '#7A7167', marginTop: 22 }}>Référence à transmettre si le problème persiste : {ref}</p>}
    </div>
  )
}
