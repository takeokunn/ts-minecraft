import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, Layer, Option, Schema } from 'effect'
import { DeltaTimeSecs } from '@/shared/kernel'
import {
  PhysicsService,
  PhysicsServiceLive,
  PhysicsServiceError,
  AddBodyConfigSchema,
  GROUND_DETECTION_DISTANCE,
  PLAYER_FEET_OFFSET,
} from './physics-service'
import { PhysicsWorldServiceLive } from '../../infrastructure/physics/boundary/physics-world-service'
import { RigidBodyServiceLive } from '../../infrastructure/physics/boundary/rigid-body-service'
import { ShapeServiceLive } from '../../infrastructure/physics/boundary/shape-service'

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

    it.effect('should have all required methods', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        expect(typeof service.initialize).toBe('function')
        expect(typeof service.addBody).toBe('function')
        expect(typeof service.removeBody).toBe('function')
        expect(typeof service.step).toBe('function')
        expect(typeof service.isGrounded).toBe('function')
        expect(typeof service.getVelocity).toBe('function')
        expect(typeof service.getPosition).toBe('function')
        expect(typeof service.setVelocity).toBe('function')
        expect(typeof service.setPosition).toBe('function')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('World initialization', () => {
    it.effect('should initialize physics world with default gravity', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        // Verify initialization succeeded by stepping without error
        yield* service.step(DeltaTimeSecs.make(0.016))
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail to step before initialization', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = yield* Effect.either(service.step(DeltaTimeSecs.make(0.016)))

        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(PhysicsServiceError)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should idempotently initialize (calling twice is safe)', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        // Second call should be a no-op
        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        yield* service.step(DeltaTimeSecs.make(0.016))
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('addBody', () => {
    it.effect('should fail to add body before initialization', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = yield* Effect.either(
          service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        )

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return a PhysicsBodyId when adding a box body', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return a PhysicsBodyId when adding a plane body', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const groundId = yield* service.addBody({
          mass: 0,
          position: { x: 0, y: 0, z: 0 },
          shape: 'plane',
          type: 'static',
        })

        expect(typeof groundId).toBe('string')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return distinct IDs for multiple bodies', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const id1 = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        const id2 = yield* service.addBody({ mass: 70, position: { x: 5, y: 10, z: 5 }, shape: 'box' })

        expect(id1).not.toBe(id2)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('removeBody', () => {
    it.effect('should remove a body by ID', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })

        yield* service.removeBody(bodyId)

        // After removal, getVelocity should fail
        const result = yield* Effect.either(service.getVelocity(bodyId))
        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail to remove the same body twice (handlerMap cleanup)', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })

        yield* service.removeBody(bodyId)

        // Second removal should fail — body is no longer registered in bodyMap
        const result = yield* Effect.either(service.removeBody(bodyId))
        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Step simulation', () => {
    it.effect('should step the simulation without error', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        yield* service.step(DeltaTimeSecs.make(1 / 60))
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should simulate falling body (position decreases over time)', () =>
      Effect.gen(function* () {
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
        yield* Effect.forEach(Arr.makeBy(60, i => i), _ => service.step(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const finalPos = yield* service.getPosition(bodyId)

        // Body should have fallen due to gravity
        expect(finalPos.y).toBeLessThan(initialY)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should clamp body position to minY when below threshold', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 10, z: 0 },
          shape: 'box',
          shapeParams: { halfExtents: { x: 0.3, y: 0.9, z: 0.3 } },
        })

        // Teleport body far below the minY threshold
        yield* service.setPosition(bodyId, { x: 0, y: -5, z: 0 })

        // Step with minY = 1.0; body at y=-5 is below minY, so it should be clamped to 1.0
        yield* service.step(DeltaTimeSecs.make(1 / 60), { minY: 1.0 })

        const pos = yield* service.getPosition(bodyId)
        expect(pos.y).toBeGreaterThanOrEqual(1.0)

        // Velocity y should also be zeroed (since body was below minY)
        const vel = yield* service.getVelocity(bodyId)
        expect(vel.y).toBeGreaterThanOrEqual(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Velocity operations', () => {
    it.effect('should set and get velocity on a body', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })

        yield* service.setVelocity(bodyId, { x: 5, y: 2, z: -3 })

        const vel = yield* service.getVelocity(bodyId)
        expect(vel.x).toBe(5)
        expect(vel.y).toBe(2)
        expect(vel.z).toBe(-3)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail to set velocity on unknown body ID', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        // Use a valid-looking but unregistered body ID
        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.setVelocity(fakeId, { x: 5, y: 2, z: -3 }))

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail to get velocity on unknown body ID', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.getVelocity(fakeId))

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Position operations', () => {
    it.effect('should get position of a body', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should set position of a body', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Grounded state', () => {
    it.effect('should initially not be grounded (body in air)', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })

        const grounded = yield* service.isGrounded(bodyId)

        expect(grounded).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail isGrounded for unknown body ID', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.isGrounded(fakeId))

        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should detect ground when player lands on ground plane', () =>
      Effect.gen(function* () {
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
        yield* Effect.forEach(Arr.makeBy(300, i => i), _ => service.step(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        // After falling, player should be grounded
        const finalGrounded = yield* service.isGrounded(bodyId)
        expect(finalGrounded).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should not be grounded when player jumps (velocity applied upward)', () =>
      Effect.gen(function* () {
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
        yield* Effect.forEach(Arr.makeBy(300, i => i), _ => service.step(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        // Player should be on ground
        const beforeJumpGrounded = yield* service.isGrounded(bodyId)
        expect(beforeJumpGrounded).toBe(true)

        // Apply jump velocity
        yield* service.setVelocity(bodyId, { x: 0, y: 7, z: 0 })

        // Step multiple times to let player rise above ground detection range
        yield* Effect.forEach(Arr.makeBy(5, i => i), _ => service.step(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        // Player should no longer be grounded after jumping
        const afterJumpGrounded = yield* service.isGrounded(bodyId)
        expect(afterJumpGrounded).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should properly detect grounded state after landing (full jump cycle)', () =>
      Effect.gen(function* () {
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
        yield* Effect.forEach(Arr.makeBy(500, i => i), _ => service.step(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const isGroundedAfterLanding = yield* service.isGrounded(bodyId)

        // Jump
        yield* service.setVelocity(bodyId, { x: 0, y: 7, z: 0 })
        yield* Effect.forEach(Arr.makeBy(10, i => i), _ => service.step(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        // In air
        expect(yield* service.isGrounded(bodyId)).toBe(false)

        // Fall back down
        yield* Effect.forEach(Arr.makeBy(500, i => i), _ => service.step(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        // Landed again
        expect(yield* service.isGrounded(bodyId)).toBe(true)

        // Also verify the first landing was successful
        expect(isGroundedAfterLanding).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )
  })


  describe('Physics constants', () => {
    it('should have correct ground detection constants', () => {
      expect(GROUND_DETECTION_DISTANCE).toBe(0.15)
      expect(PLAYER_FEET_OFFSET).toBe(0.9)
    })
  })

  describe('Effect composition', () => {
    it.effect('should support Effect.flatMap for chaining operations', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        const result = service
          .initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
          .pipe(
            Effect.flatMap(() => service.step(DeltaTimeSecs.make(1 / 60))),
            Effect.map(() => ({ success: true }))
          )

        expect(typeof result.pipe).toBe('function')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should chain addBody and getVelocity via PhysicsBodyId', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService

        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })

        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        yield* service.setVelocity(bodyId, { x: 1, y: 2, z: 3 })
        const vel = yield* service.getVelocity(bodyId)

        expect(vel.x).toBe(1)
        expect(vel.y).toBe(2)
        expect(vel.z).toBe(3)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('AddBodyConfigSchema', () => {
    it('should decode a valid box body config', () => {
      const result = Schema.decodeSync(AddBodyConfigSchema)({
        mass: 70,
        position: { x: 0, y: 10, z: 0 },
        shape: 'box',
      })
      expect(result.mass).toBe(70)
      expect(result.shape).toBe('box')
    })

    it('should decode config with all optional fields', () => {
      const result = Schema.decodeSync(AddBodyConfigSchema)({
        mass: 0,
        position: { x: 0, y: 0, z: 0 },
        shape: 'plane',
        type: 'static',
        fixedRotation: true,
        angularDamping: 0.9,
        allowSleep: false,
      })
      expect(result.type).toBe('static')
      expect(result.fixedRotation).toBe(true)
    })

    it('should reject invalid shape literal', () => {
      expect(() =>
        Schema.decodeUnknownSync(AddBodyConfigSchema)({
          mass: 70,
          position: { x: 0, y: 0, z: 0 },
          shape: 'cylinder',
        })
      ).toThrow()
    })

    it('should reject invalid body type literal', () => {
      expect(() =>
        Schema.decodeUnknownSync(AddBodyConfigSchema)({
          mass: 70,
          position: { x: 0, y: 0, z: 0 },
          shape: 'box',
          type: 'invalid',
        })
      ).toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // B5: Error handling via Effect.catchTag
  // ---------------------------------------------------------------------------

  describe('error handling via Effect.catchTag', () => {
    it.effect('getVelocity on unknown body ID fails with PhysicsServiceError catchable by tag', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const caught = yield* service.getVelocity(unknownId).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e._tag))
        )
        expect(caught).toBe('PhysicsServiceError')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('setVelocity on unknown body ID is catchable via Effect.catchTag', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const caught = yield* service.setVelocity(unknownId, { x: 1, y: 0, z: 0 }).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e._tag))
        )
        expect(caught).toBe('PhysicsServiceError')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('getPosition on unknown body ID is catchable via Effect.catchTag', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const caught = yield* service.getPosition(unknownId).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e._tag))
        )
        expect(caught).toBe('PhysicsServiceError')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('step before initialize fails with PhysicsServiceError catchable by tag', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        const caught = yield* service.step(DeltaTimeSecs.make(0.016)).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e._tag))
        )
        expect(caught).toBe('PhysicsServiceError')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('caught PhysicsServiceError has a non-empty message string', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const errorMsg = yield* service.getVelocity(unknownId).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e.message as string))
        )
        expect(typeof errorMsg).toBe('string')
        expect((errorMsg as string).length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('isGrounded on unknown body ID is catchable via Effect.catchTag', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 }, broadphase: 'naive' })
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@/shared/kernel').PhysicsBodyIdSchema.make>
        const caught = yield* service.isGrounded(unknownId).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e._tag))
        )
        expect(caught).toBe('PhysicsServiceError')
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
