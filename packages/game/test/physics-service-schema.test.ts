import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, Schema } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import {
  PhysicsService,
  AddBodyConfigSchema,
} from '@ts-minecraft/game'
import { PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer } from '@ts-minecraft/game'

const TestLayer = PhysicsService.Default.pipe(
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

    it('should decode config with optional type field', () => {
      const result = Schema.decodeSync(AddBodyConfigSchema)({
        mass: 0,
        position: { x: 0, y: 0, z: 0 },
        shape: 'plane',
        type: 'static',
      })
      expect(result.type).toBe('static')
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

  describe('error handling via Effect.catchTag', () => {
    it.effect('getVelocity on unknown body ID fails with PhysicsServiceError catchable by tag', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@ts-minecraft/core').PhysicsBodyIdSchema.make>
        const caught = yield* service.getVelocity(unknownId).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e._tag))
        )
        expect(caught).toBe('PhysicsServiceError')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('setVelocity on unknown body ID is catchable via Effect.catchTag', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@ts-minecraft/core').PhysicsBodyIdSchema.make>
        const caught = yield* service.setVelocity(unknownId, { x: 1, y: 0, z: 0 }).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e._tag))
        )
        expect(caught).toBe('PhysicsServiceError')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('getPosition on unknown body ID is catchable via Effect.catchTag', () =>
      Effect.gen(function* () {
        const service = yield* initializedService
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@ts-minecraft/core').PhysicsBodyIdSchema.make>
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
        const service = yield* initializedService
        const unknownId = 'physics-body-nonexistent' as ReturnType<typeof import('@ts-minecraft/core').PhysicsBodyIdSchema.make>
        const errorMsg = yield* service.getVelocity(unknownId).pipe(
          Effect.catchTag('PhysicsServiceError', (e) => Effect.succeed(e.message as string))
        )
        expect(typeof errorMsg).toBe('string')
        expect((errorMsg as string).length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
