/**
 * Test builders for @ts-minecraft/core domain types.
 *
 * Centralises repeated setup so tests stay concise. Builders return
 * fully-valid values by default; callers override only what they care about.
 */

import { type Vector3 } from './math/vector3'
import { type Quaternion } from './math/quaternion'
import { type Color } from './math/color'
import { type Position } from './position'

// ── Vector3 ────────────────────────────────────────────────────────────────

export interface Vector3Overrides {
  x?: number
  y?: number
  z?: number
}

/** Returns `{ x: 0, y: 0, z: 0 }` with any fields overridden. */
export const makeTestVector3 = (overrides: Vector3Overrides = {}): Vector3 => ({
  x: 0,
  y: 0,
  z: 0,
  ...overrides,
})

// ── Quaternion ─────────────────────────────────────────────────────────────

export interface QuaternionOverrides {
  x?: number
  y?: number
  z?: number
  w?: number
}

/** Returns the identity quaternion `{ x: 0, y: 0, z: 0, w: 1 }` with any fields overridden. */
export const makeTestQuaternion = (overrides: QuaternionOverrides = {}): Quaternion => ({
  x: 0,
  y: 0,
  z: 0,
  w: 1,
  ...overrides,
})

// ── Color ──────────────────────────────────────────────────────────────────

export interface ColorOverrides {
  r?: number
  g?: number
  b?: number
}

/** Returns pure red `{ r: 1, g: 0, b: 0 }` with any channels overridden. */
export const makeTestColor = (overrides: ColorOverrides = {}): Color => ({
  r: 1,
  g: 0,
  b: 0,
  ...overrides,
})

// ── Position ───────────────────────────────────────────────────────────────

export interface PositionOverrides {
  x?: number
  y?: number
  z?: number
}

/** Returns origin `{ x: 0, y: 0, z: 0 }` with any coordinates overridden. */
export const makeTestPosition = (overrides: PositionOverrides = {}): Position => ({
  x: 0,
  y: 0,
  z: 0,
  ...overrides,
})

// ── ColorPort (duck-typed, satisfies ColorPortSchema) ──────────────────────

export interface ColorPort {
  r: number
  g: number
  b: number
  setHSL: () => void
  lerpColors: () => void
}

/** Returns a minimal ColorPort test-double; r/g/b default to `{ 0, 0, 0 }`. */
export const makeTestColorPort = (overrides: Partial<ColorPort> = {}): ColorPort => ({
  r: 0,
  g: 0,
  b: 0,
  setHSL: () => {},
  lerpColors: () => {},
  ...overrides,
})
