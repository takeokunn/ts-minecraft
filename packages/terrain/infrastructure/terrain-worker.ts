// Terrain worker entrypoint.
//
// Listens for TerrainWorkerRequest, runs the chunk-gen pipeline via
// ManagedRuntime.runPromise, and posts back a TerrainWorkerSuccess / Failure
// response with explicit transfer list (the three Uint8Array buffers cross
// the boundary zero-copy).
//
// Per-worker Runtime cache: building the terrain Layer (BiomeService.Default +
// ChunkService.Default + pure NoiseServicePort) is non-trivial — it allocates
// service instances and wires their dependency graph. Across many chunks with
// the same seed (the common case during world streaming) we'd repeat that work
// for every message. The cache below memoises the Runtime by seed, rebuilding
// only when the world seed changes.
//
// runPromise (not runSync): ManagedRuntime initialises its layers in a
// background fiber. Calling runSync before that fiber completes throws
// "Fiber #1 cannot be resolved synchronously". runPromise awaits the runtime
// to be ready, so it works correctly on the first request and subsequent ones.
//
// All errors are caught and posted as kind: 'failure' — the worker never
// throws, so the main thread is the single owner of error handling policy.
import { Effect, ManagedRuntime } from 'effect'
import {
  buildTerrainLayer,
  buildTerrainProgram,
  toChunkBlocks,
} from '../application/terrain-generation'
import { decodeRequestSync, type TerrainWorkerResponse } from '../domain/terrain-worker-protocol'

// The buildTerrainProgram return type carries its requirements in
// `Effect.Effect.Context<...>`; we extract it here so the cache type stays in
// sync with the program shape automatically.
type TerrainContext = Effect.Effect.Context<ReturnType<typeof buildTerrainProgram>>

// Per-worker Runtime cache keyed by seed. The Runtime owns initialised
// instances of ChunkService.Default, BiomeService.Default, and the pure
// NoiseServicePort layer for that seed; reusing it across messages amortises
// the Layer-init cost (20-40% per-chunk improvement for worlds streaming
// many chunks from the same seed).
//
// We keep this as a module-level `let` rather than `MutableRef` because the
// cache is single-threaded by definition (one worker = one event loop) and
// every read happens synchronously inside `onmessage`.
let cachedRuntime: {
  readonly seed: number
  readonly runtime: ManagedRuntime.ManagedRuntime<TerrainContext, never>
} | undefined

const getRuntimeForSeed = (seed: number): ManagedRuntime.ManagedRuntime<TerrainContext, never> => {
  if (cachedRuntime !== undefined && cachedRuntime.seed === seed) {
    return cachedRuntime.runtime
  }
  // Dispose the prior runtime if any — the layer used pure data only, so this
  // is currently a no-op, but it keeps the lifecycle correct if anyone adds a
  // resource to the layer in the future.
  cachedRuntime?.runtime.dispose()
  const runtime = ManagedRuntime.make(buildTerrainLayer(seed))
  cachedRuntime = { seed, runtime }
  return runtime
}

self.onmessage = (e: MessageEvent<unknown>): void => {
  // Pull `id` from the raw payload first so a malformed request still gets
  // routed back to the correct caller as a `failure`. We treat anything that
  // isn't a plain object with a numeric `id` as id=-1 — the pool ignores
  // unrecognized ids, which is the right behaviour for a structurally-broken
  // message.
  const raw = e.data as { id?: unknown } | null | undefined
  const fallbackId = typeof raw?.id === 'number' && Number.isFinite(raw.id) ? raw.id : -1

  // Decode synchronously (Schema.decodeUnknownSync throws on malformed input),
  // then run the terrain program asynchronously via runPromise.
  // The void IIFE keeps onmessage typed as (e) => void while letting the
  // async body use await; the inner try/catch owns all error handling.
  void (async () => {
    try {
      const req = decodeRequestSync(e.data)
      const runtime = getRuntimeForSeed(req.seed)
      const chunk = await runtime.runPromise(buildTerrainProgram(req.chunk))
      const { blocks, skyLight, blockLight } = toChunkBlocks(chunk)

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
  })()
}
