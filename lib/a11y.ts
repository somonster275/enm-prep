import type { KeyboardEvent } from 'react'

/** À étaler sur un élément cliquable qui n'est pas un <button> : focus clavier, Entrée/Espace = clic. */
export const activable = {
  role: 'button',
  tabIndex: 0,
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return // ne pas détourner les touches d'un enfant (bouton, champ)
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() }
  },
}
