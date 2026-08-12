import type { Card } from '../types'

/**
 * The text an embedding should represent for a card. Each type keeps something
 * different in a different field, and a link card's own fields are often empty
 * — its meaning lives in the fetched preview.
 */
export function cardText(card: Card): string {
  const parts: string[] = []

  if (card.title) parts.push(card.title)

  switch (card.type) {
    case 'note':
      parts.push(card.content)
      break
    case 'highlight':
      parts.push(card.text)
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
  if (card.tags.length) parts.push(card.tags.join(' '))
  for (const subnote of card.subnotes) parts.push(subnote.content)

  return parts.join('\n').trim()
}

/**
 * Cheap content fingerprint, used to decide whether a card needs re-embedding.
 * FNV-1a — not cryptographic, just needs to change when the text does.
 */
export function textHash(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36) + text.length.toString(36)
}
