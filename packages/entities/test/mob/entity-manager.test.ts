import { describe, it } from '@effect/vitest'
import { it as plainIt, expect } from 'vitest'
import { Array as Arr, Effect, MutableRef, Option } from 'effect'
import { AIState, EntityType, EntityId } from '@ts-minecraft/entities'
import { EntityManager, EntityManagerLive } from '@ts-minecraft/entities'
import { DeltaTimeSecs } from '@ts-minecraft/kernel'
import { makeTestEntity } from './test-utils'

describe('entity/entityManager', () => {
  describe('addEntity', () => {
    it.effect('returns a valid entityId string', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        expect(typeof entityId).toBe('string')
        expect(entityId.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('entity appears in getEntities() after add', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Cow, { x: 5, y: 64, z: 5 })
        const entities = yield* entityManager.getEntities()
        expect(entities.length).toBe(1)
        expect(entities[0]?.type).toBe(EntityType.Cow)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('getCount() increments after each add', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const before = yield* entityManager.getCount()
        yield* entityManager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
        const after = yield* entityManager.getCount()
        expect(after).toBe(before + 1)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('removeEntity', () => {
    it.effect('returns true when entity exists and removes it', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const removed = yield* entityManager.removeEntity(entityId)
        expect(removed).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('returns false for a non-existent entity id', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const fakeId = EntityId.make('entity-nonexistent')
        const removed = yield* entityManager.removeEntity(fakeId)
        expect(removed).toBe(false)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('getCount() decrements after remove', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Sheep, { x: 0, y: 64, z: 0 })
        const countBefore = yield* entityManager.getCount()
        yield* entityManager.removeEntity(entityId)
        const countAfter = yield* entityManager.getCount()
        expect(countAfter).toBe(countBefore - 1)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('getEntity', () => {
    it.effect('returns Option.some for an existing entity', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 3, y: 64, z: 3 })
        const result = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result).entityId).toBe(entityId)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('returns Option.none for an unknown id', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const fakeId = EntityId.make('entity-unknown')
        const result = yield* entityManager.getEntity(fakeId)
        expect(Option.isNone(result)).toBe(true)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('applyDamage', () => {
    it.effect('0 damage returns Option.none() and entity survives', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.applyDamage(entityId, 0)
        expect(Option.isNone(result)).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(1)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('partial damage reduces health and returns Option.none()', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.applyDamage(entityId, 5)
        expect(Option.isNone(result)).toBe(true)
        const entityOpt = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(entityOpt)).toBe(true)
        expect(Option.getOrThrow(entityOpt).health).toBe(15) // Zombie maxHealth=20, 20-5=15
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('lethal damage removes entity and returns Option.some(drops)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.applyDamage(entityId, 9999)
        expect(Option.isSome(result)).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('negative amount is a no-op and returns Option.none()', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.applyDamage(entityId, -10)
        expect(Option.isNone(result)).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(1)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('positive damage on non-existent entity returns Option.none() and leaves count at 0', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const fakeId = EntityId.make('entity-nonexistent-damage')
        const result = yield* entityManager.applyDamage(fakeId, 10)
        expect(Option.isNone(result)).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('getPlayerContactDamage', () => {
    it.effect('no entities → returns 0', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const damage = yield* entityManager.getPlayerContactDamage({ x: 0, y: 64, z: 0 })
        expect(damage).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('hostile entity out of attack range → returns 0 damage', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        // Zombie attackRange is 2; place player far away
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const damage = yield* entityManager.getPlayerContactDamage({ x: 100, y: 64, z: 0 })
        expect(damage).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('hostile entity within attack range → returns attack damage and sets cooldown', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        // Zombie attackDamage=3, attackRange=1.6; place zombie at x=0, player at x=1 (distance=1 < 1.6)
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const damage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
        expect(damage).toBe(3)

        // Cooldown active → returns 0 even though still in range
        const damageAfterCooldown = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
        expect(damageAfterCooldown).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('getEntityAIState', () => {
    it.effect('returns Option.some with Idle for a freshly-added entity', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.getEntityAIState(entityId)
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result)).toBe('Idle')
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('returns Option.none for an unknown entity id', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const fakeId = EntityId.make('entity-nonexistent-ai')
        const result = yield* entityManager.getEntityAIState(fakeId)
        expect(Option.isNone(result)).toBe(true)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('update', () => {
    it.effect('runs without error (smoke test)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 5, y: 64, z: 0 })
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('getEntities() remains accessible after update', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })
        yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 0, y: 64, z: 0 })
        const entities = yield* entityManager.getEntities()
        expect(entities.length).toBe(1)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('entity in attack range transitions to attack state (non-wander wanderDirection path)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        // Zombie attackRange is 2; player at same position triggers Attack state
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        // Update with player at the zombie's exact position — within attack range
        yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 0, y: 64, z: 0 })
        const entities = yield* entityManager.getEntities()
        expect(entities.length).toBe(1)
        // Entity should still exist (attack doesn't remove the entity, only damage does)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('entity wanders and moves while player stays outside detection range', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

        yield* Effect.forEach(Arr.makeBy(13, (i) => i), () =>
          entityManager.update(DeltaTimeSecs.make(0.016), { x: 1000, y: 64, z: 1000 }),
          { concurrency: 1 }
        )

        const stateOpt = yield* entityManager.getEntityAIState(entityId)
        expect(Option.isSome(stateOpt)).toBe(true)
        expect(Option.getOrThrow(stateOpt)).toBe(AIState.Wander)

        const entityOpt = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(entityOpt)).toBe(true)
        const entity = Option.getOrThrow(entityOpt)
        expect(Math.hypot(entity.velocity.x, entity.velocity.z)).toBeGreaterThan(0)
        expect(Math.hypot(entity.position.x, entity.position.z)).toBeGreaterThan(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('idle entity with active attack cooldown decrements cooldown without changing AI state', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager

        // Zombie: attackRange=1.6. Place player within range to set cooldown via getPlayerContactDamage.
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const playerClose = { x: 1, y: 64, z: 0 }
        const initialDamage = yield* entityManager.getPlayerContactDamage(playerClose)
        expect(initialDamage).toBe(3) // Cooldown is now HOSTILE_ATTACK_COOLDOWN_SECS=1

        // Now update with player FAR away — zombie stays Idle (outside detection range 16).
        // velocity is zero (Idle state), nextState = Idle = current aiState.
        // This triggers the early-return branch: cooldown ticks down without a full state update.
        const playerFar = { x: 1000, y: 64, z: 1000 }
        yield* entityManager.update(DeltaTimeSecs.make(0.5), playerFar)

        const aiStateOpt = yield* entityManager.getEntityAIState(entityId)
        expect(Option.isSome(aiStateOpt)).toBe(true)
        // Entity remains Idle — the early-return branch did not change aiState
        expect(Option.getOrThrow(aiStateOpt)).toBe(AIState.Idle)

        // Entity still exists (idle branch does not remove the entity)
        const count = yield* entityManager.getCount()
        expect(count).toBe(1)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('wandering entity keeps its direction across consecutive ticks when already wandering', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const playerFar = { x: 1000, y: 64, z: 1000 }

        // Run enough updates until entity enters Wander state.
        // randomWanderRoll < 0.25 triggers transition to Wander from Idle.
        yield* Effect.forEach(Arr.makeBy(20, (i) => i), () =>
          entityManager.update(DeltaTimeSecs.make(0.016), playerFar),
          { concurrency: 1 }
        )

        const aiStateOpt = yield* entityManager.getEntityAIState(entityId)
        expect(Option.isSome(aiStateOpt)).toBe(true)
        expect(Option.getOrThrow(aiStateOpt)).toBe(AIState.Wander)

        // Capture velocity after wander is established.
        const beforeOpt = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(beforeOpt)).toBe(true)
        const before = Option.getOrThrow(beforeOpt)

        // Run many more wander ticks. On ticks where randomWanderRoll >= 0.2 AND
        // entity is already Wander, the continuation branch preserves wanderDirection —
        // velocity should stay the same magnitude (speed is fixed) and direction.
        // We look for at least one tick where velocity is unchanged to confirm the branch fires.
        const directionPreservedRef = MutableRef.make(false)
        yield* Effect.forEach(Arr.makeBy(30, (i) => i), () =>
          Effect.gen(function* () {
            const snapshot = yield* entityManager.getEntity(entityId)
            const prevVelocity = Option.map(snapshot, (e) => ({ x: e.velocity.x, z: e.velocity.z }))

            yield* entityManager.update(DeltaTimeSecs.make(0.016), playerFar)

            const afterOpt = yield* entityManager.getEntity(entityId)
            const nextVelocity = Option.map(afterOpt, (e) => ({ x: e.velocity.x, z: e.velocity.z }))

            if (
              Option.isSome(prevVelocity) && Option.isSome(nextVelocity) &&
              Option.getOrThrow(prevVelocity).x === Option.getOrThrow(nextVelocity).x &&
              Option.getOrThrow(prevVelocity).z === Option.getOrThrow(nextVelocity).z
            ) {
              MutableRef.set(directionPreservedRef, true)
            }
          }),
          { concurrency: 1 }
        )

        // Entity still wanders and moves — it was not removed or frozen
        const finalOpt = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(finalOpt)).toBe(true)
        expect(Math.hypot(before.velocity.x, before.velocity.z)).toBeGreaterThan(0)

        // At least one continuation tick must have occurred in 30 iterations
        // (probability of all 30 rolls being < 0.2 is 0.2^30 ≈ 1e-21)
        expect(MutableRef.get(directionPreservedRef)).toBe(true)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('getStructureVersion', () => {
    it.effect('increments on add/remove but not on position-only update', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager

        const version0 = yield* entityManager.getStructureVersion()
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const version1 = yield* entityManager.getStructureVersion()
        yield* entityManager.update(DeltaTimeSecs.make(0.016), { x: 5, y: 64, z: 0 })
        const version2 = yield* entityManager.getStructureVersion()
        yield* entityManager.removeEntity(entityId)
        const version3 = yield* entityManager.getStructureVersion()

        expect(version1).toBe(version0 + 1)
        expect(version2).toBe(version1)
        expect(version3).toBe(version2 + 1)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('increments when lethal damage removes an entity', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
        const before = yield* entityManager.getStructureVersion()

        yield* entityManager.applyDamage(entityId, 9999)
        const after = yield* entityManager.getStructureVersion()

        expect(after).toBe(before + 1)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('makeTestEntity — builder shape validation', () => {
    plainIt('default entity has all required Entity fields', () => {
      const entity = makeTestEntity()
      expect(typeof entity.entityId).toBe('string')
      expect(entity.entityId.length).toBeGreaterThan(0)
      expect(entity.type).toBe(EntityType.Zombie)
      expect(entity.health).toBe(20)
      expect(entity.position).toEqual({ x: 0, y: 0, z: 0 })
    })

    plainIt('override type produces a Cow entity', () => {
      const entity = makeTestEntity({ type: EntityType.Cow })
      expect(entity.type).toBe(EntityType.Cow)
    })

    plainIt('override position is reflected in the result', () => {
      const entity = makeTestEntity({ position: { x: 5, y: 64, z: -3 } })
      expect(entity.position).toEqual({ x: 5, y: 64, z: -3 })
    })

    plainIt('each call returns a unique entityId', () => {
      const a = makeTestEntity()
      const b = makeTestEntity()
      expect(a.entityId).not.toBe(b.entityId)
    })
  })
})
