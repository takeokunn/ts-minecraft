/**
 * Entity Repository Tests - Comprehensive test suite for entity repository implementation
 *
 * This test suite covers all CRUD operations, error conditions, concurrent operations,
 * and edge cases to achieve 100% coverage of the entity repository.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Option from 'effect/Option'

import { 
  createEntityRepository,
  type IEntityRepository,
  type EntityRepositoryState,
  type EntityMetadata,
  type EntityQueryOptions,
  type EntityChange,
  EntityRepositoryLive
} from '@infrastructure/repositories/entity.repository'
import { EntityId, toEntityId } from '@domain/entities'
import { type ComponentName, type Components, componentNamesSet } from '@domain/entities/components'
import { Archetype } from '@domain/archetypes'
import { expectEffect, runEffect, measureEffectPerformance } from '../../../setup/infrastructure.setup'

describe('EntityRepository', () => {
  let repository: IEntityRepository
  let stateRef: Ref.Ref<EntityRepositoryState>

  const createTestState = (): EntityRepositoryState => ({
    nextEntityId: 0,
    entityMetadata: HashMap.empty(),
    componentStorage: Object.fromEntries(
      Array.from(componentNamesSet).map((name) => [name, HashMap.empty()])
    ) as Record<ComponentName, HashMap.HashMap<EntityId, any>>,
    archetypeToEntities: HashMap.empty(),
    changes: [],
    maxChangeHistory: 100,
  })

  beforeEach(async () => {
    const initialState = createTestState()
    stateRef = await runEffect(Ref.make(initialState))
    repository = createEntityRepository(stateRef)
  })

  describe('Entity Lifecycle', () => {
    describe('createEntity', () => {
      it('should create entity without archetype', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        
        expect(entityId).toBeDefined()
        expect(typeof entityId).toBe('number')
        expect(entityId).toBeGreaterThanOrEqual(0)
      })

      it('should create entity with archetype', async () => {
        const archetype: Archetype = {
          position: { x: 10, y: 20, z: 30 },
          velocity: { x: 1, y: 0, z: 0 }
        }

        const entityId = await expectEffect.toSucceed(repository.createEntity(archetype))
        
        expect(entityId).toBeDefined()
        
        // Verify entity has components
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

      it('should record entity creation in change history', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        const changes = await expectEffect.toSucceed(repository.getEntityChanges(entityId))
        
        expect(changes).toHaveLength(1)
        expect(changes[0].changeType).toBe('created')
        expect(changes[0].entityId).toBe(entityId)
      })

      it('should handle invalid archetype gracefully', async () => {
        const invalidArchetype = {
          invalidComponent: { invalid: 'data' }
        } as Archetype

        const entityId = await expectEffect.toSucceed(repository.createEntity(invalidArchetype))
        expect(entityId).toBeDefined()
        
        // Should still create entity, just without invalid components
        const exists = await expectEffect.toSucceed(repository.entityExists(entityId))
        expect(exists).toBe(true)
      })
    })

    describe('destroyEntity', () => {
      it('should destroy existing entity', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        const destroyed = await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        expect(destroyed).toBe(true)
        
        const exists = await expectEffect.toSucceed(repository.entityExists(entityId))
        expect(exists).toBe(false)
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const destroyed = await expectEffect.toSucceed(repository.destroyEntity(nonExistentId))
        
        expect(destroyed).toBe(false)
      })

      it('should remove all components when destroying entity', async () => {
        const archetype: Archetype = {
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 1, y: 1, z: 1 },
          health: { current: 100, max: 100 }
        }
        
        const entityId = await expectEffect.toSucceed(repository.createEntity(archetype))
        await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        const position = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
        const velocity = await expectEffect.toSucceed(repository.getComponent(entityId, 'velocity'))
        const health = await expectEffect.toSucceed(repository.getComponent(entityId, 'health'))
        
        expect(Option.isNone(position)).toBe(true)
        expect(Option.isNone(velocity)).toBe(true)
        expect(Option.isNone(health)).toBe(true)
      })

      it('should record entity destruction in change history', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        const changes = await expectEffect.toSucceed(repository.getEntityChanges(entityId))
        
        expect(changes).toHaveLength(2) // creation + destruction
        expect(changes[1].changeType).toBe('destroyed')
        expect(changes[1].entityId).toBe(entityId)
      })
    })

    describe('entityExists', () => {
      it('should return true for existing entity', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        const exists = await expectEffect.toSucceed(repository.entityExists(entityId))
        
        expect(exists).toBe(true)
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const exists = await expectEffect.toSucceed(repository.entityExists(nonExistentId))
        
        expect(exists).toBe(false)
      })

      it('should return false for destroyed entity', async () => {
        const entityId = await expectEffect.toSucceed(repository.createEntity())
        await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        const exists = await expectEffect.toSucceed(repository.entityExists(entityId))
        expect(exists).toBe(false)
      })
    })

    describe('getEntityMetadata', () => {
      it('should return metadata for existing entity', async () => {
        const archetype: Archetype = {
          position: { x: 10, y: 20, z: 30 }
        }
        
        const entityId = await expectEffect.toSucceed(repository.createEntity(archetype))
        const metadataOpt = await expectEffect.toSucceed(repository.getEntityMetadata(entityId))
        
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.id).toBe(entityId)
          expect(metadata.componentTypes.has('position')).toBe(true)
          expect(metadata.generation).toBe(0)
          expect(metadata.createdAt).toBeGreaterThan(0)
          expect(metadata.updatedAt).toBe(metadata.createdAt)
        }
      })

      it('should return None for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const metadataOpt = await expectEffect.toSucceed(repository.getEntityMetadata(nonExistentId))
        
        expect(Option.isNone(metadataOpt)).toBe(true)
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
        
        const addedAgain = await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        expect(addedAgain).toBe(false)
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const position = { x: 10, y: 20, z: 30 }
        
        const added = await expectEffect.toSucceed(repository.addComponent(nonExistentId, 'position', position))
        expect(added).toBe(false)
      })

      it('should update entity metadata when adding component', async () => {
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        
        const metadataOpt = await expectEffect.toSucceed(repository.getEntityMetadata(entityId))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.componentTypes.has('position')).toBe(true)
          expect(metadata.generation).toBe(1) // Incremented
          expect(metadata.updatedAt).toBeGreaterThan(metadata.createdAt)
        }
      })

      it('should record component addition in change history', async () => {
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        
        const changes = await expectEffect.toSucceed(repository.getEntityChanges(entityId))
        
        expect(changes).toHaveLength(2) // creation + component addition
        expect(changes[1].changeType).toBe('updated')
        expect(changes[1].componentName).toBe('position')
        expect(changes[1].newValue).toEqual(position)
      })
    })

    describe('removeComponent', () => {
      beforeEach(async () => {
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
      })

      it('should remove component from entity', async () => {
        const removed = await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        expect(removed).toBe(true)
        
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasComponent).toBe(false)
      })

      it('should return false when removing non-existent component', async () => {
        const removed = await expectEffect.toSucceed(repository.removeComponent(entityId, 'velocity'))
        expect(removed).toBe(false)
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const removed = await expectEffect.toSucceed(repository.removeComponent(nonExistentId, 'position'))
        
        expect(removed).toBe(false)
      })

      it('should update entity metadata when removing component', async () => {
        await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        const metadataOpt = await expectEffect.toSucceed(repository.getEntityMetadata(entityId))
        expect(Option.isSome(metadataOpt)).toBe(true)
        
        if (Option.isSome(metadataOpt)) {
          const metadata = metadataOpt.value
          expect(metadata.componentTypes.has('position')).toBe(false)
          expect(metadata.generation).toBe(2) // Incremented twice (add + remove)
        }
      })

      it('should record component removal in change history', async () => {
        const originalPosition = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.removeComponent(entityId, 'position'))
        
        const changes = await expectEffect.toSucceed(repository.getEntityChanges(entityId))
        
        expect(changes).toHaveLength(3) // creation + add + remove
        expect(changes[2].changeType).toBe('updated')
        expect(changes[2].componentName).toBe('position')
        expect(changes[2].previousValue).toEqual(originalPosition)
        expect(changes[2].newValue).toBeUndefined()
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

      it('should return None for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(nonExistentId, 'position'))
        
        expect(Option.isNone(componentOpt)).toBe(true)
      })
    })

    describe('hasComponent', () => {
      it('should return true for existing component', async () => {
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
        
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
        expect(hasComponent).toBe(true)
      })

      it('should return false for non-existent component', async () => {
        const hasComponent = await expectEffect.toSucceed(repository.hasComponent(entityId, 'position'))
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
        const position = { x: 10, y: 20, z: 30 }
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', position))
      })

      it('should update existing component', async () => {
        const updater = (pos: any) => ({ ...pos, x: pos.x + 5 })
        const updated = await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', updater))
        
        expect(updated).toBe(true)
        
        const componentOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
        expect(Option.isSome(componentOpt)).toBe(true)
        
        if (Option.isSome(componentOpt)) {
          expect(componentOpt.value.x).toBe(15)
          expect(componentOpt.value.y).toBe(20)
          expect(componentOpt.value.z).toBe(30)
        }
      })

      it('should return false for non-existent component', async () => {
        const updater = (vel: any) => vel
        const updated = await expectEffect.toSucceed(
          repository.updateComponent(entityId, 'velocity', updater).pipe(
            Effect.catchAll(() => Effect.succeed(false))
          )
        )
        
        expect(updated).toBe(false)
      })

      it('should fail with validation error for invalid component data', async () => {
        const badUpdater = () => ({ invalid: 'data' })
        
        await expectEffect.toFail(
          repository.updateComponent(entityId, 'position', badUpdater)
        )
      })

      it('should record component update in change history', async () => {
        const updater = (pos: any) => ({ ...pos, x: pos.x + 5 })
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', updater))
        
        const changes = await expectEffect.toSucceed(repository.getEntityChanges(entityId))
        
        expect(changes).toHaveLength(3) // creation + add + update
        expect(changes[2].changeType).toBe('updated')
        expect(changes[2].componentName).toBe('position')
        expect(changes[2].previousValue).toEqual({ x: 10, y: 20, z: 30 })
        expect(changes[2].newValue).toEqual({ x: 15, y: 20, z: 30 })
      })
    })
  })

  describe('Bulk Operations', () => {
    describe('createEntities', () => {
      it('should create multiple entities with archetypes', async () => {
        const archetypes = [
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: 10, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } },
          { health: { current: 100, max: 100 } }
        ] as Archetype[]
        
        const entityIds = await expectEffect.toSucceed(repository.createEntities(archetypes))
        
        expect(entityIds).toHaveLength(3)
        expect(entityIds[0]).toBe(0)
        expect(entityIds[1]).toBe(1)
        expect(entityIds[2]).toBe(2)
        
        // Verify components were added correctly
        const hasPos1 = await expectEffect.toSucceed(repository.hasComponent(entityIds[0], 'position'))
        const hasVel2 = await expectEffect.toSucceed(repository.hasComponent(entityIds[1], 'velocity'))
        const hasHealth3 = await expectEffect.toSucceed(repository.hasComponent(entityIds[2], 'health'))
        
        expect(hasPos1).toBe(true)
        expect(hasVel2).toBe(true)
        expect(hasHealth3).toBe(true)
      })

      it('should handle empty archetypes array', async () => {
        const entityIds = await expectEffect.toSucceed(repository.createEntities([]))
        expect(entityIds).toHaveLength(0)
      })
    })

    describe('destroyEntities', () => {
      it('should destroy multiple entities', async () => {
        const entity1 = await expectEffect.toSucceed(repository.createEntity())
        const entity2 = await expectEffect.toSucceed(repository.createEntity())
        const entity3 = await expectEffect.toSucceed(repository.createEntity())
        
        const destroyedCount = await expectEffect.toSucceed(
          repository.destroyEntities([entity1, entity2, entity3])
        )
        
        expect(destroyedCount).toBe(3)
        
        const exists1 = await expectEffect.toSucceed(repository.entityExists(entity1))
        const exists2 = await expectEffect.toSucceed(repository.entityExists(entity2))
        const exists3 = await expectEffect.toSucceed(repository.entityExists(entity3))
        
        expect(exists1).toBe(false)
        expect(exists2).toBe(false)
        expect(exists3).toBe(false)
      })

      it('should handle mix of existing and non-existent entities', async () => {
        const existingEntity = await expectEffect.toSucceed(repository.createEntity())
        const nonExistentEntity = toEntityId(9999)
        
        const destroyedCount = await expectEffect.toSucceed(
          repository.destroyEntities([existingEntity, nonExistentEntity])
        )
        
        expect(destroyedCount).toBe(1)
      })
    })

    describe('cloneEntity', () => {
      it('should clone entity with all components', async () => {
        const archetype: Archetype = {
          position: { x: 10, y: 20, z: 30 },
          velocity: { x: 1, y: 2, z: 3 },
          health: { current: 80, max: 100 }
        }
        
        const originalId = await expectEffect.toSucceed(repository.createEntity(archetype))
        const clonedIdOpt = await expectEffect.toSucceed(repository.cloneEntity(originalId))
        
        expect(Option.isSome(clonedIdOpt)).toBe(true)
        
        if (Option.isSome(clonedIdOpt)) {
          const clonedId = clonedIdOpt.value
          
          // Verify cloned entity has all components
          const hasPosition = await expectEffect.toSucceed(repository.hasComponent(clonedId, 'position'))
          const hasVelocity = await expectEffect.toSucceed(repository.hasComponent(clonedId, 'velocity'))
          const hasHealth = await expectEffect.toSucceed(repository.hasComponent(clonedId, 'health'))
          
          expect(hasPosition).toBe(true)
          expect(hasVelocity).toBe(true)
          expect(hasHealth).toBe(true)
          
          // Verify component values match
          const positionOpt = await expectEffect.toSucceed(repository.getComponent(clonedId, 'position'))
          expect(Option.isSome(positionOpt)).toBe(true)
          if (Option.isSome(positionOpt)) {
            expect(positionOpt.value).toEqual({ x: 10, y: 20, z: 30 })
          }
        }
      })

      it('should return None for non-existent entity', async () => {
        const nonExistentId = toEntityId(9999)
        const clonedIdOpt = await expectEffect.toSucceed(repository.cloneEntity(nonExistentId))
        
        expect(Option.isNone(clonedIdOpt)).toBe(true)
      })
    })
  })

  describe('Query Operations', () => {
    let entities: EntityId[]

    beforeEach(async () => {
      // Create test entities with different component combinations
      const archetypes = [
        { position: { x: 0, y: 0, z: 0 } }, // Entity 0: position only
        { position: { x: 10, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } }, // Entity 1: position + velocity
        { velocity: { x: 2, y: 0, z: 0 }, health: { current: 100, max: 100 } }, // Entity 2: velocity + health
        { position: { x: 20, y: 0, z: 0 }, health: { current: 50, max: 100 } }, // Entity 3: position + health
      ] as Archetype[]
      
      entities = await expectEffect.toSucceed(repository.createEntities(archetypes))
    })

    describe('findEntitiesByComponents', () => {
      it('should find entities with single component', async () => {
        const positionEntities = await expectEffect.toSucceed(
          repository.findEntitiesByComponents(['position'])
        )
        
        expect(positionEntities).toHaveLength(3) // Entities 0, 1, 3
        
        const entityIds = positionEntities.map(e => e.id)
        expect(entityIds).toContain(entities[0])
        expect(entityIds).toContain(entities[1])
        expect(entityIds).toContain(entities[3])
        expect(entityIds).not.toContain(entities[2])
      })

      it('should find entities with multiple components', async () => {
        const positionVelocityEntities = await expectEffect.toSucceed(
          repository.findEntitiesByComponents(['position', 'velocity'])
        )
        
        expect(positionVelocityEntities).toHaveLength(1) // Only entity 1
        expect(positionVelocityEntities[0].id).toBe(entities[1])
      })

      it('should exclude entities with specified components', async () => {
        const options: EntityQueryOptions = {
          excludeComponents: ['health']
        }
        
        const entitiesWithoutHealth = await expectEffect.toSucceed(
          repository.findEntitiesByComponents(['position'], options)
        )
        
        expect(entitiesWithoutHealth).toHaveLength(2) // Entities 0, 1 (not 3)
        const entityIds = entitiesWithoutHealth.map(e => e.id)
        expect(entityIds).toContain(entities[0])
        expect(entityIds).toContain(entities[1])
        expect(entityIds).not.toContain(entities[3])
      })

      it('should apply limit and offset', async () => {
        const options: EntityQueryOptions = {
          limit: 2,
          offset: 1
        }
        
        const limitedEntities = await expectEffect.toSucceed(
          repository.findEntitiesByComponents(['position'], options)
        )
        
        expect(limitedEntities).toHaveLength(2)
      })

      it('should sort entities by creation time', async () => {
        const options: EntityQueryOptions = {
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }
        
        const sortedEntities = await expectEffect.toSucceed(
          repository.findEntitiesByComponents(['position'], options)
        )
        
        expect(sortedEntities).toHaveLength(3)
        expect(sortedEntities[0].createdAt >= sortedEntities[1].createdAt).toBe(true)
      })
    })

    describe('countEntities', () => {
      it('should count all entities when no components specified', async () => {
        const count = await expectEffect.toSucceed(repository.countEntities())
        expect(count).toBe(4)
      })

      it('should count entities with specific components', async () => {
        const positionCount = await expectEffect.toSucceed(
          repository.countEntities(['position'])
        )
        expect(positionCount).toBe(3)
        
        const velocityCount = await expectEffect.toSucceed(
          repository.countEntities(['velocity'])
        )
        expect(velocityCount).toBe(2)
      })
    })
  })

  describe('Change Tracking', () => {
    let entityId: EntityId

    beforeEach(async () => {
      entityId = await expectEffect.toSucceed(repository.createEntity())
    })

    describe('getEntityChanges', () => {
      it('should return all changes when no filters specified', async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', (pos: any) => ({ ...pos, x: 15 })))
        
        const changes = await expectEffect.toSucceed(repository.getEntityChanges())
        expect(changes).toHaveLength(3) // create + add + update
      })

      it('should filter changes by entity ID', async () => {
        const otherEntityId = await expectEffect.toSucceed(repository.createEntity())
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        
        const entityChanges = await expectEffect.toSucceed(repository.getEntityChanges(entityId))
        expect(entityChanges).toHaveLength(2) // create + add for specific entity
        
        entityChanges.forEach(change => {
          expect(change.entityId).toBe(entityId)
        })
      })

      it('should filter changes by timestamp', async () => {
        const beforeTime = Date.now()
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        
        const recentChanges = await expectEffect.toSucceed(repository.getEntityChanges(undefined, beforeTime))
        expect(recentChanges).toHaveLength(1) // Only the add component change
      })
    })

    describe('clearChangeHistory', () => {
      beforeEach(async () => {
        await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
        await expectEffect.toSucceed(repository.updateComponent(entityId, 'position', (pos: any) => ({ ...pos, x: 15 })))
      })

      it('should clear all changes when no timestamp specified', async () => {
        const clearedCount = await expectEffect.toSucceed(repository.clearChangeHistory())
        expect(clearedCount).toBe(3) // All changes cleared
        
        const remainingChanges = await expectEffect.toSucceed(repository.getEntityChanges())
        expect(remainingChanges).toHaveLength(0)
      })

      it('should clear changes before specified timestamp', async () => {
        const cutoffTime = Date.now()
        await expectEffect.toSucceed(repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }))
        
        const clearedCount = await expectEffect.toSucceed(repository.clearChangeHistory(cutoffTime))
        expect(clearedCount).toBe(3) // Changes before cutoff
        
        const remainingChanges = await expectEffect.toSucceed(repository.getEntityChanges())
        expect(remainingChanges).toHaveLength(1) // Only the velocity addition remains
      })
    })
  })

  describe('Statistics and Maintenance', () => {
    beforeEach(async () => {
      // Create test data for statistics
      const archetypes = [
        { position: { x: 0, y: 0, z: 0 } },
        { position: { x: 10, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } },
        { health: { current: 100, max: 100 } }
      ] as Archetype[]
      
      await expectEffect.toSucceed(repository.createEntities(archetypes))
    })

    describe('getRepositoryStats', () => {
      it('should return comprehensive repository statistics', async () => {
        const stats = await expectEffect.toSucceed(repository.getRepositoryStats())
        
        expect(stats.entityCount).toBe(3)
        expect(stats.componentCounts.position).toBe(2)
        expect(stats.componentCounts.velocity).toBe(1)
        expect(stats.componentCounts.health).toBe(1)
        expect(stats.changeCount).toBeGreaterThan(0)
        expect(stats.memoryUsage).toBeGreaterThan(0)
        expect(Object.keys(stats.archetypeCounts).length).toBeGreaterThan(0)
      })
    })

    describe('compactStorage', () => {
      it('should compact storage by removing empty archetype entries', async () => {
        // Create and destroy entities to create empty archetype entries
        const entityId = await expectEffect.toSucceed(repository.createEntity({ position: { x: 0, y: 0, z: 0 } }))
        await expectEffect.toSucceed(repository.destroyEntity(entityId))
        
        await expectEffect.toSucceed(repository.compactStorage())
        
        // Verify operation completes successfully
        const stats = await expectEffect.toSucceed(repository.getRepositoryStats())
        expect(stats).toBeDefined()
      })
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent entity creation', async () => {
      const concurrentCreations = Array.from({ length: 10 }, () =>
        repository.createEntity({ position: { x: Math.random(), y: 0, z: Math.random() } })
      )
      
      const entityIds = await expectEffect.toSucceed(
        Effect.all(concurrentCreations, { concurrency: 'unbounded' })
      )
      
      expect(entityIds).toHaveLength(10)
      
      // Verify all entity IDs are unique
      const uniqueIds = new Set(entityIds)
      expect(uniqueIds.size).toBe(10)
      
      // Verify all entities exist
      const existenceChecks = entityIds.map(id => repository.entityExists(id))
      const existenceResults = await expectEffect.toSucceed(
        Effect.all(existenceChecks, { concurrency: 'unbounded' })
      )
      
      existenceResults.forEach(exists => {
        expect(exists).toBe(true)
      })
    })

    it('should handle concurrent component operations', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      const concurrentOperations = [
        repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }),
        repository.addComponent(entityId, 'velocity', { x: 1, y: 0, z: 0 }),
        repository.addComponent(entityId, 'health', { current: 100, max: 100 })
      ]
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentOperations, { concurrency: 'unbounded' })
      )
      
      // All operations should succeed
      results.forEach(result => {
        expect(result).toBe(true)
      })
      
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
      await expectEffect.toSucceed(repository.createEntities([
        { position: { x: 0, y: 0, z: 0 } },
        { velocity: { x: 1, y: 0, z: 0 } },
        { health: { current: 100, max: 100 } }
      ] as Archetype[]))
      
      const concurrentQueries = [
        repository.findEntitiesByComponents(['position']),
        repository.findEntitiesByComponents(['velocity']),
        repository.findEntitiesByComponents(['health']),
        repository.countEntities(),
        repository.getRepositoryStats()
      ]
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentQueries, { concurrency: 'unbounded' })
      )
      
      expect(results).toHaveLength(5)
      expect(results[0]).toHaveLength(1) // Position entities
      expect(results[1]).toHaveLength(1) // Velocity entities
      expect(results[2]).toHaveLength(1) // Health entities
      expect(results[3]).toBe(3) // Total entity count
      expect(results[4]).toBeDefined() // Repository stats
    })
  })

  describe('Performance Tests', () => {
    it('should handle large numbers of entities efficiently', async () => {
      const startTime = performance.now()
      
      // Create 1000 entities
      const archetypes = Array.from({ length: 1000 }, (_, i) => ({
        position: { x: i, y: 0, z: i },
        velocity: { x: i % 10, y: 0, z: 0 }
      })) as Archetype[]
      
      const { result: entityIds, duration } = await measureEffectPerformance(
        repository.createEntities(archetypes),
        'create 1000 entities'
      )
      
      expect(entityIds).toHaveLength(1000)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      
      // Verify query performance
      const { result: queryResult, duration: queryDuration } = await measureEffectPerformance(
        repository.findEntitiesByComponents(['position']),
        'query 1000 entities by component'
      )
      
      expect(queryResult).toHaveLength(1000)
      expect(queryDuration).toBeLessThan(100) // Should complete within 100ms
    })

    it('should maintain consistent performance with change history', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      // Perform many updates to test change history performance
      const updates = Array.from({ length: 100 }, (_, i) => 
        repository.updateComponent(entityId, 'position', (pos: any) => ({ 
          x: i, y: pos?.y ?? 0, z: pos?.z ?? 0 
        })).pipe(
          Effect.catchAll(() => 
            repository.addComponent(entityId, 'position', { x: i, y: 0, z: 0 })
          )
        )
      )
      
      const { duration } = await measureEffectPerformance(
        Effect.all(updates, { concurrency: 1 }),
        '100 component updates'
      )
      
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      
      // Verify change history was maintained efficiently
      const changes = await expectEffect.toSucceed(repository.getEntityChanges(entityId))
      expect(changes.length).toBeGreaterThan(0)
      expect(changes.length).toBeLessThanOrEqual(100) // Respects maxChangeHistory
    })
  })

  describe('Edge Cases', () => {
    it('should handle entity creation with empty archetype', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity({}))
      
      expect(entityId).toBeDefined()
      
      const metadata = await expectEffect.toSucceed(repository.getEntityMetadata(entityId))
      expect(Option.isSome(metadata)).toBe(true)
      
      if (Option.isSome(metadata)) {
        expect(metadata.value.componentTypes.size).toBe(0)
      }
    })

    it('should handle maximum entity ID overflow gracefully', async () => {
      // Set entity ID to near maximum value
      const state = await runEffect(Ref.get(stateRef))
      await runEffect(Ref.set(stateRef, { ...state, nextEntityId: Number.MAX_SAFE_INTEGER - 1 }))
      
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      expect(entityId).toBe(Number.MAX_SAFE_INTEGER - 1)
    })

    it('should handle component schema validation failures', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      // Attempt to add invalid component data
      const invalidPosition = { invalid: 'data', missing: 'required fields' }
      
      await expectEffect.toFail(
        repository.addComponent(entityId, 'position', invalidPosition as any)
          .pipe(Effect.catchAll(() => Effect.fail('Expected validation error')))
      )
    })

    it('should maintain consistency when operations fail', async () => {
      const entityId = await expectEffect.toSucceed(repository.createEntity())
      
      // Add a valid component first
      await expectEffect.toSucceed(repository.addComponent(entityId, 'position', { x: 10, y: 20, z: 30 }))
      
      // Attempt invalid update that should fail
      const invalidUpdate = () => ({ completely: 'invalid' })
      
      await expectEffect.toFail(
        repository.updateComponent(entityId, 'position', invalidUpdate as any)
      )
      
      // Verify original component is unchanged
      const componentOpt = await expectEffect.toSucceed(repository.getComponent(entityId, 'position'))
      expect(Option.isSome(componentOpt)).toBe(true)
      
      if (Option.isSome(componentOpt)) {
        expect(componentOpt.value).toEqual({ x: 10, y: 20, z: 30 })
      }
    })
  })

  describe('Effect Layer Integration', () => {
    it('should work with Effect Layer system', async () => {
      const effect = Effect.gen(function* (_) {
        const repo = yield* _(createEntityRepository)
        const entityId = yield* _(repo.createEntity({ position: { x: 0, y: 0, z: 0 } }))
        const exists = yield* _(repo.entityExists(entityId))
        return { entityId, exists }
      })
      
      const result = await runEffect(Effect.provide(effect, EntityRepositoryLive))
      
      expect(result.entityId).toBeDefined()
      expect(result.exists).toBe(true)
    })
  })
})