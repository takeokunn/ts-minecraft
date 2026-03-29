import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import { expect } from 'vitest'
import {
  PlayerCameraStateService,
  PlayerCameraStateLive,
  PITCH_MIN,
  PITCH_MAX,
  type CameraRotation,
} from './camera-state'

describe('PlayerCameraStateService', () => {
  describe('getRotation', () => {
    it.effect('should return initial rotation of { yaw: 0, pitch: 0 }', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService
        const rotation = yield* camera.getRotation()

        expect(rotation).toEqual({ yaw: 0, pitch: 0 })
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should return the current rotation state', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 4)
        yield* camera.setPitch(Math.PI / 6)

        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 4)
        expect(rotation.pitch).toBeCloseTo(Math.PI / 6)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )
  })

  describe('getMode', () => {
    it.effect('should return firstPerson by default', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService
        const mode = yield* camera.getMode()
        expect(mode).toBe('firstPerson')
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )
  })

  describe('setYaw', () => {
    it.effect('should set yaw to a positive value', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 2)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 2)
        expect(rotation.pitch).toBe(0)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should set yaw to a negative value', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(-Math.PI)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(-Math.PI)
        expect(rotation.pitch).toBe(0)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should set yaw to zero', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 4)
        yield* camera.setYaw(0)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBe(0)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should allow full rotation (2*PI)', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(2 * Math.PI)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(2 * Math.PI)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )
  })

  describe('setPitch', () => {
    it.effect('should set pitch to a positive value', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(Math.PI / 4)
        expect(rotation.yaw).toBe(0)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should set pitch to a negative value', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(-Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(-Math.PI / 4)
        expect(rotation.yaw).toBe(0)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should clamp pitch to PITCH_MAX when exceeding upper limit', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(Math.PI) // Try to set beyond max
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MAX)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should clamp pitch to PITCH_MIN when exceeding lower limit', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(-Math.PI) // Try to set beyond min
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MIN)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should accept pitch at PITCH_MAX boundary', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(PITCH_MAX)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MAX)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should accept pitch at PITCH_MIN boundary', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(PITCH_MIN)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MIN)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )
  })

  describe('addYaw', () => {
    it.effect('should add positive delta to yaw', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(0)
        yield* camera.addYaw(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 4)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should add negative delta to yaw', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(0)
        yield* camera.addYaw(-Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(-Math.PI / 4)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should accumulate multiple additions', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(0)
        yield* camera.addYaw(Math.PI / 4)
        yield* camera.addYaw(Math.PI / 4)
        yield* camera.addYaw(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo((3 * Math.PI) / 4)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should not affect pitch when adding yaw', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(Math.PI / 6)
        yield* camera.addYaw(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(Math.PI / 6)
        expect(rotation.yaw).toBeCloseTo(Math.PI / 4)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )
  })

  describe('addPitch', () => {
    it.effect('should add positive delta to pitch with clamping', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(0)
        yield* camera.addPitch(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(Math.PI / 4)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should add negative delta to pitch with clamping', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(0)
        yield* camera.addPitch(-Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(-Math.PI / 4)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should clamp to PITCH_MAX when adding exceeds limit', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(PITCH_MAX - 0.1)
        yield* camera.addPitch(0.5) // This would exceed PITCH_MAX
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MAX)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should clamp to PITCH_MIN when adding exceeds limit', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(PITCH_MIN + 0.1)
        yield* camera.addPitch(-0.5) // This would exceed PITCH_MIN
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MIN)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should not affect yaw when adding pitch', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 3)
        yield* camera.addPitch(Math.PI / 6)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 3)
        expect(rotation.pitch).toBeCloseTo(Math.PI / 6)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )
  })

  describe('reset', () => {
    it.effect('should reset rotation to { yaw: 0, pitch: 0 }', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 2)
        yield* camera.setPitch(Math.PI / 4)
        yield* camera.reset()
        const rotation = yield* camera.getRotation()

        expect(rotation).toEqual({ yaw: 0, pitch: 0 })
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should allow setting values after reset', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI)
        yield* camera.reset()
        yield* camera.setYaw(Math.PI / 4)
        yield* camera.setPitch(Math.PI / 8)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 4)
        expect(rotation.pitch).toBeCloseTo(Math.PI / 8)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should reset camera mode to firstPerson', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setMode('thirdPerson')
        yield* camera.reset()
        const mode = yield* camera.getMode()
        expect(mode).toBe('firstPerson')
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )
  })

  describe('toggleMode', () => {
    it.effect('should switch from firstPerson to thirdPerson and back', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        const first = yield* camera.getMode()
        yield* camera.toggleMode()
        const second = yield* camera.getMode()
        yield* camera.toggleMode()
        const third = yield* camera.getMode()

        expect(first).toBe('firstPerson')
        expect(second).toBe('thirdPerson')
        expect(third).toBe('firstPerson')
      }).pipe(Effect.provide(PlayerCameraStateLive))
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

        // Simulate mouse movement: right and up
        yield* camera.addYaw(0.01) // Mouse moved right
        yield* camera.addPitch(0.005) // Mouse moved up

        // More mouse movement
        yield* camera.addYaw(0.02)
        yield* camera.addPitch(0.01)

        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(0.03)
        expect(rotation.pitch).toBeCloseTo(0.015)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should handle looking straight up and down with clamping', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        // Try to look straight up (should clamp)
        yield* camera.setPitch(Math.PI / 2)
        let rotation = yield* camera.getRotation()
        expect(rotation.pitch).toBeCloseTo(PITCH_MAX)

        // Try to look straight down (should clamp)
        yield* camera.setPitch(-Math.PI / 2)
        rotation = yield* camera.getRotation()
        expect(rotation.pitch).toBeCloseTo(PITCH_MIN)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )

    it.effect('should handle full 360 degree horizontal rotation', () =>
      Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        // Turn around multiple times
        yield* Effect.forEach(Arr.makeBy(4, () => undefined), () => camera.addYaw(Math.PI / 2), { concurrency: 1 })

        const rotation = yield* camera.getRotation()

        // Should complete full rotation (2*PI)
        expect(rotation.yaw).toBeCloseTo(2 * Math.PI)
      }).pipe(Effect.provide(PlayerCameraStateLive))
    )
  })
})
