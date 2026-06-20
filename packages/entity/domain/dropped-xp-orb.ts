import type { Position } from '@ts-minecraft/core'

export const XP_ORB_PICKUP_DISTANCE = 1.5
export const XP_ORB_PICKUP_DISTANCE_SQUARED = XP_ORB_PICKUP_DISTANCE * XP_ORB_PICKUP_DISTANCE
export const XP_ORB_ATTRACTION_DISTANCE = 8
export const XP_ORB_ATTRACTION_DISTANCE_SQUARED =
  XP_ORB_ATTRACTION_DISTANCE * XP_ORB_ATTRACTION_DISTANCE
export const XP_ORB_ATTRACTION_ACCELERATION_PER_TICK = 0.08
export const XP_ORB_MAX_SPEED_PER_TICK = 0.6
export const XP_ORB_VELOCITY_DAMPING_PER_TICK = 0.98
export const XP_ORB_LIFETIME_TICKS = 20 * 60 * 5
export const XP_ORB_PICKUP_DELAY_TICKS = 10

export type DroppedXpOrbPosition = Position

export type DroppedXpOrbEntity = {
  readonly id: string
  readonly amount: number
  readonly position: DroppedXpOrbPosition
  readonly velocity: DroppedXpOrbPosition
  readonly ageTicks: number
  readonly pickupDelayTicks: number
}
