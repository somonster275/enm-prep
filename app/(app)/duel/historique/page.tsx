'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Ligne = {
  matchId: string; titre: string; date: string | null; total: number
  score: number; justes: number; rang: number; nb: number
}

const FONT = "'Hanken Grotesk', sans-serif"
const DISPLAY = "'Bricolage Grotesque', sans-serif"

export default function HistoriqueDuels() {
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ joues: 0, victoires: 0, tauxJustes: 0 })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Mes participations à des matchs terminés.
      const { data: miennes } = await supabase
        .from('match_joueurs')
        .select('match_id, score, justes, matchs!inner(titre, statut, ended_at, deck)')
        .eq('user_id', user.id)
        .eq('matchs.statut', 'termine')
        .order('joined_at', { ascending: false })
        .limit(40)

      const rows = (miennes || []) as any[]
      if (rows.length === 0) { setLoading(false); return }

      // Tous les joueurs de ces matchs, pour calculer le rang et le nb de participants.
      const ids = rows.map(r => r.match_id)
      const { data: tous } = await supabase.from('match_joueurs').select('match_id, user_id, score').in('match_id', ids)
      const parMatch: Record<string, { user_id: string; score: number }[]> = {}
      for (const j of (tous || []) as { match_id: string; user_id: string; score: number }[]) {
        ;(parMatch[j.match_id] ||= []).push(j)
      }

      const out: Ligne[] = rows.map(r => {
        const joueurs = (parMatch[r.match_id] || []).sort((a, b) => b.score - a.score)
        const rang = joueurs.findIndex(j => j.user_id === user.id) + 1
        const m = Array.isArray(r.matchs) ? r.matchs[0] : r.matchs
        return {
          matchId: r.match_id, titre: m?.titre || 'Match', date: m?.ended_at || null,
          total: Array.isArray(m?.deck) ? m.deck.length : 0,
          score: r.score, justes: r.justes, rang: rang || 0, nb: joueurs.length,
        }
      })

      const victoires = out.filter(l => l.rang === 1).length
      const totJustes = out.reduce((s, l) => s + l.justes, 0)
      const totQ = out.reduce((s, l) => s + l.total, 0)
      setStats({ joues: out.length, victoires, tauxJustes: totQ > 0 ? Math.round((totJustes / totQ) * 100) : 0 })
      setLignes(out)
      setLoading(false)
    }
    load()
  }, [])

  const dateFr = (s: string | null) => s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''

  return (
    <div style={{ paddingTop: 34, maxWidth: 720, margin: '0 auto', fontFamily: FONT, color: '#2A2018' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, margin: 0 }}>Mes duels</h1>
        <Link href="/duel" style={{ fontSize: 13.5, color: '#9A8D72', textDecoration: 'none' }}>← Retour aux duels</Link>
      </div>

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : lignes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>
          Tu n&apos;as pas encore terminé de duel. <Link href="/duel" style={{ color: '#DC4A2B', fontWeight: 700 }}>Lance ton premier match !</Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
            {[
              { l: 'Matchs joués', v: stats.joues, c: '#2A2018' },
              { l: 'Victoires 🥇', v: stats.victoires, c: '#DC4A2B' },
              { l: 'Bonnes réponses', v: `${stats.tauxJustes}%`, c: '#0F6E56' },
            ].map(s => (
              <div key={s.l} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 14, padding: 16, textAlign: 'center' }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 12.5, color: '#8A7E68', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lignes.map(l => (
              <div key={l.matchId} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 16px' }}>
                <span style={{ fontSize: 18, width: 30, textAlign: 'center' }}>{l.rang === 1 ? '🥇' : l.rang === 2 ? '🥈' : l.rang === 3 ? '🥉' : `#${l.rang}`}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.titre}</div>
                  <div style={{ fontSize: 12, color: '#9A8D72' }}>{dateFr(l.date)} · {l.justes}/{l.total} bonnes · {l.nb} joueur{l.nb > 1 ? 's' : ''}</div>
                </div>
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 18, color: '#DC4A2B' }}>{l.score}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
