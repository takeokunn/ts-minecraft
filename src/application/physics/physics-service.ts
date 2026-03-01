import { Effect } from 'effect'
import * as CANNON from 'cannon-es'
import { PhysicsError, isPhysicsError } from '../../domain/errors'
import { PhysicsWorldService } from '../../infrastructure/cannon/boundary/world-service'
import { RigidBodyService } from '../../infrastructure/cannon/boundary/body-service'
import { ShapeService } from '../../infrastructure/cannon/boundary/shape-service'

export interface PhysicsBody {
  readonly id: string
  readonly body: CANNON.Body
}

/**
 * Result of a physics raycast
 */
export interface PhysicsRaycastResult {
  /** Whether the raycast hit something */
  readonly hasHit: boolean
  /** Distance to the hit point (if any) */
  readonly distance: number
  /** Hit body (if any) */
  readonly body: CANNON.Body | null
  /** Hit point in world coordinates */
  readonly hitPoint: { x: number; y: number; z: number } | null
  /** Hit normal */
  readonly hitNormal: { x: number; y: number; z: number } | null
}

/**
 * Distance threshold for ground detection (in meters)
 */
export const GROUND_DETECTION_DISTANCE = 0.15

/**
 * Vertical offset from player center to feet for ground raycast
 */
export const PLAYER_FEET_OFFSET = 0.9

