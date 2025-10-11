/**
 * @fileoverview Three.js PlaneGeometry - Effect-TS Wrapper
 * PlaneGeometryのEffect-TSラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { GeometryError } from '../errors'

/**
 * PlaneGeometry Parameters Schema
 */
export const PlaneGeometryParamsSchema = Schema.Struct({
  width: Schema.Number.pipe(Schema.positive()),
  height: Schema.Number.pipe(Schema.positive()),
  widthSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  heightSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})

export type PlaneGeometryParams = Schema.Schema.Type<typeof PlaneGeometryParamsSchema>

/**
 * PlaneGeometry生成
 */
export const createPlaneGeometry = (params: PlaneGeometryParams): Effect.Effect<THREE.PlaneGeometry, GeometryError> =>
  Effect.try({
    try: () => new THREE.PlaneGeometry(params.width, params.height, params.widthSegments, params.heightSegments),
    catch: (error) =>
      GeometryError.make({
        type: 'plane',
        cause: error,
      }),
  })

/**
 * Effect.Scopeによるリソース管理付きPlaneGeometry生成
 */
export const withPlaneGeometry = <A, E>(
  params: PlaneGeometryParams,
  f: (geometry: THREE.PlaneGeometry) => Effect.Effect<A, E>
): Effect.Effect<A, E | GeometryError> =>
  Effect.acquireUseRelease(createPlaneGeometry(params), f, (geometry) => Effect.sync(() => geometry.dispose()))

/**
 * Geometry手動dispose
 */
export const disposePlaneGeometry = (geometry: THREE.PlaneGeometry): Effect.Effect<void, never> =>
  Effect.sync(() => geometry.dispose())
