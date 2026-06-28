import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

const BUCKETS = ['mindmaps', 'medias', 'qcm']

export async function POST() {
  let admin
  try {
    admin = getSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Clé service role manquante' }, { status: 500 })
  }

  // Réservé au staff (création de buckets via service_role).
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data: prof } = await admin.from('profils').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin' && prof?.role !== 'editeur') {
    return NextResponse.json({ error: 'Réservé au staff' }, { status: 403 })
  }

  const results: Record<string, string> = {}
  for (const bucket of BUCKETS) {
    const { data: existing } = await admin.storage.getBucket(bucket)
    if (existing) {
      results[bucket] = 'exists'
      continue
    }
    const { error } = await admin.storage.createBucket(bucket, { public: true, allowedMimeTypes: null, fileSizeLimit: null })
    results[bucket] = error ? `error: ${error.message}` : 'created'
  }

  return NextResponse.json({ results })
}