export class PhysicsService extends Effect.Service<PhysicsService>()(
  '@minecraft/layer/PhysicsService',
  {
    effect: Effect.gen(function* () {
      const worldService = yield* PhysicsWorldService
      const bodyService = yield* RigidBodyService
      const shapeService = yield* ShapeService

      // Mutable state for collision callback access (required for CANNON.js callbacks)
      const bodiesMap = new Map<string, PhysicsBody>()
      const groundedSet = new Set<string>()
      const groundContactsMap = new Map<string, number>()
      // Track bodies whose grounded state was manually cleared (e.g., on jump)
      // This overrides contact-based detection for the current frame
      const manuallyClearedIds = new Set<string>()
      // World and ground references
      let worldRef: CANNON.World | null = null
      // Ground collision callbacks
      const groundCollisionCallbacks = new Map<string, Set<() => void>>()

      return {
        initialize: (): Effect.Effect<CANNON.World, PhysicsError> =>
          Effect.gen(function* () {
            const world = yield* worldService.create({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
            worldRef = world
            return world
          }).pipe(
            Effect.mapError((e) => new PhysicsError({ contextData: 'world-init', reason: String(e) }))
          ),

        createPlayerBody: (id: string, position: { x: number; y: number; z: number }): Effect.Effect<CANNON.Body, PhysicsError> =>
          Effect.gen(function* () {
            if (!worldRef) {
              return yield* Effect.fail(new PhysicsError({ contextData: id, reason: 'World not initialized' }))
            }

            // Create player collider (capsule approximated as box for Phase 4)
            const shape = yield* shapeService.createBox({
              halfExtents: { x: 0.3, y: 0.9, z: 0.3 }, // 0.6m wide, 1.8m tall
            })

            const body = yield* bodyService.create({
              mass: 70, // 70kg player
              position,
              quaternion: { x: 0, y: 0, z: 0, w: 1 },
            })

            // Add shape to body
            yield* bodyService.addShape(body, shape)

            // Prevent physics rotation (essential for character controllers)
            body.fixedRotation = true
            yield* bodyService.updateMassProperties(body)
            // Dampen angular velocity as extra safety
            body.angularDamping = 1
            // Never sleep: sleeping removes the body from contact tracking, breaking grounded detection
            body.allowSleep = false

            // Add to world
            yield* worldService.addBody(worldRef, body)

            // Track body (mutable)
            bodiesMap.set(id, { id, body })

            return body
          }).pipe(
            Effect.mapError((e) => isPhysicsError(e) ? e : new PhysicsError({ contextData: id, reason: String(e) }))
          ),

        createGroundPlane: (): Effect.Effect<CANNON.Body, PhysicsError> =>
          Effect.gen(function* () {
            if (!worldRef) {
              return yield* Effect.fail(new PhysicsError({ contextData: 'ground', reason: 'World not initialized' }))
            }

            const shape = yield* shapeService.createPlane()
            const body = yield* bodyService.create({
              mass: 0, // Static body
              position: { x: 0, y: 0, z: 0 },
              quaternion: { x: 0, y: 0, z: 0, w: 1 },
            })

            // Add shape to body
            yield* bodyService.addShape(body, shape)

            // Rotate plane to be horizontal (facing up)
            body.quaternion.setFromEuler(-Math.PI / 2, 0, 0)

            yield* worldService.addBody(worldRef, body)

            return body
          }).pipe(
            Effect.mapError((e) => isPhysicsError(e) ? e : new PhysicsError({ contextData: 'ground', reason: String(e) }))
          ),

        initializeScene: (groundY = 0): Effect.Effect<{
          readonly world: CANNON.World
          readonly groundBody: CANNON.Body
        }, PhysicsError> =>
          Effect.gen(function* () {
            // Create the physics world
            const world = yield* worldService.create({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
            worldRef = world

            // Set up collision detection for grounded state using beginContact/endContact events
            world.addEventListener('beginContact', (event: { bodyA: CANNON.Body; bodyB: CANNON.Body }) => {
              // Check each tracked body
              for (const pb of bodiesMap.values()) {
                if (pb.body === event.bodyA || pb.body === event.bodyB) {
                  const otherBody = pb.body === event.bodyA ? event.bodyB : event.bodyA
                  // Check if contacting a static body (ground)
                  if (otherBody && otherBody.mass === 0) {
                    const playerY = pb.body.position.y
                    const otherY = otherBody.position.y
                    // Player is at or above the contact surface
                    if (playerY >= otherY - 0.1) {
                      // Mark as grounded
                      if (!groundedSet.has(pb.id)) {
                        groundedSet.add(pb.id)
                      }
                      // Update contact count
                      groundContactsMap.set(pb.id, (groundContactsMap.get(pb.id) ?? 0) + 1)
                      // Call callbacks
                      const callbacks = groundCollisionCallbacks.get(pb.id)
                      if (callbacks) {
                        callbacks.forEach(cb => cb())
                      }
                    }
                  }
                }
              }
            })

            world.addEventListener('endContact', (event: { bodyA: CANNON.Body; bodyB: CANNON.Body }) => {
              // Check each tracked body
              for (const pb of bodiesMap.values()) {
                if (pb.body === event.bodyA || pb.body === event.bodyB) {
                  const otherBody = pb.body === event.bodyA ? event.bodyB : event.bodyA
                  if (otherBody && otherBody.mass === 0) {
                    // Decrement contact count
                    const currentCount = groundContactsMap.get(pb.id) ?? 0
                    if (currentCount > 0) {
                      groundContactsMap.set(pb.id, currentCount - 1)
                      // If no more contacts, clear grounded state
                      if (currentCount === 1) {
                        groundedSet.delete(pb.id)
                      }
                    }
                  }
                }
              }
            })

            // Create the ground plane at the terrain surface height
            const groundBody = yield* Effect.gen(function* () {
              const shape = yield* shapeService.createPlane()
              const body = yield* bodyService.create({
                mass: 0, // Static body (mass = 0 means infinite mass)
                position: { x: 0, y: groundY, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
              })

              yield* bodyService.addShape(body, shape)

              // Rotate plane to be horizontal (facing up - normal points +Y)
              body.quaternion.setFromEuler(-Math.PI / 2, 0, 0)

              yield* worldService.addBody(worldRef!, body)

              return body
            }).pipe(
              Effect.mapError((e) => isPhysicsError(e) ? e : new PhysicsError({ contextData: 'ground', reason: String(e) }))
            )

            return { world, groundBody }
          }).pipe(
            Effect.mapError((e) => new PhysicsError({ contextData: 'scene-init', reason: String(e) }))
          ),

        step: (world: CANNON.World, deltaTime: number): Effect.Effect<void, PhysicsError> =>
          worldService.step(world, deltaTime).pipe(
            Effect.mapError((e) => new PhysicsError({ contextData: 'step', reason: String(e) }))
          ),

        getBody: (id: string): Effect.Effect<CANNON.Body | null, never> =>
          Effect.sync(() => {
            const pb = bodiesMap.get(id)
            return pb?.body ?? null
          }),

        applyImpulse: (id: string, impulse: { x: number; y: number; z: number }): Effect.Effect<void, PhysicsError> =>
          Effect.gen(function* () {
            const pb = bodiesMap.get(id)
            if (!pb) {
              return yield* Effect.fail(new PhysicsError({ contextData: id, reason: 'Body not found' }))
            }

            pb.body.applyImpulse(
              new CANNON.Vec3(impulse.x, impulse.y, impulse.z),
              new CANNON.Vec3(0, 0, 0)
            )
          }).pipe(
            Effect.mapError((e) => isPhysicsError(e) ? e : new PhysicsError({ contextData: id, reason: String(e) }))
          ),

        setVelocity: (id: string, velocity: { x: number; y: number; z: number }): Effect.Effect<void, PhysicsError> =>
          Effect.gen(function* () {
            const pb = bodiesMap.get(id)
            if (!pb) {
              return yield* Effect.fail(new PhysicsError({ contextData: id, reason: 'Body not found' }))
            }

            yield* bodyService.setVelocity(pb.body, velocity)
          }).pipe(
            Effect.mapError((e) => isPhysicsError(e) ? e : new PhysicsError({ contextData: id, reason: String(e) }))
          ),

        // Contact-based ground detection using world.contacts (reliable alternative to events)
        isGrounded: (id: string): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            if (!worldRef) return false
            const pb = bodiesMap.get(id)
            if (!pb) return false
            // Check if any ground contact exists via world.contacts
            let hasGroundContact = false
            for (const contact of worldRef.contacts) {
              const otherBody = pb.body === contact.bi ? contact.bj
                              : pb.body === contact.bj ? contact.bi
                              : null
              if (otherBody && otherBody.mass === 0) {
                const playerY = pb.body.position.y
                const otherY = otherBody.position.y
                if (playerY >= otherY - 0.1) {
                  hasGroundContact = true
                  break
                }
              }
            }
            // If manual override is active (clearGroundedState was called after a jump):
            // - If contacts are gone, auto-clear the override (player has left the ground)
            // - Always return false while override is active
            // NOTE: world.contacts reflects pre-integration positions, so contacts may still
            // exist for one frame after jump; the override ensures we return false until
            // the player physically separates from the ground.
            if (manuallyClearedIds.has(id)) {
              if (!hasGroundContact) {
                manuallyClearedIds.delete(id)
              }
              return false
            }
            return hasGroundContact
          }),

        checkGroundContact: (playerBodyId: string): Effect.Effect<boolean, never> =>
          Effect.sync(() => (groundContactsMap.get(playerBodyId) ?? 0) > 0),

        onGroundCollision: (bodyId: string, callback: () => void): Effect.Effect<void, never> =>
          Effect.sync(() => {
            // Store callbacks to call when grounded state is detected
            if (!groundCollisionCallbacks.has(bodyId)) {
              groundCollisionCallbacks.set(bodyId, new Set())
            }
            groundCollisionCallbacks.get(bodyId)!.add(callback)
          }),

        clearGroundedState: (id: string): Effect.Effect<void, never> =>
          Effect.sync(() => {
            // Clear grounded state (used when jumping)
            groundedSet.delete(id)
            groundContactsMap.delete(id)
            // Also override contact-based detection for this frame
            manuallyClearedIds.add(id)
          }),

        raycast: (
          world: CANNON.World,
          origin: { x: number; y: number; z: number },
          direction: { x: number; y: number; z: number },
          maxDistance: number
        ): Effect.Effect<PhysicsRaycastResult, never> =>
          Effect.gen(function* () {
            const ray = new CANNON.Ray(
              new CANNON.Vec3(origin.x, origin.y, origin.z),
              new CANNON.Vec3(
                origin.x + direction.x * maxDistance,
                origin.y + direction.y * maxDistance,
                origin.z + direction.z * maxDistance
              )
            )

            const result = new CANNON.RaycastResult()
            ray.intersectWorld(world, { mode: CANNON.Ray.CLOSEST, result })

            if (!result.hasHit) {
              return {
                hasHit: false,
                distance: maxDistance,
                body: null,
                hitPoint: null,
                hitNormal: null,
              }
            }

            const hitPoint = result.hitPointWorld
            const hitNormal = result.hitNormalWorld

            return {
              hasHit: true,
              distance: result.distance ?? 0,
              body: result.body ?? null,
              hitPoint: hitPoint ? { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z } : null,
              hitNormal: hitNormal ? { x: hitNormal.x, y: hitNormal.y, z: hitNormal.z } : null,
            }
          }),
      }
    }),
  }
) {}
export { PhysicsService as PhysicsServiceLive }
