/**
 * System Registry - Centralized system management with scheduler integration
 * Configures all game systems with proper dependencies, priorities, and execution phases
 */

import { Effect, Duration } from 'effect'
import { SystemConfig, SystemFunction, SystemScheduler, createSystemScheduler } from './core/scheduler'

import { blockInteractionSystem } from './block-interaction'
import { cameraControlSystem } from './camera-control'
import { chunkLoadingSystem } from './chunk-loading'
import { collisionSystem } from './collision'
import { inputPollingSystem } from './input-polling'
import { physicsSystem } from './physics'
import { playerMovementSystem } from './player-movement'
import { updateTargetSystem } from './update-target-system'
import { createUISystem } from './ui'
import { updatePhysicsWorldSystem } from './update-physics-world'
import { worldUpdateSystem } from './world-update'

/**
 * System registry configuration
 */
export interface SystemRegistryConfig {
  readonly enableParallelExecution: boolean
  readonly maxConcurrency: number
  readonly targetFPS: number
  readonly enableProfiling: boolean
  readonly enableCommunication: boolean
}

export const defaultRegistryConfig: SystemRegistryConfig = {
  enableParallelExecution: true,
  maxConcurrency: 4,
  targetFPS: 60,
  enableProfiling: true,
  enableCommunication: true,
}

/**
 * System configurations with dependencies and execution phases
 */
const systemConfigurations: SystemConfig[] = [
  // Input Phase - Highest priority, run first
  {
    id: 'input-polling',
    name: 'Input Polling System',
    priority: 'critical',
    phase: 'input',
    dependencies: [],
    conflicts: [],
    maxExecutionTime: Duration.millis(2),
    enableProfiling: true,
  },

  // Update Phase - Game logic updates
  {
    id: 'player-movement',
    name: 'Player Movement System',
    priority: 'high',
    phase: 'update',
    dependencies: ['input-polling'],
    conflicts: [],
    maxExecutionTime: Duration.millis(4),
    enableProfiling: true,
  },
  {
    id: 'block-interaction',
    name: 'Block Interaction System',
    priority: 'high',
    phase: 'update',
    dependencies: ['input-polling'],
    conflicts: [],
    maxExecutionTime: Duration.millis(3),
    enableProfiling: true,
  },
  {
    id: 'update-target',
    name: 'Target Update System',
    priority: 'normal',
    phase: 'update',
    dependencies: ['input-polling'],
    conflicts: [],
    maxExecutionTime: Duration.millis(2),
    enableProfiling: true,
  },
  {
    id: 'camera-control',
    name: 'Camera Control System',
    priority: 'high',
    phase: 'update',
    dependencies: ['input-polling', 'player-movement'],
    conflicts: [],
    maxExecutionTime: Duration.millis(2),
    enableProfiling: true,
  },

  // Physics Phase - Physics simulation
  {
    id: 'physics',
    name: 'Physics System',
    priority: 'high',
    phase: 'physics',
    dependencies: ['player-movement'],
    conflicts: ['collision'],
    maxExecutionTime: Duration.millis(5),
    enableProfiling: true,
  },
  {
    id: 'update-physics-world',
    name: 'Physics World Update System',
    priority: 'normal',
    phase: 'physics',
    dependencies: ['physics'],
    conflicts: [],
    maxExecutionTime: Duration.millis(3),
    enableProfiling: true,
  },

  // Collision Phase - Collision detection and resolution
  {
    id: 'collision',
    name: 'Collision System',
    priority: 'high',
    phase: 'collision',
    dependencies: ['physics'],
    conflicts: [],
    maxExecutionTime: Duration.millis(6),
    enableProfiling: true,
  },

  // Render Phase - Rendering and world updates
  {
    id: 'chunk-loading',
    name: 'Chunk Loading System',
    priority: 'normal',
    phase: 'render',
    dependencies: ['player-movement'],
    conflicts: [],
    maxExecutionTime: Duration.millis(4),
    enableProfiling: true,
  },
  {
    id: 'world-update',
    name: 'World Update System',
    priority: 'normal',
    phase: 'render',
    dependencies: ['chunk-loading'],
    conflicts: [],
    maxExecutionTime: Duration.millis(3),
    enableProfiling: true,
  },
  {
    id: 'ui',
    name: 'UI System',
    priority: 'low',
    phase: 'render',
    dependencies: [],
    conflicts: [],
    maxExecutionTime: Duration.millis(2),
    enableProfiling: true,
  },
]

