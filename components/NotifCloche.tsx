'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Notif = { id: string; type: string; texte: string; lien: string | null; lu: boolean; created_at: string }
const FONT = "'Hanken Grotesk', sans-serif"

export default function NotifCloche() {
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const charger = async (userId: string) => {
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    setItems((data || []) as Notif[])
  }

  useEffect(() => {
    let canal: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id || ''
      if (!id) return
      setUid(id)
      charger(id)
      canal = supabase.channel(`notifs-${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${id}` },
          payload => setItems(prev => [payload.new as Notif, ...prev].slice(0, 20)))
        .subscribe()
    })
    return () => { if (canal) supabase.removeChannel(canal) }
  }, [])

  // Ferme au clic extérieur.
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const nonLues = items.filter(n => !n.lu).length

  const ouvrir = (n: Notif) => {
    if (!n.lu) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, lu: true } : x))
      supabase.from('notifications').update({ lu: true }).eq('id', n.id)
    }
    setOpen(false)
    if (n.lien) router.push(n.lien)
  }

  const toutLire = async () => {
    setItems(prev => prev.map(x => ({ ...x, lu: true })))
    if (uid) await supabase.from('notifications').update({ lu: true }).eq('user_id', uid).eq('lu', false)
  }

  const tempsRelatif = (s: string) => {
    const d = (Date.now() - new Date(s).getTime()) / 1000
    if (d < 60) return "à l'instant"
    if (d < 3600) return `il y a ${Math.floor(d / 60)} min`
    if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`
    return `il y a ${Math.floor(d / 86400)} j`
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications" style={{
        width: 38, height: 38, borderRadius: '50%', background: '#FDF6EA', border: '1px solid #F0E7D6',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6E6456" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {nonLues > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#DC4A2B', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>{nonLues > 9 ? '9+' : nonLues}</span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 46, right: 0, width: 320, maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14, boxShadow: '0 8px 24px -8px rgba(40,30,60,.18)', zIndex: 300, fontFamily: FONT }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #F0E7D6' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#2A2018' }}>Notifications</span>
            {nonLues > 0 && <button onClick={toutLire} style={{ background: 'none', border: 'none', color: '#DC4A2B', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Tout lire</button>}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9A8D72', fontSize: 13 }}>Aucune notification.</div>
          ) : (
            items.map(n => (
              <button key={n.id} onClick={() => ouvrir(n)} style={{
                width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: '11px 14px', border: 'none', borderBottom: '1px solid #F5EEE0',
                background: n.lu ? '#fff' : '#FFF8EE', cursor: 'pointer', fontFamily: FONT,
              }}>
                {!n.lu && <span style={{ flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: '#DC4A2B', marginTop: 5 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#2A2018', lineHeight: 1.4 }}>{n.texte}</div>
                  <div style={{ fontSize: 11, color: '#9A8D72', marginTop: 2 }}>{tempsRelatif(n.created_at)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
