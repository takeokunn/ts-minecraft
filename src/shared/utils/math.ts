import * as S from 'effect/Schema'

/**
 * Mathematical utility functions and types
 */

/**
 * Represents a floating-point Number.
 */
export const Float = S.Number.pipe(S.brand('Float'))
export type Float = S.Schema.Type<typeof Float>
export const toFloat = S.decodeUnknownSync(Float)

/**
 * Represents an integer.
 */
export const Int = S.Number.pipe(S.int(), S.brand('Int'))
export type Int = S.Schema.Type<typeof Int>
export const toInt = S.decodeUnknownSync(Int)

/**
 * Schemas for 3D and 2D vectors.
 */
export const Vector3FloatSchema = S.Tuple(Float, Float, Float)
export type Vector3Float = S.Schema.Type<typeof Vector3FloatSchema>

export const Vector2FloatSchema = S.Tuple(Float, Float)
export type Vector2Float = S.Schema.Type<typeof Vector2FloatSchema>

export const Vector3IntSchema = S.Tuple(Int, Int, Int)
export type Vector3Int = S.Schema.Type<typeof Vector3IntSchema>

export const ChunkX = Int.pipe(S.brand('ChunkX'))
export type ChunkX = S.Schema.Type<typeof ChunkX>
export const toChunkX = S.decodeUnknownSync(ChunkX)

export const ChunkZ = Int.pipe(S.brand('ChunkZ'))
export type ChunkZ = S.Schema.Type<typeof ChunkZ>
export const toChunkZ = S.decodeUnknownSync(ChunkZ)

/**
 * Mathematical utility functions
 */
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const distance2D = (x1: number, y1: number, x2: number, y2: number): number => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

export const distance3D = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2)

export const normalizeAngle = (angle: number): number => {
  while (angle < 0) angle += 2 * Math.PI
  while (angle >= 2 * Math.PI) angle -= 2 * Math.PI
  return angle
}

export const degreesToRadians = (degrees: number): number => degrees * (Math.PI / 180)

export const radiansToDegrees = (radians: number): number => radians * (180 / Math.PI)

export const isPowerOfTwo = (value: number): boolean => (value & (value - 1)) === 0 && value !== 0

export const nextPowerOfTwo = (value: number): number => {
  if (isPowerOfTwo(value)) return value
  let power = 1
  while (power < value) {
    power *= 2
  }
  return power
}
