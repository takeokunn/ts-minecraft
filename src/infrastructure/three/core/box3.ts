/**
 * @fileoverview Three.js Box3 - Effect-TSラッパー
 * 3Dバウンディングボックスの型安全な不変操作を提供
 */

import { ErrorCauseSchema } from '@shared/schema/error'
import { Effect, Match, Schema, pipe } from 'effect'
import * as THREE from 'three'
import type { Vector3 } from './vector3'
import * as V3 from './vector3'

/**
 * Box3 Schema定義（Brand型）
 * 軸平行バウンディングボックス（AABB）
 */
export const Box3Schema = Schema.Struct({
  min: V3.Vector3Schema,
  max: V3.Vector3Schema,
}).pipe(Schema.brand('ThreeBox3'))

export type Box3 = Schema.Schema.Type<typeof Box3Schema>

/**
 * Box3エラー型
 */
export const Box3Error = Schema.TaggedError('Box3Error')({
  operation: Schema.String,
  reason: Schema.String,
  box: Schema.optional(Box3Schema),
  points: Schema.optional(Schema.Array(V3.Vector3Schema)),
  cause: Schema.optional(ErrorCauseSchema),
})
export type Box3Error = Schema.Schema.Type<typeof Box3Error>

/**
 * Box3コンストラクタ - min/maxベクトルから構築
 *
 * @internal
 * Infrastructure層内部専用。値の検証を行わないため、信頼できる値のみに使用すること。
 * Three.jsとの連携において、構造的に同一であることが保証されている値の変換に使用。
 */
export const make = (min: Vector3, max: Vector3): Box3 => ({ min, max }) as Box3

/**
 * 空のBox3（無限小）
 */
export const empty: Box3 = make(
  V3.make(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
  V3.make(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
)

/**
 * Three.js Box3からEffect型への変換
 */
export const fromThreeBox = (b: THREE.Box3): Effect.Effect<Box3, never> =>
  Effect.sync(() => make(V3.make(b.min.x, b.min.y, b.min.z), V3.make(b.max.x, b.max.y, b.max.z)))

/**
 * Effect型からThree.js Box3への変換
 */
export const toThreeBox = (b: Box3): THREE.Box3 => new THREE.Box3(V3.toThreeVector(b.min), V3.toThreeVector(b.max))

/**
 * 点を含むようにBox3を拡張
 */
export const expandByPoint = (box: Box3, point: Vector3): Box3 => {
  const newMin = V3.min(box.min, point)
  const newMax = V3.max(box.max, point)
  return make(newMin, newMax)
}

/**
 * スカラー値でBox3を拡張
 */
export const expandByScalar = (box: Box3, scalar: number): Box3 => {
  const offset = V3.make(scalar, scalar, scalar)
  return make(V3.subtract(box.min, offset), V3.add(box.max, offset))
}

/**
 * 他のBox3を含むように拡張
 */
export const union = (a: Box3, b: Box3): Box3 => {
  const newMin = V3.min(a.min, b.min)
  const newMax = V3.max(a.max, b.max)
  return make(newMin, newMax)
}

/**
 * 2つのBox3の交差部分を計算
 */
export const intersect = (a: Box3, b: Box3): Box3 => {
  const newMin = V3.max(a.min, b.min)
  const newMax = V3.min(a.max, b.max)
  return make(newMin, newMax)
}

/**
 * Box3の中心点を取得
 */
export const getCenter = (box: Box3): Vector3 => {
  const center = V3.add(box.min, box.max)
  return V3.scale(center, 0.5)
}

/**
 * Box3のサイズ（幅・高さ・奥行き）を取得
 */
export const getSize = (box: Box3): Vector3 => V3.subtract(box.max, box.min)

/**
 * 点がBox3内に含まれるか判定
 */
export const containsPoint = (box: Box3, point: Vector3): boolean => {
  return (
    point.x >= box.min.x &&
    point.x <= box.max.x &&
    point.y >= box.min.y &&
    point.y <= box.max.y &&
    point.z >= box.min.z &&
    point.z <= box.max.z
  )
}

/**
 * Box3が他のBox3と交差するか判定
 */
export const intersectsBox = (a: Box3, b: Box3): boolean => {
  return !(
    b.max.x < a.min.x ||
    b.min.x > a.max.x ||
    b.max.y < a.min.y ||
    b.min.y > a.max.y ||
    b.max.z < a.min.z ||
    b.min.z > a.max.z
  )
}

/**
 * Box3が空（無効）か判定
 */
export const isEmpty = (box: Box3): boolean => {
  return box.max.x < box.min.x || box.max.y < box.min.y || box.max.z < box.min.z
}

/**
 * Box3の体積を計算
 */
export const getVolume = (box: Box3): number => {
  return pipe(
    Match.value(isEmpty(box)),
    Match.when(true, () => 0),
    Match.orElse(() => {
      const size = getSize(box)
      return size.x * size.y * size.z
    })
  )
}

/**
 * 点をBox3内にクランプ
 */
export const clampPoint = (box: Box3, point: Vector3): Vector3 => V3.clamp(point, box.min, box.max)

/**
 * 点からBox3表面までの距離を計算
 */
export const distanceToPoint = (box: Box3, point: Vector3): number => {
  const clampedPoint = clampPoint(box, point)
  return V3.distance(point, clampedPoint)
}

/**
 * Box3の等価性判定
 */
export const equals = (a: Box3, b: Box3, epsilon: number = Number.EPSILON): boolean => {
  return V3.equals(a.min, b.min, epsilon) && V3.equals(a.max, b.max, epsilon)
}

/**
 * 点の配列からBox3を生成
 */
export const fromPoints = (points: ReadonlyArray<Vector3>): Effect.Effect<Box3, Box3Error> =>
  Effect.gen(function* () {
    yield* pipe(
      Match.value(points.length === 0),
      Match.when(true, () =>
        Effect.fail(
          new Box3Error({
            operation: 'fromPoints',
            reason: 'Cannot create Box3 from empty points array',
            points,
          })
        )
      ),
      Match.orElse(() => Effect.void)
    )

    return points.reduce((acc, point) => expandByPoint(acc, point), empty)
  })
