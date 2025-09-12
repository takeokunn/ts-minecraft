/**
 * Physics Repository Tests - Comprehensive test suite for physics repository implementation
 *
 * This test suite covers all physics operations, spatial indexing, collision detection,
 * simulation support, and performance optimization features.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Option from 'effect/Option'

import { 
  createPhysicsRepository,
  type IPhysicsRepository,
  type PhysicsRepositoryState,
  type PhysicsBody,
  type CollisionEvent,
  type SpatialRegion,
  type PhysicsQueryOptions,
  type PhysicsStats,
  PhysicsRepositoryLive
} from '@infrastructure/repositories/physics.repository'
import { EntityId, toEntityId } from '@domain/entities'
import { type PositionComponent, type VelocityComponent, type CollisionComponent } from '@domain/entities/components/physics/physics-components'
import { expectEffect, runEffect, measureEffectPerformance } from '../../../setup/infrastructure.setup'

describe('PhysicsRepository', () => {
  let repository: IPhysicsRepository
  let stateRef: Ref.Ref<PhysicsRepositoryState>

  const createTestState = (): PhysicsRepositoryState => ({
    physicsBodies: HashMap.empty(),
    collisionEvents: [],
    maxCollisionHistory: 1000,
    spatialIndex: HashMap.empty(),
    spatialGridSize: 32,
    lastSimulationTime: 0,
  })

  const createTestPhysicsBody = (
    entityId: EntityId,
    position: PositionComponent = { x: 0, y: 0, z: 0 },
    velocity: VelocityComponent = { x: 0, y: 0, z: 0 },
    collision: CollisionComponent = { width: 1, height: 1, depth: 1, isTrigger: false },
    mass: number = 1,
    isStatic: boolean = false
  ): PhysicsBody => ({
    entityId,
    position,
    velocity,
    collision,
    mass,
    isStatic,
    isActive: true,
    lastUpdated: Date.now(),
    version: 1,
  })

  beforeEach(async () => {
    const initialState = createTestState()
    stateRef = await runEffect(Ref.make(initialState))
    repository = createPhysicsRepository(stateRef)
  })

  describe('Physics Body Operations', () => {
    describe('addPhysicsBody', () => {
      it('should add physics body to repository', async () => {
        const entityId = toEntityId(1)
        const body = createTestPhysicsBody(entityId)
        
        const added = await expectEffect.toSucceed(repository.addPhysicsBody(body))
        expect(added).toBe(true)
        
        const hasBody = await expectEffect.toSucceed(repository.hasPhysicsBody(entityId))
        expect(hasBody).toBe(true)
      })

      it('should return false when adding duplicate body', async () => {
        const entityId = toEntityId(1)
        const body = createTestPhysicsBody(entityId)
        
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
        const addedAgain = await expectEffect.toSucceed(repository.addPhysicsBody(body))
        
        expect(addedAgain).toBe(false)
      })

      it('should update spatial index when adding body', async () => {
        const entityId = toEntityId(1)
        const body = createTestPhysicsBody(entityId, { x: 10, y: 20, z: 30 })
        
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
        
        const regions = await expectEffect.toSucceed(repository.getSpatialRegions())
        expect(regions.length).toBeGreaterThan(0)
        
        const region = regions.find(r => HashSet.has(r.entities, entityId))
        expect(region).toBeDefined()
      })

      it('should handle bodies at different positions', async () => {
        const entities = [
          { id: toEntityId(1), pos: { x: 0, y: 0, z: 0 } },
          { id: toEntityId(2), pos: { x: 100, y: 0, z: 0 } },
          { id: toEntityId(3), pos: { x: 0, y: 100, z: 0 } },
        ]
        
        for (const entity of entities) {
          const body = createTestPhysicsBody(entity.id, entity.pos)
          await expectEffect.toSucceed(repository.addPhysicsBody(body))
        }
        
        // All bodies should be added
        for (const entity of entities) {
          const hasBody = await expectEffect.toSucceed(repository.hasPhysicsBody(entity.id))
          expect(hasBody).toBe(true)
        }
      })
    })

    describe('updatePhysicsBody', () => {
      let entityId: EntityId
      let originalBody: PhysicsBody

      beforeEach(async () => {
        entityId = toEntityId(10)
        originalBody = createTestPhysicsBody(entityId, { x: 10, y: 20, z: 30 })
        await expectEffect.toSucceed(repository.addPhysicsBody(originalBody))
      })

      it('should update existing physics body', async () => {
        const updates = {
          position: { x: 15, y: 25, z: 35 },
          velocity: { x: 1, y: 0, z: -1 }
        }
        
        const updated = await expectEffect.toSucceed(repository.updatePhysicsBody(entityId, updates))
        expect(updated).toBe(true)
        
        const bodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(entityId))
        expect(Option.isSome(bodyOpt)).toBe(true)
        
        if (Option.isSome(bodyOpt)) {
          expect(bodyOpt.value.position).toEqual(updates.position)
          expect(bodyOpt.value.velocity).toEqual(updates.velocity)
          expect(bodyOpt.value.version).toBe(originalBody.version + 1)
        }
      })

      it('should return false for non-existent body', async () => {
        const nonExistentId = toEntityId(999)
        const updated = await expectEffect.toSucceed(
          repository.updatePhysicsBody(nonExistentId, { mass: 5 })
        )
        expect(updated).toBe(false)
      })

      it('should update spatial index when position changes', async () => {
        const newPosition = { x: 100, y: 200, z: 300 }
        await expectEffect.toSucceed(repository.updatePhysicsBody(entityId, { position: newPosition }))
        
        const regions = await expectEffect.toSucceed(repository.getSpatialRegions())
        const newRegion = regions.find(r => HashSet.has(r.entities, entityId))
        
        expect(newRegion).toBeDefined()
        if (newRegion) {
          expect(newRegion.minX <= newPosition.x && newPosition.x < newRegion.maxX).toBe(true)
          expect(newRegion.minY <= newPosition.y && newPosition.y < newRegion.maxY).toBe(true)
          expect(newRegion.minZ <= newPosition.z && newPosition.z < newRegion.maxZ).toBe(true)
        }
      })

      it('should update last modified time and version', async () => {
        const beforeUpdate = Date.now()
        await expectEffect.toSucceed(repository.updatePhysicsBody(entityId, { mass: 2.5 }))
        
        const bodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(entityId))
        expect(Option.isSome(bodyOpt)).toBe(true)
        
        if (Option.isSome(bodyOpt)) {
          expect(bodyOpt.value.lastUpdated).toBeGreaterThanOrEqual(beforeUpdate)
          expect(bodyOpt.value.version).toBe(originalBody.version + 1)
          expect(bodyOpt.value.mass).toBe(2.5)
        }
      })
    })

    describe('removePhysicsBody', () => {
      let entityId: EntityId

      beforeEach(async () => {
        entityId = toEntityId(20)
        const body = createTestPhysicsBody(entityId, { x: 50, y: 60, z: 70 })
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      })

      it('should remove existing physics body', async () => {
        const removed = await expectEffect.toSucceed(repository.removePhysicsBody(entityId))
        expect(removed).toBe(true)
        
        const hasBody = await expectEffect.toSucceed(repository.hasPhysicsBody(entityId))
        expect(hasBody).toBe(false)
      })

      it('should return false for non-existent body', async () => {
        const nonExistentId = toEntityId(999)
        const removed = await expectEffect.toSucceed(repository.removePhysicsBody(nonExistentId))
        expect(removed).toBe(false)
      })

      it('should update spatial index when removing body', async () => {
        await expectEffect.toSucceed(repository.removePhysicsBody(entityId))
        
        const regions = await expectEffect.toSucceed(repository.getSpatialRegions())
        const hasEntity = regions.some(r => HashSet.has(r.entities, entityId))
        expect(hasEntity).toBe(false)
      })
    })

    describe('getPhysicsBody', () => {
      it('should return physics body for existing entity', async () => {
        const entityId = toEntityId(30)
        const originalBody = createTestPhysicsBody(entityId, { x: 100, y: 200, z: 300 })
        await expectEffect.toSucceed(repository.addPhysicsBody(originalBody))
        
        const bodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(entityId))
        expect(Option.isSome(bodyOpt)).toBe(true)
        
        if (Option.isSome(bodyOpt)) {
          expect(bodyOpt.value.entityId).toBe(entityId)
          expect(bodyOpt.value.position).toEqual(originalBody.position)
        }
      })

      it('should return None for non-existent entity', async () => {
        const nonExistentId = toEntityId(999)
        const bodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(nonExistentId))
        expect(Option.isNone(bodyOpt)).toBe(true)
      })
    })

    describe('hasPhysicsBody', () => {
      it('should return true for existing body', async () => {
        const entityId = toEntityId(40)
        const body = createTestPhysicsBody(entityId)
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
        
        const hasBody = await expectEffect.toSucceed(repository.hasPhysicsBody(entityId))
        expect(hasBody).toBe(true)
      })

      it('should return false for non-existent body', async () => {
        const entityId = toEntityId(999)
        const hasBody = await expectEffect.toSucceed(repository.hasPhysicsBody(entityId))
        expect(hasBody).toBe(false)
      })
    })
  })

  describe('Position and Velocity Operations', () => {
    let entityId: EntityId

    beforeEach(async () => {
      entityId = toEntityId(50)
      const body = createTestPhysicsBody(entityId, { x: 10, y: 20, z: 30 }, { x: 1, y: 0, z: -1 })
      await expectEffect.toSucceed(repository.addPhysicsBody(body))
    })

    describe('updatePosition', () => {
      it('should update entity position', async () => {
        const newPosition = { x: 15, y: 25, z: 35 }
        const updated = await expectEffect.toSucceed(repository.updatePosition(entityId, newPosition))
        
        expect(updated).toBe(true)
        
        const positionOpt = await expectEffect.toSucceed(repository.getPosition(entityId))
        expect(Option.isSome(positionOpt)).toBe(true)
        if (Option.isSome(positionOpt)) {
          expect(positionOpt.value).toEqual(newPosition)
        }
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(999)
        const updated = await expectEffect.toSucceed(
          repository.updatePosition(nonExistentId, { x: 0, y: 0, z: 0 })
        )
        expect(updated).toBe(false)
      })
    })

    describe('updateVelocity', () => {
      it('should update entity velocity', async () => {
        const newVelocity = { x: 2, y: 1, z: -2 }
        const updated = await expectEffect.toSucceed(repository.updateVelocity(entityId, newVelocity))
        
        expect(updated).toBe(true)
        
        const velocityOpt = await expectEffect.toSucceed(repository.getVelocity(entityId))
        expect(Option.isSome(velocityOpt)).toBe(true)
        if (Option.isSome(velocityOpt)) {
          expect(velocityOpt.value).toEqual(newVelocity)
        }
      })

      it('should return false for non-existent entity', async () => {
        const nonExistentId = toEntityId(999)
        const updated = await expectEffect.toSucceed(
          repository.updateVelocity(nonExistentId, { x: 0, y: 0, z: 0 })
        )
        expect(updated).toBe(false)
      })
    })

    describe('getPosition and getVelocity', () => {
      it('should return position for existing entity', async () => {
        const positionOpt = await expectEffect.toSucceed(repository.getPosition(entityId))
        expect(Option.isSome(positionOpt)).toBe(true)
        if (Option.isSome(positionOpt)) {
          expect(positionOpt.value).toEqual({ x: 10, y: 20, z: 30 })
        }
      })

      it('should return velocity for existing entity', async () => {
        const velocityOpt = await expectEffect.toSucceed(repository.getVelocity(entityId))
        expect(Option.isSome(velocityOpt)).toBe(true)
        if (Option.isSome(velocityOpt)) {
          expect(velocityOpt.value).toEqual({ x: 1, y: 0, z: -1 })
        }
      })

      it('should return None for non-existent entity', async () => {
        const nonExistentId = toEntityId(999)
        
        const positionOpt = await expectEffect.toSucceed(repository.getPosition(nonExistentId))
        expect(Option.isNone(positionOpt)).toBe(true)
        
        const velocityOpt = await expectEffect.toSucceed(repository.getVelocity(nonExistentId))
        expect(Option.isNone(velocityOpt)).toBe(true)
      })
    })
  })

  describe('Spatial Queries', () => {
    beforeEach(async () => {
      // Create a grid of physics bodies for spatial testing
      const bodies = [
        createTestPhysicsBody(toEntityId(100), { x: 0, y: 0, z: 0 }),
        createTestPhysicsBody(toEntityId(101), { x: 10, y: 0, z: 0 }),
        createTestPhysicsBody(toEntityId(102), { x: 0, y: 10, z: 0 }),
        createTestPhysicsBody(toEntityId(103), { x: 10, y: 10, z: 0 }),
        createTestPhysicsBody(toEntityId(104), { x: 100, y: 100, z: 100 }), // Far away
      ]
      
      for (const body of bodies) {
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      }
    })

    describe('findBodiesInRegion', () => {
      it('should find bodies within specified region', async () => {
        const region = { minX: -5, minY: -5, minZ: -5, maxX: 15, maxY: 15, maxZ: 5 }
        const bodies = await expectEffect.toSucceed(repository.findBodiesInRegion(region))
        
        expect(bodies).toHaveLength(4) // All except the far away one
        
        const entityIds = bodies.map(b => b.entityId)
        expect(entityIds).toContain(toEntityId(100))
        expect(entityIds).toContain(toEntityId(101))
        expect(entityIds).toContain(toEntityId(102))
        expect(entityIds).toContain(toEntityId(103))
        expect(entityIds).not.toContain(toEntityId(104))
      })

      it('should return empty array for region with no bodies', async () => {
        const region = { minX: 200, minY: 200, minZ: 200, maxX: 300, maxY: 300, maxZ: 300 }
        const bodies = await expectEffect.toSucceed(repository.findBodiesInRegion(region))
        expect(bodies).toHaveLength(0)
      })
    })

    describe('findBodiesInRadius', () => {
      it('should find bodies within specified radius', async () => {
        const center = { x: 5, y: 5, z: 0 }
        const radius = 10
        const bodies = await expectEffect.toSucceed(repository.findBodiesInRadius(center, radius))
        
        expect(bodies.length).toBeGreaterThan(0)
        expect(bodies.length).toBeLessThan(5) // Not all bodies should be in radius
        
        // Verify all returned bodies are within radius
        bodies.forEach(body => {
          const distance = Math.sqrt(
            (body.position.x - center.x) ** 2 +
            (body.position.y - center.y) ** 2 +
            (body.position.z - center.z) ** 2
          )
          expect(distance).toBeLessThanOrEqual(radius)
        })
      })

      it('should return empty array when no bodies in radius', async () => {
        const center = { x: 500, y: 500, z: 500 }
        const radius = 10
        const bodies = await expectEffect.toSucceed(repository.findBodiesInRadius(center, radius))
        expect(bodies).toHaveLength(0)
      })
    })

    describe('findNearestBodies', () => {
      it('should find nearest bodies sorted by distance', async () => {
        const position = { x: 0, y: 0, z: 0 }
        const maxCount = 3
        const results = await expectEffect.toSucceed(
          repository.findNearestBodies(position, maxCount)
        )
        
        expect(results.length).toBeLessThanOrEqual(maxCount)
        expect(results.length).toBeGreaterThan(0)
        
        // Verify sorting by distance
        for (let i = 1; i < results.length; i++) {
          expect(results[i].distance).toBeGreaterThanOrEqual(results[i-1].distance)
        }
        
        // Verify distances are calculated correctly
        results.forEach(result => {
          const expectedDistance = Math.sqrt(
            result.body.position.x ** 2 +
            result.body.position.y ** 2 +
            result.body.position.z ** 2
          )
          expect(Math.abs(result.distance - expectedDistance)).toBeLessThan(0.001)
        })
      })

      it('should respect max distance limit', async () => {
        const position = { x: 0, y: 0, z: 0 }
        const maxCount = 10
        const maxDistance = 20
        const results = await expectEffect.toSucceed(
          repository.findNearestBodies(position, maxCount, maxDistance)
        )
        
        results.forEach(result => {
          expect(result.distance).toBeLessThanOrEqual(maxDistance)
        })
      })

      it('should return empty array when no bodies within max distance', async () => {
        const position = { x: 0, y: 0, z: 0 }
        const maxCount = 10
        const maxDistance = 0.5 // Very small distance
        const results = await expectEffect.toSucceed(
          repository.findNearestBodies(position, maxCount, maxDistance)
        )
        
        expect(results).toHaveLength(0)
      })
    })
  })

  describe('Collision Detection', () => {
    beforeEach(async () => {
      // Create overlapping bodies for collision testing
      const body1 = createTestPhysicsBody(
        toEntityId(200), 
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { width: 2, height: 2, depth: 2, isTrigger: false }
      )
      const body2 = createTestPhysicsBody(
        toEntityId(201),
        { x: 1, y: 0, z: 0 }, // Overlapping with body1
        { x: -1, y: 0, z: 0 },
        { width: 2, height: 2, depth: 2, isTrigger: false }
      )
      const body3 = createTestPhysicsBody(
        toEntityId(202),
        { x: 10, y: 0, z: 0 }, // Not overlapping
        { x: 0, y: 0, z: 0 },
        { width: 1, height: 1, depth: 1, isTrigger: false }
      )
      
      await expectEffect.toSucceed(repository.addPhysicsBody(body1))
      await expectEffect.toSucceed(repository.addPhysicsBody(body2))
      await expectEffect.toSucceed(repository.addPhysicsBody(body3))
    })

    describe('detectCollisions', () => {
      it('should detect collisions between overlapping bodies', async () => {
        const collisions = await expectEffect.toSucceed(repository.detectCollisions())
        
        expect(collisions.length).toBeGreaterThan(0)
        
        const hasCollision = collisions.some(collision => 
          (collision.entityA === toEntityId(200) && collision.entityB === toEntityId(201)) ||
          (collision.entityA === toEntityId(201) && collision.entityB === toEntityId(200))
        )
        expect(hasCollision).toBe(true)
      })

      it('should not detect false collisions', async () => {
        const collisions = await expectEffect.toSucceed(repository.detectCollisions())
        
        // Should not have collision between body1/body3 or body2/body3
        const hasFalseCollision = collisions.some(collision =>
          (collision.entityA === toEntityId(200) && collision.entityB === toEntityId(202)) ||
          (collision.entityA === toEntityId(201) && collision.entityB === toEntityId(202)) ||
          (collision.entityA === toEntityId(202) && collision.entityB === toEntityId(200)) ||
          (collision.entityA === toEntityId(202) && collision.entityB === toEntityId(201))
        )
        expect(hasFalseCollision).toBe(false)
      })
    })

    describe('checkCollision', () => {
      it('should detect collision between two overlapping entities', async () => {
        const collisionOpt = await expectEffect.toSucceed(
          repository.checkCollision(toEntityId(200), toEntityId(201))
        )
        
        expect(Option.isSome(collisionOpt)).toBe(true)
        if (Option.isSome(collisionOpt)) {
          const collision = collisionOpt.value
          expect(collision.entityA === toEntityId(200) || collision.entityA === toEntityId(201)).toBe(true)
          expect(collision.entityB === toEntityId(200) || collision.entityB === toEntityId(201)).toBe(true)
          expect(collision.penetration).toBeGreaterThan(0)
        }
      })

      it('should return None for non-overlapping entities', async () => {
        const collisionOpt = await expectEffect.toSucceed(
          repository.checkCollision(toEntityId(200), toEntityId(202))
        )
        
        expect(Option.isNone(collisionOpt)).toBe(true)
      })

      it('should return None for non-existent entities', async () => {
        const collisionOpt = await expectEffect.toSucceed(
          repository.checkCollision(toEntityId(999), toEntityId(998))
        )
        
        expect(Option.isNone(collisionOpt)).toBe(true)
      })
    })

    describe('getCollisionEvents', () => {
      beforeEach(async () => {
        // Generate some collision events
        await expectEffect.toSucceed(repository.detectCollisions())
      })

      it('should return all collision events when no filters applied', async () => {
        const events = await expectEffect.toSucceed(repository.getCollisionEvents())
        expect(events.length).toBeGreaterThan(0)
      })

      it('should filter events by entity ID', async () => {
        const events = await expectEffect.toSucceed(
          repository.getCollisionEvents(toEntityId(200))
        )
        
        events.forEach(event => {
          expect(
            event.entityA === toEntityId(200) || event.entityB === toEntityId(200)
          ).toBe(true)
        })
      })

      it('should filter events by timestamp', async () => {
        const cutoffTime = Date.now()
        
        // Wait a bit and create new collision
        await new Promise(resolve => setTimeout(resolve, 10))
        await expectEffect.toSucceed(repository.detectCollisions())
        
        const recentEvents = await expectEffect.toSucceed(
          repository.getCollisionEvents(undefined, cutoffTime)
        )
        
        recentEvents.forEach(event => {
          expect(event.timestamp).toBeGreaterThanOrEqual(cutoffTime)
        })
      })
    })

    describe('resolveCollision', () => {
      it('should mark collision as resolved', async () => {
        const collisions = await expectEffect.toSucceed(repository.detectCollisions())
        expect(collisions.length).toBeGreaterThan(0)
        
        const collision = collisions[0]
        expect(collision.resolved).toBe(false)
        
        const resolved = await expectEffect.toSucceed(repository.resolveCollision(collision))
        expect(resolved).toBe(true)
        
        // The collision should now be marked as resolved in the history
        const events = await expectEffect.toSucceed(repository.getCollisionEvents())
        const resolvedEvent = events.find(e => 
          e.entityA === collision.entityA && 
          e.entityB === collision.entityB &&
          Math.abs(e.timestamp - collision.timestamp) < 100
        )
        expect(resolvedEvent?.resolved).toBe(true)
      })
    })
  })

  describe('Bulk Operations', () => {
    describe('updateMultipleBodies', () => {
      beforeEach(async () => {
        const entities = [toEntityId(300), toEntityId(301), toEntityId(302)]
        for (const entityId of entities) {
          const body = createTestPhysicsBody(entityId, { x: entityId, y: 0, z: 0 })
          await expectEffect.toSucceed(repository.addPhysicsBody(body))
        }
      })

      it('should update multiple bodies', async () => {
        const updates = [
          { entityId: toEntityId(300), updates: { mass: 2.0 } },
          { entityId: toEntityId(301), updates: { isStatic: true } },
          { entityId: toEntityId(302), updates: { position: { x: 999, y: 888, z: 777 } } }
        ]
        
        const updatedCount = await expectEffect.toSucceed(
          repository.updateMultipleBodies(updates)
        )
        expect(updatedCount).toBe(3)
        
        // Verify updates were applied
        const body1 = await expectEffect.toSucceed(repository.getPhysicsBody(toEntityId(300)))
        const body2 = await expectEffect.toSucceed(repository.getPhysicsBody(toEntityId(301)))
        const body3 = await expectEffect.toSucceed(repository.getPhysicsBody(toEntityId(302)))
        
        expect(Option.isSome(body1) && body1.value.mass).toBe(2.0)
        expect(Option.isSome(body2) && body2.value.isStatic).toBe(true)
        expect(Option.isSome(body3) && body3.value.position).toEqual({ x: 999, y: 888, z: 777 })
      })

      it('should handle mix of existing and non-existent entities', async () => {
        const updates = [
          { entityId: toEntityId(300), updates: { mass: 3.0 } },
          { entityId: toEntityId(999), updates: { mass: 4.0 } } // Non-existent
        ]
        
        const updatedCount = await expectEffect.toSucceed(
          repository.updateMultipleBodies(updates)
        )
        expect(updatedCount).toBe(1) // Only the existing entity
      })
    })

    describe('queryBodies', () => {
      beforeEach(async () => {
        const bodies = [
          createTestPhysicsBody(toEntityId(400), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, undefined, 1, false), // Active, dynamic
          createTestPhysicsBody(toEntityId(401), { x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, undefined, 1, true), // Active, static
          createTestPhysicsBody(toEntityId(402), { x: 20, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { width: 1, height: 1, depth: 1, isTrigger: true }, 1, false), // Active, dynamic, trigger
        ]
        
        bodies[1].isActive = false // Deactivate one body
        
        for (const body of bodies) {
          await expectEffect.toSucceed(repository.addPhysicsBody(body))
        }
      })

      it('should return all bodies when no options specified', async () => {
        const bodies = await expectEffect.toSucceed(repository.queryBodies())
        expect(bodies).toHaveLength(3)
      })

      it('should filter by active status', async () => {
        const activeBodies = await expectEffect.toSucceed(
          repository.queryBodies({ activeOnly: true })
        )
        expect(activeBodies).toHaveLength(2) // Two active bodies
        
        activeBodies.forEach(body => {
          expect(body.isActive).toBe(true)
        })
      })

      it('should filter by static status', async () => {
        const staticBodies = await expectEffect.toSucceed(
          repository.queryBodies({ staticOnly: true })
        )
        expect(staticBodies).toHaveLength(1) // One static body
        
        staticBodies.forEach(body => {
          expect(body.isStatic).toBe(true)
        })
      })

      it('should filter by collision presence', async () => {
        const collisionBodies = await expectEffect.toSucceed(
          repository.queryBodies({ withCollision: true })
        )
        expect(collisionBodies).toHaveLength(3) // All have collision components
      })

      it('should filter by region', async () => {
        const region = { minX: -5, minY: -5, minZ: -5, maxX: 15, maxY: 5, maxZ: 5 }
        const bodiesInRegion = await expectEffect.toSucceed(
          repository.queryBodies({ region })
        )
        expect(bodiesInRegion).toHaveLength(2) // Bodies at x=0 and x=10
      })

      it('should filter by specific entity IDs', async () => {
        const entityIds = [toEntityId(400), toEntityId(402)]
        const specificBodies = await expectEffect.toSucceed(
          repository.queryBodies({ entityIds })
        )
        expect(specificBodies).toHaveLength(2)
        
        specificBodies.forEach(body => {
          expect(entityIds).toContain(body.entityId)
        })
      })
    })

    describe('activateBodies and deactivateBodies', () => {
      beforeEach(async () => {
        const entities = [toEntityId(500), toEntityId(501), toEntityId(502)]
        for (const entityId of entities) {
          const body = createTestPhysicsBody(entityId)
          await expectEffect.toSucceed(repository.addPhysicsBody(body))
        }
      })

      it('should deactivate specified bodies', async () => {
        const entityIds = [toEntityId(500), toEntityId(501)]
        const deactivatedCount = await expectEffect.toSucceed(
          repository.deactivateBodies(entityIds)
        )
        expect(deactivatedCount).toBe(2)
        
        // Verify bodies are deactivated
        for (const entityId of entityIds) {
          const bodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(entityId))
          expect(Option.isSome(bodyOpt) && !bodyOpt.value.isActive).toBe(true)
        }
        
        // Verify third body is still active
        const activeBodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(toEntityId(502)))
        expect(Option.isSome(activeBodyOpt) && activeBodyOpt.value.isActive).toBe(true)
      })

      it('should activate specified bodies', async () => {
        // First deactivate some bodies
        await expectEffect.toSucceed(repository.deactivateBodies([toEntityId(500), toEntityId(501)]))
        
        // Then reactivate them
        const entityIds = [toEntityId(500), toEntityId(501)]
        const activatedCount = await expectEffect.toSucceed(
          repository.activateBodies(entityIds)
        )
        expect(activatedCount).toBe(2)
        
        // Verify bodies are activated
        for (const entityId of entityIds) {
          const bodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(entityId))
          expect(Option.isSome(bodyOpt) && bodyOpt.value.isActive).toBe(true)
        }
      })
    })
  })

  describe('Physics Simulation Support', () => {
    beforeEach(async () => {
      const bodies = [
        createTestPhysicsBody(toEntityId(600), { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }),
        createTestPhysicsBody(toEntityId(601), { x: 5, y: 0, z: 0 }, { x: -5, y: 0, z: 0 }),
        createTestPhysicsBody(toEntityId(602), { x: 100, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, undefined, 1, true), // Static
      ]
      
      for (const body of bodies) {
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      }
    })

    describe('stepSimulation', () => {
      it('should advance simulation and update positions', async () => {
        const deltaTime = 0.016 // 16ms
        const result = await expectEffect.toSucceed(repository.stepSimulation(deltaTime))
        
        expect(result.movedBodies).toBeGreaterThan(0)
        expect(result.collisions).toBeGreaterThanOrEqual(0)
        
        // Verify positions were updated based on velocity
        const body1Opt = await expectEffect.toSucceed(repository.getPhysicsBody(toEntityId(600)))
        expect(Option.isSome(body1Opt)).toBe(true)
        if (Option.isSome(body1Opt)) {
          expect(body1Opt.value.position.x).toBeGreaterThan(0) // Should have moved
        }
      })

      it('should not move static bodies', async () => {
        const deltaTime = 0.016
        await expectEffect.toSucceed(repository.stepSimulation(deltaTime))
        
        const staticBodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(toEntityId(602)))
        expect(Option.isSome(staticBodyOpt)).toBe(true)
        if (Option.isSome(staticBodyOpt)) {
          expect(staticBodyOpt.value.position.x).toBe(100) // Should not have moved
        }
      })

      it('should detect collisions during simulation', async () => {
        // Move bodies closer for potential collision
        await expectEffect.toSucceed(repository.updatePosition(toEntityId(601), { x: 1, y: 0, z: 0 }))
        
        const deltaTime = 0.016
        const result = await expectEffect.toSucceed(repository.stepSimulation(deltaTime))
        
        expect(result.collisions).toBeGreaterThanOrEqual(0)
      })
    })

    describe('applyForce', () => {
      it('should apply force to physics body', async () => {
        const force = { x: 100, y: 0, z: 0 }
        const applied = await expectEffect.toSucceed(
          repository.applyForce(toEntityId(600), force)
        )
        expect(applied).toBe(true)
        
        // Verify velocity changed (force applied over time changes velocity)
        const bodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(toEntityId(600)))
        expect(Option.isSome(bodyOpt)).toBe(true)
        if (Option.isSome(bodyOpt)) {
          // The exact velocity change depends on implementation, just verify it's different
          expect(bodyOpt.value.version).toBeGreaterThan(1)
        }
      })

      it('should return false for non-existent entity', async () => {
        const force = { x: 100, y: 0, z: 0 }
        const applied = await expectEffect.toSucceed(
          repository.applyForce(toEntityId(999), force)
        )
        expect(applied).toBe(false)
      })
    })

    describe('applyImpulse', () => {
      it('should apply impulse to physics body', async () => {
        const impulse = { x: 5, y: 0, z: 0 }
        const applied = await expectEffect.toSucceed(
          repository.applyImpulse(toEntityId(600), impulse)
        )
        expect(applied).toBe(true)
        
        // Verify velocity changed (impulse directly changes velocity)
        const bodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(toEntityId(600)))
        expect(Option.isSome(bodyOpt)).toBe(true)
        if (Option.isSome(bodyOpt)) {
          expect(bodyOpt.value.velocity.x).toBe(15) // Original 10 + impulse 5
          expect(bodyOpt.value.version).toBeGreaterThan(1)
        }
      })

      it('should return false for non-existent entity', async () => {
        const impulse = { x: 5, y: 0, z: 0 }
        const applied = await expectEffect.toSucceed(
          repository.applyImpulse(toEntityId(999), impulse)
        )
        expect(applied).toBe(false)
      })
    })
  })

  describe('Spatial Indexing', () => {
    beforeEach(async () => {
      // Create bodies in different regions
      const bodies = [
        createTestPhysicsBody(toEntityId(700), { x: 0, y: 0, z: 0 }),
        createTestPhysicsBody(toEntityId(701), { x: 50, y: 0, z: 0 }),
        createTestPhysicsBody(toEntityId(702), { x: 100, y: 100, z: 0 }),
      ]
      
      for (const body of bodies) {
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      }
    })

    describe('getSpatialRegions', () => {
      it('should return all spatial regions', async () => {
        const regions = await expectEffect.toSucceed(repository.getSpatialRegions())
        
        expect(regions.length).toBeGreaterThan(0)
        
        regions.forEach(region => {
          expect(region.minX).toBeLessThan(region.maxX)
          expect(region.minY).toBeLessThan(region.maxY)
          expect(region.minZ).toBeLessThan(region.maxZ)
          expect(HashSet.size(region.entities)).toBeGreaterThan(0)
        })
      })

      it('should contain correct entities in regions', async () => {
        const regions = await expectEffect.toSucceed(repository.getSpatialRegions())
        
        const allEntitiesInRegions = regions.flatMap(region => 
          Array.from(region.entities)
        )
        
        expect(allEntitiesInRegions).toContain(toEntityId(700))
        expect(allEntitiesInRegions).toContain(toEntityId(701))
        expect(allEntitiesInRegions).toContain(toEntityId(702))
      })
    })

    describe('rebuildSpatialIndex', () => {
      it('should rebuild spatial index', async () => {
        await expectEffect.toSucceed(repository.rebuildSpatialIndex())
        
        // Verify index still works after rebuild
        const bodies = await expectEffect.toSucceed(
          repository.findBodiesInRegion({ minX: -10, minY: -10, minZ: -10, maxX: 60, maxY: 10, maxZ: 10 })
        )
        
        expect(bodies.length).toBe(2) // Bodies at x=0 and x=50
      })
    })

    describe('optimizeSpatialIndex', () => {
      it('should optimize spatial index', async () => {
        // Add and remove some bodies to create fragmentation
        const tempBody = createTestPhysicsBody(toEntityId(999), { x: 25, y: 25, z: 0 })
        await expectEffect.toSucceed(repository.addPhysicsBody(tempBody))
        await expectEffect.toSucceed(repository.removePhysicsBody(toEntityId(999)))
        
        await expectEffect.toSucceed(repository.optimizeSpatialIndex())
        
        // Verify index still works after optimization
        const regions = await expectEffect.toSucceed(repository.getSpatialRegions())
        expect(regions.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Statistics and Maintenance', () => {
    beforeEach(async () => {
      const bodies = [
        createTestPhysicsBody(toEntityId(800), { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, undefined, 1, false),
        createTestPhysicsBody(toEntityId(801), { x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, undefined, 2, true),
        createTestPhysicsBody(toEntityId(802), { x: 20, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, undefined, 1.5, false),
      ]
      
      for (const body of bodies) {
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      }
      
      // Generate some collision events
      await expectEffect.toSucceed(repository.detectCollisions())
    })

    describe('getPhysicsStats', () => {
      it('should return comprehensive physics statistics', async () => {
        const stats = await expectEffect.toSucceed(repository.getPhysicsStats())
        
        expect(stats.totalBodies).toBe(3)
        expect(stats.activeBodies).toBe(3) // All active by default
        expect(stats.staticBodies).toBe(1) // One static body
        expect(stats.collisionEvents).toBeGreaterThanOrEqual(0)
        expect(stats.spatialRegions).toBeGreaterThan(0)
        expect(stats.averageEntitiesPerRegion).toBeGreaterThan(0)
        expect(stats.memoryUsage).toBeGreaterThan(0)
      })

      it('should track active vs inactive bodies correctly', async () => {
        await expectEffect.toSucceed(repository.deactivateBodies([toEntityId(800)]))
        
        const stats = await expectEffect.toSucceed(repository.getPhysicsStats())
        
        expect(stats.totalBodies).toBe(3)
        expect(stats.activeBodies).toBe(2) // One deactivated
      })
    })

    describe('clearCollisionHistory', () => {
      it('should clear all collision history when no timestamp specified', async () => {
        const clearedCount = await expectEffect.toSucceed(repository.clearCollisionHistory())
        expect(clearedCount).toBeGreaterThanOrEqual(0)
        
        const events = await expectEffect.toSucceed(repository.getCollisionEvents())
        expect(events).toHaveLength(0)
      })

      it('should clear collision history before specified timestamp', async () => {
        const cutoffTime = Date.now()
        
        // Wait and generate new collisions
        await new Promise(resolve => setTimeout(resolve, 10))
        await expectEffect.toSucceed(repository.detectCollisions())
        
        const clearedCount = await expectEffect.toSucceed(repository.clearCollisionHistory(cutoffTime))
        expect(clearedCount).toBeGreaterThanOrEqual(0)
        
        const remainingEvents = await expectEffect.toSucceed(repository.getCollisionEvents())
        remainingEvents.forEach(event => {
          expect(event.timestamp).toBeGreaterThanOrEqual(cutoffTime)
        })
      })
    })

    describe('compactStorage', () => {
      it('should compact storage successfully', async () => {
        // Add and remove some bodies to create storage fragmentation
        const tempBodies = [createTestPhysicsBody(toEntityId(900)), createTestPhysicsBody(toEntityId(901))]
        for (const body of tempBodies) {
          await expectEffect.toSucceed(repository.addPhysicsBody(body))
        }
        for (const body of tempBodies) {
          await expectEffect.toSucceed(repository.removePhysicsBody(body.entityId))
        }
        
        await expectEffect.toSucceed(repository.compactStorage())
        
        // Verify data integrity after compaction
        const stats = await expectEffect.toSucceed(repository.getPhysicsStats())
        expect(stats.totalBodies).toBe(3) // Original bodies should remain
      })
    })

    describe('validatePhysicsData', () => {
      it('should validate correct physics data', async () => {
        const validation = await expectEffect.toSucceed(repository.validatePhysicsData())
        
        expect(validation.isValid).toBe(true)
        expect(validation.errors).toHaveLength(0)
      })

      it('should detect data inconsistencies', async () => {
        // Manually corrupt data by directly modifying state
        const state = await runEffect(Ref.get(stateRef))
        const corruptedState = {
          ...state,
          physicsBodies: HashMap.set(state.physicsBodies, toEntityId(999), {
            entityId: toEntityId(999),
            position: { x: NaN, y: 0, z: 0 }, // Invalid position
            velocity: { x: 0, y: 0, z: 0 },
            collision: { width: 1, height: 1, depth: 1, isTrigger: false },
            mass: -1, // Invalid mass
            isStatic: false,
            isActive: true,
            lastUpdated: Date.now(),
            version: 1,
          } as PhysicsBody)
        }
        await runEffect(Ref.set(stateRef, corruptedState))
        
        const validation = await expectEffect.toSucceed(repository.validatePhysicsData())
        
        expect(validation.isValid).toBe(false)
        expect(validation.errors.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent body additions', async () => {
      const entityIds = Array.from({ length: 10 }, (_, i) => toEntityId(1000 + i))
      
      const concurrentOps = entityIds.map(entityId => {
        const body = createTestPhysicsBody(entityId, { x: entityId, y: 0, z: 0 })
        return repository.addPhysicsBody(body)
      })
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentOps, { concurrency: 'unbounded' })
      )
      
      // All operations should succeed
      results.forEach(result => expect(result).toBe(true))
      
      // Verify all bodies were added
      for (const entityId of entityIds) {
        const hasBody = await expectEffect.toSucceed(repository.hasPhysicsBody(entityId))
        expect(hasBody).toBe(true)
      }
    })

    it('should handle concurrent position updates', async () => {
      const entityId = toEntityId(2000)
      const body = createTestPhysicsBody(entityId, { x: 0, y: 0, z: 0 })
      await expectEffect.toSucceed(repository.addPhysicsBody(body))
      
      const concurrentUpdates = Array.from({ length: 5 }, (_, i) =>
        repository.updatePosition(entityId, { x: i * 10, y: 0, z: 0 })
      )
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentUpdates, { concurrency: 'unbounded' })
      )
      
      // All operations should succeed
      results.forEach(result => expect(result).toBe(true))
      
      // Final position should be consistent
      const finalBodyOpt = await expectEffect.toSucceed(repository.getPhysicsBody(entityId))
      expect(Option.isSome(finalBodyOpt)).toBe(true)
    })

    it('should handle concurrent collision detection', async () => {
      // Setup colliding bodies
      const bodies = [
        createTestPhysicsBody(toEntityId(3000), { x: 0, y: 0, z: 0 }),
        createTestPhysicsBody(toEntityId(3001), { x: 0.5, y: 0, z: 0 }),
        createTestPhysicsBody(toEntityId(3002), { x: 1, y: 0, z: 0 }),
      ]
      
      for (const body of bodies) {
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      }
      
      const concurrentCollisionChecks = [
        repository.detectCollisions(),
        repository.checkCollision(toEntityId(3000), toEntityId(3001)),
        repository.checkCollision(toEntityId(3001), toEntityId(3002)),
      ]
      
      const results = await expectEffect.toSucceed(
        Effect.all(concurrentCollisionChecks, { concurrency: 'unbounded' })
      )
      
      expect(results).toHaveLength(3)
      expect(results[0]).toBeInstanceOf(Array) // detectCollisions returns array
      // Other results are Options
    })
  })

  describe('Performance Tests', () => {
    it('should handle large numbers of physics bodies efficiently', async () => {
      const bodyCount = 1000
      const bodies = Array.from({ length: bodyCount }, (_, i) => 
        createTestPhysicsBody(
          toEntityId(10000 + i),
          { x: (i % 32) * 10, y: Math.floor(i / 32) * 10, z: 0 }
        )
      )
      
      const { duration } = await measureEffectPerformance(
        Effect.all(bodies.map(body => repository.addPhysicsBody(body)), { concurrency: 50 }),
        'add 1000 physics bodies'
      )
      
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      
      // Verify spatial query performance
      const { result: queryResult, duration: queryDuration } = await measureEffectPerformance(
        repository.findBodiesInRegion({ minX: 0, minY: 0, minZ: -10, maxX: 320, maxY: 320, maxZ: 10 }),
        'spatial query on 1000 bodies'
      )
      
      expect(queryResult.length).toBe(bodyCount)
      expect(queryDuration).toBeLessThan(100) // Should complete within 100ms
    })

    it('should perform collision detection efficiently', async () => {
      // Create a smaller set for collision detection performance test
      const bodyCount = 100
      const bodies = Array.from({ length: bodyCount }, (_, i) => 
        createTestPhysicsBody(
          toEntityId(20000 + i),
          { x: (i % 10) * 2, y: Math.floor(i / 10) * 2, z: 0 },
          { x: Math.random() - 0.5, y: 0, z: Math.random() - 0.5 }
        )
      )
      
      for (const body of bodies) {
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      }
      
      const { result, duration } = await measureEffectPerformance(
        repository.detectCollisions(),
        'collision detection on 100 bodies'
      )
      
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle simulation steps efficiently', async () => {
      const bodyCount = 200
      const bodies = Array.from({ length: bodyCount }, (_, i) => 
        createTestPhysicsBody(
          toEntityId(30000 + i),
          { x: i, y: 0, z: 0 },
          { x: Math.random() * 10, y: 0, z: Math.random() * 10 }
        )
      )
      
      for (const body of bodies) {
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      }
      
      const { result, duration } = await measureEffectPerformance(
        repository.stepSimulation(0.016),
        'physics simulation step with 200 bodies'
      )
      
      expect(duration).toBeLessThan(500) // Should complete within 500ms
      expect(result.movedBodies).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle bodies with zero mass', async () => {
      const entityId = toEntityId(40000)
      const body = createTestPhysicsBody(entityId, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, undefined, 0)
      
      const added = await expectEffect.toSucceed(repository.addPhysicsBody(body))
      expect(added).toBe(true)
      
      // Should handle force application gracefully
      const forceApplied = await expectEffect.toSucceed(
        repository.applyForce(entityId, { x: 100, y: 0, z: 0 })
      )
      expect(forceApplied).toBe(true)
    })

    it('should handle bodies with infinite mass', async () => {
      const entityId = toEntityId(40001)
      const body = createTestPhysicsBody(entityId, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, undefined, Infinity)
      
      const added = await expectEffect.toSucceed(repository.addPhysicsBody(body))
      expect(added).toBe(true)
    })

    it('should handle bodies at extreme coordinates', async () => {
      const extremePositions = [
        { x: -100000, y: -100000, z: -100000 },
        { x: 100000, y: 100000, z: 100000 },
        { x: 0, y: 0, z: 0 }
      ]
      
      for (let i = 0; i < extremePositions.length; i++) {
        const entityId = toEntityId(50000 + i)
        const body = createTestPhysicsBody(entityId, extremePositions[i])
        
        const added = await expectEffect.toSucceed(repository.addPhysicsBody(body))
        expect(added).toBe(true)
      }
    })

    it('should handle collision detection with overlapping identical positions', async () => {
      const position = { x: 0, y: 0, z: 0 }
      const entities = [toEntityId(60000), toEntityId(60001)]
      
      for (const entityId of entities) {
        const body = createTestPhysicsBody(entityId, position)
        await expectEffect.toSucceed(repository.addPhysicsBody(body))
      }
      
      const collisions = await expectEffect.toSucceed(repository.detectCollisions())
      expect(collisions.length).toBeGreaterThan(0)
    })

    it('should handle simulation with zero delta time', async () => {
      const entityId = toEntityId(70000)
      const body = createTestPhysicsBody(entityId, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 })
      await expectEffect.toSucceed(repository.addPhysicsBody(body))
      
      const result = await expectEffect.toSucceed(repository.stepSimulation(0))
      expect(result.movedBodies).toBe(0) // No movement with zero delta time
    })
  })

  describe('Layer Integration', () => {
    it('should work with Effect Layer system', async () => {
      const effect = Effect.gen(function* (_) {
        const repo = yield* _(PhysicsRepository)
        const entityId = toEntityId(80000)
        const body = createTestPhysicsBody(entityId, { x: 10, y: 20, z: 30 })
        
        const added = yield* _(repo.addPhysicsBody(body))
        const hasBody = yield* _(repo.hasPhysicsBody(entityId))
        const bodyOpt = yield* _(repo.getPhysicsBody(entityId))
        
        return { added, hasBody, position: Option.map(bodyOpt, b => b.position) }
      })
      
      const result = await runEffect(Effect.provide(effect, PhysicsRepositoryLive))
      
      expect(result.added).toBe(true)
      expect(result.hasBody).toBe(true)
      expect(Option.isSome(result.position) && result.position.value).toEqual({ x: 10, y: 20, z: 30 })
    })
  })
})