import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CardPosition } from '@/core/types'
import { layoutKeyForSpace, positionFor } from '@/core/types'
import { useCardsStore, useLayoutStore, useSpacesStore } from '@/core/stores'
import { Card } from '../cards/Card'
import { clsx } from 'clsx'

const MIN_ZOOM = 0.15
const MAX_ZOOM = 2.5
const ZOOM_STEP = 1.2

/** Pointer travel before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4

interface Viewport {
  x: number
  y: number
  zoom: number
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

/**
 * Full-viewport canvas. Rendered outside the app shell rather than inside the
 * main column — a spatial surface boxed in beside a sidebar and a rail defeats
 * the point of it.
 */
export function CanvasView({ spaceId }: { spaceId: string | null }) {
  const getSpaceById = useSpacesStore((s) => s.getSpaceById)
  const getCardsBySpace = useCardsStore((s) => s.getCardsBySpace)
  // getCardsBySpace reads these off the store, so subscribe for re-renders.
  useCardsStore((s) => s.cards)

  const cards = getCardsBySpace(spaceId)
  const space = spaceId ? getSpaceById(spaceId) : null

  const spaceKey = layoutKeyForSpace(spaceId)

  const layouts = useLayoutStore((s) => s.layouts)
  const setPositions = useLayoutStore((s) => s.setPositions)
  const layout = layouts[spaceKey]

  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)

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
      setPositions(spaceKey, { [cardId]: next })
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

  /**
   * Frame every card. Card heights aren't known ahead of render — they size to
   * their content — so the extent is estimated from widths and a nominal
   * height, then padded. Close enough to frame, and the user can nudge.
   */
  const fitToContent = useCallback(() => {
    const el = containerRef.current
    if (!el || placed.length === 0) return

    const NOMINAL_HEIGHT = 320
    const PAD = 60
    const minX = Math.min(...placed.map((p) => p.pos.x))
    const minY = Math.min(...placed.map((p) => p.pos.y))
    const maxX = Math.max(...placed.map((p) => p.pos.x + p.pos.w))
    const maxY = Math.max(...placed.map((p) => p.pos.y + NOMINAL_HEIGHT))

    const { width, height } = el.getBoundingClientRect()
    const zoom = clampZoom(
      Math.min((width - PAD * 2) / (maxX - minX), (height - PAD * 2) / (maxY - minY))
    )

    setViewport({
      zoom,
      x: PAD - minX * zoom + (width - PAD * 2 - (maxX - minX) * zoom) / 2,
      y: PAD - minY * zoom + (height - PAD * 2 - (maxY - minY) * zoom) / 2,
    })
  }, [placed])

  const resetView = () => setViewport({ x: 0, y: 0, zoom: 1 })

  // Frame the content on open rather than dropping the user at 100% in a
  // corner. Runs once — refitting on every card change would fight the user.
  const didFit = useRef(false)
  useEffect(() => {
    if (didFit.current || placed.length === 0) return
    didFit.current = true
    fitToContent()
  }, [placed.length, fitToContent])

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

  return (
    <div className="canvas-surface fixed inset-0 z-40 overflow-hidden bg-[#fbfbfd]">
      <div
        ref={containerRef}
        onPointerDown={startPan}
        className={clsx(
          'absolute inset-0 touch-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(15,23,42,0.10) 1px, transparent 1px)',
          backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          {placed.map(({ card, pos }) => (
            <div
              key={card.id}
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

      <div className="canvas-chrome absolute top-4 left-4 z-30 flex items-center gap-2">
        <span className="px-3 h-8 inline-flex items-center rounded-full bg-white/90 backdrop-blur-md border border-white/60 shadow-soft text-xs font-medium text-text">
          {space?.name || 'All cards'}
        </span>
        <span className="px-2.5 h-8 inline-flex items-center rounded-full bg-white/70 backdrop-blur-md border border-white/60 text-[11px] tabular-nums text-text-muted">
          {cards.length} card{cards.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={fitToContent}
          title="Fit everything (⌘1)"
          className="px-3 h-8 rounded-full bg-white/90 backdrop-blur-md border border-white/60 shadow-soft text-xs font-medium text-text hover:bg-white transition-colors"
        >
          Fit
        </button>
        <button
          onClick={() => window.print()}
          title="Print or save as PDF"
          className="px-3 h-8 rounded-full bg-[#0f172a] text-white text-xs font-medium hover:bg-[#1e293b] transition-colors shadow-soft"
        >
          Save as PDF
        </button>
      </div>

      <div className="canvas-chrome absolute bottom-4 right-4 z-30 flex items-center gap-1 p-1 rounded-full bg-white/90 backdrop-blur-md border border-white/60 shadow-soft">
        <ZoomButton label="Zoom out" onClick={() => setViewport((v) => ({ ...v, zoom: clampZoom(v.zoom / ZOOM_STEP) }))}>
          <path d="M5 12h14" />
        </ZoomButton>
        <button
          onClick={resetView}
          title="Reset view"
          className="px-2 h-7 text-[11px] tabular-nums text-text-muted hover:text-text transition-colors"
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
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-text hover:bg-white transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {children}
      </svg>
    </button>
  )
}
