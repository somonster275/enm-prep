import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hoduewjiaowlvhkngoum.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZHVld2ppYW93bHZoa25nb3VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTY1MDEsImV4cCI6MjA5NDUzMjUwMX0._7BQ2UQteV8Mb-n8-hPQM56bZBDPbx5Oksx0Qo6RuCM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const getSupabaseAdmin = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante')
  return createClient(supabaseUrl, serviceKey)
}