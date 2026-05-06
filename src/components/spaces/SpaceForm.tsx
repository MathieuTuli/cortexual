import { useState } from 'react'
import { useSpacesStore } from '@/core/stores'
import { Input, Button } from '../ui'
import { clsx } from 'clsx'

interface SpaceFormProps {
  onClose: () => void
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
]

export function SpaceForm({ onClose }: SpaceFormProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const createSpace = useSpacesStore((s) => s.createSpace)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    await createSpace({
      name: name.trim(),
      icon: icon || undefined,
      color: color || undefined,
    })

    setName('')
    setIcon('')
    setColor(null)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-12 text-center"
          maxLength={2}
        />
        <Input
          placeholder="Space name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="flex gap-1 flex-wrap">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={clsx(
              'w-5 h-5 rounded-full border-2 transition-transform',
              color === c ? 'border-white ring-2 ring-offset-1 ring-gray-400 scale-110' : 'border-transparent hover:scale-110'
            )}
            style={{ backgroundColor: c }}
            onClick={() => setColor(color === c ? null : c)}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!name.trim()}>
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
