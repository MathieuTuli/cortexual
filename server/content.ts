import { ProxyAgent, fetch as undiciFetch, setGlobalDispatcher } from 'undici'
import { fetchTweet } from 'react-tweet/api'

const PROXY_URL =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy
if (PROXY_URL) {
  setGlobalDispatcher(new ProxyAgent(PROXY_URL))
}

export { fetchTweet }

interface LinkPreview {
  title?: string
  description?: string
  image?: string
  siteName?: string
}

// X's syndication API omits empty entity arrays, but react-tweet's enrichTweet
// iterates them unconditionally and throws "entities is not iterable".
export function normalizeTweet(tweet: any): any {
  if (!tweet || typeof tweet !== 'object') return tweet
  const e = tweet.entities ?? {}
  tweet.entities = {
    ...e,
    hashtags: Array.isArray(e.hashtags) ? e.hashtags : [],
    user_mentions: Array.isArray(e.user_mentions) ? e.user_mentions : [],
    urls: Array.isArray(e.urls) ? e.urls : [],
    symbols: Array.isArray(e.symbols) ? e.symbols : [],
  }
  if (tweet.quoted_tweet) tweet.quoted_tweet = normalizeTweet(tweet.quoted_tweet)
  return tweet
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function pickMeta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`,
      'i',
    )
    const tag = html.match(re)?.[0]
    if (!tag) continue
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1]
    if (content) return decodeEntities(content)
  }
  return undefined
}

// YouTube serves a consent/JS shell to bots, so its watch pages carry no
// scrapable og:title. oEmbed hands it over without auth.
async function fetchYouTubeOEmbed(url: string): Promise<LinkPreview | null> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  const res = await undiciFetch(endpoint, { redirect: 'follow' })
  if (!res.ok) return null
  const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
  if (!data.title) return null
  return {
    title: data.title,
    description: data.author_name,
    image: data.thumbnail_url,
    siteName: 'YouTube',
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const hostname = new URL(url).hostname.replace(/^www\./, '')
  if (hostname === 'youtube.com' || hostname === 'youtu.be' || hostname === 'm.youtube.com') {
    const oembed = await fetchYouTubeOEmbed(url).catch(() => null)
    if (oembed) return oembed
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await undiciFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CortexualBot/1.0; +https://cortexual.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      return {}
    }
    const html = (await res.text()).slice(0, 500_000)

    const title =
      pickMeta(html, ['og:title', 'twitter:title']) ||
      decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '') ||
      undefined
    const description = pickMeta(html, [
      'og:description',
      'twitter:description',
      'description',
    ])
    let image = pickMeta(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'])
    const siteName = pickMeta(html, ['og:site_name', 'application-name']) ||
      new URL(url).hostname.replace(/^www\./, '')

    if (image) {
      try {
        image = new URL(image, url).toString()
      } catch {
        image = undefined
      }
    }

    return { title, description, image, siteName }
  } finally {
    clearTimeout(timeout)
  }
}
interface Article extends LinkPreview {
  author?: string
  publishedAt?: string
  excerpt?: string
  text?: string
  wordCount?: number
}

function pickJsonLdAuthor(html: string): string | undefined {
  // Readability's byline is often missing on blog platforms that put the
  // author only in structured data.
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(block[1].trim())
      for (const node of Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])]) {
        const author = node?.author
        if (!author) continue
        const name = Array.isArray(author) ? author[0]?.name : author.name || author
        if (typeof name === 'string' && name.trim()) return name.trim()
      }
    } catch {
      // A malformed ld+json block is common and not worth failing over.
    }
  }
  return undefined
}

function cleanByline(byline: string | null | undefined): string | undefined {
  if (!byline) return undefined
  const cleaned = byline.replace(/^\s*(by|written by)\s+/i, '').trim()
  return cleaned.length > 0 && cleaned.length <= 120 ? cleaned : undefined
}

/**
 * Full-article extraction, as opposed to fetchLinkPreview's OG-tag scrape.
 * Substack and most blogs are ordinary enough that Readability handles them;
 * this deliberately has no per-site special cases until one proves necessary.
 */
export async function fetchArticle(url: string): Promise<Article> {
  const preview = await fetchLinkPreview(url).catch(() => ({}) as LinkPreview)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await undiciFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CortexualBot/1.0; +https://cortexual.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!(res.headers.get('content-type') || '').includes('text/html')) return preview

    const html = await res.text()
    const { JSDOM } = await import('jsdom')
    const { Readability } = await import('@mozilla/readability')

    const dom = new JSDOM(html, { url })
    const parsed = new Readability(dom.window.document).parse()
    const text = parsed?.textContent?.replace(/\n{3,}/g, '\n\n').trim()

    return {
      ...preview,
      title: parsed?.title || preview.title,
      siteName: parsed?.siteName || preview.siteName,
      author: cleanByline(parsed?.byline) || pickJsonLdAuthor(html),
      publishedAt: parsed?.publishedTime || pickMeta(html, ['article:published_time']),
      excerpt: parsed?.excerpt || preview.description,
      text,
      wordCount: text ? text.split(/\s+/).length : 0,
    }
  } finally {
    clearTimeout(timeout)
  }
}
