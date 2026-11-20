'use client'
import { useState } from 'react'
import Link from 'next/link'
import { LogoBadge } from '@/components/Logo'

export default function ContactPage() {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [statut, setStatut] = useState<'' | 'envoi' | 'ok'>('')
  const [erreur, setErreur] = useState('')

  const envoyer = async () => {
    setErreur('')
    if (!message.trim()) { setErreur('Écris ton message.'); return }
    setStatut('envoi')
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, message }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setStatut(''); setErreur(json.error || 'Une erreur est survenue.'); return }
    setStatut('ok')
  }

  const champ: React.CSSProperties = {
    width: '100%', border: '1.5px solid var(--c-filet-fort)', borderRadius: 12, padding: '12px 14px',
    background: 'var(--c-papier)', fontSize: 14.5, outline: 'none', boxSizing: 'border-box',
    fontFamily: "var(--font-texte)",
  }

  return (
    <div className="bg-grille" style={{ minHeight: '100vh', backgroundColor: 'var(--c-papier-teinte)', fontFamily: "var(--font-texte)", color: 'var(--c-encre)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 22px 60px' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: 28 }}><LogoBadge size={20} /></Link>

        <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 800, fontSize: 30, margin: 0 }}>Nous contacter</h1>
        <p style={{ fontSize: 15.5, color: 'var(--c-annotation)', margin: '10px 0 26px' }}>
          Une question, un souci, une suggestion ? Écris-nous, le message arrive directement à l&apos;administrateur de codex.
        </p>

        <div style={{ background: '#fff', border: '1px solid var(--c-filet)', borderRadius: 18, padding: 24 }}>
          {statut === 'ok' ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Message envoyé !</div>
              <div style={{ fontSize: 14, color: 'var(--c-annotation)', marginTop: 6 }}>On te répondra dès que possible.</div>
              <Link href="/" style={{ display: 'inline-block', marginTop: 18, color: 'var(--c-accent)', fontWeight: 700, textDecoration: 'none' }}>Retour à l&apos;accueil</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom (facultatif)" style={champ} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ton email (pour qu'on te réponde)" style={champ} />
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Ton message…" rows={6}
                style={{ ...champ, resize: 'vertical', lineHeight: 1.5 }} />
              {erreur && <div style={{ fontSize: 13.5, color: 'var(--c-accent)' }}>{erreur}</div>}
              <button onClick={envoyer} disabled={statut === 'envoi'} style={{
                height: 50, border: 'none', borderRadius: 12, background: 'var(--c-accent)', color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: statut === 'envoi' ? 0.7 : 1,
                fontFamily: "var(--font-texte)",
              }}>{statut === 'envoi' ? 'Envoi…' : 'Envoyer le message'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
