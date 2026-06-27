/**
 * Envoi d'emails via Resend (https://resend.com).
 * ⚠️ Code SERVEUR uniquement (utilise RESEND_API_KEY).
 *
 * FROM par défaut = onboarding@resend.dev : domaine de test Resend qui ne peut
 * écrire QU'À l'adresse du compte Resend. Suffisant pour se notifier soi-même.
 * Pour écrire à n'importe qui (ex. envoyer ses identifiants à un nouvel
 * utilisateur), il faut vérifier un domaine dans Resend et changer EMAIL_FROM.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'codex <onboarding@resend.dev>'
const ADMIN_EMAIL = process.env.ADMIN_NOTIF_EMAIL || 'codex.prepa.dev@gmail.com'

/** Échappe le HTML pour éviter toute injection dans le corps de l'email. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Envoie un email à un destinataire quelconque. Lance une erreur si l'envoi échoue.
 *  ⚠️ En mode test Resend (domaine onboarding@resend.dev), seul l'email du compte
 *  Resend est accepté ; les autres destinataires renvoient une 403 tant qu'un
 *  domaine n'est pas vérifié dans Resend. */
export async function envoyerEmail(to: string, sujet: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY manquante')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject: sujet, html }),
  })
  if (!res.ok) throw new Error(`Resend (${res.status}) : ${await res.text()}`)
}

/** Envoie un email à l'administrateur. */
export async function envoyerEmailAdmin(sujet: string, html: string): Promise<void> {
  return envoyerEmail(ADMIN_EMAIL, sujet, html)
}
