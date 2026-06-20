import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Option } from 'effect'
import { BlockService, blockOverlapsPlayer, worldToBlockLocal } from '@ts-minecraft/world'
import { InventoryError } from '@ts-minecraft/inventory/domain/errors'
import { createLightBuffer, setLightAt } from '@ts-minecraft/block/domain/light'
import { blockIndex, CHUNK_HEIGHT, CHUNK_SIZE, indexToBlockType, isValidBlockIndex, Position } from '@ts-minecraft/core'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import {
  createFailingChunkManagerService,
  createMockChestService,
  createMockChunkManagerService,
  createMockChunkManagerServiceFromChunks,
  createMockFurnaceService,
  createMockHotbarService,
  createMockInventoryService,
  createMockPlayerService,
  createTestLayer,
  makeEmptyChunk,
  writeBlock,
} from './block-service-test-utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Block index for local (lx=0, y=64, lz=0): y + z*CHUNK_HEIGHT + x*CHUNK_HEIGHT*CHUNK_SIZE = 64
const BLOCK_IDX_64 = 64
const BLOCK_IDX_65 = 65
const TEST_PLANT_POSITION: Position = { x: 1, y: 64, z: 1 }
const TEST_PLANT_IDX = Option.getOrThrow(blockIndex(1, 64, 1))
const TEST_PLANT_SUPPORT_IDX = Option.getOrThrow(blockIndex(1, 63, 1))
const TEST_PLANT_EAST_SUPPORT_IDX = Option.getOrThrow(blockIndex(2, 63, 1))
const TEST_PLANT_EAST_SIDE_IDX = Option.getOrThrow(blockIndex(2, 64, 1))
const DEFAULT_BLOCK_POSITION: Position = { x: 0, y: 64, z: 0 }

const writeBlockAtIndex = (chunk: Chunk, idx: number, blockType: BlockType): void => {
  const lx = Math.floor(idx / (CHUNK_HEIGHT * CHUNK_SIZE))
  const remainder = idx % (CHUNK_HEIGHT * CHUNK_SIZE)
  const lz = Math.floor(remainder / CHUNK_HEIGHT)
  const y = remainder % CHUNK_HEIGHT
  writeBlock(chunk, lx, y, lz, blockType)
}

const makeChunk = (blockType: BlockType = 'AIR', localIdx = BLOCK_IDX_64): Chunk => {
  const chunk = makeEmptyChunk({ x: 0, z: 0 })
  if (blockType !== 'AIR') writeBlockAtIndex(chunk, localIdx, blockType)
  return chunk
}

const makeLightBufferAt = (position: Position, value: number): Uint8Array<ArrayBufferLike> => {
  const light = createLightBuffer()
  setLightAt(light, position.x, position.y, position.z, value)
  return light
}

const blockAt = (chunk: Chunk, idx: number): BlockType => {
  const blockId = chunk.blocks[idx]
  if (!isValidBlockIndex(blockId)) throw new Error(`Invalid test block id: ${String(blockId)}`)
  return indexToBlockType(blockId)
}

const buildLayer = (opts: {
  blockAtIdx?: BlockType
  chunk?: Chunk
  selectedTool?: Option.Option<InventoryItem>
  playerPos?: Position
  addBlock?: (itemType: InventoryItem, count: number) => Effect.Effect<void, InventoryError>
  removeBlockFails?: boolean
  dismantleResult?: boolean
  chestDismantleResult?: boolean
} = {}) => {
  const chunkManager = opts.chunk
    ? createMockChunkManagerServiceFromChunks([opts.chunk])
    : createMockChunkManagerService([{ pos: DEFAULT_BLOCK_POSITION, blockType: opts.blockAtIdx ?? 'STONE' }])

  return createTestLayer(
    chunkManager.service,
    createMockPlayerService(opts.playerPos ?? { x: 100, y: 100, z: 100 }),
    undefined,
    createMockInventoryService({
      ...(opts.addBlock === undefined ? {} : { addBlock: opts.addBlock }),
      ...(opts.removeBlockFails === undefined
        ? {}
        : {
          removeBlock: (itemType) =>
            Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `No ${itemType} available` })),
        }),
    }),
    createMockHotbarService(opts.selectedTool),
    createMockFurnaceService(
      opts.dismantleResult === undefined
        ? {}
        : { dismantleFurnace: () => Effect.succeed(opts.dismantleResult ?? true) },
    ),
    createMockChestService(
      opts.chestDismantleResult === undefined
        ? {}
        : { dismantleChest: () => Effect.succeed(opts.chestDismantleResult ?? true) },
    ),
  )
}

