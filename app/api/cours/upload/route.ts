import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'
import { chunker } from '@/lib/chunker'

// Texte maximal accepté (le corps de requête Vercel est limité à 4,5 Mo).
const TEXTE_MAX = 4_000_000

export async function POST(request: NextRequest) {
  // --- Identité (session/cookies, jamais le user_id fourni par le client) ---
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let admin
  try { admin = getSupabaseAdmin() } catch {
    return NextResponse.json({ error: 'Clé service role manquante' }, { status: 500 })
  }

  // Le texte est extrait dans le navigateur (lib/extraire-texte.ts) : seul le texte arrive ici.
  const body = await request.json().catch(() => ({}))
  const nom = String(body.nom || '').trim().slice(0, 200)
  const texte = typeof body.texte === 'string' ? body.texte : ''
  const espaceId = typeof body.espace_id === 'string' && body.espace_id ? body.espace_id : null
  const portee = body.portee === 'personnel' ? 'personnel' : 'officiel'

  if (!nom || !texte.trim()) return NextResponse.json({ error: 'Aucun texte extrait du fichier' }, { status: 400 })
  if (texte.length > TEXTE_MAX) return NextResponse.json({ error: 'Document trop long' }, { status: 413 })

  // --- Droits ---
  // La base ENM (officiel) n'est alimentée que par les admins.
  if (portee === 'officiel' && !(await estAdmin(user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const chunks = chunker(texte)
  if (chunks.length === 0) return NextResponse.json({ error: 'Aucun texte extrait' }, { status: 422 })

  const { data: doc, error: docErr } = await admin
    .from('cours_documents')
    .insert({
      nom,
      // Un document personnel n'est pas rattaché à une matière ENM.
      espace_id: portee === 'officiel' ? (espaceId || null) : null,
      nb_chunks: chunks.length,
      created_by: user.id,
      portee,
    })
    .select('id')
    .single()

  if (docErr || !doc) { console.error('cours/upload:', docErr?.message); return NextResponse.json({ error: 'Enregistrement impossible, réessaie.' }, { status: 500 }) }

  // --- Embeddings : uniquement pour la base ENM (officiel) ---
  // Passages enregistrés SANS embedding : pour un gros document, les calculer ici dépassait le temps
  // maximal d'une fonction Vercel (document laissé vide). La page appelle ensuite /api/cours/indexer par lots.
  const rows = chunks.map((c, i) => ({ document_id: doc.id, contenu: c, position: i, embedding: null }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error: chunkErr } = await admin.from('cours_chunks').insert(rows.slice(i, i + 500))
    if (chunkErr) {
      await admin.from('cours_chunks').delete().eq('document_id', doc.id)
      await admin.from('cours_documents').delete().eq('id', doc.id)
      console.error('cours/upload chunks:', chunkErr.message)
      return NextResponse.json({ error: 'Enregistrement impossible, réessaie.' }, { status: 500 })
    }
  }

  return NextResponse.json({ id: doc.id, chunks: chunks.length, portee, aIndexer: portee === 'officiel' })
}
