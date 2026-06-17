import { describe, expect, it } from '@effect/vitest'
import { Option } from 'effect'
import { createStack, ItemStack } from '../domain/item-stack'
import type { InventorySlots } from '../application/inventory-service-types'
import {
  moveStackInInventorySlots,
  repairMendingInventorySlotsWithXP,
} from '../application/inventory-service-state'
import { asSlotIndex } from '../test/inventory-service-test-utils'

const emptySlots = (): InventorySlots => Array.from({ length: 36 }, () => Option.none())

const mkMendingPickaxe = (durability: number): ItemStack =>
  new ItemStack({
    itemType: 'DIAMOND_PICKAXE',
    count: 1,
    durability,
    enchantments: [{ type: 'MENDING', level: 1 }],
  })

describe('application/inventory/inventory-service-state', () => {
  describe('moveStackInInventorySlots', () => {
    it('moves a stack to an empty slot', () => {
      const slots = emptySlots()
      slots[0] = Option.some(createStack('DIRT', 10))

      const moved = moveStackInInventorySlots(slots, asSlotIndex(0), asSlotIndex(1))

      expect(Option.isNone(moved[0])).toBe(true)
      expect(Option.getOrThrow(moved[1]).itemType).toBe('DIRT')
      expect(Option.getOrThrow(moved[1]).count).toBe(10)
    })

    it('merges compatible stacks and leaves a remainder when full', () => {
      const slots = emptySlots()
      slots[0] = Option.some(createStack('STONE', 10))
      slots[1] = Option.some(createStack('STONE', 60))

      const moved = moveStackInInventorySlots(slots, asSlotIndex(0), asSlotIndex(1))

      expect(Option.getOrThrow(moved[1]).count).toBe(64)
      expect(Option.getOrThrow(moved[0]).count).toBe(6)
    })

    it('swaps incompatible stacks', () => {
      const slots = emptySlots()
      slots[0] = Option.some(createStack('DIRT', 5))
      slots[1] = Option.some(createStack('WOOD', 3))

      const moved = moveStackInInventorySlots(slots, asSlotIndex(0), asSlotIndex(1))

      expect(Option.getOrThrow(moved[0]).itemType).toBe('WOOD')
      expect(Option.getOrThrow(moved[0]).count).toBe(3)
      expect(Option.getOrThrow(moved[1]).itemType).toBe('DIRT')
      expect(Option.getOrThrow(moved[1]).count).toBe(5)
    })

    it('swaps same-type tools instead of merging, preserving durability', () => {
      const slots = emptySlots()
      slots[0] = Option.some(new ItemStack({ itemType: 'WOODEN_PICKAXE', count: 1, durability: 50 }))
      slots[1] = Option.some(new ItemStack({ itemType: 'WOODEN_PICKAXE', count: 1, durability: 20 }))

      const moved = moveStackInInventorySlots(slots, asSlotIndex(0), asSlotIndex(1))

      expect(Option.getOrThrow(moved[0]).durability).toBe(20)
      expect(Option.getOrThrow(moved[1]).durability).toBe(50)
    })

    it('does nothing when source is empty or source and destination are identical', () => {
      const slots = emptySlots()
      slots[1] = Option.some(createStack('GLASS', 2))

      const emptySource = moveStackInInventorySlots(slots, asSlotIndex(0), asSlotIndex(1))
      const sameSlot = moveStackInInventorySlots(slots, asSlotIndex(1), asSlotIndex(1))

      expect(emptySource).toEqual(slots)
      expect(sameSlot).toEqual(slots)
    })
  })

  describe('repairMendingInventorySlotsWithXP', () => {
    it('repairs multiple Mending stacks in order and preserves fractional XP', () => {
      const slots = emptySlots()
      slots[0] = Option.some(mkMendingPickaxe(1559))
      slots[1] = Option.some(mkMendingPickaxe(1557))

      const [remaining, nextSlots] = repairMendingInventorySlotsWithXP(slots, 3.5)

      expect(remaining).toBe(0.5)
      expect(Option.getOrThrow(nextSlots[0]).durability).toBe(1561)
      expect(Option.getOrThrow(nextSlots[1]).durability).toBe(1561)
    })

    it('returns non-positive XP unchanged without touching slots', () => {
      const slots = emptySlots()
      slots[0] = Option.some(mkMendingPickaxe(1559))

      expect(repairMendingInventorySlotsWithXP(slots, 0)).toEqual([0, slots])
      expect(repairMendingInventorySlotsWithXP(slots, -2)).toEqual([-2, slots])
      expect(Option.getOrThrow(slots[0]).durability).toBe(1559)
    })
  })
})
