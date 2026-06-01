import { Brand, Effect, HashMap, Layer, MutableHashMap, Option } from 'effect'
import { StorageServicePort } from '@ts-minecraft/world'
import type { ChunkStorageValue } from '@ts-minecraft/world'
import { NoiseServicePort } from '@ts-minecraft/world'
import { NoiseServiceLive } from '@ts-minecraft/world'
import { TerrainWorkerPoolPortLayer } from '@ts-minecraft/world'
import { BiomeServiceLive } from '@ts-minecraft/world'
import { CHUNK_SIZE, indexToBlockType, blockIndex, SlotIndex, ChunkCoord } from '@ts-minecraft/core'
import { ChunkServiceLive } from '@ts-minecraft/world'
import { PlayerService } from '@ts-minecraft/entity'
import { Position, PlayerId, WorldId } from '@ts-minecraft/core'
import { PlayerError } from '@ts-minecraft/entity'
import { ChunkManagerServiceLive } from '@ts-minecraft/world'
import { LightEngineLive } from '@ts-minecraft/world'
import { BlockServiceLive } from '@ts-minecraft/world'
import { InventoryService } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import type { InventorySlots } from '@ts-minecraft/inventory'
import { FluidService } from '@ts-minecraft/world'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
type ChunkStorageKey = string & Brand.Brand<'ChunkStorageKey'>
const ChunkStorageKey = Brand.nominal<ChunkStorageKey>()
const storageKey = (worldId: WorldId, coord: ChunkCoord): ChunkStorageKey =>
  ChunkStorageKey(`${worldId}:${coord.x}:${coord.z}`)

export const makeInMemoryStorage = () => {
  const chunks = MutableHashMap.empty<ChunkStorageKey, ChunkStorageValue>()

  return StorageServicePort.of({
    _tag: '@minecraft/application/storage/StorageServicePort' as const,
    saveChunk: (worldId, coord, data) =>
      Effect.sync((): void => {
        MutableHashMap.set(chunks, storageKey(worldId, coord), data)
      }),
    loadChunk: (worldId, coord) =>
      Effect.sync(() => MutableHashMap.get(chunks, storageKey(worldId, coord))),
  })
}

// ---------------------------------------------------------------------------
// Mock PlayerService
// ---------------------------------------------------------------------------

export const createMockPlayerService = (position: Position): PlayerService =>
  PlayerService.of({
    _tag: '@minecraft/application/PlayerService' as const,
    create: (_id: PlayerId, _position: Position) => Effect.void,
    updatePosition: (_id: PlayerId, _position: Position) => Effect.void,
    updateVelocity: (_id: PlayerId, _velocity) => Effect.void,
    getPosition: (_id: PlayerId) => Effect.succeed(position),
    getVelocity: (_id: PlayerId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
    getState: (_id: PlayerId) =>
      Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
  })

// ---------------------------------------------------------------------------
// Layer builders
// ---------------------------------------------------------------------------

// Build the full integration layer: BlockService + ChunkManagerService + deps.
// Returns the shared in-memory storage so tests can inspect it directly.
export const buildIntegrationLayer = (playerPos: Position = { x: 100, y: 0, z: 100 }) => {
  const storage = makeInMemoryStorage()
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

  const ChunkManagerTestLayer = ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
    Layer.provide(NoiseServiceLive),
    Layer.provide(TerrainWorkerPoolPortLayer),
    Layer.provide(LightEngineLive),
  )

  const PlayerTestLayer = Layer.succeed(PlayerService, createMockPlayerService(playerPos))

  const emptyInventorySlots: InventorySlots = []

  const MockInventoryLayer = Layer.succeed(InventoryService, InventoryService.of({
    _tag: '@minecraft/application/InventoryService' as const,
    addBlock: (_blockType, _count) => Effect.succeed(false),
    removeBlock: (_blockType, _count, _preferredSlot) => Effect.succeed(true),
    getSlot: (_idx) => Effect.succeed(Option.none()),
    setSlot: (_idx, _slot) => Effect.void,
    damageSlot: (_idx, _amount) => Effect.void,
    moveStack: (_from, _to) => Effect.void,
    getHotbarSlots: () => Effect.succeed([]),
    getAllSlots: () => Effect.succeed(emptyInventorySlots),
    serialize: () => Effect.succeed({ slots: [] }),
    clear: () => Effect.void,
    deserialize: (_data) => Effect.void,
  }))

  const MockHotbarLayer = Layer.succeed(HotbarService, HotbarService.of({
    _tag: '@minecraft/application/HotbarService' as const,
    getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
    setSelectedSlot: () => Effect.void,
    getSelectedBlockType: () => Effect.succeed(Option.none()),
    getSlots: () => Effect.succeed([]),
    update: () => Effect.void,
  }))

  const MockFurnaceLayer = Layer.succeed(FurnaceService, FurnaceService.of({
    _tag: '@minecraft/application/FurnaceService' as const,
    getState: () => Effect.succeed({ furnaces: HashMap.empty(), selectedFurnacePosition: Option.none() }),
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
  }))

  const MockFluidLayer = Layer.succeed(FluidService, FluidService.of({
    _tag: '@minecraft/application/FluidService' as const,
    notifyBlockChanged: (_position) => Effect.void,
    seedWater: (_position) => Effect.void,
    seedLava: (_position) => Effect.void,
    removeWater: (_position) => Effect.void,
    removeLava: (_position) => Effect.void,
    syncLoadedChunks: (_chunks) => Effect.void,
    tick: () => Effect.void,
  }))

  const BlockTestLayer = BlockServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(ChunkManagerTestLayer, PlayerTestLayer, ChunkServiceLive, MockInventoryLayer, MockHotbarLayer, MockFluidLayer)
        .pipe(Layer.provideMerge(MockFurnaceLayer))
    )
  )

  // Merged layer providing both BlockService and ChunkManagerService
  const TestLayer = Layer.mergeAll(BlockTestLayer, ChunkManagerTestLayer)

  return { TestLayer, storage }
}

// Build a second ChunkManagerService layer backed by the SAME in-memory storage.
// Simulates a new game session loading persisted chunk data.
export const buildSecondSessionLayer = (storage: ReturnType<typeof makeInMemoryStorage>) => {
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage)
  const NoiseLayer = NoiseServicePort.Default
  const BiomeTestLayer = BiomeServiceLive.pipe(Layer.provide(NoiseLayer))

  return ChunkManagerServiceLive.pipe(
    Layer.provide(ChunkServiceLive),
    Layer.provide(StorageTestLayer),
    Layer.provide(BiomeTestLayer),
    Layer.provide(NoiseLayer),
    Layer.provide(NoiseServiceLive),
    Layer.provide(TerrainWorkerPoolPortLayer),
    Layer.provide(LightEngineLive),
  )
}

// ---------------------------------------------------------------------------
// Coordinate helpers (mirror block-service.ts worldToBlockLocal)
// ---------------------------------------------------------------------------

export const worldToLocal = (pos: Position): { coord: ChunkCoord; lx: number; lz: number; y: number } => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  const lx = ((Math.floor(pos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((Math.floor(pos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return { coord: { x: cx, z: cz }, lx, lz, y: Math.floor(pos.y) }
}

export const readBlockFromArray = (data: ChunkStorageValue | Uint8Array, lx: number, y: number, lz: number): string => {
  const blocks = data instanceof Uint8Array ? data : data.blocks
  return Option.match(blockIndex(lx, y, lz), {
    onNone: () => 'AIR',
    onSome: (idx) => indexToBlockType(Option.getOrElse(Option.fromNullable(blocks[idx]), () => 0)),
  })
}
