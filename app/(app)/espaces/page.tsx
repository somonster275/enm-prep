'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace } from '@/types'
import Link from 'next/link'
import { useEchap } from '@/lib/useEchap'

const COULEURS = [
  'var(--c-accent)', '#E8A11E', '#0F6E56', '#2563EB', '#7C3AED',
  '#DB2777', '#0891B2', '#65A30D', '#9A3412', '#374151',
]
const ICONES = ['📚', '⚖️', '🏛️', '📜', '🔬', '🌍', '💰', '🏥', '🎓', '📊', '🗳️', '🤝', '🛡️', '⚙️', '🌿']

function toSlug(nom: string) {
  return nom.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function ModalAjoutEspace({ onFermer, onAjoute }: { onFermer: () => void; onAjoute: (e: Espace) => void }) {
  const [nom, setNom] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuel, setSlugManuel] = useState(false)
  const [description, setDescription] = useState('')
  const [couleur, setCouleur] = useState(COULEURS[0])
  const [icone, setIcone] = useState(ICONES[0])
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)

  const font = "var(--font-texte)"
  const display = "var(--font-titre)"

  const handleNom = (v: string) => {
    setNom(v)
    if (!slugManuel) setSlug(toSlug(v))
  }

  const valider = async () => {
    setErreur('')
    if (!nom.trim()) { setErreur('Le nom est requis.'); return }
    if (!slug.trim()) { setErreur('Le slug est requis.'); return }
    if (!/^[a-z0-9-]+$/.test(slug)) { setErreur('Le slug ne doit contenir que des lettres minuscules, chiffres et tirets.'); return }
    setLoading(true)

    // ordre = max actuel + 1
    const { data: derniers } = await supabase.from('espaces').select('ordre').order('ordre', { ascending: false }).limit(1)
    const ordre = ((derniers?.[0]?.ordre) ?? 0) + 1

    const { data, error } = await supabase
      .from('espaces')
      .insert({ nom: nom.trim(), slug: slug.trim(), description: description.trim(), couleur, icone, ordre })
      .select()
      .single()

    setLoading(false)
    if (error) { setErreur(error.message); return }
    onAjoute(data as Espace)
    onFermer()
  }

  useEchap(true, onFermer) // la modale n'est montée que lorsqu'elle est ouverte

  const champ: React.CSSProperties = {
    width: '100%', height: 44, border: '1.5px solid var(--c-filet-fort)', borderRadius: 6,
    padding: '0 12px', background: 'var(--c-papier)', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: font, color: 'var(--c-encre)',
  }

  return (
    <div onClick={onFermer} style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,20,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        background: '#FFFEFB', borderRadius: 6, width: '100%', maxWidth: 520,
        fontFamily: font, color: 'var(--c-encre)', boxShadow: '0 30px 80px -30px rgba(40,30,20,.5)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--c-filet)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: display, fontWeight: 'var(--titre-poids)', fontSize: 20 }}>Nouvel espace de révision</div>
          <button onClick={onFermer} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--c-annotation-clair)', lineHeight: 1 }}>✕</button>
        </div>

        {/* Corps */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Icône + Nom */}
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Sélecteur icône */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4A22', marginBottom: 6 }}>Icône</div>
              <div style={{ position: 'relative' }}>
                <select value={icone} onChange={e => setIcone(e.target.value)} style={{
                  height: 44, border: '1.5px solid var(--c-filet-fort)', borderRadius: 6, padding: '0 28px 0 10px',
                  background: 'var(--c-papier)', fontSize: 20, cursor: 'pointer', outline: 'none', appearance: 'none',
                }}>
                  {ICONES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            {/* Nom */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4A22', marginBottom: 6 }}>Nom de la matière *</div>
              <input value={nom} onChange={e => handleNom(e.target.value)} placeholder="ex. Droit civil" style={champ} />
            </div>
          </div>

          {/* Slug */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4A22', marginBottom: 6 }}>
              Identifiant URL (slug) *
              <span style={{ fontWeight: 400, color: 'var(--c-annotation-clair)', marginLeft: 6 }}>codexprepa.com/espaces/<b>{slug || '…'}</b></span>
            </div>
            <input value={slug} onChange={e => { setSlugManuel(true); setSlug(e.target.value) }}
              placeholder="ex. droit-civil" style={champ} />
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4A22', marginBottom: 6 }}>Description <span style={{ fontWeight: 400, color: 'var(--c-annotation-clair)' }}>(optionnelle)</span></div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brève description de la matière…" rows={2}
              style={{ ...champ, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          {/* Couleur */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4A22', marginBottom: 8 }}>Couleur</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COULEURS.map(c => (
                <button key={c} onClick={() => setCouleur(c)} style={{
                  width: 32, height: 32, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: couleur === c ? `3px solid ${c}` : 'none',
                  outlineOffset: 2, transform: couleur === c ? 'scale(1.15)' : 'none', transition: 'transform .15s',
                }} />
              ))}
            </div>
          </div>

          {/* Aperçu */}
          <div style={{ background: 'var(--c-papier)', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: 'var(--c-annotation-clair)', marginBottom: 10 }}>Aperçu</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 6, background: couleur + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icone}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{nom || 'Nom de la matière'}</div>
                {description && <div style={{ fontSize: 12.5, color: 'var(--c-annotation-clair)', marginTop: 2 }}>{description}</div>}
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: couleur, background: couleur + '18', padding: '2px 8px', borderRadius: 999 }}>Voir le contenu →</span>
                </div>
              </div>
            </div>
          </div>

          {erreur && <div style={{ fontSize: 13, color: 'var(--c-accent)', background: '#FEF2F0', border: '1px solid #F9C5BB', borderRadius: 8, padding: '10px 12px' }}>{erreur}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--c-filet)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onFermer} style={{ height: 40, padding: '0 18px', border: '1px solid var(--c-filet-fort)', borderRadius: 6, background: 'transparent', color: 'var(--c-annotation)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
            Annuler
          </button>
          <button onClick={valider} disabled={loading} style={{ height: 40, padding: '0 22px', border: 'none', borderRadius: 6, background: 'var(--c-accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: font, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Création…' : 'Créer l\'espace'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EspacesPage() {
  const [espaces, setEspaces] = useState<Espace[]>([])
  const [loading, setLoading] = useState(true)
  const [estAdmin, setEstAdmin] = useState(false)
  const [modalOuvert, setModalOuvert] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profil } = await supabase.from('profils').select('role').eq('id', user.id).single()
        if (profil?.role === 'admin') setEstAdmin(true)
      }
      const { data: esp } = await supabase.from('espaces').select('*').order('ordre')
      setEspaces(esp || [])
      setLoading(false)
    }
    load()
  }, [])

  const font = "var(--font-texte)"
  const display = "var(--font-titre)"

  if (loading) return (
    <div style={{ paddingTop: '4rem', textAlign: 'center', color: 'var(--c-annotation-clair)', fontFamily: font }}>Chargement…</div>
  )

  return (
    <div style={{ paddingTop: '34px', fontFamily: font, color: 'var(--c-encre)' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: display, fontWeight: 'var(--titre-poids)', fontSize: 36, letterSpacing: '-.015em', margin: 0 }}>
            Vos matières
          </h1>
          <div style={{ fontSize: 15, color: 'var(--c-annotation)', marginTop: 4 }}>
            {espaces.length} matière{espaces.length > 1 ? 's' : ''} à réviser.
          </div>
        </div>
        {estAdmin && (
          <button onClick={() => setModalOuvert(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px',
            border: '1px solid var(--c-filet-fort)', borderRadius: 6, background: 'transparent',
            color: 'var(--c-encre)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font,
          }}>
            Ajouter une matière
          </button>
        )}
      </div>

      {espaces.length === 0 ? (
        <div style={{ fontSize: 15, color: 'var(--c-annotation)', textAlign: 'center', padding: '4rem 0' }}>
          Aucune matière pour le moment.
        </div>
      ) : (
        <>
          {/* Autres façons de réviser : une bande de liens, la révision mixte en tête */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 0, background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, marginBottom: 28 }}>
            {[
              { href: '/espaces/_/revision?mixte=1', titre: 'Révision mixte', desc: '40 fiches dues, toutes matières mélangées.', fort: true },
              { href: '/carnet', titre: "Carnet d'erreurs", desc: 'Vos fiches mal notées, à revoir en priorité.' },
              { href: '/espaces/_/revision?favoris=1', titre: 'Mes favoris', desc: 'Les fiches que vous avez marquées.' },
              { href: '/recherche', titre: 'Recherche', desc: 'Retrouver une notion dans toutes les fiches.' },
            ].map(l => (
              <Link key={l.href} href={l.href} className="lien-revision" style={{
                textDecoration: 'none', color: 'inherit', padding: '16px 20px', minWidth: 0,
                boxShadow: l.fort ? 'inset 0 3px 0 var(--c-accent)' : 'none',
              }}>
                <div style={{ fontFamily: display, fontWeight: 600, fontSize: 18, color: l.fort ? 'var(--c-accent)' : 'var(--c-encre)' }}>{l.titre}</div>
                <div style={{ fontSize: 13.5, color: 'var(--c-annotation)', marginTop: 3, lineHeight: 1.45 }}>{l.desc}</div>
              </Link>
            ))}
          </div>

          {/* Les matières : une tranche de couleur par espace, comme un code sur l'étagère */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
            {espaces.map(espace => (
              <Link key={espace.id} href={`/espaces/${espace.slug}`} className="carte-matiere" style={{
                textDecoration: 'none', color: 'inherit', display: 'flex', minWidth: 0,
                background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, overflow: 'hidden',
              }}>
                <span aria-hidden style={{ width: 10, flexShrink: 0, background: espace.couleur }} />
                <span style={{ padding: '18px 20px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: display, fontWeight: 600, fontSize: 21, lineHeight: 1.2 }}>{espace.nom}</span>
                  {espace.description && <span style={{ fontSize: 14, color: 'var(--c-annotation)', lineHeight: 1.45 }}>{espace.description}</span>}
                  <span style={{ fontSize: 14, color: 'var(--c-annotation)', marginTop: 8, textDecoration: 'underline', textUnderlineOffset: 3 }}>Ouvrir la matière</span>
                </span>
              </Link>
            ))}

            {estAdmin && (
              <button onClick={() => setModalOuvert(true)} style={{
                background: 'transparent', borderRadius: 6, padding: '18px 20px',
                border: '1px dashed var(--c-filet-fort)', cursor: 'pointer', textAlign: 'left',
                fontFamily: font, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 100,
              }}>
                <span style={{ fontFamily: display, fontWeight: 600, fontSize: 19, color: 'var(--c-encre)' }}>Ajouter une matière</span>
                <span style={{ fontSize: 14, color: 'var(--c-annotation)' }}>Créer un nouvel espace de révision.</span>
              </button>
            )}
          </div>
          <style>{`
            .lien-revision + .lien-revision { border-left: 1px solid var(--c-filet) }
            @media (max-width: 768px) { .lien-revision + .lien-revision { border-left: none; border-top: 1px solid var(--c-filet) } }
            .lien-revision:hover, .carte-matiere:hover { background: var(--c-papier-teinte) !important }
          `}</style>
        </>
      )}

      {modalOuvert && (
        <ModalAjoutEspace
          onFermer={() => setModalOuvert(false)}
          onAjoute={e => setEspaces(prev => [...prev, e])}
        />
      )}
    </div>
  )
}
