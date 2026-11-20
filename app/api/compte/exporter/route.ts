import { NextResponse } from 'next/server'
import { getSupabaseAdmin, toutesLesLignes } from '@/lib/supabase'
import { utilisateurCourant } from '@/lib/auth-serveur'

export const dynamic = 'force-dynamic'

// Droit d'accès / portabilité (RGPD art. 15 & 20) : l'utilisateur télécharge
// l'ensemble de ses données personnelles au format JSON.
export async function GET() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = getSupabaseAdmin()

  // Rate-limit persistant : 1 export par 24 h.
  const { data: ok } = await admin.rpc('consommer_quota', {
    p_user: user.id, p_action: 'export', p_max: 1, p_fenetre: '24 hours',
  })
  if (ok === false) {
    return NextResponse.json({ error: 'Export déjà effectué dans les dernières 24 h. Réessaie demain.' }, { status: 429 })
  }

  // Best-effort : on ignore les tables éventuellement absentes (migrations non jouées).
  // `ordre` = clé unique pour paginer au-delà du plafond de 1 000 lignes.
  const tryTable = async (table: string, col: string, val: string, ordre = ['id']) => {
    try {
      const { data, error } = await toutesLesLignes((de, a) => {
        let q = admin.from(table).select('*').eq(col, val)
        for (const o of ordre) q = q.order(o)
        return q.range(de, a)
      })
      return error ? [] : data
    } catch { return [] }
  }
  const u = user.id

  // Toutes les tables qui contiennent des données de l'utilisateur (sauf les jetons Google Drive, secrets techniques).
  const tables: Record<string, Promise<unknown[]>> = {
    profil: tryTable('profils', 'id', u),
    progression: tryTable('progression', 'utilisateur_id', u, ['fiche_id']),
    activite_jours: tryTable('activite_jours', 'utilisateur_id', u, ['jour']),
    nouvelles_cartes_jours: tryTable('nouvelles_jours', 'user_id', u, ['jour']),
    pauses: tryTable('pauses', 'user_id', u),
    favoris: tryTable('favoris', 'user_id', u, ['fiche_id']),
    notes: tryTable('notes', 'user_id', u),
    coach_messages: tryTable('coach_messages', 'user_id', u),
    usage_ia: tryTable('ia_usage', 'user_id', u, ['jour']),
    qcm_resultats: tryTable('qcm_resultats', 'user_id', u),
    qcm_reponses: tryTable('qcm_reponses', 'user_id', u, ['question_id']),
    medias_vus: tryTable('media_vues', 'user_id', u, ['media_id']),
    duels_crees: tryTable('matchs', 'hote_id', u),
    duels_participations: tryTable('match_joueurs', 'user_id', u, ['match_id']),
    duels_reponses: tryTable('match_reponses', 'user_id', u, ['match_id', 'q_index']),
    forum_questions: tryTable('forum_questions', 'user_id', u),
    forum_reponses: tryTable('forum_reponses', 'user_id', u),
    astuces: tryTable('astuces', 'user_id', u),
    annales: tryTable('annales', 'user_id', u),
    contributions: tryTable('contributions', 'user_id', u),
    remarques: tryTable('remarques_fiches', 'user_id', u),
    remarques_cours: tryTable('cours_remarques', 'user_id', u),
    notifications: tryTable('notifications', 'user_id', u),
    entraide: tryTable('entraide', 'user_id', u, ['user_id']),
    liens_drive: tryTable('drive_liens', 'user_id', u),
    documents_importes: tryTable('cours_documents', 'created_by', u),
    demandes_acces: user.email ? tryTable('demandes_acces', 'email', user.email) : Promise.resolve([]),
  }
  const valeurs = await Promise.all(Object.values(tables))

  const exportData = {
    export_genere_le: new Date().toISOString(),
    compte: { id: user.id, email: user.email },
    ...Object.fromEntries(Object.keys(tables).map((k, i) => [k, valeurs[i]])),
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="codex-mes-donnees.json"`,
    },
  })
}
