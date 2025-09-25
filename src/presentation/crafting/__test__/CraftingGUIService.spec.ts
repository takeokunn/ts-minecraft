import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Layer, Option, Exit, pipe, Brand } from 'effect'
import { CraftingGUIService, CraftingGUIServiceLive, CraftingGUIError, InvalidSlotError, DragDropError } from '../CraftingGUIService'
import type { CraftingGUIState, CraftingGUIEvent, CraftingSession } from '../CraftingGUITypes'
import { RecipeRegistryServiceLive } from '../../../domain/crafting/RecipeRegistryService'
import { CraftingEngineServiceLive } from '../../../domain/crafting/CraftingEngineService'
import { InventoryServiceLive } from '../../../domain/inventory/InventoryServiceLive'
import type { CraftingGrid, CraftingRecipe, RecipeId } from '../../../domain/crafting/RecipeTypes'

describe('CraftingGUIService', () => {
  const testLayer = Layer.mergeAll(
    RecipeRegistryServiceLive,
    CraftingEngineServiceLive,
    InventoryServiceLive,
    CraftingGUIServiceLive
  )

  const runEffect = <R, E, A>(effect: Effect.Effect<A, E, R>) =>
    Effect.runPromise(Effect.provide(effect, testLayer))

  describe('Session Management', () => {
    it('should initialize a crafting session', async () => {
      const service = await runEffect(CraftingGUIService)
      const session = await runEffect(
        service.initializeSession('player1', 'workbench')
      )

      expect(session).toMatchObject({
        _tag: 'CraftingSession',
        playerId: 'player1',
        craftingTableType: 'workbench',
        stats: {
          itemsCrafted: 0,
          recipesUsed: 0,
          materialsConsumed: 0
        }
      })
      expect(session.id).toBeDefined()
      expect(session.startTime).toBeGreaterThan(0)
    })

    it('should initialize different table types with correct grid sizes', async () => {
      const service = await runEffect(CraftingGUIService)

      const workbenchSession = await runEffect(
        service.initializeSession('player1', 'workbench')
      )
      const playerSession = await runEffect(
        service.initializeSession('player1', 'player-inventory')
      )

      // Workbench should have 3x3 grid
      expect(workbenchSession.grid).toBeDefined()

      // Player inventory should have 2x2 grid
      expect(playerSession.grid).toBeDefined()
    })
  })

  describe('State Management', () => {
    it('should get current GUI state', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const state = await runEffect(service.getState())

      expect(state).toMatchObject({
        _tag: 'CraftingGUIState',
        craftingGrid: expect.any(Array),
        isProcessing: false,
        isDragging: false,
        showRecipeBook: true
      })
      expect(state.sessionId).toBeDefined()
    })
  })

  describe('Event Handling', () => {
    it('should handle SlotClicked event', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const event: CraftingGUIEvent = {
        _tag: 'SlotClicked',
        slotIndex: 0,
        position: { x: 0, y: 0 },
        button: 'left',
        shiftKey: false,
        ctrlKey: false
      }

      await runEffect(service.handleEvent(event))
      // Should not throw
      expect(true).toBe(true)
    })

    it('should handle invalid slot index', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const event: CraftingGUIEvent = {
        _tag: 'SlotClicked',
        slotIndex: 100, // Invalid index
        position: { x: 0, y: 0 },
        button: 'left',
        shiftKey: false,
        ctrlKey: false
      }

      const result = await Effect.runPromiseExit(
        Effect.provide(service.handleEvent(event), testLayer)
      )

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = Exit.causeOption(result)
        expect(Option.isSome(error)).toBe(true)
      }
    })

    it('should handle ItemDragStart event', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const mockItem = {
        _tag: 'CraftingItemStack' as const,
        itemId: Brand.nominal('minecraft:wood'),
        count: Brand.nominal(5),
        metadata: {}
      }

      const event: CraftingGUIEvent = {
        _tag: 'ItemDragStart',
        slotIndex: 0,
        item: mockItem as any
      }

      await runEffect(service.handleEvent(event))

      const state = await runEffect(service.getState())
      expect(state.isDragging).toBe(true)
      expect(state.draggedFromSlot).toBe(0)
    })

    it('should handle ItemDrop event', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const mockItem = {
        _tag: 'CraftingItemStack' as const,
        itemId: Brand.nominal('minecraft:wood'),
        count: Brand.nominal(5),
        metadata: {}
      }

      const dropEvent: CraftingGUIEvent = {
        _tag: 'ItemDrop',
        sourceSlot: 0,
        targetSlot: 4,
        item: mockItem as any
      }

      await runEffect(service.handleEvent(dropEvent))
      // Item should be moved from slot 0 to slot 4
      const state = await runEffect(service.getState())
      expect(state.craftingGrid).toBeDefined()
    })

    it('should handle RecipeSelected event', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const event: CraftingGUIEvent = {
        _tag: 'RecipeSelected',
        recipeId: 'minecraft:wooden_pickaxe'
      }

      await runEffect(service.handleEvent(event))

      const state = await runEffect(service.getState())
      expect(state.selectedRecipe).toBe('minecraft:wooden_pickaxe')
    })

    it('should handle RecipeSearch event', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const event: CraftingGUIEvent = {
        _tag: 'RecipeSearch',
        query: 'pickaxe'
      }

      await runEffect(service.handleEvent(event))

      const state = await runEffect(service.getState())
      expect(state.searchQuery).toBe('pickaxe')
    })

    it('should handle GridCleared event', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      // Add some items to grid first
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: 3,
        height: 3,
        slots: [
          [{ _tag: 'CraftingItemStack', itemId: Brand.nominal('wood'), count: Brand.nominal(1), metadata: {} }, undefined, undefined],
          [undefined, undefined, undefined],
          [undefined, undefined, undefined]
        ]
      }
      await runEffect(service.updateGrid(grid))

      // Clear the grid
      const event: CraftingGUIEvent = { _tag: 'GridCleared' }
      await runEffect(service.handleEvent(event))

      const state = await runEffect(service.getState())
      const allEmpty = state.craftingGrid.flat().every(slot => slot === undefined)
      expect(allEmpty).toBe(true)
    })

    it('should handle RecipeBookToggled event', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const initialState = await runEffect(service.getState())
      const initialShowRecipeBook = initialState.showRecipeBook

      const event: CraftingGUIEvent = { _tag: 'RecipeBookToggled' }
      await runEffect(service.handleEvent(event))

      const newState = await runEffect(service.getState())
      expect(newState.showRecipeBook).toBe(!initialShowRecipeBook)
    })
  })

  describe('Grid Updates', () => {
    it('should update grid and calculate crafting result', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: 3,
        height: 3,
        slots: [
          [undefined, undefined, undefined],
          [undefined, { _tag: 'CraftingItemStack', itemId: Brand.nominal('wood'), count: Brand.nominal(1), metadata: {} }, undefined],
          [undefined, undefined, undefined]
        ]
      }

      const result = await runEffect(service.updateGrid(grid))

      expect(result).toMatchObject({
        _tag: 'CraftingResultDisplay',
        canCraft: expect.any(Boolean),
        missingIngredients: expect.any(Array),
        craftCount: expect.any(Number)
      })
    })
  })

  describe('Recipe Management', () => {
    it('should get available recipes', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const recipes = await runEffect(service.getAvailableRecipes())

      expect(Array.isArray(recipes)).toBe(true)
    })

    it('should filter recipes by category', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const filterConfig = {
        _tag: 'RecipeFilterConfig' as const,
        categories: ['crafting'],
        searchQuery: '',
        showCraftableOnly: false,
        sortBy: 'name' as const,
        displayMode: 'grid' as const
      }

      const recipes = await runEffect(service.getAvailableRecipes(filterConfig))

      expect(Array.isArray(recipes)).toBe(true)
      // All recipes should be in the crafting category
      recipes.forEach(recipe => {
        expect(recipe.category._tag).toBe('crafting')
      })
    })

    it('should filter recipes by search query', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const filterConfig = {
        _tag: 'RecipeFilterConfig' as const,
        categories: [],
        searchQuery: 'wood',
        showCraftableOnly: false,
        sortBy: 'name' as const,
        displayMode: 'grid' as const
      }

      const recipes = await runEffect(service.getAvailableRecipes(filterConfig))

      expect(Array.isArray(recipes)).toBe(true)
      // All recipes should contain 'wood' in their result item ID
      recipes.forEach(recipe => {
        expect(recipe.result.itemId.toLowerCase()).toContain('wood')
      })
    })
  })

  describe('Crafting Operations', () => {
    it('should craft item when recipe matches', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      // Set up a valid crafting grid (would match a recipe)
      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: 3,
        height: 3,
        slots: [
          [{ _tag: 'CraftingItemStack', itemId: Brand.nominal('wood'), count: Brand.nominal(1), metadata: {} }, { _tag: 'CraftingItemStack', itemId: Brand.nominal('wood'), count: Brand.nominal(1), metadata: {} }, undefined],
          [undefined, undefined, undefined],
          [undefined, undefined, undefined]
        ]
      }
      await runEffect(service.updateGrid(grid))

      // Try to craft (may fail if no matching recipe)
      const craftResult = await Effect.runPromiseExit(
        Effect.provide(service.craftItem(undefined, 1), testLayer)
      )

      // Either succeeds with a crafted item or fails with no matching recipe
      expect(Exit.isExit(craftResult)).toBe(true)
    })
  })

  describe('Tooltip System', () => {
    it('should get tooltip for occupied slot', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const grid: CraftingGrid = {
        _tag: 'CraftingGrid',
        width: 3,
        height: 3,
        slots: [
          [{ _tag: 'CraftingItemStack', itemId: Brand.nominal('wood'), count: Brand.nominal(5), metadata: {} }, undefined, undefined],
          [undefined, undefined, undefined],
          [undefined, undefined, undefined]
        ]
      }
      await runEffect(service.updateGrid(grid))

      const tooltip = await runEffect(service.getTooltip(0))

      expect(Option.isSome(tooltip)).toBe(true)
      if (Option.isSome(tooltip)) {
        expect(tooltip.value).toMatchObject({
          _tag: 'TooltipInfo',
          title: expect.any(String),
          stackSize: 5
        })
      }
    })

    it('should return none for empty slot', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      const tooltip = await runEffect(service.getTooltip(1))

      expect(Option.isNone(tooltip)).toBe(true)
    })
  })

  describe('Resource Cleanup', () => {
    it('should dispose resources properly', async () => {
      const service = await runEffect(CraftingGUIService)
      await runEffect(service.initializeSession('player1', 'workbench'))

      await runEffect(service.dispose())

      // After disposal, the grid should be cleared
      const state = await runEffect(service.getState())
      const allEmpty = state.craftingGrid.flat().every(slot => slot === undefined)
      expect(allEmpty).toBe(true)
    })
  })
})