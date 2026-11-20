'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseTexte } from '@/lib/qcm-parse'

type Espace = { id: string; nom: string }
type ModuleItem = { id: string; nom: string }
type Contribution = { id: string; type: string; statut: string; titre: string | null; created_at: string }

const FONT = "var(--font-texte)"
const DISPLAY = "var(--font-titre)"

const STATUT_LABEL: Record<string, { t: string; bg: string; c: string }> = {
  nouveau: { t: 'En attente', bg: '#FCEFD3', c: '#8A5A10' },
  approuve: { t: 'Publié ✓', bg: '#ECF7F0', c: '#0E5A47' },
  refuse: { t: 'Refusé', bg: '#FCEEEA', c: '#A8453B' },
}

const EXEMPLE_QCM = `Q: Quelle juridiction juge les crimes ?
- Le tribunal correctionnel
- La cour d'assises *
- Le tribunal de police
> La cour d'assises juge les crimes ; le correctionnel les délits.

Q: Le délai d'appel en matière civile est de :
- 10 jours
- 1 mois *
- 2 mois`

export default function ContribuerPage() {
  const [uid, setUid] = useState('')
  const [type, setType] = useState<'fiche' | 'qcm'>('fiche')
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [mesContribs, setMesContribs] = useState<Contribution[]>([])

  // Fiche
  const [espaceId, setEspaceId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState('')

  // QCM
  const [titre, setTitre] = useState('')
  const [matiere, setMatiere] = useState('')
  const [texteQcm, setTexteQcm] = useState('')

  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; t: string } | null>(null)

  const chargerMes = async (userId: string) => {
    const { data } = await supabase.from('contributions')
      .select('id, type, statut, titre, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    setMesContribs((data || []) as Contribution[])
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUid(user.id)
      const { data: esp } = await supabase.from('espaces').select('id, nom').order('ordre')
      setEspaces((esp || []) as Espace[])
      chargerMes(user.id)
    }
    load()
  }, [])

  useEffect(() => {
    setModuleId('')
    if (!espaceId) { setModules([]); return }
    supabase.from('modules').select('id, nom').eq('espace_id', espaceId).is('deleted_at', null).order('ordre')
      .then(({ data }) => setModules((data || []) as ModuleItem[]))
  }, [espaceId])

  // Prévisualisation live du QCM (réutilise le parseur admin).
  const apercuQcm = useMemo(() => parseTexte(texteQcm), [texteQcm])

  const reset = () => {
    setQuestion(''); setReponse(''); setTitre(''); setMatiere(''); setTexteQcm('')
  }

  const envoyer = async () => {
    setMessage(null)
    let body: Record<string, unknown>
    if (type === 'fiche') {
      if (!moduleId) { setMessage({ ok: false, t: 'Choisis une matière et un chapitre.' }); return }
      if (!question.trim() || !reponse.trim()) { setMessage({ ok: false, t: 'Remplis la question et la réponse.' }); return }
      const nomEspace = espaces.find(e => e.id === espaceId)?.nom
      const nomModule = modules.find(m => m.id === moduleId)?.nom
      body = { type: 'fiche', espaceId, moduleId, question, reponse, titre: [nomEspace, nomModule].filter(Boolean).join(' › ') }
    } else {
      if (!titre.trim()) { setMessage({ ok: false, t: 'Donne un titre au QCM.' }); return }
      if (apercuQcm.length === 0) { setMessage({ ok: false, t: 'Aucune question valide détectée (vois le format ci-dessous).' }); return }
      body = { type: 'qcm', titre, matiere, questions: apercuQcm }
    }
    setEnvoi(true)
    try {
      const res = await fetch('/api/contributions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage({ ok: false, t: j.error || 'Envoi impossible.' }); setEnvoi(false); return }
      setMessage({ ok: true, t: 'Merci ! Ta proposition part en modération. Tu verras son statut ci-dessous.' })
      reset()
      if (uid) chargerMes(uid)
    } catch {
      setMessage({ ok: false, t: 'Erreur réseau, réessaie.' })
    } finally {
      setEnvoi(false)
    }
  }

  const champ: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--c-filet-fort)', borderRadius: 6, padding: '11px 14px', background: 'var(--c-papier)', fontSize: 14, outline: 'none', fontFamily: FONT }
  const label: React.CSSProperties = { fontSize: 13, color: 'var(--c-annotation)', fontWeight: 600, display: 'block', marginBottom: 5 }

  return (
    <div style={{ paddingTop: 34, maxWidth: 720, margin: '0 auto', fontFamily: FONT, color: 'var(--c-encre)' }}>
      <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, margin: 0 }}>Proposer un contenu</h1>
      <p style={{ fontSize: 15, color: 'var(--c-annotation)', margin: '8px 0 22px', maxWidth: 580 }}>
        Aide toute la promo : propose une fiche ou un QCM. Un administrateur le relit avant publication — une fois validé, il devient disponible pour tous.
      </p>

      {/* Onglets type */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['fiche', 'qcm'] as const).map(t => (
          <button key={t} onClick={() => { setType(t); setMessage(null) }} style={{
            padding: '9px 18px', borderRadius: 999, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, fontFamily: FONT,
            border: `1.5px solid ${type === t ? 'var(--c-accent)' : 'var(--c-filet-fort)'}`, background: type === t ? 'var(--c-accent)' : '#fff', color: type === t ? '#fff' : 'var(--c-annotation)',
          }}>{t === 'fiche' ? '📇 Une fiche' : '✅ Un QCM'}</button>
        ))}
      </div>

      <div style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: 22, marginBottom: 24 }}>
        {type === 'fiche' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 220px' }}>
                <span style={label}>Matière</span>
                <select value={espaceId} onChange={e => setEspaceId(e.target.value)} style={champ}>
                  <option value="">— Choisir —</option>
                  {espaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </label>
              <label style={{ flex: '1 1 220px' }}>
                <span style={label}>Chapitre</span>
                <select value={moduleId} onChange={e => setModuleId(e.target.value)} disabled={!espaceId} style={champ}>
                  <option value="">{espaceId ? '— Choisir —' : 'Choisis d\'abord une matière'}</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span style={label}>Question (recto)</span>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} placeholder="Ex. : Quelle est la durée de la garde à vue de droit commun ?" style={{ ...champ, resize: 'vertical' }} />
            </label>
            <label>
              <span style={label}>Réponse (verso)</span>
              <textarea value={reponse} onChange={e => setReponse(e.target.value)} rows={4} placeholder="La réponse claire et complète…" style={{ ...champ, resize: 'vertical' }} />
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 260px' }}>
                <span style={label}>Titre du QCM</span>
                <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex. : Procédure pénale — la garde à vue" style={champ} />
              </label>
              <label style={{ flex: '1 1 160px' }}>
                <span style={label}>Matière (facultatif)</span>
                <input value={matiere} onChange={e => setMatiere(e.target.value)} placeholder="Ex. : Procédure pénale" style={champ} />
              </label>
            </div>
            <label>
              <span style={label}>Questions</span>
              <textarea value={texteQcm} onChange={e => setTexteQcm(e.target.value)} rows={9}
                placeholder={EXEMPLE_QCM} style={{ ...champ, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
            </label>
            <div style={{ fontSize: 12, color: 'var(--c-annotation)', background: 'var(--c-papier)', border: '1px dashed var(--c-filet-fort)', borderRadius: 6, padding: '10px 12px', lineHeight: 1.6 }}>
              <b>Format :</b> <code>Q:</code> pour une question, <code>-</code> devant chaque option, une <code>*</code> en fin de ligne marque la bonne réponse (plusieurs possibles), <code>&gt;</code> pour une explication facultative.
            </div>
            {texteQcm.trim() && (
              <div style={{ fontSize: 13, color: apercuQcm.length ? '#0E5A47' : '#A8453B', fontWeight: 700 }}>
                {apercuQcm.length ? `✓ ${apercuQcm.length} question${apercuQcm.length > 1 ? 's' : ''} détectée${apercuQcm.length > 1 ? 's' : ''}` : 'Aucune question valide détectée — vérifie le format.'}
              </div>
            )}
          </div>
        )}

        {message && (
          <div style={{ marginTop: 14, fontSize: 13.5, fontWeight: 600, color: message.ok ? '#0E5A47' : '#C0392B' }}>{message.t}</div>
        )}
        <button onClick={envoyer} disabled={envoi} style={{ marginTop: 16, height: 48, padding: '0 26px', border: 'none', borderRadius: 6, background: 'var(--c-accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: envoi ? 0.7 : 1, fontFamily: FONT }}>
          {envoi ? 'Envoi…' : 'Proposer à la modération →'}
        </button>
      </div>

      {/* Mes propositions */}
      {mesContribs.length > 0 && (
        <>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Mes propositions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mesContribs.map(c => {
              const s = STATUT_LABEL[c.statut] || STATUT_LABEL.nouveau
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '11px 16px' }}>
                  <span style={{ fontSize: 18 }}>{c.type === 'qcm' ? '✅' : '📇'}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c.titre || (c.type === 'qcm' ? 'QCM' : 'Fiche')}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: s.c, background: s.bg, borderRadius: 999, padding: '3px 10px' }}>{s.t}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
