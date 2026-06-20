import type { DroppedItemPosition } from './dropped-item'
import { ITEM_PICKUP_DISTANCE } from './dropped-item'

export const squaredDroppedItemDistance = (
  a: DroppedItemPosition,
  b: DroppedItemPosition,
): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

export const isWithinItemPickupDistance = (
  playerPosition: DroppedItemPosition,
  itemPosition: DroppedItemPosition,
  pickupDistance = ITEM_PICKUP_DISTANCE,
): boolean =>
  squaredDroppedItemDistance(playerPosition, itemPosition) <= pickupDistance * pickupDistance
