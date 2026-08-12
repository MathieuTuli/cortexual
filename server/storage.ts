import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const DATA_DIR = path.join(ROOT, 'data')
export const CARDS_FILE = path.join(DATA_DIR, 'cards.json')
export const SPACES_FILE = path.join(DATA_DIR, 'spaces.json')
export const LAYOUTS_FILE = path.join(DATA_DIR, 'layouts.json')
export const EMBEDDINGS_FILE = path.join(DATA_DIR, 'embeddings.json')
export const MEDIA_DIR = path.join(DATA_DIR, 'media')

export function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true })
  if (!fs.existsSync(CARDS_FILE)) fs.writeFileSync(CARDS_FILE, '[]')
  if (!fs.existsSync(LAYOUTS_FILE)) fs.writeFileSync(LAYOUTS_FILE, '{}')
  if (!fs.existsSync(EMBEDDINGS_FILE)) fs.writeFileSync(EMBEDDINGS_FILE, '{}')
  if (!fs.existsSync(SPACES_FILE)) {
    const now = new Date().toISOString()
    fs.writeFileSync(
      SPACES_FILE,
      JSON.stringify([
        {
          id: 'uncategorized',
          name: 'Uncategorized',
          sortOrder: 0,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ])
    )
  }
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

/**
 * Write via a temp file and rename. A crash mid-write would otherwise leave a
 * truncated cards.json, which is the whole library.
 */
export function writeJson(file: string, value: unknown) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
  fs.renameSync(tmp, file)
}
