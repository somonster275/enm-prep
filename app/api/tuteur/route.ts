import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const SYSTEME = `Tu es un tuteur pédagogique pour des étudiants préparant le concours de l'ENM (École Nationale de la Magistrature, droit français).
Ton rôle : expliquer clairement les notions juridiques, donner des méthodes (cas pratique, dissertation, note de synthèse, grand oral), résumer, et répondre aux questions de cours.
Règles :
- Réponds en français, de façon rigoureuse, structurée et pédagogique.
- Quand tu énonces une règle de droit, sois précis (texte, principe). Si tu n'es pas certain d'une information, dis-le clairement plutôt que d'inventer.
- Adapte la longueur à la question ; utilise des listes ou des titres quand c'est utile.
- Tu es une aide à la révision : invite l'étudiant à recouper avec ses cours et les sources officielles pour les points sensibles.`

type Msg = { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest) {
  const { messages } = await request.json().catch(() => ({}))
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Conversation vide' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé Anthropic manquante' }, { status: 500 })
  }

  // On ne garde que les 20 derniers messages, format propre.
  const msgs: Msg[] = messages
    .filter((m: { role?: string; content?: string }) => m && m.content)
    .map((m: { role?: string; content?: string }): Msg => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content),
    }))
    .slice(-20)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: SYSTEME,
          messages: msgs,
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
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
