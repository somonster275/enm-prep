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

  // Mot de passe oublié (self-service)
  const [modeOubli, setModeOubli] = useState(false)
  const [oEmail, setOEmail] = useState('')
  const [oStatut, setOStatut] = useState<'' | 'envoi' | 'ok'>('')
  const [oErreur, setOErreur] = useState('')

  const envoyerReset = async () => {
    const mail = (oEmail || email).trim()
    if (!mail) { setOErreur('Indique ton adresse email.'); return }
    setOStatut('envoi'); setOErreur('')
    // Email de récupération Supabase : le lien ramène sur /bienvenue pour
    // définir un nouveau mot de passe (même page que les invitations).
    const { error } = await supabase.auth.resetPasswordForEmail(mail, {
      redirectTo: `${window.location.origin}/bienvenue`,
    })
    if (error) { setOStatut(''); setOErreur(error.message); return }
    setOStatut('ok')
  }

  // Demande d'accès lecteur (self-service)
  const [modeDemande, setModeDemande] = useState(false)
  const [dNom, setDNom] = useState('')
  const [dEmail, setDEmail] = useState('')
  const [dMessage, setDMessage] = useState('')
  const [dStatut, setDStatut] = useState<'' | 'envoi' | 'ok'>('')
  const [dErreur, setDErreur] = useState('')

  const envoyerDemande = async () => {
    if (!dEmail.trim()) { setDErreur('Indique ton adresse email.'); return }
    setDStatut('envoi'); setDErreur('')
    const res = await fetch('/api/acces/demande', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: dNom, email: dEmail, message: dMessage }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setDStatut(''); setDErreur(json.error || 'Une erreur est survenue.'); return }
    setDStatut('ok')
  }

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const m = error.message
      setError(
        m === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.'
        : m === 'Email not confirmed' ? "Ton email n'est pas encore confirmé."
        : m.toLowerCase().includes('rate limit') ? 'Trop de tentatives, réessaie dans quelques minutes.'
        : m
      )
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
      {/* Panneau gauche — poster de marque (masqué sur mobile) */}
      <div className="hide-mobile" style={{
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
      <div className="login-form" style={{ padding: '64px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fff' }}>
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
              <button onClick={() => { setModeOubli(o => !o); setOEmail(email); setOStatut(''); setOErreur('') }} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: '#9A8D72', fontWeight: 600, fontSize: 12.5, fontFamily: "'Hanken Grotesk', sans-serif",
              }}>Mot de passe oublié ?</button>
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

        {/* Mot de passe oublié */}
        {modeOubli && (
          <div style={{ marginTop: 18, background: '#FFFBF2', border: '1px solid #EFE7D7', borderRadius: 14, padding: '16px 16px' }}>
            {oStatut === 'ok' ? (
              <div style={{ fontSize: 13.5, color: '#0F6E56', textAlign: 'center', lineHeight: 1.5 }}>
                ✅ Si un compte existe pour cette adresse, un lien de réinitialisation vient d&apos;être envoyé. Ouvre-le pour choisir un nouveau mot de passe.
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2A2018', marginBottom: 4 }}>Réinitialiser le mot de passe</div>
                <div style={{ fontSize: 12.5, color: '#8A7E68', marginBottom: 12 }}>Reçois un lien par email pour en définir un nouveau.</div>
                <input type="email" value={oEmail} onChange={e => setOEmail(e.target.value)} placeholder="ton@email.fr"
                  onKeyDown={e => { if (e.key === 'Enter') envoyerReset() }}
                  style={{ width: '100%', height: 46, border: '1.5px solid #EADFC9', borderRadius: 12, padding: '0 14px', background: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "'Hanken Grotesk', sans-serif" }} />
                {oErreur && <div style={{ marginTop: 10, fontSize: 13, color: '#D94A30' }}>{oErreur}</div>}
                <button onClick={envoyerReset} disabled={oStatut === 'envoi'} style={{
                  marginTop: 12, height: 46, width: '100%', border: 'none', borderRadius: 12,
                  background: '#DC4A2B', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  opacity: oStatut === 'envoi' ? 0.7 : 1, fontFamily: "'Hanken Grotesk', sans-serif",
                }}>{oStatut === 'envoi' ? 'Envoi…' : 'Envoyer le lien'}</button>
              </div>
            )}
          </div>
        )}

        {/* Demande d'accès lecteur */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #EFE7D7' }}>
          {!modeDemande && (
            <div style={{ fontSize: 13.5, color: '#8A7E68', textAlign: 'center' }}>
              Pas encore de compte ?{' '}
              <button onClick={() => { setModeDemande(true); setDErreur('') }} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: '#DC4A2B', fontWeight: 700, fontSize: 13.5, fontFamily: "'Hanken Grotesk', sans-serif", textDecoration: 'underline',
              }}>Demander un accès lecteur</button>
            </div>
          )}

          {modeDemande && dStatut === 'ok' && (
            <div style={{ background: '#ECF7F0', border: '1px solid #BFE6CF', borderRadius: 12, padding: '14px 16px', fontSize: 13.5, color: '#0F6E56', textAlign: 'center' }}>
              ✅ Demande envoyée ! Un administrateur l'examinera et créera ton accès. Tu seras recontacté(e) par email.
            </div>
          )}

          {modeDemande && dStatut !== 'ok' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2A2018', marginBottom: 4 }}>Demander un accès lecteur</div>
              <div style={{ fontSize: 12.5, color: '#8A7E68', marginBottom: 14 }}>Ta demande est envoyée à l'administrateur, qui valide la création de ton compte.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input value={dNom} onChange={e => setDNom(e.target.value)} placeholder="Ton nom"
                  style={{ height: 46, border: '1.5px solid #EADFC9', borderRadius: 12, padding: '0 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', fontFamily: "'Hanken Grotesk', sans-serif" }} />
                <input type="email" value={dEmail} onChange={e => setDEmail(e.target.value)} placeholder="Ton email"
                  style={{ height: 46, border: '1.5px solid #EADFC9', borderRadius: 12, padding: '0 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', fontFamily: "'Hanken Grotesk', sans-serif" }} />
                <textarea value={dMessage} onChange={e => setDMessage(e.target.value)} placeholder="Message (facultatif) — qui es-tu, pourquoi cet accès…" rows={2}
                  style={{ border: '1.5px solid #EADFC9', borderRadius: 12, padding: '10px 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: "'Hanken Grotesk', sans-serif" }} />
              </div>
              {dErreur && <div style={{ marginTop: 10, fontSize: 13, color: '#D94A30' }}>{dErreur}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={() => { setModeDemande(false); setDErreur('') }} style={{
                  flex: 1, height: 48, border: '1.5px solid #EADFC9', background: '#fff', borderRadius: 12,
                  fontSize: 14, fontWeight: 600, color: '#6E6456', cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
                }}>Annuler</button>
                <button onClick={envoyerDemande} disabled={dStatut === 'envoi'} style={{
                  flex: 2, height: 48, border: 'none', background: '#DC4A2B', color: '#fff', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: dStatut === 'envoi' ? 0.7 : 1, fontFamily: "'Hanken Grotesk', sans-serif",
                }}>{dStatut === 'envoi' ? 'Envoi…' : 'Envoyer la demande'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
