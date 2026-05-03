import { Effect, HashMap, Layer, Array as Arr, MutableHashMap, Option, Either } from 'effect'
import { ChunkManagerService, ChunkManagerError } from '@ts-minecraft/terrain'
import { ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, indexToBlockType } from '@ts-minecraft/kernel'
import { ChunkServiceLive, Chunk } from '@ts-minecraft/terrain'
import { PlayerService } from '@ts-minecraft/player'
import { BlockType } from '@ts-minecraft/kernel'
import { ChunkCacheKey, Position, PlayerId, SlotIndex } from '@ts-minecraft/kernel'
import { StorageError } from '../domain/errors'
import { PlayerError } from '@ts-minecraft/player'
import { BlockServiceLive, worldToBlockLocal } from '@ts-minecraft/terrain'
import { InventoryService } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import { FluidService } from '@ts-minecraft/terrain'
import { expect } from 'vitest'

// ─── Chunk test utilities ─────────────────────────────────────────────────────

export const makeEmptyChunk = (coord: ChunkCoord): Chunk => ({
  coord,
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

export const blockIdx = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

export const readBlock = (chunk: Chunk, lx: number, y: number, lz: number): BlockType =>
  indexToBlockType(Option.getOrElse(Option.fromNullable(chunk.blocks[blockIdx(lx, y, lz)]), () => 0))

export const writeBlock = (chunk: Chunk, lx: number, y: number, lz: number, blockType: BlockType): void => {
  chunk.blocks[blockIdx(lx, y, lz)] = blockTypeToIndex(blockType)
}

export const worldToLocal = (pos: Position): { coord: ChunkCoord; lx: number; lz: number; y: number } => {
  const { chunkCoord, lx, lz } = worldToBlockLocal(pos)
  return { coord: chunkCoord, lx, lz, y: Math.floor(pos.y) }
}

// ─── Mock factories ───────────────────────────────────────────────────────────

export interface MockChunkManagerHandle {
  service: ChunkManagerService
  getChunkForPos: (pos: Position) => Chunk
}

export const createMockChunkManagerService = (
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

export const createFailingChunkManagerService = (): ChunkManagerService => ({
  getChunk: (_coord: ChunkCoord) =>
    Effect.fail({ _tag: 'ChunkError' as const, message: 'Chunk load error', chunkCoord: { x: 0, z: 0 }, reason: 'Chunk load error' } as unknown as ChunkManagerError),
  loadChunksAroundPlayer: () => Effect.void,
  getLoadedChunks: () => Effect.succeed([]),
  markChunkDirty: () => Effect.void,
  saveDirtyChunks: () => Effect.void as Effect.Effect<void, StorageError>,
  unloadChunk: () => Effect.void as Effect.Effect<void, StorageError>,
} as unknown as ChunkManagerService)

export const createMockPlayerService = (position: Position): PlayerService => ({
  create: () => Effect.void,
  updatePosition: () => Effect.void,
  getPosition: (_id: PlayerId) => Effect.succeed(position),
  getVelocity: () => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getState: () => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
} as unknown as PlayerService)

export const createFailingPlayerService = (): PlayerService => ({
  create: () => Effect.void,
  updatePosition: () => Effect.void,
  getPosition: () => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'Player not found' })),
  getVelocity: () => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getState: () => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
} as unknown as PlayerService)

export const createMockInventoryService = (options?: {
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

export const createMockHotbarService = (selectedBlockType: Option.Option<BlockType> = Option.none()): HotbarService => ({
  getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
  setSelectedSlot: () => Effect.void,
  getSelectedBlockType: () => Effect.succeed(selectedBlockType),
  getSlots: () => Effect.succeed([]),
  update: () => Effect.void,
} as unknown as HotbarService)

export const createMockFurnaceService = (): FurnaceService => ({
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

export const createFluidRecorder = () => {
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

export const createTestLayer = (
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

export const assertLeft = <E>(result: Either.Either<unknown, E>): E => {
  expect(Either.isLeft(result)).toBe(true)
  return Option.getOrThrow(Either.getLeft(result))
}
