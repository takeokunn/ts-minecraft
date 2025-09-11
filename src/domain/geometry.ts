import * as S from "/schema/Schema"
import type { ColliderComponent, PositionComponent } from '@/core/components'
import { toFloat, Vector3Float, Vector3Int } from './common'
import { CHUNK_SIZE } from './world-constants'

/**
 * Converts a 3D local position vector within a chunk to a 1D array index.
 * @param localPosition The position vector within the chunk [x, y, z].
 * @returns The corresponding index in the chunk's block array.
 */
export const toChunkIndex = (localPosition: Vector3Int): number => {
  const [x, y, z] = localPosition
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
}

/**
 * An Axis-Aligned Bounding Box, defined by its minimum and maximum corners.
 */
export const AABBSchema = S.Struct({
  minX: S.Number,
  minY: S.Number,
  minZ: S.Number,
  maxX: S.Number,
  maxY: S.Number,
  maxZ: S.Number,
})
export type AABB = S.Schema.Type<typeof AABBSchema>

export const fromCenterAndSize = (center: Vector3Float, size: Vector3Float) => {
  const halfSize: Vector3Float = [toFloat(size[0] / 2), toFloat(size[1] / 2), toFloat(size[2] / 2)]
  return S.decodeUnknownSync(AABBSchema)({
    minX: center[0] - halfSize[0],
    minY: center[1] - halfSize[1],
    minZ: center[2] - halfSize[2],
    maxX: center[0] + halfSize[0],
    maxY: center[1] + halfSize[1],
    maxZ: center[2] + halfSize[2],
  })
}

/**
 * Creates an AABB from an entity's position and collider components.
 * @param position The entity's position.
 * @param collider The entity's collider.
 * @returns A new AABB object.
 */
export const createAABB = (position: PositionComponent, collider: ColliderComponent): AABB => ({
  minX: toFloat(position.x - collider.width / 2),
  minY: toFloat(position.y), // Player's origin is at their feet
  minZ: toFloat(position.z - collider.depth / 2),
  maxX: toFloat(position.x + collider.width / 2),
  maxY: toFloat(position.y + collider.height),
  maxZ: toFloat(position.z + collider.depth / 2),
})

/**
 * Checks if two AABBs are intersecting.
 * @param a The first AABB.
 * @param b The second AABB.
 * @returns True if they intersect, false otherwise.
 */
export const areAABBsIntersecting = (a: AABB, b: AABB): boolean => {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY && a.minZ <= b.maxZ && a.maxZ >= b.minZ
}

/**
 * Calculates the minimum translation vector (MTV) to resolve a collision between two AABBs.
 * This function is currently not used in the collision system but is kept for potential future use.
 * @param a The first AABB.
 * @param b The second AABB.
 * @returns The MTV as a 3D vector.
 */
export const getIntersectionDepth = (a: AABB, b: AABB): Vector3Float => {
  if (!areAABBsIntersecting(a, b)) {
    return [toFloat(0), toFloat(0), toFloat(0)]
  }

  const overlaps = [
    { axis: 0, value: a.maxX - b.minX, sign: -1 }, // Push left
    { axis: 0, value: b.maxX - a.minX, sign: 1 }, // Push right
    { axis: 1, value: a.maxY - b.minY, sign: -1 }, // Push down
    { axis: 1, value: b.maxY - a.minY, sign: 1 }, // Push up
    { axis: 2, value: a.maxZ - b.minZ, sign: -1 }, // Push back
    { axis: 2, value: b.maxZ - a.minZ, sign: 1 }, // Push forward
  ]

  const minOverlap = overlaps.reduce((min, current) => (current.value < min.value ? current : min))

  const mtv: [number, number, number] = [0, 0, 0]
  mtv[minOverlap.axis] = minOverlap.value * minOverlap.sign

  return [toFloat(mtv[0]), toFloat(mtv[1]), toFloat(mtv[2])]
}