import { Effect, Option, Ref, Data, Schema } from 'effect'
import { PhysicsBodyId, PhysicsBodyIdSchema, Position, PositionSchema, DeltaTimeSecs } from '@/shared/kernel'
import { Vector3Schema, type Vector3 } from '@/shared/math/three'
import { RigidBodyService, type CustomBody } from '@/infrastructure/physics/boundary/rigid-body-service'
import { PhysicsWorldService, type CustomWorld } from '@/infrastructure/physics/boundary/physics-world-service'
import { ShapeService, type CustomShape } from '@/infrastructure/physics/boundary/shape-service'

/**
 * Error type for PhysicsService operations.
 * Uses distinct _tag 'PhysicsServiceError' to avoid collision with
 * domain-level PhysicsError in domain/errors.ts.
 */
export class PhysicsServiceError extends Data.TaggedError('PhysicsServiceError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause
      ? `Physics error [${this.operation}]: ${String(this.cause)}`
      : `Physics error [${this.operation}]`
  }
}

/**
 * PhysicsBody handle — only exposes the opaque ID, not the raw body
 */
export const PhysicsBodySchema = Schema.Struct({ id: PhysicsBodyIdSchema })
export type PhysicsBody = typeof PhysicsBodySchema.Type

/**
 * Configuration for adding a rigid body
 */
const ShapeParamsSchema = Schema.Struct({
  halfExtents: Schema.optional(Vector3Schema),
  radius: Schema.optional(Schema.Number),
})

export const AddBodyConfigSchema = Schema.Struct({
  mass: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  position: PositionSchema,
  shape: Schema.Literal('box', 'sphere', 'plane'),
  shapeParams: Schema.optional(ShapeParamsSchema),
  type: Schema.optional(Schema.Literal('dynamic', 'static', 'kinematic')),
  fixedRotation: Schema.optional(Schema.Boolean),
  angularDamping: Schema.optional(Schema.Number.pipe(Schema.finite())),
  allowSleep: Schema.optional(Schema.Boolean),
})
export type AddBodyConfig = Schema.Schema.Type<typeof AddBodyConfigSchema>

/**
 * Ground detection distance threshold (in meters)
 */
export const GROUND_DETECTION_DISTANCE = 0.15

/**
 * Vertical offset from player center to feet for ground detection
 */
export const PLAYER_FEET_OFFSET = 0.9

