/**
 * @fileoverview Three.js Sphere - Effect-TSラッパー
 * 球体（バウンディングスフィア）の型安全な不変操作を提供
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import type { Vector3 } from './vector3'
import * as V3 from './vector3'
import { ErrorCauseSchema } from '@shared/schema/error'

/**
 * Sphere Schema定義（Brand型）
 * 中心点と半径で定義される球体
 */
export const SphereSchema = Schema.Struct({
  center: V3.Vector3Schema,
  radius: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
}).pipe(Schema.brand('ThreeSphere'))

export type Sphere = Schema.Schema.Type<typeof SphereSchema>

/**
 * Sphereエラー型
 */
export const SphereError = Schema.TaggedError('SphereError')({
  operation: Schema.String,
  reason: Schema.String,
  sphere: Schema.optional(SphereSchema),
  points: Schema.optional(Schema.Array(V3.Vector3Schema)),
  cause: Schema.optional(ErrorCauseSchema),
})
export type SphereError = Schema.Schema.Type<typeof SphereError>

/**
 * Sphereコンストラクタ - 中心と半径から構築
 */
export const make = (center: Vector3, radius: number): Sphere =>
  Schema.decodeUnknownSync(SphereSchema)({ center, radius })

/**
 * 空のSphere（半径0）
 */
export const empty: Sphere = make(V3.zero, 0)

/**
 * Three.js SphereからEffect型への変換
 */
export const fromThreeSphere = (s: THREE.Sphere): Effect.Effect<Sphere, never> =>
  Effect.sync(() => make(V3.make(s.center.x, s.center.y, s.center.z), s.radius))

/**
 * Effect型からThree.js Sphereへの変換
 */
export const toThreeSphere = (s: Sphere): THREE.Sphere => new THREE.Sphere(V3.toThreeVector(s.center), s.radius)

/**
 * 点を含むようにSphereを拡張
 */
export const expandByPoint = (sphere: Sphere, point: Vector3): Sphere => {
  const distance = V3.distance(sphere.center, point)
  if (distance <= sphere.radius) {
    return sphere
  }

  const newRadius = (sphere.radius + distance) / 2
  const direction = V3.subtract(point, sphere.center)
  const normalized = V3.normalize(direction)

  return Effect.runSync(
    Effect.gen(function* () {
      const norm = yield* normalized
      const offset = V3.scale(norm, newRadius - sphere.radius)
      const newCenter = V3.add(sphere.center, offset)
      return make(newCenter, newRadius)
    })
  )
}

/**
 * 2つのSphereを包含する最小Sphere
 */
export const union = (a: Sphere, b: Sphere): Sphere => {
  const centerDist = V3.distance(a.center, b.center)

  if (centerDist + b.radius <= a.radius) return a
  if (centerDist + a.radius <= b.radius) return b

  const newRadius = (a.radius + b.radius + centerDist) / 2
  const direction = V3.subtract(b.center, a.center)

  return Effect.runSync(
    Effect.gen(function* () {
      const normalized = yield* V3.normalize(direction)
      const offset = V3.scale(normalized, newRadius - a.radius)
      const newCenter = V3.add(a.center, offset)
      return make(newCenter, newRadius)
    })
  )
}

/**
 * 点がSphere内に含まれるか判定
 */
export const containsPoint = (sphere: Sphere, point: Vector3): boolean => {
  return V3.distanceSquared(sphere.center, point) <= sphere.radius * sphere.radius
}

/**
 * Sphereが他のSphereと交差するか判定
 */
export const intersectsSphere = (a: Sphere, b: Sphere): boolean => {
  const radiusSum = a.radius + b.radius
  return V3.distanceSquared(a.center, b.center) <= radiusSum * radiusSum
}

/**
 * Sphereが空（半径0）か判定
 */
export const isEmpty = (sphere: Sphere): boolean => sphere.radius === 0

/**
 * 点をSphere表面にクランプ
 */
export const clampPoint = (sphere: Sphere, point: Vector3): Vector3 => {
  const direction = V3.subtract(point, sphere.center)
  const distanceSq = V3.lengthSquared(direction)

  if (distanceSq <= sphere.radius * sphere.radius) {
    return point
  }

  return Effect.runSync(
    Effect.gen(function* () {
      const normalized = yield* V3.normalize(direction)
      const offset = V3.scale(normalized, sphere.radius)
      return V3.add(sphere.center, offset)
    })
  )
}

/**
 * 点からSphere表面までの距離を計算
 */
export const distanceToPoint = (sphere: Sphere, point: Vector3): number => {
  const distance = V3.distance(sphere.center, point)
  return Math.max(0, distance - sphere.radius)
}

/**
 * Sphereの体積を計算
 */
export const getVolume = (sphere: Sphere): number => (4 / 3) * Math.PI * Math.pow(sphere.radius, 3)

/**
 * Sphereの表面積を計算
 */
export const getSurfaceArea = (sphere: Sphere): number => 4 * Math.PI * sphere.radius * sphere.radius

/**
 * Sphereの等価性判定
 */
export const equals = (a: Sphere, b: Sphere, epsilon: number = Number.EPSILON): boolean => {
  return V3.equals(a.center, b.center, epsilon) && Math.abs(a.radius - b.radius) <= epsilon
}

/**
 * 点の配列からSphereを生成（最小包含球）
 */
export const fromPoints = (points: ReadonlyArray<Vector3>): Effect.Effect<Sphere, SphereError> =>
  Effect.gen(function* () {
    if (points.length === 0) {
      return yield* Effect.fail(
        new SphereError({
          operation: 'fromPoints',
          reason: 'Cannot create Sphere from empty points array',
          points,
        })
      )
    }

    // 簡易実装: バウンディングボックスの中心と最遠点で近似
    const min = points.reduce((acc, p) => V3.min(acc, p), points[0])
    const max = points.reduce((acc, p) => V3.max(acc, p), points[0])
    const center = V3.scale(V3.add(min, max), 0.5)

    const maxDistance = points.reduce((maxDist, point) => {
      const dist = V3.distance(center, point)
      return Math.max(maxDist, dist)
    }, 0)

    return make(center, maxDistance)
  })
