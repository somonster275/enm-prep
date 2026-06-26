'use client'
import OutilContenu from '@/components/OutilContenu'

export default function MediaPage() {
  return (
    <OutilContenu
      table="medias"
      accent="#3B82D9"
      icone="🎧"
      titre="Audio & Vidéo"
      description="Podcasts, enregistrements et vidéos, classés par matière (#)."
      withType
      lienLabel="Lien du média (URL)"
      acceptFichier="audio/*,video/*"
      bucketStorage="medias"
    />
  )
}
