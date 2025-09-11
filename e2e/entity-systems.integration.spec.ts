import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { GameTestHarness, withGameHarness } from './framework/game-test-harness'
import { PerformanceTester, withPerformanceTester } from './framework/performance-testing'
import { BlockType } from '@/core/values/block-type'
import { EntityId } from '@/core/entities/entity'

/**
 * Entity Systems Integration Tests
 * 
 * Comprehensive tests for entity lifecycle, component interactions,
 * and system behavior under various conditions.
 */

describe('Entity Systems Integration', () => {
  describe('Entity Lifecycle Management', () => {
    it.effect('should handle entity creation and destruction cycles', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Create multiple batches of entities
        const batches: EntityId[][] = []
        const batchSize = 100
        const batchCount = 5
        
        for (let batch = 0; batch < batchCount; batch++) {
          const entities = yield* harness.chaos.spawnEntities(batchSize)
          batches.push(entities)
          
          // Verify entity count increases
          const entityCount = yield* harness.verifyWorldState.entityCount(1 + (batch + 1) * batchSize)
          expect(entityCount).toBe(true)
        }
        
        // Remove entities in LIFO order (last created, first removed)
        for (let batch = batchCount - 1; batch >= 0; batch--) {
          const world = yield* Effect.service('World')
          
          for (const entityId of batches[batch]) {
            yield* world.removeEntity(entityId)
          }
          
          // Verify entity count decreases
          const expectedCount = 1 + batch * batchSize
          const entityCount = yield* harness.verifyWorldState.entityCount(expectedCount)
          expect(entityCount).toBe(true)
        }
        
        // Only player should remain
        const finalCount = yield* harness.verifyWorldState.entityCount(1)
        expect(finalCount).toBe(true)
        
        return { batchesCreated: batchCount, entitiesPerBatch: batchSize }
      }).pipe(withGameHarness)
    )

    it.effect('should maintain component consistency during entity operations', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Create entities with specific component combinations
        const testEntities: EntityId[] = []
        
        // Physics entities (position + velocity + gravity)
        for (let i = 0; i < 50; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: { x: i, y: 64, z: 0 },
              velocity: { dx: Math.random() * 10 - 5, dy: 0, dz: Math.random() * 10 - 5 },
              gravity: { value: -9.8 }
            }
          })
          testEntities.push(entityId)
        }
        
        // Renderable entities (position + mesh + renderable)
        for (let i = 0; i < 30; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: { x: i, y: 65, z: 10 },
              mesh: { 
                vertices: new Float32Array([0, 0, 0, 1, 1, 1]),
                indices: new Uint16Array([0, 1, 2])
              },
              renderable: { visible: true, castShadow: true }
            }
          })
          testEntities.push(entityId)
        }
        
        // Collidable entities (position + collider)
        for (let i = 0; i < 20; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: { x: i, y: 64, z: 20 },
              collider: { width: 1, height: 1, depth: 1 }
            }
          })
          testEntities.push(entityId)
        }
        
        // Query different component combinations
        const physicsEntities = yield* world.query('position', 'velocity', 'gravity')
        const renderableEntities = yield* world.query('position', 'mesh', 'renderable')
        const collidableEntities = yield* world.query('position', 'collider')
        const allPositionEntities = yield* world.query('position')
        
        expect(physicsEntities.length).toBe(50)
        expect(renderableEntities.length).toBe(30)
        expect(collidableEntities.length).toBe(20)
        expect(allPositionEntities.length).toBe(1 + 50 + 30 + 20) // player + test entities
        
        // Update components and verify consistency
        for (const entity of testEntities.slice(0, 10)) {
          yield* world.updateComponent(entity, 'position', {
            x: Math.random() * 100,
            y: 64 + Math.random() * 10,
            z: Math.random() * 100
          })
        }
        
        // Verify queries still return correct counts
        const physicsEntitiesAfter = yield* world.query('position', 'velocity', 'gravity')
        expect(physicsEntitiesAfter.length).toBe(50)
        
        return {
          totalEntities: testEntities.length + 1, // +1 for player
          physicsCount: physicsEntities.length,
          renderableCount: renderableEntities.length,
          collidableCount: collidableEntities.length
        }
      }).pipe(withGameHarness)
    )

    it.effect('should handle component addition and removal dynamically', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Create a basic entity with just position
        const entityId = yield* world.addArchetype({
          components: {
            position: { x: 0, y: 64, z: 0 }
          }
        })
        
        // Verify initial state
        let positionComponent = yield* world.getComponent(entityId, 'position')
        let velocityComponent = yield* world.getComponent(entityId, 'velocity')
        
        expect(positionComponent._tag).toBe('Some')
        expect(velocityComponent._tag).toBe('None')
        
        // Add velocity component dynamically
        yield* world.addComponent(entityId, 'velocity', { dx: 5, dy: 0, dz: 0 })
        
        // Verify velocity was added
        velocityComponent = yield* world.getComponent(entityId, 'velocity')
        expect(velocityComponent._tag).toBe('Some')
        
        // Entity should now appear in physics queries
        const physicsQuery = yield* world.query('position', 'velocity')
        const entityInPhysics = physicsQuery.some(e => e.entityId === entityId)
        expect(entityInPhysics).toBe(true)
        
        // Add more components
        yield* world.addComponent(entityId, 'gravity', { value: -9.8 })
        yield* world.addComponent(entityId, 'collider', { width: 1, height: 1, depth: 1 })
        
        // Verify full physics entity
        const fullPhysicsQuery = yield* world.query('position', 'velocity', 'gravity', 'collider')
        const entityInFullPhysics = fullPhysicsQuery.some(e => e.entityId === entityId)
        expect(entityInFullPhysics).toBe(true)
        
        // Remove gravity component
        yield* world.removeComponent(entityId, 'gravity')
        
        // Should no longer appear in full physics query
        const physicsQueryAfterRemoval = yield* world.query('position', 'velocity', 'gravity', 'collider')
        const entityStillInFullPhysics = physicsQueryAfterRemoval.some(e => e.entityId === entityId)
        expect(entityStillInFullPhysics).toBe(false)
        
        // But should still appear in partial physics query
        const partialPhysicsQuery = yield* world.query('position', 'velocity', 'collider')
        const entityInPartialPhysics = partialPhysicsQuery.some(e => e.entityId === entityId)
        expect(entityInPartialPhysics).toBe(true)
        
        return { entityId, componentsAdded: 3, componentsRemoved: 1 }
      }).pipe(withGameHarness)
    )
  })

  describe('System Interaction Testing', () => {
    it.effect('should handle physics system with large entity counts', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Create physics simulation scenario
        const entityCount = 1000
        const simulationFrames = 60 // 1 second at 60fps
        
        const physicsTest = yield* perfTester.runBenchmark(
          'physics-system-stress-test',
          `Physics simulation with ${entityCount} entities`,
          Effect.gen(function* () {
            const testHarness = yield* Effect.service(GameTestHarness)
            const world = yield* Effect.service('World')
            
            // Create entities with physics components
            const entities: EntityId[] = []
            for (let i = 0; i < entityCount; i++) {
              const entityId = yield* world.addArchetype({
                components: {
                  position: {
                    x: (Math.random() - 0.5) * 200,
                    y: 64 + Math.random() * 50,
                    z: (Math.random() - 0.5) * 200
                  },
                  velocity: {
                    dx: (Math.random() - 0.5) * 20,
                    dy: Math.random() * 10,
                    dz: (Math.random() - 0.5) * 20
                  },
                  gravity: { value: -9.8 }
                }
              })
              entities.push(entityId)
            }
            
            // Simulate physics for multiple frames
            for (let frame = 0; frame < simulationFrames; frame++) {
              const delta = 1.0 / 60.0 // 60 FPS
              
              // Update all physics entities
              for (const entityId of entities) {
                const velocity = yield* world.getComponentUnsafe(entityId, 'velocity')
                const position = yield* world.getComponentUnsafe(entityId, 'position')
                const gravity = yield* world.getComponentUnsafe(entityId, 'gravity')
                
                // Apply gravity
                const newVelocity = {
                  dx: velocity.dx,
                  dy: velocity.dy + gravity.value * delta,
                  dz: velocity.dz
                }
                
                // Update position
                const newPosition = {
                  x: position.x + newVelocity.dx * delta,
                  y: Math.max(60, position.y + newVelocity.dy * delta), // Ground at y=60
                  z: position.z + newVelocity.dz * delta
                }
                
                // Ground collision
                if (newPosition.y <= 60) {
                  newVelocity.dy = 0
                  newPosition.y = 60
                }
                
                yield* world.updateComponent(entityId, 'velocity', newVelocity)
                yield* world.updateComponent(entityId, 'position', newPosition)
              }
            }
            
            return { entitiesSimulated: entities.length, framesSimulated: simulationFrames }
          }),
          5000, // 5 second test
          30 // Lower FPS target for stress test
        )
        
        expect(physicsTest.summary.passed).toBe(true)
        expect(physicsTest.summary.averageFPS).toBeGreaterThan(25)
        
        return { benchmark: physicsTest }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should handle rendering system with complex scenes', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Create complex scene with various renderable entities
        const sceneEntities: EntityId[] = []
        
        // Create a large structure with varied materials
        for (let level = 0; level < 10; level++) {
          const size = 10 - level
          for (let x = -size; x <= size; x++) {
            for (let z = -size; z <= size; z++) {
              if (x === -size || x === size || z === -size || z === size) {
                // Only place blocks on the perimeter to create hollow structure
                const entityId = yield* world.addArchetype({
                  components: {
                    position: { x, y: 64 + level, z },
                    mesh: {
                      vertices: new Float32Array([
                        0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, // Face vertices
                        0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1
                      ]),
                      indices: new Uint16Array([
                        0, 1, 2, 2, 3, 0, // Front face
                        4, 5, 6, 6, 7, 4  // Back face
                      ])
                    },
                    renderable: {
                      visible: true,
                      castShadow: level < 5, // Only lower levels cast shadows
                      material: level % 3 === 0 ? 'stone' : level % 3 === 1 ? 'wood' : 'dirt'
                    }
                  }
                })
                sceneEntities.push(entityId)
              }
            }
          }
        }
        
        // Add some animated entities
        for (let i = 0; i < 50; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: {
                x: (Math.random() - 0.5) * 50,
                y: 65 + Math.random() * 20,
                z: (Math.random() - 0.5) * 50
              },
              velocity: {
                dx: (Math.random() - 0.5) * 2,
                dy: 0,
                dz: (Math.random() - 0.5) * 2
              },
              mesh: {
                vertices: new Float32Array([0, 0, 0, 0.5, 0.5, 0.5]),
                indices: new Uint16Array([0, 1, 2])
              },
              renderable: {
                visible: true,
                castShadow: false,
                material: 'particle'
              }
            }
          })
          sceneEntities.push(entityId)
        }
        
        // Query rendering statistics
        const renderableEntities = yield* world.query('position', 'mesh', 'renderable')
        const shadowCasters = renderableEntities.filter(entity => {
          return entity.components.renderable.castShadow
        })
        const animatedEntities = yield* world.query('position', 'velocity', 'mesh', 'renderable')
        
        // Simulate rendering updates for animated entities
        for (let frame = 0; frame < 30; frame++) {
          for (const entity of animatedEntities) {
            const position = entity.components.position
            const velocity = entity.components.velocity
            
            yield* world.updateComponent(entity.entityId, 'position', {
              x: position.x + velocity.dx * 0.016,
              y: position.y,
              z: position.z + velocity.dz * 0.016
            })
          }
        }
        
        expect(renderableEntities.length).toBeGreaterThan(200)
        expect(shadowCasters.length).toBeGreaterThan(50)
        expect(animatedEntities.length).toBe(50)
        
        return {
          totalRenderables: renderableEntities.length,
          shadowCasters: shadowCasters.length,
          animatedEntities: animatedEntities.length,
          staticEntities: renderableEntities.length - animatedEntities.length
        }
      }).pipe(withGameHarness)
    )

    it.effect('should handle collision detection with multiple entity types', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Create collision test scenario
        const staticObstacles: EntityId[] = []
        const movingEntities: EntityId[] = []
        
        // Create static obstacles in a grid
        for (let x = -5; x <= 5; x += 2) {
          for (let z = -5; z <= 5; z += 2) {
            const entityId = yield* world.addArchetype({
              components: {
                position: { x, y: 64, z },
                collider: { width: 1, height: 2, depth: 1 },
                obstacle: { type: 'static' }
              }
            })
            staticObstacles.push(entityId)
          }
        }
        
        // Create moving entities that will collide with obstacles
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2
          const radius = 10
          const entityId = yield* world.addArchetype({
            components: {
              position: {
                x: Math.cos(angle) * radius,
                y: 64,
                z: Math.sin(angle) * radius
              },
              velocity: {
                dx: -Math.cos(angle) * 5, // Moving toward center
                dy: 0,
                dz: -Math.sin(angle) * 5
              },
              collider: { width: 0.5, height: 1, depth: 0.5 },
              moving: { type: 'dynamic' }
            }
          })
          movingEntities.push(entityId)
        }
        
        // Simulate movement and collision detection
        const collisions: Array<{ entityA: EntityId; entityB: EntityId; frame: number }> = []
        
        for (let frame = 0; frame < 120; frame++) { // 2 seconds at 60fps
          const delta = 1.0 / 60.0
          
          // Update moving entities
          for (const entityId of movingEntities) {
            const position = yield* world.getComponentUnsafe(entityId, 'position')
            const velocity = yield* world.getComponentUnsafe(entityId, 'velocity')
            const collider = yield* world.getComponentUnsafe(entityId, 'collider')
            
            const newPosition = {
              x: position.x + velocity.dx * delta,
              y: position.y + velocity.dy * delta,
              z: position.z + velocity.dz * delta
            }
            
            // Simple collision detection with static obstacles
            let collision = false
            for (const obstacleId of staticObstacles) {
              const obstaclePos = yield* world.getComponentUnsafe(obstacleId, 'position')
              const obstacleCollider = yield* world.getComponentUnsafe(obstacleId, 'collider')
              
              // AABB collision check
              const dx = Math.abs(newPosition.x - obstaclePos.x)
              const dz = Math.abs(newPosition.z - obstaclePos.z)
              
              if (dx < (collider.width + obstacleCollider.width) / 2 &&
                  dz < (collider.depth + obstacleCollider.depth) / 2) {
                collision = true
                collisions.push({ entityA: entityId, entityB: obstacleId, frame })
                
                // Bounce off obstacle
                const bounceVel = {
                  dx: velocity.dx * -0.5,
                  dy: velocity.dy,
                  dz: velocity.dz * -0.5
                }
                yield* world.updateComponent(entityId, 'velocity', bounceVel)
                break
              }
            }
            
            if (!collision) {
              yield* world.updateComponent(entityId, 'position', newPosition)
            }
          }
        }
        
        expect(staticObstacles.length).toBe(36) // 6x6 grid
        expect(movingEntities.length).toBe(20)
        expect(collisions.length).toBeGreaterThan(5) // Should have some collisions
        
        return {
          staticObstacles: staticObstacles.length,
          movingEntities: movingEntities.length,
          totalCollisions: collisions.length,
          firstCollisionFrame: collisions[0]?.frame || -1
        }
      }).pipe(withGameHarness)
    )
  })

  describe('Component System Stress Testing', () => {
    it.effect('should handle rapid component updates without degradation', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Create test entities
        const testEntities: EntityId[] = []
        for (let i = 0; i < 500; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: { x: i % 50, y: 64, z: Math.floor(i / 50) },
              velocity: { dx: 0, dy: 0, dz: 0 },
              health: { current: 100, maximum: 100 },
              status: { effects: [] }
            }
          })
          testEntities.push(entityId)
        }
        
        // Perform rapid updates
        const updateCycles = 1000
        const startTime = Date.now()
        
        for (let cycle = 0; cycle < updateCycles; cycle++) {
          // Update random entities
          const entityToUpdate = testEntities[Math.floor(Math.random() * testEntities.length)]
          
          // Random component update
          const updateType = Math.floor(Math.random() * 4)
          
          switch (updateType) {
            case 0: // Position update
              yield* world.updateComponent(entityToUpdate, 'position', {
                x: Math.random() * 100,
                y: 64 + Math.random() * 10,
                z: Math.random() * 100
              })
              break
              
            case 1: // Velocity update
              yield* world.updateComponent(entityToUpdate, 'velocity', {
                dx: (Math.random() - 0.5) * 10,
                dy: (Math.random() - 0.5) * 10,
                dz: (Math.random() - 0.5) * 10
              })
              break
              
            case 2: // Health update
              const currentHealth = yield* world.getComponentUnsafe(entityToUpdate, 'health')
              yield* world.updateComponent(entityToUpdate, 'health', {
                current: Math.max(0, currentHealth.current + (Math.random() - 0.5) * 20),
                maximum: currentHealth.maximum
              })
              break
              
            case 3: // Status update
              yield* world.updateComponent(entityToUpdate, 'status', {
                effects: [`effect_${Math.floor(Math.random() * 10)}`]
              })
              break
          }
          
          // Occasional query to test performance
          if (cycle % 100 === 0) {
            const queryResults = yield* world.query('position', 'velocity')
            expect(queryResults.length).toBe(testEntities.length)
          }
        }
        
        const updateTime = Date.now() - startTime
        const updatesPerSecond = (updateCycles * 1000) / updateTime
        
        // Verify system integrity after stress test
        const finalQuery = yield* world.query('position', 'velocity', 'health', 'status')
        expect(finalQuery.length).toBe(testEntities.length)
        
        // Performance should be reasonable
        expect(updatesPerSecond).toBeGreaterThan(1000) // At least 1000 updates/sec
        
        return {
          entitiesStressed: testEntities.length,
          updateCycles: updateCycles,
          updateTime: updateTime,
          updatesPerSecond: Math.round(updatesPerSecond)
        }
      }).pipe(withGameHarness)
    )
  })
})

// Extend vitest with Effect support for this file
declare module 'vitest' {
  interface TestAPI {
    effect: <A, E>(name: string, effect: Effect.Effect<A, E, never>) => void
  }
}

const originalIt = it
// @ts-ignore
originalIt.effect = function<A, E>(name: string, effect: Effect.Effect<A, E, never>) {
  return originalIt(name, async () => {
    const result = await Effect.runPromise(effect)
    return result
  })
}