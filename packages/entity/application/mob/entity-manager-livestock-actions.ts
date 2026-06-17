import * as Effect from 'effect/Effect'
import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'

import { EntityType } from '../../domain/mob/entity'
import type { Entity, EntityId } from '../../domain/mob/entity'
import { LOVE_DURATION_TICKS, canAcceptBreedingFood, isBaby, acceleratedBabyAge } from '../../domain/mob/breeding'
import { WOOL_REGROWTH_TICKS, canBeSheared, shearWoolCount } from '../../domain/mob/shearing'
import { hashEntityId } from '../../domain/mob/entity-utils'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { invalidateEntityCache } from './entity-manager-cache'
import { updateManagedEntity } from './entity-manager-entity-mutation'

export const makeEntityManagerLivestockActions = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
) => ({
  // FR R6: feed a breeding item to an entity. Enters love mode (returns true) only
  // if it is a willing adult (off cooldown, not already in love). The caller checks
  // the held item matches the mob's breedingItem before invoking this.
  feedEntity: (entityId: EntityId): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const fed = yield* Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const [fed, updatedEntities] = updateManagedEntity(
          entities,
          entityId,
          false,
          (entity) => {
            // Feeding a baby accelerates its growth (vanilla); feeding a willing adult
            // enters love mode. An in-love / cooling-down adult declines (no consume).
            if (isBaby(entity.ageTicks)) {
              return [true, { ...entity, ageTicks: acceleratedBabyAge(entity.ageTicks) }]
            }
            return canAcceptBreedingFood({
              loveTicksRemaining: entity.loveTicksRemaining,
              breedCooldownRemaining: entity.breedCooldownRemaining,
              ageTicks: entity.ageTicks,
            })
              ? [true, { ...entity, loveTicksRemaining: LOVE_DURATION_TICKS }]
              : [false, entity]
          },
        )

        return [fed, updatedEntities]
      })
      if (fed) yield* invalidateEntityCache(cachedEntitiesRef)
      return fed
    }),

  // FR R11: shear a sheep. Returns Some(woolCount) and starts the regrowth timer only
  // for a woolly sheep (type Sheep, regrowth at 0); None otherwise (wrong species, or
  // already sheared). The caller checks the held item is SHEARS before invoking this.
  shearEntity: (entityId: EntityId): Effect.Effect<Option.Option<number>, never> =>
    Effect.gen(function* () {
      const res = yield* Ref.modify(entitiesRef, (entities): [Option.Option<number>, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const [res, updatedEntities] = updateManagedEntity(
          entities,
          entityId,
          Option.none(),
          (entity) => {
            if (entity.type !== EntityType.Sheep || !canBeSheared(entity.woolRegrowthTicks)) {
              return [Option.none(), entity]
            }
            const count = shearWoolCount(hashEntityId(entityId))
            return [
              Option.some(count),
              { ...entity, woolRegrowthTicks: WOOL_REGROWTH_TICKS },
            ]
          },
        )

        return [res, updatedEntities]
      })
      if (Option.isSome(res)) yield* invalidateEntityCache(cachedEntitiesRef)
      return res
    }),
})
