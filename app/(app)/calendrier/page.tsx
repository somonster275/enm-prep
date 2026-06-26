'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Evenement = {
  id: string
  titre: string
  description: string | null
  date_debut: string   // 'YYYY-MM-DD'
  heure: string | null // 'HH:MM'
  type: string
  couleur: string
  created_by: string | null
}

// Événement de planning fac récupéré via /api/planning (lecture seule).
type PlanningEv = {
  date_debut: string; heure: string; fin: string
  titre: string; type: string; lieu: string; intervenant: string; formation: string
  couleur: string; source: string; lien: string
}

// Vue unifiée affichée dans la grille (manuel + planning fac).
type EvUnifie = {
  id: string
  titre: string
  description: string | null
  date_debut: string
  heure: string | null
  fin?: string | null
  type: string
  couleur: string
  lieu?: string
  intervenant?: string
  formation?: string
  lien?: string
  readonly: boolean
}

type Flux = { id: string; nom: string; url: string; couleur: string }

const TYPES: { value: string; label: string; couleur: string }[] = [
  { value: 'cours',    label: 'Cours',    couleur: '#3B82D9' },
  { value: 'examen',   label: 'Examen',   couleur: '#DC4A2B' },
  { value: 'deadline', label: 'Deadline', couleur: '#E8A11E' },
  { value: 'autre',    label: 'Autre',    couleur: '#2DAE83' },
]

