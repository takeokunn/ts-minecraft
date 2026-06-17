import { Effect, Option } from 'effect'
import { TimeService } from './time-service'
import type { DeltaTimeSecs, DayNightLightsPort } from '@ts-minecraft/core'
import { resolveDayNightCycleState } from '../domain/day-night-cycle'
import { resolveDayNightCycleAppearance } from '../domain/day-night-cycle-appearance'

export type { DayNightLightsPort as DayNightLights }

const hideMoon = (lights: DayNightLightsPort): void => {
  const moon = Option.getOrNull(lights.moon)
  if (moon === null) return
  moon.setVisible(false)
  moon.setOpacity(0)
}

// The End: deep void black with faint purple ambient, no sun.
export const applyEndEnvironment = (lights: DayNightLightsPort): void => {
  lights.light.intensity = 0
  lights.ambientLight.intensity = 0.15
  lights.ambientLight.color.setHSL(0.8, 0.5, 0.25)  // deep purple
  lights.skyCurrent.setHSL(0.8, 0.3, 0.02)           // near-black void
  lights.renderer.setClearColor(lights.skyCurrent)
  hideMoon(lights)
}

// Fixed nether lighting — called after updateDayNightCycle so time still advances,
// but the visual result is always dark red regardless of time-of-day.
export const applyNetherEnvironment = (lights: DayNightLightsPort): void => {
  lights.light.intensity = 0              // no sun in the nether
  lights.ambientLight.intensity = 0.2
  lights.ambientLight.color.setHSL(0.04, 0.8, 0.3)   // dark orange-red ambient
  lights.skyCurrent.setHSL(0.02, 0.9, 0.04)           // near-black red background
  lights.renderer.setClearColor(lights.skyCurrent)
  hideMoon(lights)
}

export const updateDayNightCycle = (
  deltaTime: DeltaTimeSecs,
  lights: DayNightLightsPort,
  timeService: TimeService,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    yield* timeService.advanceTick(deltaTime)
    const timeOfDay = yield* timeService.getTimeOfDay()
    const moonPhase = yield* timeService.getMoonPhase()
    const state = resolveDayNightCycleState(timeOfDay)
    const appearance = resolveDayNightCycleAppearance(state)

    yield* Effect.sync(() => {
      lights.light.intensity = appearance.directionalLightIntensity
      lights.light.position.set(appearance.lightPosition.x, appearance.lightPosition.y, appearance.lightPosition.z)
      lights.light.color.setHSL(
        appearance.directionalLightColor.h,
        appearance.directionalLightColor.s,
        appearance.directionalLightColor.l,
      )

      lights.ambientLight.intensity = appearance.ambientLightIntensity
      lights.ambientLight.color.setHSL(
        appearance.ambientLightColor.h,
        appearance.ambientLightColor.s,
        appearance.ambientLightColor.l,
      )

      lights.skyCurrent.lerpColors(lights.skyNight, lights.skyDay, state.dayFactor)
      lights.renderer.setClearColor(lights.skyCurrent)

      const sky = Option.getOrNull(lights.sky)
      if (sky !== null) {
        sky.uniforms.sunPosition.value.set(
          appearance.skySunPosition.x,
          appearance.skySunPosition.y,
          appearance.skySunPosition.z,
        )
        sky.uniforms.turbidity.value = appearance.skyTurbidity
        sky.uniforms.rayleigh.value = appearance.skyRayleigh
      }

      const moon = Option.getOrNull(lights.moon)
      if (moon !== null) {
        moon.setPosition(appearance.moonPosition.x, appearance.moonPosition.y, appearance.moonPosition.z)
        moon.setPhase(moonPhase)
        moon.setOpacity(appearance.moonOpacity)
        moon.setVisible(appearance.moonVisible)
      }
    })
  })
