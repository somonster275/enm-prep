'use client'
import { useEffect, useState } from 'react'
import { supabase, ecrire } from '@/lib/supabase'

type Annale = { id: string; user_id: string; auteur: string | null; titre: string; type: string | null; matiere: string | null; url: string; created_at: string }

const TYPES: Record<string, { label: string; bg: string; fg: string }> = {
  sujet:   { label: 'Sujet',   bg: '#E8F0FE', fg: '#1A56C4' },
  corrige: { label: 'Corrigé', bg: '#ECF7F0', fg: '#0F6E56' },
  fiche:   { label: 'Fiche',   bg: '#FCEFD3', fg: '#8A5A10' },
  autre:   { label: 'Autre',   bg: '#F1ECE1', fg: 'var(--c-texte-doux)' },
}

export default function AnnalesPage() {
  const [uid, setUid] = useState('')
  const [auteur, setAuteur] = useState('Étudiant')
  const [isAdmin, setIsAdmin] = useState(false)
  const [matieres, setMatieres] = useState<string[]>([])
  const [liste, setListe] = useState<Annale[]>([])
  const [loading, setLoading] = useState(true)

  const [titre, setTitre] = useState('')
  const [type, setType] = useState('sujet')
  const [matiere, setMatiere] = useState('')
  const [url, setUrl] = useState('')
  const [erreur, setErreur] = useState('')
  const [saving, setSaving] = useState(false)
  const [formOuvert, setFormOuvert] = useState(false)
  const [filtre, setFiltre] = useState('')

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const [{ data: prof }, { data: esp }, { data: an }] = await Promise.all([
      supabase.from('profils').select('prenom, nom, role').eq('id', user.id).single(),
      supabase.from('espaces').select('nom').order('ordre'),
      supabase.from('annales').select('*').order('created_at', { ascending: false }),
    ])
    setAuteur([prof?.prenom, prof?.nom].filter(Boolean).join(' ') || 'Étudiant')
    setIsAdmin(prof?.role === 'admin')
    setMatieres((esp || []).map((e: { nom: string }) => e.nom))
    setListe((an || []) as Annale[])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const ajouter = async () => {
    setErreur('')
    if (!titre.trim()) { setErreur('Donne un titre.'); return }
    if (!/^https?:\/\/.+/i.test(url.trim())) { setErreur('Colle un lien valide (https://…).'); return }
    setSaving(true)
    const { error } = await supabase.from('annales').insert({
      user_id: uid, auteur, titre: titre.trim().slice(0, 160), type, matiere: matiere || null, url: url.trim(),
    })
    setSaving(false)
    if (error) { setErreur(error.message); return }
    setTitre(''); setUrl(''); setMatiere(''); setType('sujet'); setFormOuvert(false)
    charger()
  }

  const supprimer = async (id: string) => {
    if (!(await ecrire(supabase.from('annales').delete().eq('id', id).select('id')))) return
    setListe(l => l.filter(a => a.id !== id))
  }

  const font = "var(--font-texte)"
  const champ: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--c-filet-fort)', borderRadius: 12, padding: '11px 14px', background: 'var(--c-papier)', fontSize: 14, outline: 'none', fontFamily: font }
  const visibles = filtre ? liste.filter(a => a.matiere === filtre) : liste

  return (
    <div style={{ paddingTop: 34, maxWidth: 820, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 28, margin: 0 }}>Annales & corrigés partagés</h1>
        {!formOuvert && <button onClick={() => setFormOuvert(true)} style={{ padding: '10px 18px', borderRadius: 11, background: 'var(--c-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: font }}>Partager un document</button>}
      </div>
      <p style={{ fontSize: 15, color: 'var(--c-annotation)', margin: '8px 0 22px' }}>Une bibliothèque commune : sujets passés, corrigés, fiches… partagés entre candidats via leurs liens.</p>

      {formOuvert && (
        <div style={{ background: '#fff', border: '1px solid var(--c-filet)', borderRadius: 16, padding: 18, marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre (ex. « Annale 2024 — Droit civil »)" style={champ} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...champ, flex: '1 1 140px' }}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={matiere} onChange={e => setMatiere(e.target.value)} style={{ ...champ, flex: '1 1 180px' }}>
              <option value="">Matière (facultatif)</option>
              {matieres.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Lien partagé (Google Drive, PDF…)" style={champ} />
          {erreur && <div style={{ fontSize: 13, color: 'var(--c-accent)' }}>{erreur}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={ajouter} disabled={saving} style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 11, background: 'var(--c-accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: font }}>{saving ? 'Partage…' : 'Partager'}</button>
            <button onClick={() => setFormOuvert(false)} style={{ height: 44, padding: '0 16px', border: '1.5px solid var(--c-filet-fort)', borderRadius: 11, background: '#fff', color: 'var(--c-texte-doux)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Annuler</button>
          </div>
        </div>
      )}

      {matieres.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFiltre('')} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: font, background: filtre === '' ? 'var(--c-accent)' : '#fff', color: filtre === '' ? '#fff' : 'var(--c-annotation)', border: `1px solid ${filtre === '' ? 'var(--c-accent)' : 'var(--c-filet)'}` }}>Toutes</button>
          {matieres.map(m => (
            <button key={m} onClick={() => setFiltre(m)} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: font, background: filtre === m ? 'var(--c-accent)' : '#fff', color: filtre === m ? '#fff' : 'var(--c-annotation)', border: `1px solid ${filtre === m ? 'var(--c-accent)' : 'var(--c-filet)'}` }}>{m}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--c-annotation-clair)', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-annotation-clair)', background: 'var(--c-papier)', border: '1px dashed var(--c-filet-fort)', borderRadius: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📚</div>Aucun document partagé pour l&apos;instant.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {visibles.map(a => {
            const t = TYPES[a.type || 'autre'] || TYPES.autre
            return (
              <div key={a.id} style={{ background: '#fff', border: '1px solid var(--c-filet)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: t.fg, background: t.bg, padding: '2px 9px', borderRadius: 999 }}>{t.label}</span>
                  {a.matiere && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-annotation)', background: '#FCEFD3', padding: '2px 9px', borderRadius: 999 }}>{a.matiere}</span>}
                  {(isAdmin || a.user_id === uid) && <button onClick={() => supprimer(a.id)} title="Supprimer" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--c-discret-clair)', cursor: 'pointer', fontSize: 14 }}>✕</button>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{a.titre}</div>
                <div style={{ fontSize: 12, color: 'var(--c-annotation-clair)', marginTop: 3 }}>Partagé par {a.auteur || 'un étudiant'}</div>
                <a href={/^https?:\/\//i.test(a.url) ? a.url : undefined} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px solid var(--c-filet-fort)', borderRadius: 11, background: 'var(--c-papier)', color: 'var(--c-encre)', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>
                  Ouvrir ↗
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
