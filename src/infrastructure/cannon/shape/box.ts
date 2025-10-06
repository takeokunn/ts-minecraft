import * as CANNON from 'cannon-es'
import { Effect, Schema } from 'effect'
import { PhysicsShapeError } from '../errors'

/**
 * Box Shape - Cannon.js Box形状のEffect-TSラッパー
 *
 * Phase 1.4: パラメータSchemaによる型安全なBox形状生成
 */

// Box形状パラメータSchema
export const BoxShapeParamsSchema = Schema.Struct({
  halfExtents: Schema.Struct({
    x: Schema.Number.pipe(Schema.positive(), Schema.annotations({ description: 'Half width (X-axis)' })),
    y: Schema.Number.pipe(Schema.positive(), Schema.annotations({ description: 'Half height (Y-axis)' })),
    z: Schema.Number.pipe(Schema.positive(), Schema.annotations({ description: 'Half depth (Z-axis)' })),
  }).pipe(
    Schema.annotations({
      title: 'Box Half Extents',
      description: 'Box寸法の半分値（Cannon.jsでは中心からの距離で指定）',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Box Shape Parameters',
    description: 'Parameters for creating a box collision shape',
    examples: [
      { halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }, // 1x1x1の立方体
      { halfExtents: { x: 1.0, y: 0.5, z: 1.0 } }, // 2x1x2の直方体
    ],
  })
)

export type BoxShapeParams = Schema.Schema.Type<typeof BoxShapeParamsSchema>

/**
 * Box Shape生成
 *
 * @param params - Box形状パラメータ
 * @returns Effect型でラップされたCANNON.Box
 */
export const createBoxShape = (params: BoxShapeParams): Effect.Effect<CANNON.Box, PhysicsShapeError> =>
  Effect.try({
    try: () => {
      const { x, y, z } = params.halfExtents
      return new CANNON.Box(new CANNON.Vec3(x, y, z))
    },
    catch: (error) =>
      new PhysicsShapeError({
        type: 'box',
        cause: error,
        message: `Failed to create box shape with halfExtents: ${JSON.stringify(params.halfExtents)}`,
      }),
  })

/**
 * Box Shape生成（Schema検証付き）
 *
 * 未検証のデータからBox Shapeを安全に生成
 */
export const createBoxShapeFromUnknown = (
  data: unknown
): Effect.Effect<CANNON.Box, PhysicsShapeError | Schema.ParseError> =>
  Effect.gen(function* () {
    const params = yield* Schema.decodeUnknown(BoxShapeParamsSchema)(data)
    return yield* createBoxShape(params)
  })
