import { NextResponse, type NextRequest } from 'next/server'
import { streamIA, iaConfiguree } from '@/lib/ia'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { embedQuestion, toVector } from '@/lib/embeddings'

const SYSTEME = `Tu es un assistant pédagogique de l'ENM (École Nationale de la Magistrature).
Tu réponds UNIQUEMENT en te basant sur les extraits de cours fournis ci-dessous.
Si l'information demandée ne figure pas dans les documents, réponds exactement : "Je n'ai pas trouvé cette information dans les documents de cours importés."
Sois précis, pédagogique et structuré. Tu peux citer des passages clés entre guillemets.
Ne fabrique jamais d'information non présente dans les extraits.`

// Seuil de similarité cosinus (voyage-law-2) en dessous duquel un passage est jugé
// hors-sujet : mieux vaut répondre « je n'ai pas trouvé » que broder sur du bruit.
// Les vraies questions du corpus se situent vers 0.55–0.65 ; 0.4 laisse une marge sûre.
const SEUIL_SIMILARITE = 0.4
// Quota anti-coûts : nombre maximum de questions IA par utilisateur et par jour.
const LIMITE_QUESTIONS_JOUR = 40
const jourCourant = () => new Date().toISOString().slice(0, 10)

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

// Le client lit TOUJOURS un flux SSE (res.body.getReader) : un simple
// NextResponse.json ne s'afficherait pas. Ce helper renvoie un message
// « one-shot » au format SSE (sources vides puis un seul token = le message).
function messageSSE(message: string): Response {
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources: [], nbPassages: 0 })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: message })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}

export async function POST(request: NextRequest) {
  const { question, espace_id, document_ids, portee: porteeBrut } = await request.json()
  const portee = porteeBrut === 'personnel' ? 'personnel' : 'officiel'
  const document_ids_array: string[] = Array.isArray(document_ids) && document_ids.length > 0 ? document_ids : []
  if (!question?.trim()) return NextResponse.json({ error: 'Question manquante' }, { status: 400 })
  if (!iaConfiguree('anthropic')) return NextResponse.json({ error: 'Clé IA manquante' }, { status: 500 })

  let admin
  try { admin = getSupabaseAdmin() } catch {
    return NextResponse.json({ error: 'Clé service role manquante' }, { status: 500 })
  }

  // Les documents personnels exigent une identité vérifiée (confidentialité).
  const user = await utilisateurCourant()
  if (portee === 'personnel' && !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // ---- Quota anti-coûts (par utilisateur / par jour). Résilient : si la table
  //      ia_usage n'existe pas encore (migration 0032), aucun quota n'est appliqué.
  if (user) {
    try {
      const { data, error } = await admin.from('ia_usage').select('questions')
        .eq('user_id', user.id).eq('jour', jourCourant()).maybeSingle()
      if (!error && (data?.questions ?? 0) >= LIMITE_QUESTIONS_JOUR) {
        return messageSSE(`Tu as atteint la limite de ${LIMITE_QUESTIONS_JOUR} questions pour aujourd'hui. Reviens demain — cela évite aussi de saturer le service. 🙂`)
      }
    } catch { /* table absente → pas de quota */ }
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
    const rows = (data || []) as { contenu: string; document_nom: string; similarite: number }[]
    if (rows.length === 0) {
      return messageSSE("Aucun document de cours n'a encore été importé dans la base ENM.")
    }
    // Garde-fou anti hors-sujet : on ne garde que les passages assez proches sémantiquement.
    const pertinents = rows.filter(r => (r.similarite ?? 0) >= SEUIL_SIMILARITE)
    if (pertinents.length === 0) {
      return messageSSE("Je n'ai pas trouvé d'information pertinente sur cette question dans la base ENM. Reformule, ou pose une question couverte par le programme importé.")
    }
    extraits = pertinents.map(r => ({ contenu: r.contenu, nom: r.document_nom }))
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

    const { data: chunks } = await req

    // Plus de repli aléatoire : si la recherche ne trouve rien, on NE répond PAS sur
    // des passages arbitraires (garantie anti hors-sujet). Message adapté au contexte.
    if (!chunks || chunks.length === 0) {
      const { count } = await admin
        .from('cours_documents')
        .select('id', { count: 'exact', head: true })
        .eq('portee', 'personnel').eq('created_by', user!.id).is('deleted_at', null)
      const msg = (count || 0) === 0
        ? "Tu n'as pas encore importé de document. Ajoute un fichier pour pouvoir l'interroger."
        : "Je n'ai pas trouvé de passage correspondant à ta question dans tes documents. Reformule ou vérifie que c'est le bon fichier."
      return messageSSE(msg)
    }

    extraits = (chunks || []).map((c: { contenu: string; cours_documents: { nom: string } | { nom: string }[] }) => {
      const doc = Array.isArray(c.cours_documents) ? c.cours_documents[0] : c.cours_documents
      return { contenu: c.contenu, nom: doc?.nom ?? 'Document' }
    })
  }

  if (extraits.length === 0) {
    return messageSSE(portee === 'personnel'
      ? "Je n'ai pas trouvé d'information dans tes documents."
      : "Aucun document de cours n'a encore été importé dans la base ENM.")
  }

  // On s'engage à répondre → on incrémente le quota (borne Voyage + Claude).
  // Résilient : sans la table ia_usage, l'incrément est simplement ignoré.
  if (user) {
    try {
      const jour = jourCourant()
      const { data, error } = await admin.from('ia_usage').select('questions')
        .eq('user_id', user.id).eq('jour', jour).maybeSingle()
      if (!error) {
        if (data) await admin.from('ia_usage').update({ questions: data.questions + 1 }).eq('user_id', user.id).eq('jour', jour)
        else await admin.from('ia_usage').insert({ user_id: user.id, jour, questions: 1 })
      }
    } catch { /* résilient */ }
  }

  const contexteTexte = extraits.map(e => `[Source : ${e.nom}]\n${e.contenu}`).join('\n\n---\n\n')
  const sources = [...new Set(extraits.map(e => e.nom))]

  const userMessage = `Extraits de cours :\n\n${contexteTexte}\n\n---\n\nQuestion : ${question}`

  // Streaming SSE — « Questions de cours » reste sur Claude (rigueur juridique).
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources, nbPassages: extraits.length })}\n\n`))

        for await (const tok of streamIA({ provider: 'anthropic', system: SYSTEME, maxTokens: 1500, messages: [{ role: 'user', content: userMessage }] })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: tok })}\n\n`))
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
