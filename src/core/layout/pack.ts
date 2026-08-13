import type { CardPosition } from '../types'

/** A canvas is looked at on a screen and printed landscape, so aim for 16:9. */
export const TARGET_ASPECT = 16 / 9

export interface MeasuredCard {
  id: string
  /** Rendered height at the pack width. Cards size to their content. */
  height: number
}

export interface PackOptions {
  width: number
  gap: number
  targetAspect?: number
}

/**
 * Choose a column count so the packed block lands near the target aspect.
 *
 * Packing n columns of fixed width w+g against a total content run of H gives a
 * block roughly n(w+g) wide and H/n tall, so its aspect is n²(w+g)/H. Solving
 * for the target is the square root below. Without this the canvas inherits
 * whatever column count was hardcoded and grows straight down — 326 cards in
 * five columns is a strip twenty times taller than it is wide, which prints as
 * a ribbon.
 */
export function columnsForAspect(
  totalHeight: number,
  columnWidth: number,
  targetAspect: number
): number {
  if (totalHeight <= 0 || columnWidth <= 0) return 1
  return Math.max(1, Math.round(Math.sqrt((targetAspect * totalHeight) / columnWidth)))
}

/**
 * Masonry pack in the order given: each card goes to whichever column is
 * currently shortest. Order is preserved rather than sorting tall-first —
 * a better balance isn't worth a canvas whose reading order looks random.
 */
export function packToAspect(
  cards: MeasuredCard[],
  { width, gap, targetAspect = TARGET_ASPECT }: PackOptions
): Record<string, CardPosition> {
  if (cards.length === 0) return {}

  const columnWidth = width + gap
  const totalHeight = cards.reduce((sum, card) => sum + card.height + gap, 0)
  const columns = Math.min(cards.length, columnsForAspect(totalHeight, columnWidth, targetAspect))

  const filled = new Array<number>(columns).fill(0)
  const positions: Record<string, CardPosition> = {}

  for (const card of cards) {
    let shortest = 0
    for (let i = 1; i < columns; i++) {
      if (filled[i] < filled[shortest]) shortest = i
    }
    positions[card.id] = { x: shortest * columnWidth, y: filled[shortest], w: width }
    filled[shortest] += card.height + gap
  }

  return positions
}

/** Bounding box of a set of positions, given the heights they were packed from. */
export function packedExtent(
  positions: Record<string, CardPosition>,
  heights: Map<string, number>
): { width: number; height: number } {
  let width = 0
  let height = 0
  for (const [id, pos] of Object.entries(positions)) {
    width = Math.max(width, pos.x + pos.w)
    height = Math.max(height, pos.y + (heights.get(id) ?? 0))
  }
  return { width, height }
}
