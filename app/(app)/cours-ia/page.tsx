'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace } from '@/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useIsMobile } from '@/lib/useIsMobile'
import TuteurChat from '@/components/TuteurChat'

type Document = { id: string; nom: string; nb_chunks: number; espace_id: string | null; created_at: string; espaces: { nom: string; couleur: string } | null }
type Message = {
  role: 'user' | 'assistant'
  contenu: string
  sources?: string[]
  nbPassages?: number
  tReflexion?: number
  tRedaction?: number
  interrompu?: boolean
  ts: number
}

const fmtSec = (s: number) => s.toFixed(1).replace('.', ',') + ' s'
type Mode = 'officiel' | 'personnel'
const cleLS = (m: Mode) => `cours-ia-messages-${m}`
const TTL_MS = 24 * 60 * 60 * 1000

function chargerDepuisLS(m: Mode): Message[] {
  try {
    const raw = localStorage.getItem(cleLS(m))
    if (!raw) return []
    const parsed: Message[] = JSON.parse(raw)
    const limite = Date.now() - TTL_MS
    return parsed.filter(msg => msg.ts > limite)
  } catch { return [] }
}

function sauvegarderDansLS(m: Mode, msgs: Message[]) {
  try {
    const limite = Date.now() - TTL_MS
    localStorage.setItem(cleLS(m), JSON.stringify(msgs.filter(msg => msg.ts > limite)))
  } catch { /* quota exceeded */ }
}

