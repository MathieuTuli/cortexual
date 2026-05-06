import { api } from '../api'
import type { Card, ImageCard, VideoCard, NoteCard, LinkCard, EmbedType, Space } from '../types'
import { DEFAULT_SPACE_ID, DEFAULT_SPACE } from '../types'
import { generateId } from './id'
import { parseCsv, generateCsv, parseTags, stringifyTags, type CsvCard } from './csv'
import { parseUrl, getYouTubeThumbnail } from './url-parser'

const SPACE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#6366f1', '#a855f7', '#ec4899',
]

function getRandomSpaceColor(): string {
  return SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)]
}

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function clearDatabase(): Promise<void> {
  await fetch('/api/clear', { method: 'POST' })
}

export async function importFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  onProgress?: (message: string) => void
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const log = (msg: string) => {
    console.log(`[Import] ${msg}`)
    onProgress?.(msg)
  }

  // Find CSV file
  let csvFile: File | null = null
  const mediaFiles: Map<string, File> = new Map()

  log('Scanning directory for files...')
  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind === 'file') {
      const fileHandle = handle as FileSystemFileHandle
      const file = await fileHandle.getFile()

      if (name.endsWith('.csv')) {
        csvFile = file
        log(`Found CSV: ${name}`)
      } else if (file.type.startsWith('image/') || file.type.startsWith('video/') ||
                 name.match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i)) {
        // Store by full filename (case-insensitive key) for new format
        // Also store by filename without extension for backward compatibility
        mediaFiles.set(name.toLowerCase(), file)
        const nameWithoutExt = name.replace(/\.[^/.]+$/, '')
        mediaFiles.set(nameWithoutExt.toLowerCase(), file)
      }
    }
  }
  log(`Found ${mediaFiles.size} media files: ${Array.from(mediaFiles.keys()).slice(0, 5).join(', ')}${mediaFiles.size > 5 ? '...' : ''}`)

  // Debug: Log all media file keys to console for comparison
  if (mediaFiles.size > 0) {
    console.log('[Import] All media file keys:', Array.from(mediaFiles.keys()))
  }

  if (!csvFile) {
    result.errors.push('No CSV file found in directory')
    return result
  }

  // Parse CSV
  log('Parsing CSV...')
  const csvText = await csvFile.text()
  const csvCards = parseCsv(csvText)
  log(`Parsed ${csvCards.length} cards from CSV`)

  // Debug: Show sample IDs for Image/Video cards to help match with media files
  const imageVideoCards = csvCards.filter(c => c.type === 'Image' || c.type === 'Video')
  if (imageVideoCards.length > 0) {
    const sampleIds = imageVideoCards.slice(0, 5).map(c => c.id.toLowerCase())
    log(`Sample Image/Video IDs: ${sampleIds.join(', ')}`)
  }

  if (csvCards.length === 0) {
    result.errors.push('No valid cards found in CSV')
    return result
  }

  // Get existing cards and spaces for duplicate checking
  log('Fetching existing cards and spaces...')
  const existingCards: Card[] = await api.getCards()
  const existingCardIds = new Set(existingCards.map((c) => c.id))
  const existingSpaces: Space[] = await api.getSpaces()
  log(`Found ${existingCards.length} existing cards, ${existingSpaces.length} existing spaces`)

  // Phase 1: Collect all unique space names and create spaces first
  log('Phase 1: Collecting unique space names...')
  const spaceNamesToCreate = new Set<string>()
  for (const csvCard of csvCards) {
    if (existingCardIds.has(csvCard.id)) continue
    const spaceName = csvCard.space || ''
    if (spaceName && spaceName.toLowerCase() !== 'uncategorized') {
      const exists = existingSpaces.some(
        (s) => s.name.toLowerCase() === spaceName.toLowerCase() && s.deletedAt === null
      )
      if (!exists) {
        spaceNamesToCreate.add(spaceName)
      }
    }
  }

  // Create spaces (can't use bulk for spaces as we need to track IDs for later)
  const spaceNameToId = new Map<string, string>()
  for (const space of existingSpaces) {
    if (space.deletedAt === null) {
      spaceNameToId.set(space.name.toLowerCase(), space.id)
    }
  }

  // Check if default space exists
  const defaultExists = existingSpaces.some((s) => s.id === DEFAULT_SPACE_ID)
  if (!defaultExists) {
    await api.createSpace(DEFAULT_SPACE)
    existingSpaces.push(DEFAULT_SPACE)
    spaceNameToId.set(DEFAULT_SPACE.name.toLowerCase(), DEFAULT_SPACE_ID)
  }

  // Create new spaces
  log(`Creating ${spaceNamesToCreate.size} new spaces...`)
  const now = new Date().toISOString()
  for (const spaceName of spaceNamesToCreate) {
    const newSpace: Space = {
      id: generateId(),
      name: spaceName,
      description: undefined,
      color: getRandomSpaceColor(),
      icon: undefined,
      isDefault: false,
      sortOrder: existingSpaces.filter((s) => s.deletedAt === null).length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await api.createSpace(newSpace)
    existingSpaces.push(newSpace)
    spaceNameToId.set(spaceName.toLowerCase(), newSpace.id)
  }

  // Phase 2: Build all cards in memory
  log('Phase 2: Building cards in memory...')
  const cardsToCreate: Card[] = []
  const cardsWithMedia: { cardId: string; file: File }[] = []
  const totalToProcess = csvCards.length
  let processed = 0

  for (const csvCard of csvCards) {
    processed++

    // Skip duplicates
    if (existingCardIds.has(csvCard.id)) {
      result.skipped++
      if (processed % 50 === 0 || processed === totalToProcess) {
        log(`Processing cards: ${processed}/${totalToProcess} (${result.skipped} skipped)`)
      }
      continue
    }

    if (processed % 50 === 0 || processed === totalToProcess) {
      log(`Processing cards: ${processed}/${totalToProcess}`)
    }

    const tags = parseTags(csvCard.tags)
    const cardNow = csvCard.created || new Date().toISOString()

    // Resolve space ID
    const spaceName = csvCard.space || ''
    let spaceId: string
    if (!spaceName || spaceName.toLowerCase() === 'uncategorized') {
      spaceId = DEFAULT_SPACE_ID
    } else {
      spaceId = spaceNameToId.get(spaceName.toLowerCase()) || DEFAULT_SPACE_ID
    }

    let card: Card

    if (csvCard.type === 'Image') {
      card = {
        id: csvCard.id,
        type: 'image',
        spaceId,
        title: csvCard.title || undefined,
        mediaIds: [],
        caption: csvCard.note || undefined,
        tags,
        subnotes: [],
        createdAt: cardNow,
        updatedAt: cardNow,
        deletedAt: null,
      } as ImageCard

      // Check for media column first (new format with pipe-separated filenames)
      if (csvCard.media) {
        const filenames = csvCard.media.split('|').filter(Boolean)
        for (const filename of filenames) {
          const mediaFile = mediaFiles.get(filename.toLowerCase())
          if (mediaFile) {
            cardsWithMedia.push({ cardId: csvCard.id, file: mediaFile })
          }
        }
      } else {
        // Fallback: ID-based matching for backward compatibility
        const mediaKey = csvCard.id.toLowerCase()
        const mediaFile = mediaFiles.get(mediaKey)

        if (!mediaFile && mediaFiles.size > 0) {
          // Debug: try to find a close match
          const allKeys = Array.from(mediaFiles.keys())
          const partialMatch = allKeys.find(k => k.includes(mediaKey) || mediaKey.includes(k))
          if (partialMatch) {
            console.log(`[Import] No exact match for "${mediaKey}", but found partial match: "${partialMatch}"`)
          }
        }

        if (mediaFile) {
          cardsWithMedia.push({ cardId: csvCard.id, file: mediaFile })
        }
      }
    } else if (csvCard.type === 'Video') {
      card = {
        id: csvCard.id,
        type: 'video',
        spaceId,
        title: csvCard.title || undefined,
        mediaId: '',
        caption: csvCard.note || undefined,
        tags,
        subnotes: [],
        createdAt: cardNow,
        updatedAt: cardNow,
        deletedAt: null,
      } as VideoCard

      // Check for media column first (new format with pipe-separated filenames)
      if (csvCard.media) {
        const filenames = csvCard.media.split('|').filter(Boolean)
        for (const filename of filenames) {
          const mediaFile = mediaFiles.get(filename.toLowerCase())
          if (mediaFile) {
            cardsWithMedia.push({ cardId: csvCard.id, file: mediaFile })
          }
        }
      } else {
        // Fallback: ID-based matching for backward compatibility
        const mediaKey = csvCard.id.toLowerCase()
        const mediaFile = mediaFiles.get(mediaKey)

        if (!mediaFile && mediaFiles.size > 0) {
          // Debug: try to find a close match
          const allKeys = Array.from(mediaFiles.keys())
          const partialMatch = allKeys.find(k => k.includes(mediaKey) || mediaKey.includes(k))
          if (partialMatch) {
            console.log(`[Import] No exact match for "${mediaKey}", but found partial match: "${partialMatch}"`)
          }
        }

        if (mediaFile) {
          cardsWithMedia.push({ cardId: csvCard.id, file: mediaFile })
        }
      }
    } else if (csvCard.type === 'Link' || csvCard.url) {
      // Detect embed type from URL
      const parsed = csvCard.url ? parseUrl(csvCard.url) : { embedType: 'generic' as EmbedType }

      let embedData: Record<string, unknown> | undefined
      let preview: { image?: string; siteName?: string } | undefined

      if (parsed.embedId) {
        if (parsed.embedType === 'youtube') {
          embedData = { videoId: parsed.embedId }
          preview = { image: getYouTubeThumbnail(parsed.embedId), siteName: 'YouTube' }
        } else if (parsed.embedType === 'twitter') {
          embedData = { tweetId: parsed.embedId }
          preview = { siteName: 'Twitter/X' }
        }
      }

      card = {
        id: csvCard.id,
        type: 'link',
        spaceId,
        title: csvCard.title || undefined,
        url: csvCard.url,
        embedType: parsed.embedType,
        embedData,
        preview,
        tags,
        subnotes: [],
        createdAt: cardNow,
        updatedAt: cardNow,
        deletedAt: null,
      } as LinkCard
    } else {
      card = {
        id: csvCard.id,
        type: 'note',
        spaceId,
        title: csvCard.title || undefined,
        content: csvCard.content || csvCard.note || '',
        tags,
        subnotes: [],
        createdAt: cardNow,
        updatedAt: cardNow,
        deletedAt: null,
      } as NoteCard
    }

    cardsToCreate.push(card)
    existingCardIds.add(csvCard.id) // Track for duplicates within same import
  }

  log(`Built ${cardsToCreate.length} cards, ${cardsWithMedia.length} with media files`)

  // Phase 3: Bulk import all cards at once
  log(`Phase 3: Bulk importing ${cardsToCreate.length} cards...`)
  if (cardsToCreate.length > 0) {
    try {
      const bulkResult = await api.createCardsBulk(cardsToCreate)
      if (bulkResult.success) {
        result.imported = bulkResult.imported
        result.skipped += bulkResult.skipped
      } else {
        result.errors.push('Bulk card import failed')
      }
    } catch (error) {
      result.errors.push(`Bulk import error: ${(error as Error).message}`)
    }
  }

  // Phase 4: Upload media files for cards that have them
  log(`Phase 4: Uploading ${cardsWithMedia.length} media files...`)
  let mediaUploaded = 0
  let mediaErrors = 0
  for (const { cardId, file } of cardsWithMedia) {
    mediaUploaded++
    try {
      log(`Uploading media: ${mediaUploaded}/${cardsWithMedia.length} (${file.name}, ${(file.size / 1024).toFixed(1)}KB)`)
      const response = await api.uploadMedia(cardId, file)
      console.log(`[Import] Upload response for ${cardId}:`, response)
    } catch (error) {
      mediaErrors++
      const errMsg = `Failed to upload media for ${cardId}: ${(error as Error).message}`
      console.error(`[Import] ${errMsg}`)
      result.errors.push(errMsg)
    }
  }

  if (mediaErrors > 0) {
    log(`Media upload completed with ${mediaErrors} errors`)
  }

  log(`Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`)
  return result
}

