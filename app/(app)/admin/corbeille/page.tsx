'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [modules, setModules] = useState<ModuleSupprime[]>([])
  const [fiches, setFiches] = useState<FicheSupprimee[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const afficherMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const font = "'Hanken Grotesk', sans-serif"

  const charger = async () => {
    // Purge automatique de tout ce qui dépasse 30 jours
    const cutoff = new Date(Date.now() - RETENTION_JOURS * MS_JOUR).toISOString()
    await supabase.from('fiches').delete().not('deleted_at', 'is', null).lt('deleted_at', cutoff)
    await supabase.from('modules').delete().not('deleted_at', 'is', null).lt('deleted_at', cutoff)

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
    const reste = RETENTION_JOURS - Math.floor((Date.now() - new Date(deletedAt).getTime()) / MS_JOUR)
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
    await supabase.from('modules').update({ deleted_at: null, ...(parentActif ? {} : { parent_id: null }) }).eq('id', mod.id)
    if (ids.length > 1) await supabase.from('modules').update({ deleted_at: null }).in('id', ids.slice(1))
    await supabase.from('fiches').update({ deleted_at: null }).in('module_id', ids)
    afficherMsg('✅ Module restauré')
    await charger()
  }

  const restaurerFiche = async (f: FicheSupprimee) => {
    await supabase.from('fiches').update({ deleted_at: null }).eq('id', f.id)
    afficherMsg('✅ Fiche restaurée')
    await charger()
  }

  const supprimerDefinitivementModule = async (mod: ModuleSupprime) => {
    if (!confirm(`Supprimer DÉFINITIVEMENT "${mod.nom}" et son contenu ? Cette action est irréversible.`)) return
    const ids = [mod.id, ...descendantsSupprimes(mod.id)]
    await supabase.from('fiches').delete().in('module_id', ids)
    await supabase.from('modules').delete().in('id', ids)
    afficherMsg('🗑️ Module supprimé définitivement')
    await charger()
  }

  const supprimerDefinitivementFiche = async (f: FicheSupprimee) => {
    if (!confirm('Supprimer DÉFINITIVEMENT cette fiche ? Cette action est irréversible.')) return
    await supabase.from('fiches').delete().eq('id', f.id)
    afficherMsg('🗑️ Fiche supprimée définitivement')
    await charger()
  }

  const viderCorbeille = async () => {
    if (!confirm('Vider entièrement la corbeille ? Tout sera supprimé définitivement.')) return
    await supabase.from('fiches').delete().not('deleted_at', 'is', null)
    await supabase.from('modules').delete().not('deleted_at', 'is', null)
    afficherMsg('🗑️ Corbeille vidée')
    await charger()
  }

  if (loading) return <div style={{ paddingTop: '4rem', textAlign: 'center', color: '#9A8D72', fontFamily: font }}>Chargement…</div>
  if (isAdmin === false) return (
    <div style={{ paddingTop: '4rem', textAlign: 'center', color: '#9A8D72', fontFamily: font }}>
      Accès réservé aux administrateurs.
    </div>
  )

  const vide = modules.length === 0 && fiches.length === 0

  const btnRestore: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8, background: '#DDF3EE', color: '#0E7C63',
    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
  }
  const btnDelete: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 8, background: '#FCE9E3', color: '#D94A30',
    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
  }

  return (
    <div style={{ paddingTop: '34px', maxWidth: 820, margin: '0 auto', fontFamily: font, color: '#2A2018' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 26 }}>Corbeille</div>
        {!vide && (
          <button onClick={viderCorbeille} style={{ ...btnDelete, padding: '9px 16px', fontSize: 13 }}>Vider la corbeille</button>
        )}
      </div>
      <p style={{ fontSize: 13, color: '#9A8D72', margin: '0 0 24px' }}>
        Les éléments supprimés sont conservés {RETENTION_JOURS} jours, puis effacés automatiquement.
      </p>

      {msg && (
        <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 10, marginBottom: 16, color: msg.startsWith('🗑️') ? '#D94A30' : '#0E7C63', background: msg.startsWith('🗑️') ? '#FCE9E3' : '#DDF3EE' }}>{msg}</div>
      )}

      {vide ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#9A8D72' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
          <div style={{ fontSize: 15 }}>La corbeille est vide.</div>
        </div>
      ) : (
        <>
          {/* MODULES */}
          {modules.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
                Modules <span style={{ fontSize: 14, color: '#9A8D72', fontWeight: 400 }}>({modules.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modules.map(mod => (
                  <div key={mod.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{mod.nom}</div>
                      <div style={{ fontSize: 12, color: '#9A8D72', marginTop: 2 }}>
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
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
                Fiches <span style={{ fontSize: 14, color: '#9A8D72', fontWeight: 400 }}>({fiches.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fiches.map(f => (
                  <div key={f.id} style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.question}</div>
                      <div style={{ fontSize: 12, color: '#9A8D72', marginTop: 2 }}>
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
