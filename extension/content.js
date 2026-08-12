// Floating "save highlight" affordance. Kept deliberately small: it reads the
// selection and the page's own metadata, then hands off to the worker, which
// is the only side that can reach the daemon.

let bubble = null

function pageAuthor() {
  const meta =
    document.querySelector('meta[name="author"]')?.content ||
    document.querySelector('meta[property="article:author"]')?.content
  if (meta) return meta.trim()

  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(node.textContent)
      for (const entry of Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])]) {
        const author = entry?.author
        const name = Array.isArray(author) ? author[0]?.name : author?.name || author
        if (typeof name === 'string' && name.trim()) return name.trim()
      }
    } catch {
      // Malformed ld+json is common; ignore it.
    }
  }
  return undefined
}

function canonicalUrl() {
  return document.querySelector('link[rel="canonical"]')?.href || location.href
}

function siteName() {
  return (
    document.querySelector('meta[property="og:site_name"]')?.content || location.hostname.replace(/^www\./, '')
  )
}

function removeBubble() {
  bubble?.remove()
  bubble = null
}

function showToast(ok) {
  const toast = document.createElement('div')
  toast.className = 'cortexual-toast'
  toast.textContent = ok ? 'Saved to Cortexual' : 'Could not reach Cortexual'
  toast.dataset.ok = String(ok)
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2200)
}

function showBubble(selection) {
  removeBubble()

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return

  const text = selection.toString().trim()
  if (text.length < 2) return

  bubble = document.createElement('button')
  bubble.className = 'cortexual-bubble'
  bubble.textContent = '❝ Save'
  bubble.style.top = `${window.scrollY + rect.bottom + 8}px`
  bubble.style.left = `${window.scrollX + rect.left}px`

  bubble.addEventListener('mousedown', (e) => {
    // mousedown, not click: clicking would clear the selection first.
    e.preventDefault()
    e.stopPropagation()

    bubble.textContent = 'Saving…'
    chrome.runtime.sendMessage(
      {
        type: 'cortexual:save-highlight',
        payload: {
          text,
          url: canonicalUrl(),
          title: document.title,
          author: pageAuthor(),
          siteName: siteName(),
        },
      },
      (response) => {
        showToast(Boolean(response?.ok))
        removeBubble()
      }
    )
  })

  document.body.appendChild(bubble)
}

document.addEventListener('selectionchange', () => {
  const selection = document.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    removeBubble()
    return
  }
  // Debounced via rAF so dragging a selection doesn't thrash the DOM.
  requestAnimationFrame(() => {
    const current = document.getSelection()
    if (current && !current.isCollapsed && current.rangeCount) showBubble(current)
  })
})

document.addEventListener('scroll', removeBubble, { passive: true })

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'cortexual:toast') showToast(message.ok)
})

/**
 * Media as the page actually rendered it.
 *
 * Instagram serves an empty JS shell to any server-side fetch — no og tags, no
 * CDN urls, nothing — so scraping it from the daemon returns zero. In here the
 * post is a real DOM, on your session, already loaded. That's the difference,
 * and it's why this lives in the content script rather than the server.
 */
function collectPageMedia() {
  const post =
    document.querySelector('article[role="presentation"]') ||
    document.querySelector('article') ||
    document.body

  const media = []
  const seen = new Set()

  const push = (url, kind) => {
    if (!url || seen.has(url)) return
    // Avatars, emoji and UI chrome all live in the same DOM.
    if (/\/(rsrc\.php|static\.cdninstagram\.com\/rsrc)/.test(url)) return
    seen.add(url)
    media.push({ url, kind })
  }

  /** srcset's widest candidate, so a carousel isn't saved at thumbnail size. */
  const widest = (img) => {
    if (!img.srcset) return img.currentSrc || img.src
    return (
      img.srcset
        .split(',')
        .map((part) => {
          const [url, size] = part.trim().split(/\s+/)
          return { url, width: parseInt(size) || 0 }
        })
        .sort((a, b) => b.width - a.width)[0]?.url || img.src
    )
  }

  for (const img of post.querySelectorAll('img')) {
    if (img.naturalWidth && img.naturalWidth < 200) continue
    push(widest(img), 'image')
  }

  for (const video of post.querySelectorAll('video')) {
    push(video.currentSrc || video.src || video.querySelector('source')?.src, 'video')
  }

  return {
    source: location.hostname.includes('instagram') ? 'instagram' : 'page',
    author:
      document.querySelector('meta[property="og:title"]')?.content ||
      location.pathname.split('/').filter(Boolean)[0],
    text: document.querySelector('meta[property="og:description"]')?.content,
    media,
    // Instagram only keeps the visible slides mounted, so a carousel yields
    // what you've scrolled through rather than all of it.
    partial: media.length > 0 && Boolean(post.querySelector('[aria-label*="Next"]')),
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'cortexual:collect-media') return
  try {
    sendResponse(collectPageMedia())
  } catch (error) {
    sendResponse({ media: [], error: error.message })
  }
  return true
})
