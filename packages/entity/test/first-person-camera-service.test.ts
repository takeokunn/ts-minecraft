import { describe,it } from '@effect/vitest'
import type { MouseDelta } from '@ts-minecraft/entity/application/player-input-service';
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state';
import { BASE_MOUSE_SENSITIVITY, FirstPersonCameraService } from '@ts-minecraft/entity/application/first-person-camera-service';
import { PlayerInputService } from '@ts-minecraft/entity/application/player-input-service';
import { Effect,Layer,MutableRef } from 'effect'
import * as THREE from 'three'
import { expect } from 'vitest'
import { createTestInputService } from './movement-service-test-utils'

const createTestLayers = (inputService: PlayerInputService) =>
  Layer.merge(
    Layer.succeed(PlayerInputService, inputService),
    PlayerCameraStateService.Default
  )

describe('FirstPersonCameraService', () => {
  describe('BASE_MOUSE_SENSITIVITY', () => {
    it('should have a base sensitivity value', () => {
      expect(BASE_MOUSE_SENSITIVITY).toBe(0.004)
    })

    it('should be a positive number', () => {
      expect(BASE_MOUSE_SENSITIVITY).toBeGreaterThan(0)
    })
  })

  describe('update', () => {
    it.effect('should not update camera rotation when pointer is not locked', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 100, y: 50 },
        pointerLocked: false,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      const initialRotation = camera.rotation.clone()

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        expect(camera.rotation.x).toBe(initialRotation.x)
        expect(camera.rotation.y).toBe(initialRotation.y)
        expect(camera.rotation.z).toBe(initialRotation.z)
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })

    it.effect('should update camera rotation when pointer is locked', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 100, y: 50 },
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        const rotation = yield* cameraState.getRotation()

        // Verify rotation was updated (negative for intuitive direction)
        const expectedYaw = -100 * BASE_MOUSE_SENSITIVITY * 0.5
        const expectedPitch = -50 * BASE_MOUSE_SENSITIVITY * 0.5

        expect(rotation.yaw).toBeCloseTo(expectedYaw)
        expect(rotation.pitch).toBeCloseTo(expectedPitch)

        // Verify camera rotation matches state
        expect(camera.rotation.x).toBeCloseTo(expectedPitch)
        expect(camera.rotation.y).toBeCloseTo(expectedYaw)
        expect(camera.rotation.z).toBe(0)
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })

    it.effect('should use YXZ rotation order', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 100, y: 50 },
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        expect(camera.rotation.order).toBe('YXZ')
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })

    it.effect('should not update when mouse delta is zero', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 0, y: 0 },
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        const cameraState = yield* PlayerCameraStateService

        // Set initial rotation
        yield* cameraState.setYaw(0.5)
        yield* cameraState.setPitch(0.3)
        yield* cameraService.attachToPlayer(camera)

        const beforeRotation = yield* cameraState.getRotation()
        yield* cameraService.update(camera)
        const afterRotation = yield* cameraState.getRotation()

        expect(afterRotation.yaw).toBeCloseTo(beforeRotation.yaw)
        expect(afterRotation.pitch).toBeCloseTo(beforeRotation.pitch)
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })

    it.effect('should apply negative multiplier for intuitive rotation (mouse right = look right)', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 100, y: 0 }, // Mouse moved right
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        const rotation = yield* cameraState.getRotation()

        // Negative delta.x * sensitivity = positive yaw (looking right)
        expect(rotation.yaw).toBeCloseTo(-100 * BASE_MOUSE_SENSITIVITY * 0.5)
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })

    it.effect('should accumulate multiple updates', () => {
      const mouseDeltaRef = MutableRef.make<MouseDelta>({ x: 50, y: 25 })
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
        isPointerLocked: () => Effect.sync(() => true),
        consumeWheelDelta: () => Effect.sync(() => 0),
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        // Reset mouse delta for second update
        MutableRef.set(mouseDeltaRef, { x: 50, y: 25 })
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        const rotation = yield* cameraState.getRotation()

        // Two updates should accumulate
        const expectedYaw = -100 * BASE_MOUSE_SENSITIVITY * 0.5
        const expectedPitch = -50 * BASE_MOUSE_SENSITIVITY * 0.5

        expect(rotation.yaw).toBeCloseTo(expectedYaw)
        expect(rotation.pitch).toBeCloseTo(expectedPitch)
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })
  })

  describe('update with pitch clamping', () => {
    it.effect('should clamp pitch to PITCH_MAX when looking too far up', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 0, y: -10000 }, // Large upward movement
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        const rotation = yield* cameraState.getRotation()

        // Pitch should be clamped to near PI/2
        expect(rotation.pitch).toBeLessThan(Math.PI / 2)
        expect(rotation.pitch).toBeGreaterThan(1.5) // Close to PI/2
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })

    it.effect('should clamp pitch to PITCH_MIN when looking too far down', () => {
      const inputService = createTestInputService({
        mouseDelta: { x: 0, y: 10000 }, // Large downward movement
        pointerLocked: true,
      })
      const testLayers = createTestLayers(inputService)

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)

      return Effect.gen(function* () {
        const cameraService = yield* FirstPersonCameraService
        yield* cameraService.update(camera)

        const cameraState = yield* PlayerCameraStateService
        const rotation = yield* cameraState.getRotation()

        // Pitch should be clamped to near -PI/2
        expect(rotation.pitch).toBeGreaterThan(-Math.PI / 2)
        expect(rotation.pitch).toBeLessThan(-1.5) // Close to -PI/2
      }).pipe(Effect.provide(FirstPersonCameraService.Default), Effect.provide(testLayers))
    })
  })

})
