'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace, Module } from '@/types'

type CartePreview = { question: string; reponse: string }
type Etape = 'upload' | 'preview' | 'import' | 'done'

// Convertit le HTML en texte brut (uniquement pour l'aperçu compact)
function htmlToText(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
}

// Nettoie les artefacts Anki tout en conservant la mise en forme HTML
function nettoyerHtmlAnki(s: string): string {
  return s
    .replace(/\[sound:[^\]]+\]/g, '') // retire les références audio non gérées
    .replace(/&nbsp;/g, ' ')
    .trim()
}

// Détermine le type MIME d'un fichier image selon son extension ('' si non-image)
function mimeImage(nom: string): string {
  const ext = nom.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg': case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    case 'svg': return 'image/svg+xml'
    case 'bmp': return 'image/bmp'
    default: return ''
  }
}

// Encode un Uint8Array en base64 (par blocs pour éviter de saturer la pile)
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

// Parseur protobuf minimal pour le fichier "media" du format Anki récent.
// Renvoie la liste ordonnée des noms de fichiers (le fichier "0","1"… du zip
// correspond à l'entrée du même rang).
function parseMediaEntries(bytes: Uint8Array): string[] {
  const names: string[] = []
  let i = 0
  const readVarint = () => {
    let result = 0, shift = 0, b = 0
    do { b = bytes[i++]; result += (b & 0x7f) * Math.pow(2, shift); shift += 7 } while (b & 0x80)
    return result
  }
  while (i < bytes.length) {
    const tag = readVarint()
    const field = tag >> 3, wire = tag & 7
    if (field === 1 && wire === 2) {
      const len = readVarint()
      const entry = bytes.subarray(i, i + len); i += len
      let j = 0, name = ''
      const rv = () => { let r = 0, s = 0, b = 0; do { b = entry[j++]; r += (b & 0x7f) * Math.pow(2, s); s += 7 } while (b & 0x80); return r }
      while (j < entry.length) {
        const t = rv(); const f = t >> 3, w = t & 7
        if (f === 1 && w === 2) { const l = rv(); name = new TextDecoder().decode(entry.subarray(j, j + l)); j += l }
        else if (w === 2) { const l = rv(); j += l }
        else if (w === 0) { rv() }
        else if (w === 5) { j += 4 }
        else if (w === 1) { j += 8 }
        else break
      }
      names.push(name)
    } else if (wire === 2) { const len = readVarint(); i += len }
    else if (wire === 0) { readVarint() }
    else if (wire === 5) { i += 4 }
    else if (wire === 1) { i += 8 }
    else break
  }
  return names
}

// Remplace les <img src="fichier"> par les images en data URI (intégrées)
function integrerImages(html: string, mediaMap: Record<string, string>): string {
  if (Object.keys(mediaMap).length === 0) return html
  return html.replace(/(<img[^>]*\ssrc=["'])([^"']+)(["'][^>]*>)/gi, (full, pre, src, post) => {
    const name = decodeURIComponent(src)
    return mediaMap[name] ? `${pre}${mediaMap[name]}${post}` : full
  })
}

async function parseTxt(file: File): Promise<CartePreview[]> {
  const texte = await file.text()
  const lignes = texte.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  const cartes: CartePreview[] = []
  for (const ligne of lignes) {
    const parts = ligne.split('\t')
    if (parts.length >= 2) {
      const q = nettoyerHtmlAnki(parts[0])
      const r = nettoyerHtmlAnki(parts.slice(1).join('\t'))
      if (htmlToText(q) && htmlToText(r)) cartes.push({ question: q, reponse: r })
    }
  }
  return cartes
}

