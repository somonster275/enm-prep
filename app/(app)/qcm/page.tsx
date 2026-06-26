'use client'
import OutilContenu from '@/components/OutilContenu'

export default function QcmPage() {
  return (
    <OutilContenu
      table="qcm"
      accent="#E8A11E"
      icone="✅"
      titre="QCM"
      description="Questionnaires à choix multiples, classés par matière (#)."
      lienLabel="Lien du QCM"
      acceptFichier="application/pdf,text/html,.html"
      bucketStorage="qcm"
    />
  )
}
