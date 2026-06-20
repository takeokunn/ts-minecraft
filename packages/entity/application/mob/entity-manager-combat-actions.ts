import * as Effect from 'effect/Effect'
import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'

import type { EntityDrop } from '../../domain/mob/drop'
import type { Entity, EntityId } from '../../domain/mob/entity'
import { KNOCKBACK_DURATION_SECS } from '../../domain/combat.config'
import type { Vector3 } from '@ts-minecraft/core'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { damageManagedEntity } from './entity-manager-damage'
import { invalidateEntityCache, invalidateEntityCacheAndBumpStructureVersion } from './entity-manager-cache'

export const makeEntityManagerCombatActions = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  applyDamage: (
    entityId: EntityId,
    amount: number,
  ): Effect.Effect<Option.Option<ReadonlyArray<EntityDrop>>, never> => {
    if (amount <= 0) {
      return Effect.succeed(Option.none())
    }

    return Effect.gen(function* () {
      const dropsOpt = yield* Ref.modify(entitiesRef, (entities) => damageManagedEntity(entities, entityId, amount))
      if (Option.isSome(dropsOpt)) {
        yield* invalidateEntityCacheAndBumpStructureVersion(cachedEntitiesRef, structureVersionRef)
      } else {
        yield* invalidateEntityCache(cachedEntitiesRef)
      }
      return dropsOpt
    })
  },

  applyKnockback: (entityId: EntityId, impulse: Vector3): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      yield* Ref.update(entitiesRef, (entities) => {
        const entity = Option.getOrNull(HashMap.get(entities, entityId))
        if (!entity) return entities

        return HashMap.set(entities, entityId, {
          ...entity,
          velocity: impulse,
          knockbackSecsRemaining: KNOCKBACK_DURATION_SECS,
        })
      })
      yield* invalidateEntityCache(cachedEntitiesRef)
    }),
})
