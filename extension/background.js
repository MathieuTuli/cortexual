import { getPostMedia, savePostMedia, saveHighlight, saveImage, saveLink } from './api.js'

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
      await saveHighlight({
        text: info.selectionText,
        url: info.pageUrl || tab?.url,
        title: tab?.title,
      })
    } else if (info.menuItemId === MENU.media) {
      const url = info.linkUrl || info.pageUrl || tab?.url
      const found = await getPostMedia(url)
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
// block it — so saves are proxied through the worker.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'cortexual:save-highlight') return

  saveHighlight(message.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }))

  return true // keep the channel open for the async reply
})
