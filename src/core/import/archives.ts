/**
 * Parsers for the data archives X and Instagram hand you. Both are pure
 * functions over file text so they can be tested without a real 2GB export.
 */

export interface ArchiveItem {
  /** Stable id derived from the source, so re-importing an archive is a no-op. */
  id: string
  url: string
  text?: string
  author?: string
  createdAt?: string
  /** Filename inside the archive's media folder, when the post has one. */
  media?: string
}

/**
 * X's export is JavaScript, not JSON: each file assigns an array to a global.
 * Strip the assignment and the trailing semicolon to get at the payload.
 */
export function unwrapXFile(source: string): unknown[] {
  const start = source.indexOf('=')
  if (start === -1) return []
  const json = source.slice(start + 1).trim().replace(/;\s*$/, '')
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function statusUrl(tweetId: string, handle?: string): string {
  return `https://x.com/${handle || 'i/web'}/status/${tweetId}`
}

/** bookmarks.js — entries carry a tweet id and little else. */
export function parseXBookmarks(source: string): ArchiveItem[] {
  const items: ArchiveItem[] = []
  for (const entry of unwrapXFile(source)) {
    const bookmark = (entry as { bookmark?: Record<string, string> })?.bookmark
    const tweetId = bookmark?.tweetId
    if (!tweetId) continue
    items.push({
      id: `x-bookmark-${tweetId}`,
      url: bookmark.expandedUrl || statusUrl(tweetId),
    })
  }
  return items
}

/** like.js — richer than bookmarks: the liked tweet's text comes along. */
export function parseXLikes(source: string): ArchiveItem[] {
  const items: ArchiveItem[] = []
  for (const entry of unwrapXFile(source)) {
    const like = (entry as { like?: Record<string, string> })?.like
    const tweetId = like?.tweetId
    if (!tweetId) continue
    items.push({
      id: `x-like-${tweetId}`,
      url: like.expandedUrl || statusUrl(tweetId),
      text: like.fullText,
    })
  }
  return items
}

interface InstagramEntry {
  title?: string
  string_map_data?: Record<string, { href?: string; timestamp?: number; value?: string }>
}

/**
 * saved_posts.json — the post URL hides in a string_map_data entry whose key
 * ("Saved on") is a display label, so match on shape rather than that key.
 */
export function parseInstagramSaved(source: string): ArchiveItem[] {
  let parsed: { saved_saved_media?: InstagramEntry[] }
  try {
    parsed = JSON.parse(source)
  } catch {
    return []
  }

  const items: ArchiveItem[] = []
  for (const entry of parsed.saved_saved_media || []) {
    const fields = Object.values(entry.string_map_data || {})
    const withHref = fields.find((f) => f?.href)
    if (!withHref?.href) continue

    const shortcode = withHref.href.match(/\/(?:p|reel|tv)\/([^/?]+)/)?.[1]
    items.push({
      id: `ig-saved-${shortcode || withHref.href}`,
      url: withHref.href,
      author: entry.title || undefined,
      createdAt: withHref.timestamp
        ? new Date(withHref.timestamp * 1000).toISOString()
        : undefined,
    })
  }
  return items
}

export type ArchiveKind = 'x' | 'instagram'

export interface DetectedArchive {
  kind: ArchiveKind
  items: ArchiveItem[]
}

/**
 * Works out which archive a set of files is and parses it. Keyed on filename
 * because both exports have stable, distinctive ones.
 */
export function parseArchive(files: Map<string, string>): DetectedArchive | null {
  const find = (name: string) => {
    for (const [path, text] of files) {
      if (path.toLowerCase().endsWith(name)) return text
    }
    return undefined
  }

  const bookmarks = find('bookmarks.js')
  const likes = find('like.js')
  if (bookmarks || likes) {
    const items = [
      ...(bookmarks ? parseXBookmarks(bookmarks) : []),
      ...(likes ? parseXLikes(likes) : []),
    ]
    // Bookmarking something you also liked shouldn't make two cards.
    const seen = new Set<string>()
    const deduped = items.filter((item) => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
    return { kind: 'x', items: deduped }
  }

  const saved = find('saved_posts.json')
  if (saved) return { kind: 'instagram', items: parseInstagramSaved(saved) }

  return null
}
