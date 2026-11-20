'use client' // Remplace le layout racine quand celui-ci plante : document et styles propres.

import { useEffect } from 'react'

export default function ErreurGlobale({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <html lang="fr">
      <body style={{ margin: 0, background: '#FFFBF2', fontFamily: 'system-ui, sans-serif', color: '#2A2018' }}>
        <title>Erreur — codex</title>
        <div role="alert" style={{ maxWidth: 460, margin: '15vh auto', padding: '0 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Un problème est survenu</h1>
          <p style={{ fontSize: 15, color: '#6E6456', lineHeight: 1.55, margin: '0 0 22px' }}>
            L&apos;application n&apos;a pas pu se charger. Ta progression enregistrée n&apos;est pas perdue.
          </p>
          <button onClick={() => retry()} style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 11, background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Réessayer</button>
        </div>
      </body>
    </html>
  )
}