const breakBlockEither = (
  layer: ReturnType<typeof buildLayer>,
  position: Position = DEFAULT_BLOCK_POSITION,
  silkTouch?: boolean,
  options?: { requireHarvest?: boolean; dropItems?: boolean },
) =>
  Effect.gen(function* () {
    return yield* Effect.either((yield* BlockService).breakBlock(position, silkTouch, options))
  }).pipe(Effect.provide(layer))

const placeBlockEither = (
  layer: ReturnType<typeof buildLayer>,
  position: Position,
  blockType: BlockType,
) =>
  Effect.gen(function* () {
    return yield* Effect.either((yield* BlockService).placeBlock(position, blockType))
  }).pipe(Effect.provide(layer))

const forceSetBlockEither = (
  layer: ReturnType<typeof buildLayer>,
  position: Position,
  blockType: BlockType,
) =>
  Effect.gen(function* () {
    return yield* Effect.either((yield* BlockService).forceSetBlock(position, blockType))
  }).pipe(Effect.provide(layer))

const makeChunkWithBlocks = (blocks: Array<{ idx: number; type: BlockType }>): Chunk => {
  const chunk = makeChunk('AIR')
  blocks.forEach(({ idx, type }) => {
    writeBlockAtIndex(chunk, idx, type)
  })
  return chunk
}

const expectBreakRemovesSupportAndAttachment = (supportBlock: BlockType, attachedBlock: BlockType) => {
  const chunk = makeChunkWithBlocks([
    { idx: BLOCK_IDX_64, type: supportBlock },
    { idx: BLOCK_IDX_65, type: attachedBlock },
  ])
  const layer = buildLayer({ chunk })
  return breakBlockEither(layer).pipe(
    Effect.tap((result) => Effect.sync(() => {
      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
    })),
  )
}

