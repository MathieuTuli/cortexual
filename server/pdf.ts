import { extractText, getDocumentProxy } from 'unpdf'

/**
 * Capped well past what EmbeddingGemma will read (~2k tokens) but short of
 * bloating cards.json, which is fetched whole on every app load. The tile
 * excerpt and the index both work from the opening pages, which is where a
 * document says what it is.
 */
const TEXT_LIMIT = 8000

export interface PdfExtraction {
  text: string
  pageCount: number
}

export async function extractPdfText(data: Buffer): Promise<PdfExtraction> {
  const pdf = await getDocumentProxy(new Uint8Array(data))
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  return {
    text: text.replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT),
    pageCount: totalPages,
  }
}
