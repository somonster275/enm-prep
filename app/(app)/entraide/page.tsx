'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Entree = {
  user_id: string
  prenom: string | null
  nom: string | null
  contact: string
  matieres: string
  message: string | null
  updated_at: string
}

export default function EntraidePage() {
  const [userId, setUserId] = useState('')
  const [liste, setListe] = useState<Entree[]>([])
  const [loading, setLoading] = useState(true)

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [contact, setContact] = useState('')
  const [matieres, setMatieres] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)
  const [formOuvert, setFormOuvert] = useState(false)

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [{ data: prof }, { data: entrees }] = await Promise.all([
      supabase.from('profils').select('prenom, nom').eq('id', user.id).single(),
      supabase.from('entraide').select('*').order('updated_at', { ascending: false }),
    ])
    const toutes = (entrees || []) as Entree[]
    setListe(toutes)

    const mienne = toutes.find(e => e.user_id === user.id)
    if (mienne) {
      setPrenom(mienne.prenom || ''); setNom(mienne.nom || '')
      setContact(mienne.contact); setMatieres(mienne.matieres); setMessage(mienne.message || '')
    } else {
      setPrenom(prof?.prenom || ''); setNom(prof?.nom || '')
      setFormOuvert(false)
    }
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const enregistrer = async () => {
    setMsg(null)
    if (!contact.trim()) { setMsg({ type: 'err', texte: 'Indique un moyen de contact (email ou téléphone).' }); return }
    if (!matieres.trim()) { setMsg({ type: 'err', texte: 'Indique au moins une matière où tu peux aider.' }); return }
    setSaving(true)
    const { error } = await supabase.from('entraide').upsert({
      user_id: userId,
      prenom: prenom.trim().slice(0, 60) || null,
      nom: nom.trim().slice(0, 60) || null,
      contact: contact.trim().slice(0, 120),
      matieres: matieres.trim().slice(0, 200),
      message: message.trim().slice(0, 400) || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (error) { setMsg({ type: 'err', texte: error.message }); return }
    setMsg({ type: 'ok', texte: 'Ta fiche d’entraide est publiée ✅' })
    setFormOuvert(false)
    charger()
  }

  const retirer = async () => {
    if (!confirm('Retirer ta fiche de l’annuaire d’entraide ?')) return
    await supabase.from('entraide').delete().eq('user_id', userId)
    setContact(''); setMatieres(''); setMessage('')
    setMsg(null); setFormOuvert(false)
    charger()
  }

  const font = "'Hanken Grotesk', sans-serif"
  const champ: React.CSSProperties = {
    width: '100%', border: '1.5px solid #EADFC9', borderRadius: 12, padding: '11px 14px',
    background: '#FFFBF2', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: font,
  }
  const jePublie = liste.some(e => e.user_id === userId)
  const nomComplet = (e: Entree) => [e.prenom, e.nom].filter(Boolean).join(' ') || 'Étudiant'

  return (
    <div style={{ paddingTop: 34, maxWidth: 820, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>Entraide</h1>
      <p style={{ fontSize: 15.5, color: '#8A7E68', margin: '8px 0 24px', maxWidth: 600 }}>
        Un annuaire entre candidats : laisse tes coordonnées et les matières où tu te sens à l&apos;aise,
        pour aider d&apos;autres étudiants — et trouver de l&apos;aide à ton tour.
      </p>

      {/* Ma fiche d'entraide */}
      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{jePublie ? 'Ma fiche d’entraide' : 'Proposer mon aide'}</div>
          {!formOuvert && (
            <button onClick={() => setFormOuvert(true)} style={{ padding: '8px 16px', borderRadius: 10, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, fontFamily: font }}>
              {jePublie ? 'Modifier' : 'Publier ma fiche'}
            </button>
          )}
        </div>

        {formOuvert && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Prénom" style={champ} />
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom" style={champ} />
            </div>
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact : email et/ou téléphone" style={champ} />
            <input value={matieres} onChange={e => setMatieres(e.target.value)} placeholder="Matières où tu peux aider (ex. Droit civil, Procédure pénale)" style={champ} />
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Petit mot (facultatif)" style={{ ...champ, resize: 'vertical', lineHeight: 1.5 }} />
            {msg && <div style={{ fontSize: 13.5, color: msg.type === 'ok' ? '#0F6E56' : '#D94A30' }}>{msg.texte}</div>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={enregistrer} disabled={saving} style={{ height: 46, padding: '0 22px', border: 'none', borderRadius: 11, background: '#DC4A2B', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, fontFamily: font }}>
                {saving ? 'Publication…' : 'Publier'}
              </button>
              <button onClick={() => { setFormOuvert(false); setMsg(null) }} style={{ height: 46, padding: '0 18px', border: '1.5px solid #EADFC9', borderRadius: 11, background: '#fff', color: '#6E6456', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Annuler</button>
              {jePublie && (
                <button onClick={retirer} style={{ height: 46, padding: '0 18px', border: 'none', borderRadius: 11, background: '#FCE9E3', color: '#D94A30', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font, marginLeft: 'auto' }}>Retirer ma fiche</button>
              )}
            </div>
          </div>
        )}

        {!formOuvert && !jePublie && (
          <div style={{ fontSize: 13.5, color: '#8A7E68', marginTop: 10 }}>Tu n&apos;apparais pas encore dans l&apos;annuaire.</div>
        )}
      </div>

      {/* Annuaire */}
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 14 }}>
        Les étudiants disponibles {liste.length > 0 && <span style={{ fontSize: 14, color: '#9A8D72', fontWeight: 400, fontFamily: font }}>({liste.length})</span>}
      </div>

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : liste.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🤝</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#6E6456' }}>Personne pour l&apos;instant.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Sois le premier à proposer ton aide !</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {liste.map(e => (
            <div key={e.user_id} style={{ background: '#fff', border: e.user_id === userId ? '1.5px solid #DC4A2B' : '1px solid #F0E7D6', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{nomComplet(e)}</div>
                {e.user_id === userId && <span style={{ fontSize: 11, fontWeight: 700, color: '#DC4A2B', background: '#FCE9E3', padding: '2px 8px', borderRadius: 999 }}>Toi</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {e.matieres.split(/[,;]+/).map(m => m.trim()).filter(Boolean).map((m, i) => (
                  <span key={i} style={{ fontSize: 12, fontWeight: 600, color: '#0F6E56', background: '#ECF7F0', padding: '4px 10px', borderRadius: 999 }}>{m}</span>
                ))}
              </div>
              {e.message && <div style={{ fontSize: 13.5, color: '#6E6456', lineHeight: 1.5, marginBottom: 10 }}>{e.message}</div>}
              <div style={{ fontSize: 13, color: '#2A2018', fontWeight: 600, wordBreak: 'break-word' }}>
                <span style={{ color: '#9A8D72', fontWeight: 400 }}>Contact : </span>{e.contact}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
