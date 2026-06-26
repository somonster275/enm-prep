import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant, estAdmin } from '@/lib/auth-serveur'
import { embed, toVector } from '@/lib/embeddings'

const LOT_EMBED = 64 // passages par appel d'embeddings

function chunker(texte: string, taille = 800, chevauchement = 100): string[] {
  const paragraphes = texte.split(/\n{2,}/)
  const chunks: string[] = []
  let courant = ''
  for (const p of paragraphes) {
    if ((courant + '\n\n' + p).length > taille && courant) {
      chunks.push(courant.trim())
      const mots = courant.split(' ')
      courant = mots.slice(-Math.floor(chevauchement / 5)).join(' ') + '\n\n' + p
    } else {
      courant = courant ? courant + '\n\n' + p : p
    }
  }
  if (courant.trim()) chunks.push(courant.trim())
  return chunks.filter(c => c.length > 30)
}

async function extraireTexte(fichier: File): Promise<string> {
  const type = fichier.type
  if (type === 'text/plain' || fichier.name.endsWith('.txt')) {
    return fichier.text()
  }
  if (type === 'application/pdf' || fichier.name.endsWith('.pdf')) {
    const data = new Uint8Array(await fichier.arrayBuffer())
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data })
    try {
      const result = await parser.getText()
      return result.text
    } finally {
      await parser.destroy()
    }
  }
  throw new Error(`Format non supporté : ${type || fichier.name}`)
}

export async function POST(request: NextRequest) {
  // --- Identité (session/cookies, jamais le user_id fourni par le client) ---
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let admin
  try { admin = getSupabaseAdmin() } catch {
    return NextResponse.json({ error: 'Clé service role manquante' }, { status: 500 })
  }

  const form = await request.formData()
  const fichier = form.get('fichier') as File | null
  const espaceId = (form.get('espace_id') as string) || null
  const portee = (form.get('portee') as string) === 'personnel' ? 'personnel' : 'officiel'

  if (!fichier) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

  // --- Droits ---
  // La base ENM (officiel) n'est alimentée que par les admins.
  if (portee === 'officiel' && !(await estAdmin(user.id))) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  let texte: string
  try {
    texte = await extraireTexte(fichier)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 422 })
  }

  const chunks = chunker(texte)
  if (chunks.length === 0) return NextResponse.json({ error: 'Aucun texte extrait' }, { status: 422 })

  const { data: doc, error: docErr } = await admin
    .from('cours_documents')
    .insert({
      nom: fichier.name,
      // Un document personnel n'est pas rattaché à une matière ENM.
      espace_id: portee === 'officiel' ? (espaceId || null) : null,
      nb_chunks: chunks.length,
      created_by: user.id,
      portee,
    })
    .select('id')
    .single()

  if (docErr || !doc) return NextResponse.json({ error: docErr?.message }, { status: 500 })

  // --- Embeddings : uniquement pour la base ENM (officiel) ---
  let embeddings: (string | null)[] = chunks.map(() => null)
  if (portee === 'officiel') {
    try {
      const out: string[] = []
      for (let i = 0; i < chunks.length; i += LOT_EMBED) {
        const lot = chunks.slice(i, i + LOT_EMBED)
        const vecteurs = await embed(lot, 'document')
        for (const v of vecteurs) out.push(toVector(v))
      }
      embeddings = out
    } catch (e) {
      // On annule le document pour ne pas laisser une base ENM sans embeddings.
      await admin.from('cours_documents').delete().eq('id', doc.id)
      return NextResponse.json({ error: `Embeddings : ${String(e)}` }, { status: 502 })
    }
  }

  const rows = chunks.map((c, i) => ({
    document_id: doc.id,
    contenu: c,
    position: i,
    embedding: embeddings[i],
  }))
  const { error: chunkErr } = await admin.from('cours_chunks').insert(rows)
  if (chunkErr) {
    await admin.from('cours_documents').delete().eq('id', doc.id)
    return NextResponse.json({ error: chunkErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: doc.id, chunks: chunks.length, portee })
}
