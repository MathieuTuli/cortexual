import { describe, it, expect } from 'vitest'
import {
  CardPositionSchema,
  DEFAULT_CARD_WIDTH,
  fallbackPosition,
  positionFor,
  projectLayoutKey,
  type CanvasLayout,
} from './layout'

describe('projectLayoutKey', () => {
  it('namespaces the project id', () => {
    expect(projectLayoutKey('abc')).toBe('project:abc')
  })

  it('keeps two projects apart', () => {
    expect(projectLayoutKey('a')).not.toBe(projectLayoutKey('b'))
  })
})

describe('fallbackPosition', () => {
  it('puts the first card at the origin', () => {
    expect(fallbackPosition(0)).toEqual({ x: 0, y: 0, w: DEFAULT_CARD_WIDTH })
  })

  it('advances along a row before wrapping', () => {
    expect(fallbackPosition(1).y).toBe(0)
    expect(fallbackPosition(1).x).toBeGreaterThan(fallbackPosition(0).x)
  })

  it('wraps to a new row after the column count', () => {
    expect(fallbackPosition(5)).toMatchObject({ x: 0 })
    expect(fallbackPosition(5).y).toBeGreaterThan(fallbackPosition(4).y)
  })

  it('never overlaps two consecutive slots', () => {
    const a = fallbackPosition(0)
    const b = fallbackPosition(1)
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.w)
  })
})

describe('positionFor', () => {
  const layout: CanvasLayout = { moved: { x: 120, y: 340, w: 300 } }

  it('prefers a stored position', () => {
    expect(positionFor(layout, 'moved', 7)).toEqual({ x: 120, y: 340, w: 300 })
  })

  it('falls back to the grid slot for an unplaced card', () => {
    expect(positionFor(layout, 'unplaced', 0)).toEqual(fallbackPosition(0))
  })

  it('gives different unplaced cards different slots', () => {
    expect(positionFor(layout, 'a', 0)).not.toEqual(positionFor(layout, 'b', 1))
  })
})

describe('CardPositionSchema', () => {
  it('accepts a well-formed position', () => {
    expect(CardPositionSchema.parse({ x: 1, y: 2, w: 3 })).toEqual({ x: 1, y: 2, w: 3 })
  })

  it('accepts negative coordinates — the canvas extends both ways', () => {
    expect(() => CardPositionSchema.parse({ x: -500, y: -900, w: 260 })).not.toThrow()
  })

  it('rejects a position missing a coordinate', () => {
    expect(() => CardPositionSchema.parse({ x: 1, w: 3 })).toThrow()
  })

  it('rejects coordinates that are not numbers', () => {
    expect(() => CardPositionSchema.parse({ x: '1', y: 2, w: 3 })).toThrow()
  })
})