export async function exportToFolder(): Promise<{ csv: Blob; mediaFiles: { name: string; blob: Blob }[] }> {
  // Get all cards and filter for active ones
  const allCards: Card[] = await api.getCards()
  const activeCards = allCards.filter((c) => c.deletedAt === null)

  // Get all spaces and build lookup map
  const allSpaces: Space[] = await api.getSpaces()
  const spaceIdToName = new Map<string, string>()
  for (const space of allSpaces) {
    spaceIdToName.set(space.id, space.name)
  }

  const csvCards: CsvCard[] = []
  const mediaFiles: { name: string; blob: Blob }[] = []

  for (const card of activeCards) {
    const csvCard: CsvCard = {
      id: card.id,
      type: card.type.charAt(0).toUpperCase() + card.type.slice(1), // Capitalize
      title: card.title || '',
      url: card.type === 'link' ? (card as LinkCard).url : '',
      content: card.type === 'note' ? (card as NoteCard).content : '',
      note: (card.type === 'image' || card.type === 'video') ? ((card as ImageCard | VideoCard).caption || '') : '',
      tags: stringifyTags(card.tags),
      created: card.createdAt,
      space: spaceIdToName.get(card.spaceId) || 'Uncategorized',
      media: '',
    }

    // Get media for image/video cards
    if (card.type === 'image' || card.type === 'video') {
      const mediaUrls = await api.getMediaUrls(card.id)
      const mediaFilenames: string[] = []
      let mediaIndex = 1
      for (const url of mediaUrls) {
        try {
          const response = await fetch(url)
          if (response.ok) {
            const blob = await response.blob()
            const ext = getExtensionFromMimeType(blob.type)
            const filename = `${card.id}-${mediaIndex}${ext}`
            mediaFiles.push({ name: filename, blob })
            mediaFilenames.push(filename)
            mediaIndex++
          }
        } catch {
          // Skip media that can't be fetched
        }
      }
      csvCard.media = mediaFilenames.join('|')
    }

    csvCards.push(csvCard)
  }

  const csvText = generateCsv(csvCards)
  const csvBlob = new Blob([csvText], { type: 'text/csv' })

  return { csv: csvBlob, mediaFiles }
}

