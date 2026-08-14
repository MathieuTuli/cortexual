#!/usr/bin/env node
/**
 * Generates public/favicon.svg — the same eleven-pointed star as the icon
 * buttons, from the same geometry, so the tab and the app are one mark.
 *
 * Deeper than the buttons on purpose. Their 0.11 is a rim that undulates; at
 * 16 CSS pixels that reads as a slightly lumpy circle, because eleven lobes get
 * about four pixels of circumference each. At 0.18 it reads as a starburst,
 * which is all a favicon has to communicate. Eight points would be crisper
 * still, but eleven is the mark.
 *
 *   node scripts/gen-favicon.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { outline, toPath } from './star-geometry.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'favicon.svg')
const TOKENS = path.join(ROOT, 'src', 'index.css')

/** Read from the stylesheet rather than repeated here, so the two cannot drift. */
function accent() {
  const css = fs.readFileSync(TOKENS, 'utf8')
  const hit = css.match(/--accent:\s*(#[0-9a-f]{6})/i)
  if (!hit) throw new Error(`no --accent in ${TOKENS}`)
  return hit[1]
}

const POINTS = 11
const DEPTH = 0.18
const REACH = 48
const SAMPLES = POINTS * 6

/** Sized so the points land on REACH, leaving the rest as bleed margin. */
const BASE = REACH / (1 + DEPTH)

const d = toPath(outline((theta) => BASE * (1 + DEPTH * Math.cos(POINTS * theta)), SAMPLES))

/*
 * The accent flat, at every scheme. A lighter fill on a dark tab strip would
 * carry further — this blue is nearly black against one — but it stops being
 * the accent, and the mark matters more than the contrast.
 */
const fill = accent()
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="${d}" fill="${fill}"/>
</svg>
`

fs.writeFileSync(OUT, svg)
console.log(
  `wrote ${OUT} (${svg.length} bytes, ${POINTS} points, depth ${DEPTH}, ` +
    `reach ${REACH}/100, fill ${fill} from --accent)`
)
