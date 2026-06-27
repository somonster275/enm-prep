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
    return (JSON.parse(raw) as Message[]).filter(m => m.ts > Date.now() - TTL_MS)
  } catch { return [] }
}
function sauver(msgs: Message[]) {
  try { localStorage.setItem(CLE_LS, JSON.stringify(msgs.filter(m => m.ts > Date.now() - TTL_MS))) } catch {}
}

const SUGGESTIONS = [
  'Fais-moi un planning de révision pour les semaines à venir.',
  'Par quelles matières je devrais commencer vu le temps qu\'il me reste ?',
  'Donne-moi la méthode du cas pratique.',
  'Comment réviser efficacement le grand oral ?',
]

export default function TuteurChat({ variant = 'full' }: { variant?: 'full' | 'bubble' }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const compact = variant === 'bubble'

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: base.map(m => ({ role: m.role, content: m.contenu })) }),
        signal: controller.signal,
      })
    } catch { setLoading(false); abortRef.current = null; return }
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

  const effacer = () => { localStorage.removeItem(CLE_LS); setMessages([]) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: font, color: '#2A2018' }}>
      {/* Messages */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14, padding: compact ? '12px' : '0', minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: compact ? '1.5rem' : '3rem', color: '#9A8D72' }}>
            <div style={{ fontSize: compact ? 28 : 40, marginBottom: 10 }}>🧑‍🏫</div>
            <div style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: '#2A2018', marginBottom: 14 }}>Ton coach de révision ENM</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxWidth: 460, margin: '0 auto', padding: compact ? '0 6px' : 0 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => envoyer(s)} style={{ textAlign: 'left', background: '#fff', border: '1px solid #F0E7D6', borderRadius: 11, padding: compact ? '9px 12px' : '12px 16px', fontSize: compact ? 12.5 : 13.5, color: '#3A3226', cursor: 'pointer', fontFamily: font }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => m.role === 'user' ? (
          <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: '#2A2018', color: '#fff', borderRadius: '14px 14px 4px 14px', padding: compact ? '9px 13px' : '12px 18px', maxWidth: '85%', fontSize: compact ? 13.5 : 14.5, lineHeight: 1.55 }}>{m.contenu}</div>
          </div>
        ) : (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <div style={{ width: compact ? 26 : 34, height: compact ? 26 : 34, borderRadius: 9, flexShrink: 0, marginTop: 2, background: coral + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 13 : 17 }}>🧑‍🏫</div>
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #F0E7D6', borderRadius: '4px 14px 14px 14px', padding: compact ? '10px 13px' : '14px 18px', fontSize: compact ? 13.5 : 15, lineHeight: 1.6 }}>
              {m.contenu ? <div className="md-response"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.contenu}</ReactMarkdown></div> : <span style={{ color: '#C2B7A0', fontStyle: 'italic' }}>…</span>}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', flexShrink: 0 }}>
          <button onClick={stop} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2A2018', color: '#fff', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
            <span className="ia-spinner" style={{ borderColor: '#5a4', borderTopColor: '#fff', width: 11, height: 11 }} /> Stop
          </button>
        </div>
      )}

      {/* Saisie */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #F0E7D6', padding: compact ? '10px 12px' : '10px 0 0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer() } }}
            placeholder="Pose ta question au coach…" disabled={loading}
            style={{ flex: 1, padding: compact ? '10px 12px' : '12px 14px', borderRadius: 11, border: '1.5px solid #EADFC9', background: '#FFFBF2', fontSize: compact ? 13.5 : 14.5, outline: 'none', fontFamily: font, opacity: loading ? 0.6 : 1, minWidth: 0 }} />
          <button onClick={() => envoyer()} disabled={!question.trim() || loading} style={{ padding: compact ? '10px 16px' : '12px 22px', borderRadius: 11, background: coral, color: '#fff', border: 'none', cursor: question.trim() && !loading ? 'pointer' : 'default', fontSize: compact ? 13.5 : 14.5, fontWeight: 700, fontFamily: font, opacity: question.trim() && !loading ? 1 : 0.5, flexShrink: 0 }}>
            {loading ? '…' : '↑'}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 10.5, fontStyle: 'italic', color: '#A89880' }}>Aide à la révision — recoupe avec tes cours.</span>
          {messages.length > 0 && <button onClick={effacer} style={{ background: 'none', border: 'none', color: '#A89880', fontSize: 10.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: font }}>Effacer</button>}
        </div>
      </div>
    </div>
  )
}
