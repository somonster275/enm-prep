'use client'
import OutilContenu from '@/components/OutilContenu'

export default function MindMapsPage() {
  return (
    <OutilContenu
      table="mindmaps"
      accent="#2DAE83"
      icone="🧠"
      titre="Mind maps"
      description="Cartes mentales et schémas de synthèse, classés par matière (#)."
      lienLabel="Lien vers l'image / le PDF"
      acceptFichier="image/*,application/pdf"
      bucketStorage="mindmaps"
    />
  )
}
