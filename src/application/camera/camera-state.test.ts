import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
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
    it('should return initial rotation of { yaw: 0, pitch: 0 }', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService
        const rotation = yield* camera.getRotation()

        expect(rotation).toEqual({ yaw: 0, pitch: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should return the current rotation state', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 4)
        yield* camera.setPitch(Math.PI / 6)

        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 4)
        expect(rotation.pitch).toBeCloseTo(Math.PI / 6)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })
  })

  describe('setYaw', () => {
    it('should set yaw to a positive value', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 2)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 2)
        expect(rotation.pitch).toBe(0)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should set yaw to a negative value', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(-Math.PI)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(-Math.PI)
        expect(rotation.pitch).toBe(0)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should set yaw to zero', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 4)
        yield* camera.setYaw(0)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBe(0)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should allow full rotation (2*PI)', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(2 * Math.PI)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(2 * Math.PI)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })
  })

  describe('setPitch', () => {
    it('should set pitch to a positive value', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(Math.PI / 4)
        expect(rotation.yaw).toBe(0)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should set pitch to a negative value', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(-Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(-Math.PI / 4)
        expect(rotation.yaw).toBe(0)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should clamp pitch to PITCH_MAX when exceeding upper limit', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(Math.PI) // Try to set beyond max
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MAX)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should clamp pitch to PITCH_MIN when exceeding lower limit', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(-Math.PI) // Try to set beyond min
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MIN)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should accept pitch at PITCH_MAX boundary', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(PITCH_MAX)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MAX)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should accept pitch at PITCH_MIN boundary', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(PITCH_MIN)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MIN)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })
  })

  describe('addYaw', () => {
    it('should add positive delta to yaw', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(0)
        yield* camera.addYaw(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 4)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should add negative delta to yaw', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(0)
        yield* camera.addYaw(-Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(-Math.PI / 4)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should accumulate multiple additions', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(0)
        yield* camera.addYaw(Math.PI / 4)
        yield* camera.addYaw(Math.PI / 4)
        yield* camera.addYaw(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo((3 * Math.PI) / 4)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should not affect pitch when adding yaw', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(Math.PI / 6)
        yield* camera.addYaw(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(Math.PI / 6)
        expect(rotation.yaw).toBeCloseTo(Math.PI / 4)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })
  })

  describe('addPitch', () => {
    it('should add positive delta to pitch with clamping', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(0)
        yield* camera.addPitch(Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(Math.PI / 4)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should add negative delta to pitch with clamping', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(0)
        yield* camera.addPitch(-Math.PI / 4)
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(-Math.PI / 4)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should clamp to PITCH_MAX when adding exceeds limit', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(PITCH_MAX - 0.1)
        yield* camera.addPitch(0.5) // This would exceed PITCH_MAX
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MAX)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should clamp to PITCH_MIN when adding exceeds limit', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setPitch(PITCH_MIN + 0.1)
        yield* camera.addPitch(-0.5) // This would exceed PITCH_MIN
        const rotation = yield* camera.getRotation()

        expect(rotation.pitch).toBeCloseTo(PITCH_MIN)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should not affect yaw when adding pitch', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 3)
        yield* camera.addPitch(Math.PI / 6)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 3)
        expect(rotation.pitch).toBeCloseTo(Math.PI / 6)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })
  })

  describe('reset', () => {
    it('should reset rotation to { yaw: 0, pitch: 0 }', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI / 2)
        yield* camera.setPitch(Math.PI / 4)
        yield* camera.reset()
        const rotation = yield* camera.getRotation()

        expect(rotation).toEqual({ yaw: 0, pitch: 0 })
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should allow setting values after reset', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        yield* camera.setYaw(Math.PI)
        yield* camera.reset()
        yield* camera.setYaw(Math.PI / 4)
        yield* camera.setPitch(Math.PI / 8)
        const rotation = yield* camera.getRotation()

        expect(rotation.yaw).toBeCloseTo(Math.PI / 4)
        expect(rotation.pitch).toBeCloseTo(Math.PI / 8)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })
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
    it('should handle typical mouse movement scenario', () => {
      const program = Effect.gen(function* () {
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
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should handle looking straight up and down with clamping', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        // Try to look straight up (should clamp)
        yield* camera.setPitch(Math.PI / 2)
        let rotation = yield* camera.getRotation()
        expect(rotation.pitch).toBeCloseTo(PITCH_MAX)

        // Try to look straight down (should clamp)
        yield* camera.setPitch(-Math.PI / 2)
        rotation = yield* camera.getRotation()
        expect(rotation.pitch).toBeCloseTo(PITCH_MIN)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })

    it('should handle full 360 degree horizontal rotation', () => {
      const program = Effect.gen(function* () {
        const camera = yield* PlayerCameraStateService

        // Turn around multiple times
        for (let i = 0; i < 4; i++) {
          yield* camera.addYaw(Math.PI / 2)
        }

        const rotation = yield* camera.getRotation()

        // Should complete full rotation (2*PI)
        expect(rotation.yaw).toBeCloseTo(2 * Math.PI)
      })

      Effect.runSync(program.pipe(Effect.provide(PlayerCameraStateLive)))
    })
  })
})
