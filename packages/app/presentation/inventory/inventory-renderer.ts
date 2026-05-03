import { Array as Arr, Cause, Effect, Either, Option, Ref } from 'effect'
import { InventoryService, INVENTORY_SIZE, HOTBAR_START, type InventorySlot } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import { RecipeId } from '@ts-minecraft/kernel'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import type { Recipe } from '@ts-minecraft/inventory'
import { SlotIndex } from '@ts-minecraft/kernel'
import { blockTypeToIndex } from '@ts-minecraft/kernel'
import { scanNearbyBlock } from '@ts-minecraft/app/main/qa-spatial'

import { buildOverlayDom } from './inventory-renderer-dom'
import { collectAvailableCounts } from './inventory-renderer-helpers'
import { renderSlotElements, renderCraftingList, renderStatusEl } from './inventory-renderer-refresh'

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
      DomOperationsService,
      Ref.make(false),
      Ref.make<ReadonlyArray<Recipe>>([]),
      Ref.make(0),
      Ref.make('Click a recipe to craft it.'),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([inventoryService, hotbarService, recipeService, furnaceService, gameState, chunkManagerService, dom, isVisibleRef, availableRecipesRef, selectedRecipeIndexRef, statusMessageRef]) => {

      const getChunkOrNone = (coord: { readonly x: number; readonly z: number }) =>
        chunkManagerService.getChunk(coord).pipe(Effect.option)

      const getPlayerPos = () =>
        gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
          Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })),
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
        const recipe = recipeService.findById(recipeId)
        return Option.match(recipe, {
          onNone: () => recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess),
          onSome: (resolvedRecipe) => resolvedRecipe.station === 'furnace'
            ? furnaceService.getNearestFurnaceState().pipe(
                Effect.flatMap((furnaceOpt) => Option.match(furnaceOpt, {
                  onNone: () => furnaceService.startSmelting(recipeId),
                  onSome: (furnace) => Option.match(furnace.output, {
                      onSome: () => furnaceService.collectOutput().pipe(Effect.asVoid),
                      onNone: () => furnaceService.startSmelting(recipeId),
                    }),
                })),
              )
            : recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess),
        }) as Effect.Effect<void, Error, never>
      }

      return Effect.sync(() => buildOverlayDom(dom)).pipe(
        Effect.flatMap(({ overlayEl, slotEls, craftingListEl, statusEl }) => {
        /* c8 ignore start */
        const handleDelegatedClick = (event: MouseEvent) => {
          const htmlTarget = event.target instanceof HTMLElement ? event.target : null
          const recipeTarget = Option.fromNullable(htmlTarget?.closest('[data-recipe-id]')).pipe(
            Option.filter((target): target is HTMLElement => target instanceof HTMLElement),
          )

          Option.match(recipeTarget, {
            onSome: (target) => {
              const recipeId = target.dataset['recipeId']
              if (!recipeId) return
                Effect.runFork(
                Effect.all([hasNearbyCraftingTable(), hasNearbyFurnace()], { concurrency: 'unbounded' }).pipe(
                  Effect.flatMap(([hasTableAccess, hasFurnaceAccess]) => performRecipe(RecipeId.make(recipeId), hasTableAccess, hasFurnaceAccess)),
                  Effect.andThen(Ref.set(statusMessageRef, 'Crafted successfully.')),
                  Effect.catchAll((error) =>
                    Ref.set(statusMessageRef, error instanceof Error ? error.message : 'Crafting failed.'),
                  ),
                  Effect.andThen(refreshSlots()),
                  Effect.catchAllCause((cause) =>
                    Effect.logError(`Crafting click error: ${Cause.pretty(cause)}`),
                  ),
                ),
              )
            },
            onNone: () => {
              const slotTarget = Option.fromNullable(htmlTarget?.closest('[data-slot]')).pipe(
                Option.filter((target): target is HTMLElement => target instanceof HTMLElement),
              )

              Option.map(slotTarget, (target) => {
                const index = parseInt(Option.getOrElse(Option.fromNullable(target.dataset['slot']), () => '-1'), 10)
                if (index < 0 || index >= INVENTORY_SIZE) return
                Effect.runFork(
                  Effect.gen(function* () {
                    const selectedSlot = yield* hotbarService.getSelectedSlot()
                    const hotbarInventoryIndex = HOTBAR_START + SlotIndex.toNumber(selectedSlot)
                    yield* inventoryService.moveStack(SlotIndex.make(index), SlotIndex.make(hotbarInventoryIndex))
                  }).pipe(
                    Effect.catchAllCause(cause =>
                      Effect.logError(`Inventory click error: ${Cause.pretty(cause)}`)
                    )
                  )
                )
              })
            },
          })
        }
        /* c8 ignore stop */

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
            Option.map(overlayEl, (el) => el.addEventListener('click', handleDelegatedClick))
          }),
          () => Effect.sync(() => {
            Option.map(overlayEl, (el) => { el.removeEventListener('click', handleDelegatedClick); el.remove() })
          })
        ).pipe(Effect.as({
          toggle: (): Effect.Effect<boolean, never> =>
            Effect.gen(function* () {
              const next = yield* Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current])
              yield* Effect.sync(() => Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none' }))
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
              const recipe = Option.getOrElse(Arr.get(recipes, selectedRecipeIndex), () => null)
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
                  ? `Crafted ${recipe.output.count} ${recipe.output.blockType}.`
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