export default function CoursIAPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState('')
  const [mode, setMode] = useState<Mode>('officiel')
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [espaceFiltre] = useState('')
  const [documentsSelectionnes, setDocumentsSelectionnes] = useState<string[]>([])
  const [panelOuvert, setPanelOuvert] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'recherche' | 'redaction'>('idle')
  const [sidebarOuverte, setSidebarOuverte] = useState(true)
  const [vueTuteur, setVueTuteur] = useState(false)
  const isMobile = useIsMobile()
  const abortRef = useRef<AbortController | null>(null)
  const [uploading, setUploading] = useState(false)
  const [espaceDoc, setEspaceDoc] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  const font = "'Hanken Grotesk', sans-serif"
  const coral = '#F2654B'
  const coralDark = '#B23A22'
  const coralBg = '#FDEFE9'
  const coralBorder = '#F8DACE'
  const sand = '#FDF6EA'
  const border = '#F0E7D6'
  const textDark = '#2A2018'
  const textMid = '#6E6456'
  const textMuted = '#9A8D72'

  const affMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const chargerDocs = async (m: Mode = mode, uid: string = userId) => {
    let q = supabase
      .from('cours_documents')
      .select('*, espaces(nom, couleur)')
      .is('deleted_at', null)
      .eq('portee', m)
      .order('created_at', { ascending: false })
    if (m === 'personnel') q = q.eq('created_by', uid)
    const { data } = await q
    setDocs((data as Document[]) || [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: prof } = await supabase.from('profils').select('role').eq('id', user.id).single()
      // La base ENM (officiel) n'est alimentée que par les admins.
      setIsAdmin(prof?.role === 'admin')
      const { data: esp } = await supabase.from('espaces').select('*').order('ordre')
      setEspaces(esp || [])
    }
    init()
  }, [])

  // Recharge documents + conversation à chaque changement de mode (ou au login).
  useEffect(() => {
    if (!userId) return
    setDocumentsSelectionnes([])
    setMessages(chargerDepuisLS(mode))
    chargerDocs(mode, userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Sur mobile, la sidebar documents est repliée par défaut (elle s'ouvre via le bouton).
  useEffect(() => { if (isMobile) setSidebarOuverte(false) }, [isMobile])

  const importerDoc = async () => {
    if (!fichier) return
    setUploading(true)
    const form = new FormData()
    form.append('fichier', fichier)
    if (mode === 'officiel' && espaceDoc) form.append('espace_id', espaceDoc)
    form.append('portee', mode)
    const res = await fetch('/api/cours/upload', { method: 'POST', body: form })
    const json = await res.json()
    setUploading(false)
    if (!res.ok) { affMsg('❌ ' + json.error); return }
    affMsg(`✅ ${json.chunks} passages indexés`)
    setFichier(null); setEspaceDoc('')
    if (fileRef.current) fileRef.current.value = ''
    chargerDocs(mode, userId)
  }

  const supprimerDoc = async (id: string) => {
    if (!confirm('Supprimer ce document et tous ses passages ?')) return
    await supabase.from('cours_documents').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setDocs(d => d.filter(x => x.id !== id))
  }

  const stopGeneration = () => abortRef.current?.abort()

  const poserQuestion = async () => {
    if (!question.trim() || loading) return
    const q = question.trim()
    setQuestion('')
    const msgUser: Message = { role: 'user', contenu: q, ts: Date.now() }
    setMessages(m => { const next = [...m, msgUser]; sauvegarderDansLS(mode, next); return next })
    setLoading(true)
    setPhase('recherche')

    const controller = new AbortController()
    abortRef.current = controller
    const t0 = Date.now()
    let tWriteStart = 0
    let premierToken = false

    let res: Response
    try {
      res = await fetch('/api/cours/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, portee: mode, espace_id: espaceFiltre || undefined, document_ids: documentsSelectionnes.length > 0 ? documentsSelectionnes : undefined }),
        signal: controller.signal,
      })
    } catch {
      setMessages(m => { const next = [...m, { role: 'assistant' as const, contenu: '⏹️ Génération interrompue.', interrompu: true, ts: Date.now() }]; sauvegarderDansLS(mode, next); return next })
      setLoading(false); setPhase('idle'); abortRef.current = null
      return
    }

    if (!res.ok || !res.body) {
      setMessages(m => { const next = [...m, { role: 'assistant' as const, contenu: "Erreur lors de la connexion à l'IA.", ts: Date.now() }]; sauvegarderDansLS(mode, next); return next })
      setLoading(false); setPhase('idle'); abortRef.current = null
      return
    }

    setMessages(m => [...m, { role: 'assistant', contenu: '', sources: [], ts: Date.now() }])

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') continue
          try {
            const obj = JSON.parse(payload)
            if (obj.sources) {
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], sources: obj.sources, nbPassages: obj.nbPassages }
                return copy
              })
            }
            if (obj.token) {
              if (!premierToken) {
                premierToken = true
                tWriteStart = Date.now()
                const tRef = (tWriteStart - t0) / 1000
                setPhase('redaction')
                setMessages(m => {
                  const copy = [...m]
                  copy[copy.length - 1] = { ...copy[copy.length - 1], tReflexion: tRef }
                  return copy
                })
              }
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], contenu: copy[copy.length - 1].contenu + obj.token }
                return copy
              })
            }
            if (obj.error) {
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], contenu: '⚠️ Erreur : ' + obj.error }
                return copy
              })
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* abort ou coupure réseau */ }

    const tRed = tWriteStart ? (Date.now() - tWriteStart) / 1000 : undefined
    setMessages(m => {
      const copy = [...m]
      const last = copy[copy.length - 1]
      if (last && last.role === 'assistant') {
        copy[copy.length - 1] = {
          ...last,
          tRedaction: tRed,
          interrompu: controller.signal.aborted || undefined,
          contenu: last.contenu || (controller.signal.aborted ? '⏹️ Génération interrompue.' : last.contenu),
        }
      }
      sauvegarderDansLS(mode, copy)
      return copy
    })
    setLoading(false); setPhase('idle'); abortRef.current = null
  }

  const docsAffiches = espaceFiltre ? docs.filter(d => d.espace_id === espaceFiltre) : docs

  // Placeholder de l'input selon le mode et la sélection.
  // En base ENM, pas de sélection : la question porte sur toute la base.
  const inputPlaceholder = mode === 'officiel'
    ? 'Posez votre question à la base ENM…'
    : documentsSelectionnes.length === 1
      ? `Question sur « ${docs.find(d => d.id === documentsSelectionnes[0])?.nom ?? '…'} »…`
      : documentsSelectionnes.length > 1
        ? `Question sur ${documentsSelectionnes.length} documents sélectionnés…`
        : 'Posez une question sur vos documents…'

  return (
    <>
      {/* Fonts Codex */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Space+Grotesk:wght@400;500;600&display=swap');`}</style>

      <div style={{
        minHeight: 'calc(100vh - 58px)',
        background: `${sand} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M0 0h32v32H0z' fill='none'/%3E%3Cpath d='M32 0H0M0 32V0' stroke='rgba(150,120,80,.048)' stroke-width='1'/%3E%3C/svg%3E") repeat`,
        fontFamily: font,
        color: textDark,
        paddingTop: 28,
        paddingBottom: 32,
      }}>
        <div className="cours-ia-wrap" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 58px - 60px)' }}>

          {/* ── En-tête page ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', display: 'inline-block', lineHeight: 1 }}>
                <div style={{ position: 'absolute', zIndex: 0, left: 10, right: 8, top: 4, bottom: 3, background: coral, borderRadius: 7 }} />
                <span style={{ position: 'relative', zIndex: 1, fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: 22, color: textDark, padding: '0 4px' }}>codex</span>
              </div>
              <span style={{ fontSize: 13, color: textMuted, borderLeft: `1px solid ${border}`, paddingLeft: 12 }}>
                Questions de cours
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Sélecteur Base ENM / Mes documents / Coach IA */}
              <div style={{ display: 'flex', background: '#fff', border: `1px solid ${border}`, borderRadius: 11, padding: 3, gap: 2, marginRight: 4, flexWrap: 'wrap' }}>
                {([['officiel', 'Base ENM'], ['personnel', 'Mes documents']] as [Mode, string][]).map(([m, label]) => {
                  const actif = !vueTuteur && mode === m
                  return (
                  <button key={m} onClick={() => { setMode(m); setVueTuteur(false) }} style={{
                    padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 700, fontFamily: font,
                    background: actif ? coral : 'transparent',
                    color: actif ? '#fff' : textMid,
                    boxShadow: actif ? `0 6px 14px -7px rgba(242,101,75,.8)` : 'none',
                  }}>{label}</button>
                )})}
                <button onClick={() => setVueTuteur(true)} style={{
                  padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, fontFamily: font,
                  background: vueTuteur ? coral : 'transparent',
                  color: vueTuteur ? '#fff' : textMid,
                  boxShadow: vueTuteur ? `0 6px 14px -7px rgba(242,101,75,.8)` : 'none',
                }}>📕 Coach IA</button>
              </div>
              {/* Sélection de documents : réservée à « Mes documents ».
                  En base ENM, les étudiants interrogent toute la base sans voir la liste. */}
              {!vueTuteur && mode === 'personnel' && docs.length > 0 && (
                <button onClick={() => setSidebarOuverte(o => !o)} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
                  background: sidebarOuverte ? coralBg : '#fff', color: sidebarOuverte ? coralDark : textMid,
                  border: `1px solid ${sidebarOuverte ? coralBorder : border}`, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: font,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
                  Documents
                  {documentsSelectionnes.length > 0 && (
                    <span style={{ background: coral, color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 6px', minWidth: 16, textAlign: 'center' }}>{documentsSelectionnes.length}</span>
                  )}
                </button>
              )}
              {!vueTuteur && (mode === 'personnel' || isAdmin) && (
                <button onClick={() => setPanelOuvert(o => !o)} style={{
                  padding: '8px 14px', borderRadius: 10,
                  background: panelOuvert ? textDark : '#fff',
                  color: panelOuvert ? '#fff' : textMid,
                  border: `1px solid ${panelOuvert ? textDark : border}`,
                  cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: font,
                }}>
                  {panelOuvert ? '× Fermer' : '+ Importer'}
                </button>
              )}
            </div>
          </div>

          {vueTuteur ? (
            <div style={{ flex: 1, minHeight: 0 }}><TuteurChat variant="full" /></div>
          ) : (
          <>
          {/* ── Panel admin import ── */}
          {panelOuvert && (mode === 'personnel' || isAdmin) && (
            <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: 18, padding: 20, marginBottom: 18, flexShrink: 0, boxShadow: `0 1px 2px rgba(60,40,20,.04), 0 12px 28px -18px rgba(60,40,20,.18)` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: textDark, marginBottom: 14 }}>
                {mode === 'personnel' ? 'Importer un de mes documents' : 'Importer un document dans la base ENM'}
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                {mode === 'officiel' && (
                  <select value={espaceDoc} onChange={e => setEspaceDoc(e.target.value)} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${border}`,
                    fontSize: 13, fontFamily: font, background: sand, outline: 'none',
                  }}>
                    <option value="">Toutes les matières</option>
                    {espaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                  </select>
                )}
                <label style={{
                  flex: 2, padding: '10px 14px', borderRadius: 10, border: `1.5px dashed ${coral}66`,
                  fontSize: 13, fontWeight: 600, color: coral, cursor: 'pointer', background: fichier ? coralBg : sand,
                }}>
                  {fichier ? `📎 ${fichier.name}` : 'Choisir un PDF ou fichier texte…'}
                  <input ref={fileRef} type="file" accept=".pdf,.txt,text/plain,application/pdf" style={{ display: 'none' }}
                    onChange={e => setFichier(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: textMuted }}>PDF et TXT · découpés en passages et indexés</div>
                <button onClick={importerDoc} disabled={!fichier || uploading} style={{
                  padding: '10px 22px', borderRadius: 10, background: coral, color: '#fff', border: 'none',
                  cursor: fichier && !uploading ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, fontFamily: font,
                  opacity: fichier && !uploading ? 1 : 0.5, boxShadow: fichier && !uploading ? `0 8px 18px -8px rgba(242,101,75,.7)` : 'none',
                }}>
                  {uploading ? 'Indexation…' : 'Importer'}
                </button>
              </div>
              {msg && <div style={{ fontSize: 13, marginTop: 10, color: msg.startsWith('❌') ? '#D94A30' : '#0E7C63' }}>{msg}</div>}
              {docsAffiches.length > 0 && (
                <div style={{ marginTop: 16, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: textMuted, marginBottom: 8, fontWeight: 700, letterSpacing: '.08em' }}>DOCUMENTS INDEXÉS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {docsAffiches.map(d => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '8px 12px', background: sand, borderRadius: 10, border: `1px solid ${border}` }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{d.nom}</span>
                          <span style={{ color: textMuted, marginLeft: 8, fontFamily: "'Space Grotesk', sans-serif", fontSize: 12 }}>· {d.nb_chunks} passages</span>
                          {d.espaces && <span style={{ marginLeft: 8, fontSize: 11, background: d.espaces.couleur + '20', color: d.espaces.couleur, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>#{d.espaces.nom}</span>}
                        </div>
                        <button onClick={() => supprimerDoc(d.id)} style={{ background: '#FCE9E3', color: '#D94A30', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Supprimer</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Conteneur 2 colonnes (empilées sur mobile) ── */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 18, flex: 1, minHeight: 0 }}>

            {/* Sidebar documents — uniquement « Mes documents » (jamais en base ENM) */}
            {mode === 'personnel' && docs.length > 0 && sidebarOuverte && (
              <aside style={{
                width: isMobile ? '100%' : 288, flexShrink: 0, maxHeight: isMobile ? '38vh' : undefined,
                background: '#fff', border: `1px solid ${border}`, borderRadius: 20,
                boxShadow: `0 1px 2px rgba(60,40,20,.05), 0 20px 44px -28px rgba(60,40,20,.22)`,
                display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 13px' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.13em', color: textMuted }}>DOCUMENTS INTERROGÉS</span>
                  <button onClick={() => setSidebarOuverte(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C2B7A0', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                </div>
                <div style={{ display: 'flex', gap: 14, padding: '0 18px 13px', borderBottom: `1px solid #F4ECDC` }}>
                  <button onClick={() => setDocumentsSelectionnes(docs.map(d => d.id))} style={{ fontSize: 12, fontWeight: 700, color: coral, background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, padding: 0 }}>Tout sélectionner</button>
                  <button onClick={() => setDocumentsSelectionnes([])} style={{ fontSize: 12, fontWeight: 600, color: '#B6A98C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, padding: 0 }}>Tout désélectionner</button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '14px 14px 8px' }}>
                  {espaces.filter(e => docs.some(d => d.espace_id === e.id)).map(e => (
                    <div key={e.id} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: coralDark, padding: '0 4px 8px' }}>{e.nom.toUpperCase()}</div>
                      {docs.filter(d => d.espace_id === e.id).map(d => {
                        const checked = documentsSelectionnes.includes(d.id)
                        return (
                          <label key={d.id} onClick={() => setDocumentsSelectionnes(prev => checked ? prev.filter(id => id !== d.id) : [...prev, d.id])} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 13,
                            marginBottom: 4, cursor: 'pointer',
                            background: checked ? coralBg : 'transparent',
                            border: `1px solid ${checked ? coralBorder : 'transparent'}`,
                          }}>
                            <div style={{
                              flexShrink: 0, width: 18, height: 18, borderRadius: 6,
                              background: checked ? coral : '#fff',
                              border: checked ? 'none' : `1.8px solid #DCCFB8`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: checked ? `0 3px 8px -3px rgba(242,101,75,.7)` : 'none',
                            }}>
                              {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span style={{ fontSize: 11, color: '#C9A98F' }}>📄</span>
                            <span title={d.nom} style={{ flex: 1, fontSize: 13, fontWeight: checked ? 700 : 600, color: checked ? textDark : '#6E6456', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nom}</span>
                            <span style={{ flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 600, color: checked ? coralDark : textMuted, background: checked ? '#FCE0D6' : '#F4ECDC', padding: '2px 7px', borderRadius: 7 }}>{d.nb_chunks}</span>
                          </label>
                        )
                      })}
                    </div>
                  ))}
                  {docs.filter(d => !d.espace_id).map(d => {
                    const checked = documentsSelectionnes.includes(d.id)
                    return (
                      <label key={d.id} onClick={() => setDocumentsSelectionnes(prev => checked ? prev.filter(id => id !== d.id) : [...prev, d.id])} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 13,
                        marginBottom: 4, cursor: 'pointer',
                        background: checked ? coralBg : 'transparent',
                        border: `1px solid ${checked ? coralBorder : 'transparent'}`,
                      }}>
                        <div style={{
                          flexShrink: 0, width: 18, height: 18, borderRadius: 6,
                          background: checked ? coral : '#fff',
                          border: checked ? 'none' : `1.8px solid #DCCFB8`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: checked ? `0 3px 8px -3px rgba(242,101,75,.7)` : 'none',
                        }}>
                          {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span style={{ fontSize: 11, color: '#C9A98F' }}>📄</span>
                        <span title={d.nom} style={{ flex: 1, fontSize: 13, fontWeight: checked ? 700 : 600, color: checked ? textDark : '#6E6456', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nom}</span>
                        <span style={{ flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 600, color: checked ? coralDark : textMuted, background: checked ? '#FCE0D6' : '#F4ECDC', padding: '2px 7px', borderRadius: 7 }}>{d.nb_chunks}</span>
                      </label>
                    )
                  })}
                </div>

                <div style={{ padding: '13px 18px', borderTop: `1px solid #F4ECDC`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: documentsSelectionnes.length > 0 ? '#2DAE83' : '#C2B7A0', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: textMid }}>
                    {documentsSelectionnes.length > 0
                      ? `${documentsSelectionnes.length} document${documentsSelectionnes.length > 1 ? 's' : ''} sélectionné${documentsSelectionnes.length > 1 ? 's' : ''}`
                      : 'Tous les documents interrogés'}
                  </span>
                </div>
              </aside>
            )}

            {/* Colonne conversation */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

              {/* Zone de chat */}
              <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8, minHeight: 0 }}>

                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', paddingTop: '5rem', color: textMuted }}>
                    <div style={{ fontSize: 36, marginBottom: 14 }}>
                      <div style={{ position: 'relative', display: 'inline-block', lineHeight: 1 }}>
                        <div style={{ position: 'absolute', zIndex: 0, left: 14, right: 10, top: 6, bottom: 5, background: coral, borderRadius: 9 }} />
                        <span style={{ position: 'relative', zIndex: 1, fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: 36, color: textDark, padding: '0 5px' }}>codex</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: textDark, marginBottom: 6 }}>Posez votre première question</div>
                    <div style={{ fontSize: 13, color: textMuted }}>
                      {mode === 'personnel'
                        ? "L'IA répond en s'appuyant exclusivement sur tes propres documents importés."
                        : "L'IA répond en s'appuyant exclusivement sur la base de cours ENM."}
                    </div>
                    {docs.length === 0 && (
                      mode === 'personnel'
                        ? <div style={{ marginTop: 12, fontSize: 13, color: '#D94A30' }}>⚠ Aucun document personnel — clique sur « + Importer » pour ajouter le tien.</div>
                        : isAdmin
                          ? <div style={{ marginTop: 12, fontSize: 13, color: '#D94A30' }}>⚠ Base ENM vide — cliquez sur « + Importer » pour commencer.</div>
                          : <div style={{ marginTop: 12, fontSize: 13, color: '#D94A30' }}>⚠ Aucun document n'a encore été importé dans la base ENM.</div>
                    )}
                  </div>
                )}

                {messages.map((m, i) => {
                  const dernier = i === messages.length - 1
                  const enCours = dernier && loading && m.role === 'assistant'

                  if (m.role === 'user') {
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          background: textDark, color: '#fff',
                          borderRadius: '16px 16px 4px 16px',
                          padding: '12px 18px', maxWidth: '68%', fontSize: 14, lineHeight: 1.6,
                          boxShadow: `0 4px 12px -6px rgba(42,32,24,.4)`,
                        }}>{m.contenu}</div>
                      </div>
                    )
                  }

                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {/* Carte réponse */}
                      <div style={{
                        background: '#fff', border: `1px solid ${border}`, borderRadius: 20,
                        boxShadow: `0 1px 2px rgba(60,40,20,.05), 0 24px 54px -32px rgba(60,40,20,.26)`,
                        overflow: 'hidden',
                      }}>
                        {/* Header carte */}
                        <div style={{ padding: '14px 22px 12px', background: 'linear-gradient(180deg,#FFF8EE,#FFFFFF)', borderBottom: `1px solid #F6EEDE` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Avatar codex */}
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: textDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0 }}>
                              c<span style={{ color: coral }}>.</span>
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 13.5, color: textDark }}>Réponse</span>
                            {/* Status pill */}
                            {enCours ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: coral, background: coralBg, padding: '3px 9px', borderRadius: 999 }}>
                                <span className="ia-spinner" style={{ width: 10, height: 10, borderColor: '#F8DACE', borderTopColor: coral }} />
                                {phase === 'recherche' ? 'Recherche…' : 'Rédaction…'}
                              </span>
                            ) : m.contenu && !m.interrompu ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#0E7C63', background: '#E2F3EC', padding: '3px 9px', borderRadius: 999 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2DAE83', display: 'inline-block' }} />
                                terminé
                              </span>
                            ) : m.interrompu ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#9A5A20', background: '#FEF0DC', padding: '3px 9px', borderRadius: 999 }}>interrompu</span>
                            ) : null}
                          </div>

                          {/* Chips phase (contexte) */}
                          {(m.sources || enCours) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                              {(m.sources && m.sources.length > 0) && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: textDark, background: '#FBF6EC', border: `1px solid ${border}`, padding: '3px 9px', borderRadius: 7, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500 }}>
                                  🔍 {m.sources.length} doc{m.sources.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {m.nbPassages !== undefined && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: textDark, background: '#FBF6EC', border: `1px solid ${border}`, padding: '3px 9px', borderRadius: 7, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500 }}>
                                  {m.nbPassages} passage{m.nbPassages > 1 ? 's' : ''}
                                </span>
                              )}
                              {(m.tReflexion !== undefined || enCours) && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: textDark, background: '#FBF6EC', border: `1px solid ${border}`, padding: '3px 9px', borderRadius: 7, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500 }}>
                                  ✏️ Rédaction
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Corps réponse */}
                        <div style={{ padding: '20px 24px 18px', fontSize: 15, lineHeight: 1.68, color: '#3A3226' }}>
                          {m.contenu ? (
                            <div className="md-response codex-response">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.contenu}</ReactMarkdown>
                            </div>
                          ) : (
                            <span style={{ color: '#C2B7A0', fontStyle: 'italic' }}>En attente de la réponse…</span>
                          )}
                        </div>

                        {/* Métriques */}
                        {m.tReflexion !== undefined && (
                          <div style={{ display: 'flex', gap: 8, padding: '0 24px 18px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textMid, background: '#FBF6EC', border: `1px solid ${border}`, padding: '6px 11px', borderRadius: 10 }}>
                              ⚡ Premier mot en <strong style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: textDark, marginLeft: 3 }}>{fmtSec(m.tReflexion)}</strong>
                            </span>
                            {m.tRedaction !== undefined && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textMid, background: '#FBF6EC', border: `1px solid ${border}`, padding: '6px 11px', borderRadius: 10 }}>
                                ✏️ Rédigé en <strong style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: textDark, marginLeft: 3 }}>{fmtSec(m.tRedaction)}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Sources toujours visibles en bas de carte */}
                        {m.sources && m.sources.length > 0 && (
                          <div style={{ borderTop: `1px solid #F6EEDE`, padding: '12px 24px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: textMuted }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={coral} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
                              SOURCES
                            </span>
                            {m.sources.map((s, j) => (
                              <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, background: coralBg, color: coralDark, padding: '4px 10px', borderRadius: 8, fontWeight: 600, border: `1px solid ${coralBorder}` }}>
                                <span style={{ width: 17, height: 17, borderRadius: 5, background: j === 0 ? coral : '#FCE6DE', color: j === 0 ? '#fff' : coralDark, fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{j + 1}</span>
                                📄 {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Stop pill flottante */}
                {phase !== 'idle' && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4, flexShrink: 0 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#fff', border: `1px solid ${border}`, borderRadius: 999, padding: '7px 8px 7px 16px', boxShadow: `0 6px 20px -8px rgba(242,101,75,.25)` }}>
                      <span className="ia-spinner" style={{ borderColor: coralBg, borderTopColor: coral }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: coral }}>{phase === 'recherche' ? 'Recherche…' : 'Rédaction…'}</span>
                      <button onClick={stopGeneration} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: textDark, color: '#fff', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                        Stop
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Barre de saisie ── */}
              <div style={{ flexShrink: 0, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1.5px solid ${border}`, borderRadius: 18, padding: '9px 9px 9px 16px', boxShadow: `0 1px 2px rgba(60,40,20,.05), 0 16px 38px -24px rgba(60,40,20,.22)` }}>
                  {documentsSelectionnes.length > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 12, fontWeight: 600, color: coralDark, background: coralBg, padding: '5px 10px', borderRadius: 9, border: `1px solid ${coralBorder}`, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📄 {documentsSelectionnes.length === 1 ? (docs.find(d => d.id === documentsSelectionnes[0])?.nom ?? '…') : `${documentsSelectionnes.length} documents`}
                    </span>
                  )}
                  <input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); poserQuestion() } }}
                    placeholder={inputPlaceholder}
                    disabled={loading}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14.5, fontFamily: font, color: textDark, background: 'transparent', opacity: loading ? 0.6 : 1 }}
                  />
                  <span style={{ flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: '#C2B7A0', border: `1px solid #ECE2D0`, padding: '4px 8px', borderRadius: 7 }}>⏎ pour envoyer</span>
                  <button onClick={poserQuestion} disabled={!question.trim() || loading} style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 22px', borderRadius: 13, background: coral, color: '#fff', border: 'none',
                    cursor: question.trim() && !loading ? 'pointer' : 'default', fontSize: 14, fontWeight: 700, fontFamily: font,
                    opacity: question.trim() && !loading ? 1 : 0.5,
                    boxShadow: question.trim() && !loading ? `0 8px 20px -8px rgba(242,101,75,.8)` : 'none',
                  }}>
                    {loading ? '…' : <>Envoyer <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg></>}
                  </button>
                </div>

                {/* Avertissements */}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '0 4px' }}>
                  <span style={{ fontSize: 12, color: textMuted, fontFamily: "'Space Grotesk', sans-serif" }}>
                    ⏳ Conversations conservées <strong style={{ fontWeight: 600 }}>24 h</strong> dans ce navigateur.{' '}
                    {messages.length > 0 && (
                      <button onClick={() => { localStorage.removeItem(cleLS(mode)); setMessages([]) }} style={{ background: 'none', border: 'none', color: coral, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Space Grotesk', sans-serif", padding: 0, fontWeight: 600 }}>
                        Effacer
                      </button>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: textMuted, fontFamily: "'Space Grotesk', sans-serif" }}>
                    ⚠️ Assistant propulsé par Claude (Anthropic) — recoupez avec vos cours, n&apos;y inscrivez pas d&apos;informations personnelles.
                  </span>
                </div>
              </div>

            </div>{/* fin colonne conversation */}
          </div>{/* fin conteneur 2 colonnes */}
          </>
          )}
        </div>
      </div>
    </>
  )
}
