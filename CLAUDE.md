@AGENTS.md

# Reprise de contexte (codex / enm-prep)

- **Avant toute tâche, lire `MEMORY.md`** : c'est le journal de toutes les sessions (état du projet,
  décisions, migrations, pièges). Il est antéchronologique : l'entrée la plus récente est en haut de
  la section « Journal des sessions ».
- **En fin de session** qui modifie le projet : ajouter une entrée en haut du journal de `MEMORY.md`
  et mettre à jour la date en tête du fichier.
- **Déploiement** : un push sur `main` déploie automatiquement codexprepa.com (projet Vercel relié à
  GitHub). Toujours vérifier `npx tsc --noEmit` et `npm run build` avant de pousser.
- **Migrations Supabase** : fichiers numérotés dans `supabase/migrations/`, exécutés À LA MAIN par
  l'utilisateur dans le SQL Editor. Les écrire ré-exécutables (`if not exists`, `drop policy if exists`
  avant `create policy`) et garder le code résilient tant qu'elles ne sont pas passées. Toujours donner
  le SQL à copier à l'utilisateur.
- Échanger avec l'utilisateur en français.
