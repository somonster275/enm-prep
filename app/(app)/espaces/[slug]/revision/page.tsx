'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useSearchParams } from 'next/navigation'
import type { Fiche, Progression, Espace, Module } from '@/types'
import { NIVEAUX, PALIER_MAX, prochaineRevision, intervalleMinutes, palierApres, formatIntervalle, estDue } from '@/lib/spaced-repetition'
import Link from 'next/link'
import RichContent from '@/components/RichContent'
import RichEditor from '@/components/RichEditor'
import RemarqueButton from '@/components/RemarqueButton'
import { enregistrerActivite, chargerActivite, calculerStreak } from '@/lib/streaks'

// Récupère récursivement tous les IDs de modules enfants d'un module
async function getAllModuleIds(rootId: string): Promise<string[]> {
  const ids: string[] = [rootId]
  const { data: children } = await supabase.from('modules').select('id').eq('parent_id', rootId).is('deleted_at', null)
  for (const child of children || []) {
    const nested = await getAllModuleIds(child.id)
    ids.push(...nested)
  }
  return ids
}

export default function RevisionPage() {
  const { slug } = useParams()
  const searchParams = useSearchParams()
  const modeAlea = searchParams.get('mode') === 'tout'
  const moduleFilter = searchParams.get('module') // null = tout l'espace

  const [espace, setEspace] = useState<Espace | null>(null)
  const [moduleLabel, setModuleLabel] = useState<string | null>(null)
  const [deck, setDeck] = useState<Fiche[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [progressions, setProgressions] = useState<Record<string, Progression>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [streak, setStreak] = useState<number | null>(null)

  // Mode édition de la carte en cours
  const [editing, setEditing] = useState(false)
  const [editQ, setEditQ] = useState('')
  const [editR, setEditR] = useState('')

  // Brouillon libre : l'étudiant rédige sa réponse avant de retourner la carte.
  const [brouillon, setBrouillon] = useState('')
  // Repart à vide à chaque changement de carte.
  useEffect(() => { setBrouillon('') }, [idx])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: prof } = await supabase.from('profils').select('role').eq('id', user.id).single()
      setIsAdmin(prof?.role === 'admin' || prof?.role === 'editeur')

      const { data: esp } = await supabase.from('espaces').select('*').eq('slug', slug).single()
      if (!esp) return
      setEspace(esp)

      let modIds: string[]

      if (moduleFilter) {
        // Révision d'un module spécifique (+ ses sous-modules)
        const { data: mod } = await supabase.from('modules').select('nom').eq('id', moduleFilter).single()
        setModuleLabel(mod?.nom ?? null)
        modIds = await getAllModuleIds(moduleFilter)
      } else {
        // Révision de tout l'espace
        const { data: mods } = await supabase.from('modules').select('id').eq('espace_id', esp.id).is('deleted_at', null)
        modIds = (mods || []).map((m: { id: string }) => m.id)
      }

      if (modIds.length === 0) { setLoaded(true); return }

      const { data: fich } = await supabase.from('fiches').select('*').in('module_id', modIds).is('deleted_at', null)
      const fichList = fich || []

      const { data: prog } = await supabase.from('progression').select('*')
        .eq('utilisateur_id', user.id)
        .in('fiche_id', fichList.map((f: Fiche) => f.id))
      const progMap: Record<string, Progression> = {}
      ;(prog || []).forEach((p: Progression) => { progMap[p.fiche_id] = p })
      setProgressions(progMap)

      let d = modeAlea
        ? [...fichList].sort(() => Math.random() - 0.5)
        : fichList.filter((f: Fiche) => { const p = progMap[f.id]; return !p || estDue(p.prochaine_revision) }).sort(() => Math.random() - 0.5)
      if (d.length === 0) d = [...fichList].sort(() => Math.random() - 0.5)
      setDeck(d)
      setLoaded(true)
    }
    load()
  }, [slug, modeAlea, moduleFilter])

  // En dessous de ce seuil, la carte revient dans la session en cours (1 min, 15 min…).
  const SEUIL_REQUEUE = 30 // minutes

  const rateCard = async (bouton: number) => {
    if (!userId || !deck[idx]) return
    const fiche = deck[idx]
    const palierActuel = progressions[fiche.id]?.palier ?? 0
    const minutes = intervalleMinutes(bouton, palierActuel)
    const nouveauPalier = palierApres(bouton, palierActuel)
    const nextRev = prochaineRevision(bouton, palierActuel)
    const prog = {
      utilisateur_id: userId,
      fiche_id: fiche.id,
      niveau: bouton,
      palier: nouveauPalier,
      prochaine_revision: nextRev.toISOString(),
      derniere_revision: new Date().toISOString()
    }
    await supabase.from('progression').upsert(prog, { onConflict: 'utilisateur_id,fiche_id' })
    enregistrerActivite(userId) // alimente la série / le momentum
    setProgressions(prev => ({ ...prev, [fiche.id]: prog as Progression }))

    // Intervalle court → la carte est remise en fin de session pour être revue tout de suite.
    const requeue = minutes < SEUIL_REQUEUE
    if (requeue) setDeck(d => [...d, fiche])
    setFlipped(false)
    if (idx + 1 < deck.length + (requeue ? 1 : 0)) setIdx(i => i + 1)
    else setDone(true)
  }

  const ouvrirEdition = () => {
    const c = deck[idx]
    if (!c) return
    setEditQ(c.question)
    setEditR(c.reponse)
    setEditing(true)
  }

  const sauvegarderEdition = async () => {
    const c = deck[idx]
    if (!c) return
    const { error } = await supabase.from('fiches').update({ question: editQ, reponse: editR }).eq('id', c.id)
    if (error) return
    setDeck(d => d.map((f, i) => i === idx ? { ...f, question: editQ, reponse: editR } : f))
    setEditing(false)
  }

  // À la fin de la session, recalcule la série pour l'afficher
  useEffect(() => {
    if (done && userId) {
      chargerActivite(userId).then(a => setStreak(calculerStreak(a)))
    }
  }, [done, userId])

  const retourHref = moduleFilter
    ? `/espaces/${slug}/modules/${moduleFilter}`
    : `/espaces/${slug}`

  const font = "'Hanken Grotesk', sans-serif"

  if (!loaded || !espace) return (
    <div style={{ padding: '2rem', color: '#9A8D72', textAlign: 'center', fontFamily: font }}>Chargement…</div>
  )

  if (loaded && deck.length === 0) return (
    <div style={{ padding: '3rem', textAlign: 'center', maxWidth: 480, margin: '0 auto', fontFamily: font }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>Aucune fiche à réviser</h2>
      <p style={{ fontSize: 14, color: '#8A7E68', margin: '0 0 2rem' }}>
        {moduleFilter ? 'Ce module ne contient pas encore de fiches.' : 'Cet espace ne contient pas encore de fiches.'}
      </p>
      <Link href={retourHref} style={{
        padding: '12px 24px', borderRadius: 12, background: '#DC4A2B', color: '#fff',
        textDecoration: 'none', fontSize: 14, fontWeight: 700, fontFamily: font,
      }}>Retour</Link>
    </div>
  )

  if (done) return (
    <div style={{ padding: '3rem', textAlign: 'center', maxWidth: 500, margin: '0 auto', fontFamily: font }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26, marginBottom: 8 }}>Session terminée</div>
      <p style={{ fontSize: 14, color: '#8A7E68', margin: '0 0 1.25rem' }}>{deck.length} fiches révisées</p>
      {streak !== null && streak > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, margin: '0 0 2rem',
          fontWeight: 700, fontSize: 15, color: '#D94A30', background: '#FCE9E3',
          padding: '10px 18px', borderRadius: 999,
        }}>
          🔥 {streak} jour{streak > 1 ? 's' : ''} d'affilée
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => { setIdx(0); setFlipped(false); setDone(false) }} style={{
          padding: '12px 22px', borderRadius: 10, background: espace.couleur, color: '#fff',
          border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: font,
        }}>Recommencer</button>
        <Link href={retourHref} style={{
          padding: '12px 22px', borderRadius: 10, background: '#FDF6EA', color: '#8A7E68',
          textDecoration: 'none', fontSize: 14, fontFamily: font, border: '1px solid #EADFC9',
        }}>Retour</Link>
      </div>
    </div>
  )

  const card = deck[idx]
  const prog = progressions[card.id]

  return (
    <div style={{ paddingTop: '34px', maxWidth: 640, margin: '0 auto', fontFamily: font }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Link href={retourHref} style={{ fontSize: 13, color: '#9A8D72', textDecoration: 'none' }}>← Retour</Link>
        <div style={{ textAlign: 'right' }}>
          {moduleLabel && <div style={{ fontSize: 11, color: '#9A8D72', marginBottom: 2 }}>{moduleLabel}</div>}
          <span style={{ fontSize: 13, color: '#8A7E68', fontWeight: 600 }}>{idx + 1} / {deck.length}</span>
        </div>
      </div>

      <div style={{ height: 6, background: '#F0E7D6', borderRadius: 999, marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((idx + 1) / deck.length) * 100}%`, background: espace.couleur, borderRadius: 999, transition: 'width 0.3s' }} />
      </div>

      {prog && (
        <div style={{ marginBottom: 8, textAlign: 'right', fontSize: 11, color: '#999' }}>
          Échelon <span style={{ color: espace.couleur, fontWeight: 700 }}>{Math.min(prog.palier ?? 0, PALIER_MAX)}/{PALIER_MAX}</span>
        </div>
      )}

      {editing ? (
        /* ===== MODE ÉDITION ===== */
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, color: '#9A8D72', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Question</div>
          <div style={{ marginBottom: 18 }}>
            <RichEditor value={editQ} onChange={setEditQ} placeholder="Question…" minHeight={80} />
          </div>
          <div style={{ fontSize: 11, color: '#9A8D72', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Réponse</div>
          <div style={{ marginBottom: 18 }}>
            <RichEditor value={editR} onChange={setEditR} placeholder="Réponse…" minHeight={140} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={sauvegarderEdition} style={{
              padding: '11px 22px', borderRadius: 10, background: '#DC4A2B', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: font,
            }}>Enregistrer</button>
            <button onClick={() => setEditing(false)} style={{
              padding: '11px 16px', borderRadius: 10, background: '#FDF6EA', color: '#8A7E68',
              border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 14, fontFamily: font,
            }}>Annuler</button>
          </div>
        </div>
      ) : (
        <div onClick={() => setFlipped(f => !f)} style={{
          background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18,
          padding: '2rem', minHeight: 240, cursor: 'pointer', marginBottom: '1rem',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative',
        }}>
          {isAdmin ? (
            <button onClick={e => { e.stopPropagation(); ouvrirEdition() }} style={{
              position: 'absolute', top: 14, right: 14, padding: '6px 12px', borderRadius: 8,
              background: '#FDF6EA', color: '#8A7E68', border: '1px solid #EADFC9',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
            }}>✎ Éditer</button>
          ) : (
            <div style={{ position: 'absolute', top: 14, right: 14 }}>
              <RemarqueButton ficheId={card.id} />
            </div>
          )}
          {!flipped ? (
            <>
              <div style={{ fontSize: 11, color: '#9A8D72', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Question — cliquez pour voir la réponse</div>
              <RichContent html={card.question} style={{ fontSize: 16, lineHeight: 1.7, color: '#2A2018' }} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: '#9A8D72', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Réponse</div>
              <RichContent html={card.reponse} style={{ fontSize: 15, lineHeight: 1.8, color: '#2A2018' }} />
            </>
          )}
        </div>
      )}

      {/* Brouillon libre — pour rédiger sa réponse puis la comparer */}
      {!editing && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, color: '#9A8D72', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
            ✏️ Brouillon
            {flipped && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#B6A98C' }}>— compare avec la réponse ci-dessus</span>}
          </div>
          <textarea
            value={brouillon}
            onChange={e => setBrouillon(e.target.value)}
            placeholder="Écris ta réponse ici avant de retourner la carte, puis compare…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', border: '1px dashed #E3D6BE', borderRadius: 12,
              background: '#FFFDF8', padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, color: '#5C5448',
              fontFamily: font, outline: 'none', resize: 'vertical',
            }}
          />
        </div>
      )}

      {editing ? null : flipped ? (
        <div>
          <div style={{ fontSize: 13, color: '#8A7E68', marginBottom: 12, textAlign: 'center' }}>Comment évaluez-vous votre réponse ?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {NIVEAUX.map((n, i) => {
              const palierCarte = prog?.palier ?? 0
              const mins = intervalleMinutes(i, palierCarte)
              return (
                <button key={n.label} onClick={() => rateCard(i)} style={{
                  padding: '12px 4px', borderRadius: 12, border: `1px solid ${n.couleur}33`,
                  background: n.bg, color: n.couleur, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  lineHeight: 1.3, fontFamily: font,
                }}>
                  {n.label}
                  <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 3 }}>
                    {formatIntervalle(mins)}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <button onClick={() => setFlipped(true)} style={{
          width: '100%', padding: '14px', borderRadius: 12, background: espace.couleur,
          color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: font,
        }}>
          Voir la réponse
        </button>
      )}
    </div>
  )
}
