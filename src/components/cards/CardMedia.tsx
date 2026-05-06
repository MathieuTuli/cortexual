import { useEffect, useState } from 'react'
import type { ImageCard, VideoCard } from '@/core/types'
import { api } from '@/core/api'

interface CardMediaProps {
  card: ImageCard | VideoCard
}

export function CardMedia({ card }: CardMediaProps) {
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadMedia() {
      try {
        const urls = await api.getMediaUrls(card.id)
        if (!cancelled) {
          setMediaUrls(urls)
          if (urls.length === 0) {
            setLoadError(true)
          }
        }
      } catch (error) {
        console.error('Failed to load media:', error)
        if (!cancelled) setLoadError(true)
      }
    }

    loadMedia()

    return () => {
      cancelled = true
    }
  }, [card.id])

  // For video cards
  if (card.type === 'video') {
    const src = mediaUrls[0] || card.thumbnailDataUrl

    if (!src && !loadError) {
      return (
        <div className="aspect-video bg-gradient-to-b from-[#e0ecf4] to-[#f8fcff] flex items-center justify-center border border-[#a8d4f0] rounded">
          <span className="text-text-muted text-sm">Loading...</span>
        </div>
      )
    }

    if (!src && loadError) {
      return (
        <div className="aspect-video bg-gradient-to-b from-[#e0ecf4] to-[#f8fcff] flex items-center justify-center border border-[#a8d4f0] rounded">
          <span className="text-text-muted text-sm">[video]</span>
        </div>
      )
    }

    return (
      <div className="relative rounded overflow-hidden">
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
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-gradient-to-b from-[#66ccff] to-[#0066cc] text-white px-3 py-1 text-sm rounded shadow-y2k">
            ▶ Play
          </span>
        </div>
        {card.caption && (
          <p className="mt-2 text-xs text-text-muted">{card.caption}</p>
        )}
      </div>
    )
  }

  // For image cards
  const thumbnails = card.thumbnailDataUrls || []
  const sources = mediaUrls.length > 0 ? mediaUrls : thumbnails
  const totalImages = Math.max(mediaUrls.length, thumbnails.length)

  if (sources.length === 0 && !loadError) {
    return (
      <div className="aspect-video bg-gradient-to-b from-[#e0ecf4] to-[#f8fcff] flex items-center justify-center border border-[#a8d4f0] rounded">
        <span className="text-text-muted text-sm">Loading...</span>
      </div>
    )
  }

  if (sources.length === 0 && loadError) {
    return (
      <div className="aspect-video bg-gradient-to-b from-[#e0ecf4] to-[#f8fcff] flex items-center justify-center border border-[#a8d4f0] rounded">
        <span className="text-text-muted text-sm">[image]</span>
      </div>
    )
  }

  return (
    <div className="rounded overflow-hidden">
      <div className="relative">
        <img
          src={sources[0]}
          alt={card.caption || 'Image'}
          className="w-full object-cover"
        />
        {totalImages > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            +{totalImages - 1} more
          </div>
        )}
      </div>
      {card.caption && (
        <p className="mt-2 text-xs text-text-muted">{card.caption}</p>
      )}
    </div>
  )
}
