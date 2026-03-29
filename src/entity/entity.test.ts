import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { AIState } from '@/ai/stateMachine'
import { EntityType } from '@/entity/entity'
import { EntityManager, EntityManagerLive } from '@/entity/entityManager'
import { DeltaTimeSecs } from '@/shared/kernel'

describe('entity/entityManager', () => {
  it.effect('adds, retrieves, and removes entities', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
      const countAfterAdd = yield* entityManager.getCount()
      expect(countAfterAdd).toBe(1)

      const entityOpt = yield* entityManager.getEntity(entityId)
      expect(Option.isSome(entityOpt)).toBe(true)
      expect(Option.getOrThrow(entityOpt).type).toBe(EntityType.Zombie)

      const removed = yield* entityManager.removeEntity(entityId)
      expect(removed).toBe(true)

      const removedAgain = yield* entityManager.removeEntity(entityId)
      expect(removedAgain).toBe(false)

      const countAfterRemove = yield* entityManager.getCount()
      expect(countAfterRemove).toBe(0)
    }).pipe(Effect.provide(EntityManagerLive))
  )

  it.effect('updates hostile entities to chase and move toward the player', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(1), { x: 6, y: 64, z: 0 })

      const stateOpt = yield* entityManager.getEntityAIState(entityId)
      expect(Option.isSome(stateOpt)).toBe(true)
      expect(Option.getOrThrow(stateOpt)).toBe(AIState.Chase)

      const entityOpt = yield* entityManager.getEntity(entityId)
      expect(Option.isSome(entityOpt)).toBe(true)
      expect(Option.getOrThrow(entityOpt).position.x).toBeGreaterThan(0)
    }).pipe(Effect.provide(EntityManagerLive))
  )

  it.effect('updates passive entities to flee from nearby player', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(1), { x: 2, y: 64, z: 0 })

      const stateOpt = yield* entityManager.getEntityAIState(entityId)
      expect(Option.isSome(stateOpt)).toBe(true)
      expect(Option.getOrThrow(stateOpt)).toBe(AIState.Flee)

      const entityOpt = yield* entityManager.getEntity(entityId)
      expect(Option.isSome(entityOpt)).toBe(true)
      expect(Option.getOrThrow(entityOpt).position.x).toBeLessThan(0)
    }).pipe(Effect.provide(EntityManagerLive))
  )

  it.effect('returns drops and removes entity when fatal damage is applied', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
      const dropsOpt = yield* entityManager.applyDamage(entityId, 100)
      expect(Option.isSome(dropsOpt)).toBe(true)

      const countAfterKill = yield* entityManager.getCount()
      expect(countAfterKill).toBe(0)
    }).pipe(Effect.provide(EntityManagerLive))
  )
})
