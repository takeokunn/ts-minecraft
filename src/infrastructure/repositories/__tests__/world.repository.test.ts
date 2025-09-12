/**
 * World Repository Tests
 * 
 * Comprehensive test suite for WorldRepository implementation using Effect-TS patterns.
 * Tests entity management, component operations, queries, and archetype handling.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as TestContext from 'effect/TestContext'
import * as Option from 'effect/Option'
import * as HashMap from 'effect/HashMap'

import { 
  WorldRepositoryService, 
  WorldRepositoryLive,
  WorldRepositoryUtils
} from '../world.repository'
import { IWorldRepository } from '@domain/ports/world-repository.port'
import { EntityId, toEntityId } from '@domain/entities'

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
    Effect.provide(WorldRepositoryLive),
    Effect.provide(TestContext.TestContext)
  ))

// Test data factories
const createTestPosition = (x = 0, y = 0, z = 0): TestPosition => ({ x, y, z })
const createTestVelocity = (vx = 0, vy = 0, vz = 0): TestVelocity => ({ vx, vy, vz })
const createTestHealth = (current = 100, max = 100): TestHealth => ({ current, max })

describe('WorldRepository', () => {
  describe('Entity Creation and Management', () => {
    it('should create entities with unique IDs', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create multiple entities
        const entity1 = yield* repo.createEntity()
        const entity2 = yield* repo.createEntity()
        const entity3 = yield* repo.createEntity()

        // All should have unique IDs
        expect(entity1).not.toBe(entity2)
        expect(entity2).not.toBe(entity3)
        expect(entity1).not.toBe(entity3)

        // All should exist
        expect(yield* repo.hasEntity(entity1)).toBe(true)
        expect(yield* repo.hasEntity(entity2)).toBe(true)
        expect(yield* repo.hasEntity(entity3)).toBe(true)
      }))
    })

    it('should create entities with initial components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity with components
        const entityId = yield* repo.createEntity({
          position: createTestPosition(10, 20, 30),
          velocity: createTestVelocity(1, 0, -1)
        })

        expect(yield* repo.hasEntity(entityId)).toBe(true)

        // Verify components were added
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(false)
      }))
    })

    it('should destroy entities and cleanup components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity with components
        const entityId = yield* repo.createEntity({
          position: createTestPosition(5, 5, 5),
          health: createTestHealth(80, 100)
        })

        expect(yield* repo.hasEntity(entityId)).toBe(true)

        // Destroy entity
        yield* repo.destroyEntity(entityId)

        // Entity should no longer exist
        expect(yield* repo.hasEntity(entityId)).toBe(false)

        // Components should also be cleaned up
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(false)
      }))
    })

    it('should handle destruction of non-existent entities gracefully', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService
        const nonExistentId = toEntityId(9999)

        // Should not throw error
        yield* repo.destroyEntity(nonExistentId)
        expect(yield* repo.hasEntity(nonExistentId)).toBe(false)
      }))
    })
  })

  describe('Component Operations', () => {
    it('should add components to existing entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

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
      }))
    })

    it('should not add duplicate components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity with position component
        const entityId = yield* repo.createEntity({
          position: createTestPosition(0, 0, 0)
        })

        // Try to add position component again
        const addResult = yield* repo.addComponent(entityId, 'position' as any, createTestPosition(1, 1, 1))
        expect(addResult).toBe(false)
      }))
    })

    it('should remove components from entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity with multiple components
        const entityId = yield* repo.createEntity({
          position: createTestPosition(1, 2, 3),
          velocity: createTestVelocity(1, 0, 0),
          health: createTestHealth(50, 100)
        })

        // Remove velocity component
        const removeResult = yield* repo.removeComponent(entityId, 'velocity' as any)
        expect(removeResult).toBe(true)

        // Verify component was removed
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(true)
      }))
    })

    it('should not remove non-existent components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity with only position
        const entityId = yield* repo.createEntity({
          position: createTestPosition(0, 0, 0)
        })

        // Try to remove velocity component that doesn't exist
        const removeResult = yield* repo.removeComponent(entityId, 'velocity' as any)
        expect(removeResult).toBe(false)
      }))
    })

    it('should retrieve components from entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService
        const testPosition = createTestPosition(10, 20, 30)

        // Create entity with position component
        const entityId = yield* repo.createEntity({
          position: testPosition
        })

        // Get component
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

    it('should update components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService
        const initialPosition = createTestPosition(0, 0, 0)
        const updatedPosition = createTestPosition(5, 10, 15)

        // Create entity with position
        const entityId = yield* repo.createEntity({
          position: initialPosition
        })

        // Update component
        yield* repo.updateComponent(entityId, 'position', updatedPosition)

        // Verify component was updated
        const positionOpt = yield* repo.getComponent(entityId, 'position' as any)
        expect(Option.isSome(positionOpt)).toBe(true)
        if (Option.isSome(positionOpt)) {
          expect(positionOpt.value).toEqual(updatedPosition)
        }
      }))
    })

    it('should update multiple components in batch', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entities with components
        const entity1 = yield* repo.createEntity({ position: createTestPosition(0, 0, 0) })
        const entity2 = yield* repo.createEntity({ velocity: createTestVelocity(0, 0, 0) })

        const updates = [
          { entityId: entity1, componentType: 'position', component: createTestPosition(1, 2, 3) },
          { entityId: entity2, componentType: 'velocity', component: createTestVelocity(1, 1, 1) }
        ]

        // Batch update
        yield* repo.updateComponents(updates)

        // Verify updates
        const pos1 = yield* repo.getComponent(entity1, 'position' as any)
        const vel2 = yield* repo.getComponent(entity2, 'velocity' as any)

        expect(Option.isSome(pos1)).toBe(true)
        expect(Option.isSome(vel2)).toBe(true)

        if (Option.isSome(pos1)) {
          expect(pos1.value).toEqual(createTestPosition(1, 2, 3))
        }
        if (Option.isSome(vel2)) {
          expect(vel2.value).toEqual(createTestVelocity(1, 1, 1))
        }
      }))
    })
  })

  describe('Queries', () => {
    it('should query entities by single component type', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entities with different component combinations
        const entity1 = yield* repo.createEntity({ position: createTestPosition(1, 0, 0) })
        const entity2 = yield* repo.createEntity({ velocity: createTestVelocity(1, 0, 0) })
        const entity3 = yield* repo.createEntity({ 
          position: createTestPosition(2, 0, 0),
          velocity: createTestVelocity(0, 1, 0)
        })

        // Query for entities with position component
        const positionEntities = yield* repo.query('position' as any)

        expect(positionEntities.length).toBe(2)
        const entityIds = positionEntities.map(r => r.entityId)
        expect(entityIds).toContain(entity1)
        expect(entityIds).toContain(entity3)
        expect(entityIds).not.toContain(entity2)
      }))
    })

    it('should query entities by multiple component types', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entities with different component combinations
        const entity1 = yield* repo.createEntity({ position: createTestPosition(1, 0, 0) })
        const entity2 = yield* repo.createEntity({ velocity: createTestVelocity(1, 0, 0) })
        const entity3 = yield* repo.createEntity({ 
          position: createTestPosition(2, 0, 0),
          velocity: createTestVelocity(0, 1, 0)
        })
        const entity4 = yield* repo.createEntity({
          position: createTestPosition(3, 0, 0),
          velocity: createTestVelocity(0, 0, 1),
          health: createTestHealth(75, 100)
        })

        // Query for entities with both position and velocity components
        const results = yield* repo.queryMultiple(['position', 'velocity'] as any)

        expect(results.length).toBe(2)
        const entityIds = results.map(r => r.entityId)
        expect(entityIds).toContain(entity3)
        expect(entityIds).toContain(entity4)
        expect(entityIds).not.toContain(entity1)
        expect(entityIds).not.toContain(entity2)
      }))
    })

    it('should query single component for specific entity', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService
        const testPosition = createTestPosition(5, 10, 15)

        // Create entity
        const entityId = yield* repo.createEntity({ position: testPosition })

        // Query single component
        const position = yield* repo.querySingle('position' as any, entityId)
        expect(position).toEqual(testPosition)
      }))
    })

    it('should fail when querying non-existent single component', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity without velocity
        const entityId = yield* repo.createEntity({ position: createTestPosition(0, 0, 0) })

        // Try to query velocity - should fail
        const result = yield* Effect.exit(repo.querySingle('velocity' as any, entityId))
        expect(result._tag).toBe('Failure')
      }))
    })

    it('should perform SoA (Structure of Arrays) queries', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entities with position and velocity
        const entity1 = yield* repo.createEntity({
          position: createTestPosition(1, 2, 3),
          velocity: createTestVelocity(0.1, 0.2, 0.3)
        })
        const entity2 = yield* repo.createEntity({
          position: createTestPosition(4, 5, 6),
          velocity: createTestVelocity(0.4, 0.5, 0.6)
        })

        // Perform SoA query
        const result = yield* repo.querySoA(['position', 'velocity'] as any)

        expect(result.entities.length).toBe(2)
        expect(result.components.position.length).toBe(2)
        expect(result.components.velocity.length).toBe(2)

        // Verify data structure
        expect(result.entities).toContain(entity1)
        expect(result.entities).toContain(entity2)
      }))
    })
  })

  describe('Archetype Management', () => {
    it('should handle archetype changes when adding components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity with position only
        const entityId = yield* repo.createEntity({ position: createTestPosition(0, 0, 0) })

        // Add velocity component (changes archetype)
        yield* repo.addComponent(entityId, 'velocity' as any, createTestVelocity(1, 0, 0))

        // Entity should still exist and have both components
        expect(yield* repo.hasEntity(entityId)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(true)

        // Query should find it in the new archetype
        const results = yield* repo.queryMultiple(['position', 'velocity'] as any)
        expect(results.some(r => r.entityId === entityId)).toBe(true)
      }))
    })

    it('should handle archetype changes when removing components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity with multiple components
        const entityId = yield* repo.createEntity({
          position: createTestPosition(1, 2, 3),
          velocity: createTestVelocity(1, 0, 0),
          health: createTestHealth(100, 100)
        })

        // Remove velocity component (changes archetype)
        yield* repo.removeComponent(entityId, 'velocity' as any)

        // Entity should still exist but with different archetype
        expect(yield* repo.hasEntity(entityId)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(true)

        // Should appear in position+health queries but not position+velocity queries
        const posHealthResults = yield* repo.queryMultiple(['position', 'health'] as any)
        const posVelResults = yield* repo.queryMultiple(['position', 'velocity'] as any)

        expect(posHealthResults.some(r => r.entityId === entityId)).toBe(true)
        expect(posVelResults.some(r => r.entityId === entityId)).toBe(false)
      }))
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle operations on non-existent entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService
        const nonExistentId = toEntityId(99999)

        // All operations should fail gracefully
        expect(yield* repo.hasEntity(nonExistentId)).toBe(false)
        expect(yield* repo.addComponent(nonExistentId, 'position' as any, createTestPosition(0, 0, 0))).toBe(false)
        expect(yield* repo.removeComponent(nonExistentId, 'velocity' as any)).toBe(false)
        expect(yield* repo.hasComponent(nonExistentId, 'position' as any)).toBe(false)

        const componentOpt = yield* repo.getComponent(nonExistentId, 'position' as any)
        expect(Option.isNone(componentOpt)).toBe(true)
      }))
    })

    it('should handle empty component creation', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entity with empty components object
        const entityId = yield* repo.createEntity({})
        
        expect(yield* repo.hasEntity(entityId)).toBe(true)

        // Should have no components
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(false)
      }))
    })

    it('should handle concurrent entity operations', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create multiple entities concurrently
        const createEffects = Array.from({ length: 10 }, (_, i) =>
          repo.createEntity({ 
            position: createTestPosition(i, i, i) 
          })
        )

        const entityIds = yield* Effect.all(createEffects, { concurrency: 5 })

        // All entities should be created with unique IDs
        expect(entityIds.length).toBe(10)
        expect(new Set(entityIds).size).toBe(10) // All unique

        // All entities should exist
        for (const entityId of entityIds) {
          expect(yield* repo.hasEntity(entityId)).toBe(true)
        }
      }))
    })
  })

  describe('Repository Utils', () => {
    it('should create repository with pre-populated archetypes', async () => {
      await runTest(Effect.gen(function* () {
        const archetypes = [
          { position: createTestPosition(1, 2, 3) },
          { velocity: createTestVelocity(0.5, 0, -0.5) },
          { 
            position: createTestPosition(4, 5, 6),
            health: createTestHealth(80, 100)
          }
        ]

        const repo = yield* WorldRepositoryUtils.createWithArchetypes(archetypes)

        // Should have created entities for each archetype
        const positionEntities = yield* repo.query('position' as any)
        const velocityEntities = yield* repo.query('velocity' as any)
        const healthEntities = yield* repo.query('health' as any)

        expect(positionEntities.length).toBe(2) // First and third archetypes
        expect(velocityEntities.length).toBe(1) // Second archetype
        expect(healthEntities.length).toBe(1) // Third archetype
      }))
    })

    it('should export repository state', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create some entities
        yield* repo.createEntity({ position: createTestPosition(1, 2, 3) })
        yield* repo.createEntity({ velocity: createTestVelocity(1, 0, 0) })

        // Export state
        const state = yield* WorldRepositoryUtils.exportState(repo)

        // Should have basic state structure
        expect(state).toHaveProperty('version')
        expect(state).toHaveProperty('entityCount')
        expect(state).toHaveProperty('archetypeCount')
        expect(state).toHaveProperty('componentCounts')
      }))
    })

    it('should perform health check', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create some test data
        yield* repo.createEntity({ position: createTestPosition(0, 0, 0) })

        // Perform health check
        const healthCheck = yield* WorldRepositoryUtils.healthCheck(repo)

        expect(healthCheck).toHaveProperty('isHealthy')
        expect(healthCheck).toHaveProperty('entityCount')
        expect(healthCheck).toHaveProperty('archetypeEntityCount')
        expect(healthCheck).toHaveProperty('version')
        expect(healthCheck.isHealthy).toBe(true)
      }))
    })
  })

  describe('Performance and Stress Tests', () => {
    it('should handle large numbers of entities efficiently', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService
        const entityCount = 1000

        // Create many entities
        const createEffects = Array.from({ length: entityCount }, (_, i) =>
          repo.createEntity({
            position: createTestPosition(i % 100, Math.floor(i / 100), 0)
          })
        )

        const entityIds = yield* Effect.all(createEffects, { concurrency: 50 })

        // Query all entities
        const allEntities = yield* repo.query('position' as any)
        expect(allEntities.length).toBe(entityCount)

        // Verify some random entities exist
        const randomIndices = [0, 100, 500, 999]
        for (const index of randomIndices) {
          expect(yield* repo.hasEntity(entityIds[index])).toBe(true)
        }
      }))
    })

    it('should handle complex queries efficiently', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* WorldRepositoryService

        // Create entities with various component combinations
        const combinations = [
          { position: createTestPosition(0, 0, 0) },
          { velocity: createTestVelocity(1, 0, 0) },
          { health: createTestHealth(100, 100) },
          { position: createTestPosition(1, 1, 1), velocity: createTestVelocity(0, 1, 0) },
          { position: createTestPosition(2, 2, 2), health: createTestHealth(80, 100) },
          { velocity: createTestVelocity(0, 0, 1), health: createTestHealth(60, 100) },
          { 
            position: createTestPosition(3, 3, 3), 
            velocity: createTestVelocity(1, 1, 1),
            health: createTestHealth(50, 100)
          }
        ]

        // Create multiple entities for each combination
        for (let i = 0; i < 100; i++) {
          for (const combo of combinations) {
            yield* repo.createEntity(combo)
          }
        }

        // Perform various queries
        const positionResults = yield* repo.query('position' as any)
        const velocityResults = yield* repo.query('velocity' as any)
        const healthResults = yield* repo.query('health' as any)
        const posVelResults = yield* repo.queryMultiple(['position', 'velocity'] as any)
        const allThreeResults = yield* repo.queryMultiple(['position', 'velocity', 'health'] as any)

        // Verify expected counts
        expect(positionResults.length).toBe(400) // 4 combinations * 100 entities
        expect(velocityResults.length).toBe(400) // 4 combinations * 100 entities
        expect(healthResults.length).toBe(400) // 4 combinations * 100 entities
        expect(posVelResults.length).toBe(200) // 2 combinations * 100 entities
        expect(allThreeResults.length).toBe(100) // 1 combination * 100 entities
      }))
    })
  })
})