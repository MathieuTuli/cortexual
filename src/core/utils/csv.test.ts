import { describe, it, expect } from 'vitest'
import { parseCsv, generateCsv, parseTags, stringifyTags, type CsvCard } from './csv'

const HEADER = 'id,type,title,url,content,note,author,sourceurl,sitename,tags,created,space,media'

function blank(overrides: Partial<CsvCard> = {}): CsvCard {
  return {
    id: '', type: '', title: '', url: '', content: '', note: '',
    author: '', sourceUrl: '', siteName: '',
    tags: '', created: '', space: '', media: '',
    ...overrides,
  }
}

/**
 * A raw row in HEADER order. Built field-by-field rather than as a literal so
 * adding a column can't silently shift every fixture's values one slot left.
 */
function row(fields: Partial<CsvCard>): string {
  const c = blank(fields)
  return [
    c.id, c.type, c.title, c.url, c.content, c.note,
    c.author, c.sourceUrl, c.siteName,
    c.tags, c.created, c.space, c.media,
  ].join(',')
}

describe('parseCsv', () => {
  it('parses every column of a plain row', () => {
    const fields = {
      id: 'a1', type: 'Note', title: 'Hello', url: 'https://e.com',
      content: 'body', note: 'n', author: 'Ada', sourceUrl: 'https://src',
      siteName: 'Src', tags: 'x', created: '2026-01-01', space: 'Inbox',
      media: 'a.jpg',
    }
    const rows = parseCsv(`${HEADER}\n${row(fields)}`)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(blank(fields))
  })

  it('reads the provenance columns', () => {
    const rows = parseCsv(`${HEADER}\n${row({ id: 'a1', author: 'Ada', sourceUrl: 'https://s', siteName: 'S' })}`)
    expect(rows[0]).toMatchObject({ author: 'Ada', sourceUrl: 'https://s', siteName: 'S' })
  })

  it('drops rows with no id', () => {
    const rows = parseCsv(`${HEADER}\n${row({ type: 'Note', title: 'No id' })}\n${row({ id: 'a2' })}`)
    expect(rows.map((r) => r.id)).toEqual(['a2'])
  })

  it('returns empty for a header-only file', () => {
    expect(parseCsv(HEADER)).toEqual([])
  })

  it('matches headers case-insensitively', () => {
    const rows = parseCsv('ID,Type,TITLE\na1,Note,Shouty')
    expect(rows[0]).toMatchObject({ id: 'a1', type: 'Note', title: 'Shouty' })
  })

  it('tolerates a header missing columns', () => {
    const rows = parseCsv('id,title\na1,Only two')
    expect(rows[0]).toMatchObject({ id: 'a1', title: 'Only two', url: '', media: '' })
  })

  it('keeps commas inside quoted fields', () => {
    const rows = parseCsv(`${HEADER}\na1,Note,"Tuli, Mathieu",,,,,,,`)
    expect(rows[0].title).toBe('Tuli, Mathieu')
  })

  it('keeps newlines inside quoted fields', () => {
    const rows = parseCsv(`${HEADER}\na1,Note,t,,"line one\nline two",,,,,`)
    expect(rows[0].content).toBe('line one\nline two')
    expect(rows).toHaveLength(1)
  })

  it('unescapes doubled quotes', () => {
    const rows = parseCsv(`${HEADER}\na1,Note,"he said ""hi""",,,,,,,`)
    expect(rows[0].title).toBe('he said "hi"')
  })

  it('handles CRLF line endings', () => {
    const rows = parseCsv(`${HEADER}\r\na1,Note,First,,,,,,,\r\na2,Note,Second,,,,,,,`)
    expect(rows.map((r) => r.title)).toEqual(['First', 'Second'])
  })

  it('handles a bare CR line ending', () => {
    const rows = parseCsv(`${HEADER}\ra1,Note,First,,,,,,,`)
    expect(rows[0].title).toBe('First')
  })

  it('keeps a CRLF that sits inside a quoted field', () => {
    const rows = parseCsv(`${HEADER}\na1,Note,t,,"one\r\ntwo",,,,,`)
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toBe('one\r\ntwo')
  })

  it('reads the last row when the file has no trailing newline', () => {
    const rows = parseCsv(`${HEADER}\na1,Note,Last,,,,,,,`)
    expect(rows).toHaveLength(1)
  })
})

describe('generateCsv', () => {
  it('emits the header even with no rows', () => {
    expect(generateCsv([])).toBe(HEADER)
  })

  it('quotes values containing commas, quotes, or newlines', () => {
    const out = generateCsv([blank({ id: 'a1', title: 'a,b', content: 'say "hi"', note: 'x\ny' })])
    expect(out).toContain('"a,b"')
    expect(out).toContain('"say ""hi"""')
    expect(out).toContain('"x\ny"')
  })

  it('leaves plain values unquoted', () => {
    expect(generateCsv([blank({ id: 'a1', title: 'plain' })])).toContain('a1,,plain,')
  })
})

describe('round trip', () => {
  it('survives generate -> parse with nasty values', () => {
    const original = blank({
      id: 'a1',
      type: 'Note',
      title: 'Comma, "quote" and\nnewline',
      content: 'multi\nline\r\nbody',
      tags: 'one,two',
      space: 'Reading, 2026',
      media: 'a.jpg|b.jpg',
    })
    const [parsed] = parseCsv(generateCsv([original]))
    expect(parsed).toEqual(original)
  })

  it('survives several rows at once', () => {
    const rows = [
      blank({ id: 'a1', title: 'one' }),
      blank({ id: 'a2', title: 'two, with comma' }),
      blank({ id: 'a3', title: 'three' }),
    ]
    expect(parseCsv(generateCsv(rows))).toEqual(rows)
  })
})

describe('tags', () => {
  it('splits, trims, and lowercases', () => {
    expect(parseTags(' Alpha , BETA,gamma ')).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('drops empty entries', () => {
    expect(parseTags('a,,b,')).toEqual(['a', 'b'])
  })

  it('returns empty for an empty string', () => {
    expect(parseTags('')).toEqual([])
  })

  it('round trips through stringifyTags', () => {
    expect(parseTags(stringifyTags(['a', 'b', 'c']))).toEqual(['a', 'b', 'c'])
  })
})
