/**
 * Backfill des embeddings Voyage pour les passages OFFICIELS (base ENM)
 * qui n'en ont pas encore (ex. documents importés avant la migration 0002).
 *
 * Usage :
 *   node --env-file=.env.local scripts/backfill-embeddings.mjs
 *
 * Idempotent : ne traite que les chunks dont embedding IS NULL et dont le
 * document parent est portee='officiel' et non supprimé. Relançable sans risque.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || 'voyage-law-2'

if (!url || !key) { console.error('❌ URL ou SERVICE_ROLE_KEY manquante'); process.exit(1) }
if (!VOYAGE_API_KEY) { console.error('❌ VOYAGE_API_KEY manquante'); process.exit(1) }

const admin = createClient(url, key)
const BATCH = 32 // passages par requête Voyage

async function embed(textes) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: textes, input_type: 'document' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status} : ${await res.text()}`)
  const json = await res.json()
  return json.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
}

// 1) ids des documents officiels non supprimés
const { data: docs, error: eDocs } = await admin
  .from('cours_documents')
  .select('id, nom')
  .eq('portee', 'officiel')
  .is('deleted_at', null)
if (eDocs) { console.error('❌ docs:', eDocs.message); process.exit(1) }
const docIds = docs.map(d => d.id)
if (docIds.length === 0) { console.log('Aucun document officiel.'); process.exit(0) }

// 2) chunks officiels sans embedding
const { data: chunks, error: eCh } = await admin
  .from('cours_chunks')
  .select('id, contenu')
  .in('document_id', docIds)
  .is('embedding', null)
if (eCh) { console.error('❌ chunks:', eCh.message); process.exit(1) }

console.log(`${docs.length} document(s) officiel(s), ${chunks.length} passage(s) à vectoriser.\n`)
if (chunks.length === 0) { console.log('✅ Rien à faire, tout est déjà embeddé.'); process.exit(0) }

let ok = 0
for (let i = 0; i < chunks.length; i += BATCH) {
  const lot = chunks.slice(i, i + BATCH)
  const vecteurs = await embed(lot.map(c => c.contenu))
  for (let j = 0; j < lot.length; j++) {
    const vec = '[' + vecteurs[j].join(',') + ']'
    const { error } = await admin.from('cours_chunks').update({ embedding: vec }).eq('id', lot[j].id)
    if (error) console.error(`  ❌ chunk ${lot[j].id}: ${error.message}`)
    else ok++
  }
  console.log(`  ${Math.min(i + BATCH, chunks.length)}/${chunks.length} traités…`)
}

console.log(`\n✅ Terminé : ${ok}/${chunks.length} passages embeddés.`)