// Flux planning pré-configuré (inséré au 1er chargement admin si la table est vide).
const SEED_FLUX = [{
  nom: 'Planning fac (IEJ)',
  url: 'https://pantheon.extraplanning.com/PlanningFormationEtudiant.aspx?p=flukyGy49BaRawidEvmYtspUZYtyqamywunruslAdruwYnWoco-taQAJoGUKAHUtyspuTumotPAtAdrYPespedrokeclEphesloFA&u=ec92ea03-80d0-49cd-9a96-e9f9aa7caa1a',
  couleur: '#6366F1',
}]

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function couleurType(type: string) {
  return TYPES.find(t => t.value === type)?.couleur ?? '#8A7E68'
}
function labelType(type: string) {
  return TYPES.find(t => t.value === type)?.label ?? type
}
function dateToKey(d: Date) {
  return d.toISOString().slice(0, 10)
}
function premierJourSemaine(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7 // lundi = 0
}
function nbJours(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export default function CalendrierPage() {
  const today = new Date()
  const todayKey = dateToKey(today)

  const [annee, setAnnee] = useState(today.getFullYear())
  const [mois, setMois] = useState(today.getMonth())
  const [evenements, setEvenements] = useState<Evenement[]>([])
  const [planning, setPlanning] = useState<PlanningEv[]>([])
  const [flux, setFlux] = useState<Flux[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [joursSelectionne, setJourSelectionne] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncPlan, setSyncPlan] = useState(false)
  const [tableManquante, setTableManquante] = useState(false)
  const [fluxTableManquante, setFluxTableManquante] = useState(false)
  const [msg, setMsg] = useState('')

  // Formulaire événement
  const [fTitre, setFTitre] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fDate, setFDate] = useState('')
  const [fHeure, setFHeure] = useState('')
  const [fType, setFType] = useState('cours')
  const [saving, setSaving] = useState(false)

  // Formulaire flux
  const [showFlux, setShowFlux] = useState(false)
  const [flNom, setFlNom] = useState('')
  const [flUrl, setFlUrl] = useState('')

  const afficherMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const charger = async () => {
    const { data, error } = await supabase.from('evenements').select('*').order('date_debut')
    if (error) {
      const m = (error.message || '').toLowerCase()
      if (error.code === '42P01' || m.includes('does not exist') || m.includes('find the table')) setTableManquante(true)
      setEvenements([])
    } else {
      setEvenements((data as Evenement[]) || [])
    }
  }

  const chargerPlanning = async (fluxList: Flux[]) => {
    if (fluxList.length === 0) { setPlanning([]); return }
    setSyncPlan(true)
    try {
      const res = await fetch('/api/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeds: fluxList.map(f => ({ url: f.url, nom: f.nom, couleur: f.couleur })) }),
      })
      const data = await res.json()
      setPlanning(data.evenements || [])
    } catch {
      setPlanning([])
    }
    setSyncPlan(false)
  }

  const chargerFlux = async (admin: boolean): Promise<Flux[]> => {
    const { data, error } = await supabase.from('calendrier_flux').select('*').order('created_at')
    if (error) {
      const m = (error.message || '').toLowerCase()
      if (error.code === '42P01' || m.includes('does not exist') || m.includes('find the table')) setFluxTableManquante(true)
      setFlux([]); return []
    }
    let list = (data as Flux[]) || []
    if (admin && list.length === 0) {
      const { error: e2 } = await supabase.from('calendrier_flux').insert(SEED_FLUX)
      if (!e2) {
        const { data: d2 } = await supabase.from('calendrier_flux').select('*').order('created_at')
        list = (d2 as Flux[]) || []
      }
    }
    setFlux(list)
    return list
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: prof } = await supabase.from('profils').select('role').eq('id', user.id).single()
      const admin = prof?.role === 'admin'
      setIsAdmin(admin)
      await charger()
      const fluxList = await chargerFlux(admin)
      setLoading(false)
      await chargerPlanning(fluxList)
    }
    init()
  }, []) // eslint-disable-line

  // Fusion manuel + planning fac
  const tous: EvUnifie[] = useMemo(() => {
    const manuel: EvUnifie[] = evenements.map(e => ({
      id: e.id, titre: e.titre, description: e.description, date_debut: e.date_debut,
      heure: e.heure, type: e.type, couleur: e.couleur, readonly: false,
    }))
    const plan: EvUnifie[] = planning.map((p, i) => ({
      id: 'plan-' + i, titre: p.titre, description: null, date_debut: p.date_debut,
      heure: p.heure, fin: p.fin, type: p.type, couleur: p.couleur,
      lieu: p.lieu, intervenant: p.intervenant, formation: p.formation, lien: p.lien, readonly: true,
    }))
    return [...manuel, ...plan]
  }, [evenements, planning])

  const evParJour = useMemo(() => {
    const map: Record<string, EvUnifie[]> = {}
    tous.forEach(ev => {
      if (!map[ev.date_debut]) map[ev.date_debut] = []
      map[ev.date_debut].push(ev)
    })
    Object.values(map).forEach(list => list.sort((a, b) => (a.heure || '').localeCompare(b.heure || '')))
    return map
  }, [tous])

  const evProchains = useMemo(() => {
    return tous
      .filter(ev => ev.date_debut >= todayKey)
      .sort((a, b) => (a.date_debut + (a.heure || '')).localeCompare(b.date_debut + (b.heure || '')))
      .slice(0, 8)
  }, [tous, todayKey])

  const cells = useMemo(() => {
    const offset = premierJourSemaine(annee, mois)
    const total = nbJours(annee, mois)
    const arr: (number | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= total; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [annee, mois])

  const naviguerMois = (delta: number) => {
    let m = mois + delta, a = annee
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMois(m); setAnnee(a)
    setJourSelectionne(null)
  }

  const ouvrirFormulaire = (dateStr?: string) => {
    setFTitre(''); setFDesc(''); setFHeure(''); setFType('cours')
    setFDate(dateStr || todayKey)
    setShowForm(true)
  }

  const sauvegarder = async () => {
    if (!fTitre.trim() || !fDate) return
    setSaving(true)
    const { error } = await supabase.from('evenements').insert({
      titre: fTitre.trim(), description: fDesc.trim() || null, date_debut: fDate,
      heure: fHeure || null, type: fType, couleur: couleurType(fType),
    })
    setSaving(false)
    if (error) { afficherMsg('❌ ' + error.message); return }
    setShowForm(false)
    afficherMsg('✅ Événement ajouté')
    charger()
  }

  const supprimer = async (id: string) => {
    if (!confirm('Supprimer cet événement ?')) return
    await supabase.from('evenements').delete().eq('id', id)
    setEvenements(prev => prev.filter(e => e.id !== id))
  }

  const ajouterFlux = async () => {
    if (!flNom.trim() || !flUrl.trim()) return
    const { error } = await supabase.from('calendrier_flux').insert({ nom: flNom.trim(), url: flUrl.trim(), couleur: '#6366F1' })
    if (error) { afficherMsg('❌ ' + error.message); return }
    setFlNom(''); setFlUrl('')
    afficherMsg('✅ Flux ajouté')
    const list = await chargerFlux(true)
    chargerPlanning(list)
  }

  const supprimerFlux = async (id: string) => {
    if (!confirm('Retirer ce flux du calendrier ?')) return
    await supabase.from('calendrier_flux').delete().eq('id', id)
    const list = await chargerFlux(true)
    chargerPlanning(list)
  }

  const font = "'Hanken Grotesk', sans-serif"
  const display = "'Bricolage Grotesque', sans-serif"
  const inp: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 10, border: '1.5px solid #EADFC9',
    fontSize: 13, fontFamily: font, background: '#FFFBF2', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  const evJourSelectionne = joursSelectionne ? (evParJour[joursSelectionne] || []) : []

  return (
    <div style={{ paddingTop: 34, maxWidth: 1000, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#DC4A2B22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📅</div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 26 }}>Calendrier</div>
            {syncPlan && <span style={{ fontSize: 12, color: '#6366F1', fontWeight: 600 }}>↻ synchro planning…</span>}
          </div>
          <p style={{ fontSize: 14, color: '#8A7E68', margin: '6px 0 0 56px' }}>Vos cours de la fac et les événements de la prépa, au même endroit.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setShowFlux(s => !s)} style={{
              padding: '11px 16px', borderRadius: 11, background: '#fff', color: '#6366F1',
              border: '1px solid #DDD6FE', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font,
            }}>Flux planning</button>
          )}
          {isAdmin && !tableManquante && (
            <button onClick={() => ouvrirFormulaire()} style={{
              padding: '11px 20px', borderRadius: 11, background: '#DC4A2B', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: font,
            }}>+ Ajouter un événement</button>
          )}
        </div>
      </div>

      {tableManquante && (
        <div style={{ fontSize: 13, color: '#D94A30', background: '#FCE9E3', padding: '14px 18px', borderRadius: 12, marginBottom: 24 }}>
          La table <strong>evenements</strong> n'existe pas encore. Exécute le SQL ci-dessous dans Supabase.
          <pre style={{ marginTop: 10, fontSize: 11, background: '#fff', padding: 12, borderRadius: 8, overflowX: 'auto', color: '#2A2018' }}>{`CREATE TABLE evenements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  date_debut DATE NOT NULL,
  heure TEXT,
  type TEXT DEFAULT 'autre',
  couleur TEXT DEFAULT '#2DAE83',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ev_select" ON evenements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ev_write" ON evenements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profils WHERE profils.id = auth.uid() AND profils.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profils WHERE profils.id = auth.uid() AND profils.role = 'admin'));`}</pre>
        </div>
      )}

      {msg && <div style={{ fontSize: 13, marginBottom: 16, color: msg.startsWith('❌') ? '#D94A30' : '#0E7C63', background: msg.startsWith('❌') ? '#FCE9E3' : '#E6F7F2', padding: '10px 14px', borderRadius: 10 }}>{msg}</div>}

      {/* Gestion des flux planning (admin) */}
      {isAdmin && showFlux && (
        <div style={{ background: '#fff', border: '1px solid #DDD6FE', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Flux de planning (fac)</div>
          <div style={{ fontSize: 12, color: '#9A8D72', marginBottom: 14 }}>
            Colle l'adresse de ton planning en ligne (extraplanning / IEJ). Les cours s'affichent automatiquement dans le calendrier (lecture seule).
          </div>

          {fluxTableManquante ? (
            <div style={{ fontSize: 13, color: '#D94A30', background: '#FCE9E3', padding: '12px 14px', borderRadius: 10 }}>
              La table <strong>calendrier_flux</strong> n'existe pas encore. Exécute le SQL ci-dessous dans Supabase.
              <pre style={{ marginTop: 10, fontSize: 11, background: '#fff', padding: 12, borderRadius: 8, overflowX: 'auto', color: '#2A2018' }}>{`CREATE TABLE calendrier_flux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  url TEXT NOT NULL,
  couleur TEXT DEFAULT '#6366F1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE calendrier_flux ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cf_select" ON calendrier_flux FOR SELECT TO authenticated USING (true);
CREATE POLICY "cf_write" ON calendrier_flux FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profils WHERE profils.id = auth.uid() AND profils.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profils WHERE profils.id = auth.uid() AND profils.role = 'admin'));`}</pre>
            </div>
          ) : (
            <>
              {flux.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {flux.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: f.couleur + '14', borderRadius: 999, padding: '5px 6px 5px 12px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.couleur }} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{f.nom}</span>
                      <button onClick={() => supprimerFlux(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D94A30', fontSize: 15, lineHeight: 1, padding: '0 4px' }} title="Retirer">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr auto auto', gap: 10 }}>
                <input value={flNom} onChange={e => setFlNom(e.target.value)} placeholder="Nom (ex. Planning fac)…" style={inp} />
                <input value={flUrl} onChange={e => setFlUrl(e.target.value)} placeholder="https://…extraplanning.com/…" style={inp} />
                <button onClick={ajouterFlux} disabled={!flNom.trim() || !flUrl.trim()} style={{
                  padding: '10px 18px', borderRadius: 10, background: '#6366F1', color: '#fff', border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font, opacity: (!flNom.trim() || !flUrl.trim()) ? 0.5 : 1, whiteSpace: 'nowrap',
                }}>Ajouter</button>
                <button onClick={() => chargerPlanning(flux)} disabled={syncPlan || flux.length === 0} style={{
                  padding: '10px 16px', borderRadius: 10, background: '#fff', color: '#6366F1', border: '1px solid #DDD6FE',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: font, whiteSpace: 'nowrap',
                }}>{syncPlan ? '…' : 'Actualiser'}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Formulaire d'ajout d'événement */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: 22, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Nouvel événement</div>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9A8D72', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <input value={fTitre} onChange={e => setFTitre(e.target.value)} placeholder="Titre de l'événement…" style={inp} />
            </div>
            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inp} />
            <input type="time" value={fHeure} onChange={e => setFHeure(e.target.value)} style={inp} />
            <div style={{ gridColumn: '1/-1' }}>
              <select value={fType} onChange={e => setFType(e.target.value)} style={inp}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Description (optionnel)…" rows={2}
                style={{ ...inp, resize: 'vertical', display: 'block' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: 10, background: '#F4EDE0', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: font, color: '#8A7E68', fontWeight: 600 }}>Annuler</button>
            <button onClick={sauvegarder} disabled={!fTitre.trim() || !fDate || saving} style={{
              padding: '10px 22px', borderRadius: 10, background: couleurType(fType), color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: font,
              opacity: (!fTitre.trim() || !fDate || saving) ? 0.5 : 1,
            }}>
              {saving ? 'Enregistrement…' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

        {/* Calendrier */}
        <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 18, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button onClick={() => naviguerMois(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8A7E68', padding: '4px 10px' }}>‹</button>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 18 }}>{MOIS_FR[mois]} {annee}</div>
            <button onClick={() => naviguerMois(1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8A7E68', padding: '4px 10px' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
            {JOURS.map(j => (
              <div key={j} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9A8D72', padding: '4px 0' }}>{j}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {cells.map((jour, i) => {
              if (!jour) return <div key={i} />
              const key = `${annee}-${String(mois + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
              const evs = evParJour[key] || []
              const isToday = key === todayKey
              const isSelected = key === joursSelectionne
              const hasPast = key < todayKey
              return (
                <div key={i}
                  onClick={() => setJourSelectionne(isSelected ? null : key)}
                  style={{
                    minHeight: 56, borderRadius: 10, padding: '6px 4px 4px',
                    background: isSelected ? '#FCEFD3' : isToday ? '#FFF4E6' : '#FAFAF8',
                    border: isToday ? '2px solid #DC4A2B' : isSelected ? '1.5px solid #EADFC9' : '1.5px solid transparent',
                    cursor: 'pointer', position: 'relative',
                    opacity: hasPast ? 0.65 : 1,
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: isToday ? 800 : 500,
                    color: isToday ? '#DC4A2B' : '#2A2018', textAlign: 'center', marginBottom: 4,
                  }}>{jour}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {evs.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{
                        fontSize: 9, fontWeight: 700, lineHeight: 1.3,
                        background: ev.couleur, color: '#fff', borderRadius: 4, padding: '2px 4px',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}>{ev.titre}</div>
                    ))}
                    {evs.length > 3 && <div style={{ fontSize: 9, color: '#9A8D72', textAlign: 'center' }}>+{evs.length - 3}</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Détail jour sélectionné */}
          {joursSelectionne && (
            <div style={{ marginTop: 16, borderTop: '1px solid #F0E7D6', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2A2018' }}>
                  {new Date(joursSelectionne + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                {isAdmin && (
                  <button onClick={() => ouvrirFormulaire(joursSelectionne)} style={{
                    fontSize: 12, fontWeight: 600, color: '#DC4A2B', background: '#FCE9E3',
                    border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: font,
                  }}>+ Ajouter</button>
                )}
              </div>
              {evJourSelectionne.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9A8D72' }}>Aucun événement ce jour.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {evJourSelectionne.map(ev => (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      background: ev.couleur + '12', borderRadius: 10, padding: '10px 12px',
                      borderLeft: `3px solid ${ev.couleur}`,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#2A2018' }}>{ev.titre}</div>
                        {(ev.heure || ev.fin) && (
                          <div style={{ fontSize: 11, color: '#9A8D72', marginTop: 2 }}>
                            🕐 {ev.heure}{ev.fin ? ` – ${ev.fin}` : ''}
                          </div>
                        )}
                        {ev.lieu && <div style={{ fontSize: 11, color: '#9A8D72', marginTop: 2 }}>📍 {ev.lieu}</div>}
                        {ev.intervenant && <div style={{ fontSize: 11, color: '#9A8D72', marginTop: 2 }}>👤 {ev.intervenant}</div>}
                        {ev.description && <div style={{ fontSize: 12, color: '#5A4E3A', marginTop: 4 }}>{ev.description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: ev.couleur, background: ev.couleur + '20', padding: '2px 7px', borderRadius: 999 }}>
                            {ev.readonly ? ev.type : labelType(ev.type)}
                          </span>
                          {ev.readonly && ev.lien && (
                            <a href={ev.lien} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: ev.couleur, textDecoration: 'none', fontWeight: 600 }}>Planning →</a>
                          )}
                        </div>
                      </div>
                      {isAdmin && !ev.readonly && (
                        <button onClick={() => supprimer(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D94A30', fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0 }} title="Supprimer">×</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Colonne droite : à venir */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 17, color: '#2A2018' }}>À venir</div>
          {loading ? (
            <div style={{ fontSize: 13, color: '#9A8D72' }}>Chargement…</div>
          ) : evProchains.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9A8D72', background: '#fff', borderRadius: 12, padding: '14px 16px', border: '1px solid #F0E7D6' }}>
              Aucun événement à venir.
            </div>
          ) : (
            evProchains.map(ev => {
              const d = new Date(ev.date_debut + 'T12:00:00')
              const isEvToday = ev.date_debut === todayKey
              const diff = Math.round((d.getTime() - new Date(todayKey).getTime()) / 86400000)
              return (
                <div key={ev.id} onClick={() => {
                  const [a, mo] = ev.date_debut.split('-').map(Number)
                  setAnnee(a); setMois(mo - 1); setJourSelectionne(ev.date_debut)
                }} style={{
                  background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12,
                  padding: '12px 14px', cursor: 'pointer', borderLeft: `4px solid ${ev.couleur}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{ev.titre}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: ev.couleur, background: ev.couleur + '18', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {ev.readonly ? ev.type : labelType(ev.type)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9A8D72', marginTop: 4 }}>
                    {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {ev.heure && ` · ${ev.heure}`}
                    {ev.lieu && ` · ${ev.lieu}`}
                  </div>
                  {isEvToday && <div style={{ fontSize: 11, fontWeight: 700, color: '#DC4A2B', marginTop: 4 }}>Aujourd'hui</div>}
                  {!isEvToday && diff <= 7 && <div style={{ fontSize: 11, color: '#E8A11E', fontWeight: 600, marginTop: 4 }}>Dans {diff} jour{diff > 1 ? 's' : ''}</div>}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
