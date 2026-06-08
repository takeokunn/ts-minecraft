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
): Effect.Effect<{ readonly timeOfDay: number }, never> =>
  Effect.gen(function* () {
    yield* logErrors(
      updateDayNightCycle(inputs.deltaTime, inputs.effectiveLights, services.timeService),
      'Day/night error',
    )
    // Tick weather transitions and read current state.
    const weather = yield* services.weatherService.tick(inputs.deltaTime)

    const dimension = yield* services.netherService.getDimension()
    if (dimension === 'nether') {
      yield* Effect.sync(() => applyNetherEnvironment(inputs.effectiveLights))
    } else if (dimension === 'end') {
      yield* Effect.sync(() => applyEndEnvironment(inputs.effectiveLights))
    } else {
      yield* Effect.sync(() => applyRainEnvironment(inputs.effectiveLights, weather))
    }
    yield* Ref.updateAndGet(refs.shadowUpdateCounterRef, (n) => (n + 1) % 8).pipe(
      Effect.flatMap((shadowFrame) =>
        shadowFrame === 0 && deps.lights.light.castShadow
          ? Effect.sync(() => {
              inputs.markShadowMapDirty()
            })
          : Effect.void,
      ),
    )

    yield* logErrors(
      services.timeService.isNight().pipe(
        Effect.flatMap((isNight) =>
          services.musicManager.updateFromContext({ isNight, playerPosition: inputs.playerPos }),
        ),
      ),
      'Music update error',
    )

    const timeOfDay = yield* services.timeService.getTimeOfDay()

    // Sun-driven shader uniform — derived from the canonical day-factor formula
    // (matches `updateDayNightCycle`'s sin curve so chunk lighting tracks the visible sun).
    const sunIntensity = Math.max(0, Math.sin((timeOfDay - 0.25) * Math.PI * 2))
    yield* logErrors(services.chunkMeshService.setSunIntensity(sunIntensity), 'Sun intensity sync error')

    return { timeOfDay }
  })
