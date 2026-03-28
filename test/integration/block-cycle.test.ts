/**
 * Integration test: block operation → chunk state → storage cycle
 *
 * Verifies the full pipeline:
 *   BlockService.breakBlock / placeBlock
 *   → ChunkManagerService (cache + dirty tracking)
 *   → StorageService (in-memory mock)
 *
 * Key relationships verified:
 *   - breakBlock sets chunk.dirty = true (via markChunkDirty)
 *   - saveDirtyChunks persists modified block data to storage
 *   - A new ChunkManagerService instance reads back the saved data unchanged
 */
import { describe, it, expect } from 'vitest'
import { Array as Arr, Effect, Layer, MutableHashMap, Option } from 'effect'
import { StorageServicePort } from '@/application/storage/storage-service-port'
import { StorageError } from '@/domain/errors'
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { BiomeServiceLive } from '@/application/biome/biome-service'
import {
  ChunkServiceLive,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  blockTypeToIndex,
  indexToBlockType,
  blockIndex,
  ChunkCoord,
} from '@/domain/chunk'
import { PlayerService } from '@/application/player/player-state'
import { Position, PlayerId } from '@/shared/kernel'
import { PlayerError } from '@/domain/errors'
import { ChunkManagerService, ChunkManagerServiceLive } from '@/application/chunk/chunk-manager-service'
import { BlockService, BlockServiceLive } from '@/application/block/block-service'
import { InventoryService } from '@/application/inventory/inventory-service'
import { FluidService } from '@/application/fluid/fluid-service'
import { DEFAULT_WORLD_ID, DEFAULT_PLAYER_ID } from '@/application/constants'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// In-memory StorageService mock (no IndexedDB)
// ---------------------------------------------------------------------------

const makeInMemoryStorage = () => {
  const chunks = MutableHashMap.empty<string, Uint8Array>()

  return StorageServicePort.of({
    _tag: '@minecraft/application/storage/StorageServicePort' as const,
    saveChunk: (worldId, coord, data) =>
      Effect.sync(() => {
        MutableHashMap.set(chunks, `${worldId}:${coord.x}:${coord.z}`, data)
      }) as Effect.Effect<undefined, StorageError>,
    loadChunk: (worldId, coord) =>
      Effect.sync(() => MutableHashMap.get(chunks, `${worldId}:${coord.x}:${coord.z}`)),
  })
}

// ---------------------------------------------------------------------------
// Mock PlayerService
// ---------------------------------------------------------------------------

const createMockPlayerService = (position: Position): PlayerService =>
  ({
    create: (_id: PlayerId, _position: Position) => Effect.void,
    updatePosition: (_id: PlayerId, _position: Position) => Effect.void,
    getPosition: (_id: PlayerId) => Effect.succeed(position),
    getVelocity: (_id: PlayerId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
    getState: (_id: PlayerId) =>
      Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
  } as unknown as PlayerService)

// ---------------------------------------------------------------------------
// Layer builders
// ---------------------------------------------------------------------------

/**
 * Build the full integration layer: BlockService + ChunkManagerService + deps.
 * Returns the shared in-memory storage so tests can inspect it directly.
 */
const buildIntegrationLayer = (playerPos: Position = { x: 100, y: 0, z: 100 }) => {
  const storage = makeInMemoryStorage()
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

  const ChunkManagerTestLayer = ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
  )

  const PlayerTestLayer = Layer.succeed(PlayerService, createMockPlayerService(playerPos))

  const MockInventoryLayer = Layer.succeed(InventoryService, {
    addBlock: (_blockType: unknown, _count: unknown) => Effect.succeed(false),
    getSlot: (_idx: unknown) => Effect.void,
    setSlot: (_idx: unknown, _slot: unknown) => Effect.void,
    moveStack: (_from: unknown, _to: unknown) => Effect.void,
    getHotbarSlots: () => Effect.succeed([]),
  } as unknown as InventoryService)

  const MockFluidLayer = Layer.succeed(FluidService, {
    notifyBlockChanged: (_position: unknown) => Effect.void,
    seedWater: (_position: unknown) => Effect.void,
    removeWater: (_position: unknown) => Effect.void,
    syncLoadedChunks: (_chunks: unknown) => Effect.void,
    tick: () => Effect.void,
  } as unknown as FluidService)

  const BlockTestLayer = BlockServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(ChunkManagerTestLayer, PlayerTestLayer, ChunkServiceLive, MockInventoryLayer, MockFluidLayer)
    )
  )

  // Merged layer providing both BlockService and ChunkManagerService
  const TestLayer = Layer.mergeAll(BlockTestLayer, ChunkManagerTestLayer)

  return { TestLayer, storage }
}

