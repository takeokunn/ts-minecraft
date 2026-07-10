import { Effect, Ref } from 'effect'
import { evaluateUnlocks, AchievementId, type Achievement } from '../domain/achievement/achievement'
import { ACHIEVEMENT_REGISTRY } from '../domain/achievement/achievement-registry'
import type { Statistics } from '../domain/statistics/statistics'

export class AchievementService extends Effect.Service<AchievementService>()(
  '@minecraft/application/AchievementService',
  {
    effect: Effect.gen(function* () {
      const unlockedRef = yield* Ref.make<ReadonlySet<AchievementId>>(new Set())

      return {
        getUnlocked: (): Effect.Effect<ReadonlyArray<AchievementId>, never> =>
          Ref.get(unlockedRef).pipe(Effect.map((unlocked) => [...unlocked])),

        // Evaluates the registry against the given stats snapshot, persists any
        // newly-satisfied achievements, and returns only the newly unlocked ones —
        // callers use that to fire a one-shot "Achievement Unlocked!" toast.
        checkUnlocks: (stats: Statistics): Effect.Effect<ReadonlyArray<Achievement>, never> =>
          Ref.modify(unlockedRef, (unlocked): [ReadonlyArray<Achievement>, ReadonlySet<AchievementId>] => {
            const newlyUnlocked = evaluateUnlocks(ACHIEVEMENT_REGISTRY, stats, unlocked)
            if (newlyUnlocked.length === 0) return [newlyUnlocked, unlocked]
            const next = new Set(unlocked)
            for (const achievement of newlyUnlocked) next.add(achievement.id)
            return [newlyUnlocked, next]
          }),

        reset: (): Effect.Effect<void, never> => Ref.set(unlockedRef, new Set()),

        serialize: (): Effect.Effect<ReadonlyArray<AchievementId>, never> =>
          Ref.get(unlockedRef).pipe(Effect.map((unlocked) => [...unlocked])),

        deserialize: (ids: ReadonlyArray<string>): Effect.Effect<void, never> =>
          Ref.set(unlockedRef, new Set(ids.map((id) => AchievementId.make(id)))),
      }
    }),
  },
) {}
