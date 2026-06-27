'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BienvenuePage() {
  // 'verif' = on traite le lien ; 'pret' = session OK, formulaire ; 'invalide' = lien KO
  const [etat, setEtat] = useState<'verif' | 'pret' | 'invalide'>('verif')
  const [mdp, setMdp] = useState('')
  const [mdp2, setMdp2] = useState('')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let resolu = false
    // Le client Supabase détecte automatiquement le jeton dans l'URL (invitation).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { resolu = true; setEtat('pret') }
    })
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { resolu = true; setEtat('pret') }
    })
    // Si rien après 5 s, on considère le lien invalide/expiré.
    const t = setTimeout(() => { if (!resolu) setEtat('invalide') }, 5000)
    return () => { sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  const definir = async () => {
    setErreur('')
    if (mdp.length < 6) { setErreur('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (mdp !== mdp2) { setErreur('Les deux mots de passe ne correspondent pas.'); return }
    setLoading(true)

    // 1) Enregistre le mot de passe (la session d'invitation est active).
    const { data: upd, error } = await supabase.auth.updateUser({ password: mdp })
    if (error) { setLoading(false); setErreur(error.message); return }
    const email = upd.user?.email ?? ''

    // 2) Établit une session pleinement valide AVANT d'entrer dans l'espace, pour
    //    ne pas dépendre de la latence d'enregistrement chez Supabase. On se
    //    reconnecte en arrière-plan avec le mot de passe qu'on vient de définir,
    //    en réessayant quelques fois : l'étudiant entre directement, sans avoir
    //    à se reconnecter lui-même derrière.
    let connecte = false
    if (email) {
      for (let i = 0; i < 5; i++) {
        const { data: sign, error: signErr } = await supabase.auth.signInWithPassword({ email, password: mdp })
        if (!signErr && sign.session) { connecte = true; break }
        await new Promise(r => setTimeout(r, 800))
      }
    }

    setLoading(false)
    setDone(true)
    // 3) Entrée directe. Si la reconnexion en arrière-plan a échoué malgré les
    //    tentatives, la session d'invitation reste valable : on tente l'entrée,
    //    et l'AuthGuard renverra au besoin vers /login.
    void connecte
    window.location.assign('/dashboard')
  }

  const champ: React.CSSProperties = {
    width: '100%', height: 48, border: '1.5px solid #EADFC9', borderRadius: 12,
    padding: '0 14px', background: '#FFFBF2', fontSize: 15, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Hanken Grotesk', sans-serif",
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDF6EA', fontFamily: "'Hanken Grotesk', sans-serif", color: '#2A2018', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: '2rem', boxShadow: '0 20px 44px -28px rgba(60,40,20,.22)' }}>

        {etat === 'verif' && (
          <div style={{ textAlign: 'center', color: '#8A7E68' }}>Vérification de ton lien…</div>
        )}

        {etat === 'invalide' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Lien invalide ou expiré</div>
            <div style={{ fontSize: 14, color: '#8A7E68', marginBottom: 18 }}>Ce lien d&apos;invitation n&apos;est plus valable. Demande à l&apos;administrateur de te renvoyer une invitation.</div>
            <a href="/login" style={{ color: '#DC4A2B', fontWeight: 700, textDecoration: 'none' }}>Aller à la connexion</a>
          </div>
        )}

        {etat === 'pret' && !done && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Bienvenue 🎓</div>
            <div style={{ fontSize: 14, color: '#8A7E68', marginBottom: 22 }}>Choisis ton mot de passe pour finaliser ton accès.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="password" value={mdp} onChange={e => setMdp(e.target.value)} placeholder="Mot de passe" style={champ} />
              <input type="password" value={mdp2} onChange={e => setMdp2(e.target.value)} placeholder="Confirme le mot de passe"
                onKeyDown={e => { if (e.key === 'Enter') definir() }} style={champ} />
            </div>
            {erreur && <div style={{ marginTop: 12, fontSize: 13.5, color: '#D94A30' }}>{erreur}</div>}
            <button onClick={definir} disabled={loading} style={{
              marginTop: 18, height: 50, width: '100%', border: 'none', borderRadius: 12,
              background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: "'Hanken Grotesk', sans-serif",
            }}>
              {loading ? 'Enregistrement…' : 'Valider et accéder à codex'}
            </button>
          </div>
        )}

        {done && (
          <div style={{ textAlign: 'center', color: '#0F6E56' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>✅ C&apos;est fait !</div>
            <div style={{ fontSize: 14, color: '#8A7E68' }}>Redirection vers ton espace…</div>
          </div>
        )}
      </div>
    </div>
  )
}
