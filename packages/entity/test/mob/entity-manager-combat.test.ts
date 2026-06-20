import { describe } from '@effect/vitest'
import { expect, it as plainIt } from 'vitest'
import { Effect, HashMap, Option } from 'effect'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager';
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { CREEPER_EXPLOSION_POWER } from '../../domain/explosion'
import { computeExplosionDamageAt } from '../../domain/explosion-resolution'
import { CREEPER_FUSE_SECONDS } from '../../domain/mob/creeper-fuse'
import { HOSTILE_ATTACK_COOLDOWN_SECS } from '../../domain/mob/entity-internal'
import { resolvePlayerContactDamage, resolvePlayerRangedDamage } from '../../application/mob/entity-manager-combat'
import { canSkeletonShootPlayer } from '../../application/mob/entity-manager-skeleton-shot'
import { expectSome, itEntityManagerEffect, makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerCombat', () => {
  plainIt('allows skeletons to shoot when the path is clear', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-skeleton-ranged-clear'),
      type: EntityType.Skeleton,
      position: { x: 0, y: 64, z: 0 },
    })

    expect(canSkeletonShootPlayer(entity, { x: 10, y: 64, z: 0 })).toBe(true)
  })

  plainIt('rejects skeleton shots outside attack range', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-skeleton-ranged-out-of-range'),
      type: EntityType.Skeleton,
      position: { x: 0, y: 64, z: 0 },
    })

    expect(canSkeletonShootPlayer(entity, { x: 13, y: 64, z: 0 })).toBe(false)
  })

  plainIt('resolvePlayerContactDamage applies hostile melee and creeper detonation in one pass', () => {
    const zombie = makeTestManagedEntity({
      entityId: EntityId.make('entity-zombie-contact-damage'),
      type: EntityType.Zombie,
      position: { x: 1, y: 64, z: 0 },
    })
    const creeper = makeTestManagedEntity({
      entityId: EntityId.make('entity-creeper-contact-damage'),
      type: EntityType.Creeper,
      fuseSecs: CREEPER_FUSE_SECONDS,
      position: { x: 0, y: 64, z: 0 },
    })
    const entities = HashMap.set(
      HashMap.set(HashMap.empty(), zombie.entityId, zombie),
      creeper.entityId,
      creeper,
    )

    const [resolution, updatedEntities] = resolvePlayerContactDamage(entities, { x: 0, y: 64, z: 0 })

    expect(resolution.removed).toBe(true)
    expect(resolution.explosions).toEqual([
      {
        source: 'creeper',
        position: { x: 0, y: 64, z: 0 },
        power: CREEPER_EXPLOSION_POWER,
      },
    ])
    expect(resolution.damage).toBe(
      zombie.attackDamage + computeExplosionDamageAt(creeper.position, CREEPER_EXPLOSION_POWER, { x: 0, y: 64, z: 0 }),
    )
    expect(HashMap.get(updatedEntities, creeper.entityId)).toEqual(Option.none())
    expect(HashMap.get(updatedEntities, zombie.entityId)).toEqual(
      Option.some({
        ...zombie,
        attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
      }),
    )
  })

  plainIt('resolvePlayerContactDamage ignores skeletons and unprovoked endermen', () => {
    const skeleton = makeTestManagedEntity({
      entityId: EntityId.make('entity-skeleton-contact-ignored'),
      type: EntityType.Skeleton,
      position: { x: 0, y: 64, z: 0 },
    })
    const enderman = makeTestManagedEntity({
      entityId: EntityId.make('entity-enderman-contact-ignored'),
      type: EntityType.Enderman,
      position: { x: 0, y: 64, z: 0 },
    })
    const entities = HashMap.set(
      HashMap.set(HashMap.empty(), skeleton.entityId, skeleton),
      enderman.entityId,
      enderman,
    )

    const [resolution, updatedEntities] = resolvePlayerContactDamage(entities, { x: 0, y: 64, z: 0 })

    expect(resolution.damage).toBe(0)
    expect(resolution.removed).toBe(false)
    expect(resolution.explosions).toEqual([])
    expect(updatedEntities).toEqual(entities)
  })

  plainIt('resolvePlayerRangedDamage applies skeleton damage and cooldown', () => {
    const skeleton = makeTestManagedEntity({
      entityId: EntityId.make('entity-skeleton-ranged-damage'),
      type: EntityType.Skeleton,
      position: { x: 0, y: 64, z: 0 },
    })
    const zombie = makeTestManagedEntity({
      entityId: EntityId.make('entity-zombie-ranged-damage'),
      type: EntityType.Zombie,
      position: { x: 1, y: 64, z: 0 },
    })
    const entities = HashMap.set(
      HashMap.set(HashMap.empty(), skeleton.entityId, skeleton),
      zombie.entityId,
      zombie,
    )

    const [resolution, updatedEntities] = resolvePlayerRangedDamage(entities, { x: 10, y: 64, z: 0 })

    expect(resolution.damage).toBe(skeleton.attackDamage)
    expect(HashMap.get(updatedEntities, skeleton.entityId)).toEqual(
      Option.some({
        ...skeleton,
        attackCooldownRemaining: HOSTILE_ATTACK_COOLDOWN_SECS,
      }),
    )
    expect(HashMap.get(updatedEntities, zombie.entityId)).toEqual(Option.some(zombie))
  })
})

describe('entity/entityManagerCombat integration', () => {
  itEntityManagerEffect('applyDamage teleports Endermen when they survive the hit', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const entityId = yield* entityManager.addEntity(EntityType.Enderman, { x: 0, y: 64, z: 0 })
      const before = expectSome(yield* entityManager.getEntity(entityId))

      yield* entityManager.applyDamage(entityId, 1)

      const after = expectSome(yield* entityManager.getEntity(entityId))
      expect(after.health).toBeLessThan(before.health)
      expect(after.position.x !== before.position.x || after.position.z !== before.position.z).toBe(true)
    }))

  itEntityManagerEffect('applyKnockback preserves the impulse for the next update tick', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

      yield* entityManager.applyKnockback(entityId, { x: 5, y: 0, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 1000, y: 64, z: 1000 })

      const entity = expectSome(yield* entityManager.getEntity(entityId))
      expect(entity.velocity.x).toBeCloseTo(5)
    }))
})
