import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import {
  PhysicsService,
  PhysicsServiceLive,
  PhysicsError,
  GROUND_DETECTION_DISTANCE,
  PLAYER_FEET_OFFSET,
} from './physics-service'
import { PhysicsWorldServiceLive } from '../../infrastructure/cannon/boundary/world-service'
import { RigidBodyServiceLive } from '../../infrastructure/cannon/boundary/body-service'
import { ShapeServiceLive } from '../../infrastructure/cannon/boundary/shape-service'

// Create test layer by combining all dependencies
const TestLayer = PhysicsServiceLive.pipe(
  Layer.provide(PhysicsWorldServiceLive),
  Layer.provide(RigidBodyServiceLive),
  Layer.provide(ShapeServiceLive)
)

describe('application/physics/physics-service', () => {
  describe('PhysicsServiceLive', () => {
    it('should provide PhysicsService as Layer', () => {
      const layer = PhysicsServiceLive

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it('should have all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        expect(typeof service.initialize).toBe('function')
        expect(typeof service.addBody).toBe('function')
        expect(typeof service.removeBody).toBe('function')
        expect(typeof service.step).toBe('function')
        expect(typeof service.raycast).toBe('function')
        expect(typeof service.isGrounded).toBe('function')
        expect(typeof service.groundCollisions).toBe('function')
        expect(typeof service.getVelocity).toBe('function')
        expect(typeof service.getPosition).toBe('function')
        expect(typeof service.setVelocity).toBe('function')
        expect(typeof service.setPosition).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('World initialization', () => {
    it('should initialize physics world with default gravity', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        // Verify initialization succeeded by stepping without error
        yield* service.step(0.016)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should fail to step before initialization', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = yield* Effect.either(service.step(0.016))

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(PhysicsError)
        }

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should idempotently initialize (calling twice is safe)', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        // Second call should be a no-op
        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        yield* service.step(0.016)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('addBody', () => {
    it('should fail to add body before initialization', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = yield* Effect.either(
          service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        )

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should return a PhysicsBodyId when adding a box body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 10, z: 0 },
          shape: 'box',
          shapeParams: { halfExtents: { x: 0.3, y: 0.9, z: 0.3 } },
        })

        expect(typeof bodyId).toBe('string')
        expect(bodyId).toContain('physics-body-')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should return a PhysicsBodyId when adding a plane body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const groundId = yield* service.addBody({
          mass: 0,
          position: { x: 0, y: 0, z: 0 },
          shape: 'plane',
          type: 'static',
        })

        expect(typeof groundId).toBe('string')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should return distinct IDs for multiple bodies', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const id1 = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        const id2 = yield* service.addBody({ mass: 70, position: { x: 5, y: 10, z: 5 }, shape: 'box' })

        expect(id1).not.toBe(id2)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('removeBody', () => {
    it('should remove a body by ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })

        yield* service.removeBody(bodyId)

        // After removal, getVelocity should fail
        const result = yield* Effect.either(service.getVelocity(bodyId))
        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Step simulation', () => {
    it('should step the simulation without error', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        yield* service.step(1 / 60)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should simulate falling body (position decreases over time)', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 10, z: 0 },
          shape: 'box',
        })

        const initialPos = yield* service.getPosition(bodyId)
        const initialY = initialPos.y

        // Step simulation multiple times
        for (let i = 0; i < 60; i++) {
          yield* service.step(1 / 60)
        }

        const finalPos = yield* service.getPosition(bodyId)

        // Body should have fallen due to gravity
        expect(finalPos.y).toBeLessThan(initialY)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Velocity operations', () => {
    it('should set and get velocity on a body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })

        yield* service.setVelocity(bodyId, { x: 5, y: 2, z: -3 })

        const vel = yield* service.getVelocity(bodyId)
        expect(vel.x).toBe(5)
        expect(vel.y).toBe(2)
        expect(vel.z).toBe(-3)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should fail to set velocity on unknown body ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        // Use a valid-looking but unregistered body ID
        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.setVelocity(fakeId, { x: 5, y: 2, z: -3 }))

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should fail to get velocity on unknown body ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.getVelocity(fakeId))

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Position operations', () => {
    it('should get position of a body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 1, y: 10, z: 3 },
          shape: 'box',
        })

        const pos = yield* service.getPosition(bodyId)
        expect(pos.x).toBe(1)
        expect(pos.y).toBe(10)
        expect(pos.z).toBe(3)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should set position of a body', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 10, z: 0 },
          shape: 'box',
        })

        yield* service.setPosition(bodyId, { x: 5, y: 20, z: -3 })
        const pos = yield* service.getPosition(bodyId)

        expect(pos.x).toBe(5)
        expect(pos.y).toBe(20)
        expect(pos.z).toBe(-3)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Grounded state', () => {
    it('should initially not be grounded (body in air)', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })

        const grounded = yield* service.isGrounded(bodyId)

        expect(grounded).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should fail isGrounded for unknown body ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.isGrounded(fakeId))

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should detect ground when player lands on ground plane', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        // Create ground plane
        yield* service.addBody({
          mass: 0,
          position: { x: 0, y: 0, z: 0 },
          shape: 'plane',
          type: 'static',
        })

        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 5, z: 0 },
          shape: 'box',
          shapeParams: { halfExtents: { x: 0.3, y: 0.9, z: 0.3 } },
          fixedRotation: true,
          angularDamping: 1,
          allowSleep: false,
        })

        // Player should not be grounded initially (5 units above ground)
        const initialGrounded = yield* service.isGrounded(bodyId)
        expect(initialGrounded).toBe(false)

        // Simulate falling until player hits ground
        for (let i = 0; i < 300; i++) {
          yield* service.step(1 / 60)
        }

        // After falling, player should be grounded
        const finalGrounded = yield* service.isGrounded(bodyId)
        expect(finalGrounded).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should not be grounded when player jumps (velocity applied upward)', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        // Create ground plane
        yield* service.addBody({
          mass: 0,
          position: { x: 0, y: 0, z: 0 },
          shape: 'plane',
          type: 'static',
        })

        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 5, z: 0 },
          shape: 'box',
          shapeParams: { halfExtents: { x: 0.3, y: 0.9, z: 0.3 } },
          fixedRotation: true,
          angularDamping: 1,
          allowSleep: false,
        })

        // Let player fall to ground
        for (let i = 0; i < 300; i++) {
          yield* service.step(1 / 60)
        }

        // Player should be on ground
        const beforeJumpGrounded = yield* service.isGrounded(bodyId)
        expect(beforeJumpGrounded).toBe(true)

        // Apply jump velocity
        yield* service.setVelocity(bodyId, { x: 0, y: 7, z: 0 })

        // Step multiple times to let player rise above ground detection range
        for (let i = 0; i < 5; i++) {
          yield* service.step(1 / 60)
        }

        // Player should no longer be grounded after jumping
        const afterJumpGrounded = yield* service.isGrounded(bodyId)
        expect(afterJumpGrounded).toBe(false)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should properly detect grounded state after landing (full jump cycle)', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        // Create ground plane
        yield* service.addBody({
          mass: 0,
          position: { x: 0, y: 0, z: 0 },
          shape: 'plane',
          type: 'static',
        })

        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 5, z: 0 },
          shape: 'box',
          shapeParams: { halfExtents: { x: 0.3, y: 0.9, z: 0.3 } },
          fixedRotation: true,
          angularDamping: 1,
          allowSleep: false,
        })

        // Fall and land
        for (let i = 0; i < 500; i++) {
          yield* service.step(1 / 60)
        }

        const isGroundedAfterLanding = yield* service.isGrounded(bodyId)

        // Jump
        yield* service.setVelocity(bodyId, { x: 0, y: 7, z: 0 })
        for (let i = 0; i < 10; i++) {
          yield* service.step(1 / 60)
        }

        // In air
        expect(yield* service.isGrounded(bodyId)).toBe(false)

        // Fall back down
        for (let i = 0; i < 500; i++) {
          yield* service.step(1 / 60)
        }

        // Landed again
        expect(yield* service.isGrounded(bodyId)).toBe(true)

        // Also verify the first landing was successful
        expect(isGroundedAfterLanding).toBe(true)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('groundCollisions stream', () => {
    it('should return a stream for a body ID', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })

        const stream = service.groundCollisions(bodyId)
        expect(stream).toBeDefined()

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })

  describe('Physics constants', () => {
    it('should have correct ground detection constants', () => {
      expect(GROUND_DETECTION_DISTANCE).toBe(0.15)
      expect(PLAYER_FEET_OFFSET).toBe(0.9)
    })
  })

  describe('raycast', () => {
    it('should have raycast method', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        expect(typeof service.raycast).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should fail to raycast before initialization', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = yield* Effect.either(
          service.raycast({ x: 0, y: 10, z: 0 }, { x: 0, y: 0, z: 0 })
        )

        expect(result._tag).toBe('Left')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return empty array when raycast hits nothing', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        // Raycast in empty world
        const hits = yield* service.raycast(
          { x: 0, y: 10, z: 0 },
          { x: 0, y: 5, z: 0 }
        )

        expect(hits).toHaveLength(0)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Effect composition', () => {
    it('should support Effect.flatMap for chaining operations', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = service
          .initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
          .pipe(
            Effect.flatMap(() => service.step(1 / 60)),
            Effect.map(() => ({ success: true }))
          )

        expect(typeof result.pipe).toBe('function')

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })

    it('should chain addBody and getVelocity via PhysicsBodyId', () => {
      const program = Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        yield* service.setVelocity(bodyId, { x: 1, y: 2, z: 3 })
        const vel = yield* service.getVelocity(bodyId)

        expect(vel.x).toBe(1)
        expect(vel.y).toBe(2)
        expect(vel.z).toBe(3)

        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)

      expect(result.success).toBe(true)
    })
  })
})
