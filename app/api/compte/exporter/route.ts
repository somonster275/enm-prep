import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Droit d'accès / portabilité (RGPD art. 15 & 20) : l'utilisateur télécharge
// l'ensemble de ses données personnelles au format JSON.
export async function GET() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const admin = getSupabaseAdmin()

  // Best-effort : on ignore les tables éventuellement absentes (migrations non jouées).
  const tryTable = async (table: string, col: string, val: string) => {
    try {
      const { data } = await admin.from(table).select('*').eq(col, val)
      return data || []
    } catch { return [] }
  }

  const [profil, progression, activite, notes, entraide, drive, remarques, demandes] = await Promise.all([
    tryTable('profils', 'id', user.id),
    tryTable('progression', 'utilisateur_id', user.id),
    tryTable('activite_jours', 'utilisateur_id', user.id),
    tryTable('notes', 'user_id', user.id),
    tryTable('entraide', 'user_id', user.id),
    tryTable('drive_liens', 'user_id', user.id),
    tryTable('remarques_fiches', 'user_id', user.id),
    user.email ? tryTable('demandes_acces', 'email', user.email) : Promise.resolve([]),
  ])

  const exportData = {
    export_genere_le: new Date().toISOString(),
    compte: { id: user.id, email: user.email },
    profil, progression, activite_jours: activite, notes,
    entraide, liens_drive: drive, remarques: remarques, demandes_acces: demandes,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="codex-mes-donnees.json"`,
    },
  })
}
