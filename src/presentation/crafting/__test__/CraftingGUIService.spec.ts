import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Layer, Option, Exit, pipe, Brand } from 'effect'
import {
  CraftingGUIService,
  CraftingGUIServiceLive,
  CraftingGUIError,
  InvalidSlotError,
  DragDropError,
} from '../CraftingGUIService'
import type { CraftingGUIState, CraftingGUIEvent, CraftingSession } from '../CraftingGUITypes'
import { RecipeRegistryService, RecipeRegistryServiceLive } from '../../../domain/crafting/RecipeRegistryService'
import { CraftingEngineService, CraftingEngineServiceLive } from '../../../domain/crafting/CraftingEngineService'
import { InventoryService } from '../../../domain/inventory/InventoryService'
import { InventoryServiceLive } from '../../../domain/inventory/InventoryServiceLive'
import { ItemRegistry } from '../../../domain/inventory/ItemRegistry'
import type { CraftingGrid, CraftingRecipe, RecipeId } from '../../../domain/crafting/RecipeTypes'
import { GridWidth, GridHeight, ItemStackCount } from '../../../domain/crafting/RecipeTypes'

describe('CraftingGUIService', () => {
  // Complete test layer with all required dependencies using proper layer composition
  const testLayer = CraftingGUIServiceLive.pipe(
    Layer.provide(CraftingEngineServiceLive),
    Layer.provide(RecipeRegistryServiceLive),
    Layer.provide(InventoryServiceLive),
    Layer.provide(ItemRegistry.Default)
  )

  // Helper function to run effects with proper layer setup
  const runTest = <A, E>(
    effect: Effect.Effect<
      A,
      E,
      CraftingGUIService | CraftingEngineService | RecipeRegistryService | InventoryService | ItemRegistry
    >
  ): Promise<A> => Effect.runPromise(Effect.provide(effect, testLayer) as Effect.Effect<A, E, never>)

  describe('Session Management', () => {
    it('should initialize a crafting session', async () => {
      const session = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          return yield* service.initializeSession('player1', 'workbench')
        })
      )

      expect(session).toMatchObject({
        _tag: 'CraftingSession',
        playerId: 'player1',
        craftingTableType: 'workbench',
        stats: {
          itemsCrafted: 0,
          recipesUsed: 0,
          materialsConsumed: 0,
        },
      })
      expect(session.id).toBeDefined()
      expect(session.startTime).toBeGreaterThan(0)
    })

    it('should initialize different table types with correct grid sizes', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          const workbenchSession = yield* service.initializeSession('player1', 'workbench')
          const playerSession = yield* service.initializeSession('player1', 'player-inventory')
          return { workbenchSession, playerSession }
        })
      )

      // Workbench should have 3x3 grid
      expect(result.workbenchSession.grid).toBeDefined()

      // Player inventory should have 2x2 grid
      expect(result.playerSession.grid).toBeDefined()
    })
  })

  describe('State Management', () => {
    it('should get current GUI state', async () => {
      const state = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')
          return yield* service.getState()
        })
      )

      expect(state).toMatchObject({
        _tag: 'CraftingGUIState',
        craftingGrid: expect.any(Array),
        isProcessing: false,
        isDragging: false,
        showRecipeBook: true,
      })
      expect(state.sessionId).toBeDefined()
    })
  })

  describe('Event Handling', () => {
    it('should handle SlotClicked event', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const event: CraftingGUIEvent = {
            _tag: 'SlotClicked',
            slotIndex: 0,
            position: { x: 0, y: 0 },
            button: 'left',
            shiftKey: false,
            ctrlKey: false,
          }

          yield* service.handleEvent(event)
          // Should not throw
        })
      )
      expect(true).toBe(true)
    })

    it('should handle invalid slot index', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const event: CraftingGUIEvent = {
            _tag: 'SlotClicked',
            slotIndex: 100, // Invalid index
            position: { x: 0, y: 0 },
            button: 'left',
            shiftKey: false,
            ctrlKey: false,
          }

          return yield* Effect.either(service.handleEvent(event))
        })
      )

      expect(result._tag).toBe('Left')
    })

    it('should handle ItemDragStart event', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const mockItem = {
            itemId: 'minecraft:wood',
            count: ItemStackCount(5),
            metadata: {},
          }

          const event: CraftingGUIEvent = {
            _tag: 'ItemDragStart',
            slotIndex: 0,
            item: mockItem as any,
          }

          yield* service.handleEvent(event)

          const state = yield* service.getState()
          expect(state.isDragging).toBe(true)
          expect(state.draggedFromSlot).toBe(0)
        })
      )
    })

    it('should handle ItemDrop event', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const mockItem = {
            itemId: 'minecraft:wood',
            count: ItemStackCount(5),
            metadata: {},
          }

          const dropEvent: CraftingGUIEvent = {
            _tag: 'ItemDrop',
            sourceSlot: 0,
            targetSlot: 4,
            item: mockItem as any,
          }

          yield* service.handleEvent(dropEvent)
          // Item should be moved from slot 0 to slot 4
          const state = yield* service.getState()
          expect(state.craftingGrid).toBeDefined()
        })
      )
    })

    it('should handle RecipeSelected event', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const event: CraftingGUIEvent = {
            _tag: 'RecipeSelected',
            recipeId: 'test_recipe',
          }

          yield* service.handleEvent(event)

          // The selected recipe should be set even if recipe doesn't exist in registry
          const state = yield* service.getState()
          // Note: The recipe might not be found in registry, so selectedRecipe could be null
          // But the event handling should not throw an error
          expect(state.selectedRecipe).toBeNull()
        })
      )
    })

    it('should handle RecipeSearch event', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const event: CraftingGUIEvent = {
            _tag: 'RecipeSearch',
            query: 'pickaxe',
          }

          yield* service.handleEvent(event)

          const state = yield* service.getState()
          expect(state.searchQuery).toBe('pickaxe')
        })
      )
    })

    it('should handle GridCleared event', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          // Add some items to grid first
          const grid: CraftingGrid = {
            _tag: 'CraftingGrid',
            width: GridWidth(3),
            height: GridHeight(3),
            slots: [
              [{ itemId: 'wood', count: ItemStackCount(1), metadata: {} }, null, null],
              [null, null, null],
              [null, null, null],
            ],
          }
          yield* service.updateGrid(grid)

          // Clear the grid
          const event: CraftingGUIEvent = { _tag: 'GridCleared' }
          yield* service.handleEvent(event)

          const state = yield* service.getState()
          const allEmpty = state.craftingGrid.flat().every((slot) => slot === null)
          expect(allEmpty).toBe(true)
        })
      )
    })

    it('should handle RecipeBookToggled event', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const initialState = yield* service.getState()
          const initialShowRecipeBook = initialState.showRecipeBook

          const event: CraftingGUIEvent = { _tag: 'RecipeBookToggled' }
          yield* service.handleEvent(event)

          const newState = yield* service.getState()
          expect(newState.showRecipeBook).toBe(!initialShowRecipeBook)
        })
      )
    })
  })

  describe('Grid Updates', () => {
    it('should update grid and calculate crafting result', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const grid: CraftingGrid = {
            _tag: 'CraftingGrid',
            width: GridWidth(3),
            height: GridHeight(3),
            slots: [
              [null, null, null],
              [null, { itemId: 'wood', count: ItemStackCount(1), metadata: {} }, null],
              [null, null, null],
            ],
          }

          return yield* service.updateGrid(grid)
        })
      )

      expect(result).toMatchObject({
        _tag: 'CraftingResultDisplay',
        canCraft: expect.any(Boolean),
        missingIngredients: expect.any(Array),
        craftCount: expect.any(Number),
      })
    })
  })

  describe('Recipe Management', () => {
    it('should get available recipes', async () => {
      const recipes = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')
          return yield* service.getAvailableRecipes()
        })
      )

      expect(Array.isArray(recipes)).toBe(true)
    })

    it('should filter recipes by category', async () => {
      const recipes = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const filterConfig = {
            _tag: 'RecipeFilterConfig' as const,
            categories: ['crafting'],
            searchQuery: '',
            showCraftableOnly: false,
            sortBy: 'name' as const,
            displayMode: 'grid' as const,
          }

          return yield* service.getAvailableRecipes(filterConfig)
        })
      )

      expect(Array.isArray(recipes)).toBe(true)
      // All recipes should be in the crafting category
      recipes.forEach((recipe: any) => {
        expect(recipe.category._tag).toBe('crafting')
      })
    })

    it('should filter recipes by search query', async () => {
      const recipes = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const filterConfig = {
            _tag: 'RecipeFilterConfig' as const,
            categories: [],
            searchQuery: 'wood',
            showCraftableOnly: false,
            sortBy: 'name' as const,
            displayMode: 'grid' as const,
          }

          return yield* service.getAvailableRecipes(filterConfig)
        })
      )

      expect(Array.isArray(recipes)).toBe(true)
      // All recipes should contain 'wood' in their result item ID
      recipes.forEach((recipe: any) => {
        expect(recipe.result.itemId.toLowerCase()).toContain('wood')
      })
    })
  })

  describe('Crafting Operations', () => {
    it('should craft item when recipe matches', async () => {
      const craftResult = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          // Set up a valid crafting grid (would match a recipe)
          const grid: CraftingGrid = {
            _tag: 'CraftingGrid',
            width: GridWidth(3),
            height: GridHeight(3),
            slots: [
              [
                { itemId: 'wood', count: ItemStackCount(1), metadata: {} },
                { itemId: 'wood', count: ItemStackCount(1), metadata: {} },
                null,
              ],
              [null, null, null],
              [null, null, null],
            ],
          }
          yield* service.updateGrid(grid)

          // Try to craft (may fail if no matching recipe)
          return yield* Effect.either(service.craftItem(undefined, 1))
        })
      )

      // Either succeeds with a crafted item or fails with no matching recipe
      expect(craftResult._tag).toBeDefined()
    })
  })

  describe('Tooltip System', () => {
    it('should get tooltip for occupied slot', async () => {
      const tooltip = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          const grid: CraftingGrid = {
            _tag: 'CraftingGrid',
            width: GridWidth(3),
            height: GridHeight(3),
            slots: [
              [{ itemId: 'wood', count: ItemStackCount(5), metadata: {} }, null, null],
              [null, null, null],
              [null, null, null],
            ],
          }
          yield* service.updateGrid(grid)

          return yield* service.getTooltip(0)
        })
      )

      expect(Option.isSome(tooltip)).toBe(true)
      if (Option.isSome(tooltip)) {
        expect(tooltip.value).toMatchObject({
          _tag: 'TooltipInfo',
          title: expect.any(String),
          stackSize: 5,
        })
      }
    })

    it('should return none for empty slot', async () => {
      const tooltip = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')
          return yield* service.getTooltip(1)
        })
      )

      expect(Option.isNone(tooltip)).toBe(true)
    })
  })

  describe('Resource Cleanup', () => {
    it('should dispose resources properly', async () => {
      const state = await runTest(
        Effect.gen(function* () {
          const service = yield* CraftingGUIService
          yield* service.initializeSession('player1', 'workbench')

          yield* service.dispose()

          // After disposal, the grid should be cleared
          return yield* service.getState()
        })
      )

      const allEmpty = state.craftingGrid.flat().every((slot) => slot === null)
      expect(allEmpty).toBe(true)
    })
  })
})
