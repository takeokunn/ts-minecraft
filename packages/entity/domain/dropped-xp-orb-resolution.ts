import type { DroppedXpOrbPosition } from './dropped-xp-orb'
import { XP_ORB_PICKUP_DISTANCE } from './dropped-xp-orb'

export const squaredXpOrbDistance = (a: DroppedXpOrbPosition, b: DroppedXpOrbPosition): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

export const isWithinXpOrbPickupDistance = (
  playerPosition: DroppedXpOrbPosition,
  orbPosition: DroppedXpOrbPosition,
  pickupDistance = XP_ORB_PICKUP_DISTANCE,
): boolean => squaredXpOrbDistance(playerPosition, orbPosition) <= pickupDistance * pickupDistance
