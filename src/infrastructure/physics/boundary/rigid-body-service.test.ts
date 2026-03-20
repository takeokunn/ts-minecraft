import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Schema } from 'effect'
import {
  RigidBodyService,
  RigidBodyServiceLive,
  RigidBodyConfigSchema,
  type RigidBodyConfig,
} from './rigid-body-service'

describe('physics/boundary/rigid-body-service', () => {
  const defaultConfig: RigidBodyConfig = {
    mass: 1,
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  }

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

  describe('RigidBodyServiceLive', () => {
    it.effect('should expose all required methods', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        expect(typeof service.create).toBe('function')
        expect(typeof service.setPosition).toBe('function')
        expect(typeof service.setQuaternion).toBe('function')
        expect(typeof service.setVelocity).toBe('function')
        expect(typeof service.setAngularVelocity).toBe('function')
        expect(typeof service.addShape).toBe('function')
        expect(typeof service.updateMassProperties).toBe('function')
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should create a body with correct mass', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        expect(body.mass).toBe(1)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should create a static body when type=static', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create({ ...defaultConfig, type: 'static' })
        expect(body.type).toBe('static')
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should create a kinematic body when type=kinematic', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create({ ...defaultConfig, type: 'kinematic' })
        expect(body.type).toBe('kinematic')
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should set position on a body', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.setPosition(body, { x: 5, y: 10, z: 15 })
        expect(body.position.x).toBe(5)
        expect(body.position.y).toBe(10)
        expect(body.position.z).toBe(15)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should set velocity on a body', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.setVelocity(body, { x: 1, y: 2, z: 3 })
        expect(body.velocity.x).toBe(1)
        expect(body.velocity.y).toBe(2)
        expect(body.velocity.z).toBe(3)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should add a shape to a body (replaces placeholder)', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        const newShape = { kind: 'box' as const, halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }
        yield* service.addShape(body, newShape)
        expect(body.shape).toEqual(newShape)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('updateMassProperties should complete without error', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.updateMassProperties(body)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )
  })
})
