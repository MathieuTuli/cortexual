import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import App from './App'

/**
 * Every route rendered against a stubbed API. Not a substitute for looking at
 * the thing, but it catches the class of breakage a typecheck misses — import
 * cycles, a hook rule violated, a component that throws on first paint — which
 * is otherwise only discoverable in a browser.
 */

const EMPTY: Record<string, unknown> = {
  '/api/cards': [],
  '/api/spaces': [],
  '/api/projects': [],
  '/api/layouts': {},
  '/api/embeddings': {},
}

function at(path: string) {
  const url = new URL(`http://localhost${path}`)
  window.history.pushState({}, '', url.pathname + url.search)
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      const key = Object.keys(EMPTY).find((k) => url.startsWith(k))
      return new Response(JSON.stringify(key ? EMPTY[key] : {}), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('routes render', () => {
  // The marquee repeats each label nine times, so text queries match many
  // nodes; the copies are aria-hidden, so accessible-name queries see one.
  it('home offers the three destinations', () => {
    at('/')
    render(<App />)
    expect(screen.getByPlaceholderText('Search your library')).toBeTruthy()
    for (const label of ['Spaces', 'Projects', 'Canvases']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('library renders its own nav column', () => {
    at('/library')
    render(<App />)
    expect(screen.getByRole('button', { name: /All cards/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'All cards' })).toBeTruthy()
  })

  it('projects renders its own nav column', () => {
    at('/projects')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeTruthy()
    expect(screen.getByText('No projects yet.')).toBeTruthy()
  })

  it('canvases is empty until a project has one', () => {
    at('/canvases')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Canvases' })).toBeTruthy()
    expect(screen.getByText('No canvases yet.')).toBeTruthy()
    // Nothing is listed for spaces or for the library as a whole.
    expect(screen.queryByText('All cards')).toBeNull()
  })

  it('canvas is its own document, with no library chrome', () => {
    at('/canvas?project=p1')
    render(<App />)
    expect(screen.getByText('Loading canvas…')).toBeTruthy()
    expect(screen.queryByText('All cards')).toBeNull()
  })

  it('keeps the capture button pinned bottom-right', () => {
    at('/library')
    render(<App />)
    const capture = screen.getByRole('button', { name: 'Capture a new card' })
    expect(capture.className).toContain('fixed')
    expect(capture.className).toContain('bottom-8')
    // Right offset carries the scroll-lock compensation, so match loosely.
    expect(capture.className).toMatch(/right-/)
  })

  it('every page can reach the other two without going home', () => {
    for (const path of ['/library', '/projects', '/canvases']) {
      at(path)
      const { unmount } = render(<App />)
      const nav = within(screen.getByRole('navigation', { name: 'Pages' }))
      for (const label of ['Spaces', 'Projects', 'Canvases']) {
        expect(nav.getByRole('button', { name: label })).toBeTruthy()
      }
      expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy()
      unmount()
    }
  })

  it('a canvas with no project is not a place — it goes home', () => {
    at('/canvas')
    render(<App />)
    expect(screen.getByPlaceholderText('Search your library')).toBeTruthy()
  })
})
