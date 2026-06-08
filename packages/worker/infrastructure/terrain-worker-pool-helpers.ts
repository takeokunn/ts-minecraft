// @effect-boundary - infrastructure worker helpers that wrap browser Web Worker API boundary operations
import { Effect, Schema } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, type ChunkCoord } from '@ts-minecraft/core'
import { generateTerrainBlocks, buildNetherProgram, buildEndProgram, buildTerrainLayer, toChunkBlocks, type ChunkBlocks } from '@ts-minecraft/world'
import { TerrainGenerationError, type TerrainGenerationOptions } from '../application/terrain-worker-pool-port'
import { TerrainWorkerResponseSchema } from '../domain/terrain-worker-protocol'

export const decodeResponseSync = Schema.decodeUnknownSync(TerrainWorkerResponseSchema)

export const BLOCK_BYTES = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

export const generateTerrainSync = (
  chunk: ChunkCoord,
  options: TerrainGenerationOptions,
): Effect.Effect<ChunkBlocks, TerrainGenerationError> => {
  if (options.dimension === 'end') {
    return Effect.try({
      try: () => {
        const layer = buildTerrainLayer(options.seed)
        const endChunk = Effect.runSync(buildEndProgram(chunk).pipe(Effect.provide(layer)))
        return toChunkBlocks(endChunk)
      },
      catch: (e) => new TerrainGenerationError({
        reason: e instanceof Error ? e.message : String(e),
        chunk,
      }),
    })
  }
  if (options.dimension === 'nether') {
    return Effect.try({
      try: () => {
        const layer = buildTerrainLayer(options.seed)
        const netherChunk = Effect.runSync(buildNetherProgram(chunk).pipe(Effect.provide(layer)))
        return toChunkBlocks(netherChunk)
      },
      catch: (e) => new TerrainGenerationError({
        reason: e instanceof Error ? e.message : String(e),
        chunk,
      }),
    })
  }
  return Effect.try({
    try: () => generateTerrainBlocks({
      coord: chunk,
      seaLevel: options.seaLevel,
      lakeLevel: options.lakeLevel,
      seed: options.seed,
    }),
    catch: (e) => new TerrainGenerationError({
      reason: e instanceof Error ? e.message : String(e),
      chunk,
    }),
  })
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export const computeWorkerCount = (): number => {
  const hc = (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number')
    ? navigator.hardwareConcurrency
    : 2
  return Math.max(2, Math.min(8, hc - 1))
}

// In dev builds, assert that the buffer has been detached post-postMessage.
// We treat any environment where `import.meta.env?.DEV` is truthy OR
// `process.env.NODE_ENV !== 'production'` as a dev build.
//
// We type `import.meta` locally instead of pulling in `vite/client`: the
// project's tsconfig has `"types": []`, so adding a global types reference
// would expand the ambient surface unnecessarily. Vite injects `import.meta.env`
// at build time; the narrow intersection below describes only the field we
// actually read.
export const isDevBuild = (): boolean => {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
  if (env && env.DEV === true) return true

  type ProcessLike = {
    env?: {
      readonly NODE_ENV?: string
    }
  }
  const processLike = (globalThis as typeof globalThis & { process?: ProcessLike }).process
  return processLike?.env?.NODE_ENV !== 'production'
}

// @effect-boundary - Worker termination is a browser-side operation
// that may throw; we must not crash the pool manager for an already-dead worker.
export const terminateWorkerSafely = (worker: Worker): void => {
  try {
    worker.terminate()
  } catch {
    // ignore: terminate after a fatal error sometimes throws
  }
      }

export const formatWorkerErrorDetails = (event: ErrorEvent): string => {
  const details = [
    `message=${event.message === '' ? 'unknown error' : event.message}`,
  ]

  if (event.filename !== '') {
    details.push(`filename=${event.filename}`)
  }
  if (event.lineno !== 0) {
    details.push(`lineno=${String(event.lineno)}`)
  }
  if (event.colno !== 0) {
    details.push(`colno=${String(event.colno)}`)
  }
  if (event.error !== undefined && event.error !== null) {
    details.push(
      `error=${event.error instanceof Error ? event.error.message : String(event.error)}`,
    )
  }

  return details.join(', ')
}
