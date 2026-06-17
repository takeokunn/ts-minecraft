import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, HashMap, Layer, Option } from 'effect'
import { BlockService, blockOverlapsPlayer, worldToBlockLocal } from '@ts-minecraft/world'
import { ChunkManagerService } from '@ts-minecraft/world'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { FluidService } from '@ts-minecraft/world'
import { PlayerService } from '@ts-minecraft/entity'
import { InventoryService, InventoryError } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { ChestService, FurnaceService } from '@ts-minecraft/inventory'
import { blockTypeToIndex, indexToBlockType, isValidBlockIndex, Position, SlotIndex } from '@ts-minecraft/core'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeBlocks = (overrides: Array<{ idx: number; type: BlockType }> = []): Uint8Array<ArrayBufferLike> => {
  const blocks = makeChunkBlockBuffer()
  Arr.forEach(overrides, ({ idx, type }) => {
    blocks[idx] = blockTypeToIndex(type)
  })
  return blocks
}

// Block index for local (lx=0, y=64, lz=0): y + z*CHUNK_HEIGHT + x*CHUNK_HEIGHT*CHUNK_SIZE = 64
const BLOCK_IDX_64 = 64
const BLOCK_IDX_65 = 65

const makeChunk = (blockType: BlockType = 'AIR', localIdx = BLOCK_IDX_64) =>
  ({
    coord: { x: 0, z: 0 },
    blocks: makeBlocks(blockType !== 'AIR' ? [{ idx: localIdx, type: blockType }] : []),
    fluid: Option.none(),
  })

