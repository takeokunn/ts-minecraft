import { Array as Arr, Cause, Effect, Either, HashMap, Option, Ref } from 'effect'
import { InventoryService, INVENTORY_SIZE, HOTBAR_START, type InventorySlot } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { RecipeService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { GameStateService } from '@ts-minecraft/game'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import { RecipeId } from '@ts-minecraft/kernel'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import type { BlockType } from '@ts-minecraft/kernel'
import type { Recipe } from '@ts-minecraft/inventory'
import { SlotIndex } from '@ts-minecraft/kernel'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/kernel'

import {
  SLOT_COLORS, DEFAULT_SLOT_COLOR,
  SLOT_EL_STYLE, OVERLAY_STYLE, OVERLAY_TITLE_STYLE,
  MAIN_GRID_STYLE, HOTBAR_GRID_STYLE, SEPARATOR_STYLE,
  CRAFTING_TITLE_STYLE, CRAFTING_LIST_STYLE, STATUS_STYLE,
  EMPTY_RECIPE_STYLE, RECIPE_ROW_BASE_STYLE,
  RECIPE_ROW_SELECTED_BG, RECIPE_ROW_SELECTED_BORDER,
  RECIPE_ROW_DEFAULT_BG, RECIPE_ROW_DEFAULT_BORDER,
  SLOT_BORDER_SELECTED, SLOT_BORDER_DEFAULT,
} from './inventory-renderer.config'

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
      const getSlotColor = (blockType: BlockType): string =>
        Option.getOrElse(Option.fromNullable(SLOT_COLORS[blockType as BlockType]), () => DEFAULT_SLOT_COLOR)

      type OverlayDom = {
        readonly overlayEl: Option.Option<HTMLDivElement>
        readonly slotEls: HTMLDivElement[]
        readonly craftingListEl: Option.Option<HTMLDivElement>
        readonly statusEl: Option.Option<HTMLDivElement>
      }

      const collectAvailableCounts = (slots: ReadonlyArray<InventorySlot>): HashMap.HashMap<BlockType, number> =>
        Arr.reduce(slots, HashMap.empty<BlockType, number>(), (counts, slot) =>
          Option.match(slot, {
            onNone: () => counts,
            onSome: (stack) =>
              HashMap.set(
                counts,
                stack.blockType,
                Option.getOrElse(HashMap.get(counts, stack.blockType), () => 0) + stack.count,
              ),
          }),
        )

      const hasNearbyCraftingTable = (): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })))
          const searchRadius = 5
          const craftingTableIndex = blockTypeToIndex('CRAFTING_TABLE')

          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -1; dy <= 2; dy++) {
              for (let dz = -searchRadius; dz <= searchRadius; dz++) {
                const wx = Math.floor(playerPos.x + dx)
                const wy = Math.floor(playerPos.y + dy)
                const wz = Math.floor(playerPos.z + dz)
                if (wy < 0 || wy >= CHUNK_HEIGHT) continue
                const cx = Math.floor(wx / CHUNK_SIZE)
                const cz = Math.floor(wz / CHUNK_SIZE)
                const chunk = yield* chunkManagerService.getChunk({ x: cx, z: cz }).pipe(Effect.catchAll(() => Effect.succeed(null)))
                if (chunk === null) continue
                const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                const idx = wy + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
                if (chunk.blocks[idx] === craftingTableIndex) return true
              }
            }
          }

          return false
        })

      const hasNearbyFurnace = (): Effect.Effect<boolean, never> =>
        Effect.gen(function* () {
          const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })))
          const searchRadius = 5
          const furnaceIndex = blockTypeToIndex('FURNACE')

          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -1; dy <= 2; dy++) {
              for (let dz = -searchRadius; dz <= searchRadius; dz++) {
                const wx = Math.floor(playerPos.x + dx)
                const wy = Math.floor(playerPos.y + dy)
                const wz = Math.floor(playerPos.z + dz)
                if (wy < 0 || wy >= CHUNK_HEIGHT) continue
                const cx = Math.floor(wx / CHUNK_SIZE)
                const cz = Math.floor(wz / CHUNK_SIZE)
                const chunk = yield* chunkManagerService.getChunk({ x: cx, z: cz }).pipe(Effect.catchAll(() => Effect.succeed(null)))
                if (chunk === null) continue
                const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
                const idx = wy + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
                if (chunk.blocks[idx] === furnaceIndex) return true
              }
            }
          }

          return false
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
        const recipe = recipeService.findById(recipeId)
        return Option.match(recipe, {
          onNone: () => recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess),
          onSome: (resolvedRecipe) => resolvedRecipe.station === 'furnace'
            ? furnaceService.getNearestFurnaceState().pipe(
                Effect.flatMap((furnaceOpt) => Option.match(furnaceOpt, {
                  onNone: () => furnaceService.startSmelting(recipeId),
                  onSome: (furnace) => Option.isSome(furnace.output)
                    ? furnaceService.collectOutput().pipe(Effect.asVoid)
                    : furnaceService.startSmelting(recipeId),
                })),
              )
            : recipeService.craft(recipeId, inventoryService, hasTableAccess, hasFurnaceAccess),
        }) as Effect.Effect<void, Error, never>
      }

      const createSlotEl = (index: number): HTMLDivElement => {
        const el = dom.createElement('div')
        el.dataset['slot'] = String(index)
        el.style.cssText = `${SLOT_EL_STYLE};background:${DEFAULT_SLOT_COLOR}`
        return el
      }

      return Effect.sync((): OverlayDom => {
        if (typeof document === 'undefined') {
          return {
            overlayEl: Option.none(),
            slotEls: [],
            craftingListEl: Option.none(),
            statusEl: Option.none(),
          }
        }

        const el = dom.createElement('div')
        el.id = 'inventory-overlay'
        el.style.cssText = OVERLAY_STYLE

        const title = dom.createElement('div')
        title.textContent = 'Inventory'
        title.style.cssText = OVERLAY_TITLE_STYLE
        dom.appendChildTo(el, title)

        // Main grid (3 rows × 9 = slots 0-26)
        const mainGrid = dom.createElement('div')
        mainGrid.style.cssText = MAIN_GRID_STYLE
        const mainSlots = Arr.makeBy(HOTBAR_START, (i) => createSlotEl(i))
        Arr.forEach(mainSlots, (slotEl) => dom.appendChildTo(mainGrid, slotEl))
        dom.appendChildTo(el, mainGrid)

        // Separator
        const sep = dom.createElement('hr')
        sep.style.cssText = SEPARATOR_STYLE
        dom.appendChildTo(el, sep)

        // Hotbar row (slots 27-35)
        const hotbarGrid = dom.createElement('div')
        hotbarGrid.style.cssText = HOTBAR_GRID_STYLE
        const hotbarSlots = Arr.makeBy(INVENTORY_SIZE - HOTBAR_START, (i) => createSlotEl(HOTBAR_START + i))
        Arr.forEach(hotbarSlots, (slotEl) => dom.appendChildTo(hotbarGrid, slotEl))
        dom.appendChildTo(el, hotbarGrid)

        const craftingTitle = dom.createElement('div')
        craftingTitle.textContent = 'Crafting'
        craftingTitle.style.cssText = CRAFTING_TITLE_STYLE
        dom.appendChildTo(el, craftingTitle)

        const craftingList = dom.createElement('div')
        craftingList.style.cssText = CRAFTING_LIST_STYLE
        dom.appendChildTo(el, craftingList)

        const status = dom.createElement('div')
        status.style.cssText = STATUS_STYLE
        status.textContent = 'Click a recipe to craft it.'
        dom.appendChildTo(el, status)

        dom.appendChild(el)

        return {
          overlayEl: Option.some(el),
          slotEls: Arr.appendAll(mainSlots, hotbarSlots),
          craftingListEl: Option.some(craftingList),
          statusEl: Option.some(status),
        }
      }).pipe(
        Effect.flatMap(({ overlayEl, slotEls, craftingListEl, statusEl }) => {
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

        const refreshSlots = (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const allSlots = yield* inventoryService.getAllSlots()
            const selectedSlot = yield* hotbarService.getSelectedSlot()
            const [craftableRecipes, selectedRecipeIndex] = yield* refreshCraftingState(allSlots)
            const statusMessage = yield* Ref.get(statusMessageRef)

            yield* Effect.sync(() => {
              const selectedHotbarIdx = HOTBAR_START + SlotIndex.toNumber(selectedSlot)
              Arr.forEach(Arr.zip(slotEls, allSlots), ([el, itemOpt], i) => {
                Option.match(itemOpt, {
                  onSome: (stack) => {
                    el.style.background = getSlotColor(stack.blockType)
                    el.title = `${stack.blockType} ×${stack.count}`
                    el.textContent = stack.count < 64 ? String(stack.count) : ''
                  },
                  onNone: () => {
                    el.style.background = DEFAULT_SLOT_COLOR
                    el.title = ''
                    el.textContent = ''
                  },
                })
                // Highlight selected hotbar slot
                el.style.border = i >= HOTBAR_START && i === selectedHotbarIdx
                  ? SLOT_BORDER_SELECTED
                  : SLOT_BORDER_DEFAULT
              })

              Option.map(craftingListEl, (container) => {
                container.innerHTML = ''
                if (craftableRecipes.length === 0) {
                  const empty = dom.createElement('div')
                  empty.textContent = 'No craftable recipes yet.'
                  empty.style.cssText = EMPTY_RECIPE_STYLE
                  dom.appendChildTo(container, empty)
                  return
                }

                Arr.forEach(craftableRecipes, (recipe, index) => {
                  const row = dom.createElement('button')
                  row.dataset['recipeId'] = recipe.id
                  const isSelected = index === selectedRecipeIndex
                  row.style.cssText = [
                    RECIPE_ROW_BASE_STYLE,
                    'border:1px solid ' + (isSelected ? RECIPE_ROW_SELECTED_BORDER : RECIPE_ROW_DEFAULT_BORDER),
                    'background:' + (isSelected ? RECIPE_ROW_SELECTED_BG : RECIPE_ROW_DEFAULT_BG),
                  ].join(';')
                  const stationLabel = recipe.station === 'crafting_table'
                    ? ' [Crafting Table]'
                    : recipe.station === 'furnace'
                      ? ' [Furnace]'
                      : ''
                  row.textContent = `${Arr.map(recipe.ingredients, (ingredient) => `${ingredient.count} ${ingredient.blockType}`).join(' + ')} → ${recipe.output.count} ${recipe.output.blockType}${stationLabel}`
                  dom.appendChildTo(container, row)
                })
              })

              Option.map(statusEl, (el) => {
                el.textContent = statusMessage
              })
            })
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
