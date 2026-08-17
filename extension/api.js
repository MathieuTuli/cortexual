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

export async function getProjects() {
  const res = await fetch(`${API}/projects`)
  if (!res.ok) throw new Error(`projects: ${res.status}`)
  // Archived projects are finished work; nothing new gets filed into one.
  return (await res.json()).filter((p) => !p.deletedAt && p.status === 'active')
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
    // Required on every card, and leaving it off was not harmless:
    // cardIsInProject() reads .includes() straight off it, so a single card
    // saved from here was enough to throw the whole Projects page.
    projectIds: [],
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

/**
 * Saves immediately with what the tab already knows, then asks the server to
 * fill in author, site and excerpt in the background. Article extraction is a
 * fetch plus a full DOM parse — several seconds — and waiting for it made
 * every save feel broken.
 */
export async function saveLink({ url, title, spaceIds = [], tags = [] }) {
  const { embedType, embedData } = embedFor(url)

  const card = await createCard(
    baseCard({
      id: id('ext-link'),
      type: 'link',
      url,
      sourceUrl: url,
      title: title || undefined,
      embedType,
      embedData,
      spaceIds,
      tags,
    })
  )

  // Deliberately not awaited.
  fetch(`${API}/cards/${card.id}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).catch(() => {})

  return card
}

export async function saveHighlight({
  text,
  url,
  title,
  author,
  siteName,
  spaceIds = [],
  projectIds = [],
  tags = [],
}) {
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
      projectIds,
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

export async function getPostMedia(url) {
  try {
    const res = await fetch(`${API}/post-media?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(20000),
    })
    return res.ok ? await res.json() : { media: [] }
  } catch {
    return { media: [] }
  }
}

async function attachMedia(cardId, item) {
  // Downloaded through the worker so the card keeps the file rather than a
  // hotlink that rots when the post comes down.
  const blob = await (await fetch(item.url)).blob()
  await fetch(`${API}/media/${cardId}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || (item.kind === 'video' ? 'video/mp4' : 'image/jpeg') },
    body: blob,
  })
}

/**
 * Turn a post's media into cards. `mode: 'single'` puts every image in one
 * gallery card, which suits a carousel; `'separate'` gives each its own card.
 * Videos always get their own card either way — a video card holds one file.
 */
export async function savePostMedia({ url, title, found, mode = 'single', spaceIds = [], tags = [] }) {
  const images = found.media.filter((m) => m.kind === 'image')
  const videos = found.media.filter((m) => m.kind === 'video')
  const shared = {
    sourceUrl: url,
    author: found.author,
    siteName: found.source === 'x' ? 'X' : found.source === 'instagram' ? 'Instagram' : undefined,
    spaceIds,
    tags,
  }
  const caption = found.text?.slice(0, 300) || undefined
  const created = []

  const groups = mode === 'single' && images.length > 0 ? [images] : images.map((i) => [i])
  for (const group of groups) {
    const card = baseCard({
      ...shared,
      id: id('ext-media'),
      type: 'image',
      mediaIds: [],
      title: title || undefined,
      caption,
    })
    await createCard(card)
    for (const item of group) await attachMedia(card.id, item)
    created.push(card)
  }

  for (const video of videos) {
    const card = baseCard({
      ...shared,
      id: id('ext-media'),
      type: 'video',
      mediaId: '',
      title: title || undefined,
      caption,
    })
    await createCard(card)
    await attachMedia(card.id, video)
    created.push(card)
  }

  return created
}
