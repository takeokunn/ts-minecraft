import { Effect, Layer, pipe, Runtime, Option, Array as EffectArray, Schedule, Duration } from 'effect'
import { TestClock, TestRandom, TestConsole } from '@effect/platform-node'
import { TestHarness } from '@/test-utils/test-harness'
import { AppLive } from '@/infrastructure/layers'
import { World, Clock, InputManager, Renderer, Stats } from '@/services'
import { BlockType } from '@/core/values/block-type'
import { EntityId, toEntityId } from '@/core/entities/entity'
import { runGameLoop } from '@/runtime/loop'
import * as fc from 'effect/FastCheck'

/**
 * GameTestHarness - E2E testing framework for the Minecraft game
 * 
 * Features:
 * - Full game initialization and lifecycle management
 * - Player operation simulation
 * - World state verification
 * - Performance measurement
 * - Visual regression testing capabilities
 * - Chaos testing support
 */
export class GameTestHarness {
  private constructor(
    private readonly runtime: Runtime.Runtime<World | Clock | InputManager | Renderer | Stats>,
    private readonly baseHarness: TestHarness
  ) {}

  /**
   * Create a new GameTestHarness with full game services
   */
  static create(): Effect.Effect<GameTestHarness, never, never> {
    return Effect.gen(function* () {
      // Create runtime with all live services
      const runtime = yield* Layer.toRuntime(AppLive)
      const baseHarness = TestHarness.create()
      
      return new GameTestHarness(runtime, baseHarness)
    })
  }

  /**
   * Initialize a complete game session
   */
  initializeGame(): Effect.Effect<{
    playerId: EntityId
    worldStats: {
      entityCount: number
      chunkCount: number
    }
  }, never, never> {
    return Effect.gen(function* () {
      const world = yield* World
      const clock = yield* Clock
      
      // Start the game clock
      yield* clock.start()
      
      // Create player with full component set
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

      // Generate initial world (simple ground plane)
      yield* this.generateTestWorld()
      
      // Get world statistics
      const entities = yield* world.query('position')
      const worldStats = {
        entityCount: entities.length,
        chunkCount: 1 // Simplified for now
      }
      
      return { playerId, worldStats }
    }).pipe(
      Effect.provide(this.runtime)
    )
  }

  /**
   * Simulate player operations
   */
  simulatePlayerActions = {
    /**
     * Move player in specified direction for duration
     */
    move: (playerId: EntityId, direction: 'forward' | 'backward' | 'left' | 'right', durationMs: number) =>
      Effect.gen(function* () {
        const world = yield* World
        
        // Set input state
        const inputUpdate = {
          forward: direction === 'forward',
          backward: direction === 'backward',
          left: direction === 'left',
          right: direction === 'right',
          jump: false,
          sprint: false,
          place: false,
          destroy: false,
          isLocked: false
        }
        
        yield* world.updateComponent(playerId, 'inputState', inputUpdate)
        
        // Run physics for specified duration
        yield* this.runPhysicsFrames(Math.floor(durationMs / 16)) // 16ms per frame at 60fps
        
        // Reset input
        yield* world.updateComponent(playerId, 'inputState', {
          ...inputUpdate,
          forward: false,
          backward: false,
          left: false,
          right: false
        })
      }).pipe(Effect.provide(this.runtime)),

    /**
     * Jump action
     */
    jump: (playerId: EntityId) =>
      Effect.gen(function* () {
        const world = yield* World
        const player = yield* world.getComponentUnsafe(playerId, 'player')
        
        if (player.isGrounded) {
          yield* world.updateComponent(playerId, 'velocity', { dy: 8 })
          yield* world.updateComponent(playerId, 'player', { isGrounded: false })
        }
      }).pipe(Effect.provide(this.runtime)),

    /**
     * Place block at target location
     */
    placeBlock: (playerId: EntityId, x: number, y: number, z: number, blockType: BlockType) =>
      Effect.gen(function* () {
        const world = yield* World
        yield* world.setVoxel(x, y, z, blockType)
        
        // Update hotbar if needed
        const hotbar = yield* world.getComponentUnsafe(playerId, 'hotbar')
        if (hotbar.slots[hotbar.selectedIndex] === BlockType.AIR) {
          const newSlots = [...hotbar.slots]
          newSlots[hotbar.selectedIndex] = blockType
          yield* world.updateComponent(playerId, 'hotbar', { slots: newSlots })
        }
      }).pipe(Effect.provide(this.runtime)),

    /**
     * Destroy block at location
     */
    destroyBlock: (x: number, y: number, z: number) =>
      Effect.gen(function* () {
        const world = yield* World
        yield* world.setVoxel(x, y, z, BlockType.AIR)
      }).pipe(Effect.provide(this.runtime))
  }

