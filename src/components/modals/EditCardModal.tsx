import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAppStore, useCardsStore } from '@/core/stores'
import type { Card, ImageCard, Subnote } from '@/core/types'
import { generateId, filesFromClipboard, isImage } from '@/core/utils'
import { api } from '@/core/api'
import { Modal, Button, Input, Textarea, TagInput } from '../ui'
import { SpacePicker } from '../spaces'
import { clsx } from 'clsx'

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

export function EditCardModal() {
  const isOpen = useAppStore((s) => s.isEditModalOpen)
  const editingCardId = useAppStore((s) => s.editingCardId)
  const closeModal = useAppStore((s) => s.closeEditModal)
  const cards = useCardsStore((s) => s.cards)
  const updateCard = useCardsStore((s) => s.updateCard)
  const deleteCard = useCardsStore((s) => s.deleteCard)

  const allTags = Array.from(new Set(cards.flatMap((c) => c.tags))).sort()
  const card = cards.find((c) => c.id === editingCardId)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [spaceIds, setSpaceIds] = useState<string[]>([])
  const [author, setAuthor] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [subnotes, setSubnotes] = useState<Subnote[]>([])
  const [newSubnote, setNewSubnote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubnotes, setShowSubnotes] = useState(false)

  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([])
  const [newImageFiles, setNewImageFiles] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])

  useEffect(() => {
    if (card) {
      setTitle(card.title || '')
      setContent('content' in card ? (card.content as string) : '')
      setCaption('caption' in card ? (card.caption as string) || '' : '')
      setTags([...card.tags])
      setSpaceIds([...card.spaceIds])
      setAuthor(card.author || '')
      setSourceUrl(card.sourceUrl || '')
      setSubnotes([...card.subnotes])
      setNewImageFiles([])
      setNewImagePreviews([])
    }
  }, [card?.id])

  useEffect(() => {
    if (!card || card.type !== 'image') return
    let cancelled = false
    api.getMediaUrls(card.id).then((urls) => {
      if (!cancelled) setExistingMediaUrls(urls)
    })
    return () => { cancelled = true }
  }, [card?.id, card?.type])

  // Handle paste for image cards — takes every pasted image, not just the first
  useEffect(() => {
    if (!isOpen || card?.type !== 'image') return
    const handlePaste = (e: ClipboardEvent) => {
      const files = filesFromClipboard(e.clipboardData, isImage)
      if (files.length === 0) return
      e.preventDefault()
      setNewImageFiles((prev) => [...prev, ...files])
      setNewImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))])
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isOpen, card?.type])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setNewImageFiles((prev) => [...prev, ...acceptedFiles])
    setNewImagePreviews((prev) => [...prev, ...acceptedFiles.map((f) => URL.createObjectURL(f))])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    multiple: true,
  })

  const removeNewImage = (index: number) => {
    URL.revokeObjectURL(newImagePreviews[index])
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index))
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  if (!card) return null

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) setTags([...tags, tag])
  }
  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }
  const addSubnote = () => {
    if (!newSubnote.trim()) return
    setSubnotes([...subnotes, { id: generateId(), content: newSubnote.trim(), createdAt: new Date().toISOString() }])
    setNewSubnote('')
  }
  const removeSubnote = (id: string) => {
    setSubnotes(subnotes.filter((s) => s.id !== id))
  }

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      const updates: Partial<Card> = {
        title: title || undefined,
        tags,
        spaceIds,
        subnotes,
        // Sent as '' rather than undefined when cleared: the store merges
        // changes over the existing card, and JSON.stringify drops undefined
        // keys, so an omitted field reads as "leave it alone" — you could
        // never empty one.
        author: author.trim(),
        sourceUrl: sourceUrl.trim(),
      }
      if (card.type === 'note') {
        (updates as Partial<Card> & { content: string }).content = content
      }
      if (card.type === 'image' || card.type === 'video') {
        (updates as Partial<Card> & { caption?: string }).caption = caption || undefined
      }

      // For image cards: upload any newly added images and append their thumbnails
      if (card.type === 'image' && newImageFiles.length > 0) {
        const newThumbnails: string[] = []
        for (const file of newImageFiles) {
          await api.uploadMedia(card.id, file)
          if (file.type.startsWith('image/')) {
            newThumbnails.push(await generateThumbnail(file))
          }
        }
        const existingThumbs = (card as ImageCard).thumbnailDataUrls || []
        ;(updates as Partial<ImageCard>).thumbnailDataUrls = [...existingThumbs, ...newThumbnails]
      }

      await updateCard(card.id, updates)
      newImagePreviews.forEach((u) => URL.revokeObjectURL(u))
      closeModal()
    } catch (error) {
      console.error('Failed to update card:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (confirm('Delete this card?')) {
      await deleteCard(card.id)
      closeModal()
    }
  }

  return (
    <Modal open={isOpen} onOpenChange={closeModal} title="Edit card">
      <div className="space-y-4">
        <Input
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {card.type === 'note' && (
          <Textarea
            placeholder="Note content…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        )}

        {card.type === 'link' && (
          <div className="px-3.5 py-2.5 bg-[#f9fafb] border border-[var(--color-border)] rounded-lg">
            <p className="text-xs text-text-muted mb-0.5">URL</p>
            <p className="text-sm text-accent-primary break-all">{card.url}</p>
          </div>
        )}

        {card.type === 'image' && (
          <div className="space-y-3">
            <div>
              <p className="section-label mb-2">
                Images ({existingMediaUrls.length + newImageFiles.length})
              </p>
              {(existingMediaUrls.length + newImagePreviews.length) > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {existingMediaUrls.map((url, i) => (
                    <div key={`ex-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border)]">
                      <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {newImagePreviews.map((preview, i) => (
                    <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden border-2 border-accent-primary group">
                      <img src={preview} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-semibold rounded bg-accent-primary text-white">NEW</span>
                      <button
                        type="button"
                        onClick={() => removeNewImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-[#0f172a]/80 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                {...getRootProps()}
                className={clsx(
                  'rounded-xl p-5 text-center cursor-pointer transition-all',
                  'bg-[#f9fafb] border-2 border-dashed',
                  isDragActive
                    ? 'border-accent-primary bg-[#eef2ff]'
                    : 'border-[var(--color-border-bold)] hover:border-accent-primary'
                )}
              >
                <input {...getInputProps()} />
                <p className="text-sm text-text-muted">
                  {isDragActive ? 'Drop images to add' : '+ Drag, click, or paste to add more images'}
                </p>
              </div>
            </div>

            <Input
              placeholder="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
        )}

        {card.type === 'video' && (
          <Input
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        )}

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

        <TagInput
          tags={tags}
          availableTags={allTags}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          label="Tags"
        />

        <SpacePicker value={spaceIds} onChange={setSpaceIds} />

        <div className="border-t border-[var(--color-border)] pt-4">
          <button
            onClick={() => setShowSubnotes(!showSubnotes)}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text"
          >
            <span>{showSubnotes ? '−' : '+'}</span>
            <span>Subnotes ({subnotes.length})</span>
          </button>

          {showSubnotes && (
            <div className="mt-3 space-y-2">
              {subnotes.map((subnote) => (
                <div
                  key={subnote.id}
                  className="flex items-start gap-2 p-3 bg-[#f9fafb] border border-[var(--color-border)] rounded-lg"
                >
                  <p className="flex-1 text-sm">{subnote.content}</p>
                  <button
                    onClick={() => removeSubnote(subnote.id)}
                    className="text-text-muted hover:text-[#dc2626] text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Add subnote…"
                  value={newSubnote}
                  onChange={(e) => setNewSubnote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSubnote()
                    }
                  }}
                />
                <Button size="sm" onClick={addSubnote} disabled={!newSubnote.trim()}>
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-text-muted space-y-0.5 pt-3 border-t border-[var(--color-border)]">
          <p>Created {new Date(card.createdAt).toLocaleString()}</p>
          <p>Updated {new Date(card.updatedAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="danger" onClick={handleDelete}>
          Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
