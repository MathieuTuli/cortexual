import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { NoteCard, Project } from '@/core/types'
import { projectDocs } from '@/core/types'
import { useCardsStore } from '@/core/stores'
import { DocEditor } from './DocEditor'
import { Button } from '../ui'
import { clsx } from 'clsx'

const TEXT_ACCEPT = {
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
}

/** First non-empty line, for a document nobody titled. */
function summarise(doc: NoteCard): string {
  return doc.title?.trim() || doc.content.split('\n').find((l) => l.trim())?.slice(0, 60) || 'Untitled'
}

export function ProjectDocs({ project }: { project: Project }) {
  const cards = useCardsStore((s) => s.cards)
  const createCard = useCardsStore((s) => s.createCard)
  const createCards = useCardsStore((s) => s.createCards)
  const deleteCard = useCardsStore((s) => s.deleteCard)

  const docs = useMemo(
    () => projectDocs(cards, project.id) as NoteCard[],
    [cards, project.id]
  )
  const [selectedId, setSelectedId] = useState<string | null>(docs[0]?.id ?? null)

  // A deleted or freshly imported document shouldn't leave the pane blank.
  useEffect(() => {
    if (docs.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (!selectedId || !docs.some((d) => d.id === selectedId)) setSelectedId(docs[0].id)
  }, [docs, selectedId])

  const selected = docs.find((d) => d.id === selectedId) ?? null

  const newDoc = async () => {
    const card = await createCard({
      type: 'note',
      isDoc: true,
      spaceIds: [],
      projectIds: [project.id],
      content: '',
      tags: [],
      subnotes: [],
    })
    setSelectedId(card.id)
  }

  const onDrop = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const contents = await Promise.all(files.map((f) => f.text()))
      const created = await createCards(
        files.map((file, i) => ({
          input: {
            type: 'note' as const,
            isDoc: true,
            spaceIds: [],
            projectIds: [project.id],
            title: file.name.replace(/\.(txt|md|markdown)$/i, ''),
            content: contents[i],
            tags: [],
            subnotes: [],
          },
        }))
      )
      if (created[0]) setSelectedId(created[0].id)
    },
    [createCards, project.id]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: TEXT_ACCEPT,
    multiple: true,
    noClick: true,
  })

  const remove = async (doc: NoteCard) => {
    if (!confirm(`Delete "${summarise(doc)}"?`)) return
    await deleteCard(doc.id)
  }

  return (
    <div {...getRootProps()} className="grid grid-cols-[240px_1fr] gap-8 min-h-[60vh]">
      <input {...getInputProps()} />

      <div>
        <Button variant="default" size="sm" onClick={newDoc} className="w-full mb-3">
          New document
        </Button>

        {docs.length === 0 ? (
          <p className="px-3 text-sm text-text-faint">
            Nothing written yet. Drop a .txt or .md file here to bring one in.
          </p>
        ) : (
          <ul className="-mx-1">
            {docs.map((doc) => (
              <li key={doc.id} className="group relative">
                <button
                  onClick={() => setSelectedId(doc.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2 pr-9 rounded-md text-sm truncate transition-colors',
                    doc.id === selectedId
                      ? 'bg-chip text-text'
                      : 'text-text-muted hover:bg-chip hover:text-text'
                  )}
                >
                  {summarise(doc)}
                </button>
                <button
                  onClick={() => remove(doc)}
                  aria-label="Delete document"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-text-faint opacity-0 group-hover:opacity-100 hover:bg-sunken hover:text-danger transition-all"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={clsx('min-w-0', isDragActive && 'ring-2 ring-accent rounded-lg')}>
        {selected ? (
          <DocEditor key={selected.id} doc={selected} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-faint">
            {isDragActive ? 'Drop to add' : 'No document selected.'}
          </div>
        )}
      </div>
    </div>
  )
}
