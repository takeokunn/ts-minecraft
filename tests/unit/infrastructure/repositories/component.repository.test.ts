/**
 * Component Repository Tests - Comprehensive test suite for component repository implementation
 *
 * This test suite covers all component operations, metadata management, bulk operations,
 * change tracking, and validation features with complete coverage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Option from 'effect/Option'

import { 
  createComponentRepository,
  type IComponentRepository,
  type ComponentRepositoryState,
  type ComponentMetadata,
  type ComponentStats,
  type ComponentChange,
  type ComponentQueryOptions,
  ComponentRepositoryLive
} from '@infrastructure/repositories/component.repository'
import { EntityId, toEntityId } from '@domain/entities'
import { type ComponentName, type Components, componentNamesSet } from '@domain/entities/components'
import { ComponentDecodeError } from '@domain/errors'
import { expectEffect, runEffect, measureEffectPerformance } from '../../../setup/infrastructure.setup'

describe('ComponentRepository', () => {
  let repository: IComponentRepository
  let stateRef: Ref.Ref<ComponentRepositoryState>

  const createTestState = (): ComponentRepositoryState => ({
    components: Object.fromEntries(
      Array.from(componentNamesSet).map((name) => [name, HashMap.empty()])
    ) as ComponentRepositoryState['components'],
    metadata: HashMap.empty(),
    changes: [],
    maxChangeHistory: 100,
    entityComponentIndex: HashMap.empty(),
  })

  beforeEach(async () => {
    const initialState = createTestState()
    stateRef = await runEffect(Ref.make(initialState))
    repository = createComponentRepository(stateRef)
  })

  describe('Basic Component Operations', () => {
    let entityId: EntityId

    beforeEach(() => {
      entityId = toEntityId(1)
    })

    describe('addComponent', () => {
      it('should add component to entity', async () => {
        const position = { x: 10, y: 20, z: 30 }
        const added = await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        
        expect(added).toBe(true)
        
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasComponent).toBe(true)
      })

      it('should return false when adding duplicate component', async () => {
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        
        const addedAgain = await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        expect(addedAgain).toBe(false)
      })

      it('should validate component data against schema', async () => {
        const invalidPosition = { invalid: 'data' }
        
        await expectEffect.toFail(
          repository.addComponent(entityId, 'position', invalidPosition as any)
        )
      })

      it('should update component metadata when adding', async () => {
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        
        const metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('position'))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.componentName).toBe('position')
          expect(metadata.entityCount).toBe(1)
          expect(metadata.totalSize).toBeGreaterThan(0)
          expect(metadata.averageSize).toBeGreaterThan(0)
          expect(metadata.version).toBe(1)
        }
      })

      it('should record component addition in change history', async () => {
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        
        const changes = await expectEffect.toSucceed(repository.getComponentChanges(entityId, 'position'))
        
        expect(changes).toHaveLength(1)
        expect(changes[0].changeType).toBe('added')
        expect(changes[0].componentName).toBe('position')
        expect(changes[0].newValue).toEqual(position)
      })

      it('should update entity component index', async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
        
        const components = await expectEffect.toSucceed(repository.findComponentsByEntity(entityId))
        
        expect(Object.keys(components)).toHaveLength(2)
        expect(components).toHaveProperty('position')
        expect(components).toHaveProperty('velocity')
      })
    })

    describe('updateComponent', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
      })

      it('should update existing component', async () => {
        const newPosition = { x: 15, y: 25, z: 35 }
        const updated = await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', newPosition))
        
        expect(updated).toBe(true)
        
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
        expect(Option.isSome(componentOpt)).toBe(true)
        
        if (Option.isSome(componentOpt)) {
          expect(componentOpt.value).toEqual(newPosition)
        }
      })

      it('should return false for non-existent component', async () => {
        const velocity = { x: 1, y: 0, z: 0 }
        const updated = await expectEffect.toSucceed(repository.updateComponent(entityId, 'velocity', velocity))
        
        expect(updated).toBe(false)
      })

      it('should validate updated component data', async () => {
        const invalidPosition = { invalid: 'structure' }
        
        await expectEffect.toFail(
          repository.updateComponent(entityId, 'position', invalidPosition as any)
        )
      })

      it('should update metadata size calculations', async () => {
        const largerPosition = { x: 100000, y: 200000, z: 300000 }
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', largerPosition))
        
        const metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('position'))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.version).toBe(2)
          expect(metadata.totalSize).toBeGreaterThan(0)
        }
      })

      it('should record component update in change history', async () => {
        const originalPosition = { x: 10, y: 20, z: 30 }
        const newPosition = { x: 15, y: 25, z: 35 }
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', newPosition))
        
        const changes = await expectEffect.toSucceed(repository.getComponentChanges(entityId, 'position'))
        
        expect(changes).toHaveLength(2) // add + update
        expect(changes[1].changeType).toBe('updated')
        expect(changes[1].previousValue).toEqual(originalPosition)
        expect(changes[1].newValue).toEqual(newPosition)
      })
    })

    describe('removeComponent', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      })

      it('should remove existing component', async () => {
        const removed = await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        expect(removed).toBe(true)
        
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasComponent).toBe(false)
      })

      it('should return false for non-existent component', async () => {
        const removed = await expectEffect.toSucceed(repository.removeComponent(entityId, 'health'))
        expect(removed).toBe(false)
      })

      it('should update metadata when removing component', async () => {
        await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        const metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('position'))
        expect(Option.isNone(metadataOpt)).toBe(true) // Metadata removed when last component removed
      })

      it('should update entity component index when removing', async () => {
        await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        const components = await expectEffect.toSucceed(repository.findComponentsByEntity(entityId))
        
        expect(Object.keys(components)).toHaveLength(1)
        expect(components).not.toHaveProperty('position')
        expect(components).toHaveProperty('velocity')
      })

      it('should record component removal in change history', async () => {
        const originalPosition = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        const changes = await expectEffect.toSucceed(repository.getComponentChanges(entityId, 'position'))
        
        expect(changes).toHaveLength(2) // add + remove
        expect(changes[1].changeType).toBe('removed')
        expect(changes[1].previousValue).toEqual(originalPosition)
        expect(changes[1].newValue).toBeUndefined()
      })
    })

    describe('getComponent', () => {
      it('should return component data for existing component', async () => {
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
        
        expect(Option.isSome(componentOpt)).toBe(true)
        if (Option.isSome(componentOpt)) {
          expect(componentOpt.value).toEqual(position)
        }
      })

      it('should return None for non-existent component', async () => {
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
        expect(Option.isNone(componentOpt)).toBe(true)
      })
    })

    describe('hasComponent', () => {
      it('should return true for existing component', async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
        
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasComponent).toBe(true)
      })

      it('should return false for non-existent component', async () => {
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasComponent).toBe(false)
      })
    })
  })

  describe('Bulk Operations', () => {
    let entityId: EntityId

    beforeEach(() => {
      entityId = toEntityId(10)
    })

    describe('addComponents', () => {
      it('should add multiple components to entity', async () => {
        const components = {
          position: { x: 10, y: 20, z: 30 },
          velocity: { x: 1, y: 0, z: -1 },
          health: { current: 100, max: 100 }
        }

        const addedCount = await expectEffect.toSucceed(repository.addComponents(entityId, components))
        
        expect(addedCount).toBe(3)
        
        const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        const hasVelocity = await expectEffect.toSucceed(repository.hasComponent(entityId, 'velocity'))
        const hasHealth = await expectEffect.toSucceed(repository.hasComponent(entityId, 'health'))
        
        expect(hasPosition).toBe(true)
        expect(hasVelocity).toBe(true)
        expect(hasHealth).toBe(true)
      })

      it('should skip invalid component types with warning', async () => {
        const components = {
          position: { x: 10, y: 20, z: 30 },
          invalidComponent: { invalid: 'data' }
        }

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        
        const addedCount = await expectEffect.toSucceed(repository.addComponents(entityId, components))
        
        expect(addedCount).toBe(1) // Only position should be added
        consoleSpy.mockRestore()
      })

      it('should fail if any valid component data is invalid', async () => {
        const components = {
          position: { invalid: 'structure' }, // Invalid position data
          velocity: { x: 1, y: 0, z: 0 }
        }

        await expectEffect.toFail(repository.addComponents(entityId, components))
      })

      it('should handle empty components object', async () => {
        const addedCount = await expectEffect.toSucceed(repository.addComponents(entityId, {}))
        expect(addedCount).toBe(0)
      })
    })

    describe('updateComponents', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      })

      it('should update multiple existing components', async () => {
        const updates = {
          position: { x: 15, y: 25, z: 35 },
          velocity: { x: 2, y: 1, z: -1 }
        }

        const updatedCount = await expectEffect.toSucceed(repository.updateComponents(entityId, updates))
        
        expect(updatedCount).toBe(2)
        
        const positionOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
        const velocityOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'velocity'))
        
        expect(Option.isSome(positionOpt)).toBe(true)
        expect(Option.isSome(velocityOpt)).toBe(true)
        
        if (Option.isSome(positionOpt)) {
          expect(positionOpt.value).toEqual({ x: 15, y: 25, z: 35 })
        }
        if (Option.isSome(velocityOpt)) {
          expect(velocityOpt.value).toEqual({ x: 2, y: 1, z: -1 })
        }
      })

      it('should return 0 for non-existent components', async () => {
        const updates = {
          health: { current: 50, max: 100 } // Not added to entity
        }

        const updatedCount = await expectEffect.toSucceed(repository.updateComponents(entityId, updates))
        expect(updatedCount).toBe(0)
      })

      it('should handle mix of existing and non-existent components', async () => {
        const updates = {
          position: { x: 100, y: 200, z: 300 },
          health: { current: 50, max: 100 } // Doesn't exist
        }

        const updatedCount = await expectEffect.toSucceed(repository.updateComponents(entityId, updates))
        expect(updatedCount).toBe(1) // Only position updated
      })
    })

    describe('removeComponents', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'health', { current: 100, max: 100 }))
      })

      it('should remove multiple components', async () => {
        const componentNames: ComponentName[] = ['position', 'velocity']
        const removedCount = await expectEffect.toSucceed(repository.removeComponents(entityId, componentNames))
        
        expect(removedCount).toBe(2)
        
        const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        const hasVelocity = await expectEffect.toSucceed(repository.hasComponent(entityId, 'velocity'))
        const hasHealth = await expectEffect.toSucceed(repository.hasComponent(entityId, 'health'))
        
        expect(hasPosition).toBe(false)
        expect(hasVelocity).toBe(false)
        expect(hasHealth).toBe(true) // Should remain
      })

      it('should handle non-existent components', async () => {
        const componentNames: ComponentName[] = ['inventory'] // Doesn't exist
        const removedCount = await expectEffect.toSucceed(repository.removeComponents(entityId, componentNames))
        
        expect(removedCount).toBe(0)
      })

      it('should handle mix of existing and non-existent components', async () => {
        const componentNames: ComponentName[] = ['position', 'inventory']
        const removedCount = await expectEffect.toSucceed(repository.removeComponents(entityId, componentNames))
        
        expect(removedCount).toBe(1) // Only position removed
      })
    })

    describe('getComponents', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      })

      it('should return all components when no filter specified', async () => {
        const components = await expectEffect.toSucceed(repository.getComponents(entityId))
        
        expect(Object.keys(components)).toHaveLength(2)
        expect(components).toHaveProperty('position')
        expect(components).toHaveProperty('velocity')
        expect(components.position).toEqual({ x: 10, y: 20, z: 30 })
        expect(components.velocity).toEqual({ x: 1, y: 0, z: 0 })
      })

      it('should return filtered components when names specified', async () => {
        const components = await expectEffect.toSucceed(
          repository.getComponents(entityId, ['position'])
        )
        
        expect(Object.keys(components)).toHaveLength(1)
        expect(components).toHaveProperty('position')
        expect(components).not.toHaveProperty('velocity')
      })

      it('should return empty object for entity with no components', async () => {
        const emptyEntityId = toEntityId(999)
        const components = await expectEffect.toSucceed(repository.getComponents(emptyEntityId))
        
        expect(Object.keys(components)).toHaveLength(0)
      })

      it('should skip non-existent components in filter', async () => {
        const components = await expectEffect.toSucceed(
          repository.getComponents(entityId, ['position', 'health'])
        )
        
        expect(Object.keys(components)).toHaveLength(1)
        expect(components).toHaveProperty('position')
        expect(components).not.toHaveProperty('health')
      })
    })
  })

  describe('Query Operations', () => {
    let entities: EntityId[]

    beforeEach(async () => {
      entities = [toEntityId(20), toEntityId(21), toEntityId(22), toEntityId(23)]
      
      // Entity 0: position only
      await expectEffect.toSucceed(repository.addComponent(entities[0], 'position', { x: 0, y: 0, z: 0 }))
      
      // Entity 1: position + velocity
      await expectEffect.toSucceed(repository.addComponent(entities[1], 'position', { x: 10, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entities[1], 'velocity', { x: 1, y: 0, z: 0 }))
      
      // Entity 2: velocity + health
      await expectEffect.toSucceed(repository.addComponent(entities[2], 'velocity', { x: 2, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entities[2], 'health', { current: 100, max: 100 }))
      
      // Entity 3: position + health
      await expectEffect.toSucceed(repository.addComponent(entities[3], 'position', { x: 20, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entities[3], 'health', { current: 50, max: 100 }))
    })

    describe('findEntitiesByComponent', () => {
      it('should find all entities with specific component', async () => {
        const positionResults = await expectEffect.toSucceed(
          repository.findEntitiesByComponent('position')
        )
        
        expect(positionResults).toHaveLength(3) // entities 0, 1, 3
        
        const entityIds = positionResults.map(r => r.entityId)
        expect(entityIds).toContain(entities[0])
        expect(entityIds).toContain(entities[1])
        expect(entityIds).toContain(entities[3])
        expect(entityIds).not.toContain(entities[2])
      })

      it('should return component data with entity IDs', async () => {
        const velocityResults = await expectEffect.toSucceed(
          repository.findEntitiesByComponent('velocity')
        )
        
        expect(velocityResults).toHaveLength(2) // entities 1, 2
        
        velocityResults.forEach(result => {
          expect(result.entityId).toBeDefined()
          expect(result.component).toHaveProperty('x')
          expect(result.component).toHaveProperty('y')
          expect(result.component).toHaveProperty('z')
        })
      })

      it('should return empty array for components with no entities', async () => {
        const results = await expectEffect.toSucceed(
          repository.findEntitiesByComponent('inventory')
        )
        expect(results).toHaveLength(0)
      })
    })

    describe('findComponentsByEntity', () => {
      it('should find all components for specific entity', async () => {
        const components = await expectEffect.toSucceed(
          repository.findComponentsByEntity(entities[1]) // Has position + velocity
        )
        
        expect(Object.keys(components)).toHaveLength(2)
        expect(components).toHaveProperty('position')
        expect(components).toHaveProperty('velocity')
        expect(components.position).toEqual({ x: 10, y: 0, z: 0 })
        expect(components.velocity).toEqual({ x: 1, y: 0, z: 0 })
      })

      it('should return empty object for entity with no components', async () => {
        const emptyEntityId = toEntityId(999)
        const components = await expectEffect.toSucceed(
          repository.findComponentsByEntity(emptyEntityId)
        )
        
        expect(Object.keys(components)).toHaveLength(0)
      })
    })

    describe('queryComponents', () => {
      it('should find components matching predicate', async () => {
        const predicate = (pos: any) => pos.x > 5
        const results = await expectEffect.toSucceed(
          repository.queryComponents('position', predicate)
        )
        
        expect(results).toHaveLength(2) // entities 1 and 3 with x > 5
        
        const entityIds = results.map(r => r.entityId)
        expect(entityIds).toContain(entities[1])
        expect(entityIds).toContain(entities[3])
        expect(entityIds).not.toContain(entities[0])
      })

      it('should return empty array when no components match predicate', async () => {
        const predicate = (pos: any) => pos.x > 100
        const results = await expectEffect.toSucceed(
          repository.queryComponents('position', predicate)
        )
        
        expect(results).toHaveLength(0)
      })

      it('should work with complex predicates', async () => {
        const predicate = (health: any) => health.current < health.max
        const results = await expectEffect.toSucceed(
          repository.queryComponents('health', predicate)
        )
        
        expect(results).toHaveLength(1) // Only entity 3 with current < max
        expect(results[0].entityId).toBe(entities[3])
      })
    })
  })

  describe('Component Metadata and Statistics', () => {
    beforeEach(async () => {
      const entities = [toEntityId(30), toEntityId(31), toEntityId(32)]
      
      // Add various components to build metadata
      await expectEffect.toSucceed(repository.addComponent(entities[0], 'position', { x: 0, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entities[1], 'position', { x: 10, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entities[2], 'velocity', { x: 1, y: 0, z: 0 }))
    })

    describe('getComponentMetadata', () => {
      it('should return metadata for component with instances', async () => {
        const metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('position'))
        
        expect(Option.isSome(metadataOpt)).toBe(true)
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.componentName).toBe('position')
          expect(metadata.entityCount).toBe(2)
          expect(metadata.totalSize).toBeGreaterThan(0)
          expect(metadata.averageSize).toBeGreaterThan(0)
          expect(metadata.version).toBe(2) // 2 additions
        }
      })

      it('should return None for component with no instances', async () => {
        const metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('health'))
        expect(Option.isNone(metadataOpt)).toBe(true)
      })

      it('should track version increments', async () => {
        const entityId = toEntityId(40)
        await expectEffect.toSucceed(repository.addComponent(entityId, 'health', { current: 100, max: 100 }))
        
        let metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('health'))
        expect(Option.isSome(metadataOpt) && metadataOpt.value.version).toBe(1)
        
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'health', { current: 80, max: 100 }))
        
        metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('health'))
        expect(Option.isSome(metadataOpt) && metadataOpt.value.version).toBe(2)
      })
    })

    describe('getComponentStats', () => {
      it('should return comprehensive component statistics', async () => {
        const stats = await expectEffect.toSucceed(repository.getComponentStats())
        
        expect(stats.totalComponents).toBe(3) // 2 position + 1 velocity
        expect(stats.componentsByType.position).toBe(2)
        expect(stats.componentsByType.velocity).toBe(1)
        expect(stats.componentsByType.health).toBe(0)
        
        expect(stats.memoryUsage.position).toBeGreaterThan(0)
        expect(stats.memoryUsage.velocity).toBeGreaterThan(0)
        
        expect(stats.mostUsedComponents).toHaveLength(5)
        expect(stats.leastUsedComponents).toHaveLength(2) // Only components with count > 0
      })

      it('should order most and least used components correctly', async () => {
        const stats = await expectEffect.toSucceed(repository.getComponentStats())
        
        // Most used should be in descending order
        for (let i = 1; i < stats.mostUsedComponents.length; i++) {
          expect(stats.mostUsedComponents[i].count).toBeLessThanOrEqual(stats.mostUsedComponents[i-1].count)
        }
        
        // Least used should be in ascending order (excluding zero counts)
        for (let i = 1; i < stats.leastUsedComponents.length; i++) {
          expect(stats.leastUsedComponents[i].count).toBeGreaterThanOrEqual(stats.leastUsedComponents[i-1].count)
        }
      })
    })

    describe('getComponentCount', () => {
      it('should return count for specific component', async () => {
        const positionCount = await expectEffect.toSucceed(repository.getComponentCount('position'))
        const velocityCount = await expectEffect.toSucceed(repository.getComponentCount('velocity'))
        const healthCount = await expectEffect.toSucceed(repository.getComponentCount('health'))
        
        expect(positionCount).toBe(2)
        expect(velocityCount).toBe(1)
        expect(healthCount).toBe(0)
      })

      it('should return total count when no component specified', async () => {
        const totalCount = await expectEffect.toSucceed(repository.getComponentCount())
        expect(totalCount).toBe(3) // 2 position + 1 velocity
      })
    })
  })

  describe('Change Tracking', () => {
    let entityId: EntityId

    beforeEach(async () => {
      entityId = toEntityId(50)
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
    })

    describe('getComponentChanges', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', { x: 15, y: 25, z: 35 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
        
        // Add changes for different entity
        const otherEntityId = toEntityId(51)
        await expectEffect.toSucceed(repository.addComponent(otherEntityId, 'health', { current: 100, max: 100 }))
      })

      it('should return all changes when no filters applied', async () => {
        const changes = await expectEffect.toSucceed(repository.getComponentChanges())
        expect(changes).toHaveLength(4) // 1 add + 1 update + 1 add for first entity + 1 add for second entity
      })

      it('should filter changes by entity ID', async () => {
        const changes = await expectEffect.toSucceed(repository.getComponentChanges(entityId))
        expect(changes).toHaveLength(3) // Only changes for specific entity
        
        changes.forEach(change => {
          expect(change.entityId).toBe(entityId)
        })
      })

      it('should filter changes by component name', async () => {
        const changes = await expectEffect.toSucceed(repository.getComponentChanges(undefined, 'position'))
        expect(changes).toHaveLength(2) // add + update for position
        
        changes.forEach(change => {
          expect(change.componentName).toBe('position')
        })
      })

      it('should filter changes by timestamp', async () => {
        const cutoffTime = Date.now()
        
        // Add another change after cutoff
        await expectEffect.toSucceed(repository.addComponent(entityId, 'health', { current: 50, max: 100 }))
        
        const recentChanges = await expectEffect.toSucceed(
          repository.getComponentChanges(undefined, undefined, cutoffTime)
        )
        expect(recentChanges).toHaveLength(1) // Only the health addition
        expect(recentChanges[0].componentName).toBe('health')
      })

      it('should combine all filters', async () => {
        const changes = await expectEffect.toSucceed(
          repository.getComponentChanges(entityId, 'position')
        )
        expect(changes).toHaveLength(2) // add + update for specific entity and component
        
        changes.forEach(change => {
          expect(change.entityId).toBe(entityId)
          expect(change.componentName).toBe('position')
        })
      })
    })

    describe('clearChangeHistory', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', { x: 20, y: 30, z: 40 }))
      })

      it('should clear all changes when no timestamp specified', async () => {
        const clearedCount = await expectEffect.toSucceed(repository.clearChangeHistory())
        expect(clearedCount).toBe(2) // add + update
        
        const remainingChanges = await expectEffect.toSucceed(repository.getComponentChanges())
        expect(remainingChanges).toHaveLength(0)
      })

      it('should clear changes before specified timestamp', async () => {
        const cutoffTime = Date.now()
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
        
        const clearedCount = await expectEffect.toSucceed(repository.clearChangeHistory(cutoffTime))
        expect(clearedCount).toBe(2) // Changes before cutoff
        
        const remainingChanges = await expectEffect.toSucceed(repository.getComponentChanges())
        expect(remainingChanges).toHaveLength(1) // Only velocity addition remains
      })
    })

    it('should respect max change history limit', async () => {
      const entityId = toEntityId(60)
      
      // Create more changes than the limit (100)
      for (let i = 0; i < 120; i++) {
        await expectEffect.toSucceed(
          repository.addComponent(toEntityId(1000 + i), 'position', { x: i, y: 0, z: 0 })
        )
      }
      
      const changes = await expectEffect.toSucceed(repository.getComponentChanges())
      expect(changes.length).toBeLessThanOrEqual(100) // Should respect maxChangeHistory
    })
  })

  describe('Validation', () => {
    describe('validateComponent', () => {
      it('should validate correct component data', async () => {
        const position = { x: 10, y: 20, z: 30 }
        const validated = await expectEffect.toSucceed(
          repository.validateComponent('position', position)
        )
        
        expect(validated).toEqual(position)
      })

      it('should fail validation for incorrect component data', async () => {
        const invalidPosition = { invalid: 'structure' }
        
        await expectEffect.toFail(
          repository.validateComponent('position', invalidPosition)
        )
      })

      it('should validate with proper type inference', async () => {
        const health = { current: 80, max: 100 }
        const validated = await expectEffect.toSucceed(
          repository.validateComponent('health', health)
        )
        
        expect(validated.current).toBe(80)
        expect(validated.max).toBe(100)
      })
    })

    describe('validateComponents', () => {
      it('should validate multiple components', async () => {
        const components = {
          position: { x: 10, y: 20, z: 30 },
          velocity: { x: 1, y: 0, z: -1 },
          health: { current: 100, max: 100 }
        }

        const validated = await expectEffect.toSucceed(
          repository.validateComponents(components)
        )
        
        expect(Object.keys(validated)).toHaveLength(3)
        expect(validated.position).toEqual({ x: 10, y: 20, z: 30 })
        expect(validated.velocity).toEqual({ x: 1, y: 0, z: -1 })
        expect(validated.health).toEqual({ current: 100, max: 100 })
      })

      it('should skip invalid component types with warning', async () => {
        const components = {
          position: { x: 10, y: 20, z: 30 },
          invalidComponent: { invalid: 'data' }
        }

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        
        const validated = await expectEffect.toSucceed(
          repository.validateComponents(components)
        )
        
        expect(Object.keys(validated)).toHaveLength(1)
        expect(validated).toHaveProperty('position')
        expect(validated).not.toHaveProperty('invalidComponent')
        
        consoleSpy.mockRestore()
      })

      it('should fail if any valid component has invalid data', async () => {
        const components = {
          position: { invalid: 'structure' },
          velocity: { x: 1, y: 0, z: 0 }
        }

        await expectEffect.toFail(repository.validateComponents(components))
      })
    })
  })

  describe('Maintenance Operations', () => {
    beforeEach(async () => {
      // Create and then remove some components to create cleanup scenarios
      const entityId = toEntityId(70)
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.removeComponent(entityId, 'velocity'))
    })

    describe('compactStorage', () => {
      it('should remove empty metadata entries', async () => {
        // Velocity metadata should be removed since no instances remain
        await expectEffect.toSucceed(repository.compactStorage())
        
        const velocityMetadata = await expectEffect.toSucceed(repository.getComponentMetadata('velocity'))
        expect(Option.isNone(velocityMetadata)).toBe(true)
        
        const positionMetadata = await expectEffect.toSucceed(repository.getComponentMetadata('position'))
        expect(Option.isSome(positionMetadata)).toBe(true)
      })

      it('should clean entity component index', async () => {
        await expectEffect.toSucceed(repository.compactStorage())
        
        // Should complete without error
        const stats = await expectEffect.toSucceed(repository.getComponentStats())
        expect(stats).toBeDefined()
      })
    })

    describe('optimizeIndices', () => {
      it('should rebuild entity component index', async () => {
        await expectEffect.toSucceed(repository.optimizeIndices())
        
        // Verify index is consistent
        const entityId = toEntityId(70)
        const components = await expectEffect.toSucceed(repository.findComponentsByEntity(entityId))
        
        expect(Object.keys(components)).toHaveLength(1) // Only position should remain
        expect(components).toHaveProperty('position')
        expect(components).not.toHaveProperty('velocity')
      })

      it('should maintain data integrity during optimization', async () => {
        const entityId = toEntityId(75)
        await expectEffect.toSucceed(repository.addComponent(entityId, 'health', { current: 100, max: 100 }))
        
        await expectEffect.toSucceed(repository.optimizeIndices())
        
        // All data should remain accessible
        const hasHealth = await expectEffect.toSucceed(repository.hasComponent(entityId, 'health'))
        expect(hasHealth).toBe(true)
        
        const healthOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'health'))
        expect(Option.isSome(healthOpt)).toBe(true)
        if (Option.isSome(healthOpt)) {
          expect(healthOpt.value).toEqual({ current: 100, max: 100 })
        }
      })
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent component additions', async () => {
      const entityIds = Array.from({ length: 10 }, (_, i) => toEntityId(100 + i))
      
      const concurrentOps = entityIds.map(entityId => 
        repository.addComponent(entityId, 'position', { x: entityId, y: 0, z: 0 })
      )
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentOps, { concurrency: 'unbounded' })
      )
      
      // All operations should succeed
      results.forEach(result => expect(result).toBe(true))
      
      // Verify all components were added
      const positionResults = await expectEffect.toSucceed(
        repository.findEntitiesByComponent('position')
      )
      expect(positionResults).toHaveLength(10)
    })

    it('should handle concurrent component updates', async () => {
      const entityId = toEntityId(200)
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
      
      const concurrentUpdates = Array.from({ length: 5 }, (_, i) =>
        repository.updateComponent(entityId, 'position', { x: i * 10, y: 0, z: 0 })
      )
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentUpdates, { concurrency: 'unbounded' })
      )
      
      // All operations should succeed
      results.forEach(result => expect(result).toBe(true))
      
      // Final state should be consistent
      const positionOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
      expect(Option.isSome(positionOpt)).toBe(true)
      
      // Verify changes were tracked
      const changes = await expectEffect.toSucceed(repository.getComponentChanges(entityId, 'position'))
      expect(changes.length).toBeGreaterThan(1) // At least add + updates
    })

    it('should handle concurrent queries', async () => {
      // Setup test data
      const entities = Array.from({ length: 20 }, (_, i) => toEntityId(300 + i))
      for (const entityId of entities) {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: entityId % 10, y: 0, z: 0 }))
      }
      
      const concurrentQueries = [
        repository.findEntitiesByComponent('position'),
        repository.getComponentStats(),
        repository.getComponentCount('position'),
        repository.queryComponents('position', (pos) => pos.x > 5),
      ]
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentQueries, { concurrency: 'unbounded' })
      )
      
      expect(results[0]).toHaveLength(20) // All entities with position
      expect(results[1]).toHaveProperty('totalComponents')
      expect(results[2]).toBe(20) // Position count
      expect(results[3].length).toBeGreaterThan(0) // Filtered results
    })
  })

  describe('Performance Tests', () => {
    it('should handle large numbers of components efficiently', async () => {
      const componentCount = 1000
      const entityIds = Array.from({ length: componentCount }, (_, i) => toEntityId(1000 + i))
      
      const addOps = entityIds.map(entityId => 
        repository.addComponent(entityId, 'position', { x: entityId, y: 0, z: 0 })
      )
      
      const { duration } = await measureEffectPerformance(
        Effect.all(addOps, { concurrency: 50 }),
        'add 1000 components'
      )
      
      expect(duration).toBeLessThan(3000) // Should complete within 3 seconds
      
      // Verify query performance
      const { result: queryResult, duration: queryDuration } = await measureEffectPerformance(
        repository.findEntitiesByComponent('position'),
        'query 1000 components'
      )
      
      expect(queryResult).toHaveLength(componentCount)
      expect(queryDuration).toBeLessThan(100) // Should complete within 100ms
    })

    it('should maintain performance with frequent updates', async () => {
      const entityId = toEntityId(2000)
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
      
      // Perform many updates
      const updates = Array.from({ length: 100 }, (_, i) =>
        repository.updateComponent(entityId, 'position', { x: i, y: 0, z: 0 })
      )
      
      const { duration } = await measureEffectPerformance(
        Effect.all(updates, { concurrency: 1 }),
        '100 component updates'
      )
      
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      
      // Verify metadata is still accurate
      const metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('position'))
      expect(Option.isSome(metadataOpt)).toBe(true)
      if (Option.isSome(metadataOpt)) {
        expect(metadataOpt.value.version).toBe(101) // 1 add + 100 updates
      }
    })

    it('should handle bulk operations efficiently', async () => {
      const entityId = toEntityId(3000)
      const components = {
        position: { x: 10, y: 20, z: 30 },
        velocity: { x: 1, y: 0, z: -1 },
        health: { current: 100, max: 100 },
        inventory: { items: [] }
      }
      
      const { duration } = await measureEffectPerformance(
        repository.addComponents(entityId, components),
        'bulk add 4 components'
      )
      
      expect(duration).toBeLessThan(100) // Should complete within 100ms
      
      // Verify all components were added
      const entityComponents = await expectEffect.toSucceed(repository.findComponentsByEntity(entityId))
      expect(Object.keys(entityComponents)).toHaveLength(4)
    })
  })

  describe('Edge Cases', () => {
    it('should handle component addition to entity with many existing components', async () => {
      const entityId = toEntityId(4000)
      
      // Add many components
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entityId, 'health', { current: 100, max: 100 }))
      await expectEffect.toSucceed(repository.addComponent(entityId, 'inventory', { items: [] }))
      
      const components = await expectEffect.toSucceed(repository.findComponentsByEntity(entityId))
      expect(Object.keys(components)).toHaveLength(4)
    })

    it('should handle removal of non-existent component gracefully', async () => {
      const entityId = toEntityId(5000)
      const removed = await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
      expect(removed).toBe(false)
    })

    it('should handle component size estimation edge cases', async () => {
      const entityId = toEntityId(6000)
      
      // Very large component
      const largeInventory = {
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item${i}`, count: i % 64 }))
      }
      
      await expectEffect.toSucceed(repository.addComponent(entityId, 'inventory', largeInventory))
      
      const metadataOpt = await expectEffect.toSucceed(repository.getComponentMetadata('inventory'))
      expect(Option.isSome(metadataOpt)).toBe(true)
      if (Option.isSome(metadataOpt)) {
        expect(metadataOpt.value.totalSize).toBeGreaterThan(1000) // Should estimate large size
      }
    })

    it('should handle query predicates that throw exceptions', async () => {
      const entityId = toEntityId(7000)
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
      
      const badPredicate = () => {
        throw new Error('Predicate error')
      }
      
      // Should handle predicate errors gracefully
      try {
        await expectEffect.toSucceed(repository.queryComponents('position', badPredicate))
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Layer Integration', () => {
    it('should work with Effect Layer system', async () => {
      const effect = Effect.gen(function* (_) {
        const repo = yield* _(ComponentRepository)
        const entityId = toEntityId(8000)
        const added = yield* _(repo.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
        const hasComponent = yield* _(repo.hasComponent(entityId, 'position'))
        return { added, hasComponent }
      })
      
      const result = await runEffect(Effect.provide(effect, ComponentRepositoryLive))
      
      expect(result.added).toBe(true)
      expect(result.hasComponent).toBe(true)
    })
  })
})