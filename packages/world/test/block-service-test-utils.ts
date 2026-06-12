import { Effect, HashMap, Layer, Array as Arr, MutableHashMap, Option, Either } from 'effect'
import { ChunkError } from '../domain/errors'
import { ChunkManagerService } from '../application/chunk-manager-service'
import { ChunkCoord, CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, indexToBlockType } from '@ts-minecraft/core'
import { ChunkServiceLive } from '../application/chunk-service'
import type { Chunk } from '../domain/chunk'
import { PlayerService } from '@ts-minecraft/entity'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { ChunkCacheKey, Position, PlayerId, SlotIndex } from '@ts-minecraft/core'
import { PlayerError } from '@ts-minecraft/entity'
import { BlockServiceLive, worldToBlockLocal } from '../application/block-service'
import { InventoryService, type InventorySlot } from '@ts-minecraft/inventory/application/inventory-service'
import { InventoryError } from '@ts-minecraft/inventory/domain/errors'
import { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { FluidService } from '../application/fluid-service'
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
  indexToBlockType(chunk.blocks[blockIdx(lx, y, lz)] ?? 0)

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

  const service = ChunkManagerService.of({
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: (coord: ChunkCoord) => Effect.sync(() => ensureChunk(coord)),
    loadChunksAroundPlayer: (_playerPos: Position, _renderDistance?: number) => Effect.succeed(false),
    getLoadedChunks: () => Effect.succeed(Arr.fromIterable(MutableHashMap.values(chunkMap))),
    drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
    markChunkDirty: (_coord: ChunkCoord) => Effect.void,
    saveDirtyChunks: () => Effect.void,
    unloadChunk: (_coord: ChunkCoord) => Effect.void,
    setActiveWorldId: (_worldId: unknown) => Effect.void,
    setActiveDimension: (_dim: unknown) => Effect.void,
  })
  return {
    service,
    getChunkForPos: (pos: Position) => ensureChunk(worldToLocal(pos).coord),
  }
}

export const createFailingChunkManagerService = (): ChunkManagerService => ChunkManagerService.of({
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: (_coord: ChunkCoord) =>
    Effect.fail(new ChunkError({ chunkCoord: { x: 0, z: 0 }, reason: 'Chunk load error' })),
  loadChunksAroundPlayer: (_playerPos: Position, _renderDistance?: number) => Effect.succeed(false),
  getLoadedChunks: () => Effect.succeed([]),
  drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
  markChunkDirty: (_coord: ChunkCoord) => Effect.void,
  saveDirtyChunks: () => Effect.void,
  unloadChunk: (_coord: ChunkCoord) => Effect.void,
  setActiveWorldId: (_worldId: unknown) => Effect.void,
  setActiveDimension: (_dim: unknown) => Effect.void,
})

export const createMockPlayerService = (position: Position): PlayerService => PlayerService.of({
  _tag: '@minecraft/application/PlayerService' as const,
  create: (_id: PlayerId, _position: Position) => Effect.void,
  updatePosition: (_id: PlayerId, _position: Position) => Effect.void,
  updateVelocity: (_id: PlayerId, _velocity: { x: number; y: number; z: number }) => Effect.void,
  getPosition: (_id: PlayerId) => Effect.succeed(position),
  getVelocity: (_id: PlayerId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getState: (_id: PlayerId) => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
})

export const createFailingPlayerService = (): PlayerService => PlayerService.of({
  _tag: '@minecraft/application/PlayerService' as const,
  create: (_id: PlayerId, _position: Position) => Effect.void,
  updatePosition: (_id: PlayerId, _position: Position) => Effect.void,
  updateVelocity: (_id: PlayerId, _velocity: { x: number; y: number; z: number }) => Effect.void,
  getPosition: (_id: PlayerId) => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'Player not found' })),
  getVelocity: (_id: PlayerId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
  getState: (_id: PlayerId) => Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
})

