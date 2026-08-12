/**
 * Make videos searchable by sampling frames and embedding each with MobileCLIP.
 *
 *   npx tsx scripts/backfill-video.ts [--frames N]
 *
 * A video isn't one picture, so one vector would describe it badly — a clip
 * that opens on a title card and cuts to a city street is neither. Each frame
 * is embedded separately and a query scores the video by its best-matching
 * frame, which is also what makes "the bit with the neon sign" findable.
 *
 * Needs ffmpeg on PATH.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { CARDS_FILE, MEDIA_DIR, VIDEO_EMBEDDINGS_FILE } from '../server/storage.ts'
import { embedImageFile, encodeVector } from '../server/embeddings.ts'

const MOVIE = /\.(mp4|webm|mov|m4v)$/i

const args = process.argv.slice(2)
const framesArg = args.indexOf('--frames')
const FRAMES = framesArg >= 0 ? Number(args[framesArg + 1]) : 5

interface Card {
  id: string
  type: string
  deletedAt: string | null
}

function videoFile(cardId: string): { file: string; hash: string } | null {
  const dir = path.join(MEDIA_DIR, cardId)
  if (!fs.existsSync(dir)) return null
  const name = fs.readdirSync(dir).sort().find((f) => MOVIE.test(f))
  if (!name) return null
  const file = path.join(dir, name)
  return { file, hash: `${name}-${fs.statSync(file).size}-f${FRAMES}` }
}

function duration(file: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]).toString().trim()
  const seconds = Number(out)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
}

/** Evenly spaced stills, skipping the very start and end — often black. */
function extractFrames(file: string, into: string): string[] {
  const length = duration(file)
  const written: string[] = []

  for (let i = 0; i < FRAMES; i++) {
    const at = length > 0 ? (length * (i + 0.5)) / FRAMES : i
    const out = path.join(into, `frame-${i}.jpg`)
    try {
      execFileSync('ffmpeg', [
        '-loglevel', 'error',
        '-ss', at.toFixed(2),
        '-i', file,
        '-frames:v', '1',
        '-q:v', '4',
        '-y', out,
      ])
      if (fs.existsSync(out) && fs.statSync(out).size > 0) written.push(out)
    } catch {
      // A seek past the end of a truncated file just yields no frame.
    }
  }
  return written
}

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
} catch {
  console.error('ffmpeg not found on PATH — install it and re-run')
  process.exit(1)
}

const cards: Card[] = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
const stored: Record<string, { hash: string; vectors: string[] }> = fs.existsSync(
  VIDEO_EMBEDDINGS_FILE
)
  ? JSON.parse(fs.readFileSync(VIDEO_EMBEDDINGS_FILE, 'utf-8'))
  : {}

const candidates = cards
  .filter((c) => !c.deletedAt && c.type === 'video')
  .map((card) => ({ card, media: videoFile(card.id) }))
  .filter((e): e is { card: Card; media: { file: string; hash: string } } => Boolean(e.media))

const pending = candidates.filter(({ card, media }) => stored[card.id]?.hash !== media.hash)

const live = new Set(candidates.map((c) => c.card.id))
for (const id of Object.keys(stored)) if (!live.has(id)) delete stored[id]

console.log(`${candidates.length} video cards, ${pending.length} need frames`)
if (pending.length === 0) {
  fs.writeFileSync(VIDEO_EMBEDDINGS_FILE, JSON.stringify(stored))
  process.exit(0)
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cortexual-frames-'))
let done = 0
let failed = 0

for (const { card, media } of pending) {
  try {
    const frames = extractFrames(media.file, scratch)
    if (frames.length === 0) throw new Error('no frames extracted')

    const vectors: string[] = []
    for (const frame of frames) {
      vectors.push(encodeVector(await embedImageFile(frame)))
      fs.rmSync(frame, { force: true })
    }
    stored[card.id] = { hash: media.hash, vectors }
  } catch (error) {
    failed++
    console.warn(`\n  skipped ${card.id}: ${(error as Error).message}`)
  }

  done++
  fs.writeFileSync(VIDEO_EMBEDDINGS_FILE, JSON.stringify(stored))
  process.stdout.write(`\r  ${done}/${pending.length}`)
}

fs.rmSync(scratch, { recursive: true, force: true })
const frameCount = Object.values(stored).reduce((n, v) => n + v.vectors.length, 0)
console.log(`\ndone — ${Object.keys(stored).length} videos, ${frameCount} frames${failed ? `, ${failed} skipped` : ''}`)
