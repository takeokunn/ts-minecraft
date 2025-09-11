import * as S from '@effect/schema/Schema'
import { Brand } from 'effect'

type Struct<T> = T

// Distance calculations with branded types
export type Distance = number & Brand.Brand<'Distance'>

export const Distance = Brand.refined<Distance>(
  (n): n is number => Number.isFinite(n) && n >= 0,
  (n) => Brand.error(`Invalid Distance: ${n} (must be non-negative)`),
)

export const DistanceSchema = S.Number.pipe(
  S.finite(),
  S.nonNegative(),
  S.brand('Distance'),
)

// Angle measurements in radians
export type Angle = number & Brand.Brand<'Angle'>

export const Angle = Brand.refined<Angle>(
  (n): n is number => Number.isFinite(n),
  (n) => Brand.error(`Invalid Angle: ${n}`),
)

export const AngleSchema = S.Number.pipe(
  S.finite(),
  S.brand('Angle'),
)

// Normalized angle (0 to 2π)
export const normalizeAngle = (angle: number): Angle => {
  const normalized = angle % (2 * Math.PI)
  return Angle(normalized < 0 ? normalized + 2 * Math.PI : normalized)
}

// Degrees to radians conversion
export const degreesToRadians = (degrees: number): Angle =>
  Angle((degrees * Math.PI) / 180)

export const radiansToDegrees = (radians: Angle): number =>
  (radians * 180) / Math.PI

// Bounding box for collision detection
export const BoundingBoxSchema = S.Struct({
  minX: S.Number,
  minY: S.Number,
  minZ: S.Number,
  maxX: S.Number,
  maxY: S.Number,
  maxZ: S.Number,
})

export type BoundingBox = Struct<{
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly maxX: number
  readonly maxY: number
  readonly maxZ: number
}>

export const BoundingBox = Struct<BoundingBox>()

export const makeBoundingBox = (
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): BoundingBox =>
  BoundingBox({
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    minZ: Math.min(minZ, maxZ),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
    maxZ: Math.max(minZ, maxZ),
  })

// Ray for raycasting
export const RaySchema = S.Struct({
  origin: S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number,
  }),
  direction: S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number,
  }),
  maxDistance: DistanceSchema,
})

export type Ray = Struct<{
  readonly origin: { readonly x: number; readonly y: number; readonly z: number }
  readonly direction: { readonly x: number; readonly y: number; readonly z: number }
  readonly maxDistance: Distance
}>

export const Ray = Struct<Ray>()

export const makeRay = (
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  maxDistance: number,
): Ray => {
  // Normalize direction vector
  const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2)
  const normalizedDirection = length > 0 
    ? { x: direction.x / length, y: direction.y / length, z: direction.z / length }
    : { x: 0, y: 0, z: 0 }

  return Ray({
    origin,
    direction: normalizedDirection,
    maxDistance: Distance(maxDistance),
  })
}

// Sphere for collision detection
export const SphereSchema = S.Struct({
  center: S.Struct({
    x: S.Number,
    y: S.Number,
    z: S.Number,
  }),
  radius: S.Number.pipe(S.nonNegative()),
})

export type Sphere = Struct<{
  readonly center: { readonly x: number; readonly y: number; readonly z: number }
  readonly radius: number
}>

export const Sphere = Struct<Sphere>()

export const makeSphere = (center: { x: number; y: number; z: number }, radius: number): Sphere =>
  Sphere({
    center,
    radius: Math.max(0, radius),
  })

// Geometric calculations
export const pointDistance = (
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
): Distance => {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  const dz = p1.z - p2.z
  return Distance(Math.sqrt(dx * dx + dy * dy + dz * dz))
}

export const boundingBoxIntersects = (a: BoundingBox, b: BoundingBox): boolean =>
  a.maxX >= b.minX &&
  a.minX <= b.maxX &&
  a.maxY >= b.minY &&
  a.minY <= b.maxY &&
  a.maxZ >= b.minZ &&
  a.minZ <= b.maxZ

export const sphereIntersects = (a: Sphere, b: Sphere): boolean => {
  const distance = pointDistance(a.center, b.center)
  return distance <= Distance(a.radius + b.radius)
}

