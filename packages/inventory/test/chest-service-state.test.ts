import { describe, expect, it } from '@effect/vitest'
import { Option } from 'effect'

import { CHEST_SIZE } from '../domain/chest-service.config'
import {
  fillSlotsFromStack,
  isValidChestIndex,
  moveBetweenSlots,
  tryFillSlotsFromStacks,
} from '../application/chest-service-state'
import { ItemStack } from '../domain/item-stack'

describe('chest-service-state', () => {
  it('validates chest indices within bounds', () => {
    expect(isValidChestIndex(0)).toBe(true)
    expect(isValidChestIndex(CHEST_SIZE - 1)).toBe(true)
    expect(isValidChestIndex(-1)).toBe(false)
    expect(isValidChestIndex(CHEST_SIZE)).toBe(false)
    expect(isValidChestIndex(1.5)).toBe(false)
  })

  it('moves, merges, and swaps slot contents', () => {
    const stone40 = Option.some(new ItemStack({ itemType: 'STONE', count: 40, durability: null }))
    const stone30 = Option.some(new ItemStack({ itemType: 'STONE', count: 30, durability: null }))
    const dirt3 = Option.some(new ItemStack({ itemType: 'DIRT', count: 3, durability: null }))

    const [emptyFrom, filledTo] = moveBetweenSlots(Option.none(), stone40)
    expect(Option.isNone(emptyFrom)).toBe(true)
    expect(Option.getOrThrow(filledTo).count).toBe(40)

    const [mergedFrom, mergedTo] = moveBetweenSlots(stone40, stone30)
    expect(Option.getOrThrow(mergedTo).count).toBe(64)
    expect(Option.getOrThrow(mergedFrom).count).toBe(6)

    const [swappedFrom, swappedTo] = moveBetweenSlots(stone40, dirt3)
    expect(Option.getOrThrow(swappedFrom).itemType).toBe('DIRT')
    expect(Option.getOrThrow(swappedFrom).count).toBe(3)
    expect(Option.getOrThrow(swappedTo).itemType).toBe('STONE')
    expect(Option.getOrThrow(swappedTo).count).toBe(40)
  })

  it('fills matching stacks before empty slots', () => {
    const slots = [
      Option.some(new ItemStack({ itemType: 'STONE', count: 63, durability: null })),
      Option.none(),
      Option.some(new ItemStack({ itemType: 'STONE', count: 10, durability: null })),
      Option.none(),
    ]

    const [nextSlots, remainder] = fillSlotsFromStack(slots, new ItemStack({ itemType: 'STONE', count: 64, durability: null }))

    expect(Option.isNone(remainder)).toBe(true)
    expect(Option.getOrThrow(nextSlots[0]).count).toBe(64)
    expect(Option.getOrThrow(nextSlots[1]).count).toBe(9)
    expect(Option.getOrThrow(nextSlots[2]).count).toBe(64)
    expect(Option.isNone(nextSlots[3])).toBe(true)
  })

  it('fails dismantling when any stack does not fit', () => {
    const slots = [Option.some(new ItemStack({ itemType: 'STONE', count: 63, durability: null })), Option.none()]

    const nextSlots = tryFillSlotsFromStacks(slots, [
      new ItemStack({ itemType: 'STONE', count: 2, durability: null }),
      new ItemStack({ itemType: 'DIRT', count: 1, durability: null }),
    ])

    expect(Option.isNone(nextSlots)).toBe(true)
  })

  it('returns updated slots when all dismantled stacks fit', () => {
    const slots = [Option.some(new ItemStack({ itemType: 'STONE', count: 63, durability: null })), Option.none()]

    const nextSlots = tryFillSlotsFromStacks(slots, [new ItemStack({ itemType: 'STONE', count: 2, durability: null })])

    expect(Option.isSome(nextSlots)).toBe(true)
    expect(Option.getOrThrow(Option.getOrThrow(nextSlots)[0]).count).toBe(64)
    expect(Option.getOrThrow(Option.getOrThrow(nextSlots)[1]).count).toBe(1)
  })
})
