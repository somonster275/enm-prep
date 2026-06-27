import Link from 'next/link'
import { LogoBadge } from '@/components/Logo'

export const metadata = { title: 'Confidentialité & données — codex' }

const MAJ = '27 juin 2026'

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #F0E7D6', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{titre}</div>
      <div style={{ fontSize: 14.5, lineHeight: 1.65, color: '#5C5448' }}>{children}</div>
    </div>
  )
}

export default function DonneesPage() {
  const lien = { color: '#DC4A2B', fontWeight: 700, textDecoration: 'none' }
  return (
    <div className="bg-grille" style={{ minHeight: '100vh', backgroundColor: '#FDF6EA', fontFamily: "'Hanken Grotesk', sans-serif", color: '#2A2018' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 22px 60px' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: 28 }}><LogoBadge size={20} /></Link>

        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 30, margin: 0 }}>Confidentialité & données</h1>
        <p style={{ fontSize: 15.5, color: '#8A7E68', margin: '10px 0 6px' }}>
          Comment codex traite tes données personnelles, et les droits dont tu disposes (RGPD).
        </p>
        <p style={{ fontSize: 12.5, color: '#B6A98C', margin: '0 0 26px' }}>Dernière mise à jour : {MAJ}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section titre="Qui est responsable ?">
            codex est une application de préparation au concours de l&apos;ENM, éditée et administrée à titre
            personnel. Pour toute question relative à tes données, contacte le responsable via la page{' '}
            <Link href="/contact" style={lien}>Nous contacter</Link> ou par email à titipaulin@gmail.com.
          </Section>

          <Section titre="Quelles données sont collectées ?">
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              <li><b>Compte</b> : adresse email, mot de passe (chiffré, jamais lisible), prénom et nom (facultatifs).</li>
              <li><b>Révisions</b> : ta progression, ton activité quotidienne, tes notes/tâches personnelles.</li>
              <li><b>Entraide</b> (facultatif, si tu publies ta fiche) : prénom/nom, contact, matières — visibles des autres étudiants connectés.</li>
              <li><b>Remarques</b> que tu envoies sur les fiches.</li>
              <li><b>Mon Drive</b> : les liens que tu ajoutes ; si tu connectes Google Drive, des jetons d&apos;accès (en lecture seule) conservés de façon sécurisée côté serveur.</li>
            </ul>
          </Section>

          <Section titre="Pourquoi (finalités) et sur quelle base légale ?">
            Tes données servent uniquement à <b>fournir le service</b> : authentification, suivi des révisions,
            entraide et assistance. La base légale est l&apos;<b>exécution du service</b> que tu utilises et,
            pour les fonctions optionnelles (entraide, connexion Drive, assistant IA), ton <b>consentement</b>,
            que tu peux retirer à tout moment en cessant de les utiliser.
          </Section>

          <Section titre="Qui héberge et traite les données (sous-traitants) ?">
            Pour fonctionner, codex s&apos;appuie sur des prestataires techniques, dont certains sont situés
            <b> hors de l&apos;Union européenne</b> (encadrés par les clauses contractuelles types lorsque requis) :
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li><b>Supabase</b> — base de données & authentification.</li>
              <li><b>Vercel</b> — hébergement de l&apos;application (États-Unis).</li>
              <li><b>Resend</b> — envoi des emails (États-Unis).</li>
              <li><b>Anthropic (Claude)</b> — assistant « Questions de cours » (États-Unis).</li>
              <li><b>DeepSeek</b> — assistant « Coach » / tuteur (serveurs en Chine).</li>
              <li><b>Voyage AI</b> — indexation des contenus de cours (États-Unis).</li>
              <li><b>Google</b> — uniquement si tu connectes Google Drive (accès en lecture seule).</li>
            </ul>
            <div style={{ marginTop: 8 }}>
              Lorsque tu utilises un assistant IA, le contenu de ta question (et, pour le coach, des éléments de
              ta progression) est transmis au prestataire concerné pour générer la réponse. <b>N&apos;y inscris pas
              d&apos;informations sensibles</b> que tu ne souhaites pas voir traitées.
            </div>
          </Section>

          <Section titre="Combien de temps sont-elles conservées ?">
            Tes données sont conservées tant que ton compte est actif. Tu peux les supprimer toi-même à tout
            moment (voir ci-dessous) ; la suppression du compte efface définitivement l&apos;ensemble de tes données.
          </Section>

          <Section titre="Cloisonnement & sécurité">
            Chaque compte est <b>isolé</b> : la base de données applique des règles de sécurité par utilisateur
            (Row Level Security) qui empêchent l&apos;accès aux données d&apos;un autre compte. Les jetons d&apos;accès
            (ex. Google Drive) ne sont jamais exposés au navigateur. Tes données <b>ne sont ni vendues ni partagées</b>
            à des fins commerciales ou publicitaires.
          </Section>

          <Section titre="Cookies">
            codex n&apos;utilise que des cookies <b>strictement nécessaires</b> à la connexion (session
            d&apos;authentification). Aucun cookie publicitaire ni traceur de suivi tiers.
          </Section>

          <Section titre="Tes droits">
            Conformément au RGPD, tu disposes des droits d&apos;<b>accès</b>, de <b>rectification</b>,
            d&apos;<b>effacement</b>, de <b>limitation</b>, d&apos;<b>opposition</b> et de <b>portabilité</b> :
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li><b>Accès / portabilité</b> : exporte toutes tes données en JSON depuis <Link href="/compte" style={lien}>Mon compte</Link>.</li>
              <li><b>Rectification</b> : modifie ton identité depuis <Link href="/compte" style={lien}>Mon compte</Link>.</li>
              <li><b>Effacement</b> : supprime ton compte et toutes tes données depuis <Link href="/compte" style={lien}>Mon compte</Link>.</li>
              <li>Pour toute autre demande : <Link href="/contact" style={lien}>Nous contacter</Link>.</li>
            </ul>
            <div style={{ marginTop: 8 }}>
              Tu peux aussi introduire une réclamation auprès de la <b>CNIL</b> (www.cnil.fr).
            </div>
          </Section>
        </div>

        <div style={{ marginTop: 22, fontSize: 14, color: '#8A7E68' }}>
          Une question ? <Link href="/contact" style={lien}>Contacte-nous</Link>.
        </div>
      </div>
    </div>
  )
}
