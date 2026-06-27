'use client'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Message = { role: 'user' | 'assistant'; contenu: string; ts: number }
const CLE_LS = 'tuteur-messages'
const TTL_MS = 24 * 60 * 60 * 1000

function charger(): Message[] {
  try {
    const raw = localStorage.getItem(CLE_LS)
    if (!raw) return []
    const limite = Date.now() - TTL_MS
    return (JSON.parse(raw) as Message[]).filter(m => m.ts > limite)
  } catch { return [] }
}
function sauver(msgs: Message[]) {
  try { localStorage.setItem(CLE_LS, JSON.stringify(msgs.filter(m => m.ts > Date.now() - TTL_MS))) } catch {}
}

const SUGGESTIONS = [
  'Explique-moi la distinction entre obligation de moyens et de résultat.',
  'Donne-moi la méthode du cas pratique en droit civil.',
  "Résume les principes de la responsabilité pénale.",
  'Quelles sont les étapes du syllogisme juridique ?',
]

export default function TuteurPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  const font = "'Hanken Grotesk', sans-serif"
  const coral = '#DC4A2B'

  useEffect(() => { setMessages(charger()) }, [])
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

  const stop = () => abortRef.current?.abort()

  const envoyer = async (texte?: string) => {
    const q = (texte ?? question).trim()
    if (!q || loading) return
    setQuestion('')
    const base = [...messages, { role: 'user' as const, contenu: q, ts: Date.now() }]
    setMessages(base); sauver(base)
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    let res: Response
    try {
      res = await fetch('/api/tuteur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: base.map(m => ({ role: m.role, content: m.contenu })) }),
        signal: controller.signal,
      })
    } catch {
      setLoading(false); abortRef.current = null; return
    }
    if (!res.ok || !res.body) {
      setMessages(m => { const n = [...m, { role: 'assistant' as const, contenu: "Erreur de connexion à l'IA.", ts: Date.now() }]; sauver(n); return n })
      setLoading(false); abortRef.current = null; return
    }

    setMessages(m => [...m, { role: 'assistant', contenu: '', ts: Date.now() }])
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const p = line.slice(6)
          if (p === '[DONE]') continue
          try {
            const obj = JSON.parse(p)
            if (obj.token) setMessages(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], contenu: c[c.length - 1].contenu + obj.token }; return c })
            if (obj.error) setMessages(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], contenu: '⚠️ ' + obj.error }; return c })
          } catch {}
        }
      }
    } catch {}
    setMessages(m => { sauver(m); return m })
    setLoading(false); abortRef.current = null
  }

  return (
    <div style={{ paddingTop: 34, fontFamily: font, color: '#2A2018', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 60px)' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: coral + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🧑‍🏫</div>
          <div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 24 }}>Tuteur IA</div>
            <div style={{ fontSize: 13.5, color: '#8A7E68' }}>Pose tes questions, demande des explications, des méthodes…</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { localStorage.removeItem(CLE_LS); setMessages([]) }} style={{ background: 'none', border: '1px solid #EADFC9', color: '#8A7E68', borderRadius: 9, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
            Effacer
          </button>
        )}
      </div>

      {/* Zone de chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8, minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '3rem', color: '#9A8D72' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2A2018', marginBottom: 16 }}>Par quoi veux-tu commencer ?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520, margin: '0 auto' }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => envoyer(s)} style={{ textAlign: 'left', background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, color: '#3A3226', cursor: 'pointer', fontFamily: font }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => m.role === 'user' ? (
          <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: '#2A2018', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '12px 18px', maxWidth: '78%', fontSize: 14.5, lineHeight: 1.6 }}>{m.contenu}</div>
          </div>
        ) : (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 2, background: coral + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🧑‍🏫</div>
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #F0E7D6', borderRadius: '4px 16px 16px 16px', padding: '14px 18px', fontSize: 15, lineHeight: 1.7 }}>
              {m.contenu ? <div className="md-response"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.contenu}</ReactMarkdown></div>
                : <span style={{ color: '#C2B7A0', fontStyle: 'italic' }}>…</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Stop */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, flexShrink: 0 }}>
          <button onClick={stop} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#2A2018', color: '#fff', border: 'none', borderRadius: 999, padding: '7px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
            <span className="ia-spinner" style={{ borderColor: '#5a4', borderTopColor: '#fff', width: 12, height: 12 }} /> Stop
          </button>
        </div>
      )}

      {/* Saisie */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #F0E7D6', paddingTop: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer() } }}
            placeholder="Pose ta question au tuteur…" disabled={loading}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #EADFC9', background: '#FFFBF2', fontSize: 14.5, outline: 'none', fontFamily: font, opacity: loading ? 0.6 : 1 }} />
          <button onClick={() => envoyer()} disabled={!question.trim() || loading} style={{ padding: '12px 22px', borderRadius: 12, background: coral, color: '#fff', border: 'none', cursor: question.trim() && !loading ? 'pointer' : 'default', fontSize: 14.5, fontWeight: 700, fontFamily: font, opacity: question.trim() && !loading ? 1 : 0.5 }}>
            {loading ? '…' : 'Envoyer'}
          </button>
        </div>
        <p style={{ margin: '8px 4px 0', fontSize: 11.5, fontStyle: 'italic', color: '#A89880' }}>
          ⚠️ Aide à la révision générée par IA — recoupe les points sensibles avec tes cours officiels. Conversations gardées 24 h sur cet appareil.
        </p>
      </div>
    </div>
  )
}
