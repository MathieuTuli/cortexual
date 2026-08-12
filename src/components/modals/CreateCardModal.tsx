import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import type { NewCard } from '@/core/stores/cards-store'
import type { CardType, CreateCardInput } from '@/core/types'
import { DEFAULT_SPACE_ID } from '@/core/types'
import { parseUrl, getYouTubeThumbnail, getHostname, filesFromClipboard, isImage, isMedia } from '@/core/utils'
import { api } from '@/core/api'
import { Modal, Button, Input, Textarea, TagInput } from '../ui'
import { SpacePicker } from '../spaces'
import { useDropzone } from 'react-dropzone'
import { clsx } from 'clsx'

const MEDIA_ACCEPT = {
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  'video/*': ['.mp4', '.webm', '.mov'],
}

// A batch is one paste or one drop — everything that arrived together.
interface StagedMedia {
  file: File
  preview: string
  batch: number
}

type GroupMode = 'file' | 'batch' | 'all'

const GROUP_MODES: { mode: GroupMode; label: string; hint: string }[] = [
  { mode: 'file', label: 'Per image', hint: 'Every image becomes its own card' },
  { mode: 'batch', label: 'Per paste', hint: 'Images pasted or dropped together share a card' },
  { mode: 'all', label: 'One card', hint: 'All images go into a single card' },
]

function groupImages(images: StagedMedia[], mode: GroupMode): StagedMedia[][] {
  if (images.length === 0) return []
  if (mode === 'all') return [images]
  if (mode === 'file') return images.map((image) => [image])

  const batches = new Map<number, StagedMedia[]>()
  for (const image of images) {
    const batch = batches.get(image.batch)
    if (batch) batch.push(image)
    else batches.set(image.batch, [image])
  }
  return Array.from(batches.values())
}

