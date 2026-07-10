import type { Position } from '@ts-minecraft/core'

export const MAX_REDSTONE_POWER = 15

export const DEFAULT_BUTTON_TICKS = 20 // vanilla stone button: 1.0s pulse

export const MAX_BUTTON_TICKS = 200

export const POSITION_DIRECTIONS: ReadonlyArray<Position> = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
]
