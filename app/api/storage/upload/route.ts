import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

const TAILLE_MAX = 50 * 1024 * 1024 // 50 Mo

export async function POST(request: NextRequest) {
  let admin
  try {
    admin = getSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Clé service role manquante' }, { status: 500 })
  }

  // Réservé au staff : cette route écrit via service_role (contourne le RLS storage).
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data: prof } = await admin.from('profils').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin' && prof?.role !== 'editeur') {
    return NextResponse.json({ error: 'Réservé au staff' }, { status: 403 })
  }

  const form = await request.formData()
  const fichier = form.get('fichier') as File | null
  const bucket = form.get('bucket') as string | null

  if (!fichier || !bucket) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }
  // Seuls les buckets applicatifs connus sont autorisés (pas de cible arbitraire).
  if (!['mindmaps', 'medias', 'qcm', 'cours'].includes(bucket)) {
    return NextResponse.json({ error: 'Bucket non autorisé' }, { status: 400 })
  }
  if (fichier.size > TAILLE_MAX) {
    return NextResponse.json({ error: 'Fichier trop volumineux (50 Mo max)' }, { status: 413 })
  }

  const ext = fichier.name.split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await fichier.arrayBuffer())

  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: fichier.type,
    upsert: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = admin.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
