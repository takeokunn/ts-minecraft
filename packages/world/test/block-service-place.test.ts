import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, Layer, MutableRef, Option } from 'effect'
import { BlockService, BlockServiceLive, BlockServiceError } from '@ts-minecraft/world'
import { ChunkManagerService } from '@ts-minecraft/world'
import { ChunkServiceLive } from '@ts-minecraft/world/application/chunk-service'
import { FluidService } from '@ts-minecraft/world'
import { PlayerService } from '@ts-minecraft/entity'
import { InventoryService, InventoryError } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, Position, SlotIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeBlocks = (overrides: Array<{ idx: number; type: BlockType }> = []): Uint8Array<ArrayBufferLike> => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  Arr.forEach(overrides, ({ idx, type }) => {
    blocks[idx] = blockTypeToIndex(type)
  })
  return blocks
}

// Block index for local (lx=0, y=64, lz=0): y + z*CHUNK_HEIGHT + x*CHUNK_HEIGHT*CHUNK_SIZE = 64
const BLOCK_IDX_64 = 64

const makeChunk = (blockType: BlockType = 'AIR', localIdx = BLOCK_IDX_64) =>
  ({
    coord: { x: 0, z: 0 },
    blocks: makeBlocks(blockType !== 'AIR' ? [{ idx: localIdx, type: blockType }] : []),
    fluid: Option.none(),
  })

const noopFluidService = Layer.succeed(FluidService, {
  _tag: '@minecraft/application/FluidService' as const,
  notifyBlockChanged: () => Effect.void,
  seedWater: () => Effect.void,
  seedLava: () => Effect.void,
  removeWater: () => Effect.void,
  removeLava: () => Effect.void,
  syncLoadedChunks: () => Effect.void,
  tick: () => Effect.void,
} as unknown as FluidService)

const makeChunkManagerLayer = (opts: {
  chunk?: ReturnType<typeof makeChunk>
  markDirtyFail?: boolean
} = {}) => {
  const chunk = opts.chunk ?? makeChunk()
  return Layer.succeed(ChunkManagerService, {
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: () => Effect.succeed(chunk),
    markChunkDirty: () => Effect.void,
    getLoadedChunks: () => Effect.succeed([chunk]),
    drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
    loadChunksAroundPlayer: () => Effect.succeed(false),
    saveDirtyChunks: () => Effect.void,
    unloadChunk: () => Effect.void,
  } as unknown as ChunkManagerService)
}

const makePlayerLayer = (pos: Position = { x: 100, y: 100, z: 100 }) =>
  Layer.succeed(PlayerService, {
    _tag: '@minecraft/application/PlayerService' as const,
    getPosition: () => Effect.succeed(pos),
    create: () => Effect.void,
    updatePosition: () => Effect.void,
    updateVelocity: () => Effect.void,
    getState: () => Effect.fail(new Error('not needed') as never),
  } as unknown as PlayerService)

const makeInventoryLayer = (opts: {
  removeBlockFails?: boolean
} = {}) =>
  Layer.succeed(InventoryService, {
    _tag: '@minecraft/application/InventoryService' as const,
    addBlock: () => Effect.void,
    removeBlock: (_blockType: BlockType) => opts.removeBlockFails
      ? Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `No ${_blockType} available` }))
      : Effect.void,
    getSlot: () => Effect.succeed(Option.none()),
    getHotbarSlots: () => Effect.succeed([]),
    getAllSlots: () => Effect.succeed([]),
    serialize: () => Effect.succeed({ slots: [] }),
    deserialize: () => Effect.void,
  } as unknown as InventoryService)

const makeHotbarLayer = (selectedBlockType: Option.Option<BlockType> = Option.none()) =>
  Layer.succeed(HotbarService, {
    _tag: '@minecraft/application/HotbarService' as const,
    getSelectedBlockType: () => Effect.succeed(selectedBlockType),
    getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
    setSelectedSlot: () => Effect.void,
    getSlots: () => Effect.succeed([]),
    update: () => Effect.void,
  } as unknown as HotbarService)

