import { Array as Arr, Effect, Option, Ref } from 'effect'
import type { BlockType } from '@/domain/block'
import { InventoryService, HOTBAR_SIZE, HOTBAR_START } from '@/application/inventory/inventory-service'
import { PlayerInputService } from '@/application/input/player-input-service'
import { KeyMappings } from '@/application/input/key-mappings'
import { SlotIndex } from '@/shared/kernel'

export { HOTBAR_SIZE }

/**
 * Service interface for managing the player's hotbar
 *
 * The hotbar is a view over InventoryService slots 27-35 (the bottom row).
 * Slot indices 0-8 in HotbarService map to inventory indices 27-35.
 */

/**
 * Context tag for HotbarService
 */

/**
 * Live implementation of HotbarService
 *
 * A thin projection over InventoryService slots 27-35.
 * Selected slot state is managed locally; slot content comes from InventoryService.
 */
export class HotbarService extends Effect.Service<HotbarService>()(
  '@minecraft/application/HotbarService',
  {
    effect: Effect.gen(function* () {
      const inputService = yield* PlayerInputService
      const inventoryService = yield* InventoryService

      const selectedSlotRef = yield* Ref.make<SlotIndex>(SlotIndex.make(0))

      const hotbarKeys: ReadonlyArray<string> = [
        KeyMappings.HOTBAR_SLOT_1,
        KeyMappings.HOTBAR_SLOT_2,
        KeyMappings.HOTBAR_SLOT_3,
        KeyMappings.HOTBAR_SLOT_4,
        KeyMappings.HOTBAR_SLOT_5,
        KeyMappings.HOTBAR_SLOT_6,
        KeyMappings.HOTBAR_SLOT_7,
        KeyMappings.HOTBAR_SLOT_8,
        KeyMappings.HOTBAR_SLOT_9,
      ]

      return {
        /**
         * Get the currently selected slot index (0-8)
         */
        getSelectedSlot: (): Effect.Effect<SlotIndex, never> =>
          Ref.get(selectedSlotRef),

        /**
         * Set the selected slot index (clamped to 0-8)
         */
        setSelectedSlot: (slot: SlotIndex): Effect.Effect<void, never> =>
          Ref.set(selectedSlotRef, SlotIndex.make(Math.max(0, Math.min(HOTBAR_SIZE - 1, SlotIndex.toNumber(slot))))),

        /**
         * Get the BlockType for the currently selected slot.
         * Returns Option.none() if the slot is empty or index is out of bounds.
         */
        getSelectedBlockType: (): Effect.Effect<Option.Option<BlockType>, never> =>
          Effect.gen(function* () {
            const slot = yield* Ref.get(selectedSlotRef)
            const inventorySlot = yield* inventoryService.getSlot(SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(slot)))
            return Option.map(inventorySlot, (stack) => stack.blockType)
          }),

        /**
         * Get all hotbar slot block types (array of length HOTBAR_SIZE, entries may be None).
         * Maps InventoryService slots 27-35, discarding item count.
         */
        getSlots: (): Effect.Effect<ReadonlyArray<Option.Option<BlockType>>, never> =>
          Effect.gen(function* () {
            const hotbarSlots = yield* inventoryService.getHotbarSlots()
            return Arr.map(hotbarSlots, (slot) => Option.map(slot, (stack) => stack.blockType))
          }),

        /**
         * Process input for slot selection (call once per frame from game loop).
         * Handles Digit1-9 key presses and mouse wheel scrolling.
         */
        update: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const keyFound = yield* Effect.reduce(
              Arr.map(hotbarKeys, (key, i) => [i, key] as const),
              false,
              (found, [i, key]) =>
                found
                  ? Effect.succeed(true)
                  : inputService.consumeKeyPress(key).pipe(
                      Effect.flatMap((pressed) =>
                        pressed
                          ? Ref.set(selectedSlotRef, SlotIndex.make(i)).pipe(Effect.as(true))
                          : Effect.succeed(false)
                      )
                    )
            )

            if (keyFound) return

            const wheelDelta = yield* inputService.consumeWheelDelta()
            if (wheelDelta !== 0) {
              const direction = wheelDelta > 0 ? 1 : -1
              yield* Ref.update(selectedSlotRef, (cur) =>
                SlotIndex.make((SlotIndex.toNumber(cur) + direction + HOTBAR_SIZE) % HOTBAR_SIZE)
              )
            }
          }),
      }
    }),
  }
) {}

export const HotbarServiceLive = HotbarService.Default
