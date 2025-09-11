import { Effect } from 'effect'
import { 
  startOptimizedRuntime,
  OptimizedRuntimeLayer,
  benchmarkOptimizedRuntime,
  defaultOptimizedConfig,
  type OptimizedRuntimeConfig,
  type PrioritizedSystem
} from './optimized-runtime'
import { withPooledEntity, withPooledComponent } from './memory-pools'
import { withResourceManager, loadTexture } from './resource-manager'
import { Profile } from '@/core/performance'

/**
 * Example game systems with priority levels
 */

// Critical systems - must run every frame
const physicsSystem: PrioritizedSystem<never, never> = {
  system: Effect.gen(function* () {
    yield* Profile.measure('physics_update')(Effect.void)
  }),
  priority: 'critical',
  name: 'physics',
  maxExecutionTime: 5, // 5ms max
  canSkip: false
}

const renderSystem: PrioritizedSystem<never, never> = {
  system: Effect.gen(function* () {
    yield* Profile.measure('render_update')(Effect.void)
  }),
  priority: 'critical',
  name: 'render',
  maxExecutionTime: 10, // 10ms max
  canSkip: false
}

// High priority systems - important but can be delayed slightly
const inputSystem: PrioritizedSystem<never, never> = {
  system: Effect.gen(function* () {
    yield* Profile.measure('input_processing')(Effect.void)
  }),
  priority: 'high',
  name: 'input',
  maxExecutionTime: 2,
  canSkip: false
}

const audioSystem: PrioritizedSystem<never, never> = {
  system: Effect.gen(function* () {
    yield* Profile.measure('audio_update')(Effect.void)
  }),
  priority: 'high',
  name: 'audio',
  canSkip: true // Audio can be skipped if needed
}

// Normal priority systems
const networkSystem: PrioritizedSystem<never, never> = {
  system: Effect.gen(function* () {
    yield* Profile.measure('network_sync')(Effect.void)
  }),
  priority: 'normal',
  name: 'network',
  canSkip: true
}

const uiSystem: PrioritizedSystem<never, never> = {
  system: Effect.gen(function* () {
    yield* Profile.measure('ui_update')(Effect.void)
  }),
  priority: 'normal',
  name: 'ui',
  canSkip: true
}

// Low priority systems - can be deferred
const analyticsSystem: PrioritizedSystem<never, never> = {
  system: Effect.gen(function* () {
    yield* Profile.measure('analytics_collection')(Effect.void)
  }),
  priority: 'low',
  name: 'analytics',
  canSkip: true
}

const debugSystem: PrioritizedSystem<never, never> = {
  system: Effect.gen(function* () {
    yield* Profile.measure('debug_overlay')(Effect.void)
  }),
  priority: 'low',
  name: 'debug',
  canSkip: true
}

/**
 * Complete example of optimized runtime usage
 */
export const exampleOptimizedMinecraft = () => {
  // Define all game systems with priorities
  const gameSystems: PrioritizedSystem<never, never>[] = [
    physicsSystem,
    renderSystem,
    inputSystem,
    audioSystem,
    networkSystem,
    uiSystem,
    analyticsSystem,
    debugSystem
  ]

  // Custom configuration for high-performance setup
  const highPerformanceConfig: OptimizedRuntimeConfig = {
    ...defaultOptimizedConfig,
    gameLoop: {
      ...defaultOptimizedConfig.gameLoop,
      targetFPS: 60,
      priorityThreshold: 16, // 16ms budget per frame
      enableAdaptiveQuality: true
    },
    resourceManager: {
      ...defaultOptimizedConfig.resourceManager,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB for high-end systems
      maxCacheSize: 20000
    },
    quality: {
      initial: 'high',
      adaptive: true,
      targetFPS: 60
    },
    monitoring: {
      enableFPSCounter: true,
      enableMemoryDetection: true,
      enableProfiling: true,
      reportInterval: 30000,
      autoQualityAdjustment: true
    }
  }

  // Create runtime program
  const runtimeProgram = startOptimizedRuntime(gameSystems, highPerformanceConfig)

  // Provide runtime layer and run
  return runtimeProgram.pipe(
    Effect.provide(OptimizedRuntimeLayer(highPerformanceConfig))
  )
}

/**
 * Example of using memory pools for entity management
 */
export const exampleMemoryPoolUsage = () =>
  Effect.gen(function* () {
    yield* Effect.log('Demonstrating Memory Pool Usage')

    // Create and manage entities using pools
    yield* withPooledEntity('player_1', entity => 
      Effect.gen(function* () {
        yield* Effect.log(`Created pooled entity: ${entity.id}`)
        
        // Add components using pools
        yield* withPooledComponent('transform', entity.id, { x: 0, y: 0, z: 0 }, _component =>
          Effect.gen(function* () {
            yield* Effect.log(`Added transform component to ${entity.id}`)
            entity.addComponent('transform')
            return Effect.void
          })
        )
        
        yield* withPooledComponent('velocity', entity.id, { vx: 0, vy: 0, vz: 0 }, _component =>
          Effect.gen(function* () {
            yield* Effect.log(`Added velocity component to ${entity.id}`)
            entity.addComponent('velocity')
            return Effect.void
          })
        )

        yield* Effect.log(`Entity ${entity.id} has components: ${entity.getComponents().join(', ')}`)
        return Effect.void
      })
    )

    yield* Effect.log('Memory pool usage example completed')
  })

/**
 * Example of resource loading and management
 */
