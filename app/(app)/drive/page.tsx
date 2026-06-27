'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Lien = {
  id: string
  titre: string
  url: string
  fournisseur: string | null
  matiere: string | null
  created_at: string
}

// Fournisseurs reconnus : libellé, emoji, teinte de fond du badge.
const FOURNISSEURS: Record<string, { label: string; icone: string; bg: string; fg: string }> = {
  google:   { label: 'Google Drive', icone: '📁', bg: '#E8F0FE', fg: '#1A56C4' },
  icloud:   { label: 'iCloud Drive', icone: '☁️', bg: '#EAF4FF', fg: '#0A84C2' },
  dropbox:  { label: 'Dropbox',      icone: '📦', bg: '#E8F1FE', fg: '#0061FF' },
  onedrive: { label: 'OneDrive',     icone: '🗂️', bg: '#E9F1FB', fg: '#0A4FB4' },
  notion:   { label: 'Notion',       icone: '📝', bg: '#F1F0EE', fg: '#37352F' },
  autre:    { label: 'Lien',         icone: '🔗', bg: '#F1ECE1', fg: '#6E6456' },
}

// Devine le fournisseur à partir de l'URL.
function detecter(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('drive.google') || u.includes('docs.google')) return 'google'
  if (u.includes('icloud.com')) return 'icloud'
  if (u.includes('dropbox.com')) return 'dropbox'
  if (u.includes('onedrive') || u.includes('1drv.ms') || u.includes('sharepoint')) return 'onedrive'
  if (u.includes('notion.so') || u.includes('notion.site')) return 'notion'
  return 'autre'
}

export default function DrivePage() {
  const [liens, setLiens] = useState<Lien[]>([])
  const [loading, setLoading] = useState(true)
  const [titre, setTitre] = useState('')
  const [url, setUrl] = useState('')
  const [matiere, setMatiere] = useState('')
  const [erreur, setErreur] = useState('')
  const [saving, setSaving] = useState(false)

  const charger = async () => {
    const { data } = await supabase.from('drive_liens').select('*').order('created_at', { ascending: false })
    setLiens((data || []) as Lien[])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const ajouter = async () => {
    setErreur('')
    const lien = url.trim()
    if (!titre.trim()) { setErreur('Donne un nom à ce lien.'); return }
    if (!/^https?:\/\/.+/i.test(lien)) { setErreur('Colle une adresse valide (commençant par https://).'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setErreur('Session expirée, reconnecte-toi.'); return }
    const { error } = await supabase.from('drive_liens').insert({
      user_id: user.id,
      titre: titre.trim().slice(0, 120),
      url: lien,
      fournisseur: detecter(lien),
      matiere: matiere.trim().slice(0, 60) || null,
    })
    setSaving(false)
    if (error) { setErreur(error.message); return }
    setTitre(''); setUrl(''); setMatiere('')
    charger()
  }

  const supprimer = async (id: string) => {
    setLiens(ls => ls.filter(l => l.id !== id))
    await supabase.from('drive_liens').delete().eq('id', id)
  }

  const champ: React.CSSProperties = {
    height: 46, border: '1.5px solid #EADFC9', borderRadius: 12, padding: '0 14px',
    background: '#FFFBF2', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Hanken Grotesk', sans-serif", width: '100%',
  }

  // Aperçu en direct du fournisseur détecté pendant la saisie.
  const apercu = url.trim() ? FOURNISSEURS[detecter(url)] : null

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: "'Hanken Grotesk', sans-serif", color: '#2A2018' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>Mon Drive</h1>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 24px', maxWidth: 560 }}>
        Centralise l&apos;accès à tes cours : ajoute les liens partagés de tes dossiers
        (Google Drive, iCloud, Dropbox, OneDrive, Notion…) et ouvre-les en un clic depuis l&apos;app.
      </p>

      {/* Formulaire d'ajout */}
      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 20, marginBottom: 26 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Ajouter un lien</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Nom (ex. « Cours de droit civil »)" style={champ} />
          <div style={{ position: 'relative' }}>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Lien partagé (https://…)"
              onKeyDown={e => { if (e.key === 'Enter') ajouter() }} style={{ ...champ, paddingRight: apercu ? 132 : 14 }} />
            {apercu && (
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: apercu.fg, background: apercu.bg, padding: '5px 10px', borderRadius: 999 }}>
                {apercu.icone} {apercu.label}
              </span>
            )}
          </div>
          <input value={matiere} onChange={e => setMatiere(e.target.value)} placeholder="Matière (facultatif, ex. « Droit pénal »)"
            onKeyDown={e => { if (e.key === 'Enter') ajouter() }} style={champ} />
        </div>
        {erreur && <div style={{ marginTop: 12, fontSize: 13.5, color: '#D94A30' }}>{erreur}</div>}
        <button onClick={ajouter} disabled={saving} style={{
          marginTop: 16, height: 46, padding: '0 22px', border: 'none', borderRadius: 12,
          background: '#DC4A2B', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer',
          opacity: saving ? 0.7 : 1, fontFamily: "'Hanken Grotesk', sans-serif",
        }}>
          {saving ? 'Ajout…' : 'Ajouter le lien'}
        </button>
      </div>

      {/* Liste des liens */}
      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : liens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🗂️</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#6E6456' }}>Aucun lien pour l&apos;instant.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Ajoute le lien partagé de ton dossier de cours ci-dessus.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {liens.map(l => {
            const f = FOURNISSEURS[l.fournisseur || 'autre'] || FOURNISSEURS.autre
            return (
              <div key={l.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{f.icone}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.titre}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: f.fg, marginTop: 2 }}>{f.label}</div>
                  </div>
                  <button onClick={() => supprimer(l.id)} title="Supprimer" style={{ border: 'none', background: 'transparent', color: '#C0B7A4', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
                </div>
                {l.matiere && (
                  <span style={{ alignSelf: 'flex-start', marginTop: 12, fontSize: 12, fontWeight: 600, color: '#8A7E68', background: '#FCEFD3', padding: '4px 10px', borderRadius: 999 }}>{l.matiere}</span>
                )}
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{
                  marginTop: 14, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  border: '1.5px solid #EADFC9', borderRadius: 11, background: '#FFFBF2',
                  color: '#2A2018', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                }}>
                  Ouvrir
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
