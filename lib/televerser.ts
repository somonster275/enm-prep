import { supabase } from '@/lib/supabase'

// Envoie un fichier DIRECTEMENT à Supabase Storage (adresse signée fournie par le serveur),
// sans passer par une route Vercel, qui refuse tout corps de plus de 4,5 Mo.
export async function televerser(fichier: File, bucket: string): Promise<string> {
  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, nom: fichier.name, taille: fichier.size }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || "Échec de l'envoi du fichier")
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(j.path, j.token, fichier, { contentType: fichier.type })
  if (error) throw new Error(error.message)
  return j.url as string
}
