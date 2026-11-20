'use client'
import { useEffect, useState } from 'react'
import RichContent from '@/components/RichContent'

type Remarque = {
  id: string
  message: string
  statut: string
  created_at: string
  fiche_id: string
  fiches: { question: string; modules: { nom: string; espaces: { nom: string; slug: string } | null } | null } | null
  auteur: { email: string; prenom: string | null; nom: string | null } | null
}

export default function AdminRemarques() {
  const [remarques, setRemarques] = useState<Remarque[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'nouveau' | 'tous'>('nouveau')

  const charger = async () => {
    const res = await fetch('/api/admin/remarques')
    const json = await res.json().catch(() => ({ remarques: [] }))
    setRemarques(json.remarques || [])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const agir = async (id: string, action: 'traite' | 'nouveau' | 'supprimer') => {
    if (action === 'supprimer' && !confirm('Supprimer définitivement cette remarque ?')) return
    // Optimiste
    setRemarques(rs => action === 'supprimer'
      ? rs.filter(r => r.id !== id)
      : rs.map(r => r.id === id ? { ...r, statut: action } : r))
    await fetch('/api/admin/remarques', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
  }

  const font = "var(--font-texte)"
  const visibles = remarques.filter(r => filtre === 'tous' || r.statut === 'nouveau')
  const nbNouveau = remarques.filter(r => r.statut === 'nouveau').length

  const auteurNom = (a: Remarque['auteur']) =>
    a ? ([a.prenom, a.nom].filter(Boolean).join(' ') || a.email) : 'Étudiant'

  return (
    <div style={{ paddingTop: 34, maxWidth: 820, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 800, fontSize: 26, margin: 0 }}>Remarques des étudiants</h1>
        <div style={{ display: 'flex', gap: 6, background: '#fff', border: '1px solid var(--c-filet)', borderRadius: 11, padding: 3 }}>
          {(['nouveau', 'tous'] as const).map(f => (
            <button key={f} onClick={() => setFiltre(f)} style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font,
              background: filtre === f ? 'var(--c-accent)' : 'transparent', color: filtre === f ? '#fff' : 'var(--c-annotation)',
            }}>{f === 'nouveau' ? `À traiter${nbNouveau ? ` (${nbNouveau})` : ''}` : 'Toutes'}</button>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 14.5, color: 'var(--c-annotation)', margin: '0 0 22px' }}>
        Les retours des étudiants sur les fiches. Tu décides d&apos;en tenir compte ou non.
      </p>

      {loading ? (
        <div style={{ color: 'var(--c-annotation-clair)', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-annotation-clair)', background: 'var(--c-papier)', border: '1px dashed var(--c-filet-fort)', borderRadius: 16 }}>
          {filtre === 'nouveau' ? 'Aucune remarque à traiter. 🎉' : 'Aucune remarque pour l’instant.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visibles.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid var(--c-filet)', borderRadius: 16, padding: 18, opacity: r.statut === 'traite' ? 0.65 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--c-annotation)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--c-encre)' }}>{auteurNom(r.auteur)}</span>
                  {r.fiches?.modules?.espaces && <span> · {r.fiches.modules.espaces.nom}</span>}
                  {r.fiches?.modules && <span> › {r.fiches.modules.nom}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--c-annotation-clair)' }}>{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  {r.statut === 'traite' && <span style={{ fontSize: 11, fontWeight: 700, color: '#0F6E56', background: '#ECF7F0', padding: '3px 9px', borderRadius: 999 }}>Traité</span>}
                </div>
              </div>

              {/* Fiche concernée */}
              {r.fiches?.question && (
                <div style={{ background: 'var(--c-papier)', border: '1px solid var(--c-filet)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--c-discret)', letterSpacing: '.06em', marginBottom: 4 }}>FICHE CONCERNÉE</div>
                  <RichContent html={r.fiches.question} style={{ fontSize: 13, color: 'var(--c-texte-doux)', lineHeight: 1.5 }} />
                </div>
              )}

              {/* Message */}
              <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--c-encre)', whiteSpace: 'pre-wrap' }}>{r.message}</div>

              {/* Liens vers la fiche + actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {r.fiches?.modules?.espaces && (
                  <a href={`/espaces/${r.fiches.modules.espaces.slug}`} style={{ fontSize: 12.5, fontWeight: 700, color: '#1A56C4', textDecoration: 'none', alignSelf: 'center', marginRight: 'auto' }}>Voir l&apos;espace ↗</a>
                )}
                {r.statut === 'nouveau' ? (
                  <button onClick={() => agir(r.id, 'traite')} style={{ padding: '8px 14px', borderRadius: 9, background: '#ECF7F0', color: '#0F6E56', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font }}>Marquer traité</button>
                ) : (
                  <button onClick={() => agir(r.id, 'nouveau')} style={{ padding: '8px 14px', borderRadius: 9, background: 'var(--c-papier-teinte)', color: 'var(--c-annotation)', border: '1px solid var(--c-filet-fort)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font }}>Rouvrir</button>
                )}
                <button onClick={() => agir(r.id, 'supprimer')} style={{ padding: '8px 14px', borderRadius: 9, background: 'var(--c-accent-pale)', color: 'var(--c-accent)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font }}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
