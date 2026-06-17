import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { EntityManager, EntityType } from '@ts-minecraft/entity'
import { itEntityManagerEffect } from './test-utils'

describe('entity/entityManagerLifecycle', () => {
  describe('despawnFarEntities', () => {
    itEntityManagerEffect('removes far and invalid entities and returns the number removed', () =>
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
      }))

    itEntityManagerEffect('retains an entity exactly at maxDistance and removes one just beyond', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Cow, { x: 40, y: 64, z: 0 })
        yield* entityManager.addEntity(EntityType.Pig, { x: 41, y: 64, z: 0 })

        const removedCount = yield* entityManager.despawnFarEntities({ x: 0, y: 64, z: 0 }, 40)
        const remaining = yield* entityManager.getEntities()

        expect(removedCount).toBe(1)
        expect(remaining).toHaveLength(1)
        expect(remaining[0]?.type).toBe(EntityType.Cow)
      }))
  })

  describe('getStructureVersion', () => {
    itEntityManagerEffect('increments on add/remove but not on position-only update', () =>
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
      }))

    itEntityManagerEffect('increments when lethal damage removes an entity', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
        const before = yield* entityManager.getStructureVersion()

        yield* entityManager.applyDamage(entityId, 9999)
        const after = yield* entityManager.getStructureVersion()

        expect(after).toBe(before + 1)
      }))
  })

  describe('despawnAllEntities', () => {
    itEntityManagerEffect('removes all entities and returns the removed count', () =>
      Effect.gen(function* () {
        const em = yield* EntityManager
        yield* em.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        yield* em.addEntity(EntityType.Pig, { x: 5, y: 64, z: 0 })
        const removed = yield* em.despawnAllEntities()
        expect(removed).toBe(2)
        expect(yield* em.getCount()).toBe(0)
      }))

    itEntityManagerEffect('returns 0 when there are no entities to despawn', () =>
      Effect.gen(function* () {
        const em = yield* EntityManager
        const removed = yield* em.despawnAllEntities()
        expect(removed).toBe(0)
        expect(yield* em.getCount()).toBe(0)
      }))
  })
})
