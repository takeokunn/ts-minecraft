import { Array as Arr, Cause, Effect, Option } from 'effect'
import { blockTypeToIndex, DEFAULT_PLAYER_ID, RecipeId, SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import type { ChunkManagerService } from '@ts-minecraft/world'
import type { GameStateService } from '@ts-minecraft/game'
import type { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import type { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import type { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import type { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
import type { XPService } from '@ts-minecraft/entity/application/xp-service'
import type { InventoryItem } from '@ts-minecraft/core'
import type { InventoryRendererService } from '@ts-minecraft/presentation'
import { scanNearbyBlock } from '@ts-minecraft/app/main/qa-spatial'

export const getInventorySnapshot = (inventoryService: InventoryService) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const slots = yield* inventoryService.getAllSlots()
      return Arr.map(slots, (slot, index) => {
        const s = Option.getOrNull(slot)
        if (s === null) return null
        // Expose the full stack identity, not just type+count: anvil renames set
        // customName, tools carry durability, and enchanting adds enchantments —
        // debugging those flows needs all three visible, not inferred.
        return {
          slot: index,
          itemType: s.itemType,
          count: s.count,
          durability: s.durability ?? null,
          ...(s.customName !== undefined ? { customName: s.customName } : {}),
          ...(s.enchantments !== undefined && s.enchantments.length > 0
            ? { enchantments: s.enchantments.map((e) => ({ type: e.type, level: e.level })) }
            : {}),
        }
      })
    }),
  )

export const openInventoryForQA = (inventoryRenderer: InventoryRendererService) =>
  Effect.runPromise(inventoryRenderer.toggle())

// Grants raw XP so playtests can exercise the XP-gated flows — anvil
// repair/rename and enchanting-table — without grinding mobs/ore first.
// Returns the resulting {level, totalXP} so tests can assert the grant landed.
export const grantXpForQA = (xpService: XPService, amount: number) =>
  Effect.runPromise(xpService.addXP(amount))

// Grants an arbitrary item without staging blocks in the world — playtests of
// crafting/eating/planting flows shouldn't need to mine their inputs first.
export const giveItemForQA = (
  inventoryService: InventoryService,
  itemType: InventoryItem,
  count: number,
) =>
  Effect.runPromise(
    inventoryService.addBlock(itemType, Math.max(1, Math.floor(count))).pipe(
      Effect.as(true),
      Effect.catchAll(() => Effect.succeed(false)),
    ),
  )

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
