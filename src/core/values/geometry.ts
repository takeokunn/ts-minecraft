import * as S from '@effect/schema/Schema'
import { Brand, Data } from 'effect'

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

export type BoundingBox = Data.Struct<{
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly maxX: number
  readonly maxY: number
  readonly maxZ: number
}>

export const BoundingBox = Data.struct<BoundingBox>()

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

export type Ray = Data.Struct<{
  readonly origin: { readonly x: number; readonly y: number; readonly z: number }
  readonly direction: { readonly x: number; readonly y: number; readonly z: number }
  readonly maxDistance: Distance
}>

export const Ray = Data.struct<Ray>()

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

export type Sphere = Data.Struct<{
  readonly center: { readonly x: number; readonly y: number; readonly z: number }
  readonly radius: number
}>

export const Sphere = Data.struct<Sphere>()

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