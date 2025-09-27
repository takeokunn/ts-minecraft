/**
 * InventoryGUIService
 *
 * Bridge between React GUI components and Effect-TS inventory service
 * Handles GUI events and translates them to service calls
 */

import { InventoryService } from '@domain/inventory/InventoryService'
import { InventoryServiceLive } from '@domain/inventory/InventoryServiceLive'
import type { Inventory, PlayerId } from '@domain/inventory/InventoryTypes'
import { Context, Effect, Layer, Match, Option, pipe, Stream } from 'effect'
import type { InventoryGUIConfig, InventoryGUIEvent } from './types'
import { defaultInventoryGUIConfig } from './types'

// =========================================
// Service Interface
// =========================================

export interface InventoryGUIService {
  readonly handleGUIEvent: (playerId: PlayerId, event: InventoryGUIEvent) => Effect.Effect<void, never>

  readonly watchInventory: (playerId: PlayerId) => Stream.Stream<Inventory, never>

  readonly getGUIConfig: () => Effect.Effect<InventoryGUIConfig, never>

  readonly setGUIConfig: (config: Partial<InventoryGUIConfig>) => Effect.Effect<void, never>

  readonly openInventory: (playerId: PlayerId) => Effect.Effect<void, never>

  readonly closeInventory: (playerId: PlayerId) => Effect.Effect<void, never>

  readonly isInventoryOpen: (playerId: PlayerId) => Effect.Effect<boolean, never>
}

// =========================================
// Service Tag
// =========================================

export const InventoryGUIService = Context.GenericTag<InventoryGUIService>(
  '@minecraft/presentation/InventoryGUIService'
)

// =========================================
// Service Implementation
// =========================================

export const InventoryGUIServiceLive = Layer.effect(
  InventoryGUIService,
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService

    // State management
    const openInventories = new Set<PlayerId>()
    let guiConfig = { ...defaultInventoryGUIConfig }

    // =========================================
    // Event Handling
    // =========================================

    const handleGUIEvent = (playerId: PlayerId, event: InventoryGUIEvent) =>
      Effect.gen(function* () {
        yield* pipe(
          Match.value(event),
          Match.tag('SlotClicked', ({ slot, button }) =>
            Effect.gen(function* () {
              const inventory = yield* inventoryService.getInventory(playerId)
              const item = inventory.slots[slot]

              if (!item) return

              yield* pipe(
                Match.value(button),
                Match.when('left', () =>
                  // Left click - select/pickup item
                  inventoryService.setSelectedSlot(playerId, slot)
                ),
                Match.when('right', () =>
                  // Right click - split stack
                  Effect.gen(function* () {
                    const halfAmount = Math.ceil(item.count / 2)
                    // Find empty slot for split
                    const emptySlotCount = yield* inventoryService.getEmptySlotCount(playerId)
                    if (emptySlotCount > 0) {
                      // Implementation would split the stack
                      yield* Effect.logDebug(`Splitting stack at slot ${slot}`)
                    }
                  })
                ),
                Match.when('middle', () =>
                  // Middle click - clone item (creative mode)
                  Effect.logDebug(`Middle click on slot ${slot}`)
                ),
                Match.exhaustive
              )
            })
          ),

          Match.tag('ItemDragStart', ({ slot, item }) =>
            Effect.logDebug(`Drag started from slot ${slot} with item ${item.itemId}`)
          ),

          Match.tag('ItemDragEnd', ({ result }) =>
            Effect.gen(function* () {
              if (Option.isNone(result)) {
                yield* Effect.logDebug('Drag cancelled')
                return
              }

              const dropResult = result.value
              if (!dropResult.accepted) {
                yield* Effect.logDebug('Drop rejected')
                return
              }

              yield* pipe(
                Match.value(dropResult.action),
                Match.when('move', () =>
                  inventoryService.moveItem(playerId, dropResult.sourceSlot, dropResult.targetSlot)
                ),
                Match.when('swap', () =>
                  inventoryService.swapItems(playerId, dropResult.sourceSlot, dropResult.targetSlot)
                ),
                Match.when('merge', () =>
                  inventoryService.mergeStacks(playerId, dropResult.sourceSlot, dropResult.targetSlot)
                ),
                Match.when('split', () =>
                  inventoryService.splitStack(playerId, dropResult.sourceSlot, dropResult.targetSlot, dropResult.amount)
                ),
                Match.when('rejected', () => Effect.logDebug('Drop action rejected')),
                Match.exhaustive
              )
            })
          ),

          Match.tag('ItemDropped', ({ sourceSlot, targetSlot }) =>
            inventoryService.moveItem(playerId, sourceSlot, targetSlot)
          ),

          Match.tag('HotbarSelected', ({ index }) => inventoryService.setSelectedSlot(playerId, index)),

          Match.tag('QuickMove', ({ slot }) =>
            Effect.gen(function* () {
              // Quick move to different section (e.g., hotbar to main)
              const item = yield* inventoryService.getSlotItem(playerId, slot)
              if (!item) return

              // Find appropriate destination
              if (slot < 9) {
                // From hotbar to main inventory
                yield* inventoryService.moveItem(playerId, slot, slot + 9)
              } else {
                // From main to hotbar
                const emptyHotbarSlot = yield* Effect.gen(function* () {
                  for (let i = 0; i < 9; i++) {
                    const slotItem = yield* inventoryService.getSlotItem(playerId, i)
                    if (!slotItem) return Option.some(i)
                  }
                  return Option.none<number>()
                })

                if (Option.isSome(emptyHotbarSlot)) {
                  yield* inventoryService.moveItem(playerId, slot, emptyHotbarSlot.value)
                }
              }
            })
          ),

          Match.tag('QuickDrop', ({ slot, all }) => inventoryService.dropItem(playerId, slot, all ? undefined : 1)),

          Match.tag('InventoryOpened', () =>
            Effect.sync(() => {
              openInventories.add(playerId)
            })
          ),

          Match.tag('InventoryClosed', () =>
            Effect.sync(() => {
              openInventories.delete(playerId)
            })
          ),

          Match.tag('SlotHovered', ({ slot }) => Effect.logDebug(`Slot ${slot} hovered`)),

          Match.tag('SlotUnhovered', ({ slot }) => Effect.logDebug(`Slot ${slot} unhovered`)),

          Match.exhaustive
        )
      }).pipe(Effect.catchAll((error) => Effect.logError(`GUI event error: ${error}`)))

    // =========================================
    // Inventory Watching
    // =========================================

    const watchInventory = (playerId: PlayerId) =>
      Stream.repeatEffect(inventoryService.getInventory(playerId)).pipe(Stream.catchAll(() => Stream.empty))

    // =========================================
    // Configuration Management
    // =========================================

    const getGUIConfig = () => Effect.succeed({ ...guiConfig })

    const setGUIConfig = (config: Partial<InventoryGUIConfig>) =>
      Effect.sync(() => {
        guiConfig = { ...guiConfig, ...config }
      })

    // =========================================
    // Inventory State Management
    // =========================================

    const openInventory = (playerId: PlayerId) =>
      Effect.sync(() => {
        openInventories.add(playerId)
      })

    const closeInventory = (playerId: PlayerId) =>
      Effect.sync(() => {
        openInventories.delete(playerId)
      })

    const isInventoryOpen = (playerId: PlayerId) => Effect.succeed(openInventories.has(playerId))

    return InventoryGUIService.of({
      handleGUIEvent,
      watchInventory,
      getGUIConfig,
      setGUIConfig,
      openInventory,
      closeInventory,
      isInventoryOpen,
    })
  })
).pipe(Layer.provide(InventoryServiceLive))
