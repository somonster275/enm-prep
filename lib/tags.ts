// Tags (#) : normalisation et analyse. Un tag = un slug court en minuscules,
// sans accents ni espaces (ex. « Droit Pénal » → « droit-penal »).

export function normaliserTag(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^#+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Extrait une liste de tags d'une saisie libre (« #a #b, c » → ['a','b','c']).
export function parseTags(input: string): string[] {
  return [...new Set((input || '').split(/[\s,]+/).map(normaliserTag).filter(Boolean))]
}

// Nettoie/dédoublonne un tableau de tags (venant de la base ou du client).
export function nettoyerTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return [...new Set(tags.map(t => normaliserTag(String(t))).filter(Boolean))]
}

// Affichage « #a #b » pour l'édition libre.
export function tagsVersTexte(tags: string[]): string {
  return (tags || []).map(t => `#${t}`).join(' ')
}
