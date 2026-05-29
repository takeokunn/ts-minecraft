import { Effect, Option } from 'effect'
import { TimeService } from './time-service'
import type { DeltaTimeSecs } from '@ts-minecraft/kernel'
import type { DayNightLightsPort } from '@ts-minecraft/kernel'

const DAWN_PHASE_OFFSET = 0.25   // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
const DIRECT_LIGHT_MIN = 0.3
const DIRECT_LIGHT_RANGE = 0.7
const AMBIENT_LIGHT_MIN = 0.28
const AMBIENT_LIGHT_RANGE = 0.42
const SUN_DISTANCE = 50
const SUN_HEIGHT = 80

// Sky turbidity and rayleigh: tuned for natural appearance (lower = cleaner/less hazy)
const SKY_TURBIDITY_DAY = 2
const SKY_TURBIDITY_HORIZON = 4
const SKY_RAYLEIGH_DAY = 3
const SKY_RAYLEIGH_NIGHT = 0.5

export type { DayNightLightsPort as DayNightLights }

export const updateDayNightCycle = (
  deltaTime: DeltaTimeSecs,
  lights: DayNightLightsPort,
  timeService: TimeService,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const timeOfDay = yield* timeService.advanceTick(deltaTime).pipe(
      Effect.andThen(timeService.getTimeOfDay()),
    )

    // Sun arc: 0.25=dawn, 0.5=noon, 0.75=dusk, 0.0/1.0=midnight
    // sin peaks at noon (0.5), zero at dawn/dusk, negative at night → clamp to 0
    const dayFactor = Math.max(0, Math.sin((timeOfDay - DAWN_PHASE_OFFSET) * Math.PI * 2))

    // Directional light follows a semicircular arc east→zenith→west across the
    // day. sunAngle spans 0 (dawn, east horizon) → π/2 (noon, overhead) → π
    // (dusk, west horizon), and goes negative / past π at night (sun below the
    // horizon). The ×2 matches dayFactor's full-cycle scaling so the sun peaks
    // exactly at noon — not at dusk, as the prior ×π (only reaching π/2 at dusk)
    // incorrectly did.
    const sunAngle = (timeOfDay - DAWN_PHASE_OFFSET) * Math.PI * 2  // 0 at dawn, π/2 at noon, π at dusk

    yield* Effect.sync(() => {
      lights.light.intensity = DIRECT_LIGHT_MIN + dayFactor * DIRECT_LIGHT_RANGE
      lights.light.position.set(Math.cos(sunAngle) * SUN_DISTANCE, Math.sin(sunAngle) * SUN_HEIGHT, 0)

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

      Option.map(lights.sky, (sky) => {
        const sunX = Math.cos(sunAngle) * SUN_DISTANCE
        const sunY = Math.sin(sunAngle) * SUN_HEIGHT
        sky.uniforms.sunPosition.value.set(sunX, sunY, 0)
        // Turbidity increases near horizon (hazy at dawn/dusk)
        sky.uniforms.turbidity.value = SKY_TURBIDITY_DAY + (1 - dayFactor) * (SKY_TURBIDITY_HORIZON - SKY_TURBIDITY_DAY)
        sky.uniforms.rayleigh.value = SKY_RAYLEIGH_NIGHT + dayFactor * (SKY_RAYLEIGH_DAY - SKY_RAYLEIGH_NIGHT)
      })
    })
  })
