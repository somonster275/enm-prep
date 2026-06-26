'use client'
import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'

const CONFIG = {
  ALLOWED_TAGS: [
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'mark',
    'span', 'div', 'p', 'br', 'hr',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'h1', 'h2', 'h3', 'h4', 'font',
  ],
  ALLOWED_ATTR: ['style', 'href', 'src', 'alt', 'width', 'height', 'color', 'target', 'class', 'colspan', 'rowspan'],
  ALLOW_DATA_ATTR: false,
}

/**
 * Affiche du HTML riche (couleurs, gras, surlignage, images…) de façon sécurisée.
 * Le HTML est nettoyé avec DOMPurify et injecté côté client (évite les erreurs d'hydratation).
 */
export default function RichContent({ html, style }: { html: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = DOMPurify.sanitize(html, CONFIG)
  }, [html])

  return <div ref={ref} className="rich-content" style={style} />
}
