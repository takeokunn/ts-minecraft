import { Effect, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { updateDayNightCycle, applyNetherEnvironment, applyEndEnvironment, type DayNightLights, type Weather } from '@ts-minecraft/game'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'

// Apply a grey-blue tint when it is raining or thundering (overrides the daytime sky).
const applyRainEnvironment = (lights: DayNightLights, weather: Weather): void => {
  if (weather === 'clear') return
  // Darken ambient and directional light; shift sky towards overcast grey-blue.
  const thunderFactor = weather === 'thunder' ? 0.6 : 0.85
  lights.light.intensity *= thunderFactor
  lights.ambientLight.intensity *= thunderFactor
  lights.ambientLight.color.setHSL(0.6, 0.15, 0.4)   // cool grey-blue ambient
  lights.skyCurrent.setHSL(0.6, 0.08, 0.35 * thunderFactor)  // overcast sky
  lights.renderer.setClearColor(lights.skyCurrent)
}

// Module-scoped scratch for the per-frame music context. Its fields are overwritten
// every frame before use, so reusing it avoids allocating a fresh
// `{ isNight, playerPosition }` literal each frame. Safe because
// `musicManager.updateFromContext` reads the fields synchronously
// (via `environmentFromContext`) and never retains the object.
const musicContextScratch: { isNight: boolean; playerPosition: Position } = {
  isNight: false,
  playerPosition: { x: 0, y: 0, z: 0 },
}

export const lightingStage = (
  deps: Pick<FrameHandlerDeps, 'lights' | 'renderer'>,
  services: Pick<FrameHandlerServices, 'timeService' | 'musicManager' | 'chunkMeshService' | 'netherService' | 'weatherService'>,
  refs: Pick<FrameStageRefs, 'shadowUpdateCounterRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly effectiveLights: DayNightLights
    readonly playerPos: Position
    readonly markShadowMapDirty: () => void
  },
): Effect.Effect<{ readonly timeOfDay: number; readonly sunIntensity: number }, never> =>
  // Pre-composed flatMap chain — no per-frame generator
  logErrors(
    updateDayNightCycle(inputs.deltaTime, inputs.effectiveLights, services.timeService),
    'Day/night error',
  ).pipe(
    Effect.flatMap(() => services.weatherService.tick(inputs.deltaTime)),
    Effect.flatMap((weather) =>
      // Sequential: getDimension is a read from a Ref. No need for Effect.all([...])
      // which creates an intermediate 2-element array every frame.
      Effect.flatMap(services.netherService.getDimension(), (dimension) =>
        Effect.sync(() => {
          if (dimension === 'nether') applyNetherEnvironment(inputs.effectiveLights)
          else if (dimension === 'end') applyEndEnvironment(inputs.effectiveLights)
          else applyRainEnvironment(inputs.effectiveLights, weather)
        }),
      ),
    ),
    Effect.flatMap(() =>
      Ref.updateAndGet(refs.shadowUpdateCounterRef, (n) => (n + 1) % 8),
    ),
    Effect.flatMap((shadowFrame) =>
      shadowFrame === 0 && deps.lights.light.castShadow
        ? Effect.sync(() => { inputs.markShadowMapDirty() })
        : Effect.void,
    ),
    Effect.flatMap(() =>
      logErrors(
        services.timeService.isNight().pipe(
          Effect.flatMap((isNight) => {
            musicContextScratch.isNight = isNight
            musicContextScratch.playerPosition = inputs.playerPos
            return services.musicManager.updateFromContext(musicContextScratch)
          }),
        ),
        'Music update error',
      ),
    ),
    Effect.flatMap(() => services.timeService.getTimeOfDay()),
    Effect.flatMap((timeOfDay) => {
      const sunIntensity = Math.max(0, Math.sin((timeOfDay - 0.25) * Math.PI * 2))
      return logErrors(services.chunkMeshService.setSunIntensity(sunIntensity), 'Sun intensity sync error').pipe(
        Effect.map(() => ({ timeOfDay, sunIntensity })),
      )
    }),
  )
