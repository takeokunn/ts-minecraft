/**
 * Physics Repository Tests
 * 
 * Comprehensive test suite for PhysicsRepository implementation using Effect-TS patterns.
 * Tests physics body management, collision detection, spatial indexing, and simulation support.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as TestContext from 'effect/TestContext'
import * as Option from 'effect/Option'
import * as HashSet from 'effect/HashSet'

import { 
  PhysicsRepository, 
  PhysicsRepositoryLive,
  type PhysicsBody,
  type CollisionEvent,
  type SpatialRegion,
  type PhysicsQueryOptions,
  type PhysicsStats
} from '../physics.repository'
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

interface TestCollision {
  width: number
  height: number
  depth: number
  isTrigger: boolean
}

// Helper to run effects in test context
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(
    Effect.provide(PhysicsRepositoryLive),
    Effect.provide(TestContext.TestContext)
  ))

// Test data factories
const createTestPosition = (x = 0, y = 0, z = 0): TestPosition => ({ x, y, z })
const createTestVelocity = (vx = 0, vy = 0, vz = 0): TestVelocity => ({ vx, vy, vz })
const createTestCollision = (width = 1, height = 1, depth = 1, isTrigger = false): TestCollision => ({
  width, height, depth, isTrigger
})

const createTestPhysicsBody = (
  entityId: EntityId,
  position: TestPosition = createTestPosition(),
  velocity: TestVelocity = createTestVelocity(),
  collision: TestCollision = createTestCollision(),
  options: Partial<PhysicsBody> = {}
): PhysicsBody => ({
  entityId,
  position: position as any,
  velocity: velocity as any,
  collision: collision as any,
  mass: 1.0,
  isStatic: false,
  isActive: true,
  lastUpdated: Date.now(),
  version: 1,
  ...options
})

describe('PhysicsRepository', () => {
  describe('Physics Body Management', () => {
    it('should add physics bodies correctly', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const entityId = toEntityId(1)
        const body = createTestPhysicsBody(entityId, createTestPosition(10, 20, 30))

        const addResult = yield* repo.addPhysicsBody(body)
        expect(addResult).toBe(true)

        // Verify body was added
        const hasResult = yield* repo.hasPhysicsBody(entityId)
        expect(hasResult).toBe(true)

        const bodyOpt = yield* repo.getPhysicsBody(entityId)
        expect(Option.isSome(bodyOpt)).toBe(true)
        if (Option.isSome(bodyOpt)) {
          expect(bodyOpt.value.entityId).toBe(entityId)
          expect(bodyOpt.value.position).toEqual(body.position)
        }
      }))
    })

    it('should not add duplicate physics bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const entityId = toEntityId(2)
        const body1 = createTestPhysicsBody(entityId, createTestPosition(1, 2, 3))
        const body2 = createTestPhysicsBody(entityId, createTestPosition(10, 20, 30))

        // Add first body
        const firstAdd = yield* repo.addPhysicsBody(body1)
        expect(firstAdd).toBe(true)

        // Try to add second body with same entity ID
        const secondAdd = yield* repo.addPhysicsBody(body2)
        expect(secondAdd).toBe(false)

        // Original body should remain unchanged
        const bodyOpt = yield* repo.getPhysicsBody(entityId)
        if (Option.isSome(bodyOpt)) {
          expect(bodyOpt.value.position).toEqual(body1.position)
        }
      }))
    })

    it('should update physics bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const entityId = toEntityId(3)
        const initialBody = createTestPhysicsBody(entityId, createTestPosition(0, 0, 0))

        // Add initial body
        yield* repo.addPhysicsBody(initialBody)

        // Update body
        const updates = {
          position: createTestPosition(5, 10, 15) as any,
          velocity: createTestVelocity(1, 0, -1) as any,
          mass: 2.5
        }

        const updateResult = yield* repo.updatePhysicsBody(entityId, updates)
        expect(updateResult).toBe(true)

        // Verify updates
        const updatedBodyOpt = yield* repo.getPhysicsBody(entityId)
        expect(Option.isSome(updatedBodyOpt)).toBe(true)
        if (Option.isSome(updatedBodyOpt)) {
          const body = updatedBodyOpt.value
          expect(body.position).toEqual(updates.position)
          expect(body.velocity).toEqual(updates.velocity)
          expect(body.mass).toBe(updates.mass)
          expect(body.version).toBe(initialBody.version + 1) // Version should increment
        }
      }))
    })

    it('should not update non-existent physics bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const nonExistentId = toEntityId(999)

        const updateResult = yield* repo.updatePhysicsBody(nonExistentId, {
          position: createTestPosition(1, 2, 3) as any
        })
        expect(updateResult).toBe(false)
      }))
    })

    it('should remove physics bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const entityId = toEntityId(4)
        const body = createTestPhysicsBody(entityId)

        // Add body
        yield* repo.addPhysicsBody(body)
        expect(yield* repo.hasPhysicsBody(entityId)).toBe(true)

        // Remove body
        const removeResult = yield* repo.removePhysicsBody(entityId)
        expect(removeResult).toBe(true)

        // Verify removal
        expect(yield* repo.hasPhysicsBody(entityId)).toBe(false)
        const bodyOpt = yield* repo.getPhysicsBody(entityId)
        expect(Option.isNone(bodyOpt)).toBe(true)
      }))
    })

    it('should not remove non-existent physics bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const nonExistentId = toEntityId(999)

        const removeResult = yield* repo.removePhysicsBody(nonExistentId)
        expect(removeResult).toBe(false)
      }))
    })
  })

  describe('Position and Velocity Operations', () => {
    it('should update position independently', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const entityId = toEntityId(10)
        const body = createTestPhysicsBody(entityId, createTestPosition(0, 0, 0))

        yield* repo.addPhysicsBody(body)

        // Update position
        const newPosition = createTestPosition(100, 200, 300)
        const updateResult = yield* repo.updatePosition(entityId, newPosition as any)
        expect(updateResult).toBe(true)

        // Verify position was updated
        const positionOpt = yield* repo.getPosition(entityId)
        expect(Option.isSome(positionOpt)).toBe(true)
        if (Option.isSome(positionOpt)) {
          expect(positionOpt.value).toEqual(newPosition)
        }
      }))
    })

    it('should update velocity independently', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const entityId = toEntityId(11)
        const body = createTestPhysicsBody(entityId, createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0))

        yield* repo.addPhysicsBody(body)

        // Update velocity
        const newVelocity = createTestVelocity(5, -2, 1.5)
        const updateResult = yield* repo.updateVelocity(entityId, newVelocity as any)
        expect(updateResult).toBe(true)

        // Verify velocity was updated
        const velocityOpt = yield* repo.getVelocity(entityId)
        expect(Option.isSome(velocityOpt)).toBe(true)
        if (Option.isSome(velocityOpt)) {
          expect(velocityOpt.value).toEqual(newVelocity)
        }
      }))
    })

    it('should not update position/velocity for non-existent bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const nonExistentId = toEntityId(999)

        const posUpdateResult = yield* repo.updatePosition(nonExistentId, createTestPosition(1, 2, 3) as any)
        expect(posUpdateResult).toBe(false)

        const velUpdateResult = yield* repo.updateVelocity(nonExistentId, createTestVelocity(1, 2, 3) as any)
        expect(velUpdateResult).toBe(false)
      }))
    })
  })

  describe('Spatial Queries', () => {
    it('should find bodies in region', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Create bodies in different positions
        const entity1 = toEntityId(20)
        const entity2 = toEntityId(21)
        const entity3 = toEntityId(22)

        const body1 = createTestPhysicsBody(entity1, createTestPosition(5, 5, 5))
        const body2 = createTestPhysicsBody(entity2, createTestPosition(15, 15, 15))
        const body3 = createTestPhysicsBody(entity3, createTestPosition(25, 25, 25))

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)
        yield* repo.addPhysicsBody(body3)

        // Query region containing only first two bodies
        const region = { minX: 0, minY: 0, minZ: 0, maxX: 20, maxY: 20, maxZ: 20 }
        const bodiesInRegion = yield* repo.findBodiesInRegion(region)

        expect(bodiesInRegion.length).toBe(2)
        const entityIds = bodiesInRegion.map(b => b.entityId)
        expect(entityIds).toContain(entity1)
        expect(entityIds).toContain(entity2)
        expect(entityIds).not.toContain(entity3)
      }))
    })

    it('should find bodies in radius', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Create bodies at different distances from origin
        const entity1 = toEntityId(23)
        const entity2 = toEntityId(24)
        const entity3 = toEntityId(25)

        const body1 = createTestPhysicsBody(entity1, createTestPosition(1, 0, 0)) // Distance 1
        const body2 = createTestPhysicsBody(entity2, createTestPosition(3, 4, 0)) // Distance 5
        const body3 = createTestPhysicsBody(entity3, createTestPosition(10, 0, 0)) // Distance 10

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)
        yield* repo.addPhysicsBody(body3)

        // Find bodies within radius 6 from origin
        const center = { x: 0, y: 0, z: 0 }
        const bodiesInRadius = yield* repo.findBodiesInRadius(center, 6)

        expect(bodiesInRadius.length).toBe(2)
        const entityIds = bodiesInRadius.map(b => b.entityId)
        expect(entityIds).toContain(entity1)
        expect(entityIds).toContain(entity2)
        expect(entityIds).not.toContain(entity3)
      }))
    })

    it('should find nearest bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(26)
        const entity2 = toEntityId(27)
        const entity3 = toEntityId(28)

        const body1 = createTestPhysicsBody(entity1, createTestPosition(2, 0, 0))
        const body2 = createTestPhysicsBody(entity2, createTestPosition(5, 0, 0))
        const body3 = createTestPhysicsBody(entity3, createTestPosition(1, 0, 0))

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)
        yield* repo.addPhysicsBody(body3)

        // Find 2 nearest bodies to origin
        const queryPoint = { x: 0, y: 0, z: 0 }
        const nearestBodies = yield* repo.findNearestBodies(queryPoint, 2)

        expect(nearestBodies.length).toBe(2)
        
        // Should be sorted by distance
        expect(nearestBodies[0].body.entityId).toBe(entity3) // Distance 1
        expect(nearestBodies[1].body.entityId).toBe(entity1) // Distance 2
        expect(nearestBodies[0].distance).toBeLessThan(nearestBodies[1].distance)
      }))
    })

    it('should find nearest bodies with max distance constraint', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(29)
        const entity2 = toEntityId(30)

        const body1 = createTestPhysicsBody(entity1, createTestPosition(2, 0, 0))
        const body2 = createTestPhysicsBody(entity2, createTestPosition(10, 0, 0))

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)

        // Find nearest bodies with max distance of 5
        const queryPoint = { x: 0, y: 0, z: 0 }
        const nearestBodies = yield* repo.findNearestBodies(queryPoint, 10, 5)

        expect(nearestBodies.length).toBe(1)
        expect(nearestBodies[0].body.entityId).toBe(entity1)
      }))
    })
  })

  describe('Collision Detection', () => {
    it('should detect collisions between overlapping bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(40)
        const entity2 = toEntityId(41)

        // Create overlapping bodies
        const body1 = createTestPhysicsBody(
          entity1, 
          createTestPosition(0, 0, 0),
          createTestVelocity(0, 0, 0),
          createTestCollision(2, 2, 2) // Size 2x2x2, centered at origin
        )
        
        const body2 = createTestPhysicsBody(
          entity2,
          createTestPosition(1, 0, 0), // Offset by 1, should overlap
          createTestVelocity(0, 0, 0),
          createTestCollision(2, 2, 2)
        )

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)

        // Detect collisions
        const collisions = yield* repo.detectCollisions()

        expect(collisions.length).toBe(1)
        expect(collisions[0].entityA).toBe(entity1)
        expect(collisions[0].entityB).toBe(entity2)
        expect(collisions[0].resolved).toBe(false)
      }))
    })

    it('should not detect collisions for non-overlapping bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(42)
        const entity2 = toEntityId(43)

        // Create non-overlapping bodies
        const body1 = createTestPhysicsBody(entity1, createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1))
        const body2 = createTestPhysicsBody(entity2, createTestPosition(10, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1))

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)

        // Detect collisions
        const collisions = yield* repo.detectCollisions()
        expect(collisions.length).toBe(0)
      }))
    })

    it('should check collision between specific entities', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(44)
        const entity2 = toEntityId(45)

        const body1 = createTestPhysicsBody(entity1, createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2))
        const body2 = createTestPhysicsBody(entity2, createTestPosition(0.5, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2))

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)

        // Check specific collision
        const collisionOpt = yield* repo.checkCollision(entity1, entity2)
        expect(Option.isSome(collisionOpt)).toBe(true)

        if (Option.isSome(collisionOpt)) {
          expect(collisionOpt.value.entityA).toBe(entity1)
          expect(collisionOpt.value.entityB).toBe(entity2)
        }
      }))
    })

    it('should resolve collisions', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(46)
        const entity2 = toEntityId(47)

        const body1 = createTestPhysicsBody(entity1, createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2))
        const body2 = createTestPhysicsBody(entity2, createTestPosition(1, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2))

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)

        // Detect collision
        const collisions = yield* repo.detectCollisions()
        expect(collisions.length).toBe(1)

        // Resolve collision
        const resolveResult = yield* repo.resolveCollision(collisions[0])
        expect(resolveResult).toBe(true)

        // Get collision events to check if it's marked as resolved
        const events = yield* repo.getCollisionEvents()
        const resolvedEvent = events.find(e => e.entityA === entity1 && e.entityB === entity2)
        expect(resolvedEvent?.resolved).toBe(true)
      }))
    })

    it('should track collision events with filtering', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(48)
        const entity2 = toEntityId(49)
        const entity3 = toEntityId(50)

        const body1 = createTestPhysicsBody(entity1, createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2))
        const body2 = createTestPhysicsBody(entity2, createTestPosition(1, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2))
        const body3 = createTestPhysicsBody(entity3, createTestPosition(0, 1, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2))

        yield* repo.addPhysicsBody(body1)
        yield* repo.addPhysicsBody(body2)
        yield* repo.addPhysicsBody(body3)

        const beforeTime = Date.now()

        // Detect collisions
        yield* repo.detectCollisions()

        // Get events for specific entity
        const entity1Events = yield* repo.getCollisionEvents(entity1)
        expect(entity1Events.length).toBe(2) // Should collide with both entity2 and entity3

        // Get events since a specific time
        const recentEvents = yield* repo.getCollisionEvents(undefined, beforeTime)
        expect(recentEvents.length).toBeGreaterThan(0)
      }))
    })
  })

  describe('Bulk Operations', () => {
    it('should update multiple bodies at once', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(60)
        const entity2 = toEntityId(61)
        const entity3 = toEntityId(62)

        // Add initial bodies
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity1, createTestPosition(0, 0, 0)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity2, createTestPosition(1, 1, 1)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity3, createTestPosition(2, 2, 2)))

        // Bulk update
        const updates = [
          { entityId: entity1, updates: { mass: 2.0 } },
          { entityId: entity2, updates: { mass: 3.0 } },
          { entityId: entity3, updates: { isStatic: true } }
        ]

        const updateCount = yield* repo.updateMultipleBodies(updates)
        expect(updateCount).toBe(3)

        // Verify updates
        const body1Opt = yield* repo.getPhysicsBody(entity1)
        const body2Opt = yield* repo.getPhysicsBody(entity2)
        const body3Opt = yield* repo.getPhysicsBody(entity3)

        if (Option.isSome(body1Opt)) expect(body1Opt.value.mass).toBe(2.0)
        if (Option.isSome(body2Opt)) expect(body2Opt.value.mass).toBe(3.0)
        if (Option.isSome(body3Opt)) expect(body3Opt.value.isStatic).toBe(true)
      }))
    })

    it('should query bodies with various options', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(63)
        const entity2 = toEntityId(64)
        const entity3 = toEntityId(65)

        // Add bodies with different properties
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity1, createTestPosition(5, 5, 5), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: true, isStatic: false }))
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity2, createTestPosition(15, 15, 15), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: false, isStatic: true }))
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity3, createTestPosition(25, 25, 25), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: true, isStatic: false }))

        // Query active bodies only
        const activeBodies = yield* repo.queryBodies({ activeOnly: true })
        expect(activeBodies.length).toBe(2)

        // Query static bodies only
        const staticBodies = yield* repo.queryBodies({ staticOnly: true })
        expect(staticBodies.length).toBe(1)

        // Query bodies in region
        const bodiesInRegion = yield* repo.queryBodies({
          region: { minX: 0, minY: 0, minZ: 0, maxX: 20, maxY: 20, maxZ: 20 }
        })
        expect(bodiesInRegion.length).toBe(2)
      }))
    })

    it('should activate and deactivate bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(66)
        const entity2 = toEntityId(67)
        const entity3 = toEntityId(68)

        // Add inactive bodies
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity1, createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: false }))
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity2, createTestPosition(1, 1, 1), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: false }))
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity3, createTestPosition(2, 2, 2), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: true }))

        // Activate some bodies
        const activatedCount = yield* repo.activateBodies([entity1, entity2])
        expect(activatedCount).toBe(2)

        // Deactivate one body
        const deactivatedCount = yield* repo.deactivateBodies([entity1])
        expect(deactivatedCount).toBe(1)

        // Verify states
        const body1Opt = yield* repo.getPhysicsBody(entity1)
        const body2Opt = yield* repo.getPhysicsBody(entity2)

        if (Option.isSome(body1Opt)) expect(body1Opt.value.isActive).toBe(false)
        if (Option.isSome(body2Opt)) expect(body2Opt.value.isActive).toBe(true)
      }))
    })
  })

  describe('Physics Simulation Support', () => {
    it('should step simulation and report results', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entity1 = toEntityId(70)
        const entity2 = toEntityId(71)

        // Add bodies with velocity
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity1, createTestPosition(0, 0, 0), createTestVelocity(1, 0, 0)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(entity2, createTestPosition(5, 0, 0), createTestVelocity(-1, 0, 0)))

        const deltaTime = 0.016 // 60 FPS
        const result = yield* repo.stepSimulation(deltaTime)

        expect(result.movedBodies).toBeGreaterThanOrEqual(0)
        expect(result.collisions).toBeGreaterThanOrEqual(0)
      }))
    })

    it('should apply force to bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entityId = toEntityId(72)
        const body = createTestPhysicsBody(entityId, createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0))

        yield* repo.addPhysicsBody(body)

        // Apply force
        const force = { x: 10, y: 0, z: 0 }
        const applyResult = yield* repo.applyForce(entityId, force)
        expect(applyResult).toBe(true)

        // Verify velocity was affected (should be proportional to force/mass)
        const updatedBodyOpt = yield* repo.getPhysicsBody(entityId)
        if (Option.isSome(updatedBodyOpt)) {
          expect(updatedBodyOpt.value.velocity.vx).toBeGreaterThan(0)
        }
      }))
    })

    it('should apply impulse to bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        const entityId = toEntityId(73)
        const body = createTestPhysicsBody(entityId, createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0))

        yield* repo.addPhysicsBody(body)

        // Apply impulse
        const impulse = { x: 5, y: 0, z: 0 }
        const applyResult = yield* repo.applyImpulse(entityId, impulse)
        expect(applyResult).toBe(true)

        // Verify velocity was changed instantly
        const updatedBodyOpt = yield* repo.getPhysicsBody(entityId)
        if (Option.isSome(updatedBodyOpt)) {
          expect(updatedBodyOpt.value.velocity.vx).toBeGreaterThan(0)
        }
      }))
    })

    it('should not apply force/impulse to non-existent bodies', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const nonExistentId = toEntityId(999)

        const forceResult = yield* repo.applyForce(nonExistentId, { x: 10, y: 0, z: 0 })
        expect(forceResult).toBe(false)

        const impulseResult = yield* repo.applyImpulse(nonExistentId, { x: 5, y: 0, z: 0 })
        expect(impulseResult).toBe(false)
      }))
    })
  })

  describe('Spatial Indexing', () => {
    it('should rebuild spatial index', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Add some bodies
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(80), createTestPosition(0, 0, 0)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(81), createTestPosition(10, 10, 10)))

        // Rebuild spatial index
        yield* repo.rebuildSpatialIndex()

        // This is more of a smoke test - the operation should complete without error
        // and spatial queries should still work
        const bodiesInRegion = yield* repo.findBodiesInRegion({
          minX: -5, minY: -5, minZ: -5, maxX: 5, maxY: 5, maxZ: 5
        })
        expect(bodiesInRegion.length).toBe(1)
      }))
    })

    it('should optimize spatial index', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Add and remove bodies to create fragmentation
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(82), createTestPosition(0, 0, 0)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(83), createTestPosition(1, 1, 1)))
        yield* repo.removePhysicsBody(toEntityId(83))

        // Optimize spatial index
        yield* repo.optimizeSpatialIndex()

        // The operation should complete without error
      }))
    })

    it('should get spatial regions', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Add bodies in different spatial regions
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(84), createTestPosition(0, 0, 0)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(85), createTestPosition(100, 100, 100)))

        const regions = yield* repo.getSpatialRegions()
        expect(regions.length).toBeGreaterThan(0)

        // Each region should contain at least one entity
        for (const region of regions) {
          expect(HashSet.size(region.entities)).toBeGreaterThan(0)
        }
      }))
    })
  })

  describe('Statistics and Maintenance', () => {
    it('should provide physics statistics', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Add various types of bodies
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(90), createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: true, isStatic: false }))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(91), createTestPosition(1, 1, 1), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: false, isStatic: true }))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(92), createTestPosition(2, 2, 2), createTestVelocity(0, 0, 0), createTestCollision(1, 1, 1), { isActive: true, isStatic: false }))

        // Generate some collisions
        yield* repo.detectCollisions()

        const stats = yield* repo.getPhysicsStats()

        expect(stats.totalBodies).toBe(3)
        expect(stats.activeBodies).toBe(2)
        expect(stats.staticBodies).toBe(1)
        expect(stats.spatialRegions).toBeGreaterThan(0)
        expect(stats.memoryUsage).toBeGreaterThan(0)
      }))
    })

    it('should clear collision history', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Create colliding bodies
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(93), createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(94), createTestPosition(1, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2)))

        // Generate collisions
        yield* repo.detectCollisions()

        // Verify events exist
        const eventsBefore = yield* repo.getCollisionEvents()
        expect(eventsBefore.length).toBeGreaterThan(0)

        // Clear history
        const clearedCount = yield* repo.clearCollisionHistory()
        expect(clearedCount).toBe(eventsBefore.length)

        // Verify events were cleared
        const eventsAfter = yield* repo.getCollisionEvents()
        expect(eventsAfter.length).toBe(0)
      }))
    })

    it('should clear collision history with time filter', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Create collision
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(95), createTestPosition(0, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(96), createTestPosition(1, 0, 0), createTestVelocity(0, 0, 0), createTestCollision(2, 2, 2)))

        yield* repo.detectCollisions()

        const midTime = Date.now() + 1000

        // Clear only old events (none should be cleared since all are recent)
        const clearedCount = yield* repo.clearCollisionHistory(midTime)
        expect(clearedCount).toBe(0)

        // Events should still exist
        const eventsAfter = yield* repo.getCollisionEvents()
        expect(eventsAfter.length).toBeGreaterThan(0)
      }))
    })

    it('should compact storage', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Add and remove bodies to create fragmentation
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(97), createTestPosition(0, 0, 0)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(98), createTestPosition(1, 1, 1)))
        yield* repo.removePhysicsBody(toEntityId(98))

        // Compact storage
        yield* repo.compactStorage()

        // This is more of a smoke test - the operation should complete without error
      }))
    })

    it('should validate physics data', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Add valid bodies
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(99), createTestPosition(0, 0, 0)))
        yield* repo.addPhysicsBody(createTestPhysicsBody(toEntityId(100), createTestPosition(1, 1, 1)))

        const validation = yield* repo.validatePhysicsData()

        expect(validation.isValid).toBe(true)
        expect(validation.errors.length).toBe(0)
      }))
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle operations on non-existent bodies gracefully', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository
        const nonExistentId = toEntityId(9999)

        // All operations should handle non-existent entities gracefully
        expect(yield* repo.hasPhysicsBody(nonExistentId)).toBe(false)
        expect(yield* repo.updatePhysicsBody(nonExistentId, { mass: 5 })).toBe(false)
        expect(yield* repo.removePhysicsBody(nonExistentId)).toBe(false)

        const bodyOpt = yield* repo.getPhysicsBody(nonExistentId)
        expect(Option.isNone(bodyOpt)).toBe(true)

        const positionOpt = yield* repo.getPosition(nonExistentId)
        expect(Option.isNone(positionOpt)).toBe(true)

        expect(yield* repo.applyForce(nonExistentId, { x: 1, y: 0, z: 0 })).toBe(false)
        expect(yield* repo.applyImpulse(nonExistentId, { x: 1, y: 0, z: 0 })).toBe(false)
      }))
    })

    it('should handle concurrent physics operations', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Add multiple bodies concurrently
        const addEffects = Array.from({ length: 20 }, (_, i) =>
          repo.addPhysicsBody(createTestPhysicsBody(toEntityId(1000 + i), createTestPosition(i, i, i)))
        )

        const results = yield* Effect.all(addEffects, { concurrency: 10 })

        // All operations should succeed
        expect(results.every(r => r === true)).toBe(true)

        // Verify statistics are consistent
        const stats = yield* repo.getPhysicsStats()
        expect(stats.totalBodies).toBe(20)
      }))
    })

    it('should handle large numbers of bodies efficiently', async () => {
      await runTest(Effect.gen(function* () {
        const repo = yield* PhysicsRepository

        // Add many bodies
        const bodyCount = 500
        for (let i = 0; i < bodyCount; i++) {
          yield* repo.addPhysicsBody(createTestPhysicsBody(
            toEntityId(2000 + i),
            createTestPosition(i % 50, Math.floor(i / 50), 0)
          ))
        }

        // Spatial queries should still work efficiently
        const bodiesInRegion = yield* repo.findBodiesInRegion({
          minX: 0, minY: 0, minZ: -1, maxX: 25, maxY: 5, maxZ: 1
        })
        expect(bodiesInRegion.length).toBeGreaterThan(0)

        // Statistics should be accurate
        const stats = yield* repo.getPhysicsStats()
        expect(stats.totalBodies).toBe(bodyCount)
      }))
    })
  })
})