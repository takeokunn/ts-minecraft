import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { EntityType } from '@/entity/entity'
import { EntityManager, EntityManagerLive } from './entityManager'
import { DeltaTimeSecs } from '@/shared/kernel'

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
        const { EntityId } = yield* Effect.promise(() => import('@/entity/entity'))
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
        const { EntityId } = yield* Effect.promise(() => import('@/entity/entity'))
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
  })
})
