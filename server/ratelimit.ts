/*
 * A small in-memory failed-attempt throttle keyed by an arbitrary string
 * (typically client IP). After `max` failures within `window`, the key is
 * locked out for `lockout`.
 *
 * Ported from the Go original in ~/apps/mathieutuli (internal/ratelimit) so the
 * two sites throttle login the same way.
 */

type Record = {
  count: number
  windowEnd: number
  lockedUntil: number
}

export class Limiter {
  private entries = new Map<string, Record>()

  private max: number
  private window: number
  private lockout: number

  // Fields are declared and assigned explicitly rather than via constructor
  // parameter properties: those are a transform, and Node's strip-only type
  // stripping rejects them at load time even though tsc accepts them.
  constructor(max: number, window: number, lockout: number) {
    this.max = max
    this.window = window
    this.lockout = lockout
    // unref so a running janitor never holds the process open on shutdown.
    setInterval(() => this.sweep(), window + lockout).unref()
  }

  /** How long the key must wait, in ms; 0 means it may proceed. */
  retryAfter(key: string): number {
    const r = this.entries.get(key)
    if (!r) return 0
    return Math.max(0, r.lockedUntil - Date.now())
  }

  /** Records a failed attempt and locks the key once max is reached. */
  fail(key: string): void {
    const now = Date.now()
    let r = this.entries.get(key)
    if (!r || now > r.windowEnd) {
      r = { count: 0, windowEnd: now + this.window, lockedUntil: 0 }
      this.entries.set(key, r)
    }
    r.count++
    if (r.count >= this.max) {
      r.lockedUntil = now + this.lockout
      r.count = 0
      r.windowEnd = now + this.window
    }
  }

  /** Clears a key's history. Call on a successful attempt. */
  reset(key: string): void {
    this.entries.delete(key)
  }

  private sweep(): void {
    const now = Date.now()
    for (const [k, r] of this.entries) {
      if (now > r.windowEnd && now > r.lockedUntil) this.entries.delete(k)
    }
  }
}