/**
 * System function adapters - Convert existing systems to scheduler-compatible format
 */
const systemFunctionAdapters: Record<string, SystemFunction> = {
  'input-polling': () => inputPollingSystem,
  'player-movement': () => playerMovementSystem,
  'block-interaction': () => blockInteractionSystem,
  'update-target': () => updateTargetSystem,
  'camera-control': () => cameraControlSystem,
  'physics': () => physicsSystem,
  'update-physics-world': () => updatePhysicsWorldSystem,
  'collision': () => collisionSystem,
  'chunk-loading': () => chunkLoadingSystem,
  'world-update': () => worldUpdateSystem,
  'ui': () => createUISystem(),
}

/**
 * Create and configure a system registry
 */
export const createSystemRegistry = (config: Partial<SystemRegistryConfig> = {}): Effect.Effect<SystemScheduler, never, never> =>
  Effect.gen(function* ($) {
    const finalConfig = { ...defaultRegistryConfig, ...config }
    
    // Create scheduler
    const scheduler = createSystemScheduler({
      targetFPS: finalConfig.targetFPS,
      maxFrameTime: Duration.millis(1000 / finalConfig.targetFPS),
      enableProfiling: finalConfig.enableProfiling,
      enableParallelExecution: finalConfig.enableParallelExecution,
      maxConcurrency: finalConfig.maxConcurrency,
    })

    // Register all systems
    yield* $(
      Effect.forEach(
        systemConfigurations,
        (systemConfig) =>
          Effect.gen(function* ($) {
            const systemFunction = systemFunctionAdapters[systemConfig.id]
            if (!systemFunction) {
              throw new Error(`No system function found for system: ${systemConfig.id}`)
            }
            
            yield* $(scheduler.registerSystem(systemConfig, systemFunction))
          }),
        { concurrency: 'unbounded', discard: true }
      )
    )

    return scheduler
  })

/**
 * Default system registry instance
 */
export const defaultSystemRegistry = createSystemRegistry()

/**
 * System registry utilities
 */
