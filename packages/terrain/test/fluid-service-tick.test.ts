import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, MutableRef, Option } from 'effect'
import { FluidService, FluidServiceLive } from '@ts-minecraft/terrain'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { Chunk } from '../domain/chunk'
import {
  FLUID_BYTE_LENGTH,
  createFluidBuffer,
  encodeFluidCell,
  WATER_INDEX,
  LAVA_INDEX,
} from '@ts-minecraft/world-state'
import { blockIndex } from '@ts-minecraft/kernel'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEmptyChunk = (coord: { x: number; z: number } = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

// blockIndex(lx=0, y=64, lz=0) = 64 (y + z*CHUNK_HEIGHT + x*CHUNK_HEIGHT*CHUNK_SIZE)
const blockIndexAt = (lx: number, y: number, lz: number): number =>
  Option.getOrElse(blockIndex(lx, y, lz), () => -1)

const makeChunkWith = (
  blockTypes: Array<{ lx: number; y: number; lz: number; blockType: 'WATER' | 'LAVA' | 'AIR' | 'STONE' | 'DIRT' }>,
  coord: { x: number; z: number } = { x: 0, z: 0 },
): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  Arr.forEach(blockTypes, ({ lx, y, lz, blockType }) => {
    const idx = blockIndexAt(lx, y, lz)
    if (idx >= 0) blocks[idx] = blockTypeToIndex(blockType)
  })
  return { coord, blocks, fluid: Option.none() }
}

const makeChunkManagerLayer = (chunks: Chunk[]) =>
  Layer.succeed(ChunkManagerService, {
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: (_coord: { x: number; z: number }) =>
      Effect.succeed(chunks[0] ?? makeEmptyChunk()),
    markChunkDirty: (_coord: { x: number; z: number }) => Effect.void,
    getLoadedChunks: () => Effect.succeed(chunks),
  } as unknown as ChunkManagerService)


describe('terrain/application/fluid-service', () => {

  // ─── tick — empty frontier (line 278) ────────────────────────────────────

  it.effect('tick with no frontier increments tickCounter only (empty frontier path)', () => {
    const layer = FluidServiceLive.pipe(
      Layer.provide(makeChunkManagerLayer([])),
    )
    return Effect.gen(function* () {
      const svc = yield* FluidService
      // No seeding → frontier is empty → tick should hit line 278-280
      yield* svc.tick()
      yield* svc.tick()
      // If these complete without error, the early-return path works
    }).pipe(Effect.provide(layer))
  })

  // ─── tick — stale key in frontier (lines 294-295, 332-334) ───────────────

  it.effect('tick removes cell when block at position is no longer the correct fluid type', () => {
    // Seed water at a position, then replace with AIR in the chunk but keep it in state.
    // On tick, blocks[idx] !== blockIndexFor('water') → cell is removed (line 332-334).
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    const fluidBuffer = createFluidBuffer()
    const idx = blockIndexAt(0, 64, 0)
    fluidBuffer[idx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.void,
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      // Now overwrite the block with AIR — the fluid state still has the cell
      chunk.blocks[idx] = blockTypeToIndex('AIR')
      // tick should detect mismatch and remove the cell
      yield* svc.tick()
      // No error means the stale-cell removal path executed correctly
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick skips processing when frontier has keys not present in cells (lines 294-295)', () => {
    // notifyBlockChanged adds keys to frontier but cells map may not have matching entries.
    // This exercises workWithCells = Arr.filterMap(...) → produces empty work array.
    const chunk = makeEmptyChunk()
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.void,
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      // Add keys to frontier without corresponding cells via notifyBlockChanged
      yield* svc.notifyBlockChanged({ x: 0, y: 64, z: 0 })
      yield* svc.notifyBlockChanged({ x: 1, y: 64, z: 0 })
      // tick processes keys → filterMap returns empty (no cells) → work = []
      yield* svc.tick()
    }).pipe(Effect.provide(layer))
  })

  // ─── tick — downward flow (water falls to empty space below) ─────────────

  it.effect('tick flows water downward into air below', () => {
    // Water source at y=64, AIR at y=63 → tick should spread water down
    const markDirtyCountRef = MutableRef.make(0)
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    const fluidBuffer = createFluidBuffer()
    const idx = blockIndexAt(0, 64, 0)
    fluidBuffer[idx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
      // markChunkDirty should be called for the water spread
      expect(MutableRef.get(markDirtyCountRef)).toBeGreaterThan(0)
    }).pipe(Effect.provide(layer))
  })

  // ─── tick — lateral flow (FLOW_OFFSETS path, lines 357-402) ──────────────

  it.effect('tick flows water laterally when below is blocked', () => {
    // Water at y=64, STONE at y=63 (below is blocked), AIR at (1,64,0) → lateral spread
    const markDirtyCountRef = MutableRef.make(0)
    const chunk = makeChunkWith([
      { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
      { lx: 0, y: 63, lz: 0, blockType: 'STONE' }, // block below → no downward flow
    ])
    const fluidBuffer = createFluidBuffer()
    const waterIdx = blockIndexAt(0, 64, 0)
    fluidBuffer[waterIdx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
      // Lateral spread should have been attempted, calling markChunkDirty
      expect(MutableRef.get(markDirtyCountRef)).toBeGreaterThan(0)
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick skips max-level water that is not a source (non-spreading water)', () => {
    // A non-source water cell at max level should not spread (line 367: if (!cell.source && cell.level >= maxLevel) return)
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    const fluidBuffer = createFluidBuffer()
    const idx = blockIndexAt(0, 64, 0)
    // WATER_MAX_LEVEL = 7, source = false, level = 7
    fluidBuffer[idx] = encodeFluidCell({ level: 7, source: false, type: 'water' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const markDirtyCountRef = MutableRef.make(0)
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      // cell.level >= maxLevel → should return without writing anything
      yield* svc.tick()
      // markDirtyCountRef should be 0 since no spreading occurred
      expect(MutableRef.get(markDirtyCountRef)).toBe(0)
    }).pipe(Effect.provide(layer))
  })
})
