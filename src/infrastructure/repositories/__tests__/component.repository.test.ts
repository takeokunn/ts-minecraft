/**
 * Component Repository Tests
 * 
 * Comprehensive test suite for ComponentRepository implementation using Effect-TS patterns.
 * Tests component lifecycle, bulk operations, querying, statistics, and change tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as TestContext from 'effect/TestContext'
import * as Option from 'effect/Option'

import { 
  ComponentRepository, 
  ComponentRepositoryLive,
  type ComponentMetadata,
  type ComponentStats,
  type ComponentChange
} from '../component.repository'
import { EntityId, toEntityId } from '@domain/entities'
import { ComponentDecodeError } from '@domain/errors'

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
    Effect.provide(ComponentRepositoryLive),
    Effect.provide(TestContext.TestContext)
  ))

// Test data factories
const createTestPosition = (x = 0, y = 0, z = 0): TestPosition => ({ x, y, z })
const createTestVelocity = (vx = 0, vy = 0, vz = 0): TestVelocity => ({ vx, vy, vz })
const createTestHealth = (current = 100, max = 100): TestHealth => ({ current, max })

describe('ComponentRepository', () => {
  describe('Component Operations', () => {
    it('should add components to entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(1)
        const position = createTestPosition(10, 20, 30)

        const addResult = yield* repo.addComponent(entityId, 'position' as any, position)
        expect(addResult).toBe(true)

        // Verify component was added
        const hasResult = yield* repo.hasComponent(entityId, 'position' as any)
        expect(hasResult).toBe(true)

        // Retrieve component
        const componentOpt = yield* repo.getComponent(entityId, 'position' as any)
        expect(Option.isSome(componentOpt)).toBe(true)
        if (Option.isSome(componentOpt)) {
          expect(componentOpt.value).toEqual(position)
        }
      }))
    })

    it('should not add duplicate components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(2)
        const position = createTestPosition(5, 10, 15)

        // Add component first time
        const firstAdd = yield* repo.addComponent(entityId, 'position' as any, position)
        expect(firstAdd).toBe(true)

        // Try to add same component again
        const secondAdd = yield* repo.addComponent(entityId, 'position' as any, createTestPosition(100, 200, 300))
        expect(secondAdd).toBe(false)

        // Original component should be unchanged
        const componentOpt = yield* repo.getComponent(entityId, 'position' as any)
        if (Option.isSome(componentOpt)) {
          expect(componentOpt.value).toEqual(position)
        }
      }))
    })

    it('should update existing components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(3)
        const initialPosition = createTestPosition(1, 2, 3)
        const updatedPosition = createTestPosition(10, 20, 30)

        // Add initial component
        yield* repo.addComponent(entityId, 'position' as any, initialPosition)

        // Update component
        const updateResult = yield* repo.updateComponent(entityId, 'position' as any, updatedPosition)
        expect(updateResult).toBe(true)

        // Verify component was updated
        const componentOpt = yield* repo.getComponent(entityId, 'position' as any)
        expect(Option.isSome(componentOpt)).toBe(true)
        if (Option.isSome(componentOpt)) {
          expect(componentOpt.value).toEqual(updatedPosition)
        }
      }))
    })

    it('should not update non-existent components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(4)
        const position = createTestPosition(1, 2, 3)

        // Try to update component that doesn't exist
        const updateResult = yield* repo.updateComponent(entityId, 'position' as any, position)
        expect(updateResult).toBe(false)

        // Verify component wasn't added
        const hasResult = yield* repo.hasComponent(entityId, 'position' as any)
        expect(hasResult).toBe(false)
      }))
    })

    it('should remove components from entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(5)
        const position = createTestPosition(1, 2, 3)
        const velocity = createTestVelocity(0.5, 0, -0.5)

        // Add multiple components
        yield* repo.addComponent(entityId, 'position' as any, position)
        yield* repo.addComponent(entityId, 'velocity' as any, velocity)

        // Remove one component
        const removeResult = yield* repo.removeComponent(entityId, 'position' as any)
        expect(removeResult).toBe(true)

        // Verify component was removed
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(true)
      }))
    })

    it('should not remove non-existent components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(6)

        // Try to remove component that doesn't exist
        const removeResult = yield* repo.removeComponent(entityId, 'position' as any)
        expect(removeResult).toBe(false)
      }))
    })

    it('should check component existence correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(7)
        const position = createTestPosition(1, 2, 3)

        // Initially should not have component
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(false)

        // Add component
        yield* repo.addComponent(entityId, 'position' as any, position)

        // Should now have component
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(false)
      }))
    })
  })

  describe('Bulk Operations', () => {
    it('should add multiple components at once', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(10)

        const components = {
          position: createTestPosition(1, 2, 3),
          velocity: createTestVelocity(1, 0, -1),
          health: createTestHealth(80, 100)
        }

        const addedCount = yield* repo.addComponents(entityId, components)
        expect(addedCount).toBe(3)

        // Verify all components were added
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(true)
      }))
    })

    it('should skip unknown component types when adding', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(11)

        const components = {
          position: createTestPosition(1, 2, 3),
          unknownComponent: { foo: 'bar' }, // This should be skipped
          velocity: createTestVelocity(1, 0, 0)
        }

        const addedCount = yield* repo.addComponents(entityId, components)
        expect(addedCount).toBe(2) // Only position and velocity should be added

        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(true)
      }))
    })

    it('should update multiple components at once', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(12)

        // Add initial components
        yield* repo.addComponent(entityId, 'position' as any, createTestPosition(0, 0, 0))
        yield* repo.addComponent(entityId, 'velocity' as any, createTestVelocity(0, 0, 0))
        yield* repo.addComponent(entityId, 'health' as any, createTestHealth(50, 100))

        // Update multiple components
        const updates = {
          position: createTestPosition(10, 20, 30),
          velocity: createTestVelocity(1, 2, 3),
          unknownComponent: { test: 'data' } // Should be skipped
        }

        const updatedCount = yield* repo.updateComponents(entityId, updates)
        expect(updatedCount).toBe(2) // Only position and velocity should be updated

        // Verify updates
        const positionOpt = yield* repo.getComponent(entityId, 'position' as any)
        const velocityOpt = yield* repo.getComponent(entityId, 'velocity' as any)
        const healthOpt = yield* repo.getComponent(entityId, 'health' as any)

        if (Option.isSome(positionOpt)) {
          expect(positionOpt.value).toEqual(createTestPosition(10, 20, 30))
        }
        if (Option.isSome(velocityOpt)) {
          expect(velocityOpt.value).toEqual(createTestVelocity(1, 2, 3))
        }
        if (Option.isSome(healthOpt)) {
          expect(healthOpt.value).toEqual(createTestHealth(50, 100)) // Should be unchanged
        }
      }))
    })

    it('should remove multiple components at once', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(13)

        // Add components
        yield* repo.addComponent(entityId, 'position' as any, createTestPosition(1, 2, 3))
        yield* repo.addComponent(entityId, 'velocity' as any, createTestVelocity(1, 0, 0))
        yield* repo.addComponent(entityId, 'health' as any, createTestHealth(100, 100))

        // Remove multiple components
        const removedCount = yield* repo.removeComponents(entityId, ['position' as any, 'velocity' as any])
        expect(removedCount).toBe(2)

        // Verify removals
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(false)
        expect(yield* repo.hasComponent(entityId, 'health' as any)).toBe(true)
      }))
    })

    it('should get all components for an entity', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(14)

        const position = createTestPosition(5, 10, 15)
        const velocity = createTestVelocity(0.5, 1, -0.5)

        yield* repo.addComponent(entityId, 'position' as any, position)
        yield* repo.addComponent(entityId, 'velocity' as any, velocity)

        // Get all components
        const allComponents = yield* repo.getComponents(entityId)
        
        expect(allComponents['position' as any]).toEqual(position)
        expect(allComponents['velocity' as any]).toEqual(velocity)
        expect(allComponents['health' as any]).toBeUndefined()
      }))
    })

    it('should get specific components for an entity', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(15)

        const position = createTestPosition(1, 2, 3)
        const velocity = createTestVelocity(1, 0, 0)
        const health = createTestHealth(75, 100)

        yield* repo.addComponent(entityId, 'position' as any, position)
        yield* repo.addComponent(entityId, 'velocity' as any, velocity)
        yield* repo.addComponent(entityId, 'health' as any, health)

        // Get only specific components
        const specificComponents = yield* repo.getComponents(entityId, ['position' as any, 'health' as any])
        
        expect(specificComponents['position' as any]).toEqual(position)
        expect(specificComponents['health' as any]).toEqual(health)
        expect(specificComponents['velocity' as any]).toBeUndefined()
      }))
    })
  })

  describe('Query Operations', () => {
    it('should find entities by component type', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        
        const entity1 = toEntityId(20)
        const entity2 = toEntityId(21)
        const entity3 = toEntityId(22)

        // Add position components to some entities
        yield* repo.addComponent(entity1, 'position' as any, createTestPosition(1, 0, 0))
        yield* repo.addComponent(entity2, 'velocity' as any, createTestVelocity(1, 0, 0))
        yield* repo.addComponent(entity3, 'position' as any, createTestPosition(2, 0, 0))

        const results = yield* repo.findEntitiesByComponent('position' as any)
        const entityIds = results.map(r => r.entityId)

        expect(results.length).toBe(2)
        expect(entityIds).toContain(entity1)
        expect(entityIds).toContain(entity3)
        expect(entityIds).not.toContain(entity2)
      }))
    })

    it('should find all components for an entity', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(23)

        const position = createTestPosition(10, 20, 30)
        const velocity = createTestVelocity(1, 1, 1)

        yield* repo.addComponent(entityId, 'position' as any, position)
        yield* repo.addComponent(entityId, 'velocity' as any, velocity)

        const components = yield* repo.findComponentsByEntity(entityId)

        expect(components['position' as any]).toEqual(position)
        expect(components['velocity' as any]).toEqual(velocity)
      }))
    })

    it('should query components with predicate', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        
        const entity1 = toEntityId(24)
        const entity2 = toEntityId(25)
        const entity3 = toEntityId(26)

        yield* repo.addComponent(entity1, 'position' as any, createTestPosition(5, 0, 0))
        yield* repo.addComponent(entity2, 'position' as any, createTestPosition(15, 0, 0))
        yield* repo.addComponent(entity3, 'position' as any, createTestPosition(25, 0, 0))

        // Find positions with x > 10
        const results = yield* repo.queryComponents(
          'position' as any,
          (pos: TestPosition) => pos.x > 10
        )

        expect(results.length).toBe(2)
        const entityIds = results.map(r => r.entityId)
        expect(entityIds).toContain(entity2)
        expect(entityIds).toContain(entity3)
        expect(entityIds).not.toContain(entity1)
      }))
    })
  })

  describe('Component Metadata and Statistics', () => {
    it('should track component metadata', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        
        const entity1 = toEntityId(30)
        const entity2 = toEntityId(31)

        // Add position components
        yield* repo.addComponent(entity1, 'position' as any, createTestPosition(1, 2, 3))
        yield* repo.addComponent(entity2, 'position' as any, createTestPosition(4, 5, 6))

        const metadataOpt = yield* repo.getComponentMetadata('position' as any)
        expect(Option.isSome(metadataOpt)).toBe(true)

        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.componentName).toBe('position')
          expect(metadata.entityCount).toBe(2)
          expect(metadata.totalSize).toBeGreaterThan(0)
          expect(metadata.averageSize).toBeGreaterThan(0)
          expect(metadata.version).toBe(2) // Incremented for each addition
        }
      }))
    })

    it('should update metadata when components are removed', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        
        const entity1 = toEntityId(32)
        const entity2 = toEntityId(33)
        const entity3 = toEntityId(34)

        // Add position components
        yield* repo.addComponent(entity1, 'position' as any, createTestPosition(1, 0, 0))
        yield* repo.addComponent(entity2, 'position' as any, createTestPosition(2, 0, 0))
        yield* repo.addComponent(entity3, 'position' as any, createTestPosition(3, 0, 0))

        // Remove one component
        yield* repo.removeComponent(entity2, 'position' as any)

        const metadataOpt = yield* repo.getComponentMetadata('position' as any)
        if (Option.isSome(metadataOpt)) {
          expect(metadataOpt.value.entityCount).toBe(2)
        }

        // Remove all remaining components
        yield* repo.removeComponent(entity1, 'position' as any)
        yield* repo.removeComponent(entity3, 'position' as any)

        // Metadata should be removed when no entities have the component
        const emptyMetadataOpt = yield* repo.getComponentMetadata('position' as any)
        expect(Option.isNone(emptyMetadataOpt)).toBe(true)
      }))
    })

    it('should provide component statistics', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        
        // Add various components
        for (let i = 0; i < 5; i++) {
          yield* repo.addComponent(toEntityId(40 + i), 'position' as any, createTestPosition(i, i, i))
        }
        
        for (let i = 0; i < 3; i++) {
          yield* repo.addComponent(toEntityId(50 + i), 'velocity' as any, createTestVelocity(i, 0, 0))
        }

        yield* repo.addComponent(toEntityId(60), 'health' as any, createTestHealth(100, 100))

        const stats = yield* repo.getComponentStats()

        expect(stats.totalComponents).toBe(9) // 5 + 3 + 1
        expect(stats.componentsByType['position' as any]).toBe(5)
        expect(stats.componentsByType['velocity' as any]).toBe(3)
        expect(stats.componentsByType['health' as any]).toBe(1)

        // Should have memory usage information
        expect(stats.memoryUsage['position' as any]).toBeGreaterThan(0)
        expect(stats.memoryUsage['velocity' as any]).toBeGreaterThan(0)
        expect(stats.memoryUsage['health' as any]).toBeGreaterThan(0)

        // Should have most/least used components
        expect(stats.mostUsedComponents.length).toBeGreaterThan(0)
        expect(stats.mostUsedComponents[0].name).toBe('position') // Most used
      }))
    })

    it('should count components correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        
        // Add components
        yield* repo.addComponent(toEntityId(70), 'position' as any, createTestPosition(1, 0, 0))
        yield* repo.addComponent(toEntityId(71), 'position' as any, createTestPosition(2, 0, 0))
        yield* repo.addComponent(toEntityId(72), 'velocity' as any, createTestVelocity(1, 0, 0))

        // Count specific component type
        const positionCount = yield* repo.getComponentCount('position' as any)
        expect(positionCount).toBe(2)

        const velocityCount = yield* repo.getComponentCount('velocity' as any)
        expect(velocityCount).toBe(1)

        // Count all components
        const totalCount = yield* repo.getComponentCount()
        expect(totalCount).toBe(3)
      }))
    })
  })

  describe('Change Tracking', () => {
    it('should track component additions', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(80)
        const beforeTime = Date.now()

        const position = createTestPosition(1, 2, 3)
        yield* repo.addComponent(entityId, 'position' as any, position)

        const changes = yield* repo.getComponentChanges(entityId, 'position' as any, beforeTime)

        expect(changes.length).toBe(1)
        expect(changes[0].entityId).toBe(entityId)
        expect(changes[0].componentName).toBe('position')
        expect(changes[0].changeType).toBe('added')
        expect(changes[0].newValue).toEqual(position)
        expect(changes[0].timestamp).toBeGreaterThanOrEqual(beforeTime)
      }))
    })

    it('should track component updates', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(81)

        const initialPosition = createTestPosition(0, 0, 0)
        const updatedPosition = createTestPosition(10, 20, 30)

        yield* repo.addComponent(entityId, 'position' as any, initialPosition)

        const beforeUpdate = Date.now()
        yield* repo.updateComponent(entityId, 'position' as any, updatedPosition)

        const changes = yield* repo.getComponentChanges(entityId, 'position' as any, beforeUpdate)

        expect(changes.length).toBe(1)
        expect(changes[0].changeType).toBe('updated')
        expect(changes[0].previousValue).toEqual(initialPosition)
        expect(changes[0].newValue).toEqual(updatedPosition)
      }))
    })

    it('should track component removals', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(82)

        const position = createTestPosition(5, 10, 15)
        yield* repo.addComponent(entityId, 'position' as any, position)

        const beforeRemoval = Date.now()
        yield* repo.removeComponent(entityId, 'position' as any)

        const changes = yield* repo.getComponentChanges(entityId, 'position' as any, beforeRemoval)

        expect(changes.length).toBe(1)
        expect(changes[0].changeType).toBe('removed')
        expect(changes[0].previousValue).toEqual(position)
        expect(changes[0].newValue).toBeUndefined()
      }))
    })

    it('should filter changes by entity and time', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entity1 = toEntityId(83)
        const entity2 = toEntityId(84)

        // Add components to both entities
        yield* repo.addComponent(entity1, 'position' as any, createTestPosition(1, 0, 0))

        const midTime = Date.now()
        
        // Small delay to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 1))
        
        yield* repo.addComponent(entity2, 'position' as any, createTestPosition(2, 0, 0))

        // Get changes for specific entity
        const entity1Changes = yield* repo.getComponentChanges(entity1)
        expect(entity1Changes.length).toBe(1)
        expect(entity1Changes[0].entityId).toBe(entity1)

        // Get changes since midTime
        const recentChanges = yield* repo.getComponentChanges(undefined, undefined, midTime)
        expect(recentChanges.length).toBe(1)
        expect(recentChanges[0].entityId).toBe(entity2)
      }))
    })

    it('should clear change history', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(85)

        // Create some changes
        yield* repo.addComponent(entityId, 'position' as any, createTestPosition(1, 2, 3))
        yield* repo.updateComponent(entityId, 'position' as any, createTestPosition(4, 5, 6))

        // Get all changes
        const allChanges = yield* repo.getComponentChanges()
        expect(allChanges.length).toBeGreaterThan(0)

        // Clear history
        const clearedCount = yield* repo.clearChangeHistory()
        expect(clearedCount).toBe(allChanges.length)

        // Should have no changes after clear
        const changesAfterClear = yield* repo.getComponentChanges()
        expect(changesAfterClear.length).toBe(0)
      }))
    })
  })

  describe('Validation', () => {
    it('should validate individual components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository

        const validPosition = createTestPosition(1, 2, 3)
        const validatedPosition = yield* repo.validateComponent('position' as any, validPosition)
        expect(validatedPosition).toEqual(validPosition)
      }))
    })

    it('should fail validation for invalid components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository

        const invalidPosition = { x: "not a number", y: 2, z: 3 }
        const result = yield* Effect.exit(repo.validateComponent('position' as any, invalidPosition))
        
        expect(result._tag).toBe('Failure')
      }))
    })

    it('should validate multiple components', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository

        const components = {
          position: createTestPosition(1, 2, 3),
          velocity: createTestVelocity(0.5, 0, -0.5),
          unknownComponent: { test: 'data' } // Should be skipped
        }

        const validatedComponents = yield* repo.validateComponents(components)

        expect(validatedComponents['position' as any]).toEqual(components.position)
        expect(validatedComponents['velocity' as any]).toEqual(components.velocity)
        expect(validatedComponents['unknownComponent' as any]).toBeUndefined()
      }))
    })
  })

  describe('Storage Optimization', () => {
    it('should compact storage by removing empty metadata', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(90)

        // Add and then remove a component to create empty metadata
        yield* repo.addComponent(entityId, 'position' as any, createTestPosition(1, 2, 3))
        yield* repo.removeComponent(entityId, 'position' as any)

        // Verify metadata was removed (since no entities have the component)
        let metadataOpt = yield* repo.getComponentMetadata('position' as any)
        expect(Option.isNone(metadataOpt)).toBe(true)

        // Compact storage
        yield* repo.compactStorage()

        // This is more of a smoke test - hard to verify internal state changes
        // but the operation should complete without error
      }))
    })

    it('should optimize indices for consistency', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const entityId = toEntityId(91)

        yield* repo.addComponent(entityId, 'position' as any, createTestPosition(1, 2, 3))
        yield* repo.addComponent(entityId, 'velocity' as any, createTestVelocity(1, 0, 0))

        // Optimize indices
        yield* repo.optimizeIndices()

        // Verify components are still accessible (indices should be rebuilt correctly)
        expect(yield* repo.hasComponent(entityId, 'position' as any)).toBe(true)
        expect(yield* repo.hasComponent(entityId, 'velocity' as any)).toBe(true)
      }))
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle operations on non-existent entities gracefully', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository
        const nonExistentId = toEntityId(99999)

        // All read operations should handle non-existent entities gracefully
        expect(yield* repo.hasComponent(nonExistentId, 'position' as any)).toBe(false)

        const componentOpt = yield* repo.getComponent(nonExistentId, 'position' as any)
        expect(Option.isNone(componentOpt)).toBe(true)

        const components = yield* repo.getComponents(nonExistentId)
        expect(Object.keys(components).length).toBe(0)

        // Update/remove operations should return false
        expect(yield* repo.updateComponent(nonExistentId, 'position' as any, createTestPosition(0, 0, 0))).toBe(false)
        expect(yield* repo.removeComponent(nonExistentId, 'position' as any)).toBe(false)
      }))
    })

    it('should handle concurrent component operations', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository

        // Create multiple entities and add components concurrently
        const addEffects = Array.from({ length: 20 }, (_, i) =>
          repo.addComponent(toEntityId(100 + i), 'position' as any, createTestPosition(i, i, i))
        )

        const results = yield* Effect.all(addEffects, { concurrency: 10 })

        // All operations should succeed
        expect(results.every(r => r === true)).toBe(true)

        // Verify statistics are consistent
        const stats = yield* repo.getComponentStats()
        expect(stats.componentsByType['position' as any]).toBe(20)
      }))
    })

    it('should handle large numbers of components efficiently', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* ComponentRepository

        // Add many components
        const entityCount = 1000
        for (let i = 0; i < entityCount; i++) {
          yield* repo.addComponent(toEntityId(200 + i), 'position' as any, createTestPosition(i % 100, Math.floor(i / 100), 0))
        }

        // Query operations should still work efficiently
        const allPositions = yield* repo.findEntitiesByComponent('position' as any)
        expect(allPositions.length).toBe(entityCount)

        const stats = yield* repo.getComponentStats()
        expect(stats.componentsByType['position' as any]).toBe(entityCount)

        // Filter with predicate
        const filtered = yield* repo.queryComponents(
          'position' as any,
          (pos: TestPosition) => pos.x < 50
        )
        expect(filtered.length).toBe(500) // Half should match the predicate
      }))
    })
  })
})