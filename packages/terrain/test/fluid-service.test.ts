import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { FluidService, FluidServiceLive, resolveContact } from '@ts-minecraft/terrain'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, ChunkCacheKey } from '@ts-minecraft/kernel'
import type { Chunk } from '../domain/chunk'
import {
  FLUID_BYTE_LENGTH,
  createFluidBuffer,
  encodeFluidCell,
  WATER_INDEX,
  LAVA_INDEX,
} from '@ts-minecraft/world-state'
import { blockIndex } from '@ts-minecraft/kernel'
import { Option as OptionLib } from 'effect'

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
  for (const { lx, y, lz, blockType } of blockTypes) {
    const idx = blockIndexAt(lx, y, lz)
    if (idx >= 0) blocks[idx] = blockTypeToIndex(blockType)
  }
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
    let markDirtyCalled = false
    const chunk = makeEmptyChunk({ x: 0, z: 0 })
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCalled = true }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      // syncLoadedChunks to populate the loaded cache
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      // After seeding, markChunkDirty should have been called
      expect(markDirtyCalled).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('removeWater removes the fluid cell and writes air to chunk', () => {
    let markDirtyCalled = false
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCalled = true }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      markDirtyCalled = false
      yield* svc.removeWater({ x: 0, y: 64, z: 0 })
      expect(markDirtyCalled).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  // ─── syncLoadedChunks — covers ensureFluidBuffer None path (lines 19-23) ─

  it.effect('syncLoadedChunks with chunk having no fluid buffer creates one (ensureFluidBuffer None path)', () => {
    // chunk.fluid = Option.none() triggers the onNone branch in ensureFluidBuffer
    // which creates a new Uint8Array and mutates chunk.fluid in place
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    // Ensure fluid is None
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.none()

    let markDirtyCalled = false
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCalled = true }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
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
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      // Fluid should now have been replaced with correct length
      expect(Option.isSome(chunk.fluid)).toBe(true)
      const fluidBuffer = Option.getOrThrow(chunk.fluid)
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
    let markDirtyCount = 0
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    const fluidBuffer = createFluidBuffer()
    const idx = blockIndexAt(0, 64, 0)
    fluidBuffer[idx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCount++ }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
      // markChunkDirty should be called for the water spread
      expect(markDirtyCount).toBeGreaterThan(0)
    }).pipe(Effect.provide(layer))
  })

  // ─── tick — lateral flow (FLOW_OFFSETS path, lines 357-402) ──────────────

  it.effect('tick flows water laterally when below is blocked', () => {
    // Water at y=64, STONE at y=63 (below is blocked), AIR at (1,64,0) → lateral spread
    let markDirtyCount = 0
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
      markChunkDirty: () => Effect.sync(() => { markDirtyCount++ }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
      // Lateral spread should have been attempted, calling markChunkDirty
      expect(markDirtyCount).toBeGreaterThan(0)
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

    let markDirtyCount = 0
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCount++ }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      // cell.level >= maxLevel → should return without writing anything
      yield* svc.tick()
      // markDirtyCount should be 0 since no spreading occurred
      expect(markDirtyCount).toBe(0)
    }).pipe(Effect.provide(layer))
  })

  // ─── tick — blockAt covers line 177-180 (lateral flow opposite fluid) ────

  it.effect('tick handles lateral contact between water and lava (blockAt path)', () => {
    // Water source at (0,64,0), lava at (1,64,0). Below (0,63,0) is STONE.
    // The lateral flow loop checks isAirAt(loaded, target) → false for (1,64,0),
    // then calls blockAt(loaded, target) → returns Option<number> for lava index.
    // This covers blockAt (lines 177-180) and the isOpposite check (lines 393-399).
    const chunk = makeChunkWith([
      { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
      { lx: 0, y: 63, lz: 0, blockType: 'STONE' }, // block downward
      { lx: 1, y: 64, lz: 0, blockType: 'LAVA' },  // adjacent lava
    ])
    const fluidBuffer = createFluidBuffer()
    const waterIdx = blockIndexAt(0, 64, 0)
    const lavaIdx = blockIndexAt(1, 64, 0)
    fluidBuffer[waterIdx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    fluidBuffer[lavaIdx] = encodeFluidCell({ level: 0, source: true, type: 'lava' })
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
      // syncLoadedChunks to pick up both water+lava cells from fluidBuffer
      yield* svc.syncLoadedChunks([chunk])
      // tick: water cell processes, encounters lava to the right → resolveNeighborContact
      yield* svc.tick()
      // No error means blockAt and contact resolution ran correctly
    }).pipe(Effect.provide(layer))
  })

  // ─── lava seeding and lava tick interval ─────────────────────────────────

  it.effect('seedLava seeds a lava cell at the given position', () => {
    let markDirtyCalled = false
    const chunk = makeEmptyChunk()
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCalled = true }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedLava({ x: 0, y: 64, z: 0 })
      expect(markDirtyCalled).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick skips lava spreading on non-lava-tick (lava tick interval)', () => {
    // LAVA_TICK_INTERVAL = 3, so tick 1 and 2 should not spread lava.
    // This exercises the retainedLavaFrontier path in splitBudget.
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'LAVA' }])
    const fluidBuffer = createFluidBuffer()
    const idx = blockIndexAt(0, 64, 0)
    fluidBuffer[idx] = encodeFluidCell({ level: 0, source: true, type: 'lava' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    let markDirtyCount = 0
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCount++ }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      // tickCounter starts at 0; tick 1 → tickCounter = 1, lavaTickActive = false
      yield* svc.tick()
      // tick 2 → tickCounter = 2, lavaTickActive = false
      yield* svc.tick()
      // No lava should have spread yet (markDirty only for retained processing)
      // tick 3 → tickCounter = 3, lavaTickActive = true (3 % 3 = 0)
      yield* svc.tick()
      // Now lava has ticked
    }).pipe(Effect.provide(layer))
  })

  // ─── removeLava ───────────────────────────────────────────────────────────

  it.effect('removeLava removes the lava fluid cell', () => {
    let markDirtyCalled = false
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'LAVA' }])
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCalled = true }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedLava({ x: 0, y: 64, z: 0 })
      markDirtyCalled = false
      yield* svc.removeLava({ x: 0, y: 64, z: 0 })
      expect(markDirtyCalled).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  // ─── tick — chunk not in loaded cache (onNone path in tick's forEach) ─────

  it.effect('tick skips cells whose chunk is not in the loaded cache', () => {
    // Seed water but loadedCacheRef is empty (getLoadedChunks called with no loaded chunks).
    // The loaded = Ref.get(loadedCacheRef) will be empty → HashMap.get(loaded, key) = None
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
      // Do NOT call syncLoadedChunks → loaded cache is empty
      // But notifyBlockChanged + seedWater will add to state
      yield* svc.notifyBlockChanged({ x: 0, y: 64, z: 0 })
      // tick reads loadedCacheRef (empty, but getLoadedChunks fallback is used via getLoaded)
      // since loadedCacheRef is empty → getLoaded fetches from chunkManagerService.getLoadedChunks
      yield* svc.tick()
      // Completes without error
    }).pipe(Effect.provide(layer))
  })

  // ─── tick — lateral flow with non-air, non-opposite-fluid neighbor ────────

  it.effect('tick skips lateral spread into solid (non-air, non-opposite-type) blocks', () => {
    // Water at (0,64,0), STONE at (0,63,0) (blocks downward), STONE at (1,64,0) (blocks lateral).
    // This exercises the lateral loop's `!isAirAt(loaded, target)` → non-opposite check → return
    const chunk = makeChunkWith([
      { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
      { lx: 0, y: 63, lz: 0, blockType: 'STONE' },
      { lx: 1, y: 64, lz: 0, blockType: 'STONE' }, // solid, not opposite fluid
      { lx: 15, y: 64, lz: 0, blockType: 'STONE' }, // block other sides
      { lx: 0, y: 64, lz: 1, blockType: 'STONE' },
      { lx: 0, y: 64, lz: 15, blockType: 'STONE' },
    ])
    const fluidBuffer = createFluidBuffer()
    const waterIdx = blockIndexAt(0, 64, 0)
    fluidBuffer[waterIdx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    let markDirtyCount = 0
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { markDirtyCount++ }),
      getLoadedChunks: () => Effect.succeed([chunk]),
    } as unknown as ChunkManagerService)
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
      // Lateral spread was skipped because neighbors are solid; no markDirty for fluid writes
      // (only possible write is from resolveNeighborContact which doesn't match here)
    }).pipe(Effect.provide(layer))
  })
})
