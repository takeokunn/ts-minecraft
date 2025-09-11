/**
 * Native Math Adapter - Implements math operations using native JavaScript
 *
 * This adapter provides concrete implementation for 3D mathematical operations
 * using native JavaScript, providing a lightweight alternative to Three.js
 * for mathematical calculations.
 */

import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  IVector3Port,
  IQuaternionPort,
  IRayPort,
  IMathPort,
  Vector3Data,
  QuaternionData,
  RayData,
  Vector3Port,
  QuaternionPort,
  RayPort,
  MathPort,
} from '@domain/ports/math.port'

/**
 * Native JavaScript Vector3 Adapter Implementation
 */
export const NativeVector3AdapterLive = Layer.succeed(
  Vector3Port,
  Vector3Port.of({
    create: (x: number, y: number, z: number) =>
      Effect.succeed({ x, y, z }),

    add: (a: Vector3Data, b: Vector3Data) =>
      Effect.succeed({
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z,
      }),

    subtract: (a: Vector3Data, b: Vector3Data) =>
      Effect.succeed({
        x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z,
      }),

    multiply: (vector: Vector3Data, scalar: number) =>
      Effect.succeed({
        x: vector.x * scalar,
        y: vector.y * scalar,
        z: vector.z * scalar,
      }),

    dot: (a: Vector3Data, b: Vector3Data) =>
      Effect.succeed(a.x * b.x + a.y * b.y + a.z * b.z),

    cross: (a: Vector3Data, b: Vector3Data) =>
      Effect.succeed({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      }),

    magnitude: (vector: Vector3Data) =>
      Effect.succeed(Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)),

    normalize: (vector: Vector3Data) =>
      Effect.gen(function* (_) {
        const mag = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)
        if (mag === 0) {
          return { x: 0, y: 0, z: 0 }
        }
        return {
          x: vector.x / mag,
          y: vector.y / mag,
          z: vector.z / mag,
        }
      }),

    distance: (a: Vector3Data, b: Vector3Data) =>
      Effect.gen(function* (_) {
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dz = a.z - b.z
        return Math.sqrt(dx * dx + dy * dy + dz * dz)
      }),

    lerp: (a: Vector3Data, b: Vector3Data, t: number) =>
      Effect.succeed({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      }),
  })
)

/**
 * Native JavaScript Quaternion Adapter Implementation
 */
export const NativeQuaternionAdapterLive = Layer.succeed(
  QuaternionPort,
  QuaternionPort.of({
    create: (x: number, y: number, z: number, w: number) =>
      Effect.succeed({ x, y, z, w }),

    identity: () =>
      Effect.succeed({ x: 0, y: 0, z: 0, w: 1 }),

    multiply: (a: QuaternionData, b: QuaternionData) =>
      Effect.succeed({
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      }),

    conjugate: (q: QuaternionData) =>
      Effect.succeed({ x: -q.x, y: -q.y, z: -q.z, w: q.w }),

    normalize: (q: QuaternionData) =>
      Effect.gen(function* (_) {
        const mag = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)
        if (mag === 0) {
          return { x: 0, y: 0, z: 0, w: 1 }
        }
        return {
          x: q.x / mag,
          y: q.y / mag,
          z: q.z / mag,
          w: q.w / mag,
        }
      }),

    fromAxisAngle: (axis: Vector3Data, angle: number) =>
      Effect.gen(function* (_) {
        const halfAngle = angle / 2
        const sin = Math.sin(halfAngle)
        const cos = Math.cos(halfAngle)

        // Normalize axis
        const axisMag = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z)
        if (axisMag === 0) {
          return { x: 0, y: 0, z: 0, w: 1 }
        }

        const normalizedAxis = {
          x: axis.x / axisMag,
          y: axis.y / axisMag,
          z: axis.z / axisMag,
        }

        return {
          x: normalizedAxis.x * sin,
          y: normalizedAxis.y * sin,
          z: normalizedAxis.z * sin,
          w: cos,
        }
      }),

    fromEuler: (pitch: number, yaw: number, roll: number) =>
      Effect.gen(function* (_) {
        const halfPitch = pitch / 2
        const halfYaw = yaw / 2
        const halfRoll = roll / 2

        const cp = Math.cos(halfPitch)
        const sp = Math.sin(halfPitch)
        const cy = Math.cos(halfYaw)
        const sy = Math.sin(halfYaw)
        const cr = Math.cos(halfRoll)
        const sr = Math.sin(halfRoll)

        return {
          x: sr * cp * cy - cr * sp * sy,
          y: cr * sp * cy + sr * cp * sy,
          z: cr * cp * sy - sr * sp * cy,
          w: cr * cp * cy + sr * sp * sy,
        }
      }),

    toEuler: (q: QuaternionData) =>
      Effect.gen(function* (_) {
        // Roll (x-axis rotation)
        const sinr_cosp = 2 * (q.w * q.x + q.y * q.z)
        const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y)
        const roll = Math.atan2(sinr_cosp, cosr_cosp)

        // Pitch (y-axis rotation)
        const sinp = 2 * (q.w * q.y - q.z * q.x)
        const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp)

        // Yaw (z-axis rotation)
        const siny_cosp = 2 * (q.w * q.z + q.x * q.y)
        const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z)
        const yaw = Math.atan2(siny_cosp, cosy_cosp)

        return { pitch, yaw, roll }
      }),

    rotateVector: (q: QuaternionData, vector: Vector3Data) =>
      Effect.gen(function* (_) {
        // Manual quaternion rotation: v' = q * v * q^(-1)
        // For unit quaternions, q^(-1) = conjugate(q)
        
        // First multiply: q * v (treating v as quaternion with w=0)
        const qv = {
          x: q.w * vector.x + q.y * vector.z - q.z * vector.y,
          y: q.w * vector.y + q.z * vector.x - q.x * vector.z,
          z: q.w * vector.z + q.x * vector.y - q.y * vector.x,
          w: -(q.x * vector.x + q.y * vector.y + q.z * vector.z),
        }
        
        // Then multiply result by conjugate of q
        const qConj = { x: -q.x, y: -q.y, z: -q.z, w: q.w }
        
        return {
          x: qv.w * qConj.x + qv.x * qConj.w + qv.y * qConj.z - qv.z * qConj.y,
          y: qv.w * qConj.y - qv.x * qConj.z + qv.y * qConj.w + qv.z * qConj.x,
          z: qv.w * qConj.z + qv.x * qConj.y - qv.y * qConj.x + qv.z * qConj.w,
        }
      }),
  })
)

