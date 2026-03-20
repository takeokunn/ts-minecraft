import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { Schema } from 'effect'
import {
  ShapeService,
  ShapeServiceLive,
  BoxShapeConfigSchema,
  SphereShapeConfigSchema,
} from './shape-service'

describe('physics/boundary/shape-service', () => {
  describe('Schema validation', () => {
    it('BoxShapeConfigSchema accepts valid config', () => {
      const result = Schema.decodeUnknownSync(BoxShapeConfigSchema)({
        halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
      })
      expect(result.halfExtents).toEqual({ x: 0.5, y: 0.5, z: 0.5 })
    })

    it('SphereShapeConfigSchema accepts valid config', () => {
      const result = Schema.decodeUnknownSync(SphereShapeConfigSchema)({ radius: 1.0 })
      expect(result.radius).toBe(1.0)
    })
  })

  describe('ShapeServiceLive', () => {
    it.effect('should expose all required methods', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        expect(typeof service.createBox).toBe('function')
        expect(typeof service.createSphere).toBe('function')
        expect(typeof service.createPlane).toBe('function')
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('createBox should create a descriptor with correct half extents', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const box = yield* service.createBox({ halfExtents: { x: 1, y: 2, z: 3 } })
        expect(box.kind).toBe('box')
        if (box.kind === 'box') {
          expect(box.halfExtents.x).toBe(1)
          expect(box.halfExtents.y).toBe(2)
          expect(box.halfExtents.z).toBe(3)
        }
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('createSphere should create a descriptor with correct radius', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const sphere = yield* service.createSphere({ radius: 2.5 })
        expect(sphere.kind).toBe('sphere')
        if (sphere.kind === 'sphere') {
          expect(sphere.radius).toBe(2.5)
        }
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('createPlane should create a plane descriptor', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const plane = yield* service.createPlane()
        expect(plane.kind).toBe('plane')
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('should support Effect.flatMap chaining for createBox and createSphere', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const box = yield* service.createBox({ halfExtents: { x: 0.5, y: 0.5, z: 0.5 } })
        const sphere = yield* service.createSphere({ radius: 1 })
        expect(box.kind).toBe('box')
        expect(sphere.kind).toBe('sphere')
      }).pipe(Effect.provide(ShapeServiceLive))
    )
  })
})
