/**
 * Entity Domain Service Tests
 * 
 * Example test structure for domain services using Effect-TS testing patterns
 */

import { describe, it, expect } from 'vitest'
import { Effect, TestContext, Layer } from 'effect'
import { EntityDomainService, EntityDomainServiceLive } from '@domain/services/entity.domain-service'

describe('EntityDomainService', () => {
  const TestLayer = Layer.merge(EntityDomainServiceLive, TestContext.TestContext)

  describe('entity lifecycle', () => {
    it('should create entity with empty components', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const entityId = yield* entityService.createEntity({})
        const exists = yield* entityService.entityExists(entityId)
        
        expect(exists).toBe(true)
        expect(typeof entityId).toBe('string')
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it('should create entity with initial components', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const initialComponents = {
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 }
        }
        
        const entityId = yield* entityService.createEntity(initialComponents)
        const retrievedComponents = yield* entityService.getEntityComponents(entityId)
        
        expect(retrievedComponents).toMatchObject(initialComponents)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it('should destroy existing entity', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const entityId = yield* entityService.createEntity({})
        yield* entityService.destroyEntity(entityId)
        const exists = yield* entityService.entityExists(entityId)
        
        expect(exists).toBe(false)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it('should fail to destroy non-existent entity', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const result = yield* Effect.either(entityService.destroyEntity('non-existent'))
        
        expect(result._tag).toBe('Left')
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })

  describe('component management', () => {
    it('should add component to entity', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const entityId = yield* entityService.createEntity({})
        yield* entityService.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 })
        
        const hasComponent = yield* entityService.hasComponent(entityId, 'position')
        const component = yield* entityService.getComponent(entityId, 'position')
        
        expect(hasComponent).toBe(true)
        expect(component).toEqual({ x: 10, y: 20, z: 30 })
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it('should remove component from entity', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const entityId = yield* entityService.createEntity({
          position: { x: 0, y: 0, z: 0 }
        })
        
        yield* entityService.removeComponent(entityId, 'position')
        const hasComponent = yield* entityService.hasComponent(entityId, 'position')
        
        expect(hasComponent).toBe(false)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it('should update existing component', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const entityId = yield* entityService.createEntity({
          position: { x: 0, y: 0, z: 0 }
        })
        
        yield* entityService.updateComponent(entityId, 'position', (pos) => ({
          ...pos,
          x: pos.x + 10
        }))
        
        const updatedComponent = yield* entityService.getComponent(entityId, 'position')
        
        expect(updatedComponent.x).toBe(10)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })

  describe('entity queries', () => {
    it('should query entities by components', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const entity1 = yield* entityService.createEntity({
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 1, y: 0, z: 0 }
        })
        
        const entity2 = yield* entityService.createEntity({
          position: { x: 5, y: 0, z: 0 }
        })
        
        const entitiesWithVelocity = yield* entityService.queryEntities(['velocity'])
        const entitiesWithPosition = yield* entityService.queryEntities(['position'])
        
        expect(entitiesWithVelocity).toContain(entity1)
        expect(entitiesWithVelocity).not.toContain(entity2)
        expect(entitiesWithPosition).toContain(entity1)
        expect(entitiesWithPosition).toContain(entity2)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })

  describe('service statistics', () => {
    it('should track entity count', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        const initialCount = yield* entityService.getEntityCount()
        
        yield* entityService.createEntity({})
        yield* entityService.createEntity({})
        
        const finalCount = yield* entityService.getEntityCount()
        
        expect(finalCount).toBe(initialCount + 2)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it('should provide entity statistics', () =>
      Effect.gen(function* () {
        const entityService = yield* EntityDomainService
        
        yield* entityService.createEntity({ position: { x: 0, y: 0, z: 0 } })
        yield* entityService.createEntity({ velocity: { x: 1, y: 0, z: 0 } })
        
        const stats = yield* entityService.getEntityStats()
        
        expect(stats.totalEntities).toBeGreaterThanOrEqual(2)
        expect(stats.activeEntities).toBeGreaterThanOrEqual(2)
        expect(stats.archetypeCount).toBeGreaterThanOrEqual(2)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })
})