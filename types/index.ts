export type Role = 'admin' | 'editeur' | 'lecteur'
export type Niveau = 0 | 1 | 2 | 3

export interface Espace {
  id: string
  nom: string
  slug: string
  description: string
  couleur: string
  ordre: number
}

export interface Module {
  id: string
  espace_id: string
  nom: string
  description?: string
  ordre: number
}

export interface Fiche {
  id: string
  module_id: string
  question: string
  reponse: string
  tags?: string[]
  created_at: string
}

export interface Profil {
  id: string
  email: string
  nom?: string
  role: Role
}

export interface Progression {
  id: string
  utilisateur_id: string
  fiche_id: string
  niveau: Niveau
  prochaine_revision: string
  derniere_revision?: string
}