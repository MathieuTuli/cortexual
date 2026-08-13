import { useEffect, useRef, useState } from 'react'
import type { NoteCard } from '@/core/types'
import { useCardsStore } from '@/core/stores'

/** Long enough that you aren't fighting it, short enough to feel like autosave. */
const SAVE_DELAY_MS = 700

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/**
 * A plain writing surface for a project's notes. Deliberately not a rich text
 * editor: the body is the same string the search index reads, so anything that
 * wrapped it in markup would make documents less findable than the cards
 * around them.
 *
 * Mount this with `key={doc.id}`. State is seeded from props once, so a
 * remount is what switches documents — reacting to a prop change instead would
 * also fire on our own save round-tripping back through the store, and eat
 * whatever was typed in between.
 */
export function DocEditor({ doc }: { doc: NoteCard }) {
  const updateCard = useCardsStore((s) => s.updateCard)

  const [title, setTitle] = useState(doc.title ?? '')
  const [content, setContent] = useState(doc.content)
  const [dirty, setDirty] = useState(false)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Reads the latest draft when the timer fires, without restarting the timer
  // on every keystroke.
  const draft = useRef({ title, content })
  draft.current = { title, content }

  const queueSave = () => {
    setDirty(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const { title: t, content: c } = draft.current
      updateCard(doc.id, { title: t.trim(), content: c })
      setDirty(false)
    }, SAVE_DELAY_MS)
  }

  // A tab close mid-sentence should not lose the sentence.
  useEffect(() => {
    const flush = () => {
      if (!timer.current) return
      clearTimeout(timer.current)
      timer.current = null
      const { title: t, content: c } = draft.current
      updateCard(doc.id, { title: t.trim(), content: c })
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [doc.id, updateCard])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 mb-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            queueSave()
          }}
          placeholder="Untitled"
          className="flex-1 bg-transparent border-0 p-0 text-2xl font-semibold tracking-tight text-text placeholder:text-text-faint focus:outline-none"
        />
        <span className="text-xs tabular-nums text-text-faint flex-shrink-0">
          {dirty ? 'Saving…' : 'Saved'}
        </span>
      </div>

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          queueSave()
        }}
        placeholder="Start writing…"
        className="flex-1 min-h-[50vh] w-full resize-none rounded-lg bg-chip px-5 py-4 text-[15px] leading-relaxed text-text-body placeholder:text-text-faint border-0 focus:outline-none focus:ring-2 focus:ring-accent/25"
      />

      <p className="mt-2 text-xs text-text-faint tabular-nums">
        {countWords(content)} words · edited {new Date(doc.updatedAt).toLocaleString()}
      </p>
    </div>
  )
}
