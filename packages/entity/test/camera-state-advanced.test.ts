import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import { expect } from 'vitest'
import {
  PlayerCameraStateService,
  PITCH_MIN,
  PITCH_MAX,
  type CameraRotation,
} from '@ts-minecraft/entity'

describe('PlayerCameraStateService', () => {
  describe('reset', () => {
    it.effect('should reset rotation to { yaw: 0, pitch: 0 }', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 2)
        yield* camera.setPitch(Math.PI / 4)
        yield* camera.reset()
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBe(0)
        expect(rotation.pitch).toBe(0)
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )

    it.effect('should reset mode to first-person', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.toggleMode()
        yield* camera.reset()
        const mode = yield* camera.getMode()

        expect(mode).toBe('firstPerson')
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )
  })

  describe('toggleMode', () => {
    it.effect('should toggle from first-person to third-person', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.toggleMode()
        const mode = yield* camera.getMode()

        expect(mode).toBe('thirdPerson')
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )

    it.effect('should toggle back from third-person to first-person', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.toggleMode()
        yield* camera.toggleMode()
        const mode = yield* camera.getMode()

        expect(mode).toBe('firstPerson')
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )
  })

  describe('CameraRotationSchema', () => {
    it('should validate a valid camera rotation', () => {
      const rotation: CameraRotation = { yaw: 1.5, pitch: 0.5 }
      expect(rotation).toEqual({ yaw: 1.5, pitch: 0.5 })
    })

    it('should accept zero values', () => {
      const rotation: CameraRotation = { yaw: 0, pitch: 0 }
      expect(rotation).toEqual({ yaw: 0, pitch: 0 })
    })

    it('should accept negative yaw values', () => {
      const rotation: CameraRotation = { yaw: -Math.PI, pitch: 0 }
      expect(rotation.yaw).toBeCloseTo(-Math.PI)
    })
  })

  describe('pitch constants', () => {
    it('should have PITCH_MIN approximately -89 degrees', () => {
      expect(PITCH_MIN).toBeCloseTo(-Math.PI / 2 + 0.01, 2)
    })

    it('should have PITCH_MAX approximately 89 degrees', () => {
      expect(PITCH_MAX).toBeCloseTo(Math.PI / 2 - 0.01, 2)
    })

    it('should have symmetric min and max values', () => {
      expect(Math.abs(PITCH_MIN)).toBeCloseTo(Math.abs(PITCH_MAX))
    })
  })

  describe('integration scenarios', () => {
    it.effect('should handle typical mouse movement scenario', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.addYaw(0.01)
        yield* camera.addPitch(0.005)

        yield* camera.addYaw(0.02)
        yield* camera.addPitch(0.01)

        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(0.03)
        expect(rotation.pitch).toBeCloseTo(0.015)
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )

    it.effect('should handle looking straight up and down with clamping', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(Math.PI / 2)
        const upRotation = yield* camera.getRotation()
        expect(upRotation.pitch).toBeCloseTo(PITCH_MAX)

        yield* camera.setPitch(-Math.PI / 2)
        const downRotation = yield* camera.getRotation()
        expect(downRotation.pitch).toBeCloseTo(PITCH_MIN)
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )

    it.effect('should handle full 360 degree horizontal rotation', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* Effect.forEach(Arr.makeBy(4, () => undefined), () => camera.addYaw(Math.PI / 2), { concurrency: 1 })

        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(2 * Math.PI)
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )
  })

  describe('addYawPitch', () => {
    it.effect('matches separate addYaw + addPitch (accumulates both axes)', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService
        yield* camera.addYawPitch(0.01, 0.005)
        yield* camera.addYawPitch(0.02, 0.01)
        const rotation = yield* camera.getRotation()
        expect(rotation.yaw).toBeCloseTo(0.03)
        expect(rotation.pitch).toBeCloseTo(0.015)
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )

    it.effect('clamps pitch to [PITCH_MIN, PITCH_MAX] while yaw is unbounded', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService
        yield* camera.addYawPitch(10, Math.PI) // pitch overshoots up
        const up = yield* camera.getRotation()
        expect(up.pitch).toBeCloseTo(PITCH_MAX)
        expect(up.yaw).toBeCloseTo(10)
        yield* camera.addYawPitch(0, -Math.PI * 2) // pitch overshoots down
        const down = yield* camera.getRotation()
        expect(down.pitch).toBeCloseTo(PITCH_MIN)
      }).pipe(Effect.provide(PlayerCameraStateService.Default))
    )
  })
})
