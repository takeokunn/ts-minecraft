import * as CANNON from 'cannon-es'
import { Effect, Schema } from 'effect'
import { PhysicsShapeError } from '../errors'

/**
 * Sphere Shape - Cannon.js Sphere形状のEffect-TSラッパー
 *
 * Phase 1.4: パラメータSchemaによる型安全なSphere形状生成
 */

// Sphere形状パラメータSchema
export const SphereShapeParamsSchema = Schema.Struct({
  radius: Schema.Number.pipe(
    Schema.positive(),
    Schema.annotations({
      description: 'Sphere radius (must be positive)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'Sphere Shape Parameters',
    description: 'Parameters for creating a sphere collision shape',
    examples: [{ radius: 0.5 }, { radius: 1.0 }, { radius: 2.5 }],
  })
)

export type SphereShapeParams = Schema.Schema.Type<typeof SphereShapeParamsSchema>

/**
 * Sphere Shape生成
 *
 * @param params - Sphere形状パラメータ
 * @returns Effect型でラップされたCANNON.Sphere
 */
export const createSphereShape = (params: SphereShapeParams): Effect.Effect<CANNON.Sphere, PhysicsShapeError> =>
  Effect.try({
    try: () => new CANNON.Sphere(params.radius),
    catch: (error) =>
      PhysicsShapeError.make({
        type: 'sphere',
        cause: error,
        message: `Failed to create sphere shape with radius: ${params.radius}`,
      }),
  })

/**
 * Sphere Shape生成（Schema検証付き）
 *
 * 未検証のデータからSphere Shapeを安全に生成
 */
export const createSphereShapeFromUnknown = (
  data: unknown
): Effect.Effect<CANNON.Sphere, PhysicsShapeError | Schema.ParseError> =>
  Effect.gen(function* () {
    const params = yield* Schema.decodeUnknown(SphereShapeParamsSchema)(data)
    return yield* createSphereShape(params)
  })
