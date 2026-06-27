# Sauvegarde mémoire — enm-prep

> Snapshot du projet pour reprise de contexte. Dernière mise à jour : 2026-06-27 (suite 8).

## Vue d'ensemble
Application web de préparation à l'**ENM** (École Nationale de la Magistrature).
Système de **fiches** (question/réponse) révisées par **répétition espacée**, avec
suivi de la progression, des séries (streaks) et d'un objectif quotidien.

## Stack technique
- **Next.js 16.2.6** (App Router) — ⚠️ version récente avec breaking changes : consulter
  `node_modules/next/dist/docs/` avant d'écrire du code (cf. AGENTS.md).
- **React 19.2.4**, **TypeScript 5**, **Tailwind CSS 4** (via `@tailwindcss/postcss`).
- **Supabase** : auth (`@supabase/ssr`, `@supabase/auth-helpers-nextjs`) + base de données.
- Autres libs : `dompurify` (sanitisation HTML), `sql.js` + `jszip` + `fzstd`
  (probablement pour l'import de bases / fichiers compressés).
- Turbopack activé ; webpack fallback `fs/path/crypto: false` (pour sql.js côté client).

## Structure des routes (`app/`)
- `(auth)/login` — connexion
- `auth/callback/route.ts` — callback OAuth Supabase
- `(app)/layout.tsx` — layout authentifié
- `(app)/dashboard` — tableau de bord (progression, streaks, objectif du jour)
- `(app)/espaces/[slug]` — page d'un espace
- `(app)/espaces/[slug]/modules/[moduleId]` — fiches d'un module
- `(app)/espaces/[slug]/revision` — session de révision
- `(app)/admin/editeur` — éditeur de contenu
- `(app)/admin/import` — import de fiches
- `(app)/admin/corbeille` — corbeille
- `(app)/admin/utilisateurs` — gestion des utilisateurs

## Modèle de données (`types/index.ts`)
- `Role` : `'admin' | 'editeur' | 'lecteur'`
- `Niveau` : `0 | 1 | 2 | 3`
- `Espace` { id, nom, slug, description, couleur, ordre }
- `Module` { id, espace_id, nom, description?, ordre, parent_id? } — modules imbriquables
- `Fiche` { id, module_id, question, reponse, tags?, created_at }
- `Profil` { id, email, nom?, prenom?, role } — `prenom` ajouté le 2026-06-27 (migration `0005`)
- `Progression` { id, utilisateur_id, fiche_id, niveau, prochaine_revision, derniere_revision? }

Tables Supabase identifiées : `activite_jours` (utilisateur_id, jour, cartes),
plus tables sous-jacentes aux types (espaces, modules, fiches, profils, progressions).

## Logique métier (`lib/`)
- **`spaced-repetition.ts`** : 4 niveaux `NIVEAUX` avec couleurs et intervalles —
  À revoir (0 j), Intermédiaire (3 j), Bien (7 j), Parfait (21 j).
  - `prochaineRevision(niveau)`, `estDue(date)`, `scoreGlobal(progressions)` (% sur niveau max 3).
- **`streaks.ts`** : objectif quotidien `OBJECTIF_QUOTIDIEN = 20` cartes.
  - `enregistrerActivite`, `chargerActivite` (60 j), `calculerStreak` (valide si actif
    aujourd'hui OU hier), `meilleurStreak`, `derniers7Jours`, `cartesAujourdhui`.
- **`supabase.ts`** : client navigateur (`createBrowserClient`) + `getSupabaseAdmin()`
  (service role, requiert `SUPABASE_SERVICE_ROLE_KEY`).
  - ⚠️ URL et clé anon Supabase sont en dur comme fallback dans le fichier.
- **`supabase-server.ts`** : client serveur SSR `createSupabaseServer()` (lit la session
  depuis les cookies). Implémenté par Théo. Utilisé pour l'auth des routes RAG.
- **`embeddings.ts`** : helper Voyage AI (`embed`, `embedQuestion`, `toVector`),
  modèle par défaut `voyage-law-2` (1024 dims).
- **`auth-serveur.ts`** : `utilisateurCourant()` (identité via cookies) + `estAdmin()`.

## Fonctionnalité « Questions de cours » (`/cours-ia`) — RAG
Page de chat IA (marque interne « codex ») avec un **sélecteur de mode** :
- **Base ENM** (officiel) : base alimentée par les **admins uniquement**, interrogée par
  tous. **Recherche sémantique RAG** : embeddings Voyage `voyage-law-2` + pgvector,
  fonction SQL `match_cours_chunks`.
  - **Côté étudiant (décidé 2026-06-26)** : les étudiants posent leur question
    **librement sur toute la base** ; ils ne voient PAS la liste des documents et ne
    peuvent ni en ajouter ni en sélectionner. La sidebar de sélection + le toggle
    « Documents » sont **masqués en mode officiel** (`mode === 'personnel'` requis pour
    les afficher). L'admin gère les documents via le panneau « + Importer ».
  - Sécurité serveur : `/api/cours/upload` refuse (403) tout import officiel par un
    non-admin (`estAdmin`). `/api/cours/question` en officiel n'exige pas d'auth (lecture
    libre). État au 2026-06-26 : **base ENM vide**, à constituer par l'admin.
- **Mes documents** (personnel) : chaque utilisateur importe ses fichiers **privés**
  (`created_by` = lui) et les interroge en **recherche plein-texte** (pas d'embeddings).
  Garde la sidebar de sélection des documents.
  - Les 2 PDF de test (Médecine légale, Identification des corps) appartiennent à
    **titipaulin** et ont été **basculés ici** (étaient à tort en officiel).

Tables : `cours_documents` (id, nom, espace_id, nb_chunks, created_by, deleted_at,
**portee** 'officiel'|'personnel') et `cours_chunks` (document_id, contenu, position,
**embedding** vector(1024)). Routes : `/api/cours/upload` (extraction PDF/TXT, chunking,
embeddings si officiel) et `/api/cours/question` (RAG officiel / FTS personnel, streaming
SSE vers Claude `claude-sonnet-4-6`). Identité serveur via cookies (jamais le user_id client).

Migration à exécuter dans Supabase : `supabase/migrations/0002_rag_cours.sql` (faite le 2026-06-26).

## Points d'attention / TODO potentiels
- Clé anon Supabase hardcodée en fallback dans `lib/supabase.ts` (à déplacer en env si besoin).
- `meilleurStreak` limité à la fenêtre de 60 jours chargée.
- **Word (.docx) non supporté** à l'import cours (PDF/TXT seulement) → prochaine amélioration.
- `scripts/backfill-embeddings.mjs` (idempotent) : vectorise les passages officiels sans
  embedding. Lancé une fois sur les 2 PDF quand on les croyait « officiels » ; ils sont
  depuis passés en personnel (embeddings devenus inutiles mais inoffensifs). Garder le
  script comme filet de sécurité pour de futurs docs ENM.
- Pas de seuil de similarité sur la recherche sémantique (8 passages bruts).
- Variable d'env **`VOYAGE_API_KEY`** : présente et **validée** (clé `pa-…`, modèle
  `voyage-law-2`, 1024 dims). RAG testé bout-en-bout OK (scores ~57–64 % sur une vraie question).
- Fichiers en doublon : **SUPPRIMÉS le 2026-06-26 (suite 2)** —
  `app/(app)/assistant/`, `app/api/assistant/`, `scripts/ingest-cours.mjs`,
  `supabase/migrations/0001_rag_documents.sql`. Seul `0002_rag_cours.sql` subsiste.
  `lib/embeddings.ts` + `lib/auth-serveur.ts` conservés (utilisés par `/api/cours/*`).

## Environnement de dev
- Shell + git **fonctionnels** (le blocage espace disque de la 1ʳᵉ session est résolu).
  `npm run dev` tourne sur **port 3000** ; `npx tsc --noEmit` passe sans erreur.
- ⚠️ Piège récurrent : un serveur `next dev` fantôme garde le port 3000 → l'app
  bascule sur 3001 et semble « ne pas démarrer ». Remède : `taskkill /PID <pid> /F`.
- Projet versionné avec git (remote `origin` configuré).

## Journal des sessions

### 2026-06-27 (suite 8) — Favicon, page d'accueil publique, robustesse auth, identité étudiant
**Favicon (marque codex)**
- Remplacé le triangle Vercel par une icône **« c » corail** vectorielle. Méthode : convention `app/icon.svg` (et **suppression** de `app/favicon.ico` qui était servi automatiquement). Couleur fond `#E0613F`, trait `#221E1A`.
- **Piège majeur** : le middleware `proxy.ts` interceptait `/icon.svg` et le redirigeait vers `/login` (réponse HTML au lieu du SVG). Corrigé en ajoutant `icon.svg|apple-icon` au `matcher` négatif du proxy.

**Page d'accueil publique** (`app/page.tsx`, ex-redirect → vraie landing)
- Page de découverte AVANT connexion, architecture inspirée de Galien.AI : nav sticky, hero + réseau hexagonal des matières, démo « Questions de cours », grille des 8 fonctionnalités, section méthode + carte progression, CTA. Boutons → `/login` (ou `/dashboard` si déjà connecté).
- `proxy.ts` : `/` rendu **public** (ajouté à `estPublic`).

**Robustesse auth / invitations** (le gros du travail — beaucoup de SAV)
- `proxy.ts` : sur les routes `/api/*` non authentifiées, renvoie un **401 JSON** au lieu d'une redirection 307 vers `/login` (qui donnait un 405 sur POST et cassait les `fetch` à l'expiration de session).
- `/bienvenue` : après définition du mot de passe, **reconnexion explicite** (`signInWithPassword`, jusqu'à 6 essais avec délais) pour absorber la latence Supabase → entrée directe sans reconnexion manuelle ; si échec → redirige vers `/login`.
- `/bienvenue` : détecte les **erreurs de lien** Supabase (`error_code=otp_expired`, souvent lien pré-consommé par les anti-spam type SafeLinks) et propose un **renvoi de lien** self-service (`resetPasswordForEmail`).
- `/login` : ajout **« Mot de passe oublié ? »** (panneau inline → `resetPasswordForEmail` → lien de récup ramène sur `/bienvenue`).
- `changer-mot-de-passe` (admin) : **autorise désormais les comptes lecteur** (avant : réservé staff, ce qui empêchait de débloquer un étudiant).
- **PKCE** : les liens de récup `@supabase/ssr` arrivent avec `?code=...` (pas de hash). Quand Supabase retombe sur la **Site URL** (`/`) au lieu de `/bienvenue`, l'accueil détecte `?code` / `type=recovery|invite` / `error_code` et **bascule vers `/bienvenue`**.
- **Config à corriger côté user (Supabase → Auth → URL Configuration)** : la **Site URL était encore `https://codex-prepa.vercel.app`** → doit devenir **`https://codexprepa.com`**. Redirect URLs OK (`…/bienvenue`, `…/**`). Vérifier que le template email **« Reset Password »** est activé.
- Route `/api/acces/renvoyer-lien` créée puis **supprimée** (impasse : `inviteUserByEmail` échoue sur comptes existants). Le bon canal pour un compte existant = **récupération** (`resetPasswordForEmail`).

**Domaine & déploiement**
- **`NEXT_PUBLIC_APP_URL=https://codexprepa.com`** ajoutée dans Vercel Production (avant : non définie → repli sur `codex-prepa.vercel.app`). Domaine principal = **codexprepa.com**.
- **Vercel CLI authentifié localement** (`vercel login` + `vercel link` faits par le user) : je peux désormais `vercel ls` / `vercel inspect` / `vercel --prod`. La sortie passe par stderr (« exit 255 » trompeur mais OK).

**Identité étudiant + personnalisation**
- Migration **`0005_profil_prenom.sql`** : ajoute colonnes `nom` + `prenom` à `public.profils` (⚠️ **à exécuter dans Supabase SQL Editor**). `Profil` type → `prenom?`.
- `/compte` refondu : section **« Mon identité »** (prénom + nom) ; écriture via route **`/api/compte/profil`** (POST) qui n'écrit QUE nom/prénom (pas le rôle → pas d'escalade). + **widget ENT Paris 1** (lien `https://ent.univ-paris1.fr/`, nouvel onglet).
- Prénom propagé : **dashboard** « Bonjour, {prénom} », **TopNav** (initiales avatar = P+N, menu = « Prénom Nom »), **tuteur IA** (contexte + consigne de tutoyer par le prénom).

**Commits poussés sur `main`** (auto-déployés) : favicon, landing, proxy public/401, bienvenue (entrée directe + lien expiré + renvoi), mot de passe oublié, accueil détecte recovery/PKCE, compte identité+ENT, perso prénom, tuteur prénom.

**Restant à faire côté user** : (1) exécuter `0005_profil_prenom.sql` ; (2) passer la **Site URL** Supabase à `https://codexprepa.com` ; (3) débloquer le mot de passe admin via « Mot de passe oublié ? » ou le dashboard Supabase ; (4) nettoyer la demande de test `test-claude-demande@example.com`.

### 2026-06-26
- Reprise du projet après connexion du dossier `enm-prep-propre`.
- Exploration complète de l'arborescence : routes (`app/`), modèle de données
  (`types/index.ts`), logique métier (`lib/`), config (`next.config.ts`, `package.json`).
- Création de cette sauvegarde mémoire (`MEMORY.md`).
- Aucune modification du code applicatif aujourd'hui (session de prise de contexte).
- Blocage rencontré : shell/git indisponibles (espace disque) → commit à faire
  ultérieurement, fichiers déjà écrits sur disque.
- Prochaines pistes envisagées : implémenter `lib/supabase-server.ts` (vide),
  déplacer la clé Supabase hardcodée vers les variables d'env.

### 2026-06-26 (suite) — Fonctionnalité RAG « Questions de cours »
- Point de départ : Théo cherchait où déposer des documents (il était sur la page
  « Fichiers » de Claude Console). Clarifié : inutile, la fonctionnalité existe déjà
  dans l'app (`/cours-ia`).
- Constat : le système existant faisait de la recherche **plein-texte** (FTS Postgres),
  pas du RAG. Décision : passer la **base ENM** en **RAG sémantique**.
- Décisions produit :
  - 2 outils sur une **seule page** avec sélecteur : « Base ENM » / « Mes documents ».
  - Documents personnels **privés** (visibles seulement par leur auteur).
  - Base ENM alimentée par les **admins uniquement**.
  - Embeddings : **Voyage AI `voyage-law-2`** (spécialisé droit, 1024 dims, confirmé via doc).
  - RAG sémantique sur la **base ENM seulement** ; docs perso restent en FTS.
- Réalisé : migration `0002_rag_cours.sql` (pgvector + portee + embedding + fonction
  `match_cours_chunks`), `lib/embeddings.ts`, `lib/auth-serveur.ts`, refonte de
  `/api/cours/upload` et `/api/cours/question`, sélecteur de mode dans `/cours-ia`,
  doc `SETUP-RAG.md`. Aucune nouvelle dépendance npm (Voyage via `fetch`).
- Auth : bascule sur `createSupabaseServer()` (cookies) ajouté par Théo, plus propre
  que mon approche par token Bearer (retirée).
- Migration exécutée dans Supabase OK (après correction : `position` est un mot réservé,
  retiré du `returns table`).
- Incident dev : `localhost:3000` → ERR_CONNECTION_REFUSED. Cause = serveur `next dev`
  fantôme + verrou `.next` (« Another next dev server is already running »), PAS le code.
  Remède : `taskkill /IM node.exe /F` + `Remove-Item -Recurse -Force .next` + `npm run dev`.
- Reste à faire : installer `VOYAGE_API_KEY`, tester import + question, supprimer les 4
  fichiers en doublon, envisager le support `.docx`.

### 2026-06-26 (suite 2) — Démarrage app + ménage
- **Bug de démarrage résolu** : Next 16.2.6 interdit la coexistence de `middleware.ts`
  et `proxy.ts` (« Both middleware file and proxy file are detected »). `middleware.ts`
  n'était qu'un stub vide → **supprimé**. `proxy.ts` (vrai garde d'auth Supabase via
  cookies, redirige vers `/login`) conservé comme fichier canonique.
- Corrigé un mauvais import : `app/api/assistant/route.ts` importait `getSupabaseAdmin`
  depuis `@/lib/supabase-server` (n'existe pas) → c'était dans `@/lib/supabase`.
  (Fichier ensuite supprimé de toute façon, cf. ci-dessous.)
- **4 doublons supprimés** (confirmés morts par grep, rien dans la nav n'y pointe) :
  `app/(app)/assistant/`, `app/api/assistant/`, `scripts/ingest-cours.mjs`,
  `supabase/migrations/0001_rag_documents.sql`. `SETUP-RAG.md` mis à jour en conséquence.
- `npx tsc --noEmit` repasse sans erreur ; `npm run dev` OK sur le port 3000.
- Design `/cours-ia` refondu façon « Codex » (corail #F2654B, Baloo 2, cartes/ombres)
  dans les sessions précédentes — TopNav horizontale laissée intacte.
- **RAG techniquement validé** : schéma 0002 OK, clé Voyage OK (appel direct), pipeline
  embed question → `match_cours_chunks` testé (4 passages, similarité 57–64 %).
  Backfill `scripts/backfill-embeddings.mjs` créé et lancé (24 passages).

### 2026-06-27 (suite 7) — Progression repensée (score composite)
- **`lib/progression.ts`** : `calculerProgression()` = score global pondéré sur 3
  dimensions — **maîtrise** (scoreGlobal des paliers, 50%), **couverture** (modules
  abordés / total, 30%), **régularité** (taux d'objectif quotidien atteint sur 7 j, 20%).
  Poids dans `POIDS`, ajustables. (Tâches NON retenues par l'utilisateur.)
- **`components/ProgressionCard.tsx`** : score global (anneau) + 3 barres ; affiché en
  haut du **dashboard** (remplace l'ancien `scoreGlobal` seul ; le « Score global » du
  hero utilise désormais le composite).
- Le **coach** reçoit la progression composite (global + 3 dimensions) dans son contexte.
- Couverture = niveau **module** (fiches→module_id ; modules non supprimés). QCM/mindmaps/
  media pas encore intégrés (nécessitent du tracking ; QCM interactif = chantier à part).

### 2026-06-27 (suite 6) — Le coach connaît la progression de l'étudiant
- `/api/tuteur` injecte dans le contexte : score `scoreGlobal`, fiches dues (`estDue`)
  et maîtrisées (`palier >= PALIER_MAX`), total + **détail par matière** (fiches→modules→
  espaces), activité 7 j (activite_jours), tâches en attente (notes). Prompt mis à jour :
  le coach répond « où j'en suis » et priorise les matières en retard. Données lues via
  admin filtrées sur `user.id` (best-effort, try/catch).

### 2026-06-27 (suite 5) — Coach sous DeepSeek, le reste sous Claude
- `lib/ia.ts` : abstraction LLM, **provider par appel** (`streamIA`/`chatIA` prennent
  `provider: 'anthropic' | 'deepseek'`). DeepSeek = API compatible OpenAI (SSE).
  **Repli auto sur Claude** si `DEEPSEEK_API_KEY` absente → rien ne casse avant config.
- **Coach** (`/api/tuteur`) → **DeepSeek** (`CHATBOT_PROVIDER`, défaut `deepseek`) pour
  réduire les coûts (gros volume étudiant).
- **Questions de cours** (`/api/cours/question`) → **Claude** forcé (rigueur juridique).
  **Génération de fiches** → Claude (inchangée, SDK Anthropic direct).
- **`DEEPSEEK_API_KEY` configurée et VALIDÉE** (testée en local, réponse FR correcte, le
  modèle renvoyé est `deepseek-v4-flash`). Coach = DeepSeek confirmé OK. Optionnel :
  `CHATBOT_PROVIDER=anthropic` pour repasser le coach sous Claude, `DEEPSEEK_MODEL`.
  Reste à reporter `DEEPSEEK_API_KEY` (+ `CHATBOT_PROVIDER=deepseek`) dans Vercel + redeploy.

### 2026-06-27 (suite 4) — Notes/tâches + coach qui les propose + logo code civil
- **Table `notes`** (migration `0004_notes.sql`, RLS par utilisateur) : pense-bête perso.
- **`components/NotesWidget.tsx`** (ajouter/cocher/supprimer, scroll) placé dans le
  **Calendrier** (après l'en-tête) et sur l'**accueil** (colonne droite sous le mini-calendrier).
- **Coach propose des tâches** : prompt `/api/tuteur` peut émettre un bloc
  `<TACHES>\n- …\n</TACHES>` ; `TuteurChat` le parse (caché pendant le streaming),
  masque le bloc et affiche chaque tâche avec « + Ajouter » → insert dans `notes`.
- **Logo chatbot = code civil 📕** (bulle, avatars TuteurChat, onglet Coach cours-ia).
- À faire côté user : exécuter `0004_notes.sql` dans Supabase.

### 2026-06-27 (suite 3) — Coach IA (bulle flottante)
- Le « Tuteur IA » devient un **Coach de révision** : prompt enrichi (programme +
  épreuves ENM), et la route `/api/tuteur` injecte un **contexte temps réel** : date du
  jour + compte à rebours vers le prochain `evenements.type='examen'` + liste des
  événements à venir → conseils de planning adaptés au temps restant + méthodes.
- **Bulle flottante** bas-droite (`components/ChatbotBulle.tsx`) montée dans `(app)/layout`
  → présente sur toutes les pages. Composant chat réutilisable `components/TuteurChat.tsx`
  (variantes `full` / `bubble`, mémoire 24h localStorage partagée clé `tuteur-messages`).
- Ajouté comme **3ᵉ onglet « Coach IA »** dans `/cours-ia` (état `vueTuteur` qui masque le
  RAG et rend `<TuteurChat/>`). Onglet « Tuteur IA » **retiré de la nav** (→ la bulle).
- Page `/tuteur` conservée (wrapper TuteurChat) mais plus dans la nav.
- TODO possible (v2) : laisser le coach **créer/modifier** des événements du calendrier
  (tool-use) — pour l'instant il conseille mais ne modifie pas le planning.

### 2026-06-27 (suite 2) — Nouvelles fonctionnalités IA (via Claude API, pas de modèle local)
- Décision : pas d'IA locale (trop lourd sur mobile, qualité moindre) → tout via l'API Claude.
- **Tuteur IA** (`/tuteur` + `/api/tuteur`) : chat libre non limité aux docs importés
  (explications, méthodes, résumés), SSE streaming, mémoire 24h localStorage, responsive.
  Lien « Tuteur IA » dans TopNav. Prompt = tuteur ENM.
- **Générateur de fiches** (`/api/ia/generer-fiches` staff-only + `components/GenerateurFiches.tsx`)
  intégré dans l'éditeur (onglet Fiches, quand un module est choisi) : Claude génère des
  paires Q/R en JSON depuis un thème/texte → relire/éditer/décocher → insère dans `fiches`.
- **QCM interactif** : PAS fait — le « QCM » actuel est juste un stockage de ressources
  (OutilContenu), pas un quiz structuré. Un vrai QCM IA = chantier séparé (table options/
  réponses + lecteur). À proposer si demandé.

### 2026-06-27 (suite) — Responsive mobile
- App rendue responsive. Architecture en styles inline → approche : **CSS global**
  dans `globals.css` qui replie **toute** grille inline en 1 colonne sur mobile via le
  sélecteur d'attribut `[style*="grid-template-columns"] { ...1fr !important }` (sûr car
  aucune page n'utilise minmax/auto-fill). + classes `.app-main` (marges réduites),
  `.hide-mobile`, `.login-form`, `.cours-ia-wrap` ; `overflow-x:hidden` global.
- Hook **`lib/useIsMobile.ts`** (matchMedia 768px) pour la logique JS.
- `TopNav` : menu **hamburger** + tiroir vertical sur mobile. `login` : poster masqué.
  `cours-ia` : header qui s'enroule, colonnes empilées, sidebar repliée par défaut.
- Viewport meta ajouté dans `app/layout.tsx`. Breakpoint = 768px.
- Pages secondaires (espaces, admin, calendrier, etc.) : bénéficient du repli de grille
  global automatiquement ; à fignoler au cas par cas selon retours.

### 2026-06-27 — Email demandeur, page Mon compte, suppression d'utilisateurs
- **À l'approbation (OPTION B retenue le 2026-06-27)** : `inviteUserByEmail` Supabase
  → email d'invitation au demandeur (n'importe quelle adresse, sans domaine Resend),
  redirectTo `/bienvenue` + profil lecteur. Page publique **`app/bienvenue/page.tsx`**
  (exemptée dans `proxy.ts`) : le client Supabase détecte le jeton dans l'URL
  (`onAuthStateChange`/`getUser`), la personne définit son mot de passe
  (`updateUser({password})`) → /dashboard. Plus de mot de passe provisoire ni d'affichage
  d'identifiants côté admin (juste « invitation envoyée »).
  - ⚠️ Requiert dans Supabase : Redirect URLs doit inclure `…/bienvenue` (ou `/**`).
    Email d'invitation via service intégré Supabase (gratuit mais limité/spam sur plan
    gratuit → SMTP custom si volume). L'ancienne piste Resend-au-demandeur (option A,
    nécessitait un domaine) est abandonnée. `lib/email.ts` garde `envoyerEmail` générique
    (inutilisé pour l'instant) ; `envoyerEmailAdmin` sert encore à la notif admin Resend.
- **Page `/compte`** (`app/(app)/compte/page.tsx`, lien dans le menu TopNav) :
  `supabase.auth.updateUser({ password })` → mot de passe définitif.
- **Suppression d'utilisateurs** : route `/api/admin/supprimer-utilisateur` (admin only,
  bloque l'auto-suppression) + bouton dans `admin/utilisateurs`. Supprime profil + auth user.
- `lib/email.ts` : ajout d'`envoyerEmail(to, sujet, html)` générique.
- Note : `TopNav.tsx` crée les profils manquants avec `role: 'etudiant'` (hors enum
  'admin|editeur|lecteur') — incohérence latente à surveiller.

### 2026-06-26 (suite 5) — Demande d'accès lecteur (self-service) + fix création users
- **Bug création d'utilisateurs** : la page `admin/utilisateurs` appelait
  `/api/admin/creer-utilisateur` qui **n'existait pas** (404). Route créée
  (admin only, `creerCompte` via service role + email_confirm). Helper partagé
  `lib/creer-compte.ts`.
- **Nouvelle feature « Demander un accès lecteur »** depuis la page de connexion :
  formulaire (nom/email/message) → route PUBLIQUE `/api/acces/demande` (enregistre
  + email Resend à l'admin). Espace admin : section « Demandes en attente »
  (Approuver → crée le compte lecteur + affiche identifiants / Refuser).
  Table `demandes_acces` (migration `0003_demandes_acces.sql`).
- `proxy.ts` : `/api/acces` et `/auth` rendus accessibles **sans auth** (sinon le
  POST public était redirigé vers /login).
- **Email via Resend** (`lib/email.ts`) : nouvelle env **`RESEND_API_KEY`** ;
  FROM=onboarding@resend.dev (mode test → écrit seulement à l'adresse du compte
  Resend = titipaulin@gmail.com). Pour écrire aux nouveaux users, vérifier un
  domaine. Env optionnelles : `EMAIL_FROM`, `ADMIN_NOTIF_EMAIL`, `NEXT_PUBLIC_APP_URL`.
- À faire côté user : exécuter `0003` dans Supabase + ajouter `RESEND_API_KEY` dans Vercel.

### 2026-06-26 (suite 4) — Déploiement Vercel
- **App en PRODUCTION sur Vercel** : projet `enm-prep` (compte somonster275, plan Hobby),
  relié au repo GitHub `somonster275/enm-prep`, **Production suit la branche `main`**
  (un push sur main = déploiement auto). URL : **https://codex-prepa.vercel.app (ancien : enm-prep-kohl.vercel.app, redirige vers le nouveau)**.
- Commit de tout le travail non suivi (51 fichiers, `9cb0034`) puis push.
- **Bug prod 500 sur toutes les pages** : `proxy.ts` lisait `process.env.NEXT_PUBLIC_SUPABASE_URL!`
  / `ANON_KEY!` → `undefined` car les `NEXT_PUBLIC_*` ne sont PAS injectées dans le build
  Edge (Vercel). Erreur : « Your project's URL and Key are required ». **Corrigé** (`5170c80`)
  en donnant à `proxy.ts` le même **filet de secours en dur** que `lib/supabase.ts`
  (URL + clé anon = valeurs publiques). → site OK (/ → 307 /login, /login → 200).
- 5 variables d'env saisies dans Vercel (Production) ; les 3 secrètes (SERVICE_ROLE,
  ANTHROPIC, VOYAGE) sont lues à l'exécution (pas besoin de rebuild).
- **Vérifié en prod le 2026-06-26 : connexion OK + Question de cours (RAG) OK.**
- TODO optionnel : ajouter l'URL prod dans Supabase Auth (Site URL / Redirect URLs) —
  pas requis pour le login mot de passe, utile pour emails de confirmation / magic links.

### 2026-06-26 (suite 3) — Correction du modèle d'accès
- **Quiproquo levé** : les 2 PDF n'étaient PAS la base ENM mais les documents perso de
  l'admin. Demande réelle : l'admin constitue la base ENM (docs de son choix), les
  étudiants posent leurs questions librement SANS voir/gérer/choisir les documents.
- DB : 2 PDF basculés `officiel → personnel` (espace_id remis à NULL), **base ENM vidée**
  (0 doc officiel, prête à être constituée).
- UI `/cours-ia` : sidebar de sélection + toggle « Documents » désormais affichés
  **seulement en mode personnel**. En base ENM : champ question seul, placeholder
  « Posez votre question à la base ENM… ». Panneau « + Importer » officiel = admin only.
- Vérifié : `/api/cours/upload` bloque déjà (403) les imports officiels non-admin ;
  `tsc --noEmit` OK.
