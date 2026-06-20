import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { DEFAULT_WALK_SPEED, MovementService, type MovementInput } from '@ts-minecraft/entity/application/movement-service';
import { createTestInputService, createTestLayers } from './movement-service-test-utils'

describe('MovementService', () => {
  describe('calculateVelocity', () => {
    describe('camera-relative direction', () => {
      it.effect('should adjust movement direction based on yaw angle', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
        }
        const testAngles = [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2]
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          yield* Effect.forEach(testAngles, yaw =>
            Effect.gen(function* () {
              const velocity = yield* movementService.calculateVelocity(input, yaw, true)
              // Forward direction should be -sin(yaw), -cos(yaw)
              expect(velocity.x).toBeCloseTo(-Math.sin(yaw) * DEFAULT_WALK_SPEED)
              expect(velocity.z).toBeCloseTo(-Math.cos(yaw) * DEFAULT_WALK_SPEED)
            })
          , { concurrency: 1 })
        }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
      })

      it.effect('should handle 180-degree rotation correctly', () => {
        const inputService = createTestInputService()
        const testLayers = createTestLayers(inputService)
        const input: MovementInput = {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
        }
        return Effect.gen(function* () {
          const movementService = yield* MovementService
          const velocity = yield* movementService.calculateVelocity(input, Math.PI, true)
          // At yaw=PI: sin(PI)=0, cos(PI)=-1
          // Forward: x -= 0, z -= (-1) => z = walkSpeed
          expect(velocity.x).toBeCloseTo(0)
          expect(velocity.z).toBeCloseTo(DEFAULT_WALK_SPEED)
        }).pipe(Effect.provide(MovementService.Default), Effect.provide(testLayers))
      })
    })
  })
})
