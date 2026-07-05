// Mélange de Fisher-Yates : distribution uniforme et non biaisée.
// Remplace `arr.sort(() => Math.random() - 0.5)`, dont la distribution dépend de
// l'algorithme de tri du moteur (biais réel, surtout sur de grands tableaux).
export function melange<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
