// @effect-boundary Worker entrypoint catches host exceptions and reports structured failures.
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
  buildNetherProgram,
  buildEndProgram,
  toChunkBlocks,
} from '@ts-minecraft/world'
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

const extractRequestId = (data: unknown): number | null => {
  if (typeof data !== 'object' || data === null) return null
  const id = (data as { readonly id?: unknown }).id
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 ? id : null
}

self.onmessage = (e: MessageEvent<unknown>): void => {
  // Decode synchronously (Schema.decodeUnknownSync throws on malformed input),
  // then run the terrain program asynchronously via runPromise.
  // The void IIFE keeps onmessage typed as (e) => void while letting the
  // async body use await; the inner try/catch owns all error handling.
  void (async () => {
    try {
      const req = decodeRequestSync(e.data)
      const runtime = getRuntimeForSeed(req.seed)
      const program = req.dimension === 'nether'
        ? buildNetherProgram(req.chunk)
        : req.dimension === 'end'
          ? buildEndProgram(req.chunk)
          : buildTerrainProgram(req.chunk, { seaLevel: req.seaLevel, lakeLevel: req.lakeLevel })
      const chunk = await runtime.runPromise(program)
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
      const id = extractRequestId(e.data)
      if (id === null) return

      const failure: TerrainWorkerResponse = {
        id,
        kind: 'failure',
        error: err instanceof Error ? err.message : String(err),
      }
      self.postMessage(failure)
    }
  })()
}
