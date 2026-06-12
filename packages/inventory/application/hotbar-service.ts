import { Array as Arr, Effect, Option, Ref } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { InventoryService, HOTBAR_SIZE, HOTBAR_START } from './inventory-service'
import { PlayerInputService } from '@ts-minecraft/entity/application/player-input-service'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { SlotIndex } from '@ts-minecraft/core'

export { HOTBAR_SIZE }

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
        getSelectedSlot: (): Effect.Effect<SlotIndex, never> =>
          Ref.get(selectedSlotRef),

        setSelectedSlot: (slot: SlotIndex): Effect.Effect<void, never> =>
          Ref.set(selectedSlotRef, SlotIndex.make(Math.max(0, Math.min(HOTBAR_SIZE - 1, SlotIndex.toNumber(slot))))),

        getSelectedBlockType: (): Effect.Effect<Option.Option<InventoryItem>, never> =>
          Effect.gen(function* () {
            const slot = yield* Ref.get(selectedSlotRef)
            const inventorySlot = yield* inventoryService.getSlot(SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(slot)))
            return Option.map(inventorySlot, (stack) => stack.itemType)
          }),

        getSlots: (): Effect.Effect<ReadonlyArray<Option.Option<InventoryItem>>, never> =>
          Effect.gen(function* () {
            const hotbarSlots = yield* inventoryService.getHotbarSlots()
            return Arr.map(hotbarSlots, (slot) => Option.map(slot, (stack) => stack.itemType))
          }),

        update: (): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const keyFound = yield* Effect.reduce(
              Arr.map(hotbarKeys, (key, i) => [i, key] as const),
              false,
              (found, [i, key]) =>
                found
                  ? Effect.succeed(true)
                  : Effect.gen(function* () {
                      const pressed = yield* inputService.consumeKeyPress(key)
                      if (!pressed) return false
                      yield* Ref.set(selectedSlotRef, SlotIndex.make(i))
                      return true
                    })
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
