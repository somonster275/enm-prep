import React from 'react'

// Contenu pédagogique partagé : affiché dans la fenêtre d'accueil (1re visite)
// et sur la page /methode. Présente les outils de codex (dont le collaboratif,
// mis en valeur) et les méthodes validées par la science de l'apprentissage.

const FONT = "'Hanken Grotesk', sans-serif"
const DISPLAY = "'Bricolage Grotesque', sans-serif"

// Outils pour réviser en solo (cœur de la mémorisation).
const REVISER: { emoji: string; titre: string; desc: string }[] = [
  { emoji: '🗂️', titre: 'Fiches en répétition espacée', desc: 'Chaque fiche revient au bon moment, juste avant que tu l\'oublies. C\'est le cœur de codex.' },
  { emoji: '🔀', titre: 'Révision mixte', desc: 'Mélange des fiches de toutes les matières dans une même session (entrelacement).' },
  { emoji: '✏️', titre: 'Brouillon', desc: 'Rédige ta réponse de mémoire avant de retourner la carte, puis compare.' },
  { emoji: '✅', titre: 'QCM & révision des erreurs', desc: 'Entraîne-toi sur des QCM auto-corrigés. codex retient tes erreurs et te les fait rejouer.' },
  { emoji: '📕', titre: 'Carnet d\'erreurs', desc: 'Toutes les fiches que tu maîtrises mal sont regroupées pour les revoir en priorité.' },
  { emoji: '⭐', titre: 'Favoris', desc: 'Marque les fiches clés d\'une étoile et révise-les en une session dédiée.' },
]

// Outils collaboratifs — mis en valeur dans un bloc dédié.
const COLLABORATIF: { emoji: string; titre: string; desc: string }[] = [
  { emoji: '⚔️', titre: 'Duel', desc: 'Affronte d\'autres candidats en temps réel sur les mêmes questions — chrono, classement live et historique de tes matchs.' },
  { emoji: '🤝', titre: 'Entraide', desc: 'Un annuaire entre candidats : trouve quelqu\'un prêt à t\'aider sur une matière, ou propose ton aide.' },
  { emoji: '💬', titre: 'Forum Q&R', desc: 'Pose une question à la communauté, réponds à celles des autres. Tu es notifié·e quand on te répond.' },
  { emoji: '📚', titre: 'Annales partagées', desc: 'Sujets et corrigés mis en commun par les candidats, classés par matière.' },
  { emoji: '🏆', titre: 'Classement & défi', desc: 'Un défi de la semaine et un classement (anonyme) pour garder la motivation, ensemble.' },
]

// Outils qui accompagnent au quotidien.
const ACCOMPAGNER: { emoji: string; titre: string; desc: string }[] = [
  { emoji: '🤖', titre: 'Coach', desc: 'Un tuteur qui connaît ta progression et t\'aide à organiser tes révisions.' },
  { emoji: '🎓', titre: 'Questions de cours', desc: 'Pose une question, obtiens une réponse sourcée sur la base de cours.' },
  { emoji: '🔍', titre: 'Recherche globale', desc: 'Retrouve d\'un coup une fiche, un QCM, une vidéo, une annale ou un sujet du forum.' },
  { emoji: '🎬', titre: 'Vidéos', desc: 'Des vidéos sélectionnées par matière, à regarder directement dans codex.' },
  { emoji: '📅', titre: 'Calendrier', desc: 'Tes cours de la fac et les événements de la prépa au même endroit, synchronisés.' },
  { emoji: '🔔', titre: 'Notifications', desc: 'Tu es prévenu·e dès qu\'on répond à ta question ou qu\'un événement t\'attend.' },
]

const MARCHE: { titre: string; desc: string }[] = [
  { titre: 'La répétition espacée', desc: 'Revoir une notion à intervalles croissants ancre la mémoire bien mieux qu\'une longue séance unique.' },
  { titre: 'Se tester (récupération active)', desc: 'Essayer de retrouver la réponse de mémoire — même en se trompant — renforce l\'apprentissage. D\'où le brouillon et les QCM.' },
  { titre: 'Mélanger les sujets (entrelacement)', desc: 'Alterner les matières force ton cerveau à choisir le bon raisonnement : meilleure rétention et transfert.' },
  { titre: 'Apprendre avec les autres', desc: 'Expliquer, se confronter, s\'entraîner à plusieurs (forum, duel, entraide) ancre les connaissances et soutient la motivation sur la durée.' },
  { titre: 'Reformuler avec ses mots', desc: 'Expliquer une notion comme si tu l\'enseignais (effet Feynman) révèle ce que tu maîtrises vraiment.' },
]

