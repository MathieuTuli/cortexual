import { useEffect, useState } from 'react'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import { cardSpaces } from '@/core/types'
import { getHostname } from '@/core/utils'
import { api } from '@/core/api'
import { Modal, Button, TagInput } from '../ui'
import { YouTubeEmbed } from '../embeds/YouTubeEmbed'
import { TwitterEmbed } from '../embeds/TwitterEmbed'

export function CardViewModal() {
  const isOpen = useAppStore((s) => s.isViewModalOpen)
  const viewingCardId = useAppStore((s) => s.viewingCardId)
  const closeModal = useAppStore((s) => s.closeViewModal)
  const openEditModal = useAppStore((s) => s.openEditModal)
  const cards = useCardsStore((s) => s.cards)
  const updateCard = useCardsStore((s) => s.updateCard)
  const deleteCard = useCardsStore((s) => s.deleteCard)
  const spaces = useSpacesStore((s) => s.spaces)

  const [blobUrls, setBlobUrls] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [tags, setTags] = useState<string[]>([])

  const card = cards.find((c) => c.id === viewingCardId)
  const memberSpaces = card ? cardSpaces(card, spaces) : []
  const allTags = Array.from(new Set(cards.flatMap((c) => c.tags))).sort()

  // Sync tags from card
  useEffect(() => {
    if (card) {
      setTags([...card.tags])
    }
  }, [card?.id, card?.tags.join(',')])

  const addTag = async (tag: string) => {
    if (!tags.includes(tag) && card) {
      const newTags = [...tags, tag]
      setTags(newTags)
      await updateCard(card.id, { tags: newTags })
    }
  }

  const removeTag = async (tag: string) => {
    if (!card) return
    const newTags = tags.filter((t) => t !== tag)
    setTags(newTags)
    await updateCard(card.id, { tags: newTags })
  }

  // Load full resolution media
  useEffect(() => {
    if (!card || (card.type !== 'image' && card.type !== 'video')) return

    let cancelled = false

    async function loadMedia() {
      try {
        const urls = await api.getMediaUrls(card!.id)
        if (!cancelled) {
          setBlobUrls(urls)
        }
      } catch (error) {
        console.error('Failed to load media:', error)
      }
    }

    setBlobUrls([])
    setCurrentImageIndex(0)
    loadMedia()

    return () => {
      cancelled = true
    }
  }, [card])

  if (!card) return null

  const handleEdit = () => {
    closeModal()
    openEditModal(card.id)
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this card?')) {
      closeModal()
      await deleteCard(card.id)
    }
  }

  return (
    <Modal open={isOpen} onOpenChange={closeModal} title={card.title || `${card.type.charAt(0).toUpperCase() + card.type.slice(1)}`} className="max-w-4xl">
      <div className="space-y-4">
        {/* Main Content */}
        <div className="min-h-[200px]">
          {card.type === 'note' && (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-text leading-relaxed">
                {card.content}
              </p>
            </div>
          )}

          {card.type === 'image' && (
            <div className="space-y-3">
              {/* Main Image with Navigation */}
              <div className="relative flex justify-center items-center">
                {blobUrls.length > 1 && (
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev - 1 + blobUrls.length) % blobUrls.length)}
                    className="absolute left-2 z-10 w-9 h-9 flex items-center justify-center bg-[#0f172a]/60 hover:bg-[#0f172a]/80 text-white rounded-full transition-colors backdrop-blur-sm"
                  >
                    ‹
                  </button>
                )}
                <img
                  src={blobUrls[currentImageIndex] || (card.thumbnailDataUrls?.[currentImageIndex])}
                  alt={card.caption || 'Image'}
                  className="max-w-full max-h-[60vh] object-contain"
                />
                {blobUrls.length > 1 && (
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev + 1) % blobUrls.length)}
                    className="absolute right-2 z-10 w-9 h-9 flex items-center justify-center bg-[#0f172a]/60 hover:bg-[#0f172a]/80 text-white rounded-full transition-colors backdrop-blur-sm"
                  >
                    ›
                  </button>
                )}
              </div>
              {/* Thumbnail Strip */}
              {blobUrls.length > 1 && (
                <div className="flex justify-center gap-2 overflow-x-auto py-2">
                  {blobUrls.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentImageIndex
                          ? 'border-accent-primary'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              {/* Image Counter */}
              {blobUrls.length > 1 && (
                <p className="text-center text-xs text-text-muted">
                  {currentImageIndex + 1} / {blobUrls.length}
                </p>
              )}
            </div>
          )}

          {card.type === 'video' && blobUrls.length > 0 && (
            <div className="flex justify-center">
              <video
                src={blobUrls[0]}
                controls
                className="max-w-full max-h-[60vh]"
              />
            </div>
          )}

          {card.type === 'link' && (
            <div className="space-y-4">
              {card.embedType === 'youtube' && card.embedData && 'videoId' in card.embedData && (
                <YouTubeEmbed videoId={card.embedData.videoId as string} />
              )}
              {card.embedType === 'twitter' && card.embedData && 'tweetId' in card.embedData && (
                <TwitterEmbed tweetId={card.embedData.tweetId as string} />
              )}
              {card.embedType !== 'youtube' && card.embedType !== 'twitter' && (
                <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-white">
                  {card.preview?.image && (
                    <img
                      src={card.preview.image}
                      alt={card.preview.title || card.title || 'Link preview'}
                      className="w-full max-h-[40vh] object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                  <div className="p-5 space-y-2">
                    {card.preview?.siteName && (
                      <p className="section-label">{card.preview.siteName}</p>
                    )}
                    {(card.preview?.title || card.title) && (
                      <p className="text-base font-semibold text-text leading-snug">
                        {card.preview?.title || card.title}
                      </p>
                    )}
                    {card.preview?.description && (
                      <p className="text-sm text-text-muted leading-relaxed">
                        {card.preview.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3.5 py-2.5 rounded-lg bg-[#f9fafb] border border-[var(--color-border)] hover:border-accent-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm text-accent-primary break-all">↗ {card.url}</p>
              </a>
            </div>
          )}

          {/* Caption for media */}
          {(card.type === 'image' || card.type === 'video') && card.caption && (
            <p className="mt-3 text-sm text-text-muted text-center italic">
              {card.caption}
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-[var(--color-border)]">
          <TagInput
            tags={tags}
            availableTags={allTags}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            label="Tags"
          />
        </div>

        {card.subnotes.length > 0 && (
          <div className="pt-4 border-t border-[var(--color-border)]">
            <p className="section-label mb-2">Subnotes</p>
            <div className="space-y-2">
              {card.subnotes.map((subnote) => (
                <div
                  key={subnote.id}
                  className="p-3 bg-[#f9fafb] rounded-lg border border-[var(--color-border)] text-sm"
                >
                  {subnote.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {(card.author || card.sourceUrl || card.siteName) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted pt-3">
            {card.author && <span className="text-text">{card.author}</span>}
            {card.author && (card.siteName || card.sourceUrl) && <span>·</span>}
            {card.sourceUrl ? (
              <a
                href={card.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-text underline underline-offset-2 truncate max-w-[280px]"
              >
                {card.siteName || getHostname(card.sourceUrl)}
              </a>
            ) : (
              card.siteName && <span>{card.siteName}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-text-muted pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            {memberSpaces.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color || '#94a3b8' }} />
                {s.name}
              </span>
            ))}
            <span>{new Date(card.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex justify-between pt-3">
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closeModal}>
              Close
            </Button>
            <Button variant="primary" onClick={handleEdit}>
              Edit
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