export class PhysicsService extends Effect.Service<PhysicsService>()(
  '@minecraft/application/PhysicsService',
  {
    effect: Effect.gen(function* () {
      const rigidBodyService = yield* RigidBodyService
      const physicsWorldService = yield* PhysicsWorldService
      const shapeService = yield* ShapeService

      // Internal state: CustomWorld stored in a Ref
      const worldRef = yield* Ref.make<Option.Option<CustomWorld>>(Option.none())

      // Internal body registry: maps PhysicsBodyId -> CustomBody
      const bodyMap = new Map<PhysicsBodyId, CustomBody>()

      // Track plane body Y positions for isGrounded()
      const planePositions = new Map<PhysicsBodyId, number>()

      // Per-instance body ID counter
      let nextBodyId = 0
      const makeBodyId = (): PhysicsBodyId =>
        PhysicsBodyId.make(`physics-body-${nextBodyId++}`)

      /**
       * Helper: get world or fail with PhysicsServiceError
       */
      const getWorld: Effect.Effect<CustomWorld, PhysicsServiceError> = Ref.get(worldRef).pipe(
        Effect.flatMap((world) =>
          Option.match(world, {
            onNone: () => Effect.fail(new PhysicsServiceError({ operation: 'getWorld', cause: 'Physics world not initialized. Call initialize() first.' })),
            onSome: (w) => Effect.succeed(w),
          })
        )
      )

      /**
       * Helper: get CustomBody or fail with PhysicsServiceError
       */
      const getBody = (bodyId: PhysicsBodyId): Effect.Effect<CustomBody, PhysicsServiceError> =>
        Effect.succeed(bodyMap.get(bodyId)).pipe(
          Effect.flatMap((body) =>
            body !== undefined
              ? Effect.succeed(body)
              : Effect.fail(new PhysicsServiceError({ operation: 'getBody', cause: `Body not found: ${bodyId}` })),
          ),
        )

      return {
        initialize: (config: { gravity: Vector3; broadphase: 'naive' | 'sap' }): Effect.Effect<void, PhysicsServiceError> =>
          Effect.gen(function* () {
            // Create the world first (side effect outside the critical section)
            const newWorld = yield* physicsWorldService.create({
              gravity: config.gravity,
              broadphase: config.broadphase,
            }).pipe(Effect.mapError((e) => new PhysicsServiceError({ operation: 'initialize', cause: e })))

            // Atomic check-and-set: write only if still None
            const wasAlreadyInit = yield* Ref.modify(worldRef, (current) =>
              Option.isSome(current)
                ? [true, current]                   // already initialized: keep current
                : [false, Option.some(newWorld)]    // not yet: store new world
            )

            // If another concurrent caller already initialized, discard newWorld
            // (CustomWorld has no dispose method, so just return early)
            if (wasAlreadyInit) return
          }),

        addBody: (config: AddBodyConfig): Effect.Effect<PhysicsBodyId, PhysicsServiceError> =>
          getWorld.pipe(
            Effect.flatMap((world) =>
              Effect.gen(function* () {
                // Create shape
                let shape: CustomShape
                if (config.shape === 'box') {
                  const halfExtents = config.shapeParams?.halfExtents ?? { x: 0.5, y: 0.5, z: 0.5 }
                  shape = yield* shapeService.createBox({ halfExtents })
                } else if (config.shape === 'sphere') {
                  const radius = config.shapeParams?.radius ?? 0.5
                  shape = yield* shapeService.createSphere({ radius })
                } else {
                  shape = yield* shapeService.createPlane()
                }

                // Build body config
                const bodyConfig = {
                  mass: config.mass,
                  position: config.position,
                  quaternion: { x: 0, y: 0, z: 0, w: 1 },
                  ...(config.type !== undefined ? { type: config.type } : {}),
                }

                // Create body
                const body = yield* rigidBodyService.create(bodyConfig)
                yield* rigidBodyService.addShape(body, shape)

                // Apply optional physics properties
                if (config.fixedRotation !== undefined) {
                  body.fixedRotation = config.fixedRotation
                }
                if (config.angularDamping !== undefined) {
                  body.angularDamping = config.angularDamping
                }
                if (config.allowSleep !== undefined) {
                  body.allowSleep = config.allowSleep
                }

                yield* rigidBodyService.updateMassProperties(body)

                // Generate opaque ID
                const bodyId = makeBodyId()

                // Add body to world and register
                yield* physicsWorldService.addBody(world, body)
                bodyMap.set(bodyId, body)

                // Track plane positions for isGrounded()
                if (config.shape === 'plane') {
                  planePositions.set(bodyId, config.position.y)
                }

                return bodyId
              }).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'addBody', cause: e }))
              )
            )
          ),

        removeBody: (bodyId: PhysicsBodyId): Effect.Effect<void, PhysicsServiceError> =>
          Effect.gen(function* () {
            const world = yield* getWorld
            const body = yield* getBody(bodyId)
            yield* physicsWorldService.removeBody(world, body).pipe(
              Effect.mapError((e) => new PhysicsServiceError({ operation: 'removeBody', cause: e }))
            )
            bodyMap.delete(bodyId)
            planePositions.delete(bodyId)
          }),

        step: (deltaTime: DeltaTimeSecs, options?: { readonly minY?: number }): Effect.Effect<void, PhysicsServiceError> =>
          Effect.gen(function* () {
            const world = yield* getWorld
            yield* physicsWorldService.step(world, deltaTime).pipe(
              Effect.mapError((e) => new PhysicsServiceError({ operation: 'step', cause: e }))
            )
            if (options?.minY !== undefined) {
              const minY = options.minY
              for (const body of bodyMap.values()) {
                if (body.type !== 'static' && body.position.y < minY) {
                  body.position.y = minY
                  if (body.velocity.y < 0) body.velocity.y = 0
                }
              }
            }
          }),

        isGrounded: (bodyId: PhysicsBodyId): Effect.Effect<boolean, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.map((body) => {
              if (planePositions.size === 0) return false

              let bodyBottomY: number
              if (body.shape.kind === 'box') {
                bodyBottomY = body.position.y - body.shape.halfExtents.y
              } else if (body.shape.kind === 'sphere') {
                bodyBottomY = body.position.y - body.shape.radius
              } else {
                return false // planes are never grounded
              }

              for (const planeY of planePositions.values()) {
                if (bodyBottomY >= planeY - 0.5 && bodyBottomY <= planeY + GROUND_DETECTION_DISTANCE) {
                  return true
                }
              }
              return false
            })
          ),

        getVelocity: (bodyId: PhysicsBodyId): Effect.Effect<Vector3, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.map((body) => ({
              x: body.velocity.x,
              y: body.velocity.y,
              z: body.velocity.z,
            }))
          ),

        getPosition: (bodyId: PhysicsBodyId): Effect.Effect<Position, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.map((body) =>
              PositionSchema.make({
                x: body.position.x,
                y: body.position.y,
                z: body.position.z,
              })
            )
          ),

        setVelocity: (bodyId: PhysicsBodyId, velocity: Vector3): Effect.Effect<void, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.flatMap((body) =>
              rigidBodyService.setVelocity(body, velocity).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'setVelocity', cause: e }))
              )
            )
          ),

        setPosition: (bodyId: PhysicsBodyId, position: Position): Effect.Effect<void, PhysicsServiceError> =>
          getBody(bodyId).pipe(
            Effect.flatMap((body) =>
              rigidBodyService.setPosition(body, position).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'setPosition', cause: e }))
              )
            )
          ),
      }
    }),
  }
) {}
export const PhysicsServiceLive = PhysicsService.Default
