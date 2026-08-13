import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useCardsStore, useLayoutStore, useProjectsStore } from '@/core/stores'
import { projectLayoutKey, type Project } from '@/core/types'
import { CanvasesPage } from './CanvasesPage'

vi.mock('@/core/api', () => ({ api: {} }))

function project(id: string, name: string): Project {
  return {
    id,
    name,
    status: 'active',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }
}

beforeEach(() => {
  cleanup()
  useCardsStore.setState({ cards: [] })
  useProjectsStore.setState({ projects: [project('p1', 'Kitchen'), project('p2', 'Untouched')] })
  useLayoutStore.setState({ layouts: {} })
})

describe('CanvasesPage', () => {
  it('lists nothing until a canvas has actually been arranged', () => {
    render(<CanvasesPage />)
    expect(screen.getByText('No canvases yet.')).toBeTruthy()
  })

  /*
   * The shape here is what the API really returns — a layout keyed
   * `project:<id>`, written by the canvas tab. Getting that key wrong, or
   * reading it before the store has been refreshed, is what made a canvas the
   * user had just made fail to show up at all.
   */
  it('lists a project once its layout exists, and only that one', () => {
    useLayoutStore.setState({
      layouts: {
        [projectLayoutKey('p1')]: {
          cardA: { x: 0, y: 0, w: 260 },
          cardB: { x: 284, y: 0, w: 260 },
        },
      },
    })

    render(<CanvasesPage />)

    expect(screen.getByText('Kitchen')).toBeTruthy()
    expect(screen.queryByText('Untouched')).toBeNull()
    expect(screen.queryByText('No canvases yet.')).toBeNull()
  })

  it('ignores a layout key that exists but holds no cards', () => {
    useLayoutStore.setState({ layouts: { [projectLayoutKey('p1')]: {} } })
    render(<CanvasesPage />)
    expect(screen.getByText('No canvases yet.')).toBeTruthy()
  })
})
