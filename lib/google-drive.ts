/**
 * Connexion Google Drive (OAuth 2.0) — helpers SERVEUR uniquement.
 * Nécessite GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (identifiants OAuth créés
 * dans Google Cloud Console). Les jetons sont stockés dans la table
 * `google_drive_tokens` et ne sont jamais exposés au client.
 */
import { getSupabaseAdmin } from '@/lib/supabase'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://codexprepa.com'
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export const GOOGLE_REDIRECT = `${APP_URL}/api/drive/google/callback`
// Lecture seule du Drive + identité (pour afficher quel compte est connecté).
export const GOOGLE_SCOPE = 'openid email https://www.googleapis.com/auth/drive.readonly'

export const googleConfigure = () => !!(CLIENT_ID && CLIENT_SECRET)

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  modifiedTime?: string
  size?: string
}

export const DOSSIER_MIME = 'application/vnd.google-apps.folder'

export function googleAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: GOOGLE_REDIRECT,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',   // pour obtenir un refresh_token
    prompt: 'consent',        // force le refresh_token même après 1re autorisation
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`
}

type TokenResp = { access_token: string; refresh_token?: string; expires_in: number }

export async function googleExchangeCode(code: string): Promise<TokenResp> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!,
      redirect_uri: GOOGLE_REDIRECT, grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error('Google token exchange: ' + (await res.text()))
  return res.json()
}

async function googleRefresh(refresh_token: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token, client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!, grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Google refresh: ' + (await res.text()))
  return res.json()
}

export async function googleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const j = await res.json()
    return j.email ?? null
  } catch { return null }
}

export async function googleListFiles(accessToken: string, folderId = 'root'): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed = false`
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size)',
    orderBy: 'folder,name',
    pageSize: '300',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Drive list: ' + (await res.text()))
  const j = await res.json()
  return (j.files || []) as DriveFile[]
}

// ---------------------------------------------------------------------------
// Stockage des jetons (service_role : contourne RLS)
// ---------------------------------------------------------------------------

export async function googleSaveTokens(
  userId: string,
  t: { access_token: string; refresh_token?: string; expires_in: number; email?: string | null },
) {
  const admin = getSupabaseAdmin()
  const expiry = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString()
  const payload: Record<string, unknown> = {
    user_id: userId, access_token: t.access_token, expiry, updated_at: new Date().toISOString(),
  }
  if (t.refresh_token) payload.refresh_token = t.refresh_token   // garder l'ancien si non renvoyé
  if (t.email !== undefined) payload.email = t.email
  await admin.from('google_drive_tokens').upsert(payload, { onConflict: 'user_id' })
}

export async function googleStatus(userId: string): Promise<{ connected: boolean; email: string | null }> {
  const admin = getSupabaseAdmin()
  const { data } = await admin.from('google_drive_tokens').select('email').eq('user_id', userId).maybeSingle()
  return data ? { connected: true, email: (data.email as string) ?? null } : { connected: false, email: null }
}

export async function googleDisconnect(userId: string) {
  const admin = getSupabaseAdmin()
  await admin.from('google_drive_tokens').delete().eq('user_id', userId)
}

/** Renvoie un access_token valide (rafraîchi si expiré), ou null si non connecté. */
export async function googleValidAccessToken(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin()
  const { data } = await admin.from('google_drive_tokens').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return null
  if (data.access_token && data.expiry && new Date(data.expiry).getTime() > Date.now()) {
    return data.access_token as string
  }
  if (!data.refresh_token) return null
  const r = await googleRefresh(data.refresh_token as string)
  const expiry = new Date(Date.now() + (r.expires_in - 60) * 1000).toISOString()
  await admin.from('google_drive_tokens').update({ access_token: r.access_token, expiry }).eq('user_id', userId)
  return r.access_token
}
