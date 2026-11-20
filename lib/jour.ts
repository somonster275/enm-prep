// Jour calendaire en France (YYYY-MM-DD). Côté serveur (Vercel tourne en UTC), toISOString()
// donnerait la veille entre minuit et 2 h, heure de Paris.
export function jourParis(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(d)
}
