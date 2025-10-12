/**
 * @fileoverview Three.js Quaternion - Effect-TSラッパー
 * クォータニオン（四元数）による回転表現の型安全な不変操作を提供
 */

import { ErrorCauseSchema } from '@shared/schema/error'
import { Effect, Match, Schema, pipe } from 'effect'
import * as THREE from 'three'
import type { Vector3 } from './vector3'
import * as V3 from './vector3'

/**
 * Quaternion Schema定義（Brand型）
 * 3次元空間の回転を表現（ジンバルロック回避）
 */
export const QuaternionSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
  w: Schema.Number.pipe(Schema.finite()),
}).pipe(Schema.brand('ThreeQuaternion'))

export type Quaternion = Schema.Schema.Type<typeof QuaternionSchema>

/**
 * Quaternionエラー型
 */
export const QuaternionError = Schema.TaggedError('QuaternionError')({
  operation: Schema.String,
  reason: Schema.String,
  quaternion: Schema.optional(QuaternionSchema),
  cause: Schema.optional(ErrorCauseSchema),
})
export type QuaternionError = Schema.Schema.Type<typeof QuaternionError>

/**
 * Quaternionコンストラクタ - プリミティブ値から構築
 *
 * @internal
 * Infrastructure層内部専用。値の検証を行わないため、信頼できる値のみに使用すること。
 * Three.jsとの連携において、構造的に同一であることが保証されている値の変換に使用。
 */
export const make = (x: number, y: number, z: number, w: number): Quaternion => ({ x, y, z, w }) as Quaternion

/**
 * 単位クォータニオン（無回転）
 */
export const identity: Quaternion = make(0, 0, 0, 1)

/**
 * Three.js QuaternionからEffect型への変換
 */
export const fromThreeQuaternion = (q: THREE.Quaternion): Effect.Effect<Quaternion, never> =>
  Effect.sync(() => make(q.x, q.y, q.z, q.w))

/**
 * Effect型からThree.js Quaternionへの変換
 */
export const toThreeQuaternion = (q: Quaternion): THREE.Quaternion => new THREE.Quaternion(q.x, q.y, q.z, q.w)

/**
 * 軸と角度からクォータニオンを生成
 * @param axis 回転軸（正規化済み）
 * @param angle 回転角（ラジアン）
 */
export const fromAxisAngle = (axis: Vector3, angle: number): Effect.Effect<Quaternion, QuaternionError> =>
  Effect.gen(function* () {
    const normalizedAxis = yield* V3.normalize(axis).pipe(
      Effect.mapError(
        (error) =>
          new QuaternionError({
            operation: 'fromAxisAngle',
            reason: 'Invalid axis for quaternion creation',
            cause: error instanceof Error ? error : { message: String(error) },
          })
      )
    )

    const halfAngle = angle / 2
    const s = Math.sin(halfAngle)

    return make(normalizedAxis.x * s, normalizedAxis.y * s, normalizedAxis.z * s, Math.cos(halfAngle))
  })

/**
 * クォータニオンの乗算（回転の合成）
 * 注意: 乗算順序が重要（非可換）
 */
export const multiply = (a: Quaternion, b: Quaternion): Quaternion => {
  const x = a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y
  const y = a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z
  const z = a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z

  return make(x, y, z, w)
}

/**
 * クォータニオンの共役
 */
export const conjugate = (q: Quaternion): Quaternion => make(-q.x, -q.y, -q.z, q.w)

/**
 * クォータニオンのノルム（長さ）
 */
export const norm = (q: Quaternion): number => Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)

/**
 * クォータニオンの正規化
 */
export const normalize = (q: Quaternion): Effect.Effect<Quaternion, QuaternionError> =>
  Effect.gen(function* () {
    const n = norm(q)
    return yield* pipe(
      Match.value(n === 0),
      Match.when(
        (isZero) => isZero,
        () =>
          Effect.fail(
            new QuaternionError({
              operation: 'normalize',
              reason: 'Cannot normalize zero quaternion',
              cause: q,
            })
          )
      ),
      Match.orElse(() => Effect.succeed(make(q.x / n, q.y / n, q.z / n, q.w / n)))
    )
  })

/**
 * クォータニオンの逆元
 */
export const inverse = (q: Quaternion): Effect.Effect<Quaternion, QuaternionError> =>
  Effect.gen(function* () {
    const normSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w
    return yield* pipe(
      Match.value(normSq === 0),
      Match.when(
        (isZero) => isZero,
        () =>
          Effect.fail(
            new QuaternionError({
              operation: 'inverse',
              reason: 'Cannot invert zero quaternion',
              cause: q,
            })
          )
      ),
      Match.orElse(() => {
        const conj = conjugate(q)
        return Effect.succeed(make(conj.x / normSq, conj.y / normSq, conj.z / normSq, conj.w / normSq))
      })
    )
  })

/**
 * 球面線形補間（Spherical Linear Interpolation）
 * @param t 補間係数（0.0 - 1.0）
 */
export const slerp = (a: Quaternion, b: Quaternion, t: number): Effect.Effect<Quaternion, QuaternionError> =>
  Effect.gen(function* () {
    const clampedT = Math.max(0, Math.min(1, t))

    // 内積計算
    const cosom = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w

    // 最短経路を選択
    const adjustedB = cosom < 0 ? make(-b.x, -b.y, -b.z, -b.w) : b
    const adjustedCosom = Math.abs(cosom)

    const threshold = 0.9995

    return yield* pipe(
      Match.value(adjustedCosom > threshold),
      Match.when(
        (withinLinearRange) => withinLinearRange,
        () =>
          Effect.gen(function* () {
            const x = a.x + (adjustedB.x - a.x) * clampedT
            const y = a.y + (adjustedB.y - a.y) * clampedT
            const z = a.z + (adjustedB.z - a.z) * clampedT
            const w = a.w + (adjustedB.w - a.w) * clampedT

            return yield* normalize(make(x, y, z, w))
          })
      ),
      Match.orElse(() =>
        Effect.gen(function* () {
          const omega = Math.acos(adjustedCosom)
          const sinom = Math.sin(omega)

          const scale0 = Math.sin((1 - clampedT) * omega) / sinom
          const scale1 = Math.sin(clampedT * omega) / sinom

          return make(
            a.x * scale0 + adjustedB.x * scale1,
            a.y * scale0 + adjustedB.y * scale1,
            a.z * scale0 + adjustedB.z * scale1,
            a.w * scale0 + adjustedB.w * scale1
          )
        })
      )
    )
  })

/**
 * クォータニオンの内積
 */
export const dot = (a: Quaternion, b: Quaternion): number => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w

/**
 * クォータニオンの等価性判定
 */
export const equals = (a: Quaternion, b: Quaternion, epsilon: number = Number.EPSILON): boolean => {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.z - b.z) <= epsilon &&
    Math.abs(a.w - b.w) <= epsilon
  )
}

/**
 * ベクトルをクォータニオンで回転
 */
export const rotateVector = (q: Quaternion, v: Vector3): Vector3 => {
  // q * v * q^(-1) の計算
  const ix = q.w * v.x + q.y * v.z - q.z * v.y
  const iy = q.w * v.y + q.z * v.x - q.x * v.z
  const iz = q.w * v.z + q.x * v.y - q.y * v.x
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z

  return V3.make(
    ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
  )
}
