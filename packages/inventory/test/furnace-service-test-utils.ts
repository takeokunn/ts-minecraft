import { Array as Arr, Effect, Layer, MutableHashMap, Option } from 'effect'
import { FurnaceServiceLive } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { InventoryService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { blockTypeToIndex, CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'

export const makeChunkWithFurnace = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks[64] = blockTypeToIndex('FURNACE')
  return { coord: { x: 0, z: 0 }, blocks }
}

export const makeEmptyChunk = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  return { coord: { x: 0, z: 0 }, blocks }
}

export type RecipeEntry = {
  station: string
  ingredients: { blockType: string; count: number }[]
  output: { blockType: string; count: number }
}

export type MakeFurnaceLayerOpts = {
  playerPosition?: { x: number; y: number; z: number }
  inventoryItems?: Map<string, number>
  recipeMap?: Record<string, RecipeEntry>
  chunkBlocks?: Uint8Array
  getChunkFails?: boolean
}

export const makeFurnaceLayer = (opts: MakeFurnaceLayerOpts = {}) => {
  const {
    playerPosition = { x: 0, y: 64, z: 0 },
    inventoryItems = new Map([['RAW_IRON', 1], ['COAL', 1]]),
    recipeMap = {
      'raw-iron-to-iron-ingot': {
        station: 'furnace',
        ingredients: [{ blockType: 'RAW_IRON', count: 1 }],
        output: { blockType: 'IRON_INGOT', count: 1 },
      },
    },
    chunkBlocks,
    getChunkFails = false,
  } = opts

  const items = MutableHashMap.fromIterable(inventoryItems)

  const inventory = {
    getAllSlots() {
      return Effect.succeed(
        Arr.map(Arr.fromIterable(items), ([blockType, count]) =>
          Option.some({ blockType, count }),
        ),
      )
    },
    removeBlock(blockType: string, count: number) {
      return Effect.sync(() => {
        const current = Option.getOrElse(MutableHashMap.get(items, blockType), () => 0)
        if (current < count) return false
        MutableHashMap.set(items, blockType, current - count)
        return true
      })
    },
    addBlock(blockType: string, _count: number) {
      return Effect.sync(() => {
        const current = Option.getOrElse(MutableHashMap.get(items, blockType), () => 0)
        MutableHashMap.set(items, blockType, current + _count)
        return true
      })
    },
  }

  const blocks = chunkBlocks ?? (() => {
    const b = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    b[64] = blockTypeToIndex('FURNACE')
    return b
  })()

  return FurnaceServiceLive.pipe(
    Layer.provide(Layer.succeed(RecipeService, {
      findById: (id: string) => {
        const entry = recipeMap[id]
        return entry
          ? Option.some({ id, ...entry })
          : Option.none()
      },
    } as unknown as RecipeService)),
    Layer.provide(Layer.succeed(InventoryService, inventory as unknown as InventoryService)),
    Layer.provide(Layer.succeed(GameStateService, {
      getPlayerPosition: () => Effect.succeed(playerPosition),
    } as unknown as GameStateService)),
    Layer.provide(Layer.succeed(ChunkManagerService, {
      getChunk: () =>
        getChunkFails
          ? Effect.fail(new Error('chunk unavailable'))
          : Effect.succeed({ coord: { x: 0, z: 0 }, blocks }),
    } as unknown as ChunkManagerService)),
  )
}
