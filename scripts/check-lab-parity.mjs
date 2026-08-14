#!/usr/bin/env node
/**
 * Diffs the shipped generator against the lab model it claims to implement.
 *
 * The lab is where the shape was chosen, so "what ships is what was picked" has
 * to be checked against the lab's own code rather than a retyped copy of it.
 * This loads star-lab.html, pulls the live model out of the page, and compares
 * its rim against the generator's at a dense grid of angles and times.
 *
 *   node scripts/check-lab-parity.mjs M4
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WANTED = process.argv[2] ?? 'M4'

const gen = fs.readFileSync(path.join(ROOT, 'scripts', 'gen-star-ripple.mjs'), 'utf8')
const value = (name) => {
  const hit = gen.match(new RegExp(`^const ${name} = ([-\\d.']+)`, 'm'))
  if (!hit) throw new Error(`no ${name} in the generator`)
  return Number(hit[1].replace(/'/g, '').replace('s', ''))
}

const settings = {
  points: value('POINTS'),
  amp: value('DEPTH'),
  invert: value('INVERT'),
  travel: value('TRAVEL'),
  mix: value('MIX'),
  wraps: 2,
  sway: 0,
}

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'scripts', 'star-lab.html'), 'utf8'), {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
})
await new Promise((r) => setTimeout(r, 400))

const model = dom.window.STAR_MODELS.find((m) => m.id === WANTED)
if (!model) throw new Error(`no model ${WANTED} in the lab`)

// The generator's own wave table, re-derived here from its constants.
const share = Math.min(0.45, settings.mix / 3)
const gap = 1 - settings.invert
const waves = [
  { k: settings.points, amp: (1 - share) * ((1 + gap) / 2), cycles: settings.travel + 1 },
  { k: settings.points, amp: (1 - share) * ((1 - gap) / 2), cycles: settings.travel - 1 },
  { k: Math.max(1, settings.points - 4), amp: share, cycles: -2 },
]
const shipped = (s, t) =>
  waves.reduce((sum, w) => sum + w.amp * Math.cos(w.k * s - 2 * Math.PI * w.cycles * t), 0)

let worst = 0
let at = null
for (let ti = 0; ti < 240; ti++) {
  const t = ti / 240
  for (let si = 0; si < 720; si++) {
    const s = (si / 720) * Math.PI * 2
    const [radial, tangential] = model.f(s, t, settings.points, settings)
    if (Math.abs(tangential) > 1e-9) throw new Error(`${WANTED} uses sway; the generator cannot`)
    const diff = Math.abs(radial - shipped(s, t))
    if (diff > worst) {
      worst = diff
      at = { t: t.toFixed(3), deg: ((si / 720) * 360).toFixed(1) }
    }
  }
}

const units = worst * settings.amp * 42
console.log(
  `lab ${WANTED} vs generator, ${Object.entries(settings)
    .filter(([k]) => ['points', 'amp', 'invert', 'travel', 'mix'].includes(k))
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')}\n` +
    `  worst rim difference ${worst.toExponential(2)} of the unit wave` +
    ` = ${units.toExponential(2)} of 42 units, at t=${at.t} ${at.deg}deg`
)

dom.window.close()
if (worst > 1e-9) {
  console.error('MISMATCH: the generator does not implement this model')
  process.exit(1)
}
console.log('  identical')
process.exit(0)
