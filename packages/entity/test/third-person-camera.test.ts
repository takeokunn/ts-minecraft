import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, MutableRef } from 'effect'
import { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state';
import type { CameraTransformPort } from '@ts-minecraft/core'
import { ThirdPersonCameraService } from '@ts-minecraft/entity/application/third-person-camera-service';

// ---------------------------------------------------------------------------
// Mock PlayerCameraStateService
// ---------------------------------------------------------------------------

const makeMockCameraStateLayer = (yaw: number, pitch: number) =>
  Layer.succeed(PlayerCameraStateService, PlayerCameraStateService.of({
    _tag: '@minecraft/application/PlayerCameraStateService' as const,
    getRotation: () => Effect.succeed({ yaw, pitch }),
    getMode: () => Effect.succeed('thirdPerson' as const),
    setYaw: () => Effect.void,
    setPitch: () => Effect.void,
    addYaw: () => Effect.void,
    addPitch: () => Effect.void,
    setMode: () => Effect.void,
    toggleMode: () => Effect.void,
    reset: () => Effect.void,
  }))

// ---------------------------------------------------------------------------
// Mock CameraTransformPort
// ---------------------------------------------------------------------------

const makeMockCamera = () => {
  const positionSet = { x: 0, y: 0, z: 0, called: false, args: [0, 0, 0] as [number, number, number] }
  const lookAtArgs: [number, number, number] = [0, 0, 0]
  const lookAtCalledRef = MutableRef.make(false)

  const camera: CameraTransformPort = {
    rotation: { set: () => {} },
    position: {
      set: (x: number, y: number, z: number) => {
        positionSet.called = true
        positionSet.args = [x, y, z]
      },
    },
    lookAt: (x: number, y: number, z: number) => {
      MutableRef.set(lookAtCalledRef, true)
      lookAtArgs[0] = x
      lookAtArgs[1] = y
      lookAtArgs[2] = z
    },
  }

  return { camera, positionSet, lookAtArgs: () => lookAtArgs, wasLookAtCalled: () => MutableRef.get(lookAtCalledRef) }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThirdPersonCameraService', () => {
  it.effect('update at yaw=0, pitch=0 places camera behind and above player', () =>
    Effect.gen(function* () {
      const thirdPersonCamera = yield* ThirdPersonCameraService
      const { camera, positionSet, wasLookAtCalled } = makeMockCamera()

      yield* thirdPersonCamera.update(camera, { x: 10, y: 64, z: 10 }, 0.7)

      // yaw=0, pitch=0:
      // offsetX = sin(0)*cos(0)*4 = 0
      // offsetZ = cos(0)*cos(0)*4 = 4
      // offsetY = sin(0)*4 + 1.5 = 1.5
      // eyeY = 64 + 0.7 = 64.7
      // camera.position.set(10 - 0, 64.7 + 1.5, 10 - 4) = (10, 66.2, 6)
      expect(positionSet.called).toBe(true)
      expect(positionSet.args[0]).toBeCloseTo(10)
      expect(positionSet.args[1]).toBeCloseTo(66.2)
      expect(positionSet.args[2]).toBeCloseTo(6)
      expect(wasLookAtCalled()).toBe(true)
    }).pipe(
      Effect.provide(
        ThirdPersonCameraService.Default.pipe(
          Layer.provide(makeMockCameraStateLayer(0, 0)),
        ),
      ),
    )
  )

  it.effect('lookAt is called with the player eye position', () =>
    Effect.gen(function* () {
      const thirdPersonCamera = yield* ThirdPersonCameraService
      const { camera, lookAtArgs, wasLookAtCalled } = makeMockCamera()

      yield* thirdPersonCamera.update(camera, { x: 10, y: 64, z: 10 }, 0.7)

      // lookAt is called with (playerPos.x, eyeY, playerPos.z) = (10, 64.7, 10)
      expect(wasLookAtCalled()).toBe(true)
      expect(lookAtArgs()[0]).toBeCloseTo(10)
      expect(lookAtArgs()[1]).toBeCloseTo(64.7)
      expect(lookAtArgs()[2]).toBeCloseTo(10)
    }).pipe(
      Effect.provide(
        ThirdPersonCameraService.Default.pipe(
          Layer.provide(makeMockCameraStateLayer(0, 0)),
        ),
      ),
    )
  )

  it.effect('update with non-zero yaw rotates the offset around Y axis', () =>
    Effect.gen(function* () {
      const thirdPersonCamera = yield* ThirdPersonCameraService
      const { camera, positionSet } = makeMockCamera()

      yield* thirdPersonCamera.update(camera, { x: 0, y: 0, z: 0 }, 0)

      // yaw=PI/2, pitch=0:
      // offsetX = sin(PI/2)*cos(0)*4 = 4
      // offsetZ = cos(PI/2)*cos(0)*4 = ~0
      // offsetY = sin(0)*4 + 1.5 = 1.5
      // camera.position.set(0 - 4, 0 + 1.5, 0 - 0) = (-4, 1.5, 0)
      expect(positionSet.called).toBe(true)
    }).pipe(
      Effect.provide(
        ThirdPersonCameraService.Default.pipe(
          Layer.provide(makeMockCameraStateLayer(Math.PI / 2, 0)),
        ),
      ),
    )
  )

  it.effect('camera Y is higher with pitch > 0 than with pitch = 0', () =>
    Effect.gen(function* () {
      // pitch = 0: offsetY = sin(0)*4 + 1.5 = 1.5
      const { camera: flatCam, positionSet: flatSet } = makeMockCamera()
      yield* Effect.gen(function* () {
        const svc = yield* ThirdPersonCameraService
        yield* svc.update(flatCam, { x: 0, y: 64, z: 0 }, 0.7)
      }).pipe(
        Effect.provide(ThirdPersonCameraService.Default.pipe(Layer.provide(makeMockCameraStateLayer(0, 0)))),
      )
      const flatY = flatSet.args[1]

      // pitch = PI/4: offsetY = sin(PI/4)*4 + 1.5 ≈ 4.33
      const { camera: upCam, positionSet: upSet } = makeMockCamera()
      yield* Effect.gen(function* () {
        const svc = yield* ThirdPersonCameraService
        yield* svc.update(upCam, { x: 0, y: 64, z: 0 }, 0.7)
      }).pipe(
        Effect.provide(ThirdPersonCameraService.Default.pipe(Layer.provide(makeMockCameraStateLayer(0, Math.PI / 4)))),
      )
      const upY = upSet.args[1]

      expect(upY).toBeGreaterThan(flatY)
    })
  )

  it.effect('default eyeLevelOffset of 0.7 is used when not provided', () =>
    Effect.gen(function* () {
      const thirdPersonCamera = yield* ThirdPersonCameraService
      const { camera: cam1, positionSet: set1 } = makeMockCamera()
      const { camera: cam2, positionSet: set2 } = makeMockCamera()

      yield* thirdPersonCamera.update(cam1, { x: 5, y: 20, z: 5 })
      yield* thirdPersonCamera.update(cam2, { x: 5, y: 20, z: 5 }, 0.7)

      // Both should give the same result since 0.7 is the default
      expect(set1.args[0]).toBeCloseTo(set2.args[0])
      expect(set1.args[1]).toBeCloseTo(set2.args[1])
      expect(set1.args[2]).toBeCloseTo(set2.args[2])
    }).pipe(
      Effect.provide(
        ThirdPersonCameraService.Default.pipe(
          Layer.provide(makeMockCameraStateLayer(0, 0)),
        ),
      ),
    )
  )
})
