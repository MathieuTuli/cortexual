import { useState, useEffect } from 'react'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import type { Card, Subnote } from '@/core/types'
import { generateId } from '@/core/utils'
import { Modal, Button, Input, Textarea, TagInput } from '../ui'

export function EditCardModal() {
  const isOpen = useAppStore((s) => s.isEditModalOpen)
  const editingCardId = useAppStore((s) => s.editingCardId)
  const closeModal = useAppStore((s) => s.closeEditModal)
  const cards = useCardsStore((s) => s.cards)
  const updateCard = useCardsStore((s) => s.updateCard)
  const deleteCard = useCardsStore((s) => s.deleteCard)
  const spaces = useSpacesStore((s) => s.spaces)

  // Compute allTags from cards array (not calling a function in the selector)
  const allTags = Array.from(new Set(cards.flatMap((c) => c.tags))).sort()

  const card = cards.find((c) => c.id === editingCardId)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [spaceId, setSpaceId] = useState('')
  const [subnotes, setSubnotes] = useState<Subnote[]>([])
  const [newSubnote, setNewSubnote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubnotes, setShowSubnotes] = useState(false)

  useEffect(() => {
    if (card) {
      setTitle(card.title || '')
      setContent('content' in card ? (card.content as string) : '')
      setCaption('caption' in card ? (card.caption as string) || '' : '')
      setTags([...card.tags])
      setSpaceId(card.spaceId)
      setSubnotes([...card.subnotes])
    }
  }, [card])

  if (!card) return null

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag])
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const addSubnote = () => {
    if (!newSubnote.trim()) return
    const subnote: Subnote = {
      id: generateId(),
      content: newSubnote.trim(),
      createdAt: new Date().toISOString(),
    }
    setSubnotes([...subnotes, subnote])
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
        spaceId,
        subnotes,
      }

      if (card.type === 'note') {
        (updates as Partial<Card> & { content: string }).content = content
      }

      if (card.type === 'image' || card.type === 'video') {
        (updates as Partial<Card> & { caption?: string }).caption = caption || undefined
      }

      await updateCard(card.id, updates)
      closeModal()
    } catch (error) {
      console.error('Failed to update card:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this card?')) {
      await deleteCard(card.id)
      closeModal()
    }
  }

  return (
    <Modal open={isOpen} onOpenChange={closeModal} title={`Edit [${card.type}]`}>
      <div className="space-y-4">
        {/* Title */}
        <Input
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Content (notes only) */}
        {card.type === 'note' && (
          <Textarea
            placeholder="Note content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        )}

        {/* Display for other types */}
        {card.type === 'link' && (
          <div className="p-3 bg-surface border border-border">
            <p className="font-mono text-sm text-accent-cyber break-all">{card.url}</p>
          </div>
        )}

        {(card.type === 'image' || card.type === 'video') && (
          <>
            <div className="p-3 bg-surface border border-border">
              <p className="font-mono text-sm text-text-muted">
                [{card.type} attached]
              </p>
            </div>
            <Input
              placeholder="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </>
        )}

        {/* Tags */}
        <TagInput
          tags={tags}
          availableTags={allTags}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          label="🏷️ Tags"
        />

        {/* Space */}
        <div>
          <label className="block text-xs font-mono text-text-muted mb-1 uppercase">
            Space
          </label>
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="w-full bg-surface border-3 border-border px-3 py-2 font-mono text-text focus:outline-none focus:border-accent-cyber"
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.icon ? `${space.icon} ` : ''}{space.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subnotes */}
        <div className="border-t-3 border-border pt-4">
          <button
            onClick={() => setShowSubnotes(!showSubnotes)}
            className="flex items-center gap-2 font-mono text-sm text-text-muted hover:text-text"
          >
            <span>[{showSubnotes ? '-' : '+'}]</span>
            <span>Subnotes ({subnotes.length})</span>
          </button>

          {showSubnotes && (
            <div className="mt-3 space-y-2">
              {subnotes.map((subnote) => (
                <div
                  key={subnote.id}
                  className="flex items-start gap-2 p-2 bg-surface border border-border"
                >
                  <p className="flex-1 font-mono text-sm">{subnote.content}</p>
                  <button
                    onClick={() => removeSubnote(subnote.id)}
                    className="text-text-muted hover:text-red-500 font-mono text-xs"
                  >
                    [x]
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Add subnote..."
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

        {/* Metadata */}
        <div className="text-xs font-mono text-text-muted space-y-1 pt-4 border-t border-border">
          <p>Created: {new Date(card.createdAt).toLocaleString()}</p>
          <p>Updated: {new Date(card.updatedAt).toLocaleString()}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-6">
        <Button variant="danger" onClick={handleDelete}>
          Delete
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
