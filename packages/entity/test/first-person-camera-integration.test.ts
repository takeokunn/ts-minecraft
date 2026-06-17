import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, MutableRef } from 'effect'
import * as THREE from 'three'
import { PlayerInputService } from '@ts-minecraft/entity'
import { PlayerCameraStateService } from '@ts-minecraft/entity'
import {
  FirstPersonCameraService,
  BASE_MOUSE_SENSITIVITY,
} from '@ts-minecraft/entity'

const createTestLayers = (inputService: PlayerInputService) =>
  Layer.merge(
    Layer.succeed(PlayerInputService, inputService),
    PlayerCameraStateService.Default
  )


describe('FirstPersonCameraService', () => {
  describe('integration scenarios', () => {
    it.effect('should handle typical mouse look sequence', () => {
      const mouseDeltaRef = MutableRef.make({ x: 0, y: 0 })
      const pointerLockedRef = MutableRef.make(false)

      const inputService = PlayerInputService.of({
        _tag: '@minecraft/application/PlayerInputService' as const,
        isKeyPressed: () => Effect.sync(() => false),
        consumeKeyPress: () => Effect.sync(() => false),
        getMouseDelta: () =>
          Effect.sync(() => {
            const delta = { ...MutableRef.get(mouseDeltaRef) }
            MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
            return delta
          }),
        isPointerLocked: () => Effect.sync(() => MutableRef.get(pointerLockedRef)),
        consumeWheelDelta: () => Effect.sync(() => 0),
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      // Set pointer locked via MutableRef
      MutableRef.set(pointerLockedRef, true)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        // First mouse movement - look right and up
        MutableRef.set(mouseDeltaRef, { x: 200, y: -100 })
        yield* cameraService.update(camera)

        // Second mouse movement - look left and down
        MutableRef.set(mouseDeltaRef, { x: -100, y: 50 })
        yield* cameraService.update(camera)

        const rotation = yield* cameraState.getRotation()

        // Net movement: yaw = -(200 - 100) * 0.002 = -0.2
        // Net movement: pitch = -(-100 + 50) * 0.002 = 0.1
        expect(rotation.yaw).toBeCloseTo(-100 * BASE_MOUSE_SENSITIVITY * 0.5)
        expect(rotation.pitch).toBeCloseTo(50 * BASE_MOUSE_SENSITIVITY * 0.5)
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })

    it.effect('should handle pointer lock/unlock during gameplay', () => {
      const mouseDeltaRef = MutableRef.make({ x: 100, y: 50 })
      const pointerLockedRef = MutableRef.make(true)

      const inputService = PlayerInputService.of({
        _tag: '@minecraft/application/PlayerInputService' as const,
        isKeyPressed: () => Effect.sync(() => false),
        consumeKeyPress: () => Effect.sync(() => false),
        getMouseDelta: () =>
          Effect.sync(() => {
            const delta = { ...MutableRef.get(mouseDeltaRef) }
            MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
            return delta
          }),
        isPointerLocked: () => Effect.sync(() => MutableRef.get(pointerLockedRef)),
        consumeWheelDelta: () => Effect.sync(() => 0),
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        // First update with pointer locked
        yield* cameraService.update(camera)
        const rotation1 = yield* cameraState.getRotation()

        // Exit pointer lock via MutableRef
        MutableRef.set(pointerLockedRef, false)

        // Set mouse delta but shouldn't be applied
        MutableRef.set(mouseDeltaRef, { x: 200, y: 100 })
        yield* cameraService.update(camera)
        const rotation2 = yield* cameraState.getRotation()

        // Second update should not have changed rotation
        expect(rotation2.yaw).toBeCloseTo(rotation1.yaw)
        expect(rotation2.pitch).toBeCloseTo(rotation1.pitch)
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })
  })
})
