import { useEffect, useState } from 'react'

/**
 * A band rather than a line. On a trackpad the scroll position wobbles by a few
 * pixels while apparently still, and a bare comparison flips back and forth
 * whenever you happen to come to rest on the threshold.
 */
const HYSTERESIS = 24

/** True once the page has scrolled past `threshold`, false once well back above it. */
export function useScrolledPast(threshold: number): boolean {
  const [past, setPast] = useState(false)

  useEffect(() => {
    let frame = 0

    const read = () => {
      frame = 0
      setPast((was) => window.scrollY > (was ? threshold - HYSTERESIS : threshold))
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [threshold])

  return past
}
