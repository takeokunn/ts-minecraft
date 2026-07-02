import { Array as Arr, Cause, Effect, Either, Option, Ref } from 'effect'
import { ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { InventoryService, HOTBAR_START, type InventorySlot } from '@ts-minecraft/inventory/application/inventory-service'
import { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/world'
import { XPService } from '@ts-minecraft/entity/application/xp-service'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { RecipeId } from '@ts-minecraft/core'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import type { Recipe } from '@ts-minecraft/inventory/domain/crafting'
import { SlotIndex } from '@ts-minecraft/core'
import { blockTypeToIndex } from '@ts-minecraft/core'
import { scanNearbyBlock } from '@ts-minecraft/world'

import { buildOverlayDom } from './inventory-renderer-dom'
import { collectAvailableCounts } from './inventory-renderer-helpers'
import { renderSlotElements, renderRecipeBook, renderCraftingList, renderCraftingPreview, renderCraftingGridCells, renderCraftingGridOutput, renderStatusEl, renderInventoryCursor } from './inventory-renderer-refresh'
import { buildHandleDelegatedClick } from './inventory-renderer-click-handler'
import { returnInventoryCursorToSlots } from './inventory-cursor-click'
import { emptyCraftingGridCells, findShapedGridMatch } from './crafting-grid'
import { getActiveDocument, asFocusableElement } from '../dom-focus-utils'

type DragSource =
  | { readonly kind: 'inventory'; readonly slot: number }
  | { readonly kind: 'chest'; readonly slot: number }

const readDragSource = (target: EventTarget | null): DragSource | null => {
  if (target === null || typeof target !== 'object') return null
  const dataset = (target as { readonly dataset?: Record<string, string | undefined> }).dataset
  if (dataset === undefined) return null

  const chestSlot = dataset['chestSlot']
  if (chestSlot !== undefined) {
    const slot = Number.parseInt(chestSlot, 10)
    return Number.isNaN(slot) || slot < 0 ? null : { kind: 'chest', slot }
  }

  const slot = dataset['slot']
  if (slot !== undefined) {
    const index = Number.parseInt(slot, 10)
    return Number.isNaN(index) || index < 0 ? null : { kind: 'inventory', slot: index }
  }

  return null
}

export class InventoryRendererService extends Effect.Service<InventoryRendererService>()(
  '@minecraft/presentation/InventoryRenderer',
  {
    scoped: Effect.gen(function* () {
      const inventoryService = yield* InventoryService
      const hotbarService = yield* HotbarService
      const equipmentService = yield* EquipmentService
      const recipeService = yield* RecipeService
      const furnaceService = yield* FurnaceService
      const chestService = yield* ChestService
      const gameState = yield* GameStateService
      const chunkManagerService = yield* ChunkManagerService
      const xpService = yield* XPService
      const dom = yield* DomOperationsService
      const isVisibleRef = yield* Ref.make(false)
      const availableRecipesRef = yield* Ref.make<ReadonlyArray<Recipe>>([])
      const recipeBookQueryRef = yield* Ref.make('')
      const selectedRecipeIndexRef = yield* Ref.make(0)
      const inventoryCursorRef = yield* Ref.make<InventorySlot>(Option.none())
      const statusMessageRef = yield* Ref.make('Click a recipe to craft it.')
      const dragSourceRef = yield* Ref.make<Option.Option<DragSource>>(Option.none())
      // Interactive 3x3 shaped-crafting grid cells (real stacks; spilled back on close).
      const craftingGridCellsRef = yield* Ref.make<ReadonlyArray<InventorySlot>>(emptyCraftingGridCells())

      // Focus state and cursor position (plain mutables — used only in sync DOM callbacks)
      let prevFocusEl: { focus?: () => void } | null = null
      let activeKeydownHandler: ((e: KeyboardEvent) => void) | null = null
      let cursorClickX = -9999
      let cursorClickY = -9999

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

      const hasNearbyBrewingStand = (): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const pos = yield* getPlayerPos()
          return yield* scanNearbyBlock(pos, 5, blockTypeToIndex('BREWING_STAND'), getChunkOrNone)
        })

      const refreshCraftingState = (slots: ReadonlyArray<InventorySlot>): Effect.Effect<readonly [ReadonlyArray<Recipe>, number], never> =>
        Effect.gen(function* () {
          const hasTableAccess = yield* hasNearbyCraftingTable()
          const hasFurnaceAccess = yield* hasNearbyFurnace()
          const hasBrewingAccess = yield* hasNearbyBrewingStand()
          const craftable = recipeService.findCraftable(collectAvailableCounts(slots), hasTableAccess, hasFurnaceAccess, hasBrewingAccess)
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
        hasBrewingAccess = true,
      ): Effect.Effect<void, Error, never> => {
        const recipe = Option.getOrNull(recipeService.findById(recipeId))
        if (recipe === null || recipe.station !== 'furnace') return recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess, hasBrewingAccess)
        return Effect.gen(function* () {
          const furnaceOpt = yield* furnaceService.getNearestFurnaceState()
          const furnace = Option.getOrNull(furnaceOpt)
          if (furnace === null) { yield* furnaceService.startSmelting(recipeId); return }
          if (Option.isNone(furnace.output)) { yield* furnaceService.startSmelting(recipeId); return }
          const { xp } = yield* furnaceService.collectOutput()
          if (xp > 0) {
            const remainingXP = yield* inventoryService.repairMendingItemsWithXP(xp)
            if (remainingXP > 0) yield* xpService.addXP(remainingXP)
          }
        }) as Effect.Effect<void, Error, never>
      }

      const clearDragSource = (): Effect.Effect<void, never> =>
        Ref.set(dragSourceRef, Option.none())

      const { overlayEl, chestContainerEl, chestSlotEls, slotEls, recipeBookEl, recipeBookSearchEl, craftingPreviewEl, craftingListEl, craftGridCellEls, craftGridOutputEl, statusEl, sortButtonEl, cursorEl } = yield* Effect.sync(() => buildOverlayDom(dom))

      // Scans craftingListEl then recipeBookEl for the last focusable button with data-recipe-id.
      // Uses querySelectorAll in real DOM; falls back to childrenList in test mock DOM.
      const findLastFocusable = (): { focus?: () => void } | null => {
        for (const containerOpt of [craftingListEl, recipeBookEl]) {
          const container = Option.getOrNull(containerOpt)
          if (container === null) continue
          const asEl = container as unknown as {
            querySelectorAll?: (selector: string) => NodeListOf<HTMLElement>
            childrenList?: Array<{ dataset?: Record<string, string>; focus?: () => void }>
          }
          if (typeof asEl.querySelectorAll === 'function') {
            const buttons = Array.from(asEl.querySelectorAll('[data-recipe-id]'))
            if (buttons.length > 0) return buttons[buttons.length - 1] as unknown as { focus?: () => void }
          } else if (asEl.childrenList !== undefined) {
            const children = asEl.childrenList.filter((c) => c.dataset !== undefined && 'recipeId' in c.dataset)
            if (children.length > 0) return children[children.length - 1] ?? null
          }
        }
        return null
      }

      /* c8 ignore next */
      const innerDelegatedClick = buildHandleDelegatedClick({
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
        getAllRecipes: () => recipeService.getAllRecipes(),
        refreshSlots: () => refreshSlots(),
      })
      const handleDelegatedClick = (event: MouseEvent): void => {
        cursorClickX = event.clientX + 14
        cursorClickY = event.clientY + 14
        innerDelegatedClick(event)
      }
      const dragTargets = [...chestSlotEls, ...slotEls]

      const handleDragStart = (event: DragEvent): void => {
        if (event.dataTransfer !== null) {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', 'inventory-slot')
        }

        Effect.runFork(
          Effect.gen(function* () {
            const source = readDragSource(event.currentTarget ?? event.target)
            if (source === null) return

            const cursor = yield* Ref.get(inventoryCursorRef)
            if (Option.isSome(cursor)) {
              yield* Ref.set(statusMessageRef, 'Place held item before dragging.')
              return
            }

            if (source.kind === 'inventory') {
              const slot = yield* inventoryService.getSlot(SlotIndex.make(source.slot))
              if (Option.isNone(slot)) return
            } else {
              const chestState = Option.getOrNull(yield* chestService.getNearestChestState())
              const chestSlot = chestState?.slots[source.slot] ?? Option.none()
              if (Option.isNone(chestSlot)) return
            }

            yield* Ref.set(dragSourceRef, Option.some(source))
          }).pipe(
            Effect.catchAllCause((cause) =>
              Effect.logError(`Inventory drag start error: ${Cause.pretty(cause)}`),
            ),
          ),
        )
      }

      const handleDragOver = (event: DragEvent): void => {
        event.preventDefault()
        event.stopPropagation()
      }

      const handleDrop = (event: DragEvent): void => {
        event.preventDefault()
        event.stopPropagation()

        Effect.runFork(
          Effect.gen(function* () {
            const source = yield* Ref.get(dragSourceRef)
            if (Option.isNone(source)) return

            const target = readDragSource(event.currentTarget ?? event.target)
            if (target === null) return
            if (source.value.kind === target.kind && source.value.slot === target.slot) return

            if (source.value.kind === 'inventory' && target.kind === 'inventory') {
              yield* inventoryService.moveStack(SlotIndex.make(source.value.slot), SlotIndex.make(target.slot))
              yield* Ref.set(statusMessageRef, 'Item moved.')
            } else if (source.value.kind === 'inventory' && target.kind === 'chest') {
              yield* chestService.moveInventoryStackToChestSlot(SlotIndex.make(source.value.slot), target.slot)
              yield* Ref.set(statusMessageRef, 'Item moved to chest.')
            } else if (source.value.kind === 'chest' && target.kind === 'inventory') {
              yield* chestService.moveChestStackToInventorySlot(source.value.slot, SlotIndex.make(target.slot))
              yield* Ref.set(statusMessageRef, 'Chest item moved to inventory.')
            } else if (source.value.kind === 'chest' && target.kind === 'chest') {
              yield* chestService.moveChestStackToChestSlot(source.value.slot, target.slot)
              yield* Ref.set(statusMessageRef, 'Chest item moved.')
            } else {
              return
            }

            yield* refreshSlots()
          }).pipe(
            Effect.ensuring(clearDragSource()),
            Effect.catchAllCause((cause) =>
              Effect.logError(`Inventory drag drop error: ${Cause.pretty(cause)}`),
            ),
          ),
        )
      }

      const handleDragEnd = (): void => {
        Effect.runFork(clearDragSource())
      }

      const refreshSlots = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const allSlots = yield* inventoryService.getAllSlots()
          const chestState = yield* chestService.getNearestChestState()
          const selectedSlot = yield* hotbarService.getSelectedSlot()
          const allRecipes = recipeService.getAllRecipes()
          const [craftableRecipes, selectedRecipeIndex] = yield* refreshCraftingState(allSlots)
          const statusMessage = yield* Ref.get(statusMessageRef)
          const recipeBookQuery = yield* Ref.get(recipeBookQueryRef)
          const cursor = yield* Ref.get(inventoryCursorRef)
          const craftingGridCells = yield* Ref.get(craftingGridCellsRef)
          const hasTableAccessForGrid = yield* hasNearbyCraftingTable()
          const shapedMatch = findShapedGridMatch(allRecipes, craftingGridCells, hasTableAccessForGrid)

          /* c8 ignore start */
          yield* Effect.sync(() => {
            const selectedHotbarIdx = HOTBAR_START + SlotIndex.toNumber(selectedSlot)
            const chest = Option.getOrNull(chestState)
            const chestContainer = Option.getOrNull(chestContainerEl)
            if (chestContainer !== null) chestContainer.style.display = chest === null ? 'none' : 'block'
            renderSlotElements(chestSlotEls, chest?.slots ?? [], -1)
            renderSlotElements(slotEls, allSlots, selectedHotbarIdx)
            renderRecipeBook(dom, recipeBookEl, allRecipes, recipeBookQuery, new Set(craftableRecipes.map((recipe) => recipe.id)))
            renderCraftingPreview(dom, craftingPreviewEl, craftableRecipes, selectedRecipeIndex)
            renderCraftingList(dom, craftingListEl, craftableRecipes, selectedRecipeIndex)
            renderCraftingGridCells(craftGridCellEls, craftingGridCells)
            renderCraftingGridOutput(craftGridOutputEl, shapedMatch)
            renderStatusEl(statusEl, statusMessage)
            renderInventoryCursor(cursorEl, cursor)
            const cursorElement = Option.getOrNull(cursorEl)
            if (cursorElement !== null && Option.isSome(cursor)) {
              cursorElement.style.transform = `translate(${cursorClickX}px,${cursorClickY}px)`
            }
          })
          /* c8 ignore stop */
        })

      const handleRecipeBookSearchInput = (event: Event): void => {
        const target = event.currentTarget
        if (target === null || typeof target !== 'object') return
        const value = (target as HTMLInputElement).value ?? ''
        Effect.runFork(
          Effect.gen(function* () {
            yield* Ref.set(recipeBookQueryRef, value)
            yield* refreshSlots()
          }).pipe(
            Effect.catchAllCause((cause) =>
              Effect.logError(`Inventory recipe search error: ${Cause.pretty(cause)}`),
            ),
          ),
        )
      }

      // Spill the crafting grid back into the inventory when the overlay
      // closes — items must never vanish inside the grid. Cells that cannot
      // fit stay in the grid for the next open.
      const returnCraftingGridToInventory = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const cells = yield* Ref.get(craftingGridCellsRef)
          const remaining = [...cells]
          for (let index = 0; index < remaining.length; index += 1) {
            const stack = Option.getOrNull(remaining[index] ?? Option.none())
            if (stack === null) continue
            const returned = yield* inventoryService.addBlock(stack.itemType, stack.count).pipe(
              Effect.as(true),
              Effect.catchAll(() => Effect.succeed(false)),
            )
            if (returned) remaining[index] = Option.none()
          }
          yield* Ref.set(craftingGridCellsRef, remaining)
        })

      const returnCursorToInventory = (): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const cursor = yield* Ref.get(inventoryCursorRef)
          if (Option.isNone(cursor)) {
            return true
          }

          const allSlots = yield* inventoryService.getAllSlots()
          const next = returnInventoryCursorToSlots(allSlots, cursor)

          for (let index = 0; index < next.slots.length; index += 1) {
            const before = allSlots[index] ?? Option.none()
            const after = next.slots[index] ?? Option.none()
            if (before !== after) {
              yield* inventoryService.setSlot(SlotIndex.make(index), after)
            }
          }

          yield* Ref.set(inventoryCursorRef, next.cursor)

          if (Option.isNone(next.cursor)) {
            yield* Ref.set(statusMessageRef, 'Returned held item to inventory.')
            return true
          }

          yield* Ref.set(statusMessageRef, 'Inventory full; place held item before closing.')
          yield* refreshSlots()
          return false
        })

      const sortInventory = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const isVisible = yield* Ref.get(isVisibleRef)
          if (!isVisible) return

          const cursor = yield* Ref.get(inventoryCursorRef)
          if (Option.isSome(cursor)) {
            yield* Ref.set(statusMessageRef, 'Place held item before sorting inventory.')
            yield* refreshSlots()
            return
          }

          yield* inventoryService.sortInventory()
          yield* Ref.set(statusMessageRef, 'Inventory sorted.')
          yield* refreshSlots()
        })

      const handleSortButtonClick = (event: Event): void => {
        event.preventDefault()
        event.stopPropagation()
        Effect.runFork(sortInventory())
      }

      yield* Effect.sync(() => {
        const el = Option.getOrNull(overlayEl)
        const sortButton = Option.getOrNull(sortButtonEl)
        const recipeBookSearch = Option.getOrNull(recipeBookSearchEl)
        el?.addEventListener('click', handleDelegatedClick)
        el?.addEventListener('contextmenu', handleDelegatedClick)
        sortButton?.addEventListener('click', handleSortButtonClick)
        recipeBookSearch?.addEventListener('input', handleRecipeBookSearchInput)
        dragTargets.forEach((target) => {
          target.addEventListener('dragstart', handleDragStart)
          target.addEventListener('dragover', handleDragOver)
          target.addEventListener('drop', handleDrop)
          target.addEventListener('dragend', handleDragEnd)
        })
      })
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        const el = Option.getOrNull(overlayEl)
        const sortButton = Option.getOrNull(sortButtonEl)
        const recipeBookSearch = Option.getOrNull(recipeBookSearchEl)
        sortButton?.removeEventListener('click', handleSortButtonClick)
        recipeBookSearch?.removeEventListener('input', handleRecipeBookSearchInput)
        dragTargets.forEach((target) => {
          target.removeEventListener('dragstart', handleDragStart)
          target.removeEventListener('dragover', handleDragOver)
          target.removeEventListener('drop', handleDrop)
          target.removeEventListener('dragend', handleDragEnd)
        })
        if (el !== null) {
          el.removeEventListener('click', handleDelegatedClick)
          el.removeEventListener('contextmenu', handleDelegatedClick)
          el.remove()
        }
      }))

      const toggle = (): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const current = yield* Ref.get(isVisibleRef)
          if (current) {
            const canClose = yield* returnCursorToInventory()
            if (!canClose) return true
            yield* returnCraftingGridToInventory()
            yield* Effect.sync(() => {
              const doc = getActiveDocument()
              if (activeKeydownHandler !== null) {
                doc?.removeEventListener?.('keydown', activeKeydownHandler)
                activeKeydownHandler = null
              }
              asFocusableElement(prevFocusEl as HTMLElement | null)?.focus()
              prevFocusEl = null
            })
          }

          const next = !current
          yield* Ref.set(isVisibleRef, next)
          yield* Effect.sync(() => {
            const el = Option.getOrNull(overlayEl)
            if (el !== null) el.style.display = next ? 'block' : 'none'
          })
          if (next) {
            yield* refreshSlots()
            yield* Effect.sync(() => {
              const doc = getActiveDocument()
              prevFocusEl = doc?.activeElement as { focus?: () => void } | null
              Option.getOrNull(sortButtonEl)?.focus?.()
              activeKeydownHandler = handleKeydown
              doc?.addEventListener?.('keydown', handleKeydown)
            })
          }
          return next
        })

      const handleKeydown = (event: KeyboardEvent): void => {
        // Escape is deliberately NOT handled here: the frame pipeline's
        // handleEscape owns inventory close (plays the close sound and
        // resumes the game). A second closer here would race it — the key
        // reaches the InputService on `window` and both would toggle.
        if (event.key === 'Tab') {
          const doc = getActiveDocument()
          const active = doc?.activeElement
          const first = Option.getOrNull(sortButtonEl)
          const last = findLastFocusable()
          if (!event.shiftKey && active === last && last !== null) {
            event.preventDefault()
            event.stopPropagation()
            first?.focus?.()
          } else if (event.shiftKey && active === first && first !== null) {
            event.preventDefault()
            event.stopPropagation()
            last?.focus?.()
          }
        }
      }

      return {
        toggle,

        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        update: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const isVisible = yield* Ref.get(isVisibleRef)
            if (isVisible) yield* refreshSlots()
          }),

        sortInventory,

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
            const hasBrewingAccess = yield* hasNearbyBrewingStand()
            const result = yield* performRecipe(recipe.id, hasTableAccess, hasFurnaceAccess, hasBrewingAccess).pipe(Effect.either)
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
