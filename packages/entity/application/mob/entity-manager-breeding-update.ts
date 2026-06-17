import { Effect, HashMap, Option, Ref } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { findBreedingPairs } from '../../domain/mob/breeding'
import { type Entity, type EntityId as EntityIdType, type EntityType } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { collectBreedingCandidates } from './entity-manager-breeding-candidates'
import { resetBreedingParentState } from './entity-manager-breeding'
import { invalidateEntityCache } from './entity-manager-cache'

export const runBreedingUpdate = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityIdType, ManagedEntity>>,
  birthsRef: Ref.Ref<number>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  spawnEntity: (type: EntityType, position: Position, ageTicks?: number) => Effect.Effect<EntityIdType, never>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const entities = yield* Ref.get(entitiesRef)
    const candidates = collectBreedingCandidates(entities)
    if (candidates.length < 2) return

    for (const pair of findBreedingPairs(candidates)) {
      yield* Ref.update(entitiesRef, (es) =>
        resetBreedingParentState(resetBreedingParentState(es, pair.parentA), pair.parentB)
      )
      yield* spawnEntity(pair.type, pair.babyPosition, 0)
      yield* Ref.update(birthsRef, (n) => n + 1)
    }

    yield* invalidateEntityCache(cachedEntitiesRef)
  })
