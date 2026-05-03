import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, MutableRef, Option } from 'effect'
import * as THREE from 'three'
import { PlayerInputService } from '@ts-minecraft/player'
import type { MouseDelta } from '@ts-minecraft/player'
import type { InputServicePort as InputServiceType } from '@ts-minecraft/player'
import { PlayerCameraStateService, PlayerCameraStateLive } from '@ts-minecraft/player'
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
  describe('integration scenarios', () => {
    it.effect('should handle typical mouse look sequence', () => {
      const mouseDeltaRef = MutableRef.make({ x: 0, y: 0 })
      const pointerLockedRef = MutableRef.make(false)

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
      } as unknown as InputServiceType
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
    })

    it.effect('should handle pointer lock/unlock during gameplay', () => {
      const mouseDeltaRef = MutableRef.make({ x: 100, y: 50 })
      const pointerLockedRef = MutableRef.make(true)

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
      } as unknown as InputServiceType
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
      }).pipe(Effect.provide(FirstPersonCameraServiceLive), Effect.provide(testLayers))
    })
  })
})
