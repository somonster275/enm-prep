import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js' // utilisé uniquement pour getSupabaseAdmin

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hoduewjiaowlvhkngoum.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZHVld2ppYW93bHZoa25nb3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTY1MDEsImV4cCI6MjA5NDUzMjUwMX0._7BQ2UQteV8Mb-n8-hPQM56bZBDPbx5Oksx0Qo6RuCM'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export const getSupabaseAdmin = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante')
  return createClient(supabaseUrl, serviceKey)
}

/**
 * Écriture côté client vérifiée. La requête doit finir par `.select('id')` : un refus RLS ne renvoie
 * pas d'erreur, seulement 0 ligne. Prévient l'utilisateur et renvoie false si rien n'a été écrit.
 * `vide: true` quand 0 ligne est un résultat normal (purge, module sans fiche…).
 */
export async function ecrire(
  q: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  { vide = false }: { vide?: boolean } = {},
): Promise<boolean> {
  const { data, error } = await q
  if (error || (!vide && !data?.length)) {
    console.error('Écriture refusée :', error?.message ?? '0 ligne (droits insuffisants ?)')
    if (typeof window !== 'undefined') window.alert("L'opération n'a pas pu être enregistrée. Vérifie ta connexion ou tes droits, puis réessaie.")
    return false
  }
  return true
}

// PostgREST plafonne chaque réponse à 1 000 lignes : on enchaîne les pages.
// `page(de, a)` doit appliquer `.range(de, a)` sur une requête triée (ordre stable).
const PAGE = 1000
export async function toutesLesLignes<T>(
  page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const lignes: T[] = []
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await page(de, de + PAGE - 1)
    if (error) return { data: lignes, error }
    lignes.push(...(data || []))
    if (!data || data.length < PAGE) return { data: lignes, error: null }
  }
}
