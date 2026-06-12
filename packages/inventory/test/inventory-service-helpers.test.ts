import { describe, it } from 'vitest'
import { Array as Arr, Option } from 'effect'
import { expect } from 'vitest'
import { createStack } from '../domain/item-stack'
import {
  fillExistingStacks,
  drainPreferredSlot,
  fillEmptySlots,
} from '../application/inventory-service.helpers'
import type { InventorySlot } from '../application/inventory-service'

// ─── Test helpers ─────────────────────────────────────────────────────────────

const slot = (itemType: 'COBBLESTONE' | 'DIRT' | 'WOOD', count: number): InventorySlot =>
  Option.some(createStack(itemType, count))

const empty = (): InventorySlot => Option.none()

const countOf = (slot: InventorySlot): number =>
  Option.match(slot, { onNone: () => 0, onSome: (s) => s.count })

const typeOf = (slot: InventorySlot): string | null =>
  Option.match(slot, { onNone: () => null, onSome: (s) => s.itemType })

// ─── fillExistingStacks ───────────────────────────────────────────────────────

describe('fillExistingStacks', () => {
  it('fills a partial stack up to maxStack', () => {
    const slots = [slot('COBBLESTONE', 30), empty(), empty()]
    const [updated, remaining] = fillExistingStacks(slots, 'COBBLESTONE', 20, 64)
    expect(countOf(updated[0]!)).toBe(50)
    expect(remaining).toBe(0)
  })

  it('returns leftover count when adding exceeds maxStack', () => {
    const slots = [slot('COBBLESTONE', 50), empty()]
    const [updated, remaining] = fillExistingStacks(slots, 'COBBLESTONE', 20, 64)
    expect(countOf(updated[0]!)).toBe(64)
    expect(remaining).toBe(6)
  })

  it('fills across multiple partial stacks of the same type', () => {
    const slots = [slot('COBBLESTONE', 32), slot('COBBLESTONE', 32), empty()]
    const [updated, remaining] = fillExistingStacks(slots, 'COBBLESTONE', 40, 64)
    expect(countOf(updated[0]!)).toBe(64)
    expect(countOf(updated[1]!)).toBe(40)
    expect(remaining).toBe(0)
  })

  it('ignores slots with different item type', () => {
    const slots = [slot('DIRT', 10), slot('COBBLESTONE', 20)]
    const [updated, remaining] = fillExistingStacks(slots, 'COBBLESTONE', 5, 64)
    expect(countOf(updated[0]!)).toBe(10)
    expect(typeOf(updated[0]!)).toBe('DIRT')
    expect(countOf(updated[1]!)).toBe(25)
    expect(remaining).toBe(0)
  })

  it('leaves empty slots untouched', () => {
    const slots = [empty(), slot('COBBLESTONE', 10), empty()]
    const [updated, remaining] = fillExistingStacks(slots, 'COBBLESTONE', 5, 64)
    expect(typeOf(updated[0]!)).toBeNull()
    expect(countOf(updated[1]!)).toBe(15)
    expect(remaining).toBe(0)
  })

  it('returns full count unchanged when no matching partial stacks exist', () => {
    const slots = [empty(), empty()]
    const [updated, remaining] = fillExistingStacks(slots, 'COBBLESTONE', 10, 64)
    expect(Arr.every(updated, (s) => Option.isNone(s))).toBe(true)
    expect(remaining).toBe(10)
  })

  it('does not modify a full stack', () => {
    const slots = [slot('COBBLESTONE', 64)]
    const [updated, remaining] = fillExistingStacks(slots, 'COBBLESTONE', 5, 64)
    expect(countOf(updated[0]!)).toBe(64)
    expect(remaining).toBe(5)
  })
})

// ─── drainPreferredSlot ───────────────────────────────────────────────────────

