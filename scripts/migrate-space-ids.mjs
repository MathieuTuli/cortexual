#!/usr/bin/env node
/**
 * Card.spaceId (one space) -> Card.spaceIds (many).
 *
 * "uncategorized" stops being a space a card is filed into and becomes the
 * absence of one, so those cards migrate to an empty array.
 *
 *   node scripts/migrate-space-ids.mjs --dry-run
 *   node scripts/migrate-space-ids.mjs
 *
 * Idempotent: cards that already have spaceIds are left alone.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CARDS_FILE = path.join(ROOT, 'data', 'cards.json')
const DEFAULT_SPACE_ID = 'uncategorized'

const dryRun = process.argv.includes('--dry-run')

if (!fs.existsSync(CARDS_FILE)) {
  console.error(`No cards file at ${CARDS_FILE}`)
  process.exit(1)
}

const cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
if (!Array.isArray(cards)) {
  console.error('cards.json is not an array — refusing to touch it')
  process.exit(1)
}

let migrated = 0
let alreadyDone = 0
let toUncategorized = 0

for (const card of cards) {
  if (Array.isArray(card.spaceIds)) {
    alreadyDone++
    delete card.spaceId
    continue
  }

  const previous = card.spaceId
  card.spaceIds = !previous || previous === DEFAULT_SPACE_ID ? [] : [previous]
  if (card.spaceIds.length === 0) toUncategorized++
  delete card.spaceId
  migrated++
}

console.log(`cards:            ${cards.length}`)
console.log(`migrated:         ${migrated}`)
console.log(`already migrated: ${alreadyDone}`)
console.log(`-> uncategorized: ${toUncategorized}`)

const missing = cards.filter((c) => !Array.isArray(c.spaceIds))
if (missing.length > 0) {
  console.error(`${missing.length} cards still have no spaceIds — aborting`)
  process.exit(1)
}

if (dryRun) {
  console.log('\ndry run — nothing written')
  process.exit(0)
}

// Write to a sibling temp file and rename, so a crash mid-write can't leave a
// truncated cards.json behind.
const tmp = `${CARDS_FILE}.migrating`
fs.writeFileSync(tmp, JSON.stringify(cards, null, 2))
fs.renameSync(tmp, CARDS_FILE)
console.log(`\nwrote ${CARDS_FILE}`)
