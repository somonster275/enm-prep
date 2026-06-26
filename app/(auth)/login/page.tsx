'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LogoPoster } from '@/components/Logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Identifiants incorrects.')
      setLoading(false)
      return
    }
    window.location.assign('/dashboard')
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 52, border: `1.5px solid ${focused ? '#DC4A2B' : '#EADFC9'}`,
    borderRadius: 14, padding: '0 16px',
    background: focused ? '#fff' : '#FFFBF2',
    boxShadow: focused ? '0 0 0 4px rgba(220,74,43,.12)' : 'none',
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
      fontFamily: "'Hanken Grotesk', sans-serif", color: '#2A2018',
    }}>
      {/* Panneau gauche — poster de marque */}
      <div style={{
        position: 'relative', background: '#C6C4BD', overflow: 'hidden',
        padding: 52, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        color: '#2A2018',
      }}>
        {/* vignette papier */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 120% at 50% 40%, rgba(255,255,255,.18), rgba(0,0,0,.06))', pointerEvents: 'none' }} />

        {/* libellés pivotés façon poster */}
        <div style={{ position: 'absolute', top: 30, right: 30, writingMode: 'vertical-rl', fontSize: 13, letterSpacing: '.12em', color: '#3A352F', fontWeight: 600 }}>prép</div>
        <div style={{ position: 'absolute', bottom: 30, left: 30, writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 13, letterSpacing: '.12em', color: '#3A352F', fontWeight: 600 }}>ENM · 2026</div>

        {/* bloc rouge + « codex » qui DÉBORDE des bords, centré, comme le poster */}
        <LogoPoster width={460} />
      </div>

      {/* Panneau droit — formulaire */}
      <div style={{ padding: '64px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fff' }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30, letterSpacing: '-.01em' }}>
          Bon retour 👋
        </div>
        <div style={{ fontSize: 15, color: '#8A7E68', marginTop: 6 }}>
          Connectez-vous pour continuer vos révisions.
        </div>

        <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5C4A22', marginBottom: 8 }}>Email</div>
            <div style={inputStyle(false)}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#2A2018', outline: 'none', width: '100%', fontFamily: "'Hanken Grotesk', sans-serif" }}
              />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#5C4A22' }}>Mot de passe</div>
            </div>
            <div style={inputStyle(false)}>
              <input
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                placeholder="••••••••"
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: '#2A2018', outline: 'none', flex: 1, fontFamily: "'Hanken Grotesk', sans-serif" }}
              />
              <button onClick={() => setShowPassword(v => !v)} style={{ border: 'none', background: 'transparent', fontSize: 13, color: '#9A8D72', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: "'Hanken Grotesk', sans-serif" }}>
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 14, fontSize: 14, color: '#D94A30', background: '#FCE9E3', padding: '10px 14px', borderRadius: 10, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading} style={{
          marginTop: 26, height: 54,
          fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 700, fontSize: 16,
          color: '#fff', background: '#DC4A2B', border: 'none', borderRadius: 14,
          cursor: 'pointer', opacity: loading ? 0.7 : 1,
          boxShadow: '0 12px 24px -10px rgba(220,74,43,.8)',
        }}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
    </div>
  )
}
