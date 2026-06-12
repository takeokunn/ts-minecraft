import { Array as Arr, Effect, Either, Option, Ref } from 'effect'
import { InventoryService, HOTBAR_START, type InventorySlot } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/world'
import { XPService } from '@ts-minecraft/entity'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { RecipeId } from '@ts-minecraft/core'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import type { Recipe } from '@ts-minecraft/inventory'
import { SlotIndex } from '@ts-minecraft/core'
import { blockTypeToIndex } from '@ts-minecraft/core'
import { scanNearbyBlock } from '@ts-minecraft/app/main/qa-spatial'

import { buildOverlayDom } from './inventory-renderer-dom'
import { collectAvailableCounts } from './inventory-renderer-helpers'
import { renderSlotElements, renderCraftingList, renderStatusEl } from './inventory-renderer-refresh'
import { buildHandleDelegatedClick } from './inventory-renderer-click-handler'

export class InventoryRendererService extends Effect.Service<InventoryRendererService>()(
  '@minecraft/presentation/InventoryRenderer',
  {
    scoped: Effect.gen(function* () {
      const inventoryService = yield* InventoryService
      const hotbarService = yield* HotbarService
      const recipeService = yield* RecipeService
      const furnaceService = yield* FurnaceService
      const gameState = yield* GameStateService
      const chunkManagerService = yield* ChunkManagerService
      const xpService = yield* XPService
      const dom = yield* DomOperationsService
      const isVisibleRef = yield* Ref.make(false)
      const availableRecipesRef = yield* Ref.make<ReadonlyArray<Recipe>>([])
      const selectedRecipeIndexRef = yield* Ref.make(0)
      const statusMessageRef = yield* Ref.make('Click a recipe to craft it.')

      const getChunkOrNone = (coord: { readonly x: number; readonly z: number }) =>
        chunkManagerService.getChunk(coord).pipe(Effect.option)

      const getPlayerPos = () =>
        gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
          Effect.catchAllCause(() => Effect.succeed({ x: 0, y: 0, z: 0 })),
        )

      const hasNearbyCraftingTable = (): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const pos = yield* getPlayerPos()
          return yield* scanNearbyBlock(pos, 5, blockTypeToIndex('CRAFTING_TABLE'), getChunkOrNone)
        })

      const hasNearbyFurnace = (): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const pos = yield* getPlayerPos()
          return yield* scanNearbyBlock(pos, 5, blockTypeToIndex('FURNACE'), getChunkOrNone)
        })

      const refreshCraftingState = (slots: ReadonlyArray<InventorySlot>): Effect.Effect<readonly [ReadonlyArray<Recipe>, number], never> =>
        Effect.gen(function* () {
          const hasTableAccess = yield* hasNearbyCraftingTable()
          const hasFurnaceAccess = yield* hasNearbyFurnace()
          const craftable = recipeService.findCraftable(collectAvailableCounts(slots), hasTableAccess, hasFurnaceAccess)
          const nextSelectedIndex = yield* Ref.modify(selectedRecipeIndexRef, (current) => {
            if (craftable.length === 0) return [0, 0] as const
            const clamped = Math.max(0, Math.min(current, craftable.length - 1))
            return [clamped, clamped] as const
          })
          yield* Ref.set(availableRecipesRef, craftable)
          return [craftable, nextSelectedIndex] as const
        })

      const performRecipe = (
        recipeId: RecipeId,
        hasTableAccess: boolean,
        hasFurnaceAccess: boolean,
      ): Effect.Effect<void, Error, never> => {
        const recipe = Option.getOrNull(recipeService.findById(recipeId))
        if (recipe === null) return recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess)
        if (recipe.station !== 'furnace') return recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess)
        return Effect.gen(function* () {
          const furnaceOpt = yield* furnaceService.getNearestFurnaceState()
          const furnace = Option.getOrNull(furnaceOpt)
          if (furnace === null) { yield* furnaceService.startSmelting(recipeId); return }
          if (Option.isNone(furnace.output)) { yield* furnaceService.startSmelting(recipeId); return }
          const { xp } = yield* furnaceService.collectOutput()
          if (xp > 0) yield* xpService.addXP(xp)
        }) as Effect.Effect<void, Error, never>
      }

      const { overlayEl, slotEls, craftingListEl, statusEl } = yield* Effect.sync(() => buildOverlayDom(dom))
      /* c8 ignore next */
      const handleDelegatedClick = buildHandleDelegatedClick({
        hasNearbyCraftingTable,
        hasNearbyFurnace,
        performRecipe,
        hotbarService,
        inventoryService,
        statusMessageRef,
        refreshSlots: () => refreshSlots(),
      })

      const refreshSlots = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const allSlots = yield* inventoryService.getAllSlots()
          const selectedSlot = yield* hotbarService.getSelectedSlot()
          const [craftableRecipes, selectedRecipeIndex] = yield* refreshCraftingState(allSlots)
          const statusMessage = yield* Ref.get(statusMessageRef)

          /* c8 ignore start */
          yield* Effect.sync(() => {
            const selectedHotbarIdx = HOTBAR_START + SlotIndex.toNumber(selectedSlot)
            renderSlotElements(slotEls, allSlots, selectedHotbarIdx)
            renderCraftingList(dom, craftingListEl, craftableRecipes, selectedRecipeIndex)
            renderStatusEl(statusEl, statusMessage)
          })
          /* c8 ignore stop */
        })

      yield* Effect.sync(() => {
        Option.getOrNull(overlayEl)?.addEventListener('click', handleDelegatedClick)
      })
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        const el = Option.getOrNull(overlayEl)
        if (el !== null) { el.removeEventListener('click', handleDelegatedClick); el.remove() }
      }))

      return {
        toggle: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const next = yield* Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current])
            yield* Effect.sync(() => {
              const el = Option.getOrNull(overlayEl)
              if (el !== null) el.style.display = next ? 'block' : 'none'
            })
            if (next) yield* refreshSlots()
            return next
          }),

        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        update: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const isVisible = yield* Ref.get(isVisibleRef)
            if (isVisible) yield* refreshSlots()
          }),

        cycleRecipes: (delta: number): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const recipes = yield* Ref.get(availableRecipesRef)
            if (recipes.length === 0) return
            yield* Ref.update(selectedRecipeIndexRef, (current) => {
              const next = (current + delta) % recipes.length
              return next < 0 ? next + recipes.length : next
            })
            yield* refreshSlots()
          }),

        craftSelectedRecipe: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const recipes = yield* Ref.get(availableRecipesRef)
            const selectedRecipeIndex = yield* Ref.get(selectedRecipeIndexRef)
            const recipe = Option.getOrNull(Arr.get(recipes, selectedRecipeIndex))
            if (recipe === null) {
              yield* Ref.set(statusMessageRef, 'No craftable recipe selected.')
              yield* refreshSlots()
              return false
            }

            const hasTableAccess = yield* hasNearbyCraftingTable()
            const hasFurnaceAccess = yield* hasNearbyFurnace()
            const result = yield* performRecipe(recipe.id, hasTableAccess, hasFurnaceAccess).pipe(Effect.either)
            const crafted = Either.isRight(result)

            yield* Ref.set(
              statusMessageRef,
              crafted
                ? `Crafted ${recipe.output.count} ${recipe.output.itemType}.`
                : 'Crafting failed.',
            )
            yield* refreshSlots()
            return crafted
          }),
      }
    }),
  }
) {}
export const InventoryRendererLive = InventoryRendererService.Default
