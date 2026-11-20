# Sauvegarde mémoire — enm-prep

> Snapshot du projet pour reprise de contexte. Dernière mise à jour : 2026-11-20 (suite 36).

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

### 2026-11-20 (suite 36) — Revue de toutes les RLS (pg_policies fourni par le user) + migration 0042 (exécutée par le user)
- Revue complète des policies : tables du staff (fiches, modules, medias, mindmaps, qcm, cours, evenements,
  espaces, calendrier_flux, sources_actualites) bien réservées admin/éditeur en écriture ; données perso en
  « soi uniquement » ; profils, activite_jours, cours_documents/chunks conformes aux migrations 0037 à 0040.
- **Faille trouvée** : `match_joueurs.mj_insert` ne vérifiait que `user_id` → un étudiant rejoignait un duel avec
  un score inventé (jamais recalculé s'il ne répond pas). **Migration `0042_duel_score_initial.sql`** : le trigger
  `forcer_pseudo` remet aussi score/repondu/justes/termine à zéro. Testée sur Postgres 16 (rejouable, score forcé à 0).
- Constats laissés tels quels (choix produit / faible enjeu) : `qcm_write` (ALL) laisse les éditeurs supprimer des
  QCM alors que `qcm_delete` vise l'admin seul ; `matchs_update` laisse l'hôte modifier son match (statut, horaires) ;
  les bonnes réponses d'un duel restent lisibles par un tricheur dans `fiches` / `qcm_questions` (révision libre) ;
  4 policies redondantes sur `progression` (dont `progression_own`, rôle public, qui couvre aussi DELETE).
- Vérifié par le user : aucune table `public` sans RLS (`pg_tables … not rowsecurity` → 0 ligne).
  Reste non vérifié : policies du Storage (buckets `cours`, `medias`, `mindmaps`, `qcm`).

### 2026-11-20 (suite 35) — Audit v3 : les 7 points restants
- **Premiers tests du projet** : `npm test` (`tsx --test tests/*.test.ts`, `tsx` en devDependency) — paliers et
  intervalles de répétition espacée, série (tolérance de la veille, trou, pause sautée), filtre d'adresses,
  pagination. Vérifié qu'un test échoue si on casse la logique des pauses.
- `lib/url-publique.ts` : `urlPublique()` (http(s) public seulement : refuse localhost, IP privées/décimales/IPv6,
  identifiants dans l'URL) utilisé par `/api/actualites` (≤ 20 flux) et `/api/planning` (≤ 10 flux, cache borné à
  50 entrées) ; `lienSur()` empêche un flux RSS d'injecter un lien `javascript:`. Limite notée en `shortcut:` (pas de
  vérification de l'IP résolue ni des redirections).
- Classement paginé (`toutesLesLignes`, tri utilisateur + jour). Changement de mot de passe : refusé sur un AUTRE
  admin. Suppression d'utilisateur : compte d'auth d'abord, profil ensuite. Repli mort de `enregistrerActivite`
  supprimé. `@types/dompurify` retiré.
- L'audit v3 est entièrement traité. Non vérifié : RLS des tables anciennes (`medias`, `mindmaps`, écriture de
  `fiches` / `modules` / `qcm`) — à lire via `pg_policies` si besoin.

