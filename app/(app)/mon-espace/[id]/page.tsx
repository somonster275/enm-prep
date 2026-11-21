'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { lienSur } from '@/lib/url-publique'
import { rafraichir, instantane, muter, telechargerFichiers, fichiersEnCache, lienFichier } from '@/lib/hors-ligne'
import RichContent from '@/components/RichContent'
import RichEditor from '@/components/RichEditor'
import {
  contenuOfficiel, calculerNouveautes, appliquerNouveautes, estModifie,
  type PersoModule, type PersoElement, type Nouveautes, type Contenu, type TypeElement,
} from '@/lib/espace-perso'

type QOption = { t: string; c: boolean }
const font = 'var(--font-texte)'
const SECTIONS: { type: TypeElement; titre: string }[] = [
  { type: 'fiche', titre: 'Fiches' },
  { type: 'qcm_question', titre: 'Questions' },
  { type: 'cours', titre: 'Cours' },
  { type: 'mindmap', titre: 'Mind maps' },
]
const VIDES: Record<TypeElement, Contenu> = {
  fiche: { question: '', reponse: '', tags: [] },
  qcm_question: { enonce: '', options: [{ t: '', c: true }, { t: '', c: false }], explication: null, cas: null, reponses_ok: null, reponse_affichee: null },
  cours: { titre: '', description: null, fichier_url: null, fichier_nom: null, type: null },
  mindmap: { titre: '', url: null },
}

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 6, border: '1.5px solid var(--c-filet-fort)',
  fontSize: 13.5, fontFamily: font, background: 'var(--c-papier)', color: 'var(--c-encre)', outline: 'none',
}
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--c-annotation)', display: 'block', margin: '10px 0 5px' }
const bouton = (fond: string, texte: string): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 8, background: fond, color: texte, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
})

