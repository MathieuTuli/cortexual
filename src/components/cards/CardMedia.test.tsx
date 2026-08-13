import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import type { ImageCard } from '@/core/types'
import { CardMedia } from './CardMedia'

const getMediaUrls = vi.fn()
vi.mock('@/core/api', () => ({ api: { getMediaUrls: (id: string) => getMediaUrls(id) } }))

function imageCard(): ImageCard {
  return {
    id: 'c1',
    type: 'image',
    caption: 'A set',
    mediaIds: ['m1', 'm2', 'm3'],
    tags: [],
    spaceIds: [],
    projectIds: [],
    subnotes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }
}

/** The one currently on screen, as opposed to the invisible height sizer. */
const shown = () => screen.getByAltText('A set')

beforeEach(() => {
  cleanup()
  getMediaUrls.mockReset()
})

describe('CardMedia with a set of images', () => {
  it('keeps one image in flow as the sizer and draws the rest inside it', async () => {
    getMediaUrls.mockResolvedValue(['/a.jpg', '/b.jpg', '/c.jpg'])
    render(<CardMedia card={imageCard()} />)

    await waitFor(() => expect(shown()).toBeTruthy())

    // The sizer is the first source, always, and it holds the box open.
    const sizer = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement
    expect(sizer.getAttribute('src')).toBe('/a.jpg')
    expect(sizer.className).toContain('invisible')
    expect(sizer.className).not.toContain('absolute')

    // Whatever is on screen is taken out of flow and fitted to that box, so no
    // image's own proportions can change the height of the tile.
    expect(shown().className).toContain('absolute')
    expect(shown().className).toContain('object-contain')
    expect(shown().className).not.toContain('object-cover')
  })

  it('does not change the sizer when paging through the set', async () => {
    getMediaUrls.mockResolvedValue(['/a.jpg', '/b.jpg', '/c.jpg'])
    render(<CardMedia card={imageCard()} />)
    await waitFor(() => expect(shown()).toBeTruthy())

    const sizerSrc = () =>
      (document.querySelector('img[aria-hidden="true"]') as HTMLImageElement).getAttribute('src')

    expect(shown().getAttribute('src')).toBe('/a.jpg')
    fireEvent.click(screen.getByLabelText('Next image'))
    expect(shown().getAttribute('src')).toBe('/b.jpg')
    expect(sizerSrc()).toBe('/a.jpg')

    fireEvent.click(screen.getByLabelText('Previous image'))
    fireEvent.click(screen.getByLabelText('Previous image'))
    expect(shown().getAttribute('src')).toBe('/c.jpg')
    expect(sizerSrc()).toBe('/a.jpg')
  })

  it('leaves a lone image sizing itself, with no sizer and no letterboxing', async () => {
    getMediaUrls.mockResolvedValue(['/only.jpg'])
    render(<CardMedia card={imageCard()} />)
    await waitFor(() => expect(shown()).toBeTruthy())

    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull()
    expect(shown().className).toContain('object-cover')
    expect(shown().className).not.toContain('absolute')
    expect(screen.queryByLabelText('Next image')).toBeNull()
  })
})
