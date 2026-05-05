import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, Layer, Option } from 'effect'
import { BlockService, BlockServiceLive, blockOverlapsPlayer, worldToBlockLocal } from '@ts-minecraft/terrain'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { ChunkServiceLive } from '../application/chunk-service'
import { FluidService } from '@ts-minecraft/terrain'
import { PlayerService } from '@ts-minecraft/player'
import { InventoryService, InventoryError } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/furnace'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, Position, SlotIndex } from '@ts-minecraft/kernel'
import type { BlockType } from '@ts-minecraft/kernel'

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
} = {}) => {
  const chunk = opts.chunk ?? makeChunk()
  return Layer.succeed(ChunkManagerService, {
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: () => Effect.succeed(chunk),
    markChunkDirty: () => Effect.void,
    getLoadedChunks: () => Effect.succeed([chunk]),
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

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('terrain/application/block-service pure helpers', () => {
  it('worldToBlockLocal converts positive world coords correctly', () => {
    const result = worldToBlockLocal({ x: 16.5, y: 64, z: 32.9 })
    expect(result.chunkCoord).toEqual({ x: 1, z: 2 })
    expect(result.lx).toBe(0)
    expect(result.lz).toBe(0)
  })

  it('worldToBlockLocal handles negative coords with double-modulo', () => {
    const result = worldToBlockLocal({ x: -1, y: 0, z: -1 })
    expect(result.chunkCoord).toEqual({ x: -1, z: -1 })
    expect(result.lx).toBe(15)
    expect(result.lz).toBe(15)
  })

  it('blockOverlapsPlayer returns true when block is at player feet', () => {
    const playerFeet = { x: 5, y: 64, z: 5 }
    const blockPos = { x: 5, y: 64, z: 5 }
    expect(blockOverlapsPlayer(blockPos, playerFeet)).toBe(true)
  })

  it('blockOverlapsPlayer returns false when block is far from player', () => {
    const playerFeet = { x: 0, y: 64, z: 0 }
    const blockPos = { x: 5, y: 64, z: 5 }
    expect(blockOverlapsPlayer(blockPos, playerFeet)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// canHarvestBlock — the uncovered "non-pickaxe tool" branch (line 40)
// ---------------------------------------------------------------------------

describe('terrain/application/block-service breakBlock harvest logic', () => {
  it.effect('canHarvestBlock falls through to "non-pickaxe tool" branch (line 40) for a block not requiring pickaxe', () => {
    // DIRT is NOT in any pickaxe-harvestable set.
    // When selectedTool is 'STONE_SWORD' (not a pickaxe), canHarvestBlock line 40 runs:
    // return !HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, 'DIRT')
    // DIRT is NOT in IRON set → returns true → shouldDrop = true
    // DIRT is NOT in REQUIRES_PICKAXE_BLOCKS → breakBlock proceeds.
    const chunk = makeChunk('DIRT', BLOCK_IDX_64)
    const layer = BlockServiceLive.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkServiceLive),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(makeInventoryLayer()),
      // 'DIRT' is not a pickaxe so it falls through to line 40
      Layer.provide(makeHotbarLayer(Option.some('DIRT' as BlockType))),
      Layer.provide(makeFurnaceLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock with OBSIDIAN and a non-pickaxe tool selected fails (requires pickaxe)', () => {
    // OBSIDIAN is in DIAMOND_PICKAXE_HARVESTABLE_BLOCKS (= REQUIRES_PICKAXE_BLOCKS).
    // With tool 'DIRT' (not a pickaxe), canHarvestBlock returns !has(IRON_SET, OBSIDIAN).
    // OBSIDIAN is in DIAMOND set but not IRON set, so !has(IRON_SET, OBSIDIAN) = true — shouldDrop = true.
    // But wait, actually DIAMOND_PICKAXE_HARVESTABLE_BLOCKS = IRON_PICKAXE_HARVESTABLE_BLOCKS + OBSIDIAN.
    // IRON_PICKAXE_HARVESTABLE_BLOCKS does NOT contain OBSIDIAN.
    // So !has(IRON_SET, OBSIDIAN) = true → shouldDrop = true.
    // OBSIDIAN is in REQUIRES_PICKAXE_BLOCKS, shouldDrop = true → it proceeds.
    // Actually: let's pick 'IRON_ORE' with a non-pickaxe tool.
    // IRON_ORE is in IRON_PICKAXE_HARVESTABLE_BLOCKS → !has(IRON_SET, IRON_ORE) = false → shouldDrop = false.
    // IRON_ORE is in REQUIRES_PICKAXE_BLOCKS? REQUIRES_PICKAXE_BLOCKS = DIAMOND_PICKAXE_HARVESTABLE_BLOCKS.
    // DIAMOND set includes IRON set, so yes IRON_ORE is in REQUIRES_PICKAXE_BLOCKS.
    // shouldDrop = false and IRON_ORE is in REQUIRES_PICKAXE_BLOCKS → fail with "requires stronger pickaxe".
    const chunk = makeChunk('IRON_ORE', BLOCK_IDX_64)
    const layer = BlockServiceLive.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkServiceLive),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(makeInventoryLayer()),
      Layer.provide(makeHotbarLayer(Option.some('DIRT' as BlockType))),
      Layer.provide(makeFurnaceLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.reason).toContain('requires a stronger pickaxe')
    }).pipe(Effect.provide(layer))
  })

  it.effect('canHarvestBlock with STONE_PICKAXE tool covers that branch', () => {
    const layer = buildLayer({
      blockAtIdx: 'STONE',
      selectedTool: Option.some('STONE_PICKAXE' as BlockType),
    })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('canHarvestBlock with WOODEN_PICKAXE tool covers that branch', () => {
    const layer = buildLayer({
      blockAtIdx: 'STONE',
      selectedTool: Option.some('WOODEN_PICKAXE' as BlockType),
    })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('canHarvestBlock with WOODEN_PICKAXE returns false for non-harvestable block (covers false branch)', () => {
    // IRON_ORE is NOT in WOODEN_PICKAXE_HARVESTABLE_BLOCKS → HashSet.has returns false → breakBlock fails
    const layer = buildLayer({
      blockAtIdx: 'IRON_ORE',
      selectedTool: Option.some('WOODEN_PICKAXE' as BlockType),
    })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('canHarvestBlock with IRON_PICKAXE tool covers that branch', () => {
    const layer = buildLayer({
      blockAtIdx: 'STONE',
      selectedTool: Option.some('IRON_PICKAXE' as BlockType),
    })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('canHarvestBlock with DIAMOND_PICKAXE tool covers that branch', () => {
    const layer = buildLayer({
      blockAtIdx: 'STONE',
      selectedTool: Option.some('DIAMOND_PICKAXE' as BlockType),
    })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })
})

// ---------------------------------------------------------------------------
// breakBlock — FURNACE path (lines 137–150)
// ---------------------------------------------------------------------------
