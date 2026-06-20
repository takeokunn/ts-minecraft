import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import type { DroppedItemEntity } from '../domain/dropped-item'
import {
  DROPPED_ITEM_LIFETIME_TICKS,
  DROPPED_ITEM_PICKUP_DELAY_TICKS,
  ITEM_PICKUP_DISTANCE,
  ITEM_PICKUP_DISTANCE_SQUARED,
} from '../domain/dropped-item'
import {
  isWithinItemPickupDistance,
  squaredDroppedItemDistance,
} from '../domain/dropped-item-resolution'

describe('DroppedItemEntity', () => {
  it('defines pickup and despawn constants for world item drops', () => {
    expect(ITEM_PICKUP_DISTANCE).toBe(1.5)
    expect(ITEM_PICKUP_DISTANCE_SQUARED).toBe(2.25)
    expect(DROPPED_ITEM_LIFETIME_TICKS).toBe(6000)
    expect(DROPPED_ITEM_PICKUP_DELAY_TICKS).toBe(10)
  })

  it('checks pickup range using squared distance', () => {
    const playerPosition = { x: 0, y: 64, z: 0 }

    expect(isWithinItemPickupDistance(playerPosition, { x: 1.5, y: 64, z: 0 })).toBe(true)
    expect(isWithinItemPickupDistance(playerPosition, { x: 1.51, y: 64, z: 0 })).toBe(false)
    expect(isWithinItemPickupDistance(playerPosition, { x: 0, y: 65, z: 1 })).toBe(true)
  })

  it('supports a custom pickup radius for callers that use expanded player bounds', () => {
    const playerPosition = { x: 0, y: 64, z: 0 }
    const itemPosition = { x: 2, y: 64, z: 0 }

    expect(isWithinItemPickupDistance(playerPosition, itemPosition)).toBe(false)
    expect(isWithinItemPickupDistance(playerPosition, itemPosition, 2)).toBe(true)
  })

  it('keeps item stacks separate from mob loot table drops', () => {
    const droppedItem: DroppedItemEntity = {
      id: 'drop-1',
      itemType: 'DIRT',
      count: 1,
      position: { x: 0, y: 64, z: 0 },
      velocity: { x: 0, y: 0.1, z: 0 },
      ageTicks: 0,
      pickupDelayTicks: 0,
    }

    expect(droppedItem.itemType).toBe('DIRT')
    expect(squaredDroppedItemDistance(droppedItem.position, { x: 0, y: 64, z: 2 })).toBe(4)
  })
})
