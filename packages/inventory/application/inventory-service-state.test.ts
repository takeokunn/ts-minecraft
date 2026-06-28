import { describe, it, expect } from '@effect/vitest'
import { Option } from 'effect'
import { SlotIndex } from '@ts-minecraft/core'
import { ItemStack, createStack } from '../domain/item-stack'
import type { InventorySlots } from './inventory-service-types'
import {
  deserializeInventorySlots,
  quickMoveInventorySlots,
  removeBlocksFromInventory,
  serializeInventorySlots,
  sortInventorySlots,
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

  describe('sortInventorySlots', () => {
    it('packs matching stackable items and moves occupied slots to the front', () => {
      const slots = emptySlots()
      slots[5] = Option.some(createStack('DIRT', 40))
      slots[8] = Option.some(createStack('DIRT', 30))
      slots[2] = Option.some(createStack('STONE', 12))

      const sorted = sortInventorySlots(slots)

      expect(Option.getOrThrow(sorted[0] ?? Option.none()).itemType).toBe('DIRT')
      expect(Option.getOrThrow(sorted[0] ?? Option.none()).count).toBe(64)
      expect(Option.getOrThrow(sorted[1] ?? Option.none()).itemType).toBe('DIRT')
      expect(Option.getOrThrow(sorted[1] ?? Option.none()).count).toBe(6)
      expect(Option.getOrThrow(sorted[2] ?? Option.none()).itemType).toBe('STONE')
      expect(Option.getOrThrow(sorted[2] ?? Option.none()).count).toBe(12)
      expect(Option.isNone(sorted[3] ?? Option.none())).toBe(true)
    })

    it('keeps durable or enchanted item instances separate by identity', () => {
      const slots = emptySlots()
      slots[0] = Option.some(new ItemStack({
        itemType: 'IRON_SWORD',
        count: 1,
        durability: 10,
        enchantments: [{ type: 'SHARPNESS', level: 2 }],
      }))
      slots[7] = Option.some(new ItemStack({
        itemType: 'IRON_SWORD',
        count: 1,
        durability: 20,
        enchantments: [{ type: 'SHARPNESS', level: 2 }],
      }))
      slots[8] = Option.some(new ItemStack({
        itemType: 'IRON_SWORD',
        count: 1,
        durability: 10,
        enchantments: [{ type: 'MENDING', level: 1 }],
      }))

      const sorted = sortInventorySlots(slots)
      const occupied = sorted.flatMap((slot) =>
        Option.match(slot, {
          onNone: () => [],
          onSome: (stack) => [stack],
        }))

      expect(occupied).toHaveLength(3)
      expect(occupied.map((stack) => stack.durability)).toEqual([10, 10, 20])
      expect(occupied.map((stack) => stack.enchantments?.[0]?.type)).toEqual(['MENDING', 'SHARPNESS', 'SHARPNESS'])
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
