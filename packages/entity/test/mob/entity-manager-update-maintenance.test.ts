import { describe, expect, it } from '@effect/vitest'
import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { EntityId, EntityType, type Entity } from '@ts-minecraft/entity/domain/mob/entity';
import { DeltaTimeSecs } from '@ts-minecraft/core/domain/numerics';
import { applyBurnDamageCleanup, invalidateEntityCacheIfNeeded, updateCreeperFuseStates, updateSheepWoolRegrowth } from '../../application/mob/entity-manager-update-maintenance'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { expectSome, makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerUpdateMaintenance', () => {
  it('updateCreeperFuseStates leaves entities untouched when no creepers are tracked', () =>
    Effect.gen(function* () {
      const zombie = makeTestManagedEntity({
        entityId: EntityId.make('entity-zombie-maintenance-idle'),
        type: EntityType.Zombie,
        position: { x: 0, y: 64, z: 0 },
      })
      const entitiesRef = yield* Ref.make(HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), zombie.entityId, zombie))
      const dirtyRef = MutableRef.make(false)
      const hasCreeperRef = MutableRef.make(false)

      yield* updateCreeperFuseStates(
        entitiesRef,
        dirtyRef,
        hasCreeperRef,
        { x: 1, y: 64, z: 0 },
        DeltaTimeSecs.make(0.5),
      )

      expect(MutableRef.get(dirtyRef)).toBe(false)
      expect(HashMap.get(yield* Ref.get(entitiesRef), zombie.entityId)).toEqual(Option.some(zombie))
    }))

  it('updateCreeperFuseStates advances only creepers and marks the manager dirty', () =>
    Effect.gen(function* () {
      const creeper = makeTestManagedEntity({
        entityId: EntityId.make('entity-creeper-maintenance-fuse'),
        type: EntityType.Creeper,
        position: { x: 0, y: 64, z: 0 },
      })
      const zombie = makeTestManagedEntity({
        entityId: EntityId.make('entity-zombie-maintenance-fuse'),
        type: EntityType.Zombie,
        position: { x: 8, y: 64, z: 0 },
      })
      const entitiesRef = yield* Ref.make(
        HashMap.set(
          HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), creeper.entityId, creeper),
          zombie.entityId,
          zombie,
        ),
      )
      const dirtyRef = MutableRef.make(false)
      const hasCreeperRef = MutableRef.make(true)

      yield* updateCreeperFuseStates(
        entitiesRef,
        dirtyRef,
        hasCreeperRef,
        { x: 1, y: 64, z: 0 },
        DeltaTimeSecs.make(0.5),
      )

      const updated = yield* Ref.get(entitiesRef)
      expect(MutableRef.get(dirtyRef)).toBe(true)
      expectSome(HashMap.get(updated, creeper.entityId)).toMatchObject({ fuseSecs: 0.5 })
      expect(HashMap.get(updated, zombie.entityId)).toEqual(Option.some(zombie))
    }))

  it('updateSheepWoolRegrowth leaves entities untouched when no sheared sheep are tracked', () =>
    Effect.gen(function* () {
      const sheep = makeTestManagedEntity({
        entityId: EntityId.make('entity-sheep-maintenance-idle'),
        type: EntityType.Sheep,
        woolRegrowthTicks: 12,
      })
      const entitiesRef = yield* Ref.make(HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), sheep.entityId, sheep))
      const hasShearedSheepRef = MutableRef.make(false)

      yield* updateSheepWoolRegrowth(entitiesRef, hasShearedSheepRef, DeltaTimeSecs.make(0.5))

      expect(HashMap.get(yield* Ref.get(entitiesRef), sheep.entityId)).toEqual(Option.some(sheep))
    }))

  it('updateSheepWoolRegrowth regrows only sheep entities', () =>
    Effect.gen(function* () {
      const sheep = makeTestManagedEntity({
        entityId: EntityId.make('entity-sheep-maintenance-regrowth'),
        type: EntityType.Sheep,
        woolRegrowthTicks: 12,
      })
      const zombie = makeTestManagedEntity({
        entityId: EntityId.make('entity-zombie-maintenance-regrowth'),
        type: EntityType.Zombie,
        woolRegrowthTicks: 0,
      })
      const entitiesRef = yield* Ref.make(
        HashMap.set(
          HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), sheep.entityId, sheep),
          zombie.entityId,
          zombie,
        ),
      )
      const hasShearedSheepRef = MutableRef.make(true)

      yield* updateSheepWoolRegrowth(entitiesRef, hasShearedSheepRef, DeltaTimeSecs.make(0.5))

      const updated = yield* Ref.get(entitiesRef)
      expectSome(HashMap.get(updated, sheep.entityId)).toMatchObject({ woolRegrowthTicks: 2 })
      expect(HashMap.get(updated, zombie.entityId)).toEqual(Option.some(zombie))
    }))

  it('applyBurnDamageCleanup returns false when burn cleanup is inactive', () =>
    Effect.gen(function* () {
      const dead = makeTestManagedEntity({
        entityId: EntityId.make('entity-zombie-maintenance-burn-inactive'),
        type: EntityType.Zombie,
        health: 0,
      })
      const entitiesRef = yield* Ref.make(HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), dead.entityId, dead))
      const structureVersionRef = yield* Ref.make(4)
      const fireDamageRef = MutableRef.make(false)

      const changed = yield* applyBurnDamageCleanup(entitiesRef, structureVersionRef, false, fireDamageRef)

      expect(changed).toBe(false)
      expect(yield* Ref.get(structureVersionRef)).toBe(4)
      expect(HashMap.get(yield* Ref.get(entitiesRef), dead.entityId)).toEqual(Option.some(dead))
    }))

  it('applyBurnDamageCleanup removes dead entities and bumps structure version when active', () =>
    Effect.gen(function* () {
      const alive = makeTestManagedEntity({
        entityId: EntityId.make('entity-zombie-maintenance-burn-alive'),
        type: EntityType.Zombie,
        health: 20,
      })
      const dead = makeTestManagedEntity({
        entityId: EntityId.make('entity-zombie-maintenance-burn-dead'),
        type: EntityType.Zombie,
        health: 0,
      })
      const entitiesRef = yield* Ref.make(
        HashMap.set(
          HashMap.set(HashMap.empty<EntityId, ManagedEntity>(), alive.entityId, alive),
          dead.entityId,
          dead,
        ),
      )
      const structureVersionRef = yield* Ref.make(9)
      const fireDamageRef = MutableRef.make(false)

      const changed = yield* applyBurnDamageCleanup(entitiesRef, structureVersionRef, true, fireDamageRef)

      const updated = yield* Ref.get(entitiesRef)
      expect(changed).toBe(true)
      expect(yield* Ref.get(structureVersionRef)).toBe(10)
      expectSome(HashMap.get(updated, alive.entityId)).toEqual(alive)
      expect(Option.isNone(HashMap.get(updated, dead.entityId))).toBe(true)
    }))

  it('invalidateEntityCacheIfNeeded clears a dirty cached entity snapshot', () =>
    Effect.gen(function* () {
      const snapshot = [] as ReadonlyArray<Entity>
      const cachedEntitiesRef = yield* Ref.make<Option.Option<ReadonlyArray<Entity>>>(Option.some(snapshot))
      const dirtyRef = MutableRef.make(true)

      yield* invalidateEntityCacheIfNeeded(cachedEntitiesRef, dirtyRef, false)

      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
    }))
})
