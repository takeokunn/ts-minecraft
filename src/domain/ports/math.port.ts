/**
 * Math Port - Interface for mathematical operations
 *
 * This port defines the contract for 3D mathematical operations,
 * allowing the domain layer to perform vector, quaternion, and ray
 * operations without depending on specific implementations (Three.js, gl-matrix, etc.).
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'

// Domain-specific math types (pure data structures)
export interface Vector3Data {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface QuaternionData {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}

export interface RayData {
  readonly origin: Vector3Data
  readonly direction: Vector3Data
}

export interface RaycastHit {
  readonly point: Vector3Data
  readonly normal: Vector3Data
  readonly distance: number
  readonly blockType?: string
}

export interface Matrix4Data {
  readonly elements: readonly [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number
  ]
}

/**
 * Vector3 operations interface
 */
export interface IVector3Port {
  readonly create: (x: number, y: number, z: number) => Effect.Effect<Vector3Data, never, never>
  readonly add: (a: Vector3Data, b: Vector3Data) => Effect.Effect<Vector3Data, never, never>
  readonly subtract: (a: Vector3Data, b: Vector3Data) => Effect.Effect<Vector3Data, never, never>
  readonly multiply: (vector: Vector3Data, scalar: number) => Effect.Effect<Vector3Data, never, never>
  readonly dot: (a: Vector3Data, b: Vector3Data) => Effect.Effect<number, never, never>
  readonly cross: (a: Vector3Data, b: Vector3Data) => Effect.Effect<Vector3Data, never, never>
  readonly magnitude: (vector: Vector3Data) => Effect.Effect<number, never, never>
  readonly normalize: (vector: Vector3Data) => Effect.Effect<Vector3Data, never, never>
  readonly distance: (a: Vector3Data, b: Vector3Data) => Effect.Effect<number, never, never>
  readonly lerp: (a: Vector3Data, b: Vector3Data, t: number) => Effect.Effect<Vector3Data, never, never>
}

/**
 * Quaternion operations interface
 */
export interface IQuaternionPort {
  readonly create: (x: number, y: number, z: number, w: number) => Effect.Effect<QuaternionData, never, never>
  readonly identity: () => Effect.Effect<QuaternionData, never, never>
  readonly multiply: (a: QuaternionData, b: QuaternionData) => Effect.Effect<QuaternionData, never, never>
  readonly conjugate: (q: QuaternionData) => Effect.Effect<QuaternionData, never, never>
  readonly normalize: (q: QuaternionData) => Effect.Effect<QuaternionData, never, never>
  readonly fromAxisAngle: (axis: Vector3Data, angle: number) => Effect.Effect<QuaternionData, never, never>
  readonly fromEuler: (pitch: number, yaw: number, roll: number) => Effect.Effect<QuaternionData, never, never>
  readonly toEuler: (q: QuaternionData) => Effect.Effect<{ pitch: number; yaw: number; roll: number }, never, never>
  readonly rotateVector: (q: QuaternionData, vector: Vector3Data) => Effect.Effect<Vector3Data, never, never>
}

/**
 * Ray operations interface
 */
export interface IRayPort {
  readonly create: (origin: Vector3Data, direction: Vector3Data) => Effect.Effect<RayData, never, never>
  readonly at: (ray: RayData, distance: number) => Effect.Effect<Vector3Data, never, never>
  readonly intersectsSphere: (ray: RayData, center: Vector3Data, radius: number) => Effect.Effect<{ hit: boolean; distance?: number }, never, never>
  readonly intersectsPlane: (ray: RayData, planeNormal: Vector3Data, planeDistance: number) => Effect.Effect<{ hit: boolean; point?: Vector3Data; distance?: number }, never, never>
  readonly intersectsBox: (ray: RayData, min: Vector3Data, max: Vector3Data) => Effect.Effect<{ hit: boolean; point?: Vector3Data; distance?: number }, never, never>
}

/**
 * Matrix4 operations interface for transformations
 */
export interface IMatrix4Port {
  readonly create: () => Effect.Effect<Matrix4Data, never, never>
  readonly identity: () => Effect.Effect<Matrix4Data, never, never>
  readonly fromArray: (elements: readonly number[]) => Effect.Effect<Matrix4Data, never, never>
  readonly multiply: (a: Matrix4Data, b: Matrix4Data) => Effect.Effect<Matrix4Data, never, never>
  readonly multiplyVector3: (matrix: Matrix4Data, vector: Vector3Data) => Effect.Effect<Vector3Data, never, never>
  readonly transpose: (matrix: Matrix4Data) => Effect.Effect<Matrix4Data, never, never>
  readonly invert: (matrix: Matrix4Data) => Effect.Effect<Matrix4Data, never, never>
  readonly translate: (matrix: Matrix4Data, vector: Vector3Data) => Effect.Effect<Matrix4Data, never, never>
  readonly rotate: (matrix: Matrix4Data, axis: Vector3Data, angle: number) => Effect.Effect<Matrix4Data, never, never>
  readonly scale: (matrix: Matrix4Data, vector: Vector3Data) => Effect.Effect<Matrix4Data, never, never>
  readonly lookAt: (eye: Vector3Data, center: Vector3Data, up: Vector3Data) => Effect.Effect<Matrix4Data, never, never>
  readonly perspective: (fov: number, aspect: number, near: number, far: number) => Effect.Effect<Matrix4Data, never, never>
}

/**
 * Combined Math Port interface
 */
export interface IMathPort {
  readonly vector3: IVector3Port
  readonly quaternion: IQuaternionPort
  readonly ray: IRayPort
  readonly matrix4: IMatrix4Port
}

// Context tags for dependency injection
export const Vector3Port = Context.GenericTag<IVector3Port>('Vector3Port')
export const QuaternionPort = Context.GenericTag<IQuaternionPort>('QuaternionPort')
export const RayPort = Context.GenericTag<IRayPort>('RayPort')
export const Matrix4Port = Context.GenericTag<IMatrix4Port>('Matrix4Port')
export const MathPort = Context.GenericTag<IMathPort>('MathPort')

// Constants for common vectors
export const VECTOR3_CONSTANTS = {
  ZERO: { x: 0, y: 0, z: 0 } as const,
  ONE: { x: 1, y: 1, z: 1 } as const,
  UP: { x: 0, y: 1, z: 0 } as const,
  DOWN: { x: 0, y: -1, z: 0 } as const,
  FORWARD: { x: 0, y: 0, z: 1 } as const,
  BACK: { x: 0, y: 0, z: -1 } as const,
  RIGHT: { x: 1, y: 0, z: 0 } as const,
  LEFT: { x: -1, y: 0, z: 0 } as const,
} as const

// Constants for common quaternions
export const QUATERNION_CONSTANTS = {
  IDENTITY: { x: 0, y: 0, z: 0, w: 1 } as const,
} as const

// Constants for common matrices
export const MATRIX4_CONSTANTS = {
  IDENTITY: {
    elements: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]
  } as const,
} as const