#!/usr/bin/env node
/**
 * Generates src/star-ripple.css — the circle-to-star morph for icon buttons.
 *
 * This is model M4 from scripts/star-lab.html. Two things are going on.
 *
 * A k-lobed star is a single Fourier mode, u = C(t) cos(k0 - phi(t)). Standing
 * means phi is pinned while C swings through zero; travelling means C is fixed
 * while phi rotates. Running two waves of the SAME wavenumber at DIFFERENT rates
 * gives both at once: every point on the rim swings the whole way from crest to
 * trough, and the pattern travels while it does. That is the core. On its own it
 * is flawlessly even, because one wavenumber cannot be anything but a perfect
 * k-pointed star.
 *
 * On top sits a single distant flanker at k-4, at a fraction of the amplitude.
 * It desynchronises the flip — at the instant the core passes through flat, the
 * flanker is what is still standing, so the star never blanks — and it makes the
 * points distinguishable enough that the travel is visible as travel rather than
 * averaging into a spin.
 *
 * Every wavenumber here is odd, which is what makes opposite ends of the rim
 * exact opposites: cos(k(0+pi)) is -cos(k0) for odd k. An even point count breaks
 * that, and the checker will say so.
 *
 * A single travelling wave, r = R(1 + A cos(k0 - wt)), is worth naming as the
 * thing to never ship: it is *identically* a rigid rotation of the star, not
 * approximately, so it can only ever read as a spinning shape.
 *
 *   node scripts/gen-star-ripple.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CENTRE, controlPoints, outline as sample, round, toPath } from './star-geometry.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src', 'star-ripple.css')

const RADIUS = 42

/* --- the lab's sliders, as shipped values ------------------------------- */
const POINTS = 11
const DEPTH = 0.11
const INVERT = 0.4
const TRAVEL = 3
const MIX = 0.8
const LOOP = '1.5s'
/* ------------------------------------------------------------------------ */

const FLANKER_OFFSET = -4
const FLANKER_CYCLES = -2

const GAP = 1 - INVERT
const SHARE = Math.min(0.45, MIX / 3)

/** Wavenumber, amplitude and signed cycles-per-loop for each component. */
const WAVES = [
  { k: POINTS, amp: (1 - SHARE) * ((1 + GAP) / 2), cycles: TRAVEL + 1 },
  { k: POINTS, amp: (1 - SHARE) * ((1 - GAP) / 2), cycles: TRAVEL - 1 },
  { k: Math.max(1, POINTS + FLANKER_OFFSET), amp: SHARE, cycles: FLANKER_CYCLES },
].filter(({ amp }) => amp > 1e-6)

/**
 * Both counts are derived rather than chosen. Samples: six per period of the
 * highest wavenumber, so the spline through them does not clip the points.
 * Frames: seven per oscillation of the fastest component, because CSS
 * interpolates d linearly between keyframes and a sine sampled that often is
 * within a fraction of a pixel of the real thing.
 */
const SAMPLES = Math.max(48, Math.ceil((Math.max(...WAVES.map((w) => w.k)) * 6) / 2) * 2)
const FRAMES = Math.max(12, Math.ceil(Math.max(...WAVES.map((w) => Math.abs(w.cycles))) * 7))
const BLOOM = '0.18s'

function radius(theta, t) {
  const wave = WAVES.reduce(
    (sum, { k, amp, cycles }) => sum + amp * Math.cos(k * theta - 2 * Math.PI * cycles * t),
    0
  )
  return RADIUS * (1 + DEPTH * wave)
}

const outline = (t, samples = SAMPLES) =>
  sample((theta) => (t === null ? RADIUS : radius(theta, t)), samples)

const shape = (t) => `path("${toPath(outline(t))}")`

/**
 * The emitted path is a spline through rounded samples, not the curve itself.
 * Worth knowing by how much they differ before shipping it.
 */
function splineError(t) {
  const points = outline(t)
  const start = points[0].map(round)
  const segments = controlPoints(points)
  let worst = 0

  segments.forEach(([c1, c2, p], i) => {
    const p0 = i === 0 ? start : segments[i - 1][2]
    for (let s = 1; s < 8; s++) {
      const u = s / 8
      const v = 1 - u
      const x = v ** 3 * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u ** 3 * p[0]
      const y = v ** 3 * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u ** 3 * p[1]
      const dx = x - CENTRE
      const dy = y - CENTRE
      worst = Math.max(worst, Math.abs(Math.hypot(dx, dy) - radius(Math.atan2(dy, dx), t)))
    }
  })

  return worst
}

function depthAt(t) {
  const rs = Array.from({ length: 360 }, (_, j) => radius((j / 360) * 2 * Math.PI, t))
  return Math.max(...rs) - Math.min(...rs)
}

/**
 * Where in the loop to begin. Hovering snaps straight to the first keyframe —
 * there is no run-up, because a bloom would have to animate d and the ripple
 * already owns it, and delaying the ripple to make room reads as a lag before
 * anything moves. Starting at the loop's shallowest moment instead makes that
 * snap as small as the shape allows, and costs nothing: the cycle is closed, so
 * every point in it is an equally valid place to enter.
 */
const START = Array.from({ length: FRAMES * 8 }, (_, i) => i / (FRAMES * 8)).reduce(
  (best, t) => (depthAt(t) < depthAt(best) ? t : best),
  0
)

const frames = Array.from({ length: FRAMES + 1 }, (_, i) => {
  const pct = round((i / FRAMES) * 100)
  return `  ${pct}% {\n    d: ${shape((START + (i % FRAMES) / FRAMES) % 1)};\n  }`
}).join('\n')

const css = `/* Generated by scripts/gen-star-ripple.mjs — do not edit by hand. */

.star-btn__shape path {
  d: ${shape(null)};
  fill: var(--star-bg, var(--chip));
  transition:
    fill 0.12s ease,
    d ${BLOOM} cubic-bezier(0.2, 0.8, 0.3, 1);
}

.star-btn:hover:not(:disabled) .star-btn__shape path {
  fill: var(--star-bg-hover, var(--sunken));
}

/*
 * No delay: the ripple has to be moving the instant the pointer lands, so it
 * starts on its own first keyframe. The transition above still runs on the way
 * out, where a soft settle back to the circle costs nothing.
 */
@media (prefers-reduced-motion: no-preference) {
  .star-btn:hover:not(:disabled) .star-btn__shape path {
    animation: star-ripple var(--star-speed, ${LOOP}) linear infinite;
  }
}

@keyframes star-ripple {
${frames}
}
`

fs.writeFileSync(OUT, css)

const errors = Array.from({ length: FRAMES }, (_, i) => splineError(i / FRAMES))
const worst = Math.max(...errors)
console.log(
  `wrote ${OUT}\n` +
    `  M4 · points ${POINTS} · depth ${DEPTH} · invert ${INVERT} · travel ${TRAVEL} · mix ${MIX} · loop ${LOOP}\n` +
    `  waves ${WAVES.map((w) => `k${w.k}@${w.cycles}`).join(' ')}\n` +
    `  ${(css.length / 1024).toFixed(1)}kB, ${FRAMES} frames, ${SAMPLES} samples\n` +
    `  spline error ${worst.toFixed(3)} of ${RADIUS} units (${((worst / RADIUS) * 100).toFixed(2)}%)\n` +
    `  enters at t=${START.toFixed(3)}, the loop's shallowest frame: hover snaps to ` +
    `${depthAt(START).toFixed(2)} of ${RADIUS} units deep, not ` +
    `${Math.max(...Array.from({ length: 360 }, (_, i) => depthAt(i / 360))).toFixed(2)}`
)
