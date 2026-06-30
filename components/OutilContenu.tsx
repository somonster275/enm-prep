'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace } from '@/types'
import TagsInput from '@/components/TagsInput'
import TagsEditeur from '@/components/TagsEditeur'

type Props = {
  table: string            // 'mindmaps' | 'medias' | 'qcm'
  accent: string
  icone: string
  titre: string
  description: string
  withType?: boolean       // média : audio / vidéo
  lienLabel?: string
  // Types de fichiers acceptés pour l'upload (ex: 'image/*,application/pdf')
  acceptFichier?: string
  bucketStorage?: string   // nom du bucket Supabase Storage
}

type Item = {
  id: string
  espace_id: string
  titre: string
  url: string | null
  type?: string | null
  tags?: string[]
  espaces: { nom: string; slug: string; couleur: string } | null
}

export default function OutilContenu({ table, accent, icone, titre, description, withType, lienLabel = 'Lien', acceptFichier, bucketStorage }: Props) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [tableManquante, setTableManquante] = useState(false)
  const [loading, setLoading] = useState(true)

  const [nom, setNom] = useState('')
  const [espaceId, setEspaceId] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState('audio')
  const [tags, setTags] = useState<string[]>([])
  const [fichier, setFichier] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"
  const afficherMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const charger = async () => {
    const { data, error } = await supabase
      .from(table)
      .select('*, espaces(nom, slug, couleur)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) {
      const m = (error.message || '').toLowerCase()
      if (error.code === '42P01' || error.code === 'PGRST205' || m.includes('does not exist') || m.includes('find the table')) {
        setTableManquante(true)
      }
      setItems([])
    } else {
      setItems((data as Item[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: prof } = await supabase.from('profils').select('role').eq('id', user.id).single()
      const admin = prof?.role === 'admin' || prof?.role === 'editeur'
      setIsAdmin(admin)
      if (admin && bucketStorage) {
        fetch('/api/storage/init', { method: 'POST' }).catch(() => {})
      }
      const { data: esp } = await supabase.from('espaces').select('*').order('ordre')
      setEspaces(esp || [])
      await charger()
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const uploadFichier = async (): Promise<string | null> => {
    if (!fichier || !bucketStorage) return null
    const form = new FormData()
    form.append('fichier', fichier)
    form.append('bucket', bucketStorage)
    const res = await fetch('/api/storage/upload', { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok || json.error) { afficherMsg('❌ Upload échoué : ' + (json.error ?? res.statusText)); return null }
    return json.url as string
  }

  const ajouter = async () => {
    if (!nom.trim() || !espaceId) return
    setUploading(true)
    let finalUrl = url.trim() || null
    if (fichier && bucketStorage) {
      finalUrl = await uploadFichier()
      if (!finalUrl && fichier) { setUploading(false); return }
    }
    const payload: Record<string, unknown> = { titre: nom.trim(), espace_id: espaceId, url: finalUrl, tags }
    if (withType) payload.type = type
    const { error } = await supabase.from(table).insert(payload)
    setUploading(false)
    if (error) { afficherMsg('❌ ' + error.message); return }
    setNom(''); setUrl(''); setTags([]); setFichier(null)
    if (fileRef.current) fileRef.current.value = ''
    afficherMsg('✅ Ajouté')
    charger()
  }

  const supprimer = async (id: string) => {
    if (!confirm('Mettre à la corbeille ?')) return
    await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setItems(it => it.filter(i => i.id !== id))
  }

  const inp: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 10, border: '1.5px solid #EADFC9',
    fontSize: 13, fontFamily: font, background: '#FFFBF2', outline: 'none', boxSizing: 'border-box',
  }

  const canAdd = nom.trim() && espaceId && !uploading

  return (
    <div style={{ paddingTop: '34px', maxWidth: 900, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{icone}</div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 28 }}>{titre}</div>
      </div>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '0 0 28px' }}>{description}</p>

      {tableManquante && (
        <div style={{ fontSize: 13, color: '#D94A30', background: '#FCE9E3', padding: '12px 16px', borderRadius: 10, marginBottom: 24 }}>
          La table <strong>{table}</strong> n'existe pas encore dans Supabase. Exécute le SQL fourni pour activer cet outil.
        </div>
      )}

      {isAdmin && !tableManquante && (
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 20, marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Ajouter un contenu</div>
          <div style={{ display: 'grid', gridTemplateColumns: withType ? '1.4fr 1fr 1fr' : '1.6fr 1fr', gap: 10, marginBottom: 10 }}>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Titre…" style={inp} />
            <select value={espaceId} onChange={e => setEspaceId(e.target.value)} style={inp}>
              <option value="">#  Matière…</option>
              {espaces.map(e => <option key={e.id} value={e.id}>#{e.nom}</option>)}
            </select>
            {withType && (
              <select value={type} onChange={e => setType(e.target.value)} style={inp}>
                <option value="audio">Audio</option>
                <option value="video">Vidéo</option>
              </select>
            )}
          </div>

          {/* URL ou fichier */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <input
              value={url}
              onChange={e => { setUrl(e.target.value); if (e.target.value) { setFichier(null); if (fileRef.current) fileRef.current.value = '' } }}
              placeholder={fichier ? '(fichier sélectionné)' : `${lienLabel} (optionnel)…`}
              disabled={!!fichier}
              style={{ ...inp, flex: 1, opacity: fichier ? 0.5 : 1 }}
            />
            {bucketStorage && (
              <>
                <span style={{ fontSize: 12, color: '#9A8D72', flexShrink: 0 }}>ou</span>
                <label style={{
                  padding: '10px 14px', borderRadius: 10, border: `1.5px dashed ${accent}66`,
                  fontSize: 12, fontWeight: 600, color: accent, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: fichier ? accent + '10' : '#FFFBF2', flexShrink: 0,
                }}>
                  {fichier ? `📎 ${fichier.name.length > 20 ? fichier.name.slice(0, 18) + '…' : fichier.name}` : 'Choisir un fichier'}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={acceptFichier}
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0] || null; setFichier(f); if (f) setUrl('') }}
                  />
                </label>
                {fichier && (
                  <button onClick={() => { setFichier(null); if (fileRef.current) fileRef.current.value = '' }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#D94A30', padding: '0 4px' }}>×</button>
                )}
              </>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4A22', marginBottom: 5 }}># Tags <span style={{ fontWeight: 400, color: '#9A8D72' }}>(relient ce contenu aux fiches du même thème)</span></div>
            <TagsInput value={tags} onChange={setTags} accent={accent} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={ajouter} disabled={!canAdd} style={{
              padding: '10px 22px', borderRadius: 10, background: accent, color: '#fff',
              border: 'none', cursor: canAdd ? 'pointer' : 'default', fontSize: 14, fontWeight: 700, fontFamily: font,
              opacity: canAdd ? 1 : 0.5,
            }}>
              {uploading ? 'Envoi en cours…' : 'Ajouter'}
            </button>
          </div>
          {msg && <div style={{ fontSize: 13, marginTop: 10, color: msg.startsWith('❌') ? '#D94A30' : '#0E7C63' }}>{msg}</div>}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9A8D72' }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9A8D72', fontSize: 14 }}>
          Aucun contenu pour le moment.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(it => (
            <div key={it.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {it.titre}
                  {withType && it.type && <span style={{ fontSize: 11, color: '#8A7E68', marginLeft: 8 }}>· {it.type}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {it.espaces && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: it.espaces.couleur, background: it.espaces.couleur + '1A', padding: '2px 8px', borderRadius: 999 }}>
                      #{it.espaces.nom}
                    </span>
                  )}
                  {it.url && <a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: accent, textDecoration: 'none', fontWeight: 600 }}>Ouvrir →</a>}
                </div>
                <TagsEditeur table={table} id={it.id} initial={it.tags} accent={accent} canEdit={isAdmin} />
              </div>
              {isAdmin && (
                <button onClick={() => supprimer(it.id)} style={{
                  padding: '6px 12px', borderRadius: 8, background: '#FCE9E3', color: '#D94A30',
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font, flexShrink: 0,
                }}>Supprimer</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
