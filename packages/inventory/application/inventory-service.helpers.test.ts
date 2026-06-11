import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { fillExistingStacks, drainPreferredSlot, fillEmptySlots } from './inventory-service.helpers'
import type { InventorySlots } from './inventory-service'
import { createStack } from '../domain/item-stack'

const MAX_STACK = 64
const empty = Option.none()
const slot = (type: string, count: number) => Option.some(createStack(type as never, count))

describe('fillExistingStacks', () => {
  it('fills partial stacks of the same type', () => {
    // count=50: fills s0 (30→64 uses 34), then s2 (20→36 uses 16), total 50
    const slots: InventorySlots = [slot('STONE', 30), empty, slot('STONE', 20)]
    const [updated, remaining] = fillExistingStacks(slots, 'STONE', 50, MAX_STACK)
    const s0 = Option.getOrNull(updated[0]!)
    const s2 = Option.getOrNull(updated[2]!)
    expect(s0?.count).toBe(64)
    expect(s2?.count).toBe(36)
    expect(remaining).toBe(0)
  })

  it('leaves excess remaining when stacks are full', () => {
    const slots: InventorySlots = [slot('STONE', 64)]
    const [, remaining] = fillExistingStacks(slots, 'STONE', 10, MAX_STACK)
    expect(remaining).toBe(10)
  })

  it('skips slots of different item types', () => {
    const slots: InventorySlots = [slot('DIRT', 30), slot('STONE', 30)]
    const [updated, remaining] = fillExistingStacks(slots, 'DIRT', 20, MAX_STACK)
    const s0 = Option.getOrNull(updated[0]!)
    const s1 = Option.getOrNull(updated[1]!)
    expect(s0?.count).toBe(50)
    expect(s1?.count).toBe(30)
    expect(remaining).toBe(0)
  })

  it('does not modify empty slots', () => {
    const slots: InventorySlots = [empty, empty]
    const [updated, remaining] = fillExistingStacks(slots, 'STONE', 10, MAX_STACK)
    expect(Option.isNone(updated[0]!)).toBe(true)
    expect(remaining).toBe(10)
  })

  it('returns all items as remaining when no matching slots exist', () => {
    const slots: InventorySlots = [slot('DIRT', 10)]
    const [, remaining] = fillExistingStacks(slots, 'STONE', 5, MAX_STACK)
    expect(remaining).toBe(5)
  })

  it('distributes across multiple partial stacks in order', () => {
    // Each slot has space 4; 3 slots × 4 = 12 capacity. 15 items: fills all 3 slots, 3 remain.
    const slots: InventorySlots = [slot('STONE', 60), slot('STONE', 60), slot('STONE', 60)]
    const [updated, remaining] = fillExistingStacks(slots, 'STONE', 15, MAX_STACK)
    const s0 = Option.getOrNull(updated[0]!)
    const s1 = Option.getOrNull(updated[1]!)
    const s2 = Option.getOrNull(updated[2]!)
    expect(s0?.count).toBe(64)
    expect(s1?.count).toBe(64)
    expect(s2?.count).toBe(64)
    expect(remaining).toBe(3)
  })
})

describe('fillEmptySlots', () => {
  it('fills empty slots with new stacks', () => {
    const slots: InventorySlots = [empty, empty, slot('STONE', 5)]
    const [updated, remaining] = fillEmptySlots(slots, 'DIRT', 100, MAX_STACK)
    const s0 = Option.getOrNull(updated[0]!)
    const s1 = Option.getOrNull(updated[1]!)
    expect(s0?.itemType).toBe('DIRT')
    expect(s0?.count).toBe(64)
    expect(s1?.count).toBe(36)
    expect(remaining).toBe(0)
  })

  it('returns remaining when no empty slots', () => {
    const slots: InventorySlots = [slot('STONE', 1), slot('STONE', 1)]
    const [, remaining] = fillEmptySlots(slots, 'DIRT', 10, MAX_STACK)
    expect(remaining).toBe(10)
  })

  it('respects maxStack per slot', () => {
    const slots: InventorySlots = [empty]
    const [updated, remaining] = fillEmptySlots(slots, 'STONE', 10, 5)
    const s0 = Option.getOrNull(updated[0]!)
    expect(s0?.count).toBe(5)
    expect(remaining).toBe(5)
  })

  it('does not touch existing non-empty slots', () => {
    const slots: InventorySlots = [slot('DIRT', 10), empty]
    const [updated] = fillEmptySlots(slots, 'STONE', 5, MAX_STACK)
    const s0 = Option.getOrNull(updated[0]!)
    expect(s0?.itemType).toBe('DIRT')
    expect(s0?.count).toBe(10)
  })
})

describe('drainPreferredSlot', () => {
  it('drains from preferred slot when it matches', () => {
    const slots: InventorySlots = [slot('STONE', 10), slot('DIRT', 5)]
    const [remaining, updated] = drainPreferredSlot(slots, 'STONE', 3, Option.some(0))
    const s0 = Option.getOrNull(updated[0]!)
    expect(s0?.count).toBe(7)
    expect(remaining).toBe(0)
  })

  it('returns original count when preferred slot has different item type', () => {
    const slots: InventorySlots = [slot('DIRT', 10), slot('STONE', 10)]
    const [remaining, updated] = drainPreferredSlot(slots, 'STONE', 5, Option.some(0))
    expect(remaining).toBe(5)
    const s0 = Option.getOrNull(updated[0]!)
    expect(s0?.count).toBe(10)
  })

  it('returns original when no preferred slot (none)', () => {
    const slots: InventorySlots = [slot('STONE', 10)]
    const [remaining] = drainPreferredSlot(slots, 'STONE', 3, Option.none())
    expect(remaining).toBe(3)
  })

  it('clamps drain to available count', () => {
    const slots: InventorySlots = [slot('STONE', 2)]
    const [remaining, updated] = drainPreferredSlot(slots, 'STONE', 10, Option.some(0))
    expect(remaining).toBe(8)
    expect(Option.isNone(updated[0]!)).toBe(true)
  })

  it('returns original count when preferred slot is empty', () => {
    const slots: InventorySlots = [empty, slot('STONE', 10)]
    const [remaining] = drainPreferredSlot(slots, 'STONE', 5, Option.some(0))
    expect(remaining).toBe(5)
  })
})
