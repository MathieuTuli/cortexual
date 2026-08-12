import { describe, it, expect } from 'vitest'
import { parseUrl, getYouTubeThumbnail, getHostname, getFavicon, describeUrl } from './url-parser'

describe('parseUrl', () => {
  it('reads a youtube.com watch id', () => {
    expect(parseUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toEqual({ embedType: 'youtube', embedId: 'dQw4w9WgXcQ' })
  })

  it('reads a youtu.be short id', () => {
    expect(parseUrl('https://youtu.be/dQw4w9WgXcQ'))
      .toEqual({ embedType: 'youtube', embedId: 'dQw4w9WgXcQ' })
  })

  it('still reports youtube when the v param is missing', () => {
    expect(parseUrl('https://www.youtube.com/feed/subscriptions'))
      .toEqual({ embedType: 'youtube', embedId: undefined })
  })

  it('reads a tweet id from x.com', () => {
    expect(parseUrl('https://x.com/anyone/status/1234567890'))
      .toEqual({ embedType: 'twitter', embedId: '1234567890' })
  })

  it('reads a tweet id from twitter.com', () => {
    expect(parseUrl('https://twitter.com/anyone/status/1234567890'))
      .toEqual({ embedType: 'twitter', embedId: '1234567890' })
  })

  it('ignores trailing path segments after the status id', () => {
    expect(parseUrl('https://x.com/anyone/status/1234567890/photo/1').embedId).toBe('1234567890')
  })

  it('reports twitter with no id for a profile url', () => {
    expect(parseUrl('https://x.com/anyone'))
      .toEqual({ embedType: 'twitter', embedId: undefined })
  })

  it('falls back to generic for other hosts', () => {
    expect(parseUrl('https://example.com/a/b')).toEqual({ embedType: 'generic' })
  })

  it('falls back to generic for an unparseable url', () => {
    expect(parseUrl('not a url')).toEqual({ embedType: 'generic' })
  })
})

describe('getHostname', () => {
  it('strips a www prefix', () => {
    expect(getHostname('https://www.example.com/x')).toBe('example.com')
  })

  it('leaves other subdomains alone', () => {
    expect(getHostname('https://blog.example.com')).toBe('blog.example.com')
  })

  it('returns the input unchanged when it will not parse', () => {
    expect(getHostname('nonsense')).toBe('nonsense')
  })
})

describe('getFavicon', () => {
  it('builds a lookup url from the hostname', () => {
    expect(getFavicon('https://example.com/deep/path')).toContain('domain=example.com')
  })

  it('returns empty string for an unparseable url', () => {
    expect(getFavicon('nonsense')).toBe('')
  })
})

describe('getYouTubeThumbnail', () => {
  it('builds the hqdefault url', () => {
    expect(getYouTubeThumbnail('abc123')).toBe('https://img.youtube.com/vi/abc123/hqdefault.jpg')
  })
})

describe('describeUrl', () => {
  it('renders an x.com profile as a handle', () => {
    expect(describeUrl('https://x.com/mathieutuli')).toBe('@mathieutuli')
  })

  it('renders a twitter.com profile as a handle', () => {
    expect(describeUrl('https://twitter.com/mathieutuli/status/1')).toBe('@mathieutuli')
  })

  it('renders host and path for a generic url', () => {
    expect(describeUrl('https://www.example.com/a/b')).toBe('example.com/a/b')
  })

  it('drops a trailing slash', () => {
    expect(describeUrl('https://example.com/a/')).toBe('example.com/a')
  })

  it('renders bare host when there is no path', () => {
    expect(describeUrl('https://example.com')).toBe('example.com')
  })

  it('returns the input unchanged when it will not parse', () => {
    expect(describeUrl('nonsense')).toBe('nonsense')
  })
})
