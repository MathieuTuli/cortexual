import { api } from '../api'
import type { Card, LinkCard } from '../types'
import { parseUrl } from '../utils/url-parser'
import { parseArchive, type ArchiveItem, type ArchiveKind } from './archives'

/** Text files worth reading out of an export; the rest is media and noise. */
const TEXT_FILE = /(bookmarks|like|saved_posts)\.(js|json)$/i

export interface ArchiveImportResult {
  kind: ArchiveKind | null
  found: number
  imported: number
  skipped: number
}

async function collectTextFiles(
  directory: FileSystemDirectoryHandle,
  onProgress?: (message: string) => void,
  prefix = '',
  depth = 0
): Promise<Map<string, string>> {
  const files = new Map<string, string>()
  // Exports nest two or three deep; anything past that is media directories.
  if (depth > 4) return files

  for await (const [name, handle] of directory.entries()) {
    const path = prefix ? `${prefix}/${name}` : name

    if (handle.kind === 'directory') {
      const nested = await collectTextFiles(
        handle as FileSystemDirectoryHandle,
        onProgress,
        path,
        depth + 1
      )
      for (const [k, v] of nested) files.set(k, v)
    } else if (TEXT_FILE.test(name)) {
      onProgress?.(`Reading ${path}…`)
      files.set(path, await (handle as FileSystemFileHandle).getFile().then((f) => f.text()))
    }
  }

  return files
}

function toCard(item: ArchiveItem, kind: ArchiveKind, spaceIds: string[]): Card {
  const parsed = parseUrl(item.url)
  const now = new Date().toISOString()
  const createdAt = item.createdAt || now

  return {
    id: item.id,
    type: 'link',
    spaceIds,
    projectIds: [],
    url: item.url,
    sourceUrl: item.url,
    author: item.author,
    siteName: kind === 'x' ? 'X' : 'Instagram',
    embedType: parsed.embedType,
    embedData: parsed.embedId
      ? parsed.embedType === 'youtube'
        ? { videoId: parsed.embedId }
        : { tweetId: parsed.embedId }
      : undefined,
    // The archive's own text, where it has any, so the card says something
    // before any preview is fetched.
    preview: item.text ? { title: item.text.slice(0, 140), description: item.text } : undefined,
    tags: [],
    subnotes: [],
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  } as LinkCard
}

/**
 * Import an unzipped X or Instagram export. Ids are derived from the source
 * post, so running the same archive twice imports nothing the second time.
 */
export async function importArchive(
  directory: FileSystemDirectoryHandle,
  spaceIds: string[] = [],
  onProgress?: (message: string) => void
): Promise<ArchiveImportResult> {
  onProgress?.('Scanning archive…')
  const files = await collectTextFiles(directory, onProgress)

  const archive = parseArchive(files)
  if (!archive) {
    return { kind: null, found: 0, imported: 0, skipped: 0 }
  }

  onProgress?.(`Found ${archive.items.length} items in a ${archive.kind} export`)

  const existing: Card[] = await api.getCards()
  const existingIds = new Set(existing.map((c) => c.id))

  const fresh = archive.items.filter((item) => !existingIds.has(item.id))
  const skipped = archive.items.length - fresh.length

  if (fresh.length === 0) {
    return { kind: archive.kind, found: archive.items.length, imported: 0, skipped }
  }

  onProgress?.(`Importing ${fresh.length} cards…`)
  const result = await api.createCardsBulk(fresh.map((item) => toCard(item, archive.kind, spaceIds)))

  return {
    kind: archive.kind,
    found: archive.items.length,
    imported: result.imported,
    skipped: skipped + result.skipped,
  }
}
