import { CARDS_FILE, EMBEDDINGS_FILE, readJson } from './storage.ts'
import { decodeVector, dot, embedQuery } from './embeddings.ts'


interface CardRow {
  id: string
  type: string
  title?: string
  url?: string
  text?: string
  content?: string
  preview?: { title?: string }
}

function label(card: CardRow): string {
  return (
    card.title ||
    card.preview?.title ||
    (card.text || card.content || '').split('\n')[0].slice(0, 80) ||
    card.url ||
    'Untitled'
  )
}

export interface RelatedHit {
  id: string
  label: string
  url?: string
  score: number
}

export async function findRelated(text: string, limit = 4): Promise<RelatedHit[]> {
  const trimmed = text.trim()
  if (!trimmed) return []

  const stored = readJson<Record<string, { vector: string }>>(EMBEDDINGS_FILE, {})
  if (Object.keys(stored).length === 0) return []

  const query = await embedQuery(trimmed)

  const cards = readJson<CardRow[]>(CARDS_FILE, [])
  const byId = new Map(cards.map((card) => [card.id, card]))

  return Object.entries(stored)
    .map(([id, entry]) => ({ id, score: dot(query, decodeVector(entry.vector)) }))
    .filter((hit) => hit.score > 0.3 && byId.has(hit.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => {
      const card = byId.get(hit.id)!
      return { id: hit.id, label: label(card), url: card.url, score: hit.score }
    })
}
