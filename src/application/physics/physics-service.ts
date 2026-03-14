import { Effect, Ref, Stream, PubSub, Data, Schema } from 'effect'
import * as CANNON from 'cannon-es'
import { PhysicsBodyId, PhysicsBodyIdSchema, Position, PositionSchema } from '@/shared/kernel'
import { Vector3Schema, type Vector3 } from '@/shared/math/three'
import { RigidBodyService } from '@/infrastructure/cannon/boundary/body-service'
import { PhysicsWorldService } from '@/infrastructure/cannon/boundary/world-service'
import { ShapeService } from '@/infrastructure/cannon/boundary/shape-service'

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
 * PhysicsBody handle — only exposes the opaque ID, not the raw CANNON.Body
 */
export const PhysicsBodySchema = Schema.Struct({ id: PhysicsBodyIdSchema })
export type PhysicsBody = typeof PhysicsBodySchema.Type

/**
 * Raycast hit result — references a body by ID, not raw CANNON.Body
 */
export const PhysicsRaycastHitSchema = Schema.Struct({
  bodyId: PhysicsBodyIdSchema,
  point: Vector3Schema,
  normal: Vector3Schema,
  distance: Schema.Number,
})
export type PhysicsRaycastHit = Schema.Schema.Type<typeof PhysicsRaycastHitSchema>

/**
 * Configuration for adding a rigid body
 */
const ShapeParamsSchema = Schema.Struct({
  halfExtents: Schema.optional(Vector3Schema),
  radius: Schema.optional(Schema.Number),
})

