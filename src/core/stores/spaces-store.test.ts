import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Space } from '../types'

const getSpaces = vi.fn()
const createSpace = vi.fn().mockResolvedValue({})
const updateSpace = vi.fn().mockResolvedValue({})
const deleteSpace = vi.fn().mockResolvedValue({})

vi.mock('../api', () => ({
  api: {
    getSpaces: () => getSpaces(),
    createSpace: (s: Space) => createSpace(s),
    updateSpace: (id: string, c: unknown) => updateSpace(id, c),
    deleteSpace: (id: string) => deleteSpace(id),
  },
}))

vi.mock('./cards-store', () => ({
  useCardsStore: { getState: () => ({ setMembership: vi.fn().mockResolvedValue(undefined) }) },
}))

const { useSpacesStore, compareSpaces } = await import('./spaces-store')

function space(id: string, name: string, sortOrder = 0): Space {
  return {
    id,
    name,
    isDefault: id === 'uncategorized',
    sortOrder,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }
}

const names = () => useSpacesStore.getState().spaces.map((s) => s.name)

describe('spaces alphabetical ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSpace.mockResolvedValue({})
    updateSpace.mockResolvedValue({})
    useSpacesStore.setState({ spaces: [], isLoading: false, error: null, activeSpaceId: null })
  })

  it('loads spaces alphabetically, ignoring sortOrder', async () => {
    getSpaces.mockResolvedValue([space('z', 'Zebra', 0), space('a', 'apple', 1), space('m', 'Mango', 2)])
    await useSpacesStore.getState().loadSpaces()
    expect(names()).toEqual(['apple', 'Mango', 'Zebra'])
  })

  it('is case-insensitive', async () => {
    getSpaces.mockResolvedValue([space('b', 'banana'), space('a', 'Apple'), space('c', 'cherry')])
    await useSpacesStore.getState().loadSpaces()
    expect(names()).toEqual(['Apple', 'banana', 'cherry'])
  })

  it('excludes deleted spaces', async () => {
    getSpaces.mockResolvedValue([{ ...space('d', 'Aardvark'), deletedAt: '2026-01-02T00:00:00.000Z' }, space('b', 'Beta')])
    await useSpacesStore.getState().loadSpaces()
    expect(names()).toEqual(['Beta'])
  })

  it('inserts a created space alphabetically', async () => {
    useSpacesStore.setState({ spaces: [space('a', 'Apple'), space('z', 'Zebra')] })
    await useSpacesStore.getState().createSpace({ name: 'Mango' })
    expect(names()).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  it('re-sorts when a space is renamed', async () => {
    useSpacesStore.setState({ spaces: [space('a', 'Apple'), space('z', 'Zebra')] })
    await useSpacesStore.getState().updateSpace('z', { name: 'Apricot' })
    expect(names()).toEqual(['Apple', 'Apricot'])
  })

  it('compareSpaces orders by name', () => {
    expect(compareSpaces(space('1', 'beta'), space('2', 'Alpha'))).toBeGreaterThan(0)
    expect(compareSpaces(space('1', 'Alpha'), space('2', 'beta'))).toBeLessThan(0)
  })
})
