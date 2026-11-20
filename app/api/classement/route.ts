import { NextResponse } from 'next/server'
import { getSupabaseAdmin, toutesLesLignes } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'
import { jourParis } from '@/lib/jour'

export const dynamic = 'force-dynamic'

// Début de la semaine ISO (lundi) au format YYYY-MM-DD.
function lundiDeLaSemaine(): string {
  const d = new Date(jourParis() + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7) // recule jusqu'au lundi
  return d.toISOString().slice(0, 10)
}

// Classement hebdomadaire ANONYME : nombre de cartes révisées cette semaine.
// On n'expose aucun nom, seulement les rangs, les totaux, et un repère « moi ».
export async function GET() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const debut = lundiDeLaSemaine()

  // Paginé : au-delà de 1 000 lignes (≈ 140 étudiants actifs sur 7 jours), Supabase tronque.
  const { data } = await toutesLesLignes((de, a) => admin
    .from('activite_jours')
    .select('utilisateur_id, cartes, jour')
    .gte('jour', debut)
    .order('utilisateur_id').order('jour')
    .range(de, a))

  const totaux = new Map<string, number>()
  for (const r of (data || []) as { utilisateur_id: string; cartes: number }[]) {
    totaux.set(r.utilisateur_id, (totaux.get(r.utilisateur_id) || 0) + (r.cartes || 0))
  }

  const tries = [...totaux.entries()].map(([uid, cartes]) => ({ uid, cartes })).sort((a, b) => b.cartes - a.cartes)
  const monTotal = totaux.get(user.id) || 0
  const monIdx = tries.findIndex(t => t.uid === user.id)
  const monRang = monIdx >= 0 ? monIdx + 1 : 0 // 0 = pas encore dans le classement

  const classement = tries.slice(0, 15).map((t, i) => ({ rang: i + 1, cartes: t.cartes, moi: t.uid === user.id }))

  return NextResponse.json({
    semaineDebut: debut,
    participants: tries.length,
    moi: { rang: monRang, cartes: monTotal },
    classement,
  })
}