export const SystemRegistryUtils = {
  /**
   * Get system configuration by ID
   */
  getSystemConfig: (systemId: string): SystemConfig | undefined => {
    return systemConfigurations.find(config => config.id === systemId)
  },

  /**
   * Get all system configurations
   */
  getAllSystemConfigs: (): readonly SystemConfig[] => {
    return [...systemConfigurations]
  },

  /**
   * Get systems by phase
   */
  getSystemsByPhase: (phase: SystemConfig['phase']): readonly SystemConfig[] => {
    return systemConfigurations.filter(config => config.phase === phase)
  },

  /**
   * Get system dependency graph
   */
  getDependencyGraph: (): Record<string, string[]> => {
    return systemConfigurations.reduce((graph, config) => {
      graph[config.id] = [...config.dependencies]
      return graph
    }, {} as Record<string, string[]>)
  },

  /**
   * Validate system configuration
   */
  validateConfiguration: (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    const systemIds = new Set(systemConfigurations.map(config => config.id))

    // Check for duplicate IDs
    const idCounts = new Map<string, number>()
    for (const config of systemConfigurations) {
      idCounts.set(config.id, (idCounts.get(config.id) || 0) + 1)
    }
    
    for (const [id, count] of idCounts) {
      if (count > 1) {
        errors.push(`Duplicate system ID: ${id}`)
      }
    }

    // Check for invalid dependencies
    for (const config of systemConfigurations) {
      for (const dependency of config.dependencies) {
        if (!systemIds.has(dependency)) {
          errors.push(`System ${config.id} has invalid dependency: ${dependency}`)
        }
      }
    }

    // Check for circular dependencies (simplified check)
    for (const config of systemConfigurations) {
      if (config.dependencies.includes(config.id)) {
        errors.push(`System ${config.id} has circular dependency on itself`)
      }
    }

    // Check for missing system functions
    for (const config of systemConfigurations) {
      if (!systemFunctionAdapters[config.id]) {
        errors.push(`No system function adapter found for: ${config.id}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Get execution order based on dependencies
   */
  getExecutionOrder: (): string[] => {
    // Simple topological sort
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const order: string[] = []

    const visit = (systemId: string) => {
      if (visiting.has(systemId)) {
        throw new Error(`Circular dependency detected involving: ${systemId}`)
      }
      if (visited.has(systemId)) {
        return
      }

      visiting.add(systemId)
      
      const config = systemConfigurations.find(c => c.id === systemId)
      if (config) {
        for (const dependency of config.dependencies) {
          visit(dependency)
        }
      }
      
      visiting.delete(systemId)
      visited.add(systemId)
      order.push(systemId)
    }

    for (const config of systemConfigurations) {
      visit(config.id)
    }

    return order
  },

  /**
   * Create system configuration for dynamic system registration
   */
  createSystemConfig: (
    id: string,
    name: string,
    options: Partial<Omit<SystemConfig, 'id' | 'name'>> = {}
  ): SystemConfig => ({
    id,
    name,
    priority: options.priority || 'normal',
    phase: options.phase || 'update',
    dependencies: options.dependencies || [],
    conflicts: options.conflicts || [],
    maxExecutionTime: options.maxExecutionTime || Duration.millis(5),
    enableProfiling: options.enableProfiling !== undefined ? options.enableProfiling : true,
  }),
}

/**
 * System performance monitoring utilities
 */
export const SystemPerformanceUtils = {
  /**
   * Get frame time breakdown by system
   */
  getFrameTimeBreakdown: (scheduler: SystemScheduler): Effect.Effect<Record<string, number, never>, never, never> =>
    Effect.gen(function* ($) {
      const allMetrics = yield* $(scheduler.getAllMetrics())
      const breakdown: Record<string, number> = {}
      
      for (const [systemId, metrics] of allMetrics) {
        breakdown[systemId] = metrics.averageExecutionTime
      }
      
      return breakdown
    }),

  /**
   * Get bottleneck systems
   */
  getBottleneckSystems: (scheduler: SystemScheduler, threshold = 5): Effect.Effect<string[], never, never> =>
    Effect.gen(function* ($) {
      const allMetrics = yield* $(scheduler.getAllMetrics())
      const bottlenecks: string[] = []
      
      for (const [systemId, metrics] of allMetrics) {
        if (metrics.averageExecutionTime > threshold) {
          bottlenecks.push(systemId)
        }
      }
      
      return bottlenecks.sort((a, b) => {
        const metricsA = allMetrics.get(a)!
        const metricsB = allMetrics.get(b)!
        return metricsB.averageExecutionTime - metricsA.averageExecutionTime
      })
    }),

  /**
   * Get frame rate estimation
   */
  getFrameRateEstimation: (scheduler: SystemScheduler): Effect.Effect<{ estimatedFPS: number; frameTimeMs: number }, never, never> =>
    Effect.gen(function* ($) {
      const allMetrics = yield* $(scheduler.getAllMetrics())
      let totalFrameTime = 0
      
      for (const [, metrics] of allMetrics) {
        totalFrameTime += metrics.averageExecutionTime
      }
      
      const estimatedFPS = totalFrameTime > 0 ? 1000 / totalFrameTime : 0
      
      return {
        estimatedFPS,
        frameTimeMs: totalFrameTime,
      }
    }),
}