/**
 * Wire-format schemas for the terrain worker pool.
 *
 * Two channels:
 *   - main → worker: TerrainWorkerRequest. Plain structured-cloneable values
 *     plus an `id` for response correlation.
 *   - worker → main: TerrainWorkerResponse. Either { kind: 'success', blocks,
 *     skyLight, blockLight } or { kind: 'failure', error }.
 *
 * Buffers cross the worker boundary as `Uint8Array`. The pool is responsible
 * for picking out their `.buffer` properties for the structured-clone transfer
 * list (zero-copy); decoders here are agnostic to whether the buffer was
 * transferred or copied.
 */
import { Effect, Schema } from 'effect'
import { ChunkCoordSchema } from '@ts-minecraft/domain'

export const TerrainWorkerRequestSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  chunk: ChunkCoordSchema,
  seaLevel: Schema.Number.pipe(Schema.int()),
  lakeLevel: Schema.Number.pipe(Schema.int()),
  seed: Schema.Number.pipe(Schema.int()),
})
export type TerrainWorkerRequest = Schema.Schema.Type<typeof TerrainWorkerRequestSchema>

export const TerrainWorkerSuccessSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  kind: Schema.Literal('success'),
  blocks: Schema.instanceOf(Uint8Array),
  skyLight: Schema.instanceOf(Uint8Array),
  blockLight: Schema.instanceOf(Uint8Array),
})
export type TerrainWorkerSuccess = Schema.Schema.Type<typeof TerrainWorkerSuccessSchema>

export const TerrainWorkerFailureSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  kind: Schema.Literal('failure'),
  error: Schema.String,
})
export type TerrainWorkerFailure = Schema.Schema.Type<typeof TerrainWorkerFailureSchema>

export const TerrainWorkerResponseSchema = Schema.Union(
  TerrainWorkerSuccessSchema,
  TerrainWorkerFailureSchema,
)
export type TerrainWorkerResponse = Schema.Schema.Type<typeof TerrainWorkerResponseSchema>

// Decoders — async via `Effect` so callers can fail-fast through the Effect
// runtime rather than throwing synchronously inside an `onmessage` handler.
// (The pool wraps these in try/catch so a malformed message is logged via
// `Effect.logError(Cause.pretty(...))` instead of crashing the main thread.)
export const decodeRequest = Schema.decodeUnknown(TerrainWorkerRequestSchema)
export const decodeResponse = Schema.decodeUnknown(TerrainWorkerResponseSchema)

// Sync decoders — only used inside the worker entrypoint where we cannot run
// the Effect runtime in the message-handler microtask. Errors from these
// surface as a `failure` response so the main thread sees a typed error.
export const decodeRequestSync = Schema.decodeUnknownSync(TerrainWorkerRequestSchema)

// Type helper for `Effect.Effect`-typed decoders so external imports get a
// stable signature regardless of how Schema's runtime types evolve.
export type DecodeError = Effect.Effect.Error<ReturnType<typeof decodeResponse>>
