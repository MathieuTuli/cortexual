import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { timeAgo } from './time-ago'

const NOW = new Date('2026-06-15T12:00:00.000Z')

/** An ISO timestamp `ms` before the frozen clock. */
function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString()
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads under a minute as "just now"', () => {
    expect(timeAgo(ago(0))).toBe('just now')
    expect(timeAgo(ago(59 * SECOND))).toBe('just now')
  })

  it('switches to minutes at exactly one minute', () => {
    expect(timeAgo(ago(MINUTE))).toBe('1m ago')
    expect(timeAgo(ago(59 * MINUTE))).toBe('59m ago')
  })

  it('switches to hours at exactly one hour', () => {
    expect(timeAgo(ago(HOUR))).toBe('1h ago')
    expect(timeAgo(ago(23 * HOUR))).toBe('23h ago')
  })

  it('switches to days at exactly one day', () => {
    expect(timeAgo(ago(DAY))).toBe('1d ago')
    expect(timeAgo(ago(6 * DAY))).toBe('6d ago')
  })

  it('switches to weeks at exactly one week', () => {
    expect(timeAgo(ago(WEEK))).toBe('1w ago')
    expect(timeAgo(ago(4 * WEEK))).toBe('4w ago')
  })

  it('falls back to an absolute date past five weeks', () => {
    const out = timeAgo(ago(5 * WEEK))
    expect(out).not.toMatch(/ago$/)
    expect(out).not.toBe('just now')
  })

  it('clamps future timestamps to "just now" rather than going negative', () => {
    expect(timeAgo(new Date(NOW.getTime() + DAY).toISOString())).toBe('just now')
  })
})
