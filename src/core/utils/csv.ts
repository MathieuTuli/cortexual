// CSV parsing and generation utilities

export interface CsvCard {
  id: string
  type: string
  title: string
  url: string
  content: string
  note: string
  tags: string
  created: string
  space: string
  media: string  // pipe-separated list of media filenames
}

export function parseCsv(csvText: string): CsvCard[] {
  const rows = parseCsvRows(csvText)
  if (rows.length < 2) return []

  // Parse header (case-insensitive)
  const rawHeader = rows[0]
  const header = rawHeader.map(h => h.toLowerCase().trim())
  const cards: CsvCard[] = []

  // Helper to safely get column value (handles missing columns)
  const getColumnValue = (values: string[], columnName: string): string => {
    const idx = header.indexOf(columnName.toLowerCase())
    return idx >= 0 ? (values[idx] || '') : ''
  }

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i]
    if (values.length === 0 || (values.length === 1 && !values[0])) continue

    const card: CsvCard = {
      id: getColumnValue(values, 'id'),
      type: getColumnValue(values, 'type'),
      title: getColumnValue(values, 'title'),
      url: getColumnValue(values, 'url'),
      content: getColumnValue(values, 'content'),
      note: getColumnValue(values, 'note'),
      tags: getColumnValue(values, 'tags'),
      created: getColumnValue(values, 'created'),
      space: getColumnValue(values, 'space'),
      media: getColumnValue(values, 'media'),
    }
    if (card.id) {
      cards.push(card)
    }
  }

  return cards
}

// Parse CSV text into rows, properly handling quoted fields with embedded newlines
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (!inQuotes) {
        inQuotes = true
      } else if (nextChar === '"') {
        // Escaped quote
        currentValue += '"'
        i++
      } else {
        inQuotes = false
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentValue)
      currentValue = ''
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // End of row (skip \r if followed by \n)
      if (char === '\r') i++
      currentRow.push(currentValue)
      rows.push(currentRow)
      currentRow = []
      currentValue = ''
    } else if (char === '\r' && !inQuotes) {
      // Standalone \r as line ending
      currentRow.push(currentValue)
      rows.push(currentRow)
      currentRow = []
      currentValue = ''
    } else {
      currentValue += char
    }
  }

  // Don't forget the last value/row
  if (currentValue || currentRow.length > 0) {
    currentRow.push(currentValue)
    rows.push(currentRow)
  }

  return rows
}

export function generateCsv(cards: CsvCard[]): string {
  const header = 'id,type,title,url,content,note,tags,created,space,media'
  const lines = [header]

  for (const card of cards) {
    const values = [
      escapeCsvValue(card.id),
      escapeCsvValue(card.type),
      escapeCsvValue(card.title),
      escapeCsvValue(card.url),
      escapeCsvValue(card.content),
      escapeCsvValue(card.note),
      escapeCsvValue(card.tags),
      escapeCsvValue(card.created),
      escapeCsvValue(card.space),
      escapeCsvValue(card.media),
    ]
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

function escapeCsvValue(value: string): string {
  if (!value) return ''

  // If value contains comma, newline, carriage return, or quote, wrap in quotes
  if (value.includes(',') || value.includes('\n') || value.includes('\r') || value.includes('"')) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""')
    return `"${escaped}"`
  }

  return value
}

export function parseTags(tagsString: string): string[] {
  if (!tagsString) return []
  return tagsString.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
}

export function stringifyTags(tags: string[]): string {
  return tags.join(',')
}
