import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import * as CANNON from 'cannon-es'
import {
  RigidBodyService,
  RigidBodyServiceLive,
  RigidBodyConfigSchema,
  type RigidBodyConfig,
} from './body-service'
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
    it('should expose all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* RigidBodyService
        expect(typeof service.create).toBe('function')
        expect(typeof service.setPosition).toBe('function')
        expect(typeof service.setQuaternion).toBe('function')
        expect(typeof service.setVelocity).toBe('function')
        expect(typeof service.setAngularVelocity).toBe('function')
        expect(typeof service.addShape).toBe('function')
        expect(typeof service.updateMassProperties).toBe('function')
        return { success: true }
      }).pipe(Effect.provide(RigidBodyServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should create a CANNON.Body with correct mass', () => {
      const program = Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        return { mass: body.mass }
      }).pipe(Effect.provide(RigidBodyServiceLive))

      const { mass } = Effect.runSync(program)
      expect(mass).toBe(1)
    })

    it('should create a static body when type=static', () => {
      const program = Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create({ ...defaultConfig, type: 'static' })
        return { type: body.type }
      }).pipe(Effect.provide(RigidBodyServiceLive))

      const { type } = Effect.runSync(program)
      expect(type).toBe(CANNON.Body.STATIC)
    })

    it('should create a kinematic body when type=kinematic', () => {
      const program = Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create({ ...defaultConfig, type: 'kinematic' })
        return { type: body.type }
      }).pipe(Effect.provide(RigidBodyServiceLive))

      const { type } = Effect.runSync(program)
      expect(type).toBe(CANNON.Body.KINEMATIC)
    })

    it('should set position on an existing body', () => {
      const program = Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.setPosition(body, { x: 5, y: 10, z: 15 })
        return { pos: { x: body.position.x, y: body.position.y, z: body.position.z } }
      }).pipe(Effect.provide(RigidBodyServiceLive))

      const { pos } = Effect.runSync(program)
      expect(pos.x).toBe(5)
      expect(pos.y).toBe(10)
      expect(pos.z).toBe(15)
    })

    it('should set velocity on an existing body', () => {
      const program = Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.setVelocity(body, { x: 1, y: 2, z: 3 })
        return { vel: { x: body.velocity.x, y: body.velocity.y, z: body.velocity.z } }
      }).pipe(Effect.provide(RigidBodyServiceLive))

      const { vel } = Effect.runSync(program)
      expect(vel.x).toBe(1)
      expect(vel.y).toBe(2)
      expect(vel.z).toBe(3)
    })

    it('should add a shape to a body', () => {
      const program = Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
        yield* service.addShape(body, shape)
        return { shapeCount: body.shapes.length }
      }).pipe(Effect.provide(RigidBodyServiceLive))

      const { shapeCount } = Effect.runSync(program)
      expect(shapeCount).toBe(1)
    })

    it('should update mass properties without error', () => {
      const program = Effect.gen(function* () {
        const service = yield* RigidBodyService
        const body = yield* service.create(defaultConfig)
        yield* service.updateMassProperties(body)
        return { success: true }
      }).pipe(Effect.provide(RigidBodyServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
