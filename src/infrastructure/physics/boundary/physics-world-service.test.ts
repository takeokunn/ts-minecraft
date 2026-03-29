import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect } from 'effect'
import { DeltaTimeSecs } from '@/shared/kernel'
import {
  PhysicsWorldService,
  PhysicsWorldServiceLive,
  type WorldConfig,
} from './physics-world-service'
import { RigidBodyService, RigidBodyServiceLive } from './rigid-body-service'

describe('physics/boundary/physics-world-service', () => {
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

    it.effect('should have create, addBody, removeBody, step methods', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService
        expect(typeof service.create).toBe('function')
        expect(typeof service.addBody).toBe('function')
        expect(typeof service.removeBody).toBe('function')
        expect(typeof service.step).toBe('function')
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should create a physics world with specified gravity', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService
        const world = yield* service.create(defaultConfig)
        expect(world.gravity.x).toBe(0)
        expect(world.gravity.y).toBe(-9.82)
        expect(world.gravity.z).toBe(0)
      }).pipe(Effect.provide(PhysicsWorldServiceLive))
    )

    it.effect('should add body to world', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create({ mass: 1, position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } })
        yield* worldSvc.addBody(world, body)
        expect(world.bodies).toContain(body)
      }).pipe(Effect.provide(PhysicsWorldServiceLive), Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should remove body from world', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create({ mass: 1, position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } })
        yield* worldSvc.addBody(world, body)
        expect(world.bodies).toContain(body)
        yield* worldSvc.removeBody(world, body)
        expect(world.bodies).not.toContain(body)
      }).pipe(Effect.provide(PhysicsWorldServiceLive), Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should apply gravity when stepping (body falls)', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create({ mass: 1, position: { x: 0, y: 10, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } })
        body.shape = { kind: 'box', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }
        yield* worldSvc.addBody(world, body)

        const initialY = body.position.y
        yield* worldSvc.step(world, DeltaTimeSecs.make(1 / 60))

        // Gravity should reduce y position
        expect(body.position.y).toBeLessThan(initialY)
      }).pipe(Effect.provide(PhysicsWorldServiceLive), Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should resolve AABB-vs-plane collision (body settles on plane)', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)

        // Static plane at y=0
        const plane = yield* bodySvc.create({ mass: 0, position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, type: 'static' })
        plane.shape = { kind: 'plane' }
        yield* worldSvc.addBody(world, plane)

        // Dynamic box at y=5
        const box = yield* bodySvc.create({ mass: 1, position: { x: 0, y: 5, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } })
        box.shape = { kind: 'box', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }
        yield* worldSvc.addBody(world, box)

        // Step until settled
        yield* Effect.forEach(Arr.makeBy(300, () => undefined), () => worldSvc.step(world, DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        // Box bottom should be at planeY (0), so box center at 0 + halfExtents.y = 0.5
        expect(box.position.y).toBeCloseTo(0.5, 1)
        expect(box.velocity.y).toBeCloseTo(0, 1)
      }).pipe(Effect.provide(PhysicsWorldServiceLive), Effect.provide(RigidBodyServiceLive))
    )

    it.effect('static bodies should not be affected by gravity', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create({ mass: 0, position: { x: 0, y: 10, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 }, type: 'static' })
        body.shape = { kind: 'plane' }
        yield* worldSvc.addBody(world, body)

        yield* worldSvc.step(world, DeltaTimeSecs.make(1 / 60))

        expect(body.position.y).toBe(10)
      }).pipe(Effect.provide(PhysicsWorldServiceLive), Effect.provide(RigidBodyServiceLive))
    )
  })
})