async function parseApkg(file: File): Promise<CartePreview[]> {
  const buffer = await file.arrayBuffer()

  // Extraction du zip
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)

  // Formats par ordre de priorité :
  // - collection.anki21b : SQLite compressé en Zstandard (Anki récent)
  // - collection.anki21 / collection.anki2 : SQLite brut (Anki plus ancien)
  const entryB = zip.file('collection.anki21b')
  const entryRaw = zip.file('collection.anki21') ?? zip.file('collection.anki2')
  if (!entryB && !entryRaw) throw new Error('Aucune base collection.anki2(1)(b) trouvée dans le .apkg')

  let dbBytes: Uint8Array
  if (entryB) {
    const compressed = new Uint8Array(await entryB.async('arraybuffer'))
    const fzstd = await import('fzstd')
    dbBytes = fzstd.decompress(compressed)
  } else {
    dbBytes = new Uint8Array(await entryRaw!.async('arraybuffer'))
  }

  // Construction de la table des médias (images) → data URI.
  // Deux formats possibles :
  //  - Ancien : fichier "media" = JSON {"0":"img.png",…}, fichiers médias bruts
  //  - Récent : fichier "media" = protobuf compressé zstd, fichiers médias compressés zstd
  const mediaMap: Record<string, string> = {}
  try {
    const mediaEntry = zip.file('media')
    if (mediaEntry) {
      const raw = new Uint8Array(await mediaEntry.async('arraybuffer'))
      const estZstd = raw[0] === 0x28 && raw[1] === 0xb5 && raw[2] === 0x2f && raw[3] === 0xfd
      const fzstd = await import('fzstd')

      if (estZstd) {
        // Format récent
        const names = parseMediaEntries(fzstd.decompress(raw))
        for (let idx = 0; idx < names.length; idx++) {
          const name = names[idx]
          const mime = mimeImage(name)
          if (!mime) continue
          const f = zip.file(String(idx))
          if (!f) continue
          const bytes = fzstd.decompress(new Uint8Array(await f.async('arraybuffer')))
          mediaMap[name] = `data:${mime};base64,${uint8ToBase64(bytes)}`
        }
      } else {
        // Ancien format JSON
        const mediaJson = JSON.parse(new TextDecoder().decode(raw)) as Record<string, string>
        for (const [num, name] of Object.entries(mediaJson)) {
          const mime = mimeImage(name)
          if (!mime) continue
          const f = zip.file(num)
          if (!f) continue
          mediaMap[name] = `data:${mime};base64,${await f.async('base64')}`
        }
      }
    }
  } catch {
    // En cas d'échec, les cartes s'importent sans images
  }

  // Chargement sql.js avec le WASM local
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  })

  const db = new SQL.Database(dbBytes)

  // Les champs Anki sont séparés par \x1f (ASCII 31) dans la colonne flds
  const result = db.exec('SELECT flds FROM notes')
  db.close()

  const cartes: CartePreview[] = []
  if (result.length > 0) {
    for (const row of result[0].values) {
      const fields = (row[0] as string).split('\x1f')
      if (fields.length >= 2) {
        const q = integrerImages(nettoyerHtmlAnki(fields[0]), mediaMap)
        const r = integrerImages(nettoyerHtmlAnki(fields[1]), mediaMap)
        if (htmlToText(q) && htmlToText(r)) cartes.push({ question: q, reponse: r })
      }
    }
  }
  return cartes
}

