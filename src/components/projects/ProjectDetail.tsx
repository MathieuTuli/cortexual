import { useState } from 'react'
import type { Project } from '@/core/types'
import { projectDocs } from '@/core/types'
import { useCardsStore, useProjectsStore } from '@/core/stores'
import { go, hrefFor } from '@/core/router'
import { MasonryGrid } from '../layout/MasonryGrid'
import { CardList } from '../layout/CardList'
import { useViewMode } from '@/core/hooks'
import { ProjectDocs } from './ProjectDocs'
import { useContextMenu, ContextMenu, Marquee } from '../ui'
import { clsx } from 'clsx'

type Tab = 'cards' | 'docs'

export function ProjectDetail({ project }: { project: Project }) {
  const getCardsByProject = useCardsStore((s) => s.getCardsByProject)
  const cards = useCardsStore((s) => s.cards)
  const updateProject = useProjectsStore((s) => s.updateProject)
  const deleteProject = useProjectsStore((s) => s.deleteProject)
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()

  const [tab, setTab] = useState<Tab>('cards')
  const [viewMode] = useViewMode()

  const projectCards = getCardsByProject(project.id)
  const docCount = projectDocs(cards, project.id).length

  const menu = (e: React.MouseEvent) =>
    showContextMenu(e, [
      {
        label: project.status === 'archived' ? 'Make active' : 'Archive',
        onClick: () =>
          updateProject(project.id, {
            status: project.status === 'archived' ? 'active' : 'archived',
          }),
      },
      { label: '', divider: true, onClick: () => {} },
      {
        label: 'Delete project',
        danger: true,
        onClick: () => {
          if (!confirm(`Delete "${project.name}"? Its cards stay in your library.`)) return
          deleteProject(project.id)
          go({ name: 'projects', projectId: null })
        },
      },
    ])

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'cards', label: 'Cards', count: projectCards.length },
    { id: 'docs', label: 'Docs', count: docCount },
  ]

  return (
    <div>
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-title text-text">{project.name}</h1>
          {project.status === 'archived' && (
            <span className="h-6 px-2.5 inline-flex items-center rounded-full bg-chip text-xs text-text-faint">
              archived
            </span>
          )}
          <button
            onClick={menu}
            aria-label="Project actions"
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-faint hover:bg-chip hover:text-text transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </button>

          {/* A real new tab: the canvas is a separate printable document. */}
          <a
            href={hrefFor({ name: 'canvas', projectId: project.id })}
            target="_blank"
            rel="noopener noreferrer"
            className="pill pill--md ml-auto"
            style={
              {
                '--pill-bg': 'var(--accent)',
                '--pill-bg-hover': 'var(--accent-hover)',
                '--pill-fg': 'var(--white)',
              } as React.CSSProperties
            }
          >
            <Marquee text="Open canvas" />
          </a>
        </div>

        {project.description && (
          <p className="mt-2 text-[15px] text-text-muted max-w-2xl">{project.description}</p>
        )}

        <div className="inline-flex p-1 mt-5 rounded-full bg-chip">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'h-8 px-4 rounded-full text-[13px] font-medium transition-colors',
                tab === id ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
              )}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      </header>

      {tab === 'docs' ? (
        <ProjectDocs project={project} />
      ) : projectCards.length === 0 ? (
        <div className="pt-10">
          <p className="text-lg text-text-muted">No cards in this project yet.</p>
          <p className="mt-1 text-sm text-text-faint">
            Open a card anywhere in your library and add it to {project.name}, or capture
            straight into it with the + button.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <CardList cards={projectCards} />
      ) : (
        <MasonryGrid cards={projectCards} />
      )}

      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={hideContextMenu}
        />
      )}
    </div>
  )
}
