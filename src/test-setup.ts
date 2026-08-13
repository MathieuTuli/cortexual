import '@testing-library/jest-dom/vitest'

/**
 * Node 22+ ships an experimental global `localStorage` that throws unless the
 * process was started with --localstorage-file, and it shadows the jsdom one.
 * A plain in-memory Storage is closer to a browser than either.
 */
function memoryStorage(): Storage {
  let store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => void (store = new Map()),
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, {
    value: memoryStorage(),
    writable: true,
    configurable: true,
  })
}
