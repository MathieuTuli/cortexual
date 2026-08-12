import { CARDS_FILE, EMBEDDINGS_FILE, IMAGE_EMBEDDINGS_FILE, readJson } from './storage.ts'
import { decodeVector, dot, embedQueryForImages, embedText } from './embeddings.ts'

interface Stored {
  [cardId: string]: { hash: string; vector: string }
}

/**
 * Reciprocal rank fusion. The two indexes aren't on a comparable scale — a
 * sentence encoder puts related text around 0.5-0.7, while CLIP text-to-image
 * cosines sit near 0.1 by construction, since the model is trained with a
 * learned logit scale and only the ordering carries meaning. Comparing the
 * numbers directly would bury every image; fusing positions doesn't.
 */
const RRF_K = 60

function rank(scores: Array<{ id: string; score: number }>): Map<string, number> {
  const ordered = [...scores].sort((a, b) => b.score - a.score)
  return new Map(ordered.map((entry, index) => [entry.id, index]))
}

function scoreAgainst(index: Stored, query: Float32Array): Array<{ id: string; score: number }> {
  return Object.entries(index).map(([id, entry]) => ({
    id,
    score: dot(query, decodeVector(entry.vector)),
  }))
}

export interface SearchHit {
  id: string
  /** Which index surfaced it — useful for explaining a result. */
  via: 'text' | 'image' | 'both'
  score: number
}

export async function searchCards(query: string, limit = 60): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const textIndex = readJson<Stored>(EMBEDDINGS_FILE, {})
  const imageIndex = readJson<Stored>(IMAGE_EMBEDDINGS_FILE, {})
  if (!Object.keys(textIndex).length && !Object.keys(imageIndex).length) return []

  const live = new Set(readJson<Array<{ id: string }>>(CARDS_FILE, []).map((c) => c.id))

  const [textQuery, imageQuery] = await Promise.all([
    Object.keys(textIndex).length ? embedText([trimmed]).then((v) => v[0]) : null,
    Object.keys(imageIndex).length ? embedQueryForImages(trimmed) : null,
  ])

  // Only the strongest slice of each index is fused; past that the tail is
  // noise and would dilute the other index's good hits.
  const HEAD = 40
  const textScores = textQuery ? scoreAgainst(textIndex, textQuery) : []
  const imageScores = imageQuery ? scoreAgainst(imageIndex, imageQuery) : []

  const textRanks = rank(textScores.filter((s) => s.score > 0.25))
  const imageRanks = rank(imageScores.sort((a, b) => b.score - a.score).slice(0, HEAD))

  const fused = new Map<string, { score: number; text: boolean; image: boolean }>()
  for (const [id, position] of textRanks) {
    if (position >= HEAD || !live.has(id)) continue
    fused.set(id, { score: 1 / (RRF_K + position), text: true, image: false })
  }
  for (const [id, position] of imageRanks) {
    if (!live.has(id)) continue
    const existing = fused.get(id)
    const contribution = 1 / (RRF_K + position)
    if (existing) {
      existing.score += contribution
      existing.image = true
    } else {
      fused.set(id, { score: contribution, text: false, image: true })
    }
  }

  return Array.from(fused.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([id, entry]) => ({
      id,
      via: entry.text && entry.image ? 'both' : entry.text ? 'text' : 'image',
      score: entry.score,
    }))
}
