import { describe, it, expect } from 'vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { TimeService, TimeServiceLive } from '@/application/time/time-service'
import { updateDayNightCycle, type DayNightLights } from '@/application/time/day-night-cycle'
import type { DeltaTimeSecs } from '@/shared/kernel'

/**
 * Lightweight stub for DayNightLights.
 * Captures the clear color passed to renderer.setClearColor for assertions.
 */
const makeFakeLights = (): DayNightLights & {
  capturedClearColor: Option.Option<THREE.Color>
} => {
  let capturedColor: Option.Option<THREE.Color> = Option.none()
  return {
    light: {
      intensity: 0,
      position: { set: (_x: number, _y: number, _z: number) => {} },
      color: { setHSL: (_h: number, _s: number, _l: number) => {} },
    } as unknown as THREE.DirectionalLight,
    ambientLight: {
      intensity: 0,
      color: { setHSL: (_h: number, _s: number, _l: number) => {} },
    } as unknown as THREE.AmbientLight,
    renderer: {
      setClearColor: (color: THREE.Color) => {
        capturedColor = Option.some(color)
      },
    },
    skyNight: new THREE.Color(0x000000),
    skyDay: new THREE.Color(0xffffff),
    skyCurrent: new THREE.Color(),
    sky: Option.none(),
    get capturedClearColor() {
      return capturedColor
    },
  }
}

const DIRECT_LIGHT_MIN = 0.2
const DIRECT_LIGHT_RANGE = 0.8
const AMBIENT_LIGHT_MIN = 0.1
const AMBIENT_LIGHT_RANGE = 0.4

describe('application/time/day-night-cycle', () => {
  describe('updateDayNightCycle — noon (timeOfDay=0.5)', () => {
    it('should give maximum direct light intensity at noon', () => {
      // dayFactor = sin((0.5 - 0.25) * π * 2) = sin(π/2) = 1.0
      // direct intensity = 0.2 + 1.0 * 0.8 = 1.0
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.light.intensity).toBeCloseTo(DIRECT_LIGHT_MIN + DIRECT_LIGHT_RANGE, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should give maximum ambient light intensity at noon', () => {
      // dayFactor = 1.0
      // ambient intensity = 0.1 + 1.0 * 0.4 = 0.5
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.ambientLight.intensity).toBeCloseTo(AMBIENT_LIGHT_MIN + AMBIENT_LIGHT_RANGE, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('updateDayNightCycle — midnight (timeOfDay=0.0)', () => {
    it('should give minimum direct light intensity at midnight', () => {
      // dayFactor = max(0, sin((0.0 - 0.25) * π * 2)) = max(0, sin(-π/2)) = max(0, -1) = 0
      // direct intensity = 0.2 + 0 * 0.8 = 0.2
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.light.intensity).toBeCloseTo(DIRECT_LIGHT_MIN, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should give minimum ambient light intensity at midnight', () => {
      // dayFactor = 0 → ambient = 0.1
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.ambientLight.intensity).toBeCloseTo(AMBIENT_LIGHT_MIN, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('updateDayNightCycle — dawn (timeOfDay=0.25)', () => {
    it('should give minimum direct light intensity at dawn', () => {
      // dayFactor = max(0, sin((0.25 - 0.25) * π * 2)) = max(0, sin(0)) = 0
      // direct intensity = 0.2
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.25)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.light.intensity).toBeCloseTo(DIRECT_LIGHT_MIN, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should give minimum ambient light intensity at dawn', () => {
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.25)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.ambientLight.intensity).toBeCloseTo(AMBIENT_LIGHT_MIN, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('updateDayNightCycle — dusk (timeOfDay=0.75)', () => {
    it('should give minimum direct light intensity at dusk', () => {
      // dayFactor = max(0, sin((0.75 - 0.25) * π * 2)) = max(0, sin(π)) = max(0, ~0) = 0
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.75)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.light.intensity).toBeCloseTo(DIRECT_LIGHT_MIN, 4)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('updateDayNightCycle — advanceTick is called', () => {
    it('should advance time when deltaTime > 0', () => {
      // Verify that updateDayNightCycle calls advanceTick by observing that
      // getTimeOfDay changes after two calls with non-zero deltaTime.
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)

        const before = yield* timeService.getTimeOfDay()
        const lights = makeFakeLights()
        // deltaTime = 1 second → adds 60 ticks
        yield* updateDayNightCycle(1 as DeltaTimeSecs, lights, timeService)
        const after = yield* timeService.getTimeOfDay()

        expect(after).toBeGreaterThan(before)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should not advance time when deltaTime is 0', () => {
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)

        const before = yield* timeService.getTimeOfDay()
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        const after = yield* timeService.getTimeOfDay()

        expect(after).toBeCloseTo(before, 10)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('updateDayNightCycle — sky color interpolation', () => {
    it('should call setClearColor at midnight (sky near black)', () => {
      // dayFactor = 0 → lerpColors(black, white, 0) = black → r≈0, g≈0, b≈0
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(Option.isSome(lights.capturedClearColor)).toBe(true)
        // skyCurrent after lerpColors(black, white, 0) = black
        expect(lights.skyCurrent.r).toBeCloseTo(0, 3)
        expect(lights.skyCurrent.g).toBeCloseTo(0, 3)
        expect(lights.skyCurrent.b).toBeCloseTo(0, 3)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should call setClearColor at noon (sky near white)', () => {
      // dayFactor = 1.0 → lerpColors(black, white, 1) = white → r≈1, g≈1, b≈1
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(Option.isSome(lights.capturedClearColor)).toBe(true)
        expect(lights.skyCurrent.r).toBeCloseTo(1, 3)
        expect(lights.skyCurrent.g).toBeCloseTo(1, 3)
        expect(lights.skyCurrent.b).toBeCloseTo(1, 3)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('updateDayNightCycle — dayFactor clamping', () => {
    it('should never produce negative intensities (dayFactor always >= 0)', () => {
      // Test multiple night-time values to confirm no negative intensities
      const nightTimes = [0, 0.1, 0.9, 0.95, 0.99]
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)

        for (const t of nightTimes) {
          yield* timeService.setTimeOfDay(t)
          const lights = makeFakeLights()
          yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
          expect(lights.light.intensity).toBeGreaterThanOrEqual(DIRECT_LIGHT_MIN)
          expect(lights.ambientLight.intensity).toBeGreaterThanOrEqual(AMBIENT_LIGHT_MIN)
        }
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should produce intensities no greater than max (DIRECT_LIGHT_MIN + DIRECT_LIGHT_RANGE)', () => {
      const dayTimes = [0.25, 0.375, 0.5, 0.625, 0.75]
      const program = Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)

        for (const t of dayTimes) {
          yield* timeService.setTimeOfDay(t)
          const lights = makeFakeLights()
          yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
          expect(lights.light.intensity).toBeLessThanOrEqual(
            DIRECT_LIGHT_MIN + DIRECT_LIGHT_RANGE + 1e-9
          )
          expect(lights.ambientLight.intensity).toBeLessThanOrEqual(
            AMBIENT_LIGHT_MIN + AMBIENT_LIGHT_RANGE + 1e-9
          )
        }
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
