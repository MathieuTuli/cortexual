import type { EmbedRequest, EmbedResponse } from './embed.worker'

type Pending = {
  resolve: (vectors: Float32Array[]) => void
  reject: (error: Error) => void
}

/**
 * Promise-shaped wrapper over the embedding worker. The model is ~25MB and
 * loads lazily on the first request, so the worker is only spun up when
 * something actually needs a vector.
 */
export class Embedder {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private onReady?: () => void

  constructor(onReady?: () => void) {
    this.onReady = onReady
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker

    const worker = new Worker(new URL('./embed.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<EmbedResponse>) => {
      const data = event.data
      if ('ready' in data) {
        this.onReady?.()
        return
      }

      const pending = this.pending.get(data.id)
      if (!pending) return
      this.pending.delete(data.id)

      if (data.ok) pending.resolve(data.vectors)
      else pending.reject(new Error(data.error))
    }

    // A worker-level failure never resolves the in-flight requests, so fail
    // them explicitly rather than leaving callers hanging forever.
    worker.onerror = (event) => {
      const error = new Error(event.message || 'embedding worker failed')
      for (const pending of this.pending.values()) pending.reject(error)
      this.pending.clear()
    }

    this.worker = worker
    return worker
  }

  embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return Promise.resolve([])

    const worker = this.ensureWorker()
    const id = this.nextId++

    return new Promise<Float32Array[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ id, texts } satisfies EmbedRequest)
    })
  }

  terminate() {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
  }
}
