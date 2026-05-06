import { useEffect, useState } from 'react'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
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
  const space = card ? spaces.find((s) => s.id === card.spaceId) : null
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
                    className="absolute left-0 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
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
                    className="absolute right-0 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
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
                      className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                        index === currentImageIndex
                          ? 'border-accent-primary ring-2 ring-accent-secondary'
                          : 'border-[#a8d4f0] opacity-70 hover:opacity-100'
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
              {/* Link preview image */}
              {card.preview?.image && (
                <div className="flex justify-center">
                  <img
                    src={card.preview.image}
                    alt={card.title || 'Link preview'}
                    className="max-w-full max-h-[40vh] object-contain rounded"
                  />
                </div>
              )}
              {card.embedType === 'youtube' && card.embedData && 'videoId' in card.embedData && (
                <YouTubeEmbed videoId={card.embedData.videoId as string} />
              )}
              {card.embedType === 'twitter' && card.embedData && 'tweetId' in card.embedData && (
                <TwitterEmbed tweetId={card.embedData.tweetId as string} />
              )}
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-gradient-to-b from-[#e8f4fc] to-white rounded-lg border border-[#a8d4f0] hover:border-accent-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm text-accent-primary break-all">{card.url}</p>
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

        {/* Tags - Editable */}
        <div className="pt-3 border-t border-[#a8d4f0]">
          <TagInput
            tags={tags}
            availableTags={allTags}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            label="🏷️ Tags"
          />
        </div>

        {/* Subnotes */}
        {card.subnotes.length > 0 && (
          <div className="pt-3 border-t border-[#a8d4f0]">
            <p className="text-xs font-medium text-text-muted mb-2">Subnotes</p>
            <div className="space-y-2">
              {card.subnotes.map((subnote) => (
                <div
                  key={subnote.id}
                  className="p-2 bg-gradient-to-b from-[#f0f8ff] to-white rounded border border-[#a8d4f0] text-sm"
                >
                  {subnote.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-text-muted pt-3 border-t border-[#a8d4f0]">
          <div className="flex items-center gap-2">
            {space && (
              <span className="bg-[#e8f4fc] px-2 py-0.5 rounded">
                {space.icon || '📁'} {space.name}
              </span>
            )}
            <span>{new Date(card.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-3">
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
          <div className="flex gap-3">
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
