import { useEffect, useRef } from 'react'
import type { LinkCard } from '@/core/types'
import { useCardsStore } from '@/core/stores'
import { api } from '@/core/api'
import { YouTubeEmbed } from '../embeds/YouTubeEmbed'
import { TwitterEmbed } from '../embeds/TwitterEmbed'

interface CardLinkProps {
  card: LinkCard
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const inflightBackfills = new Set<string>()

export function CardLink({ card }: CardLinkProps) {
  const updateCard = useCardsStore((s) => s.updateCard)
  const backfillTriedRef = useRef(false)

  useEffect(() => {
    if (backfillTriedRef.current) return
    if (card.embedType !== 'generic') return
    if (card.preview) return
    if (inflightBackfills.has(card.id)) return

    backfillTriedRef.current = true
    inflightBackfills.add(card.id)

    let cancelled = false
    api
      .getLinkPreview(card.url)
      .then((preview) => {
        if (cancelled) return
        if (preview && (preview.title || preview.description || preview.image)) {
          return updateCard(card.id, { preview } as Partial<LinkCard>)
        }
      })
      .catch(() => {})
      .finally(() => {
        inflightBackfills.delete(card.id)
      })

    return () => {
      cancelled = true
    }
  }, [card.id, card.embedType, card.preview, card.url, updateCard])

  if (card.embedType === 'youtube' && card.embedData?.videoId) {
    return <YouTubeEmbed videoId={card.embedData.videoId as string} />
  }

  if (card.embedType === 'twitter' && card.embedData?.tweetId) {
    return <TwitterEmbed tweetId={card.embedData.tweetId as string} />
  }

  const host = getHostname(card.url)
  const title = card.preview?.title || card.title
  const hasPreview = Boolean(card.preview?.image || title || card.preview?.description)

  if (!hasPreview) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gradient-to-b from-[#e8f4fc] to-white rounded border border-[#a8d4f0]">
        <span className="text-base">🔗</span>
        <p className="text-xs text-accent-primary truncate">{host}</p>
      </div>
    )
  }

  return (
    <div className="block overflow-hidden rounded border border-[#a8d4f0] bg-white">
      {card.preview?.image && (
        <img
          src={card.preview.image}
          alt={title || 'Link preview'}
          className="w-full aspect-video object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div className="p-2 space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-accent-secondary font-semibold truncate">
          🔗 {card.preview?.siteName || host}
        </p>
        {title && (
          <p className="text-sm font-medium text-text leading-snug line-clamp-2">
            {title}
          </p>
        )}
        {card.preview?.description && (
          <p className="text-xs text-text-muted line-clamp-2 leading-snug">
            {card.preview.description}
          </p>
        )}
      </div>
    </div>
  )
}
