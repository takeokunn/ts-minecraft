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
  DEFAULT_SNEAK_SPEED,
  DEFAULT_JUMP_VELOCITY,
} from '@ts-minecraft/entity'
import { createTestInputService, createTestLayers } from './movement-service-test-utils'

describe('computeVelocity — pure function', () => {
  const walk = DEFAULT_WALK_SPEED
  const sprint = DEFAULT_SPRINT_SPEED
  const sneak = DEFAULT_SNEAK_SPEED
  const jump = DEFAULT_JUMP_VELOCITY

  const noInput: MovementInput = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false, sneak: false }

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
      'sneak forward at yaw=0 → z=-sneakSpeed',
      { ...noInput, forward: true, sneak: true },
      0,
      false,
      { x: 0, y: 0, z: -sneak },
    ],
    [
      'sneak suppresses sprint → z=-sneakSpeed (vanilla: cannot sprint while sneaking)',
      { ...noInput, forward: true, sprint: true, sneak: true },
      0,
      false,
      { x: 0, y: 0, z: -sneak },
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

  it('forward at yaw=PI/2 → x=-walkSpeed, z≈0', () => {
    // At yaw=PI/2: sin(PI/2)=1, cos(PI/2)=0 → Forward: x -= sin = -walkSpeed, z -= cos = 0
    const vel = computeVelocity({ ...noInput, forward: true }, Math.PI / 2, false)
    expect(vel.x).toBeCloseTo(-walk)
    expect(vel.z).toBeCloseTo(0)
    expect(vel.y).toBe(0)
  })
})

describe('MovementService', () => {
  describe('calculateVelocity (Effect wrapper sanity check)', () => {
    it.effect('should return zero velocity when no input is provided', () => {
      const inputService = createTestInputService()
      const testLayers = createTestLayers(inputService)
      const noInput: MovementInput = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        sneak: false,
      }
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.calculateVelocity(noInput, 0, false)
        expect(velocity.x).toBe(0)
        expect(velocity.y).toBe(0)
        expect(velocity.z).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })

  describe('constants', () => {
    it('should have vanilla walk speed of 4.317 b/s', () => {
      expect(DEFAULT_WALK_SPEED).toBe(4.317)
    })

    it('should have vanilla sprint speed of 5.612 b/s (walk × 1.3)', () => {
      expect(DEFAULT_SPRINT_SPEED).toBe(5.612)
    })

    it('should have vanilla sneak speed of 1.295 b/s (walk × 0.3)', () => {
      expect(DEFAULT_SNEAK_SPEED).toBe(1.295)
    })

    it('should have default jump velocity of 5.0 m/s', () => {
      expect(DEFAULT_JUMP_VELOCITY).toBe(5.0)
    })

    it('speed ordering: sneak < walk < sprint', () => {
      expect(DEFAULT_SNEAK_SPEED).toBeLessThan(DEFAULT_WALK_SPEED)
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
        expect(input.sneak).toBe(false)
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

    // Arrow keys are aliases for WASD: each direction responds to either.
    it.effect('arrow keys move the same as WASD (ArrowUp/Down/Left/Right)', () => {
      const inputService = createTestInputService()
      inputService.setKeyPressed('ArrowUp', true)
      inputService.setKeyPressed('ArrowLeft', true)
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.forward).toBe(true)
        expect(input.left).toBe(true)
        expect(input.backward).toBe(false)
        expect(input.right).toBe(false)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('WASD and arrow keys are OR-combined per direction', () => {
      const inputService = createTestInputService({ forward: true }) // W down
      inputService.setKeyPressed('ArrowDown', true) // S-alias down
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.forward).toBe(true)
        expect(input.backward).toBe(true)
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

    it.effect('should return sprint true when ControlRight is pressed', () => {
      const inputService = createTestInputService()
      inputService.setKeyPressed('ControlRight', true)
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.sprint).toBe(true)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return sneak true when ShiftLeft is pressed', () => {
      const inputService = createTestInputService({ sneak: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const input = yield* movementService.getInput()
        expect(input.sneak).toBe(true)
        expect(input.sprint).toBe(false)
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

  describe('update', () => {
    it.effect('should return walk velocity when W is held (grounded)', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        expect(velocity.z).toBeCloseTo(-DEFAULT_WALK_SPEED)
        expect(velocity.x).toBeCloseTo(0)
        expect(velocity.y).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should return jump velocity when Space is pressed while grounded', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        expect(velocity.y).toBe(DEFAULT_JUMP_VELOCITY)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })

    it.effect('should not jump when not grounded', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, false)
        expect(velocity.y).toBe(0)
      }).pipe(Effect.provide(MovementServiceLive), Effect.provide(testLayers))
    })
  })
})
