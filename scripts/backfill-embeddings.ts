/**
 * Embed every card up front, so the app doesn't have to grind through the
 * library in a web worker the first time you open it.
 *
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Idempotent: cards whose text hash already matches are skipped.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline, env } from '@xenova/transformers'
import { cardText, textHash } from '../src/core/search/card-text.ts'
import type { Card } from '../src/core/types/card.ts'

env.allowLocalModels = false

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CARDS_FILE = path.join(ROOT, 'data', 'cards.json')
const EMBEDDINGS_FILE = path.join(ROOT, 'data', 'embeddings.json')
const BATCH = 32

function encode(vector: Float32Array): string {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength).toString('base64')
}

const cards: Card[] = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
const stored: Record<string, { hash: string; vector: string }> = fs.existsSync(EMBEDDINGS_FILE)
  ? JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'))
  : {}

const pending = cards.filter((card) => stored[card.id]?.hash !== textHash(cardText(card)))
const live = new Set(cards.map((c) => c.id))
for (const id of Object.keys(stored)) if (!live.has(id)) delete stored[id]

console.log(`${cards.length} cards, ${pending.length} need embedding`)
if (pending.length === 0) {
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(stored))
  console.log('nothing to do')
  process.exit(0)
}

console.log('loading model…')
const extract = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })

for (let i = 0; i < pending.length; i += BATCH) {
  const batch = pending.slice(i, i + BATCH)
  const texts = batch.map(cardText)
  const output = await extract(texts, { pooling: 'mean', normalize: true })
  const dims = (output.dims as number[])[1]
  const flat = output.data as Float32Array

  batch.forEach((card, n) => {
    stored[card.id] = {
      hash: textHash(texts[n]),
      vector: encode(flat.slice(n * dims, (n + 1) * dims)),
    }
  })

  // Written each batch so an interrupted run keeps its progress.
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(stored))
  process.stdout.write(`\r  ${Math.min(i + BATCH, pending.length)}/${pending.length}`)
}

console.log(`\ndone — ${Object.keys(stored).length} vectors in ${EMBEDDINGS_FILE}`)
