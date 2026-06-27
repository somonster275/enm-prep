'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LogoBadge, Logo } from '@/components/Logo'

const INK = '#2A2018'
const MUTED = '#8A7E68'
const RED = '#DC4A2B'
const CREAM = '#FDF6EA'
const BORDER = '#F0E7D6'

// Les matières du programme, autour du noyau « codex » (réseau hexagonal du hero).
// Illustration « rangée de codes juridiques » du hero — codes réels (Légifrance).
const LIVRES: { h: number; rot: string; bg: string; kicker: string; titre: string; size: number }[] = [
  { h: 268, rot: '-1deg',  bg: '#EE5A52', kicker: 'CODE',      titre: 'CIVIL',    size: 15 },
  { h: 286, rot: '.6deg',  bg: '#D22F26', kicker: 'CODE',      titre: 'PÉNAL',    size: 15 },
  { h: 260, rot: '-.4deg', bg: '#B5392A', kicker: 'PROCÉDURE', titre: 'CIVILE',   size: 14 },
  { h: 280, rot: '.8deg',  bg: '#C8412F', kicker: 'PROCÉDURE', titre: 'PÉNALE',   size: 14 },
  { h: 266, rot: '-.7deg', bg: '#E76F45', kicker: 'CODE DE',   titre: 'COMMERCE', size: 11 },
  { h: 274, rot: '.5deg',  bg: '#A82C28', kicker: 'CODE DU',   titre: 'TRAVAIL',  size: 13 },
]

// Tout ce que l'étudiant peut faire dans l'app.
const FONCTIONS = [
  { icone: '🗂️', couleur: '#DC4A2B', titre: 'Fiches de révision', desc: 'Vos fiches par matière, servies en répétition espacée pour ancrer durablement.' },
  { icone: '💬', couleur: '#534AB7', titre: 'Questions de cours', desc: 'Une question, une réponse sourcée sur la base de cours validée par l\'équipe.' },
  { icone: '✅', couleur: '#E8A11E', titre: 'QCM', desc: 'Tester ses connaissances avec des questions à choix multiples corrigées.' },
  { icone: '🧠', couleur: '#2DAE83', titre: 'Mind maps', desc: 'Visualiser les notions clés en cartes mentales et schémas par sujet.' },
  { icone: '🎧', couleur: '#3B82D9', titre: 'Audio & vidéo', desc: 'Réviser en écoutant ou en regardant les ressources importées.' },
  { icone: '📰', couleur: '#C2410C', titre: 'Actualités', desc: 'Suivre l\'actualité juridique utile au concours, sélectionnée pour vous.' },
  { icone: '🤖', couleur: '#0F766E', titre: 'Tuteur IA', desc: 'Un coach qui connaît votre progression et vous propose la prochaine étape.' },
  { icone: '🔥', couleur: '#D94A30', titre: 'Progression', desc: 'Régularité, maîtrise et couverture suivies jour après jour pour rester motivé.' },
]

