import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { embedQuestion, toVector } from '@/lib/embeddings'

const SYSTEME = `Tu es un assistant pédagogique de l'ENM (École Nationale de la Magistrature).
Tu réponds UNIQUEMENT en te basant sur les extraits de cours fournis ci-dessous.
Si l'information demandée ne figure pas dans les documents, réponds exactement : "Je n'ai pas trouvé cette information dans les documents de cours importés."
Sois précis, pédagogique et structuré. Tu peux citer des passages clés entre guillemets.
Ne fabrique jamais d'information non présente dans les extraits.`

interface Extrait {
  contenu: string
  nom: string
}

function tsquery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-zàâäéèêëîïôùûüç\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w + ':*')
    .join(' & ')
}

export async function POST(request: NextRequest) {
  const { question, espace_id, document_ids, portee: porteeBrut } = await request.json()
  const portee = porteeBrut === 'personnel' ? 'personnel' : 'officiel'
  const document_ids_array: string[] = Array.isArray(document_ids) && document_ids.length > 0 ? document_ids : []
  if (!question?.trim()) return NextResponse.json({ error: 'Question manquante' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Clé Anthropic manquante' }, { status: 500 })

  let admin
  try { admin = getSupabaseAdmin() } catch {
    return NextResponse.json({ error: 'Clé service role manquante' }, { status: 500 })
  }

  // Les documents personnels exigent une identité vérifiée (confidentialité).
  const user = await utilisateurCourant()
  if (portee === 'personnel' && !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let extraits: Extrait[] = []

  if (portee === 'officiel') {
    // ---- BASE ENM : recherche SÉMANTIQUE (embeddings + pgvector) ----
    let vecteur: number[]
    try {
      vecteur = await embedQuestion(question)
    } catch (e) {
      return NextResponse.json({ error: `Embedding : ${String(e)}` }, { status: 502 })
    }
    const { data, error } = await admin.rpc('match_cours_chunks', {
      query_embedding: toVector(vecteur),
      match_count: 8,
      filtre_espace: espace_id || null,
      filtre_documents: document_ids_array.length > 0 ? document_ids_array : null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    extraits = (data || []).map((r: { contenu: string; document_nom: string }) => ({
      contenu: r.contenu,
      nom: r.document_nom,
    }))
  } else {
    // ---- MES DOCUMENTS : recherche plein-texte, restreinte à l'étudiant ----
    const query = tsquery(question)
    let req = admin
      .from('cours_chunks')
      .select('contenu, position, cours_documents!inner(id, nom, created_by, portee)')
      .eq('cours_documents.portee', 'personnel')
      .eq('cours_documents.created_by', user!.id)
      .textSearch('contenu', query, { config: 'french' })
      .limit(8)
    if (document_ids_array.length > 0) req = req.in('document_id', document_ids_array)

    let { data: chunks } = await req

    // Fallback : si la recherche ne donne rien, prendre quelques passages de l'étudiant.
    if (!chunks || chunks.length === 0) {
      let fb = admin
        .from('cours_chunks')
        .select('contenu, position, cours_documents!inner(id, nom, created_by, portee)')
        .eq('cours_documents.portee', 'personnel')
        .eq('cours_documents.created_by', user!.id)
        .limit(6)
      if (document_ids_array.length > 0) fb = fb.in('document_id', document_ids_array)
      const { data } = await fb
      chunks = data || []
    }

    extraits = (chunks || []).map((c: { contenu: string; cours_documents: { nom: string } | { nom: string }[] }) => {
      const doc = Array.isArray(c.cours_documents) ? c.cours_documents[0] : c.cours_documents
      return { contenu: c.contenu, nom: doc?.nom ?? 'Document' }
    })
  }

  if (extraits.length === 0) {
    const msg = portee === 'personnel'
      ? "Tu n'as pas encore importé de document. Ajoute un fichier pour pouvoir l'interroger."
      : "Aucun document de cours n'a encore été importé dans la base ENM."
    return NextResponse.json({ reponse: msg, sources: [] })
  }

  const contexteTexte = extraits.map(e => `[Source : ${e.nom}]\n${e.contenu}`).join('\n\n---\n\n')
  const sources = [...new Set(extraits.map(e => e.nom))]

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userMessage = `Extraits de cours :\n\n${contexteTexte}\n\n---\n\nQuestion : ${question}`

  // Streaming SSE
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources, nbPassages: extraits.length })}\n\n`))

        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: SYSTEME,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: event.delta.text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`))
      }
      controller.close()
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
