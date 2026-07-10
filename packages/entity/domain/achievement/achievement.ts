import { Schema } from 'effect'
import type { Statistics } from '../statistics/statistics'

export const AchievementIdSchema = Schema.String.pipe(Schema.brand('AchievementId'))
export type AchievementId = Schema.Schema.Type<typeof AchievementIdSchema>
export const AchievementId = {
  make: (value: string): AchievementId => Schema.decodeUnknownSync(AchievementIdSchema)(value),
}

export interface Achievement {
  readonly id: AchievementId
  readonly name: string
  readonly description: string
  readonly isUnlocked: (stats: Statistics) => boolean
  // Gates unlock until the referenced achievement is already unlocked — mirrors
  // vanilla's advancement tree (e.g. "Acquire Hardware" requires "Time to Mine!").
  readonly prerequisite?: AchievementId
}

// Fixed-point sweep over the registry: an achievement whose prerequisite unlocks
// in this same call (e.g. mining wood and crafting a pickaxe in one session) must
// still be picked up, so a single top-to-bottom pass isn't enough regardless of
// registry ordering. Bounded by registry.length passes — no infinite loop risk.
export const evaluateUnlocks = (
  registry: ReadonlyArray<Achievement>,
  stats: Statistics,
  unlockedIds: ReadonlySet<AchievementId>,
): ReadonlyArray<Achievement> => {
  const satisfied = new Set(unlockedIds)
  const newlyUnlocked: Achievement[] = []
  let changed = true
  while (changed) {
    changed = false
    for (const achievement of registry) {
      if (satisfied.has(achievement.id)) continue
      if (achievement.prerequisite !== undefined && !satisfied.has(achievement.prerequisite)) continue
      if (!achievement.isUnlocked(stats)) continue
      satisfied.add(achievement.id)
      newlyUnlocked.push(achievement)
      changed = true
    }
  }
  return newlyUnlocked
}
