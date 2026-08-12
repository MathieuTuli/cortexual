/**
 * Describe image cards that arrived with no words of their own, using
 * Moondream2. Fixes two things at once: cards that render as "Untitled", and
 * cards the text index has nothing to say about.
 *
 *   npx tsx scripts/caption-images.ts [--limit N] [--force]
 *
 * Stop the server first — this writes cards.json directly.
 *
 * Roughly 6s an image on CPU, so a few hundred is a coffee. Progress is saved
 * as it goes; re-running picks up where it stopped.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  AutoProcessor,
  AutoTokenizer,
  Moondream1ForConditionalGeneration,
  RawImage,
} from '@huggingface/transformers'
import { CARDS_FILE, MEDIA_DIR } from '../server/storage.ts'

const MODEL = 'Xenova/moondream2'
const PROMPT = 'Describe this image in one short sentence.'

/**
 * v4 merges vision features by replacing each image-token position, so the
 * placeholder is repeated to match the encoder's patch count. The model card's
 * single <image> is written for v3 and fails here.
 */
const IMAGE_TOKENS = 729

const STILL = /\.(jpg|jpeg|png|webp|gif)$/i

interface Card {
  id: string
  type: string
  title?: string
  caption?: string
  autoCaption?: string
  tags: string[]
  deletedAt: string | null
}

const args = process.argv.slice(2)
const force = args.includes('--force')
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity

function firstImage(cardId: string): string | null {
  const dir = path.join(MEDIA_DIR, cardId)
  if (!fs.existsSync(dir)) return null
  const name = fs.readdirSync(dir).sort().find((f) => STILL.test(f))
  return name ? path.join(dir, name) : null
}

/**
 * Cards with no words of their own. Tags don't count: they're a handful of
 * shared labels like "art", which make a poor caption and give the text index
 * almost nothing to distinguish one card from another.
 */
function needsCaption(card: Card): boolean {
  if (card.type !== 'image' || card.deletedAt) return false
  if (!force && card.autoCaption) return false
  return !card.title && !card.caption
}

const cards: Card[] = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
const eligible = cards
  .filter(needsCaption)
  .map((card) => ({ card, file: firstImage(card.id) }))
  .filter((e): e is { card: Card; file: string } => Boolean(e.file))

const pending = eligible.slice(0, limit)

const totalImages = cards.filter((c) => c.type === 'image' && !c.deletedAt).length
console.log(`${totalImages} image cards, ${eligible.length} with no words of their own`)
if (pending.length < eligible.length) {
  console.log(`  --limit ${limit}: captioning ${pending.length} of them this run`)
}
if (pending.length === 0) process.exit(0)

console.log('loading Moondream2 (first run downloads ~1.5GB)…')
const processor = await AutoProcessor.from_pretrained(MODEL)
const tokenizer = await AutoTokenizer.from_pretrained(MODEL)
const model = await Moondream1ForConditionalGeneration.from_pretrained(MODEL, {
  dtype: { embed_tokens: 'fp32', vision_encoder: 'q8', decoder_model_merged: 'q4' },
})

const textInputs = tokenizer(
  `${'<image>'.repeat(IMAGE_TOKENS)}\n\nQuestion: ${PROMPT}\n\nAnswer:`
)

function tidy(raw: string): string {
  const answer = raw.split('Answer:').pop()?.trim() ?? ''
  // Moondream sometimes opens with a stock preamble; the subject is the point.
  return answer
    .replace(/^(the image (shows|depicts|features|is)|this image (shows|depicts|features|is))\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

let done = 0
let failed = 0
const started = Date.now()

for (const { card, file } of pending) {
  try {
    const image = await RawImage.read(file)
    const visionInputs = await processor(image)
    const output = await model.generate({
      ...textInputs,
      ...visionInputs,
      do_sample: false,
      max_new_tokens: 40,
    })
    const caption = tidy(tokenizer.batch_decode(output, { skip_special_tokens: true })[0])
    if (caption) {
      cards.find((c) => c.id === card.id)!.autoCaption = caption
    }
  } catch (error) {
    failed++
    console.warn(`\n  skipped ${card.id}: ${(error as Error).message}`)
  }

  done++
  if (done % 5 === 0 || done === pending.length) {
    const tmp = `${CARDS_FILE}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(cards, null, 2))
    fs.renameSync(tmp, CARDS_FILE)

    const rate = (Date.now() - started) / done / 1000
    const left = Math.round(((pending.length - done) * rate) / 60)
    process.stdout.write(`\r  ${done}/${pending.length}  ~${left}m left   `)
  }
}

console.log(`\ndone${failed ? `, ${failed} skipped` : ''}`)
console.log('now re-run: npx tsx scripts/backfill-embeddings.ts')
