import {
  getPostMedia,
  getProjects,
  getSpaces,
  savePostMedia,
  saveHighlight,
  saveImage,
  saveLink,
} from './api.js'

const MENU = {
  image: 'cortexual-save-image',
  selection: 'cortexual-save-selection',
  page: 'cortexual-save-page',
  media: 'cortexual-save-media',
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU.image, title: 'Save image to Cortexual', contexts: ['image'] })
    chrome.contextMenus.create({ id: MENU.selection, title: 'Save highlight to Cortexual', contexts: ['selection'] })
    chrome.contextMenus.create({ id: MENU.page, title: 'Save page to Cortexual', contexts: ['page', 'link'] })
    chrome.contextMenus.create({ id: MENU.media, title: 'Save just the media from this post', contexts: ['page', 'link'] })
  })
})

/**
 * Ask the page first, fall back to the server.
 *
 * The DOM is the only place Instagram's media exists for us — it serves a bare
 * JS shell to any fetch from the daemon. X is the other way round: its
 * syndication endpoint gives full-resolution originals and every carousel
 * image, where the DOM only holds the sizes the timeline chose to render.
 */
async function findMedia(tab, url) {
  const isX = /(^|.)(x|twitter).com$/.test(new URL(url).hostname)

  if (!isX && tab?.id != null) {
    const fromPage = await chrome.tabs
      .sendMessage(tab.id, { type: 'cortexual:collect-media' })
      .catch(() => null)
    if (fromPage?.media?.length) return fromPage
  }

  return getPostMedia(url)
}

/**
 * A quote is filed, not just saved, so the menu opens the same picker the
 * in-page bubble does rather than quietly guessing. Pages the content script
 * can't run on — the web store, a pdf viewer, a tab restored from before the
 * extension loaded — answer nothing, and there the menu saves outright.
 */
async function offerPicker(tabId, payload) {
  if (tabId == null) return false
  const reply = await chrome.tabs
    .sendMessage(tabId, { type: 'cortexual:pick-highlight', payload })
    .catch(() => null)
  return Boolean(reply?.opened)
}

/** Badge doubles as the only feedback available from a context menu. */
async function flash(ok, tabId) {
  await chrome.action.setBadgeText({ text: ok ? '✓' : '!' })
  await chrome.action.setBadgeBackgroundColor({ color: ok ? '#22c55e' : '#ef4444' })
  if (tabId != null) {
    chrome.tabs.sendMessage(tabId, { type: 'cortexual:toast', ok }).catch(() => {})
  }
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000)
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU.image && info.srcUrl) {
      await saveImage({ imageUrl: info.srcUrl, pageUrl: info.pageUrl || tab?.url, title: tab?.title })
    } else if (info.menuItemId === MENU.selection && info.selectionText) {
      const payload = {
        text: info.selectionText,
        url: info.pageUrl || tab?.url,
        title: tab?.title,
      }
      // The picker carries its own feedback, so there is nothing to flash.
      if (await offerPicker(tab?.id, payload)) return
      await saveHighlight(payload)
    } else if (info.menuItemId === MENU.media) {
      const url = info.linkUrl || info.pageUrl || tab?.url
      const found = await findMedia(tab, url)
      if (!found.media?.length) throw new Error('no media found in that post')
      await savePostMedia({ url, title: tab?.title, found, mode: 'single' })
    } else if (info.menuItemId === MENU.page) {
      await saveLink({ url: info.linkUrl || info.pageUrl || tab?.url, title: info.linkUrl ? undefined : tab?.title })
    }
    await flash(true, tab?.id)
  } catch (error) {
    console.error('[cortexual]', error)
    await flash(false, tab?.id)
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-page') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return
  try {
    await saveLink({ url: tab.url, title: tab.title })
    await flash(true, tab.id)
  } catch {
    await flash(false, tab.id)
  }
})

// The content script can't reach the daemon itself — a page's own CSP would
// block it — so everything the picker needs is proxied through the worker.
// Each branch returns true to keep the channel open for its async reply.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'cortexual:list-targets') {
    // An empty list is a truthful answer here: it renders as "no spaces yet"
    // rather than stalling a picker that still has a quote to save.
    Promise.all([getSpaces().catch(() => []), getProjects().catch(() => [])]).then(
      ([spaces, projects]) => sendResponse({ spaces, projects })
    )
    return true
  }

  if (message?.type === 'cortexual:save-highlight') {
    saveHighlight(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }))
    return true
  }
})
