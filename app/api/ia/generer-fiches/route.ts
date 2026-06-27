import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

const SYSTEME = `Tu es un assistant pédagogique pour la préparation au concours de l'ENM (magistrature, droit français).
À partir d'un sujet ou d'un texte de cours, tu génères des fiches de révision sous forme de paires question/réponse, claires et rigoureuses.
- Les questions sont précises et autonomes ; les réponses sont exactes, structurées et concises (2 à 6 phrases, ou une courte liste).
- Reste fidèle au droit français. N'invente pas de règles. Si le texte fourni est insuffisant, base-toi sur les connaissances juridiques standard du programme ENM.
Tu réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, au format :
[{"question": "...", "reponse": "..."}, ...]`

export async function POST(request: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const admin = getSupabaseAdmin()
  const { data: prof } = await admin.from('profils').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin' && prof?.role !== 'editeur') {
    return NextResponse.json({ error: 'Réservé au staff (admin/éditeur)' }, { status: 403 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé Anthropic manquante' }, { status: 500 })
  }

  const { texte, nombre } = await request.json().catch(() => ({}))
  const sujet = String(texte || '').trim()
  if (!sujet) return NextResponse.json({ error: 'Sujet ou texte manquant' }, { status: 400 })
  const n = Math.min(20, Math.max(1, parseInt(String(nombre), 10) || 8))

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let reponse: string
  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEME,
      messages: [{ role: 'user', content: `Génère ${n} fiches de révision à partir de ceci :\n\n${sujet}` }],
    })
    reponse = res.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('')
  } catch (e) {
    return NextResponse.json({ error: `IA : ${String(e)}` }, { status: 502 })
  }

  // Extraction robuste du JSON (au cas où le modèle ajoute des fences ```).
  let fiches: { question: string; reponse: string }[]
  try {
    const debut = reponse.indexOf('[')
    const fin = reponse.lastIndexOf(']')
    const brut = debut >= 0 && fin > debut ? reponse.slice(debut, fin + 1) : reponse
    const parsed = JSON.parse(brut)
    fiches = (Array.isArray(parsed) ? parsed : [])
      .filter((f: { question?: unknown; reponse?: unknown }) => f && typeof f.question === 'string' && typeof f.reponse === 'string')
      .map((f: { question: string; reponse: string }) => ({ question: f.question.trim(), reponse: f.reponse.trim() }))
  } catch {
    return NextResponse.json({ error: "La génération n'a pas produit de fiches exploitables. Réessaie." }, { status: 502 })
  }

  if (fiches.length === 0) return NextResponse.json({ error: 'Aucune fiche générée. Précise davantage le sujet.' }, { status: 502 })
  return NextResponse.json({ fiches })
}
