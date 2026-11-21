'use client'
import { useEffect, useState } from 'react'
import { supabase, ecrire } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const RETENTION_JOURS = 30
const MS_JOUR = 24 * 60 * 60 * 1000

type ModuleSupprime = {
  id: string
  nom: string
  espace_id: string
  parent_id: string | null
  deleted_at: string
  espaces: { nom: string; slug: string } | null
}
type FicheSupprimee = {
  id: string
  question: string
  reponse: string
  module_id: string
  deleted_at: string
  modules: { nom: string } | null
}

export default function CorbeillePage() {
  const [maintenant] = useState(Date.now) // heure figée au montage : un rendu doit rester pur
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [modules, setModules] = useState<ModuleSupprime[]>([])
  const [fiches, setFiches] = useState<FicheSupprimee[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const afficherMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const font = "var(--font-texte)"

  const charger = async () => {
    // Purge automatique de tout ce qui dépasse 30 jours
    const cutoff = new Date(Date.now() - RETENTION_JOURS * MS_JOUR).toISOString()
    await ecrire(supabase.from('fiches').delete().not('deleted_at', 'is', null).lt('deleted_at', cutoff).select('id'), { vide: true })
    await ecrire(supabase.from('modules').delete().not('deleted_at', 'is', null).lt('deleted_at', cutoff).select('id'), { vide: true })

    const [{ data: mods }, { data: fchs }] = await Promise.all([
      supabase.from('modules').select('*, espaces(nom, slug)').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('fiches').select('*, modules(nom)').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ])
    setModules((mods as ModuleSupprime[]) || [])
    setFiches((fchs as FicheSupprimee[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsAdmin(false); setLoading(false); return }
      const { data: prof } = await supabase.from('profils').select('role').eq('id', user.id).single()
      const admin = prof?.role === 'admin'
      setIsAdmin(admin)
      if (admin) await charger()
      else setLoading(false)
    }
    init()
  }, [])

  // Jours restants avant purge automatique
  const joursRestants = (deletedAt: string) => {
    const reste = RETENTION_JOURS - Math.floor((maintenant - new Date(deletedAt).getTime()) / MS_JOUR)
    return Math.max(0, reste)
  }

  // Descendants (parmi les modules supprimés) d'un module donné
  const descendantsSupprimes = (rootId: string): string[] => {
    const res: string[] = []
    const walk = (id: string) => {
      for (const m of modules) if (m.parent_id === id) { res.push(m.id); walk(m.id) }
    }
    walk(rootId)
    return res
  }

  const restaurerModule = async (mod: ModuleSupprime) => {
    const ids = [mod.id, ...descendantsSupprimes(mod.id)]
    // Si le parent n'existe plus / est en corbeille, on remonte le module à la racine
    const parentActif = mod.parent_id ? !modules.find(m => m.id === mod.parent_id) : true
    if (!(await ecrire(supabase.from('modules').update({ deleted_at: null, ...(parentActif ? {} : { parent_id: null }) }).eq('id', mod.id).select('id')))) return
    if (ids.length > 1) await supabase.from('modules').update({ deleted_at: null }).in('id', ids.slice(1))
    if (!(await ecrire(supabase.from('fiches').update({ deleted_at: null }).in('module_id', ids).select('id'), { vide: true }))) return
    afficherMsg('Module restauré')
    await charger()
  }

  const restaurerFiche = async (f: FicheSupprimee) => {
    if (!(await ecrire(supabase.from('fiches').update({ deleted_at: null }).eq('id', f.id).select('id')))) return
    afficherMsg('Fiche restaurée')
    await charger()
  }

  const supprimerDefinitivementModule = async (mod: ModuleSupprime) => {
    if (!confirm(`Supprimer DÉFINITIVEMENT "${mod.nom}" et son contenu ? Cette action est irréversible.`)) return
    const ids = [mod.id, ...descendantsSupprimes(mod.id)]
    if (!(await ecrire(supabase.from('fiches').delete().in('module_id', ids).select('id'), { vide: true }))) return
    if (!(await ecrire(supabase.from('modules').delete().in('id', ids).select('id')))) return
    afficherMsg('Module supprimé définitivement')
    await charger()
  }

  const supprimerDefinitivementFiche = async (f: FicheSupprimee) => {
    if (!confirm('Supprimer DÉFINITIVEMENT cette fiche ? Cette action est irréversible.')) return
    if (!(await ecrire(supabase.from('fiches').delete().eq('id', f.id).select('id')))) return
    afficherMsg('Fiche supprimée définitivement')
    await charger()
  }

  const viderCorbeille = async () => {
    if (!confirm('Vider entièrement la corbeille ? Tout sera supprimé définitivement.')) return
    if (!(await ecrire(supabase.from('fiches').delete().not('deleted_at', 'is', null).select('id'), { vide: true }))) return
    if (!(await ecrire(supabase.from('modules').delete().not('deleted_at', 'is', null).select('id'), { vide: true }))) return
    afficherMsg('Corbeille vidée')
    await charger()
  }

  if (loading) return <div style={{ paddingTop: '4rem', textAlign: 'center', color: 'var(--c-annotation-clair)', fontFamily: font }}>Chargement…</div>
  if (isAdmin === false) return (
    <div style={{ paddingTop: '4rem', textAlign: 'center', color: 'var(--c-annotation-clair)', fontFamily: font }}>
      Accès réservé aux administrateurs.
    </div>
  )

  const vide = modules.length === 0 && fiches.length === 0

  const btnRestore: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8, background: '#DDF3EE', color: '#0E7C63',
    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
  }
  const btnDelete: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8, background: 'var(--c-accent-pale)', color: 'var(--c-accent)',
    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
  }

  return (
    <div style={{ paddingTop: '34px', maxWidth: 820, margin: '0 auto', fontFamily: font, color: 'var(--c-encre)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 26 }}>Corbeille</div>
        {!vide && (
          <button onClick={viderCorbeille} style={{ ...btnDelete, padding: '9px 16px', fontSize: 13 }}>Vider la corbeille</button>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--c-annotation-clair)', margin: '0 0 24px' }}>
        Les éléments supprimés sont conservés {RETENTION_JOURS} jours, puis effacés automatiquement.
      </p>

      {msg && (
        <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 6, marginBottom: 16, color: /supprim|vidée/.test(msg) ? 'var(--c-accent)' : '#0E7C63', background: /supprim|vidée/.test(msg) ? 'var(--c-accent-pale)' : '#DDF3EE' }}>{msg}</div>
      )}

      {vide ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--c-annotation-clair)' }}>
          <div style={{ fontSize: 15 }}>La corbeille est vide.</div>
        </div>
      ) : (
        <>
          {/* MODULES */}
          {modules.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 18, marginBottom: 12 }}>
                Modules <span style={{ fontSize: 14, color: 'var(--c-annotation-clair)', fontWeight: 400 }}>({modules.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modules.map(mod => (
                  <div key={mod.id} style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{mod.nom}</div>
                      <div style={{ fontSize: 12, color: 'var(--c-annotation-clair)', marginTop: 2 }}>
                        {mod.espaces?.nom ?? 'Espace inconnu'} · supprimé il y a {RETENTION_JOURS - joursRestants(mod.deleted_at)} j · purge dans {joursRestants(mod.deleted_at)} j
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => restaurerModule(mod)} style={btnRestore}>Restaurer</button>
                      <button onClick={() => supprimerDefinitivementModule(mod)} style={btnDelete}>Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FICHES */}
          {fiches.length > 0 && (
            <div>
              <div style={{ fontFamily: "var(--font-titre)", fontWeight: 'var(--titre-poids)', fontSize: 18, marginBottom: 12 }}>
                Fiches <span style={{ fontSize: 14, color: 'var(--c-annotation-clair)', fontWeight: 400 }}>({fiches.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fiches.map(f => (
                  <div key={f.id} style={{ background: '#FFFEFB', border: '1px solid var(--c-filet)', borderRadius: 6, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.question}</div>
                      <div style={{ fontSize: 12, color: 'var(--c-annotation-clair)', marginTop: 2 }}>
                        {f.modules?.nom ?? 'Module supprimé'} · purge dans {joursRestants(f.deleted_at)} j
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => restaurerFiche(f)} style={btnRestore}>Restaurer</button>
                      <button onClick={() => supprimerDefinitivementFiche(f)} style={btnDelete}>Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
