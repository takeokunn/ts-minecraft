import type { InventoryItem } from '@ts-minecraft/core'

export const ITEM_PICKUP_DISTANCE = 1.5
export const ITEM_PICKUP_DISTANCE_SQUARED = ITEM_PICKUP_DISTANCE * ITEM_PICKUP_DISTANCE
export const DROPPED_ITEM_LIFETIME_TICKS = 20 * 60 * 5
export const DROPPED_ITEM_PICKUP_DELAY_TICKS = 10

export type DroppedItemPosition = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type DroppedItemStack = {
  readonly itemType: InventoryItem
  readonly count: number
}

export type DroppedItemEntity = DroppedItemStack & {
  readonly id: string
  readonly position: DroppedItemPosition
  readonly velocity: DroppedItemPosition
  readonly ageTicks: number
  readonly pickupDelayTicks: number
}
