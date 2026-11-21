'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { lirePartage, importer, type Paquet } from '@/lib/partage'
import { rafraichir } from '@/lib/hors-ligne'

const NOMS = { fiche: 'fiche', qcm_question: 'question', cours: 'cours', mindmap: 'mind map' } as const

/** Lien de partage : aperçu du module partagé et ajout à « Mon espace ». */
export default function PartagePage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [p, setP] = useState<Paquet | null>(null)
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'introuvable' | 'ajout'>('chargement')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    lirePartage(id)
      .then(x => { setP(x); setEtat(x ? 'pret' : 'introuvable') })
      .catch(e => { setErreur('Erreur : ' + (e as Error).message); setEtat('introuvable') })
  }, [id])

  const ajouter = async () => {
    if (!p) return
    setEtat('ajout'); setErreur('')
    try {
      const pid = await importer(p)
      await rafraichir()
      router.push(`/mon-espace/${pid}`)
    } catch (e) { setErreur('Erreur : ' + (e as Error).message); setEtat('pret') }
  }

  const font = 'var(--font-texte)'
  const detail = p && (Object.keys(NOMS) as (keyof typeof NOMS)[])
    .map(t => [t, p.elements.filter(e => e.type === t).length] as const).filter(([, n]) => n > 0)
    .map(([t, n]) => `${n} ${NOMS[t]}${n > 1 && t !== 'cours' ? 's' : ''}`).join(' · ')

  return (
    <div style={{ paddingTop: 34, maxWidth: 560, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      {etat === 'chargement' ? (
        <div style={{ textAlign: 'center', color: 'var(--c-annotation-clair)', padding: 40 }}>Chargement…</div>
      ) : !p ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontFamily: 'var(--font-titre)', fontSize: 24, marginBottom: 8 }}>Lien de partage introuvable</div>
          <p style={{ color: 'var(--c-annotation)', fontSize: 14 }}>{erreur || "Ce partage a été arrêté par son auteur, ou le lien est incomplet."}</p>
          <Link href="/mon-espace" style={{ color: 'var(--c-accent)', fontWeight: 600 }}>Mon espace</Link>
        </div>
      ) : (
        <div style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '24px 26px' }}>
          <div style={{ fontSize: 13, color: 'var(--c-annotation)' }}>Module partagé avec toi</div>
          <h1 style={{ fontFamily: 'var(--font-titre)', fontWeight: 'var(--titre-poids)', fontSize: 26, margin: '4px 0 6px' }}>{p.nom}</h1>
          <div style={{ fontSize: 14, color: 'var(--c-texte-doux)', marginBottom: 18 }}>{detail || 'Module vide'}</div>
          <button onClick={ajouter} disabled={etat === 'ajout'} style={{ padding: '11px 20px', borderRadius: 6, border: 'none', background: 'var(--c-accent)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: font, cursor: 'pointer', opacity: etat === 'ajout' ? 0.6 : 1 }}>
            {etat === 'ajout' ? 'Ajout…' : 'Ajouter à mon espace'}
          </button>
          <p style={{ fontSize: 12.5, color: 'var(--c-annotation-clair)', margin: '12px 0 0' }}>Tu obtiens ta propre copie, modifiable pour toi seul.</p>
          {erreur && <p role="alert" style={{ fontSize: 13, color: 'var(--c-accent)', margin: '10px 0 0' }}>{erreur}</p>}
        </div>
      )}
    </div>
  )
}
