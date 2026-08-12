/**
 * Cosine similarity of two vectors the model has already L2-normalised, which
 * makes this a plain dot product. Returns 0 on a length mismatch rather than
 * throwing, so one stale vector can't take down a whole search.
 */
export function similarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

/** 384 floats per card as JSON numbers is ~8x the bytes of base64. */
export function encodeVector(vector: Float32Array): string {
  const bytes = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function decodeVector(encoded: string): Float32Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

export interface Scored<T> {
  item: T
  score: number
}

/** Top-k by score, descending, dropping anything under `floor`. */
export function topK<T>(scored: Scored<T>[], k: number, floor = 0): Scored<T>[] {
  return scored
    .filter((s) => s.score > floor)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}