function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  }
  return map[mimeType] || ''
}

export async function downloadExport(): Promise<void> {
  // Check if File System Access API is available
  if ('showDirectoryPicker' in window) {
    try {
      // Let user select destination directory
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads',
      })

      const { csv, mediaFiles } = await exportToFolder()

      // Write CSV file
      const csvFileHandle = await dirHandle.getFileHandle('cards.csv', { create: true })
      const csvWritable = await csvFileHandle.createWritable()
      await csvWritable.write(csv)
      await csvWritable.close()

      // Write media files
      for (const file of mediaFiles) {
        const fileHandle = await dirHandle.getFileHandle(file.name, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(file.blob)
        await writable.close()
      }

      return
    } catch (error) {
      // User cancelled or API not supported, fall back to downloads
      if ((error as Error).name === 'AbortError') {
        return // User cancelled
      }
      console.warn('Directory picker failed, falling back to downloads:', error)
    }
  }

  // Fallback: download to downloads folder
  const { csv, mediaFiles } = await exportToFolder()

  // Download CSV
  const csvUrl = URL.createObjectURL(csv)
  const csvLink = document.createElement('a')
  csvLink.href = csvUrl
  csvLink.download = 'cards.csv'
  csvLink.click()
  URL.revokeObjectURL(csvUrl)

  // Download media files (with a small delay between each to avoid overwhelming the browser)
  for (const file of mediaFiles) {
    const url = URL.createObjectURL(file.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    URL.revokeObjectURL(url)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

export async function downloadExportAsZip(): Promise<void> {
  // For a proper implementation, you'd use a library like JSZip
  // For now, we'll just download files individually
  await downloadExport()
}
