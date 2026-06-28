import { describe } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager';
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { expectSome, itEntityManagerEffect } from './test-utils'

describe('entity/entityManagerCore', () => {
  describe('addEntity', () => {
    itEntityManagerEffect('returns a valid entityId string', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        expect(typeof entityId).toBe('string')
        expect(entityId.length).toBeGreaterThan(0)
      }))

    itEntityManagerEffect('entity appears in getEntities() after add', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        yield* entityManager.addEntity(EntityType.Cow, { x: 5, y: 64, z: 5 })
        const entities = yield* entityManager.getEntities()
        expect(entities.length).toBe(1)
        expect(entities[0]?.type).toBe(EntityType.Cow)
      }))

    itEntityManagerEffect('getCount() increments after each add', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const before = yield* entityManager.getCount()
        yield* entityManager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
        const after = yield* entityManager.getCount()
        expect(after).toBe(before + 1)
      }))
  })

  describe('removeEntity', () => {
    itEntityManagerEffect('returns true when entity exists and removes it', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const removed = yield* entityManager.removeEntity(entityId)
        expect(removed).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(0)
      }))

    itEntityManagerEffect('returns false for a non-existent entity id', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const fakeId = EntityId.make('entity-nonexistent')
        const removed = yield* entityManager.removeEntity(fakeId)
        expect(removed).toBe(false)
      }))

    itEntityManagerEffect('getCount() decrements after remove', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Sheep, { x: 0, y: 64, z: 0 })
        const countBefore = yield* entityManager.getCount()
        yield* entityManager.removeEntity(entityId)
        const countAfter = yield* entityManager.getCount()
        expect(countAfter).toBe(countBefore - 1)
      }))
  })

  describe('applyEntitySnapshot', () => {
    itEntityManagerEffect('upserts, updates, and removes snapshot entities through the public API', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = EntityId.make('remote:player-b:entity-1')
        const beforeVersion = yield* entityManager.getStructureVersion()

        const created = yield* entityManager.applyEntitySnapshot({
          entityId,
          entityType: EntityType.Creeper,
          position: { x: 1, y: 64, z: 2 },
          health: 999,
          alive: true,
          velocity: { x: 0.5, y: 0.25, z: -0.5 },
          rotation: { x: 0, y: 0.707, z: 0, w: 0.707 },
          isBaby: true,
          fuseSecs: 3,
          fireSecs: 6,
        })
        const createdVersion = yield* entityManager.getStructureVersion()
        const createdEntity = expectSome(yield* entityManager.getEntity(entityId))

        expect(created).toBe('created')
        expect(createdVersion).toBe(beforeVersion + 1)
        expect(createdEntity.type).toBe(EntityType.Creeper)
        expect(createdEntity.position).toEqual({ x: 1, y: 64, z: 2 })
        expect(createdEntity.velocity).toEqual({ x: 0.5, y: 0.25, z: -0.5 })
        expect(createdEntity.rotation).toEqual({ x: 0, y: 0.707, z: 0, w: 0.707 })
        expect(createdEntity.isBaby).toBe(true)
        expect(createdEntity.fuseSecs).toBe(3)
        expect(createdEntity.fireSecs).toBe(6)
        expect(createdEntity.health).toBeLessThanOrEqual(999)

        const updated = yield* entityManager.applyEntitySnapshot({
          entityId,
          entityType: EntityType.Creeper,
          position: { x: 3, y: 65, z: 4 },
          health: 4,
          alive: true,
          velocity: { x: 1, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 1, w: 0 },
          isBaby: false,
          fuseSecs: 1.5,
          fireSecs: 2,
        })
        const updatedVersion = yield* entityManager.getStructureVersion()
        const updatedEntity = expectSome(yield* entityManager.getEntity(entityId))

        expect(updated).toBe('updated')
        expect(updatedVersion).toBe(createdVersion)
        expect(updatedEntity.position).toEqual({ x: 3, y: 65, z: 4 })
        expect(updatedEntity.velocity).toEqual({ x: 1, y: 0, z: 0 })
        expect(updatedEntity.rotation).toEqual({ x: 0, y: 0, z: 1, w: 0 })
        expect(updatedEntity.isBaby).toBe(false)
        expect(updatedEntity.fuseSecs).toBe(1.5)
        expect(updatedEntity.fireSecs).toBe(2)
        expect(updatedEntity.health).toBe(4)

        const removed = yield* entityManager.applyEntitySnapshot({
          entityId,
          entityType: EntityType.Cow,
          position: updatedEntity.position,
          health: 0,
          alive: false,
        })
        const removedVersion = yield* entityManager.getStructureVersion()
        const missing = yield* entityManager.getEntity(entityId)

        expect(removed).toBe('removed')
        expect(removedVersion).toBe(updatedVersion + 1)
        expect(Option.isNone(missing)).toBe(true)
      }))
  })

  describe('getEntity', () => {
    itEntityManagerEffect('returns Option.some for an existing entity', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 3, y: 64, z: 3 })
        const result = yield* entityManager.getEntity(entityId)
        expect(expectSome(result).entityId).toBe(entityId)
      }))

    itEntityManagerEffect('returns Option.none for an unknown id', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const fakeId = EntityId.make('entity-unknown')
        const result = yield* entityManager.getEntity(fakeId)
        expect(Option.isNone(result)).toBe(true)
      }))
  })

  describe('applyDamage', () => {
    itEntityManagerEffect('0 damage returns Option.none() and entity survives', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.applyDamage(entityId, 0)
        expect(Option.isNone(result)).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(1)
      }))

    itEntityManagerEffect('partial damage reduces health and returns Option.none()', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Zombie, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.applyDamage(entityId, 5)
        expect(Option.isNone(result)).toBe(true)
        const entityOpt = yield* entityManager.getEntity(entityId)
        expect(expectSome(entityOpt).health).toBe(15) // Zombie maxHealth=20, 20-5=15
      }))

    itEntityManagerEffect('lethal damage removes entity and returns Option.some(drops)', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.applyDamage(entityId, 9999)
        expectSome(result)
        const count = yield* entityManager.getCount()
        expect(count).toBe(0)
      }))

    itEntityManagerEffect('negative amount is a no-op and returns Option.none()', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const entityId = yield* entityManager.addEntity(EntityType.Cow, { x: 0, y: 64, z: 0 })
        const result = yield* entityManager.applyDamage(entityId, -10)
        expect(Option.isNone(result)).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(1)
      }))

    itEntityManagerEffect('positive damage on non-existent entity returns Option.none() and leaves count at 0', () =>
      Effect.gen(function* () {
        const entityManager = yield* EntityManager
        const fakeId = EntityId.make('entity-nonexistent-damage')
        const result = yield* entityManager.applyDamage(fakeId, 10)
        expect(Option.isNone(result)).toBe(true)
        const count = yield* entityManager.getCount()
        expect(count).toBe(0)
      }))
  })
})
