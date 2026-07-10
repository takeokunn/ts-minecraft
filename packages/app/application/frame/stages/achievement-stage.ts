import { Effect, MutableRef } from 'effect'
import { dispatchModTick } from '@ts-minecraft/app/application/mods/mod-api'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

// Achievements are evaluated by polling the statistics snapshot on a 1s cadence
// rather than hooking every recording call site: the registry is a handful of
// cheap predicates, and a ≤1s toast delay is imperceptible next to the 3.5s
// toast display time.
export const ACHIEVEMENT_CHECK_INTERVAL_SECS = 1

export const achievementStage = (
  services: Pick<
    FrameHandlerServices,
    'statisticsService' | 'achievementService' | 'achievementToast' | 'soundManager'
  >,
  accumulatorRef: MutableRef.MutableRef<number>,
  deltaTime: DeltaTimeSecs,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const accumulated = MutableRef.get(accumulatorRef) + deltaTime
    if (accumulated < ACHIEVEMENT_CHECK_INTERVAL_SECS) {
      MutableRef.set(accumulatorRef, accumulated)
      return
    }
    MutableRef.set(accumulatorRef, 0)
    // Modding onTick rides the same 1s cadence (exception-isolated inside).
    dispatchModTick()
    const stats = yield* services.statisticsService.getStatistics()
    const newlyUnlocked = yield* services.achievementService.checkUnlocks(stats)
    for (const achievement of newlyUnlocked) {
      yield* services.achievementToast.show(achievement.name, achievement.description)
      yield* services.soundManager.playEffect('achievementUnlock')
    }
  })
