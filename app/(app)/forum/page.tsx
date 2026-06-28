'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Question = { id: string; user_id: string; auteur: string | null; matiere: string | null; titre: string; corps: string | null; created_at: string }
type Reponse = { id: string; question_id: string; user_id: string; auteur: string | null; corps: string; created_at: string }

export default function ForumPage() {
  const [uid, setUid] = useState('')
  const [auteur, setAuteur] = useState('Étudiant')
  const [isAdmin, setIsAdmin] = useState(false)
  const [matieres, setMatieres] = useState<string[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('')

  // Nouvelle question
  const [titre, setTitre] = useState('')
  const [matiere, setMatiere] = useState('')
  const [corps, setCorps] = useState('')
  const [posting, setPosting] = useState(false)
  const [formOuvert, setFormOuvert] = useState(false)

  // Fil ouvert
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [reponses, setReponses] = useState<Record<string, Reponse[]>>({})
  const [reponse, setReponse] = useState('')

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUid(user.id)
    const [{ data: prof }, { data: esp }, { data: qs }] = await Promise.all([
      supabase.from('profils').select('prenom, nom, role').eq('id', user.id).single(),
      supabase.from('espaces').select('nom').order('ordre'),
      supabase.from('forum_questions').select('*').order('created_at', { ascending: false }),
    ])
    setAuteur([prof?.prenom, prof?.nom].filter(Boolean).join(' ') || 'Étudiant')
    setIsAdmin(prof?.role === 'admin')
    setMatieres((esp || []).map((e: { nom: string }) => e.nom))
    setQuestions((qs || []) as Question[])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const poser = async () => {
    if (!titre.trim()) return
    setPosting(true)
    const { error } = await supabase.from('forum_questions').insert({
      user_id: uid, auteur, matiere: matiere || null, titre: titre.trim().slice(0, 160), corps: corps.trim().slice(0, 2000) || null,
    })
    setPosting(false)
    if (error) return
    setTitre(''); setCorps(''); setMatiere(''); setFormOuvert(false)
    charger()
  }

  const ouvrirFil = async (id: string) => {
    if (ouvert === id) { setOuvert(null); return }
    setOuvert(id); setReponse('')
    const { data } = await supabase.from('forum_reponses').select('*').eq('question_id', id).order('created_at')
    setReponses(r => ({ ...r, [id]: (data || []) as Reponse[] }))
  }

  const repondre = async (qid: string) => {
    if (!reponse.trim()) return
    const { error } = await supabase.from('forum_reponses').insert({
      question_id: qid, user_id: uid, auteur, corps: reponse.trim().slice(0, 2000),
    })
    if (error) return
    setReponse('')
    const { data } = await supabase.from('forum_reponses').select('*').eq('question_id', qid).order('created_at')
    setReponses(r => ({ ...r, [qid]: (data || []) as Reponse[] }))
  }

  const supprimerQuestion = async (id: string) => {
    if (!confirm('Supprimer cette question et ses réponses ?')) return
    setQuestions(qs => qs.filter(q => q.id !== id))
    await supabase.from('forum_questions').delete().eq('id', id)
  }
  const supprimerReponse = async (qid: string, id: string) => {
    setReponses(r => ({ ...r, [qid]: (r[qid] || []).filter(x => x.id !== id) }))
    await supabase.from('forum_reponses').delete().eq('id', id)
  }

  const font = "'Hanken Grotesk', sans-serif"
  const champ: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid #EADFC9', borderRadius: 12, padding: '11px 14px', background: '#FFFBF2', fontSize: 14, outline: 'none', fontFamily: font }
  const visibles = filtre ? questions.filter(q => q.matiere === filtre) : questions
  const dateFr = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>Forum d&apos;entraide</h1>
        {!formOuvert && <button onClick={() => setFormOuvert(true)} style={{ padding: '10px 18px', borderRadius: 11, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: font }}>Poser une question</button>}
      </div>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 22px' }}>Posez vos questions, répondez à celles des autres. On avance ensemble.</p>

      {formOuvert && (
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18, marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ta question en une phrase…" style={champ} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select value={matiere} onChange={e => setMatiere(e.target.value)} style={{ ...champ, flex: '1 1 200px' }}>
              <option value="">Matière (facultatif)</option>
              {matieres.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <textarea value={corps} onChange={e => setCorps(e.target.value)} rows={3} placeholder="Détaille si besoin…" style={{ ...champ, resize: 'vertical', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={poser} disabled={posting || !titre.trim()} style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 11, background: '#DC4A2B', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: posting || !titre.trim() ? 0.6 : 1, fontFamily: font }}>{posting ? 'Publication…' : 'Publier'}</button>
            <button onClick={() => setFormOuvert(false)} style={{ height: 44, padding: '0 16px', border: '1.5px solid #EADFC9', borderRadius: 11, background: '#fff', color: '#6E6456', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Filtre matière */}
      {matieres.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFiltre('')} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: font, background: filtre === '' ? '#DC4A2B' : '#fff', color: filtre === '' ? '#fff' : '#8A7E68', borderWidth: filtre === '' ? 0 : 1, borderStyle: 'solid', borderColor: '#F0E7D6' }}>Toutes</button>
          {matieres.map(m => (
            <button key={m} onClick={() => setFiltre(m)} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: font, background: filtre === m ? '#DC4A2B' : '#fff', color: filtre === m ? '#fff' : '#8A7E68', border: `1px solid ${filtre === m ? '#DC4A2B' : '#F0E7D6'}` }}>{m}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>Aucune question pour l&apos;instant. Lance la discussion !</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibles.map(q => {
            const open = ouvert === q.id
            const reps = reponses[q.id] || []
            return (
              <div key={q.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div onClick={() => ouvrirFil(q.id)} style={{ flex: 1, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      {q.matiere && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0F6E56', background: '#ECF7F0', padding: '2px 8px', borderRadius: 999 }}>{q.matiere}</span>}
                      <span style={{ fontSize: 12, color: '#9A8D72' }}>{q.auteur || 'Étudiant'} · {dateFr(q.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 700 }}>{q.titre}</div>
                    {q.corps && <div style={{ fontSize: 13.5, color: '#6E6456', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{q.corps}</div>}
                  </div>
                  {(isAdmin || q.user_id === uid) && (
                    <button onClick={() => supprimerQuestion(q.id)} title="Supprimer" style={{ border: 'none', background: 'transparent', color: '#C0B7A4', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>✕</button>
                  )}
                </div>

                <button onClick={() => ouvrirFil(q.id)} style={{ marginTop: 10, background: 'none', border: 'none', color: '#DC4A2B', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: font }}>
                  {open ? 'Masquer les réponses' : `Voir / répondre${reps.length ? ` (${reps.length})` : ''}`}
                </button>

                {open && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #F5EEE0', paddingTop: 12 }}>
                    {reps.length === 0 && <div style={{ fontSize: 13, color: '#9A8D72', marginBottom: 10 }}>Aucune réponse — sois le premier à aider.</div>}
                    {reps.map(r => (
                      <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1, background: '#FFFBF2', border: '1px solid #F0E7D6', borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ fontSize: 12, color: '#9A8D72', marginBottom: 3 }}>{r.auteur || 'Étudiant'} · {dateFr(r.created_at)}</div>
                          <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.corps}</div>
                        </div>
                        {(isAdmin || r.user_id === uid) && (
                          <button onClick={() => supprimerReponse(q.id, r.id)} title="Supprimer" style={{ border: 'none', background: 'transparent', color: '#C0B7A4', cursor: 'pointer', fontSize: 14 }}>✕</button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input value={reponse} onChange={e => setReponse(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') repondre(q.id) }} placeholder="Ta réponse…" style={{ ...champ, flex: 1 }} />
                      <button onClick={() => repondre(q.id)} disabled={!reponse.trim()} style={{ padding: '0 18px', borderRadius: 11, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: reponse.trim() ? 1 : 0.5, fontFamily: font }}>Envoyer</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
