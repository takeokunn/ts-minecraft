import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect } from 'effect'
import {
  MovementService,
  MovementServiceLive,
  computeVelocity,
  type MovementInput,
  DEFAULT_WALK_SPEED,
  DEFAULT_SPRINT_SPEED,
  DEFAULT_JUMP_VELOCITY,
} from '@ts-minecraft/player'
import { createTestInputService, createTestLayers } from './movement-service-test-utils'

describe('computeVelocity — pure function', () => {
  const walk = DEFAULT_WALK_SPEED
  const sprint = DEFAULT_SPRINT_SPEED
  const jump = DEFAULT_JUMP_VELOCITY

  const noInput: MovementInput = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false }

  const cases: ReadonlyArray<readonly [string, MovementInput, number, boolean, { x: number; y: number; z: number }]> = [
    [
      'forward at yaw=0 → z=-walkSpeed, x=0',
      { ...noInput, forward: true },
      0,
      false,
      { x: 0, y: 0, z: -walk },
    ],
    [
      'backward at yaw=0 → z=+walkSpeed',
      { ...noInput, backward: true },
      0,
      false,
      { x: 0, y: 0, z: walk },
    ],
    [
      'left strafe at yaw=0 → x=-walkSpeed',
      { ...noInput, left: true },
      0,
      false,
      { x: -walk, y: 0, z: 0 },
    ],
    [
      'right strafe at yaw=0 → x=+walkSpeed',
      { ...noInput, right: true },
      0,
      false,
      { x: walk, y: 0, z: 0 },
    ],
    [
      'sprint forward at yaw=0 → z=-sprintSpeed',
      { ...noInput, forward: true, sprint: true },
      0,
      false,
      { x: 0, y: 0, z: -sprint },
    ],
    [
      'jump when grounded → y=jumpVelocity',
      { ...noInput, jump: true },
      0,
      true,
      { x: 0, y: jump, z: 0 },
    ],
    [
      'jump when not grounded → y=0',
      { ...noInput, jump: true },
      0,
      false,
      { x: 0, y: 0, z: 0 },
    ],
  ]

  Arr.forEach(cases, ([label, input, yaw, grounded, expected]) => {
    it(label, () => {
      const vel = computeVelocity(input, yaw, grounded)
      expect(vel.x).toBeCloseTo(expected.x)
      expect(vel.y).toBeCloseTo(expected.y)
      expect(vel.z).toBeCloseTo(expected.z)
    })
  })

  it('diagonal forward+right normalized to walkSpeed', () => {
    const vel = computeVelocity({ ...noInput, forward: true, right: true }, 0, false)
    const magnitude = Math.sqrt(vel.x ** 2 + vel.z ** 2)
    expect(magnitude).toBeCloseTo(walk, 5)
  })
})

describe('MovementService', () => {
  describe('constants', () => {
    it('should have default walk speed of 8.0 m/s', () => {
      expect(DEFAULT_WALK_SPEED).toBe(8.0)
    })

    it('should have default sprint speed of 14.0 m/s', () => {
      expect(DEFAULT_SPRINT_SPEED).toBe(14.0)
    })

    it('should have default jump velocity of 5.0 m/s', () => {
      expect(DEFAULT_JUMP_VELOCITY).toBe(5.0)
    })

    it('sprint speed should be greater than walk speed', () => {
      expect(DEFAULT_SPRINT_SPEED).toBeGreaterThan(DEFAULT_WALK_SPEED)
    })
  })

  describe('getInput', () => {
    it.effect('should return false for all inputs when no keys are pressed', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.forward).toBe(false)
        expect(input.backward).toBe(false)
        expect(input.left).toBe(false)
        expect(input.right).toBe(false)
        expect(input.jump).toBe(false)
        expect(input.sprint).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return forward true when W is pressed', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.forward).toBe(true)
        expect(input.backward).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return backward true when S is pressed', () => {
      const inputService = createTestInputService({ backward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.backward).toBe(true)
        expect(input.forward).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return left true when A is pressed', () => {
      const inputService = createTestInputService({ left: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.left).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return right true when D is pressed', () => {
      const inputService = createTestInputService({ right: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.right).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return jump true when Space is pressed', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.jump).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return sprint true when ControlLeft is pressed', () => {
      const inputService = createTestInputService({ sprint: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.sprint).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle multiple keys pressed simultaneously', () => {
      const inputService = createTestInputService({
        forward: true,
        left: true,
        sprint: true,
      })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.forward).toBe(true)
        expect(input.backward).toBe(false)
        expect(input.left).toBe(true)
        expect(input.right).toBe(false)
        expect(input.jump).toBe(false)
        expect(input.sprint).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })
})