const expectPlaceResultAtDefaultPosition = (
  chunk: Chunk,
  blockType: BlockType,
  expected: 'left' | 'right',
) => {
  const layer = buildLayer({ chunk })
  return placeBlockEither(layer, DEFAULT_BLOCK_POSITION, blockType).pipe(
    Effect.tap((result) => Effect.sync(() => {
      expect(expected === 'right' ? Either.isRight(result) : Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe(expected === 'right' ? blockType : 'AIR')
    })),
  )
}

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
    const layer = buildLayer({ chunk, selectedTool: Option.some('DIRT') })
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
    const layer = buildLayer({ chunk, selectedTool: Option.some('DIRT') })
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
      selectedTool: Option.some('STONE_PICKAXE'),
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
      selectedTool: Option.some('WOODEN_PICKAXE'),
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
      selectedTool: Option.some('WOODEN_PICKAXE'),
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
      selectedTool: Option.some('IRON_PICKAXE'),
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
      selectedTool: Option.some('DIAMOND_PICKAXE'),
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
    const layer = buildLayer({ blockAtIdx: 'OBSIDIAN', selectedTool: Option.some('STONE_SWORD') })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('OBSIDIAN cannot be harvested by an IRON pickaxe (needs diamond)', () => {
    const layer = buildLayer({ blockAtIdx: 'OBSIDIAN', selectedTool: Option.some('IRON_PICKAXE') })
    return Effect.gen(function* () {
      const result = yield* Effect.either((yield* BlockService).breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('OBSIDIAN IS harvestable by a DIAMOND pickaxe', () => {
    const layer = buildLayer({ blockAtIdx: 'OBSIDIAN', selectedTool: Option.some('DIAMOND_PICKAXE') })
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
    return placeBlockEither(layer, DEFAULT_BLOCK_POSITION, 'DOOR').pipe(
      Effect.tap((result) => Effect.sync(() => {
      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('DOOR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('DOOR')
      })),
    )
  })

  it.effect('placeBlock refuses a DOOR when the upper block is occupied', () => {
    const chunk = makeChunkWithBlocks([{ idx: BLOCK_IDX_65, type: 'STONE' }])
    const layer = buildLayer({ chunk })
    return placeBlockEither(layer, DEFAULT_BLOCK_POSITION, 'DOOR').pipe(
      Effect.tap((result) => Effect.sync(() => {
      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('STONE')
      })),
    )
  })

  it.effect('placeBlock rolls back both DOOR blocks when inventory removal fails', () => {
    const chunk = makeChunk('AIR')
    const layer = buildLayer({ chunk, removeBlockFails: true })
    return placeBlockEither(layer, DEFAULT_BLOCK_POSITION, 'DOOR').pipe(
      Effect.tap((result) => Effect.sync(() => {
      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
      })),
    )
  })

  it.effect('breakBlock removes both halves of a matching DOOR', () => {
    const chunk = makeChunkWithBlocks([{ idx: BLOCK_IDX_64, type: 'DOOR' }, { idx: BLOCK_IDX_65, type: 'DOOR' }])
    const layer = buildLayer({ chunk })
    return breakBlockEither(layer).pipe(
      Effect.tap((result) => Effect.sync(() => {
        expect(Either.isRight(result)).toBe(true)
        expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
        expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
      })),
    )
  })
})

// ---------------------------------------------------------------------------
// support-sensitive blocks
// ---------------------------------------------------------------------------

describe('terrain/application/block-service support updates', () => {
  it.effect('breakBlock removes a torch when its support block is broken', () => {
    return expectBreakRemovesSupportAndAttachment('DIRT', 'TORCH')
  })

  it.effect('breakBlock removes wheat crop when farmland support is broken', () => {
    return expectBreakRemovesSupportAndAttachment('FARMLAND', 'WHEAT_CROP')
  })

  it.effect('breakBlock removes sapling when dirt support is broken', () => {
    return expectBreakRemovesSupportAndAttachment('DIRT', 'SAPLING')
  })

  it.effect('breakBlock removes flower when dirt support is broken', () => {
    return expectBreakRemovesSupportAndAttachment('DIRT', 'DANDELION')
  })

  it.effect('breakBlock removes tall grass when dirt support is broken', () => {
    return expectBreakRemovesSupportAndAttachment('DIRT', 'TALL_GRASS')
  })

  it.effect('placeBlock rejects torch placement without support below', () => {
    return expectPlaceResultAtDefaultPosition(makeChunk('AIR'), 'TORCH', 'left')
  })

  it.effect('placeBlock allows torch placement on a solid support block', () => {
    return expectPlaceResultAtDefaultPosition(makeChunkWithBlocks([{ idx: 63, type: 'DIRT' }]), 'TORCH', 'right')
  })

  it.effect('placeBlock rejects sapling placement without plantable support below', () => {
    return expectPlaceResultAtDefaultPosition(makeChunk('AIR'), 'SAPLING', 'left')
  })

  it.effect('placeBlock rejects mushroom placement without plantable support below', () => {
    return expectPlaceResultAtDefaultPosition(makeChunk('AIR'), 'BROWN_MUSHROOM', 'left')
  })

  it.effect('placeBlock allows sapling placement on a dirt support block', () => {
    return expectPlaceResultAtDefaultPosition(makeChunkWithBlocks([{ idx: 63, type: 'DIRT' }]), 'SAPLING', 'right')
  })

  it.effect('placeBlock allows flower placement on a dirt support block', () => {
    return expectPlaceResultAtDefaultPosition(makeChunkWithBlocks([{ idx: 63, type: 'DIRT' }]), 'POPPY', 'right')
  })

  it.effect('placeBlock allows fern placement on a dirt support block', () => {
    return expectPlaceResultAtDefaultPosition(makeChunkWithBlocks([{ idx: 63, type: 'DIRT' }]), 'FERN', 'right')
  })

  it.effect('placeBlock rejects mushroom placement in bright light', () => {
    const chunk = makeChunkWithBlocks([{ idx: TEST_PLANT_SUPPORT_IDX, type: 'DIRT' }])
    chunk.skyLight = makeLightBufferAt(TEST_PLANT_POSITION, 13)
    chunk.blockLight = createLightBuffer()
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'BROWN_MUSHROOM'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows mushroom placement on dirt in low light', () => {
    const chunk = makeChunkWithBlocks([{ idx: TEST_PLANT_SUPPORT_IDX, type: 'DIRT' }])
    chunk.skyLight = makeLightBufferAt(TEST_PLANT_POSITION, 12)
    chunk.blockLight = createLightBuffer()
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'RED_MUSHROOM'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('RED_MUSHROOM')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows sugar cane on sand support with adjacent water', () => {
    const chunk = makeChunkWithBlocks([
      { idx: TEST_PLANT_SUPPORT_IDX, type: 'SAND' },
      { idx: TEST_PLANT_EAST_SUPPORT_IDX, type: 'WATER' },
    ])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'SUGAR_CANE'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('SUGAR_CANE')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows stacked sugar cane support', () => {
    const chunk = makeChunkWithBlocks([{ idx: TEST_PLANT_SUPPORT_IDX, type: 'SUGAR_CANE' }])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'SUGAR_CANE'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('SUGAR_CANE')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects sugar cane on sand support without adjacent water', () => {
    const chunk = makeChunkWithBlocks([{ idx: TEST_PLANT_SUPPORT_IDX, type: 'SAND' }])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'SUGAR_CANE'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('AIR')
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
    const chunk = makeChunkWithBlocks([{ idx: TEST_PLANT_SUPPORT_IDX, type: 'SAND' }])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'CACTUS'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('CACTUS')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows stacked cactus support', () => {
    const chunk = makeChunkWithBlocks([{ idx: TEST_PLANT_SUPPORT_IDX, type: 'CACTUS' }])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'CACTUS'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('CACTUS')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects cactus when a horizontal side is occupied', () => {
    const chunk = makeChunkWithBlocks([
      { idx: TEST_PLANT_SUPPORT_IDX, type: 'SAND' },
      { idx: TEST_PLANT_EAST_SIDE_IDX, type: 'DIRT' },
    ])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'CACTUS'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects cactus placement on dirt support', () => {
    const chunk = makeChunkWithBlocks([{ idx: TEST_PLANT_SUPPORT_IDX, type: 'DIRT' }])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(TEST_PLANT_POSITION, 'CACTUS'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, TEST_PLANT_IDX)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock allows lily pad on water support', () => {
    const chunk = makeChunkWithBlocks([{ idx: 63, type: 'WATER' }])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'LILY_PAD'))

      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('LILY_PAD')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock rejects lily pad placement without water support', () => {
    const chunk = makeChunkWithBlocks([{ idx: 63, type: 'DIRT' }])
    const layer = buildLayer({ chunk })
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'LILY_PAD'))

      expect(Either.isLeft(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock removes sugar cane when sand support is broken', () => {
    const chunk = makeChunkWithBlocks([
      { idx: BLOCK_IDX_64, type: 'SAND' },
      { idx: BLOCK_IDX_65, type: 'SUGAR_CANE' },
    ])
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
    const chunk = makeChunkWithBlocks([
      { idx: BLOCK_IDX_64, type: 'SAND' },
      { idx: BLOCK_IDX_65, type: 'CACTUS' },
    ])
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
    const chunk = makeChunkWithBlocks([
      { idx: BLOCK_IDX_64, type: 'WATER' },
      { idx: BLOCK_IDX_65, type: 'LILY_PAD' },
    ])
    const layer = buildLayer({ chunk })
    return forceSetBlockEither(layer, DEFAULT_BLOCK_POSITION, 'AIR').pipe(
      Effect.tap((result) => Effect.sync(() => {
        expect(Either.isRight(result)).toBe(true)
        expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
        expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
      })),
    )
  })

  it.effect('forceSetBlock clears unsupported torch after removing its support', () => {
    const chunk = makeChunkWithBlocks([
      { idx: BLOCK_IDX_64, type: 'DIRT' },
      { idx: BLOCK_IDX_65, type: 'TORCH' },
    ])
    const layer = buildLayer({ chunk })
    return forceSetBlockEither(layer, DEFAULT_BLOCK_POSITION, 'AIR').pipe(
      Effect.tap((result) => Effect.sync(() => {
      expect(Either.isRight(result)).toBe(true)
      expect(blockAt(chunk, BLOCK_IDX_64)).toBe('AIR')
      expect(blockAt(chunk, BLOCK_IDX_65)).toBe('AIR')
      })),
    )
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
    const layer = createTestLayer(
      createFailingChunkManagerService(),
      createMockPlayerService({ x: 100, y: 100, z: 100 }),
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
    return breakBlockEither(layer).pipe(
      Effect.tap((result) => Effect.sync(() => {
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.operation).toBe('breakBlock')
      expect(err.reason).toContain('Cannot break chest while its contents cannot fit in inventory')
      })),
    )
  })

  it.effect('breakBlock removes a chest after its contents are returned to inventory', () => {
    const layer = buildLayer({ blockAtIdx: 'CHEST', chestDismantleResult: true })
    return breakBlockEither(layer).pipe(Effect.tap((result) => Effect.sync(() => {
      expect(Either.isRight(result)).toBe(true)
    })))
  })

  it.effect('breakBlock refuses to remove a furnace when its contents cannot fit in inventory', () => {
    const layer = buildLayer({ blockAtIdx: 'FURNACE', dismantleResult: false })
    return breakBlockEither(layer).pipe(Effect.tap((result) => Effect.sync(() => {
      expect(Either.isLeft(result)).toBe(true)
    })))
  })
})
