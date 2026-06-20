import { Array as Arr, Effect, Layer, MutableHashMap, Option } from 'effect'
import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { InventoryError } from '@ts-minecraft/inventory/domain/errors'
import { PlayerServicePort, WorldBlockQueryPort, worldToBlockIndex } from '@ts-minecraft/world'
import type { PlayerServicePortShape, WorldBlockQueryPortShape } from '@ts-minecraft/world'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import type { InventoryItem, PlayerId, Position } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'

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
  damageSlot: InventoryService['damageSlot']
  repairMendingItemsWithXP: InventoryService['repairMendingItemsWithXP']
  moveStack: InventoryService['moveStack']
  quickMove: InventoryService['quickMove']
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
  getBlockIndexAt: WorldBlockQueryPortShape['getBlockIndexAt']
}>

type PlayerMockOverrides = Partial<{
  getPosition: PlayerServicePortShape['getPosition']
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
          Option.some({ itemType, count: Option.getOrElse(MutableHashMap.get(items, itemType), () => 0), durability: null }),
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
    damageSlot: () => Effect.void,
    repairMendingItemsWithXP: (amount) => Effect.succeed(amount),
    moveStack: () => Effect.void,
    quickMove: () => Effect.void,
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
  PlayerServicePort.of({
    getPosition: (_id: PlayerId) => Effect.succeed(playerPosition),
    ...overrides,
  })

export const makeChunkManagerService = (
  chunk: Chunk,
  overrides: ChunkManagerMockOverrides = {},
) =>
  WorldBlockQueryPort.of({
    getBlockIndexAt: (position) =>
      Effect.sync(() => {
        const { chunkCoord, ly, flatIdx } = worldToBlockIndex(position)
        if (ly < 0 || ly >= CHUNK_HEIGHT) return Option.none()
        if (chunk.coord.x !== chunkCoord.x || chunk.coord.z !== chunkCoord.z) return Option.none()
        const blockIndex = chunk.blocks[flatIdx]
        if (blockIndex === undefined) return Option.none()
        if (blockIndex === blockTypeToIndex('AIR')) return Option.none()
        return Option.some(blockIndex)
      }),
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

  return FurnaceService.Default.pipe(
    Layer.provide(Layer.succeed(RecipeService, makeRecipeService(recipeMap))),
    Layer.provide(Layer.succeed(InventoryService, makeInventoryService(inventoryItems))),
    Layer.provide(Layer.succeed(PlayerServicePort, makePlayerService(playerPosition))),
    Layer.provide(Layer.succeed(
      WorldBlockQueryPort,
      makeChunkManagerService(
        chunk,
        getChunkFails
          ? {
              getBlockIndexAt: () => Effect.succeed(Option.none()),
            }
          : {},
      ),
    )),
  )
}
