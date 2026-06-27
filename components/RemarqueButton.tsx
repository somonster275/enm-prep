'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const FONT = "'Hanken Grotesk', sans-serif"

/** Bouton « Faire une remarque » + modal, pour qu'un étudiant signale un retour
 *  sur une fiche à l'administrateur. */
export default function RemarqueButton({ ficheId, style }: { ficheId: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [statut, setStatut] = useState<'' | 'envoi' | 'ok'>('')
  const [err, setErr] = useState('')

  const fermer = () => { setOpen(false); setMessage(''); setStatut(''); setErr('') }

  const envoyer = async () => {
    if (!message.trim()) { setErr('Écris ta remarque.'); return }
    setStatut('envoi'); setErr('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatut(''); setErr('Session expirée, reconnecte-toi.'); return }
    const { error } = await supabase.from('remarques_fiches').insert({
      fiche_id: ficheId, user_id: user.id, message: message.trim().slice(0, 2000),
    })
    if (error) { setStatut(''); setErr(error.message); return }
    setStatut('ok')
  }

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        title="Signaler une remarque à l'administrateur"
        style={{
          padding: '6px 12px', borderRadius: 8, background: '#fff', color: '#8A7E68',
          border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: FONT,
          whiteSpace: 'nowrap', ...style,
        }}>
        💬 Faire une remarque
      </button>

      {open && (
        <div onClick={fermer} style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,20,.42)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => { e.stopPropagation() }} style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 460, fontFamily: FONT, color: '#2A2018', boxShadow: '0 24px 60px -30px rgba(40,30,20,.5)' }}>
            {statut === 'ok' ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 30, marginBottom: 6 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>Remarque envoyée !</div>
                <div style={{ fontSize: 13.5, color: '#8A7E68', marginTop: 6 }}>L&apos;administrateur la verra et en tiendra compte si besoin. Merci !</div>
                <button onClick={fermer} style={{ marginTop: 18, height: 44, padding: '0 24px', border: 'none', borderRadius: 11, background: '#DC4A2B', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Faire une remarque</div>
                <div style={{ fontSize: 13, color: '#8A7E68', marginBottom: 14 }}>
                  Une erreur, une imprécision ou une suggestion sur cette fiche ? Signale-la à l&apos;administrateur.
                </div>
                <textarea autoFocus value={message} onChange={e => setMessage(e.target.value)} rows={5}
                  placeholder="Ta remarque sur cette fiche…"
                  style={{ width: '100%', border: '1.5px solid #EADFC9', borderRadius: 12, padding: '12px 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, fontFamily: FONT }} />
                {err && <div style={{ color: '#D94A30', fontSize: 13, marginTop: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button onClick={fermer} style={{ flex: 1, height: 46, border: '1.5px solid #EADFC9', background: '#fff', borderRadius: 11, fontSize: 14, fontWeight: 600, color: '#6E6456', cursor: 'pointer', fontFamily: FONT }}>Annuler</button>
                  <button onClick={envoyer} disabled={statut === 'envoi'} style={{ flex: 2, height: 46, border: 'none', background: '#DC4A2B', color: '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: statut === 'envoi' ? 0.7 : 1, fontFamily: FONT }}>{statut === 'envoi' ? 'Envoi…' : 'Envoyer'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