export default function CopiePersoPage() {
  const { id } = useParams() as { id: string }
  const [pm, setPm] = useState<PersoModule | null>(null)
  const [elements, setElements] = useState<PersoElement[]>([])
  const [nouv, setNouv] = useState<Nouveautes | null>(null)
  const [loading, setLoading] = useState(true)
  const [edition, setEdition] = useState<{ id: string | null; type: TypeElement; brouillon: Contenu } | null>(null)
  const [msg, setMsg] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [fichiers, setFichiers] = useState<{ total: number; enCache: number }>({ total: 0, enCache: 0 })
  const [version, setVersion] = useState(0) // +1 = recharger après une modification
  // Après une écriture locale, relire la copie locale suffit ; le réseau sert à l'ouverture et après une mise à jour.
  const reseau = useRef(true)
  const charger = (viaReseau = false) => { reseau.current = viaReseau; setVersion(v => v + 1) }

  useEffect(() => { (async () => {
    const viaReseau = reseau.current
    const s = viaReseau ? await rafraichir() : await instantane()
    const m = s?.modules.find(x => x.id === id) ?? null
    const liste = (s?.elements || []).filter(e => e.perso_module_id === id)
      .sort((a, b) => a.ordre - b.ordre || a.created_at.localeCompare(b.created_at))
    setPm(m)
    setElements(liste)
    setLoading(false)
    const urls = liste.flatMap(e => lienSur(e.contenu.fichier_url ?? e.contenu.url) ?? [])
    setFichiers({ total: urls.length, enCache: await fichiersEnCache(urls) })
    // Les nouveautés de l'original ne se comparent qu'en ligne.
    if (viaReseau && navigator.onLine && m?.source_type && m.source_id) {
      const off = await contenuOfficiel(m.source_type, m.source_id)
      setNouv(off ? calculerNouveautes(liste, off.elements) : null)
    }
  })() }, [id, version])

  const afficher = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }
  const ordreMax = elements.reduce((mx, e) => Math.max(mx, e.ordre), 0)

  const garderFichiers = async () => {
    setOccupe(true)
    const urls = elements.filter(e => !e.supprime).flatMap(e => lienSur(e.contenu.fichier_url ?? e.contenu.url) ?? [])
    const n = await telechargerFichiers(urls)
    setFichiers({ total: urls.length, enCache: n })
    setOccupe(false)
    afficher(n === urls.length ? 'Fichiers disponibles hors ligne' : `Erreur : ${urls.length - n} fichier(s) non téléchargé(s)`)
  }

  const recuperer = async () => {
    if (!nouv) return
    setOccupe(true)
    const err = await appliquerNouveautes(id, nouv, ordreMax)
    setOccupe(false)
    afficher(err ? 'Erreur : ' + err : 'Mise à jour récupérée')
    setNouv(null)
    charger(true)
  }

  const enregistrer = async (brouillon: Contenu) => {
    if (!edition) return
    const { id: eid, type } = edition
    // Id créé ici : l'ajout peut attendre le réseau sans risque de doublon.
    await muter(eid
      ? { table: 'perso_elements', action: 'update', filtre: { id: eid }, champs: { contenu: brouillon } }
      : { table: 'perso_elements', action: 'upsert', ligne: {
          id: crypto.randomUUID(), perso_module_id: id, type, contenu: brouillon, ordre: ordreMax + 1,
          source_id: null, origine: null, supprime: false, created_at: new Date().toISOString(),
        } })
    setEdition(null)
    afficher(eid ? 'Modification enregistrée' : 'Ajouté')
    charger()
  }

  const supprimer = async (e: PersoElement) => {
    if (!confirm('Supprimer cet élément de ta copie ?')) return
    // Élément issu de l'officiel : on le marque supprimé pour que la prochaine mise à jour ne le repropose pas.
    await muter(e.source_id
      ? { table: 'perso_elements', action: 'update', filtre: { id: e.id }, champs: { supprime: true } }
      : { table: 'perso_elements', action: 'delete', filtre: { id: e.id } })
    charger()
  }

  const maj = async (e: PersoElement, champs: Partial<PersoElement>, m: string) => {
    await muter({ table: 'perso_elements', action: 'update', filtre: { id: e.id }, champs })
    afficher(m)
    charger()
  }

  if (loading) return <div style={{ paddingTop: '4rem', textAlign: 'center', color: 'var(--c-annotation-clair)', fontFamily: font }}>Chargement…</div>
  if (!pm) return <div style={{ paddingTop: '4rem', textAlign: 'center', color: 'var(--c-annotation-clair)', fontFamily: font }}>Copie introuvable.</div>

  const visibles = elements.filter(e => !e.supprime)
  const nb = (t: TypeElement) => visibles.filter(e => e.type === t).length
  const retires = new Set(nouv?.retires)
  const aMettreAJour = nouv ? nouv.ajouts.length + nouv.majs.length + nouv.conserves.length : 0
  // On peut ajouter des fiches à un module, des questions à un QCM.
  const ajoutable: TypeElement | null = pm.source_type === 'qcm' ? 'qcm_question' : pm.source_type === 'mindmap' ? null : 'fiche'

  return (
    <div style={{ paddingTop: 34, maxWidth: 820, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      <div style={{ fontSize: 13, color: 'var(--c-annotation-clair)', marginBottom: 16 }}>
        <Link href="/mon-espace" style={{ color: 'var(--c-annotation-clair)', textDecoration: 'none' }}>Mon espace</Link>
        {' / '}<span style={{ color: 'var(--c-encre)', fontWeight: 600 }}>{pm.nom}</span>
      </div>

      <div style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '22px 26px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-titre)', fontWeight: 'var(--titre-poids)', fontSize: 24 }}>{pm.nom}</div>
          <div style={{ fontSize: 13, color: 'var(--c-annotation)', marginTop: 4 }}>Ta copie personnelle · {visibles.length} élément{visibles.length > 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {nb('fiche') > 0 && <Link href={`/espaces/mon-espace/revision?perso=${id}`} style={{ padding: '10px 18px', borderRadius: 6, background: 'var(--c-accent)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Réviser</Link>}
          {nb('qcm_question') > 0 && <Link href={`/qcm?perso=${id}`} style={{ padding: '10px 18px', borderRadius: 6, background: 'var(--c-accent)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Faire le QCM</Link>}
          {fichiers.total > 0 && (fichiers.enCache >= fichiers.total
            ? <span style={{ fontSize: 12.5, color: '#0E7C63', alignSelf: 'center' }}>Fichiers gardés hors ligne</span>
            : <button onClick={garderFichiers} disabled={occupe} style={{ ...bouton('var(--c-papier-teinte)', 'var(--c-encre)'), padding: '10px 14px', fontSize: 13, border: '1px solid var(--c-filet-fort)', opacity: occupe ? 0.6 : 1 }}>
                Garder les fichiers hors ligne ({fichiers.total - fichiers.enCache})
              </button>)}
          {ajoutable && <button onClick={() => setEdition({ id: null, type: ajoutable, brouillon: structuredClone(VIDES[ajoutable]) })} style={{ ...bouton('var(--c-papier-teinte)', 'var(--c-encre)'), padding: '10px 14px', fontSize: 13, border: '1px solid var(--c-filet-fort)' }}>
            + {ajoutable === 'fiche' ? 'Fiche' : 'Question'}
          </button>}
        </div>
      </div>

      {aMettreAJour > 0 && nouv && (
        <div style={{ background: 'var(--c-papier-chaud)', border: '1px solid #F2D9A0', borderRadius: 6, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>
            <b>L&apos;original a été mis à jour.</b>{' '}
            {[nouv.ajouts.length && `${nouv.ajouts.length} nouveauté${nouv.ajouts.length > 1 ? 's' : ''}`,
              nouv.majs.length && `${nouv.majs.length} élément${nouv.majs.length > 1 ? 's' : ''} corrigé${nouv.majs.length > 1 ? 's' : ''}`].filter(Boolean).join(', ')}
            {nouv.conserves.length > 0 && ` ${nouv.conserves.length} élément${nouv.conserves.length > 1 ? 's' : ''} que tu as modifié${nouv.conserves.length > 1 ? 's' : ''} rester${nouv.conserves.length > 1 ? 'ont' : 'a'} tel${nouv.conserves.length > 1 ? 's' : ''} quel${nouv.conserves.length > 1 ? 's' : ''}.`}
          </div>
          <button onClick={recuperer} disabled={occupe} style={{ ...bouton('var(--c-accent)', '#fff'), padding: '10px 16px', fontSize: 13, opacity: occupe ? 0.6 : 1 }}>
            {occupe ? 'Récupération…' : 'Récupérer'}
          </button>
        </div>
      )}

      {msg && <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 6, marginBottom: 16, color: msg.startsWith('Erreur') ? 'var(--c-accent)' : '#0E7C63', background: msg.startsWith('Erreur') ? 'var(--c-accent-pale)' : '#DDF3EE' }}>{msg}</div>}

      {edition && !edition.id && <Editeur edition={edition} onChange={b => setEdition({ ...edition, brouillon: b })} onSave={enregistrer} onCancel={() => setEdition(null)} />}

      {SECTIONS.filter(s => nb(s.type) > 0).map(s => (
        <div key={s.type} style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-titre)', fontWeight: 'var(--titre-poids)', fontSize: 20, marginBottom: 12 }}>
            {s.titre} <span style={{ fontSize: 14, color: 'var(--c-annotation-clair)', fontFamily: font, fontWeight: 400 }}>({nb(s.type)})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibles.filter(e => e.type === s.type).map(e => edition?.id === e.id ? (
              <Editeur key={e.id} edition={edition} onChange={b => setEdition({ ...edition, brouillon: b })} onSave={enregistrer} onCancel={() => setEdition(null)} />
            ) : (
              <div key={e.id} style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '14px 16px' }}>
                <Apercu e={e} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                  {!e.source_id && <Badge>Ajouté par toi</Badge>}
                  {estModifie(e) && <Badge>Modifié</Badge>}
                  {retires.has(e.id) && <Badge>Retiré de l&apos;original</Badge>}
                  <span style={{ flex: 1 }} />
                  {estModifie(e) && <button onClick={() => maj(e, { contenu: e.origine! }, 'Version officielle rétablie')} style={bouton('var(--c-papier-teinte)', 'var(--c-annotation)')}>Rétablir l&apos;original</button>}
                  {retires.has(e.id) && <button onClick={() => maj(e, { source_id: null }, 'Élément gardé dans ta copie')} style={bouton('var(--c-papier-teinte)', 'var(--c-annotation)')}>Garder</button>}
                  <button onClick={() => setEdition({ id: e.id, type: e.type, brouillon: structuredClone(e.contenu) })} style={bouton('#FCE3D3', 'var(--c-accent)')}>Modifier</button>
                  <button onClick={() => supprimer(e)} style={bouton('var(--c-accent-pale)', 'var(--c-accent)')}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {visibles.length === 0 && !edition && <div style={{ fontSize: 13, color: 'var(--c-annotation-clair)', padding: '1rem 0' }}>Cette copie est vide.</div>}
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-annotation)', border: '1px solid var(--c-filet-fort)', borderRadius: 4, padding: '1px 7px' }}>{children}</span>
}

function Apercu({ e }: { e: PersoElement }) {
  const c = e.contenu
  const lien = lienSur(c.fichier_url ?? c.url)
  if (e.type === 'fiche') return (
    <>
      <RichContent html={String(c.question ?? '')} style={{ fontSize: 14.5, fontWeight: 600 }} />
      <RichContent html={String(c.reponse ?? '')} style={{ fontSize: 13.5, color: 'var(--c-texte-doux)', marginTop: 6 }} />
    </>
  )
  if (e.type === 'qcm_question') {
    const libre = Array.isArray(c.reponses_ok)
    return (
      <>
        {!!c.cas && <div style={{ fontSize: 13, color: 'var(--c-texte-doux)', marginBottom: 6 }}>{String(c.cas)}</div>}
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{String(c.enonce ?? '')}</div>
        {libre
          ? <div style={{ fontSize: 13, color: '#0F6E56', marginTop: 6 }}>Réponse : {String(c.reponse_affichee || (c.reponses_ok as string[])[0] || '')}</div>
          : <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
              {(c.options as QOption[] || []).map((o, i) => <li key={i} style={{ color: o.c ? '#0F6E56' : 'var(--c-texte-doux)', fontWeight: o.c ? 600 : 400 }}>{o.t}{o.c && ' ✓'}</li>)}
            </ul>}
        {!!c.explication && <div style={{ fontSize: 12.5, color: 'var(--c-annotation)', marginTop: 6 }}>Explication. {String(c.explication)}</div>}
      </>
    )
  }
  return (
    <>
      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{String(c.titre ?? '')}{c.type === 'pdf' && <span style={{ fontSize: 12, color: 'var(--c-annotation)', fontWeight: 400 }}> PDF</span>}</div>
      {!!c.description && <div style={{ fontSize: 13, color: 'var(--c-texte-doux)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{String(c.description)}</div>}
      {lien && <a href={lienFichier(lien)} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 12.5, color: '#3B82D9', fontWeight: 600, textDecoration: 'none' }}>Ouvrir →</a>}
    </>
  )
}

function Editeur({ edition, onChange, onSave, onCancel }: {
  edition: { type: TypeElement; brouillon: Contenu }
  onChange: (b: Contenu) => void; onSave: (b: Contenu) => void; onCancel: () => void
}) {
  const b = edition.brouillon
  const set = (k: string, v: unknown) => onChange({ ...b, [k]: v })
  const texte = (k: string, titre: string, multi = false) => (
    <>
      <label style={label}>{titre}</label>
      {multi
        ? <textarea value={String(b[k] ?? '')} onChange={e => set(k, e.target.value || null)} rows={3} style={{ ...input, resize: 'vertical' }} />
        : <input value={String(b[k] ?? '')} onChange={e => set(k, e.target.value)} style={input} />}
    </>
  )
  const options = (b.options as QOption[]) || []
  const setOption = (i: number, o: Partial<QOption>) => set('options', options.map((x, j) => j === i ? { ...x, ...o } : x))
  const valide = edition.type === 'fiche' ? !!b.question && !!b.reponse
    : edition.type === 'qcm_question' ? !!b.enonce && (Array.isArray(b.reponses_ok) ? (b.reponses_ok as string[]).some(r => r.trim()) : options.filter(o => o.t.trim()).length >= 2 && options.some(o => o.c && o.t.trim()))
    : !!b.titre

  return (
    <div style={{ background: '#FFFEFB', border: '1.5px solid var(--c-accent)', borderRadius: 6, padding: '6px 16px 16px', marginBottom: 12 }}>
      {edition.type === 'fiche' && <>
        <label style={label}>Question</label>
        <RichEditor value={String(b.question ?? '')} onChange={v => set('question', v)} placeholder="Question…" minHeight={70} />
        <label style={label}>Réponse</label>
        <RichEditor value={String(b.reponse ?? '')} onChange={v => set('reponse', v)} placeholder="Réponse…" minHeight={120} />
      </>}
      {edition.type === 'qcm_question' && <>
        {texte('cas', 'Cas pratique (facultatif)', true)}
        {texte('enonce', 'Énoncé', true)}
        {Array.isArray(b.reponses_ok) ? <>
          {texte('reponse_affichee', 'Réponse affichée')}
          <label style={label}>Réponses acceptées (une par ligne)</label>
          <textarea value={(b.reponses_ok as string[]).join('\n')} rows={3} style={{ ...input, resize: 'vertical' }}
            onChange={e => set('reponses_ok', e.target.value.split('\n'))} />
        </> : <>
          <label style={label}>Options (coche les bonnes réponses)</label>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input type="checkbox" checked={o.c} onChange={e => setOption(i, { c: e.target.checked })} aria-label={`Option ${i + 1} correcte`} />
              <input value={o.t} onChange={e => setOption(i, { t: e.target.value })} style={input} aria-label={`Option ${i + 1}`} />
              <button onClick={() => set('options', options.filter((_, j) => j !== i))} aria-label={`Retirer l'option ${i + 1}`} style={bouton('var(--c-papier-teinte)', 'var(--c-annotation)')}>✕</button>
            </div>
          ))}
          <button onClick={() => set('options', [...options, { t: '', c: false }])} style={bouton('var(--c-papier-teinte)', 'var(--c-encre)')}>+ Option</button>
        </>}
        {texte('explication', 'Explication (facultatif)', true)}
      </>}
      {(edition.type === 'cours' || edition.type === 'mindmap') && texte('titre', 'Titre')}
      {edition.type === 'cours' && texte('description', 'Tes notes', true)}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={() => onSave(edition.type !== 'qcm_question' ? b : {
          // Nettoyage à l'enregistrement : options vides et réponses acceptées vides retirées.
          ...b, options: options.filter(o => o.t.trim()),
          ...(Array.isArray(b.reponses_ok) && { reponses_ok: (b.reponses_ok as string[]).map(s => s.trim()).filter(Boolean) }),
        })} disabled={!valide} style={{ ...bouton('var(--c-accent)', '#fff'), padding: '9px 18px', fontSize: 13, opacity: valide ? 1 : 0.5 }}>Enregistrer</button>
        <button onClick={onCancel} style={{ ...bouton('var(--c-papier-teinte)', 'var(--c-annotation)'), padding: '9px 14px', fontSize: 13 }}>Annuler</button>
      </div>
    </div>
  )
}
