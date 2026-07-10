import { Effect, Ref } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import type { Dimension } from '@ts-minecraft/world'
import type { EntityType } from '../domain/mob/entity'
import {
  INITIAL_STATISTICS,
  recordBlockMined as pureRecordBlockMined,
  recordMobKilled as pureRecordMobKilled,
  recordItemCrafted as pureRecordItemCrafted,
  recordDeath as pureRecordDeath,
  recordDimensionVisited as pureRecordDimensionVisited,
  type Statistics,
} from '../domain/statistics/statistics'

export class StatisticsService extends Effect.Service<StatisticsService>()(
  '@minecraft/application/StatisticsService',
  {
    effect: Effect.gen(function* () {
      const statsRef = yield* Ref.make<Statistics>(INITIAL_STATISTICS)

      return {
        getStatistics: (): Effect.Effect<Statistics, never> => Ref.get(statsRef),

        recordBlockMined: (blockType: InventoryItem): Effect.Effect<Statistics, never> =>
          Ref.updateAndGet(statsRef, (s) => pureRecordBlockMined(s, blockType)),

        recordMobKilled: (mobType: EntityType): Effect.Effect<Statistics, never> =>
          Ref.updateAndGet(statsRef, (s) => pureRecordMobKilled(s, mobType)),

        recordItemCrafted: (itemType: InventoryItem): Effect.Effect<Statistics, never> =>
          Ref.updateAndGet(statsRef, (s) => pureRecordItemCrafted(s, itemType)),

        recordDeath: (): Effect.Effect<Statistics, never> =>
          Ref.updateAndGet(statsRef, (s) => pureRecordDeath(s)),

        recordDimensionVisited: (dimension: Dimension): Effect.Effect<Statistics, never> =>
          Ref.updateAndGet(statsRef, (s) => pureRecordDimensionVisited(s, dimension)),

        reset: (): Effect.Effect<void, never> => Ref.set(statsRef, INITIAL_STATISTICS),

        serialize: (): Effect.Effect<Statistics, never> => Ref.get(statsRef),

        deserialize: (saved: Statistics): Effect.Effect<void, never> => Ref.set(statsRef, saved),
      }
    }),
  },
) {}
