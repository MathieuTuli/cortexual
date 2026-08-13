import { z } from 'zod'

export const CardPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  /** Card width on the canvas. Height is left to the content. */
  w: z.number(),
})

export type CardPosition = z.infer<typeof CardPositionSchema>

/** cardId -> where that card sits on one project's canvas. */
export const CanvasLayoutSchema = z.record(CardPositionSchema)
export type CanvasLayout = z.infer<typeof CanvasLayoutSchema>

/**
 * Keyed by project. Only projects have canvases — a space is somewhere a card
 * lives, not a thing you arrange — so there is exactly one canvas per project
 * and none anywhere else.
 */
export const LayoutsSchema = z.record(CanvasLayoutSchema)
export type Layouts = z.infer<typeof LayoutsSchema>

/** Prefixed so a layout key says what it belongs to when read off disk. */
export function projectLayoutKey(projectId: string): string {
  return `project:${projectId}`
}

export const DEFAULT_CARD_WIDTH = 260
export const CANVAS_GAP = 24

const FALLBACK_COLUMNS = 5
const FALLBACK_ROW_HEIGHT = 280

/**
 * Where a card sits before anything has measured it: a plain grid slot from its
 * index. Computed rather than stored, and only on screen for the moment between
 * first render and the packer replacing it — opening a canvas persists the
 * packed positions, not these.
 */
export function fallbackPosition(index: number): CardPosition {
  return {
    x: (index % FALLBACK_COLUMNS) * (DEFAULT_CARD_WIDTH + CANVAS_GAP),
    y: Math.floor(index / FALLBACK_COLUMNS) * FALLBACK_ROW_HEIGHT,
    w: DEFAULT_CARD_WIDTH,
  }
}

export function positionFor(layout: CanvasLayout, cardId: string, index: number): CardPosition {
  return layout[cardId] ?? fallbackPosition(index)
}
