'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { parseTags } from '@/lib/tags'

type Res = { id: string; titre: string; sous: string; href: string }
type Groupe = { cle: string; label: string; icone: string; couleur: string; items: Res[] }

const stripHtml = (s: string) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

export default function RecherchePage() {
  const [q, setQ] = useState('')
  const [groupes, setGroupes] = useState<Groupe[]>([])
  const [loading, setLoading] = useState(false)
  const [cherche, setCherche] = useState(false)

  const lancer = async () => {
    // Mode TAG : si la requête contient des #tags, on cherche par chevauchement
    // de tags à travers toutes les ressources (relie les contenus entre eux).
    const tags = parseTags((q.match(/#[^\s,]+/g) || []).join(' '))
    if (tags.length > 0) { await chercherParTags(tags); return }

    const terme = q.trim().replace(/[,()%*]/g, ' ').trim()
    if (terme.length < 2) return
    setLoading(true); setCherche(true)
    const like = `%${terme}%`

    const [fiches, qcms, medias, annales, forum] = await Promise.all([
      supabase.from('fiches').select('id, question, reponse, module_id, modules(nom, espaces(nom, slug))')
        .or(`question.ilike.${like},reponse.ilike.${like}`).is('deleted_at', null).eq('suspendu', false).limit(30),
      supabase.from('qcm').select('id, titre, matiere').or(`titre.ilike.${like},matiere.ilike.${like}`).limit(15),
      supabase.from('medias').select('id, titre, description, espaces(nom)')
        .or(`titre.ilike.${like},description.ilike.${like}`).is('deleted_at', null).limit(15),
      supabase.from('annales').select('id, titre, matiere, url').or(`titre.ilike.${like}`).limit(15),
      supabase.from('forum_questions').select('id, titre, matiere').or(`titre.ilike.${like},corps.ilike.${like}`).limit(15),
    ])

    const g: Groupe[] = []
    const ff = (fiches.data || []).map((r: any) => ({
      id: r.id, titre: stripHtml(r.question).slice(0, 140),
      sous: [r.modules?.espaces?.nom, r.modules?.nom].filter(Boolean).join(' › ') || stripHtml(r.reponse).slice(0, 90),
      href: r.modules?.espaces ? `/espaces/${r.modules.espaces.slug}/modules/${r.module_id}` : '#',
    }))
    if (ff.length) g.push({ cle: 'fiches', label: 'Fiches', icone: '🗂️', couleur: '#DC4A2B', items: ff })

    const qq = (qcms.data || []).map((r: any) => ({ id: r.id, titre: r.titre, sous: r.matiere || 'QCM', href: '/qcm' }))
    if (qq.length) g.push({ cle: 'qcm', label: 'QCM', icone: '✅', couleur: '#E8A11E', items: qq })

    const mm = (medias.data || []).map((r: any) => ({ id: r.id, titre: r.titre, sous: [r.espaces?.nom, stripHtml(r.description || '').slice(0, 70)].filter(Boolean).join(' · ') || 'Vidéo / audio', href: '/media' }))
    if (mm.length) g.push({ cle: 'media', label: 'Audio & Vidéo', icone: '🎬', couleur: '#3B82D9', items: mm })

    const aa = (annales.data || []).map((r: any) => ({ id: r.id, titre: r.titre, sous: r.matiere || 'Annale', href: '/annales' }))
    if (aa.length) g.push({ cle: 'annales', label: 'Annales', icone: '📚', couleur: '#1A56C4', items: aa })

    const pp = (forum.data || []).map((r: any) => ({ id: r.id, titre: r.titre, sous: r.matiere || 'Forum', href: '/forum' }))
    if (pp.length) g.push({ cle: 'forum', label: 'Forum', icone: '💬', couleur: '#0F6E56', items: pp })

    setGroupes(g)
    setLoading(false)
  }

  // Recherche par tags : chevauchement (&&) sur fiches, QCM, vidéos/audios, cours.
  const chercherParTags = async (tags: string[]) => {
    setLoading(true); setCherche(true)
    const [fiches, qcms, medias, cours] = await Promise.all([
      supabase.from('fiches').select('id, question, reponse, module_id, modules(nom, espaces(nom, slug))')
        .overlaps('tags', tags).is('deleted_at', null).eq('suspendu', false).limit(30),
      supabase.from('qcm').select('id, titre, matiere').overlaps('tags', tags).limit(15),
      supabase.from('medias').select('id, titre, description, type, url, espaces(nom)').overlaps('tags', tags).is('deleted_at', null).limit(15),
      supabase.from('cours').select('id, titre, matiere, type').overlaps('tags', tags).limit(15),
    ])
    const g: Groupe[] = []
    const ff = (fiches.data || []).map((r: any) => ({
      id: r.id, titre: stripHtml(r.question).slice(0, 140),
      sous: [r.modules?.espaces?.nom, r.modules?.nom].filter(Boolean).join(' › ') || stripHtml(r.reponse).slice(0, 90),
      href: r.modules?.espaces ? `/espaces/${r.modules.espaces.slug}/modules/${r.module_id}` : '#',
    }))
    if (ff.length) g.push({ cle: 'fiches', label: 'Fiches', icone: '🗂️', couleur: '#DC4A2B', items: ff })
    const qq = (qcms.data || []).map((r: any) => ({ id: r.id, titre: r.titre, sous: r.matiere || 'QCM', href: '/qcm' }))
    if (qq.length) g.push({ cle: 'qcm', label: 'QCM', icone: '✅', couleur: '#E8A11E', items: qq })
    const mm = (medias.data || []).map((r: any) => ({ id: r.id, titre: r.titre, sous: r.espaces?.nom || 'Vidéo / audio', href: r.url || '/media' }))
    if (mm.length) g.push({ cle: 'media', label: 'Audio & Vidéo', icone: '🎬', couleur: '#3B82D9', items: mm })
    const cc = (cours.data || []).map((r: any) => ({ id: r.id, titre: r.titre, sous: r.matiere || 'Cours', href: `/cours?c=${r.id}` }))
    if (cc.length) g.push({ cle: 'cours', label: 'Cours', icone: '📘', couleur: '#3B82D9', items: cc })
    setGroupes(g)
    setLoading(false)
  }

  const total = groupes.reduce((s, g) => s + g.items.length, 0)
  const font = "'Hanken Grotesk', sans-serif"

  return (
    <div style={{ paddingTop: 34, maxWidth: 760, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>Rechercher</h1>
      <p style={{ fontSize: 15, color: '#8A7E68', margin: '8px 0 20px' }}>Dans tes fiches, QCM, vidéos, annales et le forum — par mot-clé, ou par <b style={{ color: '#7C5CBF' }}>#tag</b> pour relier les ressources d&apos;un même thème.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') lancer() }} autoFocus
          placeholder="Ex. « prescription », « dol », ou « #droit-penal »…"
          style={{ flex: 1, border: '1.5px solid #EADFC9', borderRadius: 12, padding: '12px 16px', background: '#FFFBF2', fontSize: 15, outline: 'none', fontFamily: font }} />
        <button onClick={lancer} disabled={q.trim().length < 2} style={{ padding: '0 22px', borderRadius: 12, background: '#DC4A2B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14.5, fontWeight: 700, opacity: q.trim().length < 2 ? 0.5 : 1, fontFamily: font }}>Chercher</button>
      </div>

      {loading ? (
        <div style={{ color: '#9A8D72', textAlign: 'center', padding: 30 }}>Recherche…</div>
      ) : cherche && total === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A8D72', background: '#FFFBF2', border: '1px dashed #EADFC9', borderRadius: 16 }}>Aucun résultat pour « {q} ».</div>
      ) : total > 0 ? (
        <>
          <div style={{ fontSize: 13, color: '#9A8D72', marginBottom: 14 }}>{total} résultat{total > 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {groupes.map(grp => (
              <div key={grp.cle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span>{grp.icone}</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{grp.label}</span>
                  <span style={{ fontSize: 12, color: '#9A8D72' }}>· {grp.items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {grp.items.map(it => (
                    <Link key={it.id} href={it.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 15px', borderLeft: `3px solid ${grp.couleur}` }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>{it.titre}</div>
                        {it.sous && <div style={{ fontSize: 12.5, color: '#9A8D72', marginTop: 3 }}>{it.sous}</div>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
