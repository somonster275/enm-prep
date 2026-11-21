'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { enregistrerActivite } from '@/lib/streaks'
import { reponseCorrecte } from '@/lib/qcm-parse'
import { melange } from '@/lib/aleatoire'
import TelechargerPerso from '@/components/TelechargerPerso'
import { rafraichir } from '@/lib/hors-ligne'

type Qcm = { id: string; titre: string; matiere: string | null; type?: string }
type Question = {
  id: string; qcm_id: string; enonce: string; options: { t: string; c: boolean }[]; explication: string | null; ordre: number
  cas?: string | null; reponses_ok?: string[] | null; reponse_affichee?: string | null
}

export default function QcmPage() {
  const [uid, setUid] = useState('')
  const [qcms, setQcms] = useState<Qcm[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('')
  const [nbErreurs, setNbErreurs] = useState(0)
  const router = useRouter()
  const [perso, setPerso] = useState<string | null>(null) // id d'une copie « Mon espace » jouée (?perso=)

  const [actif, setActif] = useState<Qcm | null>(null)
  const [modeErreurs, setModeErreurs] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [reponses, setReponses] = useState<Record<string, Set<number>>>({})
  const [saisies, setSaisies] = useState<Record<string, string>>({}) // réponses libres tapées
  // Correction QUESTION PAR QUESTION : ensemble des ids déjà validés. L'étudiant voit
  // la correction immédiatement après chaque question (feedback immédiat = effet de test).
  const [valides, setValides] = useState<Set<string>>(new Set())

  const chargerErreurs = async (userId: string) => {
    const { count } = await supabase.from('qcm_reponses')
      .select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('juste', false)
    setNbErreurs(count || 0)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id || ''
      if (id) setUid(id) // hors ligne getUser échoue : ne pas effacer l'uid lu dans la copie locale
      if (id) chargerErreurs(id)
    })
    supabase.from('qcm').select('id, titre, matiere, type').order('created_at', { ascending: false })
      .then(({ data }) => { setQcms((data || []) as Qcm[]); setLoading(false) })
  }, [])

  const jouer = async (q: Qcm) => {
    const { data } = await supabase.from('qcm_questions').select('*').eq('qcm_id', q.id).order('ordre')
    setQuestions((data || []) as Question[]); setReponses({}); setSaisies({}); setValides(new Set()); setModeErreurs(false); setActif(q)
    window.scrollTo({ top: 0 })
  }

  // Mode « réviser mes erreurs » : rejoue les questions déjà ratées (tous QCM confondus).
  const jouerErreurs = async () => {
    if (!uid) return
    const { data: rep } = await supabase.from('qcm_reponses').select('question_id').eq('user_id', uid).eq('juste', false)
    const ids = (rep || []).map((r: { question_id: string }) => r.question_id)
    if (ids.length === 0) return
    const { data } = await supabase.from('qcm_questions').select('*').in('id', ids)
    const melangees = melange((data || []) as Question[])
    setQuestions(melangees); setReponses({}); setSaisies({}); setValides(new Set()); setActif(null); setModeErreurs(true)
    window.scrollTo({ top: 0 })
  }

  // Lien profond : /qcm?id=<qcmId> ouvre directement ce QCM (utilisé par « Approfondir »).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('perso')
    if (pid) {
      // Copie perso : lue dans la copie locale (marche hors ligne) ; rien n'est écrit dans les tables officielles.
      rafraichir().then(s => {
        const pm = s?.modules.find(m => m.id === pid)
        if (!s || !pm) return
        setUid(s.uid)
        const els = s.elements.filter(e => e.perso_module_id === pid && e.type === 'qcm_question' && !e.supprime)
          .sort((a, b) => a.ordre - b.ordre || a.created_at.localeCompare(b.created_at))
        setQuestions(els.map(e => ({ ...e.contenu, id: e.id, qcm_id: pid, ordre: e.ordre }) as Question))
        setReponses({}); setSaisies({}); setValides(new Set()); setPerso(pid); setActif({ id: pid, titre: pm.nom, matiere: null })
      })
      return
    }
    const id = params.get('id')
    if (!id) return
    supabase.from('qcm').select('id, titre, matiere, type').eq('id', id).maybeSingle()
      .then(({ data }) => { if (data) jouer(data as Qcm) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (qid: string, oi: number, multi: boolean) => {
    if (valides.has(qid)) return
    setReponses(r => {
      const cur = new Set(r[qid] || [])
      if (multi) { cur.has(oi) ? cur.delete(oi) : cur.add(oi) }
      else { cur.clear(); cur.add(oi) }
      return { ...r, [qid]: cur }
    })
  }

  const estBonne = (q: Question) => {
    // Réponse libre : on compare la saisie aux réponses acceptées.
    if (Array.isArray(q.reponses_ok)) return reponseCorrecte(saisies[q.id] || '', q.reponses_ok)
    const choisi = reponses[q.id] || new Set<number>()
    const bonnes = new Set(q.options.map((o, i) => o.c ? i : -1).filter(i => i >= 0))
    if (choisi.size !== bonnes.size) return false
    for (const i of choisi) if (!bonnes.has(i)) return false
    return true
  }
  const score = questions.filter(estBonne).length
  const nbValides = questions.filter(q => valides.has(q.id)).length
  const tousValides = questions.length > 0 && nbValides === questions.length

  // Une question est-elle répondue (donc validable) ?
  const aRepondu = (q: Question) => Array.isArray(q.reponses_ok)
    ? (saisies[q.id] || '').trim().length > 0
    : (reponses[q.id]?.size || 0) > 0

  // Finalisation quand toutes les questions sont validées : score global + activité.
  const finaliser = async () => {
    if (!uid) return
    if (actif && !perso) await supabase.from('qcm_resultats').insert({ user_id: uid, qcm_id: actif.id, score, total: questions.length })
    enregistrerActivite(uid) // compte dans l'activité / la série
    chargerErreurs(uid)
    window.scrollTo({ top: 0 })
  }

  // Valide UNE question : fige sa réponse, révèle la correction, enregistre le résultat.
  const validerQuestion = async (q: Question) => {
    if (valides.has(q.id) || !aRepondu(q)) return
    const next = new Set(valides); next.add(q.id)
    setValides(next)
    if (uid && !perso) {
      const { error } = await supabase.from('qcm_reponses').upsert(
        [{ user_id: uid, question_id: q.id, qcm_id: q.qcm_id, juste: estBonne(q) }],
        { onConflict: 'user_id,question_id' }
      )
      if (error) console.error('Réponse QCM non enregistrée (carnet d\'erreurs) :', error.message)
    }
    // Dernière question validée → finalisation (une seule fois).
    if (questions.every(x => next.has(x.id))) await finaliser()
  }

  const font = "var(--font-texte)"
  const matieres = [...new Set(qcms.map(q => q.matiere).filter(Boolean))] as string[]
  const visibles = filtre ? qcms.filter(q => q.matiere === filtre) : qcms
  const retour = () => { if (perso) { router.push(`/mon-espace/${perso}`); return } setActif(null); setModeErreurs(false) }
  const recommencer = () => { setReponses({}); setSaisies({}); setValides(new Set()); window.scrollTo({ top: 0 }) }

  // Bouton « Valider » d'une question (réutilisé pour libre et choix multiples).
  const boutonValider = (q: Question) => (
    <button onClick={() => validerQuestion(q)} disabled={!aRepondu(q)} style={{
      marginTop: 12, height: 42, width: '100%', border: 'none', borderRadius: 6,
      background: 'var(--c-accent)', color: '#fff', fontSize: 14, fontWeight: 700,
      cursor: aRepondu(q) ? 'pointer' : 'default', opacity: aRepondu(q) ? 1 : 0.5, fontFamily: font,
    }}>Valider</button>
  )

  // ---------- Vue : jeu / résultat ----------
  if (actif || modeErreurs) {
    return (
      <div style={{ paddingTop: 34, maxWidth: 720, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
        <button onClick={retour} style={{ background: 'none', border: 'none', color: 'var(--c-annotation-clair)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12 }}>{perso ? '← Mon espace' : '← Tous les QCM'}</button>
        <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 24, margin: '0 0 4px' }}>{actif ? actif.titre : 'Mes erreurs'}</h1>
        {actif?.matiere && <div style={{ fontSize: 13, color: 'var(--c-annotation)', marginBottom: 16 }}>{actif.matiere}</div>}
        {actif && !perso && <div style={{ marginBottom: 16 }}><TelechargerPerso type="qcm" id={actif.id} /></div>}
        {modeErreurs && <div style={{ fontSize: 13, color: 'var(--c-annotation)', marginBottom: 16 }}>Rejoue les questions que tu as déjà ratées. Une bonne réponse les retire de ta liste.</div>}

        {tousValides && (
          <div style={{ background: score === questions.length ? '#ECF7F0' : 'var(--c-papier-chaud)', border: `1px solid ${score === questions.length ? '#BFE6CF' : '#F2D9A0'}`, borderRadius: 6, padding: 18, marginBottom: 18, textAlign: 'center' }}>
            <div style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 28 }}>{score} / {questions.length}</div>
            <div style={{ fontSize: 14, color: 'var(--c-texte-doux)', marginTop: 4 }}>{score === questions.length ? 'Sans faute.' : 'Revois les explications ci-dessous.'}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {questions.map((q, qi) => {
            const v = valides.has(q.id)
            const bonne = estBonne(q)
            // ----- Question à réponse libre -----
            if (Array.isArray(q.reponses_ok)) {
              return (
                <div key={q.id} style={{ background: '#FFFEFB', border: `1px solid ${v ? (bonne ? '#BFE6CF' : 'var(--c-accent-bord)') : 'var(--c-filet)'}`, borderRadius: 6, padding: 18 }}>
                  {q.cas && <div style={{ fontSize: 13.5, color: 'var(--c-texte-doux)', marginBottom: 10, background: 'var(--c-papier)', borderRadius: 6, padding: '10px 12px', lineHeight: 1.5, borderLeft: '3px solid var(--c-filet-fort)' }}>{q.cas}</div>}
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
                    {qi + 1}. {q.enonce} {v && <span style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 6, color: bonne ? '#0F6E56' : 'var(--c-accent)' }}>{bonne ? 'Juste' : 'Faux'}</span>}
                  </div>
                  <input
                    value={saisies[q.id] || ''}
                    onChange={e => { if (!v) setSaisies(s => ({ ...s, [q.id]: e.target.value })) }}
                    onKeyDown={e => { if (e.key === 'Enter') validerQuestion(q) }}
                    disabled={v}
                    placeholder="Tape ta réponse…"
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '11px 14px', fontSize: 14, fontFamily: font,
                      borderRadius: 6, outline: 'none',
                      border: `1.5px solid ${v ? (bonne ? '#BFE6CF' : 'var(--c-accent-bord)') : 'var(--c-filet-fort)'}`,
                      background: v ? (bonne ? '#ECF7F0' : '#FCEEEA') : 'var(--c-papier)', color: 'var(--c-encre)',
                    }} />
                  {v && (
                    <div style={{ marginTop: 10, fontSize: 13.5, color: '#0E5A47', background: '#ECF7F0', border: '1px solid #BFE6CF', borderRadius: 6, padding: '9px 12px', lineHeight: 1.5 }}>
                      <b>Réponse :</b> {q.reponse_affichee || q.reponses_ok[0]}
                    </div>
                  )}
                  {v && q.explication && <div style={{ fontSize: 13, color: 'var(--c-texte-doux)', marginTop: 8, background: 'var(--c-papier)', borderRadius: 6, padding: '8px 12px', lineHeight: 1.5 }}><b style={{ fontWeight: 600, color: 'var(--c-encre)' }}>Explication.</b> {q.explication}</div>}
                  {!v && boutonValider(q)}
                </div>
              )
            }
            // ----- Question à choix multiples -----
            const multi = q.options.filter(o => o.c).length > 1
            const choisi = reponses[q.id] || new Set<number>()
            return (
              <div key={q.id} style={{ background: '#FFFEFB', border: `1px solid ${v ? (bonne ? '#BFE6CF' : 'var(--c-accent-bord)') : 'var(--c-filet)'}`, borderRadius: 6, padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {qi + 1}. {q.enonce} {v && <span style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 6, color: bonne ? '#0F6E56' : 'var(--c-accent)' }}>{bonne ? 'Juste' : 'Faux'}</span>}
                </div>
                {multi && <div style={{ fontSize: 12, color: v ? 'var(--c-annotation-clair)' : '#0F6E56', fontWeight: 600, marginBottom: 8 }}>Plusieurs réponses possibles</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                  {q.options.map((o, oi) => {
                    const sel = choisi.has(oi)
                    let bg = 'var(--c-papier)', bd = 'var(--c-filet-fort)'
                    if (v) {
                      if (o.c) { bg = '#ECF7F0'; bd = '#BFE6CF' }
                      else if (sel) { bg = '#FCEEEA'; bd = 'var(--c-accent-bord)' }
                    } else if (sel) { bg = '#FCEFD3'; bd = '#E8A11E' }
                    return (
                      <button key={oi} onClick={() => toggle(q.id, oi, multi)} disabled={v} style={{
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: v ? 'default' : 'pointer',
                        border: `1.5px solid ${bd}`, background: bg, borderRadius: 6, padding: '10px 13px', fontSize: 14, fontFamily: font, color: 'var(--c-encre)',
                      }}>
                        <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: multi ? 5 : '50%', border: `2px solid ${sel || (v && o.c) ? '#2DAE83' : 'var(--c-discret-clair)'}`, background: (sel || (v && o.c)) ? '#2DAE83' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>{(sel || (v && o.c)) ? '✓' : ''}</span>
                        <span style={{ flex: 1 }}>{o.t}</span>
                      </button>
                    )
                  })}
                </div>
                {v && q.explication && <div style={{ fontSize: 13, color: 'var(--c-texte-doux)', marginTop: 10, background: 'var(--c-papier)', borderRadius: 6, padding: '8px 12px', lineHeight: 1.5 }}><b style={{ fontWeight: 600, color: 'var(--c-encre)' }}>Explication.</b> {q.explication}</div>}
                {!v && boutonValider(q)}
              </div>
            )
          })}
        </div>

        {tousValides ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={recommencer} style={{ flex: 1, height: 48, border: '1.5px solid var(--c-filet-fort)', borderRadius: 6, background: '#FFFEFB', color: 'var(--c-texte-doux)', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>Recommencer</button>
            <button onClick={retour} style={{ flex: 1, height: 48, border: 'none', borderRadius: 6, background: 'var(--c-accent)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>{perso ? 'Mon espace' : 'Autres QCM'}</button>
          </div>
        ) : (
          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: 'var(--c-annotation-clair)' }}>
            {nbValides} / {questions.length} validée{nbValides > 1 ? 's' : ''} — valide chaque question pour voir la correction tout de suite.
          </div>
        )}
      </div>
    )
  }

  // ---------- Vue : liste ----------
  return (
    <div style={{ paddingTop: 34, maxWidth: 820, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 28, margin: 0 }}>QCM</h1>
      <p style={{ fontSize: 15, color: 'var(--c-annotation)', margin: '8px 0 20px' }}>Entraîne-toi avec des QCM auto-corrigés. Chaque QCM terminé compte dans ton activité.</p>

      {nbErreurs > 0 && (
        <button onClick={jouerErreurs} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, background: '#FFFEFB', border: '1px solid var(--c-filet)', borderTop: '3px solid var(--c-accent)', borderRadius: 6, padding: '14px 18px', marginBottom: 18, cursor: 'pointer', fontFamily: font }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-titre)', fontSize: 19, fontWeight: 600, color: 'var(--c-encre)' }}>Réviser mes erreurs</div>
            <div style={{ fontSize: 12.5, color: 'var(--c-annotation)' }}>{nbErreurs} question{nbErreurs > 1 ? 's' : ''} ratée{nbErreurs > 1 ? 's' : ''} à revoir, tous QCM confondus.</div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-accent)' }}>Commencer</span>
        </button>
      )}

      {matieres.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setFiltre('')} style={{ padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: font, background: filtre === '' ? 'var(--c-encre)' : 'transparent', color: filtre === '' ? 'var(--c-papier)' : 'var(--c-annotation)', border: `1px solid ${filtre === '' ? 'var(--c-accent)' : 'var(--c-filet)'}` }}>Tous</button>
          {matieres.map(m => <button key={m} onClick={() => setFiltre(m)} style={{ padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: font, background: filtre === m ? 'var(--c-encre)' : 'transparent', color: filtre === m ? 'var(--c-papier)' : 'var(--c-annotation)', border: `1px solid ${filtre === m ? 'var(--c-accent)' : 'var(--c-filet)'}` }}>{m}</button>)}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--c-annotation-clair)', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-annotation-clair)', background: 'var(--c-papier)', border: '1px dashed var(--c-filet-fort)', borderRadius: 6 }}>
          Aucun QCM disponible pour l&apos;instant.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {visibles.map(q => (
            <button key={q.id} onClick={() => jouer(q)} style={{ textAlign: 'left', background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: 18, cursor: 'pointer', fontFamily: font }}>
              <div style={{ fontFamily: 'var(--font-titre)', fontSize: 19, fontWeight: 600, color: 'var(--c-encre)', lineHeight: 1.25 }}>{q.titre}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                {q.matiere && <span style={{ fontSize: 12.5, color: 'var(--c-annotation-clair)' }}>{q.matiere}</span>}
                {q.type === 'libre' && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-annotation)', border: '1px solid var(--c-filet-fort)', borderRadius: 4, padding: '0 6px' }}>Réponse libre</span>}
              </div>
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--c-accent)' }}>Commencer</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