export default function ImportPage() {
  const [etape, setEtape] = useState<Etape>('upload')
  const [cartes, setCartes] = useState<CartePreview[]>([])
  const [erreur, setErreur] = useState('')
  const [parsing, setParsing] = useState(false)
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [espaceId, setEspaceId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [nomModule, setNomModule] = useState('')
  const [creatingModule, setCreatingModule] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState({ ok: 0, erreurs: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('espaces').select('*').order('ordre').then(({ data }) => setEspaces(data || []))
  }, [])

  useEffect(() => {
    if (!espaceId) { setModules([]); setModuleId(''); return }
    supabase.from('modules').select('*').eq('espace_id', espaceId).is('deleted_at', null).order('ordre')
      .then(({ data }) => setModules(data || []))
    setModuleId('')
  }, [espaceId])

  const handleFichier = async (file: File) => {
    setErreur('')
    setParsing(true)
    try {
      let parsed: CartePreview[] = []
      if (file.name.endsWith('.apkg')) {
        parsed = await parseApkg(file)
      } else if (file.name.endsWith('.txt') || file.name.endsWith('.tsv')) {
        parsed = await parseTxt(file)
      } else {
        throw new Error('Format non supporté. Utilise un fichier .apkg ou .txt exporté depuis Anki.')
      }
      if (parsed.length === 0) throw new Error('Aucune carte trouvée dans ce fichier.')
      setCartes(parsed)
      setEtape('preview')
    } catch (e: any) {
      setErreur(e.message ?? 'Erreur lors de la lecture du fichier.')
    } finally {
      setParsing(false)
    }
  }

  const creerModule = async () => {
    if (!nomModule.trim() || !espaceId) return
    const { data, error } = await supabase.from('modules')
      .insert({ espace_id: espaceId, nom: nomModule.trim(), ordre: modules.length + 1 })
      .select().single()
    if (error || !data) return
    setModules(m => [...m, data])
    setModuleId(data.id)
    setNomModule('')
    setCreatingModule(false)
  }

  const lancerImport = async () => {
    if (!moduleId || cartes.length === 0) return
    setImporting(true)
    let ok = 0; let erreurs = 0
    const BATCH = 50
    for (let i = 0; i < cartes.length; i += BATCH) {
      const batch = cartes.slice(i, i + BATCH).map(c => ({ module_id: moduleId, question: c.question, reponse: c.reponse }))
      const { error } = await supabase.from('fiches').insert(batch)
      if (error) erreurs += batch.length; else ok += batch.length
    }
    setImportResult({ ok, erreurs })
    setImporting(false)
    setEtape('done')
  }

  const reset = () => {
    setEtape('upload'); setCartes([]); setErreur('')
    setEspaceId(''); setModuleId(''); setNomModule(''); setCreatingModule(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const font = "'Hanken Grotesk', sans-serif"
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: '1.5rem', marginBottom: 16 }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #EADFC9', fontSize: 13, boxSizing: 'border-box', fontFamily: font, background: '#FFFBF2', outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 12, display: 'block', marginBottom: 6, color: '#8A7E68', fontWeight: 600 }
  const btnP: React.CSSProperties = { padding: '11px 24px', borderRadius: 10, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: font }
  const btnS: React.CSSProperties = { padding: '11px 18px', borderRadius: 10, background: '#FDF6EA', color: '#8A7E68', border: '1px solid #EADFC9', cursor: 'pointer', fontSize: 14, fontFamily: font }

  const steps = ['Fichier', 'Aperçu', 'Destination', 'Terminé']
  const stepIdx = etape === 'upload' ? 0 : etape === 'preview' ? 1 : etape === 'import' ? 2 : 3

  return (
    <div style={{ paddingTop: '34px', maxWidth: 720, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>

      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26, marginBottom: 8 }}>
        Importer des cartes Anki
      </div>
      <p style={{ fontSize: 14, color: '#8A7E68', margin: '0 0 28px' }}>
        Compatible avec les fichiers <strong>.apkg</strong> (export natif Anki) et <strong>.txt</strong> (Notes in Plain Text).
      </p>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: i <= stepIdx ? '#DC4A2B' : '#F0E7D6',
                color: i <= stepIdx ? '#fff' : '#9A8D72',
              }}>
                {i < stepIdx ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: i === stepIdx ? '#2A2018' : '#9A8D72', whiteSpace: 'nowrap' }}>{s}</div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < stepIdx ? '#DC4A2B' : '#F0E7D6', margin: '0 6px', marginBottom: 18 }} />
            )}
          </div>
        ))}
      </div>

      {/* ÉTAPE 1 — Upload */}
      {etape === 'upload' && (
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Sélectionner le fichier</h2>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFichier(f) }}
            onClick={() => !parsing && fileRef.current?.click()}
            style={{
              border: '2px dashed #F2C4B5', borderRadius: 12, padding: '2.5rem',
              textAlign: 'center', cursor: parsing ? 'wait' : 'pointer', background: '#FFFBF2',
            }}
          >
            {parsing ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#DC4A2B' }}>Lecture du fichier en cours…</div>
                <div style={{ fontSize: 12, color: '#9A8D72', marginTop: 4 }}>Le fichier .apkg peut prendre quelques secondes</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2A2018', marginBottom: 4 }}>
                  Glisse le fichier ici ou clique pour l'ouvrir
                </div>
                <div style={{ fontSize: 12, color: '#9A8D72' }}>
                  Formats supportés : <strong>.apkg</strong> · <strong>.txt</strong>
                </div>
              </>
            )}
            <input
              ref={fileRef} type="file" accept=".apkg,.txt,.tsv"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFichier(f) }}
            />
          </div>

          {erreur && (
            <div style={{ marginTop: 14, fontSize: 13, color: '#D94A30', background: '#FCE9E3', padding: '10px 14px', borderRadius: 10 }}>
              ❌ {erreur}
            </div>
          )}

          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '14px 16px', background: '#FDF6EA', borderRadius: 10, fontSize: 13, color: '#8A7E68', lineHeight: 1.6 }}>
              <strong style={{ color: '#2A2018' }}>Export .apkg</strong><br />
              1. Anki → clic droit sur un paquet<br />
              2. <strong>Exporter</strong><br />
              3. Format : <strong>Paquet Anki (.apkg)</strong><br />
              4. Clique Exporter
            </div>
            <div style={{ padding: '14px 16px', background: '#FDF6EA', borderRadius: 10, fontSize: 13, color: '#8A7E68', lineHeight: 1.6 }}>
              <strong style={{ color: '#2A2018' }}>Export .txt</strong><br />
              1. Anki → Fichier → Exporter<br />
              2. Format : <strong>Notes in Plain Text</strong><br />
              3. Décoche "Inclure les tags"<br />
              4. Clique Exporter
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 — Aperçu */}
      {etape === 'preview' && (
        <div>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{cartes.length} cartes détectées</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {cartes.slice(0, 50).map((c, i) => (
                <div key={i} style={{ padding: '10px 12px', background: '#FDF6EA', borderRadius: 10, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: '#2A2018', marginBottom: 3 }}>{htmlToText(c.question)}</div>
                  <div style={{ color: '#8A7E68', lineHeight: 1.5 }}>
                    {htmlToText(c.reponse).slice(0, 140)}{htmlToText(c.reponse).length > 140 ? '…' : ''}
                    {/^.*<img/i.test(c.reponse) || /<img/i.test(c.question) ? <span style={{ marginLeft: 6, fontSize: 11, color: '#DC4A2B', fontWeight: 600 }}>🖼️ image</span> : null}
                  </div>
                </div>
              ))}
              {cartes.length > 50 && (
                <div style={{ textAlign: 'center', fontSize: 12, color: '#9A8D72', padding: '8px 0' }}>… et {cartes.length - 50} autres cartes</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnS} onClick={reset}>← Recommencer</button>
            <button style={btnP} onClick={() => setEtape('import')}>Choisir la destination →</button>
          </div>
        </div>
      )}

      {/* ÉTAPE 3 — Destination */}
      {etape === 'import' && (
        <div>
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Choisir la destination</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Espace</label>
                <select value={espaceId} onChange={e => setEspaceId(e.target.value)} style={inp}>
                  <option value="">Choisir un espace…</option>
                  {espaces.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Module</label>
                <select value={moduleId} onChange={e => setModuleId(e.target.value)} disabled={!espaceId} style={{ ...inp, opacity: !espaceId ? 0.5 : 1 }}>
                  <option value="">Choisir un module…</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
            </div>
            {espaceId && (
              !creatingModule ? (
                <button onClick={() => setCreatingModule(true)} style={{ fontSize: 13, fontWeight: 600, color: '#DC4A2B', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: font }}>
                  + Créer un nouveau module
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={nomModule} onChange={e => setNomModule(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') creerModule(); if (e.key === 'Escape') setCreatingModule(false) }}
                    placeholder="Nom du module…" autoFocus style={{ ...inp, flex: 1 }} />
                  <button onClick={creerModule} disabled={!nomModule.trim()} style={{ ...btnP, opacity: !nomModule.trim() ? 0.5 : 1, padding: '10px 16px', fontSize: 13 }}>Créer</button>
                  <button onClick={() => setCreatingModule(false)} style={{ ...btnS, padding: '10px 14px', fontSize: 13 }}>Annuler</button>
                </div>
              )
            )}
          </div>

          <div style={{ ...card, background: '#FDF6EA', border: '1px solid #EADFC9' }}>
            <div style={{ fontSize: 14, color: '#8A7E68' }}>
              <strong style={{ color: '#2A2018' }}>{cartes.length} cartes</strong> seront importées
              {moduleId && modules.find(m => m.id === moduleId) && <> dans <strong style={{ color: '#2A2018' }}>"{modules.find(m => m.id === moduleId)?.nom}"</strong></>}
              {espaceId && espaces.find(e => e.id === espaceId) && <> — espace <strong style={{ color: '#2A2018' }}>{espaces.find(e => e.id === espaceId)?.nom}</strong></>}.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnS} onClick={() => setEtape('preview')}>← Retour</button>
            <button style={{ ...btnP, opacity: (!moduleId || importing) ? 0.5 : 1 }} disabled={!moduleId || importing} onClick={lancerImport}>
              {importing ? 'Import en cours…' : `Importer ${cartes.length} cartes →`}
            </button>
          </div>
          {importing && <div style={{ marginTop: 12, fontSize: 13, color: '#9A8D72', textAlign: 'center' }}>Ne ferme pas la page…</div>}
        </div>
      )}

      {/* ÉTAPE 4 — Terminé */}
      {etape === 'done' && (
        <div style={{ ...card, textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{importResult.erreurs === 0 ? '🎉' : '⚠️'}</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 8 }}>
            {importResult.erreurs === 0 ? 'Import réussi !' : 'Import partiel'}
          </div>
          <div style={{ fontSize: 15, color: '#8A7E68', marginBottom: 24, lineHeight: 1.6 }}>
            <span style={{ color: '#0E7C63', fontWeight: 700 }}>{importResult.ok} cartes importées</span>
            {importResult.erreurs > 0 && <><br /><span style={{ color: '#D94A30' }}>{importResult.erreurs} erreurs</span></>}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button style={btnS} onClick={reset}>Importer un autre fichier</button>
            <button style={btnP} onClick={() => window.location.href = '/dashboard'}>Aller au dashboard →</button>
          </div>
        </div>
      )}
    </div>
  )
}
