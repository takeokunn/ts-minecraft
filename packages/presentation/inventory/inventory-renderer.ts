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
    scoped: Effect.all([
      InventoryService,
      HotbarService,
      RecipeService,
      FurnaceService,
      GameStateService,
      ChunkManagerService,
      XPService,
      DomOperationsService,
      Ref.make(false),
      Ref.make<ReadonlyArray<Recipe>>([]),
      Ref.make(0),
      Ref.make('Click a recipe to craft it.'),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([inventoryService, hotbarService, recipeService, furnaceService, gameState, chunkManagerService, xpService, dom, isVisibleRef, availableRecipesRef, selectedRecipeIndexRef, statusMessageRef]) => {

      const getChunkOrNone = (coord: { readonly x: number; readonly z: number }) =>
        chunkManagerService.getChunk(coord).pipe(Effect.option)

      const getPlayerPos = () =>
        gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
          Effect.catchAllCause(() => Effect.succeed({ x: 0, y: 0, z: 0 })),
        )

      const hasNearbyCraftingTable = (): Effect.Effect<boolean, never> =>
        getPlayerPos().pipe(
          Effect.flatMap((pos) => scanNearbyBlock(pos, 5, blockTypeToIndex('CRAFTING_TABLE'), getChunkOrNone)),
        )

      const hasNearbyFurnace = (): Effect.Effect<boolean, never> =>
        getPlayerPos().pipe(
          Effect.flatMap((pos) => scanNearbyBlock(pos, 5, blockTypeToIndex('FURNACE'), getChunkOrNone)),
        )

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
        return furnaceService.getNearestFurnaceState().pipe(
          Effect.flatMap((furnaceOpt) => {
            const furnace = Option.getOrNull(furnaceOpt)
            if (furnace === null) return furnaceService.startSmelting(recipeId)
            if (Option.isNone(furnace.output)) return furnaceService.startSmelting(recipeId)
            return furnaceService.collectOutput().pipe(
              Effect.flatMap(({ xp }) => xp > 0 ? xpService.addXP(xp).pipe(Effect.asVoid) : Effect.void),
            )
          }),
        ) as Effect.Effect<void, Error, never>
      }

      return Effect.sync(() => buildOverlayDom(dom)).pipe(
        Effect.flatMap(({ overlayEl, slotEls, craftingListEl, statusEl }) => {
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

        return Effect.acquireRelease(
          Effect.sync(() => {
            Option.getOrNull(overlayEl)?.addEventListener('click', handleDelegatedClick)
          }),
          () => Effect.sync(() => {
            const el = Option.getOrNull(overlayEl)
            if (el !== null) { el.removeEventListener('click', handleDelegatedClick); el.remove() }
          })
        ).pipe(Effect.as({
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
        }))
      })
      )
    })
    ),
  }
) {}
export const InventoryRendererLive = InventoryRendererService.Default
