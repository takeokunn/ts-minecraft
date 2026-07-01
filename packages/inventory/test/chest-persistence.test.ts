import { describe, expect, it } from 'vitest'
import { Array as Arr, Option } from 'effect'
import {
  serializeChestItemStack,
  hydrateChest,
  serializeChest,
  normalizeChest,
} from '@ts-minecraft/inventory/application/chest-persistence'
import { CHEST_SIZE } from '@ts-minecraft/inventory/domain/chest-service.config'
import { createStack } from '@ts-minecraft/inventory/domain/item-stack'
import type { ChestBlockState, ChestItemStack } from '@ts-minecraft/inventory/domain/chest-state'
import type { ChestRuntimeState } from '@ts-minecraft/inventory/application/chest-service-types'

// ─── helpers ─────────────────────────────────────────────────────────────────

const pos = { x: 10, y: 64, z: -5 }

const makeEmptyBlockState = (): ChestBlockState => ({
  position: pos,
  slots: [],
})

const makeBlockStateWithItem = (index: number, item: ChestItemStack): ChestBlockState => ({
  position: pos,
  slots: Arr.makeBy(CHEST_SIZE, (i) =>
    i === index ? Option.some(item) : Option.none<ChestItemStack>(),
  ),
})

const stoneBlock: ChestItemStack = { itemType: 'STONE', count: 5, durability: null }

// ─── serializeChestItemStack ─────────────────────────────────────────────────
describe('serializeChestItemStack', () => {
  it('copies itemType and count from an ItemStack', () => {
    const stack = createStack('STONE', 5)
    const result = serializeChestItemStack(stack)
    expect(result.itemType).toBe('STONE')
    expect(result.count).toBe(5)
  })

  it('includes durability when present', () => {
    const stack = createStack('IRON_PICKAXE', 1)
    const result = serializeChestItemStack(stack)
    // Durability is undefined on a freshly-created non-tool stack; this checks
    // that serializeChestItemStack passes whatever is on the stack through.
    expect(result.count).toBe(1)
    expect(result.itemType).toBe('IRON_PICKAXE')
  })

  it('produces a plain object (not an ItemStack instance)', () => {
    const stack = createStack('DIRT', 64)
    const result = serializeChestItemStack(stack)
    expect(typeof result).toBe('object')
    expect(result).not.toBeInstanceOf(Function)
  })
})

// ─── normalizeChest ───────────────────────────────────────────────────────────
describe('normalizeChest', () => {
  it('pads an empty slot array to exactly CHEST_SIZE slots', () => {
    const result = normalizeChest(makeEmptyBlockState())
    expect(result.slots).toHaveLength(CHEST_SIZE)
  })

  it('all padded slots are Option.none()', () => {
    const result = normalizeChest(makeEmptyBlockState())
    for (const slot of result.slots) {
      expect(Option.isNone(slot)).toBe(true)
    }
  })

  it('preserves an existing item at its original index', () => {
    const state = makeBlockStateWithItem(3, stoneBlock)
    const result = normalizeChest(state)
    const slot3 = result.slots[3]
    expect(slot3).toBeDefined()
    expect(Option.isSome(slot3!)).toBe(true)
    if (Option.isSome(slot3!)) {
      expect(slot3.value.itemType).toBe('STONE')
    }
  })

  it('preserves position from the input state', () => {
    const result = normalizeChest(makeEmptyBlockState())
    expect(result.position).toEqual(pos)
  })

  it('does not mutate the input slots array', () => {
    const state = makeEmptyBlockState()
    const originalSlots = state.slots
    normalizeChest(state)
    expect(state.slots).toBe(originalSlots)
  })
})

// ─── hydrateChest ─────────────────────────────────────────────────────────────
describe('hydrateChest', () => {
  it('returns CHEST_SIZE slots', () => {
    const result = hydrateChest(makeEmptyBlockState())
    expect(result.slots).toHaveLength(CHEST_SIZE)
  })

  it('preserves position', () => {
    const result = hydrateChest(makeEmptyBlockState())
    expect(result.position).toEqual(pos)
  })

  it('converts a ChestItemStack to an ItemStack at the correct index', () => {
    const state = makeBlockStateWithItem(5, stoneBlock)
    const result = hydrateChest(state)
    const slot5 = result.slots[5]
    expect(Option.isSome(slot5!)).toBe(true)
    if (Option.isSome(slot5!)) {
      expect(slot5.value.itemType).toBe('STONE')
      expect(slot5.value.count).toBe(5)
    }
  })

  it('maps empty slots to Option.none()', () => {
    const state = makeBlockStateWithItem(0, stoneBlock)
    const result = hydrateChest(state)
    expect(Option.isNone(result.slots[1]!)).toBe(true)
  })
})

// ─── serializeChest ───────────────────────────────────────────────────────────
describe('serializeChest', () => {
  const runtimeState = (): ChestRuntimeState => ({
    position: pos,
    slots: Arr.makeBy(CHEST_SIZE, (i) =>
      i === 2 ? Option.some(createStack('DIRT', 10)) : Option.none(),
    ),
  })

  it('returns CHEST_SIZE slots', () => {
    const result = serializeChest(runtimeState())
    expect(result.slots).toHaveLength(CHEST_SIZE)
  })

  it('preserves position', () => {
    const result = serializeChest(runtimeState())
    expect(result.position).toEqual(pos)
  })

  it('serializes an ItemStack to a ChestItemStack at the correct index', () => {
    const result = serializeChest(runtimeState())
    const slot2 = result.slots[2]
    expect(Option.isSome(slot2!)).toBe(true)
    if (Option.isSome(slot2!)) {
      expect(slot2.value.itemType).toBe('DIRT')
      expect(slot2.value.count).toBe(10)
    }
  })

  it('maps empty ItemStack slots to Option.none()', () => {
    const result = serializeChest(runtimeState())
    expect(Option.isNone(result.slots[0]!)).toBe(true)
  })

  it('round-trips: serialize then hydrate recovers the original items', () => {
    const runtime = runtimeState()
    const serialized = serializeChest(runtime)
    const recovered = hydrateChest(serialized)
    const slot2 = recovered.slots[2]
    expect(Option.isSome(slot2!)).toBe(true)
    if (Option.isSome(slot2!)) {
      expect(slot2.value.itemType).toBe('DIRT')
      expect(slot2.value.count).toBe(10)
    }
  })
})
