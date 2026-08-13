import { useState } from 'react'
import { useSpacesStore } from '@/core/stores'
import { Input, Button } from '../ui'
import { SPACE_COLORS } from '@/core/palette'
import { clsx } from 'clsx'

interface SpaceFormProps {
  onClose: () => void
}

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
      <div className="flex gap-1.5 flex-wrap">
        {SPACE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={clsx(
              'w-5 h-5 rounded-full transition-transform',
              color === c ? 'ring-2 ring-offset-2 ring-accent scale-110' : 'hover:scale-110'
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
