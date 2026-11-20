// Découpe un texte en passages d'environ `taille` caractères pour la recherche (RAG).
// Les PDF donnent souvent des \n simples : un paragraphe trop long est redécoupé par phrases,
// puis en tranches fixes si une « phrase » dépasse encore la taille.
function decouper(p: string, taille: number): string[] {
  if (p.length <= taille) return [p]
  const morceaux: string[] = []
  let courant = ''
  for (const phrase of p.split(/(?<=[.!?;:])\s+|\n+/)) {
    for (let i = 0; i < phrase.length; i += taille) {
      const bout = phrase.slice(i, i + taille)
      if (courant && (courant + ' ' + bout).length > taille) { morceaux.push(courant); courant = bout }
      else courant = courant ? courant + ' ' + bout : bout
    }
  }
  if (courant) morceaux.push(courant)
  return morceaux
}

export function chunker(texte: string, taille = 800, chevauchement = 100): string[] {
  const paragraphes = texte.split(/\n{2,}/).flatMap(p => decouper(p, taille))
  const chunks: string[] = []
  let courant = ''
  for (const p of paragraphes) {
    if ((courant + '\n\n' + p).length > taille && courant) {
      chunks.push(courant.trim())
      // Chevauchement plafonné en caractères (couper sur les espaces laissait grossir un texte sans espaces).
      const fin = courant.slice(-chevauchement)
      courant = fin.slice(fin.indexOf(' ') + 1) + '\n\n' + p
    } else {
      courant = courant ? courant + '\n\n' + p : p
    }
  }
  if (courant.trim()) chunks.push(courant.trim())
  return chunks.filter(c => c.length > 30)
}
