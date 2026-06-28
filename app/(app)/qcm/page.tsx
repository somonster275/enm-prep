'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { enregistrerActivite } from '@/lib/streaks'

type Qcm = { id: string; titre: string; matiere: string | null }
type Question = { id: string; qcm_id: string; enonce: string; options: { t: string; c: boolean }[]; explication: string | null; ordre: number }

export default function QcmPage() {
  const [uid, setUid] = useState('')
  const [qcms, setQcms] = useState<Qcm[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('')
  const [nbErreurs, setNbErreurs] = useState(0)

  const [actif, setActif] = useState<Qcm | null>(null)
  const [modeErreurs, setModeErreurs] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [reponses, setReponses] = useState<Record<string, Set<number>>>({})
  const [corrige, setCorrige] = useState(false)

  const chargerErreurs = async (userId: string) => {
    const { count } = await supabase.from('qcm_reponses')
      .select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('juste', false)
    setNbErreurs(count || 0)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id || ''
      setUid(id)
      if (id) chargerErreurs(id)
    })
    supabase.from('qcm').select('id, titre, matiere').order('created_at', { ascending: false })
      .then(({ data }) => { setQcms((data || []) as Qcm[]); setLoading(false) })
  }, [])

  const jouer = async (q: Qcm) => {
    const { data } = await supabase.from('qcm_questions').select('*').eq('qcm_id', q.id).order('ordre')
    setQuestions((data || []) as Question[]); setReponses({}); setCorrige(false); setModeErreurs(false); setActif(q)
    window.scrollTo({ top: 0 })
  }

  // Mode « réviser mes erreurs » : rejoue les questions déjà ratées (tous QCM confondus).
  const jouerErreurs = async () => {
    if (!uid) return
    const { data: rep } = await supabase.from('qcm_reponses').select('question_id').eq('user_id', uid).eq('juste', false)
    const ids = (rep || []).map((r: { question_id: string }) => r.question_id)
    if (ids.length === 0) return
    const { data } = await supabase.from('qcm_questions').select('*').in('id', ids)
    const melange = ((data || []) as Question[]).sort(() => Math.random() - 0.5)
    setQuestions(melange); setReponses({}); setCorrige(false); setActif(null); setModeErreurs(true)
    window.scrollTo({ top: 0 })
  }

  const toggle = (qid: string, oi: number, multi: boolean) => {
    if (corrige) return
    setReponses(r => {
      const cur = new Set(r[qid] || [])
      if (multi) { cur.has(oi) ? cur.delete(oi) : cur.add(oi) }
      else { cur.clear(); cur.add(oi) }
      return { ...r, [qid]: cur }
    })
  }

  const estBonne = (q: Question) => {
    const choisi = reponses[q.id] || new Set<number>()
    const bonnes = new Set(q.options.map((o, i) => o.c ? i : -1).filter(i => i >= 0))
    if (choisi.size !== bonnes.size) return false
    for (const i of choisi) if (!bonnes.has(i)) return false
    return true
  }
  const score = questions.filter(estBonne).length

  const valider = async () => {
    setCorrige(true)
    window.scrollTo({ top: 0 })
    if (!uid) return
    // Enregistre le résultat par question (pour les stats et « réviser mes erreurs »).
    const rows = questions.map(q => ({ user_id: uid, question_id: q.id, qcm_id: q.qcm_id, juste: estBonne(q) }))
    if (rows.length) await supabase.from('qcm_reponses').upsert(rows, { onConflict: 'user_id,question_id' })
    if (actif) {
      await supabase.from('qcm_resultats').insert({ user_id: uid, qcm_id: actif.id, score, total: questions.length })
    }
    enregistrerActivite(uid) // compte dans l'activité / la série
    chargerErreurs(uid)
  }

  const font = "'Hanken Grotesk', sans-serif"
  const matieres = [...new Set(qcms.map(q => q.matiere).filter(Boolean))] as string[]
  const visibles = filtre ? qcms.filter(q => q.matiere === filtre) : qcms
  const retour = () => { setActif(null); setModeErreurs(false) }
  const recommencer = () => { setReponses({}); setCorrige(false); window.scrollTo({ top: 0 }) }

  // ---------- Vue : jeu / résultat ----------
  if (actif || modeErreurs) {
    return (
      <div style={{ paddingTop: 34, maxWidth: 720, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
        <button onClick={retour} style={{ background: 'none', border: 'none', color: '#9A8D72', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← Tous les QCM</button>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 24, margin: '0 0 4px' }}>{actif ? actif.titre : '🎯 Mes erreurs'}</h1>
        {actif?.matiere && <div style={{ fontSize: 13, color: '#8A7E68', marginBottom: 16 }}>{actif.matiere}</div>}
        {modeErreurs && <div style={{ fontSize: 13, color: '#8A7E68', marginBottom: 16 }}>Rejoue les questions que tu as déjà ratées. Une bonne réponse les retire de ta liste.</div>}

        {corrige && (
          <div style={{ background: score === questions.length ? '#ECF7F0' : '#FFF8EE', border: `1px solid ${score === questions.length ? '#BFE6CF' : '#F2D9A0'}`, borderRadius: 16, padding: 18, marginBottom: 18, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28 }}>{score} / {questions.length}</div>
            <div style={{ fontSize: 14, color: '#6E6456', marginTop: 4 }}>{score === questions.length ? '🎉 Sans faute !' : 'Revois les explications ci-dessous.'}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {questions.map((q, qi) => {
            const multi = q.options.filter(o => o.c).length > 1
            const choisi = reponses[q.id] || new Set<number>()
            const bonne = estBonne(q)
            return (
              <div key={q.id} style={{ background: '#fff', border: `1px solid ${corrige ? (bonne ? '#BFE6CF' : '#F3C6BC') : '#F0E7D6'}`, borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {qi + 1}. {q.enonce} {corrige && <span style={{ fontSize: 13 }}>{bonne ? '✅' : '❌'}</span>}
                </div>
                {multi && <div style={{ fontSize: 12, color: corrige ? '#9A8D72' : '#0F6E56', fontWeight: 600, marginBottom: 8 }}>☑ Plusieurs réponses possibles</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                  {q.options.map((o, oi) => {
                    const sel = choisi.has(oi)
                    let bg = '#FFFBF2', bd = '#EADFC9'
                    if (corrige) {
                      if (o.c) { bg = '#ECF7F0'; bd = '#BFE6CF' }
                      else if (sel) { bg = '#FCEEEA'; bd = '#F3C6BC' }
                    } else if (sel) { bg = '#FCEFD3'; bd = '#E8A11E' }
                    return (
                      <button key={oi} onClick={() => toggle(q.id, oi, multi)} disabled={corrige} style={{
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: corrige ? 'default' : 'pointer',
                        border: `1.5px solid ${bd}`, background: bg, borderRadius: 11, padding: '10px 13px', fontSize: 14, fontFamily: font, color: '#2A2018',
                      }}>
                        <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: multi ? 5 : '50%', border: `2px solid ${sel || (corrige && o.c) ? '#2DAE83' : '#C0B7A4'}`, background: (sel || (corrige && o.c)) ? '#2DAE83' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>{(sel || (corrige && o.c)) ? '✓' : ''}</span>
                        <span style={{ flex: 1 }}>{o.t}</span>
                      </button>
                    )
                  })}
                </div>
                {corrige && q.explication && <div style={{ fontSize: 13, color: '#6E6456', marginTop: 10, background: '#FFFBF2', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>💡 {q.explication}</div>}
              </div>
            )
          })}
        </div>

        {!corrige ? (
          <button onClick={valider} disabled={Object.keys(reponses).length < questions.length} style={{ marginTop: 18, height: 50, width: '100%', border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: Object.keys(reponses).length < questions.length ? 0.6 : 1, fontFamily: font }}>
            Valider mes réponses
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={recommencer} style={{ flex: 1, height: 48, border: '1.5px solid #EADFC9', borderRadius: 12, background: '#fff', color: '#6E6456', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>Recommencer</button>
            <button onClick={retour} style={{ flex: 1, height: 48, border: 'none', borderRadius: 12, background: '#DC4A2B', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>Autres QCM</button>
          </div>
        )}
      </div>
    )
  }

  // ---------- Vue : liste ----------
  return (
    <div style={{ paddingTop: 34, maxWidth: 820, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>QCM</h1>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 20px' }}>Entraîne-toi avec des QCM auto-corrigés. Chaque QCM terminé compte dans ton activité.</p>

      {nbErreurs > 0 && (
        <button onClick={jouerErreurs} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, background: '#FCE9E3', border: '1px solid #F3C6BC', borderRadius: 14, padding: '14px 18px', marginBottom: 18, cursor: 'pointer', fontFamily: font }}>
          <span style={{ fontSize: 26 }}>🎯</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#C0392B' }}>Réviser mes erreurs</div>
            <div style={{ fontSize: 12.5, color: '#8A7E68' }}>{nbErreurs} question{nbErreurs > 1 ? 's' : ''} ratée{nbErreurs > 1 ? 's' : ''} à revoir, tous QCM confondus.</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#C0392B' }}>Commencer →</span>
        </button>
      )}

      {matieres.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFiltre('')} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: font, background: filtre === '' ? '#DC4A2B' : '#fff', color: filtre === '' ? '#fff' : '#8A7E68', border: `1px solid ${filtre === '' ? '#DC4A2B' : '#F0E7D6'}` }}>Tous</button>
          {matieres.map(m => <button key={m} onClick={() => setFiltre(m)} style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: font, background: filtre === m ? '#DC4A2B' : '#fff', color: filtre === m ? '#fff' : '#8A7E68', border: `1px solid ${filtre === m ? '#DC4A2B' : '#F0E7D6'}` }}>{m}</button>)}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>Aucun QCM disponible pour l&apos;instant.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {visibles.map(q => (
            <button key={q.id} onClick={() => jouer(q)} style={{ textAlign: 'left', background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 18, cursor: 'pointer', fontFamily: font }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FCEFD3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2A2018' }}>{q.titre}</div>
              {q.matiere && <div style={{ fontSize: 12.5, color: '#9A8D72', marginTop: 3 }}>{q.matiere}</div>}
              <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: '#E8A11E' }}>Commencer →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
