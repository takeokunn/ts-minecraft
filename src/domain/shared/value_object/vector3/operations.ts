/**
 * @fileoverview Vector3 Operations - ベクトル演算
 * Vector3の操作関数群（不変操作）
 */

import { Effect, Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { ErrorCauseSchema } from '@/shared/schema/error'
import { Vector3Schema, type Vector3 } from './schema'

/**
 * Vector3エラー型
 */
export const Vector3ErrorSchema = Schema.TaggedError('Vector3Error', {
  operation: Schema.String,
  reason: Schema.String,
  vector: Schema.optional(Vector3Schema),
  cause: Schema.optional(ErrorCauseSchema),
})

export type Vector3Error = Schema.Schema.Type<typeof Vector3ErrorSchema>

export const Vector3Error = makeErrorFactory(Vector3ErrorSchema)

// -----------------------------------------------------------------------------
// Constructors
// -----------------------------------------------------------------------------

/**
 * Vector3コンストラクタ - プリミティブ値から構築
 */
export const make = (x: number, y: number, z: number): Effect.Effect<Vector3, Vector3Error> =>
  Schema.decode(Vector3Schema)({ x, y, z }).pipe(
    Effect.mapError((error) =>
      Vector3Error.make({
        operation: 'make',
        reason: 'Invalid vector components',
        cause: error instanceof Error ? error : { message: String(error) },
      })
    )
  )

/**
 * Vector3コンストラクタ（同期版）- 検証なし（パフォーマンス最適化用）
 * 注意: 既に検証済みの値にのみ使用すること
 */
export const makeUnsafe = (x: number, y: number, z: number): Vector3 => Schema.make(Vector3Schema)({ x, y, z })

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * ゼロベクトル定数
 */
export const zero: Vector3 = makeUnsafe(0, 0, 0)

/**
 * 単位ベクトル定数
 */
export const one: Vector3 = makeUnsafe(1, 1, 1)

/**
 * 方向ベクトル定数
 */
export const up: Vector3 = makeUnsafe(0, 1, 0)
export const down: Vector3 = makeUnsafe(0, -1, 0)
export const left: Vector3 = makeUnsafe(-1, 0, 0)
export const right: Vector3 = makeUnsafe(1, 0, 0)
export const forward: Vector3 = makeUnsafe(0, 0, -1)
export const backward: Vector3 = makeUnsafe(0, 0, 1)

// -----------------------------------------------------------------------------
// Arithmetic Operations
// -----------------------------------------------------------------------------

/**
 * ベクトル加算
 */
export const add = (a: Vector3, b: Vector3): Vector3 => makeUnsafe(a.x + b.x, a.y + b.y, a.z + b.z)

/**
 * ベクトル減算
 */
export const subtract = (a: Vector3, b: Vector3): Vector3 => makeUnsafe(a.x - b.x, a.y - b.y, a.z - b.z)

/**
 * ベクトル乗算（要素ごと）
 */
export const multiply = (a: Vector3, b: Vector3): Vector3 => makeUnsafe(a.x * b.x, a.y * b.y, a.z * b.z)

/**
 * ベクトル除算（要素ごと）
 */
export const divide = (a: Vector3, b: Vector3): Effect.Effect<Vector3, Vector3Error> =>
  Effect.gen(function* () {
    if (b.x === 0 || b.y === 0 || b.z === 0) {
      return yield* Effect.fail(
        Vector3Error.make({
          operation: 'divide',
          reason: 'Division by zero',
          vector: b,
        })
      )
    }
    return makeUnsafe(a.x / b.x, a.y / b.y, a.z / b.z)
  })

/**
 * スカラー倍
 */
export const scale = (v: Vector3, s: number): Vector3 => makeUnsafe(v.x * s, v.y * s, v.z * s)

// -----------------------------------------------------------------------------
// Vector Magnitude
// -----------------------------------------------------------------------------

/**
 * ベクトルの長さ（ノルム）
 */
export const length = (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

/**
 * ベクトルの長さの二乗（高速計算用）
 */
export const lengthSquared = (v: Vector3): number => v.x * v.x + v.y * v.y + v.z * v.z

/**
 * ベクトルの正規化（単位ベクトル化）
 */
export const normalize = (v: Vector3): Effect.Effect<Vector3, Vector3Error> =>
  Effect.gen(function* () {
    const len = length(v)
    if (len === 0) {
      return yield* Effect.fail(
        Vector3Error.make({
          operation: 'normalize',
          reason: 'Cannot normalize zero vector',
          vector: v,
        })
      )
    }
    return scale(v, 1 / len)
  })

// -----------------------------------------------------------------------------
// Vector Products
// -----------------------------------------------------------------------------

/**
 * 内積（ドット積）
 */
export const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

/**
 * 外積（クロス積）
 */
export const cross = (a: Vector3, b: Vector3): Vector3 =>
  makeUnsafe(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

// -----------------------------------------------------------------------------
// Distance
// -----------------------------------------------------------------------------

/**
 * 2つのベクトル間の距離
 */
export const distance = (a: Vector3, b: Vector3): number => length(subtract(a, b))

/**
 * 2つのベクトル間の距離の二乗（高速計算用）
 */
export const distanceSquared = (a: Vector3, b: Vector3): number => lengthSquared(subtract(a, b))

// -----------------------------------------------------------------------------
// Interpolation
// -----------------------------------------------------------------------------

/**
 * 線形補間（Linear Interpolation）
 * @param t 補間係数（0.0 - 1.0）
 */
export const lerp = (a: Vector3, b: Vector3, t: number): Vector3 => {
  const clampedT = Math.max(0, Math.min(1, t))
  return makeUnsafe(a.x + (b.x - a.x) * clampedT, a.y + (b.y - a.y) * clampedT, a.z + (b.z - a.z) * clampedT)
}

// -----------------------------------------------------------------------------
// Clamping
// -----------------------------------------------------------------------------

/**
 * ベクトルのクランプ（各要素を範囲内に制限）
 */
export const clamp = (v: Vector3, min: Vector3, max: Vector3): Vector3 =>
  makeUnsafe(
    Math.max(min.x, Math.min(max.x, v.x)),
    Math.max(min.y, Math.min(max.y, v.y)),
    Math.max(min.z, Math.min(max.z, v.z))
  )

// -----------------------------------------------------------------------------
// Component-wise Operations
// -----------------------------------------------------------------------------

/**
 * ベクトルの要素ごとの絶対値
 */
export const abs = (v: Vector3): Vector3 => makeUnsafe(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))

/**
 * ベクトルの要素ごとの最小値
 */
export const min = (a: Vector3, b: Vector3): Vector3 =>
  makeUnsafe(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z))

/**
 * ベクトルの要素ごとの最大値
 */
export const max = (a: Vector3, b: Vector3): Vector3 =>
  makeUnsafe(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z))

/**
 * ベクトルの反転（各要素の符号反転）
 */
export const negate = (v: Vector3): Vector3 => makeUnsafe(-v.x, -v.y, -v.z)

// -----------------------------------------------------------------------------
// Comparison
// -----------------------------------------------------------------------------

/**
 * ベクトルの等価性判定
 */
export const equals = (a: Vector3, b: Vector3, epsilon: number = Number.EPSILON): boolean => {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon && Math.abs(a.z - b.z) <= epsilon
}

/**
 * ゼロベクトル判定
 */
export const isZero = (v: Vector3, epsilon: number = Number.EPSILON): boolean => equals(v, zero, epsilon)

// -----------------------------------------------------------------------------
// Conversion
// -----------------------------------------------------------------------------

/**
 * 文字列変換
 */
export const toString = (v: Vector3): string => `Vector3(${v.x}, ${v.y}, ${v.z})`
