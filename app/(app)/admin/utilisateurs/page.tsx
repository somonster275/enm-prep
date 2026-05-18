'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profil } from '@/types'

export default function AdminUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState<Profil[]>([])
  const [email, setEmail] = useState('')
  const [nom, setNom] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [role, setRole] = useState<'editeur' | 'lecteur'>('lecteur')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.from('profils').select('*').then(({ data }) => setUtilisateurs(data || []))
  }, [])

  const creerUtilisateur = async () => {
    if (!email || !motDePasse) return
    setLoading(true)
    const res = await fetch('/api/admin/creer-utilisateur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nom, motDePasse, role })
    })
    if (!res.ok) { setMessage('Erreur lors de la création'); setLoading(false); return }
    setMessage('Utilisateur créé avec succès')
    setEmail(''); setNom(''); setMotDePasse(''); setLoading(false)
    supabase.from('profils').select('*').then(({ data }) => setUtilisateurs(data || []))
    setTimeout(() => setMessage(''), 3000)
  }

  const changerRole = async (id: string, newRole: string) => {
    await supabase.from('profils').update({ role: newRole }).eq('id', id)
    setUtilisateurs(u => u.map(p => p.id === id ? { ...p, role: newRole as any } : p))
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 1.5rem' }}>Gestion des utilisateurs</h1>
      <div style={{ background: '#fff', border: '0.5px solid #E5E5E5', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 1rem' }}>Créer un compte</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Nom</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom de l'utilisateur"
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com"
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Mot de passe temporaire</label>
            <input type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} placeholder="Mot de passe"
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4, color: '#555' }}>Rôle</label>
            <select value={role} onChange={e => setRole(e.target.value as any)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13, boxSizing: 'border-box' }}>
              <option value="lecteur">Lecteur</option>
              <option value="editeur">Éditeur</option>
            </select>
          </div>
        </div>
        {message && <div style={{ fontSize: 13, color: '#0F6E56', marginBottom: 10 }}>{message}</div>}
        <button onClick={creerUtilisateur} disabled={loading}
          style={{ padding: '10px 20px', borderRadius: 8, background: '#534AB7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Création...' : 'Créer le compte'}
        </button>
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #E5E5E5', borderRadius: 12, padding: '1.25rem' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 1rem' }}>Utilisateurs ({utilisateurs.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {utilisateurs.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F9F9F9', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{u.nom || u.email}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{u.email}</div>
              </div>
              <select value={u.role} onChange={e => changerRole(u.id, e.target.value)}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E0E0E0', fontSize: 12, cursor: 'pointer', background: '#fff' }}>
                <option value="admin">Admin</option>
                <option value="editeur">Éditeur</option>
                <option value="lecteur">Lecteur</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}