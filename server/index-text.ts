import { CARDS_FILE, EMBEDDINGS_FILE, readJson } from './storage.ts'
import { embedDocuments, encodeVector } from './embeddings.ts'
import fs from 'node:fs'

const BATCH = 16

interface Card {
  id: string
  type: string
  title?: string
  content?: string
  text?: string
  note?: string
  caption?: string
  autoCaption?: string
  author?: string
  siteName?: string
  url?: string
  preview?: { title?: string; description?: string; siteName?: string }
  tags: string[]
  subnotes: Array<{ content: string }>
  deletedAt: string | null
}

/**
 * Mirrors src/core/search/card-text.ts. Duplicated rather than imported across
 * the app/server boundary: the client copy is what a browser bundle sees, and
 * the two are small enough that a shared package would cost more than it saves.
 * If one changes, change both — the hash makes a mismatch show up as a full
 * re-index rather than as silent drift.
 */
function cardText(card: Card): string {
  const parts: string[] = []
  if (card.title) parts.push(card.title)

  switch (card.type) {
    case 'note':
      if (card.content) parts.push(card.content)
      break
    case 'highlight':
      if (card.text) parts.push(card.text)
      if (card.note) parts.push(card.note)
      break
    case 'link':
      if (card.preview?.title) parts.push(card.preview.title)
      if (card.preview?.description) parts.push(card.preview.description)
      if (card.preview?.siteName) parts.push(card.preview.siteName)
      break
    case 'image':
    case 'video':
      if (card.caption) parts.push(card.caption)
      break
  }

  if (card.autoCaption) parts.push(card.autoCaption)
  if (card.author) parts.push(card.author)
  if (card.siteName) parts.push(card.siteName)
  for (const subnote of card.subnotes ?? []) parts.push(subnote.content)

  // Tags ride along once there's something to attach them to, but they can't
  // be the whole document. Nine cards here indexed to the single word
  // "reference", scored identically, and flooded any query that landed near
  // it — a bare tag isn't a description, it's a label shared with other cards.
  const substantive = parts.join('\n').trim()
  if (!substantive) return ''
  if (card.tags?.length) parts.push(card.tags.join(' '))

  return parts.join('\n').trim()
}

/** FNV-1a, matching the client. Only needs to change when the text does. */
function textHash(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36) + text.length.toString(36)
}

export interface IndexResult {
  total: number
  embedded: number
  removed: number
}

/**
 * Bring the text index in line with the cards. Runs server-side so there is
 * exactly one model deciding what a vector means — when the browser did this
 * too, changing the model silently mixed 384- and 768-dimension vectors in one
 * index, and a dimension mismatch scores as zero rather than erroring.
 */
export async function syncTextIndex(): Promise<IndexResult> {
  const cards = readJson<Card[]>(CARDS_FILE, []).filter((c) => !c.deletedAt)
  const stored = readJson<Record<string, { hash: string; vector: string }>>(EMBEDDINGS_FILE, {})

  const live = new Set(cards.map((c) => c.id))
  let removed = 0
  for (const id of Object.keys(stored)) {
    if (!live.has(id)) {
      delete stored[id]
      removed++
    }
  }

  const withText = cards.map((card) => ({ card, text: cardText(card) }))

  // A card with nothing to say embeds to the prompt prefix alone. Those
  // vectors sit close to each other and to arbitrary queries, so they surface
  // as answers to everything. Left out of the text index — a picture with no
  // words is found through its picture.
  for (const { card, text } of withText) {
    if (!text && stored[card.id]) {
      delete stored[card.id]
      removed++
    }
  }

  const stale = withText
    .filter(({ text }) => text.length > 0)
    .filter(({ card, text }) => stored[card.id]?.hash !== textHash(text))

  for (let i = 0; i < stale.length; i += BATCH) {
    const batch = stale.slice(i, i + BATCH)
    const vectors = await embedDocuments(batch.map((b) => b.text))
    batch.forEach(({ card, text }, n) => {
      stored[card.id] = { hash: textHash(text), vector: encodeVector(vectors[n]) }
    })
  }

  if (stale.length > 0 || removed > 0) {
    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(stored))
  }

  return { total: cards.length, embedded: stale.length, removed }
}
