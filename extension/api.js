// The library runs on loopback with no auth, so there is no pairing step —
// if the daemon is up, the extension can talk to it.
export const API = 'http://127.0.0.1:3001/api'

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export async function isUp() {
  try {
    const res = await fetch(`${API}/spaces`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

export async function getSpaces() {
  const res = await fetch(`${API}/spaces`)
  if (!res.ok) throw new Error(`spaces: ${res.status}`)
  return (await res.json()).filter((s) => !s.deletedAt && s.id !== 'uncategorized')
}

export async function getArticle(url) {
  try {
    const res = await fetch(`${API}/article?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(20000),
    })
    return res.ok ? await res.json() : {}
  } catch {
    // Extraction is a nicety; never let it stop the save.
    return {}
  }
}

export async function getRelated(text, limit = 4) {
  try {
    const res = await fetch(`${API}/related`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, limit }),
      signal: AbortSignal.timeout(30000),
    })
    return res.ok ? (await res.json()).related || [] : []
  } catch {
    return []
  }
}

async function createCard(card) {
  const res = await fetch(`${API}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  })
  if (!res.ok) throw new Error(`create: ${res.status}`)
  return card
}

function baseCard(extra) {
  const now = new Date().toISOString()
  return {
    spaceIds: [],
    tags: [],
    subnotes: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...extra,
  }
}

function embedFor(url) {
  try {
    const { hostname, pathname } = new URL(url)
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      const videoId = hostname.includes('youtu.be')
        ? pathname.slice(1)
        : new URL(url).searchParams.get('v')
      return videoId ? { embedType: 'youtube', embedData: { videoId } } : { embedType: 'youtube' }
    }
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      const tweetId = pathname.match(/\/status\/(\d+)/)?.[1]
      return tweetId ? { embedType: 'twitter', embedData: { tweetId } } : { embedType: 'twitter' }
    }
  } catch {
    // Fall through to generic.
  }
  return { embedType: 'generic' }
}

export async function saveLink({ url, title, spaceIds = [], tags = [] }) {
  const article = await getArticle(url)
  const { embedType, embedData } = embedFor(url)

  return createCard(
    baseCard({
      id: id('ext-link'),
      type: 'link',
      url,
      sourceUrl: url,
      title: title || article.title || undefined,
      author: article.author,
      siteName: article.siteName,
      embedType,
      embedData,
      preview:
        article.title || article.excerpt || article.image
          ? {
              title: article.title,
              description: article.excerpt,
              image: article.image,
              siteName: article.siteName,
            }
          : undefined,
      spaceIds,
      tags,
    })
  )
}

export async function saveHighlight({ text, url, title, author, siteName, spaceIds = [], tags = [] }) {
  return createCard(
    baseCard({
      id: id('ext-hl'),
      type: 'highlight',
      text,
      title: title || undefined,
      author: author || undefined,
      sourceUrl: url,
      siteName: siteName || undefined,
      spaceIds,
      tags,
    })
  )
}

export async function saveImage({ imageUrl, pageUrl, title, spaceIds = [], tags = [] }) {
  const card = baseCard({
    id: id('ext-img'),
    type: 'image',
    mediaIds: [],
    title: title || undefined,
    sourceUrl: pageUrl,
    caption: undefined,
    spaceIds,
    tags,
  })
  await createCard(card)

  // Fetched here in the worker rather than referenced by URL, so the card
  // survives the page taking the image down.
  const blob = await (await fetch(imageUrl)).blob()
  await fetch(`${API}/media/${card.id}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  })

  return card
}
