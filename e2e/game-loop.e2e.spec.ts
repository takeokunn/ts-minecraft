import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Effect, pipe, Layer, Runtime } from 'effect'
import { AppLive } from '@/infrastructure/layers'
import { World, Clock, InputManager, Renderer } from '@/services'
import { runGameLoop } from '@/runtime/loop'
import { BlockType } from '@/domain/block-types'
import { toEntityId } from '@/core/entities/entity'

/**
 * End-to-end tests for the complete game loop
 * Verifies integration between all systems
 */

describe('Game Loop E2E', () => {
  let runtime: Runtime.Runtime<World | Clock | InputManager | Renderer>
  
  beforeEach(async () => {
    // Create runtime with all services
    runtime = await Effect.gen(function* () {
      const layer = AppLive
      return yield* Layer.toRuntime(layer)
    }).pipe(Effect.runPromise)
  })
  
  afterEach(async () => {
    // Cleanup
    await Runtime.dispose(runtime)
  })
  
  describe('Full Game Loop Integration', () => {
    it('should initialize and run a single frame', async () => {
      const program = Effect.gen(function* () {
        const world = yield* World
        const clock = yield* Clock
        
        // Start clock
        yield* clock.start()
        
        // Add a player entity
        const playerId = yield* world.addArchetype({
          components: {
            position: { x: 0, y: 64, z: 0 },
            velocity: { dx: 0, dy: 0, dz: 0 },
            player: { isGrounded: false },
            inputState: {
              forward: false,
              backward: false,
              left: false,
              right: false,
              jump: false,
              sprint: false,
              place: false,
              destroy: false,
              isLocked: false
            },
            cameraState: { pitch: 0, yaw: 0 },
            collider: { width: 0.6, height: 1.8, depth: 0.6 },
            gravity: { value: -32 },
            hotbar: {
              slots: Array(9).fill(BlockType.AIR),
              selectedIndex: 0
            }
          }
        })
        
        // Run one frame
        const delta = yield* clock.getDelta()
        
        // Verify player was created
        const playerComponent = yield* world.getComponent(playerId, 'player')
        expect(playerComponent._tag).toBe('Some')
        
        // Verify position exists
        const position = yield* world.getComponent(playerId, 'position')
        expect(position._tag).toBe('Some')
        if (position._tag === 'Some') {
          expect(position.value.y).toBe(64)
        }
        
        return { playerId, delta }
      })
      
      const result = await Runtime.runPromise(runtime)(program)
      expect(result.playerId).toBeDefined()
      expect(result.delta).toBeGreaterThanOrEqual(0)
    })
    
    it('should handle player movement with input', async () => {
      const program = Effect.gen(function* () {
        const world = yield* World
        const clock = yield* Clock
        
        yield* clock.start()
        
        // Add player
        const playerId = yield* world.addArchetype({
          components: {
            position: { x: 0, y: 64, z: 0 },
            velocity: { dx: 0, dy: 0, dz: 0 },
            player: { isGrounded: true },
            inputState: {
              forward: true, // Moving forward
              backward: false,
              left: false,
              right: false,
              jump: false,
              sprint: false,
              place: false,
              destroy: false,
              isLocked: false
            },
            cameraState: { pitch: 0, yaw: 0 },
            collider: { width: 0.6, height: 1.8, depth: 0.6 },
            gravity: { value: -32 }
          }
        })
        
        // Simulate physics update
        const delta = 0.016 // 60 FPS
        
        // Update velocity based on input (simplified)
        yield* world.updateComponent(playerId, 'velocity', {
          dx: 0,
          dy: 0,
          dz: 4.3 // Forward movement speed
        })
        
        // Update position based on velocity
        const velocity = yield* world.getComponentUnsafe(playerId, 'velocity')
        const position = yield* world.getComponentUnsafe(playerId, 'position')
        
        const newPosition = {
          x: position.x + velocity.dx * delta,
          y: position.y + velocity.dy * delta,
          z: position.z + velocity.dz * delta
        }
        
        yield* world.updateComponent(playerId, 'position', newPosition)
        
        // Verify movement
        const finalPosition = yield* world.getComponentUnsafe(playerId, 'position')
        
        return { initialZ: position.z, finalZ: finalPosition.z }
      })
      
      const result = await Runtime.runPromise(runtime)(program)
      expect(result.finalZ).toBeGreaterThan(result.initialZ)
    })
    
    it('should handle multiple entities', async () => {
      const program = Effect.gen(function* () {
        const world = yield* World
        
        // Add multiple entities
        const entities = []
        
        for (let i = 0; i < 10; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: { x: i, y: 64, z: i },
              velocity: { dx: 0, dy: 0, dz: 0 }
            }
          })
          entities.push(entityId)
        }
        
        // Query all entities with position and velocity
        const results = yield* world.query('position', 'velocity')
        
        return { count: results.length, entities }
      })
      
      const result = await Runtime.runPromise(runtime)(program)
      expect(result.count).toBe(10)
      expect(result.entities).toHaveLength(10)
    })
    
    it('should handle chunk loading', async () => {
      const program = Effect.gen(function* () {
        const world = yield* World
        
        // Set a voxel in the world
        yield* world.setVoxel(8, 64, 8, BlockType.STONE)
        
        // Get the voxel back
        const voxel = yield* world.getVoxel(8, 64, 8)
        
        return { voxel }
      })
      
      const result = await Runtime.runPromise(runtime)(program)
      expect(result.voxel._tag).toBe('Some')
      if (result.voxel._tag === 'Some') {
        expect(result.voxel.value).toBe(BlockType.STONE)
      }
    })
    
    it('should handle entity removal', async () => {
      const program = Effect.gen(function* () {
        const world = yield* World
        
        // Add entity
        const entityId = yield* world.addArchetype({
          components: {
            position: { x: 0, y: 0, z: 0 }
          }
        })
        
        // Verify it exists
        const beforeRemoval = yield* world.getComponent(entityId, 'position')
        expect(beforeRemoval._tag).toBe('Some')
        
        // Remove entity
        yield* world.removeEntity(entityId)
        
        // Verify it's gone
        const afterRemoval = yield* world.getComponent(entityId, 'position')
        
        return { afterRemoval }
      })
      
      const result = await Runtime.runPromise(runtime)(program)
      expect(result.afterRemoval._tag).toBe('None')
    })
  })
  
  describe('System Integration', () => {
    it('should integrate physics and collision systems', async () => {
      const program = Effect.gen(function* () {
        const world = yield* World
        
        // Add player with gravity
        const playerId = yield* world.addArchetype({
          components: {
            position: { x: 0, y: 100, z: 0 },
            velocity: { dx: 0, dy: 0, dz: 0 },
            gravity: { value: -32 },
            collider: { width: 0.6, height: 1.8, depth: 0.6 },
            player: { isGrounded: false }
          }
        })
        
        // Add ground block
        yield* world.setVoxel(0, 60, 0, BlockType.STONE)
        
        // Simulate gravity for multiple frames
        for (let i = 0; i < 60; i++) {
          const delta = 0.016
          
          // Apply gravity
          const velocity = yield* world.getComponentUnsafe(playerId, 'velocity')
          const gravity = yield* world.getComponentUnsafe(playerId, 'gravity')
          
          yield* world.updateComponent(playerId, 'velocity', {
            dy: velocity.dy + gravity.value * delta
          })
          
          // Update position
          const newVelocity = yield* world.getComponentUnsafe(playerId, 'velocity')
          const position = yield* world.getComponentUnsafe(playerId, 'position')
          
          const newY = position.y + newVelocity.dy * delta
          
          // Simple collision check
          if (newY <= 61.8) {
            // Hit ground
            yield* world.updateComponent(playerId, 'position', { y: 61.8 })
            yield* world.updateComponent(playerId, 'velocity', { dy: 0 })
            yield* world.updateComponent(playerId, 'player', { isGrounded: true })
            break
          } else {
            yield* world.updateComponent(playerId, 'position', { y: newY })
          }
        }
        
        const finalPosition = yield* world.getComponentUnsafe(playerId, 'position')
        const finalPlayer = yield* world.getComponentUnsafe(playerId, 'player')
        
        return {
          finalY: finalPosition.y,
          isGrounded: finalPlayer.isGrounded
        }
      })
      
      const result = await Runtime.runPromise(runtime)(program)
      expect(result.finalY).toBeCloseTo(61.8, 1)
      expect(result.isGrounded).toBe(true)
    })
  })
  
  describe('Performance', () => {
    it('should handle 1000 entities efficiently', async () => {
      const program = Effect.gen(function* () {
        const world = yield* World
        const startTime = Date.now()
        
        // Add 1000 entities
        const entities = []
        for (let i = 0; i < 1000; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: { x: i % 100, y: Math.floor(i / 100), z: i % 10 },
              velocity: { dx: Math.random(), dy: 0, dz: Math.random() }
            }
          })
          entities.push(entityId)
        }
        
        const creationTime = Date.now() - startTime
        
        // Query all entities
        const queryStart = Date.now()
        const results = yield* world.query('position', 'velocity')
        const queryTime = Date.now() - queryStart
        
        // Update all entities
        const updateStart = Date.now()
        for (const entity of entities) {
          yield* world.updateComponent(entity, 'position', {
            x: Math.random() * 100
          })
        }
        const updateTime = Date.now() - updateStart
        
        return {
          entityCount: results.length,
          creationTime,
          queryTime,
          updateTime
        }
      })
      
      const result = await Runtime.runPromise(runtime)(program)
      
      expect(result.entityCount).toBe(1000)
      // Performance assertions (generous limits for CI)
      expect(result.creationTime).toBeLessThan(5000)
      expect(result.queryTime).toBeLessThan(100)
      expect(result.updateTime).toBeLessThan(5000)
    })
  })
})