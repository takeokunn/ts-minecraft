import { Array as Arr, Effect, Layer, MutableHashMap, Option } from 'effect'
import { FurnaceServiceLive } from '@ts-minecraft/furnace'
import { RecipeService, InventoryError } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { PlayerError, PlayerService } from '@ts-minecraft/player'
import { ChunkError, ChunkManagerService } from '@ts-minecraft/terrain'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE, DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import type { BlockType, InventoryItem, PlayerId, Position } from '@ts-minecraft/kernel'
import type { Chunk } from '@ts-minecraft/terrain'

export const makeChunkWithFurnace = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks[64] = blockTypeToIndex('FURNACE')
  return { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
}

export const makeEmptyChunk = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  return { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
}

export type RecipeEntry = {
  station: 'inventory' | 'crafting_table' | 'furnace'
  ingredients: { itemType: InventoryItem; count: number }[]
  output: { itemType: InventoryItem; count: number }
}

type InventoryMockOverrides = Partial<{
  getAllSlots: InventoryService['getAllSlots']
  removeBlock: InventoryService['removeBlock']
  addBlock: InventoryService['addBlock']
  getSlot: InventoryService['getSlot']
  setSlot: InventoryService['setSlot']
  moveStack: InventoryService['moveStack']
  getHotbarSlots: InventoryService['getHotbarSlots']
  clear: InventoryService['clear']
  serialize: InventoryService['serialize']
  deserialize: InventoryService['deserialize']
}>

type RecipeMockOverrides = Partial<{
  getAllRecipes: RecipeService['getAllRecipes']
  findById: RecipeService['findById']
  findCraftable: RecipeService['findCraftable']
  craft: RecipeService['craft']
}>

type ChunkManagerMockOverrides = Partial<{
  getChunk: ChunkManagerService['getChunk']
  getLoadedChunks: ChunkManagerService['getLoadedChunks']
  loadChunksAroundPlayer: ChunkManagerService['loadChunksAroundPlayer']
  markChunkDirty: ChunkManagerService['markChunkDirty']
  saveDirtyChunks: ChunkManagerService['saveDirtyChunks']
  unloadChunk: ChunkManagerService['unloadChunk']
}>

type PlayerMockOverrides = Partial<{
  create: PlayerService['create']
  updatePosition: PlayerService['updatePosition']
  updateVelocity: PlayerService['updateVelocity']
  getPosition: PlayerService['getPosition']
  getVelocity: PlayerService['getVelocity']
  getState: PlayerService['getState']
}>

export const makeRecipeService = (
  recipeMap: Record<string, RecipeEntry>,
  overrides: RecipeMockOverrides = {},
) =>
  RecipeService.of({
    _tag: '@minecraft/application/RecipeService' as const,
    getAllRecipes: () => [],
    findById: (id) => {
      const entry = recipeMap[id]
      return entry ? Option.some({ id, ...entry }) : Option.none()
    },
    findCraftable: () => [],
    craft: () => Effect.void,
    ...overrides,
  })

export const makeInventoryService = (
  items: MutableHashMap.MutableHashMap<InventoryItem, number>,
  overrides: InventoryMockOverrides = {},
) =>
  InventoryService.of({
    _tag: '@minecraft/application/InventoryService' as const,
    getAllSlots: (): ReturnType<InventoryService['getAllSlots']> =>
      Effect.succeed(
        Arr.fromIterable(MutableHashMap.keys(items)).map((itemType) =>
          Option.some({ itemType, count: Option.getOrElse(MutableHashMap.get(items, itemType), () => 0) }),
        ),
      ),
    removeBlock: (itemType: InventoryItem, count: number) =>
      Effect.suspend(() => {
        const current = Option.getOrElse(MutableHashMap.get(items, itemType), () => 0)
        if (current < count) return Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `Insufficient ${itemType}: need ${count}` }))
        MutableHashMap.set(items, itemType, current - count)
        return Effect.void
      }),
    addBlock: (itemType: InventoryItem, count: number) =>
      Effect.sync(() => {
        const current = Option.getOrElse(MutableHashMap.get(items, itemType), () => 0)
        MutableHashMap.set(items, itemType, current + count)
      }),
    getSlot: () => Effect.succeed(Option.none()),
    setSlot: () => Effect.void,
    moveStack: () => Effect.void,
    getHotbarSlots: () => Effect.succeed([]),
    clear: () =>
      Effect.sync(() => {
        Arr.fromIterable(MutableHashMap.keys(items)).forEach((k) => MutableHashMap.remove(items, k))
      }),
    serialize: () => Effect.succeed({ slots: [] }),
    deserialize: () => Effect.void,
    ...overrides,
  })

