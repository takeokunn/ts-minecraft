/**
 * @fileoverview Three.js BoxGeometry - Effect-TS Wrapper
 * BoxGeometryのEffect-TSラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { GeometryError } from '../errors'

/**
 * BoxGeometry Parameters Schema
 * Three.jsのBoxGeometryコンストラクタパラメータを型安全に定義
 */
export const BoxGeometryParamsSchema = Schema.Struct({
  width: Schema.Number.pipe(Schema.positive()),
  height: Schema.Number.pipe(Schema.positive()),
  depth: Schema.Number.pipe(Schema.positive()),
  widthSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  heightSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  depthSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})

export type BoxGeometryParams = Schema.Schema.Type<typeof BoxGeometryParamsSchema>

/**
 * BoxGeometry生成
 * Effect.tryでThree.js APIを安全にラップ
 */
export const createBoxGeometry = (params: BoxGeometryParams): Effect.Effect<THREE.BoxGeometry, GeometryError> =>
  Effect.try({
    try: () =>
      new THREE.BoxGeometry(
        params.width,
        params.height,
        params.depth,
        params.widthSegments,
        params.heightSegments,
        params.depthSegments
      ),
    catch: (error) =>
      GeometryError.make({
        type: 'box',
        cause: error,
      }),
  })

/**
 * Effect.Scopeによるリソース管理付きBoxGeometry生成
 * Scopeを抜けると自動でdispose()が呼ばれる
 */
export const withBoxGeometry = <A, E>(
  params: BoxGeometryParams,
  f: (geometry: THREE.BoxGeometry) => Effect.Effect<A, E>
): Effect.Effect<A, E | GeometryError> =>
  Effect.acquireUseRelease(createBoxGeometry(params), f, (geometry) => Effect.sync(() => geometry.dispose()))

/**
 * Geometry手動dispose
 */
export const disposeBoxGeometry = (geometry: THREE.BoxGeometry): Effect.Effect<void, never> =>
  Effect.sync(() => geometry.dispose())
