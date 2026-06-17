import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import * as THREE from 'three'
import { TimeService } from '@ts-minecraft/game'
import { updateDayNightCycle, computeDaylightFactor, computeTerrainSunIntensity, resolveDayNightCycleState, TERRAIN_NIGHT_LIGHT_FLOOR, type DayNightLights } from '@ts-minecraft/game'
import { DeltaTimeSecs, type ColorPort, type MoonPhasePort } from '@ts-minecraft/core'
import type { SkyMaterialPort } from '@ts-minecraft/core'

// Lightweight stub for DayNightLights.
// Captures the clear color passed to renderer.setClearColor for assertions.
const makeFakeLights = (): DayNightLights & {
  capturedClearColor: MutableRef.MutableRef<Option.Option<ColorPort>>
} => {
  const capturedColorRef = MutableRef.make<Option.Option<ColorPort>>(Option.none())
  return {
    light: new THREE.DirectionalLight(0xffffff, 0),
    ambientLight: new THREE.AmbientLight(0xffffff, 0),
    renderer: {
      setClearColor: (color: ColorPort) => {
        MutableRef.set(capturedColorRef, Option.some(color))
      },
    },
    skyNight: new THREE.Color(0x000000),
    skyDay: new THREE.Color(0xffffff),
    skyCurrent: new THREE.Color(),
    sky: Option.none(),
    moon: Option.none(),
    capturedClearColor: capturedColorRef,
  }
}

const makeFakeMoon = () => {
  const state = { x: 0, y: 0, z: 0, phase: -1, visible: false, opacity: -1 }
  const port: MoonPhasePort = {
    setPosition: vi.fn((x: number, y: number, z: number) => {
      state.x = x
      state.y = y
      state.z = z
    }),
    setPhase: vi.fn((phase: number) => {
      state.phase = phase
    }),
    setVisible: vi.fn((visible: boolean) => {
      state.visible = visible
    }),
    setOpacity: vi.fn((opacity: number) => {
      state.opacity = opacity
    }),
  }
  return { state, port }
}

const DIRECT_LIGHT_MIN = 0.3
const DIRECT_LIGHT_RANGE = 0.7
const AMBIENT_LIGHT_MIN = 0.56
const AMBIENT_LIGHT_RANGE = 0.42

