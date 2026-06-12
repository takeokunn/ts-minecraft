import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { AIState } from '@ts-minecraft/entity'
import { EntityType, EntityManager, EntityManagerLive } from '@ts-minecraft/entity'
import { DeltaTimeSecs } from '@ts-minecraft/core'

// Output-parameter CollisionResolver: writes the corrected pose into outPos/outVel and
// returns isGrounded. Pass-through copies the candidate pose verbatim.
type Vec = { x: number; y: number; z: number }
const passThroughResolver =
  (isGrounded: boolean) =>
  (outPos: Vec, outVel: Vec, position: Vec, velocity: Vec): boolean => {
    outPos.x = position.x; outPos.y = position.y; outPos.z = position.z
    outVel.x = velocity.x; outVel.y = velocity.y; outVel.z = velocity.z
    return isGrounded
  }

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
      yield* entityManager.applyPhysics(
        DeltaTimeSecs.make(1),
        passThroughResolver(false),
      )

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
      yield* entityManager.applyPhysics(
        DeltaTimeSecs.make(1),
        passThroughResolver(false),
      )

      const stateOpt = yield* entityManager.getEntityAIState(entityId)
      expect(Option.isSome(stateOpt)).toBe(true)
      expect(Option.getOrThrow(stateOpt)).toBe(AIState.Flee)

      const entityOpt = yield* entityManager.getEntity(entityId)
      expect(Option.isSome(entityOpt)).toBe(true)
      expect(Option.getOrThrow(entityOpt).position.x).toBeLessThan(0)
    }).pipe(Effect.provide(EntityManagerLive))
  )

  it.effect('reports hostile contact damage when a zombie is within attack range', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

      const damage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
      expect(damage).toBe(3)
    }).pipe(Effect.provide(EntityManagerLive))
  )

  it.effect('applies hostile contact damage only once per cooldown window', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

      const firstDamage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
      const immediateDamage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(1), { x: 1, y: 64, z: 0 })
      const damageAfterCooldown = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })

      expect(firstDamage).toBe(3)
      expect(immediateDamage).toBe(0)
      expect(damageAfterCooldown).toBe(3)
    }).pipe(Effect.provide(EntityManagerLive))
  )

  it.effect('continues ticking hostile attack cooldown while the mob remains in Attack state', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(0.1), { x: 1, y: 64, z: 0 })

      const firstDamage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(0.5), { x: 1, y: 64, z: 0 })
      const midCooldownDamage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(0.5), { x: 1, y: 64, z: 0 })
      const damageAfterFullCooldown = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })

      expect(firstDamage).toBe(3)
      expect(midCooldownDamage).toBe(0)
      expect(damageAfterFullCooldown).toBe(3)
    }).pipe(Effect.provide(EntityManagerLive))
  )

  it.effect('does not report contact damage for passive mobs', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })

      const damage = yield* entityManager.getPlayerContactDamage({ x: 0.5, y: 64, z: 0 })
      expect(damage).toBe(0)
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
