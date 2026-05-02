import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { vi } from 'vitest'
import { Array as Arr, Effect, Either, Layer, Metric, MutableHashMap, MutableRef, Option } from 'effect'
import { ChunkManagerService, ChunkManagerError } from '@ts-minecraft/chunk-manager'
import { ChunkServiceLive, Chunk, ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, indexToBlockType } from '@ts-minecraft/domain'
import { PlayerService } from '@ts-minecraft/player-controller'
import { BlockType } from '@ts-minecraft/domain'
import { ChunkCacheKey, Position, PlayerId, SlotIndex } from '@ts-minecraft/kernel'
import { PlayerError, StorageError } from '@ts-minecraft/domain'
import {
  BlockService,
  BlockServiceLive,
  BlockServiceError,
  worldToBlockLocal,
  blockOverlapsPlayer,
  PLAYER_HALF_WIDTH,
  PLAYER_HALF_HEIGHT,
} from '@ts-minecraft/block-service'
import { InventoryService } from '@ts-minecraft/inventory-system'
import { HotbarService } from '@ts-minecraft/hotbar-system'
import { FurnaceService } from '@ts-minecraft/furnace-system'
import { DEFAULT_WORLD_ID, DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import { FluidService } from '@ts-minecraft/fluid-simulation'

// ─── Chunk test utilities ─────────────────────────────────────────────────────

const makeEmptyChunk = (coord: ChunkCoord): Chunk => ({
  coord,
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

const blockIdx = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const readBlock = (chunk: Chunk, lx: number, y: number, lz: number): BlockType =>
  indexToBlockType(Option.getOrElse(Option.fromNullable(chunk.blocks[blockIdx(lx, y, lz)]), () => 0))

const writeBlock = (chunk: Chunk, lx: number, y: number, lz: number, blockType: BlockType): void => {
  chunk.blocks[blockIdx(lx, y, lz)] = blockTypeToIndex(blockType)
}

const worldToLocal = (pos: Position): { coord: ChunkCoord; lx: number; lz: number; y: number } => {
  const { chunkCoord, lx, lz } = worldToBlockLocal(pos)
  return { coord: chunkCoord, lx, lz, y: Math.floor(pos.y) }
}

// ─── Mock factories ───────────────────────────────────────────────────────────

interface MockChunkManagerHandle {
  service: ChunkManagerService
  getChunkForPos: (pos: Position) => Chunk
}

const createMockChunkManagerService = (
  initialBlocks?: Array<{ pos: Position; blockType: BlockType }>
): MockChunkManagerHandle => {
  const chunkMap = MutableHashMap.empty<ChunkCacheKey, Chunk>()

  const ensureChunk = (coord: ChunkCoord): Chunk => {
    const key = ChunkCacheKey.make(coord)
    return Option.getOrElse(MutableHashMap.get(chunkMap, key), () => {
      const chunk = makeEmptyChunk(coord)
      MutableHashMap.set(chunkMap, key, chunk)
      return chunk
    })
  }

  if (initialBlocks) {
    Arr.forEach(initialBlocks, ({ pos, blockType }) => {
      const { coord, lx, lz, y } = worldToLocal(pos)
      writeBlock(ensureChunk(coord), lx, y, lz, blockType)
    })
  }

  const service = {
    getChunk: (coord: ChunkCoord) => Effect.sync(() => ensureChunk(coord)),
    loadChunksAroundPlayer: (_playerPos: Position) => Effect.void,
    getLoadedChunks: () => Effect.succeed(Arr.fromIterable(MutableHashMap.values(chunkMap))),
    markChunkDirty: (_coord: ChunkCoord) => Effect.void,
    saveDirtyChunks: () => Effect.void as Effect.Effect<void, StorageError>,
    unloadChunk: (_coord: ChunkCoord) => Effect.void as Effect.Effect<void, StorageError>,
  } as unknown as ChunkManagerService

  return {
    service,
    getChunkForPos: (pos) => ensureChunk(worldToLocal(pos).coord),
  }
}

const createFailingChunkManagerService = (): ChunkManagerService => ({
  getChunk: (_coord: ChunkCoord) =>
    Effect.fail({ _tag: 'ChunkError' as const, message: 'Chunk load error', chunkCoord: { x: 0, z: 0 }, reason: 'Chunk load error' } as unknown as ChunkManagerError),
  loadChunksAroundPlayer: () => Effect.void,
  getLoadedChunks: () => Effect.succeed([]),
  markChunkDirty: () => Effect.void,
  saveDirtyChunks: () => Effect.void as Effect.Effect<void, StorageError>,
  unloadChunk: () => Effect.void as Effect.Effect<void, StorageError>,
} as unknown as ChunkManagerService)

const createMockPlayerService = (position: Position): PlayerService => ({
  create: () => Effect.void,
  updatePosition: () => Effect.void,
  getPosition: (_id: PlayerId) => Effect.succeed(position),
  getVelocity: () => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getState: () => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
} as unknown as PlayerService)

const createFailingPlayerService = (): PlayerService => ({
  create: () => Effect.void,
  updatePosition: () => Effect.void,
  getPosition: () => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'Player not found' })),
  getVelocity: () => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getState: () => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
} as unknown as PlayerService)

