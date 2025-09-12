/**
 * RaycastDomainService - Pure domain raycast logic without infrastructure dependencies
 *
 * Features:
 * - Ray-geometry intersection algorithms
 * - Ray validation and normalization
 * - Pure mathematical calculations
 * - No infrastructure dependencies
 */

import { Context, Effect, Option, Layer } from 'effect'
import { EntityId } from '@domain/entities'
import { Position, Vector3 } from '@domain/value-objects'

/**
 * Ray definition
 */
export interface Ray {
  readonly origin: Position
  readonly direction: Vector3
  readonly maxDistance: number
}

/**
 * Ray hit result
 */
export interface RayHit {
  readonly entityId: EntityId
  readonly position: Position
  readonly normal: Vector3
  readonly distance: number
  readonly surface?: string
}

// Port interfaces for external dependencies
export interface GeometryPort {
  readonly getEntityBounds: (entityId: EntityId) => Effect.Effect<Option.Option<AABB>, never, never>
  readonly getEntityPosition: (entityId: EntityId) => Effect.Effect<Option.Option<Position>, never, never>
}

export interface AABB {
  readonly min: Vector3
  readonly max: Vector3
}

/**
 * Raycast Domain Service - Pure domain raycast calculations
 */
export class RaycastDomainService extends Context.Tag('RaycastDomainService')<
  RaycastDomainService,
  {
    readonly validateRay: (ray: Ray) => Effect.Effect<boolean>
    readonly normalizeRayDirection: (direction: Vector3) => Effect.Effect<Vector3>
    readonly calculateRayAABBIntersection: (ray: Ray, aabb: AABB) => Effect.Effect<Option.Option<number>>
    readonly calculateRayPlaneIntersection: (ray: Ray, planePoint: Vector3, planeNormal: Vector3) => Effect.Effect<Option.Option<number>>
    readonly isPointInRayRange: (ray: Ray, distance: number) => Effect.Effect<boolean>
  }
>() {
  static readonly Live = Layer.effect(
    RaycastDomainService,
    Effect.gen(function* () {
      return RaycastDomainService.of({
        validateRay: (ray) => Effect.succeed(ray.maxDistance > 0 && ray.maxDistance < 1000 && (ray.direction.x !== 0 || ray.direction.y !== 0 || ray.direction.z !== 0)),

        normalizeRayDirection: (direction) => {
          const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)

          if (magnitude === 0) {
            return Effect.succeed({ _tag: 'Vector3', x: 0, y: 0, z: 1 } as Vector3)
          }

          return Effect.succeed({
            _tag: 'Vector3',
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude,
          } as Vector3)
        },

        calculateRayAABBIntersection: (ray, aabb) =>
          Effect.gen(function* () {
            const normalizedDir = yield* RaycastDomainService.normalizeRayDirection(ray.direction)

            // Ray-AABB intersection algorithm
            const tMinX = (aabb.min.x - ray.origin.x) / normalizedDir.x
            const tMaxX = (aabb.max.x - ray.origin.x) / normalizedDir.x
            const tMinY = (aabb.min.y - ray.origin.y) / normalizedDir.y
            const tMaxY = (aabb.max.y - ray.origin.y) / normalizedDir.y
            const tMinZ = (aabb.min.z - ray.origin.z) / normalizedDir.z
            const tMaxZ = (aabb.max.z - ray.origin.z) / normalizedDir.z

            const tMin = Math.max(Math.min(tMinX, tMaxX), Math.min(tMinY, tMaxY), Math.min(tMinZ, tMaxZ))

            const tMax = Math.min(Math.max(tMinX, tMaxX), Math.max(tMinY, tMaxY), Math.max(tMinZ, tMaxZ))

            if (tMax < 0 || tMin > tMax || tMin > ray.maxDistance) {
              return Option.none()
            }

            return Option.some(tMin >= 0 ? tMin : tMax)
          }),

        calculateRayPlaneIntersection: (ray, planePoint, planeNormal) =>
          Effect.gen(function* () {
            const normalizedDir = yield* RaycastDomainService.normalizeRayDirection(ray.direction)

            const denominator = normalizedDir.x * planeNormal.x + normalizedDir.y * planeNormal.y + normalizedDir.z * planeNormal.z

            if (Math.abs(denominator) < 1e-6) {
              return Option.none() // Ray is parallel to plane
            }

            const numerator = (planePoint.x - ray.origin.x) * planeNormal.x + (planePoint.y - ray.origin.y) * planeNormal.y + (planePoint.z - ray.origin.z) * planeNormal.z

            const t = numerator / denominator

            if (t < 0 || t > ray.maxDistance) {
              return Option.none()
            }

            return Option.some(t)
          }),

        isPointInRayRange: (ray, distance) => Effect.succeed(distance >= 0 && distance <= ray.maxDistance),
      })
    }),
  )
}
