'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LogoBadge, Logo } from '@/components/Logo'
import { NIVEAUX, intervalleMinutes, formatIntervalle } from '@/lib/spaced-repetition'

const INK = 'var(--c-encre)'
const MUTED = 'var(--c-annotation)'
const RED = 'var(--c-accent)'
const BORDER = 'var(--c-filet)'
const TITRE: React.CSSProperties = { fontFamily: 'var(--font-titre)', fontWeight: 'var(--titre-poids)', letterSpacing: '-.015em', textWrap: 'balance' }

// Fiches de démonstration du hero : articles réels, à garder exacts.
const FICHES_DEMO = [
  {
    matiere: 'Droit civil', module: 'Vices du consentement',
    q: "Quelle différence entre le dol et l'erreur sur les qualités essentielles ?",
    article: 'art. 1132 C. civ.',
    r: [
      "L'erreur sur les qualités essentielles (§) est spontanée : le contractant se trompe seul.",
      "Le dol (art. 1137) est une erreur provoquée par les manœuvres, mensonges ou la dissimulation intentionnelle de l'autre partie. Il rend l'erreur excusable, même sur la valeur ou les motifs (art. 1139).",
    ],
  },
  {
    matiere: 'Droit pénal', module: "Causes d'irresponsabilité",
    q: 'Quelles sont les conditions de la légitime défense des personnes ?',
    article: 'art. 122-5 C. pén.',
    r: [
      "Selon l'§, l'atteinte doit être injustifiée et actuelle, envers soi-même ou autrui.",
      "La riposte doit être nécessaire, accomplie dans le même temps, et proportionnée à la gravité de l'atteinte.",
    ],
  },
  {
    matiere: 'Droit civil', module: 'Preuve et jugement',
    q: "À quelles conditions l'autorité de la chose jugée s'oppose-t-elle à une nouvelle demande ?",
    article: 'art. 1355 C. civ.',
    r: ["L'§ exige une triple identité : même chose demandée, même cause, mêmes parties agissant en la même qualité."],
  },
]

// Tout ce que l'étudiant peut faire, rangé par intention.
const VERBES: { titre: string; items: [string, string][] }[] = [
  { titre: 'Réviser', items: [
    ['Fiches', 'Par matière, en répétition espacée.'],
    ['Révision mixte', 'Les fiches dues de toutes les matières, mélangées.'],
    ['Mind maps', "Les notions clés d'un sujet sur une page."],
  ] },
  { titre: "S'entraîner", items: [
    ["QCM et carnet d'erreurs", "Vos erreurs reviennent jusqu'à être maîtrisées."],
    ['Annales', 'Sujets et corrigés partagés, classés par matière.'],
    ['Duels', 'Mêmes questions, même chrono, contre un autre candidat.'],
  ] },
  { titre: 'Comprendre', items: [
    ['Questions de cours', 'Une réponse sourcée sur une base de cours validée.'],
    ['Tuteur', 'Il propose la prochaine étape selon votre progression.'],
    ['Vidéos', 'Sélectionnées par matière.'],
  ] },
  { titre: 'Avancer ensemble', items: [
    ['Forum et entraide', 'Posez une question, aidez sur une matière.'],
    ['Classement', 'Un défi par semaine, classement anonyme.'],
    ['Calendrier', 'Cours, examens et événements de la prépa.'],
  ] },
]