export const AddBodyConfigSchema = Schema.Struct({
  mass: Schema.Number,
  position: PositionSchema,
  shape: Schema.Literal('box', 'sphere', 'plane'),
  shapeParams: Schema.optional(ShapeParamsSchema),
  type: Schema.optional(Schema.Literal('dynamic', 'static', 'kinematic')),
  fixedRotation: Schema.optional(Schema.Boolean),
  angularDamping: Schema.optional(Schema.Number),
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
  '@minecraft/layer/PhysicsService',
  {
    effect: Effect.gen(function* () {
      const rigidBodyService = yield* RigidBodyService
      const physicsWorldService = yield* PhysicsWorldService
      const shapeService = yield* ShapeService

      // Internal state: CANNON.World stored in a Ref
      const worldRef = yield* Ref.make<CANNON.World | null>(null)

      // Internal body registry: maps PhysicsBodyId -> CANNON.Body
      const bodyMap = new Map<PhysicsBodyId, CANNON.Body>()

      // Collision handler registry: maps PhysicsBodyId -> stored handler (for removeEventListener)
      const handlerMap = new Map<PhysicsBodyId, (event: unknown) => void>()

      // PubSub for ground collision events
      const groundPubSub = yield* PubSub.unbounded<PhysicsBodyId>()

      // Per-instance body ID counter — starts at 0 for each new PhysicsService instance
      let nextBodyId = 0
      const makeBodyId = (): PhysicsBodyId =>
        PhysicsBodyIdSchema.make(`physics-body-${nextBodyId++}`)

      /**
       * Helper: get world or fail with PhysicsServiceError
       */
      const getWorld: Effect.Effect<CANNON.World, PhysicsServiceError> = Ref.get(worldRef).pipe(
        Effect.flatMap((world) =>
          world === null
            ? Effect.fail(new PhysicsServiceError({ operation: 'getWorld', cause: 'Physics world not initialized. Call initialize() first.' }))
            : Effect.succeed(world)
        )
      )

      /**
       * Helper: get CANNON.Body or fail with PhysicsServiceError
       */
      const getBody = (bodyId: PhysicsBodyId): Effect.Effect<CANNON.Body, PhysicsServiceError> =>
        Effect.sync(() => bodyMap.get(bodyId)).pipe(
          Effect.flatMap((body) =>
            body !== undefined
              ? Effect.succeed(body)
              : Effect.fail(new PhysicsServiceError({ operation: 'getBody', cause: `Body not found: ${bodyId}` })),
          ),
        )

      return {
        initialize: (config: { gravity: Vector3; broadphase: 'naive' | 'sap' }): Effect.Effect<void, PhysicsServiceError> =>
          Ref.get(worldRef).pipe(
            Effect.flatMap((existingWorld) => {
              if (existingWorld !== null) {
                return Effect.void
              }
              return physicsWorldService.create({
                gravity: config.gravity,
                broadphase: config.broadphase,
              }).pipe(
                Effect.flatMap((world) => Ref.set(worldRef, world)),
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'initialize', cause: e }))
              )
            })
          ),

        addBody: (config: AddBodyConfig): Effect.Effect<PhysicsBodyId, PhysicsServiceError> =>
          getWorld.pipe(
            Effect.flatMap((world) =>
              Effect.gen(function* () {
                // Create shape
                let shape: CANNON.Shape
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
                const bodyConfig = config.type !== undefined
                  ? {
                      mass: config.mass,
                      position: config.position,
                      quaternion: { x: 0, y: 0, z: 0, w: 1 },
                      type: config.type,
                    }
                  : {
                      mass: config.mass,
                      position: config.position,
                      quaternion: { x: 0, y: 0, z: 0, w: 1 },
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

                // Plane shapes need to be rotated to face upward (+Y normal)
                if (config.shape === 'plane') {
                  body.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
                }

                yield* rigidBodyService.updateMassProperties(body)

                // Generate opaque ID
                const bodyId = makeBodyId()

                // Register collision listener for ground detection (stored for cleanup in removeBody)
                const collideHandler = (event: unknown) => {
                  const e = event as { contact: CANNON.ContactEquation }
                  const contactNormal = new CANNON.Vec3()
                  const contact = e.contact
                  if (contact.bi.id === body.id) {
                    contact.ni.negate(contactNormal)
                  } else {
                    contactNormal.copy(contact.ni)
                  }
                  if (contactNormal.y > 0.5) {
                    Effect.runFork(
                      PubSub.publish(groundPubSub, bodyId).pipe(
                        Effect.catchAllCause(() => Effect.void),
                      ),
                    )
                  }
                }
                // Add body to world FIRST — handlerMap/bodyMap writes only after success
                yield* physicsWorldService.addBody(world, body)
                bodyMap.set(bodyId, body)
                handlerMap.set(bodyId, collideHandler)
                body.addEventListener('collide', collideHandler)

                return bodyId
              }).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'addBody', cause: e }))
              )
            )
          ),

        removeBody: (bodyId: PhysicsBodyId): Effect.Effect<void, PhysicsServiceError> =>
          Effect.all([getWorld, getBody(bodyId)]).pipe(
            Effect.flatMap(([world, body]) =>
              physicsWorldService.removeBody(world, body).pipe(
                Effect.tap(() => Effect.sync(() => {
                  const handler = handlerMap.get(bodyId)
                  if (handler) {
                    body.removeEventListener('collide', handler)
                    handlerMap.delete(bodyId)
                  }
                  bodyMap.delete(bodyId)
                })),
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'removeBody', cause: e }))
              )
            )
          ),

        step: (deltaTime: number): Effect.Effect<void, PhysicsServiceError> =>
          getWorld.pipe(
            Effect.flatMap((world) =>
              physicsWorldService.step(world, deltaTime).pipe(
                Effect.mapError((e) => new PhysicsServiceError({ operation: 'step', cause: e }))
              )
            )
          ),

        raycast: (
          from: Vector3,
          to: Vector3,
        ): Effect.Effect<ReadonlyArray<PhysicsRaycastHit>, PhysicsServiceError> =>
          getWorld.pipe(
            Effect.flatMap((world) =>
              Effect.sync(() => {
                const hits: PhysicsRaycastHit[] = []

                const fromVec = new CANNON.Vec3(from.x, from.y, from.z)
                const toVec = new CANNON.Vec3(to.x, to.y, to.z)

                world.raycastAll(fromVec, toVec, { skipBackfaces: true }, (hit) => {
                  if (hit.hasHit) {
                    const hitBody = hit.body
                    if (hitBody !== null) {
                      for (const [id, body] of bodyMap.entries()) {
                        if (body === hitBody) {
                          hits.push({
                            bodyId: id,
                            point: { x: hit.hitPointWorld.x, y: hit.hitPointWorld.y, z: hit.hitPointWorld.z },
                            normal: { x: hit.hitNormalWorld.x, y: hit.hitNormalWorld.y, z: hit.hitNormalWorld.z },
                            distance: hit.distance,
                          })
                          break
                        }
                      }
                    }
                  }
                })

                return hits as ReadonlyArray<PhysicsRaycastHit>
              })
            )
          ),

        isGrounded: (bodyId: PhysicsBodyId): Effect.Effect<boolean, PhysicsServiceError> =>
          Effect.all([getWorld, getBody(bodyId)]).pipe(
            Effect.map(([world, body]) => {
              let grounded = false
              const contacts = world.contacts

              for (const contact of contacts) {
                if (contact.bi === body || contact.bj === body) {
                  const normal = new CANNON.Vec3()
                  if (contact.bi === body) {
                    contact.ni.negate(normal)
                  } else {
                    normal.copy(contact.ni)
                  }
                  if (normal.y > 0.5) {
                    grounded = true
                    break
                  }
                }
              }

              return grounded
            })
          ),

        groundCollisions: (bodyId: PhysicsBodyId): Stream.Stream<void, never, never> =>
          Stream.fromPubSub(groundPubSub).pipe(
            Stream.filter((id) => id === bodyId),
            Stream.map(() => undefined as void),
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
