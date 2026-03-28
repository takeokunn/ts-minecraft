import { Effect, Option } from 'effect'
import { TimeService } from '@/application/time/time-service'
import type { DeltaTimeSecs } from '@/shared/kernel'
import type { DayNightLightsPort } from '@/shared/math/three'

const DAWN_PHASE_OFFSET = 0.25   // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
const DIRECT_LIGHT_MIN = 0.2
const DIRECT_LIGHT_RANGE = 0.8
const AMBIENT_LIGHT_MIN = 0.1
const AMBIENT_LIGHT_RANGE = 0.4
const SUN_DISTANCE = 50
const SUN_HEIGHT = 80

// Sky turbidity and rayleigh: tuned for natural appearance (lower = cleaner/less hazy)
const SKY_TURBIDITY_DAY = 2
const SKY_TURBIDITY_HORIZON = 4
const SKY_RAYLEIGH_DAY = 3
const SKY_RAYLEIGH_NIGHT = 0.5

/**
 * Re-export port type as DayNightLights for backward compatibility with call sites.
 */
export type { DayNightLightsPort as DayNightLights }

export const updateDayNightCycle = (
  deltaTime: DeltaTimeSecs,
  lights: DayNightLightsPort,
  timeService: TimeService,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    yield* timeService.advanceTick(deltaTime)
    const timeOfDay = yield* timeService.getTimeOfDay()

    // Sun arc: 0.25=dawn, 0.5=noon, 0.75=dusk, 0.0/1.0=midnight
    // sin peaks at noon (0.5), zero at dawn/dusk, negative at night → clamp to 0
    const dayFactor = Math.max(0, Math.sin((timeOfDay - DAWN_PHASE_OFFSET) * Math.PI * 2))

    // Directional light follows a horizontal arc east→west
    const sunAngle = (timeOfDay - DAWN_PHASE_OFFSET) * Math.PI  // 0 at dawn, π at dusk

    // Apply light property mutations as a single declared side effect
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
        lights.ambientLight.color.setHSL(0.6, 0.5, 0.3)  // cool blue at night
      } else {
        lights.ambientLight.color.setHSL(0.06, horizonBlend * 0.3, 0.5 + dayFactor * 0.3)
      }
    })

    // Update physical sky or fall back to lerp-based sky color
    yield* Option.match(lights.sky, {
      onSome: (sky) => Effect.sync(() => {
        const sunX = Math.cos(sunAngle) * SUN_DISTANCE
        const sunY = Math.sin(sunAngle) * SUN_HEIGHT
        sky.uniforms.sunPosition.value.set(sunX, sunY, 0)
        // Turbidity increases near horizon (hazy at dawn/dusk)
        sky.uniforms.turbidity.value = SKY_TURBIDITY_DAY + (1 - dayFactor) * (SKY_TURBIDITY_HORIZON - SKY_TURBIDITY_DAY)
        sky.uniforms.rayleigh.value = SKY_RAYLEIGH_NIGHT + dayFactor * (SKY_RAYLEIGH_DAY - SKY_RAYLEIGH_NIGHT)
      }),
      onNone: () => Effect.sync(() => {
        // Fallback: lerp-based sky color (original behavior)
        lights.skyCurrent.lerpColors(lights.skyNight, lights.skyDay, dayFactor)
        lights.renderer.setClearColor(lights.skyCurrent)
      }),
    })
  })
