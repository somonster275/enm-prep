/**
 * Couche d'abstraction pour le LLM de chat, avec choix du provider PAR APPEL :
 *   - 'anthropic' (Claude) : Questions de cours, génération de fiches (rigueur juridique).
 *   - 'deepseek'  : le chatbot/coach (gros volume, moins cher).
 *
 * Variables d'env :
 *   ANTHROPIC_MODEL  = claude-sonnet-4-6 (défaut)
 *   DEEPSEEK_API_KEY = clé DeepSeek
 *   DEEPSEEK_MODEL   = deepseek-chat (défaut)
 *   CHATBOT_PROVIDER = 'deepseek' (défaut) — provider du coach (mettre 'anthropic' pour repasser le coach sous Claude)
 *
 * Repli de sécurité : si 'deepseek' est demandé mais que DEEPSEEK_API_KEY manque,
 * on bascule automatiquement sur Claude (le coach reste fonctionnel).
 * DeepSeek expose une API compatible OpenAI (chat/completions + SSE).
 */
import Anthropic from '@anthropic-ai/sdk'

export type IAMessage = { role: 'user' | 'assistant'; content: string }
export type Provider = 'anthropic' | 'deepseek'

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com') + '/chat/completions'

/** Provider du chatbot/coach (configurable, DeepSeek par défaut). */
export const CHATBOT_PROVIDER = (process.env.CHATBOT_PROVIDER || 'deepseek').toLowerCase() as Provider

/** Provider réellement utilisé : repli sur Claude si DeepSeek demandé sans clé. */
function effectif(provider: Provider): Provider {
  if (provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) return 'anthropic'
  return provider
}

/** Une clé est-elle disponible pour servir cette demande (après repli) ? */
export function iaConfiguree(provider: Provider = 'anthropic'): boolean {
  return effectif(provider) === 'deepseek' ? !!process.env.DEEPSEEK_API_KEY : !!process.env.ANTHROPIC_API_KEY
}

/** Streaming : génère les morceaux de texte au fil de l'eau. */
export async function* streamIA(
  { system, messages, maxTokens = 2000, provider = 'anthropic' }:
  { system: string; messages: IAMessage[]; maxTokens?: number; provider?: Provider },
): AsyncGenerator<string> {
  if (effectif(provider) === 'deepseek') {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: DEEPSEEK_MODEL, max_tokens: maxTokens, stream: true, messages: [{ role: 'system', content: system }, ...messages] }),
    })
    if (!res.ok || !res.body) throw new Error(`DeepSeek (${res.status}) : ${await res.text().catch(() => '')}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n'); buffer = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const payload = t.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          const tok = JSON.parse(payload)?.choices?.[0]?.delta?.content
          if (tok) yield tok
        } catch { /* ignore */ }
      }
    }
    return
  }

  // Anthropic (Claude)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const stream = client.messages.stream({ model: ANTHROPIC_MODEL, max_tokens: maxTokens, system, messages })
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text
  }
}

/** Réponse complète, non-streaming. */
export async function chatIA(
  { system, messages, maxTokens = 4000, provider = 'anthropic' }:
  { system: string; messages: IAMessage[]; maxTokens?: number; provider?: Provider },
): Promise<string> {
  if (effectif(provider) === 'deepseek') {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: DEEPSEEK_MODEL, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...messages] }),
    })
    if (!res.ok) throw new Error(`DeepSeek (${res.status}) : ${await res.text().catch(() => '')}`)
    const json = await res.json()
    return json?.choices?.[0]?.message?.content || ''
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({ model: ANTHROPIC_MODEL, max_tokens: maxTokens, system, messages })
  return res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('')
}