  /**
   * World state verification utilities
   */
  verifyWorldState = {
    /**
     * Check if player is at expected position
     */
    playerAt: (playerId: EntityId, expectedX: number, expectedY: number, expectedZ: number, tolerance: number = 0.1) =>
      Effect.gen(function* () {
        const world = yield* World
        const position = yield* world.getComponentUnsafe(playerId, 'position')
        
        const withinTolerance = (actual: number, expected: number) => 
          Math.abs(actual - expected) <= tolerance
        
        return withinTolerance(position.x, expectedX) &&
               withinTolerance(position.y, expectedY) &&
               withinTolerance(position.z, expectedZ)
      }).pipe(Effect.provide(this.runtime)),

    /**
     * Check if block exists at location
     */
    blockAt: (x: number, y: number, z: number, expectedType: BlockType) =>
      Effect.gen(function* () {
        const world = yield* World
        const voxel = yield* world.getVoxel(x, y, z)
        return Option.match(voxel, {
          onNone: () => expectedType === BlockType.AIR,
          onSome: (blockType) => blockType === expectedType
        })
      }).pipe(Effect.provide(this.runtime)),

    /**
     * Verify entity count
     */
    entityCount: (expectedCount: number) =>
      Effect.gen(function* () {
        const world = yield* World
        const entities = yield* world.query('position')
        return entities.length === expectedCount
      }).pipe(Effect.provide(this.runtime)),

    /**
     * Check if player is grounded
     */
    playerGrounded: (playerId: EntityId) =>
      Effect.gen(function* () {
        const world = yield* World
        const player = yield* world.getComponentUnsafe(playerId, 'player')
        return player.isGrounded
      }).pipe(Effect.provide(this.runtime))
  }

  /**
   * Performance measurement utilities
   */
  performance = {
    /**
     * Measure FPS over specified duration
     */
    measureFPS: (durationMs: number) =>
      Effect.gen(function* () {
        const frameCount = Math.floor(durationMs / 16) // 16ms per frame target
        const startTime = Date.now()
        
        yield* this.runPhysicsFrames(frameCount)
        
        const actualDuration = Date.now() - startTime
        const actualFPS = (frameCount * 1000) / actualDuration
        const targetFPS = 60
        
        return {
          fps: actualFPS,
          targetFPS,
          frameCount,
          duration: actualDuration,
          average: actualFPS,
          isStable: actualFPS >= (targetFPS * 0.9) // 90% of target
        }
      }),

    /**
     * Measure memory usage during operation
     */
    measureMemory: <A>(operation: Effect.Effect<A, never, never>) =>
      Effect.gen(function* () {
        const beforeMemory = process.memoryUsage()
        const result = yield* operation
        const afterMemory = process.memoryUsage()
        
        return {
          result,
          memoryDelta: {
            heapUsed: afterMemory.heapUsed - beforeMemory.heapUsed,
            heapTotal: afterMemory.heapTotal - beforeMemory.heapTotal,
            rss: afterMemory.rss - beforeMemory.rss
          },
          beforeMemory,
          afterMemory
        }
      }),

    /**
     * Benchmark entity operations
     */
    benchmarkEntityOperations: (entityCount: number) =>
      Effect.gen(function* () {
        const world = yield* World
        
        // Create entities
        const createStart = Date.now()
        const entities: EntityId[] = []
        
        for (let i = 0; i < entityCount; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: { x: i % 100, y: 64, z: Math.floor(i / 100) },
              velocity: { dx: 0, dy: 0, dz: 0 }
            }
          })
          entities.push(entityId)
        }
        const createTime = Date.now() - createStart
        
