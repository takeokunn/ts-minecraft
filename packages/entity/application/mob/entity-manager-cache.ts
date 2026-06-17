import { Effect, Option, Ref } from 'effect'
import type { Entity } from '../../domain/mob/entity'

export const invalidateEntityCache = (
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
): Effect.Effect<void, never> => Ref.set(cachedEntitiesRef, Option.none())

export const invalidateEntityCacheAndBumpStructureVersion = (
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* invalidateEntityCache(cachedEntitiesRef)
    yield* Ref.update(structureVersionRef, (version) => version + 1)
  })
