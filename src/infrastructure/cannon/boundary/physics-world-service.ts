import { Effect, Schema } from 'effect'
import * as CANNON from 'cannon-es'
import { Vector3Schema } from '@/infrastructure/cannon/core'
import type { DeltaTimeSecs } from '@/shared/kernel'

export const WorldConfigSchema = Schema.Struct({
  gravity: Vector3Schema,
  broadphase: Schema.Literal('naive', 'sap'),
})
export type WorldConfig = Schema.Schema.Type<typeof WorldConfigSchema>

export const CollisionEventSchema = Schema.Struct({
  bodyA: Schema.instanceOf(CANNON.Body),
  bodyB: Schema.instanceOf(CANNON.Body),
  contactPoint: Schema.optional(Schema.instanceOf(CANNON.Vec3)),
})
export type CollisionEvent = Schema.Schema.Type<typeof CollisionEventSchema>

type CollisionCallback = (event: CollisionEvent) => void
type BodyCollisionListener = (event: { body: CANNON.Body; target: CANNON.Body }) => void

export class PhysicsWorldService extends Effect.Service<PhysicsWorldService>()(
  '@minecraft/infrastructure/cannon/PhysicsWorldService',
  {
    effect: Effect.sync(() => {
      // Scoped per service instance — no module-level state
      const collisionListenersMap = new WeakMap<CANNON.World, Map<CANNON.Body, BodyCollisionListener>>()
      const collisionCallbacksMap = new WeakMap<CANNON.World, Set<CollisionCallback>>()

      return {
        create: (config: WorldConfig): Effect.Effect<CANNON.World, never> =>
          Effect.sync(() => {
            const world = new CANNON.World()
            world.gravity.set(config.gravity.x, config.gravity.y, config.gravity.z)
            if (config.broadphase === 'sap') {
              world.broadphase = new CANNON.SAPBroadphase(world)
            }
            collisionListenersMap.set(world, new Map())
            collisionCallbacksMap.set(world, new Set())
            return world
          }),
        addBody: (world: CANNON.World, body: CANNON.Body): Effect.Effect<void, never> =>
          Effect.sync(() => {
            world.addBody(body)
            const listeners = collisionListenersMap.get(world)
            const callbacks = collisionCallbacksMap.get(world)
            if (listeners && callbacks && callbacks.size > 0) {
              const listener: BodyCollisionListener = (event) => {
                const collisionEvent: CollisionEvent = {
                  bodyA: event.body,
                  bodyB: event.target,
                }
                for (const cb of callbacks) {
                  cb(collisionEvent)
                }
              }
              body.addEventListener(CANNON.Body.COLLIDE_EVENT_NAME, listener)
              listeners.set(body, listener)
            }
          }),
        removeBody: (world: CANNON.World, body: CANNON.Body): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const listeners = collisionListenersMap.get(world)
            if (listeners) {
              const listener = listeners.get(body)
              if (listener) {
                body.removeEventListener(CANNON.Body.COLLIDE_EVENT_NAME, listener)
                listeners.delete(body)
              }
            }
            world.removeBody(body)
          }),
        step: (world: CANNON.World, deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
          Effect.sync(() => world.step(deltaTime as number)),
        onCollision: (world: CANNON.World, callback: CollisionCallback): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const callbacks = collisionCallbacksMap.get(world)
            const listeners = collisionListenersMap.get(world)
            if (!callbacks || !listeners) return

            callbacks.add(callback)

            if (callbacks.size === 1) {
              for (const body of world.bodies) {
                if (!listeners.has(body)) {
                  const listener: BodyCollisionListener = (event) => {
                    const collisionEvent: CollisionEvent = {
                      bodyA: event.body,
                      bodyB: event.target,
                    }
                    for (const cb of callbacks) {
                      cb(collisionEvent)
                    }
                  }
                  body.addEventListener(CANNON.Body.COLLIDE_EVENT_NAME, listener)
                  listeners.set(body, listener)
                }
              }
            }
          }),
        clearCollisionListeners: (world: CANNON.World): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const listeners = collisionListenersMap.get(world)
            const callbacks = collisionCallbacksMap.get(world)
            if (listeners) {
              for (const [body, listener] of listeners) {
                body.removeEventListener(CANNON.Body.COLLIDE_EVENT_NAME, listener)
              }
              listeners.clear()
            }
            if (callbacks) {
              callbacks.clear()
            }
          }),
      }
    }),
  }
) {}
export const PhysicsWorldServiceLive = PhysicsWorldService.Default
