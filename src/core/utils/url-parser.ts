import type { EmbedType } from '../types'

interface ParsedUrl {
  embedType: EmbedType
  embedId?: string
}

export function parseUrl(url: string): ParsedUrl {
  try {
    const urlObj = new URL(url)

    // YouTube
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId: string | undefined

      if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1)
      } else {
        videoId = urlObj.searchParams.get('v') || undefined
      }

      return { embedType: 'youtube', embedId: videoId }
    }

    // Twitter/X
    if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
      const match = urlObj.pathname.match(/\/status\/(\d+)/)
      return { embedType: 'twitter', embedId: match?.[1] }
    }

    return { embedType: 'generic' }
  } catch {
    return { embedType: 'generic' }
  }
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function getFavicon(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`
  } catch {
    return ''
  }
}

/** Last-resort label for a link with no title of its own. */
export function describeUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace(/^www\./, '')
    if (host === 'x.com' || host === 'twitter.com') {
      const handle = pathname.split('/').filter(Boolean)[0]
      if (handle) return `@${handle}`
    }
    const path = pathname.replace(/\/$/, '')
    return path ? `${host}${path}` : host
  } catch {
    return url
  }
}
