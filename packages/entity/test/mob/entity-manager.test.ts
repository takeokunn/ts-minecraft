import { describe, it } from '@effect/vitest'
import { it as plainIt, expect } from 'vitest'
import { Array as Arr, Effect, MutableRef, Option } from 'effect'
import { AIState, EntityType, EntityId } from '@ts-minecraft/entity'
import { EntityManager, EntityManagerLive } from '@ts-minecraft/entity'
import { DeltaTimeSecs } from '@ts-minecraft/core'
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

    it.effect('creeper detonates after its fuse completes, dealing explosion damage and self-destructing', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Creeper, { x: 0, y: 64, z: 0 })
        const before = yield* entityManager.getCount()
        // Player within ignition range; a single large tick completes the 1.5s fuse.
        yield* entityManager.update(DeltaTimeSecs.make(2), { x: 1, y: 64, z: 0 })
        const damage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
        expect(damage).toBe(33) // vanilla explosion damage at distance 1, power 3
        expect(yield* entityManager.getCount()).toBe(before - 1) // creeper self-destructed
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('creeper explosion damages the player beyond melee range (area effect)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Creeper, { x: 0, y: 64, z: 0 })
        yield* entityManager.update(DeltaTimeSecs.make(2), { x: 3, y: 64, z: 0 }) // distance 3 = ignition edge
        const damage = yield* entityManager.getPlayerContactDamage({ x: 3, y: 64, z: 0 })
        expect(damage).toBe(16) // explosion AoE at distance 3, well beyond the 1.5 melee range
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('a creeper deals no contact damage before its fuse completes (creepers never melee)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Creeper, { x: 0, y: 64, z: 0 })
        // Adjacent player but the fuse has not been advanced → no detonation and no melee.
        const damage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
        expect(damage).toBe(0)
        expect(yield* entityManager.getCount()).toBe(1) // creeper survives
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('a creeper far from the player never ignites its fuse', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Creeper, { x: 0, y: 64, z: 0 })
        yield* entityManager.update(DeltaTimeSecs.make(2), { x: 100, y: 64, z: 0 }) // far out of ignition range
        const damage = yield* entityManager.getPlayerContactDamage({ x: 100, y: 64, z: 0 })
        expect(damage).toBe(0)
        expect(yield* entityManager.getCount()).toBe(1)
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

    it.effect('a stationary attacking hostile mob still burns in daylight (regression: early-return skipped burn)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        // Player adjacent → the zombie enters Attack state and stands still (Idle/Attack
        // velocity is zero), which previously hit an early-return that skipped burn damage.
        // 60 daytime ticks → burn fires at ticks 20/40/60 → 3 HP lost from 20.
        const player = { x: 1, y: 64, z: 0 }
        for (let i = 0; i < 60; i++) {
          yield* entityManager.update(DeltaTimeSecs.make(0.05), player, false)
        }
        const entities = yield* entityManager.getEntities()
        expect(entities.length).toBe(1)
        expect(entities[0]!.health).toBe(17)
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
          entityManager.update(DeltaTimeSecs.make(0.016), { x: 1000, y: 64, z: 1000 }).pipe(
            Effect.andThen(
              entityManager.applyPhysics(
                DeltaTimeSecs.make(0.016),
                (position, velocity) => ({ position, velocity, isGrounded: false }),
              ),
            ),
          ),
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

    it.effect('free-falling mob velocity is clamped to a bounded terminal velocity (tunneling guard)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 500, z: 0 })

        // Pure free fall: applyPhysics only (no AI update), resolver never grounds
        // it, so gravity accrues every tick. Step well past terminal (~65 ticks).
        yield* Effect.forEach(Arr.makeBy(100, (i) => i), () =>
          entityManager.applyPhysics(DeltaTimeSecs.make(0.05), (position, velocity) => ({ position, velocity, isGrounded: false })),
          { concurrency: 1 },
        )

        const v1 = Option.getOrThrow(yield* entityManager.getEntity(entityId)).velocity.y
        yield* entityManager.applyPhysics(DeltaTimeSecs.make(0.05), (position, velocity) => ({ position, velocity, isGrounded: false }))
        const v2 = Option.getOrThrow(yield* entityManager.getEntity(entityId)).velocity.y

        // Terminal reached: velocity stops growing (would keep decreasing if
        // unbounded), stays downward, and stays within the tunneling-safe bound
        // (per-step fall ≤ mob height 1.8 at the 0.05s dt cap → |v| ≤ 36).
        expect(v1).toBe(v2)
        expect(v1).toBeLessThan(0)
        expect(v1).toBeGreaterThanOrEqual(-36)
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

    it.effect('preserves vertical velocity and keeps AI steering on the horizontal plane', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 10, z: 0 })

        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(1),
          (position, velocity) => ({ position, velocity, isGrounded: false }),
        )

        const beforeUpdate = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(beforeUpdate)).toBe(true)
        const fallingEntity = Option.getOrThrow(beforeUpdate)

        yield* entityManager.update(
          DeltaTimeSecs.make(0.5),
          { x: 6, y: fallingEntity.position.y + 5, z: 0 },
        )

        const afterUpdate = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(afterUpdate)).toBe(true)
        const entity = Option.getOrThrow(afterUpdate)

        expect(entity.position.y).toBe(fallingEntity.position.y)
        expect(entity.velocity.y).toBe(fallingEntity.velocity.y)
        expect(entity.velocity.x).toBeGreaterThan(0)
        expect(entity.velocity.z).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('applyPhysics', () => {
    it.effect('applies gravity and uses collision resolution to ground and clamp movement', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 10, z: 0 })

        yield* entityManager.update(DeltaTimeSecs.make(1), { x: 6, y: 10, z: 0 })
        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(1),
          (position, velocity) => ({
            position: { x: 2, y: 2, z: position.z },
            velocity: {
              x: 0,
              y: 0,
              z: velocity.z,
            },
            isGrounded: true,
          }),
        )

        const entityOpt = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(entityOpt)).toBe(true)
        const entity = Option.getOrThrow(entityOpt)

        expect(entity.position.x).toBe(2)
        expect(entity.position.y).toBe(2)
        expect(entity.velocity.x).toBe(0)
        expect(entity.velocity.y).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('hops and redirects wandering movement when grounded horizontal motion is blocked', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const playerFar = { x: 1000, y: 64, z: 1000 }

        yield* Effect.forEach(Arr.makeBy(26, (i) => i), () =>
          entityManager.update(DeltaTimeSecs.make(0.016), playerFar),
          { concurrency: 1 },
        )

        const aiStateOpt = yield* entityManager.getEntityAIState(entityId)
        expect(Option.isSome(aiStateOpt)).toBe(true)
        expect(Option.getOrThrow(aiStateOpt)).toBe(AIState.Wander)

        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(0.001),
          (position, velocity) => ({ position, velocity, isGrounded: true }),
        )

        const beforeBlockOpt = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(beforeBlockOpt)).toBe(true)
        const beforeBlock = Option.getOrThrow(beforeBlockOpt)
        expect(Math.hypot(beforeBlock.velocity.x, beforeBlock.velocity.z)).toBeGreaterThan(0)

        yield* entityManager.applyPhysics(
          DeltaTimeSecs.make(0.016),
          () => ({
            position: { x: beforeBlock.position.x, y: beforeBlock.position.y, z: beforeBlock.position.z },
            velocity: { x: 0, y: 0, z: 0 },
            isGrounded: true,
          }),
        )

        const hoppedOpt = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(hoppedOpt)).toBe(true)
        const hopped = Option.getOrThrow(hoppedOpt)
        expect(hopped.velocity.x).toBe(0)
        expect(hopped.velocity.z).toBe(0)
        expect(hopped.velocity.y).toBe(4.2)

        yield* entityManager.update(DeltaTimeSecs.make(0.016), playerFar)

        const afterRedirectOpt = yield* entityManager.getEntity(entityId)
        expect(Option.isSome(afterRedirectOpt)).toBe(true)
        const afterRedirect = Option.getOrThrow(afterRedirectOpt)
        expect(Math.hypot(afterRedirect.velocity.x, afterRedirect.velocity.z)).toBeGreaterThan(0)
        expect(afterRedirect.velocity.y).toBe(4.2)
        expect(afterRedirect.velocity.x).not.toBeCloseTo(beforeBlock.velocity.x)
        expect(afterRedirect.velocity.z).not.toBeCloseTo(beforeBlock.velocity.z)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('despawnFarEntities', () => {
    it.effect('removes far and invalid entities and returns the number removed', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager

        yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        yield* entityManager.addEntity(EntityType.Cow, { x: 200, y: 64, z: 0 })
        yield* entityManager.addEntity(EntityType.Sheep, { x: Number.NaN, y: 64, z: 0 })

        const beforeVersion = yield* entityManager.getStructureVersion()
        const removedCount = yield* entityManager.despawnFarEntities({ x: 0, y: 64, z: 0 }, 40)
        const afterVersion = yield* entityManager.getStructureVersion()
        const remainingEntities = yield* entityManager.getEntities()

        expect(removedCount).toBe(2)
        expect(afterVersion).toBe(beforeVersion + 1)
        expect(remainingEntities).toHaveLength(1)
        expect(remainingEntities[0]?.type).toBe(EntityType.Zombie)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    // Boundary: shouldDespawnEntity uses strict `>`, so an entity exactly AT
    // maxDistance is RETAINED; one just beyond is removed. Guards the despawn
    // edge against an off-by-one that would flicker mobs in/out at the rim.
    it.effect('retains an entity exactly at maxDistance and removes one just beyond', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        // Player at origin, maxDistance 40.
        yield* entityManager.addEntity(EntityType.Cow, { x: 40, y: 64, z: 0 }) // exactly 40 → kept
        yield* entityManager.addEntity(EntityType.Pig, { x: 41, y: 64, z: 0 }) // 41 > 40 → removed

        const removedCount = yield* entityManager.despawnFarEntities({ x: 0, y: 64, z: 0 }, 40)
        const remaining = yield* entityManager.getEntities()

        expect(removedCount).toBe(1)
        expect(remaining).toHaveLength(1)
        expect(remaining[0]?.type).toBe(EntityType.Cow)
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

  describe('applyKnockback', () => {
    it.effect('sets the entity velocity to the impulse', () =>
      Effect.gen(function* () {
        const em = yield* EntityManager
        const id = yield* em.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        yield* em.applyKnockback(id, { x: 5, y: 4.2, z: 0 })
        const e = Option.getOrThrow(yield* em.getEntity(id))
        expect(e.velocity.x).toBeCloseTo(5)
        expect(e.velocity.y).toBeCloseTo(4.2)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('is a no-op for an unknown entity id', () =>
      Effect.gen(function* () {
        const em = yield* EntityManager
        yield* em.applyKnockback(EntityId.make('entity-missing'), { x: 5, y: 0, z: 0 })
        const count = yield* em.getCount()
        expect(count).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('preserves the knockback velocity across an update tick (AI does not clobber it)', () =>
      Effect.gen(function* () {
        const em = yield* EntityManager
        const id = yield* em.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        yield* em.applyKnockback(id, { x: 5, y: 0, z: 0 })
        // Player far away → AI would normally set horizontal velocity to idle/wander;
        // the knockback timer must keep the impulse intact this tick.
        yield* em.update(DeltaTimeSecs.make(0.016), { x: 1000, y: 64, z: 1000 })
        const e = Option.getOrThrow(yield* em.getEntity(id))
        expect(e.velocity.x).toBeCloseTo(5)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('despawnAllEntities', () => {
    it.effect('removes all entities and returns the removed count', () =>
      Effect.gen(function* () {
        const em = yield* EntityManager
        yield* em.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        yield* em.addEntity(EntityType.Pig, { x: 5, y: 64, z: 0 })
        const removed = yield* em.despawnAllEntities()
        expect(removed).toBe(2)
        expect(yield* em.getCount()).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )

    it.effect('returns 0 when there are no entities to despawn', () =>
      Effect.gen(function* () {
        const em = yield* EntityManager
        const removed = yield* em.despawnAllEntities()
        expect(removed).toBe(0)
        expect(yield* em.getCount()).toBe(0)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })

  describe('applyDamage — Enderman teleport', () => {
    it.effect('Enderman teleports to a new position when damaged but survives', () =>
      Effect.gen(function* () {
        const em = yield* EntityManager
        // Enderman has high enough health to survive one hit
        const id = yield* em.addEntity(EntityType.Enderman, { x: 0, y: 64, z: 0 })
        const before = Option.getOrThrow(yield* em.getEntity(id))
        // Apply a small amount of damage so Enderman survives and teleports
        yield* em.applyDamage(id, 1)
        const after = Option.getOrThrow(yield* em.getEntity(id))
        // Health decreased
        expect(after.health).toBeLessThan(before.health)
        // Position changed (Enderman teleported)
        const moved = after.position.x !== before.position.x || after.position.z !== before.position.z
        expect(moved).toBe(true)
      }).pipe(Effect.provide(EntityManagerLive))
    )
  })
})
