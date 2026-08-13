import { useCallback, useEffect, useRef, useState } from 'react'

/** How long heights must hold still before they count as settled. */
const SETTLE_MS = 250

export interface MeasuredHeights {
  /** Attach to each item's wrapper; pass null on unmount. */
  measure: (id: string) => (element: HTMLElement | null) => void
  /** Current rendered heights. A ref, so reading it never forces a render. */
  heights: React.MutableRefObject<Map<string, number>>
  /** True once every id has a height and nothing has resized for a beat. */
  settled: boolean
}

/**
 * Rendered heights for a set of ids, watched rather than sampled once. Cards
 * size to their content and most of that content is images, so a height read
 * on mount is the height of an empty box — anything that packs against those
 * numbers overlaps the moment the pictures arrive.
 */
export function useMeasuredHeights(ids: string[]): MeasuredHeights {
  const heights = useRef(new Map<string, number>())
  const elements = useRef(new Map<string, HTMLElement>())
  const observer = useRef<ResizeObserver | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [settled, setSettled] = useState(false)

  const expected = ids.length
  const idKey = ids.join(',')

  const markUnsettled = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setSettled(heights.current.size >= expected && expected > 0)
    }, SETTLE_MS)
  }, [expected])

  useEffect(() => {
    const resize = new ResizeObserver((entries) => {
      let changed = false
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.measureId
        if (!id) continue
        const next = entry.contentRect.height
        if (heights.current.get(id) !== next) {
          heights.current.set(id, next)
          changed = true
        }
      }
      if (changed) {
        setSettled(false)
        markUnsettled()
      }
    })

    observer.current = resize
    for (const element of elements.current.values()) resize.observe(element)
    markUnsettled()

    return () => {
      resize.disconnect()
      observer.current = null
      if (timer.current) clearTimeout(timer.current)
    }
  }, [markUnsettled])

  // Cards leaving the canvas must not keep a stale height, or the pack leaves
  // a gap where they used to be.
  useEffect(() => {
    const live = new Set(idKey ? idKey.split(',') : [])
    for (const id of heights.current.keys()) {
      if (!live.has(id)) heights.current.delete(id)
    }
    markUnsettled()
  }, [idKey, markUnsettled])

  const measure = useCallback((id: string) => {
    return (element: HTMLElement | null) => {
      const previous = elements.current.get(id)
      if (previous && previous !== element) {
        observer.current?.unobserve(previous)
        elements.current.delete(id)
      }
      if (!element) return
      element.dataset.measureId = id
      elements.current.set(id, element)
      // offsetHeight, not getBoundingClientRect: the canvas scales its contents
      // with a transform, and only the former reports the unscaled layout size.
      heights.current.set(id, element.offsetHeight)
      observer.current?.observe(element)
    }
  }, [])

  return { measure, heights, settled }
}
