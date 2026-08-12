import { describe, it, expect } from 'vitest'
import { similarity, encodeVector, decodeVector, topK } from './vector'

const unit = (...values: number[]) => {
  const v = new Float32Array(values)
  const norm = Math.hypot(...values)
  return v.map((x) => x / norm) as Float32Array
}

describe('similarity', () => {
  it('scores an identical vector at 1', () => {
    const v = unit(1, 2, 3)
    expect(similarity(v, v)).toBeCloseTo(1, 5)
  })

  it('scores orthogonal vectors at 0', () => {
    expect(similarity(unit(1, 0), unit(0, 1))).toBeCloseTo(0, 5)
  })

  it('scores opposite vectors at -1', () => {
    expect(similarity(unit(1, 0), unit(-1, 0))).toBeCloseTo(-1, 5)
  })

  it('ranks a closer vector higher', () => {
    const query = unit(1, 0)
    expect(similarity(query, unit(1, 0.2))).toBeGreaterThan(similarity(query, unit(1, 2)))
  })

  it('returns 0 on a length mismatch rather than throwing', () => {
    expect(similarity(new Float32Array([1, 0]), new Float32Array([1, 0, 0]))).toBe(0)
  })

  it('returns 0 for empty vectors', () => {
    expect(similarity(new Float32Array(), new Float32Array())).toBe(0)
  })
})

describe('vector encoding', () => {
  it('round trips exactly', () => {
    const v = new Float32Array([0.1, -0.5, 1, 0, 12345.75])
    expect(Array.from(decodeVector(encodeVector(v)))).toEqual(Array.from(v))
  })

  it('round trips a realistic 384-dim vector', () => {
    const v = new Float32Array(384)
    for (let i = 0; i < v.length; i++) v[i] = Math.sin(i) / 20
    const back = decodeVector(encodeVector(v))
    expect(back.length).toBe(384)
    expect(similarity(v, back)).toBeCloseTo(similarity(v, v), 6)
  })

  it('encodes more compactly than JSON numbers', () => {
    const v = new Float32Array(384).fill(0.123456)
    expect(encodeVector(v).length).toBeLessThan(JSON.stringify(Array.from(v)).length)
  })

  it('round trips an empty vector', () => {
    expect(decodeVector(encodeVector(new Float32Array())).length).toBe(0)
  })
})

describe('topK', () => {
  const scored = [
    { item: 'a', score: 0.9 },
    { item: 'b', score: 0.1 },
    { item: 'c', score: 0.5 },
    { item: 'd', score: 0.7 },
  ]

  it('returns the highest scores first', () => {
    expect(topK(scored, 4).map((s) => s.item)).toEqual(['a', 'd', 'c', 'b'])
  })

  it('caps the result at k', () => {
    expect(topK(scored, 2).map((s) => s.item)).toEqual(['a', 'd'])
  })

  it('drops anything at or below the floor', () => {
    expect(topK(scored, 10, 0.6).map((s) => s.item)).toEqual(['a', 'd'])
  })

  it('returns empty when everything is below the floor', () => {
    expect(topK(scored, 10, 0.99)).toEqual([])
  })

  it('handles an empty input', () => {
    expect(topK([], 5)).toEqual([])
  })
})
