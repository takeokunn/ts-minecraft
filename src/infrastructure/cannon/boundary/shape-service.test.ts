import { describe, it, expect } from 'vitest'
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
    it('should expose all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* ShapeService
        expect(typeof service.createBox).toBe('function')
        expect(typeof service.createSphere).toBe('function')
        expect(typeof service.createCylinder).toBe('function')
        expect(typeof service.createPlane).toBe('function')
        return { success: true }
      }).pipe(Effect.provide(ShapeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('createBox should create a CANNON.Box with correct half extents', () => {
      const program = Effect.gen(function* () {
        const service = yield* ShapeService
        const box = yield* service.createBox({ halfExtents: { x: 1, y: 2, z: 3 } })
        return {
          x: box.halfExtents.x,
          y: box.halfExtents.y,
          z: box.halfExtents.z,
          isBox: box instanceof CANNON.Box,
        }
      }).pipe(Effect.provide(ShapeServiceLive))

      const result = Effect.runSync(program)
      expect(result.isBox).toBe(true)
      expect(result.x).toBe(1)
      expect(result.y).toBe(2)
      expect(result.z).toBe(3)
    })

    it('createSphere should create a CANNON.Sphere with correct radius', () => {
      const program = Effect.gen(function* () {
        const service = yield* ShapeService
        const sphere = yield* service.createSphere({ radius: 2.5 })
        return { radius: sphere.radius, isSphere: sphere instanceof CANNON.Sphere }
      }).pipe(Effect.provide(ShapeServiceLive))

      const { radius, isSphere } = Effect.runSync(program)
      expect(isSphere).toBe(true)
      expect(radius).toBe(2.5)
    })

    it('createCylinder should create a CANNON.Cylinder with default 8 segments', () => {
      const program = Effect.gen(function* () {
        const service = yield* ShapeService
        const cyl = yield* service.createCylinder({
          radiusTop: 0.5,
          radiusBottom: 0.5,
          height: 2,
        })
        return { isCylinder: cyl instanceof CANNON.Cylinder }
      }).pipe(Effect.provide(ShapeServiceLive))

      const { isCylinder } = Effect.runSync(program)
      expect(isCylinder).toBe(true)
    })

    it('createCylinder should accept custom numSegments', () => {
      const program = Effect.gen(function* () {
        const service = yield* ShapeService
        const cyl = yield* service.createCylinder({
          radiusTop: 1,
          radiusBottom: 1,
          height: 3,
          numSegments: 16,
        })
        return { isCylinder: cyl instanceof CANNON.Cylinder }
      }).pipe(Effect.provide(ShapeServiceLive))

      const { isCylinder } = Effect.runSync(program)
      expect(isCylinder).toBe(true)
    })

    it('createPlane should create a CANNON.Plane', () => {
      const program = Effect.gen(function* () {
        const service = yield* ShapeService
        const plane = yield* service.createPlane()
        return { isPlane: plane instanceof CANNON.Plane }
      }).pipe(Effect.provide(ShapeServiceLive))

      const { isPlane } = Effect.runSync(program)
      expect(isPlane).toBe(true)
    })

    it('should support Effect.flatMap for chaining createBox and createSphere', () => {
      const program = Effect.gen(function* () {
        const service = yield* ShapeService
        const box = yield* service.createBox({ halfExtents: { x: 0.5, y: 0.5, z: 0.5 } })
        const sphere = yield* service.createSphere({ radius: 1 })
        return { bothCreated: box instanceof CANNON.Box && sphere instanceof CANNON.Sphere }
      }).pipe(Effect.provide(ShapeServiceLive))

      const { bothCreated } = Effect.runSync(program)
      expect(bothCreated).toBe(true)
    })
  })
})
