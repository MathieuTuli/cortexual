import { useState, useCallback, useEffect } from 'react'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import type { CardType, CreateCardInput } from '@/core/types'
import { DEFAULT_SPACE_ID } from '@/core/types'
import { parseUrl, getYouTubeThumbnail } from '@/core/utils'
import { Modal, Button, Input, Textarea, TagInput } from '../ui'
import { useDropzone } from 'react-dropzone'
import { clsx } from 'clsx'

export function CreateCardModal() {
  const isOpen = useAppStore((s) => s.isCreateModalOpen)
  const closeModal = useAppStore((s) => s.closeCreateModal)
  const defaultType = useAppStore((s) => s.createModalDefaultType)
  const createCard = useCardsStore((s) => s.createCard)
  const spaces = useSpacesStore((s) => s.spaces)
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
  const [spaceId, setSpaceId] = useState(activeSpaceId || DEFAULT_SPACE_ID)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync cardType with defaultType when modal opens
  useEffect(() => {
    if (isOpen) {
      setCardType(defaultType)
    }
  }, [isOpen, defaultType])

  // Handle paste for images
  useEffect(() => {
    if (!isOpen || cardType !== 'image') return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            setMediaFiles((prev) => [...prev, file])
            const previewUrl = URL.createObjectURL(file)
            setMediaPreviews((prev) => [...prev, previewUrl])
          }
          break
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isOpen, cardType])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (cardType === 'image') {
      // For images, allow multiple files
      const newPreviews = acceptedFiles.map((file) => URL.createObjectURL(file))
      setMediaFiles((prev) => [...prev, ...acceptedFiles])
      setMediaPreviews((prev) => [...prev, ...newPreviews])
    } else {
      // For video, only allow one file
      const file = acceptedFiles[0]
      if (file) {
        // Clean up old preview
        mediaPreviews.forEach((url) => URL.revokeObjectURL(url))
        setMediaFiles([file])
        setMediaPreviews([URL.createObjectURL(file)])
      }
    }
  }, [cardType, mediaPreviews])

  const removeImage = (index: number) => {
    URL.revokeObjectURL(mediaPreviews[index])
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: cardType === 'image'
      ? { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }
      : { 'video/*': ['.mp4', '.webm', '.mov'] },
    multiple: cardType === 'image',
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
    setSpaceId(activeSpaceId || DEFAULT_SPACE_ID)
    mediaPreviews.forEach((url) => URL.revokeObjectURL(url))
    setMediaFiles([])
    setMediaPreviews([])
  }

  const handleClose = () => {
    reset()
    closeModal()
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      let input: CreateCardInput

      if (cardType === 'note') {
        input = {
          type: 'note',
          spaceId,
          title: title || undefined,
          content,
          tags,
          subnotes: [],
        }
        await createCard(input)
      } else if (cardType === 'image' && mediaFiles.length > 0) {
        const thumbnailDataUrls: string[] = []
        for (const file of mediaFiles) {
          if (file.type.startsWith('image/')) {
            const thumbnail = await generateThumbnail(file)
            thumbnailDataUrls.push(thumbnail)
          }
        }

        input = {
          type: 'image',
          spaceId,
          title: title || undefined,
          mediaIds: [],
          caption: caption || undefined,
          thumbnailDataUrls,
          tags,
          subnotes: [],
        }
        await createCard(input, mediaFiles)
      } else if (cardType === 'video' && mediaFiles.length > 0) {
        input = {
          type: 'video',
          spaceId,
          title: title || undefined,
          mediaId: '',
          caption: caption || undefined,
          tags,
          subnotes: [],
        }
        await createCard(input, mediaFiles[0])
      } else if (cardType === 'link') {
        const parsed = parseUrl(url)

        input = {
          type: 'link',
          spaceId,
          title: title || undefined,
          url,
          embedType: parsed.embedType,
          embedData: parsed.embedId
            ? parsed.embedType === 'youtube'
              ? { videoId: parsed.embedId }
              : { tweetId: parsed.embedId }
            : undefined,
          preview: parsed.embedType === 'youtube' && parsed.embedId
            ? { image: getYouTubeThumbnail(parsed.embedId), siteName: 'YouTube' }
            : undefined,
          tags,
          subnotes: [],
        }
        await createCard(input)
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
    if (cardType === 'image' || cardType === 'video') return mediaFiles.length > 0
    if (cardType === 'link') return url.trim().length > 0
    return false
  }

  const tabIcons: Record<CardType, string> = {
    note: '📝',
    image: '🖼️',
    video: '🎬',
    link: '🔗',
  }

  const cardTypes: CardType[] = ['note', 'image', 'video', 'link']

  return (
    <Modal open={isOpen} onOpenChange={handleClose} title="New Card">
      <div className="min-h-[200px]">
        {/* Tab Buttons - Simple implementation without Radix */}
        <div className="flex gap-1 mb-4">
          {cardTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCardType(type)}
              className={clsx(
                'flex-1 py-2 px-3 text-sm font-medium rounded transition-all',
                cardType === type
                  ? 'bg-gradient-to-b from-[#66ccff] to-[#0066cc] text-white shadow-y2k'
                  : 'bg-gradient-to-b from-white to-[#e8f4fc] text-text-muted border border-[#a8d4f0] hover:border-accent-primary'
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

          {cardType === 'image' && (
            <>
              <div
                {...getRootProps()}
                className={clsx(
                  'rounded-lg p-8 text-center cursor-pointer transition-all',
                  'bg-gradient-to-b from-[#e0ecf4] to-white',
                  'border-2 border-dashed',
                  isDragActive
                    ? 'border-accent-primary bg-[#e0f0ff]'
                    : 'border-[#a8d4f0] hover:border-accent-secondary'
                )}
              >
                <input {...getInputProps()} />
                <div>
                  <p className="text-3xl mb-2">🖼️</p>
                  <p className="text-text-muted">
                    {isDragActive ? 'Drop images here!' : 'Drag & drop, click to select, or paste (multiple allowed)'}
                  </p>
                </div>
              </div>
              {mediaPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {mediaPreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-24 object-cover rounded border border-[#a8d4f0]" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Input
                placeholder="Caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </>
          )}

          {cardType === 'video' && (
            <>
              <div
                {...getRootProps()}
                className={clsx(
                  'rounded-lg p-8 text-center cursor-pointer transition-all',
                  'bg-gradient-to-b from-[#e0ecf4] to-white',
                  'border-2 border-dashed',
                  isDragActive
                    ? 'border-accent-primary bg-[#e0f0ff]'
                    : 'border-[#a8d4f0] hover:border-accent-secondary'
                )}
              >
                <input {...getInputProps()} />
                {mediaPreviews.length > 0 ? (
                  <video src={mediaPreviews[0]} className="max-h-48 mx-auto rounded" controls />
                ) : (
                  <div>
                    <p className="text-3xl mb-2">🎬</p>
                    <p className="text-text-muted">
                      {isDragActive ? 'Drop video here!' : 'Drag & drop or click to select'}
                    </p>
                  </div>
                )}
              </div>
              <Input
                placeholder="Caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </>
          )}

          {cardType === 'link' && (
            <>
              <Input
                placeholder="Paste URL (YouTube, Twitter, or any link)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {url && (
                <div className="p-3 bg-gradient-to-b from-[#e8f4fc] to-white rounded border border-[#a8d4f0]">
                  <p className="text-sm text-text-muted">
                    Detected: <span className="font-medium text-accent-primary">{parseUrl(url).embedType}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Common Fields */}
        <div className="space-y-4 mt-6 pt-4 border-t-2 border-[#a8d4f0]">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Tags */}
          <TagInput
            tags={tags}
            availableTags={allTags}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            label="🏷️ Tags"
          />

          {/* Space selector */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              📂 Space
            </label>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gradient-to-b from-[#e0ecf4] to-white border-2 border-[#88b0d0] text-text focus:outline-none focus:ring-2 focus:ring-accent-secondary"
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.icon ? `${space.icon} ` : ''}{space.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid() || isSubmitting}
          >
            {isSubmitting ? '⏳ Saving...' : '💾 Save Card'}
          </Button>
        </div>
      </div>
    </Modal>
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
