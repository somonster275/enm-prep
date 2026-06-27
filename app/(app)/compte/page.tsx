'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ComptePage() {
  const [email, setEmail] = useState('')

  // Identité
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [savingId, setSavingId] = useState(false)
  const [msgId, setMsgId] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  // Mot de passe
  const [mdp, setMdp] = useState('')
  const [mdp2, setMdp2] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setEmail(u?.email || '')
      if (u) {
        const { data: prof } = await supabase.from('profils').select('*').eq('id', u.id).single()
        setPrenom(prof?.prenom || '')
        setNom(prof?.nom || '')
      }
    })
  }, [])

  const enregistrerIdentite = async () => {
    setMsgId(null); setSavingId(true)
    const res = await fetch('/api/compte/profil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, prenom }),
    })
    setSavingId(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setMsgId({ type: 'err', texte: json.error || 'Une erreur est survenue.' }); return }
    setMsgId({ type: 'ok', texte: 'Identité mise à jour ✅' })
  }

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

  // RGPD : suppression de compte (droit à l'effacement)
  const [suppOuvert, setSuppOuvert] = useState(false)
  const [confirmTxt, setConfirmTxt] = useState('')
  const [suppLoading, setSuppLoading] = useState(false)
  const [suppErr, setSuppErr] = useState('')

  const supprimerCompte = async () => {
    setSuppErr(''); setSuppLoading(true)
    const res = await fetch('/api/compte/supprimer', { method: 'POST' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSuppLoading(false); setSuppErr(j.error || 'La suppression a échoué.'); return
    }
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  const champ: React.CSSProperties = {
    width: '100%', height: 46, border: '1.5px solid #EADFC9', borderRadius: 12,
    padding: '0 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Hanken Grotesk', sans-serif",
  }
  const carte: React.CSSProperties = {
    background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: '1.5rem',
  }
  const bouton = (disabled: boolean): React.CSSProperties => ({
    marginTop: 18, height: 48, width: '100%', border: 'none', borderRadius: 12,
    background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    opacity: disabled ? 0.7 : 1, fontFamily: "'Hanken Grotesk', sans-serif",
  })

  return (
    <div style={{ padding: '1.5rem', maxWidth: 520, margin: '0 auto', fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 1.5rem' }}>Mon compte</h1>

      {/* Identité */}
      <div style={carte}>
        <div style={{ fontSize: 13, color: '#8A7E68', marginBottom: 4 }}>Connecté en tant que</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 24 }}>{email}</div>

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Mon identité</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#5C4A22', display: 'block', marginBottom: 6 }}>Prénom</label>
            <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Ton prénom" style={champ} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#5C4A22', display: 'block', marginBottom: 6 }}>Nom</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ton nom"
              onKeyDown={e => { if (e.key === 'Enter') enregistrerIdentite() }} style={champ} />
          </div>
        </div>

        {msgId && (
          <div style={{ marginTop: 12, fontSize: 13.5, color: msgId.type === 'ok' ? '#0F6E56' : '#D94A30' }}>
            {msgId.texte}
          </div>
        )}

        <button onClick={enregistrerIdentite} disabled={savingId} style={bouton(savingId)}>
          {savingId ? 'Enregistrement…' : 'Enregistrer mon identité'}
        </button>
      </div>

      {/* Mot de passe */}
      <div style={{ ...carte, marginTop: 20 }}>
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

        <button onClick={changerMdp} disabled={loading} style={bouton(loading)}>
          {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>
      </div>

      {/* Widget ENT Paris 1 */}
      <div style={{ ...carte, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EEF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🎓</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>ENT — Université Paris 1</div>
            <div style={{ fontSize: 13, color: '#8A7E68', marginTop: 2 }}>Ton environnement numérique de travail (Panthéon-Sorbonne).</div>
          </div>
        </div>
        <a href="https://ent.univ-paris1.fr/" target="_blank" rel="noopener noreferrer" style={{
          marginTop: 16, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: '1.5px solid #C9D6F0', borderRadius: 12, background: '#F5F8FE',
          color: '#274690', fontSize: 14.5, fontWeight: 700, textDecoration: 'none',
        }}>
          Ouvrir mon ENT
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
        </a>
      </div>

      {/* Mes données — RGPD */}
      <div style={{ ...carte, marginTop: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>Mes données</h2>
        <div style={{ fontSize: 13.5, color: '#8A7E68', lineHeight: 1.5, marginBottom: 16 }}>
          Tes données t&apos;appartiennent. Tu peux les exporter à tout moment ou supprimer
          définitivement ton compte. Voir la <a href="/donnees" style={{ color: '#DC4A2B', fontWeight: 700, textDecoration: 'none' }}>politique de confidentialité</a>.
        </div>

        <a href="/api/compte/exporter" style={{
          height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: '1.5px solid #EADFC9', borderRadius: 12, background: '#FFFBF2',
          color: '#2A2018', fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}>Exporter mes données (JSON)</a>

        <button onClick={() => { setSuppOuvert(true); setConfirmTxt(''); setSuppErr('') }} style={{
          marginTop: 10, height: 46, width: '100%', border: '1.5px solid #F3C6BC', borderRadius: 12,
          background: '#fff', color: '#D94A30', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}>Supprimer mon compte</button>
      </div>

      {/* Modal de confirmation de suppression */}
      {suppOuvert && (
        <div onClick={() => !suppLoading && setSuppOuvert(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,20,.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 440, fontFamily: "'Hanken Grotesk', sans-serif", color: '#2A2018' }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Supprimer mon compte</div>
            <div style={{ fontSize: 14, color: '#8A7E68', lineHeight: 1.5, marginBottom: 14 }}>
              Cette action est <b>irréversible</b>. Toutes tes données (progression, notes, fiche d&apos;entraide,
              liens, remarques…) seront <b>définitivement supprimées</b>. Pour confirmer, écris <b>SUPPRIMER</b> ci-dessous.
            </div>
            <input value={confirmTxt} onChange={e => setConfirmTxt(e.target.value)} placeholder="SUPPRIMER"
              style={{ width: '100%', height: 46, border: '1.5px solid #EADFC9', borderRadius: 12, padding: '0 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "'Hanken Grotesk', sans-serif" }} />
            {suppErr && <div style={{ color: '#D94A30', fontSize: 13, marginTop: 8 }}>{suppErr}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setSuppOuvert(false)} disabled={suppLoading} style={{ flex: 1, height: 46, border: '1.5px solid #EADFC9', background: '#fff', borderRadius: 11, fontSize: 14, fontWeight: 600, color: '#6E6456', cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif" }}>Annuler</button>
              <button onClick={supprimerCompte} disabled={suppLoading || confirmTxt.trim().toUpperCase() !== 'SUPPRIMER'} style={{
                flex: 2, height: 46, border: 'none', borderRadius: 11, background: '#D94A30', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif",
                opacity: (suppLoading || confirmTxt.trim().toUpperCase() !== 'SUPPRIMER') ? 0.5 : 1,
              }}>{suppLoading ? 'Suppression…' : 'Supprimer définitivement'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
