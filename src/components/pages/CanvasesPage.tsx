import { useMemo } from 'react'
import { useCardsStore, useLayoutStore, useProjectsStore } from '@/core/stores'
import type { CanvasLayout, Project } from '@/core/types'
import { cardIsInProject, projectLayoutKey } from '@/core/types'
import { go, hrefFor } from '@/core/router'
import { BarNav } from '../layout/BarNav'

interface CanvasEntry {
  project: Project
  count: number
  layout: CanvasLayout
}

/** Nominal card height, for a preview that only needs the right proportions. */
const THUMB_CARD_HEIGHT = 320

/** A miniature of the arrangement itself, drawn from the saved positions. */
function CanvasThumb({ layout }: { layout: CanvasLayout }) {
  const rects = Object.values(layout)

  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const maxY = Math.max(...rects.map((r) => r.y + THUMB_CARD_HEIGHT))

  return (
    <div className="aspect-[16/10] rounded-lg bg-chip overflow-hidden p-3">
      <svg
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {rects.map((r, i) => (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={THUMB_CARD_HEIGHT}
            rx={16}
            fill="var(--sunken)"
          />
        ))}
      </svg>
    </div>
  )
}

export function CanvasesPage() {
  const cards = useCardsStore((s) => s.cards)
  const projects = useProjectsStore((s) => s.projects)
  const layouts = useLayoutStore((s) => s.layouts)

  /**
   * Only canvases that exist. A canvas comes into being when a project's is
   * opened and arranged — listing one per project before that would be
   * advertising work nobody has done.
   */
  const entries = useMemo<CanvasEntry[]>(
    () =>
      projects
        .map((project) => ({
          project,
          count: cards.filter((c) => cardIsInProject(c, project.id)).length,
          layout: layouts[projectLayoutKey(project.id)],
        }))
        .filter((entry): entry is CanvasEntry => Object.keys(entry.layout ?? {}).length > 0),
    [cards, projects, layouts]
  )

  return (
    <div className="min-h-screen bg-bg">
      <BarNav className="fixed top-5 left-5 z-30" />

      <div className="mx-auto max-w-[1280px] px-10 pt-24 pb-24">
        <h1 className="font-display text-title text-text-faint mb-9">Canvases</h1>

        {entries.length === 0 ? (
          <div>
            <p className="text-lg text-text-muted">No canvases yet.</p>
            <p className="mt-1 text-sm text-text-faint">
              A canvas belongs to a project. Open one from{' '}
              <button
                onClick={() => go({ name: 'projects', projectId: null })}
                className="text-accent hover:underline underline-offset-2"
              >
                Projects
              </button>{' '}
              and it will show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
            {entries.map(({ project, count, layout }) => (
              <a
                key={project.id}
                href={hrefFor({ name: 'canvas', projectId: project.id })}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-xl p-3 -m-3 hover:bg-chip transition-colors"
              >
                <CanvasThumb layout={layout} />
                <div className="flex items-center gap-2 mt-3 px-1">
                  {project.color && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                  )}
                  <span className="text-[15px] text-text truncate">{project.name}</span>
                  <span className="ml-auto text-xs tabular-nums text-text-faint">{count}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
