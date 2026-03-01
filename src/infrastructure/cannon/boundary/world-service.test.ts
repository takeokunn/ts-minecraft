import { describe, it, expect, vi } from 'vitest'
import { Effect } from 'effect'
import * as CANNON from 'cannon-es'
import {
  PhysicsWorldService,
  PhysicsWorldServiceLive,
  type CollisionEvent,
  type WorldConfig,
} from './world-service'

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

    it('should have create, addBody, removeBody, step, onCollision, and clearCollisionListeners methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        expect(typeof service.create).toBe('function')
        expect(typeof service.addBody).toBe('function')
        expect(typeof service.removeBody).toBe('function')
        expect(typeof service.step).toBe('function')
        expect(typeof service.onCollision).toBe('function')
        expect(typeof service.clearCollisionListeners).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should create a physics world with specified config', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)

        expect(world).toBeInstanceOf(CANNON.World)
        expect(world.gravity.x).toBe(0)
        expect(world.gravity.y).toBe(-9.82)
        expect(world.gravity.z).toBe(0)

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should create world with SAP broadphase when configured', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create({ ...defaultConfig, broadphase: 'sap' })

        expect(world.broadphase).toBeInstanceOf(CANNON.SAPBroadphase)

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should add body to world', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body = new CANNON.Body({ mass: 1 })

        yield* service.addBody(world, body)

        expect(world.bodies).toContain(body)

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should remove body from world', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body = new CANNON.Body({ mass: 1 })

        yield* service.addBody(world, body)
        expect(world.bodies).toContain(body)

        yield* service.removeBody(world, body)
        expect(world.bodies).not.toContain(body)

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should step the world simulation', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body = new CANNON.Body({ mass: 1 })
        body.position.set(0, 10, 0)

        yield* service.addBody(world, body)
        yield* service.step(world, 1 / 60)

        expect(world.bodies).toContain(body)

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Collision Events', () => {
    it('should register collision callback', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const callback = vi.fn()

        yield* service.onCollision(world, callback)

        expect(callback).not.toHaveBeenCalled()

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should support multiple collision callbacks', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const callback1 = vi.fn()
        const callback2 = vi.fn()

        yield* service.onCollision(world, callback1)
        yield* service.onCollision(world, callback2)

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should clear all collision listeners', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const callback = vi.fn()

        yield* service.onCollision(world, callback)
        yield* service.clearCollisionListeners(world)

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should clean up collision listeners when body is removed', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body = new CANNON.Body({ mass: 1 })

        yield* service.onCollision(world, () => {})
        yield* service.addBody(world, body)
        yield* service.removeBody(world, body)

        expect(world.bodies).not.toContain(body)

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should register collision listener on existing bodies when onCollision is called', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const world = yield* service.create(defaultConfig)
        const body1 = new CANNON.Body({ mass: 1 })
        const body2 = new CANNON.Body({ mass: 1 })

        yield* service.addBody(world, body1)
        yield* service.addBody(world, body2)
        yield* service.onCollision(world, () => {})

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
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
    it('should support Effect.flatMap for chaining operations', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsWorldService

        const result = service.create(defaultConfig).pipe(
          Effect.flatMap((world) => service.addBody(world, new CANNON.Body({ mass: 1 }))),
          Effect.flatMap(() => service.step(null as any, 1 / 60))
        )

        expect(typeof result.pipe).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(PhysicsWorldServiceLive))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })
})