export default function Accueil() {
  const [connecte, setConnecte] = useState(false)

  useEffect(() => {
    // Un lien de récupération / d'invitation Supabase peut retomber sur l'accueil
    // (Site URL) au lieu de /bienvenue. On détecte le jeton dans l'URL et on
    // redirige vers /bienvenue, qui gère la définition du mot de passe.
    const h = window.location.hash || ''
    const q = window.location.search || ''
    const params = new URLSearchParams(q)
    // PKCE (@supabase/ssr) renvoie un ?code=... ; le flux implicite un #type=recovery.
    // Erreurs Supabase : ?error_code / #error_code. Dans tous ces cas, on bascule
    // vers /bienvenue qui gère la définition du mot de passe.
    const estRecup =
      params.has('code') ||
      params.has('error_code') ||
      /type=(recovery|invite)/.test(h) ||
      /error/.test(h)
    if (estRecup) {
      window.location.replace('/bienvenue' + h + q)
      return
    }
    // Filet de sécurité : l'événement PASSWORD_RECOVERY si le hash a déjà été consommé.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') window.location.replace('/bienvenue')
    })
    supabase.auth.getSession().then(({ data }) => setConnecte(!!data.session))
    return () => sub.subscription.unsubscribe()
  }, [])

  const lienEspace = connecte ? '/dashboard' : '/login'
  const labelEspace = connecte ? 'Accéder à mon espace' : 'Se connecter'

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    height: 46, padding: '0 20px', borderRadius: 6, fontSize: 15, fontWeight: 600,
    textDecoration: 'none', cursor: 'pointer', fontFamily: 'var(--font-texte)',
  }
  const btnPlein: React.CSSProperties = { ...btn, background: RED, color: '#fff', border: '1px solid transparent' }
  const btnLigne: React.CSSProperties = { ...btn, background: 'transparent', color: INK, border: '1px solid var(--c-filet-fort)' }
  const section: React.CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: '72px 24px', borderTop: `1px solid ${BORDER}` }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-papier)', color: INK, fontFamily: 'var(--font-texte)' }}>

      {/* ───────────── Barre de navigation ───────────── */}
      <header style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 72, display: 'flex', alignItems: 'center', gap: 32, borderBottom: `1px solid ${BORDER}` }}>
        <LogoBadge size={20} />
        <nav className="hide-mobile" style={{ display: 'flex', gap: 24, marginRight: 'auto' }}>
          <a href="#fonctions" style={{ fontSize: 14.5, fontWeight: 500, color: MUTED, textDecoration: 'none' }}>Fonctionnalités</a>
          <a href="#methode" style={{ fontSize: 14.5, fontWeight: 500, color: MUTED, textDecoration: 'none' }}>Méthode</a>
        </nav>
        <Link href={lienEspace} style={{ ...btn, height: 40, padding: '0 16px', fontSize: 14, background: INK, color: 'var(--c-papier)', marginLeft: 'auto' }}>{labelEspace}</Link>
      </header>

      {/* ───────────── Hero : une vraie fiche à retourner ───────────── */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '80px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.05fr)', gap: 64, alignItems: 'center' }}>
        <div>
          <h1 style={{ ...TITRE, fontSize: 'clamp(2.3rem, 4.6vw, 3.6rem)', lineHeight: 1.05, margin: 0 }}>
            Le concours de la magistrature, une fiche à la fois.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--c-texte-doux)', margin: '22px 0 0', maxWidth: 480 }}>
            Vos fiches reviennent au bon moment. QCM, cours sourcés et un tuteur qui connaît votre progression complètent le reste.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 30, flexWrap: 'wrap' }}>
            <Link href={lienEspace} style={btnPlein}>{labelEspace}</Link>
            <Link href="/login" style={btnLigne}>Demander un accès</Link>
          </div>
          <p style={{ fontFamily: 'var(--font-titre)', fontStyle: 'italic', color: MUTED, fontSize: 16, margin: '30px 0 0' }}>
            Essayez la fiche ci-contre : c&apos;est exactement ce que vous ferez chaque jour.
          </p>
        </div>
        <FicheDemo />
      </section>

      {/* ───────────── Fonctionnalités par verbe ───────────── */}
      <section id="fonctions" style={section}>
        <h2 style={{ ...TITRE, fontSize: 'clamp(1.8rem, 3vw, 2.3rem)', lineHeight: 1.15, margin: 0 }}>
          Tout le programme, rangé par ce que vous voulez faire
        </h2>
        <p style={{ color: MUTED, fontSize: 16.5, margin: '12px 0 0', maxWidth: 600 }}>
          Chaque outil est relié à vos fiches : une erreur en QCM ou une question au tuteur renvoie vers la notion à revoir.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 36, marginTop: 44 }}>
          {VERBES.map(v => (
            <div key={v.titre}>
              <h3 style={{ ...TITRE, fontSize: 21, color: RED, margin: '0 0 14px' }}>{v.titre}</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 16 }}>
                {v.items.map(([t, d]) => (
                  <li key={t}>
                    <div style={{ fontWeight: 600, fontSize: 15.5 }}>{t}</div>
                    <div style={{ color: MUTED, fontSize: 14.5, lineHeight: 1.5, marginTop: 2 }}>{d}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── La méthode ───────────── */}
      <section id="methode" style={{ ...section, display: 'grid', gridTemplateColumns: 'minmax(0,.9fr) minmax(0,1.1fr)', gap: 64, alignItems: 'center' }}>
        <div>
          <h2 style={{ ...TITRE, fontSize: 'clamp(1.8rem, 3vw, 2.3rem)', lineHeight: 1.15, margin: 0 }}>
            Une fiche bien sue revient de moins en moins souvent
          </h2>
          <p style={{ color: MUTED, fontSize: 16.5, lineHeight: 1.6, margin: '14px 0 0', maxWidth: 480 }}>
            Après chaque fiche, vous dites si vous la saviez. Une fiche ratée revient dans la minute. Une fiche réussie s&apos;espace à chaque passage, jusqu&apos;à deux mois.
          </p>
        </div>
        <EchelleIntervalles />
      </section>

      {/* ───────────── CTA final ───────────── */}
      <section style={{ ...section, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <h2 style={{ ...TITRE, fontSize: 'clamp(1.8rem, 3vw, 2.3rem)', margin: 0 }}>Prêt à reprendre vos révisions ?</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href={lienEspace} style={btnPlein}>{labelEspace}</Link>
          <Link href="/login" style={btnLigne}>Demander un accès</Link>
        </div>
      </section>

      {/* ───────────── Pied de page ───────────── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '28px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Logo size={20} color={INK} />
          <div style={{ fontSize: 13.5, color: MUTED }}>
            Conçu par un étudiant en classe préparatoire à l&apos;ENM, {new Date().getFullYear()}.
          </div>
        </div>
      </footer>
    </div>
  )
}

/* Fiche bristol interactive : retourner, surligner l'article, noter avec les vrais boutons de révision. */
function FicheDemo() {
  const [i, setI] = useState(0)
  const [revelee, setRevelee] = useState(false)
  const [dernier, setDernier] = useState<string | null>(null)
  const f = FICHES_DEMO[i]

  const noter = (bouton: number) => {
    const n = NIVEAUX[bouton]
    setDernier(`Fiche notée « ${n.label} » : elle revient dans ${formatIntervalle(intervalleMinutes(bouton, 0))}.`)
    setI((i + 1) % FICHES_DEMO.length)
    setRevelee(false)
  }

  const pad = '0 26px 0 62px'
  return (
    <div aria-live="polite" style={{ position: 'relative', background: '#FFFEFB', border: `1px solid ${BORDER}`, borderRadius: 4, boxShadow: '0 1px 0 var(--c-filet), 0 18px 40px -24px rgba(33,28,25,.35)', overflow: 'hidden' }}>
      {/* marge rouge d'une fiche bristol */}
      <div aria-hidden style={{ position: 'absolute', left: 44, top: 0, bottom: 0, width: 1, background: 'rgba(163,18,42,.3)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 20px 12px 62px', fontSize: 13, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
        <span><b style={{ color: RED, fontWeight: 600 }}>{f.matiere}</b> {f.module}</span>
        <span>{i + 1} sur {FICHES_DEMO.length}</span>
      </div>

      <div style={{ padding: pad, paddingTop: 22, paddingBottom: 22, minHeight: 250, display: 'grid', alignContent: 'start', gap: 16 }}>
        <p style={{ ...TITRE, fontSize: 23, lineHeight: 1.25, margin: 0 }}>{f.q}</p>
        {revelee && (
          <div style={{ fontFamily: 'var(--font-titre)', fontSize: 17, lineHeight: 1.6 }}>
            {f.r.map((p, k) => {
              const [avant, apres] = p.split('§')
              return (
                <p key={k} style={{ margin: '0 0 8px' }}>
                  {avant}
                  {apres !== undefined && <><span className="surligne">{f.article}</span>{apres}</>}
                </p>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ padding: pad, paddingBottom: 22 }}>
        {!revelee ? (
          <>
            <button type="button" onClick={() => setRevelee(true)} style={{ height: 42, padding: '0 18px', borderRadius: 6, border: 'none', background: INK, color: 'var(--c-papier)', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-texte)', cursor: 'pointer' }}>
              Voir la réponse
            </button>
            {dernier && <p style={{ fontSize: 14, margin: '12px 0 0' }}>{dernier}</p>}
          </>
        ) : (
          <>
            <div className="no-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
              {NIVEAUX.map((n, b) => (
                <button key={n.label} type="button" onClick={() => noter(b)} style={{ display: 'grid', gap: 1, padding: '9px 4px 8px', background: '#FFFEFB', border: `1px solid ${BORDER}`, borderTop: `3px solid ${n.couleur}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-texte)', color: INK }}>
                  <b style={{ fontSize: 13.5, fontWeight: 600 }}>{n.label}</b>
                  <span style={{ fontSize: 12, color: MUTED }}>{formatIntervalle(intervalleMinutes(b, 0))}</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: MUTED, margin: '12px 0 0' }}>Saviez-vous la réponse ?</p>
          </>
        )}
      </div>
    </div>
  )
}

/* Intervalles successifs d'une fiche toujours réussie (bouton « Correct »), barres à l'échelle. */
function EchelleIntervalles() {
  const jours = NIVEAUX[2].intervalles.map(m => m / 1440)
  const max = Math.max(...jours)
  return (
    <figure style={{ margin: 0 }} aria-label={`Intervalles successifs d'une fiche réussie : ${jours.map(j => formatIntervalle(j * 1440)).join(', ')}.`}>
      <div className="no-collapse" style={{ display: 'grid', gridTemplateColumns: `repeat(${jours.length}, minmax(0,1fr))`, gap: 10, alignItems: 'end', height: 220, borderBottom: `2px solid ${INK}` }}>
        {jours.map((j, k) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6, height: '100%' }}>
            <span style={{ fontFamily: 'var(--font-titre)', fontWeight: 600, fontSize: 'clamp(13px, 1.4vw, 17px)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatIntervalle(j * 1440)}</span>
            <div style={{ width: '100%', height: `${Math.max(j / max * 170, 3)}px`, background: k === jours.length - 1 ? RED : 'var(--c-filet-fort)', borderRadius: '2px 2px 0 0' }} />
          </div>
        ))}
      </div>
      <figcaption className="no-collapse" style={{ display: 'grid', gridTemplateColumns: `repeat(${jours.length}, minmax(0,1fr))`, gap: 10, marginTop: 8, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>
        {jours.map((_, k) => <span key={k}>{k + 1}{k === 0 ? 're' : 'e'} réussite</span>)}
      </figcaption>
    </figure>
  )
}
