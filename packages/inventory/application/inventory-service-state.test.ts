import { describe, it, expect } from '@effect/vitest'
import { Option } from 'effect'
import { SlotIndex } from '@ts-minecraft/core'
import { createStack } from '../domain/item-stack'
import type { InventorySlots } from './inventory-service-types'
import {
  deserializeInventorySlots,
  quickMoveInventorySlots,
  removeBlocksFromInventory,
  serializeInventorySlots,
} from './inventory-service-state'
import { asSlotIndex } from '../test/inventory-service-test-utils'

const emptySlots = (): InventorySlots => Array.from({ length: 36 }, () => Option.none())

describe('application/inventory/inventory-service-state', () => {
  describe('serializeInventorySlots / deserializeInventorySlots', () => {
    it('round-trips sparse inventory state', () => {
      const slots = emptySlots()
      slots[1] = Option.some(createStack('STONE', 8))
      slots[35] = Option.some(createStack('DIRT', 1))

      const serialized = serializeInventorySlots(slots)
      const restored = deserializeInventorySlots(serialized)

      expect(restored).toEqual(slots)
      expect(Option.isNone(serialized.slots[0])).toBe(true)
      expect(Option.getOrThrow(serialized.slots[1]).slot).toBe(SlotIndex.make(1))
      expect(Option.getOrThrow(serialized.slots[35]).durability).toBeNull()
    })

    it('ignores out-of-range entries when deserializing', () => {
      const data = {
        slots: [
          Option.none(),
          Option.some({ slot: asSlotIndex(-1), itemType: 'STONE' as const, count: 9, durability: null }),
          Option.some({ slot: asSlotIndex(5), itemType: 'WOOD' as const, count: 4, durability: null }),
          Option.some({ slot: asSlotIndex(99), itemType: 'DIRT' as const, count: 2, durability: null }),
        ],
      }

      const restored = deserializeInventorySlots(data)

      expect(Option.isNone(restored[0])).toBe(true)
      expect(Option.isNone(restored[1])).toBe(true)
      expect(Option.isSome(restored[5])).toBe(true)
      expect(Option.getOrThrow(restored[5]).itemType).toBe('WOOD')
    })
  })

  describe('quickMoveInventorySlots', () => {
    it('moves a stack to the opposite region and merges into existing stacks first', () => {
      const slots = emptySlots()
      slots[0] = Option.some(createStack('STONE', 20))
      slots[27] = Option.some(createStack('STONE', 30))

      const moved = quickMoveInventorySlots(slots, asSlotIndex(0))

      expect(Option.isNone(moved[0])).toBe(true)
      expect(Option.isSome(moved[27])).toBe(true)
      expect(Option.getOrThrow(moved[27]).count).toBe(50)
    })
  })

  describe('removeBlocksFromInventory', () => {
    it('drains the preferred slot before other slots', () => {
      const slots = emptySlots()
      slots[0] = Option.some(createStack('STONE', 5))
      slots[1] = Option.some(createStack('STONE', 2))

      const [ok, nextSlots] = removeBlocksFromInventory(slots, 'STONE', 6, asSlotIndex(1))

      expect(ok).toBe(true)
      expect(Option.isSome(nextSlots[0])).toBe(true)
      expect(Option.getOrThrow(nextSlots[0]).count).toBe(1)
      expect(Option.isNone(nextSlots[1])).toBe(true)
    })

    it('rolls back when the inventory does not have enough items', () => {
      const slots = emptySlots()
      slots[0] = Option.some(createStack('STONE', 3))

      const [ok, nextSlots] = removeBlocksFromInventory(slots, 'STONE', 4)

      expect(ok).toBe(false)
      expect(nextSlots).toEqual(slots)
    })
  })
})