describe('drainPreferredSlot', () => {
  it('drains the exact count from the preferred slot', () => {
    const slots = [slot('COBBLESTONE', 20), slot('COBBLESTONE', 10)]
    const [remaining, updated] = drainPreferredSlot(slots, 'COBBLESTONE', 5, Option.some(0))
    expect(countOf(updated[0]!)).toBe(15)
    expect(countOf(updated[1]!)).toBe(10)
    expect(remaining).toBe(0)
  })

  it('drains all available when count exceeds stack size', () => {
    const slots = [slot('COBBLESTONE', 3), slot('COBBLESTONE', 20)]
    const [remaining, updated] = drainPreferredSlot(slots, 'COBBLESTONE', 10, Option.some(0))
    expect(countOf(updated[0]!)).toBe(0)
    expect(remaining).toBe(7)
  })

  it('empties the slot when count equals stack size', () => {
    const slots = [slot('COBBLESTONE', 5), slot('COBBLESTONE', 10)]
    const [remaining, updated] = drainPreferredSlot(slots, 'COBBLESTONE', 5, Option.some(0))
    expect(typeOf(updated[0]!)).toBeNull()
    expect(remaining).toBe(0)
  })

  it('returns unchanged when preferred slot has wrong item type', () => {
    const slots = [slot('DIRT', 10), slot('COBBLESTONE', 10)]
    const [remaining, updated] = drainPreferredSlot(slots, 'COBBLESTONE', 5, Option.some(0))
    expect(countOf(updated[0]!)).toBe(10)
    expect(countOf(updated[1]!)).toBe(10)
    expect(remaining).toBe(5)
  })

  it('returns unchanged when no preferred slot given', () => {
    const slots = [slot('COBBLESTONE', 10)]
    const [remaining, updated] = drainPreferredSlot(slots, 'COBBLESTONE', 5, Option.none())
    expect(countOf(updated[0]!)).toBe(10)
    expect(remaining).toBe(5)
  })

  it('returns unchanged when preferred slot is empty', () => {
    const slots = [empty(), slot('COBBLESTONE', 10)]
    const [remaining, updated] = drainPreferredSlot(slots, 'COBBLESTONE', 5, Option.some(0))
    expect(typeOf(updated[0]!)).toBeNull()
    expect(countOf(updated[1]!)).toBe(10)
    expect(remaining).toBe(5)
  })
})

// ─── fillEmptySlots ───────────────────────────────────────────────────────────

describe('fillEmptySlots', () => {
  it('fills a single empty slot', () => {
    const slots = [empty()]
    const [updated, remaining] = fillEmptySlots(slots, 'COBBLESTONE', 10, 64)
    expect(countOf(updated[0]!)).toBe(10)
    expect(typeOf(updated[0]!)).toBe('COBBLESTONE')
    expect(remaining).toBe(0)
  })

  it('creates full stacks and distributes remainder across multiple empty slots', () => {
    const slots = [empty(), empty(), empty()]
    const [updated, remaining] = fillEmptySlots(slots, 'COBBLESTONE', 150, 64)
    expect(countOf(updated[0]!)).toBe(64)
    expect(countOf(updated[1]!)).toBe(64)
    expect(countOf(updated[2]!)).toBe(22)
    expect(remaining).toBe(0)
  })

  it('returns leftover when more items than empty slots can hold', () => {
    const slots = [empty()]
    const [updated, remaining] = fillEmptySlots(slots, 'COBBLESTONE', 100, 64)
    expect(countOf(updated[0]!)).toBe(64)
    expect(remaining).toBe(36)
  })

  it('skips occupied slots', () => {
    const slots = [slot('DIRT', 5), empty()]
    const [updated, remaining] = fillEmptySlots(slots, 'COBBLESTONE', 10, 64)
    expect(typeOf(updated[0]!)).toBe('DIRT')
    expect(countOf(updated[0]!)).toBe(5)
    expect(typeOf(updated[1]!)).toBe('COBBLESTONE')
    expect(countOf(updated[1]!)).toBe(10)
    expect(remaining).toBe(0)
  })

  it('returns full count unchanged when no empty slots', () => {
    const slots = [slot('DIRT', 5), slot('WOOD', 3)]
    const [updated, remaining] = fillEmptySlots(slots, 'COBBLESTONE', 10, 64)
    expect(typeOf(updated[0]!)).toBe('DIRT')
    expect(typeOf(updated[1]!)).toBe('WOOD')
    expect(remaining).toBe(10)
  })
})