export const createMockInventoryService = (options?: {
  readonly removeBlock?: (itemType: InventoryItem, count: number, slot?: SlotIndex) => Effect.Effect<void, InventoryError>
  readonly addBlock?: (itemType: InventoryItem, count: number) => Effect.Effect<void, InventoryError>
}): InventoryService => InventoryService.of({
  _tag: '@minecraft/application/InventoryService' as const,
  addBlock: (itemType: InventoryItem, count: number) =>
    options?.addBlock ? options.addBlock(itemType, count) : Effect.void,
  removeBlock: (itemType: InventoryItem, count: number, slot?: SlotIndex) =>
    options?.removeBlock ? options.removeBlock(itemType, count, slot) : Effect.void,
  getSlot: (_idx: SlotIndex) => Effect.succeed(Option.none<InventorySlot extends Option.Option<infer T> ? T : never>()),
  setSlot: (_idx: SlotIndex, _slot: InventorySlot) => Effect.void,
  damageSlot: (_idx: SlotIndex, _amount?: number) => Effect.void,
  moveStack: (_from: SlotIndex, _to: SlotIndex) => Effect.void,
  quickMove: (_from: SlotIndex) => Effect.void,
  getHotbarSlots: () => Effect.succeed([]),
  getAllSlots: () => Effect.succeed([]),
  serialize: () => Effect.succeed({ slots: [] }),
  clear: () => Effect.void,
  deserialize: (_data) => Effect.void,
})

export const createMockHotbarService = (selectedBlockType: Option.Option<InventoryItem> = Option.none()): HotbarService => HotbarService.of({
  _tag: '@minecraft/application/HotbarService' as const,
  getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
  setSelectedSlot: (_slot: SlotIndex) => Effect.void,
  getSelectedBlockType: () => Effect.succeed(selectedBlockType),
  getSlots: () => Effect.succeed([]),
  update: () => Effect.void,
})

export const createMockFurnaceService = (): FurnaceService => FurnaceService.of({
  _tag: '@minecraft/application/FurnaceService' as const,
  getState: () => Effect.succeed({ furnaces: HashMap.empty(), selectedFurnacePosition: Option.none() }),
  getNearestFurnaceState: () => Effect.succeed(Option.none()),
  hasNearbyFurnace: () => Effect.succeed(false),
  setSelectedFurnace: (_position: Position) => Effect.void,
  startSmelting: (_recipeId) => Effect.void,
  collectOutput: () => Effect.succeed({ collected: true, xp: 0 }),
  clearFurnace: (_position: Position) => Effect.succeed([]),
  dismantleFurnace: (_position: Position) => Effect.succeed(true),
  serialize: () => Effect.succeed([]),
  deserialize: (_serialized) => Effect.void,
  tick: (_deltaTime) => Effect.void,
})

export const createFluidRecorder = () => {
  const calls = { notify: [] as Position[], seed: [] as Position[], remove: [] as Position[] }
  const service = FluidService.of({
    _tag: '@minecraft/application/FluidService' as const,
    notifyBlockChanged: (pos: Position) => Effect.sync(() => { calls.notify.push(pos) }),
    seedWater: (pos: Position) => Effect.sync(() => { calls.seed.push(pos) }),
    seedLava: (_pos: Position) => Effect.void,
    removeWater: (pos: Position) => Effect.sync(() => { calls.remove.push(pos) }),
    removeLava: (_pos: Position) => Effect.void,
    syncLoadedChunks: (_chunks) => Effect.void,
    tick: () => Effect.void,
  })
  return { service, calls }
}

export const createTestLayer = (
  chunkManagerService: ChunkManagerService,
  playerService: PlayerService,
  fluidService: FluidService = FluidService.of({
    _tag: '@minecraft/application/FluidService' as const,
    notifyBlockChanged: () => Effect.void,
    seedWater: () => Effect.void,
    seedLava: () => Effect.void,
    removeWater: () => Effect.void,
    removeLava: () => Effect.void,
    syncLoadedChunks: () => Effect.void,
    tick: () => Effect.void,
  }),
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
      Layer.succeed(FluidService, fluidService),
      ChunkServiceLive,
    ))
  )

// ─── Test assertion helpers ───────────────────────────────────────────────────

export const assertLeft = <E>(result: Either.Either<unknown, E>): E => {
  expect(Either.isLeft(result)).toBe(true)
  return Option.getOrThrow(Either.getLeft(result))
}
