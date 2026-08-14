#!/usr/bin/env node
/**
 * Canvases belong to projects. Spaces never should have had one, so any
 * "space:*" or "all" key in layouts.json addresses a canvas that no longer
 * exists and can never be reopened.
 *
 *   node scripts/drop-space-layouts.mjs --dry-run
 *   node scripts/drop-space-layouts.mjs
 *
 * Reports what it removes rather than deleting quietly — a key with positions
 * in it is arranging somebody did.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LAYOUTS_FILE = path.join(ROOT, 'data', 'layouts.json')
const SPACES_FILE = path.join(ROOT, 'data', 'spaces.json')

const dryRun = process.argv.includes('--dry-run')

if (!fs.existsSync(LAYOUTS_FILE)) {
  console.error(`No layouts file at ${LAYOUTS_FILE}`)
  process.exit(1)
}

const layouts = JSON.parse(fs.readFileSync(LAYOUTS_FILE, 'utf-8'))
const spaces = fs.existsSync(SPACES_FILE) ? JSON.parse(fs.readFileSync(SPACES_FILE, 'utf-8')) : []
const spaceName = (id) => spaces.find((s) => s.id === id)?.name ?? '(deleted space)'

const kept = {}
const dropped = []

for (const [key, positions] of Object.entries(layouts)) {
  if (key.startsWith('project:')) {
    kept[key] = positions
    continue
  }
  dropped.push({
    key,
    positions: Object.keys(positions).length,
    label: key === 'all' || key === '__all__' ? 'All cards' : spaceName(key.replace(/^space:/, '')),
  })
}

if (dropped.length === 0) {
  console.log('nothing to drop — every layout already belongs to a project')
  process.exit(0)
}

for (const { key, positions, label } of dropped) {
  console.log(`drop ${key.padEnd(30)} ${String(positions).padStart(3)} positions  ${label}`)
}
console.log(`\nkeeping ${Object.keys(kept).length} project canvas(es)`)

if (dryRun) {
  console.log('dry run — nothing written')
  process.exit(0)
}

const tmp = `${LAYOUTS_FILE}.migrating`
fs.writeFileSync(tmp, JSON.stringify(kept, null, 2))
fs.renameSync(tmp, LAYOUTS_FILE)
console.log(`wrote ${LAYOUTS_FILE}`)
