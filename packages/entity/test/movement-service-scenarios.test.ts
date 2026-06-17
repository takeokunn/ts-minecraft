import { describe,it } from '@effect/vitest'
import {
DEFAULT_JUMP_VELOCITY,DEFAULT_SPRINT_SPEED,DEFAULT_WALK_SPEED,MovementService,
PlayerInputService,SPRINT_JUMP_HORIZONTAL_MULTIPLIER,
type MovementInput
} from '@ts-minecraft/entity'
import { Arbitrary,Effect,MutableHashMap,MutableHashSet,Option,Schema } from 'effect'
import { expect } from 'vitest'
import { createTestInputService,createTestLayers } from './movement-service-test-utils'

describe('player/movement-service (integration)', () => {
  describe('integration scenarios', () => {
    it.effect('should handle typical gameplay movement sequence', () => {
      const pressedKeys = MutableHashMap.make(
        ['KeyW', false],
        ['KeyS', false],
        ['KeyA', false],
        ['KeyD', false],
        ['Space', false],
        ['ControlLeft', false],
      )
      const justPressedKeys = MutableHashSet.empty<string>()

      const inputService = PlayerInputService.of({
        _tag: '@minecraft/application/PlayerInputService' as const,
        isKeyPressed: (key: string) => Effect.sync(() => Option.getOrElse(MutableHashMap.get(pressedKeys, key), () => false)),
        consumeKeyPress: (key: string) =>
          Effect.sync(() => {
            if (MutableHashSet.has(justPressedKeys, key)) {
              MutableHashSet.remove(justPressedKeys, key)
              return true
            }
            return false
          }),
        getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
        isPointerLocked: () => Effect.sync(() => true),
        consumeWheelDelta: () => Effect.sync(() => 0),
      })
      const testLayers = createTestLayers(inputService)

      return Effect.gen(function* () {
        const movementService = yield* MovementService

        MutableHashMap.set(pressedKeys, 'KeyW', true)
        const velocity1 = yield* movementService.update(0, true)

        MutableHashMap.set(pressedKeys, 'ControlLeft', true)
        const velocity2 = yield* movementService.update(0, true)

        MutableHashMap.set(pressedKeys, 'Space', true)
        MutableHashSet.add(justPressedKeys, 'Space')
        const velocity3 = yield* movementService.update(0, true)

        const velocity4 = yield* movementService.update(0, false)

        expect(velocity1.z).toBeCloseTo(-DEFAULT_WALK_SPEED)
        expect(velocity1.y).toBe(0)

        expect(velocity2.z).toBeCloseTo(-DEFAULT_SPRINT_SPEED)
        expect(velocity2.y).toBe(0)

        expect(velocity3.z).toBeCloseTo(-DEFAULT_SPRINT_SPEED * SPRINT_JUMP_HORIZONTAL_MULTIPLIER)
        expect(velocity3.y).toBe(DEFAULT_JUMP_VELOCITY)

        expect(velocity4.z).toBeCloseTo(-DEFAULT_SPRINT_SPEED)
        expect(velocity4.y).toBe(0)
      }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
    })

    it.effect('should handle strafing while moving forward', () => {
      const inputService = createTestInputService({ forward: true, right: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
        expect(magnitude).toBeCloseTo(DEFAULT_WALK_SPEED, 5)
        expect(velocity.x).toBeGreaterThan(0)
        expect(velocity.z).toBeLessThan(0)
      }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
    })

    it.effect('should handle opposite keys cancelling out', () => {
      const inputService = createTestInputService({ forward: true, backward: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        expect(velocity.x).toBe(0)
        expect(velocity.z).toBe(0)
      }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
    })

    it.effect('should handle all movement keys pressed', () => {
      const inputService = createTestInputService({
        forward: true,
        backward: true,
        left: true,
        right: true,
      })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const velocity = yield* movementService.update(0, true)
        expect(velocity.x).toBe(0)
        expect(velocity.z).toBe(0)
      }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
    })
  })

  // ---------------------------------------------------------------------------
  // D6: Property-based test — velocity magnitude never exceeds sprint-jump speed
  // ---------------------------------------------------------------------------

  describe('velocity magnitude invariant (property test)', () => {
    it.effect.prop(
      '|velocity| ≤ sprintJumpSpeed for any combination of movement inputs and yaw angle',
      {
        yaw: Arbitrary.make(Schema.Number.pipe(Schema.between(0, Math.PI * 2))),
        forward: Arbitrary.make(Schema.Boolean),
        backward: Arbitrary.make(Schema.Boolean),
        left: Arbitrary.make(Schema.Boolean),
        right: Arbitrary.make(Schema.Boolean),
        jump: Arbitrary.make(Schema.Boolean),
        sprint: Arbitrary.make(Schema.Boolean),
        sneak: Arbitrary.make(Schema.Boolean),
        isGrounded: Arbitrary.make(Schema.Boolean),
      },
      ({ yaw, forward, backward, left, right, jump, sprint, sneak, isGrounded }) => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = { forward, backward, left, right, jump, sprint, sneak }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, yaw, isGrounded)
          const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
          expect(magnitude).toBeLessThanOrEqual(
            DEFAULT_SPRINT_SPEED * SPRINT_JUMP_HORIZONTAL_MULTIPLIER + 0.001
          )
        }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
      }
    )

    it.effect.prop(
      '|velocity| ≤ walkSpeed when sprint is false, for any inputs and yaw',
      {
        yaw: Arbitrary.make(Schema.Number.pipe(Schema.between(0, Math.PI * 2))),
        forward: Arbitrary.make(Schema.Boolean),
        backward: Arbitrary.make(Schema.Boolean),
        left: Arbitrary.make(Schema.Boolean),
        right: Arbitrary.make(Schema.Boolean),
        isGrounded: Arbitrary.make(Schema.Boolean),
      },
      ({ yaw, forward, backward, left, right, isGrounded }) => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = { forward, backward, left, right, jump: false, sprint: false, sneak: false }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, yaw, isGrounded)
          const magnitude = Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
          expect(magnitude).toBeLessThanOrEqual(DEFAULT_WALK_SPEED + 0.001)
        }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
      }
    )

    it.effect.prop(
      'velocity.y is always either 0 or DEFAULT_JUMP_VELOCITY (no other values)',
      {
        yaw: Arbitrary.make(Schema.Number.pipe(Schema.between(0, Math.PI * 2))),
        forward: Arbitrary.make(Schema.Boolean),
        backward: Arbitrary.make(Schema.Boolean),
        left: Arbitrary.make(Schema.Boolean),
        right: Arbitrary.make(Schema.Boolean),
        jump: Arbitrary.make(Schema.Boolean),
        isGrounded: Arbitrary.make(Schema.Boolean),
      },
      ({ yaw, forward, backward, left, right, jump, isGrounded }) => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = { forward, backward, left, right, jump, sprint: false, sneak: false }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, yaw, isGrounded)
          expect(velocity.y === 0 || velocity.y === DEFAULT_JUMP_VELOCITY).toBe(true)
        }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
      }
    )
  })

  // ---------------------------------------------------------------------------
  // Jump is a HELD key (isKeyPressed), not consumed: holding the jump key keeps
  // jump=true every frame so the player auto-bounces on each landing (vanilla).
  // Anti-double-jump is enforced downstream (game-state only jumps while grounded),
  // not by consuming the key here.
  // ---------------------------------------------------------------------------

  describe('held-jump behavior', () => {
    it.effect('jump is held: jump stays true across repeated getInput() while the key is down', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const first = yield* movementService.getInput()
        const second = yield* movementService.getInput()
        expect(first.jump).toBe(true)
        expect(second.jump).toBe(true)
      }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
    })

    it.effect('held forward and jump both remain true on the second getInput()', () => {
      const inputService = createTestInputService({ forward: true, jump: true })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const first = yield* movementService.getInput()
        const second = yield* movementService.getInput()
        expect(first.forward).toBe(true)
        expect(second.forward).toBe(true)
        expect(first.jump).toBe(true)
        expect(second.jump).toBe(true)
      }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
    })

    it.effect('jump=false from the start: getInput() returns jump=false on both calls', () => {
      const inputService = createTestInputService({ jump: false })
      const testLayers = createTestLayers(inputService)
      return Effect.gen(function* () {
        const movementService = yield* MovementService
        const first = yield* movementService.getInput()
        const second = yield* movementService.getInput()
        expect(first.jump).toBe(false)
        expect(second.jump).toBe(false)
      }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
    })
  })
})
