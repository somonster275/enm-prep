'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'

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
    height: 48, border: `1px solid ${focused ? 'var(--c-encre)' : 'var(--c-filet-fort)'}`,
    borderRadius: 6, padding: '0 14px', background: '#FFFEFB',
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr',
      fontFamily: "var(--font-texte)", color: 'var(--c-encre)',
    }}>
      {/* Panneau gauche — poster de marque (masqué sur mobile) */}
      <div className="hide-mobile" style={{
        background: 'var(--c-encre)', color: 'var(--c-papier)', padding: 56,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 40,
      }}>
        <span style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start', padding: '3px 0' }}>
          <span style={{ position: 'absolute', left: -10, right: -10, top: '14%', bottom: '10%', background: 'var(--c-surligneur)', borderRadius: 4 }} />
          <span style={{ position: 'relative' }}><Logo size={40} color="var(--c-encre)" /></span>
        </span>
        <blockquote style={{ margin: 0, maxWidth: 460 }}>
          <p style={{ fontFamily: 'var(--font-titre)', fontSize: 28, lineHeight: 1.35, margin: 0, textWrap: 'balance' }}>
            « Nul ne peut être puni pour un crime ou pour un délit dont les éléments ne sont pas définis par la loi. »
          </p>
          <footer style={{ marginTop: 14, fontSize: 14, opacity: 0.7 }}>Article 111-3 du Code pénal. Une fiche parmi d&apos;autres.</footer>
        </blockquote>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="login-form" style={{ padding: '64px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: 'var(--c-papier)' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 34, letterSpacing: '-.015em' }}>
          Bon retour
        </div>
        <div style={{ fontSize: 15, color: 'var(--c-annotation)', marginTop: 6 }}>
          Connectez-vous pour reprendre vos révisions.
        </div>

        <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 7 }}>Email</label>
            <div style={inputStyle(false)}>
              <input
                id="login-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: 'var(--c-encre)', outline: 'none', width: '100%', fontFamily: "var(--font-texte)" }}
              />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <label htmlFor="login-mdp" style={{ fontSize: 14, fontWeight: 600 }}>Mot de passe</label>
              <button onClick={() => { setModeOubli(o => !o); setOEmail(email); setOStatut(''); setOErreur('') }} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: 'var(--c-annotation-clair)', fontWeight: 600, fontSize: 12.5, fontFamily: "var(--font-texte)",
              }}>Mot de passe oublié ?</button>
            </div>
            <div style={inputStyle(false)}>
              <input
                id="login-mdp" autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                placeholder="••••••••"
                style={{ border: 'none', background: 'transparent', fontSize: 15, color: 'var(--c-encre)', outline: 'none', flex: 1, fontFamily: "var(--font-texte)" }}
              />
              <button onClick={() => setShowPassword(v => !v)} style={{ border: 'none', background: 'transparent', fontSize: 13, color: 'var(--c-annotation-clair)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: "var(--font-texte)" }}>
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 14, fontSize: 14, color: 'var(--c-accent)', background: 'var(--c-accent-pale)', padding: '10px 14px', borderRadius: 10, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading} style={{
          marginTop: 26, height: 48, width: '100%',
          fontFamily: "var(--font-texte)", fontWeight: 600, fontSize: 15.5,
          color: '#fff', background: 'var(--c-accent)', border: 'none', borderRadius: 6,
          cursor: 'pointer', opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        {/* Mot de passe oublié */}
        {modeOubli && (
          <div style={{ marginTop: 18, background: 'var(--c-papier)', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '16px 16px' }}>
            {oStatut === 'ok' ? (
              <div style={{ fontSize: 13.5, color: '#0F6E56', textAlign: 'center', lineHeight: 1.5 }}>
                ✅ Si un compte existe pour cette adresse, un lien de réinitialisation vient d&apos;être envoyé. Ouvre-le pour choisir un nouveau mot de passe.
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--c-encre)', marginBottom: 4 }}>Réinitialiser le mot de passe</div>
                <div style={{ fontSize: 12.5, color: 'var(--c-annotation)', marginBottom: 12 }}>Reçois un lien par email pour en définir un nouveau.</div>
                <input type="email" value={oEmail} onChange={e => setOEmail(e.target.value)} placeholder="ton@email.fr"
                  onKeyDown={e => { if (e.key === 'Enter') envoyerReset() }}
                  style={{ width: '100%', height: 46, border: '1.5px solid var(--c-filet-fort)', borderRadius: 6, padding: '0 14px', background: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "var(--font-texte)" }} />
                {oErreur && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--c-accent)' }}>{oErreur}</div>}
                <button onClick={envoyerReset} disabled={oStatut === 'envoi'} style={{
                  marginTop: 12, height: 46, width: '100%', border: 'none', borderRadius: 6,
                  background: 'var(--c-accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  opacity: oStatut === 'envoi' ? 0.7 : 1, fontFamily: "var(--font-texte)",
                }}>{oStatut === 'envoi' ? 'Envoi…' : 'Envoyer le lien'}</button>
              </div>
            )}
          </div>
        )}

        {/* Demande d'accès lecteur */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--c-filet)' }}>
          {!modeDemande && (
            <div style={{ fontSize: 13.5, color: 'var(--c-annotation)', textAlign: 'center' }}>
              Pas encore de compte ?{' '}
              <button onClick={() => { setModeDemande(true); setDErreur('') }} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: 'var(--c-accent)', fontWeight: 700, fontSize: 13.5, fontFamily: "var(--font-texte)", textDecoration: 'underline',
              }}>Demander un accès</button>
            </div>
          )}

          {modeDemande && dStatut === 'ok' && (
            <div style={{ background: '#ECF7F0', border: '1px solid #BFE6CF', borderRadius: 6, padding: '14px 16px', fontSize: 13.5, color: '#0F6E56', textAlign: 'center' }}>
              ✅ Demande envoyée ! Un administrateur l'examinera et créera ton accès. Tu seras recontacté(e) par email.
            </div>
          )}

          {modeDemande && dStatut !== 'ok' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-encre)', marginBottom: 4 }}>Demander un accès</div>
              <div style={{ fontSize: 12.5, color: 'var(--c-annotation)', marginBottom: 14 }}>Ta demande est envoyée à l'administrateur, qui valide la création de ton compte.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input value={dNom} onChange={e => setDNom(e.target.value)} placeholder="Ton nom"
                  style={{ height: 46, border: '1.5px solid var(--c-filet-fort)', borderRadius: 6, padding: '0 14px', background: 'var(--c-papier)', fontSize: 14, outline: 'none', fontFamily: "var(--font-texte)" }} />
                <input type="email" value={dEmail} onChange={e => setDEmail(e.target.value)} placeholder="Ton email"
                  style={{ height: 46, border: '1.5px solid var(--c-filet-fort)', borderRadius: 6, padding: '0 14px', background: 'var(--c-papier)', fontSize: 14, outline: 'none', fontFamily: "var(--font-texte)" }} />
                <textarea value={dMessage} onChange={e => setDMessage(e.target.value)} placeholder="Message (facultatif) — qui es-tu, pourquoi cet accès…" rows={2}
                  style={{ border: '1.5px solid var(--c-filet-fort)', borderRadius: 6, padding: '10px 14px', background: 'var(--c-papier)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: "var(--font-texte)" }} />
              </div>
              {dErreur && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--c-accent)' }}>{dErreur}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={() => { setModeDemande(false); setDErreur('') }} style={{
                  flex: 1, height: 48, border: '1.5px solid var(--c-filet-fort)', background: '#fff', borderRadius: 6,
                  fontSize: 14, fontWeight: 600, color: 'var(--c-texte-doux)', cursor: 'pointer', fontFamily: "var(--font-texte)",
                }}>Annuler</button>
                <button onClick={envoyerDemande} disabled={dStatut === 'envoi'} style={{
                  flex: 2, height: 48, border: 'none', background: 'var(--c-accent)', color: '#fff', borderRadius: 6,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: dStatut === 'envoi' ? 0.7 : 1, fontFamily: "var(--font-texte)",
                }}>{dStatut === 'envoi' ? 'Envoi…' : 'Envoyer la demande'}</button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
