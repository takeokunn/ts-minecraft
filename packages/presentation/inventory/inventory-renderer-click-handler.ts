import { Cause, Effect, Option, Ref } from 'effect'
import { type ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { type EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { type HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import {
  INVENTORY_SIZE,
  HOTBAR_START,
  type InventoryService,
  type InventorySlot,
} from '@ts-minecraft/inventory/application/inventory-service'
import { removeFromStack } from '@ts-minecraft/inventory/domain/item-stack'
import { RecipeId, SlotIndex } from '@ts-minecraft/core'
import { applyInventoryCursorClick, describeInventoryCursor, type InventoryCursorClickButton } from './inventory-cursor-click'
import { consumeCraftingGridCells, findShapedGridMatch } from './crafting-grid'

export type ClickHandlerDeps = {
  readonly hasNearbyCraftingTable: () => Effect.Effect<boolean, never>
  readonly hasNearbyFurnace: () => Effect.Effect<boolean, never>
  readonly hasNearbyBrewingStand: () => Effect.Effect<boolean, never>
  readonly performRecipe: (
    recipeId: RecipeId,
    hasTableAccess: boolean,
    hasFurnaceAccess: boolean,
    hasBrewingAccess?: boolean,
  ) => Effect.Effect<void, Error, never>
  readonly hotbarService: HotbarService
  readonly inventoryService: InventoryService
  readonly chestService: ChestService
  readonly equipmentService: EquipmentService
  readonly inventoryCursorRef: Ref.Ref<InventorySlot>
  readonly statusMessageRef: Ref.Ref<string>
  readonly craftingGridCellsRef: Ref.Ref<ReadonlyArray<InventorySlot>>
  readonly getAllRecipes: () => ReadonlyArray<import('@ts-minecraft/inventory/domain/crafting').Recipe>
  readonly refreshSlots: () => Effect.Effect<void, never>
}

export type ShiftQuickMoveInventoryDeps = Pick<ClickHandlerDeps, 'chestService' | 'inventoryService' | 'equipmentService'>

export const shiftQuickMoveInventorySlot = (
  deps: ShiftQuickMoveInventoryDeps,
  clickedSlot: SlotIndex,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const hasChestAccess = yield* deps.chestService.hasNearbyChest()
    if (hasChestAccess) {
      yield* deps.chestService.quickMoveInventoryToChest(clickedSlot)
      return
    }

    const stack = Option.getOrNull(yield* deps.inventoryService.getSlot(clickedSlot))
    if (stack !== null) {
      const equipped = yield* deps.equipmentService.equipIfSlotEmpty(stack)
      if (equipped) {
        yield* deps.inventoryService.setSlot(clickedSlot, removeFromStack(stack, 1))
        return
      }
    }

    yield* deps.inventoryService.quickMove(clickedSlot)
  })

/* c8 ignore next */
export const buildHandleDelegatedClick = (deps: ClickHandlerDeps) =>
  (event: MouseEvent): void => {
    const {
      hasNearbyCraftingTable,
      hasNearbyFurnace,
      hasNearbyBrewingStand,
      performRecipe,
      hotbarService,
      inventoryService,
      chestService,
      equipmentService,
      inventoryCursorRef,
      statusMessageRef,
      craftingGridCellsRef,
      getAllRecipes,
      refreshSlots,
    } = deps
    if (event.type === 'contextmenu') event.preventDefault()

    const htmlTarget = event.target instanceof HTMLElement ? event.target : null

    // Interactive 3x3 crafting grid: cells share the inventory-cursor click
    // semantics; the output cell crafts the matched shaped recipe.
    const craftCellTarget = Option.getOrNull(
      Option.fromNullable(htmlTarget?.closest('[data-craft-cell]')).pipe(
        Option.filter((target): target is HTMLElement => target instanceof HTMLElement),
      ),
    )
    if (craftCellTarget !== null) {
      const cellIndex = parseInt(craftCellTarget.dataset['craftCell'] ?? '-1', 10)
      if (cellIndex < 0 || cellIndex > 8) return
      const button: InventoryCursorClickButton = event.type === 'contextmenu' || event.button === 2 ? 'secondary' : 'primary'
      Effect.runFork(
        Effect.gen(function* () {
          const cells = yield* Ref.get(craftingGridCellsRef)
          const cell = cells[cellIndex] ?? Option.none()
          const cursor = yield* Ref.get(inventoryCursorRef)
          const next = applyInventoryCursorClick({ slot: cell, cursor }, button)
          const updated = [...cells]
          updated[cellIndex] = next.slot
          yield* Ref.set(craftingGridCellsRef, updated)
          yield* Ref.set(inventoryCursorRef, next.cursor)
          yield* Ref.set(statusMessageRef, describeInventoryCursor(next.cursor))
          yield* refreshSlots()
        }).pipe(
          Effect.catchAllCause((cause) =>
            Effect.logError(`Crafting grid click error: ${Cause.pretty(cause)}`),
          ),
        ),
      )
      return
    }

    if (htmlTarget?.closest('[data-craft-output]') != null) {
      Effect.runFork(
        Effect.gen(function* () {
          const cells = yield* Ref.get(craftingGridCellsRef)
          const hasTableAccess = yield* hasNearbyCraftingTable()
          const matched = findShapedGridMatch(getAllRecipes(), cells, hasTableAccess)
          if (matched === null) return
          const added = yield* inventoryService.addBlock(matched.output.itemType, matched.output.count).pipe(
            Effect.as(true),
            Effect.catchAll(() => Effect.succeed(false)),
          )
          if (!added) {
            yield* Ref.set(statusMessageRef, 'Cannot craft: inventory is full.')
            yield* refreshSlots()
            return
          }
          yield* Ref.set(craftingGridCellsRef, consumeCraftingGridCells(cells))
          yield* Ref.set(statusMessageRef, `Crafted ${matched.output.count} ${matched.output.itemType}.`)
          yield* refreshSlots()
        }).pipe(
          Effect.catchAllCause((cause) =>
            Effect.logError(`Crafting grid output error: ${Cause.pretty(cause)}`),
          ),
        ),
      )
      return
    }

    const recipeTarget = Option.fromNullable(htmlTarget?.closest('[data-recipe-id]')).pipe(
      Option.filter((target): target is HTMLElement => target instanceof HTMLElement),
    )

    const chestSlotTarget = Option.getOrNull(
      Option.fromNullable(htmlTarget?.closest('[data-chest-slot]')).pipe(
        Option.filter((target): target is HTMLElement => target instanceof HTMLElement),
      )
    )
    if (chestSlotTarget !== null) {
      const index = parseInt(
        chestSlotTarget.dataset['chestSlot'] ?? '-1',
        10,
      )
      if (index < 0) return
      const shiftQuickMove = event.shiftKey
      Effect.runFork(
        Effect.gen(function* () {
          if (shiftQuickMove) {
            yield* chestService.quickMoveChestToInventory(index)
          } else {
            const selectedSlot = yield* hotbarService.getSelectedSlot()
            const hotbarInventoryIndex = HOTBAR_START + SlotIndex.toNumber(selectedSlot)
            yield* chestService.moveChestStackToInventorySlot(index, SlotIndex.make(hotbarInventoryIndex))
          }
          yield* refreshSlots()
        }).pipe(
          Effect.catchAllCause((cause) =>
            Effect.logError(`Chest click error: ${Cause.pretty(cause)}`),
          ),
        ),
      )
      return
    }

    const recipe = Option.getOrNull(recipeTarget)
    if (recipe !== null) {
      const recipeId = recipe.dataset['recipeId']
      if (!recipeId) return
      Effect.runFork(
        Effect.gen(function* () {
          const hasTableAccess = yield* hasNearbyCraftingTable()
          const hasFurnaceAccess = yield* hasNearbyFurnace()
          const hasBrewingAccess = yield* hasNearbyBrewingStand()
          yield* Effect.gen(function* () {
            yield* performRecipe(RecipeId.make(recipeId), hasTableAccess, hasFurnaceAccess, hasBrewingAccess)
            yield* Ref.set(statusMessageRef, 'Crafted successfully.')
          }).pipe(
            Effect.catchAll((error) => {
              // RecipeError.message reads "Recipe error [craft]: Not enough
              // materials" — surface just the human part to the player.
              const cause = (error as { readonly cause?: unknown }).cause
              const reason = typeof cause === 'string'
                ? cause
                : error instanceof Error && error.message.length > 0
                  ? error.message
                  : 'Crafting failed.'
              return Ref.set(statusMessageRef, `Cannot craft: ${reason}`)
            }),
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
              yield* shiftQuickMoveInventorySlot({ chestService, inventoryService, equipmentService }, SlotIndex.make(index))
            } else {
              const clickedSlot = SlotIndex.make(index)
              const button: InventoryCursorClickButton = event.type === 'contextmenu' || event.button === 2 ? 'secondary' : 'primary'
              const slot = yield* inventoryService.getSlot(clickedSlot)
              const cursor = yield* Ref.get(inventoryCursorRef)
              const next = applyInventoryCursorClick({ slot, cursor }, button)
              yield* inventoryService.setSlot(clickedSlot, next.slot)
              yield* Ref.set(inventoryCursorRef, next.cursor)
              yield* Ref.set(statusMessageRef, describeInventoryCursor(next.cursor))
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
