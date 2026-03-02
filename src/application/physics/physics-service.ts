import { Effect, Ref, Stream, PubSub } from 'effect'
import * as CANNON from 'cannon-es'
import { PhysicsBodyId, PhysicsBodyIdSchema, Position, PositionSchema } from '@/shared/kernel'
import type { Vector3 } from '@/infrastructure/cannon/core'
import { RigidBodyService } from '@/infrastructure/cannon/boundary/body-service'
import { PhysicsWorldService } from '@/infrastructure/cannon/boundary/world-service'
import { ShapeService } from '@/infrastructure/cannon/boundary/shape-service'

/**
 * Error type for PhysicsService operations
 */
export class PhysicsError extends Error {
  readonly _tag = 'PhysicsError'
  readonly reason: string

  constructor(reason: string, cause?: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : cause ? String(cause) : ''
    super(`Physics error: ${reason}${causeMessage ? `: ${causeMessage}` : ''}`)
    this.name = 'PhysicsError'
    this.reason = reason
    Object.setPrototypeOf(this, PhysicsError.prototype)
  }
}

/**
 * PhysicsBody handle — only exposes the opaque ID, not the raw CANNON.Body
 */
export interface PhysicsBody {
  readonly id: PhysicsBodyId
}

/**
 * Raycast hit result — references a body by ID, not raw CANNON.Body
 */
export interface PhysicsRaycastHit {
  readonly bodyId: PhysicsBodyId
  readonly point: Vector3
  readonly normal: Vector3
  readonly distance: number
}

/**
 * Configuration for adding a rigid body
 */
export type AddBodyConfig = {
  readonly mass: number
  readonly position: Position
  readonly shape: 'box' | 'sphere' | 'plane'
  readonly shapeParams?: {
    readonly halfExtents?: Vector3
    readonly radius?: number
  }
  readonly type?: 'dynamic' | 'static' | 'kinematic'
  readonly fixedRotation?: boolean
  readonly angularDamping?: number
  readonly allowSleep?: boolean
}

let _nextBodyId = 0
const makeBodyId = (): PhysicsBodyId =>
  PhysicsBodyIdSchema.make(`physics-body-${_nextBodyId++}`)

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

      // PubSub for ground collision events
      const groundPubSub = yield* PubSub.unbounded<PhysicsBodyId>()

      /**
       * Helper: get world or fail with PhysicsError
       */
      const getWorld: Effect.Effect<CANNON.World, PhysicsError> = Ref.get(worldRef).pipe(
        Effect.flatMap((world) =>
          world === null
            ? Effect.fail(new PhysicsError('Physics world not initialized. Call initialize() first.'))
            : Effect.succeed(world)
        )
      )

      /**
       * Helper: get CANNON.Body or fail with PhysicsError
       */
      const getBody = (bodyId: PhysicsBodyId): Effect.Effect<CANNON.Body, PhysicsError> =>
        Effect.sync(() => bodyMap.get(bodyId)).pipe(
          Effect.flatMap((body) =>
            body !== undefined
              ? Effect.succeed(body)
              : Effect.fail(new PhysicsError(`Body not found: ${bodyId}`)),
          ),
        )

      return {
        initialize: (config: { gravity: Vector3; broadphase: 'naive' | 'sap' }): Effect.Effect<void, PhysicsError> =>
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
                Effect.mapError((e) => new PhysicsError('initialize', e))
              )
            })
          ),

        addBody: (config: AddBodyConfig): Effect.Effect<PhysicsBodyId, PhysicsError> =>
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

                // Register collision listener for ground detection
                body.addEventListener('collide', (event: unknown) => {
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
                })

                // Add body to world and register in internal map
                yield* physicsWorldService.addBody(world, body)
                bodyMap.set(bodyId, body)

                return bodyId
              }).pipe(
                Effect.mapError((e) => new PhysicsError('addBody', e))
              )
            )
          ),

        removeBody: (bodyId: PhysicsBodyId): Effect.Effect<void, PhysicsError> =>
          Effect.all([getWorld, getBody(bodyId)]).pipe(
            Effect.flatMap(([world, body]) =>
              physicsWorldService.removeBody(world, body).pipe(
                Effect.tap(() => Effect.sync(() => bodyMap.delete(bodyId))),
                Effect.mapError((e) => new PhysicsError('removeBody', e))
              )
            )
          ),

        step: (deltaTime: number): Effect.Effect<void, PhysicsError> =>
          getWorld.pipe(
            Effect.flatMap((world) =>
              physicsWorldService.step(world, deltaTime).pipe(
                Effect.mapError((e) => new PhysicsError('step', e))
              )
            )
          ),

        raycast: (
          from: Vector3,
          to: Vector3,
        ): Effect.Effect<ReadonlyArray<PhysicsRaycastHit>, PhysicsError> =>
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

        isGrounded: (bodyId: PhysicsBodyId): Effect.Effect<boolean, PhysicsError> =>
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

        getVelocity: (bodyId: PhysicsBodyId): Effect.Effect<Vector3, PhysicsError> =>
          getBody(bodyId).pipe(
            Effect.map((body) => ({
              x: body.velocity.x,
              y: body.velocity.y,
              z: body.velocity.z,
            }))
          ),

        getPosition: (bodyId: PhysicsBodyId): Effect.Effect<Position, PhysicsError> =>
          getBody(bodyId).pipe(
            Effect.map((body) =>
              PositionSchema.make({
                x: body.position.x,
                y: body.position.y,
                z: body.position.z,
              })
            )
          ),

        setVelocity: (bodyId: PhysicsBodyId, velocity: Vector3): Effect.Effect<void, PhysicsError> =>
          getBody(bodyId).pipe(
            Effect.flatMap((body) =>
              rigidBodyService.setVelocity(body, velocity).pipe(
                Effect.mapError((e) => new PhysicsError('setVelocity', e))
              )
            )
          ),

        setPosition: (bodyId: PhysicsBodyId, position: Position): Effect.Effect<void, PhysicsError> =>
          getBody(bodyId).pipe(
            Effect.flatMap((body) =>
              rigidBodyService.setPosition(body, position).pipe(
                Effect.mapError((e) => new PhysicsError('setPosition', e))
              )
            )
          ),
      }
    }),
  }
) {}
export const PhysicsServiceLive = PhysicsService.Default
