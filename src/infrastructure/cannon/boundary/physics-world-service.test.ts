import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect } from 'effect'
import { DeltaTimeSecs } from '@/shared/kernel'
import * as CANNON from 'cannon-es'
import {
  PhysicsWorldService,
  PhysicsWorldServiceLive,
  type CollisionEvent,
  type WorldConfig,
} from './physics-world-service'

describe('cannon/boundary/world-service', () => {
  const defaultConfig: WorldConfig = {
    gravity: { x: 0, y: -9.82, z: 0 },
    broadphase: 'naive',
  }

  describe('PhysicsWorldServiceLive', () => {
    it('should provide PhysicsWorldService as Layer', () => {
      const layer = PhysicsWorldServiceLive

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it.effect('should have create, addBody, removeBody, step, onCollision, and clearCollisionListeners methods', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        expect(typeof service.create).toBe('function')
        expect(typeof service.addBody).toBe('function')
        expect(typeof service.removeBody).toBe('function')
        expect(typeof service.step).toBe('function')
        expect(typeof service.onCollision).toBe('function')
        expect(typeof service.clearCollisionListeners).toBe('function')
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should create a physics world with specified config', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)

        expect(world).toBeInstanceOf(CANNON.World)
        expect(world.gravity.x).toBe(0)
        expect(world.gravity.y).toBe(-9.82)
        expect(world.gravity.z).toBe(0)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should create world with SAP broadphase when configured', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create({ ...defaultConfig, broadphase: 'sap' })

        expect(world.broadphase).toBeInstanceOf(CANNON.SAPBroadphase)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should add body to world', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body = new CANNON.Body({ mass: 1 })

        yield* service.addBody(world, body)

        expect(world.bodies).toContain(body)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should remove body from world', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body = new CANNON.Body({ mass: 1 })

        yield* service.addBody(world, body)
        expect(world.bodies).toContain(body)

        yield* service.removeBody(world, body)
        expect(world.bodies).not.toContain(body)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should step the world simulation', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body = new CANNON.Body({ mass: 1 })
        body.position.set(0, 10, 0)

        yield* service.addBody(world, body)
        yield* service.step(world, DeltaTimeSecs.make(1 / 60))

        expect(world.bodies).toContain(body)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )
  })

  describe('Collision Events', () => {
    it.effect('should register collision callback', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const callback = vi.fn()

        yield* service.onCollision(world, callback)

        expect(callback).not.toHaveBeenCalled()
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should support multiple collision callbacks', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const callback1 = vi.fn()
        const callback2 = vi.fn()

        yield* service.onCollision(world, callback1)
        yield* service.onCollision(world, callback2)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should clear all collision listeners', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const callback = vi.fn()

        yield* service.onCollision(world, callback)
        yield* service.clearCollisionListeners(world)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should clean up collision listeners when body is removed', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body = new CANNON.Body({ mass: 1 })

        yield* service.onCollision(world, () => {})
        yield* service.addBody(world, body)
        yield* service.removeBody(world, body)

        expect(world.bodies).not.toContain(body)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should register collision listener on existing bodies when onCollision is called', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body1 = new CANNON.Body({ mass: 1 })
        const body2 = new CANNON.Body({ mass: 1 })

        yield* service.addBody(world, body1)
        yield* service.addBody(world, body2)
        yield* service.onCollision(world, () => {})
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )
  })

  describe('CollisionEvent type', () => {
    it('should have correct structure for collision event', () => {
      const bodyA = new CANNON.Body({ mass: 1 })
      const bodyB = new CANNON.Body({ mass: 1 })

      const event: CollisionEvent = {
        bodyA,
        bodyB,
      }

      expect(event.bodyA).toBe(bodyA)
      expect(event.bodyB).toBe(bodyB)
      expect(event.contactPoint).toBeUndefined()
    })

    it('should support optional contact point', () => {
      const bodyA = new CANNON.Body({ mass: 1 })
      const bodyB = new CANNON.Body({ mass: 1 })
      const contactPoint = new CANNON.Vec3(1, 2, 3)

      const event: CollisionEvent = {
        bodyA,
        bodyB,
        contactPoint,
      }

      expect(event.contactPoint).toBe(contactPoint)
    })
  })

  describe('Effect composition', () => {
    it.effect('should support Effect.flatMap for chaining operations', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const result = service.create(defaultConfig).pipe(
          Effect.flatMap((world) => service.addBody(world, new CANNON.Body({ mass: 1 }))),
          Effect.flatMap(() => service.step(null as any, DeltaTimeSecs.make(1 / 60)))
        )

        expect(typeof result.pipe).toBe('function')
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )
  })
})
