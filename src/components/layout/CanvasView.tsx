import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { CardPosition } from '@/core/types'
import { CANVAS_GAP, DEFAULT_CARD_WIDTH, positionFor, projectLayoutKey } from '@/core/types'
import { useCardsStore, useLayoutStore, useProjectsStore } from '@/core/stores'
import { useMeasuredHeights } from '@/core/hooks'
import { packToAspect } from '@/core/layout/pack'
import { Card } from '../cards/Card'
import { Button, StarButton } from '../ui'
import { clsx } from 'clsx'

const MIN_ZOOM = 0.15
const MAX_ZOOM = 2.5
const ZOOM_STEP = 1.2

/** Pointer travel before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4

const PILL = 'h-10 px-4 inline-flex items-center rounded-full bg-chip/85 backdrop-blur-xl text-sm'

interface Viewport {
  x: number
  y: number
  zoom: number
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

/**
 * A project's canvas, full viewport. Rendered outside the app shell rather than
 * inside the main column — a spatial surface boxed in beside a sidebar defeats
 * the point of it.
 */
export function CanvasView({ projectId }: { projectId: string }) {
  const getProjectById = useProjectsStore((s) => s.getProjectById)
  const getCardsByProject = useCardsStore((s) => s.getCardsByProject)
  // The getter reads the card list off the store, so subscribe for re-renders.
  useCardsStore((s) => s.cards)

  const cards = getCardsByProject(projectId)
  const title = getProjectById(projectId)?.name

  const layoutId = projectLayoutKey(projectId)

  const layouts = useLayoutStore((s) => s.layouts)
  const setPositions = useLayoutStore((s) => s.setPositions)
  const layout = layouts[layoutId]

  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards])
  const { measure, heights, settled } = useMeasuredHeights(cardIds)

  // Resolved once per render so drag maths and rendering agree on where a card
  // is, including the ones that have never been placed.
  const placed = useMemo(
    () =>
      cards.map((card, index) => ({
        card,
        pos: positionFor(layout || {}, card.id, index),
      })),
    [cards, layout]
  )

  const posRef = useRef(placed)
  posRef.current = placed

  // A card press that turned into a drag must not also open the view modal on
  // release, so the click is swallowed once on the way back up.
  const suppressClickRef = useRef(false)

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = clientX - rect.left
    const py = clientY - rect.top

    setViewport((v) => {
      const zoom = clampZoom(v.zoom * factor)
      const ratio = zoom / v.zoom
      return { zoom, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio }
    })
  }, [])

  // Wheel has to be a native non-passive listener; React's synthetic onWheel is
  // attached passively and cannot preventDefault the browser's page zoom.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
      } else {
        setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const startPan = (e: React.PointerEvent) => {
    // Only the backdrop pans; presses that landed on a card are its own.
    if (e.target !== e.currentTarget) return
    e.preventDefault()

    const origin = { x: e.clientX, y: e.clientY }
    const start = { ...viewport }
    setIsPanning(true)

    const onMove = (ev: PointerEvent) => {
      setViewport({
        ...start,
        x: start.x + (ev.clientX - origin.x),
        y: start.y + (ev.clientY - origin.y),
      })
    }
    const onUp = () => {
      setIsPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startCardDrag = (e: React.PointerEvent, cardId: string) => {
    if (e.button !== 0) return
    e.stopPropagation()

    const origin = { x: e.clientX, y: e.clientY }
    const entry = posRef.current.find((p) => p.card.id === cardId)
    if (!entry) return
    const start = entry.pos
    const zoom = viewport.zoom
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - origin.x
      const dy = ev.clientY - origin.y

      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      if (!moved) {
        moved = true
        setDraggingId(cardId)
      }

      // Screen pixels are canvas pixels only at zoom 1.
      const next: CardPosition = { ...start, x: start.x + dx / zoom, y: start.y + dy / zoom }
      setPositions(layoutId, { [cardId]: next })
    }

    const onUp = () => {
      if (moved) {
        suppressClickRef.current = true
        setDraggingId(null)
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const swallowClickAfterDrag = (e: React.MouseEvent) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  /** Frame every card, using the heights actually on screen. */
  const fitToContent = useCallback(() => {
    const el = containerRef.current
    const current = posRef.current
    if (!el || current.length === 0) return

    const PAD = 60
    const heightOf = (id: string) => heights.current.get(id) ?? 320

    const minX = Math.min(...current.map((p) => p.pos.x))
    const minY = Math.min(...current.map((p) => p.pos.y))
    const maxX = Math.max(...current.map((p) => p.pos.x + p.pos.w))
    const maxY = Math.max(...current.map((p) => p.pos.y + heightOf(p.card.id)))

    const { width, height } = el.getBoundingClientRect()
    const zoom = clampZoom(
      Math.min((width - PAD * 2) / (maxX - minX), (height - PAD * 2) / (maxY - minY))
    )

    setViewport({
      zoom,
      x: PAD - minX * zoom + (width - PAD * 2 - (maxX - minX) * zoom) / 2,
      y: PAD - minY * zoom + (height - PAD * 2 - (maxY - minY) * zoom) / 2,
    })
  }, [heights])

  // Packing changes card widths, which changes their heights, which invalidates
  // the pack it was measured from. One follow-up pass settles it.
  const [repackWanted, setRepackWanted] = useState(false)

  const pack = useCallback(() => {
    const measured = posRef.current.map(({ card }) => ({
      id: card.id,
      height: heights.current.get(card.id) ?? 320,
    }))
    if (measured.length === 0) return
    setPositions(
      layoutId,
      packToAspect(measured, { width: DEFAULT_CARD_WIDTH, gap: CANVAS_GAP })
    )
    setRepackWanted(true)
  }, [heights, layoutId, setPositions])

  useEffect(() => {
    if (!repackWanted || !settled) return
    setRepackWanted(false)
    const measured = posRef.current.map(({ card }) => ({
      id: card.id,
      height: heights.current.get(card.id) ?? 320,
    }))
    setPositions(layoutId, packToAspect(measured, { width: DEFAULT_CARD_WIDTH, gap: CANVAS_GAP }))
    fitToContent()
  }, [repackWanted, settled, heights, layoutId, setPositions, fitToContent])

  /**
   * A canvas nobody has arranged gets packed rather than left in the index-order
   * grid, which is five columns wide and however many hundred rows tall. Only
   * when the layout is completely empty — packing over someone's arrangement
   * would throw it away.
   */
  const unarranged = Object.keys(layout || {}).length === 0 && cards.length > 0
  const didAutoPack = useRef(false)

  useEffect(() => {
    if (didAutoPack.current || !unarranged || !settled) return
    didAutoPack.current = true
    pack()
  }, [unarranged, settled, pack])

  const resetView = () => setViewport({ x: 0, y: 0, zoom: 1 })

  // Frame the content on open rather than dropping the user at 100% in a
  // corner. Runs once — refitting on every card change would fight the user.
  const didFit = useRef(false)
  useEffect(() => {
    if (didFit.current || placed.length === 0 || !settled) return
    didFit.current = true
    fitToContent()
  }, [placed.length, settled, fitToContent])

  /**
   * Print takes whatever transform is live, so frame first or the sheet gets
   * whichever corner happened to be on screen. flushSync because beforeprint
   * fires inside a synchronous window.print(): a normal setState would still be
   * queued when the snapshot is taken, and the fit would land on screen just
   * after the PDF was written without it.
   */
  useEffect(() => {
    const onBeforePrint = () => flushSync(() => fitToContent())
    window.addEventListener('beforeprint', onBeforePrint)
    return () => window.removeEventListener('beforeprint', onBeforePrint)
  }, [fitToContent])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        resetView()
      }
      if (e.key === '1' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        fitToContent()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fitToContent])

  // Cards have to be in the document to be measured, but the pre-pack grid is
  // not something anyone needs to see.
  const hidden = unarranged && !didAutoPack.current

  return (
    <div className="canvas-surface fixed inset-0 z-40 overflow-hidden bg-bg">
      <div
        ref={containerRef}
        onPointerDown={startPan}
        className={clsx(
          'absolute inset-0 touch-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)',
          backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      >
        <div
          className={clsx('absolute top-0 left-0 origin-top-left', hidden && 'opacity-0')}
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          {placed.map(({ card, pos }) => (
            <div
              key={card.id}
              ref={measure(card.id)}
              onPointerDown={(e) => startCardDrag(e, card.id)}
              onClickCapture={swallowClickAfterDrag}
              className={clsx(
                'absolute',
                draggingId === card.id ? 'z-20 opacity-90 cursor-grabbing' : 'z-10'
              )}
              style={{ left: pos.x, top: pos.y, width: pos.w }}
            >
              <Card card={card} />
            </div>
          ))}
        </div>
      </div>

      <div className="canvas-chrome absolute top-5 left-5 z-30 flex items-center gap-2">
        <span className={clsx(PILL, 'text-text')}>{title || 'Canvas'}</span>
        <span className={clsx(PILL, 'tabular-nums text-text-faint')}>
          {cards.length} card{cards.length === 1 ? '' : 's'}
        </span>
        <Button size="sm" onClick={pack} title="Re-pack everything to fit a screen">
          Pack
        </Button>
        <Button size="sm" onClick={fitToContent} title="Fit everything (⌘1)">
          Fit
        </Button>
        <Button size="sm" variant="primary" onClick={() => window.print()} title="Print or save as PDF">
          Save as PDF
        </Button>
      </div>

      <div className="canvas-chrome absolute bottom-5 right-5 z-30 flex items-center gap-1 p-1 rounded-full bg-chip/85 backdrop-blur-xl">
        <ZoomButton label="Zoom out" onClick={() => setViewport((v) => ({ ...v, zoom: clampZoom(v.zoom / ZOOM_STEP) }))}>
          <path d="M5 12h14" />
        </ZoomButton>
        <button
          onClick={resetView}
          title="Reset view"
          className="px-2.5 h-8 text-xs tabular-nums text-text-muted hover:text-text transition-colors"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <ZoomButton label="Zoom in" onClick={() => setViewport((v) => ({ ...v, zoom: clampZoom(v.zoom * ZOOM_STEP) }))}>
          <path d="M12 5v14M5 12h14" />
        </ZoomButton>
      </div>
    </div>
  )
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <StarButton
      size="w-9 h-9"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="text-text-muted hover:text-text"
      style={{ '--star-bg': 'transparent', '--star-bg-hover': 'var(--bg)' } as React.CSSProperties}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {children}
      </svg>
    </StarButton>
  )
}