const blockAt = (chunk: ReturnType<typeof makeChunk>, idx: number): BlockType => {
  const blockId = chunk.blocks[idx]
  if (!isValidBlockIndex(blockId)) throw new Error(`Invalid test block id: ${String(blockId)}`)
  return indexToBlockType(blockId)
}

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
  addBlock?: (itemType: InventoryItem, count: number) => Effect.Effect<void, InventoryError>
  removeBlockFails?: boolean
} = {}) =>
  Layer.succeed(InventoryService, {
    _tag: '@minecraft/application/InventoryService' as const,
    addBlock: (itemType: InventoryItem, count: number) =>
      opts.addBlock ? opts.addBlock(itemType, count) : Effect.void,
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


const makeChestLayer = (opts: {
  dismantleResult?: boolean
} = {}) =>
  Layer.succeed(ChestService, ChestService.of({
    _tag: '@minecraft/application/ChestService' as const,
    getState: () => Effect.succeed({ chests: HashMap.empty(), selectedChestPosition: Option.none() }),
    getNearestChestState: () => Effect.succeed(Option.none()),
    hasNearbyChest: () => Effect.succeed(false),
    setSelectedChest: () => Effect.void,
    moveInventoryStackToChestSlot: () => Effect.void,
    moveChestStackToInventorySlot: () => Effect.void,
    quickMoveInventoryToChest: () => Effect.void,
    quickMoveChestToInventory: () => Effect.void,
    clearChest: () => Effect.succeed([]),
    dismantleChest: () => Effect.succeed(opts.dismantleResult ?? true),
    serialize: () => Effect.succeed([]),
    deserialize: () => Effect.void,
  }))

const buildLayer = (opts: {
  blockAtIdx?: BlockType
  chunk?: ReturnType<typeof makeChunk>
  selectedTool?: Option.Option<BlockType>
  playerPos?: Position
  addBlock?: (itemType: InventoryItem, count: number) => Effect.Effect<void, InventoryError>
  removeBlockFails?: boolean
  dismantleResult?: boolean
  chestDismantleResult?: boolean
} = {}) =>
  BlockService.Default.pipe(
    Layer.provide(makeChunkManagerLayer({ chunk: opts.chunk ?? makeChunk(opts.blockAtIdx ?? 'STONE') })),
    Layer.provide(ChunkService.Default),
    Layer.provide(noopFluidService),
    Layer.provide(makePlayerLayer(opts.playerPos)),
    Layer.provide(makeInventoryLayer({
      ...(opts.addBlock === undefined ? {} : { addBlock: opts.addBlock }),
      ...(opts.removeBlockFails === undefined ? {} : { removeBlockFails: opts.removeBlockFails }),
    })),
    Layer.provide(makeHotbarLayer(opts.selectedTool)),
    Layer.provide(makeFurnaceLayer(opts.dismantleResult === undefined ? {} : { dismantleResult: opts.dismantleResult })),
    Layer.provide(
      makeChestLayer(
        opts.chestDismantleResult === undefined ? {} : { dismantleResult: opts.chestDismantleResult },
      ),
    ),
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
    const layer = BlockService.Default.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkService.Default),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(makeInventoryLayer()),
      // 'DIRT' is not a pickaxe so it falls through to line 40
      Layer.provide(makeHotbarLayer(Option.some('DIRT' as BlockType))),
      Layer.provide(makeFurnaceLayer()),
      Layer.provide(makeChestLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock with IRON_ORE and a non-pickaxe tool fails (requires a pickaxe)', () => {
    // IRON_ORE ∈ REQUIRES_PICKAXE_BLOCKS, and a non-pickaxe tool ('DIRT') gives
    // shouldDrop = false → breakBlock rejects with "requires a stronger pickaxe".
    const chunk = makeChunk('IRON_ORE', BLOCK_IDX_64)
    const layer = BlockService.Default.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkService.Default),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(makeInventoryLayer()),
      Layer.provide(makeHotbarLayer(Option.some('DIRT' as BlockType))),
      Layer.provide(makeFurnaceLayer()),
      Layer.provide(makeChestLayer()),
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

  it.effect('breakBlock does not drop tall grass itself on a normal break', () => {
    const added: Array<{ readonly itemType: InventoryItem; readonly count: number }> = []
    const layer = buildLayer({
      blockAtIdx: 'TALL_GRASS',
      addBlock: (itemType, count) => Effect.sync(() => {
        added.push({ itemType, count })
      }),
    })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
      expect(added).toEqual([])
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock drops fern itself when silkTouch is true', () => {
    const added: Array<{ readonly itemType: InventoryItem; readonly count: number }> = []
    const layer = buildLayer({
      blockAtIdx: 'FERN',
      addBlock: (itemType, count) => Effect.sync(() => {
        added.push({ itemType, count })
      }),
    })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }, true))
      expect(Either.isRight(result)).toBe(true)
      expect(added).toEqual([{ itemType: 'FERN', count: 1 }])
    }).pipe(Effect.provide(layer))
  })

  // OBSIDIAN is the only DIAMOND-tier-exclusive block (in the diamond set but not
  // the iron set). It must require a DIAMOND pickaxe: bare hand, a non-pickaxe
  // tool, and even an IRON pickaxe must all be rejected. (Regression: the
  // bare-hand / non-pickaxe boundary previously used the iron set, which let a
  // hand or sword harvest obsidian — breaking the diamond-tier progression gate.)
  it.effect('OBSIDIAN cannot be harvested by hand (requires a diamond pickaxe)', () => {
    const layer = buildLayer({ blockAtIdx: 'OBSIDIAN', selectedTool: Option.none() })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
      expect(Option.getOrThrow(Either.getLeft(result)).reason).toContain('requires a stronger pickaxe')
    }).pipe(Effect.provide(layer))
  })

  it.effect('OBSIDIAN cannot be harvested by a non-pickaxe tool', () => {
    const layer = buildLayer({ blockAtIdx: 'OBSIDIAN', selectedTool: Option.some('STONE_SWORD' as BlockType) })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('OBSIDIAN cannot be harvested by an IRON pickaxe (needs diamond)', () => {
    const layer = buildLayer({ blockAtIdx: 'OBSIDIAN', selectedTool: Option.some('IRON_PICKAXE' as BlockType) })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('OBSIDIAN IS harvestable by a DIAMOND pickaxe', () => {
    const layer = buildLayer({ blockAtIdx: 'OBSIDIAN', selectedTool: Option.some('DIAMOND_PICKAXE' as BlockType) })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock can bypass harvest checks and drops for creative-style breaks', () => {
    const added: Array<{ readonly itemType: InventoryItem; readonly count: number }> = []
    const chunk = makeChunk('OBSIDIAN', BLOCK_IDX_64)
    const layer = buildLayer({
      chunk,
      selectedTool: Option.none(),
      addBlock: (itemType, count) => Effect.sync(() => {
        added.push({ itemType, count })
      }),
    })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock(
        { x: 0, y: 64, z: 0 },
        false,
        { requireHarvest: false, dropItems: false },
      ))
      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(added).toEqual([])
    }).pipe(Effect.provide(layer))
  })
})

