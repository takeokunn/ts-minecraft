import type { Position } from '@ts-minecraft/core'
import type { TargetRayHit } from './interaction-types'

// Computes the world position of the block face adjacent to a ray hit:
// one block beyond the hit surface, in the direction of the surface normal.
export const adjacentToHit = (hit: TargetRayHit): Position => ({
  x: hit.blockX + Math.round(hit.normal.x),
  y: hit.blockY + Math.round(hit.normal.y),
  z: hit.blockZ + Math.round(hit.normal.z),
})

// Builds a sphere of positions centered at `center` within `radius` blocks
// (Euclidean). Used for explosion block break patterns.
export const buildExplosionBreakPositions = (center: Position, radius: number): ReadonlyArray<Position> => {
  const positions: Position[] = []
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dy * dy + dz * dz <= radius * radius) {
          positions.push({ x: center.x + dx, y: center.y + dy, z: center.z + dz })
        }
      }
    }
  }
  return positions
}

export const buildTntBreakPositions = buildExplosionBreakPositions
