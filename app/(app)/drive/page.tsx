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

type GFile = { id: string; name: string; mimeType: string; webViewLink?: string }
const DOSSIER_MIME = 'application/vnd.google-apps.folder'

export default function DrivePage() {
  const [liens, setLiens] = useState<Lien[]>([])
  const [loading, setLoading] = useState(true)
  const [titre, setTitre] = useState('')
  const [url, setUrl] = useState('')
  const [matiere, setMatiere] = useState('')
  const [erreur, setErreur] = useState('')
  const [saving, setSaving] = useState(false)

  // --- Google Drive (OAuth) ---
  const [gConfigure, setGConfigure] = useState(true)
  const [gConnecte, setGConnecte] = useState(false)
  const [gEmail, setGEmail] = useState<string | null>(null)
  const [gFiles, setGFiles] = useState<GFile[]>([])
  const [gChemin, setGChemin] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'Mon Drive' }])
  const [gLoading, setGLoading] = useState(false)
  const [gErreur, setGErreur] = useState('')

  const charger = async () => {
    const { data } = await supabase.from('drive_liens').select('*').order('created_at', { ascending: false })
    setLiens((data || []) as Lien[])
    setLoading(false)
  }

  const listerGoogle = async (folderId: string) => {
    setGLoading(true); setGErreur('')
    const res = await fetch(`/api/drive/google/list?folderId=${encodeURIComponent(folderId)}`)
    if (res.status === 409) { setGConnecte(false); setGLoading(false); return }
    const json = await res.json().catch(() => ({}))
    setGLoading(false)
    if (!res.ok) { setGErreur(json.error || 'Erreur de chargement.'); return }
    setGFiles(json.files || [])
  }

  const chargerStatutGoogle = async () => {
    const res = await fetch('/api/drive/google/status')
    if (!res.ok) return
    const j = await res.json()
    setGConfigure(j.configure)
    setGConnecte(j.connected)
    setGEmail(j.email)
    if (j.connected) { setGChemin([{ id: 'root', name: 'Mon Drive' }]); listerGoogle('root') }
  }

  const ouvrirDossier = (f: GFile) => {
    setGChemin(c => [...c, { id: f.id, name: f.name }])
    listerGoogle(f.id)
  }
  const allerVers = (index: number) => {
    const cible = gChemin[index]
    setGChemin(c => c.slice(0, index + 1))
    listerGoogle(cible.id)
  }
  const deconnecterGoogle = async () => {
    await fetch('/api/drive/google/disconnect', { method: 'POST' })
    setGConnecte(false); setGEmail(null); setGFiles([])
  }

  useEffect(() => {
    charger()
    chargerStatutGoogle()
    // Nettoie le ?google=ok/err de l'URL après retour OAuth.
    if (typeof window !== 'undefined' && window.location.search.includes('google=')) {
      const g = new URLSearchParams(window.location.search).get('google')
      if (g === 'err') setGErreur("La connexion Google a échoué. Réessaie.")
      if (g === 'config') setGErreur("Google Drive n'est pas encore configuré côté serveur.")
      window.history.replaceState({}, '', '/drive')
    }
  }, [])

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

      {/* ───────── Google Drive (connexion + navigation) ───────── */}
      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 20, marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: gConnecte ? 16 : 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: '#E8F0FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📁</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Google Drive</div>
            <div style={{ fontSize: 12.5, color: '#8A7E68' }}>
              {gConnecte ? (gEmail || 'Compte connecté') : 'Parcours et ouvre tes fichiers sans quitter codex.'}
            </div>
          </div>
          {gConnecte && (
            <button onClick={deconnecterGoogle} style={{ border: '1.5px solid #EADFC9', background: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#8A7E68', cursor: 'pointer', fontFamily: "'Hanken Grotesk', sans-serif" }}>Déconnecter</button>
          )}
        </div>

        {!gConnecte ? (
          <div>
            {!gConfigure && (
              <div style={{ fontSize: 13, color: '#B0791E', background: '#FCF3DF', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
                La connexion Google n&apos;est pas encore activée (identifiants serveur manquants).
              </div>
            )}
            <a href="/api/drive/google/connect" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, height: 46, padding: '0 20px',
              border: '1.5px solid #DADCE0', borderRadius: 12, background: '#fff', color: '#3C4043',
              fontSize: 14.5, fontWeight: 700, textDecoration: 'none',
              pointerEvents: gConfigure ? 'auto' : 'none', opacity: gConfigure ? 1 : 0.5,
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 2.97 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
              Se connecter avec Google
            </a>
          </div>
        ) : (
          <div>
            {/* Fil d'Ariane */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, fontSize: 13.5, marginBottom: 12 }}>
              {gChemin.map((c, i) => (
                <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <span style={{ color: '#C0B7A4' }}>/</span>}
                  <button onClick={() => allerVers(i)} disabled={i === gChemin.length - 1} style={{
                    border: 'none', background: 'transparent', padding: '2px 4px', cursor: i === gChemin.length - 1 ? 'default' : 'pointer',
                    fontSize: 13.5, fontWeight: i === gChemin.length - 1 ? 700 : 600,
                    color: i === gChemin.length - 1 ? '#2A2018' : '#1A56C4', fontFamily: "'Hanken Grotesk', sans-serif",
                  }}>{c.name}</button>
                </span>
              ))}
            </div>

            {gErreur && <div style={{ fontSize: 13, color: '#D94A30', marginBottom: 10 }}>{gErreur}</div>}

            {gLoading ? (
              <div style={{ color: '#9A8D72', padding: 16, fontSize: 14 }}>Chargement…</div>
            ) : gFiles.length === 0 ? (
              <div style={{ color: '#9A8D72', padding: 16, fontSize: 14 }}>Ce dossier est vide.</div>
            ) : (
              <div style={{ border: '1px solid #F0E7D6', borderRadius: 12, overflow: 'hidden' }}>
                {gFiles.map((f, i) => {
                  const dossier = f.mimeType === DOSSIER_MIME
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i > 0 ? '1px solid #F5EEE0' : 'none' }}>
                      <span style={{ fontSize: 18 }}>{dossier ? '📁' : '📄'}</span>
                      {dossier ? (
                        <button onClick={() => ouvrirDossier(f)} style={{
                          flex: 1, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer',
                          fontSize: 14, fontWeight: 600, color: '#2A2018', fontFamily: "'Hanken Grotesk', sans-serif",
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{f.name}</button>
                      ) : (
                        <span style={{ flex: 1, fontSize: 14, color: '#2A2018', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      )}
                      {dossier ? (
                        <span style={{ fontSize: 12, color: '#C0B7A4' }}>›</span>
                      ) : f.webViewLink ? (
                        <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 700, color: '#1A56C4', textDecoration: 'none', flexShrink: 0 }}>Ouvrir ↗</a>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ───────── Hub de liens (tous fournisseurs) ───────── */}
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Bricolage Grotesque', sans-serif", margin: '0 0 14px' }}>Mes liens</div>

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