const createMockInventoryService = (options?: {
  readonly removeBlock?: (blockType: BlockType, count: number, slot?: SlotIndex) => Effect.Effect<boolean, never>
  readonly addBlock?: (blockType: BlockType, count: number) => Effect.Effect<boolean, never>
}): InventoryService => ({
  addBlock: (blockType: BlockType, count: number) =>
    options?.addBlock ? options.addBlock(blockType, count) : Effect.succeed(false),
  removeBlock: (blockType: BlockType, count: number, slot?: SlotIndex) =>
    options?.removeBlock ? options.removeBlock(blockType, count, slot) : Effect.succeed(true),
  getSlot: () => Effect.void,
  setSlot: () => Effect.void,
  moveStack: () => Effect.void,
  getHotbarSlots: () => Effect.succeed([]),
} as unknown as InventoryService)

const createMockHotbarService = (selectedBlockType: Option.Option<BlockType> = Option.none()): HotbarService => ({
  getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
  setSelectedSlot: () => Effect.void,
  getSelectedBlockType: () => Effect.succeed(selectedBlockType),
  getSlots: () => Effect.succeed([]),
  update: () => Effect.void,
} as unknown as HotbarService)

const createMockFurnaceService = (): FurnaceService => ({
  getState: () => Effect.succeed({ furnaces: new Map(), selectedFurnacePosition: Option.none() }),
  getNearestFurnaceState: () => Effect.succeed(Option.none()),
  hasNearbyFurnace: () => Effect.succeed(false),
  setSelectedFurnace: () => Effect.void,
  startSmelting: () => Effect.void,
  collectOutput: () => Effect.succeed(true),
  clearFurnace: () => Effect.succeed([]),
  dismantleFurnace: () => Effect.succeed(true),
  serialize: () => Effect.succeed([]),
  deserialize: () => Effect.void,
  tick: () => Effect.void,
} as unknown as FurnaceService)

const createFluidRecorder = () => {
  const calls = { notify: [] as Position[], seed: [] as Position[], remove: [] as Position[] }
  const service = {
    notifyBlockChanged: (pos: Position) => Effect.sync(() => { calls.notify.push(pos) }),
    seedWater: (pos: Position) => Effect.sync(() => { calls.seed.push(pos) }),
    removeWater: (pos: Position) => Effect.sync(() => { calls.remove.push(pos) }),
    syncLoadedChunks: () => Effect.void,
    tick: () => Effect.void,
  } satisfies Pick<FluidService, 'notifyBlockChanged' | 'seedWater' | 'removeWater' | 'syncLoadedChunks' | 'tick'>
  return { service, calls }
}

