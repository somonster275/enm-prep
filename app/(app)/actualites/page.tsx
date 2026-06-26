'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Source = { id: string; nom: string; url: string; couleur: string }
type Article = {
  titre: string; lien: string; date: string | null
  extrait: string; image: string | null; source: string; couleur: string
}

const COULEURS = ['#DC4A2B', '#2DAE83', '#3B82D9', '#E8A11E', '#7C5CBF', '#0E7C63']

// Sources pré-configurées : insérées automatiquement au premier chargement (par un admin) si la table est vide.
const SOURCES_DEFAUT = [
  { nom: 'Le Club des Juristes', url: 'https://www.leclubdesjuristes.com/feed/', couleur: '#DC4A2B' },
  { nom: 'Dalloz Étudiant', url: 'https://actu.dalloz-etudiant.fr/rss.xml', couleur: '#2DAE83' },
  { nom: 'Vie-publique', url: 'https://www.vie-publique.fr/actualites-feeds.xml', couleur: '#3B82D9' },
]

export default function ActualitesPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [erreurs, setErreurs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState(false)
  const [tableManquante, setTableManquante] = useState(false)

  // Formulaire admin
  const [nom, setNom] = useState('')
  const [url, setUrl] = useState('')
  const [couleur, setCouleur] = useState(COULEURS[0])
  const [msg, setMsg] = useState('')
  const afficherMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"

  const synchroniser = useCallback(async (srcs: Source[]) => {
    if (srcs.length === 0) { setArticles([]); return }
    setSync(true)
    try {
      const res = await fetch('/api/actualites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeds: srcs.map(s => ({ url: s.url, nom: s.nom, couleur: s.couleur })) }),
      })
      const data = await res.json()
      setArticles(data.articles || [])
      setErreurs(data.erreurs || [])
    } catch {
      setErreurs(['Impossible de récupérer les actualités.'])
    }
    setSync(false)
  }, [])

  const chargerSources = useCallback(async () => {
    const { data, error } = await supabase.from('sources_actualites').select('*').order('created_at')
    if (error) {
      const m = (error.message || '').toLowerCase()
      if (error.code === '42P01' || m.includes('does not exist') || m.includes('find the table')) setTableManquante(true)
      setSources([]); return []
    }
    const srcs = (data as Source[]) || []
    setSources(srcs)
    return srcs
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: prof } = await supabase.from('profils').select('role').eq('id', user.id).single()
      const admin = prof?.role === 'admin'
      setIsAdmin(admin)
      let srcs = await chargerSources()
      // Premier lancement : un admin amorce les sources par défaut.
      if (admin && srcs.length === 0) {
        const { error } = await supabase.from('sources_actualites').insert(SOURCES_DEFAUT)
        if (!error) srcs = await chargerSources()
      }
      setLoading(false)
      await synchroniser(srcs)
    }
    init()
  }, [chargerSources, synchroniser])

  const ajouterSource = async () => {
    if (!nom.trim() || !url.trim()) return
    const { error } = await supabase.from('sources_actualites').insert({ nom: nom.trim(), url: url.trim(), couleur })
    if (error) { afficherMsg('❌ ' + error.message); return }
    setNom(''); setUrl(''); setCouleur(COULEURS[(sources.length + 1) % COULEURS.length])
    afficherMsg('✅ Source ajoutée')
    const srcs = await chargerSources()
    synchroniser(srcs)
  }

  const supprimerSource = async (id: string) => {
    if (!confirm('Retirer cette source ?')) return
    await supabase.from('sources_actualites').delete().eq('id', id)
    const srcs = await chargerSources()
    synchroniser(srcs)
  }

  const inp: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 10, border: '1.5px solid #EADFC9',
    fontSize: 13, fontFamily: font, background: '#FFFBF2', outline: 'none', boxSizing: 'border-box',
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const diff = Math.round((Date.now() - d.getTime()) / 86400000)
    if (diff === 0) return "Aujourd'hui"
    if (diff === 1) return 'Hier'
    if (diff < 7) return `Il y a ${diff} jours`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{ paddingTop: 34, maxWidth: 1000, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#DC4A2B22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📰</div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 26 }}>Actualités</div>
          </div>
          <p style={{ fontSize: 14, color: '#8A7E68', margin: '6px 0 0 56px' }}>L'actualité juridique de la semaine, en direct des sites de référence.</p>
        </div>
        {!tableManquante && sources.length > 0 && (
          <button onClick={() => synchroniser(sources)} disabled={sync} style={{
            padding: '10px 18px', borderRadius: 11, background: '#fff', color: '#8A7E68',
            border: '1px solid #F0E7D6', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span style={{ display: 'inline-block', transform: sync ? 'rotate(360deg)' : 'none', transition: 'transform .6s' }}>↻</span>
            {sync ? 'Synchronisation…' : 'Actualiser'}
          </button>
        )}
      </div>

      {tableManquante && (
        <div style={{ fontSize: 13, color: '#D94A30', background: '#FCE9E3', padding: '14px 18px', borderRadius: 12, marginBottom: 24 }}>
          La table <strong>sources_actualites</strong> n'existe pas encore. Exécute le SQL ci-dessous dans Supabase.
          <pre style={{ marginTop: 10, fontSize: 11, background: '#fff', padding: 12, borderRadius: 8, overflowX: 'auto', color: '#2A2018' }}>{`CREATE TABLE sources_actualites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  url TEXT NOT NULL,
  couleur TEXT DEFAULT '#DC4A2B',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sources_actualites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "src_select" ON sources_actualites FOR SELECT TO authenticated USING (true);
CREATE POLICY "src_write" ON sources_actualites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profils WHERE profils.id = auth.uid() AND profils.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profils WHERE profils.id = auth.uid() AND profils.role = 'admin'));`}</pre>
        </div>
      )}

      {/* Gestion des sources (admin) */}
      {isAdmin && !tableManquante && (
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 20, marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Sources de flux (RSS)</div>
          <div style={{ fontSize: 12, color: '#9A8D72', marginBottom: 14 }}>
            Colle l'adresse du flux RSS d'un site juridique (ex. Dalloz Actualité, Village de la Justice, Conseil constitutionnel…).
          </div>

          {sources.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {sources.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: s.couleur + '14', borderRadius: 999, padding: '5px 6px 5px 12px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.couleur }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.nom}</span>
                  <button onClick={() => supprimerSource(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D94A30', fontSize: 15, lineHeight: 1, padding: '0 4px' }} title="Retirer">×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr auto auto', gap: 10, alignItems: 'center' }}>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du site…" style={inp} />
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…/rss.xml" style={inp} />
            <div style={{ display: 'flex', gap: 5 }}>
              {COULEURS.map(c => (
                <button key={c} onClick={() => setCouleur(c)} style={{
                  width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: couleur === c ? '2px solid #2A2018' : '2px solid transparent',
                }} />
              ))}
            </div>
            <button onClick={ajouterSource} disabled={!nom.trim() || !url.trim()} style={{
              padding: '10px 20px', borderRadius: 10, background: '#DC4A2B', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font,
              opacity: (!nom.trim() || !url.trim()) ? 0.5 : 1, whiteSpace: 'nowrap',
            }}>Ajouter</button>
          </div>
          {msg && <div style={{ fontSize: 13, marginTop: 12, color: msg.startsWith('❌') ? '#D94A30' : '#0E7C63' }}>{msg}</div>}
        </div>
      )}

      {erreurs.length > 0 && (
        <div style={{ fontSize: 12, color: '#9A7A2A', background: '#FCF3DD', padding: '10px 14px', borderRadius: 10, marginBottom: 18 }}>
          ⚠️ {erreurs.join(' · ')}
        </div>
      )}

      {/* Articles */}
      {loading || sync ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9A8D72' }}>Chargement des actualités…</div>
      ) : sources.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9A8D72', fontSize: 14 }}>
          {isAdmin ? 'Ajoutez une source de flux RSS pour voir les actualités apparaître.' : 'Aucune source d\'actualité configurée pour le moment.'}
        </div>
      ) : articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9A8D72', fontSize: 14 }}>
          Aucun article récupéré. Vérifiez les adresses des flux.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {articles.map((a, i) => (
            <a key={i} href={a.lien} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, overflow: 'hidden',
                cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column',
              }}>
                {a.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', background: '#F4EDE0' }} />
                )}
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: a.couleur, background: a.couleur + '18', padding: '3px 10px', borderRadius: 999 }}>{a.source}</span>
                    {a.date && <span style={{ fontSize: 11, color: '#9A8D72' }}>{formatDate(a.date)}</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, marginBottom: 8 }}>{a.titre}</div>
                  {a.extrait && <div style={{ fontSize: 13, color: '#8A7E68', lineHeight: 1.5, flex: 1 }}>{a.extrait}</div>}
                  <div style={{ fontSize: 12, fontWeight: 600, color: a.couleur, marginTop: 12 }}>Lire l'article →</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
