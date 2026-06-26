import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const BUCKETS = ['mindmaps', 'medias', 'qcm']

export async function POST() {
  let admin
  try {
    admin = getSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Clé service role manquante' }, { status: 500 })
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
