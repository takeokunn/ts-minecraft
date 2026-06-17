import type { Position } from '@ts-minecraft/core'

import { clampPan } from './audio-utils'

export type SpatialSound = {
  gain: number
  pan: number
  position: Position
}

export const SPATIAL_DISTANCE_SCALE = 12

export const computeSpatial = (
  listener: Position,
  source: Position,
): SpatialSound => {
  const dx = source.x - listener.x
  const dy = source.y - listener.y
  const dz = source.z - listener.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const attenuation = 1 / (1 + distance / SPATIAL_DISTANCE_SCALE)
  const pan = clampPan(dx / SPATIAL_DISTANCE_SCALE)

  return {
    gain: attenuation,
    pan,
    position: { x: dx, y: dy, z: dz },
  }
}
