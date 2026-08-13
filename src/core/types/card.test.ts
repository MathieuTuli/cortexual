import { describe, it, expect } from 'vitest'
import { CardSchema, HighlightCardSchema, CardTypeEnum } from './card'

const base = {
  id: 'c1',
  spaceIds: [],
  projectIds: [],
  tags: [],
  subnotes: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
}

describe('CardTypeEnum', () => {
  it('includes highlight', () => {
    expect(CardTypeEnum.options).toContain('highlight')
  })
})

describe('HighlightCardSchema', () => {
  it('accepts a bare quote', () => {
    const parsed = HighlightCardSchema.parse({ ...base, type: 'highlight', text: 'A quote.' })
    expect(parsed.text).toBe('A quote.')
  })

  it('accepts provenance and a note', () => {
    const parsed = HighlightCardSchema.parse({
      ...base,
      type: 'highlight',
      text: 'A quote.',
      note: 'why it matters',
      author: 'Ada',
      sourceUrl: 'https://example.com',
      siteName: 'Example',
    })
    expect(parsed).toMatchObject({ author: 'Ada', siteName: 'Example', note: 'why it matters' })
  })

  it('rejects a highlight with no text', () => {
    expect(() => HighlightCardSchema.parse({ ...base, type: 'highlight' })).toThrow()
  })
})

describe('CardSchema discriminated union', () => {
  it('narrows a highlight by its type tag', () => {
    const card = CardSchema.parse({ ...base, type: 'highlight', text: 'Quoted.' })
    expect(card.type).toBe('highlight')
    if (card.type === 'highlight') expect(card.text).toBe('Quoted.')
  })

  it('still narrows a note', () => {
    const card = CardSchema.parse({ ...base, type: 'note', content: 'Mine.' })
    if (card.type === 'note') expect(card.content).toBe('Mine.')
  })

  it('does not accept a note carrying highlight text', () => {
    expect(() => CardSchema.parse({ ...base, type: 'note', text: 'Quoted.' })).toThrow()
  })

  it('accepts provenance on any card type', () => {
    const card = CardSchema.parse({
      ...base,
      type: 'link',
      url: 'https://example.com',
      author: 'Ada',
    })
    expect(card.author).toBe('Ada')
  })
})
