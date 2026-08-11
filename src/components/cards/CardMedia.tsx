import { useEffect, useState } from 'react'
import type { ImageCard, VideoCard } from '@/core/types'
import { api } from '@/core/api'

interface CardMediaProps {
  card: ImageCard | VideoCard
}

export function CardMedia({ card }: CardMediaProps) {
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [loadError, setLoadError] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function loadMedia() {
      try {
        const urls = await api.getMediaUrls(card.id)
        if (!cancelled) {
          setMediaUrls(urls)
          if (urls.length === 0) setLoadError(true)
        }
      } catch (error) {
        console.error('Failed to load media:', error)
        if (!cancelled) setLoadError(true)
      }
    }
    loadMedia()
    return () => { cancelled = true }
  }, [card.id])

  if (card.type === 'video') {
    const src = mediaUrls[0] || card.thumbnailDataUrl

    if (!src && !loadError) {
      return <div className="aspect-video bg-[#f3f4f6] animate-pulse" />
    }
    if (!src && loadError) {
      return (
        <div className="aspect-video bg-[#f3f4f6] flex items-center justify-center text-text-muted text-xs">
          [video unavailable]
        </div>
      )
    }

    return (
      <div className="relative">
        {mediaUrls[0] ? (
          <video
            src={mediaUrls[0]}
            className="w-full aspect-video object-cover"
            controls={false}
          />
        ) : (
          <img
            src={src}
            alt={card.caption || 'Video thumbnail'}
            className="w-full aspect-video object-cover"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#0f172a] ml-0.5">
              <path d="M6 4l14 8L6 20V4z" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

  const thumbnails = card.thumbnailDataUrls || []
  const sources = mediaUrls.length > 0 ? mediaUrls : thumbnails

  if (sources.length === 0 && !loadError) {
    return <div className="aspect-video bg-[#f3f4f6] animate-pulse" />
  }
  if (sources.length === 0 && loadError) {
    return (
      <div className="aspect-video bg-[#f3f4f6] flex items-center justify-center text-text-muted text-xs">
        [image unavailable]
      </div>
    )
  }

  const current = Math.min(index, sources.length - 1)

  // Cycling happens inside the card, so these clicks must not reach the tile's
  // open-in-modal handler.
  const step = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation()
    setIndex((i) => (Math.min(i, sources.length - 1) + delta + sources.length) % sources.length)
  }

  return (
    <div className="relative group/media">
      <img
        src={sources[current]}
        alt={card.caption || 'Image'}
        className="w-full object-cover"
      />
      {sources.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => step(e, -1)}
            aria-label="Previous image"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#0f172a]/60 hover:bg-[#0f172a]/85 text-white text-base leading-none flex items-center justify-center backdrop-blur-sm opacity-0 group-hover/media:opacity-100 transition-opacity"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => step(e, 1)}
            aria-label="Next image"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#0f172a]/60 hover:bg-[#0f172a]/85 text-white text-base leading-none flex items-center justify-center backdrop-blur-sm opacity-0 group-hover/media:opacity-100 transition-opacity"
          >
            ›
          </button>
          <div className="absolute bottom-2 right-2 bg-[#0f172a]/70 text-white text-[10px] font-medium tabular-nums px-2 py-0.5 rounded-full backdrop-blur-sm">
            {current + 1}/{sources.length}
          </div>
        </>
      )}
    </div>
  )
}
