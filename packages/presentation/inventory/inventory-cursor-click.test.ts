import { describe, it } from '@effect/vitest'
import { Option } from 'effect'
import { expect } from 'vitest'
import { type InventorySlot } from '@ts-minecraft/inventory/application/inventory-service'
import { createStack } from '@ts-minecraft/inventory/domain/item-stack'
import { applyInventoryCursorClick } from './inventory-cursor-click'

const stack = (itemType: 'DIRT' | 'STONE', count: number): InventorySlot =>
  Option.some(createStack(itemType, count))

const empty = (): InventorySlot => Option.none()

const countOf = (slot: InventorySlot): number =>
  Option.match(slot, { onNone: () => 0, onSome: (item) => item.count })

const typeOf = (slot: InventorySlot): string | null =>
  Option.match(slot, { onNone: () => null, onSome: (item) => item.itemType })

describe('presentation/inventory/inventory-cursor-click', () => {
  it('primary click picks up a stack when the cursor is empty', () => {
    const result = applyInventoryCursorClick({ slot: stack('DIRT', 12), cursor: empty() }, 'primary')

    expect(Option.isNone(result.slot)).toBe(true)
    expect(typeOf(result.cursor)).toBe('DIRT')
    expect(countOf(result.cursor)).toBe(12)
  })

  it('primary click places the full cursor stack into an empty slot', () => {
    const result = applyInventoryCursorClick({ slot: empty(), cursor: stack('DIRT', 12) }, 'primary')

    expect(typeOf(result.slot)).toBe('DIRT')
    expect(countOf(result.slot)).toBe(12)
    expect(Option.isNone(result.cursor)).toBe(true)
  })

  it('primary click merges matching stacks and leaves overflow on the cursor', () => {
    const result = applyInventoryCursorClick({ slot: stack('DIRT', 60), cursor: stack('DIRT', 10) }, 'primary')

    expect(countOf(result.slot)).toBe(64)
    expect(typeOf(result.cursor)).toBe('DIRT')
    expect(countOf(result.cursor)).toBe(6)
  })

  it('primary click swaps different occupied stacks', () => {
    const result = applyInventoryCursorClick({ slot: stack('STONE', 8), cursor: stack('DIRT', 3) }, 'primary')

    expect(typeOf(result.slot)).toBe('DIRT')
    expect(countOf(result.slot)).toBe(3)
    expect(typeOf(result.cursor)).toBe('STONE')
    expect(countOf(result.cursor)).toBe(8)
  })

  it('secondary click picks up half of a stack rounded up', () => {
    const result = applyInventoryCursorClick({ slot: stack('DIRT', 5), cursor: empty() }, 'secondary')

    expect(countOf(result.slot)).toBe(2)
    expect(typeOf(result.cursor)).toBe('DIRT')
    expect(countOf(result.cursor)).toBe(3)
  })

  it('secondary click places one item from the cursor into an empty slot', () => {
    const result = applyInventoryCursorClick({ slot: empty(), cursor: stack('DIRT', 5) }, 'secondary')

    expect(typeOf(result.slot)).toBe('DIRT')
    expect(countOf(result.slot)).toBe(1)
    expect(countOf(result.cursor)).toBe(4)
  })

  it('secondary click places one item onto a matching stack below max size', () => {
    const result = applyInventoryCursorClick({ slot: stack('DIRT', 63), cursor: stack('DIRT', 2) }, 'secondary')

    expect(countOf(result.slot)).toBe(64)
    expect(countOf(result.cursor)).toBe(1)
  })

  it('secondary click is a no-op for different occupied stacks', () => {
    const result = applyInventoryCursorClick({ slot: stack('STONE', 8), cursor: stack('DIRT', 3) }, 'secondary')

    expect(typeOf(result.slot)).toBe('STONE')
    expect(countOf(result.slot)).toBe(8)
    expect(typeOf(result.cursor)).toBe('DIRT')
    expect(countOf(result.cursor)).toBe(3)
  })
})
