import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Schema } from 'effect'
import { RigidBodyService } from '../infrastructure/boundary/rigid-body-service'
import { RigidBodyConfigSchema, type RigidBodyConfig } from '../domain/physics-body'

const defaultConfig: RigidBodyConfig = {
  mass: 1,
  position: { x: 0, y: 0, z: 0 },
}

describe('physics/boundary/rigid-body-service', () => {
  describe('RigidBodyConfigSchema', () => {
    it('should accept valid config', () => {
      const result = Schema.decodeUnknownSync(RigidBodyConfigSchema)(defaultConfig)
      expect(result.mass).toBe(1)
      expect(result.position).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('should accept optional type field', () => {
      const config = { ...defaultConfig, type: 'static' as const }
      const result = Schema.decodeUnknownSync(RigidBodyConfigSchema)(config)
      expect(result.type).toBe('static')
    })

    it('should accept kinematic type', () => {
      const config = { ...defaultConfig, type: 'kinematic' as const }
      const result = Schema.decodeUnknownSync(RigidBodyConfigSchema)(config)
      expect(result.type).toBe('kinematic')
    })
  })

  describe('RigidBodyService.Default', () => {
    it.effect('should expose create, setPosition, setVelocity, addShape methods', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        expect(typeof service.create).toBe('function')
        expect(typeof service.setPosition).toBe('function')
        expect(typeof service.setVelocity).toBe('function')
        expect(typeof service.addShape).toBe('function')
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should create a body with correct mass', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        expect(body.mass).toBe(1)
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should default to dynamic type when type is not specified', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        expect(body.type).toBe('dynamic')
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should create a static body when type=static', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create({ ...defaultConfig, type: 'static' })
        expect(body.type).toBe('static')
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should create a kinematic body when type=kinematic', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create({ ...defaultConfig, type: 'kinematic' })
        expect(body.type).toBe('kinematic')
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should create a body with zero initial velocity', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        expect(body.velocity.x).toBe(0)
        expect(body.velocity.y).toBe(0)
        expect(body.velocity.z).toBe(0)
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should set position on a body', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.setPosition(body, { x: 5, y: 10, z: 15 })
        expect(body.position.x).toBe(5)
        expect(body.position.y).toBe(10)
        expect(body.position.z).toBe(15)
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should set velocity on a body', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.setVelocity(body, { x: 1, y: 2, z: 3 })
        expect(body.velocity.x).toBe(1)
        expect(body.velocity.y).toBe(2)
        expect(body.velocity.z).toBe(3)
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should add a shape to a body (replaces placeholder)', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        const newShape = { kind: 'box' as const, halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }
        yield* service.addShape(body, newShape)
        expect(body.shape).toEqual(newShape)
      }).pipe(Effect.provide(RigidBodyService.Default))
    )

    it.effect('should add a sphere shape to a body', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        const sphere = { kind: 'sphere' as const, radius: 1.5 }
        yield* service.addShape(body, sphere)
        expect(body.shape).toEqual(sphere)
      }).pipe(Effect.provide(RigidBodyService.Default))
    )
  })
})
