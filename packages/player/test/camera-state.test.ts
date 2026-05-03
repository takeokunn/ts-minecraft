import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import { expect } from 'vitest'
import {
  PlayerCameraStateService,
  PlayerCameraStateLive,
  PITCH_MIN,
  PITCH_MAX,
  type CameraRotation,
} from '@ts-minecraft/player'

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

})
