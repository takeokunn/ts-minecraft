import { Effect, Layer, Option } from 'effect'
import type { FluidCell } from '@ts-minecraft/block/domain/fluid-model'
import { ChunkManagerService, FluidService } from '@ts-minecraft/world'
import { createFluidBuffer, encodeFluidCell } from '@ts-minecraft/block/domain/fluid'
import type { Chunk } from '../domain/chunk'
import type { ChunkAABB } from '../domain/chunk-aabb'
import {
  makeEmptyTestChunk,
  makeTestChunkWithBlocks,
  testBlockIndexAt,
  type ChunkBlockFixture,
} from './chunk-buffer-test-utils'

type RenderDirtyChunkEntry = Readonly<{
  readonly chunk: Chunk
  readonly dirtyAABB: Option.Option<ChunkAABB>
}>

export type FluidChunkManagerLayerOverrides = Partial<{
  readonly getChunk: (coord: { x: number; z: number }) => Effect.Effect<Chunk>
  readonly setActiveWorldId: (worldId: unknown) => Effect.Effect<void>
  readonly setActiveDimension: (dim: unknown) => Effect.Effect<void>
  readonly markChunkDirty: (coord: { x: number; z: number }) => Effect.Effect<void>
  readonly getLoadedChunks: () => Effect.Effect<ReadonlyArray<Chunk>>
  readonly drainRenderDirtyChunks: () => Effect.Effect<ReadonlyArray<Chunk>>
  readonly drainRenderDirtyChunkEntries: () => Effect.Effect<ReadonlyArray<RenderDirtyChunkEntry>>
  readonly loadChunksAroundPlayer: (
    playerPos: { x: number; y: number; z: number },
    renderDistance?: number,
    options?: unknown,
  ) => Effect.Effect<boolean>
  readonly saveDirtyChunks: () => Effect.Effect<void>
  readonly unloadChunk: (coord: { x: number; z: number }) => Effect.Effect<void>
}>

export type FluidCellFixture = Readonly<{
  readonly lx: number
  readonly y: number
  readonly lz: number
  readonly cell: FluidCell
}>

export type FluidTestChunkOptions = Readonly<{
  readonly blocks?: ReadonlyArray<ChunkBlockFixture>
  readonly fluids?: ReadonlyArray<FluidCellFixture>
  readonly coord?: { x: number; z: number }
}>

type FluidServiceTestApi = Readonly<{
  readonly tick: () => Effect.Effect<void>
  readonly syncLoadedChunks: (chunks: ReadonlyArray<Chunk>) => Effect.Effect<void>
  readonly notifyBlockChanged: (position: { x: number; y: number; z: number }) => Effect.Effect<void>
  readonly seedWater: (position: { x: number; y: number; z: number }) => Effect.Effect<void>
  readonly removeWater: (position: { x: number; y: number; z: number }) => Effect.Effect<void>
  readonly seedLava: (position: { x: number; y: number; z: number }) => Effect.Effect<void>
  readonly removeLava: (position: { x: number; y: number; z: number }) => Effect.Effect<void>
}>

export type FluidServiceTestOptions = Readonly<{
  readonly chunkManagerOverrides?: FluidChunkManagerLayerOverrides
  readonly syncLoadedChunks?: boolean
}>

export type DirtyChunkCall = Readonly<{ x: number; z: number }>

export const makeChunkManagerLayer = (
  chunks: ReadonlyArray<Chunk>,
  overrides: FluidChunkManagerLayerOverrides = {},
) =>
  Layer.succeed(
    ChunkManagerService,
    ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      setActiveWorldId: (_worldId: unknown) => Effect.void,
      setActiveDimension: (_dim: unknown) => Effect.void,
      getChunk: (_coord: { x: number; z: number }) =>
        Effect.succeed(chunks[0] ?? makeEmptyTestChunk()),
      markChunkDirty: (_coord: { x: number; z: number }) => Effect.void,
      getLoadedChunks: () => Effect.succeed(chunks),
      drainRenderDirtyChunks: () => Effect.succeed<ReadonlyArray<Chunk>>([]),
      drainRenderDirtyChunkEntries: () => Effect.succeed<ReadonlyArray<RenderDirtyChunkEntry>>([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
      ...overrides,
    }),
  )

export const seedChunkFluidCells = (
  chunk: Chunk,
  cells: ReadonlyArray<FluidCellFixture>,
): Chunk => {
  if (cells.length === 0) return chunk

  const fluidBuffer = createFluidBuffer()
  for (const { lx, y, lz, cell } of cells) {
    fluidBuffer[testBlockIndexAt(lx, y, lz)] = encodeFluidCell(cell)
  }
  return { ...chunk, fluid: Option.some(fluidBuffer) }
}

export const makeFluidTestChunk = ({
  blocks = [],
  fluids = [],
  coord,
}: FluidTestChunkOptions = {}): Chunk =>
  seedChunkFluidCells(makeTestChunkWithBlocks(blocks, coord), fluids)

export const withFluidService = <A, E, R>(
  chunks: ReadonlyArray<Chunk>,
  run: (svc: FluidServiceTestApi) => Effect.Effect<A, E, R>,
  options: FluidServiceTestOptions = {},
): Effect.Effect<A, E, R> => {
  const layer = FluidService.Default.pipe(
    Layer.provide(makeChunkManagerLayer(chunks, options.chunkManagerOverrides)),
  )

  return Effect.gen(function* () {
    const svc: FluidServiceTestApi = yield* FluidService
    if (options.syncLoadedChunks ?? true) {
      yield* svc.syncLoadedChunks(chunks)
    }
    return yield* run(svc)
  }).pipe(Effect.provide(layer))
}

export const withTrackedFluidService = <A, E, R>(
  chunks: ReadonlyArray<Chunk>,
  run: (svc: FluidServiceTestApi, dirtyCalls: ReadonlyArray<DirtyChunkCall>) => Effect.Effect<A, E, R>,
  options: FluidServiceTestOptions = {},
): Effect.Effect<A, E, R> => {
  const dirtyCalls: Array<DirtyChunkCall> = []

  return withFluidService(
    chunks,
    svc => run(svc, dirtyCalls),
    {
      ...options,
      chunkManagerOverrides: {
        ...options.chunkManagerOverrides,
        markChunkDirty: coord => Effect.sync(() => {
          dirtyCalls.push(coord)
        }),
      },
    },
  )
}
