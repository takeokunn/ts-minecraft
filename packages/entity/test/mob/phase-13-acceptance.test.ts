import { describe, expect, it } from 'vitest'
import { Effect, Option } from 'effect'
import { AIState, EntityManager, EntityManagerLive, EntityType } from '@ts-minecraft/entity'
import { DeltaTimeSecs } from '@ts-minecraft/core'

const serviceLive = EntityManagerLive

const runWithEntityManager = <A>(program: Effect.Effect<A, never, EntityManager>): Promise<A> =>
  Effect.runPromise(Effect.provide(program, serviceLive))

const getHealth = (entityManager: EntityManager, entityId: Effect.Effect.Success<ReturnType<EntityManager['addEntity']>>) =>
  Effect.gen(function* () {
    const entityOption = yield* entityManager.getEntity(entityId)
    return Option.getOrThrow(entityOption).health
  })

describe('Phase 13 entity-system acceptance guard', () => {
  it('drives hostile zombies toward the player and passive cows away from the player', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const playerPosition = { x: 8, y: 64, z: 0 }

      const zombieId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(0.05), playerPosition)
      const zombie = Option.getOrThrow(yield* entityManager.getEntity(zombieId))
      const zombieState = Option.getOrThrow(yield* entityManager.getEntityAIState(zombieId))

      expect(zombieState).toBe(AIState.Chase)
      expect(zombie.velocity.x).toBeGreaterThan(0)
      expect(zombie.velocity.z).toBeCloseTo(0, 10)

      const cowId = yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(0.05), playerPosition)
      const cow = Option.getOrThrow(yield* entityManager.getEntity(cowId))
      const cowState = Option.getOrThrow(yield* entityManager.getEntityAIState(cowId))

      expect(cowState).toBe(AIState.Flee)
      expect(cow.velocity.x).toBeLessThan(0)
      expect(cow.velocity.z).toBeCloseTo(0, 10)
    }))
  })

  it('applies hostile contact damage once and gates the immediate second hit by cooldown', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const playerPosition = { x: 1, y: 64, z: 0 }

      yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

      const firstDamage = yield* entityManager.getPlayerContactDamage(playerPosition)
      const secondDamage = yield* entityManager.getPlayerContactDamage(playerPosition)

      expect(firstDamage).toBe(3)
      expect(secondDamage).toBe(0)
    }))
  })

  it('returns rotten flesh drops when lethal damage kills a zombie', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const zombieId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

      const dropsOption = yield* entityManager.applyDamage(zombieId, 20)

      expect(Option.isSome(dropsOption)).toBe(true)
      const drops = Option.getOrThrow(dropsOption)
      expect(drops).toContainEqual({ blockType: 'ROTTEN_FLESH', count: 1 })
      expect(yield* entityManager.getCount()).toBe(0)
    }))
  })

  it('burns hostile mobs in daylight with monotonically decreasing health over the update span', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const entityManager = yield* EntityManager
      const zombieId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
      const playerPosition = { x: 8, y: 64, z: 0 }

      const initialHealth = yield* getHealth(entityManager, zombieId)

      for (let i = 0; i < 20; i++) {
        yield* entityManager.update(DeltaTimeSecs.make(0.05), playerPosition, false)
      }
      const healthAfter20Ticks = yield* getHealth(entityManager, zombieId)

      for (let i = 0; i < 20; i++) {
        yield* entityManager.update(DeltaTimeSecs.make(0.05), playerPosition, false)
      }
      const healthAfter40Ticks = yield* getHealth(entityManager, zombieId)

      for (let i = 0; i < 20; i++) {
        yield* entityManager.update(DeltaTimeSecs.make(0.05), playerPosition, false)
      }
      const healthAfter60Ticks = yield* getHealth(entityManager, zombieId)

      expect(healthAfter20Ticks).toBeLessThan(initialHealth)
      expect(healthAfter40Ticks).toBeLessThan(healthAfter20Ticks)
      expect(healthAfter60Ticks).toBeLessThan(healthAfter40Ticks)
      expect(healthAfter60Ticks).toBe(17)
    }))
  })
})
