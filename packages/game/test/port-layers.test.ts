import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import {
  PhysicsWorldPort,
  RigidBodyPort,
  ShapePort,
  PhysicsWorldPortLayer,
  RigidBodyPortLayer,
  ShapePortLayer,
  PhysicsService,
  PhysicsServiceLive,
} from '@ts-minecraft/game'

describe('infrastructure/port-layers', () => {
  describe('PhysicsWorldPortLayer', () => {
    it.effect('should provide PhysicsWorldPort with all required methods', () =>
      Effect.gen(function* () {
        const port = yield* PhysicsWorldPort
        expect(typeof port.create).toBe('function')
        expect(typeof port.addBody).toBe('function')
        expect(typeof port.removeBody).toBe('function')
        expect(typeof port.step).toBe('function')
      }).pipe(Effect.provide(PhysicsWorldPortLayer))
    )

    it.effect('should create a world and step without error', () =>
      Effect.gen(function* () {
        const port = yield* PhysicsWorldPort
        const world = yield* port.create({ gravity: { x: 0, y: -9.82, z: 0 } })
        expect(world.gravity.y).toBe(-9.82)
        expect(world.bodies).toHaveLength(0)
        yield* port.step(world, DeltaTimeSecs.make(1 / 60))
      }).pipe(Effect.provide(PhysicsWorldPortLayer))
    )
  })

  describe('RigidBodyPortLayer', () => {
    it.effect('should provide RigidBodyPort with all required methods', () =>
      Effect.gen(function* () {
        const port = yield* RigidBodyPort
        expect(typeof port.create).toBe('function')
        expect(typeof port.setPosition).toBe('function')
        expect(typeof port.setVelocity).toBe('function')
        expect(typeof port.addShape).toBe('function')
      }).pipe(Effect.provide(RigidBodyPortLayer))
    )

    it.effect('should create a body and mutate position via port', () =>
      Effect.gen(function* () {
        const port = yield* RigidBodyPort
        const body = yield* port.create({ mass: 70, position: { x: 0, y: 10, z: 0 } })
        expect(body.mass).toBe(70)
        yield* port.setPosition(body, { x: 5, y: 20, z: -3 })
        expect(body.position.x).toBe(5)
        expect(body.position.y).toBe(20)
      }).pipe(Effect.provide(RigidBodyPortLayer))
    )
  })

  describe('ShapePortLayer', () => {
    it.effect('should provide ShapePort with all required methods', () =>
      Effect.gen(function* () {
        const port = yield* ShapePort
        expect(typeof port.createBox).toBe('function')
        expect(typeof port.createSphere).toBe('function')
        expect(typeof port.createPlane).toBe('function')
      }).pipe(Effect.provide(ShapePortLayer))
    )

    it.effect('should create all three shape types via port', () =>
      Effect.gen(function* () {
        const port = yield* ShapePort
        const box = yield* port.createBox({ halfExtents: { x: 0.5, y: 0.5, z: 0.5 } })
        const sphere = yield* port.createSphere({ radius: 1 })
        const plane = yield* port.createPlane()
        expect(box.kind).toBe('box')
        expect(sphere.kind).toBe('sphere')
        expect(plane.kind).toBe('plane')
      }).pipe(Effect.provide(ShapePortLayer))
    )
  })

  describe('Full layer composition', () => {
    const FullTestLayer = PhysicsServiceLive.pipe(
      Layer.provide(PhysicsWorldPortLayer),
      Layer.provide(RigidBodyPortLayer),
      Layer.provide(ShapePortLayer)
    )

    it.effect('should compose all port layers into a working PhysicsService', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsService
        yield* service.initialize({ gravity: { x: 0, y: -9.82, z: 0 } })
        const bodyId = yield* service.addBody({
          mass: 70,
          position: { x: 0, y: 10, z: 0 },
          shape: 'box',
        })
        expect(typeof bodyId).toBe('string')

        yield* service.step(DeltaTimeSecs.make(1 / 60))

        const pos = yield* service.getPosition(bodyId)
        expect(pos.y).toBeLessThan(10)
      }).pipe(Effect.provide(FullTestLayer))
    )
  })
})