/**
 * Build a second ChunkManagerService layer backed by the SAME in-memory storage.
 * Simulates a new game session loading persisted chunk data.
 */
const buildSecondSessionLayer = (storage: ReturnType<typeof makeInMemoryStorage>) => {
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

  return ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
  )
}

// ---------------------------------------------------------------------------
// Coordinate helpers (mirror block-service.ts worldToChunkCoord)
// ---------------------------------------------------------------------------

const worldToLocal = (pos: Position): { coord: ChunkCoord; lx: number; lz: number; y: number } => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  const lx = ((Math.floor(pos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((Math.floor(pos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return { coord: { x: cx, z: cz }, lx, lz, y: Math.floor(pos.y) }
}

const readBlockFromArray = (blocks: Uint8Array, lx: number, y: number, lz: number): string =>
  Option.match(blockIndex(lx, y, lz), { onNone: () => 'AIR', onSome: (idx) => indexToBlockType(Option.getOrElse(Option.fromNullable(blocks[idx]), () => 0)) })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('integration/block-cycle', () => {
  describe('breakBlock → chunk dirty flag', () => {
    it('breakBlock makes the chunk dirty via markChunkDirty', () => {
      const targetPos: Position = { x: 1, y: 64, z: 1 }
      const { TestLayer, storage } = buildIntegrationLayer()

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        const { coord } = worldToLocal(targetPos)

        // Load the chunk (generates terrain). This creates a block at the surface.
        // Use a position that is guaranteed to have a non-AIR block after terrain gen.
        // We read the chunk first to find any solid block within it.
        const chunk = yield* chunkManager.getChunk(coord)

        // Find the first non-AIR block in this chunk by scanning y=80..1
        // (terrain surface is typically y=48-80 for PLAINS biome)
        const solidPos = Arr.findFirst(
          Arr.makeBy(80, (i) => 80 - i),
          (y) => {
            const idxOpt = blockIndex(0, y, 0)
            return Option.isSome(idxOpt) && chunk.blocks[idxOpt.value] !== 0
          }
        ).pipe(Option.map((y) => ({ x: coord.x * CHUNK_SIZE, y, z: coord.z * CHUNK_SIZE } as Position)))

        const effectiveSolidPos: Position = Option.getOrElse(solidPos, () => {
          // Fallback: manually inject a STONE block and break it
          const idxFallback = blockIndex(0, 64, 0)
          if (Option.isSome(idxFallback)) chunk.blocks[idxFallback.value] = blockTypeToIndex('STONE')
          return { x: coord.x * CHUNK_SIZE, y: 64, z: coord.z * CHUNK_SIZE }
        })

        // Save the chunk to ensure it's in cache before breakBlock
        yield* chunkManager.getChunk(coord)

        // Break the block — this calls markChunkDirty internally
        yield* blockService.breakBlock(effectiveSolidPos)

        // The chunk should now be dirty: saveDirtyChunks should write it to storage
        yield* chunkManager.saveDirtyChunks()

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)

        return { wasSaved: Option.isSome(stored) }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.wasSaved).toBe(true)
    })

    it('saveDirtyChunks saves modified block data reflecting the breakBlock', () => {
      const { TestLayer, storage } = buildIntegrationLayer()

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        // Use chunk (0,0); find a solid block by scanning from y=80 down
        const coord: ChunkCoord = { x: 0, z: 0 }
        const chunk = yield* chunkManager.getChunk(coord)

        // Find first non-AIR block (terrain surface)
        // Scan from CHUNK_HEIGHT-1 down to 1 to handle all biome height ranges
        const surfaceBlockOpt = Arr.findFirst(
          Arr.flatMap(
            Arr.makeBy(CHUNK_SIZE, (lz) => lz),
            (lz) => Arr.flatMap(
              Arr.makeBy(CHUNK_SIZE, (lx) => lx),
              (lx) => Arr.makeBy(CHUNK_HEIGHT - 1, (i) => ({ lx, lz, y: CHUNK_HEIGHT - 1 - i }))
            )
          ),
          ({ lx, lz, y }) => {
            const idxOpt = blockIndex(lx, y, lz)
            return y >= 1 && Option.isSome(idxOpt) && chunk.blocks[idxOpt.value] !== 0
          }
        )
        const { lx: surfaceLx, lz: surfaceLz, y: surfaceY } = Option.getOrElse(
          surfaceBlockOpt,
          () => ({ lx: 0, lz: 0, y: -1 })
        )

        // Fallback: place a DIRT block if no solid block found
        if (surfaceY === -1) {
          yield* blockService.placeBlock({ x: coord.x * CHUNK_SIZE, y: 64, z: coord.z * CHUNK_SIZE }, 'DIRT')
        }

        const effectiveSurfaceY = surfaceY === -1 ? 64 : surfaceY
        const worldPos: Position = {
          x: coord.x * CHUNK_SIZE + surfaceLx,
          y: effectiveSurfaceY,
          z: coord.z * CHUNK_SIZE + surfaceLz,
        }

        // Break the block at the surface
        yield* blockService.breakBlock(worldPos)

        // Save dirty chunks to storage
        yield* chunkManager.saveDirtyChunks()

        // Load the saved data back from storage
        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)
        expect(Option.isSome(stored)).toBe(true)

        if (Option.isSome(stored)) {
          const savedBlocks = stored.value
          // The broken block position should now be AIR in the saved data
          const savedBlock = readBlockFromArray(savedBlocks, surfaceLx, effectiveSurfaceY, surfaceLz)
          expect(savedBlock).toBe('AIR')
        }

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('placeBlock → saveDirtyChunks round-trip', () => {
    it('placed block is present in saved storage data', () => {
      const targetPos: Position = { x: 200, y: 200, z: 200 }
      const { TestLayer, storage } = buildIntegrationLayer()

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        const { coord, lx, lz, y } = worldToLocal(targetPos)

        // Load the chunk — terrain is generated and cached
        const chunkBefore = yield* chunkManager.getChunk(coord)

        // Ensure position is AIR (y=200 is well above terrain surface ~48-80)
        const idxBefore = blockIndex(lx, y, lz)
        expect(Option.isSome(idxBefore)).toBe(true)
        if (Option.isSome(idxBefore)) {
          expect(chunkBefore.blocks[idxBefore.value]).toBe(0) // AIR
        }

        // Place a STONE block at the target position
        yield* blockService.placeBlock(targetPos, 'STONE')

        // Save dirty chunks
        yield* chunkManager.saveDirtyChunks()

        // Verify storage has the data
        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)
        expect(Option.isSome(stored)).toBe(true)

        if (Option.isSome(stored)) {
          const savedBlock = readBlockFromArray(stored.value, lx, y, lz)
          expect(savedBlock).toBe('STONE')
        }

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('placed block type is preserved correctly (DIRT)', () => {
      const targetPos: Position = { x: 201, y: 200, z: 201 }
      const { TestLayer, storage } = buildIntegrationLayer()

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        const { coord, lx, lz, y } = worldToLocal(targetPos)

        yield* chunkManager.getChunk(coord)
        yield* blockService.placeBlock(targetPos, 'DIRT')
        yield* chunkManager.saveDirtyChunks()

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)
        expect(Option.isSome(stored)).toBe(true)
        if (Option.isSome(stored)) {
          expect(readBlockFromArray(stored.value, lx, y, lz)).toBe('DIRT')
        }

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('block state persists across ChunkManager sessions', () => {
    it('breakBlock → save → new session → load: block is AIR', () => {
      // Simulates: player breaks a block, game saves, game reloads, block is still AIR
      const { TestLayer, storage } = buildIntegrationLayer()
      const secondSessionLayer = buildSecondSessionLayer(storage)

      // Session 1: break a surface block and save
      const session1 = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        const coord: ChunkCoord = { x: 0, z: 0 }
        const chunk = yield* chunkManager.getChunk(coord)

        // Find the first solid block (terrain surface)
        // Scan from CHUNK_HEIGHT-1 down to 1 to handle all biome height ranges
        const surfaceBlockOpt = Arr.findFirst(
          Arr.flatMap(
            Arr.makeBy(CHUNK_SIZE, (lz) => lz),
            (lz) => Arr.flatMap(
              Arr.makeBy(CHUNK_SIZE, (lx) => lx),
              (lx) => Arr.makeBy(CHUNK_HEIGHT - 1, (i) => ({ lx, lz, y: CHUNK_HEIGHT - 1 - i }))
            )
          ),
          ({ lx, lz, y }) => {
            const idxOpt = blockIndex(lx, y, lz)
            return y >= 1 && Option.isSome(idxOpt) && chunk.blocks[idxOpt.value] !== 0
          }
        )
        const { lx: surfaceLx, lz: surfaceLz, y: surfaceY } = Option.getOrElse(
          surfaceBlockOpt,
          () => ({ lx: 0, lz: 0, y: -1 })
        )

        // Fallback: place a DIRT block if no solid block found
        if (surfaceY === -1) {
          yield* blockService.placeBlock({ x: coord.x * CHUNK_SIZE, y: 64, z: coord.z * CHUNK_SIZE }, 'DIRT')
        }

        const effectiveSurfaceY = surfaceY === -1 ? 64 : surfaceY
        const worldPos: Position = {
          x: coord.x * CHUNK_SIZE + surfaceLx,
          y: effectiveSurfaceY,
          z: coord.z * CHUNK_SIZE + surfaceLz,
        }

        yield* blockService.breakBlock(worldPos)
        yield* chunkManager.saveDirtyChunks()

        return { coord, surfaceLx, surfaceY: effectiveSurfaceY, surfaceLz }
      }).pipe(Effect.provide(TestLayer))

      const { coord: savedCoord, surfaceLx: savedSurfaceLx, surfaceY: savedSurfaceY, surfaceLz: savedSurfaceLz } = Effect.runSync(session1)

      // Session 2: load the same chunk from storage (new ChunkManagerService instance)
      const session2 = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService

        // Storage has the saved data; getChunk should load from storage (not regenerate)
        const chunk = yield* chunkManager.getChunk(savedCoord)

        const blockType = readBlockFromArray(chunk.blocks, savedSurfaceLx, savedSurfaceY, savedSurfaceLz)
        return { blockType }
      }).pipe(Effect.provide(secondSessionLayer))

      const result = Effect.runSync(session2)
      expect(result.blockType).toBe('AIR')
    })

    it('placeBlock → save → new session → load: placed block is present', () => {
      const targetPos: Position = { x: 0, y: 200, z: 0 }
      const { TestLayer, storage } = buildIntegrationLayer()
      const secondSessionLayer = buildSecondSessionLayer(storage)

      const { coord, lx, lz, y } = worldToLocal(targetPos)

      // Session 1: place a WOOD block at a high altitude (guaranteed AIR) and save
      const session1 = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        yield* chunkManager.getChunk(coord)
        yield* blockService.placeBlock(targetPos, 'WOOD')
        yield* chunkManager.saveDirtyChunks()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      Effect.runSync(session1)

      // Session 2: load chunk from storage and verify the WOOD block is there
      const session2 = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService

        const chunk = yield* chunkManager.getChunk(coord)
        const blockType = readBlockFromArray(chunk.blocks, lx, y, lz)
        return { blockType }
      }).pipe(Effect.provide(secondSessionLayer))

      const result = Effect.runSync(session2)
      expect(result.blockType).toBe('WOOD')
    })

    it('clean chunk (no modifications) is NOT saved to storage after saveDirtyChunks', () => {
      const { TestLayer, storage } = buildIntegrationLayer()

      const result = Effect.runSync(
        Effect.gen(function* () {
          const chunkManager = yield* ChunkManagerService

          yield* chunkManager.getChunk({ x: 5, z: 5 })
          yield* chunkManager.saveDirtyChunks()

          const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, { x: 5, z: 5 })
          return { wasStored: Option.isSome(stored) }
        }).pipe(Effect.provide(TestLayer))
      )

      expect(result.wasStored).toBe(false)
    })

    it('unloadChunk auto-saves dirty chunk without explicit saveDirtyChunks', () => {
      const targetPos: Position = { x: 0, y: 200, z: 0 }
      const { TestLayer, storage } = buildIntegrationLayer()
      const { coord } = worldToLocal(targetPos)

      const program = Effect.gen(function* () {
        const chunkManager = yield* ChunkManagerService
        const blockService = yield* BlockService

        yield* chunkManager.getChunk(coord)
        yield* blockService.placeBlock(targetPos, 'GLASS')

        // unloadChunk should auto-save the dirty chunk without calling saveDirtyChunks
        yield* chunkManager.unloadChunk(coord)

        const stored = yield* storage.loadChunk(DEFAULT_WORLD_ID, coord)
        return { wasSaved: Option.isSome(stored) }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.wasSaved).toBe(true)
    })
  })
})