export function CreateCardModal() {
  const isOpen = useAppStore((s) => s.isCreateModalOpen)
  const closeModal = useAppStore((s) => s.closeCreateModal)
  const defaultType = useAppStore((s) => s.createModalDefaultType)
  const createCard = useCardsStore((s) => s.createCard)
  const createCards = useCardsStore((s) => s.createCards)
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const cards = useCardsStore((s) => s.cards)

  // Compute allTags from cards array (not calling a function in the selector)
  const allTags = Array.from(new Set(cards.flatMap((c) => c.tags))).sort()

  const [cardType, setCardType] = useState<CardType>(defaultType)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [spaceIds, setSpaceIds] = useState<string[]>(
    activeSpaceId && activeSpaceId !== DEFAULT_SPACE_ID ? [activeSpaceId] : []
  )
  const [author, setAuthor] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [staged, setStaged] = useState<StagedMedia[]>([])
  const [groupMode, setGroupMode] = useState<GroupMode>('file')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const batchCounter = useRef(0)

  const isMediaType = cardType === 'image' || cardType === 'video'
  const urlList = url
    .split(/[\n\s]+/)
    .map((u) => u.trim())
    .filter(Boolean)
  const stagedImages = staged.filter((s) => isImage(s.file))
  const stagedVideos = staged.filter((s) => !isImage(s.file))
  const imageGroups = groupImages(stagedImages, groupMode)
  const cardCount = imageGroups.length + stagedVideos.length
  const showGroupLabels = imageGroups.some((group) => group.length > 1)

  // Sync cardType with defaultType when modal opens
  useEffect(() => {
    if (isOpen) {
      setCardType(defaultType)
    }
  }, [isOpen, defaultType])

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return
    const batch = ++batchCounter.current
    setStaged((prev) => [
      ...prev,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file), batch })),
    ])
  }, [])

  useEffect(() => {
    if (!isOpen || !isMediaType) return

    const handlePaste = (e: ClipboardEvent) => {
      const files = filesFromClipboard(e.clipboardData, isMedia)
      if (files.length === 0) return
      e.preventDefault()
      addFiles(files)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isOpen, isMediaType, addFiles])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    addFiles(acceptedFiles.filter(isMedia))
  }, [addFiles])

  const removeMedia = (preview: string) => {
    URL.revokeObjectURL(preview)
    setStaged((prev) => prev.filter((item) => item.preview !== preview))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: MEDIA_ACCEPT,
    multiple: true,
  })

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag])
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const reset = () => {
    setCardType('note')
    setTitle('')
    setContent('')
    setUrl('')
    setCaption('')
    setTags([])
    setAuthor('')
    setSourceUrl('')
    setSpaceIds(activeSpaceId && activeSpaceId !== DEFAULT_SPACE_ID ? [activeSpaceId] : [])
    staged.forEach((item) => URL.revokeObjectURL(item.preview))
    setStaged([])
    setGroupMode('file')
    setProgress(null)
    batchCounter.current = 0
  }

  const handleClose = () => {
    reset()
    closeModal()
  }

  // Images become cards at whatever granularity groupMode asks for; a video
  // card holds one file, so videos are always one apiece.
  const buildMediaCards = async (): Promise<NewCard[]> => {
    const shared = { spaceIds, title: title || undefined, caption: caption || undefined, tags, subnotes: [] }
    const thumbnails = new Map<File, string>()
    for (const { file } of stagedImages) {
      thumbnails.set(file, await generateThumbnail(file))
    }

    const imageCards: NewCard[] = imageGroups.map((group) => ({
      input: {
        ...shared,
        type: 'image' as const,
        mediaIds: [],
        thumbnailDataUrls: group.map(({ file }) => thumbnails.get(file)!),
      },
      blobs: group.map(({ file }) => file),
    }))

    const videoCards: NewCard[] = stagedVideos.map(({ file }) => ({
      input: { ...shared, type: 'video' as const, mediaId: '' },
      blobs: [file],
    }))

    return [...imageCards, ...videoCards]
  }

  /**
   * YouTube and X carry their own embeds, so they only need the id. Everything
   * else gets a full article extraction, which is where author and site name
   * come from — a title alone makes for a poor card.
   */
  const buildLinkCard = async (one: string, single: boolean): Promise<CreateCardInput> => {
    const parsed = parseUrl(one)

    let preview: { title?: string; description?: string; image?: string; siteName?: string } | undefined
    // Named apart from the `author` form field, which belongs to highlights.
    let byline: string | undefined
    let site: string | undefined

    if (parsed.embedType === 'youtube' && parsed.embedId) {
      preview = { image: getYouTubeThumbnail(parsed.embedId), siteName: 'YouTube' }
    } else if (parsed.embedType === 'generic') {
      // A failed extraction shouldn't stop the card being made — you still
      // wanted the link saved.
      const article = await api
        .getArticle(one)
        .catch((): Awaited<ReturnType<typeof api.getArticle>> => ({}))
      if (article.title || article.excerpt || article.image) {
        preview = {
          title: article.title,
          description: article.excerpt || article.description,
          image: article.image,
          siteName: article.siteName,
        }
      }
      byline = article.author
      site = article.siteName
    }

    return {
      type: 'link',
      spaceIds,
      // A shared title across a batch would label every card the same.
      title: single ? title || undefined : undefined,
      url: one,
      author: byline,
      sourceUrl: one,
      siteName: site,
      embedType: parsed.embedType,
      embedData: parsed.embedId
        ? parsed.embedType === 'youtube'
          ? { videoId: parsed.embedId }
          : { tweetId: parsed.embedId }
        : undefined,
      preview,
      tags,
      subnotes: [],
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      let input: CreateCardInput

      if (cardType === 'note') {
        input = {
          type: 'note',
          spaceIds,
          title: title || undefined,
          content,
          tags,
          subnotes: [],
        }
        await createCard(input)
      } else if (cardType === 'highlight') {
        input = {
          type: 'highlight',
          spaceIds,
          title: title || undefined,
          text: content,
          author: author.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          siteName: sourceUrl.trim() ? getHostname(sourceUrl.trim()) : undefined,
          tags,
          subnotes: [],
        }
        await createCard(input)
      } else if (isMediaType && staged.length > 0) {
        await createCards(await buildMediaCards(), (done, total) => setProgress({ done, total }))
      } else if (cardType === 'link') {
        // One URL per line, so a backlog of blog posts is one paste rather
        // than one trip through this modal each.
        const urls = url
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean)

        for (const [index, one] of urls.entries()) {
          setProgress({ done: index, total: urls.length })
          await createCard(await buildLinkCard(one, urls.length === 1))
        }
      }

      handleClose()
    } catch (error) {
      console.error('Failed to create card:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = () => {
    if (cardType === 'note') return content.trim().length > 0
    if (isMediaType) return staged.length > 0
    if (cardType === 'link') return urlList.length > 0
    if (cardType === 'highlight') return content.trim().length > 0
    return false
  }

  const tabIcons: Record<CardType, string> = {
    note: '📝',
    image: '🖼️',
    video: '🎬',
    link: '🔗',
    highlight: '❝',
  }

  const cardTypes: CardType[] = ['note', 'highlight', 'image', 'video', 'link']

  return (
    <Modal open={isOpen} onOpenChange={handleClose} title="New card">
      <div className="min-h-[200px]">
        <div className="inline-flex p-1 mb-4 bg-[#f3f4f6] rounded-full">
          {cardTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCardType(type)}
              className={clsx(
                'px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors',
                cardType === type
                  ? 'bg-white text-text shadow-soft'
                  : 'text-text-muted hover:text-text'
              )}
            >
              {tabIcons[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content - Conditional rendering */}
        <div className="space-y-4">
          {cardType === 'note' && (
            <Textarea
              placeholder="Write your note here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
            />
          )}

          {cardType === 'highlight' && (
            <>
              <Textarea
                placeholder="Paste the quote…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Author (optional)"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
                <Input
                  placeholder="Source URL (optional)"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </div>
            </>
          )}

          {isMediaType && (
            <>
              <div
                {...getRootProps()}
                className={clsx(
                  'rounded-xl p-8 text-center cursor-pointer transition-all',
                  'bg-[#f9fafb] border-2 border-dashed',
                  isDragActive
                    ? 'border-accent-primary bg-[#eef2ff]'
                    : 'border-[var(--color-border-bold)] hover:border-accent-primary'
                )}
              >
                <input {...getInputProps()} />
                <div>
                  <p className="text-3xl mb-2">{cardType === 'image' ? '🖼️' : '🎬'}</p>
                  <p className="text-text-muted">
                    {isDragActive
                      ? 'Drop them here!'
                      : 'Drag & drop, click to select, or paste — as many as you like'}
                  </p>
                </div>
              </div>

              {staged.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="section-label">
                      {staged.length} file{staged.length === 1 ? '' : 's'} → {cardCount} card
                      {cardCount === 1 ? '' : 's'}
                    </p>
                    {stagedImages.length > 1 && (
                      <div className="inline-flex p-0.5 bg-[#f3f4f6] rounded-full">
                        {GROUP_MODES.map(({ mode, label, hint }) => (
                          <button
                            key={mode}
                            type="button"
                            title={hint}
                            onClick={() => setGroupMode(mode)}
                            className={clsx(
                              'px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors',
                              groupMode === mode
                                ? 'bg-white text-text shadow-soft'
                                : 'text-text-muted hover:text-text'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {showGroupLabels ? (
                      <>
                        {imageGroups.map((group, i) => (
                          <StagedGroup
                            key={group[0].preview}
                            label={`Card ${i + 1} · ${group.length} image${group.length === 1 ? '' : 's'}`}
                            items={group}
                            onRemove={removeMedia}
                          />
                        ))}
                        {stagedVideos.length > 0 && (
                          <StagedGroup
                            label={`${stagedVideos.length} video card${stagedVideos.length === 1 ? '' : 's'}`}
                            items={stagedVideos}
                            onRemove={removeMedia}
                          />
                        )}
                      </>
                    ) : (
                      <StagedGrid items={staged} onRemove={removeMedia} />
                    )}
                  </div>
                </>
              )}

              <Input
                placeholder="Caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </>
          )}

          {cardType === 'link' && (
            <>
              <Textarea
                placeholder={'Paste a URL — or several, one per line'}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                rows={urlList.length > 1 ? 5 : 2}
              />
              {url && (
                <div className="px-3.5 py-2 rounded-lg bg-[#f9fafb] border border-[var(--color-border)]">
                  <p className="text-xs text-text-muted">
                    {urlList.length > 1 ? (
                      <>
                        <span className="font-medium text-accent-primary">{urlList.length} links</span>
                        {' — one card each, fetched in turn'}
                      </>
                    ) : (
                      <>
                        Detected: <span className="font-medium text-accent-primary">{parseUrl(urlList[0] || '').embedType}</span>
                      </>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4 mt-6 pt-4 border-t border-[var(--color-border)]">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <TagInput
            tags={tags}
            availableTags={allTags}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            label="Tags"
          />

          <SpacePicker value={spaceIds} onChange={setSpaceIds} />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid() || isSubmitting}
          >
            {isSubmitting
              ? progress ? `Saving ${progress.done}/${progress.total}…` : 'Saving…'
              : isMediaType && cardCount > 1 ? `Save ${cardCount} cards` : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface StagedGridProps {
  items: StagedMedia[]
  onRemove: (preview: string) => void
}

function StagedGrid({ items, onRemove }: StagedGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ file, preview }) => (
        <div key={preview} className="relative group">
          {isImage(file) ? (
            <img
              src={preview}
              alt={file.name}
              className="w-full h-20 object-cover rounded-lg border border-[var(--color-border)]"
            />
          ) : (
            <video
              src={preview}
              className="w-full h-20 object-cover rounded-lg border border-[var(--color-border)] bg-black"
            />
          )}
          <button
            type="button"
            onClick={() => onRemove(preview)}
            className="absolute top-1 right-1 w-5 h-5 bg-[#0f172a]/80 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function StagedGroup({ label, items, onRemove }: StagedGridProps & { label: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-2">
      <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 px-0.5">{label}</p>
      <StagedGrid items={items} onRemove={onRemove} />
    </div>
  )
}

async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxSize = 200
        let { width, height } = img

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}