const createTestLayer = (
  chunkManagerService: ChunkManagerService,
  playerService: PlayerService,
  fluidService: Pick<FluidService, 'notifyBlockChanged' | 'seedWater' | 'removeWater' | 'syncLoadedChunks' | 'tick'> = {
    notifyBlockChanged: () => Effect.void,
    seedWater: () => Effect.void,
    removeWater: () => Effect.void,
    syncLoadedChunks: () => Effect.void,
    tick: () => Effect.void,
  },
  inventoryService: InventoryService = createMockInventoryService(),
  hotbarService: HotbarService = createMockHotbarService(),
  furnaceService: FurnaceService = createMockFurnaceService(),
) =>
  BlockServiceLive.pipe(
    Layer.provide(Layer.mergeAll(
      Layer.succeed(ChunkManagerService, chunkManagerService),
      Layer.succeed(PlayerService, playerService),
      Layer.succeed(InventoryService, inventoryService),
      Layer.succeed(HotbarService, hotbarService),
      Layer.succeed(FurnaceService, furnaceService),
      Layer.succeed(FluidService, fluidService as unknown as FluidService),
      ChunkServiceLive,
    ))
  )

// ─── Test assertion helpers ───────────────────────────────────────────────────

const assertLeft = <E>(result: Either.Either<unknown, E>): E => {
  expect(Either.isLeft(result)).toBe(true)
  return Option.getOrThrow(Either.getLeft(result))
}

// ─── Pure function tests ──────────────────────────────────────────────────────

describe('worldToBlockLocal', () => {
  it('positive coordinates map to correct chunk and local offsets', () => {
    const { chunkCoord, lx, lz } = worldToBlockLocal({ x: 17, y: 0, z: 5 })
    expect(chunkCoord).toEqual({ x: 1, z: 0 })
    expect(lx).toBe(1)   // 17 % 16 = 1
    expect(lz).toBe(5)   // 5 % 16 = 5
  })

  it('position at chunk boundary maps to lx=0', () => {
    const { chunkCoord, lx } = worldToBlockLocal({ x: 16, y: 0, z: 0 })
    expect(chunkCoord.x).toBe(1)
    expect(lx).toBe(0)
  })

  it('negative coordinates use double-modulo (no negative local offsets)', () => {
    const { chunkCoord, lx, lz } = worldToBlockLocal({ x: -1, y: 0, z: -1 })
    expect(chunkCoord).toEqual({ x: -1, z: -1 })
    expect(lx).toBe(15)  // (-1 % 16 + 16) % 16 = 15
    expect(lz).toBe(15)
  })

  it('world (0,0) maps to chunk (0,0) with lx=0 lz=0', () => {
    const { chunkCoord, lx, lz } = worldToBlockLocal({ x: 0, y: 0, z: 0 })
    expect(chunkCoord).toEqual({ x: 0, z: 0 })
    expect(lx).toBe(0)
    expect(lz).toBe(0)
  })
})

