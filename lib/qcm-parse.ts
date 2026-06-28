// Analyse d'un QCM collé par l'admin, en texte simple OU en HTML.
// L'admin vérifie/ajuste ensuite le résultat dans la prévisualisation.

export type QOption = { t: string; c: boolean }
export type QQuestion = { enonce: string; options: QOption[]; explication?: string }

const looksHtml = (s: string) => /<[a-z!][\s\S]*>/i.test(s)

// ---------- Format TEXTE ----------
// Q: Question ?
// - option
// - bonne option *      (l'astérisque en fin = bonne réponse ; plusieurs possibles)
// > Explication (facultatif)
export function parseTexte(input: string): QQuestion[] {
  const lines = input.split('\n')
  const questions: QQuestion[] = []
  let cur: QQuestion | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const mExp = line.match(/^(?:>|Explication\s*[:.]?)\s*(.+)$/i)
    if (mExp && cur) { cur.explication = mExp[1].trim(); continue }

    const mQ = line.match(/^(?:Q\s*[:.\-)]\s*|\d+\s*[.)]\s*|Question\s*\d*\s*[:.]\s*)(.+)$/i)
    if (mQ) { if (cur) questions.push(cur); cur = { enonce: mQ[1].trim(), options: [] }; continue }

    const mOpt = line.match(/^[-•*]\s*(.+)$/) || line.match(/^[a-zA-Z]\s*[).]\s*(.+)$/)
    if (mOpt && cur) {
      let t = mOpt[1].trim()
      let c = false
      if (/\s\*$/.test(t) || /^\*\s/.test(t)) { c = true; t = t.replace(/^\*\s*/, '').replace(/\s*\*$/, '').trim() }
      if (/^\[x\]/i.test(t) || /^\(v\)/i.test(t)) { c = true; t = t.replace(/^\[x\]\s*/i, '').replace(/^\(v\)\s*/i, '').trim() }
      cur.options.push({ t, c })
      continue
    }

    // Ligne libre : démarre une question, ou complète l'énoncé en cours.
    if (!cur) cur = { enonce: line, options: [] }
    else if (cur.options.length === 0) cur.enonce += ' ' + line
  }
  if (cur) questions.push(cur)
  return questions.filter(q => q.options.length >= 2)
}

// ---------- Format HTML ----------
function estCorrect(el: Element): boolean {
  const cls = el.getAttribute('class') || ''
  if (/correct|bonne|exact|answer|right|juste/i.test(cls)) return true
  if (el.querySelector('strong, b, input[checked]')) return true
  if (/[✓✔☑]/.test(el.textContent || '')) return true
  return false
}
const nettoie = (s: string) => s.replace(/[✓✔☑*]/g, '').replace(/\s+/g, ' ').trim()

function enonceAvant(group: Element): string {
  let p: Element | null = group.previousElementSibling
  while (p && !(p.textContent || '').trim()) p = p.previousElementSibling
  if (!p && group.parentElement) p = group.parentElement.previousElementSibling
  return nettoie(p?.textContent || '')
}

export function parseHtml(input: string): QQuestion[] {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(input, 'text/html')
  const out: QQuestion[] = []

  // 1) Listes <ol>/<ul> : chaque liste = options, l'énoncé est juste avant.
  doc.querySelectorAll('ol, ul').forEach(list => {
    const lis = Array.from(list.children).filter(c => c.tagName === 'LI')
    if (lis.length < 2) return
    const options = lis.map(li => ({ t: nettoie(li.textContent || ''), c: estCorrect(li) })).filter(o => o.t)
    const enonce = enonceAvant(list)
    if (enonce && options.length >= 2) out.push({ enonce, options })
  })

  // 2) Groupes de boutons radio / cases à cocher (même name).
  const inputs = Array.from(doc.querySelectorAll('input[type=radio], input[type=checkbox]'))
  const groupes: Record<string, Element[]> = {}
  inputs.forEach(i => { const n = i.getAttribute('name') || '_q'; (groupes[n] ||= []).push(i) })
  Object.values(groupes).forEach(group => {
    if (group.length < 2) return
    const options = group.map(inp => {
      const id = inp.getAttribute('id')
      const lbl = inp.closest('label') || (id ? doc.querySelector(`label[for="${id}"]`) : null) || inp.parentElement
      return { t: nettoie(lbl?.textContent || ''), c: inp.hasAttribute('checked') }
    }).filter(o => o.t)
    const anc = inp0Closest(group[0])
    const enonce = anc ? enonceAvant(anc) : ''
    if (enonce && options.length >= 2) out.push({ enonce, options })
  })

  return out
}
function inp0Closest(el: Element): Element | null {
  return el.closest('fieldset, form, div, p, li') || el.parentElement
}

export function parseQcm(input: string): QQuestion[] {
  if (looksHtml(input)) {
    const h = parseHtml(input)
    if (h.length) return h
    // Repli : on retire les balises et on tente le format texte.
    const txt = input.replace(/<br\s*\/?>(?=)/gi, '\n').replace(/<\/(p|li|div|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
    return parseTexte(txt)
  }
  return parseTexte(input)
}
