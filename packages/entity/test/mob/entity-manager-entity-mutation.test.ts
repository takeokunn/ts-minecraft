import { describe, expect, it } from '@effect/vitest'
import { Effect, HashMap, Option, Ref } from 'effect'
import { EntityId, EntityType, type Entity } from '@ts-minecraft/entity'
import { makeEntityManagerMutations } from '../../application/mob/entity-manager-entity-mutation'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { expectSome, makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerEntityMutation', () => {
  it('addEntity creates a spawned entity, clears cached entities, and bumps structure version', () =>
    Effect.gen(function* () {
      const entitiesRef = yield* Ref.make(HashMap.empty<EntityId, ManagedEntity>())
      const nextEntityNumberRef = yield* Ref.make(1)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(
        Option.some([] as ReadonlyArray<Entity>),
      )
      const structureVersionRef = yield* Ref.make(0)
      const mutations = makeEntityManagerMutations(
        entitiesRef,
        nextEntityNumberRef,
        cachedEntitiesRef,
        structureVersionRef,
      )

      const entityId = yield* mutations.addEntity(EntityType.Cow, { x: 4, y: 64, z: 8 })

      expect(entityId).toBe(EntityId.make('entity-1'))
      expect(yield* Ref.get(nextEntityNumberRef)).toBe(2)
      expect(yield* Ref.get(structureVersionRef)).toBe(1)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())

      const entities = yield* Ref.get(entitiesRef)
      const stored = expectSome(HashMap.get(entities, entityId))
      expect(stored.type).toBe(EntityType.Cow)
      expect(stored.position).toEqual({ x: 4, y: 64, z: 8 })
    }))

  it('removeEntity returns false for a missing entity without changing cache or structure version', () =>
    Effect.gen(function* () {
      const staleSnapshot = [] as ReadonlyArray<Entity>
      const entitiesRef = yield* Ref.make(HashMap.empty<EntityId, ManagedEntity>())
      const nextEntityNumberRef = yield* Ref.make(1)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.some(staleSnapshot))
      const structureVersionRef = yield* Ref.make(7)
      const mutations = makeEntityManagerMutations(
        entitiesRef,
        nextEntityNumberRef,
        cachedEntitiesRef,
        structureVersionRef,
      )

      const removed = yield* mutations.removeEntity(EntityId.make('entity-missing'))

      expect(removed).toBe(false)
      expect(yield* Ref.get(structureVersionRef)).toBe(7)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.some(staleSnapshot))
      expect(HashMap.size(yield* Ref.get(entitiesRef))).toBe(0)
    }))

  it('removeEntity deletes an existing entity, clears cached entities, and bumps structure version', () =>
    Effect.gen(function* () {
      const entity = makeTestManagedEntity({
        entityId: EntityId.make('entity-1'),
        type: EntityType.Pig,
      })
      const entitiesRef = yield* Ref.make(HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entity.entityId, entity))
      const nextEntityNumberRef = yield* Ref.make(2)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(
        Option.some([] as ReadonlyArray<Entity>),
      )
      const structureVersionRef = yield* Ref.make(3)
      const mutations = makeEntityManagerMutations(
        entitiesRef,
        nextEntityNumberRef,
        cachedEntitiesRef,
        structureVersionRef,
      )

      const removed = yield* mutations.removeEntity(entity.entityId)

      expect(removed).toBe(true)
      expect(yield* Ref.get(structureVersionRef)).toBe(4)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
      expect(HashMap.size(yield* Ref.get(entitiesRef))).toBe(0)
    }))
})
