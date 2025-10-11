/**
 * @fileoverview Three.js SphereGeometry - Effect-TS Wrapper
 * SphereGeometryのEffect-TSラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { GeometryError } from '../errors'

/**
 * SphereGeometry Parameters Schema
 */
export const SphereGeometryParamsSchema = Schema.Struct({
  radius: Schema.Number.pipe(Schema.positive()),
  widthSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  heightSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  phiStart: Schema.optional(Schema.Number),
  phiLength: Schema.optional(Schema.Number),
  thetaStart: Schema.optional(Schema.Number),
  thetaLength: Schema.optional(Schema.Number),
})

export type SphereGeometryParams = Schema.Schema.Type<typeof SphereGeometryParamsSchema>

/**
 * SphereGeometry生成
 */
export const createSphereGeometry = (
  params: SphereGeometryParams
): Effect.Effect<THREE.SphereGeometry, GeometryError> =>
  Effect.try({
    try: () =>
      new THREE.SphereGeometry(
        params.radius,
        params.widthSegments,
        params.heightSegments,
        params.phiStart,
        params.phiLength,
        params.thetaStart,
        params.thetaLength
      ),
    catch: (error) =>
      GeometryError.make({
        type: 'sphere',
        cause: error,
      }),
  })

/**
 * Effect.Scopeによるリソース管理付きSphereGeometry生成
 */
export const withSphereGeometry = <A, E>(
  params: SphereGeometryParams,
  f: (geometry: THREE.SphereGeometry) => Effect.Effect<A, E>
): Effect.Effect<A, E | GeometryError> =>
  Effect.acquireUseRelease(createSphereGeometry(params), f, (geometry) => Effect.sync(() => geometry.dispose()))

/**
 * Geometry手動dispose
 */
export const disposeSphereGeometry = (geometry: THREE.SphereGeometry): Effect.Effect<void, never> =>
  Effect.sync(() => geometry.dispose())
