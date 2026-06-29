-- QCM « avancés » à réponse libre (l'étudiant tape sa réponse, comparée à une
-- liste de réponses acceptées). Réutilise les tables qcm / qcm_questions.

-- Sécurité : s'assure que la colonne matiere existe (selon l'historique de la base).
alter table public.qcm add column if not exists matiere text;

-- Type de QCM : 'choix' (choix multiples, défaut) ou 'libre' (réponse tapée).
alter table public.qcm add column if not exists type text not null default 'choix';

-- Champs spécifiques au format à réponse libre.
alter table public.qcm_questions add column if not exists cas text;                 -- énoncé/cas pratique (facultatif)
alter table public.qcm_questions add column if not exists reponses_ok jsonb;        -- ["réponse acceptée", ...]
alter table public.qcm_questions add column if not exists reponse_affichee text;    -- la bonne réponse à afficher

-- Les questions à réponse libre n'ont pas d'options : on autorise le tableau vide
-- (déjà default '[]'), aucune contrainte à modifier.

-- Force PostgREST à recharger son cache de schéma (sinon « column not found »).
notify pgrst, 'reload schema';
