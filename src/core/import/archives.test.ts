import { describe, it, expect } from 'vitest'
import {
  unwrapXFile,
  parseXBookmarks,
  parseXLikes,
  parseInstagramSaved,
  parseArchive,
} from './archives'

const BOOKMARKS_JS = `window.YTD.bookmark.part0 = [
  {
    "bookmark" : {
      "tweetId" : "1111",
      "expandedUrl" : "https://twitter.com/someone/status/1111"
    }
  },
  {
    "bookmark" : {
      "tweetId" : "2222"
    }
  }
]`

const LIKE_JS = `window.YTD.like.part0 = [
  {
    "like" : {
      "tweetId" : "3333",
      "fullText" : "a liked tweet",
      "expandedUrl" : "https://twitter.com/other/status/3333"
    }
  }
]`

const SAVED_JSON = JSON.stringify({
  saved_saved_media: [
    {
      title: 'someaccount',
      string_map_data: {
        'Saved on': { href: 'https://www.instagram.com/p/ABC123/', timestamp: 1700000000 },
      },
    },
    {
      title: 'reelaccount',
      string_map_data: {
        'Saved on': { href: 'https://www.instagram.com/reel/XYZ789/', timestamp: 1700000001 },
      },
    },
  ],
})

describe('unwrapXFile', () => {
  it('strips the global assignment', () => {
    expect(unwrapXFile('window.YTD.x.part0 = [1, 2, 3]')).toEqual([1, 2, 3])
  })

  it('tolerates a trailing semicolon', () => {
    expect(unwrapXFile('window.YTD.x.part0 = [1];')).toEqual([1])
  })

  it('returns empty for a file with no assignment', () => {
    expect(unwrapXFile('[1,2,3]')).toEqual([])
  })

  it('returns empty rather than throwing on malformed json', () => {
    expect(unwrapXFile('window.YTD.x.part0 = [not json')).toEqual([])
  })

  it('returns empty when the payload is not an array', () => {
    expect(unwrapXFile('window.YTD.x.part0 = {"a":1}')).toEqual([])
  })
})

describe('parseXBookmarks', () => {
  it('reads both entries', () => {
    expect(parseXBookmarks(BOOKMARKS_JS)).toHaveLength(2)
  })

  it('prefers the expanded url when present', () => {
    expect(parseXBookmarks(BOOKMARKS_JS)[0].url).toBe('https://twitter.com/someone/status/1111')
  })

  it('synthesises a url from the tweet id when absent', () => {
    expect(parseXBookmarks(BOOKMARKS_JS)[1].url).toContain('/status/2222')
  })

  it('derives ids that are stable across imports', () => {
    expect(parseXBookmarks(BOOKMARKS_JS)[0].id).toBe(parseXBookmarks(BOOKMARKS_JS)[0].id)
  })

  it('skips entries with no tweet id', () => {
    expect(parseXBookmarks('window.YTD.bookmark.part0 = [{"bookmark":{}}]')).toEqual([])
  })
})

describe('parseXLikes', () => {
  it('carries the liked text through', () => {
    expect(parseXLikes(LIKE_JS)[0].text).toBe('a liked tweet')
  })

  it('namespaces its ids apart from bookmarks', () => {
    expect(parseXLikes(LIKE_JS)[0].id).not.toBe(parseXBookmarks(BOOKMARKS_JS)[0].id)
  })
})

describe('parseInstagramSaved', () => {
  it('reads every saved post', () => {
    expect(parseInstagramSaved(SAVED_JSON)).toHaveLength(2)
  })

  it('keeps the post url and the account', () => {
    const [first] = parseInstagramSaved(SAVED_JSON)
    expect(first.url).toBe('https://www.instagram.com/p/ABC123/')
    expect(first.author).toBe('someaccount')
  })

  it('converts the unix timestamp to an iso date', () => {
    expect(parseInstagramSaved(SAVED_JSON)[0].createdAt).toBe(
      new Date(1700000000 * 1000).toISOString()
    )
  })

  it('handles reels as well as posts', () => {
    expect(parseInstagramSaved(SAVED_JSON)[1].id).toBe('ig-saved-XYZ789')
  })

  it('does not depend on the display label of the href field', () => {
    const renamed = SAVED_JSON.replace(/"Saved on"/g, '"Guardado el"')
    expect(parseInstagramSaved(renamed)).toHaveLength(2)
  })

  it('returns empty rather than throwing on malformed json', () => {
    expect(parseInstagramSaved('{ nope')).toEqual([])
  })

  it('skips entries with no href', () => {
    const noHref = JSON.stringify({
      saved_saved_media: [{ title: 'x', string_map_data: { 'Saved on': { value: 'y' } } }],
    })
    expect(parseInstagramSaved(noHref)).toEqual([])
  })
})

describe('parseArchive', () => {
  it('detects an X export', () => {
    const files = new Map([['data/bookmarks.js', BOOKMARKS_JS]])
    expect(parseArchive(files)?.kind).toBe('x')
  })

  it('detects an Instagram export', () => {
    const files = new Map([['saved/saved_posts.json', SAVED_JSON]])
    expect(parseArchive(files)?.kind).toBe('instagram')
  })

  it('merges bookmarks and likes from one X export', () => {
    const files = new Map([
      ['data/bookmarks.js', BOOKMARKS_JS],
      ['data/like.js', LIKE_JS],
    ])
    expect(parseArchive(files)?.items).toHaveLength(3)
  })

  it('does not make two cards for a tweet both bookmarked and liked', () => {
    const shared = `window.YTD.like.part0 = [{"like":{"tweetId":"1111","expandedUrl":"https://twitter.com/someone/status/1111"}}]`
    const files = new Map([
      ['data/bookmarks.js', BOOKMARKS_JS],
      ['data/like.js', shared],
    ])
    expect(parseArchive(files)?.items).toHaveLength(2)
  })

  it('returns null for an unrecognised folder', () => {
    expect(parseArchive(new Map([['notes.txt', 'hello']]))).toBeNull()
  })

  it('finds files at any depth', () => {
    const files = new Map([['twitter-2026-01-01/data/bookmarks.js', BOOKMARKS_JS]])
    expect(parseArchive(files)?.kind).toBe('x')
  })
})