const makeFurnaceLayer = (opts: {
  dismantleResult?: boolean
} = {}) =>
  Layer.succeed(FurnaceService, {
    _tag: '@minecraft/application/FurnaceService' as const,
    dismantleFurnace: () => Effect.succeed(opts.dismantleResult ?? true),
    registerFurnace: () => Effect.void,
    unregisterFurnace: () => Effect.void,
    setSelectedFurnace: () => Effect.void,
    startSmelting: () => Effect.void,
    tick: () => Effect.void,
    collectOutput: () => Effect.void,
    getNearestFurnaceState: () => Effect.succeed(Option.none()),
    getFurnaceState: () => Effect.succeed(Option.none()),
    serialize: () => Effect.succeed([]),
    deserialize: () => Effect.void,
  } as unknown as FurnaceService)

const buildLayer = (opts: {
  blockAtIdx?: BlockType
  selectedTool?: Option.Option<BlockType>
  playerPos?: Position
  removeBlockFails?: boolean
  dismantleResult?: boolean
} = {}) =>
  BlockServiceLive.pipe(
    Layer.provide(makeChunkManagerLayer({ chunk: makeChunk(opts.blockAtIdx ?? 'STONE') })),
    Layer.provide(ChunkServiceLive),
    Layer.provide(noopFluidService),
    Layer.provide(makePlayerLayer(opts.playerPos)),
    Layer.provide(makeInventoryLayer(opts.removeBlockFails === undefined ? {} : { removeBlockFails: opts.removeBlockFails })),
    Layer.provide(makeHotbarLayer(opts.selectedTool)),
    Layer.provide(makeFurnaceLayer(opts.dismantleResult === undefined ? {} : { dismantleResult: opts.dismantleResult })),
  )

describe('terrain/application/block-service placeBlock inventory rollback', () => {
  it.effect('placeBlock fails and rolls back when removeBlock fails', () => {
    // Position far from player so blockOverlapsPlayer is false
    const chunk = makeChunk('AIR', BLOCK_IDX_64)
    const layer = BlockServiceLive.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkServiceLive),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer({ x: 100, y: 100, z: 100 })),
      Layer.provide(makeInventoryLayer({ removeBlockFails: true })),
      Layer.provide(makeHotbarLayer()),
      Layer.provide(makeFurnaceLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.operation).toBe('placeBlock')
      expect(err.reason).toContain('No STONE available in inventory')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock on a non-air position fails with "Block already exists" error', () => {
    const layer = buildLayer({ blockAtIdx: 'STONE' })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'DIRT'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.reason).toContain('Block already exists')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock with NON_PLACEABLE_BLOCK_TYPES fails', () => {
    const chunk = makeChunk('AIR')
    const layer = BlockServiceLive.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkServiceLive),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer({ x: 100, y: 100, z: 100 })),
      Layer.provide(makeInventoryLayer()),
      Layer.provide(makeHotbarLayer()),
      Layer.provide(makeFurnaceLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'DIAMOND'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.reason).toContain('cannot be placed')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock fails when block overlaps player position', () => {
    const chunk = makeChunk('AIR')
    const layer = BlockServiceLive.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkServiceLive),
      Layer.provide(noopFluidService),
      // Player at (0, 64, 0) → block at (0, 64, 0) will overlap
      Layer.provide(makePlayerLayer({ x: 0, y: 64, z: 0 })),
      Layer.provide(makeInventoryLayer()),
      Layer.provide(makeHotbarLayer()),
      Layer.provide(makeFurnaceLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.reason).toContain('inside player')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock WATER block triggers seedWater', () => {
    const seedWaterCalledRef = MutableRef.make(false)
    const chunk = makeChunk('AIR')
    const fluidSvc = Layer.succeed(FluidService, {
      _tag: '@minecraft/application/FluidService' as const,
      notifyBlockChanged: () => Effect.void,
      seedWater: () => Effect.sync(() => { MutableRef.set(seedWaterCalledRef, true) }),
      seedLava: () => Effect.void,
      removeWater: () => Effect.void,
      removeLava: () => Effect.void,
      syncLoadedChunks: () => Effect.void,
      tick: () => Effect.void,
    } as unknown as FluidService)
    const layer = BlockServiceLive.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkServiceLive),
      Layer.provide(fluidSvc),
      Layer.provide(makePlayerLayer({ x: 100, y: 100, z: 100 })),
      Layer.provide(makeInventoryLayer()),
      Layer.provide(makeHotbarLayer()),
      Layer.provide(makeFurnaceLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'WATER'))
      expect(Either.isRight(result)).toBe(true)
      expect(MutableRef.get(seedWaterCalledRef)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

})
