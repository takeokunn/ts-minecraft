import { describe, expect } from 'vitest'
import { Effect, HashMap, Option, Ref } from 'effect'
import { EntityId, EntityType, type Entity } from '@ts-minecraft/entity'
import { CREEPER_EXPLOSION_POWER } from '../../domain/explosion'
import { CREEPER_FUSE_SECONDS } from '../../domain/mob/creeper-fuse'
import { itEntityManagerInternalEffect, makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerInternal', () => {
  itEntityManagerInternalEffect('ignores hostile mobs with zero contact damage', ({ entitiesRef, cachedEntitiesRef, internal }) =>
    Effect.gen(function* () {
      const zombie = makeTestManagedEntity({
        entityId: EntityId.make('entity-zombie-zero-contact-damage'),
        type: EntityType.Zombie,
        attackDamage: 0,
        position: { x: 0, y: 64, z: 0 },
      })
      yield* Ref.set(entitiesRef, HashMap.set(HashMap.empty(), zombie.entityId, zombie))
      yield* Ref.set(cachedEntitiesRef, Option.some([]))

      const damage = yield* internal.getPlayerContactDamage({ x: 0, y: 64, z: 0 })

      expect(damage).toBe(0)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.some([]))
    }))

  itEntityManagerInternalEffect('invalidates cached contact damage when a creeper detonates', ({ entitiesRef, cachedEntitiesRef, structureVersionRef, explosionsRef, internal }) =>
    Effect.gen(function* () {
      const zombie = makeTestManagedEntity({
        entityId: EntityId.make('entity-zombie-contact-damage-wrapper'),
        type: EntityType.Zombie,
        position: { x: 1, y: 64, z: 0 },
      })
      const creeper = makeTestManagedEntity({
        entityId: EntityId.make('entity-creeper-contact-damage-wrapper'),
        type: EntityType.Creeper,
        fuseSecs: CREEPER_FUSE_SECONDS,
        position: { x: 0, y: 64, z: 0 },
      })
      yield* Ref.set(
        entitiesRef,
        HashMap.set(
          HashMap.set(HashMap.empty(), zombie.entityId, zombie),
          creeper.entityId,
          creeper,
        ),
      )
      yield* Ref.set(cachedEntitiesRef, Option.some([]))

      const damage = yield* internal.getPlayerContactDamage({ x: 0, y: 64, z: 0 })

      expect(damage).toBeGreaterThan(0)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
      expect(yield* Ref.get(structureVersionRef)).toBe(1)
      expect(yield* Ref.get(explosionsRef)).toEqual([
        {
          source: 'creeper',
          position: { x: 0, y: 64, z: 0 },
          power: CREEPER_EXPLOSION_POWER,
        },
      ])
      expect(HashMap.get(yield* Ref.get(entitiesRef), creeper.entityId)).toEqual(Option.none())
    }))

  itEntityManagerInternalEffect('ignores hostile skeletons with zero ranged damage', ({ entitiesRef, cachedEntitiesRef, internal }) =>
    Effect.gen(function* () {
      const skeleton = makeTestManagedEntity({
        entityId: EntityId.make('entity-skeleton-zero-ranged-damage'),
        type: EntityType.Skeleton,
        attackDamage: 0,
        position: { x: 0, y: 64, z: 0 },
      })
      yield* Ref.set(entitiesRef, HashMap.set(HashMap.empty(), skeleton.entityId, skeleton))
      yield* Ref.set(cachedEntitiesRef, Option.some([]))

      const damage = yield* internal.getPlayerRangedDamage({ x: 10, y: 64, z: 0 })

      expect(damage).toBe(0)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.some([]))
    }))

  itEntityManagerInternalEffect('invalidates cached ranged damage when a skeleton attacks', ({ entitiesRef, cachedEntitiesRef, internal }) =>
    Effect.gen(function* () {
      const skeleton = makeTestManagedEntity({
        entityId: EntityId.make('entity-skeleton-ranged-damage-wrapper'),
        type: EntityType.Skeleton,
        position: { x: 0, y: 64, z: 0 },
      })
      yield* Ref.set(entitiesRef, HashMap.set(HashMap.empty(), skeleton.entityId, skeleton))
      yield* Ref.set(cachedEntitiesRef, Option.some([]))

      const damage = yield* internal.getPlayerRangedDamage({ x: 10, y: 64, z: 0 })

      expect(damage).toBeGreaterThan(0)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.none())
    }))

  itEntityManagerInternalEffect('leaves empty despawn state unchanged', ({ entitiesRef, cachedEntitiesRef, structureVersionRef, internal }) =>
    Effect.gen(function* () {
      yield* Ref.set(cachedEntitiesRef, Option.some([]))

      const removed = yield* internal.despawnFarEntities({ x: 0, y: 64, z: 0 }, 40)

      expect(removed).toBe(0)
      expect(yield* Ref.get(entitiesRef)).toEqual(HashMap.empty())
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.some([]))
      expect(yield* Ref.get(structureVersionRef)).toBe(0)
    }))

  itEntityManagerInternalEffect('returns None when shearing an unknown entity id', ({ cachedEntitiesRef, internal }) =>
    Effect.gen(function* () {
      yield* Ref.set(cachedEntitiesRef, Option.some([]))

      const result = yield* internal.shearEntity(EntityId.make('entity-missing-shear-target'))

      expect(Option.isNone(result)).toBe(true)
      expect(yield* Ref.get(cachedEntitiesRef)).toEqual(Option.some([]))
    }))
})