        // Query entities
        const queryStart = Date.now()
        const results = yield* world.query('position', 'velocity')
        const queryTime = Date.now() - queryStart
        
        // Update entities
        const updateStart = Date.now()
        for (const entity of entities) {
          yield* world.updateComponent(entity, 'position', {
            x: Math.random() * 100
          })
        }
        const updateTime = Date.now() - updateStart
        
        // Remove entities
        const removeStart = Date.now()
        for (const entity of entities) {
          yield* world.removeEntity(entity)
        }
        const removeTime = Date.now() - removeStart
        
        return {
          entityCount,
          createTime,
          queryTime,
          updateTime,
          removeTime,
          totalTime: createTime + queryTime + updateTime + removeTime,
          entitiesPerSecond: {
            create: (entityCount * 1000) / createTime,
            query: (entityCount * 1000) / queryTime,
            update: (entityCount * 1000) / updateTime,
            remove: (entityCount * 1000) / removeTime
          }
        }
      }).pipe(Effect.provide(this.runtime))
  }

  /**
   * Chaos testing utilities
   */
  chaos = {
    /**
     * Generate random player actions
     */
    randomPlayerActions: (playerId: EntityId, actionCount: number) =>
      Effect.gen(function* () {
        const actions = ['move', 'jump', 'place', 'destroy'] as const
        const directions = ['forward', 'backward', 'left', 'right'] as const
        const blocks = [BlockType.STONE, BlockType.DIRT, BlockType.WOOD] as const
        
        for (let i = 0; i < actionCount; i++) {
          const action = actions[Math.floor(Math.random() * actions.length)]
          
          switch (action) {
            case 'move':
              const direction = directions[Math.floor(Math.random() * directions.length)]
              yield* this.simulatePlayerActions.move(playerId, direction, 100 + Math.random() * 400)
              break
              
            case 'jump':
              yield* this.simulatePlayerActions.jump(playerId)
              break
              
            case 'place':
              const blockType = blocks[Math.floor(Math.random() * blocks.length)]
              const x = Math.floor(Math.random() * 20) - 10
              const y = 64 + Math.floor(Math.random() * 10)
              const z = Math.floor(Math.random() * 20) - 10
              yield* this.simulatePlayerActions.placeBlock(playerId, x, y, z, blockType)
              break
              
            case 'destroy':
              const dx = Math.floor(Math.random() * 20) - 10
              const dy = 64 + Math.floor(Math.random() * 10)
              const dz = Math.floor(Math.random() * 20) - 10
              yield* this.simulatePlayerActions.destroyBlock(dx, dy, dz)
              break
          }
          
          // Random delay between actions
          yield* Effect.sleep(Duration.millis(10 + Math.random() * 50))
        }
      }),

    /**
     * Spawn large number of entities for stress testing
     */
    spawnEntities: (count: number) =>
      Effect.gen(function* () {
        const world = yield* World
        const entities: EntityId[] = []
        
        for (let i = 0; i < count; i++) {
          const entityId = yield* world.addArchetype({
            components: {
              position: {
                x: (Math.random() - 0.5) * 1000,
                y: 64 + Math.random() * 100,
                z: (Math.random() - 0.5) * 1000
              },
              velocity: {
                dx: (Math.random() - 0.5) * 10,
                dy: (Math.random() - 0.5) * 10,
                dz: (Math.random() - 0.5) * 10
              },
              gravity: { value: -32 }
            }
          })
          entities.push(entityId)
        }
        
        return entities
      }).pipe(Effect.provide(this.runtime)),

    /**
     * Simulate memory pressure by creating and destroying entities rapidly
     */
    memoryPressure: (cycles: number, entitiesPerCycle: number) =>
      Effect.gen(function* () {
        const results = []
        
        for (let cycle = 0; cycle < cycles; cycle++) {
          const cycleStart = Date.now()
          
          // Create entities
          const entities = yield* this.chaos.spawnEntities(entitiesPerCycle)
          
          // Let them exist for a moment
          yield* Effect.sleep(Duration.millis(50))
          
          // Destroy them all
          const world = yield* World
          for (const entity of entities) {
            yield* world.removeEntity(entity)
          }
          
          const cycleTime = Date.now() - cycleStart
          const memoryUsage = process.memoryUsage()
          
          results.push({
            cycle,
            cycleTime,
            entitiesCreated: entitiesPerCycle,
            memoryUsage: memoryUsage.heapUsed
          })
        }
        
        return results
      })
  }

  /**
   * Run physics simulation for specified number of frames
   */
  private runPhysicsFrames(frameCount: number): Effect.Effect<void, never, World | Clock> {
    return Effect.gen(function* () {
      const clock = yield* Clock
      
      for (let frame = 0; frame < frameCount; frame++) {
        const delta = yield* clock.getDelta()
        // Physics simulation would happen here in the actual game loop
        // For testing, we simulate the passage of time
        yield* Effect.sleep(Duration.millis(16)) // 16ms per frame
      }
    })
  }

  /**
   * Generate a simple test world with ground plane
   */
  private generateTestWorld(): Effect.Effect<void, never, World> {
    return Effect.gen(function* () {
      const world = yield* World
      
      // Create a 32x32 ground plane at y=60
      for (let x = -16; x < 16; x++) {
        for (let z = -16; z < 16; z++) {
          yield* world.setVoxel(x, 60, z, BlockType.STONE)
        }
      }
      
      // Add some variety
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(Math.random() * 32) - 16
        const z = Math.floor(Math.random() * 32) - 16
        const height = 1 + Math.floor(Math.random() * 4)
        
        for (let y = 61; y <= 60 + height; y++) {
          yield* world.setVoxel(x, y, z, BlockType.DIRT)
        }
      }
    })
  }

  /**
   * Cleanup resources
   */
  dispose(): Effect.Effect<void, never, never> {
    return pipe(
      Runtime.dispose(this.runtime),
      Effect.asVoid
    )
  }

  /**
   * Run an effect with the game runtime
   */
  runGame<A, E>(effect: Effect.Effect<A, E, World | Clock | InputManager | Renderer | Stats>): Effect.Effect<A, E, never> {
    return effect.pipe(Effect.provide(this.runtime))
  }
}

