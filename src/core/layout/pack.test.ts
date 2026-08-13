import { describe, it, expect } from 'vitest'
import { columnsForAspect, packToAspect, packedExtent, TARGET_ASPECT } from './pack'

const OPTS = { width: 260, gap: 24 }

function cards(heights: number[]) {
  return heights.map((height, i) => ({ id: `c${i}`, height }))
}

function aspectOf(heights: number[], targetAspect = TARGET_ASPECT) {
  const items = cards(heights)
  const positions = packToAspect(items, { ...OPTS, targetAspect })
  const byId = new Map(items.map((c) => [c.id, c.height]))
  const { width, height } = packedExtent(positions, byId)
  return width / height
}

describe('columnsForAspect', () => {
  it('grows the column count with the content run', () => {
    const narrow = columnsForAspect(2_000, 284, TARGET_ASPECT)
    const wide = columnsForAspect(50_000, 284, TARGET_ASPECT)
    expect(wide).toBeGreaterThan(narrow)
  })

  it('never returns less than one column', () => {
    expect(columnsForAspect(0, 284, TARGET_ASPECT)).toBe(1)
    expect(columnsForAspect(-5, 284, TARGET_ASPECT)).toBe(1)
    expect(columnsForAspect(10, 0, TARGET_ASPECT)).toBe(1)
  })
})

describe('packToAspect', () => {
  it('lands within a third of the target aspect for a real-sized library', () => {
    const heights = Array.from({ length: 326 }, (_, i) => 200 + ((i * 37) % 300))
    const aspect = aspectOf(heights)
    expect(aspect).toBeGreaterThan(TARGET_ASPECT * 0.67)
    expect(aspect).toBeLessThan(TARGET_ASPECT * 1.33)
  })

  it('honours a non-default target', () => {
    const heights = Array.from({ length: 120 }, () => 280)
    const square = aspectOf(heights, 1)
    const wide = aspectOf(heights, 3)
    expect(square).toBeLessThan(wide)
  })

  it('beats a fixed five-column grid on shape', () => {
    const heights = Array.from({ length: 326 }, () => 280)
    const packed = aspectOf(heights)

    const columnWidth = OPTS.width + OPTS.gap
    const rows = Math.ceil(326 / 5)
    const fixed = (5 * columnWidth) / (rows * (280 + OPTS.gap))

    expect(Math.abs(packed - TARGET_ASPECT)).toBeLessThan(Math.abs(fixed - TARGET_ASPECT))
  })

  it('places every card once, on a column boundary, without vertical overlap', () => {
    const items = cards([100, 400, 250, 180, 320, 90, 500, 210])
    const positions = packToAspect(items, OPTS)
    expect(Object.keys(positions)).toHaveLength(items.length)

    const columnWidth = OPTS.width + OPTS.gap
    const byColumn = new Map<number, Array<{ top: number; bottom: number }>>()

    for (const item of items) {
      const pos = positions[item.id]
      expect(pos.w).toBe(OPTS.width)
      expect(pos.x % columnWidth).toBe(0)
      const column = pos.x / columnWidth
      const list = byColumn.get(column) ?? []
      list.push({ top: pos.y, bottom: pos.y + item.height })
      byColumn.set(column, list)
    }

    for (const spans of byColumn.values()) {
      spans.sort((a, b) => a.top - b.top)
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i].top).toBeGreaterThanOrEqual(spans[i - 1].bottom)
      }
    }
  })

  it('keeps reading order across columns for uniform cards', () => {
    const items = cards(Array.from({ length: 6 }, () => 200))
    const positions = packToAspect(items, { ...OPTS, targetAspect: 100 })
    // Every card is the same height, so a wide target puts each in its own
    // column, left to right in the order given.
    const xs = items.map((c) => positions[c.id].x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  it('returns nothing for an empty canvas', () => {
    expect(packToAspect([], OPTS)).toEqual({})
  })
})
