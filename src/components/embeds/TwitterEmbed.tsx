import { useEffect, useRef, useState } from 'react'

interface TwitterEmbedProps {
  tweetId: string
}

declare global {
  interface Window {
    twttr?: {
      ready: (callback: () => void) => void
      widgets: {
        load: (element?: HTMLElement) => void
        createTweet: (
          tweetId: string,
          element: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<HTMLElement | undefined>
      }
    }
  }
}

// Load Twitter widget script once
let twitterScriptPromise: Promise<void> | null = null

function loadTwitterScript(): Promise<void> {
  if (twitterScriptPromise) return twitterScriptPromise

  twitterScriptPromise = new Promise((resolve) => {
    // Check if already loaded
    if (window.twttr?.widgets) {
      resolve()
      return
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="platform.twitter.com/widgets.js"]')
    if (existingScript) {
      // Wait for it to load
      const checkReady = () => {
        if (window.twttr?.widgets) {
          resolve()
        } else {
          setTimeout(checkReady, 100)
        }
      }
      checkReady()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.charset = 'utf-8'

    script.onload = () => {
      // Twitter widgets.js calls twttr.ready when it's ready
      if (window.twttr?.ready) {
        window.twttr.ready(() => resolve())
      } else {
        // Fallback: poll for ready state
        const checkReady = () => {
          if (window.twttr?.widgets) {
            resolve()
          } else {
            setTimeout(checkReady, 100)
          }
        }
        checkReady()
      }
    }

    document.head.appendChild(script)
  })

  return twitterScriptPromise
}

// Cache for tweet HTML
const CACHE_KEY_PREFIX = 'tweet-cache-v3-' // v3 to invalidate old caches for new scaling approach
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CachedTweet {
  html: string
  timestamp: number
}

function getCachedTweet(tweetId: string): string | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${tweetId}`)
    if (!cached) return null

    const data: CachedTweet = JSON.parse(cached)
    const age = Date.now() - data.timestamp

    if (age > CACHE_EXPIRY_MS) {
      // Cache expired
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${tweetId}`)
      return null
    }

    return data.html
  } catch (err) {
    console.error('[TwitterEmbed] Cache read error:', err)
    return null
  }
}

function cacheTweet(tweetId: string, html: string): void {
  try {
    const data: CachedTweet = {
      html,
      timestamp: Date.now(),
    }
    localStorage.setItem(`${CACHE_KEY_PREFIX}${tweetId}`, JSON.stringify(data))
  } catch (err) {
    console.error('[TwitterEmbed] Cache write error:', err)
  }
}

const TWITTER_WIDGET_WIDTH = 550 // Twitter's default widget width

