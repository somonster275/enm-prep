import React from 'react'

// Contenu pédagogique partagé : affiché dans la fenêtre d'accueil (1re visite)
// et sur la page /methode. Fondé sur la science de l'apprentissage.

const FONT = "'Hanken Grotesk', sans-serif"

const OUTILS: { emoji: string; titre: string; desc: string }[] = [
  { emoji: '🗂️', titre: 'Fiches en répétition espacée', desc: 'Chaque fiche revient au bon moment, juste avant que tu l\'oublies. C\'est le cœur de codex.' },
  { emoji: '🔀', titre: 'Révision mixte', desc: 'Mélange des fiches de toutes les matières dans une même session (entrelacement).' },
  { emoji: '✏️', titre: 'Brouillon', desc: 'Rédige ta réponse de mémoire avant de retourner la carte, puis compare.' },
  { emoji: '💬', titre: 'Questions de cours', desc: 'Pose une question, obtiens une réponse sourcée sur la base de cours.' },
  { emoji: '🤖', titre: 'Coach', desc: 'Un tuteur qui connaît ta progression et t\'aide à organiser tes révisions.' },
  { emoji: '🤝', titre: 'Entraide', desc: 'Trouve d\'autres étudiants prêts à t\'aider sur une matière.' },
]

const MARCHE: { titre: string; desc: string }[] = [
  { titre: 'La répétition espacée', desc: 'Revoir une notion à intervalles croissants ancre la mémoire bien mieux qu\'une longue séance unique.' },
  { titre: 'Se tester (récupération active)', desc: 'Essayer de retrouver la réponse de mémoire — même en se trompant — renforce l\'apprentissage. D\'où le brouillon.' },
  { titre: 'Mélanger les sujets (entrelacement)', desc: 'Alterner les matières force ton cerveau à choisir le bon raisonnement : meilleure rétention et transfert.' },
  { titre: 'Reformuler avec ses mots', desc: 'Expliquer une notion comme si tu l\'enseignais (effet Feynman) révèle ce que tu maîtrises vraiment.' },
  { titre: 'Structurer (mind maps, schémas)', desc: 'Relier les idées entre elles crée des points d\'ancrage solides.' },
]

const MARCHE_PAS: { titre: string; desc: string }[] = [
  { titre: 'Relire et surligner passivement', desc: 'Ça donne une impression de maîtrise… trompeuse. Reconnaître n\'est pas savoir restituer.' },
  { titre: 'Recopier le cours mot à mot', desc: 'Occupé ≠ efficace. La copie n\'oblige pas à réfléchir.' },
  { titre: 'Bûcher une seule matière en bloc', desc: 'Rester des heures sur le même sujet fatigue et donne moins que des sessions variées.' },
  { titre: 'Le bachotage de dernière minute', desc: 'On retient sur le moment puis on oublie vite : inutile pour un concours qui teste sur la durée.' },
  { titre: 'Croire aux « styles d\'apprentissage »', desc: 'Le mythe « je suis visuel / auditif » n\'est pas validé scientifiquement. Ce sont les méthodes ci-dessus qui comptent.' },
]

export default function MethodeContenu() {
  return (
    <div style={{ fontFamily: FONT, color: '#2A2018' }}>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: '#5C5448', margin: '0 0 22px' }}>
        codex est construit autour des méthodes <b>validées par la science de l&apos;apprentissage</b>.
        Voici comment l&apos;utiliser, et surtout ce qui marche vraiment — et ce qui ne marche pas.
      </p>

      {/* Comment ça marche */}
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17, margin: '0 0 12px' }}>Les outils de codex</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 26 }}>
        {OUTILS.map(o => (
          <div key={o.titre} style={{ background: '#FFFBF2', border: '1px solid #F0E7D6', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{o.emoji} {o.titre}</div>
            <div style={{ fontSize: 12.5, color: '#8A7E68', marginTop: 3, lineHeight: 1.5 }}>{o.desc}</div>
          </div>
        ))}
      </div>

      {/* Ce qui marche */}
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17, margin: '0 0 12px', color: '#0F6E56' }}>✅ Ce qui marche</div>
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
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17, margin: '0 0 12px', color: '#C0392B' }}>❌ Ce qui ne marche pas</div>
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
