type Struct<T> = T
import { Position, type Position as PositionType } from '../coordinates/position.value'
import { AABBSchema } from '@/domain/geometry'

/**
 * AABB (Axis-Aligned Bounding Box) Value Object
 * Represents a 3D bounding box for collision detection
 */

// Re-export schema from domain
export { AABBSchema }

// Type definition using Struct for immutability
export type AABB = Struct<{
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly maxX: number
  readonly maxY: number
  readonly maxZ: number
}>

// Factory function
export const AABB = Struct<AABB>()

// Create AABB from min and max points
export const create = (
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number
): AABB =>
  AABB({
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    minZ: Math.min(minZ, maxZ),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
    maxZ: Math.max(minZ, maxZ),
  })

// Create from two positions
export const fromPositions = (pos1: PositionType, pos2: PositionType): AABB =>
  create(pos1.x, pos1.y, pos1.z, pos2.x, pos2.y, pos2.z)

// Create from center and half-extents
export const fromCenterAndHalfExtents = (
  center: PositionType,
  halfWidth: number,
  halfHeight: number,
  halfDepth: number
): AABB =>
  create(
    center.x - halfWidth, center.y - halfHeight, center.z - halfDepth,
    center.x + halfWidth, center.y + halfHeight, center.z + halfDepth
  )

// Common AABB constants
export const UNIT_CUBE = AABB({
  minX: 0, minY: 0, minZ: 0,
  maxX: 1, maxY: 1, maxZ: 1,
})

export const PLAYER_HITBOX = AABB({
  minX: -0.3, minY: 0, minZ: -0.3,
  maxX: 0.3, maxY: 1.8, maxZ: 0.3,
})

/**
 * Pure functions for AABB operations
 */

// Get width
export const width = (aabb: AABB): number => aabb.maxX - aabb.minX

// Get height
export const height = (aabb: AABB): number => aabb.maxY - aabb.minY

// Get depth
export const depth = (aabb: AABB): number => aabb.maxZ - aabb.minZ

// Get volume
export const volume = (aabb: AABB): number =>
  width(aabb) * height(aabb) * depth(aabb)

// Get center position
export const center = (aabb: AABB): PositionType =>
  Position({
    x: (aabb.minX + aabb.maxX) / 2,
    y: (aabb.minY + aabb.maxY) / 2,
    z: (aabb.minZ + aabb.maxZ) / 2,
  })

// Check if AABB contains a position
export const containsPosition = (pos: PositionType) =>
  (aabb: AABB): boolean =>
    pos.x >= aabb.minX && pos.x <= aabb.maxX &&
    pos.y >= aabb.minY && pos.y <= aabb.maxY &&
    pos.z >= aabb.minZ && pos.z <= aabb.maxZ

// Check if two AABBs intersect
export const intersects = (other: AABB) =>
  (aabb: AABB): boolean =>
    aabb.minX <= other.maxX && aabb.maxX >= other.minX &&
    aabb.minY <= other.maxY && aabb.maxY >= other.minY &&
    aabb.minZ <= other.maxZ && aabb.maxZ >= other.minZ

// Get intersection of two AABBs
export const intersection = (other: AABB) =>
  (aabb: AABB): AABB | null => {
    if (!intersects(other)(aabb)) return null
    
    return create(
      Math.max(aabb.minX, other.minX),
      Math.max(aabb.minY, other.minY),
      Math.max(aabb.minZ, other.minZ),
      Math.min(aabb.maxX, other.maxX),
      Math.min(aabb.maxY, other.maxY),
      Math.min(aabb.maxZ, other.maxZ)
    )
  }

// Get union of two AABBs (smallest box containing both)
export const union = (other: AABB) =>
  (aabb: AABB): AABB =>
    create(
      Math.min(aabb.minX, other.minX),
      Math.min(aabb.minY, other.minY),
      Math.min(aabb.minZ, other.minZ),
      Math.max(aabb.maxX, other.maxX),
      Math.max(aabb.maxY, other.maxY),
      Math.max(aabb.maxZ, other.maxZ)
    )

// Translate AABB by offset
export const translate = (dx: number, dy: number, dz: number) =>
  (aabb: AABB): AABB =>
    AABB({
      minX: aabb.minX + dx,
      minY: aabb.minY + dy,
      minZ: aabb.minZ + dz,
      maxX: aabb.maxX + dx,
      maxY: aabb.maxY + dy,
      maxZ: aabb.maxZ + dz,
    })