export const makePlayerService = (
  playerPosition: Position,
  overrides: PlayerMockOverrides = {},
) =>
  PlayerService.of({
    _tag: '@minecraft/application/PlayerService' as const,
    create: (_id: PlayerId, _position: Position) => Effect.void,
    updatePosition: (_id: PlayerId, _position: Position) => Effect.void,
    updateVelocity: (_id: PlayerId, _velocity: { x: number; y: number; z: number }) => Effect.void,
    getPosition: (_id: PlayerId) => Effect.succeed(playerPosition),
    getVelocity: (_id: PlayerId) => Effect.succeed({ x: 0, y: 0, z: 0 }),
    getState: (_id: PlayerId) =>
      Effect.fail(new PlayerError({ playerId: DEFAULT_PLAYER_ID, reason: 'not implemented' })),
    ...overrides,
  })

export const makeChunkManagerService = (
  chunk: Chunk,
  overrides: ChunkManagerMockOverrides = {},
) =>
  ChunkManagerService.of({
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: () => Effect.succeed(chunk),
    getLoadedChunks: () => Effect.succeed([]),
    loadChunksAroundPlayer: () => Effect.succeed(false),
    markChunkDirty: () => Effect.void,
    saveDirtyChunks: () => Effect.void,
    unloadChunk: () => Effect.void,
    ...overrides,
  })

export type MakeFurnaceLayerOpts = {
  playerPosition?: { x: number; y: number; z: number }
  inventoryItems?: MutableHashMap.MutableHashMap<InventoryItem, number>
  recipeMap?: Record<string, RecipeEntry>
  chunkBlocks?: Uint8Array
  getChunkFails?: boolean
}

export const makeFurnaceLayer = (opts: MakeFurnaceLayerOpts = {}) => {
  const {
    playerPosition = { x: 0, y: 64, z: 0 },
    inventoryItems = MutableHashMap.fromIterable<InventoryItem, number>([['RAW_IRON', 1], ['COAL', 1]]),
    recipeMap = {
      'raw-iron-to-iron-ingot': {
        station: 'furnace',
        ingredients: [{ itemType: 'RAW_IRON', count: 1 }],
        output: { itemType: 'IRON_INGOT', count: 1 },
      },
    },
    chunkBlocks,
    getChunkFails = false,
  } = opts

  const blocks = chunkBlocks ?? (() => {
    const b = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    b[64] = blockTypeToIndex('FURNACE')
    return b
  })()

  const chunk: Chunk = { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }

  return FurnaceServiceLive.pipe(
    Layer.provide(Layer.succeed(RecipeService, makeRecipeService(recipeMap))),
    Layer.provide(Layer.succeed(InventoryService, makeInventoryService(inventoryItems))),
    Layer.provide(Layer.succeed(PlayerService, makePlayerService(playerPosition))),
    Layer.provide(Layer.succeed(
      ChunkManagerService,
      makeChunkManagerService(
        chunk,
        getChunkFails
          ? {
              getChunk: (coord: Chunk['coord']) => Effect.fail(new ChunkError({ chunkCoord: coord, reason: 'chunk unavailable' })),
            }
          : {},
      ),
    )),
  )
}
