'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDefiPage() {
  const [type, setType] = useState<'fiches' | 'libre'>('fiches')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [objectif, setObjectif] = useState(150)
  const [matiere, setMatiere] = useState('')
  const [matieres, setMatieres] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('defi_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('espaces').select('nom').order('ordre'),
    ]).then(([{ data: c }, { data: esp }]) => {
      if (c) {
        setType(c.type === 'libre' ? 'libre' : 'fiches')
        setTitre(c.titre || ''); setDescription(c.description || '')
        setObjectif(c.objectif || 150); setMatiere(c.matiere || '')
      }
      setMatieres((esp || []).map((e: { nom: string }) => e.nom))
      setLoading(false)
    })
  }, [])

  const enregistrer = async () => {
    setSaving(true); setMsg(null)
    const res = await fetch('/api/admin/defi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, titre, description, objectif, matiere }),
    })
    setSaving(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ type: 'err', texte: json.error || 'Erreur' }); return }
    setMsg({ type: 'ok', texte: 'Défi de la semaine mis à jour ✅' })
  }

  const font = "'Hanken Grotesk', sans-serif"
  const champ: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #EADFC9', borderRadius: 12, padding: '11px 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', fontFamily: font }
  const carteType = (val: 'fiches' | 'libre', titreC: string, descC: string) => (
    <button onClick={() => setType(val)} style={{
      flex: 1, textAlign: 'left', padding: 16, borderRadius: 14, cursor: 'pointer', fontFamily: font,
      border: `2px solid ${type === val ? '#DC4A2B' : '#EADFC9'}`, background: type === val ? '#FCEFE9' : '#fff',
    }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: '#2A2018' }}>{titreC}</div>
      <div style={{ fontSize: 12.5, color: '#8A7E68', marginTop: 4, lineHeight: 1.5 }}>{descC}</div>
    </button>
  )

  if (loading) return <div style={{ paddingTop: '4rem', textAlign: 'center', color: '#9A8D72', fontFamily: font }}>Chargement…</div>

  return (
    <div style={{ paddingTop: 34, maxWidth: 620, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26, margin: 0 }}>Défi de la semaine</h1>
      <p style={{ fontSize: 14.5, color: '#8A7E68', margin: '8px 0 22px' }}>Choisis le défi qui s&apos;affiche aux étudiants sur la page Classement.</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {carteType('fiches', '🎯 Fiches révisées', 'Objectif chiffré, mesuré automatiquement, avec barre de progression et classement.')}
        {carteType('libre', '✍️ Défi libre', 'Un défi de ton choix (rédiger un cas pratique, ficher un chapitre…), affiché comme une annonce.')}
      </div>

      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#5C4A22', display: 'block', marginBottom: 6 }}>Titre du défi {type === 'fiches' && '(facultatif)'}</label>
          <input value={titre} onChange={e => setTitre(e.target.value)} placeholder={type === 'fiches' ? 'Ex. « Sprint de révision »' : 'Ex. « Rédige un cas pratique »'} style={champ} />
        </div>

        {type === 'fiches' ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#5C4A22', display: 'block', marginBottom: 6 }}>Objectif (cartes / semaine)</label>
              <input type="number" min={1} value={objectif} onChange={e => setObjectif(parseInt(e.target.value, 10) || 0)} style={champ} />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#5C4A22', display: 'block', marginBottom: 6 }}>Thème / matière (facultatif)</label>
              <select value={matiere} onChange={e => setMatiere(e.target.value)} style={champ}>
                <option value="">— Aucun —</option>
                {matieres.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#5C4A22', display: 'block', marginBottom: 6 }}>Description du défi</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              placeholder="Ex. « Cette semaine : rédigez un cas pratique de droit pénal et partagez-le dans Annales. »"
              style={{ ...champ, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        )}

        {msg && <div style={{ fontSize: 13.5, color: msg.type === 'ok' ? '#0F6E56' : '#D94A30' }}>{msg.texte}</div>}

        <button onClick={enregistrer} disabled={saving} style={{
          height: 48, border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff',
          fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, fontFamily: font,
        }}>{saving ? 'Enregistrement…' : 'Publier le défi'}</button>
      </div>

      <div style={{ fontSize: 12.5, color: '#9A8D72', marginTop: 14, lineHeight: 1.5 }}>
        Le classement anonyme (cartes révisées) reste affiché dans tous les cas. Pour un « défi libre », il n&apos;y a pas de mesure automatique : c&apos;est une annonce motivante.
      </div>
    </div>
  )
}
