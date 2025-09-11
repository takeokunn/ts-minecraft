import { Effect } from 'effect'
import { Position } from '../coordinates/position.value'
import { ValidationError } from '@/core/errors'

/**
 * AABB (Axis-Aligned Bounding Box) Value Object
 * Represents a 3D box aligned with the coordinate axes
 */

export interface AABBStruct {
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly maxX: number
  readonly maxY: number
  readonly maxZ: number
}

export interface AABB extends AABBStruct {}

export const AABB = (aabb: AABBStruct): AABB => aabb

/**
 * Create AABB from center position and size
 */
export const fromCenterAndSize = (
  center: Position,
  width: number,
  height: number,
  depth: number
): AABB =>
  AABB({
    minX: center.x - width / 2,
    minY: center.y - height / 2,
    minZ: center.z - depth / 2,
    maxX: center.x + width / 2,
    maxY: center.y + height / 2,
    maxZ: center.z + depth / 2
  })

/**
 * Get the center position of an AABB
 */
export const getCenter = (aabb: AABB): Position =>
  Position({
    x: (aabb.minX + aabb.maxX) / 2,
    y: (aabb.minY + aabb.maxY) / 2,
    z: (aabb.minZ + aabb.maxZ) / 2
  })

/**
 * Get the size of an AABB
 */
export const getSize = (aabb: AABB): {
  width: number
  height: number
  depth: number
} => ({
  width: aabb.maxX - aabb.minX,
  height: aabb.maxY - aabb.minY,
  depth: aabb.maxZ - aabb.minZ
})

/**
 * Check if two AABBs intersect
 */
export const intersects = (other: AABB) => (aabb: AABB): boolean =>
  aabb.maxX >= other.minX &&
  aabb.minX <= other.maxX &&
  aabb.maxY >= other.minY &&
  aabb.minY <= other.maxY &&
  aabb.maxZ >= other.minZ &&
  aabb.minZ <= other.maxZ

/**
 * Check if an AABB contains a point
 */
export const containsPoint = (point: Position) => (aabb: AABB): boolean =>
  point.x >= aabb.minX &&
  point.x <= aabb.maxX &&
  point.y >= aabb.minY &&
  point.y <= aabb.maxY &&
  point.z >= aabb.minZ &&
  point.z <= aabb.maxZ

/**
 * Translate an AABB
 */
export const translate = (dx: number, dy: number, dz: number) => (aabb: AABB): AABB =>
  AABB({
    minX: aabb.minX + dx,
    minY: aabb.minY + dy,
    minZ: aabb.minZ + dz,
    maxX: aabb.maxX + dx,
    maxY: aabb.maxY + dy,
    maxZ: aabb.maxZ + dz
  })

/**
 * Expand an AABB by a given amount in all directions
 */
export const expand = (amount: number) => (aabb: AABB): AABB =>
  AABB({
    minX: aabb.minX - amount,
    minY: aabb.minY - amount,
    minZ: aabb.minZ - amount,
    maxX: aabb.maxX + amount,
    maxY: aabb.maxY + amount,
    maxZ: aabb.maxZ + amount
  })

/**
 * Merge two AABBs into one that contains both
 */
export const merge = (other: AABB) => (aabb: AABB): AABB =>
  AABB({
    minX: Math.min(aabb.minX, other.minX),
    minY: Math.min(aabb.minY, other.minY),
    minZ: Math.min(aabb.minZ, other.minZ),
    maxX: Math.max(aabb.maxX, other.maxX),
    maxY: Math.max(aabb.maxY, other.maxY),
    maxZ: Math.max(aabb.maxZ, other.maxZ)
  })

/**
 * Get the volume of an AABB
 */
export const getVolume = (aabb: AABB): number => {
  const size = getSize(aabb)
  return size.width * size.height * size.depth
}

/**
 * Get the surface area of an AABB
 */
export const getSurfaceArea = (aabb: AABB): number => {
  const size = getSize(aabb)
  return 2 * (size.width * size.height + size.width * size.depth + size.height * size.depth)
}

/**
 * Create an AABB from min and max positions
 */
export const fromMinMax = (min: Position, max: Position): AABB =>
  AABB({
    minX: min.x,
    minY: min.y,
    minZ: min.z,
    maxX: max.x,
    maxY: max.y,
    maxZ: max.z
  })

/**
 * Get the corners of an AABB
 */
export const getCorners = (aabb: AABB): Position[] => [
  Position({ x: aabb.minX, y: aabb.minY, z: aabb.minZ }),
  Position({ x: aabb.maxX, y: aabb.minY, z: aabb.minZ }),
  Position({ x: aabb.minX, y: aabb.maxY, z: aabb.minZ }),
  Position({ x: aabb.maxX, y: aabb.maxY, z: aabb.minZ }),
  Position({ x: aabb.minX, y: aabb.minY, z: aabb.maxZ }),
  Position({ x: aabb.maxX, y: aabb.minY, z: aabb.maxZ }),
  Position({ x: aabb.minX, y: aabb.maxY, z: aabb.maxZ }),
  Position({ x: aabb.maxX, y: aabb.maxY, z: aabb.maxZ })
]

/**
 * Validate an AABB
 */
export const validate = (aabb: AABBStruct): Effect.Effect<AABB, typeof ValidationError, never> =>
  Effect.gen(function* () {
    // Check for NaN or Infinity
    const values = [aabb.minX, aabb.minY, aabb.minZ, aabb.maxX, aabb.maxY, aabb.maxZ]
    
    for (const value of values) {
      if (isNaN(value) || !isFinite(value)) {
        return yield* Effect.fail(new ValidationError({ 
          resourcePath: 'aabb.value.ts', 
          validationRules: ['finite-values'], 
          failures: ['AABB contains invalid values'],
          severity: 'error' as const
        }))
      }
    }
    
    // Check that min <= max
    if (aabb.minX > aabb.maxX || aabb.minY > aabb.maxY || aabb.minZ > aabb.maxZ) {
      return yield* Effect.fail(new ValidationError({ 
        resourcePath: 'aabb.value.ts', 
        validationRules: ['min-max-order'], 
        failures: ['AABB min values must be less than or equal to max values'],
        severity: 'error' as const
      }))
    }
    
    return AABB(aabb)
  })

// Namespace for cleaner imports
export const AABBOps = {
  fromCenterAndSize,
  getCenter,
  getSize,
  intersects,
  containsPoint,
  translate,
  expand,
  merge,
  getVolume,
  getSurfaceArea,
  fromMinMax,
  getCorners,
  validate
}

// Re-export as namespace for compatibility
export namespace AABB {
  export const fromCenterAndSize = AABBOps.fromCenterAndSize
  export const getCenter = AABBOps.getCenter
  export const getSize = AABBOps.getSize
  export const intersects = AABBOps.intersects
  export const containsPoint = AABBOps.containsPoint
  export const translate = AABBOps.translate
  export const expand = AABBOps.expand
  export const merge = AABBOps.merge
  export const getVolume = AABBOps.getVolume
  export const getSurfaceArea = AABBOps.getSurfaceArea
  export const fromMinMax = AABBOps.fromMinMax
  export const getCorners = AABBOps.getCorners
  export const validate = AABBOps.validate
}