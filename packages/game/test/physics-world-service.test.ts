import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { DeltaTimeSecs, PLAYER_HALF_HEIGHT } from '@ts-minecraft/core'
import type { WorldConfig } from '@ts-minecraft/game'
import { PhysicsWorldService, TERMINAL_VELOCITY_Y } from '../infrastructure/boundary/physics-world-service'
import { RigidBodyService } from '../infrastructure/boundary/rigid-body-service'

const defaultConfig: WorldConfig = { gravity: { x: 0, y: -9.82, z: 0 } }

const defaultBodyConfig = { mass: 1, position: { x: 0, y: 0, z: 0 } }

describe('physics/boundary/physics-world-service', () => {
  describe('PhysicsWorldService.Default', () => {
    it('should provide PhysicsWorldService as Layer', () => {
      expect(PhysicsWorldService.Default).toBeDefined()
      expect(typeof PhysicsWorldService.Default).toBe('object')
    })

    it.effect('should have create, addBody, removeBody, step methods', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService
        expect(typeof service.create).toBe('function')
        expect(typeof service.addBody).toBe('function')
        expect(typeof service.removeBody).toBe('function')
        expect(typeof service.step).toBe('function')
      }).pipe(Effect.provide(PhysicsWorldService.Default))
    )

    it.effect('should create a physics world with specified gravity', () =>
      Effect.gen(function* () {
        const service = yield* PhysicsWorldService
        const world = yield* service.create(defaultConfig)
        expect(world.gravity.x).toBe(0)
        expect(world.gravity.y).toBe(-9.82)
        expect(world.gravity.z).toBe(0)
      }).pipe(Effect.provide(PhysicsWorldService.Default))
    )

    it.effect('should add body to world', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create(defaultBodyConfig)
        yield* worldSvc.addBody(world, body)
        expect(world.bodies).toContain(body)
      }).pipe(Effect.provide(PhysicsWorldService.Default), Effect.provide(RigidBodyService.Default))
    )

    it.effect('should remove body from world', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create(defaultBodyConfig)
        yield* worldSvc.addBody(world, body)
        expect(world.bodies).toContain(body)
        yield* worldSvc.removeBody(world, body)
        expect(world.bodies).not.toContain(body)
      }).pipe(Effect.provide(PhysicsWorldService.Default), Effect.provide(RigidBodyService.Default))
    )

    it.effect('should remove every matching body reference from world', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create(defaultBodyConfig)
        yield* worldSvc.addBody(world, body)
        yield* worldSvc.addBody(world, body)

        yield* worldSvc.removeBody(world, body)

        expect(world.bodies).not.toContain(body)
      }).pipe(Effect.provide(PhysicsWorldService.Default), Effect.provide(RigidBodyService.Default))
    )

    it.effect('should apply gravity when stepping (body falls)', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create({ mass: 1, position: { x: 0, y: 10, z: 0 } })
        body.shape = { kind: 'box', halfExtents: { x: 0.5, y: 0.5, z: 0.5 } }
        yield* worldSvc.addBody(world, body)

        const initialY = body.position.y
        yield* worldSvc.step(world, DeltaTimeSecs.make(1 / 60))

        expect(body.position.y).toBeLessThan(initialY)
      }).pipe(Effect.provide(PhysicsWorldService.Default), Effect.provide(RigidBodyService.Default))
    )

    it.effect('free fall is clamped to terminal velocity (never grows unbounded)', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create({ mass: 1, position: { x: 0, y: 1000, z: 0 } })
        yield* worldSvc.addBody(world, body)

        // Step well past the time needed to reach terminal velocity
        // (|terminal| / |gravity| ≈ 3.3s ≈ 66 steps at dt=0.05).
        for (let i = 0; i < 100; i += 1) {
          yield* worldSvc.step(world, DeltaTimeSecs.make(0.05))
        }

        expect(body.velocity.y).toBe(TERMINAL_VELOCITY_Y)
        // And it never exceeds the cap on the way down.
        expect(body.velocity.y).toBeGreaterThanOrEqual(TERMINAL_VELOCITY_Y)
      }).pipe(Effect.provide(PhysicsWorldService.Default), Effect.provide(RigidBodyService.Default))
    )

    it('terminal velocity keeps per-step fall within the resolver bbox (tunneling-safe invariant)', () => {
      // The AABB resolver only catches a floor that lands inside the body's
      // ~1.8-block-tall box after a step, so the per-step fall at the deltaTime
      // ceiling must not exceed that height — otherwise a fast fall tunnels.
      const MAX_DELTA_TIME = 0.05 // game-loop.ts deltaTime cap
      const bodyHeight = 2 * PLAYER_HALF_HEIGHT
      expect(Math.abs(TERMINAL_VELOCITY_Y) * MAX_DELTA_TIME).toBeLessThanOrEqual(bodyHeight)
    })

    it.effect('static bodies should not be affected by gravity', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create({ mass: 0, position: { x: 0, y: 10, z: 0 }, type: 'static' })
        body.shape = { kind: 'plane' }
        yield* worldSvc.addBody(world, body)

        yield* worldSvc.step(world, DeltaTimeSecs.make(1 / 60))

        expect(body.position.y).toBe(10)
      }).pipe(Effect.provide(PhysicsWorldService.Default), Effect.provide(RigidBodyService.Default))
    )

    it.effect('dynamic bodies still step when static bodies are present first', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const staticBody = yield* bodySvc.create({ mass: 0, position: { x: 0, y: 10, z: 0 }, type: 'static' })
        const dynamicBody = yield* bodySvc.create({ mass: 1, position: { x: 0, y: 10, z: 0 } })
        yield* worldSvc.addBody(world, staticBody)
        yield* worldSvc.addBody(world, dynamicBody)

        const initialDynamicY = dynamicBody.position.y
        yield* worldSvc.step(world, DeltaTimeSecs.make(1 / 60))

        expect(staticBody.position.y).toBe(10)
        expect(dynamicBody.position.y).toBeLessThan(initialDynamicY)
      }).pipe(Effect.provide(PhysicsWorldService.Default), Effect.provide(RigidBodyService.Default))
    )

    it.effect('kinematic bodies should not be affected by gravity', () =>
      Effect.gen(function* () {
        const worldSvc = yield* PhysicsWorldService
        const bodySvc = yield* RigidBodyService
        const world = yield* worldSvc.create(defaultConfig)
        const body = yield* bodySvc.create({ mass: 0, position: { x: 0, y: 5, z: 0 }, type: 'kinematic' })
        yield* worldSvc.addBody(world, body)

        yield* worldSvc.step(world, DeltaTimeSecs.make(1 / 60))

        expect(body.position.y).toBe(5)
      }).pipe(Effect.provide(PhysicsWorldService.Default), Effect.provide(RigidBodyService.Default))
    )
  })
})
