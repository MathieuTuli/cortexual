import { fetchTweet } from './content.ts'

export interface PostMedia {
  url: string
  kind: 'image' | 'video'
}

export interface PostMediaResult {
  source: 'x' | 'instagram' | 'page'
  text?: string
  author?: string
  media: PostMedia[]
}

/** Highest-bitrate MP4 variant, so a saved clip isn't the 320p one. */
function bestVideo(variants: Array<{ url: string; content_type?: string; bitrate?: number }>) {
  return variants
    .filter((v) => v.content_type === 'video/mp4' || v.url.includes('.mp4'))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]?.url
}

/**
 * X's syndication endpoint returns the media for a tweet without auth, which
 * is the same source the embed uses. Photos come as a list; videos and GIFs
 * arrive under different keys depending on the tweet.
 */
async function fromTweet(tweetId: string): Promise<PostMediaResult | null> {
  const tweet = (await fetchTweet(tweetId))?.data as any
  if (!tweet) return null

  const media: PostMedia[] = []

  for (const photo of tweet.photos ?? []) {
    // ?name=orig gets the full-resolution original rather than the timeline crop.
    if (photo.url) media.push({ url: `${photo.url}?name=orig`, kind: 'image' })
  }

  const video = tweet.video ?? tweet.mediaDetails?.find((m: any) => m.video_info)
  const variants = video?.variants ?? video?.video_info?.variants
  if (variants) {
    const best = bestVideo(variants)
    if (best) media.push({ url: best, kind: 'video' })
  }

  // A tweet with only a video still carries a poster image worth nothing extra,
  // so it isn't added separately.
  return {
    source: 'x',
    text: tweet.text,
    author: tweet.user?.name || tweet.user?.screen_name,
    media,
  }
}

function metaContent(html: string, property: string): string | undefined {
  const tag = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, 'i')
  )?.[0]
  return tag?.match(/content=["']([^"']*)["']/i)?.[1]
}

/**
 * Instagram has no public API and blocks most scraping, so this only reaches
 * what the page exposes to link unfurlers: the og: tags, which carry one image
 * and no carousel. A multi-image post yields its cover only. Documented rather
 * than worked around — the alternatives are login sessions or breaking terms.
 */
async function fromInstagram(url: string): Promise<PostMediaResult | null> {
  const { fetch: undiciFetch } = await import('undici')
  const res = await undiciFetch(url, {
    headers: { 'User-Agent': 'facebookexternalhit/1.1', Accept: 'text/html' },
    redirect: 'follow',
  })
  if (!res.ok) return null

  const html = await res.text()
  const image = metaContent(html, 'og:image')
  const video = metaContent(html, 'og:video')

  const media: PostMedia[] = []
  if (video) media.push({ url: decodeURI(video), kind: 'video' })
  else if (image) media.push({ url: decodeURI(image), kind: 'image' })

  return {
    source: 'instagram',
    text: metaContent(html, 'og:description'),
    author: metaContent(html, 'og:title'),
    media,
  }
}

/** Any other page: its og:image, which is usually the hero. */
async function fromPage(url: string): Promise<PostMediaResult | null> {
  const { fetch: undiciFetch } = await import('undici')
  const res = await undiciFetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CortexualBot/1.0)', Accept: 'text/html' },
    redirect: 'follow',
  })
  if (!res.ok) return null

  const html = await res.text()
  const image = metaContent(html, 'og:image')
  return {
    source: 'page',
    text: metaContent(html, 'og:description'),
    media: image ? [{ url: new URL(image, url).toString(), kind: 'image' }] : [],
  }
}

export async function extractPostMedia(url: string): Promise<PostMediaResult | null> {
  const { hostname, pathname } = new URL(url)

  if (hostname.endsWith('x.com') || hostname.endsWith('twitter.com')) {
    const tweetId = pathname.match(/\/status\/(\d+)/)?.[1]
    if (tweetId) return fromTweet(tweetId)
  }

  if (hostname.endsWith('instagram.com')) return fromInstagram(url)

  return fromPage(url)
}
