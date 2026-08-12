import { describe, it, expect } from 'vitest'
import { cardIsInSpace, cardSpaces, DEFAULT_SPACE_ID, type Space } from './space'
import type { Card } from './card'

function card(spaceIds: string[]): Card {
  return {
    id: 'c1',
    spaceIds,
    type: 'note',
    content: '',
    tags: [],
    subnotes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }
}

function space(id: string, sortOrder = 0): Space {
  return {
    id,
    name: id,
    isDefault: id === DEFAULT_SPACE_ID,
    sortOrder,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }
}

describe('cardIsInSpace', () => {
  it('matches a space the card belongs to', () => {
    expect(cardIsInSpace(card(['a']), 'a')).toBe(true)
  })

  it('rejects a space the card does not belong to', () => {
    expect(cardIsInSpace(card(['a']), 'b')).toBe(false)
  })

  it('matches every space of a multi-space card', () => {
    const c = card(['a', 'b', 'c'])
    expect(cardIsInSpace(c, 'a')).toBe(true)
    expect(cardIsInSpace(c, 'b')).toBe(true)
    expect(cardIsInSpace(c, 'c')).toBe(true)
  })

  it('treats uncategorized as having no spaces', () => {
    expect(cardIsInSpace(card([]), DEFAULT_SPACE_ID)).toBe(true)
  })

  it('does not report a filed card as uncategorized', () => {
    expect(cardIsInSpace(card(['a']), DEFAULT_SPACE_ID)).toBe(false)
  })

  it('does not report an unfiled card as belonging to a real space', () => {
    expect(cardIsInSpace(card([]), 'a')).toBe(false)
  })
})

describe('cardSpaces', () => {
  const spaces = [space('a', 0), space('b', 1), space('c', 2)]

  it('returns the spaces a card belongs to', () => {
    expect(cardSpaces(card(['a', 'c']), spaces).map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('returns them in sidebar order, not card order', () => {
    expect(cardSpaces(card(['c', 'a']), spaces).map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('returns empty for an unfiled card', () => {
    expect(cardSpaces(card([]), spaces)).toEqual([])
  })

  it('never includes uncategorized', () => {
    const withDefault = [...spaces, space(DEFAULT_SPACE_ID, 3)]
    expect(cardSpaces(card([DEFAULT_SPACE_ID, 'a']), withDefault).map((s) => s.id)).toEqual(['a'])
  })

  it('ignores ids with no matching space', () => {
    expect(cardSpaces(card(['a', 'deleted-space']), spaces).map((s) => s.id)).toEqual(['a'])
  })
})
