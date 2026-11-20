'use client'
import { useEffect, useState } from 'react'

const FONT = "var(--font-texte)"
const DISPLAY = "var(--font-titre)"

type Auteur = { email: string; prenom: string | null; nom: string | null }
type QCM = { enonce: string; options: { t: string; c: boolean }[]; explication?: string }
type Contribution = {
  id: string; type: string; statut: string; titre: string | null; matiere: string | null
  module_id: string | null; created_at: string; auteur: Auteur | null
  payload: { question?: string; reponse?: string; questions?: QCM[] }
}

const STATUT: Record<string, { t: string; bg: string; c: string }> = {
  nouveau: { t: 'En attente', bg: '#FCEFD3', c: '#8A5A10' },
  approuve: { t: 'Publié', bg: '#ECF7F0', c: '#0E5A47' },
  refuse: { t: 'Refusé', bg: '#FCEEEA', c: '#A8453B' },
}

export default function AdminContributions() {
  const [items, setItems] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState<'nouveau' | 'tous'>('nouveau')
  const [busy, setBusy] = useState('')
  const [erreur, setErreur] = useState('')

  const charger = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/contributions')
    const j = await res.json().catch(() => ({}))
    setItems((j.contributions || []) as Contribution[])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const agir = async (id: string, action: 'approuver' | 'refuser' | 'supprimer') => {
    if (action === 'supprimer' && !confirm('Supprimer définitivement cette proposition ?')) return
    setBusy(id); setErreur('')
    const res = await fetch('/api/admin/contributions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) { setErreur(j.error || 'Action impossible.'); return }
    charger()
  }

  const auteurNom = (a: Auteur | null) => a ? ([a.prenom, a.nom].filter(Boolean).join(' ') || a.email) : 'Étudiant'
  const visibles = filtre === 'nouveau' ? items.filter(i => i.statut === 'nouveau') : items

  const btn = (bg: string): React.CSSProperties => ({ border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, background: bg, color: '#fff' })

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: FONT, color: 'var(--c-encre)' }}>
      <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, margin: 0 }}>Contributions</h1>
      <p style={{ fontSize: 15, color: 'var(--c-annotation)', margin: '8px 0 18px' }}>Propositions de fiches et de QCM des étudiants. Approuver crée le contenu pour tous.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['nouveau', 'tous'] as const).map(f => (
          <button key={f} onClick={() => setFiltre(f)} style={{ padding: '6px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: FONT, background: filtre === f ? 'var(--c-accent)' : '#fff', color: filtre === f ? '#fff' : 'var(--c-annotation)', border: `1px solid ${filtre === f ? 'var(--c-accent)' : 'var(--c-filet)'}` }}>
            {f === 'nouveau' ? 'À traiter' : 'Toutes'}
          </button>
        ))}
      </div>

      {erreur && <div style={{ fontSize: 13.5, color: '#C0392B', marginBottom: 12 }}>{erreur}</div>}

      {loading ? (
        <div style={{ color: 'var(--c-annotation-clair)', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-annotation-clair)', background: 'var(--c-papier)', border: '1px dashed var(--c-filet-fort)', borderRadius: 6 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📭</div>Aucune proposition {filtre === 'nouveau' ? 'à traiter' : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibles.map(c => {
            const s = STATUT[c.statut] || STATUT.nouveau
            return (
              <div key={c.id} style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18 }}>{c.type === 'qcm' ? '✅' : '📇'}</span>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{c.titre || (c.type === 'qcm' ? 'QCM' : 'Fiche')}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: s.c, background: s.bg, borderRadius: 999, padding: '3px 10px' }}>{s.t}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--c-annotation-clair)' }}>par {auteurNom(c.auteur)}</span>
                </div>

                {/* Aperçu du contenu */}
                {c.type === 'fiche' ? (
                  <div style={{ background: 'var(--c-papier)', border: '1px solid var(--c-filet)', borderRadius: 6, padding: 12, fontSize: 13.5, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700 }}>Q. {c.payload.question}</div>
                    <div style={{ color: '#5C5448', marginTop: 6, whiteSpace: 'pre-wrap' }}>R. {c.payload.reponse}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(c.payload.questions || []).map((q, i) => (
                      <div key={i} style={{ background: 'var(--c-papier)', border: '1px solid var(--c-filet)', borderRadius: 6, padding: 12, fontSize: 13.5 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{i + 1}. {q.enonce}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {q.options.map((o, oi) => (
                            <div key={oi} style={{ color: o.c ? '#0E5A47' : '#5C5448', fontWeight: o.c ? 700 : 400 }}>{o.c ? '✓' : '•'} {o.t}</div>
                          ))}
                        </div>
                        {q.explication && <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--c-texte-doux)' }}>💡 {q.explication}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {c.statut !== 'approuve' && (
                    <button onClick={() => agir(c.id, 'approuver')} disabled={busy === c.id} style={btn('#0F8B5F')}>{busy === c.id ? '…' : '✓ Approuver & publier'}</button>
                  )}
                  {c.statut === 'nouveau' && (
                    <button onClick={() => agir(c.id, 'refuser')} disabled={busy === c.id} style={{ ...btn('#fff'), color: 'var(--c-annotation)', border: '1px solid var(--c-filet-fort)' }}>Refuser</button>
                  )}
                  <button onClick={() => agir(c.id, 'supprimer')} disabled={busy === c.id} style={{ ...btn('#fff'), color: '#C0392B', border: '1px solid var(--c-accent-bord)' }}>Supprimer</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
