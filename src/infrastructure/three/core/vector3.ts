/**
 * @fileoverview Three.js Vector3 - Effect-TSラッパー
 * 3次元ベクトルの型安全な不変操作を提供
 */

import { ErrorCauseSchema } from '@shared/schema/error'
import { Effect, Schema } from 'effect'
import * as THREE from 'three'

/**
 * Vector3 Schema定義（Brand型）
 * 3次元空間の位置・方向ベクトルを表現
 */
export const Vector3Schema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
}).pipe(Schema.brand('ThreeVector3'))

export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

/**
 * Vector3エラー型
 */
export const Vector3Error = Schema.TaggedError('Vector3Error')({
  operation: Schema.String,
  reason: Schema.String,
  vector: Schema.optional(Vector3Schema),
  cause: Schema.optional(ErrorCauseSchema),
})
export type Vector3Error = Schema.Schema.Type<typeof Vector3Error>

/**
 * Vector3コンストラクタ - プリミティブ値から構築
 *
 * @internal
 * Infrastructure層内部専用。値の検証を行わないため、信頼できる値のみに使用すること。
 * Three.jsとの連携において、構造的に同一であることが保証されている値の変換に使用。
 */
export const make = (x: number, y: number, z: number): Vector3 => ({ x, y, z }) as Vector3

/**
 * ゼロベクトル定数
 */
export const zero: Vector3 = make(0, 0, 0)

/**
 * 単位ベクトル定数
 */
export const one: Vector3 = make(1, 1, 1)

/**
 * 方向ベクトル定数
 */
export const up: Vector3 = make(0, 1, 0)
export const down: Vector3 = make(0, -1, 0)
export const left: Vector3 = make(-1, 0, 0)
export const right: Vector3 = make(1, 0, 0)
export const forward: Vector3 = make(0, 0, -1)
export const backward: Vector3 = make(0, 0, 1)

/**
 * Three.js Vector3からEffect型への変換
 */
export const fromThreeVector = (v: THREE.Vector3): Effect.Effect<Vector3, never> =>
  Effect.sync(() => make(v.x, v.y, v.z))

/**
 * Effect型からThree.js Vector3への変換
 */
export const toThreeVector = (v: Vector3): THREE.Vector3 => new THREE.Vector3(v.x, v.y, v.z)

/**
 * ベクトル加算
 */
export const add = (a: Vector3, b: Vector3): Vector3 => make(a.x + b.x, a.y + b.y, a.z + b.z)

/**
 * ベクトル減算
 */
export const subtract = (a: Vector3, b: Vector3): Vector3 => make(a.x - b.x, a.y - b.y, a.z - b.z)

/**
 * ベクトル乗算（要素ごと）
 */
export const multiply = (a: Vector3, b: Vector3): Vector3 => make(a.x * b.x, a.y * b.y, a.z * b.z)

/**
 * ベクトル除算（要素ごと）
 */
export const divide = (a: Vector3, b: Vector3): Effect.Effect<Vector3, Vector3Error> =>
  Effect.gen(function* () {
    if (b.x === 0 || b.y === 0 || b.z === 0) {
      return yield* Effect.fail(
        new Vector3Error({
          operation: 'divide',
          reason: 'Division by zero',
          vector: b,
        })
      )
    }
    return make(a.x / b.x, a.y / b.y, a.z / b.z)
  })

/**
 * スカラー倍
 */
export const scale = (v: Vector3, s: number): Vector3 => make(v.x * s, v.y * s, v.z * s)

/**
 * ベクトルの長さ（ノルム）
 */
export const length = (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

/**
 * ベクトルの長さの二乗（高速計算用）
 */
export const lengthSquared = (v: Vector3): number => v.x * v.x + v.y * v.y + v.z * v.z

/**
 * ベクトルの正規化（単位ベクトル化）- 同期版
 *
 * ゼロベクトルの場合は例外をthrowします
 */
export const normalizeSync = (v: Vector3): Vector3 => {
  const len = length(v)
  if (len === 0) {
    throw new Vector3Error({
      operation: 'normalize',
      reason: 'Cannot normalize zero vector',
      vector: v,
    })
  }
  return scale(v, 1 / len)
}

/**
 * ベクトルの正規化（単位ベクトル化）
 */
export const normalize = (v: Vector3): Effect.Effect<Vector3, Vector3Error> =>
  Effect.gen(function* () {
    const len = length(v)
    if (len === 0) {
      return yield* Effect.fail(
        new Vector3Error({
          operation: 'normalize',
          reason: 'Cannot normalize zero vector',
          vector: v,
        })
      )
    }
    return scale(v, 1 / len)
  })

/**
 * 内積（ドット積）
 */
export const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

/**
 * 外積（クロス積）
 */
export const cross = (a: Vector3, b: Vector3): Vector3 =>
  make(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

/**
 * 2つのベクトル間の距離
 */
export const distance = (a: Vector3, b: Vector3): number => length(subtract(a, b))

/**
 * 2つのベクトル間の距離の二乗（高速計算用）
 */
export const distanceSquared = (a: Vector3, b: Vector3): number => lengthSquared(subtract(a, b))

/**
 * 線形補間（Linear Interpolation）
 * @param t 補間係数（0.0 - 1.0）
 */
export const lerp = (a: Vector3, b: Vector3, t: number): Vector3 => {
  const clampedT = Math.max(0, Math.min(1, t))
  return make(a.x + (b.x - a.x) * clampedT, a.y + (b.y - a.y) * clampedT, a.z + (b.z - a.z) * clampedT)
}

/**
 * ベクトルのクランプ（各要素を範囲内に制限）
 */
export const clamp = (v: Vector3, min: Vector3, max: Vector3): Vector3 =>
  make(
    Math.max(min.x, Math.min(max.x, v.x)),
    Math.max(min.y, Math.min(max.y, v.y)),
    Math.max(min.z, Math.min(max.z, v.z))
  )

/**
 * ベクトルの要素ごとの絶対値
 */
export const abs = (v: Vector3): Vector3 => make(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))

/**
 * ベクトルの要素ごとの最小値
 */
export const min = (a: Vector3, b: Vector3): Vector3 => make(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z))

/**
 * ベクトルの要素ごとの最大値
 */
export const max = (a: Vector3, b: Vector3): Vector3 => make(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z))

/**
 * ベクトルの反転（各要素の符号反転）
 */
export const negate = (v: Vector3): Vector3 => make(-v.x, -v.y, -v.z)

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
