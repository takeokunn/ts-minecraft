import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, Layer, Metric, MutableHashMap, Option } from 'effect'
import { ChunkManagerService, ChunkManagerError } from '@/application/chunk/chunk-manager-service'
import { ChunkServiceLive, Chunk, ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, indexToBlockType } from '@/domain/chunk'
import { PlayerService } from '@/application/player/player-state'
import { BlockType } from '@/domain/block'
import { ChunkCacheKey, Position, PlayerId } from '@/shared/kernel'
import { PlayerError, StorageError } from '@/domain/errors'
import {
  BlockService,
  BlockServiceLive,
  BlockServiceError,
} from './block-service'
import { InventoryService } from '@/application/inventory/inventory-service'
import { DEFAULT_WORLD_ID, DEFAULT_PLAYER_ID } from '@/application/constants'
import { FluidService } from '@/application/fluid/fluid-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an empty Chunk (all blocks = AIR) at the given coordinate.
 */
const makeEmptyChunk = (coord: ChunkCoord): Chunk => ({
  coord,
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

/**
 * Compute flat Uint8Array index matching the formula in chunk.ts.
 */
const blockIdx = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

/**
 * Convert a world position to chunk coordinate + local offsets (mirrors block-service.ts).
 */
const worldToLocal = (pos: Position): { coord: ChunkCoord; lx: number; lz: number; y: number } => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  const lx = ((Math.floor(pos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((Math.floor(pos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return { coord: { x: cx, z: cz }, lx, lz, y: Math.floor(pos.y) }
}

/**
 * Read a BlockType from a chunk's Uint8Array at local coordinates.
 */
const readBlock = (chunk: Chunk, lx: number, y: number, lz: number): BlockType =>
  indexToBlockType(Option.getOrElse(Option.fromNullable(chunk.blocks[blockIdx(lx, y, lz)]), () => 0))

/**
 * Write a BlockType into a chunk's Uint8Array at local coordinates.
 */
const writeBlock = (chunk: Chunk, lx: number, y: number, lz: number, blockType: BlockType): void => {
  chunk.blocks[blockIdx(lx, y, lz)] = blockTypeToIndex(blockType)
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/**
 * A mock ChunkManagerService backed by an explicit Map<string, Chunk>.
 * Chunks are auto-created (all AIR) on first access.
 * Since getChunk returns the same Chunk reference stored in the map,
 * in-place Uint8Array mutations performed by BlockService are immediately
 * visible through the map after the Effect runs.
 */
interface MockChunkManagerHandle {
  service: ChunkManagerService
  /** Retrieve the chunk for a world position (creates it if missing). */
  getChunkForPos: (pos: Position) => Chunk
}

const createMockChunkManagerService = (
  initialBlocks?: Array<{ pos: Position; blockType: BlockType }>
): MockChunkManagerHandle => {
  const chunkMap = MutableHashMap.empty<ChunkCacheKey, Chunk>()

  const ensureChunk = (coord: ChunkCoord): Chunk => {
    const key = ChunkCacheKey.make(coord)
    return Option.getOrElse(MutableHashMap.get(chunkMap, key), () => {
      const newChunk = makeEmptyChunk(coord)
      MutableHashMap.set(chunkMap, key, newChunk)
      return newChunk
    })
  }

  // Pre-populate blocks
  if (initialBlocks) {
    Arr.forEach(initialBlocks, ({ pos, blockType }) => {
      const { coord, lx, lz, y } = worldToLocal(pos)
      const chunk = ensureChunk(coord)
      writeBlock(chunk, lx, y, lz, blockType)
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
    getChunkForPos: (pos) => {
      const { coord } = worldToLocal(pos)
      return ensureChunk(coord)
    },
  }
}

/**
 * Create a mock ChunkManagerService that always fails getChunk.
 */
const createFailingChunkManagerService = (): ChunkManagerService => ({
  getChunk: (_coord: ChunkCoord) =>
    Effect.fail({
      _tag: 'ChunkError' as const,
      message: 'Chunk load error',
      chunkCoord: { x: 0, z: 0 },
      reason: 'Chunk load error',
    } as unknown as ChunkManagerError),
  loadChunksAroundPlayer: (_playerPos: Position) => Effect.void,
  getLoadedChunks: () => Effect.succeed([]),
  markChunkDirty: (_coord: ChunkCoord) => Effect.void,
  saveDirtyChunks: () => Effect.void as Effect.Effect<void, StorageError>,
  unloadChunk: (_coord: ChunkCoord) => Effect.void as Effect.Effect<void, StorageError>,
} as unknown as ChunkManagerService)

/**
 * Create a mock PlayerService at a given position.
 */
const createMockPlayerService = (position: Position): PlayerService => ({
  create: (_id: PlayerId, _position: Position) => Effect.void,
  updatePosition: (_id: PlayerId, _position: Position) => Effect.void,
  getPosition: (_id: PlayerId) => Effect.succeed(position),
  getVelocity: (_id: PlayerId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getState: (_id: PlayerId) =>
    Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
} as unknown as PlayerService)

/**
 * Create a mock PlayerService that fails getPosition.
 */
const createFailingPlayerService = (): PlayerService => ({
  create: (_id: PlayerId, _position: Position) => Effect.void,
  updatePosition: (_id: PlayerId, _position: Position) => Effect.void,
  getPosition: (_id: PlayerId) =>
    Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'Player not found' })),
  getVelocity: (_id: PlayerId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getState: (_id: PlayerId) =>
    Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
} as unknown as PlayerService)

/**
 * Build a test Layer from mock services.
 */
const mockInventoryService = {
  addBlock: (_blockType: unknown, _count: unknown) => Effect.succeed(false),
  getSlot: (_idx: unknown) => Effect.void,
  setSlot: (_idx: unknown, _slot: unknown) => Effect.void,
  moveStack: (_from: unknown, _to: unknown) => Effect.void,
  getHotbarSlots: () => Effect.succeed([]),
} as unknown as InventoryService

const createFluidRecorder = () => {
  const calls = {
    notify: [] as Position[],
    seed: [] as Position[],
    remove: [] as Position[],
  }

  const service = {
    notifyBlockChanged: (position: Position) => Effect.sync(() => {
      calls.notify.push(position)
    }),
    seedWater: (position: Position) => Effect.sync(() => {
      calls.seed.push(position)
    }),
    removeWater: (position: Position) => Effect.sync(() => {
      calls.remove.push(position)
    }),
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
  }
) => {
  const chunkManagerLayer = Layer.succeed(ChunkManagerService, chunkManagerService)
  const playerLayer = Layer.succeed(PlayerService, playerService)
  const inventoryLayer = Layer.succeed(InventoryService, mockInventoryService)
  const fluidLayer = Layer.succeed(FluidService, fluidService as unknown as FluidService)
  return BlockServiceLive.pipe(
    Layer.provide(Layer.mergeAll(chunkManagerLayer, playerLayer, ChunkServiceLive, inventoryLayer, fluidLayer))
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('application/block/block-service', () => {
  describe('Constants', () => {
    it('should export DEFAULT_WORLD_ID as world-1', () => {
      expect(DEFAULT_WORLD_ID).toBe('world-1')
    })

    it('should export DEFAULT_PLAYER_ID as player-1', () => {
      expect(DEFAULT_PLAYER_ID).toBe('player-1')
    })
  })

  describe('BlockServiceError', () => {
    it('should create BlockServiceError with operation and message', () => {
      const error = new BlockServiceError({ operation: 'breakBlock', reason: 'Test error' })
      expect(error._tag).toBe('BlockServiceError')
      expect(error.operation).toBe('breakBlock')
      expect(error.message).toContain('breakBlock')
      expect(error.message).toContain('Test error')
    })

    it('should create BlockServiceError with cause', () => {
      const cause = new Error('Underlying error')
      const error = new BlockServiceError({ operation: 'placeBlock', reason: 'Test error', cause })
      expect(error.cause).toBe(cause)
    })

    it('should have correct _tag', () => {
      const error = new BlockServiceError({ operation: 'test', reason: 'msg' })
      expect(error instanceof BlockServiceError).toBe(true)
      expect(error._tag).toBe('BlockServiceError')
    })
  })

  describe('BlockServiceLive', () => {
    it('should provide BlockService as Layer', () => {
      const { service } = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const layer = createTestLayer(service, playerService)

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it.effect('should have all required methods', () => {
      const { service } = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        expect(typeof blockService.breakBlock).toBe('function')
        expect(typeof blockService.placeBlock).toBe('function')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('breakBlock', () => {
    it.effect('should succeed when block exists at position', () => {
      const targetPos: Position = { x: 1, y: 2, z: 3 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'DIRT' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx, lz, y } = worldToLocal(targetPos)
      const chunkRef = handle.getChunkForPos(targetPos)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.breakBlock(targetPos)
        expect(readBlock(chunkRef, lx, y, lz)).toBe('AIR')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should notify fluid service when breaking water', () => {
      const targetPos: Position = { x: 1, y: 2, z: 3 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'WATER' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const fluid = createFluidRecorder()
      const testLayer = createTestLayer(handle.service, playerService, fluid.service)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.breakBlock(targetPos)
        expect(fluid.calls.remove).toEqual([targetPos])
        expect(fluid.calls.notify).toEqual([targetPos])
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should remove the block from chunk storage without affecting adjacent blocks', () => {
      const pos0: Position = { x: 0, y: 0, z: 0 }
      const pos1: Position = { x: 1, y: 0, z: 0 }
      const handle = createMockChunkManagerService([
        { pos: pos0, blockType: 'STONE' },
        { pos: pos1, blockType: 'DIRT' },
      ])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx: lx0, lz: lz0, y: y0 } = worldToLocal(pos0)
      const { lx: lx1, lz: lz1, y: y1 } = worldToLocal(pos1)
      const chunk0 = handle.getChunkForPos(pos0)
      const chunk1 = handle.getChunkForPos(pos1)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.breakBlock(pos0)
        expect(readBlock(chunk0, lx0, y0, lz0)).toBe('AIR')
        expect(readBlock(chunk1, lx1, y1, lz1)).toBe('DIRT')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fail with BlockServiceError when no block exists at position', () => {
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.breakBlock({ x: 5, y: 5, z: 5 }))

        expect(Either.isLeft(result)).toBe(true)
        const errBreak1 = Option.getOrThrow(Either.getLeft(result))
        expect(errBreak1).toBeInstanceOf(BlockServiceError)
        expect((errBreak1 as BlockServiceError).operation).toBe('breakBlock')
        expect(errBreak1.message).toContain('No block at position')
        expect(errBreak1.message).toContain('5')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fail with BlockServiceError when chunk manager fails', () => {
      const chunkManagerService = createFailingChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(chunkManagerService, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.breakBlock({ x: 0, y: 0, z: 0 }))

        expect(Either.isLeft(result)).toBe(true)
        const errBreak2 = Option.getOrThrow(Either.getLeft(result))
        expect(errBreak2).toBeInstanceOf(BlockServiceError)
        expect((errBreak2 as BlockServiceError).operation).toBe('breakBlock')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should include position coordinates in error message when block missing', () => {
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.breakBlock({ x: 3, y: 7, z: 9 }))

        expect(Either.isLeft(result)).toBe(true)
        const errBreak3 = Option.getOrThrow(Either.getLeft(result))
        expect(errBreak3.message).toContain('3')
        expect(errBreak3.message).toContain('7')
        expect(errBreak3.message).toContain('9')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('placeBlock', () => {
    it.effect('should succeed when position is empty and player is far away', () => {
      const targetPos: Position = { x: 0, y: 0, z: 0 }
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx, lz, y } = worldToLocal(targetPos)
      const chunkRef = handle.getChunkForPos(targetPos)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.placeBlock(targetPos, 'DIRT')
        expect(readBlock(chunkRef, lx, y, lz)).toBe('DIRT')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should seed fluid when placing water', () => {
      const targetPos: Position = { x: 2, y: 3, z: 4 }
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const fluid = createFluidRecorder()
      const testLayer = createTestLayer(handle.service, playerService, fluid.service)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.placeBlock(targetPos, 'WATER')
        expect(fluid.calls.seed).toEqual([targetPos])
        expect(fluid.calls.notify).toEqual([targetPos])
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should store the correct block type', () => {
      const targetPos: Position = { x: 2, y: 3, z: 4 }
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx, lz, y } = worldToLocal(targetPos)
      const chunkRef = handle.getChunkForPos(targetPos)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.placeBlock(targetPos, 'STONE')
        expect(readBlock(chunkRef, lx, y, lz)).toBe('STONE')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fail with BlockServiceError when block already exists at position', () => {
      const targetPos: Position = { x: 0, y: 0, z: 0 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'GRASS' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.placeBlock(targetPos, 'DIRT'))

        expect(Either.isLeft(result)).toBe(true)
        const errPlace1 = Option.getOrThrow(Either.getLeft(result))
        expect(errPlace1).toBeInstanceOf(BlockServiceError)
        expect((errPlace1 as BlockServiceError).operation).toBe('placeBlock')
        expect(errPlace1.message).toContain('Block already exists at position')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should include position coordinates in error message when block exists', () => {
      const targetPos: Position = { x: 4, y: 5, z: 6 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'WOOD' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.placeBlock(targetPos, 'STONE'))

        expect(Either.isLeft(result)).toBe(true)
        const errPlace2 = Option.getOrThrow(Either.getLeft(result))
        expect(errPlace2.message).toContain('4')
        expect(errPlace2.message).toContain('5')
        expect(errPlace2.message).toContain('6')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fail with BlockServiceError when position intersects player AABB', () => {
      const targetPos: Position = { x: 0, y: 0, z: 0 }
      const handle = createMockChunkManagerService()
      // Player standing at origin: feet at y=0, half-width=0.3, half-height=0.9
      // Player center at x=0, z=0. Block at (0,0,0) center=(0.5,0.5,0.5) overlaps clearly.
      const playerService = createMockPlayerService({ x: 0, y: 0, z: 0 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.placeBlock(targetPos, 'DIRT'))

        expect(Either.isLeft(result)).toBe(true)
        const errPlace3 = Option.getOrThrow(Either.getLeft(result))
        expect(errPlace3).toBeInstanceOf(BlockServiceError)
        expect((errPlace3 as BlockServiceError).operation).toBe('placeBlock')
        expect(errPlace3.message).toContain('Cannot place block inside player')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fail when block overlaps player on all axes', () => {
      // Player at (5, 0, 5). PLAYER_HALF_WIDTH=0.3, PLAYER_HALF_HEIGHT=0.9
      // Player AABB: x in [4.7, 5.3], y in [0, 1.8], z in [4.7, 5.3]
      // Block at (5, 0, 5) occupies x in [5, 6], y in [0, 1], z in [5, 6]
      // blockCenter = (5.5, 0.5, 5.5), playerCenter = (5, 0.9, 5)
      // overlapX: |5.5-5| = 0.5 < 0.5+0.3 = 0.8 => true
      // overlapY: |0.5-0.9| = 0.4 < 0.5+0.9 = 1.4 => true
      // overlapZ: |5.5-5| = 0.5 < 0.5+0.3 = 0.8 => true
      const targetPos: Position = { x: 5, y: 0, z: 5 }
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 5, y: 0, z: 5 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.placeBlock(targetPos, 'STONE'))

        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result)).message).toContain('Cannot place block inside player')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should allow placing block just outside player AABB', () => {
      // Player at (0, 0, 0). PLAYER_HALF_WIDTH=0.3, PLAYER_HALF_HEIGHT=0.9
      // Block at (2, 0, 0): blockCenter=(2.5, 0.5, 0.5)
      // overlapX: |2.5-0| = 2.5 < 0.8 => false => no overlap
      const targetPos: Position = { x: 2, y: 0, z: 0 }
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 0, y: 0, z: 0 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx, lz, y } = worldToLocal(targetPos)
      const chunkRef = handle.getChunkForPos(targetPos)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.placeBlock(targetPos, 'SAND')
        expect(readBlock(chunkRef, lx, y, lz)).toBe('SAND')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fail when chunk manager fails on getChunk', () => {
      const chunkManagerService = createFailingChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(chunkManagerService, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.placeBlock({ x: 0, y: 0, z: 0 }, 'DIRT'))

        expect(Either.isLeft(result)).toBe(true)
        const errPlace4 = Option.getOrThrow(Either.getLeft(result))
        expect(errPlace4).toBeInstanceOf(BlockServiceError)
        expect((errPlace4 as BlockServiceError).operation).toBe('placeBlock')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fail when player service fails to return position', () => {
      const handle = createMockChunkManagerService()
      const playerService = createFailingPlayerService()
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* Effect.either(blockService.placeBlock({ x: 0, y: 0, z: 0 }, 'DIRT'))

        expect(Either.isLeft(result)).toBe(true)
        const errPlace5 = Option.getOrThrow(Either.getLeft(result))
        expect(errPlace5).toBeInstanceOf(BlockServiceError)
        expect((errPlace5 as BlockServiceError).operation).toBe('placeBlock')
        expect(errPlace5.message).toContain('Player position error')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should allow placing different block types', () => {
      const blockTypes: BlockType[] = ['DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND', 'LEAVES', 'GLASS']

      return Effect.forEach(blockTypes, (blockType) => {
        // Use a unique position per block type to avoid reusing the same chunk cell
        const typeIdx = Option.getOrElse(Arr.findFirstIndex(blockTypes, (bt) => bt === blockType), () => 0)
        const targetPos: Position = { x: typeIdx * 2, y: 0, z: 0 }
        const handle = createMockChunkManagerService()
        const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
        const testLayer = createTestLayer(handle.service, playerService)

        const { lx, lz, y } = worldToLocal(targetPos)
        const chunkRef = handle.getChunkForPos(targetPos)

        return Effect.gen(function* () {
          const blockService = yield* BlockService
          yield* blockService.placeBlock(targetPos, blockType)
          expect(readBlock(chunkRef, lx, y, lz)).toBe(blockType)
        }).pipe(Effect.provide(testLayer))
      }, { concurrency: 1, discard: true })
    })
  })

  describe('Effect composition', () => {
    it.effect('should support chaining breakBlock and placeBlock', () => {
      const targetPos: Position = { x: 0, y: 0, z: 0 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'DIRT' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx, lz, y } = worldToLocal(targetPos)
      const chunkRef = handle.getChunkForPos(targetPos)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        // Break the existing DIRT block
        yield* blockService.breakBlock(targetPos)

        // Place a STONE block in its place
        yield* blockService.placeBlock(targetPos, 'STONE')

        expect(readBlock(chunkRef, lx, y, lz)).toBe('STONE')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should support Effect.flatMap for chaining operations', () => {
      const targetPos: Position = { x: 1, y: 1, z: 1 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'WOOD' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx, lz, y } = worldToLocal(targetPos)
      const chunkRef = handle.getChunkForPos(targetPos)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const outcome = yield* blockService.breakBlock(targetPos).pipe(
          Effect.flatMap(() => blockService.placeBlock(targetPos, 'GLASS')),
          Effect.map(() => ({ placed: true }))
        )

        expect(outcome.placed).toBe(true)
        expect(readBlock(chunkRef, lx, y, lz)).toBe('GLASS')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Effect.Metric counters', () => {
    it.effect('breakBlock increments blocks_broken counter by 1', () => {
      const targetPos: Position = { x: 10, y: 10, z: 10 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'STONE' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const counter = Metric.counter('blocks_broken')
        const before = yield* Metric.value(counter)

        const blockService = yield* BlockService
        yield* blockService.breakBlock(targetPos)

        const after = yield* Metric.value(counter)
        expect(after.count - before.count).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('breakBlock multiple times increments blocks_broken by N', () => {
      const positions: Position[] = [
        { x: 20, y: 10, z: 20 },
        { x: 21, y: 10, z: 20 },
        { x: 22, y: 10, z: 20 },
      ]
      const handle = createMockChunkManagerService(
        Arr.map(positions, (pos) => ({ pos, blockType: 'DIRT' as const }))
      )
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const counter = Metric.counter('blocks_broken')
        const before = yield* Metric.value(counter)

        const blockService = yield* BlockService
        yield* Effect.forEach(positions, pos => blockService.breakBlock(pos), { concurrency: 1 })

        const after = yield* Metric.value(counter)
        expect(after.count - before.count).toBe(3)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('placeBlock increments blocks_placed counter by 1', () => {
      const targetPos: Position = { x: 30, y: 10, z: 30 }
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const counter = Metric.counter('blocks_placed')
        const before = yield* Metric.value(counter)

        const blockService = yield* BlockService
        yield* blockService.placeBlock(targetPos, 'DIRT')

        const after = yield* Metric.value(counter)
        expect(after.count - before.count).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('breakBlock does NOT increment blocks_placed', () => {
      const targetPos: Position = { x: 40, y: 10, z: 40 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'GRASS' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const placedCounter = Metric.counter('blocks_placed')
        const before = yield* Metric.value(placedCounter)

        const blockService = yield* BlockService
        yield* blockService.breakBlock(targetPos)

        const after = yield* Metric.value(placedCounter)
        expect(after.count - before.count).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('placeBlock does NOT increment blocks_broken', () => {
      const targetPos: Position = { x: 50, y: 10, z: 50 }
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const brokenCounter = Metric.counter('blocks_broken')
        const before = yield* Metric.value(brokenCounter)

        const blockService = yield* BlockService
        yield* blockService.placeBlock(targetPos, 'STONE')

        const after = yield* Metric.value(brokenCounter)
        expect(after.count - before.count).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Error type verification', () => {
    it('BlockServiceError should have _tag = BlockServiceError', () => {
      const error = new BlockServiceError({ operation: 'test', reason: 'test' })
      expect(error._tag).toBe('BlockServiceError')
    })

    it.effect('BlockServiceError should be catchable with Effect.catchTag', () => {
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        // breakBlock on AIR should fail
        const result = yield* blockService.breakBlock({ x: 0, y: 0, z: 0 }).pipe(
          Effect.catchTag('BlockServiceError', (e) => Effect.succeed(`caught: ${e.operation}`))
        )

        expect(result).toBe('caught: breakBlock')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('placeBlock error should be catchable with Effect.catchTag', () => {
      const targetPos: Position = { x: 0, y: 0, z: 0 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'STONE' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        const result = yield* blockService.placeBlock(targetPos, 'DIRT').pipe(
          Effect.catchTag('BlockServiceError', (e) => Effect.succeed(`caught: ${e.operation}`))
        )

        expect(result).toBe('caught: placeBlock')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('breakBlock — edge cases', () => {
    it.effect('should handle breaking block at negative coordinates', () => {
      const targetPos: Position = { x: -3, y: 5, z: -7 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'STONE' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx, lz, y } = worldToLocal(targetPos)
      const chunkRef = handle.getChunkForPos(targetPos)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.breakBlock(targetPos)
        expect(readBlock(chunkRef, lx, y, lz)).toBe('AIR')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should handle breaking block at y=255 (max height)', () => {
      const targetPos: Position = { x: 0, y: 255, z: 0 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'GLASS' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      const { lx, lz, y } = worldToLocal(targetPos)
      const chunkRef = handle.getChunkForPos(targetPos)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.breakBlock(targetPos)
        expect(readBlock(chunkRef, lx, y, lz)).toBe('AIR')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('markChunkDirty integration', () => {
    it.effect('breakBlock calls markChunkDirty with the correct ChunkCoord', () => {
      let dirtyCoord: Option.Option<{ x: number; z: number }> = Option.none()
      const targetPos: Position = { x: 5, y: 10, z: 21 }
      const { service: baseService } = createMockChunkManagerService([{ pos: targetPos, blockType: 'DIRT' }])
      const capturingService = {
        ...(baseService as unknown as Record<string, unknown>),
        markChunkDirty: (coord: ChunkCoord) =>
          Effect.sync(() => {
            dirtyCoord = Option.some({ x: coord.x, z: coord.z })
          }),
      } as unknown as ChunkManagerService
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(capturingService, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.breakBlock(targetPos)
        expect(Option.isSome(dirtyCoord)).toBe(true)
        const coord = Option.getOrThrow(dirtyCoord)
        expect(coord.x).toBe(Math.floor(targetPos.x / CHUNK_SIZE))
        expect(coord.z).toBe(Math.floor(targetPos.z / CHUNK_SIZE))
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('placeBlock calls markChunkDirty with the correct ChunkCoord', () => {
      let dirtyCoord: Option.Option<{ x: number; z: number }> = Option.none()
      const targetPos: Position = { x: 33, y: 5, z: 0 }
      const { service: baseService } = createMockChunkManagerService()
      const capturingService = {
        ...(baseService as unknown as Record<string, unknown>),
        markChunkDirty: (coord: ChunkCoord) =>
          Effect.sync(() => {
            dirtyCoord = Option.some({ x: coord.x, z: coord.z })
          }),
      } as unknown as ChunkManagerService
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(capturingService, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.placeBlock(targetPos, 'STONE')
        expect(Option.isSome(dirtyCoord)).toBe(true)
        const coord = Option.getOrThrow(dirtyCoord)
        expect(coord.x).toBe(Math.floor(targetPos.x / CHUNK_SIZE))
        expect(coord.z).toBe(Math.floor(targetPos.z / CHUNK_SIZE))
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('breakBlock does NOT call markChunkDirty when it fails (no block)', () => {
      let dirtyCalled = false
      const { service: baseService } = createMockChunkManagerService()
      const capturingService = {
        ...(baseService as unknown as Record<string, unknown>),
        markChunkDirty: (_coord: ChunkCoord) =>
          Effect.sync(() => {
            dirtyCalled = true
          }),
      } as unknown as ChunkManagerService
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(capturingService, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* Effect.either(blockService.breakBlock({ x: 0, y: 0, z: 0 }))
        expect(dirtyCalled).toBe(false)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('breakBlock/placeBlock — out-of-bounds y coordinate', () => {
    it.effect('breakBlock at y=256 fails with BlockServiceError (out-of-bounds)', () => {
      // y=256 exceeds CHUNK_HEIGHT-1=255 → setBlockInChunk returns BlockIndexError
      // We need a block at y=256 to pass the AIR check; since the array index would
      // be out of range, indexToBlockType returns AIR (0), so breakBlock fails with
      // "No block at position" before reaching setBlockInChunk.
      // Either way the result must be Left<BlockServiceError>.
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        const result = yield* Effect.either(blockService.breakBlock({ x: 0, y: 256, z: 0 }))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(BlockServiceError)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('breakBlock at y=-1 fails with BlockServiceError (out-of-bounds)', () => {
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        const result = yield* Effect.either(blockService.breakBlock({ x: 0, y: -1, z: 0 }))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(BlockServiceError)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('placeBlock at y=-1 fails with BlockServiceError (out-of-bounds)', () => {
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        const result = yield* Effect.either(blockService.placeBlock({ x: 0, y: -1, z: 0 }, 'STONE'))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(BlockServiceError)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('placeBlock — boundary positions relative to player', () => {
    it.effect('should succeed when block is placed 2 blocks above player (y-axis separation)', () => {
      // Player at y=0, PLAYER_HALF_HEIGHT=0.9, player center Y=0.9
      // Block at y=3: blockCenter=(0.5, 3.5, 0.5)
      // overlapY: |3.5-0.9| = 2.6 < (0.5+0.9)=1.4 => false
      const targetPos: Position = { x: 0, y: 3, z: 0 }
      const handle = createMockChunkManagerService()
      const playerService = createMockPlayerService({ x: 0, y: 0, z: 0 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService
        yield* blockService.placeBlock(targetPos, 'DIRT')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should fail when trying to break a block twice in a row', () => {
      const targetPos: Position = { x: 5, y: 5, z: 5 }
      const handle = createMockChunkManagerService([{ pos: targetPos, blockType: 'DIRT' }])
      const playerService = createMockPlayerService({ x: 100, y: 0, z: 100 })
      const testLayer = createTestLayer(handle.service, playerService)

      return Effect.gen(function* () {
        const blockService = yield* BlockService

        // First break should succeed
        yield* blockService.breakBlock(targetPos)

        // Second break should fail (block is now AIR)
        const result = yield* Effect.either(blockService.breakBlock(targetPos))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result)).message).toContain('No block at position')
      }).pipe(Effect.provide(testLayer))
    })
  })
})
