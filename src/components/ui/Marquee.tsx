/**
 * A label that loops when its enclosing `.pill` is hovered.
 *
 * Two layers rather than one: the static copy is what you read at rest, and the
 * track — two identical halves of repeated copies — replaces it on hover and
 * slides exactly -50%, landing on the start of the second half. Repeating the
 * word several times per half is what keeps the line dense; a single copy per
 * half drags a button-width of empty space behind it.
 */
const COPIES_PER_HALF = 4

/**
 * A fixed duration would run every label at a different speed — "Fit" and
 * "Save as PDF" travel very different distances in the same seven seconds. The
 * duration is derived from the distance instead, so everything on screen moves
 * at one rate. Estimated from the text rather than measured: a ResizeObserver
 * per button costs more than being a few pixels per second out.
 */
const PX_PER_SECOND = 90
const CHAR_WIDTH_EM = 0.52
const GAP_EM = 1.4
const NOMINAL_FONT_PX = 16

function loopSeconds(text: string): number {
  const perCopyPx = (text.length * CHAR_WIDTH_EM + GAP_EM) * NOMINAL_FONT_PX
  return (COPIES_PER_HALF * perCopyPx) / PX_PER_SECOND
}

export function Marquee({ text, className }: { text: string; className?: string }) {
  const copies = Array.from({ length: COPIES_PER_HALF * 2 }, (_, i) => (
    <span key={i}>{text}</span>
  ))

  return (
    <span
      className={className ? `marquee ${className}` : 'marquee'}
      style={{ '--marquee-speed': `${loopSeconds(text).toFixed(2)}s` } as React.CSSProperties}
    >
      <span className="marquee__static">{text}</span>
      <span className="marquee__track" aria-hidden>
        {copies}
      </span>
    </span>
  )
}
