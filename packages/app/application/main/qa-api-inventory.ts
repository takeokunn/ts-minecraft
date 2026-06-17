import { Array as Arr, Cause, Effect, Option } from 'effect'
import { blockTypeToIndex, DEFAULT_PLAYER_ID, RecipeId, SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory'
import type { ChunkManagerService } from '@ts-minecraft/world'
import type { GameStateService } from '@ts-minecraft/game'
import type { FurnaceService, HotbarService, InventoryService, RecipeService } from '@ts-minecraft/inventory'
import type { InventoryItem } from '@ts-minecraft/core'
import type { InventoryRendererService } from '@ts-minecraft/presentation'
import { scanNearbyBlock } from '@ts-minecraft/app/main/qa-spatial'

export const getInventorySnapshot = (inventoryService: InventoryService) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const slots = yield* inventoryService.getAllSlots()
      return Arr.map(slots, (slot, index) => {
        const s = Option.getOrNull(slot)
        return s !== null ? { slot: index, itemType: s.itemType, count: s.count } : null
      })
    }),
  )

export const openInventoryForQA = (inventoryRenderer: InventoryRendererService) =>
  Effect.runPromise(inventoryRenderer.toggle())

export const moveItemToHotbar = (
  inventoryService: InventoryService,
  hotbarService: HotbarService,
  itemType: InventoryItem,
  hotbarIndex: number,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const slots = yield* inventoryService.getAllSlots()
    const fromIndexOpt = Arr.findFirstIndex(slots, (slot) => Option.exists(slot, (s) => s.itemType === itemType))
    const fromIndex = Option.getOrElse(fromIndexOpt, () => -1)
    if (fromIndex < 0) return false
    yield* inventoryService.moveStack(SlotIndex.make(fromIndex), SlotIndex.make(HOTBAR_START + hotbarIndex))
    yield* hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex))
    return true
  }))

export const selectHotbarSlot = (hotbarService: HotbarService, hotbarIndex: number) =>
  Effect.runPromise(hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex)))

export const getRecipeButtons = (recipeService: RecipeService) =>
  Arr.map(recipeService.getAllRecipes(), (recipe) => recipe.id)

export const craftRecipeForQA = (
  inventoryService: InventoryService,
  inventoryRenderer: InventoryRendererService,
  recipeService: RecipeService,
  furnaceService: FurnaceService,
  gameState: GameStateService,
  chunkManagerService: ChunkManagerService,
  recipeId: string,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const getChunkOrNone = (coord: { readonly x: number; readonly z: number }) =>
      chunkManagerService.getChunk(coord).pipe(Effect.option)
    const getPlayerPositionForQa = () =>
      gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause((_cause: Cause.Cause<unknown>) => Effect.succeed({ x: 0, y: 0, z: 0 })),
      )
    const scanNearbyCraftingStation = (targetBlockIndex: number): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        yield* inventoryRenderer.isOpen()
        const playerPos = yield* getPlayerPositionForQa()
        return yield* scanNearbyBlock(playerPos, 5, targetBlockIndex, getChunkOrNone)
      })
    const hasTableAccess = yield* scanNearbyCraftingStation(blockTypeToIndex('CRAFTING_TABLE'))
    const hasFurnaceAccess = yield* scanNearbyCraftingStation(blockTypeToIndex('FURNACE'))
    const recipe = recipeService.findById(RecipeId.make(recipeId))
    const isFurnaceRecipe = Option.exists(recipe, (r) => r.station === 'furnace')
    if (isFurnaceRecipe) {
      const furnaceOpt = yield* furnaceService.getNearestFurnaceState()
      const furnaceState = Option.getOrNull(furnaceOpt)
      if (furnaceState !== null && Option.isSome(furnaceState.output)) {
        yield* furnaceService.collectOutput().pipe(Effect.asVoid)
      } else {
        yield* furnaceService.startSmelting(RecipeId.make(recipeId))
      }
    } else {
      yield* recipeService.craft(RecipeId.make(recipeId), inventoryService, hasTableAccess, hasFurnaceAccess)
    }
  }))
