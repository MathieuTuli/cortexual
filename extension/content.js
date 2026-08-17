// The in-page half of the extension: a floating affordance on any selection,
// the picker it opens, and the media scraper. Nothing here can reach the daemon
// — a page's own CSP blocks it — so every call goes through the worker.

/*
 * All of it renders inside one shadow root. A content script draws on pages we
 * don't control, and the picker is a form — chips, an input, two buttons —
 * that any site's own `button {}` or `input {}` rule would happily wreck. A
 * shadow tree takes no page CSS at all, and `all: initial` on the host stops
 * inherited font, colour and line-height leaking across the boundary.
 */
const UI_CSS = `
  .bubble {
    position: absolute;
    padding: 7px 14px;
    border: none;
    border-radius: 999px;
    background: #1702fc;
    color: #fff;
    font: 500 12px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(23, 2, 252, 0.35);
  }
  .bubble:hover { background: #1200c9; }

  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 18px;
    border-radius: 999px;
    background: #1702fc;
    color: #fff;
    font: 500 13px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
    box-shadow: 0 6px 20px rgba(23, 2, 252, 0.3);
  }
  .toast[data-ok="false"] {
    background: #d92b2b;
    box-shadow: 0 6px 20px rgba(217, 43, 43, 0.3);
  }

  .scrim {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 32px;
    background: rgba(0, 0, 0, 0.45);
  }

  .panel {
    box-sizing: border-box;
    width: 420px;
    max-width: 100%;
    max-height: 100%;
    overflow-y: auto;
    padding: 20px;
    border-radius: 16px;
    background: #fff;
    color: #000;
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
  }
  .panel:focus { outline: none; }

  .quote {
    display: -webkit-box;
    -webkit-line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
    padding-left: 12px;
    border-left: 3px solid #dfdfdf;
    font-size: 14px;
    line-height: 1.5;
  }

  .source {
    margin: 8px 0 0;
    color: #a29e9c;
    font-size: 12px;
    word-break: break-word;
  }

  .label {
    display: block;
    margin: 18px 0 8px;
    color: #a29e9c;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .chips { display: flex; flex-wrap: wrap; gap: 6px; }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 12px;
    border: none;
    border-radius: 999px;
    background: #f2f2f2;
    color: #000;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .chip:hover { background: #dfdfdf; }
  .chip[aria-pressed="true"] { background: #1702fc; color: #fff; }

  .dot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; }

  .empty, .hint, .status { margin: 0; color: #a29e9c; font-size: 12px; }
  .hint { margin-top: 8px; }
  .status { margin-top: 10px; text-align: right; }

  .input {
    box-sizing: border-box;
    width: 100%;
    height: 36px;
    margin-top: 18px;
    padding: 0 14px;
    border: none;
    border-radius: 12px;
    background: #f2f2f2;
    color: #000;
    font: inherit;
  }
  .input::placeholder { color: #a29e9c; }
  .input:focus { outline: none; background: #dfdfdf; }

  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }

  .button {
    height: 36px;
    padding: 0 18px;
    border: none;
    border-radius: 999px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
  }
  .button--ghost { background: transparent; color: #89827e; }
  .button--ghost:hover { background: #f2f2f2; color: #000; }
  .button--primary { background: #1702fc; color: #fff; }
  .button--primary:hover { background: #1200c9; }
  .button:disabled { opacity: 0.4; cursor: default; }
`

let shadow = null
let bubble = null
let picker = null

