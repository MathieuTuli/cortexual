import {
  CARDS_FILE,
  EMBEDDINGS_FILE,
  IMAGE_EMBEDDINGS_FILE,
  VIDEO_EMBEDDINGS_FILE,
  readJson,
} from './storage.ts'
import { decodeVector, dot, embedQuery, embedQueryForImages } from './embeddings.ts'

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
  const videoIndex = readJson<Record<string, { vectors: string[] }>>(VIDEO_EMBEDDINGS_FILE, {})
  if (![textIndex, imageIndex, videoIndex].some((i) => Object.keys(i).length)) return []

  const live = new Set(readJson<Array<{ id: string }>>(CARDS_FILE, []).map((c) => c.id))

  const [textQuery, imageQuery] = await Promise.all([
    Object.keys(textIndex).length ? embedQuery(trimmed) : null,
    Object.keys(imageIndex).length || Object.keys(videoIndex).length
      ? embedQueryForImages(trimmed)
      : null,
  ])

  // Only the strongest slice of each index is fused; past that the tail is
  // noise and would dilute the other index's good hits.
  const HEAD = 40
  const textScores = textQuery ? scoreAgainst(textIndex, textQuery) : []
  // Scored on its best few frames, not its single best. Max over N samples
  // rises with N for free, so a 10-frame clip beats a 1-frame image on luck
  // alone — which is exactly what happened when frames went 5 to 10 and videos
  // took over every result. Averaging the top few keeps a single strongly
  // matching shot meaningful without paying a bonus for length.
  const TOP_FRAMES = 3
  const videoScores = imageQuery
    ? Object.entries(videoIndex).map(([id, entry]) => {
        const best = entry.vectors
          .map((v) => dot(imageQuery, decodeVector(v)))
          .sort((a, b) => b - a)
          .slice(0, TOP_FRAMES)
        return { id, score: best.reduce((sum, x) => sum + x, 0) / best.length }
      })
    : []

  const imageScores = imageQuery
    ? [...scoreAgainst(imageIndex, imageQuery), ...videoScores]
    : []

  const textRanks = rank(textScores.filter((s) => s.score > 0.25))

  // The visual side needs a quality floor as well as a cap. Taking a fixed
  // slice meant 40 cards entered the fusion however badly they matched, and a
  // card ranked mediocre in both lists then beat one ranked first in a single
  // list. The floor is relative because CLIP scores have no absolute meaning:
  // a strong text-to-image match sits near 0.1, so a fixed threshold would be
  // either everything or nothing depending on the query.
  // Relative alone isn't enough: when nothing in the library matches, 60% of a
  // bad best is still bad, and the least-wrong twenty march in anyway. The
  // absolute floor is what lets a query legitimately return nothing visual.
  // 0.05 sits between measured unrelated pairs (about 0.00) and real matches
  // (about 0.10) — CLIP scores are compressed because it trains with a learned
  // logit scale.
  const bestImage = Math.max(0, ...imageScores.map((s) => s.score))
  const imageFloor = Math.max(0.05, bestImage * 0.6)
  const imageRanks = rank(
    imageScores
      .filter((s) => s.score > imageFloor)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
  )

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
