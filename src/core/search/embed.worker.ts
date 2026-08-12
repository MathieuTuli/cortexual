/// <reference lib="webworker" />
import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers'

// No local model server to fall back on; pull from the CDN and let the browser
// cache handle repeat loads.
env.allowLocalModels = false

const MODEL = 'Xenova/all-MiniLM-L6-v2'

export interface EmbedRequest {
  id: number
  texts: string[]
}

export type EmbedResponse =
  | { id: number; ok: true; vectors: Float32Array[] }
  | { id: number; ok: false; error: string }
  | { id: -1; ready: true }

let extractor: Promise<FeatureExtractionPipeline> | null = null

function getExtractor() {
  if (!extractor) {
    extractor = pipeline('feature-extraction', MODEL, { quantized: true })
    extractor.then(
      () => self.postMessage({ id: -1, ready: true } satisfies EmbedResponse),
      () => {}
    )
  }
  return extractor
}

self.onmessage = async (event: MessageEvent<EmbedRequest>) => {
  const { id, texts } = event.data

  try {
    const extract = await getExtractor()
    // Mean pooling + normalise is what makes the output comparable by dot
    // product; without normalise, similarity() would be wrong.
    const output = await extract(texts, { pooling: 'mean', normalize: true })

    const [rows, dims] = output.dims as [number, number]
    const flat = output.data as Float32Array
    const vectors: Float32Array[] = []
    for (let r = 0; r < rows; r++) {
      vectors.push(flat.slice(r * dims, (r + 1) * dims))
    }

    self.postMessage({ id, ok: true, vectors } satisfies EmbedResponse)
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: (error as Error).message,
    } satisfies EmbedResponse)
  }
}