const MARCHE_PAS: { titre: string; desc: string }[] = [
  { titre: 'Relire et surligner passivement', desc: 'Ça donne une impression de maîtrise… trompeuse. Reconnaître n\'est pas savoir restituer.' },
  { titre: 'Recopier le cours mot à mot', desc: 'Occupé ≠ efficace. La copie n\'oblige pas à réfléchir.' },
  { titre: 'Bûcher une seule matière en bloc', desc: 'Rester des heures sur le même sujet fatigue et donne moins que des sessions variées.' },
  { titre: 'Réviser isolé·e jusqu\'au bout', desc: 'S\'enfermer seul·e épuise la motivation. Le collectif aide à tenir et à repérer ses angles morts.' },
  { titre: 'Le bachotage de dernière minute', desc: 'On retient sur le moment puis on oublie vite : inutile pour un concours qui teste sur la durée.' },
]

function GrilleOutils({ items }: { items: { emoji: string; titre: string; desc: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {items.map(o => (
        <div key={o.titre} style={{ background: '#FFFBF2', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{o.emoji} {o.titre}</div>
          <div style={{ fontSize: 12.5, color: '#8A7E68', marginTop: 3, lineHeight: 1.5 }}>{o.desc}</div>
        </div>
      ))}
    </div>
  )
}

export default function MethodeContenu() {
  return (
    <div style={{ fontFamily: FONT, color: '#2A2018' }}>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: '#5C5448', margin: '0 0 18px' }}>
        codex réunit, au même endroit, des outils pour <b>réviser efficacement</b>, une <b>communauté de candidats</b> pour ne pas avancer seul·e,
        et un accompagnement au quotidien — le tout fondé sur les méthodes <b>validées par la science de l&apos;apprentissage</b>.
      </p>

      {/* Origine : un projet d'étudiant, entre pairs. */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#FFFBF2', border: '1px solid #F0E7D6', borderRadius: 14, padding: '14px 16px', margin: '0 0 24px' }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🎓</span>
        <div style={{ fontSize: 13.5, color: '#5C5448', lineHeight: 1.55 }}>
          <b>Conçu par un étudiant en classe préparatoire à l&apos;ENM</b>, pour les candidats au concours.
        </div>
      </div>

      {/* Réviser (solo) */}
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, margin: '0 0 12px' }}>📖 Réviser, efficacement</div>
      <div style={{ marginBottom: 26 }}><GrilleOutils items={REVISER} /></div>

      {/* Collaboratif — bloc mis en valeur */}
      <div style={{
        background: 'linear-gradient(135deg, #FFF4E6 0%, #FCE9E3 100%)',
        border: '1px solid #F3C6BC', borderRadius: 18, padding: '20px 20px 22px', marginBottom: 26, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: '#DC4A2B', opacity: 0.08, right: -28, top: -34 }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#fff', background: '#DC4A2B', borderRadius: 999, padding: '4px 11px', marginBottom: 10 }}>
            Le cœur de codex
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 21, lineHeight: 1.2, marginBottom: 6 }}>
            🤝 Réviser ensemble, c&apos;est tenir la distance
          </div>
          <p style={{ fontSize: 14, color: '#6E5A50', lineHeight: 1.55, margin: '0 0 16px', maxWidth: 540 }}>
            Préparer un concours seul·e, c&apos;est dur. Ici, tu avances avec les autres : on se challenge, on s&apos;entraide,
            on partage ses ressources. <b>La motivation tient mieux à plusieurs</b> — et on apprend en expliquant.
          </p>
          <GrilleOutils items={COLLABORATIF} />
        </div>
      </div>

      {/* Accompagner */}
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, margin: '0 0 12px' }}>🧭 Toujours là pour t&apos;aider</div>
      <div style={{ marginBottom: 30 }}><GrilleOutils items={ACCOMPAGNER} /></div>

      {/* Ce qui marche */}
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, margin: '0 0 12px', color: '#0F6E56' }}>✅ Ce qui marche</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 26 }}>
        {MARCHE.map(m => (
          <div key={m.titre} style={{ display: 'flex', gap: 12, background: '#ECF7F0', border: '1px solid #BFE6CF', borderRadius: 12, padding: '12px 14px' }}>
            <span style={{ flexShrink: 0, color: '#0F6E56', fontWeight: 800 }}>✓</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0E5A47' }}>{m.titre}</div>
              <div style={{ fontSize: 13, color: '#3F7A68', marginTop: 2, lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ce qui ne marche pas */}
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, margin: '0 0 12px', color: '#C0392B' }}>❌ Ce qui ne marche pas</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MARCHE_PAS.map(m => (
          <div key={m.titre} style={{ display: 'flex', gap: 12, background: '#FCEEEA', border: '1px solid #F3C6BC', borderRadius: 12, padding: '12px 14px' }}>
            <span style={{ flexShrink: 0, color: '#C0392B', fontWeight: 800 }}>✕</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#A33125' }}>{m.titre}</div>
              <div style={{ fontSize: 13, color: '#9A5A4F', marginTop: 2, lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
