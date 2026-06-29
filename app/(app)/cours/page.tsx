'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Cours = {
  id: string; titre: string; description: string | null; matiere: string | null
  espace_id: string | null; module_id: string | null
  fichier_url: string; fichier_nom: string | null; type: string | null; created_at: string
}
type EspaceItem = { id: string; nom: string }
type ModuleItem = { id: string; nom: string }

const FONT = "'Hanken Grotesk', sans-serif"
const DISPLAY = "'Bricolage Grotesque', sans-serif"

const estPdf = (c: Cours) => (c.type === 'pdf') || /\.pdf($|\?)/i.test(c.fichier_url) || /\.pdf$/i.test(c.fichier_nom || '')

// Visionneuse : PDF en iframe direct ; Word via la visionneuse Office en ligne.
function urlVisionneuse(c: Cours): string {
  if (estPdf(c)) return c.fichier_url
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(c.fichier_url)}`
}

function CoursContenu() {
  const [uid, setUid] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [espaces, setEspaces] = useState<EspaceItem[]>([])
  const [matieres, setMatieres] = useState<string[]>([])
  const [liste, setListe] = useState<Cours[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('')

  const params = useSearchParams()

  // Cours ouvert (visionneuse)
  const [actif, setActif] = useState<Cours | null>(null)
  const [remarque, setRemarque] = useState('')
  const [envoiRemarque, setEnvoiRemarque] = useState(false)
  const [remarqueOk, setRemarqueOk] = useState(false)

  // Formulaire admin
  const [formOuvert, setFormOuvert] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [espaceId, setEspaceId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [fichier, setFichier] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const [{ data: prof }, { data: esp }, { data: cs }] = await Promise.all([
      supabase.from('profils').select('role').eq('id', user.id).single(),
      supabase.from('espaces').select('id, nom').order('ordre'),
      supabase.from('cours').select('*').order('created_at', { ascending: false }),
    ])
    setIsAdmin(prof?.role === 'admin')
    setEspaces((esp || []) as EspaceItem[])
    setMatieres((esp || []).map((e: { nom: string }) => e.nom))
    setListe((cs || []) as Cours[])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  // Ouvre automatiquement un cours si ?c=<id> est présent (lien depuis un espace/module).
  useEffect(() => {
    const id = params.get('c')
    if (!id || actif || liste.length === 0) return
    const c = liste.find(x => x.id === id)
    if (c) { setActif(c); setRemarque(''); setRemarqueOk(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, liste])

  // Modules de l'espace choisi (pour ranger le cours dans un chapitre précis).
  useEffect(() => {
    setModuleId('')
    if (!espaceId) { setModules([]); return }
    supabase.from('modules')
      .select('id, nom').eq('espace_id', espaceId).is('parent_id', null).is('deleted_at', null).order('ordre')
      .then(({ data }) => setModules((data || []) as ModuleItem[]))
  }, [espaceId])

  const televerser = async () => {
    setErreur('')
    if (!titre.trim()) { setErreur('Donne un titre.'); return }
    if (!fichier) { setErreur('Choisis un fichier PDF ou Word.'); return }
    setSaving(true)
    try {
      // 1) Upload du fichier dans le bucket « cours » (route staff, service role).
      const form = new FormData()
      form.append('fichier', fichier)
      form.append('bucket', 'cours')
      const up = await fetch('/api/storage/upload', { method: 'POST', body: form })
      const uj = await up.json().catch(() => ({}))
      if (!up.ok || !uj.url) { setErreur(uj.error || 'Échec de l\'envoi du fichier.'); setSaving(false); return }

      // 2) Enregistrement du cours.
      const nom = fichier.name
      const type = /\.pdf$/i.test(nom) ? 'pdf' : 'doc'
      const nomMatiere = espaces.find(e => e.id === espaceId)?.nom || null
      const { error } = await supabase.from('cours').insert({
        titre: titre.trim().slice(0, 160), description: description.trim() || null,
        matiere: nomMatiere, espace_id: espaceId || null, module_id: moduleId || null,
        fichier_url: uj.url, fichier_nom: nom, type, created_by: uid,
      })
      if (error) { setErreur(error.message); setSaving(false); return }
      setTitre(''); setDescription(''); setEspaceId(''); setModuleId(''); setFichier(null); setFormOuvert(false)
      if (fileRef.current) fileRef.current.value = ''
      charger()
    } catch {
      setErreur('Erreur lors de l\'envoi.')
    } finally {
      setSaving(false)
    }
  }

  const supprimer = async (id: string) => {
    if (!confirm('Supprimer ce cours ?')) return
    setListe(l => l.filter(c => c.id !== id))
    if (actif?.id === id) setActif(null)
    await supabase.from('cours').delete().eq('id', id)
  }

  const ouvrir = (c: Cours) => { setActif(c); setRemarque(''); setRemarqueOk(false); window.scrollTo({ top: 0 }) }

  const envoyerRemarque = async () => {
    if (!actif || !remarque.trim()) return
    setEnvoiRemarque(true)
    try {
      const res = await fetch('/api/cours/remarque', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coursId: actif.id, message: remarque }),
      })
      if (res.ok) { setRemarque(''); setRemarqueOk(true) }
    } finally {
      setEnvoiRemarque(false)
    }
  }

  const champ: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #EADFC9', borderRadius: 12, padding: '11px 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', fontFamily: FONT }
  const visibles = filtre ? liste.filter(c => c.matiere === filtre) : liste

  // ---------- Visionneuse d'un cours ----------
  if (actif) return (
    <div style={{ paddingTop: 28, maxWidth: 900, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      <button onClick={() => setActif(null)} style={{ background: 'none', border: 'none', color: '#9A8D72', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← Tous les cours</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, margin: 0 }}>{actif.titre}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {actif.matiere && <span style={{ fontSize: 12, fontWeight: 600, color: '#8A5A10', background: '#FCEFD3', padding: '2px 9px', borderRadius: 999 }}>{actif.matiere}</span>}
            <span style={{ fontSize: 12, color: '#9A8D72' }}>{estPdf(actif) ? 'PDF' : 'Document Word'}</span>
          </div>
          {actif.description && <p style={{ fontSize: 14, color: '#6E6456', margin: '10px 0 0', maxWidth: 640, lineHeight: 1.5 }}>{actif.description}</p>}
        </div>
        <a href={actif.fichier_url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, height: 40, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', border: '1.5px solid #EADFC9', borderRadius: 11, background: '#FFFBF2', color: '#2A2018', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>
          Télécharger ↗
        </a>
      </div>

      {/* Document */}
      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
        <iframe
          src={urlVisionneuse(actif)}
          title={actif.titre}
          style={{ width: '100%', height: '72vh', border: 'none', display: 'block' }}
        />
      </div>

      {/* Remarque (comme pour les fiches) */}
      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>💬 Une remarque sur ce cours ?</div>
        <div style={{ fontSize: 13, color: '#8A7E68', marginBottom: 10 }}>Erreur, passage peu clair, question… ton retour est envoyé à l&apos;équipe.</div>
        {remarqueOk ? (
          <div style={{ background: '#ECF7F0', border: '1px solid #BFE6CF', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, color: '#0E5A47' }}>
            ✅ Merci, ta remarque a bien été envoyée.
            <button onClick={() => setRemarqueOk(false)} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#0F6E56', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>En ajouter une autre</button>
          </div>
        ) : (
          <>
            <textarea value={remarque} onChange={e => setRemarque(e.target.value)} rows={3} placeholder="Ta remarque…" style={{ ...champ, resize: 'vertical', lineHeight: 1.5 }} />
            <button onClick={envoyerRemarque} disabled={!remarque.trim() || envoiRemarque} style={{ marginTop: 10, height: 42, padding: '0 22px', border: 'none', borderRadius: 11, background: '#DC4A2B', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (!remarque.trim() || envoiRemarque) ? 0.6 : 1, fontFamily: FONT }}>
              {envoiRemarque ? 'Envoi…' : 'Envoyer ma remarque'}
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ---------- Liste des cours ----------
  return (
    <div style={{ paddingTop: 34, maxWidth: 820, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, margin: 0 }}>Cours</h1>
        {isAdmin && !formOuvert && <button onClick={() => setFormOuvert(true)} style={{ padding: '10px 18px', borderRadius: 11, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: FONT }}>+ Ajouter un cours</button>}
      </div>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 22px' }}>Les supports de cours (PDF, Word) mis à disposition. Consulte-les en ligne et laisse une remarque si besoin.</p>

      {/* Formulaire admin */}
      {isAdmin && formOuvert && (
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18, marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre du cours" style={champ} />
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Description (facultatif)" style={{ ...champ, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select value={espaceId} onChange={e => setEspaceId(e.target.value)} style={{ ...champ, flex: '1 1 180px' }}>
              <option value="">Matière (facultatif)</option>
              {espaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
            {espaceId && modules.length > 0 && (
              <select value={moduleId} onChange={e => setModuleId(e.target.value)} style={{ ...champ, flex: '1 1 180px' }}>
                <option value="">Tout le module (chapitre facultatif)</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderRadius: 12, border: `1.5px dashed ${fichier ? '#DC4A2B' : '#EADFC9'}`, background: fichier ? '#FFF4F2' : '#FFFBF2', color: fichier ? '#DC4A2B' : '#8A7E68', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            {fichier ? `📎 ${fichier.name}` : 'Choisir un fichier (PDF ou Word)…'}
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: 'none' }}
              onChange={e => setFichier(e.target.files?.[0] || null)} />
          </label>
          {erreur && <div style={{ fontSize: 13, color: '#D94A30' }}>{erreur}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={televerser} disabled={saving} style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 11, background: '#DC4A2B', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: FONT }}>{saving ? 'Envoi…' : 'Publier le cours'}</button>
            <button onClick={() => { setFormOuvert(false); setErreur('') }} style={{ height: 44, padding: '0 16px', border: '1.5px solid #EADFC9', borderRadius: 11, background: '#fff', color: '#6E6456', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Filtres matière */}
      {matieres.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFiltre('')} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: FONT, background: filtre === '' ? '#DC4A2B' : '#fff', color: filtre === '' ? '#fff' : '#8A7E68', border: `1px solid ${filtre === '' ? '#DC4A2B' : '#F0E7D6'}` }}>Toutes</button>
          {matieres.map(m => (
            <button key={m} onClick={() => setFiltre(m)} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: FONT, background: filtre === m ? '#DC4A2B' : '#fff', color: filtre === m ? '#fff' : '#8A7E68', border: `1px solid ${filtre === m ? '#DC4A2B' : '#F0E7D6'}` }}>{m}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📘</div>Aucun cours pour l&apos;instant.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {visibles.map(c => (
            <div key={c.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: estPdf(c) ? '#FCEEEA' : '#E8F0FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{estPdf(c) ? '📕' : '📘'}</span>
                {c.matiere && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#8A5A10', background: '#FCEFD3', padding: '2px 9px', borderRadius: 999 }}>{c.matiere}</span>}
                {isAdmin && <button onClick={() => supprimer(c.id)} title="Supprimer" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#C0B7A4', cursor: 'pointer', fontSize: 14 }}>✕</button>}
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>{c.titre}</div>
              {c.description && <div style={{ fontSize: 12.5, color: '#9A8D72', marginTop: 3, lineHeight: 1.45 }}>{c.description}</div>}
              <button onClick={() => ouvrir(c)} style={{ marginTop: 14, height: 40, border: 'none', borderRadius: 11, background: '#FCEFD3', color: '#8A5A10', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                Consulter →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CoursPage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: 40, textAlign: 'center', color: '#9A8D72', fontFamily: FONT }}>Chargement…</div>}>
      <CoursContenu />
    </Suspense>
  )
}
