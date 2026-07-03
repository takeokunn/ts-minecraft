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
  // Tuned for the white-ambient/NoToneMapping model (same rebalance as the
  // nether): vanilla's End is FULLY lit in a pale lavender cast — the old
  // 0.15 x deep-purple (~0.04 effective) rendered the dimension black.
  lights.ambientLight.intensity = 0.95
  lights.ambientLight.color.setHSL(0.75, 0.15, 0.68)  // pale lavender-gray
  lights.skyCurrent.setHSL(0.75, 0.35, 0.06)           // deep violet void
  lights.renderer.setClearColor(lights.skyCurrent)
  hideMoon(lights)
}

// Fixed nether lighting — called after updateDayNightCycle so time still advances,
// but the visual result is always dark red regardless of time-of-day.
export const applyNetherEnvironment = (lights: DayNightLightsPort): void => {
  lights.light.intensity = 0              // no sun in the nether
  // Tuned for the white-ambient/NoToneMapping model: the nether has no sky
  // light, so the terrain shader sits at its 0.45 floor and the scene ambient
  // is the only brightness lever. 0.9 x warm-red (L 0.55) lands overall
  // luminance near the verified moonlit-night level — dim but readable, red.
  // (The old 0.2 x dark-red was ~0.06 effective: the nether rendered black.)
  lights.ambientLight.intensity = 0.9
  lights.ambientLight.color.setHSL(0.05, 0.5, 0.55)  // warm orange-red ambient
  lights.skyCurrent.setHSL(0.02, 0.85, 0.09)          // deep red haze background
  lights.renderer.setClearColor(lights.skyCurrent)
  hideMoon(lights)
}

export const updateDayNightCycle = (
  deltaTime: DeltaTimeSecs,
  lights: DayNightLightsPort,
  timeService: TimeService,
  // Moon anchor: the sprite lives in world space, so it must follow the
  // observer or it drifts behind and out of the far plane as the player
  // travels. Defaults to the origin for callers without a camera.
  observerPosition: { readonly x: number; readonly y: number; readonly z: number } = { x: 0, y: 0, z: 0 },
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
        moon.setPosition(
          observerPosition.x + appearance.moonPosition.x,
          observerPosition.y + appearance.moonPosition.y,
          observerPosition.z + appearance.moonPosition.z,
        )
        moon.setPhase(moonPhase)
        moon.setOpacity(appearance.moonOpacity)
        moon.setVisible(appearance.moonVisible)
      }
    })
  })
