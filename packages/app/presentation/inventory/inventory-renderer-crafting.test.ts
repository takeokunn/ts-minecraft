import { describe,it } from '@effect/vitest'
import { InventoryRendererLive,InventoryRendererService } from '@ts-minecraft/app/presentation/inventory/inventory-renderer'
import { blockTypeToIndex } from '@ts-minecraft/kernel'
import { ChunkError } from '@ts-minecraft/terrain'
import { Effect,Layer,Option } from 'effect'
import { expect } from 'vitest'
import {
createMockChunkManagerLayer,
createMockDomLayer,
createMockFurnaceLayer,
createMockGameStateLayer,
createMockHotbarLayer,
createMockInventoryLayer,
createMockRecipeLayer,
makeRecipe
} from './inventory-renderer-test-utils'

describe('presentation/inventory/inventory-renderer (recipe)', () => {
  describe('hasCraftingTable / hasNearbyFurnace', () => {
    it.scoped('hasCraftingTable returns true when crafting table is at player position', () => {
      // Player at (0,0,0); chunk (0,0); block at idx 0 = CRAFTING_TABLE
      const craftingTableIdx = blockTypeToIndex('CRAFTING_TABLE')
      const mockChunkManager = createMockChunkManagerLayer({
        getChunk: () => {
          const blocks = new Uint8Array(256 * 16 * 16)
          blocks[0] = craftingTableIdx
          return Effect.succeed({ coord: { x: 0, z: 0 }, blocks, fluid: Option.none() })
        },
      })

      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('recipe-a'))

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = InventoryRendererLive.pipe(
        Layer.provide(mockDom.MockDomLayer),
        Layer.provide(mockInventory.MockInventoryLayer),
        Layer.provide(mockHotbar.MockHotbarLayer),
        Layer.provide(mockRecipe.MockRecipeLayer),
        Layer.provide(createMockFurnaceLayer().MockFurnaceLayer),
        Layer.provide(createMockGameStateLayer().MockGameStateLayer),
        Layer.provide(mockChunkManager.MockChunkManagerLayer),
      )

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        yield* renderer.craftSelectedRecipe()
        // craft was called with hasTableAccess = true
        expect(mockRecipe.craft).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          true,
          expect.any(Boolean),
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('hasNearbyFurnace returns true when furnace is at player position', () => {
      // Player at (0,0,0); chunk (0,0); block at idx 0 = FURNACE
      const furnaceIdx = blockTypeToIndex('FURNACE')
      const mockChunkManager = createMockChunkManagerLayer({
        getChunk: () => {
          const blocks = new Uint8Array(256 * 16 * 16)
          blocks[0] = furnaceIdx
          return Effect.succeed({ coord: { x: 0, z: 0 }, blocks, fluid: Option.none() })
        },
      })

      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('recipe-a'))

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = InventoryRendererLive.pipe(
        Layer.provide(mockDom.MockDomLayer),
        Layer.provide(mockInventory.MockInventoryLayer),
        Layer.provide(mockHotbar.MockHotbarLayer),
        Layer.provide(mockRecipe.MockRecipeLayer),
        Layer.provide(createMockFurnaceLayer().MockFurnaceLayer),
        Layer.provide(createMockGameStateLayer().MockGameStateLayer),
        Layer.provide(mockChunkManager.MockChunkManagerLayer),
      )

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        yield* renderer.craftSelectedRecipe()
        // craft was called with hasFurnaceAccess = true
        expect(mockRecipe.craft).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.any(Boolean),
          true,
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('hasCraftingTable returns false when getChunk fails for all positions', () => {
      // getChunk fails → getChunkOrNone returns Option.none() → scanNearbyBlock skips
      const mockChunkManager = createMockChunkManagerLayer({
        getChunk: (coord) => Effect.fail(new ChunkError({ chunkCoord: coord, reason: 'chunk load failed' })),
      })

      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('recipe-a'))

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = InventoryRendererLive.pipe(
        Layer.provide(mockDom.MockDomLayer),
        Layer.provide(mockInventory.MockInventoryLayer),
        Layer.provide(mockHotbar.MockHotbarLayer),
        Layer.provide(mockRecipe.MockRecipeLayer),
        Layer.provide(createMockFurnaceLayer().MockFurnaceLayer),
        Layer.provide(createMockGameStateLayer().MockGameStateLayer),
        Layer.provide(mockChunkManager.MockChunkManagerLayer),
      )

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        // craftSelectedRecipe must not throw even though all chunks fail to load
        const result = yield* renderer.craftSelectedRecipe()
        expect(typeof result).toBe('boolean')
        // hasTableAccess = false because no chunk could be read
        expect(mockRecipe.craft).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          false,
          false,
        )
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
