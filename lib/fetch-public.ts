import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { urlPublique } from './url-publique'

// Serveur uniquement. Comme fetch, mais refuse toute adresse dont l'IP résolue est privée,
// et revérifie chaque redirection (sinon un site public pourrait rediriger vers 169.254.169.254).
// shortcut: fetch résout le DNS une seconde fois (rebinding très rapide possible), acceptable sur Vercel sans réseau interne.
export function ipPrivee(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, '')
  if (isIP(v) === 4) {
    const [a, b] = v.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
}

export async function fetchPublic(brute: string, init: RequestInit = {}, maxSauts = 5): Promise<Response> {
  let url = brute
  for (let saut = 0; ; saut++) {
    const ok = urlPublique(url)
    if (!ok) throw new Error('Adresse refusée')
    const ips = await lookup(new URL(ok).hostname, { all: true })
    if (!ips.length || ips.some(a => ipPrivee(a.address))) throw new Error('Adresse refusée')
    const res = await fetch(ok, { ...init, redirect: 'manual' })
    const loc = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !loc) return res
    if (saut >= maxSauts) throw new Error('Trop de redirections')
    url = new URL(loc, ok).toString()
    if (res.status !== 307 && res.status !== 308) init = { ...init, method: 'GET', body: undefined }
  }
}
