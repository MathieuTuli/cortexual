/**
 * Two embedding spaces, deliberately.
 *
 * Text cards go through a sentence encoder, which handles long prose. Images go
 * through MobileCLIP, whose text and image towers share a space — so a typed
 * query can be compared against a picture with no caption. CLIP's text tower is
 * capped at 77 tokens and trained on captions, so it is not a replacement for
 * the sentence encoder on notes and articles; the two indexes stay separate and
 * their results are merged by rank.
 */
const TEXT_MODEL = 'Xenova/all-MiniLM-L6-v2'
const CLIP_MODEL = 'Xenova/mobileclip_s1'

/** CLIP text towers need a fixed 77-token window, not dynamic padding. */
const CLIP_CONTEXT = 77

type TextPipeline = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>

let textPipe: Promise<TextPipeline> | null = null
let clip: Promise<{
  tokenizer: any
  processor: any
  textModel: any
  visionModel: any
  RawImage: any
}> | null = null

export function getTextPipeline(): Promise<TextPipeline> {
  if (!textPipe) {
    textPipe = import('@huggingface/transformers').then(async ({ pipeline, env }) => {
      env.allowLocalModels = false
      return (await pipeline('feature-extraction', TEXT_MODEL, {
        dtype: 'q8',
      })) as unknown as TextPipeline
    })
  }
  return textPipe
}

function getClip() {
  if (!clip) {
    clip = import('@huggingface/transformers').then(async (t) => {
      t.env.allowLocalModels = false
      const [tokenizer, processor, textModel, visionModel] = await Promise.all([
        t.AutoTokenizer.from_pretrained(CLIP_MODEL),
        t.AutoProcessor.from_pretrained(CLIP_MODEL),
        t.CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: 'q8' }),
        t.CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: 'q8' }),
      ])
      return { tokenizer, processor, textModel, visionModel, RawImage: t.RawImage }
    })
  }
  return clip
}

function normalize(values: Float32Array | number[]): Float32Array {
  let sum = 0
  for (const v of values) sum += v * v
  const norm = Math.sqrt(sum) || 1
  const out = new Float32Array(values.length)
  for (let i = 0; i < values.length; i++) out[i] = values[i] / norm
  return out
}

export async function embedText(texts: string[]): Promise<Float32Array[]> {
  const extract = await getTextPipeline()
  const output = await extract(texts, { pooling: 'mean', normalize: true })
  const dims = output.dims[1]
  return texts.map((_, i) => output.data.slice(i * dims, (i + 1) * dims))
}

/** A query in CLIP's joint space, comparable against image vectors. */
export async function embedQueryForImages(text: string): Promise<Float32Array> {
  const { tokenizer, textModel } = await getClip()
  const { text_embeds } = await textModel(
    tokenizer([text], { padding: 'max_length', max_length: CLIP_CONTEXT, truncation: true })
  )
  return normalize(text_embeds.data)
}

export async function embedImageFile(file: string): Promise<Float32Array> {
  const { processor, visionModel, RawImage } = await getClip()
  const image = await RawImage.read(file)
  const { image_embeds } = await visionModel(await processor(image))
  return normalize(image_embeds.data)
}

export function encodeVector(vector: Float32Array): string {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength).toString('base64')
}

export function decodeVector(encoded: string): Float32Array {
  const buffer = Buffer.from(encoded, 'base64')
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
}

export function dot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let total = 0
  for (let i = 0; i < a.length; i++) total += a[i] * b[i]
  return total
}
