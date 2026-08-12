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
