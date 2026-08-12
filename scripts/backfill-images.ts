/**
 * Embed every image card with MobileCLIP, so pictures with no title, caption
 * or tags become findable by describing them.
 *
 *   npx tsx scripts/backfill-images.ts
 *
 * Idempotent: a card is re-embedded only when its media file changes, keyed on
 * filename plus size.
 */
import fs from 'node:fs'
import path from 'node:path'
import { CARDS_FILE, IMAGE_EMBEDDINGS_FILE, MEDIA_DIR } from '../server/storage.ts'
import { embedImageFile, encodeVector } from '../server/embeddings.ts'

interface Card {
  id: string
  type: string
  deletedAt: string | null
}

const STILL = /\.(jpg|jpeg|png|webp|gif)$/i

/** Videos have no still on disk to embed; only image cards qualify. */
function firstImage(cardId: string): { file: string; hash: string } | null {
  const dir = path.join(MEDIA_DIR, cardId)
  if (!fs.existsSync(dir)) return null

  const name = fs.readdirSync(dir).sort().find((f) => STILL.test(f))
  if (!name) return null

  const file = path.join(dir, name)
  return { file, hash: `${name}-${fs.statSync(file).size}` }
}

const cards: Card[] = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
const stored: Record<string, { hash: string; vector: string }> = fs.existsSync(IMAGE_EMBEDDINGS_FILE)
  ? JSON.parse(fs.readFileSync(IMAGE_EMBEDDINGS_FILE, 'utf-8'))
  : {}

const candidates = cards
  .filter((c) => !c.deletedAt && c.type === 'image')
  .map((card) => ({ card, media: firstImage(card.id) }))
  .filter((entry): entry is { card: Card; media: { file: string; hash: string } } =>
    Boolean(entry.media)
  )

const pending = candidates.filter(({ card, media }) => stored[card.id]?.hash !== media.hash)

const live = new Set(candidates.map((c) => c.card.id))
for (const id of Object.keys(stored)) if (!live.has(id)) delete stored[id]

console.log(`${candidates.length} image cards with media, ${pending.length} need embedding`)
if (pending.length === 0) {
  fs.writeFileSync(IMAGE_EMBEDDINGS_FILE, JSON.stringify(stored))
  console.log('nothing to do')
  process.exit(0)
}

console.log('loading MobileCLIP…')
let done = 0
let failed = 0

for (const { card, media } of pending) {
  try {
    stored[card.id] = { hash: media.hash, vector: encodeVector(await embedImageFile(media.file)) }
  } catch (error) {
    // A single unreadable or truncated file shouldn't end the run.
    failed++
    console.warn(`\n  skipped ${card.id}: ${(error as Error).message}`)
  }
  done++
  if (done % 10 === 0 || done === pending.length) {
    fs.writeFileSync(IMAGE_EMBEDDINGS_FILE, JSON.stringify(stored))
    process.stdout.write(`\r  ${done}/${pending.length}`)
  }
}

console.log(
  `\ndone — ${Object.keys(stored).length} image vectors` + (failed ? `, ${failed} skipped` : '')
)
