import { Cause, Effect, Option, Ref } from 'effect'
import { type HotbarService, type InventoryService, INVENTORY_SIZE, HOTBAR_START } from '@ts-minecraft/inventory'
import { RecipeId, SlotIndex } from '@ts-minecraft/core'

export type ClickHandlerDeps = {
  readonly hasNearbyCraftingTable: () => Effect.Effect<boolean, never>
  readonly hasNearbyFurnace: () => Effect.Effect<boolean, never>
  readonly performRecipe: (
    recipeId: RecipeId,
    hasTableAccess: boolean,
    hasFurnaceAccess: boolean,
  ) => Effect.Effect<void, Error, never>
  readonly hotbarService: HotbarService
  readonly inventoryService: InventoryService
  readonly statusMessageRef: Ref.Ref<string>
  readonly refreshSlots: () => Effect.Effect<void, never>
}

/* c8 ignore next */
export const buildHandleDelegatedClick = (deps: ClickHandlerDeps) =>
  (event: MouseEvent): void => {
    const {
      hasNearbyCraftingTable,
      hasNearbyFurnace,
      performRecipe,
      hotbarService,
      inventoryService,
      statusMessageRef,
      refreshSlots,
    } = deps

    const htmlTarget = event.target instanceof HTMLElement ? event.target : null
    const recipeTarget = Option.fromNullable(htmlTarget?.closest('[data-recipe-id]')).pipe(
      Option.filter((target): target is HTMLElement => target instanceof HTMLElement),
    )

    const recipe = Option.getOrNull(recipeTarget)
    if (recipe !== null) {
      const recipeId = recipe.dataset['recipeId']
      if (!recipeId) return
      Effect.runFork(
        Effect.gen(function* () {
          const hasTableAccess = yield* hasNearbyCraftingTable()
          const hasFurnaceAccess = yield* hasNearbyFurnace()
          yield* Effect.gen(function* () {
            yield* performRecipe(RecipeId.make(recipeId), hasTableAccess, hasFurnaceAccess)
            yield* Ref.set(statusMessageRef, 'Crafted successfully.')
          }).pipe(
            Effect.catchAll((error) =>
              Ref.set(statusMessageRef, error instanceof Error ? error.message : 'Crafting failed.'),
            ),
          )
          yield* refreshSlots()
        }).pipe(
          Effect.catchAllCause((cause) =>
            Effect.logError(`Crafting click error: ${Cause.pretty(cause)}`),
          ),
        ),
      )
    } else {
      const slotTarget = Option.getOrNull(
        Option.fromNullable(htmlTarget?.closest('[data-slot]')).pipe(
          Option.filter((target): target is HTMLElement => target instanceof HTMLElement),
        )
      )
      if (slotTarget !== null) {
        const index = parseInt(
          slotTarget.dataset['slot'] ?? '-1',
          10,
        )
        if (index < 0 || index >= INVENTORY_SIZE) return
        const shiftQuickMove = event.shiftKey
        Effect.runFork(
          Effect.gen(function* () {
            if (shiftQuickMove) {
              // Vanilla shift-click: quick-transfer the clicked stack to the other region.
              yield* inventoryService.quickMove(SlotIndex.make(index))
            } else {
              const selectedSlot = yield* hotbarService.getSelectedSlot()
              const hotbarInventoryIndex = HOTBAR_START + SlotIndex.toNumber(selectedSlot)
              yield* inventoryService.moveStack(SlotIndex.make(index), SlotIndex.make(hotbarInventoryIndex))
            }
            yield* refreshSlots()
          }).pipe(
            Effect.catchAllCause((cause) =>
              Effect.logError(`Inventory click error: ${Cause.pretty(cause)}`),
            ),
          ),
        )
      }
    }
  }
