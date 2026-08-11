import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Card } from '../types'
import { enqueue } from './fetch-queue'

const mediaUrlsByCard = new Map<string, Promise<string[] | null>>()

function loadFirstMediaUrl(cardId: string): Promise<string[] | null> {
  let urls = mediaUrlsByCard.get(cardId)
  if (!urls) {
    urls = enqueue(() => api.getMediaUrls(cardId))
    mediaUrlsByCard.set(cardId, urls)
  }
  return urls
}

/** First visual for a card: its stored thumbnail, else its first media file. */
export function useCardThumbnail(card: Card): string | undefined {
  const stored =
    card.type === 'image' ? card.thumbnailDataUrls?.[0]
    : card.type === 'video' ? card.thumbnailDataUrl
    : undefined

  const [fetched, setFetched] = useState<string>()
  const needsFetch = !stored && (card.type === 'image' || card.type === 'video')

  useEffect(() => {
    if (!needsFetch) return
    let cancelled = false
    loadFirstMediaUrl(card.id).then((urls) => {
      if (!cancelled) setFetched(urls?.[0])
    })
    return () => {
      cancelled = true
    }
  }, [needsFetch, card.id])

  return stored || fetched
}
