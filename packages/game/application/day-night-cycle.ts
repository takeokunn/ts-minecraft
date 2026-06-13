import { Effect, Option } from 'effect'
import { TimeService } from './time-service'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { DayNightLightsPort } from '@ts-minecraft/core'

const DAWN_PHASE_OFFSET = 0.25   // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
const DIRECT_LIGHT_MIN = 0.3
const DIRECT_LIGHT_RANGE = 0.7
const AMBIENT_LIGHT_MIN = 0.28
const AMBIENT_LIGHT_RANGE = 0.42
const SUN_DISTANCE = 50
const SUN_HEIGHT = 80
// Half-width (in sun-elevation units, sinSun ∈ [-1,1]) of the dawn/dusk twilight
// band over which daylight ramps between night and full day. ~0.18 ≈ the sun
// within ~10° of the horizon — a short, natural-looking sunset/sunrise.
const TWILIGHT_BAND = 0.18

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

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
    // dawn/dusk, +1 at noon.
    //
    // The old model used `dayFactor = max(0, sinSun)` directly — a raw sine that
    // is only ~1 right at noon and collapses to 0 at BOTH dawn and dusk, giving
    // no twilight and a world that is fully black the instant the sun touches the
    // horizon (the "dusk looks pitch-black" bug). Real daylight instead PLATEAUS:
    // it is at full brightness for most of the day and ramps smoothly through a
    // short dawn/dusk twilight band. Model that with a smoothstep over the sun's
    // elevation: dark below -TWILIGHT_BAND, full day above +TWILIGHT_BAND, an
    // eased transition across the band. Light still ARCS via cos/sin below; only
    // the brightness/colour mix uses this plateaued factor.
    const twilightT = clamp01((sinSun + TWILIGHT_BAND) / (2 * TWILIGHT_BAND))
    const dayFactor = twilightT * twilightT * (3 - 2 * twilightT)  // smoothstep

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
