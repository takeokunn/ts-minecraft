/**
 * Terrain worker entrypoint.
 *
 * Listens for TerrainWorkerRequest, runs the pure synchronous
 * `generateTerrainBlocks`, and posts back a TerrainWorkerSuccess / Failure
 * response with explicit transfer list (the three Uint8Array buffers cross
 * the boundary zero-copy).
 *
 * All errors are caught and posted as `kind: 'failure'` — the worker never
 * throws, so the main thread is the single owner of error handling policy.
 */
import { generateTerrainBlocks } from '@/domain/terrain/terrain-generation'
import { decodeRequestSync, type TerrainWorkerResponse } from '@/infrastructure/terrain/terrain-worker-protocol'

self.onmessage = (e: MessageEvent<unknown>): void => {
  // Pull `id` from the raw payload first so a malformed request still gets
  // routed back to the correct caller as a `failure`. We treat anything that
  // isn't a plain object with a numeric `id` as id=-1 — the pool ignores
  // unrecognized ids, which is the right behaviour for a structurally-broken
  // message.
  const raw = e.data as { id?: unknown } | null | undefined
  const fallbackId = typeof raw?.id === 'number' && Number.isFinite(raw.id) ? raw.id : -1

  // Decode + execute with a single try/catch so any throw becomes a failure
  // response. Schema.decodeUnknownSync throws on malformed input; the pure
  // generator can in principle throw on invariant violations.
  try {
    const req = decodeRequestSync(e.data)
    const { blocks, skyLight, blockLight } = generateTerrainBlocks({
      coord: req.chunk,
      seaLevel: req.seaLevel,
      lakeLevel: req.lakeLevel,
      seed: req.seed,
    })

    // Cast Uint8Array<ArrayBufferLike> → Uint8Array<ArrayBuffer>: pure
    // Uint8Arrays from `new Uint8Array(N)` have a fresh ArrayBuffer underneath
    // (never SharedArrayBuffer); TS only widens the brand defensively.
    const response: TerrainWorkerResponse = {
      id: req.id,
      kind: 'success',
      blocks: blocks as Uint8Array<ArrayBuffer>,
      skyLight: skyLight as Uint8Array<ArrayBuffer>,
      blockLight: blockLight as Uint8Array<ArrayBuffer>,
    }

    // Explicit transfer list — the three buffers leave this thread with their
    // ArrayBuffers detached. After postMessage returns, blocks/skyLight/
    // blockLight are unusable from the worker side, which is correct: we are
    // not retaining them.
    self.postMessage(response, [
      blocks.buffer as ArrayBuffer,
      skyLight.buffer as ArrayBuffer,
      blockLight.buffer as ArrayBuffer,
    ])
  } catch (err) {
    const failure: TerrainWorkerResponse = {
      id: fallbackId,
      kind: 'failure',
      error: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(failure)
  }
}
