// Helpers de mise en forme de texte, sans dépendance (utilisables client & serveur).

export const sansHtml = (s: string) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Convertit le HTML en texte en préservant les ruptures de blocs (paragraphes,
// listes, sauts de ligne) sous forme de '\n' — pour pouvoir couper proprement.
export const htmlVersTexte = (s: string): string => (s || '')
  .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .split('\n').map(l => l.trim()).filter(Boolean).join('\n')

// Découpe un texte en phrases (fin de phrase OU saut de ligne / paragraphe).
const decouperPhrases = (texte: string): string[] =>
  texte.split(/(?<=[.!?…»])\s+|\n+/).map(s => s.trim()).filter(Boolean)

// Produit une proposition lisible : des PHRASES ENTIÈRES jusqu'à ~maxLen, jamais
// coupées en plein milieu. Ajoute « […] » s'il reste du texte ensuite. Une seule
// phrase trop longue est, en dernier recours, coupée au dernier mot.
export const extraitLisible = (brut: string, maxLen = 280): string => {
  const texte = htmlVersTexte(brut)
  if (texte.length <= maxLen) return texte

  const phrases = decouperPhrases(texte)
  let out = ''
  for (const p of phrases) {
    if (!out) { out = p; continue }
    if ((out + ' ' + p).length > maxLen) break
    out += ' ' + p
  }
  if (out.length > maxLen) {
    const coupe = out.slice(0, maxLen)
    const dernierEspace = coupe.lastIndexOf(' ')
    out = (dernierEspace > 60 ? coupe.slice(0, dernierEspace) : coupe).trim()
  }
  return out.replace(/[.,;:\s]+$/, '') + ' […]'
}

// Texte intégral nettoyé (pour le débrief : on garde les paragraphes en \n).
export const texteComplet = (brut: string, maxLen = 4000): string =>
  htmlVersTexte(brut).slice(0, maxLen)