function ui() {
  if (shadow) return shadow

  const host = document.createElement('div')
  // Inline, so a page rule can't reach past `all: initial` and re-inherit into
  // the tree. The declarations after it win; `all` is expanded in place.
  host.style.cssText =
    'all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;'
  shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = UI_CSS
  shadow.append(style)
  document.body.append(host)

  return shadow
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

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

function closePicker() {
  picker?.remove()
  picker = null
}

function showToast(ok) {
  const toast = el('div', 'toast', ok ? 'Saved to Cortexual' : 'Could not reach Cortexual')
  toast.dataset.ok = String(ok)
  ui().append(toast)
  setTimeout(() => toast.remove(), 2200)
}

/** Toggleable chips, the same affordance the app's own membership picker uses. */
function chips(items, chosen, onToggle) {
  const row = el('div', 'chips')

  for (const item of items) {
    const chip = el('button', 'chip')
    chip.type = 'button'
    chip.setAttribute('aria-pressed', 'false')

    const dot = el('span', 'dot')
    dot.style.background = item.color || '#a29e9c'
    chip.append(dot, document.createTextNode(item.name))

    chip.addEventListener('click', () => {
      const on = chosen.has(item.id)
      if (on) chosen.delete(item.id)
      else chosen.add(item.id)
      chip.setAttribute('aria-pressed', String(!on))
      // Set here rather than in CSS: an inline colour beats a stylesheet rule.
      dot.style.background = on ? item.color || '#a29e9c' : '#fff'
      onToggle()
    })

    row.append(chip)
  }

  return row
}

/**
 * Where the quote goes, asked before it is saved rather than after.
 *
 * The spaces and projects have to come through the worker for the same reason
 * the save does — this side can't fetch the daemon — so the panel opens with
 * the quote already in it and fills its chips when the answer arrives.
 */
function openPicker(source) {
  removeBubble()
  closePicker()

  const spaceIds = new Set()
  const projectIds = new Set()

  const scrim = el('div', 'scrim')
  const panel = el('div', 'panel')
  panel.tabIndex = -1
  scrim.append(panel)

  panel.append(el('blockquote', 'quote', source.text))

  const attribution = [source.author, source.siteName].filter(Boolean).join(' · ')
  if (attribution) panel.append(el('p', 'source', attribution))

  panel.append(el('label', 'label', 'Spaces'))
  const spaceSlot = el('div')
  const hint = el('p', 'hint', 'None selected — this quote stays uncategorized.')
  hint.hidden = true
  panel.append(spaceSlot, hint)

  panel.append(el('label', 'label', 'Projects'))
  const projectSlot = el('div')
  panel.append(projectSlot)

  const tags = el('input', 'input')
  tags.placeholder = 'tags, comma separated'
  panel.append(tags)

  const cancel = el('button', 'button button--ghost', 'Cancel')
  const save = el('button', 'button button--primary', 'Save quote')
  const actions = el('div', 'actions')
  actions.append(cancel, save)
  panel.append(actions)

  const status = el('p', 'status')
  panel.append(status)

  const fill = (slot, items, chosen, empty, onToggle = () => {}) => {
    slot.replaceChildren(
      items.length === 0 ? el('p', 'empty', empty) : chips(items, chosen, onToggle)
    )
  }

  chrome.runtime.sendMessage({ type: 'cortexual:list-targets' }, (targets) => {
    const spaces = targets?.spaces || []
    // Only worth saying when there was a choice and none of it was taken.
    const syncHint = () => {
      hint.hidden = spaces.length === 0 || spaceIds.size > 0
    }
    fill(spaceSlot, spaces, spaceIds, 'No spaces yet.', syncHint)
    fill(projectSlot, targets?.projects || [], projectIds, 'No active projects.')
    syncHint()
  })

  save.addEventListener('click', () => {
    save.disabled = true
    cancel.disabled = true
    status.textContent = 'Saving…'

    chrome.runtime.sendMessage(
      {
        type: 'cortexual:save-highlight',
        payload: {
          ...source,
          spaceIds: [...spaceIds],
          projectIds: [...projectIds],
          tags: tags.value
            .split(',')
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        },
      },
      (response) => {
        if (response?.ok) {
          closePicker()
          showToast(true)
          return
        }
        // The picker stays up on failure. Everything filed into it would
        // otherwise have to be chosen again over a daemon that was briefly down.
        save.disabled = false
        cancel.disabled = false
        status.textContent = response?.error
          ? `Failed: ${response.error}`
          : 'Could not reach Cortexual.'
      }
    )
  })

  cancel.addEventListener('click', closePicker)

  // Ours, and no business of the page's — plenty of sites close a lightbox or
  // swallow a keystroke on anything that reaches document.
  scrim.addEventListener('mousedown', (e) => e.stopPropagation())
  scrim.addEventListener('click', (e) => {
    e.stopPropagation()
    if (e.target === scrim) closePicker()
  })
  scrim.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      closePicker()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.stopPropagation()
      save.click()
    }
  })

  picker = scrim
  ui().append(scrim)
  panel.focus()
}

function showBubble(selection) {
  removeBubble()

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return

  const text = selection.toString().trim()
  if (text.length < 2) return

  bubble = el('button', 'bubble', '❝ Save')
  bubble.style.top = `${window.scrollY + rect.bottom + 8}px`
  bubble.style.left = `${window.scrollX + rect.left}px`

  bubble.addEventListener('mousedown', (e) => {
    // mousedown, not click: clicking would clear the selection first.
    e.preventDefault()
    e.stopPropagation()
    openPicker({
      text,
      url: canonicalUrl(),
      title: document.title,
      author: pageAuthor(),
      siteName: siteName(),
    })
  })

  ui().append(bubble)
}

document.addEventListener('selectionchange', () => {
  // Clicking into the picker moves the selection; it must not offer to reopen
  // itself on top of the quote it is already holding.
  if (picker) return

  const selection = document.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) {
    removeBubble()
    return
  }
  // Debounced via rAF so dragging a selection doesn't thrash the DOM.
  requestAnimationFrame(() => {
    const current = document.getSelection()
    if (!picker && current && !current.isCollapsed && current.rangeCount) showBubble(current)
  })
})

document.addEventListener('scroll', removeBubble, { passive: true })

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'cortexual:toast') {
    showToast(message.ok)
  } else if (message?.type === 'cortexual:pick-highlight') {
    // The menu passes the selection it captured; the page's own metadata is
    // only readable from in here.
    openPicker({ ...message.payload, author: pageAuthor(), siteName: siteName() })
    sendResponse({ opened: true })
  }
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
