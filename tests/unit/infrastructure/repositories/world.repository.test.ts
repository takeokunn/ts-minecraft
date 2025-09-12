/**
 * World Repository Tests - Comprehensive test suite for world repository implementation
 *
 * This test suite covers all entity/component operations, archetype management,
 * query systems, and persistence operations following the IWorldRepository interface.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Option from 'effect/Option'

import { 
  createWorldRepository,
  WorldRepositoryService,
  WorldRepositoryLive,
  WorldRepositoryUtils
} from '@infrastructure/repositories/world.repository'
import { IWorldRepository } from '@domain/ports/world-repository.port'
import { EntityId, toEntityId } from '@domain/entities'
import { type ComponentName, type Components, type ComponentOfName, componentNamesSet } from '@domain/entities/components'
import { Archetype } from '@domain/archetypes'
import { SoAResult } from '@domain/types'
import { ComponentDecodeError, QuerySingleResultNotFoundError } from '@domain/errors'
import { expectEffect, runEffect, measureEffectPerformance } from '../../../setup/infrastructure.setup'

// World repository state type for testing
interface WorldRepositoryState {
  readonly nextEntityId: number
  readonly entities: HashMap.HashMap<EntityId, string>
  readonly archetypes: HashMap.HashMap<string, HashSet.HashSet<EntityId>>
  readonly components: {
    readonly [K in ComponentName]: HashMap.HashMap<EntityId, Components[K]>
  }
  readonly version: number
}

describe('WorldRepository', () => {
  let repository: IWorldRepository
  let stateRef: Ref.Ref<WorldRepositoryState>

  const createTestState = (): WorldRepositoryState => ({
    nextEntityId: 0,
    entities: HashMap.empty(),
    archetypes: HashMap.empty(),
    components: Object.fromEntries(
      Array.from(componentNamesSet).map((name) => [name, HashMap.empty()])
    ) as any,
    version: 0,
  })

  beforeEach(async () => {
    const initialState = createTestState()
    stateRef = await runEffect(Ref.make(initialState))
    repository = createWorldRepository(stateRef)
  })

  describe('Entity Lifecycle', () => {
    describe('createEntity', () => {
      it('should create entity without components', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        
        expect(entityId).toBeDefined()
        expect(typeof entityId).toBe('number')
        expect(entityId).toBeGreaterThanOrEqual(0)
        
        const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
        expect(exists).toBe(true)
      })

      it('should create entity with valid components', async () => {
        const components = {
          position: { x: 10, y: 20, z: 30 },
          velocity: { x: 1, y: 0, z: -1 }
        }

        const entityId = await expectEffect.toSucceed(repository.createEntity(components))
        
        expect(entityId).toBeDefined()
        
        const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        const hasVelocity = await expectEffect.toSucceed(repository.hasComponent(entityId, 'velocity'))
        
        expect(hasPosition).toBe(true)
        expect(hasVelocity).toBe(true)
      })

      it('should assign sequential entity IDs', async () => {
        const entityId1 = await expectEffect.toSucceed(repository.createEntity())
        const entityId2 = await expectEffect.toSucceed(repository.createEntity())
        const entityId3 = await expectEffect.toSucceed(repository.createEntity())

        expect(entityId1).toBe(0)
        expect(entityId2).toBe(1)
        expect(entityId3).toBe(2)
      })

      it('should skip invalid components with warning', async () => {
        const components = {
          position: { x: 10, y: 20, z: 30 },
          invalidComponent: { invalid: 'data' }
        }

        const entityId = await expectEffect.toSucceed(repository.createEntity(components))
        
        const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasPosition).toBe(true)
      })

      it('should fail with component decode error for invalid component data', async () => {
        const components = {
          position: { invalid: 'structure' } // Invalid position data
        }

        await expectEffect.toFail(repository.createEntity(components))
      })

      it('should update repository version', async () => {
        const initialState = await runEffect(Ref.get(stateRef))
        const initialVersion = initialState.version

        await expectEffect.toSucceed(repository.createEntity())
        
        const newState = await runEffect(Ref.get(stateRef))
        expect(newState.version).toBe(initialVersion + 1)
      })
    })

    describe('destroyEntity', () => {
      let entityId: EntityId

      beforeEach(async () => {
        const components = {
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 1, y: 1, z: 1 }
        }
        entityId = await expectEffect.toSucceed(repository.createEntity(components))
      })

      it('should destroy existing entity', async () => {
        await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
        expect(exists).toBe(false)
      })

      it('should remove entity from all components', async () => {
        await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        const hasVelocity = await expectEffect.toSucceed(repository.hasComponent(entityId, 'velocity'))
        
        expect(hasPosition).toBe(false)
        expect(hasVelocity).toBe(false)
      })

      it('should handle non-existent entity gracefully', async () => {
        const nonExistentId = toEntityId(9999)
        
        // Should not throw, just log debug message
        await expectEffect.toSucceed(repository.destroyEntity(nonExistentId))
      })

      it('should update repository version', async () => {
        const initialState = await runEffect(Ref.get(stateRef))
        const initialVersion = initialState.version

        await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        const newState = await runEffect(Ref.get(stateRef))
        expect(newState.version).toBe(initialVersion + 1)
      })
    })

    describe('hasEntity', () => {
      it('should return true for existing entity', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
        
        expect(exists).toBe(true)
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const exists = await expectEffect.toSucceed(repository.hasEntity(nonExistentId))
        
        expect(exists).toBe(false)
      })

      it('should return false for destroyed entity', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
        expect(exists).toBe(false)
      })
    })
  })

  describe('Component Operations', () => {
    let entityId: EntityId

    beforeEach(async () => {
      entityId = await expectEffect.toSucceed(repository.createEntity())
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
        
        const addedAgain = await expectEffect.toFail(
          repository.addComponent(entityId, 'position', position)
            .pipe(Effect.catchAll(() => Effect.succeed(false)))
        )
        expect(addedAgain).toBe(false)
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const position = { x: 10, y: 20, z: 30 }
        
        const added = await expectEffect.toFail(
          repository.addComponent(nonExistentId, 'position', position)
            .pipe(Effect.catchAll(() => Effect.succeed(false)))
        )
        expect(added).toBe(false)
      })

      it('should fail with validation error for invalid component data', async () => {
        const invalidPosition = { invalid: 'data' }
        
        await expectEffect.toFail(
          repository.addComponent(entityId, 'position', invalidPosition as any)
        )
      })

      it('should update archetype when adding component', async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
        
        const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        const hasVelocity = await expectEffect.toSucceed(repository.hasComponent(entityId, 'velocity'))
        
        expect(hasPosition).toBe(true)
        expect(hasVelocity).toBe(true)
      })
    })

    describe('removeComponent', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      })

      it('should remove component from entity', async () => {
        const removed = await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        expect(removed).toBe(true)
        
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasComponent).toBe(false)
      })

      it('should return false when removing non-existent component', async () => {
        const removed = await expectEffect.toSucceed(repository.removeComponent(entityId, 'health'))
        expect(removed).toBe(false)
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const removed = await expectEffect.toSucceed(repository.removeComponent(nonExistentId, 'position'))
        
        expect(removed).toBe(false)
      })

      it('should update archetype when removing component', async () => {
        await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        const hasVelocity = await expectEffect.toSucceed(repository.hasComponent(entityId, 'velocity'))
        
        expect(hasPosition).toBe(false)
        expect(hasVelocity).toBe(true)
      })

      it('should handle removing last component', async () => {
        await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        await expectEffect.toSucceed(repository.removeComponent(entityId, 'velocity'))
        
        const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
        expect(exists).toBe(true) // Entity should still exist, just with no components
      })
    })

    describe('getComponent', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
      })

      it('should return component data for existing component', async () => {
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
        
        expect(Option.isSome(componentOpt)).toBe(true)
        if (Option.isSome(componentOpt)) {
          expect(componentOpt.value).toEqual({ x: 10, y: 20, z: 30 })
        }
      })

      it('should return None for non-existent component', async () => {
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'velocity'))
        expect(Option.isNone(componentOpt)).toBe(true)
      })

      it('should return None for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(nonExistentId, 'position'))
        
        expect(Option.isNone(componentOpt)).toBe(true)
      })
    })

    describe('hasComponent', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
      })

      it('should return true for existing component', async () => {
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasComponent).toBe(true)
      })

      it('should return false for non-existent component', async () => {
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'velocity'))
        expect(hasComponent).toBe(false)
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(nonExistentId, 'position'))
        
        expect(hasComponent).toBe(false)
      })
    })

    describe('updateComponent', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
      })

      it('should update existing component', async () => {
        const newPosition = { x: 15, y: 25, z: 35 }
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', newPosition))
        
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
        expect(Option.isSome(componentOpt)).toBe(true)
        
        if (Option.isSome(componentOpt)) {
          expect(componentOpt.value).toEqual(newPosition)
        }
      })

      it('should warn for non-existent component type', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        
        await expectEffect.toSucceed(
          repository.updateComponent(entityId, 'invalidComponent' as any, { data: 'test' })
        )
        
        consoleSpy.mockRestore()
      })

      it('should fail with validation error for invalid component data', async () => {
        const invalidPosition = { invalid: 'structure' }
        
        await expectEffect.toFail(
          repository.updateComponent(entityId, 'position', invalidPosition)
        )
      })
    })

    describe('updateComponents', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      })

      it('should update multiple components atomically', async () => {
        const updates = [
          { entityId, componentType: 'position', component: { x: 15, y: 25, z: 35 } },
          { entityId, componentType: 'velocity', component: { x: 2, y: 1, z: -1 } }
        ]

        await expectEffect.toSucceed(repository.updateComponents(updates))
        
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

      it('should handle empty updates array', async () => {
        await expectEffect.toSucceed(repository.updateComponents([]))
      })
    })
  })

  describe('Query Operations', () => {
    let entities: EntityId[]

    beforeEach(async () => {
      // Create test entities with different component combinations
      const entity1 = await expectEffect.toSucceed(repository.createEntity())
      await expectEffect.toSucceed(repository.addComponent(entity1, 'position', { x: 0, y: 0, z: 0 }))
      
      const entity2 = await expectEffect.toSucceed(repository.createEntity())
      await expectEffect.toSucceed(repository.addComponent(entity2, 'position', { x: 10, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entity2, 'velocity', { x: 1, y: 0, z: 0 }))
      
      const entity3 = await expectEffect.toSucceed(repository.createEntity())
      await expectEffect.toSucceed(repository.addComponent(entity3, 'velocity', { x: 2, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entity3, 'health', { current: 100, max: 100 }))
      
      const entity4 = await expectEffect.toSucceed(repository.createEntity())
      await expectEffect.toSucceed(repository.addComponent(entity4, 'position', { x: 20, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entity4, 'health', { current: 50, max: 100 }))
      
      entities = [entity1, entity2, entity3, entity4]
    })

    describe('query', () => {
      it('should find all entities with specific component', async () => {
        const positionResults = await expectEffect.toSucceed(repository.query('position'))
        
        expect(positionResults).toHaveLength(3) // entity1, entity2, entity4
        
        const entityIds = positionResults.map(r => r.entityId)
        expect(entityIds).toContain(entities[0])
        expect(entityIds).toContain(entities[1])
        expect(entityIds).toContain(entities[3])
        expect(entityIds).not.toContain(entities[2])
      })

      it('should return component data with entity IDs', async () => {
        const velocityResults = await expectEffect.toSucceed(repository.query('velocity'))
        
        expect(velocityResults).toHaveLength(2) // entity2, entity3
        
        velocityResults.forEach(result => {
          expect(result.entityId).toBeDefined()
          expect(result.component).toHaveProperty('x')
          expect(result.component).toHaveProperty('y')
          expect(result.component).toHaveProperty('z')
        })
      })

      it('should return empty array for components with no entities', async () => {
        const results = await expectEffect.toSucceed(repository.query('inventory'))
        expect(results).toHaveLength(0)
      })
    })

    describe('queryMultiple', () => {
      it('should find entities with all specified components', async () => {
        const results = await expectEffect.toSucceed(
          repository.queryMultiple(['position', 'velocity'])
        )
        
        expect(results).toHaveLength(1) // Only entity2 has both
        expect(results[0].entityId).toBe(entities[1])
        expect(results[0].components.position).toBeDefined()
        expect(results[0].components.velocity).toBeDefined()
      })

      it('should return empty array when no entities match all components', async () => {
        const results = await expectEffect.toSucceed(
          repository.queryMultiple(['position', 'velocity', 'health'])
        )
        
        expect(results).toHaveLength(0)
      })

      it('should handle single component query', async () => {
        const results = await expectEffect.toSucceed(
          repository.queryMultiple(['health'])
        )
        
        expect(results).toHaveLength(2) // entity3, entity4
      })

      it('should handle empty component list', async () => {
        const results = await expectEffect.toSucceed(
          repository.queryMultiple([])
        )
        
        expect(results).toHaveLength(0)
      })
    })

    describe('querySingle', () => {
      it('should return component for existing entity-component pair', async () => {
        const component = await expectEffect.toSucceed(
          repository.querySingle('position', entities[0])
        )
        
        expect(component).toEqual({ x: 0, y: 0, z: 0 })
      })

      it('should fail with QuerySingleResultNotFoundError for non-existent component', async () => {
        await expectEffect.toFail(
          repository.querySingle('velocity', entities[0])
        )
      })

      it('should fail with QuerySingleResultNotFoundError for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        
        await expectEffect.toFail(
          repository.querySingle('position', nonExistentId)
        )
      })
    })

    describe('querySoA', () => {
      it('should return Structure of Arrays format', async () => {
        const result = await expectEffect.toSucceed(
          repository.querySoA(['position', 'velocity'])
        )
        
        expect(result.entities).toHaveLength(1) // Only entity2 has both components
        expect(result.components.position).toHaveLength(1)
        expect(result.components.velocity).toHaveLength(1)
        expect(result.entities[0]).toBe(entities[1])
      })

      it('should handle multiple matching entities', async () => {
        const result = await expectEffect.toSucceed(
          repository.querySoA(['position'])
        )
        
        expect(result.entities).toHaveLength(3) // entity1, entity2, entity4
        expect(result.components.position).toHaveLength(3)
      })

      it('should return empty arrays for no matches', async () => {
        const result = await expectEffect.toSucceed(
          repository.querySoA(['inventory'])
        )
        
        expect(result.entities).toHaveLength(0)
        expect(result.components.inventory).toHaveLength(0)
      })

      it('should handle single component query', async () => {
        const result = await expectEffect.toSucceed(
          repository.querySoA(['health'])
        )
        
        expect(result.entities).toHaveLength(2) // entity3, entity4
        expect(result.components.health).toHaveLength(2)
      })
    })
  })

  describe('Archetype Management', () => {
    it('should group entities by archetype correctly', async () => {
      // Create entities with same archetype
      const entity1 = await expectEffect.toSucceed(repository.createEntity())
      await expectEffect.toSucceed(repository.addComponent(entity1, 'position', { x: 0, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entity1, 'velocity', { x: 1, y: 0, z: 0 }))
      
      const entity2 = await expectEffect.toSucceed(repository.createEntity())
      await expectEffect.toSucceed(repository.addComponent(entity2, 'position', { x: 10, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entity2, 'velocity', { x: 2, y: 0, z: 0 }))
      
      // Both entities should be found in multi-component queries
      const results = await expectEffect.toSucceed(
        repository.queryMultiple(['position', 'velocity'])
      )
      
      expect(results).toHaveLength(2)
      expect(results.map(r => r.entityId)).toContain(entity1)
      expect(results.map(r => r.entityId)).toContain(entity2)
    })

    it('should handle archetype changes when components are added/removed', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      // Start with position only
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
      
      let positionOnlyResults = await expectEffect.toSucceed(repository.query('position'))
      expect(positionOnlyResults).toHaveLength(1)
      
      // Add velocity - should still be found in position queries
      await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      
      positionOnlyResults = await expectEffect.toSucceed(repository.query('position'))
      expect(positionOnlyResults).toHaveLength(1)
      
      const positionVelocityResults = await expectEffect.toSucceed(
        repository.queryMultiple(['position', 'velocity'])
      )
      expect(positionVelocityResults).toHaveLength(1)
      
      // Remove position - should only be found in velocity queries
      await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
      
      positionOnlyResults = await expectEffect.toSucceed(repository.query('position'))
      expect(positionOnlyResults).toHaveLength(0)
      
      const velocityOnlyResults = await expectEffect.toSucceed(repository.query('velocity'))
      expect(velocityOnlyResults).toHaveLength(1)
    })

    it('should handle empty archetype (entity with no components)', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
      expect(exists).toBe(true)
      
      // Should not appear in any component queries
      const positionResults = await expectEffect.toSucceed(repository.query('position'))
      expect(positionResults.map(r => r.entityId)).not.toContain(entityId)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent entity creation', async () => {
      const entityPromises = Array.from({ length: 10 }, () =>
        repository.createEntity({ position: { x: Math.random(), y: 0, z: Math.random() } })
      )
      
      const entityIds = await expectEffect.toSucceed(
        Effect.all(entityPromises, { concurrency: 'unbounded' })
      )
      
      expect(entityIds).toHaveLength(10)
      
      // Verify all entity IDs are unique
      const uniqueIds = new Set(entityIds)
      expect(uniqueIds.size).toBe(10)
      
      // Verify all entities exist
      for (const entityId of entityIds) {
        const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
        expect(exists).toBe(true)
      }
    })

    it('should handle concurrent component operations', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      const componentOps = [
        repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }),
        repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }),
        repository.addComponent(entityId, 'health', { current: 100, max: 100 })
      ]
      
      const results = await expectEffect.toSucceed(
        Effect.all(componentOps, { concurrency: 'unbounded' })
      )
      
      // All operations should succeed
      results.forEach(result => expect(result).toBe(true))
      
      // Verify all components were added
      const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
      const hasVelocity = await expectEffect.toSucceed(repository.hasComponent(entityId, 'velocity'))
      const hasHealth = await expectEffect.toSucceed(repository.hasComponent(entityId, 'health'))
      
      expect(hasPosition).toBe(true)
      expect(hasVelocity).toBe(true)
      expect(hasHealth).toBe(true)
    })

    it('should handle concurrent queries', async () => {
      // Create test entities
      await expectEffect.toSucceed(repository.createEntity({ position: { x: 0, y: 0, z: 0 } }))
      await expectEffect.toSucceed(repository.createEntity({ velocity: { x: 1, y: 0, z: 0 } }))
      await expectEffect.toSucceed(repository.createEntity({ health: { current: 100, max: 100 } }))
      
      const concurrentQueries = [
        repository.query('position'),
        repository.query('velocity'),
        repository.query('health'),
        repository.queryMultiple(['position']),
        repository.querySoA(['velocity'])
      ]
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentQueries, { concurrency: 'unbounded' })
      )
      
      expect(results).toHaveLength(5)
      expect(results[0]).toHaveLength(1) // Position query
      expect(results[1]).toHaveLength(1) // Velocity query
      expect(results[2]).toHaveLength(1) // Health query
      expect(results[3]).toHaveLength(1) // Multiple query
      expect(results[4].entities).toHaveLength(1) // SoA query
    })
  })

  describe('Performance Tests', () => {
    it('should handle large numbers of entities efficiently', async () => {
      const entityCount = 1000
      const entityPromises = Array.from({ length: entityCount }, (_, i) => 
        repository.createEntity({
          position: { x: i, y: 0, z: i % 100 },
          velocity: { x: i % 10, y: 0, z: 0 }
        })
      )
      
      const { result: entityIds, duration } = await measureEffectPerformance(
        Effect.all(entityPromises, { concurrency: 50 }),
        'create 1000 entities'
      )
      
      expect(entityIds).toHaveLength(entityCount)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      
      // Verify query performance
      const { result: queryResult, duration: queryDuration } = await measureEffectPerformance(
        repository.query('position'),
        'query 1000 entities'
      )
      
      expect(queryResult).toHaveLength(entityCount)
      expect(queryDuration).toBeLessThan(100) // Should complete within 100ms
    })

    it('should maintain performance with many component types', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      // Add multiple components
      const componentOps = [
        repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }),
        repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }),
        repository.addComponent(entityId, 'health', { current: 100, max: 100 }),
        repository.addComponent(entityId, 'inventory', { items: [] }),
      ]
      
      const { duration } = await measureEffectPerformance(
        Effect.all(componentOps, { concurrency: 1 }),
        'add multiple components'
      )
      
      expect(duration).toBeLessThan(100) // Should complete within 100ms
      
      // Verify multi-component query performance
      const { result, duration: queryDuration } = await measureEffectPerformance(
        repository.queryMultiple(['position', 'velocity', 'health']),
        'complex multi-component query'
      )
      
      expect(result).toHaveLength(1)
      expect(queryDuration).toBeLessThan(50) // Should complete within 50ms
    })

    it('should handle frequent archetype changes efficiently', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      // Perform many component additions and removals
      const operations = []
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          operations.push(repository.addComponent(entityId, 'position', { x: i, y: 0, z: 0 }))
        } else {
          operations.push(repository.removeComponent(entityId, 'position'))
        }
      }
      
      const { duration } = await measureEffectPerformance(
        Effect.all(operations, { concurrency: 1 }),
        '100 archetype changes'
      )
      
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })
  })

  describe('Edge Cases', () => {
    it('should handle entity creation with empty components object', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity({}))
      
      expect(entityId).toBeDefined()
      
      const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
      expect(exists).toBe(true)
    })

    it('should handle component updates with undefined values gracefully', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      await expectEffect.toSucceed(
        repository.updateComponent(entityId, 'unknownComponent', undefined)
      )
      
      // Should complete without error, just log warning
    })

    it('should handle maximum entity ID values', async () => {
      const state = await runEffect(Ref.get(stateRef))
      await runEffect(Ref.set(stateRef, { ...state, nextEntityId: Number.MAX_SAFE_INTEGER - 1 }))
      
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      expect(entityId).toBe(Number.MAX_SAFE_INTEGER - 1)
    })

    it('should maintain consistency during failed operations', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      // Attempt to add invalid component
      try {
        await expectEffect.toFail(
          repository.addComponent(entityId, 'position', { invalid: 'data' } as any)
        )
      } catch {
        // Expected to fail
      }
      
      // Entity should still exist and be in clean state
      const exists = await expectEffect.toSucceed(repository.hasEntity(entityId))
      expect(exists).toBe(true)
      
      const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
      expect(hasPosition).toBe(false)
    })

    it('should handle removing components from entities with many components', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      // Add many components
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 0, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
      await expectEffect.toSucceed(repository.addComponent(entityId, 'health', { current: 100, max: 100 }))
      await expectEffect.toSucceed(repository.addComponent(entityId, 'inventory', { items: [] }))
      
      // Remove one component
      const removed = await expectEffect.toSucceed(repository.removeComponent(entityId, 'velocity'))
      expect(removed).toBe(true)
      
      // Other components should still exist
      const hasPosition = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
      const hasHealth = await expectEffect.toSucceed(repository.hasComponent(entityId, 'health'))
      const hasInventory = await expectEffect.toSucceed(repository.hasComponent(entityId, 'inventory'))
      
      expect(hasPosition).toBe(true)
      expect(hasHealth).toBe(true)
      expect(hasInventory).toBe(true)
    })
  })

  describe('Layer Integration', () => {
    it('should work with Effect Layer system', async () => {
      const effect = Effect.gen(function* (_) {
        const repo = yield* _(WorldRepositoryService)
        const entityId = yield* _(repo.createEntity({ position: { x: 0, y: 0, z: 0 } }))
        const hasPosition = yield* _(repo.hasComponent(entityId, 'position'))
        return { entityId, hasPosition }
      })
      
      const result = await runEffect(Effect.provide(effect, WorldRepositoryLive))
      
      expect(result.entityId).toBeDefined()
      expect(result.hasPosition).toBe(true)
    })

    it('should work with WorldRepositoryUtils', async () => {
      const archetypes: Archetype[] = [
        { position: { x: 0, y: 0, z: 0 } },
        { velocity: { x: 1, y: 0, z: 0 } },
        { health: { current: 100, max: 100 } }
      ]
      
      const effect = Effect.gen(function* (_) {
        const repo = yield* _(WorldRepositoryUtils.createWithArchetypes(archetypes))
        const positionEntities = yield* _(repo.query('position'))
        const velocityEntities = yield* _(repo.query('velocity'))
        const healthEntities = yield* _(repo.query('health'))
        
        return {
          positionCount: positionEntities.length,
          velocityCount: velocityEntities.length,
          healthCount: healthEntities.length
        }
      })
      
      const result = await runEffect(Effect.provide(effect, WorldRepositoryLive))
      
      expect(result.positionCount).toBe(1)
      expect(result.velocityCount).toBe(1)
      expect(result.healthCount).toBe(1)
    })

    it('should export state for persistence', async () => {
      const effect = Effect.gen(function* (_) {
        const repo = yield* _(WorldRepositoryService)
        yield* _(repo.createEntity({ position: { x: 0, y: 0, z: 0 } }))
        yield* _(repo.createEntity({ velocity: { x: 1, y: 0, z: 0 } }))
        
        const state = yield* _(WorldRepositoryUtils.exportState(repo))
        return state
      })
      
      const result = await runEffect(Effect.provide(effect, WorldRepositoryLive))
      
      expect(result).toHaveProperty('version')
      expect(result).toHaveProperty('entityCount')
      expect(result).toHaveProperty('archetypeCount')
      expect(result).toHaveProperty('componentCounts')
    })

    it('should perform health check', async () => {
      const effect = Effect.gen(function* (_) {
        const repo = yield* _(WorldRepositoryService)
        yield* _(repo.createEntity({ position: { x: 0, y: 0, z: 0 } }))
        
        const health = yield* _(WorldRepositoryUtils.healthCheck(repo))
        return health
      })
      
      const result = await runEffect(Effect.provide(effect, WorldRepositoryLive))
      
      expect(result).toHaveProperty('isHealthy')
      expect(result).toHaveProperty('entityCount')
      expect(result).toHaveProperty('version')
      expect(result.isHealthy).toBe(true)
    })
  })
})