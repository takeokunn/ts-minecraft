import { describe,it } from '@effect/vitest'
import {
DEFAULT_JUMP_VELOCITY,
DEFAULT_SPRINT_SPEED,
DEFAULT_WALK_SPEED,
MovementService,
MovementServiceLive
} from '@ts-minecraft/entity'
import { Array as Arr,Effect,Ref } from 'effect'
import { expect } from 'vitest'
import { createTestInputService,createTestLayers } from './movement-service-test-utils'

describe('player/movement-service (integration)', () => {
  describe('update', () => {
    it.effect('should combine getInput and calculateVelocity', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Should move forward
        expect(velocity.x).toBeCloseTo(0)
        expect(velocity.z).toBeCloseTo(-DEFAULT_WALK_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return zero Y velocity when not jumping', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Y velocity should be zero when not jumping
        expect(velocity.y).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return jump velocity when jumping', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Y velocity should be jump velocity when jumping
        expect(velocity.y).toBe(DEFAULT_JUMP_VELOCITY)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should not jump when not grounded', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, false)
        // Y velocity should be zero (no jump in air)
        expect(velocity.y).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle sprint in update', () => {
      const inputService = createTestInputService({ forward: true, sprint: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        expect(Math.abs(velocity.z)).toBeCloseTo(DEFAULT_SPRINT_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle complex input combinations', () => {
      const inputService = createTestInputService({
        forward: true,
        right: true,
        sprint: true,
      })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        // Should have diagonal movement normalized to sprint speed
        const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
        expect(magnitude).toBeCloseTo(DEFAULT_SPRINT_SPEED, 5)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle zero current Y velocity', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        expect(velocity.y).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should apply camera-relative movement in update', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      const yaw = Math.PI / 4 // 45 degrees
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(yaw, true)
        // Verify movement is relative to yaw angle
        expect(velocity.x).toBeCloseTo(-Math.sin(yaw) * DEFAULT_WALK_SPEED)
        expect(velocity.z).toBeCloseTo(-Math.cos(yaw) * DEFAULT_WALK_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })

  // ---------------------------------------------------------------------------
  // B7: Sprint distance > walk distance for same duration
  // ---------------------------------------------------------------------------

  describe('sprint vs walk distance comparison', () => {
    it.effect('sprint distance is greater than walk distance for the same number of frames', () => {
      const FRAMES = 60
      const yaw = 0 // facing negative-Z

      // Walk: forward=true, sprint=false
      const walkInputService = createTestInputService({ forward: true, sprint: false })
      const walkLayers = createTestLayers(walkInputService)

      const sprintInputService = createTestInputService({ forward: true, sprint: true })
      const sprintLayers = createTestLayers(sprintInputService)

      return Effect.gen(function* () {
        const walkDistRef = yield* Ref.make(0)
        const sprintDistRef = yield* Ref.make(0)

        yield* Effect.gen(function* () {
          const movementService = yield* MovementService
          const accRef = yield* Ref.make({ x: 0, z: 0 })
          yield* Effect.forEach(Arr.makeBy(FRAMES, () => undefined), () =>
            movementService.calculateVelocity(
              { forward: true, backward: false, left: false, right: false, jump: false, sprint: false },
              yaw,
              true
            ).pipe(Effect.flatMap(vel => Ref.update(accRef, acc => ({ x: acc.x + vel.x, z: acc.z + vel.z }))))
          , { concurrency: 1 })
          const { x: totalX, z: totalZ } = yield* Ref.get(accRef)
          yield* Ref.set(walkDistRef, Math.sqrt(totalX * totalX + totalZ * totalZ))
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(walkLayers))

        yield* Effect.gen(function* () {
          const movementService = yield* MovementService
          const accRef = yield* Ref.make({ x: 0, z: 0 })
          yield* Effect.forEach(Arr.makeBy(FRAMES, () => undefined), () =>
            movementService.calculateVelocity(
              { forward: true, backward: false, left: false, right: false, jump: false, sprint: true },
              yaw,
              true
            ).pipe(Effect.flatMap(vel => Ref.update(accRef, acc => ({ x: acc.x + vel.x, z: acc.z + vel.z }))))
          , { concurrency: 1 })
          const { x: totalX, z: totalZ } = yield* Ref.get(accRef)
          yield* Ref.set(sprintDistRef, Math.sqrt(totalX * totalX + totalZ * totalZ))
        }).pipe(Effect.provide(MovementServiceLive), Effect.provide(sprintLayers))

        const walkDist = yield* Ref.get(walkDistRef)
        const sprintDist = yield* Ref.get(sprintDistRef)
        expect(sprintDist).toBeGreaterThan(walkDist)
      })
    })

    it.effect('sprint displacement per frame equals DEFAULT_SPRINT_SPEED (no diagonal)', () => {
      const walkInputService = createTestInputService()
      const testLayers = createTestLayers(walkInputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const vel = yield* movementService.calculateVelocity(
          { forward: true, backward: false, left: false, right: false, jump: false, sprint: true },
          0,
          true
        )
        const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z)
        expect(speed).toBeCloseTo(DEFAULT_SPRINT_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('walk displacement per frame equals DEFAULT_WALK_SPEED (no diagonal)', () => {
      const walkInputService = createTestInputService()
      const testLayers = createTestLayers(walkInputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const vel = yield* movementService.calculateVelocity(
          { forward: true, backward: false, left: false, right: false, jump: false, sprint: false },
          0,
          true
        )
        const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z)
        expect(speed).toBeCloseTo(DEFAULT_WALK_SPEED)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })
})
