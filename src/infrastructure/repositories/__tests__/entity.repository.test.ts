/**
 * Entity Repository Tests
 * 
 * Comprehensive test suite for EntityRepository implementation using Effect-TS patterns.
 * Tests entity lifecycle, component operations, archetype management, and query functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as TestContext from 'effect/TestContext'
import * as Option from 'effect/Option'

import { 
  EntityRepository, 
  EntityRepositoryLive,
  type EntityMetadata,
  type EntityQueryOptions,
  type EntityChange
} from '../entity.repository'
import { EntityId, toEntityId } from '@domain/entities'
import { Archetype } from '@domain/archetypes'

// Mock component types for testing
interface TestPosition {
  x: number
  y: number
  z: number
}

interface TestVelocity {
  vx: number
  vy: number
  vz: number
}

interface TestHealth {
  current: number
  max: number
}

// Helper to run effects in test context
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(
    Effect.provide(EntityRepositoryLive),
    Effect.provide(TestContext.TestContext)
  ))

// Test data factories
const createTestPosition = (x = 0, y = 0, z = 0): TestPosition => ({ x, y, z })
const createTestVelocity = (vx = 0, vy = 0, vz = 0): TestVelocity => ({ vx, vy, vz })
const createTestHealth = (current = 100, max = 100): TestHealth => ({ current, max })

describe('EntityRepository', () => {
  describe('Entity Lifecycle Management', () => {
    it('should create empty entities with unique IDs', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create multiple entities without archetypes
        const entity1 = yield* repo.createEntity()
        const entity2 = yield* repo.createEntity()
        const entity3 = yield* repo.createEntity()

        // All should have unique IDs
        expect(entity1).not.toBe(entity2)
        expect(entity2).not.toBe(entity3)
        expect(entity1).not.toBe(entity3)

        // All should exist
        expect(yield* repo.entityExists(entity1)).toBe(true)
        expect(yield* repo.entityExists(entity2)).toBe(true)
        expect(yield* repo.entityExists(entity3)).toBe(true)
      }))
    })

    it('should create entities with archetypes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const archetype: Archetype = {
          position: createTestPosition(10, 20, 30),
          velocity: createTestVelocity(1, 0, -1)
        }

        const entityId = yield* repo.createEntity(archetype)

        // Entity should exist
        expect(yield* repo.entityExists(entityId)).toBe(true)

        // Should have the specified components
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(false)

        // Verify metadata
        const metadataOpt = yield* repo.getEntityMetadata(entityId)
        expect(Option.isSome(metadataOpt)).toBe(true)

        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.id).toBe(entityId)
          expect(metadata.componentTypes.has('position' as any)).toBe(true)
          expect(metadata.componentTypes.has('velocity' as any)).toBe(true)
          expect(metadata.generation).toBe(0)
        }
      }))
    })

    it('should destroy entities and cleanup resources', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entity with components
        const archetype: Archetype = {
          position: createTestPosition(5, 5, 5),
          health: createTestHealth(80, 100)
        }

        const entityId = yield* repo.createEntity(archetype)
        expect(yield* repo.entityExists(entityId)).toBe(true)

        // Destroy entity
        const destroyResult = yield* repo.destroyEntity(entityId)
        expect(destroyResult).toBe(true)

        // Entity should no longer exist
        expect(yield* repo.entityExists(entityId)).toBe(false)

        // Metadata should be cleaned up
        const metadataOpt = yield* repo.getEntityMetadata(entityId)
        expect(Option.isNone(metadataOpt)).toBe(true)

        // Components should be cleaned up
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(false)
      }))
    })

    it('should handle destruction of non-existent entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        const nonExistentId = toEntityId(9999)

        // Should return false for non-existent entity
        const result = yield* repo.destroyEntity(nonExistentId)
        expect(result).toBe(false)
      }))
    })

    it('should retrieve entity metadata correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        
        const archetype: Archetype = {
          position: createTestPosition(1, 2, 3)
        }

        const entityId = yield* repo.createEntity(archetype)
        const metadataOpt = yield* repo.getEntityMetadata(entityId)

        expect(Option.isSome(metadataOpt)).toBe(true)

        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.id).toBe(entityId)
          expect(metadata.componentTypes.size).toBe(1)
          expect(metadata.componentTypes.has('position' as any)).toBe(true)
          expect(metadata.createdAt).toBeLessThanOrEqual(Date.now())
          expect(metadata.updatedAt).toBeLessThanOrEqual(Date.now())
          expect(metadata.generation).toBe(0)
        }
      }))
    })
  })

  describe('Component Operations', () => {
    it('should add components to existing entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create empty entity
        const entityId = yield* repo.createEntity()

        // Add components
        const addResult1 = yield* repo.addComponent(entityId, 'position' as any, createTestPosition(1, 2, 3))
        const addResult2 = yield* repo.addComponent(entityId, 'velocity' as any, createTestVelocity(0.5, 0, -0.5))

        expect(addResult1).toBe(true)
        expect(addResult2).toBe(true)

        // Verify components were added
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(true)

        // Verify metadata was updated
        const metadataOpt = yield* repo.getEntityMetadata(entityId)
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.componentTypes.size).toBe(2)
          expect(metadata.generation).toBe(2) // Incremented for each component addition
        }
      }))
    })

    it('should not add duplicate components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const archetype: Archetype = {
          position: createTestPosition(0, 0, 0)
        }

        const entityId = yield* repo.createEntity(archetype)

        // Try to add position component again
        const addResult = yield* repo.addComponent(entityId, 'position' as any, createTestPosition(1, 1, 1))
        expect(addResult).toBe(false)

        // Should still have only one position component
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)

        const metadataOpt = yield* repo.getEntityMetadata(entityId)
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.componentTypes.size).toBe(1)
        }
      }))
    })

    it('should remove components from entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const archetype: Archetype = {
          position: createTestPosition(1, 2, 3),
          velocity: createTestVelocity(1, 0, 0),
          health: createTestHealth(50, 100)
        }

        const entityId = yield* repo.createEntity(archetype)

        // Remove velocity component
        const removeResult = yield* repo.removeComponent(entityId, 'velocity' as any)
        expect(removeResult).toBe(true)

        // Verify component was removed
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(true)

        // Verify metadata was updated
        const metadataOpt = yield* repo.getEntityMetadata(entityId)
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.componentTypes.size).toBe(2)
          expect(metadata.componentTypes.has('velocity' as any)).toBe(false)
          expect(metadata.generation).toBe(1) // Incremented for removal
        }
      }))
    })

    it('should not remove non-existent components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const archetype: Archetype = {
          position: createTestPosition(0, 0, 0)
        }

        const entityId = yield* repo.createEntity(archetype)

        // Try to remove velocity component that doesn't exist
        const removeResult = yield* repo.removeComponent(entityId, 'velocity' as any)
        expect(removeResult).toBe(false)

        // Original component should still exist
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
      }))
    })

    it('should retrieve components from entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        const testPosition = createTestPosition(10, 20, 30)

        const archetype: Archetype = {
          position: testPosition
        }

        const entityId = yield* repo.createEntity(archetype)

        // Get existing component
        const positionOpt = yield* repo.getComponent(entityId, 'position' as any)
        expect(Option.isSome(positionOpt)).toBe(true)
        if (Option.isSome(positionOpt)) {
          expect(positionOpt.value).toEqual(testPosition)
        }

        // Get non-existent component
        const velocityOpt = yield* repo.getComponent(entityId, 'velocity' as any)
        expect(Option.isNone(velocityOpt)).toBe(true)
      }))
    })

    it('should update components correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        const initialPosition = createTestPosition(0, 0, 0)

        const archetype: Archetype = {
          position: initialPosition
        }

        const entityId = yield* repo.createEntity(archetype)

        // Update component
        const updateResult = yield* repo.updateComponent(
          entityId, 
          'position' as any, 
          (pos: TestPosition) => ({ ...pos, x: pos.x + 10, y: pos.y + 5 })
        )

        expect(updateResult).toBe(true)

        // Verify component was updated
        const updatedPositionOpt = yield* repo.getComponent(entityId, 'position' as any)
        expect(Option.isSome(updatedPositionOpt)).toBe(true)
        if (Option.isSome(updatedPositionOpt)) {
          expect(updatedPositionOpt.value).toEqual(createTestPosition(10, 5, 0))
        }

        // Verify metadata was updated
        const metadataOpt = yield* repo.getEntityMetadata(entityId)
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.generation).toBe(1) // Incremented for update
        }
      }))
    })

    it('should not update non-existent components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const entityId = yield* repo.createEntity()

        // Try to update non-existent component
        const updateResult = yield* repo.updateComponent(
          entityId,
          'position' as any,
          (pos: TestPosition) => pos
        )

        expect(updateResult).toBe(false)
      }))
    })
  })

  describe('Bulk Operations', () => {
    it('should create multiple entities from archetypes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const archetypes: Archetype[] = [
          { position: createTestPosition(1, 0, 0) },
          { velocity: createTestVelocity(1, 0, 0) },
          { 
            position: createTestPosition(2, 0, 0),
            health: createTestHealth(75, 100)
          }
        ]

        const entityIds = yield* repo.createEntities(archetypes)

        expect(entityIds.length).toBe(3)
        expect(new Set(entityIds).size).toBe(3) // All unique

        // Verify all entities exist
        for (const entityId of entityIds) {
          expect(yield* repo.entityExists(entityId)).toBe(true)
        }

        // Verify components were assigned correctly
        expect(yield* repo.hasComponent(entityIds[0], 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityIds[1], 'velocity' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityIds[2], 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityIds[2], 'health' as any)).toBe(true)
      }))
    })

    it('should destroy multiple entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entities
        const archetypes: Archetype[] = [
          { position: createTestPosition(1, 0, 0) },
          { velocity: createTestVelocity(1, 0, 0) },
          { health: createTestHealth(100, 100) }
        ]

        const entityIds = yield* repo.createEntities(archetypes)

        // Destroy some entities (including non-existent one)
        const entitiesToDestroy = [entityIds[0], entityIds[2], toEntityId(9999)]
        const destroyedCount = yield* repo.destroyEntities(entitiesToDestroy)

        expect(destroyedCount).toBe(2) // Only existing entities should be counted

        // Verify destruction
        expect(yield* repo.entityExists(entityIds[0])).toBe(false)
        expect(yield* repo.entityExists(entityIds[1])).toBe(true)
        expect(yield* repo.entityExists(entityIds[2])).toBe(false)
      }))
    })

    it('should clone entities with all components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const archetype: Archetype = {
          position: createTestPosition(10, 20, 30),
          velocity: createTestVelocity(1, -1, 0),
          health: createTestHealth(80, 100)
        }

        const originalId = yield* repo.createEntity(archetype)
        const clonedIdOpt = yield* repo.cloneEntity(originalId)

        expect(Option.isSome(clonedIdOpt)).toBe(true)

        if (Option.isSome(clonedIdOpt)) {
          const clonedId = clonedIdOpt.value

          // Clone should be different entity
          expect(clonedId).not.toBe(originalId)

          // Clone should have same components
          expect(yield* repo.hasComponent(clonedId, 'position' as any)).toBe(true)
          expect(yield* repo.hasComponent(clonedId, 'velocity' as any)).toBe(true)
          expect(yield* repo.hasComponent(clonedId, 'health' as any)).toBe(true)

          // Verify component values are the same
          const originalPos = yield* repo.getComponent(originalId, 'position' as any)
          const clonedPos = yield* repo.getComponent(clonedId, 'position' as any)

          expect(Option.isSome(originalPos)).toBe(true)
          expect(Option.isSome(clonedPos)).toBe(true)

          if (Option.isSome(originalPos) && Option.isSome(clonedPos)) {
            expect(clonedPos.value).toEqual(originalPos.value)
          }
        }
      }))
    })

    it('should return None when cloning non-existent entity', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        const nonExistentId = toEntityId(9999)

        const clonedIdOpt = yield* repo.cloneEntity(nonExistentId)
        expect(Option.isNone(clonedIdOpt)).toBe(true)
      }))
    })
  })

  describe('Query Operations', () => {
    it('should find entities by required components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entities with different component combinations
        const entity1 = yield* repo.createEntity({ position: createTestPosition(1, 0, 0) })
        const entity2 = yield* repo.createEntity({ velocity: createTestVelocity(1, 0, 0) })
        const entity3 = yield* repo.createEntity({ 
          position: createTestPosition(2, 0, 0),
          velocity: createTestVelocity(0, 1, 0)
        })
        const entity4 = yield* repo.createEntity({
          position: createTestPosition(3, 0, 0),
          health: createTestHealth(75, 100)
        })

        // Find entities with position component
        const positionEntities = yield* repo.findEntitiesByComponents(['position' as any])
        const positionIds = positionEntities.map(e => e.id)

        expect(positionEntities.length).toBe(3)
        expect(positionIds).toContain(entity1)
        expect(positionIds).toContain(entity3)
        expect(positionIds).toContain(entity4)
        expect(positionIds).not.toContain(entity2)

        // Find entities with both position and velocity
        const bothComponents = yield* repo.findEntitiesByComponents(['position' as any, 'velocity' as any])
        const bothIds = bothComponents.map(e => e.id)

        expect(bothComponents.length).toBe(1)
        expect(bothIds).toContain(entity3)
      }))
    })

    it('should apply query options correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entities with timestamps spread out
        const entities = []
        for (let i = 0; i < 10; i++) {
          const entityId = yield* repo.createEntity({ position: createTestPosition(i, 0, 0) })
          entities.push(entityId)
          // Small delay to ensure different timestamps
          await new Promise(resolve => setTimeout(resolve, 1))
        }

        // Test limit and offset
        const options: EntityQueryOptions = {
          limit: 3,
          offset: 2,
          sortBy: 'createdAt',
          sortOrder: 'asc'
        }

        const results = yield* repo.findEntitiesByComponents(['position' as any], options)
        expect(results.length).toBe(3)

        // Results should be sorted by createdAt in ascending order
        for (let i = 1; i < results.length; i++) {
          expect(results[i].createdAt).toBeGreaterThanOrEqual(results[i - 1].createdAt)
        }
      }))
    })

    it('should exclude entities with specified components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const entity1 = yield* repo.createEntity({ position: createTestPosition(1, 0, 0) })
        const entity2 = yield* repo.createEntity({ 
          position: createTestPosition(2, 0, 0),
          velocity: createTestVelocity(1, 0, 0)
        })
        const entity3 = yield* repo.createEntity({ 
          position: createTestPosition(3, 0, 0),
          health: createTestHealth(100, 100)
        })

        // Find entities with position but exclude those with velocity
        const options: EntityQueryOptions = {
          excludeComponents: ['velocity' as any]
        }

        const results = yield* repo.findEntitiesByComponents(['position' as any], options)
        const resultIds = results.map(e => e.id)

        expect(results.length).toBe(2)
        expect(resultIds).toContain(entity1)
        expect(resultIds).toContain(entity3)
        expect(resultIds).not.toContain(entity2)
      }))
    })

    it('should find entities by archetype', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entities with specific archetype
        const archetype: Archetype = {
          position: createTestPosition(0, 0, 0),
          velocity: createTestVelocity(1, 0, 0)
        }

        const entity1 = yield* repo.createEntity(archetype)
        const entity2 = yield* repo.createEntity(archetype)
        const entity3 = yield* repo.createEntity({ position: createTestPosition(1, 1, 1) }) // Different archetype

        // Get archetype key from metadata
        const metadataOpt = yield* repo.getEntityMetadata(entity1)
        expect(Option.isSome(metadataOpt)).toBe(true)

        if (Option.isSome(metadataOpt)) {
          const archetypeKey = metadataOpt.value.archetypeKey
          const results = yield* repo.findEntitiesByArchetype(archetypeKey)
          const resultIds = results.map(e => e.id)

          expect(results.length).toBe(2)
          expect(resultIds).toContain(entity1)
          expect(resultIds).toContain(entity2)
          expect(resultIds).not.toContain(entity3)
        }
      }))
    })

    it('should count entities correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entities with different components
        yield* repo.createEntity({ position: createTestPosition(1, 0, 0) })
        yield* repo.createEntity({ velocity: createTestVelocity(1, 0, 0) })
        yield* repo.createEntity({ 
          position: createTestPosition(2, 0, 0),
          velocity: createTestVelocity(0, 1, 0)
        })

        // Count all entities
        const totalCount = yield* repo.countEntities()
        expect(totalCount).toBe(3)

        // Count entities with position
        const positionCount = yield* repo.countEntities(['position' as any])
        expect(positionCount).toBe(2)

        // Count entities with both position and velocity
        const bothCount = yield* repo.countEntities(['position' as any, 'velocity' as any])
        expect(bothCount).toBe(1)
      }))
    })
  })

  describe('Change Tracking', () => {
    it('should track entity creation changes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        const beforeTime = Date.now()

        const entityId = yield* repo.createEntity({ position: createTestPosition(1, 2, 3) })

        const changes = yield* repo.getEntityChanges(entityId, beforeTime)

        expect(changes.length).toBe(1)
        expect(changes[0].entityId).toBe(entityId)
        expect(changes[0].changeType).toBe('created')
        expect(changes[0].timestamp).toBeGreaterThanOrEqual(beforeTime)
      }))
    })

    it('should track component addition changes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const entityId = yield* repo.createEntity()
        const beforeAddition = Date.now()

        yield* repo.addComponent(entityId, 'position' as any, createTestPosition(5, 10, 15))

        const changes = yield* repo.getEntityChanges(entityId, beforeAddition)

        expect(changes.length).toBe(1)
        expect(changes[0].entityId).toBe(entityId)
        expect(changes[0].changeType).toBe('updated')
        expect(changes[0].componentName).toBe('position')
        expect(changes[0].newValue).toEqual(createTestPosition(5, 10, 15))
      }))
    })

    it('should track component removal changes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        const testPosition = createTestPosition(1, 2, 3)

        const entityId = yield* repo.createEntity({ position: testPosition })
        const beforeRemoval = Date.now()

        yield* repo.removeComponent(entityId, 'position' as any)

        const changes = yield* repo.getEntityChanges(entityId, beforeRemoval)

        expect(changes.length).toBe(1)
        expect(changes[0].entityId).toBe(entityId)
        expect(changes[0].changeType).toBe('updated')
        expect(changes[0].componentName).toBe('position')
        expect(changes[0].previousValue).toEqual(testPosition)
      }))
    })

    it('should track component update changes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        const initialPosition = createTestPosition(0, 0, 0)

        const entityId = yield* repo.createEntity({ position: initialPosition })
        const beforeUpdate = Date.now()

        yield* repo.updateComponent(
          entityId,
          'position' as any,
          (pos: TestPosition) => createTestPosition(pos.x + 10, pos.y + 20, pos.z + 30)
        )

        const changes = yield* repo.getEntityChanges(entityId, beforeUpdate)

        expect(changes.length).toBe(1)
        expect(changes[0].entityId).toBe(entityId)
        expect(changes[0].changeType).toBe('updated')
        expect(changes[0].componentName).toBe('position')
        expect(changes[0].previousValue).toEqual(initialPosition)
        expect(changes[0].newValue).toEqual(createTestPosition(10, 20, 30))
      }))
    })

    it('should track entity destruction changes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const entityId = yield* repo.createEntity({ position: createTestPosition(1, 2, 3) })
        const beforeDestruction = Date.now()

        yield* repo.destroyEntity(entityId)

        const changes = yield* repo.getEntityChanges(entityId, beforeDestruction)

        expect(changes.length).toBe(1)
        expect(changes[0].entityId).toBe(entityId)
        expect(changes[0].changeType).toBe('destroyed')
      }))
    })

    it('should clear change history', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create some changes
        const entity1 = yield* repo.createEntity()
        const entity2 = yield* repo.createEntity()
        yield* repo.addComponent(entity1, 'position' as any, createTestPosition(1, 2, 3))

        // Get all changes
        const allChanges = yield* repo.getEntityChanges()
        expect(allChanges.length).toBeGreaterThan(0)

        // Clear history
        const clearedCount = yield* repo.clearChangeHistory()
        expect(clearedCount).toBe(allChanges.length)

        // Should have no changes after clear
        const changesAfterClear = yield* repo.getEntityChanges()
        expect(changesAfterClear.length).toBe(0)
      }))
    })

    it('should filter changes by time', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        const entity1 = yield* repo.createEntity()
        const midTime = Date.now()
        
        // Small delay to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 1))
        
        const entity2 = yield* repo.createEntity()

        // Get changes since midTime
        const recentChanges = yield* repo.getEntityChanges(undefined, midTime)

        expect(recentChanges.length).toBe(1)
        expect(recentChanges[0].entityId).toBe(entity2)
      }))
    })
  })

  describe('Repository Statistics and Maintenance', () => {
    it('should provide accurate repository statistics', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entities with various components
        yield* repo.createEntity({ position: createTestPosition(1, 0, 0) })
        yield* repo.createEntity({ 
          position: createTestPosition(2, 0, 0),
          velocity: createTestVelocity(1, 0, 0)
        })
        yield* repo.createEntity({ health: createTestHealth(100, 100) })

        const stats = yield* repo.getRepositoryStats()

        expect(stats.entityCount).toBe(3)
        expect(stats.componentCounts['position' as any]).toBe(2)
        expect(stats.componentCounts['velocity' as any]).toBe(1)
        expect(stats.componentCounts['health' as any]).toBe(1)
        expect(stats.changeCount).toBe(3) // One creation change per entity
        expect(stats.memoryUsage).toBeGreaterThan(0)

        // Should have archetype counts
        expect(Object.keys(stats.archetypeCounts).length).toBeGreaterThan(0)
      }))
    })

    it('should compact storage and remove empty archetypes', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create and then destroy entities to create empty archetypes
        const entity1 = yield* repo.createEntity({ position: createTestPosition(1, 0, 0) })
        const entity2 = yield* repo.createEntity({ velocity: createTestVelocity(1, 0, 0) })

        let statsBefore = yield* repo.getRepositoryStats()
        expect(statsBefore.entityCount).toBe(2)

        // Destroy entities
        yield* repo.destroyEntity(entity1)
        yield* repo.destroyEntity(entity2)

        // Compact storage
        yield* repo.compactStorage()

        const statsAfter = yield* repo.getRepositoryStats()
        expect(statsAfter.entityCount).toBe(0)
      }))
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle operations on non-existent entities gracefully', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository
        const nonExistentId = toEntityId(99999)

        // All operations should handle non-existent entities gracefully
        expect(yield* repo.entityExists(nonExistentId)).toBe(false)
        expect(yield* repo.addComponent(nonExistentId, 'position' as any, createTestPosition(0, 0, 0))).toBe(false)
        expect(yield* repo.removeComponent(nonExistentId, 'velocity' as any)).toBe(false)
        expect(yield* repo.hasComponent(nonExistentId, 'position' as any)).toBe(false)

        const componentOpt = yield* repo.getComponent(nonExistentId, 'position' as any)
        expect(Option.isNone(componentOpt)).toBe(true)

        const metadataOpt = yield* repo.getEntityMetadata(nonExistentId)
        expect(Option.isNone(metadataOpt)).toBe(true)
      }))
    })

    it('should handle empty archetype creation', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entity with empty archetype
        const entityId = yield* repo.createEntity({})

        expect(yield* repo.entityExists(entityId)).toBe(true)

        // Should have no components
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(false)

        const metadataOpt = yield* repo.getEntityMetadata(entityId)
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.componentTypes.size).toBe(0)
        }
      }))
    })

    it('should handle concurrent entity operations', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create multiple entities concurrently
        const createEffects = Array.from({ length: 20 }, (_, i) =>
          repo.createEntity({ 
            position: createTestPosition(i, i, i) 
          })
        )

        const entityIds = yield* Effect.all(createEffects, { concurrency: 10 })

        // All entities should be created with unique IDs
        expect(entityIds.length).toBe(20)
        expect(new Set(entityIds).size).toBe(20) // All unique

        // All entities should exist
        for (const entityId of entityIds) {
          expect(yield* repo.entityExists(entityId)).toBe(true)
        }

        // Verify statistics
        const stats = yield* repo.getRepositoryStats()
        expect(stats.entityCount).toBe(20)
        expect(stats.componentCounts['position' as any]).toBe(20)
      }))
    })

    it('should handle archetype changes correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* EntityRepository

        // Create entity with one component
        const entityId = yield* repo.createEntity({ position: createTestPosition(0, 0, 0) })

        // Add component (changes archetype)
        yield* repo.addComponent(entityId, 'velocity' as any, createTestVelocity(1, 0, 0))

        // Add another component (changes archetype again)
        yield* repo.addComponent(entityId, 'health' as any, createTestHealth(100, 100))

        // Remove middle component (changes archetype)
        yield* repo.removeComponent(entityId, 'velocity' as any)

        // Entity should still exist with correct components
        expect(yield* repo.entityExists(entityId)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(true)

        // Metadata should reflect final state
        const metadataOpt = yield* repo.getEntityMetadata(entityId)
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.componentTypes.size).toBe(2)
          expect(metadata.generation).toBe(3) // Three component operations
        }
      }))
    })
  })
})