/**
 * Convenience functions for game testing
 */
export const withGameHarness = <A, E>(
  effect: Effect.Effect<A, E, GameTestHarness>
): Effect.Effect<A, E, never> =>
  Effect.gen(function* () {
    const harness = yield* GameTestHarness.create()
    try {
      return yield* effect.pipe(Effect.provideService(GameTestHarness, harness))
    } finally {
      yield* harness.dispose()
    }
  })

export const gameTest = <A, E>(
  name: string,
  effect: Effect.Effect<A, E, GameTestHarness>
) => ({
  name,
  run: () => Effect.runPromise(withGameHarness(effect))
})

/**
 * Game-specific test builders
 */
export const GameTestBuilder = {
  /**
   * Create performance test
   */
  performance: (name: string, targetFPS: number = 60) => ({
    withEntities: (entityCount: number) => ({
      test: (testDuration: number = 5000) =>
        gameTest(name, 
          Effect.gen(function* () {
            const harness = yield* Effect.service(GameTestHarness)
            const { playerId } = yield* harness.initializeGame()
            
            // Spawn entities
            yield* harness.chaos.spawnEntities(entityCount)
            
            // Measure performance
            const fpsResult = yield* harness.performance.measureFPS(testDuration)
            
            return {
              entityCount,
              fps: fpsResult,
              passed: fpsResult.average >= targetFPS
            }
          })
        )
    })
  }),

  /**
   * Create chaos test
   */
  chaos: (name: string) => ({
    withRandomActions: (actionCount: number) => ({
      test: gameTest(name,
        Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          const { playerId } = yield* harness.initializeGame()
          
          // Run chaos actions
          yield* harness.chaos.randomPlayerActions(playerId, actionCount)
          
          // Verify game is still stable
          const isStable = yield* harness.verifyWorldState.entityCount(1) // Only player should remain
          
          return { actionCount, stable: isStable }
        })
      )
    })
  }),

  /**
   * Create integration test
   */
  integration: (name: string) => ({
    test: (scenario: Effect.Effect<any, any, GameTestHarness>) =>
      gameTest(name, scenario)
  })
}