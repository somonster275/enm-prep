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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