export function TwitterEmbed({ tweetId }: TwitterEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [scale, setScale] = useState(1)
  const [containerHeight, setContainerHeight] = useState(200)
  const embedAttemptedRef = useRef(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tweetUrl = `https://twitter.com/i/status/${tweetId}`

  // Scale the embed to fit the container
  const updateScale = () => {
    if (!wrapperRef.current || !containerRef.current) return

    // Get wrapper width (constrained by CSS contain: inline-size)
    const availableWidth = wrapperRef.current.offsetWidth

    const tweetWidget = containerRef.current.querySelector('twitter-widget') as HTMLElement
    // Twitter widgets render at 550px by default, but can vary
    const tweetWidth = tweetWidget?.offsetWidth || TWITTER_WIDGET_WIDTH
    const tweetHeight = tweetWidget?.offsetHeight || 400

    // Calculate scale to fit the available width
    // Using tweetWidth / 2 because the measured width seems to be double the visual width
    if (tweetWidth > 0 && availableWidth > 0) {
      const effectiveTweetWidth = tweetWidth / 2
      const newScale = Math.min(availableWidth / effectiveTweetWidth, 1)
      setScale(newScale)
      setContainerHeight(tweetHeight * newScale)
    }
  }

  useEffect(() => {
    let mounted = true
    embedAttemptedRef.current = false

    // Try to load from cache first
    const cachedHtml = getCachedTweet(tweetId)
    if (cachedHtml && containerRef.current) {
      console.log('[TwitterEmbed] Using cached tweet:', tweetId)
      containerRef.current.innerHTML = cachedHtml
      setIsLoading(false)
      setError(false)
      // Update scale for cached tweet
      setTimeout(updateScale, 100)
      return
    }

    async function embedTweet() {
      if (!containerRef.current || embedAttemptedRef.current) return
      embedAttemptedRef.current = true

      try {
        console.log('[TwitterEmbed] Loading tweet:', tweetId)
        await loadTwitterScript()
        console.log('[TwitterEmbed] Twitter script loaded')

        if (!mounted || !containerRef.current) return

        // Clear any existing content
        containerRef.current.innerHTML = ''

        if (window.twttr?.widgets) {
          console.log('[TwitterEmbed] Creating tweet embed...')
          const tweet = await window.twttr.widgets.createTweet(
            tweetId,
            containerRef.current,
            {
              theme: 'light',
              dnt: true,
              conversation: 'none',
            }
          )

          if (mounted) {
            console.log('[TwitterEmbed] Tweet created:', tweet ? 'success' : 'failed')

            // Clear the fallback timer since we got a result
            if (fallbackTimerRef.current) {
              clearTimeout(fallbackTimerRef.current)
              fallbackTimerRef.current = null
            }

            setIsLoading(false)
            if (!tweet) {
              console.warn('[TwitterEmbed] Tweet embed returned null - tweet may not exist or be private')
              setError(true)
            } else {
              // Cache the successfully loaded tweet
              if (containerRef.current) {
                const html = containerRef.current.innerHTML
                if (html) {
                  cacheTweet(tweetId, html)
                  console.log('[TwitterEmbed] Tweet cached')
                }
              }
              // Update scale after tweet renders
              setTimeout(updateScale, 100)
            }
          }
        } else {
          console.error('[TwitterEmbed] Twitter widgets not available')
          if (mounted) {
            if (fallbackTimerRef.current) {
              clearTimeout(fallbackTimerRef.current)
              fallbackTimerRef.current = null
            }
            setIsLoading(false)
            setError(true)
          }
        }
      } catch (err) {
        console.error('[TwitterEmbed] Failed to load tweet:', err)
        if (mounted) {
          if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current)
            fallbackTimerRef.current = null
          }
          setIsLoading(false)
          setError(true)
        }
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(embedTweet, 100)

    // Fallback timeout - if still loading after 10 seconds, show error
    fallbackTimerRef.current = setTimeout(() => {
      if (mounted) {
        console.warn('[TwitterEmbed] Embed timeout - showing fallback')
        setIsLoading(false)
        setError(true)
      }
    }, 10000)

    return () => {
      mounted = false
      clearTimeout(timer)
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
  }, [tweetId])

  // Handle resize
  useEffect(() => {
    if (!wrapperRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      updateScale()
    })
    resizeObserver.observe(wrapperRef.current)

    return () => resizeObserver.disconnect()
  }, [isLoading])

  return (
    <div className="twitter-embed" ref={wrapperRef}>
      {isLoading && (
        <div className="p-4 bg-gradient-to-b from-white to-[#e8f4fc] border-2 border-[#a8d4f0] rounded-lg">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-medium text-[#1da1f2]">🐦 Loading tweet...</span>
          </div>
        </div>
      )}

      <div
        className={isLoading ? 'hidden' : 'relative'}
        style={{ height: containerHeight }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          ref={containerRef}
        />
      </div>

      {error && !isLoading && (
        <div className="p-4 bg-gradient-to-b from-white to-[#e8f4fc] border-2 border-[#a8d4f0] rounded-lg">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🐦</span>
              <span className="text-sm font-medium text-[#1da1f2]">Twitter/X Post</span>
            </div>
            <a
              href={tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-primary hover:underline text-sm break-all"
              onClick={(e) => e.stopPropagation()}
            >
              View on X/Twitter
            </a>
            <p className="text-xs text-text-muted">
              Tweet ID: {tweetId}
            </p>
            <p className="text-xs text-text-muted italic">
              Embed unavailable - check console for details
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