describe('application/time/day-night-cycle', () => {
  // The shared brightness curve used by BOTH the scene lights and the terrain shader.
  describe('computeDaylightFactor / computeTerrainSunIntensity (shared curve)', () => {
    it('is 1 at noon and 0 deep at night, 0.5 at dawn/dusk', () => {
      expect(computeDaylightFactor(0.5)).toBeCloseTo(1, 5)   // noon
      expect(computeDaylightFactor(0.0)).toBeCloseTo(0, 5)   // midnight
      expect(computeDaylightFactor(0.25)).toBeCloseTo(0.5, 5) // dawn
      expect(computeDaylightFactor(0.75)).toBeCloseTo(0.5, 5) // dusk
    })

    it('PLATEAUS through the day — bright well before and after noon (not a sharp sine peak)', () => {
      // mid-morning / mid-afternoon should already be (near) full daylight
      expect(computeDaylightFactor(0.40)).toBeGreaterThan(0.95)
      expect(computeDaylightFactor(0.60)).toBeGreaterThan(0.95)
    })

    it('terrain sun-intensity never drops below the moonlight floor (night stays readable)', () => {
      for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9]) {
        expect(computeTerrainSunIntensity(t)).toBeGreaterThanOrEqual(TERRAIN_NIGHT_LIGHT_FLOOR - 1e-9)
      }
      expect(computeTerrainSunIntensity(0.0)).toBeCloseTo(TERRAIN_NIGHT_LIGHT_FLOOR, 5) // midnight = floor
      expect(computeTerrainSunIntensity(0.5)).toBeCloseTo(1, 5)                          // noon = full
    })

    it('day→night transition is gradual (monotonic through dusk, no instant snap)', () => {
      // Sampling dusk→night, brightness must decrease monotonically (no sudden cliff to 0).
      const samples = [0.70, 0.74, 0.78, 0.82, 0.86, 0.90].map(computeTerrainSunIntensity)
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]! + 1e-9)
      }
      // And it bottoms out at the floor, not 0.
      expect(samples[samples.length - 1]!).toBeGreaterThanOrEqual(TERRAIN_NIGHT_LIGHT_FLOOR - 1e-9)
    })
  })

  describe('resolveDayNightCycleState', () => {
    it('derives the sun arc and moon state from the same time-of-day input', () => {
      const noon = resolveDayNightCycleState(0.5)
      expect(noon.sunAngle).toBeCloseTo(Math.PI / 2, 5)
      expect(noon.cosSun).toBeCloseTo(0, 5)
      expect(noon.sinSun).toBeCloseTo(1, 5)
      expect(noon.dayFactor).toBeCloseTo(1, 5)
      expect(noon.horizonBlend).toBeCloseTo(0, 5)
      expect(noon.moonElevation).toBeCloseTo(-1, 5)
      expect(noon.moonOpacity).toBeCloseTo(0, 5)

      const dawn = resolveDayNightCycleState(0.25)
      expect(dawn.sunAngle).toBeCloseTo(0, 5)
      expect(dawn.cosSun).toBeCloseTo(1, 5)
      expect(dawn.sinSun).toBeCloseTo(0, 5)
      expect(dawn.dayFactor).toBeCloseTo(0.5, 5)
      expect(dawn.horizonBlend).toBeCloseTo(0.5, 5)
      expect(dawn.moonElevation).toBeCloseTo(0, 5)
      expect(dawn.moonOpacity).toBeCloseTo(0, 5)
    })
  })

  describe('updateDayNightCycle — noon (timeOfDay=0.5)', () => {
    it.effect('should give maximum direct light intensity at noon', () =>
      // dayFactor = sin((0.5 - 0.25) * π * 2) = sin(π/2) = 1.0
      // direct intensity = 0.3 + 1.0 * 0.7 = 1.0
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.light.intensity).toBeCloseTo(DIRECT_LIGHT_MIN + DIRECT_LIGHT_RANGE, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should give maximum ambient light intensity at noon', () =>
      // dayFactor = 1.0
      // ambient intensity = 0.28 + 1.0 * 0.42 = 0.7
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.ambientLight.intensity).toBeCloseTo(AMBIENT_LIGHT_MIN + AMBIENT_LIGHT_RANGE, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('updateDayNightCycle — sun position arc', () => {
    // Returns the directional light's world position after running the cycle at
    // the given time-of-day fraction (deltaTime 0 so the set time is preserved).
    const sunPosAt = (fraction: number) =>
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(fraction)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        return lights.light.position
      }).pipe(Effect.provide(TimeService.Default))

    it.effect('sun is directly overhead at noon (x≈0, above horizon)', () =>
      Effect.gen(function* () {
        const p = yield* sunPosAt(0.5)
        expect(p.x).toBeCloseTo(0, 5) // overhead, not off to one side
        expect(p.y).toBeGreaterThan(0)
      })
    )

    it.effect('sun rises in the east at dawn (x>0, on the horizon)', () =>
      Effect.gen(function* () {
        const p = yield* sunPosAt(0.25)
        expect(p.x).toBeGreaterThan(0)
        expect(p.y).toBeCloseTo(0, 5)
      })
    )

    it.effect('sun sets in the west at dusk (x<0, on the horizon)', () =>
      Effect.gen(function* () {
        const p = yield* sunPosAt(0.75)
        expect(p.x).toBeLessThan(0)
        expect(p.y).toBeCloseTo(0, 5)
      })
    )

    it.effect('sun is below the horizon at midnight (y<0)', () =>
      Effect.gen(function* () {
        const p = yield* sunPosAt(0.0)
        expect(p.y).toBeLessThan(0)
      })
    )

    // Regression: the arc previously used ×π (not ×2π) for the position, which
    // put the sun's PEAK at dusk instead of noon. The sun must be higher at
    // noon than at dusk.
    it.effect('sun is higher at noon than at dusk', () =>
      Effect.gen(function* () {
        const noonY = (yield* sunPosAt(0.5)).y
        const duskY = (yield* sunPosAt(0.75)).y
        expect(noonY).toBeGreaterThan(duskY)
      })
    )
  })

  describe('updateDayNightCycle — midnight (timeOfDay=0.0)', () => {
    it.effect('should give minimum direct light intensity at midnight', () =>
      // dayFactor = max(0, sin((0.0 - 0.25) * π * 2)) = max(0, sin(-π/2)) = max(0, -1) = 0
      // direct intensity = 0.3 + 0 * 0.7 = 0.3
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.light.intensity).toBeCloseTo(DIRECT_LIGHT_MIN, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should give minimum ambient light intensity at midnight', () =>
      // dayFactor = 0 → ambient = 0.28
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.ambientLight.intensity).toBeCloseTo(AMBIENT_LIGHT_MIN, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('updateDayNightCycle — dawn (timeOfDay=0.25)', () => {
    // Dawn/dusk sit at the CENTRE of the twilight band (sinSun = 0), so the
    // smoothstep daylight curve yields exactly dayFactor = 0.5 — a half-lit
    // twilight, NOT the full darkness the old raw-sine model produced. This is the
    // "dusk looked pitch-black" regression guard: the light must be strictly
    // between night-minimum and noon-maximum.
    const TWILIGHT_DAY_FACTOR = 0.5

    it.effect('should give twilight (half) direct light intensity at dawn', () =>
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.25)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.light.intensity).toBeCloseTo(DIRECT_LIGHT_MIN + TWILIGHT_DAY_FACTOR * DIRECT_LIGHT_RANGE, 5)
        expect(lights.light.intensity).toBeGreaterThan(DIRECT_LIGHT_MIN)
        expect(lights.light.intensity).toBeLessThan(DIRECT_LIGHT_MIN + DIRECT_LIGHT_RANGE)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should give twilight (half) ambient light intensity at dawn', () =>
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.25)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.ambientLight.intensity).toBeCloseTo(AMBIENT_LIGHT_MIN + TWILIGHT_DAY_FACTOR * AMBIENT_LIGHT_RANGE, 5)
        expect(lights.ambientLight.intensity).toBeGreaterThan(AMBIENT_LIGHT_MIN)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('updateDayNightCycle — dusk (timeOfDay=0.75)', () => {
    const TWILIGHT_DAY_FACTOR = 0.5

    it.effect('should give twilight (half) direct light intensity at dusk, not darkness', () =>
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.75)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(lights.light.intensity).toBeCloseTo(DIRECT_LIGHT_MIN + TWILIGHT_DAY_FACTOR * DIRECT_LIGHT_RANGE, 4)
        // Regression: the old model collapsed dusk to DIRECT_LIGHT_MIN (pitch black).
        expect(lights.light.intensity).toBeGreaterThan(DIRECT_LIGHT_MIN + 0.2)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('updateDayNightCycle — advanceTick is called', () => {
    it.effect('should advance time when deltaTime > 0', () =>
      // Verify that updateDayNightCycle calls advanceTick by observing that
      // getTimeOfDay changes after two calls with non-zero deltaTime.
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)

        const before = yield* timeService.getTimeOfDay()
        const lights = makeFakeLights()
        // deltaTime = 1 second → adds 60 ticks
        yield* updateDayNightCycle(1 as DeltaTimeSecs, lights, timeService)
        const after = yield* timeService.getTimeOfDay()

        expect(after).toBeGreaterThan(before)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should not advance time when deltaTime is 0', () =>
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)

        const before = yield* timeService.getTimeOfDay()
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        const after = yield* timeService.getTimeOfDay()

        expect(after).toBeCloseTo(before, 10)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('updateDayNightCycle — moon phase', () => {
    it.effect('sets the phase and shows the moon at midnight', () =>
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(120)
        yield* timeService.setTimeOfDay(0)
        yield* timeService.advanceTick(DeltaTimeSecs.make(120 * 3))
        const moon = makeFakeMoon()
        const lights = { ...makeFakeLights(), moon: Option.some(moon.port) }

        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)

        expect(moon.state.phase).toBe(3)
        expect(moon.state.visible).toBe(true)
        expect(moon.state.opacity).toBeCloseTo(1, 5)
        expect(moon.state.y).toBeGreaterThan(0)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('hides the moon at noon', () =>
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(120)
        yield* timeService.setTimeOfDay(0.5)
        const moon = makeFakeMoon()
        const lights = { ...makeFakeLights(), moon: Option.some(moon.port) }

        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)

        expect(moon.state.visible).toBe(false)
        expect(moon.state.opacity).toBeCloseTo(0, 5)
        expect(moon.state.y).toBeLessThan(0)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('updateDayNightCycle — sky color interpolation', () => {
    it.effect('should call setClearColor at midnight (sky near black)', () =>
      // dayFactor = 0 → lerpColors(black, white, 0) = black → r≈0, g≈0, b≈0
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(Option.isSome(MutableRef.get(lights.capturedClearColor))).toBe(true)
        // skyCurrent after lerpColors(black, white, 0) = black
        expect(lights.skyCurrent.r).toBeCloseTo(0, 3)
        expect(lights.skyCurrent.g).toBeCloseTo(0, 3)
        expect(lights.skyCurrent.b).toBeCloseTo(0, 3)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should call setClearColor at noon (sky near white)', () =>
      // dayFactor = 1.0 → lerpColors(black, white, 1) = white → r≈1, g≈1, b≈1
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)
        const lights = makeFakeLights()
        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(Option.isSome(MutableRef.get(lights.capturedClearColor))).toBe(true)
        expect(lights.skyCurrent.r).toBeCloseTo(1, 3)
        expect(lights.skyCurrent.g).toBeCloseTo(1, 3)
        expect(lights.skyCurrent.b).toBeCloseTo(1, 3)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should also set clearColor when the physical sky is enabled', () =>
      Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)
        yield* timeService.setTimeOfDay(0.5)

        const fakeSky: SkyMaterialPort = {
          uniforms: {
            sunPosition: { value: { set: (_x: number, _y: number, _z: number) => {} } },
            turbidity: { value: 0 },
            rayleigh: { value: 0 },
          },
        }

        const lights = {
          ...makeFakeLights(),
          sky: Option.some(fakeSky),
        }

        yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
        expect(Option.isSome(MutableRef.get(lights.capturedClearColor))).toBe(true)
        expect(fakeSky.uniforms.turbidity.value).toBeGreaterThan(0)
        expect(fakeSky.uniforms.rayleigh.value).toBeGreaterThan(0)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('updateDayNightCycle — dayFactor clamping', () => {
    it.effect('should never produce negative intensities (dayFactor always >= 0)', () => {
      // Test multiple night-time values to confirm no negative intensities
      const nightTimes = [0, 0.1, 0.9, 0.95, 0.99]
      return Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)

        yield* Effect.forEach(nightTimes, (t) =>
          Effect.gen(function* () {
            yield* timeService.setTimeOfDay(t)
            const lights = makeFakeLights()
            yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
            expect(lights.light.intensity).toBeGreaterThanOrEqual(DIRECT_LIGHT_MIN)
            expect(lights.ambientLight.intensity).toBeGreaterThanOrEqual(AMBIENT_LIGHT_MIN)
          })
        , { concurrency: 1 })
      }).pipe(Effect.provide(TimeService.Default))
    })

    it.effect('should produce intensities no greater than max (DIRECT_LIGHT_MIN + DIRECT_LIGHT_RANGE)', () => {
      const dayTimes = [0.25, 0.375, 0.5, 0.625, 0.75]
      return Effect.gen(function* () {
        const timeService = yield* TimeService
        yield* timeService.setDayLength(400)

        yield* Effect.forEach(dayTimes, (t) =>
          Effect.gen(function* () {
            yield* timeService.setTimeOfDay(t)
            const lights = makeFakeLights()
            yield* updateDayNightCycle(0 as DeltaTimeSecs, lights, timeService)
            expect(lights.light.intensity).toBeLessThanOrEqual(
              DIRECT_LIGHT_MIN + DIRECT_LIGHT_RANGE + 1e-9
            )
            expect(lights.ambientLight.intensity).toBeLessThanOrEqual(
              AMBIENT_LIGHT_MIN + AMBIENT_LIGHT_RANGE + 1e-9
            )
          })
        , { concurrency: 1 })
      }).pipe(Effect.provide(TimeService.Default))
    })
  })
})
