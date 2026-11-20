import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

const TAILLE_MAX = 50 * 1024 * 1024 // 50 Mo
const EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'mp3', 'm4a', 'wav', 'ogg', 'mp4', 'webm', 'mov',
  'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'odp', 'ods', 'txt', 'csv']

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

  // Le fichier ne transite plus par ici : on renvoie une adresse d'envoi signée.
  const { bucket, nom, taille } = await request.json().catch(() => ({}))
  if (!bucket || !nom) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }
  // Seuls les buckets applicatifs connus sont autorisés (pas de cible arbitraire).
  if (!['mindmaps', 'medias', 'qcm', 'cours'].includes(bucket)) {
    return NextResponse.json({ error: 'Bucket non autorisé' }, { status: 400 })
  }
  if (Number(taille) > TAILLE_MAX) {
    return NextResponse.json({ error: 'Fichier trop volumineux (50 Mo max)' }, { status: 413 })
  }

  // Buckets publics : pas de html / svg / js, qui s'exécuteraient sur le domaine de stockage.
  const ext = String(nom).split('.').pop()?.toLowerCase() || ''
  if (!EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 415 })
  }
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data: signe, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !signe) {
    console.error('storage/upload:', error?.message)
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 })
  }

  const { data } = admin.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ path: signe.path, token: signe.token, url: data.publicUrl })
}
