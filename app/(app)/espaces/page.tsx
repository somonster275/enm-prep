'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Espace } from '@/types'
import Link from 'next/link'

const COULEURS = [
  '#DC4A2B', '#E8A11E', '#0F6E56', '#2563EB', '#7C3AED',
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

  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"

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

  const champ: React.CSSProperties = {
    width: '100%', height: 44, border: '1.5px solid #EADFC9', borderRadius: 10,
    padding: '0 12px', background: '#FFFBF2', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: font, color: '#2A2018',
  }

  return (
    <div onClick={onFermer} style={{ position: 'fixed', inset: 0, background: 'rgba(40,30,20,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520,
        fontFamily: font, color: '#2A2018', boxShadow: '0 30px 80px -30px rgba(40,30,20,.5)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0E7D6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 20 }}>Nouvel espace de révision</div>
          <button onClick={onFermer} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9A8D72', lineHeight: 1 }}>✕</button>
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
                  height: 44, border: '1.5px solid #EADFC9', borderRadius: 10, padding: '0 28px 0 10px',
                  background: '#FFFBF2', fontSize: 20, cursor: 'pointer', outline: 'none', appearance: 'none',
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
              <span style={{ fontWeight: 400, color: '#9A8D72', marginLeft: 6 }}>codexprepa.com/espaces/<b>{slug || '…'}</b></span>
            </div>
            <input value={slug} onChange={e => { setSlugManuel(true); setSlug(e.target.value) }}
              placeholder="ex. droit-civil" style={champ} />
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5C4A22', marginBottom: 6 }}>Description <span style={{ fontWeight: 400, color: '#9A8D72' }}>(optionnelle)</span></div>
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
          <div style={{ background: '#FFFBF2', border: '1px solid #F0E7D6', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9A8D72', marginBottom: 10 }}>Aperçu</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: couleur + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icone}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{nom || 'Nom de la matière'}</div>
                {description && <div style={{ fontSize: 12.5, color: '#9A8D72', marginTop: 2 }}>{description}</div>}
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: couleur, background: couleur + '18', padding: '2px 8px', borderRadius: 999 }}>Voir le contenu →</span>
                </div>
              </div>
            </div>
          </div>

          {erreur && <div style={{ fontSize: 13, color: '#D94A30', background: '#FEF2F0', border: '1px solid #F9C5BB', borderRadius: 8, padding: '10px 12px' }}>{erreur}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F0E7D6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onFermer} style={{ height: 40, padding: '0 18px', border: '1px solid #EADFC9', borderRadius: 10, background: 'transparent', color: '#8A7E68', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
            Annuler
          </button>
          <button onClick={valider} disabled={loading} style={{ height: 40, padding: '0 22px', border: 'none', borderRadius: 10, background: '#DC4A2B', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: font, opacity: loading ? 0.7 : 1 }}>
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

  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"

  if (loading) return (
    <div style={{ paddingTop: '4rem', textAlign: 'center', color: '#9A8D72', fontFamily: font }}>Chargement…</div>
  )

  return (
    <div style={{ paddingTop: '34px', fontFamily: font, color: '#2A2018' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: '-.01em' }}>
            Vos espaces
          </div>
          <div style={{ fontSize: 15, color: '#8A7E68', marginTop: 4 }}>
            {espaces.length} matière{espaces.length > 1 ? 's' : ''} à réviser.
          </div>
        </div>
        {estAdmin && (
          <button onClick={() => setModalOuvert(true)} style={{
            display: 'flex', alignItems: 'center', gap: 7, height: 40, padding: '0 18px',
            border: '1.5px dashed #DC4A2B', borderRadius: 12, background: '#FFF4F2',
            color: '#DC4A2B', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font,
          }}>
            + Ajouter un espace
          </button>
        )}
      </div>

      {espaces.length === 0 ? (
        <div style={{ fontSize: 14, color: '#9A8D72', textAlign: 'center', padding: '4rem 0' }}>
          Aucun espace pour le moment.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {/* Carte « Révision mixte » */}
          <Link href="/espaces/_/revision?mixte=1" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#FCEFE9', borderRadius: 18, padding: 22, border: '1.5px solid #F3C6BC', cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#DC4A2B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>🔀</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Révision mixte</div>
              <div style={{ fontSize: 13, color: '#A8705F', marginTop: 4 }}>40 fiches dues tirées au hasard, toutes matières mélangées — l&apos;entraînement le plus efficace.</div>
              <div style={{ marginTop: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#DC4A2B', padding: '3px 10px', borderRadius: 999 }}>Démarrer →</span>
              </div>
            </div>
          </Link>

          {/* Carte « Carnet d'erreurs » */}
          <Link href="/carnet" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#FCEEEA', borderRadius: 18, padding: 22, border: '1.5px solid #F3C6BC', cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#C0392B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>📕</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Carnet d&apos;erreurs</div>
              <div style={{ fontSize: 13, color: '#A8705F', marginTop: 4 }}>Tes fiches difficiles (mal notées) rassemblées pour les revoir en priorité.</div>
              <div style={{ marginTop: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#C0392B', padding: '3px 10px', borderRadius: 999 }}>Ouvrir →</span>
              </div>
            </div>
          </Link>

          {/* Carte « Mes favoris » */}
          <Link href="/espaces/_/revision?favoris=1" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#FDF3DD', borderRadius: 18, padding: 22, border: '1.5px solid #F0DBA6', cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#E8A11E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>★</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Mes favoris</div>
              <div style={{ fontSize: 13, color: '#9A7B33', marginTop: 4 }}>Réviser les fiches que tu as étoilées comme importantes.</div>
              <div style={{ marginTop: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#E8A11E', padding: '3px 10px', borderRadius: 999 }}>Réviser →</span>
              </div>
            </div>
          </Link>

          {/* Carte « Recherche » */}
          <Link href="/recherche" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: '#fff', borderRadius: 18, padding: 22, border: '1px solid #F0E7D6', cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#EFE7D7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>🔎</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Recherche</div>
              <div style={{ fontSize: 13, color: '#9A8D72', marginTop: 4 }}>Retrouver une notion par mot-clé dans toutes les fiches.</div>
              <div style={{ marginTop: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7E68', background: '#FDF6EA', padding: '3px 10px', borderRadius: 999, border: '1px solid #EADFC9' }}>Ouvrir →</span>
              </div>
            </div>
          </Link>

          {espaces.map(espace => (
            <Link key={espace.id} href={`/espaces/${espace.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ background: '#fff', borderRadius: 18, padding: 22, border: '1px solid #F0E7D6', cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: espace.couleur + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>
                  {espace.icone || '📚'}
                </div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{espace.nom}</div>
                {espace.description && (
                  <div style={{ fontSize: 13, color: '#9A8D72', marginTop: 4 }}>{espace.description}</div>
                )}
                <div style={{ marginTop: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: espace.couleur, background: espace.couleur + '18', padding: '3px 10px', borderRadius: 999 }}>Voir le contenu →</span>
                </div>
              </div>
            </Link>
          ))}

          {/* Card admin : ajouter un espace */}
          {estAdmin && (
            <button onClick={() => setModalOuvert(true)} style={{
              background: '#FFFBF2', borderRadius: 18, padding: 22,
              border: '2px dashed #EADFC9', cursor: 'pointer', textAlign: 'left',
              fontFamily: font, color: '#9A8D72', display: 'flex', flexDirection: 'column',
              alignItems: 'flex-start', gap: 8, minHeight: 140,
            }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#F0E7D6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>＋</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#5C4A22' }}>Ajouter une matière</div>
              <div style={{ fontSize: 13, color: '#9A8D72' }}>Créer un nouvel espace de révision.</div>
            </button>
          )}
        </div>
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
