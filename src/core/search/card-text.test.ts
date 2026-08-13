import { describe, it, expect } from 'vitest'
import { cardText, textHash } from './card-text'
import type { Card } from '../types'

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

describe('cardText', () => {
  it('reads a note body', () => {
    const card = { ...base, type: 'note', content: 'the body' } as Card
    expect(cardText(card)).toContain('the body')
  })

  it('reads a highlight quote and its commentary', () => {
    const card = { ...base, type: 'highlight', text: 'the quote', note: 'my take' } as Card
    const text = cardText(card)
    expect(text).toContain('the quote')
    expect(text).toContain('my take')
  })

  it('reads a link from its fetched preview, not its url', () => {
    const card = {
      ...base,
      type: 'link',
      url: 'https://example.com/a/b',
      preview: { title: 'Real Title', description: 'Real description' },
    } as Card
    const text = cardText(card)
    expect(text).toContain('Real Title')
    expect(text).toContain('Real description')
  })

  it('reads an image caption', () => {
    const card = { ...base, type: 'image', mediaIds: [], caption: 'a sunset' } as Card
    expect(cardText(card)).toContain('a sunset')
  })

  it('includes title, tags, author and subnotes', () => {
    const card = {
      ...base,
      type: 'note',
      content: 'body',
      title: 'Titled',
      tags: ['alpha', 'beta'],
      author: 'Ada',
      siteName: 'Example',
      subnotes: [{ id: 's1', content: 'a subnote', createdAt: base.createdAt }],
    } as Card
    const text = cardText(card)
    for (const part of ['Titled', 'alpha', 'beta', 'Ada', 'Example', 'a subnote']) {
      expect(text).toContain(part)
    }
  })

  it('returns empty for a card with nothing in it', () => {
    expect(cardText({ ...base, type: 'note', content: '' } as Card)).toBe('')
  })

  it('does not leak one type’s field into another', () => {
    const image = { ...base, type: 'image', mediaIds: [], caption: 'cap' } as Card
    expect(cardText(image)).not.toContain('undefined')
  })
})

describe('textHash', () => {
  it('is stable for the same text', () => {
    expect(textHash('hello world')).toBe(textHash('hello world'))
  })

  it('changes when the text changes', () => {
    expect(textHash('hello world')).not.toBe(textHash('hello worlds'))
  })

  it('changes on a single character edit', () => {
    expect(textHash('abcdef')).not.toBe(textHash('abcdeg'))
  })

  it('distinguishes anagrams', () => {
    expect(textHash('listen')).not.toBe(textHash('silent'))
  })

  it('handles an empty string', () => {
    expect(typeof textHash('')).toBe('string')
  })

  it('handles a long body without collapsing', () => {
    const long = 'x'.repeat(50_000)
    expect(textHash(long)).not.toBe(textHash(long + 'y'))
  })
})