export const exampleResourceManagement = () =>
  withResourceManager(manager =>
    Effect.gen(function* () {
      yield* Effect.log('Demonstrating Resource Management')

      // Load textures with different priorities
      const playerTexture = loadTexture('/textures/player.png', 'high')
      const grassTexture = loadTexture('/textures/grass.png', 'normal')
      const backgroundMusic = loadTexture('/audio/background.mp3', 'low') // Example

      // Load resources
      yield* Effect.all([
        manager.load(playerTexture),
        manager.load(grassTexture),
        manager.load(backgroundMusic)
      ])

      yield* Effect.log('All resources loaded successfully')

      // Get resource statistics
      const stats = yield* manager.getStats()
      yield* Effect.log(`Resource cache hit rate: ${(stats.cacheStats.hitRate * 100).toFixed(1)}%`)
      yield* Effect.log(`Memory usage: ${(stats.cacheStats.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
    })
  )

/**
 * Performance testing and benchmarking
 */
export const examplePerformanceTesting = () =>
  Effect.gen(function* () {
    yield* Effect.log('Starting Performance Benchmark...')

    // Run benchmark
    const results = yield* benchmarkOptimizedRuntime()

    // Evaluate results
    const performance = results.overallScore >= 0.8 ? 'Excellent' :
                       results.overallScore >= 0.6 ? 'Good' :
                       results.overallScore >= 0.4 ? 'Fair' : 'Poor'

    yield* Effect.log(`Performance Assessment: ${performance}`)

    // Performance targets check
    const meetsTargets = {
      fps: results.fps >= 50, // At least 50 FPS
      memory: results.memoryEfficiency >= 0.7, // At least 70% memory efficiency
      cache: results.resourceCachePerformance >= 0.8, // At least 80% cache hit rate
      pools: results.poolEfficiency >= 0.6 // At least 60% pool efficiency
    }

    const allTargetsMet = Object.values(meetsTargets).every(met => met)

    if (allTargetsMet) {
      yield* Effect.log('🎉 All performance targets met!')
    } else {
      yield* Effect.log('⚠️ Some performance targets not met:')
      
      if (!meetsTargets.fps) {
        yield* Effect.log(`  - FPS: ${results.fps.toFixed(1)} (target: ≥50)`)
      }
      if (!meetsTargets.memory) {
        yield* Effect.log(`  - Memory efficiency: ${(results.memoryEfficiency * 100).toFixed(1)}% (target: ≥70%)`)
      }
      if (!meetsTargets.cache) {
        yield* Effect.log(`  - Cache hit rate: ${(results.resourceCachePerformance * 100).toFixed(1)}% (target: ≥80%)`)
      }
      if (!meetsTargets.pools) {
        yield* Effect.log(`  - Pool efficiency: ${(results.poolEfficiency * 100).toFixed(1)}% (target: ≥60%)`)
      }
    }

    return results
  }).pipe(
    Effect.provide(OptimizedRuntimeLayer())
  )

/**
 * Full demo program combining all optimizations
 */
export const runOptimizedMinecraftDemo = () => {
  const program = Effect.gen(function* () {
    yield* Effect.log('🎮 Starting Optimized TypeScript Minecraft Demo')

    // 1. Start the optimized runtime
    const systems: PrioritizedSystem<never, never>[] = [
      physicsSystem,
      renderSystem,
      inputSystem,
      audioSystem,
      networkSystem,
      uiSystem,
      analyticsSystem,
      debugSystem
    ]

    const runtimeFiber = startOptimizedRuntime(systems).pipe(Effect.fork)
    yield* runtimeFiber

    // 2. Demonstrate memory pool usage
    yield* exampleMemoryPoolUsage()

    // 3. Demonstrate resource management
    yield* exampleResourceManagement()

    // 4. Let it run for a bit to collect performance data
    yield* Effect.sleep(5000) // 5 seconds

    // 5. Run performance benchmark
    const benchmarkResults = yield* benchmarkOptimizedRuntime()

    yield* Effect.log('📊 Final Performance Summary:')
    yield* Effect.log('─'.repeat(50))
    yield* Effect.log(`🎯 Target Achievement:`)
    yield* Effect.log(`   60 FPS: ${benchmarkResults.fps >= 60 ? '✅' : '❌'} (${benchmarkResults.fps.toFixed(1)} FPS)`)
    yield* Effect.log(`   Memory < 300MB: ${benchmarkResults.memoryEfficiency >= 0.85 ? '✅' : '❌'}`)
    yield* Effect.log(`   Load Time < 1s: ⏱️ (simulated)`)
    yield* Effect.log(`   Chunk Load < 16ms: ⏱️ (simulated)`)
    
    const overallGrade = benchmarkResults.overallScore >= 0.9 ? 'S' :
                        benchmarkResults.overallScore >= 0.8 ? 'A' :
                        benchmarkResults.overallScore >= 0.7 ? 'B' :
                        benchmarkResults.overallScore >= 0.6 ? 'C' : 'D'
    
    yield* Effect.log(`🏆 Overall Grade: ${overallGrade} (${(benchmarkResults.overallScore * 100).toFixed(1)}/100)`)

    yield* Effect.log('✨ Optimized TypeScript Minecraft Demo completed successfully!')

    return benchmarkResults
  })

  return program.pipe(
    Effect.provide(OptimizedRuntimeLayer())
  )
}

// Export for testing
export const testSystems = [
  physicsSystem,
  renderSystem,
  inputSystem,
  audioSystem,
  networkSystem,
  uiSystem,
  analyticsSystem,
  debugSystem
]