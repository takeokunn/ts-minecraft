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
  IMatrix4Port,
  IMathPort,
  Vector3Data,
  QuaternionData,
  RayData,
  Matrix4Data,
  Vector3Port,
  QuaternionPort,
  RayPort,
  Matrix4Port,
  MathPort,
} from '@domain/ports/math.port'

/**
 * Native JavaScript Vector3 Adapter Implementation
 */
export const NativeVector3AdapterLive = Layer.succeed(
  Vector3Port,
  Vector3Port.of({
    create: (x: number, y: number, z: number) => Effect.succeed({ x, y, z }),

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

    dot: (a: Vector3Data, b: Vector3Data) => Effect.succeed(a.x * b.x + a.y * b.y + a.z * b.z),

    cross: (a: Vector3Data, b: Vector3Data) =>
      Effect.succeed({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      }),

    magnitude: (vector: Vector3Data) => Effect.succeed(Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)),

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
  }),
)

/**
 * Native JavaScript Quaternion Adapter Implementation
 */
export const NativeQuaternionAdapterLive = Layer.succeed(
  QuaternionPort,
  QuaternionPort.of({
    create: (x: number, y: number, z: number, w: number) => Effect.succeed({ x, y, z, w }),

    identity: () => Effect.succeed({ x: 0, y: 0, z: 0, w: 1 }),

    multiply: (a: QuaternionData, b: QuaternionData) =>
      Effect.succeed({
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      }),

    conjugate: (q: QuaternionData) => Effect.succeed({ x: -q.x, y: -q.y, z: -q.z, w: q.w }),

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
  }),
)

/**
 * Native JavaScript Ray Adapter Implementation
 */
export const NativeRayAdapterLive = Layer.succeed(
  RayPort,
  RayPort.of({
    create: (origin: Vector3Data, direction: Vector3Data) => Effect.succeed({ origin, direction }),

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
  }),
)

/**
 * Native JavaScript Matrix4 Adapter Implementation
 */
