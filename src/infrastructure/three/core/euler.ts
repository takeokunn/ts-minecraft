/**
 * @fileoverview Three.js Euler - Effect-TSラッパー
 * オイラー角による回転表現の型安全な不変操作を提供
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import type { Quaternion } from './quaternion'
import * as Quat from './quaternion'
import { ErrorCauseSchema } from '@shared/schema/error'

/**
 * 回転順序の定義
 */
export const EulerOrderSchema = Schema.Literal('XYZ', 'YZX', 'ZXY', 'XZY', 'YXZ', 'ZYX')
export type EulerOrder = Schema.Schema.Type<typeof EulerOrderSchema>

/**
 * Euler Schema定義（Brand型）
 * オイラー角による3次元回転表現
 */
export const EulerSchema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
  order: EulerOrderSchema,
}).pipe(Schema.brand('ThreeEuler'))

export type Euler = Schema.Schema.Type<typeof EulerSchema>

/**
 * Eulerエラー型
 */
export const EulerError = Schema.TaggedError('EulerError')({
  operation: Schema.String,
  reason: Schema.String,
  euler: Schema.optional(EulerSchema),
  cause: Schema.optional(ErrorCauseSchema),
})
export type EulerError = Schema.Schema.Type<typeof EulerError>

/**
 * Eulerコンストラクタ - プリミティブ値から構築
 * @param x X軸周りの回転（ラジアン）
 * @param y Y軸周りの回転（ラジアン）
 * @param z Z軸周りの回転（ラジアン）
 * @param order 回転適用順序（デフォルト: 'XYZ'）
 */
export const make = (x: number, y: number, z: number, order: EulerOrder = 'XYZ'): Euler =>
  Schema.decodeUnknownSync(EulerSchema)({ x, y, z, order })

/**
 * ゼロ回転（無回転）
 */
export const zero: Euler = make(0, 0, 0)

/**
 * Three.js EulerからEffect型への変換
 */
export const fromThreeEuler = (e: THREE.Euler): Effect.Effect<Euler, EulerError> =>
  Effect.gen(function* () {
    const order = yield* Schema.decodeUnknown(EulerOrderSchema)(e.order).pipe(
      Effect.mapError(
        (error) =>
          new EulerError({
            operation: 'fromThreeEuler',
            reason: 'Invalid Euler order',
            cause: error instanceof Error ? error : { message: String(error) },
          })
      )
    )

    return make(e.x, e.y, e.z, order)
  })

/**
 * Effect型からThree.js Eulerへの変換
 */
export const toThreeEuler = (e: Euler): THREE.Euler => new THREE.Euler(e.x, e.y, e.z, e.order)

/**
 * QuaternionからEulerへの変換
 */
export const fromQuaternion = (q: Quaternion, order: EulerOrder = 'XYZ'): Euler => {
  const threeQuat = Quat.toThreeQuaternion(q)
  const threeEuler = new THREE.Euler().setFromQuaternion(threeQuat, order)
  return make(threeEuler.x, threeEuler.y, threeEuler.z, order)
}

/**
 * EulerからQuaternionへの変換
 */
export const toQuaternion = (e: Euler): Quaternion => {
  const threeEuler = toThreeEuler(e)
  const threeQuat = new THREE.Quaternion().setFromEuler(threeEuler)
  return Quat.make(threeQuat.x, threeQuat.y, threeQuat.z, threeQuat.w)
}

/**
 * 回転順序の変更
 */
export const reorder = (e: Euler, newOrder: EulerOrder): Euler => {
  // Quaternion経由で変換（精度保持）
  const quat = toQuaternion(e)
  return fromQuaternion(quat, newOrder)
}

/**
 * Eulerの等価性判定
 */
export const equals = (a: Euler, b: Euler, epsilon: number = Number.EPSILON): boolean => {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.z - b.z) <= epsilon &&
    a.order === b.order
  )
}

/**
 * ラジアンから度への変換
 */
export const toDegrees = (e: Euler): { x: number; y: number; z: number; order: EulerOrder } => ({
  x: (e.x * 180) / Math.PI,
  y: (e.y * 180) / Math.PI,
  z: (e.z * 180) / Math.PI,
  order: e.order,
})

/**
 * 度からラジアンへの変換
 */
export const fromDegrees = (x: number, y: number, z: number, order: EulerOrder = 'XYZ'): Euler =>
  make((x * Math.PI) / 180, (y * Math.PI) / 180, (z * Math.PI) / 180, order)

/**
 * 角度のクランプ（-π ～ π）
 */
export const normalizeAngles = (e: Euler): Euler => {
  const normalize = (angle: number): number => {
    const normalized = angle % (2 * Math.PI)
    return normalized > Math.PI
      ? normalized - 2 * Math.PI
      : normalized < -Math.PI
        ? normalized + 2 * Math.PI
        : normalized
  }

  return make(normalize(e.x), normalize(e.y), normalize(e.z), e.order)
}
