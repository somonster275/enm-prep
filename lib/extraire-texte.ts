// Extraction du texte d'un PDF / Word / TXT dans le NAVIGATEUR : on n'envoie au serveur
// que le texte, car Vercel refuse tout corps de requête de plus de 4,5 Mo.
export async function extraireTexte(fichier: File): Promise<string> {
  const nom = fichier.name.toLowerCase()
  if (fichier.type === 'text/plain' || nom.endsWith('.txt')) return fichier.text()
  if (fichier.type === 'application/pdf' || nom.endsWith('.pdf')) {
    const { extractText } = await import('unpdf')
    return (await extractText(new Uint8Array(await fichier.arrayBuffer()), { mergePages: true })).text
  }
  if (nom.endsWith('.docx') || nom.endsWith('.doc') || fichier.type.includes('word')) {
    const mammoth = await import('mammoth')
    return (await mammoth.extractRawText({ arrayBuffer: await fichier.arrayBuffer() })).value
  }
  throw new Error(`Format non supporté : ${fichier.type || fichier.name}`)
}
