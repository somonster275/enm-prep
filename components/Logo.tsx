import React from 'react'

const INK = '#000000'
const RED = '#DC4A2B'

/**
 * Logo « codex » — police Bagel Fat One (style bubble rétro), version pleine.
 */
export function Logo({ size = 26, color = INK }: { size?: number; color?: string }) {
  return (
    <span aria-label="codex" style={{
      fontFamily: "'Bagel Fat One', system-ui, sans-serif",
      fontWeight: 400, fontSize: size, lineHeight: 1, letterSpacing: '-.01em',
      color, display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      codex
    </span>
  )
}

/**
 * Logo « codex » sur bloc rouge, rendu en SVG pour un centrage vertical exact
 * (dominant-baseline central — insensible à l'espace de descente de la police).
 * Le texte déborde du bloc à gauche et à droite, comme le poster. Pour le login.
 */
export function LogoPoster({ width = 460 }: { width?: number }) {
  return (
    <svg
      viewBox="0 0 640 200" width={width} height={width * (200 / 640)}
      style={{ display: 'block', overflow: 'visible' }} aria-label="codex"
    >
      <rect x="170" y="76" width="300" height="96" rx="5" fill={RED} />
      <text
        x="320" y="100" fill={INK} textAnchor="middle" dominantBaseline="central"
        fontFamily="'Bagel Fat One', system-ui, sans-serif" fontSize="150"
      >codex</text>
    </svg>
  )
}

/**
 * Logo « codex » dont l'écriture DÉBORDE de son bloc rouge — la signature de marque.
 * Le bloc rouge est plus étroit que le texte : le « c » et le « x » dépassent
 * sur les côtés, comme sur le poster. Utilisé dans la nav une fois connecté.
 */
export function LogoBadge({ size = 18 }: { size?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', padding: '3px 0' }}>
      {/* bloc rouge en fond, plus étroit que le texte */}
      <span style={{
        position: 'absolute', left: '16%', right: '16%', top: '14%', bottom: '14%',
        background: RED, borderRadius: 4,
      }} />
      <span style={{ position: 'relative' }}>
        <Logo size={size} color={INK} />
      </span>
    </span>
  )
}
