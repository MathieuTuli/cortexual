import { z } from 'zod'

export const CardPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  /** Card width on the canvas. Height is left to the content. */
  w: z.number(),
})

export type CardPosition = z.infer<typeof CardPositionSchema>

/** cardId -> where that card sits on one space's canvas. */
export const SpaceLayoutSchema = z.record(CardPositionSchema)
export type SpaceLayout = z.infer<typeof SpaceLayoutSchema>

/**
 * Layout lives per space, not on the card: a card in three spaces needs three
 * positions. Keyed by space id, plus one pseudo-key for the All cards view,
 * which has no space record to hang off.
 */
export const LayoutsSchema = z.record(SpaceLayoutSchema)
export type Layouts = z.infer<typeof LayoutsSchema>

export const ALL_CARDS_LAYOUT_KEY = '__all__'

export const DEFAULT_CARD_WIDTH = 260

export function layoutKeyForSpace(spaceId: string | null): string {
  return spaceId ?? ALL_CARDS_LAYOUT_KEY
}

const FALLBACK_COLUMNS = 5
const FALLBACK_GAP = 24
const FALLBACK_ROW_HEIGHT = 280

/**
 * Where a card sits when nobody has dragged it yet: a plain grid slot derived
 * from its index. Computed rather than persisted, so layouts.json only ever
 * holds cards you actually moved — otherwise opening the canvas would write
 * a position for all 326 of them.
 */
export function fallbackPosition(index: number): CardPosition {
  return {
    x: (index % FALLBACK_COLUMNS) * (DEFAULT_CARD_WIDTH + FALLBACK_GAP),
    y: Math.floor(index / FALLBACK_COLUMNS) * FALLBACK_ROW_HEIGHT,
    w: DEFAULT_CARD_WIDTH,
  }
}

export function positionFor(layout: SpaceLayout, cardId: string, index: number): CardPosition {
  return layout[cardId] ?? fallbackPosition(index)
}
