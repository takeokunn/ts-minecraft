import { describe, expect } from '@effect/vitest'
import { Effect } from 'effect'
import { AIState } from '@ts-minecraft/entity/domain/mob/state-machine';
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager';
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { itEntityManagerEffect, unwrapSome, unwrapSomeEffect } from './test-utils'

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
  itEntityManagerEffect('adds, retrieves, and removes entities', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
      const countAfterAdd = yield* entityManager.getCount()
      expect(countAfterAdd).toBe(1)

      const entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
      expect(entity.type).toBe(EntityType.Zombie)

      const removed = yield* entityManager.removeEntity(entityId)
      expect(removed).toBe(true)

      const removedAgain = yield* entityManager.removeEntity(entityId)
      expect(removedAgain).toBe(false)

      const countAfterRemove = yield* entityManager.getCount()
      expect(countAfterRemove).toBe(0)
    }))

  itEntityManagerEffect('updates hostile entities to chase and move toward the player', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(1), { x: 6, y: 64, z: 0 })
      yield* entityManager.applyPhysics(
        DeltaTimeSecs.make(1),
        passThroughResolver(false),
      )

      expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Chase)

      const entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
      expect(entity.position.x).toBeGreaterThan(0)
    }))

  itEntityManagerEffect('returns the same flying entity when physics does not change its frame', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.EnderDragon, { x: 0, y: 64, z: 0 })
      const before = yield* unwrapSomeEffect(entityManager.getEntity(entityId))

      yield* entityManager.applyPhysics(
        DeltaTimeSecs.make(1),
        passThroughResolver(false),
      )

      const after = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
      expect(after).toStrictEqual(before)
    }))

  itEntityManagerEffect('updates passive entities to flee from nearby player', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })
      yield* entityManager.update(DeltaTimeSecs.make(1), { x: 2, y: 64, z: 0 })
      yield* entityManager.applyPhysics(
        DeltaTimeSecs.make(1),
        passThroughResolver(false),
      )

      expect(yield* unwrapSomeEffect(entityManager.getEntityAIState(entityId))).toBe(AIState.Flee)

      const entity = yield* unwrapSomeEffect(entityManager.getEntity(entityId))
      expect(entity.position.x).toBeLessThan(0)
    }))

  itEntityManagerEffect('reports hostile contact damage when a zombie is within attack range', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })

      const damage = yield* entityManager.getPlayerContactDamage({ x: 1, y: 64, z: 0 })
      expect(damage).toBe(3)
    }))

  itEntityManagerEffect('applies hostile contact damage only once per cooldown window', () =>
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
    }))

  itEntityManagerEffect('continues ticking hostile attack cooldown while the mob remains in Attack state', () =>
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
    }))

  itEntityManagerEffect('does not report contact damage for passive mobs', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })

      const damage = yield* entityManager.getPlayerContactDamage({ x: 0.5, y: 64, z: 0 })
      expect(damage).toBe(0)
    }))

  itEntityManagerEffect('returns drops and removes entity when fatal damage is applied', () =>
    Effect.gen(function* () {
      const entityManager = yield* EntityManager

      const entityId = yield* entityManager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
      const dropsOpt = yield* entityManager.applyDamage(entityId, 100)
      unwrapSome(dropsOpt)

      const countAfterKill = yield* entityManager.getCount()
      expect(countAfterKill).toBe(0)
    }))
})
