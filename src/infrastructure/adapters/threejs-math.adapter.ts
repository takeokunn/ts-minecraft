/**
 * Three.js Math Adapter - Implements math operations using Three.js
 *
 * This adapter provides concrete implementation for 3D mathematical operations
 * using Three.js library, isolating the domain layer from specific
 * math library implementation details.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as THREE from 'three'
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
 * Three.js Vector3 Adapter Implementation
 */
export const ThreeJsVector3AdapterLive = Layer.succeed(
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
 * Three.js Quaternion Adapter Implementation
 */
export const ThreeJsQuaternionAdapterLive = Layer.succeed(
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
        // Convert to Three.js types for the rotation operation
        const threeQuat = new THREE.Quaternion(q.x, q.y, q.z, q.w)
        const threeVector = new THREE.Vector3(vector.x, vector.y, vector.z)

        threeVector.applyQuaternion(threeQuat)

        return {
          x: threeVector.x,
          y: threeVector.y,
          z: threeVector.z,
        }
      }),
  }),
)

/**
 * Three.js Ray Adapter Implementation
 */
export const ThreeJsRayAdapterLive = Layer.succeed(
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
        const threeRay = new THREE.Ray(new THREE.Vector3(ray.origin.x, ray.origin.y, ray.origin.z), new THREE.Vector3(ray.direction.x, ray.direction.y, ray.direction.z))
        const sphere = new THREE.Sphere(new THREE.Vector3(center.x, center.y, center.z), radius)

        const intersection = threeRay.intersectSphere(sphere, new THREE.Vector3())

        if (intersection) {
          const distance = threeRay.origin.distanceTo(intersection)
          return { hit: true, distance }
        }

        return { hit: false }
      }),

    intersectsPlane: (ray: RayData, planeNormal: Vector3Data, planeDistance: number) =>
      Effect.gen(function* (_) {
        const threeRay = new THREE.Ray(new THREE.Vector3(ray.origin.x, ray.origin.y, ray.origin.z), new THREE.Vector3(ray.direction.x, ray.direction.y, ray.direction.z))
        const plane = new THREE.Plane(new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z), planeDistance)

        const intersection = threeRay.intersectPlane(plane, new THREE.Vector3())

        if (intersection) {
          const distance = threeRay.origin.distanceTo(intersection)
          return {
            hit: true,
            point: { x: intersection.x, y: intersection.y, z: intersection.z },
            distance,
          }
        }

        return { hit: false }
      }),

    intersectsBox: (ray: RayData, min: Vector3Data, max: Vector3Data) =>
      Effect.gen(function* (_) {
        const threeRay = new THREE.Ray(new THREE.Vector3(ray.origin.x, ray.origin.y, ray.origin.z), new THREE.Vector3(ray.direction.x, ray.direction.y, ray.direction.z))
        const box = new THREE.Box3(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, max.y, max.z))

        const intersection = threeRay.intersectBox(box, new THREE.Vector3())

        if (intersection) {
          const distance = threeRay.origin.distanceTo(intersection)
          return {
            hit: true,
            point: { x: intersection.x, y: intersection.y, z: intersection.z },
            distance,
          }
        }

        return { hit: false }
      }),
  }),
)

/**
 * Three.js Matrix4 Adapter Implementation
 */
export const ThreeJsMatrix4AdapterLive = Layer.succeed(
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
        const matA = new THREE.Matrix4().fromArray(Array.from(a.elements))
        const matB = new THREE.Matrix4().fromArray(Array.from(b.elements))
        matA.multiply(matB)
        return { elements: matA.elements as any }
      }),

    multiplyVector3: (matrix: Matrix4Data, vector: Vector3Data) =>
      Effect.gen(function* (_) {
        const mat = new THREE.Matrix4().fromArray(Array.from(matrix.elements))
        const vec = new THREE.Vector3(vector.x, vector.y, vector.z)
        vec.applyMatrix4(mat)
        return { x: vec.x, y: vec.y, z: vec.z }
      }),

    transpose: (matrix: Matrix4Data) =>
      Effect.gen(function* (_) {
        const mat = new THREE.Matrix4().fromArray(Array.from(matrix.elements))
        mat.transpose()
        return { elements: mat.elements as any }
      }),

    invert: (matrix: Matrix4Data) =>
      Effect.gen(function* (_) {
        const mat = new THREE.Matrix4().fromArray(Array.from(matrix.elements))
        mat.invert()
        return { elements: mat.elements as any }
      }),

    translate: (matrix: Matrix4Data, vector: Vector3Data) =>
      Effect.gen(function* (_) {
        const mat = new THREE.Matrix4().fromArray(Array.from(matrix.elements))
        const translation = new THREE.Matrix4().makeTranslation(vector.x, vector.y, vector.z)
        mat.multiply(translation)
        return { elements: mat.elements as any }
      }),

    rotate: (matrix: Matrix4Data, axis: Vector3Data, angle: number) =>
      Effect.gen(function* (_) {
        const mat = new THREE.Matrix4().fromArray(Array.from(matrix.elements))
        const rotation = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(axis.x, axis.y, axis.z).normalize(), angle)
        mat.multiply(rotation)
        return { elements: mat.elements as any }
      }),

    scale: (matrix: Matrix4Data, vector: Vector3Data) =>
      Effect.gen(function* (_) {
        const mat = new THREE.Matrix4().fromArray(Array.from(matrix.elements))
        const scaling = new THREE.Matrix4().makeScale(vector.x, vector.y, vector.z)
        mat.multiply(scaling)
        return { elements: mat.elements as any }
      }),

    lookAt: (eye: Vector3Data, center: Vector3Data, up: Vector3Data) =>
      Effect.gen(function* (_) {
        const mat = new THREE.Matrix4()
        mat.lookAt(new THREE.Vector3(eye.x, eye.y, eye.z), new THREE.Vector3(center.x, center.y, center.z), new THREE.Vector3(up.x, up.y, up.z))
        return { elements: mat.elements as any }
      }),

    perspective: (fov: number, aspect: number, near: number, far: number) =>
      Effect.gen(function* (_) {
        const mat = new THREE.Matrix4()
        mat.makePerspective(-aspect * Math.tan(fov / 2), aspect * Math.tan(fov / 2), Math.tan(fov / 2), -Math.tan(fov / 2), near, far)
        return { elements: mat.elements as any }
      }),
  }),
)

/**
 * Combined Math Adapter Layer
 */
export const ThreeJsMathAdapterLive = Layer.succeed(
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
  }).pipe(Effect.provide(Layer.mergeAll(ThreeJsVector3AdapterLive, ThreeJsQuaternionAdapterLive, ThreeJsRayAdapterLive, ThreeJsMatrix4AdapterLive))),
)

/**
 * All Three.js Math Adapters Combined
 */
export const AllThreeJsMathAdaptersLive = Layer.mergeAll(
  ThreeJsVector3AdapterLive,
  ThreeJsQuaternionAdapterLive,
  ThreeJsRayAdapterLive,
  ThreeJsMatrix4AdapterLive,
  ThreeJsMathAdapterLive,
)
