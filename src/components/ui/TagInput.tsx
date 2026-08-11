import { useState, useRef, useEffect } from 'react'
import { Tag } from './Tag'
import { Input } from './Input'

interface TagInputProps {
  tags: string[]
  availableTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  placeholder?: string
  label?: string
}

export function TagInput({
  tags,
  availableTags,
  onAddTag,
  onRemoveTag,
  placeholder = 'Add tags (press Enter)',
  label,
}: TagInputProps) {
  const [tagInput, setTagInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter available tags to exclude already selected ones
  const unusedTags = availableTags.filter((t) => !tags.includes(t))

  // Filter by input and limit to 3
  const filteredTags = tagInput.trim()
    ? unusedTags.filter((t) => t.toLowerCase().includes(tagInput.toLowerCase())).slice(0, 3)
    : []

  // Show dropdown when there are matching suggestions while typing
  useEffect(() => {
    if (filteredTags.length > 0 && tagInput.trim()) {
      setShowDropdown(true)
    } else if (!tagInput.trim()) {
      setShowDropdown(false)
    }
  }, [tagInput, filteredTags.length])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      onAddTag(trimmed)
    }
    setTagInput('')
    setShowDropdown(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddTag(tagInput)
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const toggleFullDropdown = () => {
    if (showDropdown) {
      setShowDropdown(false)
    } else {
      setShowDropdown(true)
    }
  }

  // Tags to show in dropdown - either filtered (while typing) or all unused (when clicking button)
  const dropdownTags = tagInput.trim() ? filteredTags : unusedTags.slice(0, 10)

  return (
    <div className="space-y-2">
      {label && <label className="section-label block">{label}</label>}
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {tags.map((tag) => (
          <Tag key={tag} onRemove={() => onRemoveTag(tag)}>
            {tag}
          </Tag>
        ))}
      </div>
      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-1">
          <Input
            placeholder={placeholder}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-sm flex-1"
          />
          {unusedTags.length > 0 && (
            <button
              type="button"
              onClick={toggleFullDropdown}
              className="px-2.5 bg-white border border-[var(--color-border)] rounded-lg hover:border-accent-primary text-text-muted text-xs transition-colors"
              title="Show existing tags"
            >
              ▼
            </button>
          )}
        </div>
        {showDropdown && dropdownTags.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto py-1 bg-white rounded-lg border border-[var(--color-border)] shadow-card z-50">
            {dropdownTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="w-full px-3.5 py-1.5 text-left text-sm text-text hover:bg-[#f3f4f6] transition-colors"
                onClick={() => handleAddTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
