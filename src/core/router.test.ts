import { describe, it, expect } from 'vitest'
import { hrefFor, parseRoute, type Route } from './router'

describe('parseRoute', () => {
  it('reads the home page', () => {
    expect(parseRoute('/', '')).toEqual({ name: 'home' })
  })

  it('reads the library with and without a space', () => {
    expect(parseRoute('/library', '')).toEqual({ name: 'library', spaceId: null })
    expect(parseRoute('/library/abc', '')).toEqual({ name: 'library', spaceId: 'abc' })
  })

  it('reads projects with and without one selected', () => {
    expect(parseRoute('/projects', '')).toEqual({ name: 'projects', projectId: null })
    expect(parseRoute('/projects/xyz', '')).toEqual({ name: 'projects', projectId: 'xyz' })
  })

  it('decodes ids that were escaped into the path', () => {
    expect(parseRoute('/library/a%2Fb', '')).toEqual({ name: 'library', spaceId: 'a/b' })
  })

  it('reads a project canvas', () => {
    expect(parseRoute('/canvas', '?project=p1')).toEqual({ name: 'canvas', projectId: 'p1' })
  })

  it('sends a canvas with no project home — only projects have one', () => {
    expect(parseRoute('/canvas', '')).toEqual({ name: 'home' })
    expect(parseRoute('/canvas', '?space=s1')).toEqual({ name: 'home' })
  })

  it('falls back to home for anything unrecognised', () => {
    expect(parseRoute('/nope', '')).toEqual({ name: 'home' })
  })
})

describe('hrefFor', () => {
  const cases: Route[] = [
    { name: 'home' },
    { name: 'library', spaceId: null },
    { name: 'library', spaceId: 'abc' },
    { name: 'projects', projectId: null },
    { name: 'projects', projectId: 'xyz' },
    { name: 'canvases' },
    { name: 'canvas', projectId: 'p1' },
  ]

  it('round-trips every route through the parser', () => {
    for (const route of cases) {
      const href = hrefFor(route)
      const [pathname, search] = href.split('?')
      expect(parseRoute(pathname, search ? `?${search}` : '')).toEqual(route)
    }
  })

  it('escapes an id with a slash in it', () => {
    expect(hrefFor({ name: 'library', spaceId: 'a/b' })).toBe('/library/a%2Fb')
  })
})
