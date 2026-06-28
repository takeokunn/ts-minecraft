import { describe, expect, it } from '@effect/vitest'
import { Effect, HashMap, Option, Ref } from 'effect'
import { EntityId, EntityType, type Entity } from '@ts-minecraft/entity/domain/mob/entity'
import { BABY_GROW_TICKS } from '../../domain/mob/breeding'
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

  it('applyEntitySnapshot creates a missing live entity, clears cache, clamps health, and bumps structure version', () =>
    Effect.gen(function* () {
      const staleSnapshot = [] as ReadonlyArray<Entity>
      const entitiesRef = yield* Ref.make(HashMap.empty<EntityId, ManagedEntity>())
      const nextEntityNumberRef = yield* Ref.make(3)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.some(staleSnapshot))
      const structureVersionRef = yield* Ref.make(11)
      const mutations = makeEntityManagerMutations(
        entitiesRef,
        nextEntityNumberRef,
        cachedEntitiesRef,
        structureVersionRef,
      )
      const entityId = EntityId.make('remote:player-b:entity-1')

      const result = yield* mutations.applyEntitySnapshot({
        entityId,
        entityType: EntityType.Cow,
        position: { x: 10, y: 65, z: 12 },
        health: 999,
        alive: true,
        velocity: { x: 0.25, y: 0.5, z: 0.75 },
        rotation: { x: 0, y: 0.5, z: 0, w: 0.5 },
        isBaby: true,
        fuseSecs: 2.25,
        fireSecs: 5,
      })

      expect(result).toBe('created')
      expect(yield* Ref.get(structureVersionRef)).toBe(12)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
      expect(yield* Ref.get(nextEntityNumberRef)).toBe(3)
      const stored = expectSome(HashMap.get(yield* Ref.get(entitiesRef), entityId))
      expect(stored.type).toBe(EntityType.Cow)
      expect(stored.position).toEqual({ x: 10, y: 65, z: 12 })
      expect(stored.velocity).toEqual({ x: 0.25, y: 0.5, z: 0.75 })
      expect(stored.rotation).toEqual({ x: 0, y: 0.5, z: 0, w: 0.5 })
      expect(stored.ageTicks).toBe(0)
      expect(stored.fuseSecs).toBe(2.25)
      expect(stored.fireSecsRemaining).toBe(5)
      expect(stored.fireDamageAccumulatorSecs).toBe(0)
      expect(stored.health).toBe(stored.maxHealth)
    }))

  it('applyEntitySnapshot updates same-type position and health without bumping structure version', () =>
    Effect.gen(function* () {
      const staleSnapshot = [] as ReadonlyArray<Entity>
      const entity = makeTestManagedEntity({
        entityId: EntityId.make('remote:player-b:entity-2'),
        type: EntityType.Zombie,
        health: 20,
      })
      const entitiesRef = yield* Ref.make(HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entity.entityId, entity))
      const nextEntityNumberRef = yield* Ref.make(1)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.some(staleSnapshot))
      const structureVersionRef = yield* Ref.make(5)
      const mutations = makeEntityManagerMutations(
        entitiesRef,
        nextEntityNumberRef,
        cachedEntitiesRef,
        structureVersionRef,
      )

      const result = yield* mutations.applyEntitySnapshot({
        entityId: entity.entityId,
        entityType: EntityType.Zombie,
        position: { x: 3, y: 64, z: 4 },
        health: 7,
        alive: true,
        velocity: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: 1, z: 0, w: 0 },
        isBaby: false,
        fuseSecs: 1.5,
        fireSecs: 2,
      })

      expect(result).toBe('updated')
      expect(yield* Ref.get(structureVersionRef)).toBe(5)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
      const stored = expectSome(HashMap.get(yield* Ref.get(entitiesRef), entity.entityId))
      expect(stored.position).toEqual({ x: 3, y: 64, z: 4 })
      expect(stored.velocity).toEqual({ x: 1, y: 0, z: 0 })
      expect(stored.rotation).toEqual({ x: 0, y: 1, z: 0, w: 0 })
      expect(stored.ageTicks).toBe(BABY_GROW_TICKS)
      expect(stored.fuseSecs).toBe(1.5)
      expect(stored.fireSecsRemaining).toBe(2)
      expect(stored.fireDamageAccumulatorSecs).toBe(0)
      expect(stored.health).toBe(7)
    }))

  it('applyEntitySnapshot replaces an entity when the remote type changes', () =>
    Effect.gen(function* () {
      const entity = makeTestManagedEntity({
        entityId: EntityId.make('remote:player-b:entity-3'),
        type: EntityType.Zombie,
        health: 6,
      })
      const entitiesRef = yield* Ref.make(HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entity.entityId, entity))
      const nextEntityNumberRef = yield* Ref.make(1)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(
        Option.some([] as ReadonlyArray<Entity>),
      )
      const structureVersionRef = yield* Ref.make(8)
      const mutations = makeEntityManagerMutations(
        entitiesRef,
        nextEntityNumberRef,
        cachedEntitiesRef,
        structureVersionRef,
      )

      const result = yield* mutations.applyEntitySnapshot({
        entityId: entity.entityId,
        entityType: EntityType.Cow,
        position: { x: -2, y: 70, z: 9 },
        health: 999,
        alive: true,
        velocity: { x: -1, y: 2, z: -3 },
        rotation: { x: 0.25, y: 0.25, z: 0.25, w: 0.25 },
        isBaby: true,
        fuseSecs: 4.5,
        fireSecs: 7,
      })

      expect(result).toBe('updated')
      expect(yield* Ref.get(structureVersionRef)).toBe(9)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
      const stored = expectSome(HashMap.get(yield* Ref.get(entitiesRef), entity.entityId))
      expect(stored.type).toBe(EntityType.Cow)
      expect(stored.position).toEqual({ x: -2, y: 70, z: 9 })
      expect(stored.velocity).toEqual({ x: -1, y: 2, z: -3 })
      expect(stored.rotation).toEqual({ x: 0.25, y: 0.25, z: 0.25, w: 0.25 })
      expect(stored.ageTicks).toBe(0)
      expect(stored.fuseSecs).toBe(4.5)
      expect(stored.fireSecsRemaining).toBe(7)
      expect(stored.fireDamageAccumulatorSecs).toBe(0)
      expect(stored.health).toBe(stored.maxHealth)
    }))

  it('applyEntitySnapshot removes dead entities and ignores missing dead snapshots', () =>
    Effect.gen(function* () {
      const staleSnapshot = [] as ReadonlyArray<Entity>
      const entity = makeTestManagedEntity({
        entityId: EntityId.make('remote:player-b:entity-4'),
        type: EntityType.Pig,
      })
      const entitiesRef = yield* Ref.make(HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), entity.entityId, entity))
      const nextEntityNumberRef = yield* Ref.make(1)
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.some(staleSnapshot))
      const structureVersionRef = yield* Ref.make(13)
      const mutations = makeEntityManagerMutations(
        entitiesRef,
        nextEntityNumberRef,
        cachedEntitiesRef,
        structureVersionRef,
      )

      const removed = yield* mutations.applyEntitySnapshot({
        entityId: entity.entityId,
        entityType: EntityType.Pig,
        position: entity.position,
        health: 0,
        alive: false,
      })
      const ignored = yield* mutations.applyEntitySnapshot({
        entityId: EntityId.make('remote:player-b:missing'),
        entityType: EntityType.Pig,
        position: entity.position,
        health: 0,
        alive: false,
      })

      expect(removed).toBe('removed')
      expect(ignored).toBe('ignored')
      expect(yield* Ref.get(structureVersionRef)).toBe(14)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
      expect(HashMap.size(yield* Ref.get(entitiesRef))).toBe(0)
    }))
})
