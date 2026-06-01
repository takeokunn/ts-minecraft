import { describe,it } from '@effect/vitest'
import { InventoryRendererService } from '@ts-minecraft/presentation/inventory/inventory-renderer'
import { RecipeId } from '@ts-minecraft/core'
import { Effect } from 'effect'
import { RecipeError } from '@ts-minecraft/inventory/domain/errors'
import { expect } from 'vitest'
import {
buildTestLayer,
createMockDomLayer,
createMockHotbarLayer,
createMockInventoryLayer,
createMockRecipeLayer,
makeRecipe,
} from './inventory-renderer-test-utils'

describe('presentation/inventory/inventory-renderer (recipe)', () => {
  describe('craftSelectedRecipe', () => {
    it.scoped('returns false when no recipes are available', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        const result = yield* renderer.craftSelectedRecipe()
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('returns false when crafting fails', () => {
      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('recipe-a'))
      mockRecipe.craft.mockReturnValue(Effect.fail(new RecipeError({ operation: 'craft', cause: 'Not enough materials' })))

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        const result = yield* renderer.craftSelectedRecipe()
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('refreshSlots is called after failed craft', () => {
      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('recipe-a'))
      mockRecipe.craft.mockReturnValue(Effect.fail(new RecipeError({ operation: 'craft', cause: 'Not enough materials' })))

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        yield* renderer.craftSelectedRecipe()
        expect(mockInventory.getAllSlots.mock.calls.length).toBeGreaterThan(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('returns true when crafting succeeds', () => {
      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('recipe-a'))

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        const result = yield* renderer.craftSelectedRecipe()
        expect(result).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('calls craft with the selected recipe id', () => {
      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('recipe-special'))

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        yield* renderer.craftSelectedRecipe()
        expect(mockRecipe.craft).toHaveBeenCalledWith(
          RecipeId.make('recipe-special'),
          expect.anything(),
          expect.any(Boolean),
          expect.any(Boolean),
        )
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('refreshSlots is called after successful craft', () => {
      const mockRecipe = createMockRecipeLayer()
      mockRecipe.recipes.push(makeRecipe('recipe-a'))

      const mockDom = createMockDomLayer()
      const mockInventory = createMockInventoryLayer()
      const mockHotbar = createMockHotbarLayer()
      const TestLayer = buildTestLayer(mockDom, mockInventory, mockHotbar, mockRecipe)

      return Effect.gen(function* () {
        const renderer = yield* InventoryRendererService
        yield* renderer.toggle()
        const callsBefore = mockInventory.getAllSlots.mock.calls.length
        yield* renderer.craftSelectedRecipe()
        expect(mockInventory.getAllSlots.mock.calls.length).toBeGreaterThan(callsBefore)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