export const pointInBoundingBox = (
  point: { x: number; y: number; z: number },
  box: BoundingBox,
): boolean =>
  point.x >= box.minX &&
  point.x <= box.maxX &&
  point.y >= box.minY &&
  point.y <= box.maxY &&
  point.z >= box.minZ &&
  point.z <= box.maxZ

// Volume calculations
export const boundingBoxVolume = (box: BoundingBox): number =>
  (box.maxX - box.minX) * (box.maxY - box.minY) * (box.maxZ - box.minZ)

export const sphereVolume = (sphere: Sphere): number =>
  (4 / 3) * Math.PI * sphere.radius ** 3

// Vector3 operations for test compatibility
export interface Vector3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Quaternion {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}

export interface Matrix4 {
  readonly [row: number]: readonly [number, number, number, number] | undefined
}

export interface Plane {
  readonly normal: Vector3
  readonly distance: number
}

export const createVector3 = (x: number, y: number, z: number): Vector3 => ({ x, y, z })

export const createQuaternion = (x: number, y: number, z: number, w: number): Quaternion => ({ x, y, z, w })

export const createMatrix4 = (): Matrix4 => [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1]
]

export const createAABB = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): BoundingBox =>
  makeBoundingBox(minX, minY, minZ, maxX, maxY, maxZ)

export const createRay = (origin: Vector3, direction: Vector3, maxDistance: number): Ray =>
  makeRay(origin, direction, maxDistance)

export const createPlane = (normal: Vector3, distance: number): Plane => ({ normal, distance })

// Vector operations
export const vectorAdd = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export const vectorSubtract = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

export const vectorScale = (vec: Vector3, scale: number): Vector3 => ({ x: vec.x * scale, y: vec.y * scale, z: vec.z * scale })

export const vectorDot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const vectorCross = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
})

export const vectorLength = (vec: Vector3): number => Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z)

export const vectorNormalize = (vec: Vector3): Vector3 => {
  const length = vectorLength(vec)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  return vectorScale(vec, 1 / length)
}

// Quaternion operations
export const quaternionMultiply = (a: Quaternion, b: Quaternion): Quaternion => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
})

// AABB operations
export const aabbIntersects = (a: BoundingBox, b: BoundingBox): boolean => boundingBoxIntersects(a, b)

export const rayIntersectsAABB = (ray: Ray, aabb: BoundingBox): number | null => {
  const tMin = [
    (aabb.minX - ray.origin.x) / ray.direction.x,
    (aabb.minY - ray.origin.y) / ray.direction.y,
    (aabb.minZ - ray.origin.z) / ray.direction.z
  ]
  
  const tMax = [
    (aabb.maxX - ray.origin.x) / ray.direction.x,
    (aabb.maxY - ray.origin.y) / ray.direction.y,
    (aabb.maxZ - ray.origin.z) / ray.direction.z
  ]
  
  const t1 = Math.min(tMin[0], tMax[0])
  const t2 = Math.max(tMin[0], tMax[0])
  const t3 = Math.min(tMin[1], tMax[1])
  const t4 = Math.max(tMin[1], tMax[1])
  const t5 = Math.min(tMin[2], tMax[2])
  const t6 = Math.max(tMin[2], tMax[2])
  
  const tNear = Math.max(t1, t3, t5)
  const tFar = Math.min(t2, t4, t6)
  
  if (tNear > tFar || tFar < 0 || tNear > ray.maxDistance) {
    return null
  }
  
  return tNear >= 0 ? tNear : tFar
}

// Type guards
export const isVector3 = (value: unknown): value is Vector3 =>
  typeof value === 'object' && value !== null &&
  typeof (value as any).x === 'number' &&
  typeof (value as any).y === 'number' &&
  typeof (value as any).z === 'number'

export const isQuaternion = (value: unknown): value is Quaternion =>
  typeof value === 'object' && value !== null &&
  typeof (value as any).x === 'number' &&
  typeof (value as any).y === 'number' &&
  typeof (value as any).z === 'number' &&
  typeof (value as any).w === 'number'

// Validation functions
export const isValidAngle = (value: number): boolean => Number.isFinite(value)

export const isValidDistance = (value: number): boolean => Number.isFinite(value) && value >= 0

// Additional aliases for compatibility
export { BoundingBox as AABB }
export type { BoundingBox as AABB }