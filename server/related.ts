import { CARDS_FILE, EMBEDDINGS_FILE, readJson } from './storage.ts'

const MODEL = 'Xenova/all-MiniLM-L6-v2'

type Extractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>

let extractor: Promise<Extractor> | null = null

/**
 * The model is ~25MB and several seconds to load, so it stays unloaded until
 * something asks for it — which for most sessions is never.
 */
function getExtractor(): Promise<Extractor> {
  if (!extractor) {
    extractor = import('@xenova/transformers').then(async ({ pipeline, env }) => {
      env.allowLocalModels = false
      return (await pipeline('feature-extraction', MODEL, {
        quantized: true,
      })) as unknown as Extractor
    })
  }
  return extractor
}

function decode(base64: string): Float32Array {
  const buffer = Buffer.from(base64, 'base64')
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
}

function dot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let total = 0
  for (let i = 0; i < a.length; i++) total += a[i] * b[i]
  return total
}

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

  const extract = await getExtractor()
  const output = await extract([trimmed], { pooling: 'mean', normalize: true })
  const query = output.data.slice(0, output.dims[1])

  const cards = readJson<CardRow[]>(CARDS_FILE, [])
  const byId = new Map(cards.map((card) => [card.id, card]))

  return Object.entries(stored)
    .map(([id, entry]) => ({ id, score: dot(query, decode(entry.vector)) }))
    .filter((hit) => hit.score > 0.3 && byId.has(hit.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => {
      const card = byId.get(hit.id)!
      return { id: hit.id, label: label(card), url: card.url, score: hit.score }
    })
}
