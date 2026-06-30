'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace } from '@/types'
import TagsInput from '@/components/TagsInput'
import TagsEditeur from '@/components/TagsEditeur'

type Media = {
  id: string
  espace_id: string
  titre: string
  url: string | null
  type: string | null
  description: string | null
  tags?: string[]
  espaces: { nom: string; slug: string; couleur: string } | null
}

const FONT = "'Hanken Grotesk', sans-serif"
const DISPLAY = "'Bricolage Grotesque', sans-serif"
const ACCENT = '#3B82D9'

// Extrait l'identifiant d'une vidéo YouTube depuis les formats d'URL courants.
function youtubeId(url: string): string | null {
  const pats = [
    /youtu\.be\/([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ]
  for (const p of pats) { const m = url.match(p); if (m) return m[1] }
  try {
    const u = new URL(url)
    const v = u.searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) return v
  } catch { /* URL invalide */ }
  return null
}

const estAudio = (url: string) => /\.(mp3|m4a|wav|ogg|aac)(\?|$)/i.test(url)

export default function MediaPage() {
  const [uid, setUid] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [items, setItems] = useState<Media[]>([])
  const [vues, setVues] = useState<Set<string>>(new Set())
  const [tableManquante, setTableManquante] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('')

  // Formulaire d'ajout (admin)
  const [titre, setTitre] = useState('')
  const [espaceId, setEspaceId] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [formOuvert, setFormOuvert] = useState(false)

  const afficherMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const charger = async () => {
    const { data, error } = await supabase
      .from('medias')
      .select('*, espaces(nom, slug, couleur)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) {
      const m = (error.message || '').toLowerCase()
      if (error.code === '42P01' || error.code === 'PGRST205' || m.includes('does not exist') || m.includes('find the table')) setTableManquante(true)
      setItems([])
    } else {
      setItems((data as Media[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUid(user.id)
      const { data: prof } = await supabase.from('profils').select('role').eq('id', user.id).single()
      setIsAdmin(prof?.role === 'admin' || prof?.role === 'editeur')
      const [{ data: esp }, { data: vu }] = await Promise.all([
        supabase.from('espaces').select('*').order('ordre'),
        supabase.from('media_vues').select('media_id').eq('user_id', user.id),
      ])
      setEspaces(esp || [])
      setVues(new Set((vu || []).map((v: { media_id: string }) => v.media_id)))
      await charger()
    }
    init()
  }, [])

  const toggleVu = async (mediaId: string) => {
    const dejaVu = vues.has(mediaId)
    setVues(s => { const n = new Set(s); dejaVu ? n.delete(mediaId) : n.add(mediaId); return n })
    if (dejaVu) await supabase.from('media_vues').delete().eq('user_id', uid).eq('media_id', mediaId)
    else await supabase.from('media_vues').upsert({ user_id: uid, media_id: mediaId }, { onConflict: 'user_id,media_id' })
  }

  const ajouter = async () => {
    if (!titre.trim() || !espaceId || !url.trim()) return
    setSaving(true)
    const yid = youtubeId(url.trim())
    const { error } = await supabase.from('medias').insert({
      titre: titre.trim(), espace_id: espaceId, url: url.trim(),
      type: yid ? 'video' : (estAudio(url.trim()) ? 'audio' : 'lien'),
      description: description.trim() || null, tags,
    })
    setSaving(false)
    if (error) { afficherMsg('❌ ' + error.message); return }
    setTitre(''); setUrl(''); setDescription(''); setTags([]); setFormOuvert(false)
    afficherMsg('✅ Ajouté')
    charger()
  }

  const supprimer = async (id: string) => {
    if (!confirm('Mettre à la corbeille ?')) return
    await supabase.from('medias').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setItems(it => it.filter(i => i.id !== id))
  }

  const matieres = [...new Set(items.map(i => i.espaces?.nom).filter(Boolean))] as string[]
  const visibles = filtre ? items.filter(i => i.espaces?.nom === filtre) : items

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 11, border: '1.5px solid #EADFC9',
    fontSize: 14, fontFamily: FONT, background: '#FFFBF2', outline: 'none',
  }

  return (
    <div style={{ paddingTop: 34, maxWidth: 860, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: ACCENT + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🎬</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28 }}>Audio & Vidéo</div>
        </div>
        {isAdmin && !tableManquante && !formOuvert && (
          <button onClick={() => setFormOuvert(true)} style={{ padding: '10px 18px', borderRadius: 11, background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: FONT }}>Ajouter une vidéo</button>
        )}
      </div>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 24px', maxWidth: 600 }}>
        Vidéos et podcasts à regarder directement ici, classés par matière. Les vidéos sont lues depuis YouTube (aucun fichier hébergé).
      </p>

      {tableManquante && (
        <div style={{ fontSize: 13, color: '#D94A30', background: '#FCE9E3', padding: '12px 16px', borderRadius: 10, marginBottom: 24 }}>
          La table <strong>medias</strong> n&apos;existe pas encore dans Supabase.
        </div>
      )}

      {/* Formulaire admin */}
      {isAdmin && formOuvert && !tableManquante && (
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 20, marginBottom: 26, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Ajouter une vidéo / un audio</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre de la vidéo…" style={{ ...inp, flex: '2 1 240px' }} />
            <select value={espaceId} onChange={e => setEspaceId(e.target.value)} style={{ ...inp, flex: '1 1 160px' }}>
              <option value="">Matière…</option>
              {espaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </div>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Lien YouTube (https://youtu.be/… ou …/watch?v=…)" style={inp} />
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Description pour l'étudiant (ce qu'il va apprendre, points clés…)" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4A22', marginBottom: 5 }}># Tags <span style={{ fontWeight: 400, color: '#9A8D72' }}>(relient cette ressource aux fiches du même thème)</span></div>
            <TagsInput value={tags} onChange={setTags} accent={ACCENT} />
          </div>
          <div style={{ fontSize: 12, color: '#9A8D72' }}>
            💡 Sur YouTube, mets la vidéo en <strong>« Non répertoriée »</strong> (pas « Privée » : une vidéo privée ne peut pas être lue ici). Seuls ceux qui ont le lien y accèdent.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={ajouter} disabled={!titre.trim() || !espaceId || !url.trim() || saving} style={{ height: 44, padding: '0 22px', borderRadius: 11, background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: FONT, opacity: (!titre.trim() || !espaceId || !url.trim() || saving) ? 0.5 : 1 }}>{saving ? 'Ajout…' : 'Ajouter'}</button>
            <button onClick={() => setFormOuvert(false)} style={{ height: 44, padding: '0 16px', borderRadius: 11, background: '#fff', color: '#6E6456', border: '1.5px solid #EADFC9', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: FONT }}>Annuler</button>
          </div>
          {msg && <div style={{ fontSize: 13, color: msg.startsWith('❌') ? '#D94A30' : '#0E7C63' }}>{msg}</div>}
        </div>
      )}
      {isAdmin && !formOuvert && msg && <div style={{ fontSize: 13, color: msg.startsWith('❌') ? '#D94A30' : '#0E7C63', marginBottom: 16 }}>{msg}</div>}

      {/* Filtre matière */}
      {matieres.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          <button onClick={() => setFiltre('')} style={chipStyle(filtre === '')}>Toutes</button>
          {matieres.map(m => <button key={m} onClick={() => setFiltre(m)} style={chipStyle(filtre === m)}>{m}</button>)}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9A8D72' }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9A8D72', fontSize: 14 }}>Aucun contenu pour le moment.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
          {visibles.map(it => {
            const yid = it.url ? youtubeId(it.url) : null
            const vu = vues.has(it.id)
            return (
              <div key={it.id} style={{ background: '#fff', border: `1px solid ${vu ? '#BFE6CF' : '#F0E7D6'}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Lecteur */}
                {yid ? (
                  <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${yid}`}
                      title={it.titre}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    />
                  </div>
                ) : it.url && estAudio(it.url) ? (
                  <div style={{ padding: '16px 16px 0' }}><audio controls src={it.url} style={{ width: '100%' }} /></div>
                ) : null}

                {/* Infos */}
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3 }}>{it.titre}</div>
                    {isAdmin && (
                      <button onClick={() => supprimer(it.id)} title="Supprimer" style={{ flexShrink: 0, border: 'none', background: '#FCE9E3', color: '#D94A30', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Suppr.</button>
                    )}
                  </div>
                  {it.espaces && (
                    <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 600, color: it.espaces.couleur, background: it.espaces.couleur + '1A', padding: '2px 9px', borderRadius: 999 }}>#{it.espaces.nom}</span>
                  )}
                  {it.description && <p style={{ fontSize: 13.5, color: '#6E6456', lineHeight: 1.55, margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{it.description}</p>}
                  <TagsEditeur table="medias" id={it.id} initial={it.tags} accent={ACCENT} canEdit={isAdmin} />
                  {!yid && it.url && !estAudio(it.url) && (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: 'none', marginTop: 2 }}>Ouvrir le lien →</a>
                  )}
                  <button onClick={() => toggleVu(it.id)} style={{
                    alignSelf: 'flex-start', marginTop: 6, padding: '5px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: FONT,
                    border: `1.5px solid ${vu ? '#2DAE83' : '#EADFC9'}`, background: vu ? '#ECF7F0' : '#fff', color: vu ? '#0F6E56' : '#9A8D72',
                  }}>{vu ? '✓ Vu' : 'Marquer comme vu'}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function chipStyle(actif: boolean): React.CSSProperties {
  return {
    padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: FONT,
    background: actif ? ACCENT : '#fff', color: actif ? '#fff' : '#8A7E68', border: `1px solid ${actif ? ACCENT : '#F0E7D6'}`,
  }
}