// Les trois exemples « ce que vous pouvez demander » (façon comptoir).
const EXEMPLES = [
  { titre: 'Une notion à clarifier', q: '« Distingue dol et erreur sur la substance »', note: 'Réponse sourcée sur le cours de droit civil' },
  { titre: 'Une révision ciblée', q: '« Refais-moi réviser la procédure pénale »', note: 'Fiches dues et QCM proposés automatiquement' },
  { titre: 'Un point d\'actualité', q: '« Quoi de neuf en droit des libertés ? »', note: 'Actualités juridiques sélectionnées pour l\'ENM' },
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

  const btnPlein: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, padding: '0 26px', borderRadius: 14, border: 'none',
    background: RED, color: '#fff', fontSize: 15.5, fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none', boxShadow: '0 12px 24px -10px rgba(220,74,43,.8)',
    fontFamily: "'Hanken Grotesk', sans-serif",
  }
  const btnLigne: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, padding: '0 24px', borderRadius: 14, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: INK, fontSize: 15.5, fontWeight: 700, cursor: 'pointer',
    textDecoration: 'none', fontFamily: "'Hanken Grotesk', sans-serif",
  }

  return (
    <div className="bg-grille" style={{ minHeight: '100vh', backgroundColor: CREAM, color: INK, fontFamily: "'Hanken Grotesk', sans-serif" }}>

      {/* ───────────── Barre de navigation ───────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(253,246,234,.85)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 24px', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LogoBadge size={20} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: RED, background: '#FCE9E3', padding: '4px 9px', borderRadius: 999 }}>ENM · 2026</span>
          </div>

          <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="#fonctions" style={{ fontSize: 14.5, fontWeight: 600, color: MUTED, textDecoration: 'none' }}>Fonctionnalités</a>
            <a href="#apercu" style={{ fontSize: 14.5, fontWeight: 600, color: MUTED, textDecoration: 'none' }}>Aperçu</a>
            <a href="#methode" style={{ fontSize: 14.5, fontWeight: 600, color: MUTED, textDecoration: 'none' }}>Méthode</a>
          </nav>

          <Link href={lienEspace} style={{ ...btnPlein, height: 44, padding: '0 20px', fontSize: 14.5 }}>{labelEspace}</Link>
        </div>
      </header>

      {/* ───────────── Hero ───────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '64px 24px 40px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 440px', minWidth: 300 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', color: RED, background: '#fff', border: `1px solid ${BORDER}`, padding: '7px 14px', borderRadius: 999 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: RED }} /> POUR LES CANDIDATS À L'ENM
          </div>

          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 56, lineHeight: 1.04, letterSpacing: '-.02em', margin: '22px 0 0' }}>
            Tout pour <span style={{ color: RED }}>réussir</span><br />le concours de la magistrature.
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.6, color: '#6E6456', margin: '20px 0 0', maxWidth: 540 }}>
            Fiches en répétition espacée, QCM, mind maps, cours sourcés et un tuteur IA qui connaît votre progression. Toutes vos révisions ENM réunies dans un seul espace.
          </p>

          <div style={{ display: 'flex', gap: 14, marginTop: 30, flexWrap: 'wrap' }}>
            <Link href={lienEspace} style={btnPlein}>{labelEspace}</Link>
            <a href="#fonctions" style={btnLigne}>Découvrir les fonctionnalités</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, fontSize: 13.5, color: MUTED, fontWeight: 600 }}>
            <span style={{ color: '#2DAE83' }}>●</span> Répétition espacée
            <span style={{ color: BORDER }}>·</span> Réponses sourcées
            <span style={{ color: BORDER }}>·</span> Suivi de progression
          </div>

          {/* Statistiques */}
          <div style={{ display: 'flex', gap: 40, marginTop: 38 }}>
            {[['9', 'Matières au programme'], ['100%', 'Cours validés par l\'équipe'], ['1', 'Espace pour tout réviser']].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30, color: INK }}>{n}</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 2, maxWidth: 130 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Réseau hexagonal des matières */}
        <div className="hide-mobile" style={{ flex: '1 1 360px', display: 'flex', justifyContent: 'center' }}>
          <CodexCodes />
        </div>
      </section>

      {/* ───────────── Aperçu « comme une question de cours » ───────────── */}
      <section id="apercu" style={{ maxWidth: 900, margin: '0 auto', padding: '50px 24px' }}>
        <h2 style={{ textAlign: 'center', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: '-.01em', margin: 0 }}>
          Un aperçu, comme en révision
        </h2>
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 22, padding: 24, marginTop: 28, boxShadow: '0 24px 60px -40px rgba(60,40,20,.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
            <LogoBadge size={15} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F6E56', background: '#ECF7F0', padding: '4px 10px', borderRadius: 999 }}>● Questions de cours</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <div style={{ background: RED, color: '#fff', borderRadius: '14px 14px 4px 14px', padding: '12px 16px', fontSize: 14.5, fontWeight: 600, maxWidth: 460 }}>
              Quelle différence entre dol et erreur sur la substance ?
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <div style={{ flexShrink: 0 }}><LogoBadge size={14} /></div>
            <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: '14px 14px 14px 4px', padding: '14px 16px', fontSize: 14.5, lineHeight: 1.6, color: INK }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', color: RED, background: '#FCE9E3', padding: '3px 8px', borderRadius: 6 }}>DROIT CIVIL</span>
              <div style={{ marginTop: 10 }}>
                Le <strong>dol</strong> (art. 1137 C. civ.) suppose des <strong>manœuvres</strong> d'un cocontractant pour tromper. L'<strong>erreur sur la substance</strong> (art. 1132) est spontanée et porte sur une qualité essentielle. Le dol vicie le consentement même sur une erreur qui aurait été indifférente.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#0F6E56', background: '#ECF7F0', padding: '4px 10px', borderRadius: 999 }}>📖 Fiche · Vices du consentement</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#0F6E56', background: '#ECF7F0', padding: '4px 10px', borderRadius: 999 }}>⚖️ Code civil</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, fontSize: 12.5, color: MUTED }}>
            <span>🔒 Base de cours validée</span>
            <span>Toujours rattaché à vos fiches</span>
          </div>
        </div>
      </section>

      {/* ───────────── Ce que vous pouvez faire ───────────── */}
      <section id="fonctions" style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 24px 20px' }}>
        <h2 style={{ textAlign: 'center', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: '-.01em', margin: 0 }}>
          Ce que vous pouvez faire
        </h2>
        <p style={{ textAlign: 'center', fontSize: 16.5, color: MUTED, margin: '12px auto 0', maxWidth: 560 }}>
          Toutes les façons de réviser le concours, réunies au même endroit et reliées à votre progression.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginTop: 36 }}>
          {FONCTIONS.map(f => (
            <div key={f.titre} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 18, padding: 22 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${f.couleur}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{f.icone}</div>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17, marginTop: 14 }}>{f.titre}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: MUTED, marginTop: 7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Exemples « ce que vous pouvez demander » ───────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {EXEMPLES.map(e => (
            <div key={e.titre} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 18, padding: 24 }}>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 16.5 }}>{e.titre}</div>
              <div style={{ fontSize: 14.5, fontStyle: 'italic', color: INK, margin: '12px 0', lineHeight: 1.5 }}>{e.q}</div>
              <div style={{ fontSize: 12.5, color: MUTED }}>{e.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── La méthode / différence ───────────── */}
      <section id="methode" style={{ background: '#fff', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, marginTop: 30 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '60px 24px', display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px' }}>
            <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', color: RED, border: `1px solid ${BORDER}`, padding: '6px 14px', borderRadius: 999 }}>LA MÉTHODE</div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 38, letterSpacing: '-.01em', margin: '18px 0 0', lineHeight: 1.1 }}>
              Pensé pour le <span style={{ color: RED }}>concours</span>, pas pour réviser au hasard.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 26 }}>
              {[
                ['Répétition espacée', 'Chaque fiche revient au bon moment pour ancrer la connaissance sur la durée.'],
                ['Tout est relié', 'Cours, fiches, QCM et tuteur IA travaillent ensemble autour de votre progression.'],
                ['Un peu chaque jour', 'La régularité est suivie et récompensée — l\'important, c\'est de revenir.'],
              ].map(([t, d]) => (
                <div key={t} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: '#FCE9E3', color: RED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>✓</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{t}</div>
                    <div style={{ fontSize: 14.5, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: '1 1 320px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 22, padding: 32, width: '100%', maxWidth: 380 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, letterSpacing: '.04em' }}>VOTRE PROGRESSION</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 48, color: RED }}>🔥 7</span>
                <span style={{ fontSize: 15, color: MUTED, fontWeight: 600 }}>jours d'affilée</span>
              </div>
              <div style={{ height: 1, background: BORDER, margin: '20px 0' }} />
              {[['Maîtrise', 72, '#2DAE83'], ['Couverture', 58, '#3B82D9'], ['Régularité', 90, '#E8A11E']].map(([l, v, c]) => (
                <div key={l as string} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
                    <span>{l}</span><span style={{ color: MUTED }}>{v}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: '#EFE7D7' }}>
                    <div style={{ width: `${v}%`, height: '100%', borderRadius: 999, background: c as string }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── CTA final ───────────── */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '70px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 40, letterSpacing: '-.01em', margin: 0 }}>
          Prêt à réviser autrement ?
        </h2>
        <p style={{ fontSize: 17, color: MUTED, margin: '14px auto 0', maxWidth: 500 }}>
          Connectez-vous pour retrouver vos fiches, ou demandez un accès à l'équipe.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
          <Link href={lienEspace} style={btnPlein}>{labelEspace}</Link>
          <Link href="/login" style={btnLigne}>Demander un accès</Link>
        </div>
      </section>

      {/* ───────────── Pied de page ───────────── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '28px 24px' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Logo size={20} color={INK} />
          <div style={{ fontSize: 13, color: MUTED }}>Préparation au concours de l'ENM · {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  )
}

/* Illustration du hero : une rangée de codes juridiques sur une étagère. */
function CodexCodes() {
  const overlay = 'linear-gradient(100deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,.05) 16%, rgba(0,0,0,.04) 78%, rgba(0,0,0,.18) 100%)'
  return (
    <div style={{ width: 480, maxWidth: '100%', padding: '8px 4px 0', fontFamily: "'Hanken Grotesk', sans-serif" }} aria-label="Illustration — codes juridiques">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 9, height: 296 }}>
        {LIVRES.map((l, i) => (
          <div key={i} style={{
            position: 'relative', width: 70, height: l.h, borderRadius: '4px 4px 3px 3px',
            backgroundColor: l.bg, backgroundImage: overlay,
            boxShadow: '0 22px 30px -18px rgba(120,30,20,.55)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '11px 7px 9px',
            transform: `rotate(${l.rot})`,
          }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.16)', borderRadius: 3, padding: '2px 7px' }}>2026</div>
            <div style={{ flex: 1, width: '100%', margin: '9px 0', border: '1px solid rgba(255,255,255,.55)', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: '.16em', color: 'rgba(255,255,255,.7)' }}>{l.kicker}</span>
              <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: l.size, fontWeight: 800, lineHeight: 0.98, color: '#fff', textAlign: 'center' }}>
                {l.titre.split('\n').map((t, j) => <span key={j}>{j > 0 && <br />}{t}</span>)}
              </span>
            </div>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.92)', letterSpacing: '-.01em' }}>codex</div>
          </div>
        ))}
      </div>
      <div style={{ height: 8, margin: '0 6px', borderRadius: '0 0 5px 5px', background: 'linear-gradient(180deg,#E7CFA8,#D8BC8E)', boxShadow: '0 14px 22px -12px rgba(60,40,20,.4)' }} />
    </div>
  )
}