### 2026-11-20 (suite 34) — Audit v3 : 5 corrections prioritaires (migration 0041, exécutée par le user)
- Nouvel audit complet (`/ponytail-audit`, 12 constats). Corrigés ici les 5 prioritaires :
  1. **Lien piégé dans les annales** (XSS : `javascript:` enregistré via l'API REST, exécuté au clic d'un autre
     utilisateur) : migration **0041** (`check (url ~* '^https?://') not valid`) + la page n'affiche le lien que s'il
     commence par http(s).
  2. **Duel asynchrone** : `/api/duel/correction` exige que le joueur ait répondu à toutes les questions (avant :
     corrigé complet disponible avant de jouer, et progression remise « À revoir »).
  3. **Coûts IA** : question « Questions de cours » coupée à 2 000 caractères, messages du coach à 4 000, et coach
     limité à 200 messages / 24 h (`consommer_quota`, action `coach_jour`) en plus des 20 / minute.
  4. **Fichiers > 4,5 Mo** (limite de corps Vercel) : `lib/televerser.ts` envoie le fichier directement à Supabase
     Storage via `createSignedUploadUrl` (route `/api/storage/upload` ne renvoie plus qu'une adresse signée) ;
     « Questions de cours » extrait le texte DANS LE NAVIGATEUR (`lib/extraire-texte.ts`, unpdf + mammoth, testé avec
     Playwright sur un PDF de 2 pages et un .docx) et `/api/cours/upload` reçoit du JSON (texte ≤ 4 M caractères).
  5. **Suppression de compte** : efface aussi les documents personnels (`cours_chunks` puis `cours_documents`) ;
     migration 0041 met `on delete set null` sur `demandes_acces.traite_par` (supprimer un admin échouait).
- Restent de l'audit v3 : classement tronqué à 1 000 lignes (~140 actifs/semaine), routes `actualites`/`planning` qui
  vont chercher n'importe quelle URL (cache sans limite), aucun test sur `spaced-repetition`/`streaks`, changement de
  mot de passe admin sans contrôle de rôle, ordre de suppression d'un utilisateur, repli mort dans
  `enregistrerActivite`, `@types/dompurify` inutile. Non vérifié : RLS des tables anciennes (`medias`, `mindmaps`…).
- Piège : `next dev` réécrit le bloc de `AGENTS.md` ; ne pas le committer avec le reste.

### 2026-11-20 (suite 33) — Matières réservées aux connectés (migration 0040, exécutée par le user)
- **Migration `0040_espaces_connectes.sql`** : supprime `lecture_espaces` (rôle public, lisible sans compte),
  crée `espaces_select_connectes` (select, authenticated). Vérifié : aucune page publique ne lit `espaces`.
- Classement « +1 en boucle » (jusqu'à 1 000/jour) **laissé volontairement** : classement anonyme, faible enjeu ;
  la seule vraie parade (compter côté serveur depuis `progression`) changerait le sens du classement et ne
  couvrirait plus QCM/duels. À reprendre seulement si une triche est constatée.

### 2026-11-20 (suite 32) — Révision : double appui ignoré
- `revision/page.tsx` : `rateCard` et `annuler` enrobés par `verrouille()` (verrou `useRef`, libéré dans un
  `finally`) : un 2ᵉ appui (clic ou touche 1-4 / Z) pendant l'enregistrement est ignoré, plus de double notation.

### 2026-11-20 (suite 31) — Classement non falsifiable (migration 0039, exécutée par le user)
- **Migration `0039_activite_verrou.sql`** (à exécuter par le user) : supprime TOUTES les policies héritées
  d'`activite_jours` (boucle sur pg_policies, noms inconnus) et ne garde que la lecture de sa propre ligne ;
  `incr_activite` borne le delta à ±1, la date à hier/aujourd'hui/demain, le compteur entre 0 et 1 000/jour,
  et n'est plus exécutable par `anon`. Testée sur un Postgres 16 local (rôles et `auth.uid()` simulés) :
  rejouable, triche bloquée (delta 100 000, date passée, update/insert direct).
- Aucun changement de code : le repli read-then-write de `enregistrerActivite` ne sert plus qu'avant la migration.
- Limite restante : un étudiant peut encore appeler `incr_activite(+1)` en boucle (jusqu'à 1 000/jour). Vraie
  solution si ça arrive : compter l'activité côté serveur à partir de la table `progression`.

### 2026-11-20 (suite 30) — Audit tâche 6 : code mort supprimé
- Supprimés (aucun usage vérifié par grep) : `components/Sidebar.tsx`, `meilleurStreak` (`lib/streaks.ts`),
  dépendances `@supabase/auth-helpers-nextjs` et `pdf-parse` (l'import PDF passe par `unpdf`).
- Audit de la suite 23 : les 6 tâches principales sont traitées (PR #5 à #10). Restent ouverts : compteur
  `activite_jours` falsifiable (policy `activite_jours_update` + `incr_activite` qui accepte tout delta, donc
  classement trichable), `espaces.lecture_espaces` (faible enjeu), double appui en révision.

### 2026-11-20 (suite 29) — Audit tâche 5 : export RGPD complet
- `/api/compte/exporter` exporte désormais **27 tables** (avant 8) : + coach_messages, favoris, QCM (résultats,
  réponses), duels (créés, participations, réponses), forum, astuces, annales, contributions, remarques de cours,
  notifications, pauses, compteurs (nouvelles cartes, usage IA), médias vus, documents importés (noms, pas le texte).
  Exclu volontairement : `google_drive_tokens` (secrets) et `quota_log` (technique).
- Chaque table est paginée (`toutesLesLignes`, clé d'ordre unique par table) : plus de coupure à 1 000 lignes.
- Non vérifié : la route de suppression de compte (`/api/compte/supprimer`) ne liste pas toutes ces tables ; elle
  compte sur les `on delete cascade` vers `auth.users`, non contrôlés table par table.

### 2026-11-20 (suite 28) — Audit tâche 4 : l'annulation décompte l'activité
- **Autorisation durable du user** : créer les PR ET les fusionner soi-même sur GitHub sans demander (après
  `tsc` + `build` OK et statut Vercel vert). PR #7 fusionnée ainsi.
- `annuler()` (révision) appelle `enregistrerActivite(userId, -1)` : la carte annulée ne compte plus dans la série,
  l'objectif du jour ni le classement. Réutilise la RPC `incr_activite` (accepte un delta négatif), sans migration.
- À noter pour la tâche « classement » : `incr_activite` accepte n'importe quel `p_delta` depuis le client, donc un
  étudiant peut gonfler son compteur via l'API (même faille que `activite_jours_update`).

### 2026-11-20 (suite 27) — Audit tâche 3 : note de révision perdue sans erreur
- `revision/page.tsx` : `rateCard` vérifie l'erreur de l'upsert `progression`. En cas d'échec : toast « Note non
  enregistrée… », la carte reste affichée (pas d'activité comptée, pas de passage à la suivante) pour renoter.
  Même chose pour `annuler` (la restauration n'est plus faite en local si l'écriture en base échoue).
- Non traité : un double appui rapide pendant l'enregistrement peut noter deux fois (déjà le cas avant).

### 2026-11-20 (suite 26) — Audit tâche 2 : formulaires publics limités
- `lib/limite.ts` : `tropDeRequetes(request, clé, max, fenêtre)`, compteur **en mémoire par IP** (par instance
  Vercel, remis à zéro au démarrage à froid ; à passer sur une table Supabase si un vrai abus apparaît).
- `/api/contact` et `/api/acces/demande` : 5 envois / heure / IP (réponse 429), champs tronqués (nom/email 200,
  message 5 000 / 2 000 caractères).
- `/api/acces/demande` : en plus, **plafond global durable** de 30 demandes / heure (compte sur `demandes_acces`,
  sans migration), contre un remplissage avec des emails inventés depuis plusieurs IP.
- Limite connue : `/api/contact` n'a pas de plafond global (pas de table) ; un attaquant multi-IP peut encore envoyer
  des mails à l'admin.

### 2026-11-20 (suite 25) — Audit tâche 1 : plafond Supabase de 1 000 lignes
- Nouveau helper **`toutesLesLignes(page)`** dans `lib/supabase.ts` : enchaîne les `.range()` par pages de 1 000
  (requête triée obligatoire pour un ordre stable). Branché sur les chargements de TOUTE la table `fiches`
  (dashboard, coach `/api/tuteur`, révision mixte) et sur la `progression` complète de l'utilisateur au même endroit
  (triée par `fiche_id`, unique avec `utilisateur_id`). Avant : seules les 1 000 premières fiches sur 1 536 comptaient.
- Non traité (risque plus faible) : requêtes par espace/module (`.in('module_id', …)`, `.in('fiche_id', ids)`) qui
  dépasseraient aussi 1 000 lignes ou la longueur d'URL si un seul espace grossit beaucoup.
- Tâches suivantes de l'audit (suite 23) : formulaires publics sans limite, note de révision perdue sans erreur,
  annulation qui ne décompte pas l'activité, export RGPD incomplet, code mort.

### 2026-11-20 (suite 24) — Documents personnels réellement privés
- Migration **0037 exécutée** par le user (vérifié via pg_policies) ; les 3 admins sont légitimes
  (2 comptes de Théo avec le même email de profil + Nora Caffin).
- **FUITE corrigée** : `cc_select` / `cd_select` (using true) laissaient tout étudiant connecté lire le TEXTE
  INTÉGRAL des documents personnels des autres (`cours_chunks`) via l'API REST. **Migration
  `0038_documents_personnels_prives.sql`** : officiel lisible par tous, personnel par son auteur seul ;
  `cd_write` / `cc_write` limités à la base officielle (admin/éditeur).
- Nouvelle route **`/api/cours/supprimer`** : document personnel → suppression DÉFINITIVE par son auteur
  (passages puis document) ; officiel → corbeille, admin seul. Avant, un lecteur ne pouvait pas supprimer
  (RLS) et l'échec était silencieux. `/api/cours/question` filtre désormais `deleted_at` en mode personnel.
- Reste ouvert : `espaces.lecture_espaces` (rôle public, noms des matières seulement, faible enjeu).

### 2026-11-20 (suite 23) — Audit ponytail + FAILLE profils (élévation en admin) corrigée
- **Audit complet** (`/ponytail-audit`) : 11 constats, rapport donné au user. Principaux restants à traiter :
  plafond Supabase de 1 000 lignes (dashboard / révision mixte / coach chargent toutes les fiches, or 1 536 en
  base), formulaires publics `/api/contact` + `/api/acces/demande` sans limite, recherche « Mes documents » qui
  ne filtre pas `deleted_at`, note de révision perdue sans erreur, annulation qui ne décompte pas l'activité,
  export RGPD incomplet, code mort (`components/Sidebar.tsx`, `meilleurStreak`, deps `auth-helpers`, `pdf-parse`).
- **RLS vérifiées par le user (pg_policies)** : `profils.profil_own` (ALL, sans with_check) permettait à tout
  utilisateur de modifier son propre `role` → passer admin via l'API REST. **Migration `0037_profils_verrou.sql`** :
  select/insert self uniquement (insert forcé à `lecteur`), plus aucune écriture client ; suppression des policies
  `lecture_fiches` / `lecture_modules` (lisibles SANS compte avec la clé anon).
- Nouvelle route **`/api/admin/utilisateurs`** (GET liste, POST rôle, service_role, admin only, pas sur soi-même) ;
  la page `admin/utilisateurs` l'utilise (avant : la liste ne montrait que l'admin lui-même à cause du RLS).
- Autres constats RLS à traiter : `cours_documents.cd_select = true` (tout étudiant voit les noms des documents
  personnels des autres ; `cours_chunks` non vérifié), `cd_write` réservé admin/éditeur → la suppression d'un
  document personnel par un lecteur échoue en silence ; `activite_jours_update` laisse un étudiant fixer son
  compteur (classement).

### 2026-11-20 (suite 22) — graphify branché automatiquement sur le projet
- **graphify** (github.com/Graphify-Labs/graphify, paquet PyPI `graphifyy[sql]`) : graphe de connaissances du
  code (AST local, sans LLM, ~10 s, 847 nœuds incl. migrations SQL). **Mode léger choisi** : une courte consigne
  dans `CLAUDE.md` (graphe pour les questions d'architecture / transverses, grep pour le ciblé), **pas de hooks**.
  Mesure faite : sur 170 fichiers, une `graphify query` coûte ~1 600 tokens contre ~100 pour un grep ciblé, donc le
  mode imposé (hooks PreToolUse via `graphify claude install`) était contre-productif. À réactiver quand le code
  aura beaucoup grossi (plusieurs centaines de fichiers). `graphify-out/` est dans `.gitignore`.
- **Environnement cloud « Default »** : script de démarrage qui installe graphify, enregistre le skill utilisateur
  et lance `graphify update .` dans `enm-prep` (en `|| true`, n'empêche jamais le démarrage).
- Skills **ponytail** importés sur le compte claude.ai (pas dans le repo, à la demande du user).
- Tentative de Claude Code en local sur le Mac abandonnée (app desktop trop ancienne pour les modèles récents) :
  on reste en sessions cloud.

### 2026-11-20 (suite 21) — Reprise après 4 mois : sécurité, Supabase, modèle Claude, verrou contributions
**État constaté** : aucun commit depuis le 5 juillet ; build OK. **Projet Supabase en PAUSE** (plan gratuit,
inactivité — dernière activité étudiante le **2026-07-11**) → restauré par le user. Diagnostic SQL (lecture seule) :
migrations **0031→0035 toutes passées**, 7 comptes (4 lecteurs, **3 admins** — à revoir), 11 espaces, **1 536 fiches**,
4 QCM, **1 seul document en base ENM** (RAG quasi vide), 6 duels. ⚠️ Le dashboard Supabase s'ouvre avec le
compte propriétaire du projet `hoduewjiaowlvhkngoum` (sinon écran « Create an organization » vide — NE PAS créer).
- **Sécurité** : `next` 16.2.6 → **16.4.6** + `npm audit fix` (faille critique : contournement du middleware/proxy
  App Router + Turbopack = exactement la garde d'accès `proxy.ts`). 0 vulnérabilité. Smoke test prod OK
  (pages protégées → 307 /login, API → 401).
- **Modèle Claude** : `claude-sonnet-4-6` → **`claude-sonnet-5-5`**, centralisé dans `lib/ia.ts`
  (`ANTHROPIC_MODEL` exporté ; `generer-fiches` passe désormais par `chatIA`). Réglages via `parametresClaude()` :
  réflexion toujours active sur Sonnet 5.5 et comptée dans max_tokens → **plancher 16 000** ; **effort `medium`** ;
  **repli serveur vers `claude-sonnet-5`** sur refus de sécurité (`client.beta.messages`, beta
  `server-side-fallback-2026-06-01` — seule forme supportée par le SDK 0.106) ; refus de toute la chaîne →
  message explicite (stream) ou erreur (chatIA). Pas de `temperature`/prefill dans le code (tous deux refusés).
- **Contributions verrouillées** : migration **`0036_contributions_verrou.sql`** retire la policy `contrib_insert`
  → insertion UNIQUEMENT via `/api/contributions` (service_role), qui applique **10 propositions / 24 h**.
- ⚠️ **Deux projets Vercel nommés `enm-prep`** : celui qui sert codexprepa.com est relié à GitHub (déploiement auto
  sur push `main`, coche verte sur le commit `795fe2b` du 2026-11-20). L'autre (équipe « somonster275's… », Hobby)
  n'a que 4 déploiements CLI du 18 mai : **obsolète, à ne pas confondre** (suppression conseillée). Pour retrouver
  le bon : icône de statut d'un commit sur GitHub → Details « Vercel ».
- Reste côté user : crédits API (Anthropic/Voyage/DeepSeek), `CHATBOT_PROVIDER=anthropic` sur Vercel (RGPD
  DeepSeek), relancer les étudiants, enrichir la base ENM, revoir les 3 admins. Le user veut une copie locale :
  `git clone`/`git pull` sur son Mac (les secrets ne sont pas dans Git → `vercel env pull .env.local`).

### 2026-07-05 (suite 20) — Corrections de l'audit v2 (commit fbf8298)
- Cap nouvelles cartes **en base** : table `nouvelles_jours` (migration **0035**), cross-device ; `lib/nouvelles-cartes.ts`
  devenu async (`nouvellesRestantes`, `marquerNouvellesVues(delta)`), fail-open si la table manque.
- **Compteurs atomiques** (RPC 0035) : `incr_nouvelles` et `incr_activite` (client, `auth.uid()`), `incr_ia_usage`
  (serveur, exécution retirée à anon/authenticated). `enregistrerActivite` garde un repli read-then-write.
- **Fisher-Yates** partagé (`lib/aleatoire.ts`) à la place des `sort(() => Math.random() - 0.5)` biaisés.
- `getAllModuleIds` : N+1 → 1 requête ; révision mixte : select ciblé ; `OBJECTIF_QUOTIDIEN`/`ymd` dédupliqués
  (progression importe depuis streaks) ; rôle auto-créé `'etudiant'` (hors enum) → `'lecteur'` (TopNav + Sidebar).
- Gardé volontairement : clé anon en fallback dans `proxy.ts` (filet anti-crash Edge, clé publique) ; refonte
  Server Components = chantier séparé.

### 2026-07-05 (suite 19) — Audit Fable + 6 chantiers (répétition espacée, vacances, QCM, RAG, duel async, contributions)
**Contexte** : audit critique de l'architecture demandé à un sous-agent **Fable** (retour façon
étudiant + comparaison avec Anki/Quizlet/Duolingo et surtout **edn.fr/MyEDN** — inspiration du
user, plateformes leaders de prépa concours médecine EDN). Verdict Fable : couche métier (`lib/`)
et sécurité saines ; faiblesses = tout en `'use client'`, styles inline, 0 test/CI, push direct
sur `main`. Angle mort produit vs le concours : pas d'entraînement **rédactionnel** (dissert/cas
pratique/note de synthèse) ni de **concours blanc chronométré** (ce que fait edn.fr).

**⚠️ Migrations à exécuter par le user (Supabase SQL Editor) : 0031 → 0034.** Tout le code est
**résilient** : sans les migrations, les fonctions concernées se masquent / renvoient une erreur
propre, rien ne casse en prod. ⚠️ Piège rencontré : `create policy` n'a pas de `if not exists` →
relancer une migration donne « policy already exists ». Correctif : `drop policy if exists` avant
chaque `create policy` (fait sur 0034 ; à appliquer si on relance 0031/0032).

**1. Correctif répétition espacée (quick win #1 de Fable) — `revision/page.tsx`.**
- **Bug supprimé** : `if (d.length === 0) d = [...fichList]` ressortait TOUT le deck quand plus rien
  n'était dû → re-notation → écrasement des intervalles (= bachotage). Retiré.
- Deck vide (fiches existantes mais rien de dû) → écran **« ✅ Tu es à jour »** (état désirable) +
  bouton **« Réviser quand même »** (`?mode=tout`) = sur-apprentissage devenu un choix explicite.
  State `fichesExistent` pour distinguer « à jour » de « espace vide ».

**2. Plafond de nouvelles cartes/jour = 45 — `lib/nouvelles-cartes.ts` (localStorage, PAS de migration).**
- Les **nouvelles** cartes (jamais vues, `!progMap[f.id]`) sont plafonnées à `LIMITE_NOUVELLES_PAR_JOUR=45` ;
  les cartes **dues** ne le sont jamais. Compteur `codex-nouvelles-<uid>-<YYYY-MM-DD>`, +1 à la notation
  d'une nouvelle carte (`etaitNouvelle = prevProg===null`), −1 à l'annulation. State `nouvellesEnAttente`
  → note « 🌱 X cartes en réserve » sur les écrans fin/à-jour.

**3. Mode vacances 🌴 — migration `0031_pauses.sql` (table `pauses` user_id/debut/fin, RLS self).**
- `lib/streaks.ts` : `chargerPauses()` (résilient/try-catch), `estEnPause()`, et **`calculerStreak(activite, pauses=[])`**
  qui **saute** les jours en pause (ne casse pas la chaîne, ne compte pas comme travaillé) — garde-fou anti-boucle.
- **`components/ModeVacances.tsx`** : bandeau dashboard (planifier « Ce week-end / 1 sem / 2 sem » ou dates ;
  « En pause jusqu'au… ta série est protégée » + « Reprendre »). Se masque si la table n'existe pas.
- Pauses passées à `calculerStreak` dans **dashboard**, **TopNav** et **fin de révision** (cohérence partout).

**4. QCM — feedback immédiat + lien profond (quick win #2) — `qcm/page.tsx`.**
- Correction **question par question** (state `valides: Set<string>`) au lieu d'une validation globale.
  Chaque question a son bouton « Valider » → correction + explication immédiates (effet de test). Score global
  quand tout est validé ; résultat enregistré par question au fil de l'eau. `enregistrerActivite`/`qcm_resultats`
  une seule fois à la fin.
- **Lien profond `/qcm?id=<id>`** (lu via `window.location.search`, pas de useSearchParams) ouvre直 le QCM →
  branché dans **`Approfondir.tsx`** (avant : `/qcm` liste).

**5. Garde-fous RAG (quick win #3) — `app/api/cours/question/route.ts`.**
- **Seuil de similarité `SEUIL_SIMILARITE = 0.4`** en base ENM (la RPC `match_cours_chunks` renvoie déjà
  `similarite`) : si aucun passage ≥ seuil → « pas d'info pertinente » au lieu de broder. Distingue base vide
  (0 ligne) de hors-sujet (lignes mais toutes < seuil).
- **Repli aléatoire des docs perso SUPPRIMÉ** : si la FTS ne trouve rien → message adapté (compte les docs perso
  pour distinguer « aucun doc importé » de « aucun passage trouvé »).
- **Quota IA** `LIMITE_QUESTIONS_JOUR = 40` par user/jour → migration **`0032_ia_quota.sql`** (table `ia_usage`
  user_id/jour/questions, écrite en service_role, RLS select self). Résilient (try-catch → pas de quota si table absente).
- **Bug latent corrigé** : les messages « pas de résultat » étaient renvoyés en `NextResponse.json` alors que le
  client ne lit qu'un **flux SSE** → ils ne s'affichaient pas. Helper `messageSSE()` : ils passent par le flux.

**6. Duel ASYNCHRONE (proposition #7) — migration `0033_duel_async.sql` (colonnes `matchs.mode` 'live'|'async', `matchs.expire_at`).**
- Sélecteur **« ⚡ Temps réel » / « 🕒 Asynchrone »** à la création (`duel/page.tsx`). Async : match créé en `statut='en_cours'`,
  `mode='async'`, `expire_at=now+48h` ; le créateur joue direct puis partage le code.
- **`components/DuelAsync.tsx`** : jeu **auto-rythmé**, **feedback immédiat** (le serveur renvoie `correct` — la réponse
  est verrouillée par l'anti-rejeu, donc zéro triche), **points fixes** (pas de bonus vitesse), reprise, comparaison des
  scores (👑/⌛), débrief réutilisé.
- Routes serveur (`select('*')` pour rester résilient si colonnes absentes) : **`creer`** (champs async),
  **`repondre`** (branche async : pas de fenêtre temporelle, points fixes, marque `termine` si tout répondu, renvoie `correct`),
  **`correction`** (débrief dispo dès que `mode==='async'`). Le temps réel est **inchangé** (effets clock/correction gardés
  `if mode==='async' return` dans `duel/[code]/page.tsx`).

**7. Contribution étudiante modérée (proposition #8) — migration `0034_contributions.sql` (table `contributions`).**
- Calqué sur le pipeline « remarques ». Page **`/contribuer`** (menu Communauté → « Proposer un contenu ») : propose
  une **fiche** (matière→chapitre→Q/R) ou un **QCM** (format texte `Q:`/`-`/`*`/`>` réutilisant **`parseTexte`** de
  `lib/qcm-parse.ts`, avec prévisualisation live). Suivi du statut (nouveau/approuve/refuse) via RLS select self.
- API **`/api/contributions`** (POST étudiant, insert + email admin) et **`/api/admin/contributions`** (GET liste + POST
  approuver/refuser/supprimer). **Approuver crée réellement** la fiche (`fiches`) ou le QCM (`qcm` type 'choix' + `qcm_questions`).
- Page admin **`/admin/contributions`** (menu Admin → « Contributions »). Liens ajoutés dans `TopNav.tsx`.

**Déploiement** : tout vérifié `tsc --noEmit` + `npm run build` (0 erreur) et **poussé sur `main`** (auto-déployé
sur codexprepa.com), via le circuit branche `claude/codex-vercel-supabase-deploy-0huif5` → merge ff-only sur `main`.

**Reste de la liste Fable (non faits)** : #4 coach → **Mistral UE** (RGPD DeepSeek/Chine, `lib/ia.ts` rend ça trivial),
#5 « **transformer en fiche** » depuis réponse RAG / débrief duel, #6 **auto-évaluation assistée du brouillon** par IA
(le « Feynman » promis — différenciateur le plus atteignable selon Fable), #9 **stats de rétention + prévision de charge**,
#10 (lourd) **entraînement rédactionnel corrigé par IA** (cas pratique/dissert/note de synthèse — l'épreuve réelle ENM,
= le « concours blanc » qui manque vs edn.fr). Hygiène soulignée : tests sur `lib/`, CI, ne plus push direct sur `main`.

### 2026-06-29 (suite 18) — Système de tags (#) transversal + onglet « Approfondir »
**Migration à exécuter par le user : 0030** (`tags text[]` + index GIN sur fiches/medias/
mindmaps/qcm/cours + `notify pgrst`).

- **Tags `#`** : `lib/tags.ts` (`normaliserTag`/`parseTags`/`nettoyerTags` → slug minuscules
  sans accents) + composant **`components/TagsInput.tsx`** (pastilles, Entrée/espace/virgule
  pour valider). Branché dans : éditeur de fiche (page module — chips affichées sous la fiche),
  cours, médias (`media/page.tsx`), mind-maps (`OutilContenu.tsx`), QCM (admin + API `tags`).
- **`components/Approfondir.tsx`** : en révision, quand la **réponse est révélée**, requête
  `.overlaps('tags', tags)` sur medias/mindmaps/cours/qcm → panneau dépliable « 🔎 Approfondir »
  listant les ressources du même tag, **ouvertes en nouvel onglet** (vidéo/mindmap = url directe,
  cours = `/cours?c=id`, QCM = `/qcm` liste — pas encore de lien profond QCM). N'apparaît que
  s'il y a des ressources liées. Inséré dans `revision/page.tsx` (deck charge déjà `select('*')`).
- **Recherche par `#tag`** (`recherche/page.tsx`) : si la requête contient des `#tags`, bascule
  en `chercherParTags` (chevauchement sur fiches/QCM/médias/cours) au lieu du texte.
- **Édition des tags sur le contenu DÉJÀ existant** : composant **`components/TagsEditeur.tsx`**
  (pastilles + édition inline + `update({tags})` sur la table), branché dans les listes de
  cours, médias, mind-maps (`OutilContenu`), QCM (admin ; le GET `/api/admin/qcm` renvoie `tags`).
  Permet de taguer rétroactivement sans recréer. Étudiants = pastilles en lecture seule.
- `tsc --noEmit` OK ; commits+push auto sur main. Tags resilients (si migration 0030 absente,
  les requêtes `overlaps` renvoient juste rien, pas d'erreur bloquante).

### 2026-06-29 (suite 17) — Imports docs, QCM avancés, refonte duels, rubrique Cours
**Migrations à exécuter par le user (Supabase SQL Editor) : 0023→0029.** Plusieurs ont
servi à corriger le schéma réel de `qcm` (différent des migrations d'origine) :
`matiere` ajoutée, `espace_id` rendue **nullable**, + `notify pgrst, 'reload schema'`
systématique pour vider le cache PostgREST (cause des erreurs « column not found »).

**Imports de documents :**
- « Questions de cours » accepte désormais **PDF (via `unpdf`)** et **Word .doc/.docx
  (via `mammoth`)**. `pdf-parse` abandonné (erreur `DOMMatrix is not defined` sous
  Node/Turbopack). `next.config.ts` : `serverExternalPackages: ['unpdf','pdfjs-dist','mammoth']`.

**Espaces (admin) :** création d'un espace de révision via modal (icône/couleur/slug/
description) — migration 0023 (`espaces.icone`) + 0024 (policies RLS admin insert/update/delete).

**QCM :**
- Import depuis un **lien (URL)** : route serveur `/api/admin/qcm/fetch` (anti-SSRF) +
  import d'un **fichier HTML** local. Parseur `lib/qcm-parse.ts` : ignore `<script>/<style>`,
  extrait les QCM stockés en **JS**.
- **QCM avancés à réponse libre** (« QCM AVANCÉ ») : l'étudiant **tape** sa réponse,
  comparée à `reponses_ok` (normalisée : sans accents/casse/ponctuation, via `reponseCorrecte`).
  Migration 0025 : `qcm.type` ('choix'|'libre') + `qcm_questions.cas/reponses_ok/reponse_affichee`.
  Admin détecte le format auto (`parseQcmLibre`) ; étudiant joue dans `/qcm`.

**Duels (`lib/match.ts` + `/api/duel/*`) :**
- **Débrief de fin** (`/api/duel/correction`) : revoir chaque question avec bonne réponse,
  ton choix, ✅/❌ ; **range les erreurs en révision** (fiches → carnet/progression « À revoir » ;
  QCM → `qcm_reponses`). Migration 0026 (`match_solutions.origines`, `match_reponses.choix`).
- **Leurres « ressemblants »** : distracteurs choisis par **similarité lexicale** (Jaccard sur
  mots-clés, bonus même module) au lieu d'aléatoire → duels plus difficiles.
- **Choix d'un chapitre/module** précis (pas que la matière) à la création.
- **Propositions coupées sur des phrases entières** (plus de coupure en plein mot) — helpers
  centralisés dans **`lib/texte.ts`** (`extraitLisible`, `texteComplet`, partagés client/serveur).
- **Dépliage « voir toute la carte »** au clic, en **jeu** ET au débrief (texte intégral stocké :
  `match_solutions.options_full` migration 0029 + `options[].full` dans le deck public — ne révèle
  PAS la bonne réponse). Toutes ces colonnes (0026/0029) sont **best-effort** : le code stocke
  solutions/réponses même sans la migration (corrige le débrief qui ne marchait pas).

**Rubrique « Cours » (NOUVELLE) :** supports **PDF/Word** envoyés par l'admin, consultés en
ligne (PDF en iframe, Word via visionneuse Office), **remarques étudiants** comme les fiches
(`/api/cours/remarque` → email admin). Migration 0027 (tables `cours` + `cours_remarques`) +
**bucket Storage PUBLIC `cours`** à créer (Storage, pas SQL) ; bucket ajouté à l'allowlist de
`/api/storage/upload`. Migration 0028 : `cours.espace_id` + `cours.module_id` → un cours se
**répertorie dans un espace/module** et s'affiche sur ces pages + raccourci dans l'AccesRapide.

**UI/UX :** AccesRapide rendu **vraiment adaptatif** (grille `auto-fill minmax(72px)` + classe
`.no-collapse` pour échapper à la règle globale `[style*="grid-template-columns"]:not(.no-collapse)`
qui replie les grilles en 1 colonne < 768px). **TopNav désengorgé** : 1er niveau =
Accueil/Espaces/Actualités ; menu **« Ressources »** (Cours, Questions de cours, Drive, Calendrier)
+ Communauté + Admin, via un helper `menuDeroulant` factorisé. Modal espaces rendu scrollable
(`maxHeight:90vh`). **Tout le travail de ce soir vérifié adaptatif** (grilles repliables, flex-wrap,
iframes en %/vh) — `tsc --noEmit` OK à chaque étape, commit+push auto sur main.

### 2026-06-28 (suite 16) — Outils collaboratifs, défi configurable, et 5 améliorations « solo »
**Toutes les migrations 0010→0016 ont été exécutées par le user.** Modération des contenus collaboratifs : policy RLS de DELETE = auteur OU admin (`(select role from profils where id=auth.uid())='admin'`).

**Outils collaboratifs (menu déroulant « Communauté » dans TopNav : Entraide, Forum, Annales, Classement) :**
- **Forum Q&R** (`/forum`, tables `forum_questions`+`forum_reponses`, mig `0010`) : questions par matière, réponses en fil, filtre. Auteur dénormalisé (`auteur`).
- **Astuces sous les fiches** (`components/AstucesFiche.tsx`, table `astuces`, mig `0011`) : volet sous chaque fiche (page module), mnémo partagés.
- **Annales & corrigés partagés** (`/annales`, table `annales`, mig `0012`) : bibliothèque de liens (type sujet/corrigé/fiche + matière).
- **Défi + classement anonyme** (`/classement`, API `/api/classement` agrège `activite_jours` de la semaine en service_role, **anonyme** : rangs + totaux + « Toi »).

**Défi de la semaine CONFIGURABLE par l'admin** (table `defi_config` 1 ligne, mig `0013`) : écran **Admin → Défi de la semaine** (`/admin/defi`) + API `/api/admin/defi`. Type **`fiches`** (objectif chiffré mesuré + barre + classement) OU **`libre`** (annonce texte libre). La page `/classement` lit la config (repli 150).

**Les 5 améliorations « solo » (les incohérences relevées) :**
1. **QCM interactif** (remplace l'ancien `/qcm` OutilContenu) — tables `qcm`/`qcm_questions`/`qcm_resultats` (mig `0016`). **Import texte OU HTML** (`lib/qcm-parse.ts` : `parseTexte` format `Q:`/`-`/`*`/`>`, `parseHtml` via DOMParser listes+radios) → **prévisualisation éditable** admin (`/admin/qcm`, API `/api/admin/qcm`) où on coche les bonnes réponses. Jeu étudiant auto-corrigé (radio/multi), score+explications, **`enregistrerActivite` à la fin** (compte dans série/momentum/classement). Le user fait souvent ses QCM en **HTML** → compat assurée via la prévisualisation.
2. **Raccourcis clavier en révision** : Espace/Entrée=retourner, 1-4=noter, **Z/Backspace=annuler** (restaure la progression précédente via `lastAction`). Bouton « ↶ Annuler » aussi.
3. **Carnet d'erreurs** (`/carnet` + mode révision `?carnet=1`) : fiches notées niveau ≤ 1, dérivé de `progression` (pas de table). Carte dans Espaces.
4. **Coach persistant** : `TuteurChat` stocke l'historique en base (table `coach_messages`, mig `0014`, RLS self) au lieu du localStorage 24 h → conservé entre appareils.
5. **Recherche** (`/recherche`, ILIKE sur question/réponse) + **Favoris** (étoile `components/FavoriButton.tsx`, table `favoris` mig `0015`, RLS self ; mode révision `?favoris=1`). Cartes « Mes favoris » et « Recherche » dans Espaces (avec « Révision mixte » et « Carnet d'erreurs »).

### 2026-06-27 (suite 15) — Onboarding « Méthode » + auto-hébergement des polices
**Fenêtre d'accueil + onglet Méthode**
- Composant partagé **`components/MethodeContenu.tsx`** : outils de codex + « ✅ ce qui marche » (répétition espacée, récupération active, entrelacement, reformulation/Feynman, mind maps) + « ❌ ce qui ne marche pas » (relire/surligner, recopier, bûcher en bloc, bachotage, mythe des styles d'apprentissage).
- **`components/OnboardingModal.tsx`** : fenêtre affichée **une seule fois** à la 1re arrivée sur le dashboard, mémorisée par user en localStorage (`codex-onboarding-vu-<uid>`). Montée dans `app/(app)/dashboard/page.tsx`.
- Page publique **`/methode`** (même contenu) + lien **« Méthode »** ajouté à `SiteFooter` (entre Contact et Données) + `/methode` ajouté à `estPublic` du proxy.

**Auto-hébergement des polices (RGPD — plus d'appel à Google)**
- Les 5 polices (Hanken Grotesk, Bricolage Grotesque, Bagel Fat One, Baloo 2, Space Grotesk) sont **servies en local** : 14 fichiers woff2 (latin + latin-ext) dans **`public/fonts/`**, déclarés dans **`app/fonts.css`** (importé dans `layout.tsx` avant globals) avec les **noms exacts** → aucun changement de code ailleurs. Le `<link>` Google + l'`@import` dans cours-ia ont été retirés.
- ⚠️ **Piège (même que favicon)** : `/fonts` était intercepté par `proxy.ts` → ajouté `fonts/` au `matcher` négatif. Vérifié : `/fonts/*.woff2` renvoie `font/woff2`, et la home ne fait **aucun appel à fonts.googleapis/gstatic**.
- **Confidentialité = clean** : cookies essentiels uniquement (session Supabase + `g_oauth_state` éphémère), aucun traceur/analytics, aucune fuite Google.

### 2026-06-27 (suite 14) — Brouillon de révision + mode « Révision mixte »
Tout dans `app/(app)/espaces/[slug]/revision/page.tsx`.
- **Brouillon libre** : pendant la révision, l'étudiant rédige sa réponse avant de retourner la carte puis compare. Éphémère (state, se vide à chaque carte via `useEffect([idx])`, non enregistré). **Responsive** via `useIsMobile()` : desktop = **widget latéral** flottant (onglet « ✏️ Brouillon » sur le bord droit, `position:fixed`, ouvre un panneau) ; mobile = **bloc dépliable sous la carte** (bouton → textarea en dessous, garde la carte visible pour comparer).
- **Révision mixte (entrelacement)** : inspiré de la vidéo ScienceÉtonnante « Mieux apprendre ». Paramètre **`?mixte=1`** sur la page de révision (URL `/espaces/_/revision?mixte=1`, slug ignoré). Construit un deck des cartes **dues toutes matières confondues**, mélangées, plafond **40**. Réutilise toute la logique existante (notation, répétition espacée, brouillon). Espace synthétique (couleur corail, label « Toutes matières »), `retourHref` → `/dashboard`. **Entrée** : lien « 🔀 Révision mixte » sous « Réviser maintenant » dans le bloc « Révisions du jour » du dashboard.

### 2026-06-27 (suite 13) — Bascule de l'email admin
- Adresse admin passée de `titipaulin@gmail.com` à **`codex.prepa.dev@gmail.com`** (adresse dédiée au projet).
- **Notifications** : variable Vercel `ADMIN_NOTIF_EMAIL` mise à jour + défaut code [`lib/email.ts`] aligné. **Compte Resend** rebasculé sur la nouvelle adresse par le user (mode test = livraison uniquement à l'adresse du compte). **Testé OK** (message via `/api/contact` reçu).
- **Politique de confidentialité** (`/donnees`) : l'email en clair a été **retiré** (ne plus exposer l'adresse admin aux étudiants) → contact uniquement via le formulaire `/contact`. Aucun email admin n'est affiché ailleurs dans l'UI ; aucun contrôle d'accès ne repose sur l'email (rôle dans `profils`).
- **Supabase** : table `profils.email` mise à jour par SQL. ⚠️ L'email de **connexion** (auth.users) reste `titipaulin@gmail.com` tant que non changé dans Supabase → Authentication → Users (non bloquant, droits admin liés à l'id).

### 2026-06-27 (suite 12) — Audit & mise en conformité RGPD
**Constat clé** : le RGPD s'applique même si l'app n'est PAS publique (réservée à des étudiants) — le critère c'est le traitement de données personnelles, pas la publicité. À petite échelle, DPO/ROPA/DPIA probablement non obligatoires, mais base légale + transparence + sécurité + droits + transferts licites restent dus.

**Corrigé / déployé :**
- **Politique de confidentialité complète** (`/donnees` réécrite) : responsable, données, finalités+bases légales, **sous-traitants avec pays** (Supabase, Vercel/US, Resend/US, Anthropic/US, **DeepSeek/Chine**, Voyage/US, Google), transferts hors UE, conservation, sécurité (RLS), cookies (essentiels only), tous les droits + CNIL.
- **Droit à l'effacement** : `/api/compte/supprimer` (POST, service_role : delete app tables + `auth.admin.deleteUser`) + bouton « Supprimer mon compte » (modal confirm « SUPPRIMER ») sur `/compte`.
- **Droit d'accès/portabilité** : `/api/compte/exporter` (GET → JSON de toutes les données du user) + bouton sur `/compte`.
- **Transparence IA** : mentions sur les 2 assistants — Questions de cours « propulsé par Claude (Anthropic) », coach « Assistant IA », + consigne « n'y inscris pas d'informations personnelles ».

**Point de fond NON réglé (choix du user — il se renseigne)** : le **coach tourne sur DeepSeek (serveurs en Chine)**. Raisonnement juridique établi : une politique de confidentialité ≠ mécanisme de transfert ; la Chine n'a pas d'adéquation et DeepSeek n'offre pas de CCT ; l'art. 49 (consentement explicite) est exceptionnel et invalide pour un usage systématique → **non conforme**. Un avertissement « ne pas saisir d'infos perso » réduit mais ne supprime pas (l'app envoie auto le prénom + progression + notes). USA gérable (DPF + CCT, Anthropic a un DPA). **Options prêtes** : (1) **Mistral UE** = le plus propre, zéro transfert (clé API Mistral à créer) ; (2) **Claude** via `CHATBOT_PROVIDER=anthropic` ; (+ minimisation : retirer prénom/notes du contexte coach — voir route `app/api/tuteur`). Réflexe conseillé : **DPO de l'université** avant diffusion large.

### 2026-06-27 (suite 11) — Fonctionnalités collaboratives (remarques + entraide)
**1. Remarques étudiants sur les fiches (édition admin-only)**
- L'édition des fiches était DÉJÀ réservée admin/éditeur (page module + révision, gate `isAdmin`). Pas de régression à faire.
- Nouveau composant **`components/RemarqueButton.tsx`** (bouton « 💬 Faire une remarque » + modal) affiché aux NON-admins là où l'admin voit Modifier/Éditer (page module `…/modules/[moduleId]` et carte de révision).
- Soumission via **`/api/remarques`** (POST, auth) : insert en service_role + **notification email à l'admin via Resend** (`envoyerEmailAdmin`, contient auteur, matière/module, aperçu de la fiche, message, lien `/admin/remarques`). Non bloquant.
- Page admin **`/admin/remarques`** (lien ajouté au menu Admin, admin-only) : liste via `/api/admin/remarques` (GET service_role + garde estAdmin), affiche fiche concernée + auteur, filtre « À traiter »/« Toutes », actions Marquer traité / Rouvrir / Supprimer.
- Table **`remarques_fiches`** (migration `0008` — RLS : insert/select self ; admin lit via service_role).

**2. Onglet « Entraide » (annuaire collaboratif par matière)**
- Nouvel onglet **`/entraide`** dans la nav principale (tous étudiants). Chacun publie sa fiche : prénom/nom (pré-remplis du profil), contact (email/tél), matières de spécialité, mot d'intro. Annuaire visible par tous les connectés ; chacun gère/ retire la sienne.
- Table **`entraide`** (migration `0009` — RLS : select pour tous authenticated, insert/update/delete self). Upsert client direct (clé `user_id`).

**⚠️ Migrations à exécuter (Supabase SQL Editor)** : `0008_remarques_fiches.sql` + `0009_entraide.sql`.

### 2026-06-27 (suite 10) — Footer global (Contact / Données) + quadrillage de fond
- **Footer global** `components/SiteFooter.tsx` rendu dans le **layout racine** (`app/layout.tsx`) → présent sur **toutes** les pages (connectées + publiques) : 2 mini-liens **« Nous contacter »** (`/contact`) et **« Données »** (`/donnees`).
- **`/contact`** (page publique, sans TopNav) : formulaire nom/email/message → route **`/api/contact`** (publique) qui envoie un email à l'admin via **Resend** (`envoyerEmailAdmin` → `ADMIN_NOTIF_EMAIL`=titipaulin@gmail.com). ⚠️ dépend de `RESEND_API_KEY` (mode test Resend = n'écrit qu'à l'adresse du compte = l'admin, donc OK).
- **`/donnees`** (page publique) : explique la confidentialité — données privées/cloisonnées par **RLS**, pas de revente/partage, Drive en lecture seule non recopié, suppression sur demande.
- **Proxy** : `/contact`, `/donnees`, `/api/contact` ajoutés à `estPublic`.
- **Quadrillage de fond** : classe utilitaire **`.bg-grille`** dans `globals.css` (le SVG subtil exact de Questions de cours, trait `rgba(150,120,80,.048)`, motif 32×32). Appliquée à : layout `(app)` (toutes pages connectées), accueil `/`, `/bienvenue`, login (panneau formulaire), `/contact`, `/donnees`. ⚠️ s'utilise avec `backgroundColor` (PAS le raccourci `background` inline qui écraserait l'image).

### 2026-06-27 (suite 9) — Fonctionnalité « Mon Drive » (centralisation des cours)
**Objectif** : centraliser l'accès aux cours stockés dans le cloud. Nouvel onglet **« Mon Drive »** (`/drive`, ajouté au TopNav).

**Niveau 1 — Hub de liens (LIVRÉ + table créée) :**
- L'étudiant colle le **lien partagé** de son dossier (Google Drive, iCloud, Dropbox, OneDrive, Notion, autre). Détection auto du fournisseur (icône/couleur), rangement par matière facultatif, ouverture en nouvel onglet. C'est un **lanceur/marque-pages**, pas un navigateur de fichiers.
- Marche pour **tous** les fournisseurs (iCloud inclus, via lien partagé — iCloud n'a pas d'API web).
- Table **`drive_liens`** (migration `0006`, RLS par user) — **EXÉCUTÉE dans Supabase**.
- Fichiers : `app/(app)/drive/page.tsx`.

**Niveau 2 — OAuth Google Drive (CODÉ + table créée, EN ATTENTE de config Google) :**
- Vraie connexion « Se connecter avec Google » → navigation des dossiers + ouverture des fichiers **dans l'app** (fil d'Ariane, lecture seule). Uniquement Google (pas iCloud). Scope sensible `drive.readonly` → en mode Testing OK pour 100 test users (avertissement « app non vérifiée »), vérification Google requise pour public.
- Backend : `lib/google-drive.ts` (OAuth + Drive API v3 + refresh token) ; routes `app/api/drive/google/{connect,callback,status,list,disconnect}`. Jetons dans **`google_drive_tokens`** (migration `0007`, **RLS activé SANS policy** = lisible seulement via service_role, jamais exposé au client) — **table EXÉCUTÉE dans Supabase**.
- **RESTE À FAIRE POUR ACTIVER (côté user, "plus tard")** :
  1. Google Cloud Console : activer **Google Drive API** ; OAuth consent screen (External, scopes `drive.readonly`+`openid`+`email`, ajouter les étudiants en **test users**) ; créer un **OAuth client ID Web** avec redirect URI **exact** `https://codexprepa.com/api/drive/google/callback`.
  2. Ajouter sur **Vercel Production** : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (puis redéployer).
- Tant que les env vars manquent : la section Google affiche « Se connecter » désactivé (status renvoie `configure:false`). Le hub de liens fonctionne indépendamment.

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

**Actions user — TOUTES FAITES le 2026-06-27** : ✅ `0005_profil_prenom.sql` exécutée ; ✅ Site URL Supabase = `https://codexprepa.com` ; ✅ mot de passe admin débloqué ; ✅ demande de test `test-claude-demande@example.com` nettoyée.

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
