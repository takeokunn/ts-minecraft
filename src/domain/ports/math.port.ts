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
 * Combined Math Port interface
 */
export interface IMathPort {
  readonly vector3: IVector3Port
  readonly quaternion: IQuaternionPort
  readonly ray: IRayPort
}

// Context tags for dependency injection
export class Vector3Port extends Context.GenericTag('Vector3Port')<Vector3Port, IVector3Port>() {}
export class QuaternionPort extends Context.GenericTag('QuaternionPort')<QuaternionPort, IQuaternionPort>() {}
export class RayPort extends Context.GenericTag('RayPort')<RayPort, IRayPort>() {}
export class MathPort extends Context.GenericTag('MathPort')<MathPort, IMathPort>() {}

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