/**
 * Native JavaScript Ray Adapter Implementation
 */
export const NativeRayAdapterLive = Layer.succeed(
  RayPort,
  RayPort.of({
    create: (origin: Vector3Data, direction: Vector3Data) =>
      Effect.succeed({ origin, direction }),

    at: (ray: RayData, distance: number) =>
      Effect.succeed({
        x: ray.origin.x + ray.direction.x * distance,
        y: ray.origin.y + ray.direction.y * distance,
        z: ray.origin.z + ray.direction.z * distance,
      }),

    intersectsSphere: (ray: RayData, center: Vector3Data, radius: number) =>
      Effect.gen(function* (_) {
        const oc = {
          x: ray.origin.x - center.x,
          y: ray.origin.y - center.y,
          z: ray.origin.z - center.z,
        }
        
        const a = ray.direction.x * ray.direction.x + ray.direction.y * ray.direction.y + ray.direction.z * ray.direction.z
        const b = 2.0 * (oc.x * ray.direction.x + oc.y * ray.direction.y + oc.z * ray.direction.z)
        const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - radius * radius
        
        const discriminant = b * b - 4 * a * c
        
        if (discriminant < 0) {
          return { hit: false }
        }
        
        const t = (-b - Math.sqrt(discriminant)) / (2.0 * a)
        if (t >= 0) {
          return { hit: true, distance: t }
        }
        
        return { hit: false }
      }),

    intersectsPlane: (ray: RayData, planeNormal: Vector3Data, planeDistance: number) =>
      Effect.gen(function* (_) {
        const denom = ray.direction.x * planeNormal.x + ray.direction.y * planeNormal.y + ray.direction.z * planeNormal.z
        
        if (Math.abs(denom) < 1e-6) {
          return { hit: false } // Ray is parallel to plane
        }
        
        const t = (planeDistance - (ray.origin.x * planeNormal.x + ray.origin.y * planeNormal.y + ray.origin.z * planeNormal.z)) / denom
        
        if (t >= 0) {
          const point = {
            x: ray.origin.x + ray.direction.x * t,
            y: ray.origin.y + ray.direction.y * t,
            z: ray.origin.z + ray.direction.z * t,
          }
          return { hit: true, point, distance: t }
        }
        
        return { hit: false }
      }),

    intersectsBox: (ray: RayData, min: Vector3Data, max: Vector3Data) =>
      Effect.gen(function* (_) {
        const invDir = {
          x: ray.direction.x === 0 ? Infinity : 1.0 / ray.direction.x,
          y: ray.direction.y === 0 ? Infinity : 1.0 / ray.direction.y,
          z: ray.direction.z === 0 ? Infinity : 1.0 / ray.direction.z,
        }
        
        const t1 = (min.x - ray.origin.x) * invDir.x
        const t2 = (max.x - ray.origin.x) * invDir.x
        const t3 = (min.y - ray.origin.y) * invDir.y
        const t4 = (max.y - ray.origin.y) * invDir.y
        const t5 = (min.z - ray.origin.z) * invDir.z
        const t6 = (max.z - ray.origin.z) * invDir.z
        
        const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6))
        const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6))
        
        if (tmax < 0 || tmin > tmax) {
          return { hit: false }
        }
        
        const t = tmin < 0 ? tmax : tmin
        const point = {
          x: ray.origin.x + ray.direction.x * t,
          y: ray.origin.y + ray.direction.y * t,
          z: ray.origin.z + ray.direction.z * t,
        }
        
        return { hit: true, point, distance: t }
      }),
  })
)

/**
 * Combined Native Math Adapter Layer
 */
export const NativeMathAdapterLive = Layer.succeed(
  MathPort,
  Effect.gen(function* (_) {
    const vector3 = yield* _(Vector3Port)
    const quaternion = yield* _(QuaternionPort)
    const ray = yield* _(RayPort)

    return MathPort.of({
      vector3,
      quaternion,
      ray,
    })
  }).pipe(Effect.provide(
    Layer.mergeAll(
      NativeVector3AdapterLive,
      NativeQuaternionAdapterLive,
      NativeRayAdapterLive
    )
  ))
)

/**
 * All Native Math Adapters Combined
 */
export const AllNativeMathAdaptersLive = Layer.mergeAll(
  NativeVector3AdapterLive,
  NativeQuaternionAdapterLive,
  NativeRayAdapterLive,
  NativeMathAdapterLive
)