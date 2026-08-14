/**
 * The star outline, shared by the button's ripple keyframes and the favicon so
 * the two cannot drift into being different stars.
 *
 * Everything is in a 0..100 box centred at (50,50).
 */
export const CENTRE = 50

/** One decimal is under a tenth of a pixel on a 64px button. */
export const round = (n) => Math.round(n * 10) / 10

/** Samples a polar curve into points, evenly spaced in angle. */
export function outline(radiusAt, samples) {
  return Array.from({ length: samples }, (_, i) => {
    const theta = (i / samples) * Math.PI * 2
    const r = radiusAt(theta)
    return [CENTRE + r * Math.cos(theta), CENTRE + r * Math.sin(theta)]
  })
}

/** Closed Catmull-Rom through the samples, as cubic Bézier control points. */
export function controlPoints(points) {
  const n = points.length
  const at = (i) => points[(i + n) % n]

  return Array.from({ length: n }, (_, i) => {
    const [p0x, p0y] = at(i - 1)
    const [p1x, p1y] = at(i)
    const [p2x, p2y] = at(i + 1)
    const [p3x, p3y] = at(i + 2)

    return [
      [p1x + (p2x - p0x) / 6, p1y + (p2y - p0y) / 6],
      [p2x - (p3x - p1x) / 6, p2y - (p3y - p1y) / 6],
      [p2x, p2y],
    ].map(([x, y]) => [round(x), round(y)])
  })
}

export function toPath(points) {
  const start = points[0].map(round)
  const body = controlPoints(points)
    .map(([c1, c2, p]) => `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p[0]} ${p[1]}`)
    .join('')
  return `M${start[0]} ${start[1]}${body}Z`
}
