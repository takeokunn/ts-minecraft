import * as Effect from 'effect/Effect'
import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'

import type { Entity, EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { invalidateEntityCache } from './entity-manager-cache'
import { updateManagedEntity } from './entity-manager-entity-mutation'

export const makeEntityManagerFireActions = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
) => ({
  igniteEntity: (entityId: EntityId, durationSecs: number): Effect.Effect<boolean, never> => {
    if (durationSecs <= 0) return Effect.succeed(false)

    return Effect.gen(function* () {
      const changed = yield* Ref.modify(entitiesRef, (entities): [boolean, HashMap.HashMap<EntityId, ManagedEntity>] => {
        const [changed, updatedEntities] = updateManagedEntity(
          entities,
          entityId,
          false,
          (entity) => {
            const fireSecsRemaining = Math.max(entity.fireSecsRemaining, durationSecs)
            if (fireSecsRemaining === entity.fireSecsRemaining) return [false, entity]

            return [true, { ...entity, fireSecsRemaining }]
          },
        )

        return [changed, updatedEntities]
      })

      if (changed) yield* invalidateEntityCache(cachedEntitiesRef)
      return changed
    })
  },
})
