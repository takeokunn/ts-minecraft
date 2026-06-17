import { Effect, Layer } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/world'
import type { Chunk } from '../domain/chunk'
import { makeEmptyTestChunk } from './chunk-buffer-test-utils'

export type FluidChunkManagerLayerOverrides = Partial<{
  readonly getChunk: (coord: { x: number; z: number }) => Effect.Effect<Chunk>
  readonly markChunkDirty: (coord: { x: number; z: number }) => Effect.Effect<void>
  readonly getLoadedChunks: () => Effect.Effect<ReadonlyArray<Chunk>>
  readonly drainRenderDirtyChunks: () => Effect.Effect<ReadonlyArray<unknown>>
  readonly drainRenderDirtyChunkEntries: () => Effect.Effect<ReadonlyArray<unknown>>
  readonly loadChunksAroundPlayer: (
    playerPos: { x: number; y: number; z: number },
    renderDistance?: number,
    options?: unknown,
  ) => Effect.Effect<boolean>
  readonly saveDirtyChunks: () => Effect.Effect<void>
  readonly unloadChunk: (coord: { x: number; z: number }) => Effect.Effect<void>
}>

export const makeChunkManagerLayer = (
  chunks: ReadonlyArray<Chunk>,
  overrides: FluidChunkManagerLayerOverrides = {},
) =>
  Layer.succeed(
    ChunkManagerService,
    ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: (_coord: { x: number; z: number }) =>
        Effect.succeed(chunks[0] ?? makeEmptyTestChunk()),
      markChunkDirty: (_coord: { x: number; z: number }) => Effect.void,
      getLoadedChunks: () => Effect.succeed(chunks),
      drainRenderDirtyChunks: () => Effect.succeed([]),
      drainRenderDirtyChunkEntries: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
      ...overrides,
    }),
  )
