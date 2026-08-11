const MAX_CONCURRENT = 4

const pending: Array<() => Promise<void>> = []
let active = 0

function pump() {
  while (active < MAX_CONCURRENT && pending.length > 0) {
    const task = pending.shift()!
    active++
    void task().finally(() => {
      active--
      pump()
    })
  }
}

// A list view mounts every row at once — without a queue that means hundreds of
// simultaneous scrape/media requests at the dev server. Resolves to null when
// the task throws so callers can fall back instead of unhandled-rejecting.
export function enqueue<T>(task: () => Promise<T>): Promise<T | null> {
  return new Promise((resolve) => {
    pending.push(async () => {
      try {
        resolve(await task())
      } catch {
        resolve(null)
      }
    })
    pump()
  })
}
