import { Array as Arr, Brand, Effect, HashMap, Layer, MutableHashMap, Option } from 'effect'
import { StorageServicePort } from '@ts-minecraft/terrain'
import type { ChunkStorageValue } from '@ts-minecraft/terrain'
import { StorageError } from '../domain/errors'
import { NoiseServicePort } from '@ts-minecraft/terrain'
import { NoiseServiceLive } from '@ts-minecraft/terrain'
import { TerrainWorkerPoolPortLayer } from '@ts-minecraft/app'
import { BiomeServiceLive } from '@ts-minecraft/terrain'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, indexToBlockType, blockIndex, ChunkCoord } from '@ts-minecraft/kernel'
import { ChunkServiceLive } from '@ts-minecraft/terrain'
import { PlayerService } from '@ts-minecraft/player'
import { Position, PlayerId, WorldId } from '@ts-minecraft/kernel'
import { PlayerError } from '@ts-minecraft/player'
import { ChunkManagerService, ChunkManagerServiceLive } from '@ts-minecraft/terrain'
import { LightEngineLive } from '@ts-minecraft/terrain'
import { BlockServiceLive } from '@ts-minecraft/terrain'
import { InventoryService } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { FluidService } from '@ts-minecraft/terrain'
import { DEFAULT_WORLD_ID, DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
type ChunkStorageKey = string & Brand.Brand<'ChunkStorageKey'>
const ChunkStorageKey = Brand.nominal<ChunkStorageKey>()
const storageKey = (worldId: WorldId, coord: ChunkCoord): ChunkStorageKey =>
  ChunkStorageKey(`${worldId}:${coord.x}:${coord.z}`)

export const makeInMemoryStorage = () => {
  const chunks = MutableHashMap.empty<ChunkStorageKey, Uint8Array>()

  return StorageServicePort.of({
    _tag: '@minecraft/application/storage/StorageServicePort' as const,
    saveChunk: (worldId, coord, data) =>
      Effect.sync(() => {
        MutableHashMap.set(chunks, storageKey(worldId, coord), data)
      }) as Effect.Effect<undefined, StorageError>,
    loadChunk: (worldId, coord) =>
      Effect.sync(() => MutableHashMap.get(chunks, storageKey(worldId, coord))),
  })
}

// ---------------------------------------------------------------------------
// Mock PlayerService
// ---------------------------------------------------------------------------

export const createMockPlayerService = (position: Position): PlayerService =>
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

// Build the full integration layer: BlockService + ChunkManagerService + deps.
// Returns the shared in-memory storage so tests can inspect it directly.
export const buildIntegrationLayer = (playerPos: Position = { x: 100, y: 0, z: 100 }) => {
  const storage = makeInMemoryStorage()
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
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

  const MockInventoryLayer = Layer.succeed(InventoryService, {
    addBlock: (_blockType: unknown, _count: unknown) => Effect.succeed(false),
    removeBlock: (_blockType: unknown, _count: unknown) => Effect.succeed(true),
    getSlot: (_idx: unknown) => Effect.void,
    setSlot: (_idx: unknown, _slot: unknown) => Effect.void,
    moveStack: (_from: unknown, _to: unknown) => Effect.void,
    getHotbarSlots: () => Effect.succeed([]),
  } as unknown as InventoryService)

  const MockHotbarLayer = Layer.succeed(HotbarService, {
    getSelectedSlot: () => Effect.succeed(0 as never),
    setSelectedSlot: () => Effect.void,
    getSelectedBlockType: () => Effect.succeed(Option.none()),
    getSlots: () => Effect.succeed([]),
    update: () => Effect.void,
  } as unknown as HotbarService)

  const MockFurnaceLayer = Layer.succeed(FurnaceService, {
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
  } as unknown as FurnaceService)

  const MockFluidLayer = Layer.succeed(FluidService, {
    notifyBlockChanged: (_position: unknown) => Effect.void,
    seedWater: (_position: unknown) => Effect.void,
    removeWater: (_position: unknown) => Effect.void,
    syncLoadedChunks: (_chunks: unknown) => Effect.void,
    tick: () => Effect.void,
  } as unknown as FluidService)

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
  const StorageTestLayer = Layer.succeed(StorageServicePort, storage as unknown as StorageServicePort)
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

export const readBlockFromArray = (data: ChunkStorageValue, lx: number, y: number, lz: number): string => {
  const blocks = data instanceof Uint8Array ? data : data.blocks
  return Option.match(blockIndex(lx, y, lz), {
    onNone: () => 'AIR',
    onSome: (idx) => indexToBlockType(Option.getOrElse(Option.fromNullable(blocks[idx]), () => 0)),
  })
}
