import { describe, it } from '@effect/vitest'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/game'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import {
  PhysicsService,
  PhysicsServiceError,
  PhysicsServiceLive,
} from '@ts-minecraft/game'
import { Array as Arr, Effect, Either, Layer, Option } from 'effect'
import { expect } from 'vitest'

const TestLayer = PhysicsServiceLive.pipe(
  Layer.provide(PhysicsWorldPortLayer),
  Layer.provide(RigidBodyPortLayer),
  Layer.provide(ShapePortLayer)
)

const DEFAULT_GRAVITY = { x: 0, y: -9.82, z: 0 }

const initializedService = Effect.gen(function* () {
  const service = yield* PhysicsService
  yield* service.initialize({ gravity: DEFAULT_GRAVITY })
  return service
})

describe('application/physics/physics-service', () => {
  describe('PhysicsServiceError', () => {
    it('message contains operation name when no cause', () => {
      const err = new PhysicsServiceError({ operation: 'testOp' })
      expect(err.message).toContain('testOp')
    })

    it('message includes cause string when cause is provided', () => {
      const err = new PhysicsServiceError({ operation: 'testOp', cause: new Error('inner error') })
      expect(err.message).toContain('testOp')
      expect(err.message).toContain('inner error')
    })
  })

  describe('PhysicsServiceLive', () => {
    it('should provide PhysicsService as Layer', () => {
      expect(PhysicsServiceLive).toBeDefined()
      expect(typeof PhysicsServiceLive).toBe('object')
    })
  })

  describe('World initialization', () => {
    it.effect('should initialize physics world with gravity', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        yield* service.initialize({ gravity: DEFAULT_GRAVITY })
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
        yield* service.initialize({ gravity: DEFAULT_GRAVITY })
        yield* service.initialize({ gravity: DEFAULT_GRAVITY })
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
        const service = yield* initializedService
        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 10, z: 0 },
          shape: 'box',
          shapeParams: { halfExtents: { x: 0.3, y: 0.9, z: 0.3 } },
        })
        expect(typeof bodyId).toBe('string')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return a PhysicsBodyId when adding a sphere body', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({
          mass: 5,
          position: { x: 2, y: 8, z: -1 },
          shape: 'sphere',
          shapeParams: { radius: 0.5 },
        })
        expect(typeof bodyId).toBe('string')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return a PhysicsBodyId when adding a plane body', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
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
        const service = yield* initializedService
        const id1 = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        const id2 = yield* service.addBody({ mass: 70, position: { x: 5, y: 10, z: 5 }, shape: 'box' })
        expect(id1).not.toBe(id2)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should use default halfExtents when box shapeParams is omitted', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        expect(typeof bodyId).toBe('string')
        yield* service.step(DeltaTimeSecs.make(1 / 60))
        const pos = yield* service.getPosition(bodyId)
        expect(pos.y).toBeLessThan(10)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should use default radius when sphere shapeParams is omitted', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({ mass: 5, position: { x: 0, y: 10, z: 0 }, shape: 'sphere' })
        expect(typeof bodyId).toBe('string')
        yield* service.step(DeltaTimeSecs.make(1 / 60))
        const pos = yield* service.getPosition(bodyId)
        expect(pos.y).toBeLessThan(10)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('removeBody', () => {
    it.effect('should remove a body by ID', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        yield* service.removeBody(bodyId)
        const result = yield* Effect.either(service.getVelocity(bodyId))
        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail to remove the same body twice', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        yield* service.removeBody(bodyId)
        const result = yield* Effect.either(service.removeBody(bodyId))
        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail to remove a body before initialization', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        const fakeId = 'physics-body-0' as ReturnType<typeof import('@ts-minecraft/core').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.removeBody(fakeId))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(PhysicsServiceError)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Step simulation', () => {
    it.effect('should step without error', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        yield* service.step(DeltaTimeSecs.make(1 / 60))
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should simulate falling body (position decreases over time)', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        const initialPos = yield* service.getPosition(bodyId)

        yield* Effect.forEach(Arr.makeBy(60, (i) => i), (_) => service.step(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const finalPos = yield* service.getPosition(bodyId)
        expect(finalPos.y).toBeLessThan(initialPos.y)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Velocity operations', () => {
    it.effect('should set and get velocity on a body', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
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
        const service = yield* initializedService
        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@ts-minecraft/core').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.setVelocity(fakeId, { x: 5, y: 2, z: -3 }))
        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail to get velocity on unknown body ID', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@ts-minecraft/core').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.getVelocity(fakeId))
        expect(Either.isLeft(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Position operations', () => {
    it.effect('should get position of a body', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 1, y: 10, z: 3 }, shape: 'box' })
        const pos = yield* service.getPosition(bodyId)
        expect(pos.x).toBe(1)
        expect(pos.y).toBe(10)
        expect(pos.z).toBe(3)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should set position of a body', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        yield* service.setPosition(bodyId, { x: 5, y: 20, z: -3 })
        const pos = yield* service.getPosition(bodyId)
        expect(pos.x).toBe(5)
        expect(pos.y).toBe(20)
        expect(pos.z).toBe(-3)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail to set position on unknown body ID', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const fakeId = 'physics-body-99999' as ReturnType<typeof import('@ts-minecraft/core').PhysicsBodyIdSchema.make>
        const result = yield* Effect.either(service.setPosition(fakeId, { x: 5, y: 20, z: -3 }))
        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))).toBeInstanceOf(PhysicsServiceError)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Effect composition', () => {
    it.effect('should chain initialize and step without error', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        const outcome = yield* service
          .initialize({ gravity: DEFAULT_GRAVITY })
          .pipe(
            Effect.flatMap(() => service.step(DeltaTimeSecs.make(1 / 60))),
            Effect.map(() => 'success' as const)
          )
        expect(outcome).toBe('success')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should chain addBody and getVelocity via PhysicsBodyId', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const bodyId = yield* service.addBody({ mass: 70, position: { x: 0, y: 10, z: 0 }, shape: 'box' })
        yield* service.setVelocity(bodyId, { x: 1, y: 2, z: 3 })
        const vel = yield* service.getVelocity(bodyId)
        expect(vel.x).toBe(1)
        expect(vel.y).toBe(2)
        expect(vel.z).toBe(3)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
