import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Array as Arr, Effect, Layer, MutableRef, Option, Schema } from 'effect'
import * as THREE from 'three'
import { PlayerInputService } from '@ts-minecraft/player'
import type { MouseDelta } from '@ts-minecraft/player'
import type { InputServicePort as InputServiceType } from '@ts-minecraft/player'
import { PlayerCameraStateService, PlayerCameraStateLive, PITCH_MIN, PITCH_MAX } from '@ts-minecraft/player'
import {
  FirstPersonCameraService,
  FirstPersonCameraServiceLive,
  BASE_MOUSE_SENSITIVITY,
} from '@ts-minecraft/player'

const createTestInputService = (initialState: {
  mouseDelta?: MouseDelta
  pointerLocked?: boolean
} = {}): InputServiceType & { setMouseDelta: (delta: MouseDelta) => void; setPointerLocked: (locked: boolean) => void } => {
  const mouseDeltaRef = MutableRef.make(Option.getOrElse(Option.fromNullable(initialState.mouseDelta), () => ({ x: 0, y: 0 })))
  const pointerLockedRef = MutableRef.make(Option.getOrElse(Option.fromNullable(initialState.pointerLocked), () => false))

  return {
    isKeyPressed: () => Effect.sync(() => false),
    consumeKeyPress: () => Effect.sync(() => false),
    getMouseDelta: () =>
      Effect.sync(() => {
        const delta = { ...MutableRef.get(mouseDeltaRef) }
        MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
        return delta
      }),
    isMouseDown: () => Effect.sync(() => false),
    requestPointerLock: () =>
      Effect.sync(() => {
        MutableRef.set(pointerLockedRef, true)
      }),
    exitPointerLock: () =>
      Effect.sync(() => {
        MutableRef.set(pointerLockedRef, false)
      }),
    isPointerLocked: () => Effect.sync(() => MutableRef.get(pointerLockedRef)),
    consumeMouseClick: () => Effect.sync(() => false),
    consumeWheelDelta: () => Effect.sync(() => 0),
    setMouseDelta: (delta: MouseDelta) => {
      MutableRef.set(mouseDeltaRef, delta)
    },
    setPointerLocked: (locked: boolean) => {
      MutableRef.set(pointerLockedRef, locked)
    },
  } as unknown as InputServiceType & { setMouseDelta: (delta: MouseDelta) => void; setPointerLocked: (locked: boolean) => void }
}

const createTestLayers = (inputService: InputServiceType) =>
  Layer.merge(
    Layer.succeed(PlayerInputService, inputService as unknown as PlayerInputService),
    PlayerCameraStateLive
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
    })

    it.effect('should accumulate multiple updates', () => {
      const mouseDeltaRef = MutableRef.make({ x: 50, y: 25 })
      const inputService = {
        isKeyPressed: () => Effect.sync(() => false),
        consumeKeyPress: () => Effect.sync(() => false),
        getMouseDelta: () =>
          Effect.sync(() => {
            const delta = { ...MutableRef.get(mouseDeltaRef) }
            MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
            return delta
          }),
        isMouseDown: () => Effect.sync(() => false),
        requestPointerLock: () => Effect.sync(() => {}),
        exitPointerLock: () => Effect.sync(() => {}),
        isPointerLocked: () => Effect.sync(() => true),
        consumeMouseClick: () => Effect.sync(() => false),
        consumeWheelDelta: () => Effect.sync(() => 0),
      } as unknown as InputServiceType
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
    })
  })

})
