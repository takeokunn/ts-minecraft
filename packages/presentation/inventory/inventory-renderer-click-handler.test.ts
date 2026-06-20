import { describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect, vi } from 'vitest'
import { SlotIndex } from '@ts-minecraft/core'
import { type ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { type EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import {
  type InventoryService,
  type InventorySlot,
} from '@ts-minecraft/inventory/application/inventory-service'
import { createStack } from '@ts-minecraft/inventory/domain/item-stack'
import { shiftQuickMoveInventorySlot } from './inventory-renderer-click-handler'

const emptySlot = (): InventorySlot => Option.none()
const stackSlot = (): InventorySlot => Option.some(createStack('IRON_HELMET'))

const makeDeps = ({
  slot = stackSlot(),
  hasChest = false,
  equipResult = true,
}: {
  readonly slot?: InventorySlot
  readonly hasChest?: boolean
  readonly equipResult?: boolean
} = {}) => {
  const getSlot = vi.fn((_: SlotIndex) => Effect.succeed(slot))
  const setSlot = vi.fn((_: SlotIndex, __: InventorySlot) => Effect.void)
  const quickMove = vi.fn((_: SlotIndex) => Effect.void)
  const quickMoveInventoryToChest = vi.fn((_: SlotIndex) => Effect.void)
  const equipIfSlotEmpty = vi.fn((_: unknown) => Effect.succeed(equipResult))

  return {
    deps: {
      chestService: {
        hasNearbyChest: () => Effect.succeed(hasChest),
        quickMoveInventoryToChest,
      } as unknown as ChestService,
      inventoryService: {
        getSlot,
        setSlot,
        quickMove,
      } as unknown as InventoryService,
      equipmentService: {
        equipIfSlotEmpty,
      } as unknown as EquipmentService,
    },
    getSlot,
    setSlot,
    quickMove,
    quickMoveInventoryToChest,
    equipIfSlotEmpty,
  }
}

describe('inventory-renderer-click-handler', () => {
  it.effect('shift-click equips armor into an empty matching armor slot', () =>
    Effect.gen(function* () {
      const { deps, setSlot, quickMove, quickMoveInventoryToChest, equipIfSlotEmpty } = makeDeps()

      yield* shiftQuickMoveInventorySlot(deps, SlotIndex.make(5))

      expect(equipIfSlotEmpty).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'IRON_HELMET' }))
      expect(setSlot).toHaveBeenCalledTimes(1)
      expect(Option.isNone(setSlot.mock.calls[0][1])).toBe(true)
      expect(quickMove).not.toHaveBeenCalled()
      expect(quickMoveInventoryToChest).not.toHaveBeenCalled()
    })
  )

  it.effect('falls back to inventory quick move when armor cannot be equipped', () =>
    Effect.gen(function* () {
      const { deps, setSlot, quickMove, equipIfSlotEmpty } = makeDeps({ equipResult: false })

      yield* shiftQuickMoveInventorySlot(deps, SlotIndex.make(5))

      expect(equipIfSlotEmpty).toHaveBeenCalledTimes(1)
      expect(quickMove).toHaveBeenCalledWith(SlotIndex.make(5))
      expect(setSlot).not.toHaveBeenCalled()
    })
  )

  it.effect('keeps chest quick move higher priority than armor auto-equip', () =>
    Effect.gen(function* () {
      const { deps, quickMove, quickMoveInventoryToChest, equipIfSlotEmpty } = makeDeps({ hasChest: true })

      yield* shiftQuickMoveInventorySlot(deps, SlotIndex.make(5))

      expect(quickMoveInventoryToChest).toHaveBeenCalledWith(SlotIndex.make(5))
      expect(equipIfSlotEmpty).not.toHaveBeenCalled()
      expect(quickMove).not.toHaveBeenCalled()
    })
  )

  it.effect('falls back to inventory quick move for empty clicked slots', () =>
    Effect.gen(function* () {
      const { deps, setSlot, quickMove, equipIfSlotEmpty } = makeDeps({ slot: emptySlot() })

      yield* shiftQuickMoveInventorySlot(deps, SlotIndex.make(5))

      expect(equipIfSlotEmpty).not.toHaveBeenCalled()
      expect(quickMove).toHaveBeenCalledWith(SlotIndex.make(5))
      expect(setSlot).not.toHaveBeenCalled()
    })
  )
})
