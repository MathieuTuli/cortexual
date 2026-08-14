#!/usr/bin/env node
/**
 * Two changes that have to land together, because projects introduce a second
 * kind of thing that owns a canvas:
 *
 *   1. Card.projectIds — every card gains an empty array.
 *   2. layouts.json keys — bare space ids become "space:<id>", and the
 *      all-cards pseudo-key "__all__" becomes "all", so a project id can never
 *      collide with a space id in the same map.
 *
 *   node scripts/migrate-projects.mjs --dry-run
 *   node scripts/migrate-projects.mjs
 *
 * Idempotent: already-migrated cards and already-namespaced keys are left alone.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CARDS_FILE = path.join(ROOT, 'data', 'cards.json')
const LAYOUTS_FILE = path.join(ROOT, 'data', 'layouts.json')

const dryRun = process.argv.includes('--dry-run')

function readJson(file, expected) {
  if (!fs.existsSync(file)) {
    console.error(`missing ${file}`)
    process.exit(1)
  }
  const value = JSON.parse(fs.readFileSync(file, 'utf-8'))
  if (expected === 'array' ? !Array.isArray(value) : Array.isArray(value)) {
    console.error(`${path.basename(file)} is not ${expected === 'array' ? 'an array' : 'an object'} — refusing to touch it`)
    process.exit(1)
  }
  return value
}

function writeAtomic(file, value) {
  const tmp = `${file}.migrating`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
  fs.renameSync(tmp, file)
  console.log(`wrote ${file}`)
}

// ------------------------------------------------------------------- cards

const cards = readJson(CARDS_FILE, 'array')

let cardsMigrated = 0
let cardsAlreadyDone = 0

for (const card of cards) {
  if (Array.isArray(card.projectIds)) {
    cardsAlreadyDone++
    continue
  }
  card.projectIds = []
  cardsMigrated++
}

const missing = cards.filter((c) => !Array.isArray(c.projectIds))
if (missing.length > 0) {
  console.error(`${missing.length} cards still have no projectIds — aborting`)
  process.exit(1)
}

// ----------------------------------------------------------------- layouts

const layouts = readJson(LAYOUTS_FILE, 'object')

const NAMESPACED = /^(space|project):/
let keysMigrated = 0
let keysAlreadyDone = 0
const nextLayouts = {}

for (const [key, positions] of Object.entries(layouts)) {
  let nextKey
  if (key === '__all__' || key === 'all') {
    nextKey = 'all'
  } else if (NAMESPACED.test(key)) {
    nextKey = key
  } else {
    nextKey = `space:${key}`
  }

  if (nextKey === key) keysAlreadyDone++
  else keysMigrated++

  if (nextLayouts[nextKey]) {
    console.error(`key collision on "${nextKey}" — aborting rather than merging layouts`)
    process.exit(1)
  }
  nextLayouts[nextKey] = positions
}

console.log(`cards:              ${cards.length}`)
console.log(`  + projectIds:     ${cardsMigrated}`)
console.log(`  already migrated: ${cardsAlreadyDone}`)
console.log(`layout keys:        ${Object.keys(layouts).length}`)
console.log(`  renamed:          ${keysMigrated}`)
console.log(`  already migrated: ${keysAlreadyDone}`)

if (dryRun) {
  console.log('\ndry run — nothing written')
  process.exit(0)
}

writeAtomic(CARDS_FILE, cards)
writeAtomic(LAYOUTS_FILE, nextLayouts)
