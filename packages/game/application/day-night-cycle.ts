import { Effect, Option } from 'effect'
import { TimeService } from './time-service'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { DayNightLightsPort } from '@ts-minecraft/core'

const DAWN_PHASE_OFFSET = 0.25   // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
const DIRECT_LIGHT_MIN = 0.3
const DIRECT_LIGHT_RANGE = 0.7
// Night ambient floor raised (0.28 → 0.42): combined with the terrain moonlight floor
// below, this keeps the night readable instead of pitch-black ('夜がくらすぎる').
const AMBIENT_LIGHT_MIN = 0.42
const AMBIENT_LIGHT_RANGE = 0.42
const SUN_DISTANCE = 50
const SUN_HEIGHT = 80
// Half-width (in sun-elevation units, sinSun ∈ [-1,1]) of the dawn/dusk twilight band
// over which daylight ramps between night and full day. Widened 0.18 → 0.30 (sun within
// ~17° of the horizon) so dusk/dawn last longer and night arrives gradually instead of
// snapping dark ('急に夜になる').
const TWILIGHT_BAND = 0.30

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const smoothstep01 = (t: number): number => {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}

// Daylight factor 0..1 from the sun's elevation (sinSun): 0 deep night, 1 full day,
// smooth eased ramp through the twilight band. The SINGLE source of the day/night
// brightness curve — shared by the scene light intensities (below) AND the terrain/water
// shader sun-intensity (lighting-stage). Previously the terrain used its own raw
// `max(0, sin)` which dropped to 0 at night, so terrain darkened suddenly at dusk and
// went black at night regardless of this curve.
const daylightFromElevation = (sinSun: number): number =>
  smoothstep01((sinSun + TWILIGHT_BAND) / (2 * TWILIGHT_BAND))

export const computeDaylightFactor = (timeOfDay: number): number =>
  daylightFromElevation(Math.sin((timeOfDay - DAWN_PHASE_OFFSET) * Math.PI * 2))

// Moonlight floor for the terrain/water shader: at night the sun-intensity never reaches
// 0, so block faces stay dimly lit (readable) rather than black. 0 → full day = [floor, 1].
export const TERRAIN_NIGHT_LIGHT_FLOOR = 0.30
export const computeTerrainSunIntensity = (timeOfDay: number): number =>
  TERRAIN_NIGHT_LIGHT_FLOOR + (1 - TERRAIN_NIGHT_LIGHT_FLOOR) * computeDaylightFactor(timeOfDay)

// Sky turbidity and rayleigh: tuned for natural appearance (lower = cleaner/less hazy)
const SKY_TURBIDITY_DAY = 2
const SKY_TURBIDITY_HORIZON = 4
const SKY_RAYLEIGH_DAY = 3
const SKY_RAYLEIGH_NIGHT = 0.5

export type { DayNightLightsPort as DayNightLights }

// The End: deep void black with faint purple ambient, no sun.
export const applyEndEnvironment = (lights: DayNightLightsPort): void => {
  lights.light.intensity = 0
  lights.ambientLight.intensity = 0.15
  lights.ambientLight.color.setHSL(0.8, 0.5, 0.25)  // deep purple
  lights.skyCurrent.setHSL(0.8, 0.3, 0.02)           // near-black void
  lights.renderer.setClearColor(lights.skyCurrent)
}

// Fixed nether lighting — called after updateDayNightCycle so time still advances,
// but the visual result is always dark red regardless of time-of-day.
export const applyNetherEnvironment = (lights: DayNightLightsPort): void => {
  lights.light.intensity = 0              // no sun in the nether
  lights.ambientLight.intensity = 0.2
  lights.ambientLight.color.setHSL(0.04, 0.8, 0.3)   // dark orange-red ambient
  lights.skyCurrent.setHSL(0.02, 0.9, 0.04)           // near-black red background
  lights.renderer.setClearColor(lights.skyCurrent)
}

export const updateDayNightCycle = (
  deltaTime: DeltaTimeSecs,
  lights: DayNightLightsPort,
  timeService: TimeService,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    yield* timeService.advanceTick(deltaTime)
    const timeOfDay = yield* timeService.getTimeOfDay()

    // Directional light follows a semicircular arc east→zenith→west across the
    // day. sunAngle spans 0 (dawn, east horizon) → π/2 (noon, overhead) → π
    // (dusk, west horizon), and goes negative / past π at night (sun below the
    // horizon). The ×2 matches dayFactor's full-cycle scaling so the sun peaks
    // exactly at noon — not at dusk, as the prior ×π (only reaching π/2 at dusk)
    // incorrectly did.
    const sunAngle = (timeOfDay - DAWN_PHASE_OFFSET) * Math.PI * 2  // 0 at dawn, π/2 at noon, π at dusk
    // Pre-compute trig for sunAngle — reused 3× below (light position + sky sunPos).
    const cosSun = Math.cos(sunAngle)
    const sinSun = Math.sin(sunAngle)
    // sinSun is the sun's elevation above the horizon: -1 at midnight, 0 at
    // dawn/dusk, +1 at noon. dayFactor plateaus through the day and eases through
    // the twilight band (see daylightFromElevation) — the SAME curve the terrain
    // shader uses, so scene lighting and terrain brightness stay in lockstep.
    const dayFactor = daylightFromElevation(sinSun)

    yield* Effect.sync(() => {
      lights.light.intensity = DIRECT_LIGHT_MIN + dayFactor * DIRECT_LIGHT_RANGE
      lights.light.position.set(cosSun * SUN_DISTANCE, sinSun * SUN_HEIGHT, 0)

      // Ambient light dims at night
      lights.ambientLight.intensity = AMBIENT_LIGHT_MIN + dayFactor * AMBIENT_LIGHT_RANGE

      // Directional light color temperature:
      // - horizon (dayFactor ≈ 0): warm orange
      // - noon (dayFactor = 1): white
      // The horizonBlend peaks when dayFactor is low (near horizon transitions)
      const horizonBlend = 1.0 - dayFactor
      lights.light.color.setHSL(
        0.06 - horizonBlend * 0.04,  // hue: ~0.06 (orange) near horizon → ~0.02 at night
        horizonBlend * 0.9,           // saturation: highly saturated at horizon, white at noon
        0.5 + dayFactor * 0.5,       // lightness: 0.5 at horizon, 1.0 at noon
      )

      // Ambient light at night takes a cool blue tint
      if (dayFactor < 0.1) {
        lights.ambientLight.color.setHSL(0.6, 0.35, 0.42)  // cool blue at night
      } else {
        lights.ambientLight.color.setHSL(0.06, horizonBlend * 0.3, 0.5 + dayFactor * 0.3)
      }

      lights.skyCurrent.lerpColors(lights.skyNight, lights.skyDay, dayFactor)
      lights.renderer.setClearColor(lights.skyCurrent)

      const sky = Option.getOrNull(lights.sky)
      if (sky !== null) {
        sky.uniforms.sunPosition.value.set(cosSun * SUN_DISTANCE, sinSun * SUN_HEIGHT, 0)
        // Turbidity increases near horizon (hazy at dawn/dusk)
        sky.uniforms.turbidity.value = SKY_TURBIDITY_DAY + (1 - dayFactor) * (SKY_TURBIDITY_HORIZON - SKY_TURBIDITY_DAY)
        sky.uniforms.rayleigh.value = SKY_RAYLEIGH_NIGHT + dayFactor * (SKY_RAYLEIGH_DAY - SKY_RAYLEIGH_NIGHT)
      }
    })
  })