describe('blockOverlapsPlayer — AABB collision (pure)', () => {
  // Player AABB: half-width=0.3, half-height=0.9
  // Block AABB: unit cube, center = blockPos + 0.5

  it('overlaps when block center is within player AABB', () => {
    // Player feet at (0,0,0), player center = (0, 0.9, 0)
    // Block at (0,0,0): center = (0.5, 0.5, 0.5)
    expect(blockOverlapsPlayer({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(true)
  })

  it('does not overlap when block is far away on X axis', () => {
    // overlapX: |2.5 - 0| = 2.5 < 0.8 → false
    expect(blockOverlapsPlayer({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false)
  })

  it('does not overlap when block is 2 blocks above player (Y axis)', () => {
    // Player center Y = 0.9; block center Y = 3.5; |3.5 - 0.9| = 2.6 > 1.4 → false
    expect(blockOverlapsPlayer({ x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false)
  })

  it('overlaps when all three axes overlap', () => {
    // Player at (5,0,5); block at (5,0,5): center=(5.5,0.5,5.5), playerCenter=(5,0.9,5)
    // X: |5.5-5|=0.5 < 0.8 ✓  Y: |0.5-0.9|=0.4 < 1.4 ✓  Z: |5.5-5|=0.5 < 0.8 ✓
    expect(blockOverlapsPlayer({ x: 5, y: 0, z: 5 }, { x: 5, y: 0, z: 5 })).toBe(true)
  })

  it('exported constants match physics-service expectations', () => {
    expect(PLAYER_HALF_WIDTH).toBe(0.3)
    expect(PLAYER_HALF_HEIGHT).toBe(0.9)
  })

  const axisTable: ReadonlyArray<readonly [string, Position, Position, boolean]> = [
    ['overlap on all 3 axes',                 { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true],
    ['separated on X',                        { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, false],
    ['separated on Z',                        { x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: 0 }, false],
    ['separated on Y (block above player)',   { x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 0 }, false],
    // blockCenterX=0.5, threshold=0.8 → player must be at x≥1.31 to NOT overlap
    ['X just beyond threshold (player at 1.31)', { x: 0, y: 0, z: 0 }, { x: 1.31, y: 0, z: 0 }, false],
  ] as const

  Arr.forEach(axisTable, ([desc, blockPos, playerPos, expected]) => {
    it(desc, () => {
      expect(blockOverlapsPlayer(blockPos, playerPos)).toBe(expected)
    })
  })
})

// ─── BlockServiceError ────────────────────────────────────────────────────────

describe('BlockServiceError', () => {
  it('includes operation and reason in message', () => {
    const err = new BlockServiceError({ operation: 'breakBlock', reason: 'Test error' })
    expect(err._tag).toBe('BlockServiceError')
    expect(err.message).toContain('breakBlock')
    expect(err.message).toContain('Test error')
  })

  it('appends cause message when present', () => {
    const cause = new Error('root cause')
    const err = new BlockServiceError({ operation: 'placeBlock', reason: 'failed', cause })
    expect(err.message).toContain('root cause')
  })

  it('is catchable with Effect.catchTag', () => {
    expect(new BlockServiceError({ operation: 'test', reason: 'msg' })._tag).toBe('BlockServiceError')
  })
})

// ─── BlockService integration tests ──────────────────────────────────────────

describe('BlockServiceLive — interface', () => {
  it.effect('exposes breakBlock and placeBlock', () => {
    const { service } = createMockChunkManagerService()
    const layer = createTestLayer(service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      expect(typeof svc.breakBlock).toBe('function')
      expect(typeof svc.placeBlock).toBe('function')
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService.breakBlock', () => {
  it.effect('sets the block to AIR in chunk storage', () => {
    const pos: Position = { x: 1, y: 2, z: 3 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(readBlock(chunk, lx, y, lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('does not affect adjacent blocks', () => {
    const pos0: Position = { x: 0, y: 0, z: 0 }
    const pos1: Position = { x: 1, y: 0, z: 0 }
    const handle = createMockChunkManagerService([
      { pos: pos0, blockType: 'STONE' },
      { pos: pos1, blockType: 'DIRT' },
    ])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), undefined, undefined, createMockHotbarService(Option.some('WOODEN_PICKAXE')))
    const { lx: lx1, lz: lz1, y: y1 } = worldToLocal(pos1)
    const chunk1 = handle.getChunkForPos(pos1)
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos0))
      expect(readBlock(chunk1, lx1, y1, lz1)).toBe('DIRT')
    }).pipe(Effect.provide(layer))
  })

  it.effect('calls removeWater and notifyBlockChanged when breaking water', () => {
    const pos: Position = { x: 1, y: 2, z: 3 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'WATER' }])
    const fluid = createFluidRecorder()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), fluid.service)
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(fluid.calls.remove).toEqual([pos])
      expect(fluid.calls.notify).toEqual([pos])
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with "No block at position" when breaking AIR', () => {
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 5, y: 5, z: 5 })))
      const err = assertLeft(result)
      expect(err).toBeInstanceOf(BlockServiceError)
      expect(err.message).toContain('No block at position')
      expect(err.message).toContain('5')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with "No block at position" including coordinates', () => {
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 3, y: 7, z: 9 })))
      const err = assertLeft(result)
      expect(err.message).toContain('3')
      expect(err.message).toContain('7')
      expect(err.message).toContain('9')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when chunk manager fails', () => {
    const layer = createTestLayer(createFailingChunkManagerService(), createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 0, y: 0, z: 0 })))
      const err = assertLeft(result) as BlockServiceError
      expect(err).toBeInstanceOf(BlockServiceError)
      expect(err.operation).toBe('breakBlock')
    }).pipe(Effect.provide(layer))
  })

  it.effect('handles negative coordinates', () => {
    const pos: Position = { x: -3, y: 5, z: -7 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'STONE' }])
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), undefined, undefined, createMockHotbarService(Option.some('WOODEN_PICKAXE')))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(readBlock(chunk, lx, y, lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('handles y=255 (max height)', () => {
    const pos: Position = { x: 0, y: 255, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GLASS' }])
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      expect(readBlock(chunk, lx, y, lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with BlockServiceError at y=256 (out of bounds)', () => {
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 0, y: 256, z: 0 })))
      expect(assertLeft(result)).toBeInstanceOf(BlockServiceError)
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails with BlockServiceError at y=-1 (out of bounds)', () => {
    const handle = createMockChunkManagerService()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 0, y: -1, z: 0 })))
      expect(assertLeft(result)).toBeInstanceOf(BlockServiceError)
    }).pipe(Effect.provide(layer))
  })

  it.effect('second break on the same position fails (block is now AIR)', () => {
    const pos: Position = { x: 5, y: 5, z: 5 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos)))
      expect(assertLeft(result).message).toContain('No block at position')
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService.placeBlock', () => {
  it.effect('writes the block type into chunk storage', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService()
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT'))
      expect(readBlock(chunk, lx, y, lz)).toBe('DIRT')
    }).pipe(Effect.provide(layer))
  })

  it.effect('calls seedWater and notifyBlockChanged when placing water', () => {
    const pos: Position = { x: 2, y: 3, z: 4 }
    const handle = createMockChunkManagerService()
    const fluid = createFluidRecorder()
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), fluid.service)
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'WATER'))
      expect(fluid.calls.seed).toEqual([pos])
      expect(fluid.calls.notify).toEqual([pos])
    }).pipe(Effect.provide(layer))
  })

  it.effect('calls removeBlock with blockType and count=1', () => {
    const pos: Position = { x: 6, y: 3, z: 4 }
    const spy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      createMockChunkManagerService().service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ removeBlock: spy }),
    )
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE'))
      expect(spy).toHaveBeenCalledOnce()
      expect(spy).toHaveBeenCalledWith('STONE', 1, undefined)
    }).pipe(Effect.provide(layer))
  })

  it.effect('passes preferred slot to removeBlock', () => {
    const pos: Position = { x: 8, y: 3, z: 4 }
    const spy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      createMockChunkManagerService().service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ removeBlock: spy }),
    )
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE', SlotIndex.make(31)))
      expect(spy).toHaveBeenCalledWith('STONE', 1, 31)
    }).pipe(Effect.provide(layer))
  })

  it.effect('rolls back and fails when inventory has no matching block', () => {
    const pos: Position = { x: 7, y: 3, z: 4 }
    const handle = createMockChunkManagerService()
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ removeBlock: () => Effect.succeed(false) }),
    )
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE')))
      expect(assertLeft(result).message).toContain('available in inventory')
      expect(readBlock(chunk, lx, y, lz)).toBe('AIR')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when position already has a block', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GRASS' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT')))
      const err = assertLeft(result) as BlockServiceError
      expect(err.operation).toBe('placeBlock')
      expect(err.message).toContain('Block already exists at position')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when position overlaps player AABB', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const layer = createTestLayer(
      createMockChunkManagerService().service,
      createMockPlayerService({ x: 0, y: 0, z: 0 }),
    )
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT')))
      const err = assertLeft(result) as BlockServiceError
      expect(err.operation).toBe('placeBlock')
      expect(err.message).toContain('Cannot place block inside player')
    }).pipe(Effect.provide(layer))
  })

  it.effect('succeeds when block is outside player AABB (2 blocks away on X)', () => {
    const pos: Position = { x: 2, y: 0, z: 0 }
    const handle = createMockChunkManagerService()
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 0, y: 0, z: 0 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'SAND'))
      expect(readBlock(chunk, lx, y, lz)).toBe('SAND')
    }).pipe(Effect.provide(layer))
  })

  it.effect('succeeds when block is 3+ blocks above player (Y separation)', () => {
    const pos: Position = { x: 0, y: 3, z: 0 }
    const layer = createTestLayer(
      createMockChunkManagerService().service,
      createMockPlayerService({ x: 0, y: 0, z: 0 }),
    )
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT'))
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when chunk manager fails', () => {
    const layer = createTestLayer(createFailingChunkManagerService(), createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock({ x: 0, y: 0, z: 0 }, 'DIRT')))
      const err = assertLeft(result) as BlockServiceError
      expect(err.operation).toBe('placeBlock')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails when player service fails', () => {
    const layer = createTestLayer(createMockChunkManagerService().service, createFailingPlayerService())
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock({ x: 0, y: 0, z: 0 }, 'DIRT')))
      const err = assertLeft(result) as BlockServiceError
      expect(err.operation).toBe('placeBlock')
      expect(err.message).toContain('Player position error')
    }).pipe(Effect.provide(layer))
  })

  it.effect('fails at y=-1 (out of bounds)', () => {
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.placeBlock({ x: 0, y: -1, z: 0 }, 'STONE')))
      expect(assertLeft(result)).toBeInstanceOf(BlockServiceError)
    }).pipe(Effect.provide(layer))
  })

  it.effect('places all common block types', () => {
    const blockTypes: ReadonlyArray<BlockType> = ['DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'LEAVES', 'GLASS']
    return Effect.forEach(blockTypes, (blockType, i) => {
      const pos: Position = { x: i * 2, y: 0, z: 0 }
      const handle = createMockChunkManagerService()
      const { lx, lz, y } = worldToLocal(pos)
      const chunk = handle.getChunkForPos(pos)
      const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
      return Effect.gen(function* () {
        yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, blockType))
        expect(readBlock(chunk, lx, y, lz)).toBe(blockType)
      }).pipe(Effect.provide(layer))
    }, { concurrency: 1, discard: true })
  })
})

