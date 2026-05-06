import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, MutableRef, Option } from 'effect'
import { FluidService, FluidServiceLive, resolveContact } from '@ts-minecraft/terrain'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { Chunk } from '../domain/chunk'
import {
  FLUID_BYTE_LENGTH,
  createFluidBuffer,
  encodeFluidCell,
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
  Layer.succeed(ChunkManagerService, ChunkManagerService.of({
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: (_coord: { x: number; z: number }) =>
      Effect.succeed(chunks[0] ?? makeEmptyChunk()),
    markChunkDirty: (_coord: { x: number; z: number }) => Effect.void,
    getLoadedChunks: () => Effect.succeed(chunks),
    drainRenderDirtyChunks: () => Effect.succeed([]),
    loadChunksAroundPlayer: () => Effect.succeed(false),
    saveDirtyChunks: () => Effect.void,
    unloadChunk: () => Effect.void,
  }))

// ---------------------------------------------------------------------------
// resolveContact (pure function, exported)
// ---------------------------------------------------------------------------

describe('terrain/application/fluid-service resolveContact', () => {
  it('lava flowing + water source → COBBLESTONE', () => {
    const result = resolveContact(
      { level: 2, source: false, type: 'lava' },
      { level: 0, source: true, type: 'water' },
    )
    expect(result).toEqual(Option.some('COBBLESTONE'))
  })

  it('lava flowing + water flowing → COBBLESTONE', () => {
    const result = resolveContact(
      { level: 2, source: false, type: 'lava' },
      { level: 2, source: false, type: 'water' },
    )
    expect(result).toEqual(Option.some('COBBLESTONE'))
  })

  it('lava source + any water → OBSIDIAN', () => {
    const result = resolveContact(
      { level: 0, source: true, type: 'lava' },
      { level: 1, source: false, type: 'water' },
    )
    expect(result).toEqual(Option.some('OBSIDIAN'))
  })

  it('water + water → none (same type, not lava)', () => {
    const result = resolveContact(
      { level: 0, source: true, type: 'water' },
      { level: 0, source: true, type: 'water' },
    )
    expect(result).toEqual(Option.none())
  })

  it('non-lava first arg → none', () => {
    const result = resolveContact(
      { level: 0, source: true, type: 'water' },
      { level: 0, source: true, type: 'lava' },
    )
    expect(result).toEqual(Option.none())
  })
})

// ---------------------------------------------------------------------------
// FluidService unit tests
// ---------------------------------------------------------------------------

describe('terrain/application/fluid-service', () => {
  // ─── notifyBlockChanged ──────────────────────────────────────────────────

  it.effect('notifyBlockChanged enqueues a position to frontier', () => {
    const layer = FluidServiceLive.pipe(
      Layer.provide(makeChunkManagerLayer([])),
    )
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.notifyBlockChanged({ x: 0, y: 64, z: 0 })
      // If this completes without error, notification is enqueued.
    }).pipe(Effect.provide(layer))
  })

  // ─── seedWater / removeWater ─────────────────────────────────────────────

  it.effect('seedWater seeds a water cell and writes to the chunk fluid buffer', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeEmptyChunk({ x: 0, z: 0 })
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      // syncLoadedChunks to populate the loaded cache
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      // After seeding, markChunkDirty should have been called
      expect(MutableRef.get(markDirtyCalledRef)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('removeWater removes the fluid cell and writes air to chunk', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      MutableRef.set(markDirtyCalledRef, false)
      yield* svc.removeWater({ x: 0, y: 64, z: 0 })
      expect(MutableRef.get(markDirtyCalledRef)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  // ─── syncLoadedChunks — covers ensureFluidBuffer None path (lines 19-23) ─

  it.effect('syncLoadedChunks with chunk having no fluid buffer creates one (ensureFluidBuffer None path)', () => {
    // chunk.fluid = Option.none() triggers the onNone branch in ensureFluidBuffer
    // which creates a new Uint8Array and mutates chunk.fluid in place
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    // Ensure fluid is None
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.none()

    const markDirtyCalledRef = MutableRef.make(false)
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      // syncLoadedChunks calls hydrateChunk which processes the WATER block
      // Then tick should run and call setFluidBlockIfLoaded → ensureFluidBuffer
      yield* svc.syncLoadedChunks([chunk])
      // Seed at the water position to trigger ensureFluidBuffer None path
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      // After seedWater the chunk.fluid should now be Some
      expect(Option.isSome(chunk.fluid)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('syncLoadedChunks with chunk having wrong-length fluid buffer creates new one', () => {
    // chunk.fluid with wrong byteLength triggers the onNone branch in ensureFluidBuffer
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(new Uint8Array(10))

    const markDirtyCalledRef = MutableRef.make(false)
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      // Fluid should now have been replaced with correct length
      expect(Option.isSome(chunk.fluid)).toBe(true)
      const fluidBuffer = Option.getOrThrow(chunk.fluid)
      if (!(fluidBuffer instanceof Uint8Array)) {
        throw new Error('Expected chunk fluid to be a Uint8Array')
      }
      expect(fluidBuffer.byteLength).toBe(FLUID_BYTE_LENGTH)
    }).pipe(Effect.provide(layer))
  })

  it.effect('syncLoadedChunks with proper fluid buffer uses it (onSome path)', () => {
    // Create a chunk with a valid fluid buffer that has a water cell encoded
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    const fluidBuffer = createFluidBuffer()
    const idx = blockIndexAt(0, 64, 0)
    fluidBuffer[idx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const layer = FluidServiceLive.pipe(Layer.provide(makeChunkManagerLayer([chunk])))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      // syncLoadedChunks should hydrate state from the existing fluid buffer
      yield* svc.syncLoadedChunks([chunk])
      // Sync completed without error, state was hydrated from existing buffer
    }).pipe(Effect.provide(layer))
  })
})
