import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { Card as CardType } from '@/core/types'
import { Card } from './Card'

vi.mock('@/core/api', () => ({ api: { getMediaUrls: async () => [] } }))
const selected = { current: false }
vi.mock('./use-card-actions', () => ({
  useCardActions: () => ({
    isSelected: selected.current,
    onClick: () => {},
    onMenu: () => {},
    menus: null,
  }),
}))

const base = {
  id: 'c1',
  tags: [],
  spaceIds: [],
  projectIds: [],
  subnotes: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
}

const CARDS: Record<string, CardType> = {
  note: { ...base, type: 'note', content: 'hi', title: '' },
  image: { ...base, type: 'image', mediaIds: ['m'] },
  video: { ...base, type: 'video', mediaId: 'm' },
  link: { ...base, type: 'link', url: 'https://example.com' },
  highlight: { ...base, type: 'highlight', text: 'quoted' },
} as unknown as Record<string, CardType>

const shell = () => document.querySelector('article') as HTMLElement

beforeEach(() => {
  cleanup()
  selected.current = false
})

describe('card corner marks the kind', () => {
  it.each([
    ['note', 'card-shaped--sharp'],
    ['image', 'card-shaped--round'],
    ['video', 'card-shaped--slice'],
    ['link', 'card-shaped--cut'],
    ['highlight', 'card-shaped--wide'],
  ])('gives a %s its own corner', (kind, expected) => {
    render(<Card card={CARDS[kind]} />)
    expect(shell().className).toContain(expected)
    expect(shell().className).toContain('card-shaped')
  })

  /*
   * The corners are set as single-corner longhands in the components layer, and
   * Tailwind emits utilities after it — so one rounded-* class on the shell
   * beats all of them with its shorthand and silently flattens every corner
   * back to the same radius. That is exactly what happened: image and highlight
   * rendered identically to a note until this was caught.
   */
  it('carries no border-radius utility that would flatten the corner', () => {
    render(<Card card={CARDS.image} />)
    const offenders = [...shell().classList].filter((c) => /^rounded(-|$)/.test(c))
    expect(offenders).toEqual([])
    expect(shell().className).toContain('card-surface')
  })

  it('gives every kind a different corner', () => {
    const seen = ['note', 'image', 'video', 'link', 'highlight'].map((kind) => {
      cleanup()
      render(<Card card={CARDS[kind]} />)
      return shell().className.match(/card-shaped--\w+/)?.[0]
    })
    expect(new Set(seen).size).toBe(5)
  })

  /*
   * The shaped corner eats into the bottom right, which is where the age and
   * the menu button live. The footer has to be marked so the stylesheet can
   * reserve that space; without the hook the corner clips the controls.
   */
  it('marks the footer on shaped cards so it can be kept clear', () => {
    render(<Card card={CARDS.link} />)
    expect(document.querySelector('.card-shaped .card-foot')).toBeTruthy()
  })

  /*
   * jsdom never loads the stylesheet, so the geometry has to be read out of the
   * source. Worth doing, because the shape a corner rule describes is not
   * always the shape it draws: the highlight was `border-radius: 999px`, and a
   * radius that large is clamped to half the border box — its real size was the
   * card's size. It looked right in a 220px lab card and swept a 245px arc
   * through the text of a real quote. So every length in a corner rule is
   * either written in terms of --card-corner or smaller than it; a bare number
   * big enough to be clamped, or a percentage radius, fails here.
   */
  it('sizes every corner from --card-corner rather than from the card', () => {
    // import.meta.url is an http url under vite-node, so this reads from the
    // project root vitest runs in rather than from the module.
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const corner = Number(css.match(/--card-corner:\s*([\d.]+)px/)![1])

    for (const [, selector, body] of css.matchAll(/\.(card-shaped--\w+)\s*\{([^}]*)\}/g)) {
      for (const [, prop, value] of body.matchAll(/([-a-z]+)\s*:\s*([^;]+);/g)) {
        const isRadius = prop.endsWith('radius')
        const literals = [...value.replace(/var\(--card-corner\)/g, '').matchAll(/([\d.]+)(px|%)/g)]
        // A radius may carry no raw length at all. A clip-path or a mask is
        // free to use 100% — it is anchored to the corner, not scaled by it —
        // but its own lengths still have to fit inside the reserved square.
        const offenders = literals
          .filter(([, size, unit]) => (isRadius ? true : unit === 'px' && Number(size) > corner))
          .map(([token]) => token)

        expect({ [`${selector} { ${prop} }`]: offenders }).toEqual({
          [`${selector} { ${prop} }`]: [],
        })
      }
    }
  })

  /*
   * An outset ring is painted beyond the border box, and both clip-path and
   * mask-image cut to that box — so on a shaped card the old ring-offset-2 did
   * not merely get trimmed at the corner, it disappeared completely. Inset
   * survives, on every kind.
   */
  it.each(['note', 'image', 'video', 'link', 'highlight'])(
    'keeps a visible selection ring on a %s',
    (kind) => {
      selected.current = true
      render(<Card card={CARDS[kind]} />)
      expect(shell().className).toContain('ring-inset')
      expect(shell().className).not.toContain('ring-offset')
    }
  )
})
