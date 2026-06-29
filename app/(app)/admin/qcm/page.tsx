'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseQcm, type QQuestion } from '@/lib/qcm-parse'

const EXEMPLE = `Q: Quel est le délai de prescription de droit commun en matière civile ?
- 2 ans
- 5 ans *
- 10 ans
- 30 ans
> Article 2224 du Code civil.

Q: Le dol suppose…
- une erreur spontanée
- des manœuvres frauduleuses *
- un déséquilibre économique`

type Qcm = { id: string; titre: string; matiere: string | null; nb: number }

export default function AdminQcmPage() {
  const [titre, setTitre] = useState('')
  const [matiere, setMatiere] = useState('')
  const [matieres, setMatieres] = useState<string[]>([])
  const [brut, setBrut] = useState('')
  const [questions, setQuestions] = useState<QQuestion[]>([])
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [liste, setListe] = useState<Qcm[]>([])
  const [lien, setLien] = useState('')
  const [chargementLien, setChargementLien] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const chargerListe = async () => {
    const res = await fetch('/api/admin/qcm'); const j = await res.json().catch(() => ({ qcms: [] })); setListe(j.qcms || [])
  }
  useEffect(() => {
    supabase.from('espaces').select('nom').order('ordre').then(({ data }) => setMatieres((data || []).map((e: { nom: string }) => e.nom)))
    chargerListe()
  }, [])

  const analyser = () => {
    setMsg(null)
    const q = parseQcm(brut)
    if (q.length === 0) { setMsg({ type: 'err', texte: 'Aucune question détectée. Vérifie le format (voir l\'exemple).' }); return }
    // Si aucune bonne réponse détectée (ex. import HTML), on laisse l'admin cocher.
    setQuestions(q)
  }

  // Importe depuis un lien : récupère le HTML côté serveur, le place dans la zone
  // de texte, puis l'analyse directement.
  const importerLien = async () => {
    setMsg(null)
    const url = lien.trim()
    if (!url) { setMsg({ type: 'err', texte: 'Colle d\'abord un lien.' }); return }
    setChargementLien(true)
    try {
      const res = await fetch('/api/admin/qcm/fetch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ type: 'err', texte: j.error || 'Échec du chargement du lien.' }); return }
      setBrut(j.html)
      const q = parseQcm(j.html)
      if (q.length === 0) {
        setMsg({ type: 'err', texte: 'Lien chargé, mais aucune question détectée automatiquement. Vérifie le HTML ci-dessous ou ajuste manuellement.' })
        return
      }
      setQuestions(q)
      setMsg({ type: 'ok', texte: `${q.length} question${q.length > 1 ? 's' : ''} détectée${q.length > 1 ? 's' : ''} depuis le lien — vérifie les bonnes réponses.` })
    } catch {
      setMsg({ type: 'err', texte: 'Erreur réseau lors du chargement du lien.' })
    } finally {
      setChargementLien(false)
    }
  }

  // Importe un fichier HTML (ou texte) depuis l'ordinateur : on lit son contenu,
  // on le place dans la zone de texte, puis on l'analyse.
  const importerFichier = async (file: File | null) => {
    if (!file) return
    setMsg(null)
    try {
      const contenu = await file.text()
      setBrut(contenu)
      const q = parseQcm(contenu)
      if (q.length === 0) {
        setMsg({ type: 'err', texte: `« ${file.name} » chargé, mais aucune question détectée automatiquement. Vérifie le contenu ci-dessous ou ajuste manuellement.` })
        return
      }
      setQuestions(q)
      setMsg({ type: 'ok', texte: `${q.length} question${q.length > 1 ? 's' : ''} détectée${q.length > 1 ? 's' : ''} depuis « ${file.name} » — vérifie les bonnes réponses.` })
    } catch {
      setMsg({ type: 'err', texte: 'Impossible de lire ce fichier.' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const majOption = (qi: number, oi: number, patch: Partial<{ t: string; c: boolean }>) =>
    setQuestions(qs => qs.map((q, i) => i !== qi ? q : { ...q, options: q.options.map((o, j) => j !== oi ? o : { ...o, ...patch }) }))
  const majEnonce = (qi: number, v: string) => setQuestions(qs => qs.map((q, i) => i === qi ? { ...q, enonce: v } : q))
  const supprQuestion = (qi: number) => setQuestions(qs => qs.filter((_, i) => i !== qi))
  const ajoutOption = (qi: number) => setQuestions(qs => qs.map((q, i) => i === qi ? { ...q, options: [...q.options, { t: '', c: false }] } : q))
  const supprOption = (qi: number, oi: number) => setQuestions(qs => qs.map((q, i) => i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q))

  const enregistrer = async () => {
    setMsg(null)
    if (!titre.trim()) { setMsg({ type: 'err', texte: 'Donne un titre au QCM.' }); return }
    if (!questions.length) { setMsg({ type: 'err', texte: 'Analyse d\'abord ton texte.' }); return }
    if (questions.some(q => !q.options.some(o => o.c))) { setMsg({ type: 'err', texte: 'Chaque question doit avoir au moins une bonne réponse cochée.' }); return }
    setSaving(true)
    const res = await fetch('/api/admin/qcm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titre, matiere, questions }) })
    setSaving(false)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ type: 'err', texte: j.error || 'Erreur' }); return }
    setMsg({ type: 'ok', texte: `QCM enregistré (${j.nb} questions) ✅` })
    setTitre(''); setMatiere(''); setBrut(''); setQuestions([]); chargerListe()
  }

  const supprimer = async (id: string) => {
    if (!confirm('Supprimer ce QCM ?')) return
    setListe(l => l.filter(q => q.id !== id))
    await fetch('/api/admin/qcm', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  const font = "'Hanken Grotesk', sans-serif"
  const champ: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #EADFC9', borderRadius: 12, padding: '11px 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', fontFamily: font }

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26, margin: 0 }}>Créer un QCM</h1>
      <p style={{ fontSize: 14.5, color: '#8A7E68', margin: '8px 0 18px' }}>
        Importe ton QCM depuis un <b>lien</b>, ou colle-le en <b>texte</b> ou en <b>HTML</b>, puis vérifie les bonnes réponses avant d&apos;enregistrer.
      </p>

      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre du QCM" style={{ ...champ, flex: '2 1 220px' }} />
          <select value={matiere} onChange={e => setMatiere(e.target.value)} style={{ ...champ, flex: '1 1 160px' }}>
            <option value="">Matière (facultatif)</option>
            {matieres.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {/* Import depuis un lien (URL d'une page HTML de QCM) */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={lien} onChange={e => setLien(e.target.value)} placeholder="https://… (lien d'une page de QCM)"
            onKeyDown={e => { if (e.key === 'Enter') importerLien() }}
            style={{ ...champ, flex: '3 1 240px' }} />
          <button onClick={importerLien} disabled={chargementLien} style={{
            height: 44, padding: '0 20px', border: '1px solid #EADFC9', borderRadius: 11, background: '#FDF6EA',
            color: '#5C4A22', fontSize: 14, fontWeight: 700, cursor: chargementLien ? 'wait' : 'pointer',
            fontFamily: font, opacity: chargementLien ? 0.7 : 1, whiteSpace: 'nowrap',
          }}>{chargementLien ? 'Chargement…' : '↓ Importer le lien'}</button>
          <button onClick={() => fileRef.current?.click()} style={{
            height: 44, padding: '0 20px', border: '1px solid #EADFC9', borderRadius: 11, background: '#FDF6EA',
            color: '#5C4A22', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font, whiteSpace: 'nowrap',
          }}>📄 Importer un fichier HTML</button>
          <input ref={fileRef} type="file" accept=".html,.htm,.txt,text/html,text/plain" style={{ display: 'none' }}
            onChange={e => importerFichier(e.target.files?.[0] || null)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#C7BBA2', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#F0E7D6' }} />
          ou colle directement ci-dessous
          <div style={{ flex: 1, height: 1, background: '#F0E7D6' }} />
        </div>
        <textarea value={brut} onChange={e => setBrut(e.target.value)} rows={8} placeholder={EXEMPLE}
          style={{ ...champ, resize: 'vertical', lineHeight: 1.5, fontFamily: 'monospace', fontSize: 13 }} />
        <div style={{ fontSize: 12, color: '#9A8D72' }}>
          Format texte : <code>Q:</code> pour une question, <code>-</code> pour une option, <code>*</code> en fin de ligne pour la bonne réponse, <code>&gt;</code> pour une explication. Le HTML (listes, boutons radio) est aussi accepté.
        </div>
        <div>
          <button onClick={analyser} style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 11, background: '#2A2018', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>Analyser</button>
        </div>
      </div>

      {/* Prévisualisation éditable */}
      {questions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Prévisualisation ({questions.length} questions) — coche les bonnes réponses</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {questions.map((q, qi) => (
              <div key={qi} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <textarea value={q.enonce} onChange={e => majEnonce(qi, e.target.value)} rows={2} style={{ ...champ, flex: 1, resize: 'vertical', fontWeight: 600 }} />
                  <button onClick={() => supprQuestion(qi)} title="Supprimer" style={{ border: 'none', background: 'transparent', color: '#C0B7A4', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {q.options.map((o, oi) => (
                    <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={o.c} onChange={e => majOption(qi, oi, { c: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#2DAE83', flexShrink: 0 }} />
                      <input value={o.t} onChange={e => majOption(qi, oi, { t: e.target.value })} style={{ ...champ, flex: 1, padding: '8px 12px', background: o.c ? '#ECF7F0' : '#FFFBF2' }} />
                      <button onClick={() => supprOption(qi, oi)} title="Retirer" style={{ border: 'none', background: 'transparent', color: '#C0B7A4', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => ajoutOption(qi)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#DC4A2B', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: font }}>+ option</button>
                </div>
                <input value={q.explication || ''} onChange={e => setQuestions(qs => qs.map((x, i) => i === qi ? { ...x, explication: e.target.value } : x))} placeholder="Explication (facultatif)" style={{ ...champ, marginTop: 8, fontSize: 13 }} />
              </div>
            ))}
          </div>
          {msg && <div style={{ fontSize: 13.5, color: msg.type === 'ok' ? '#0F6E56' : '#D94A30', marginTop: 12 }}>{msg.texte}</div>}
          <button onClick={enregistrer} disabled={saving} style={{ marginTop: 14, height: 48, padding: '0 26px', border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, fontFamily: font }}>{saving ? 'Enregistrement…' : 'Enregistrer le QCM'}</button>
        </div>
      )}
      {questions.length === 0 && msg && <div style={{ fontSize: 13.5, color: msg.type === 'ok' ? '#0F6E56' : '#D94A30', marginBottom: 16 }}>{msg.texte}</div>}

      {/* QCM existants */}
      <div style={{ fontWeight: 700, fontSize: 16, margin: '8px 0 10px' }}>QCM existants</div>
      {liste.length === 0 ? (
        <div style={{ fontSize: 13.5, color: '#9A8D72' }}>Aucun QCM pour l&apos;instant.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map(q => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{q.titre}</div>
                <div style={{ fontSize: 12, color: '#9A8D72' }}>{q.nb} question{q.nb > 1 ? 's' : ''}{q.matiere ? ` · ${q.matiere}` : ''}</div>
              </div>
              <button onClick={() => supprimer(q.id)} style={{ border: 'none', background: '#FCE9E3', color: '#D94A30', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
