/**
 * Stage 1: lightingStage — day/night cycle, shadow dirty, music context, sun intensity.
 */
import { Effect, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { updateDayNightCycle, type DayNightLights } from '@ts-minecraft/day-night-cycle'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/kernel'

export const lightingStage = (
  deps: Pick<FrameHandlerDeps, 'lights' | 'renderer'>,
  services: Pick<FrameHandlerServices, 'timeService' | 'musicManager' | 'chunkMeshService'>,
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
