import * as S from 'effect/Schema'

export const AABB = S.Struct({
  _tag: S.Literal('AABB'),
  minX: S.Number,
  minY: S.Number,
  minZ: S.Number,
  maxX: S.Number,
  maxY: S.Number,
  maxZ: S.Number,
})
export type AABB = S.Schema.Type<typeof AABB>

export const makeAABB = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) =>
  S.decodeSync(AABB)({
    _tag: 'AABB',
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
  })

/**
 * Create AABB from position and collider component
 */
export const createAABB = (
  position: { x: number; y: number; z: number },
  collider: {
    shape: {
      type: 'box' | 'sphere' | 'capsule' | 'mesh'
      halfExtents?: { x: number; y: number; z: number }
      radius?: number
      height?: number
    }
  },
): AABB => {
  const { x, y, z } = position
  const { shape } = collider

  switch (shape.type) {
    case 'box': {
      const { halfExtents } = shape
      if (!halfExtents) throw new Error('Box collider missing halfExtents')
      return makeAABB(x - halfExtents.x, y - halfExtents.y, z - halfExtents.z, x + halfExtents.x, y + halfExtents.y, z + halfExtents.z)
    }
    case 'sphere': {
      const { radius } = shape
      if (radius === undefined) throw new Error('Sphere collider missing radius')
      return makeAABB(x - radius, y - radius, z - radius, x + radius, y + radius, z + radius)
    }
    case 'capsule': {
      const { radius, height } = shape
      if (radius === undefined || height === undefined) {
        throw new Error('Capsule collider missing radius or height')
      }
      const halfHeight = height / 2
      return makeAABB(x - radius, y - halfHeight, z - radius, x + radius, y + halfHeight, z + radius)
    }
    case 'mesh': {
      // For mesh, use a default bounding box (this would normally be computed from vertices)
      return makeAABB(x - 0.5, y - 0.5, z - 0.5, x + 0.5, y + 0.5, z + 0.5)
    }
    default:
      throw new Error(`Unknown collider shape type: ${(shape as any).type}`)
  }
}

/**
 * Check if two AABBs are intersecting
 */
export const areAABBsIntersecting = (aabb1: AABB, aabb2: AABB): boolean => {
  return aabb1.minX <= aabb2.maxX && aabb1.maxX >= aabb2.minX && aabb1.minY <= aabb2.maxY && aabb1.maxY >= aabb2.minY && aabb1.minZ <= aabb2.maxZ && aabb1.maxZ >= aabb2.minZ
}

/**
 * Calculate the volume of an AABB
 */
export const calculateAABBVolume = (aabb: AABB): number => {
  const width = aabb.maxX - aabb.minX
  const height = aabb.maxY - aabb.minY
  const depth = aabb.maxZ - aabb.minZ
  return width * height * depth
}

/**
 * Get the center point of an AABB
 */
export const getAABBCenter = (aabb: AABB): { x: number; y: number; z: number } => ({
  x: (aabb.minX + aabb.maxX) / 2,
  y: (aabb.minY + aabb.maxY) / 2,
  z: (aabb.minZ + aabb.maxZ) / 2,
})

/**
 * Expand AABB by a given amount on all sides
 */
export const expandAABB = (aabb: AABB, expansion: number): AABB => {
  return makeAABB(aabb.minX - expansion, aabb.minY - expansion, aabb.minZ - expansion, aabb.maxX + expansion, aabb.maxY + expansion, aabb.maxZ + expansion)
}

/**
 * Merge two AABBs into one that contains both
 */
export const mergeAABBs = (aabb1: AABB, aabb2: AABB): AABB => {
  return makeAABB(
    Math.min(aabb1.minX, aabb2.minX),
    Math.min(aabb1.minY, aabb2.minY),
    Math.min(aabb1.minZ, aabb2.minZ),
    Math.max(aabb1.maxX, aabb2.maxX),
    Math.max(aabb1.maxY, aabb2.maxY),
    Math.max(aabb1.maxZ, aabb2.maxZ),
  )
}
