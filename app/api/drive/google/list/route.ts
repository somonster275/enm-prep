import { NextResponse, type NextRequest } from 'next/server'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { googleValidAccessToken, googleListFiles } from '@/lib/google-drive'

export const dynamic = 'force-dynamic'

// Liste les dossiers/fichiers d'un dossier Drive (root par défaut).
export async function GET(req: NextRequest) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const token = await googleValidAccessToken(user.id)
  if (!token) return NextResponse.json({ error: 'non_connecte' }, { status: 409 })

  const folderId = new URL(req.url).searchParams.get('folderId') || 'root'
  try {
    const files = await googleListFiles(token, folderId)
    return NextResponse.json({ files })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
