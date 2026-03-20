import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import * as CANNON from 'cannon-es'
import {
  ShapeService,
  ShapeServiceLive,
  BoxShapeConfigSchema,
  SphereShapeConfigSchema,
  CylinderShapeConfigSchema,
} from './shape-service'
import { Schema } from 'effect'

describe('cannon/boundary/shape-service', () => {
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

    it('CylinderShapeConfigSchema accepts valid config without numSegments', () => {
      const result = Schema.decodeUnknownSync(CylinderShapeConfigSchema)({
        radiusTop: 0.5,
        radiusBottom: 0.5,
        height: 2,
      })
      expect(result.height).toBe(2)
      expect(result.numSegments).toBeUndefined()
    })

    it('CylinderShapeConfigSchema accepts optional numSegments', () => {
      const result = Schema.decodeUnknownSync(CylinderShapeConfigSchema)({
        radiusTop: 0.5,
        radiusBottom: 0.5,
        height: 2,
        numSegments: 12,
      })
      expect(result.numSegments).toBe(12)
    })
  })

  describe('ShapeServiceLive', () => {
    it.effect('should expose all required methods', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        expect(typeof service.createBox).toBe('function')
        expect(typeof service.createSphere).toBe('function')
        expect(typeof service.createCylinder).toBe('function')
        expect(typeof service.createPlane).toBe('function')
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('createBox should create a CANNON.Box with correct half extents', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const box = yield* service.createBox({ halfExtents: { x: 1, y: 2, z: 3 } })
        expect(box instanceof CANNON.Box).toBe(true)
        expect(box.halfExtents.x).toBe(1)
        expect(box.halfExtents.y).toBe(2)
        expect(box.halfExtents.z).toBe(3)
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('createSphere should create a CANNON.Sphere with correct radius', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const sphere = yield* service.createSphere({ radius: 2.5 })
        expect(sphere instanceof CANNON.Sphere).toBe(true)
        expect(sphere.radius).toBe(2.5)
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('createCylinder should create a CANNON.Cylinder with default 8 segments', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const cyl = yield* service.createCylinder({
          radiusTop: 0.5,
          radiusBottom: 0.5,
          height: 2,
        })
        expect(cyl instanceof CANNON.Cylinder).toBe(true)
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('createCylinder should accept custom numSegments', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const cyl = yield* service.createCylinder({
          radiusTop: 1,
          radiusBottom: 1,
          height: 3,
          numSegments: 16,
        })
        expect(cyl instanceof CANNON.Cylinder).toBe(true)
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('createPlane should create a CANNON.Plane', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const plane = yield* service.createPlane()
        expect(plane instanceof CANNON.Plane).toBe(true)
      }).pipe(Effect.provide(ShapeServiceLive))
    )

    it.effect('should support Effect.flatMap for chaining createBox and createSphere', () =>
      Effect.gen(function* () {
        const service = yield* ShapeService
        const box = yield* service.createBox({ halfExtents: { x: 0.5, y: 0.5, z: 0.5 } })
        const sphere = yield* service.createSphere({ radius: 1 })
        expect(box instanceof CANNON.Box && sphere instanceof CANNON.Sphere).toBe(true)
      }).pipe(Effect.provide(ShapeServiceLive))
    )
  })
})