// Translate to position
export const translateTo = (pos: PositionType) =>
  (aabb: AABB): AABB => {
    const c = center(aabb)
    return translate(pos.x - c.x, pos.y - c.y, pos.z - c.z)(aabb)
  }

// Expand AABB by amount in all directions
export const expand = (amount: number) =>
  (aabb: AABB): AABB =>
    AABB({
      minX: aabb.minX - amount,
      minY: aabb.minY - amount,
      minZ: aabb.minZ - amount,
      maxX: aabb.maxX + amount,
      maxY: aabb.maxY + amount,
      maxZ: aabb.maxZ + amount,
    })

// Contract AABB by amount in all directions
export const contract = (amount: number) =>
  (aabb: AABB): AABB => {
    const halfWidth = width(aabb) / 2
    const halfHeight = height(aabb) / 2
    const halfDepth = depth(aabb) / 2
    const maxContract = Math.min(halfWidth, halfHeight, halfDepth)
    const actualAmount = Math.min(amount, maxContract)
    return expand(-actualAmount)(aabb)
  }

// Scale AABB from center
export const scale = (factor: number) =>
  (aabb: AABB): AABB => {
    const c = center(aabb)
    const halfWidth = width(aabb) * factor / 2
    const halfHeight = height(aabb) * factor / 2
    const halfDepth = depth(aabb) * factor / 2
    return fromCenterAndHalfExtents(c, halfWidth, halfHeight, halfDepth)
  }

// Get closest point on AABB to given position
export const closestPoint = (pos: PositionType) =>
  (aabb: AABB): PositionType =>
    Position({
      x: Math.max(aabb.minX, Math.min(pos.x, aabb.maxX)),
      y: Math.max(aabb.minY, Math.min(pos.y, aabb.maxY)),
      z: Math.max(aabb.minZ, Math.min(pos.z, aabb.maxZ)),
    })

// Calculate penetration depth if overlapping
export const penetrationDepth = (other: AABB) =>
  (aabb: AABB): { x: number; y: number; z: number } | null => {
    if (!intersects(other)(aabb)) return null
    
    return {
      x: Math.min(aabb.maxX - other.minX, other.maxX - aabb.minX),
      y: Math.min(aabb.maxY - other.minY, other.maxY - aabb.minY),
      z: Math.min(aabb.maxZ - other.minZ, other.maxZ - aabb.minZ),
    }
  }

// Get surface area
export const surfaceArea = (aabb: AABB): number => {
  const w = width(aabb)
  const h = height(aabb)
  const d = depth(aabb)
  return 2 * (w * h + w * d + h * d)
}

// Check if AABB is valid (min <= max)
export const isValid = (aabb: AABB): boolean =>
  aabb.minX <= aabb.maxX &&
  aabb.minY <= aabb.maxY &&
  aabb.minZ <= aabb.maxZ

// Get corners of AABB
export const getCorners = (aabb: AABB): PositionType[] => [
  Position({ x: aabb.minX, y: aabb.minY, z: aabb.minZ }),
  Position({ x: aabb.maxX, y: aabb.minY, z: aabb.minZ }),
  Position({ x: aabb.minX, y: aabb.maxY, z: aabb.minZ }),
  Position({ x: aabb.maxX, y: aabb.maxY, z: aabb.minZ }),
  Position({ x: aabb.minX, y: aabb.minY, z: aabb.maxZ }),
  Position({ x: aabb.maxX, y: aabb.minY, z: aabb.maxZ }),
  Position({ x: aabb.minX, y: aabb.maxY, z: aabb.maxZ }),
  Position({ x: aabb.maxX, y: aabb.maxY, z: aabb.maxZ }),
]

// Format as string for debugging
export const toString = (aabb: AABB): string =>
  `AABB[(${aabb.minX.toFixed(2)}, ${aabb.minY.toFixed(2)}, ${aabb.minZ.toFixed(2)}) -> (${aabb.maxX.toFixed(2)}, ${aabb.maxY.toFixed(2)}, ${aabb.maxZ.toFixed(2)})]`

/**
 * Usage examples:
 * 
 * const box1 = fromCenterAndHalfExtents(
 *   Position({ x: 0, y: 0, z: 0 }),
 *   1, 1, 1
 * )
 * 
 * const box2 = pipe(
 *   UNIT_CUBE,
 *   translate(2, 0, 0),
 *   scale(2)
 * )
 * 
 * const collision = intersects(box2)(box1)
 * const combined = pipe(box1, union(box2))
 */