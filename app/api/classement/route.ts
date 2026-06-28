import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Début de la semaine ISO (lundi) au format YYYY-MM-DD.
function lundiDeLaSemaine(): string {
  const d = new Date()
  const jour = (d.getDay() + 6) % 7 // 0 = lundi
  d.setDate(d.getDate() - jour)
  return d.toISOString().slice(0, 10)
}

// Classement hebdomadaire ANONYME : nombre de cartes révisées cette semaine.
// On n'expose aucun nom, seulement les rangs, les totaux, et un repère « moi ».
export async function GET() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const debut = lundiDeLaSemaine()

  const { data } = await admin
    .from('activite_jours')
    .select('utilisateur_id, cartes, jour')
    .gte('jour', debut)

  const totaux = new Map<string, number>()
  for (const r of (data || []) as { utilisateur_id: string; cartes: number }[]) {
    totaux.set(r.utilisateur_id, (totaux.get(r.utilisateur_id) || 0) + (r.cartes || 0))
  }

  const tries = [...totaux.entries()].map(([uid, cartes]) => ({ uid, cartes })).sort((a, b) => b.cartes - a.cartes)
  const monTotal = totaux.get(user.id) || 0
  const monRang = tries.findIndex(t => t.uid === user.id) + 1 // 0 si absent

  const classement = tries.slice(0, 15).map((t, i) => ({ rang: i + 1, cartes: t.cartes, moi: t.uid === user.id }))

  return NextResponse.json({
    semaineDebut: debut,
    participants: tries.length,
    moi: { rang: monRang, cartes: monTotal },
    classement,
  })
}
