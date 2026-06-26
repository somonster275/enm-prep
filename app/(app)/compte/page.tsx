'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ComptePage() {
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [mdp2, setMdp2] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
  }, [])

  const changerMdp = async () => {
    setMessage(null)
    if (mdp.length < 6) { setMessage({ type: 'err', texte: 'Le mot de passe doit faire au moins 6 caractères.' }); return }
    if (mdp !== mdp2) { setMessage({ type: 'err', texte: 'Les deux mots de passe ne correspondent pas.' }); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: mdp })
    setLoading(false)
    if (error) { setMessage({ type: 'err', texte: error.message }); return }
    setMdp(''); setMdp2('')
    setMessage({ type: 'ok', texte: 'Mot de passe mis à jour ✅' })
  }

  const champ: React.CSSProperties = {
    width: '100%', height: 46, border: '1.5px solid #EADFC9', borderRadius: 12,
    padding: '0 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Hanken Grotesk', sans-serif",
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 520, margin: '0 auto', fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 1.5rem' }}>Mon compte</h1>

      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: '1.5rem' }}>
        <div style={{ fontSize: 13, color: '#8A7E68', marginBottom: 4 }}>Connecté en tant que</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 24 }}>{email}</div>

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Définir mon mot de passe</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="password" value={mdp} onChange={e => setMdp(e.target.value)} placeholder="Nouveau mot de passe" style={champ} />
          <input type="password" value={mdp2} onChange={e => setMdp2(e.target.value)} placeholder="Confirme le mot de passe"
            onKeyDown={e => { if (e.key === 'Enter') changerMdp() }} style={champ} />
        </div>

        {message && (
          <div style={{ marginTop: 12, fontSize: 13.5, color: message.type === 'ok' ? '#0F6E56' : '#D94A30' }}>
            {message.texte}
          </div>
        )}

        <button onClick={changerMdp} disabled={loading} style={{
          marginTop: 18, height: 48, width: '100%', border: 'none', borderRadius: 12,
          background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          opacity: loading ? 0.7 : 1, fontFamily: "'Hanken Grotesk', sans-serif",
        }}>
          {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>
      </div>
    </div>
  )
}
