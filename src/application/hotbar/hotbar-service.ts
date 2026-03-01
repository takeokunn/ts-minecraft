import { Effect, Context, Layer, Option, Ref } from 'effect'
import type { BlockType } from '@/domain/block'
import { InventoryService, HOTBAR_SIZE, HOTBAR_START } from '@/application/inventory/inventory-service'
import { InputService, KeyMappings } from '@/presentation/input/input-service'

export { HOTBAR_SIZE }

/**
 * Service interface for managing the player's hotbar
 *
 * The hotbar is a view over InventoryService slots 27-35 (the bottom row).
 * Slot indices 0-8 in HotbarService map to inventory indices 27-35.
 */
export interface HotbarService {
  /**
   * Get the currently selected slot index (0-8)
   */
  readonly getSelectedSlot: () => Effect.Effect<number, never>

  /**
   * Set the selected slot index (clamped to 0-8)
   */
  readonly setSelectedSlot: (slot: number) => Effect.Effect<void, never>

  /**
   * Get the BlockType for the currently selected slot.
   * Returns Option.none() if the slot is empty or index is out of bounds.
   */
  readonly getSelectedBlockType: () => Effect.Effect<Option.Option<BlockType>, never>

  /**
   * Get all hotbar slot block types (array of length HOTBAR_SIZE, entries may be None).
   * Maps InventoryService slots 27-35, discarding item count.
   */
  readonly getSlots: () => Effect.Effect<ReadonlyArray<Option.Option<BlockType>>, never>

  /**
   * Process input for slot selection (call once per frame from game loop).
   * Handles Digit1-9 key presses and mouse wheel scrolling.
   */
  readonly update: () => Effect.Effect<void, never>
}

/**
 * Context tag for HotbarService
 */
export const HotbarService = Context.GenericTag<HotbarService>('@minecraft/application/HotbarService')

/**
 * Live implementation of HotbarService
 *
 * A thin projection over InventoryService slots 27-35.
 * Selected slot state is managed locally; slot content comes from InventoryService.
 */
export const HotbarServiceLive = Layer.effect(
  HotbarService,
  Effect.gen(function* () {
    const inputService = yield* InputService
    const inventoryService = yield* InventoryService

    const selectedSlotRef = yield* Ref.make<number>(0)

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

    return HotbarService.of({
      getSelectedSlot: () => Ref.get(selectedSlotRef),

      setSelectedSlot: (slot) =>
        Ref.set(selectedSlotRef, Math.max(0, Math.min(HOTBAR_SIZE - 1, slot))),

      getSelectedBlockType: () =>
        Effect.gen(function* () {
          const slot = yield* Ref.get(selectedSlotRef)
          const inventorySlot = yield* inventoryService.getSlot(HOTBAR_START + slot)
          return Option.map(inventorySlot, (stack) => stack.blockType)
        }),

      getSlots: () =>
        Effect.gen(function* () {
          const hotbarSlots = yield* inventoryService.getHotbarSlots()
          return hotbarSlots.map((slot) => Option.map(slot, (stack) => stack.blockType))
        }),

      update: () =>
        Effect.gen(function* () {
          for (let i = 0; i < hotbarKeys.length; i++) {
            const key = hotbarKeys[i]
            if (key !== undefined) {
              const pressed = yield* inputService.consumeKeyPress(key)
              if (pressed) {
                yield* Ref.set(selectedSlotRef, i)
                return
              }
            }
          }

          const wheelDelta = yield* inputService.consumeWheelDelta()
          if (wheelDelta !== 0) {
            const current = yield* Ref.get(selectedSlotRef)
            const direction = wheelDelta > 0 ? 1 : -1
            const next = (current + direction + HOTBAR_SIZE) % HOTBAR_SIZE
            yield* Ref.set(selectedSlotRef, next)
          }
        }),
    })
  })
)
