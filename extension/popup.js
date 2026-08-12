import { getRelated, getSpaces, isUp, saveLink } from './api.js'

const el = (id) => document.getElementById(id)
const selected = new Set()

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function renderSpaces(spaces) {
  el('spaces').replaceChildren(
    ...spaces.map((space) => {
      const chip = document.createElement('button')
      chip.className = 'chip'
      chip.textContent = space.name
      chip.setAttribute('aria-pressed', 'false')
      chip.addEventListener('click', () => {
        const on = selected.has(space.id)
        if (on) selected.delete(space.id)
        else selected.add(space.id)
        chip.setAttribute('aria-pressed', String(!on))
      })
      return chip
    })
  )
}

function renderRelated(related) {
  if (related.length === 0) return
  el('related-wrap').hidden = false
  el('related').replaceChildren(
    ...related.map((item) => {
      const li = document.createElement('li')
      const score = document.createElement('span')
      score.className = 'score'
      score.textContent = `${Math.round(item.score * 100)}%`

      const link = document.createElement('a')
      link.textContent = item.label || 'Untitled'
      link.href = item.url || '#'
      link.target = '_blank'

      li.append(score, link)
      return li
    })
  )
}

async function main() {
  if (!(await isUp())) {
    el('offline').hidden = false
    return
  }

  el('app').hidden = false

  const tab = await currentTab()
  el('page-title').textContent = tab?.title || 'Untitled'
  el('page-url').textContent = tab?.url || ''

  renderSpaces(await getSpaces().catch(() => []))

  el('save').addEventListener('click', async () => {
    const button = el('save')
    button.disabled = true
    el('status').textContent = 'Fetching and saving…'

    try {
      await saveLink({
        url: tab.url,
        title: tab.title,
        spaceIds: Array.from(selected),
        tags: el('tags')
          .value.split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      })
      el('status').textContent = 'Saved.'
      button.textContent = 'Saved ✓'

      // Only worth asking after the save; before it there's nothing to relate to.
      renderRelated(await getRelated(`${tab.title}\n${tab.url}`))
    } catch (error) {
      el('status').textContent = `Failed: ${error.message}`
      button.disabled = false
    }
  })
}

main()
