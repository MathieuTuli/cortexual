import { useEffect, useState } from 'react'
import { api } from '../api'
import { useCardsStore } from '../stores'
import type { LinkCard } from '../types'
import { describeUrl, getFavicon, getHostname } from '../utils'
import { enqueue } from './fetch-queue'

interface TweetSummary {
  text: string
  author?: string
}

const previewRequested = new Set<string>()
const tweetSummaries = new Map<string, Promise<TweetSummary | null>>()

function loadTweetSummary(tweetId: string): Promise<TweetSummary | null> {
  let summary = tweetSummaries.get(tweetId)
  if (!summary) {
    summary = enqueue(async () => {
      const data = (await api.getTweet(tweetId))?.data
      const text = data?.text?.trim()
      if (!text) return null
      return { text, author: data?.user?.name || (data?.user?.screen_name && `@${data.user.screen_name}`) }
    })
    tweetSummaries.set(tweetId, summary)
  }
  return summary
}

interface ResolvedLink {
  title: string
  subtitle: string
  hostname: string
  favicon: string
}

/**
 * Resolves a human-readable title for a link card, fetching one if the card
 * doesn't carry it yet. Scraped Open Graph metadata is written back to the card
 * (it's useful everywhere); tweet text is kept in memory (the embed already
 * shows it on the grid).
 */
export function useLinkPreview(card: LinkCard): ResolvedLink {
  const updateCard = useCardsStore((s) => s.updateCard)
  const [tweet, setTweet] = useState<TweetSummary | null>(null)

  const knownTitle = card.title || card.preview?.title
  const tweetId = card.embedType === 'twitter' ? (card.embedData?.tweetId as string | undefined) : undefined

  useEffect(() => {
    if (knownTitle || !tweetId) return
    let cancelled = false
    loadTweetSummary(tweetId).then((summary) => {
      if (!cancelled) setTweet(summary)
    })
    return () => {
      cancelled = true
    }
  }, [knownTitle, tweetId])

  useEffect(() => {
    if (tweetId || card.preview?.title) return
    if (previewRequested.has(card.id)) return
    previewRequested.add(card.id)

    enqueue(() => api.getLinkPreview(card.url)).then((preview) => {
      if (!preview || !(preview.title || preview.description || preview.image)) return
      return updateCard(card.id, { preview: { ...card.preview, ...preview } } as Partial<LinkCard>)
    })
  }, [card.id, card.url, card.preview, tweetId, updateCard])

  const hostname = getHostname(card.url)

  return {
    title: knownTitle || tweet?.text || describeUrl(card.url),
    subtitle: tweet?.author || card.preview?.siteName || hostname,
    hostname,
    favicon: getFavicon(card.url),
  }
}
