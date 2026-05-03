import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { expect, vi } from 'vitest'
import { blockTypeToIndex } from '@ts-minecraft/kernel'
import { InventoryRendererService, InventoryRendererLive } from '@ts-minecraft/app/presentation/inventory/inventory-renderer'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import {
  createMockDomLayer,
  createMockInventoryLayer,
  createMockHotbarLayer,
  createMockRecipeLayer,
  createMockFurnaceLayer,
  createMockGameStateLayer,
  createMockChunkManagerLayer,
  makeRecipe,
} from './inventory-renderer-test-utils'

describe('presentation/inventory/inventory-renderer (recipe)', () => {
  describe('hasCraftingTable / hasNearbyFurnace', () => {
    it.scoped('hasCraftingTable returns true when crafting table is at player position', () => {
      // Player at (0,0,0); chunk (0,0); block at idx 0 = CRAFTING_TABLE
      const craftingTableIdx = blockTypeToIndex('CRAFTING_TABLE')
      const MockChunkManagerWithCraftingTable = Layer.succeed(ChunkManagerService, {
        getChunk: () => {
          const blocks = new Uint8Array(256 * 16 * 16)
          blocks[0] = craftingTableIdx
          return Effect.succeed({ coord: { x: 0, z: 0 }, blocks, fluid: Option.none() })
        },
      } as unknown as ChunkManagerService)

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
        Layer.provide(MockChunkManagerWithCraftingTable),
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
      const MockChunkManagerWithFurnace = Layer.succeed(ChunkManagerService, {
        getChunk: () => {
          const blocks = new Uint8Array(256 * 16 * 16)
          blocks[0] = furnaceIdx
          return Effect.succeed({ coord: { x: 0, z: 0 }, blocks, fluid: Option.none() })
        },
      } as unknown as ChunkManagerService)

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
        Layer.provide(MockChunkManagerWithFurnace),
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
      const MockChunkManagerFailing = Layer.succeed(ChunkManagerService, {
        getChunk: () => Effect.fail(new Error('chunk load failed')),
      } as unknown as ChunkManagerService)

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
        Layer.provide(MockChunkManagerFailing),
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