describe('BlockService — break then place (chaining)', () => {
  it.effect('break DIRT then place STONE at the same position', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      yield* svc.placeBlock(pos, 'STONE')
      expect(readBlock(chunk, lx, y, lz)).toBe('STONE')
    }).pipe(Effect.provide(layer))
  })

  it.effect('Effect.flatMap chaining works', () => {
    const pos: Position = { x: 1, y: 1, z: 1 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'WOOD' }])
    const { lx, lz, y } = worldToLocal(pos)
    const chunk = handle.getChunkForPos(pos)
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const outcome = yield* svc.breakBlock(pos).pipe(
        Effect.flatMap(() => svc.placeBlock(pos, 'GLASS')),
        Effect.map(() => ({ placed: true })),
      )
      expect(outcome.placed).toBe(true)
      expect(readBlock(chunk, lx, y, lz)).toBe('GLASS')
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService — item-like drops and non-placeable inventory items', () => {
  it.effect('breaking COAL_ORE with a wooden pickaxe drops COAL into inventory instead of the ore block', () => {
    const pos: Position = { x: 3, y: 3, z: 3 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'COAL_ORE' }])
    const inventorySpy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('WOODEN_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('COAL', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('cannot place WOODEN_SWORD into the world', () => {
    const pos: Position = { x: 9, y: 2, z: 9 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(pos, 'WOODEN_SWORD'))
      expect(result._tag).toBe('Left')
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking STONE by hand fails instead of yielding free progression', () => {
    const pos: Position = { x: 4, y: 4, z: 4 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'STONE' }])
    const inventorySpy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.none()),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock(pos))
      expect(result._tag).toBe('Left')
      expect(inventorySpy).not.toHaveBeenCalled()
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking STONE with a selected pickaxe drops COBBLESTONE into inventory', () => {
    const pos: Position = { x: 5, y: 5, z: 5 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'STONE' }])
    const inventorySpy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('WOODEN_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('COBBLESTONE', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking COAL_ORE by hand fails instead of yielding free progression', () => {
    const pos: Position = { x: 6, y: 6, z: 6 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'COAL_ORE' }])
    const inventorySpy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.none()),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock(pos))
      expect(result._tag).toBe('Left')
      expect(inventorySpy).not.toHaveBeenCalled()
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking COAL_ORE with a wooden pickaxe drops COAL into inventory', () => {
    const pos: Position = { x: 7, y: 7, z: 7 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'COAL_ORE' }])
    const inventorySpy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('WOODEN_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('COAL', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking DIAMOND_ORE with a wooden pickaxe fails instead of yielding free progression', () => {
    const pos: Position = { x: 8, y: 8, z: 8 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIAMOND_ORE' }])
    const inventorySpy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('WOODEN_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock(pos))
      expect(result._tag).toBe('Left')
      expect(inventorySpy).not.toHaveBeenCalled()
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking DIAMOND_ORE with an iron pickaxe drops DIAMOND into inventory', () => {
    const pos: Position = { x: 9, y: 9, z: 9 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'DIAMOND_ORE' }])
    const inventorySpy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('IRON_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('DIAMOND', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking GOLD_ORE with an iron pickaxe drops RAW_GOLD into inventory', () => {
    const pos: Position = { x: 10, y: 10, z: 10 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GOLD_ORE' }])
    const inventorySpy = vi.fn(() => Effect.succeed(true))
    const layer = createTestLayer(
      handle.service,
      createMockPlayerService({ x: 100, y: 0, z: 100 }),
      undefined,
      createMockInventoryService({ addBlock: inventorySpy }),
      createMockHotbarService(Option.some('IRON_PICKAXE')),
    )

    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock(pos)
      expect(inventorySpy).toHaveBeenCalledWith('RAW_GOLD', 1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('cannot place WOODEN_PICKAXE into the world', () => {
    const pos: Position = { x: 10, y: 2, z: 10 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.placeBlock(pos, 'WOODEN_PICKAXE'))
      expect(result._tag).toBe('Left')
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService — Effect.Metric counters', () => {
  it.effect('breakBlock increments blocks_broken by 1', () => {
    const pos: Position = { x: 10, y: 10, z: 10 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'STONE' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }), undefined, undefined, createMockHotbarService(Option.some('WOODEN_PICKAXE')))
    return Effect.gen(function* () {
      const counter = Metric.counter('blocks_broken')
      const before = yield* Metric.value(counter)
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      const after = yield* Metric.value(counter)
      expect(after.count - before.count).toBe(1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breaking N blocks increments blocks_broken by N', () => {
    const positions: ReadonlyArray<Position> = [
      { x: 20, y: 10, z: 20 }, { x: 21, y: 10, z: 20 }, { x: 22, y: 10, z: 20 },
    ]
    const handle = createMockChunkManagerService(Arr.map(positions, (pos) => ({ pos, blockType: 'DIRT' as const })))
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const counter = Metric.counter('blocks_broken')
      const before = yield* Metric.value(counter)
      yield* Effect.flatMap(BlockService, (svc) =>
        Effect.forEach(positions, (pos) => svc.breakBlock(pos), { concurrency: 1 })
      )
      const after = yield* Metric.value(counter)
      expect(after.count - before.count).toBe(3)
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock increments blocks_placed by 1', () => {
    const pos: Position = { x: 30, y: 10, z: 30 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const counter = Metric.counter('blocks_placed')
      const before = yield* Metric.value(counter)
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'DIRT'))
      const after = yield* Metric.value(counter)
      expect(after.count - before.count).toBe(1)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock does NOT increment blocks_placed', () => {
    const pos: Position = { x: 40, y: 10, z: 40 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'GRASS' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const counter = Metric.counter('blocks_placed')
      const before = yield* Metric.value(counter)
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      const after = yield* Metric.value(counter)
      expect(after.count - before.count).toBe(0)
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock does NOT increment blocks_broken', () => {
    const pos: Position = { x: 50, y: 10, z: 50 }
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const counter = Metric.counter('blocks_broken')
      const before = yield* Metric.value(counter)
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE'))
      const after = yield* Metric.value(counter)
      expect(after.count - before.count).toBe(0)
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService — catchTag', () => {
  it.effect('breakBlock error is catchable with Effect.catchTag', () => {
    const layer = createTestLayer(createMockChunkManagerService().service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.flatMap(BlockService, (svc) =>
        svc.breakBlock({ x: 0, y: 0, z: 0 }).pipe(
          Effect.catchTag('BlockServiceError', (e) => Effect.succeed(`caught: ${e.operation}`))
        )
      )
      expect(result).toBe('caught: breakBlock')
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock error is catchable with Effect.catchTag', () => {
    const pos: Position = { x: 0, y: 0, z: 0 }
    const handle = createMockChunkManagerService([{ pos, blockType: 'STONE' }])
    const layer = createTestLayer(handle.service, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      const result = yield* Effect.flatMap(BlockService, (svc) =>
        svc.placeBlock(pos, 'DIRT').pipe(
          Effect.catchTag('BlockServiceError', (e) => Effect.succeed(`caught: ${e.operation}`))
        )
      )
      expect(result).toBe('caught: placeBlock')
    }).pipe(Effect.provide(layer))
  })
})

describe('BlockService — markChunkDirty integration', () => {
  it.effect('breakBlock calls markChunkDirty with the correct ChunkCoord', () => {
    const dirtyCapturedRef = MutableRef.make<Option.Option<ChunkCoord>>(Option.none())
    const pos: Position = { x: 5, y: 10, z: 21 }
    const { service: base } = createMockChunkManagerService([{ pos, blockType: 'DIRT' }])
    const capturingService = {
      ...(base as unknown as Record<string, unknown>),
      markChunkDirty: (coord: ChunkCoord) =>
        Effect.sync(() => { MutableRef.set(dirtyCapturedRef, Option.some(coord)) }),
    } as unknown as ChunkManagerService
    const layer = createTestLayer(capturingService, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.breakBlock(pos))
      const captured = MutableRef.get(dirtyCapturedRef)
      expect(Option.isSome(captured)).toBe(true)
      const coord = Option.getOrThrow(captured)
      expect(coord.x).toBe(Math.floor(pos.x / CHUNK_SIZE))
      expect(coord.z).toBe(Math.floor(pos.z / CHUNK_SIZE))
    }).pipe(Effect.provide(layer))
  })

  it.effect('placeBlock calls markChunkDirty with the correct ChunkCoord', () => {
    const dirtyCapturedRef = MutableRef.make<Option.Option<ChunkCoord>>(Option.none())
    const pos: Position = { x: 33, y: 5, z: 0 }
    const { service: base } = createMockChunkManagerService()
    const capturingService = {
      ...(base as unknown as Record<string, unknown>),
      markChunkDirty: (coord: ChunkCoord) =>
        Effect.sync(() => { MutableRef.set(dirtyCapturedRef, Option.some(coord)) }),
    } as unknown as ChunkManagerService
    const layer = createTestLayer(capturingService, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.flatMap(BlockService, (svc) => svc.placeBlock(pos, 'STONE'))
      const captured = MutableRef.get(dirtyCapturedRef)
      expect(Option.isSome(captured)).toBe(true)
      const coord = Option.getOrThrow(captured)
      expect(coord.x).toBe(Math.floor(pos.x / CHUNK_SIZE))
      expect(coord.z).toBe(Math.floor(pos.z / CHUNK_SIZE))
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock does NOT call markChunkDirty when it fails', () => {
    const dirtyCalledRef = MutableRef.make(false)
    const { service: base } = createMockChunkManagerService()
    const capturingService = {
      ...(base as unknown as Record<string, unknown>),
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(dirtyCalledRef, true) }),
    } as unknown as ChunkManagerService
    const layer = createTestLayer(capturingService, createMockPlayerService({ x: 100, y: 0, z: 100 }))
    return Effect.gen(function* () {
      yield* Effect.either(Effect.flatMap(BlockService, (svc) => svc.breakBlock({ x: 0, y: 0, z: 0 })))
      expect(MutableRef.get(dirtyCalledRef)).toBe(false)
    }).pipe(Effect.provide(layer))
  })
})

describe('Constants', () => {
  it('DEFAULT_WORLD_ID is world-1', () => expect(DEFAULT_WORLD_ID).toBe('world-1'))
  it('DEFAULT_PLAYER_ID is player-1', () => expect(DEFAULT_PLAYER_ID).toBe('player-1'))
})
