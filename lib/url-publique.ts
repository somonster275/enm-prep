// Le serveur va chercher des flux (actualités, planning) dont l'adresse vient de l'utilisateur :
// on refuse tout ce qui n'est pas une adresse web publique (réseau local, machine elle-même…).
// Ne vérifie que le nom écrit : côté serveur, passer par fetchPublic (lib/fetch-public.ts) qui vérifie l'IP et les redirections.
export function urlPublique(brute: unknown): string | null {
  let u: URL
  try { u = new URL(String(brute)) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password) return null
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return null
  if (/^(0|10|127)\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return null
  if (/^\d+$/.test(h) || h.includes(':')) return null // IP décimale (2130706433) ou IPv6 : refusées
  return u.toString()
}

/** Lien affichable dans un <a href> : seulement http(s), sinon null (bloque `javascript:`). */
export function lienSur(brut: unknown): string | null {
  return /^https?:\/\//i.test(String(brut ?? '')) ? String(brut) : null
}