export const NativeMatrix4AdapterLive = Layer.succeed(
  Matrix4Port,
  Matrix4Port.of({
    create: () =>
      Effect.succeed({
        elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      }),

    identity: () =>
      Effect.succeed({
        elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      }),

    fromArray: (elements: readonly number[]) =>
      Effect.succeed({
        elements: [
          elements[0] || 0,
          elements[1] || 0,
          elements[2] || 0,
          elements[3] || 0,
          elements[4] || 0,
          elements[5] || 0,
          elements[6] || 0,
          elements[7] || 0,
          elements[8] || 0,
          elements[9] || 0,
          elements[10] || 0,
          elements[11] || 0,
          elements[12] || 0,
          elements[13] || 0,
          elements[14] || 0,
          elements[15] || 0,
        ],
      }),

    multiply: (a: Matrix4Data, b: Matrix4Data) =>
      Effect.gen(function* (_) {
        const ae = a.elements
        const be = b.elements
        const result: number[] = new Array(16)

        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            result[i * 4 + j] = ae[i * 4 + 0] * be[0 * 4 + j] + ae[i * 4 + 1] * be[1 * 4 + j] + ae[i * 4 + 2] * be[2 * 4 + j] + ae[i * 4 + 3] * be[3 * 4 + j]
          }
        }

        return { elements: result as any }
      }),

    multiplyVector3: (matrix: Matrix4Data, vector: Vector3Data) =>
      Effect.gen(function* (_) {
        const m = matrix.elements
        const x = vector.x,
          y = vector.y,
          z = vector.z

        const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15])

        return {
          x: (m[0] * x + m[4] * y + m[8] * z + m[12]) * w,
          y: (m[1] * x + m[5] * y + m[9] * z + m[13]) * w,
          z: (m[2] * x + m[6] * y + m[10] * z + m[14]) * w,
        }
      }),

    transpose: (matrix: Matrix4Data) =>
      Effect.gen(function* (_) {
        const m = matrix.elements
        return {
          elements: [m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]],
        }
      }),

    invert: (matrix: Matrix4Data) =>
      Effect.gen(function* (_) {
        const m = matrix.elements
        const inv = new Array(16)

        inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10]
        inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10]
        inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9]
        inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9]
        inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10]
        inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10]
        inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9]
        inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9]
        inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6]
        inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6]
        inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5]
        inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5]
        inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6]
        inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6]
        inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5]
        inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5]

        const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12]

        if (det === 0) {
          return { elements: matrix.elements } // Return original if not invertible
        }

        const invDet = 1.0 / det
        for (let i = 0; i < 16; i++) {
          inv[i] *= invDet
        }

        return { elements: inv as any }
      }),

    translate: (matrix: Matrix4Data, vector: Vector3Data) =>
      Effect.gen(function* (_) {
        const translation = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, vector.x, vector.y, vector.z, 1]

        return yield* _(
          Effect.succeed({ elements: translation as any }).pipe(
            Effect.flatMap((t) =>
              Effect.succeed(t).pipe(
                Effect.flatMap((t) => {
                  const ae = matrix.elements
                  const be = t.elements
                  const result: number[] = new Array(16)

                  for (let i = 0; i < 4; i++) {
                    for (let j = 0; j < 4; j++) {
                      result[i * 4 + j] = ae[i * 4 + 0] * be[0 * 4 + j] + ae[i * 4 + 1] * be[1 * 4 + j] + ae[i * 4 + 2] * be[2 * 4 + j] + ae[i * 4 + 3] * be[3 * 4 + j]
                    }
                  }

                  return Effect.succeed({ elements: result as any })
                }),
              ),
            ),
          ),
        )
      }),

    rotate: (matrix: Matrix4Data, axis: Vector3Data, angle: number) =>
      Effect.gen(function* (_) {
        const axisMag = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z)
        if (axisMag === 0) return matrix

        const x = axis.x / axisMag
        const y = axis.y / axisMag
        const z = axis.z / axisMag

        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const t = 1 - cos

        const rotation = [
          cos + x * x * t,
          x * y * t - z * sin,
          x * z * t + y * sin,
          0,
          y * x * t + z * sin,
          cos + y * y * t,
          y * z * t - x * sin,
          0,
          z * x * t - y * sin,
          z * y * t + x * sin,
          cos + z * z * t,
          0,
          0,
          0,
          0,
          1,
        ]

        const ae = matrix.elements
        const be = rotation
        const result: number[] = new Array(16)

        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            result[i * 4 + j] = ae[i * 4 + 0] * be[0 * 4 + j] + ae[i * 4 + 1] * be[1 * 4 + j] + ae[i * 4 + 2] * be[2 * 4 + j] + ae[i * 4 + 3] * be[3 * 4 + j]
          }
        }

        return { elements: result as any }
      }),

    scale: (matrix: Matrix4Data, vector: Vector3Data) =>
      Effect.gen(function* (_) {
        const scaling = [vector.x, 0, 0, 0, 0, vector.y, 0, 0, 0, 0, vector.z, 0, 0, 0, 0, 1]

        const ae = matrix.elements
        const be = scaling
        const result: number[] = new Array(16)

        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            result[i * 4 + j] = ae[i * 4 + 0] * be[0 * 4 + j] + ae[i * 4 + 1] * be[1 * 4 + j] + ae[i * 4 + 2] * be[2 * 4 + j] + ae[i * 4 + 3] * be[3 * 4 + j]
          }
        }

        return { elements: result as any }
      }),

    lookAt: (eye: Vector3Data, center: Vector3Data, up: Vector3Data) =>
      Effect.gen(function* (_) {
        const zAxis = {
          x: eye.x - center.x,
          y: eye.y - center.y,
          z: eye.z - center.z,
        }
        const zLen = Math.sqrt(zAxis.x * zAxis.x + zAxis.y * zAxis.y + zAxis.z * zAxis.z)
        if (zLen === 0) {
          return {
            elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          }
        }
        zAxis.x /= zLen
        zAxis.y /= zLen
        zAxis.z /= zLen

        const xAxis = {
          x: up.y * zAxis.z - up.z * zAxis.y,
          y: up.z * zAxis.x - up.x * zAxis.z,
          z: up.x * zAxis.y - up.y * zAxis.x,
        }
        const xLen = Math.sqrt(xAxis.x * xAxis.x + xAxis.y * xAxis.y + xAxis.z * xAxis.z)
        if (xLen === 0) {
          return {
            elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
          }
        }
        xAxis.x /= xLen
        xAxis.y /= xLen
        xAxis.z /= xLen

        const yAxis = {
          x: zAxis.y * xAxis.z - zAxis.z * xAxis.y,
          y: zAxis.z * xAxis.x - zAxis.x * xAxis.z,
          z: zAxis.x * xAxis.y - zAxis.y * xAxis.x,
        }

        return {
          elements: [
            xAxis.x,
            yAxis.x,
            zAxis.x,
            0,
            xAxis.y,
            yAxis.y,
            zAxis.y,
            0,
            xAxis.z,
            yAxis.z,
            zAxis.z,
            0,
            -(xAxis.x * eye.x + xAxis.y * eye.y + xAxis.z * eye.z),
            -(yAxis.x * eye.x + yAxis.y * eye.y + yAxis.z * eye.z),
            -(zAxis.x * eye.x + zAxis.y * eye.y + zAxis.z * eye.z),
            1,
          ],
        }
      }),

    perspective: (fov: number, aspect: number, near: number, far: number) =>
      Effect.gen(function* (_) {
        const f = Math.tan(Math.PI * 0.5 - 0.5 * fov)
        const rangeInv = 1.0 / (near - far)

        return {
          elements: [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * rangeInv, -1, 0, 0, near * far * rangeInv * 2, 0],
        }
      }),
  }),
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
    const matrix4 = yield* _(Matrix4Port)

    return MathPort.of({
      vector3,
      quaternion,
      ray,
      matrix4,
    })
  }).pipe(Effect.provide(Layer.mergeAll(NativeVector3AdapterLive, NativeQuaternionAdapterLive, NativeRayAdapterLive, NativeMatrix4AdapterLive))),
)

/**
 * All Native Math Adapters Combined
 */
export const AllNativeMathAdaptersLive = Layer.mergeAll(
  NativeVector3AdapterLive,
  NativeQuaternionAdapterLive,
  NativeRayAdapterLive,
  NativeMatrix4AdapterLive,
  NativeMathAdapterLive,
)