// ---------------------------------------------------------------------------
// placeBlock / breakBlock — vertical DOOR handling
// ---------------------------------------------------------------------------

describe('terrain/application/block-service vertical DOOR handling', () => {
  it.effect('placeBlock creates lower and upper DOOR blocks while consuming one item', () => {
    const chunk = makeChunk('AIR')
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'DOOR'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('DOOR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('DOOR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock refuses a DOOR when the upper block is occupied', () => {
    const chunk = { ...makeChunk('AIR'), blocks: makeBlocks([{ idx: BLOCK_IDX_65, type: 'STONE' }]) }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'DOOR'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('STONE')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rolls back both DOOR blocks when inventory removal fails', () => {
    const chunk = makeChunk('AIR')
    const layer = buildLayer({ chunk, removeBlockFails: true })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'DOOR'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes both halves of a matching DOOR', () => {
    const chunk = { ...makeChunk('AIR'), blocks: makeBlocks([{ idx: BLOCK_IDX_64, type: 'DOOR' }, { idx: BLOCK_IDX_65, type: 'DOOR' }]) }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })
})

// ---------------------------------------------------------------------------
// support-sensitive blocks
// ---------------------------------------------------------------------------

describe('terrain/application/block-service support updates', () => {
  it.effect('breakBlock removes a torch when its support block is broken', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'DIRT' },
        { idx: BLOCK_IDX_65, type: 'TORCH' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes wheat crop when farmland support is broken', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'FARMLAND' },
        { idx: BLOCK_IDX_65, type: 'WHEAT_CROP' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes sapling when dirt support is broken', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'DIRT' },
        { idx: BLOCK_IDX_65, type: 'SAPLING' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes flower when dirt support is broken', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'DIRT' },
        { idx: BLOCK_IDX_65, type: 'DANDELION' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes tall grass when dirt support is broken', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'DIRT' },
        { idx: BLOCK_IDX_65, type: 'TALL_GRASS' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects torch placement without support below', () => {
    const chunk = makeChunk('AIR')
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'TORCH'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows torch placement on a solid support block', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'DIRT' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'TORCH'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('TORCH')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects sapling placement without plantable support below', () => {
    const chunk = makeChunk('AIR')
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'SAPLING'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects mushroom placement without plantable support below', () => {
    const chunk = makeChunk('AIR')
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'BROWN_MUSHROOM'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows sapling placement on a dirt support block', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'DIRT' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'SAPLING'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('SAPLING')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows flower placement on a dirt support block', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'DIRT' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'POPPY'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('POPPY')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows fern placement on a dirt support block', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'DIRT' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'FERN'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('FERN')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows sugar cane on sand support', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'SAND' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'SUGAR_CANE'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('SUGAR_CANE')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows stacked sugar cane support', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'SUGAR_CANE' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'SUGAR_CANE'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('SUGAR_CANE')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects sugar cane placement without support below', () => {
    const chunk = makeChunk('AIR')
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'SUGAR_CANE'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows cactus on sand support', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'SAND' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'CACTUS'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('CACTUS')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows stacked cactus support', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'CACTUS' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'CACTUS'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('CACTUS')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects cactus placement on dirt support', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'DIRT' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'CACTUS'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows lily pad on water support', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'WATER' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'LILY_PAD'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('LILY_PAD')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects lily pad placement without water support', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([{ idx: 63, type: 'DIRT' }]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'LILY_PAD'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes sugar cane when sand support is broken', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'SAND' },
        { idx: BLOCK_IDX_65, type: 'SUGAR_CANE' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes cactus when sand support is broken', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'SAND' },
        { idx: BLOCK_IDX_65, type: 'CACTUS' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('forceSetBlock clears lily pad after water support is removed', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'WATER' },
        { idx: BLOCK_IDX_65, type: 'LILY_PAD' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.forceSetBlock({ x: 0, y: 64, z: 0 }, 'AIR'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('forceSetBlock clears unsupported torch after removing its support', () => {
    const chunk = {
      ...makeChunk('AIR'),
      blocks: makeBlocks([
        { idx: BLOCK_IDX_64, type: 'DIRT' },
        { idx: BLOCK_IDX_65, type: 'TORCH' },
      ]),
    }
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.forceSetBlock({ x: 0, y: 64, z: 0 }, 'AIR'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })
})

// ---------------------------------------------------------------------------
// forceSetBlock (lines 214–233)
// ---------------------------------------------------------------------------

describe('terrain/application/block-service forceSetBlock', () => {
  it.effect('places a block at a valid position without inventory or player checks', () => {
    const layer = buildLayer({ blockAtIdx: 'AIR' })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.forceSetBlock({ x: 0, y: 64, z: 0 }, 'STONE'))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with BlockServiceError when getChunk rejects', () => {
    const failingChunkLayer = Layer.succeed(ChunkManagerService, {
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.fail(new Error('chunk not found')),
      markChunkDirty: () => Effect.void,
      getLoadedChunks: () => Effect.succeed([]),
    } as unknown as ChunkManagerService)
    const layer = BlockService.Default.pipe(
      Layer.provide(failingChunkLayer),
      Layer.provide(ChunkService.Default),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(makeInventoryLayer()),
      Layer.provide(makeHotbarLayer()),
      Layer.provide(makeFurnaceLayer()),
      Layer.provide(makeChestLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.forceSetBlock({ x: 0, y: 64, z: 0 }, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.operation).toBe('forceSetBlock')
      expect(err.reason).toContain('Failed to load chunk')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with BlockServiceError when y coordinate is out of bounds', () => {
    const layer = buildLayer({ blockAtIdx: 'AIR' })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      // y=−1 is below the valid range [0, CHUNK_HEIGHT) → setBlockInChunk emits BlockIndexError
      const result = yield* Effect.either(svc.forceSetBlock({ x: 0, y: -1, z: 0 }, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.operation).toBe('forceSetBlock')
      expect(err.reason).toContain('out of bounds')
    }).pipe(Effect.provide(layer))
  })
})

// ---------------------------------------------------------------------------
// breakBlock — container dismantle paths
// ---------------------------------------------------------------------------

describe('terrain/application/block-service breakBlock container dismantle paths', () => {
  it.effect('breakBlock refuses to remove a chest when its contents cannot fit in inventory', () => {
    const layer = buildLayer({ blockAtIdx: 'CHEST', chestDismantleResult: false })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.operation).toBe('breakBlock')
      expect(err.reason).toContain('Cannot break chest while its contents cannot fit in inventory')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes a chest after its contents are returned to inventory', () => {
    const layer = buildLayer({ blockAtIdx: 'CHEST', chestDismantleResult: true })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock refuses to remove a furnace when its contents cannot fit in inventory', () => {
    const layer = buildLayer({ blockAtIdx: 'FURNACE', dismantleResult: false })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })
})
