import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import * as CANNON from 'cannon-es'
import {
  RigidBodyService,
  RigidBodyServiceLive,
  RigidBodyConfigSchema,
  type RigidBodyConfig,
} from './rigid-body-service'
import { Schema } from 'effect'

describe('cannon/boundary/body-service', () => {
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

    it.effect('should create a CANNON.Body with correct mass', () =>
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
        expect(body.type).toBe(CANNON.Body.STATIC)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should create a kinematic body when type=kinematic', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create({ ...defaultConfig, type: 'kinematic' })
        expect(body.type).toBe(CANNON.Body.KINEMATIC)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should set position on an existing body', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.setPosition(body, { x: 5, y: 10, z: 15 })
        expect(body.position.x).toBe(5)
        expect(body.position.y).toBe(10)
        expect(body.position.z).toBe(15)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should set velocity on an existing body', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.setVelocity(body, { x: 1, y: 2, z: 3 })
        expect(body.velocity.x).toBe(1)
        expect(body.velocity.y).toBe(2)
        expect(body.velocity.z).toBe(3)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should add a shape to a body', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
        yield* service.addShape(body, shape)
        expect(body.shapes.length).toBe(1)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )

    it.effect('should update mass properties without error', () =>
      Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.updateMassProperties(body)
      }).pipe(Effect.provide(RigidBodyServiceLive))
    )
  })
})
