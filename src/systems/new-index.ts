/**
 * Next-Generation Systems - Wave 2 Complete System Architecture
 * 
 * This module provides the complete refactored system layer built on top of
 * Wave 1's component and query systems. Features include:
 * 
 * - Advanced system scheduler with dependency management and parallel execution
 * - High-performance physics, rendering, and interaction systems
 * - Comprehensive performance monitoring and optimization
 * - Event-driven inter-system communication
 * - Configurable system variants for different performance profiles
 */

// =============================================================================
// CORE SYSTEM INFRASTRUCTURE
// =============================================================================

export {
  SystemScheduler,
  createSystemScheduler,
  defaultSchedulerConfig,
  type SystemConfig,
  type SystemFunction,
  type SystemContext,
  type SystemPriority,
  type SystemPhase,
  type SystemMetrics,
  type SchedulerConfig,
} from './core/scheduler'

export {
  SystemCommunicationHub,
  globalCommunicationHub,
  SystemCommunicationUtils,
  SystemMessageDecorators,
  defaultCommunicationConfig,
  type SystemMessage,
  type SystemMessageType,
  type MessagePriority,
  type MessageHandler,
  type MessageFilter,
  type CommunicationConfig,
} from './core/system-communication'

export {
  PerformanceMonitor,
  globalPerformanceMonitor,
  PerformanceUtils,
  defaultPerformanceMonitorConfig,
  type PerformanceMetric,
  type PerformanceMetricType,
  type PerformanceStats,
  type PerformanceAlert,
  type PerformanceThreshold,
  type FramePerformanceSummary,
  type SystemPerformanceProfile,
  type PerformanceMonitorConfig,
} from './core/performance-monitor'

// =============================================================================
// PHYSICS SYSTEMS
// =============================================================================

export {
  createPhysicsSystem,
  physicsSystem,
  physicsSystemConfig,
  physicsSystemVariants,
  PhysicsUtils,
  defaultPhysicsConfig,
  type PhysicsConfig,
} from './physics/physics-system'

export {
  createCollisionSystem,
  collisionSystem,
  collisionSystemConfig,
  collisionSystemVariants,
  CollisionSystemUtils,
  CollisionUtils,
  defaultCollisionConfig,
  type CollisionConfig,
  type CollisionInfo,
  type CollisionEvent,
} from './physics/collision-system'

// =============================================================================
// RENDERING SYSTEMS
// =============================================================================

export {
  createRenderSystem,
  renderSystem,
  renderSystemConfig,
  renderSystemVariants,
  RenderUtils,
  defaultRenderConfig,
  type RenderConfig,
} from './rendering/render-system'

// =============================================================================
// INPUT SYSTEMS
// =============================================================================

export {
  createInputSystem,
  inputSystem,
  inputSystemConfig,
  inputSystemVariants,
  InputUtils,
  defaultInputConfig,
  defaultInputBindings,
  type InputConfig,
  type InputAction,
  type InputBinding,
} from './input/input-system'

// =============================================================================
// WORLD SYSTEMS
// =============================================================================

export {
  createChunkLoadingSystem,
  chunkLoadingSystem,
  chunkLoadingSystemConfig,
  chunkLoadingSystemVariants,
  ChunkLoadingUtils,
  ChunkCoordUtils,
  defaultChunkLoadingConfig,
  type ChunkLoadingConfig,
  type ChunkCoord,
} from './world/chunk-loading-system'

// =============================================================================
// INTERACTION SYSTEMS
// =============================================================================

export {
  createBlockInteractionSystem,
  blockInteractionSystem,
  blockInteractionSystemConfig,
  blockInteractionSystemVariants,
  BlockInteractionUtils,
  BlockPositionUtils,
  defaultBlockInteractionConfig,
  type BlockInteractionConfig,
  type BlockOperation,
  type BlockOperationType,
} from './interaction/block-interaction-system'

// =============================================================================
// TARGETING SYSTEMS
// =============================================================================

export {
  createUpdateTargetSystem,
  updateTargetSystem,
  updateTargetSystemConfig,
  updateTargetSystemVariants,
  UpdateTargetSystemUtils,
  TargetingUtils,
  defaultTargetConfig,
  defaultTargetFilters,
  type TargetConfig,
  type TargetCandidate,
  type TargetFilter,
} from './targeting/update-target-system'

// =============================================================================
// LEGACY SYSTEM COMPATIBILITY
// =============================================================================

// Keep legacy exports for backward compatibility during migration
export { blockInteractionSystem as legacyBlockInteractionSystem } from './block-interaction'
export { cameraControlSystem } from './camera-control'
export { chunkLoadingSystem as legacyChunkLoadingSystem } from './chunk-loading'
export { collisionSystem as legacyCollisionSystem } from './collision'
export { inputPollingSystem } from './input-polling'
export { physicsSystem as legacyPhysicsSystem } from './physics'
export { playerMovementSystem } from './player-movement'
export { updateTargetSystem as legacyUpdateTargetSystem } from './update-target-system'
export { createUISystem } from './ui'
export { updatePhysicsWorldSystem } from './update-physics-world'
export { worldUpdateSystem } from './world-update'

// =============================================================================
// SYSTEM INTEGRATION AND ORCHESTRATION
// =============================================================================

import { Effect, pipe, Duration } from 'effect'
import { World, Clock } from '@/runtime/services'

/**
 * Integrated system configuration profiles for different performance targets
 */
export const SystemProfiles = {
  /**
   * Low-end performance profile for weaker hardware
   */
  performance: {
    physics: 'minimal' as const,
    render: 'lowQuality' as const,
    input: 'lowLatency' as const,
    chunkLoading: 'performance' as const,
    blockInteraction: 'survival' as const,
    collision: 'performance' as const,
    updateTarget: 'performance' as const,
  },

  /**
   * Balanced profile for mid-range hardware
   */
  balanced: {
    physics: 'full' as const,
    render: 'highQuality' as const,
    input: 'smooth' as const,
    chunkLoading: 'quality' as const,
    blockInteraction: 'creative' as const,
    collision: 'precision' as const,
    updateTarget: 'precision' as const,
  },

  /**
   * High-end profile for powerful hardware
   */
  quality: {
    physics: 'full' as const,
    render: 'highQuality' as const,
    input: 'smooth' as const,
    chunkLoading: 'quality' as const,
    blockInteraction: 'creative' as const,
    collision: 'precision' as const,
    updateTarget: 'precision' as const,
  },

  /**
   * Debug profile with extended capabilities
   */
  debug: {
    physics: 'debug' as const,
    render: 'debug' as const,
    input: 'accessible' as const,
    chunkLoading: 'debug' as const,
    blockInteraction: 'creative' as const,
    collision: 'simple' as const,
    updateTarget: 'creative' as const,
  },
} as const

/**
 * Create integrated system scheduler with all systems configured
 */
export const createIntegratedSystemScheduler = (
  profile: keyof typeof SystemProfiles = 'balanced'
) => {
  const selectedProfile = SystemProfiles[profile]
  const scheduler = createSystemScheduler({
    enableProfiling: true,
    enableParallelExecution: true,
    maxConcurrency: profile === 'performance' ? 2 : profile === 'quality' ? 8 : 4,
  })

  return Effect.gen(function* ($) {
    // Register core systems with proper dependencies
    yield* $(scheduler.registerSystem(
      inputSystemConfig,
      inputSystemVariants[selectedProfile.input] || inputSystem
    ))

    yield* $(scheduler.registerSystem(
      physicsSystemConfig,
      physicsSystemVariants[selectedProfile.physics] || physicsSystem
    ))

    yield* $(scheduler.registerSystem(
      collisionSystemConfig,
      collisionSystemVariants[selectedProfile.collision] || collisionSystem
    ))

    yield* $(scheduler.registerSystem(
      chunkLoadingSystemConfig,
      chunkLoadingSystemVariants[selectedProfile.chunkLoading] || chunkLoadingSystem
    ))

    yield* $(scheduler.registerSystem(
      blockInteractionSystemConfig,
      blockInteractionSystemVariants[selectedProfile.blockInteraction] || blockInteractionSystem
    ))

    yield* $(scheduler.registerSystem(
      updateTargetSystemConfig,
      updateTargetSystemVariants[selectedProfile.updateTarget] || updateTargetSystem
    ))

    yield* $(scheduler.registerSystem(
      renderSystemConfig,
      renderSystemVariants[selectedProfile.render] || renderSystem
    ))

    return scheduler
  })
}

/**
 * System execution loop with performance monitoring
 */
export const createSystemExecutionLoop = (
  scheduler: SystemScheduler,
  performanceMonitor = globalPerformanceMonitor
) => {
  return Effect.gen(function* ($) {
    const clock = yield* $(Clock)
    let frameId = 0

    const executeFrame = () => Effect.gen(function* ($) {
      frameId++
      
      // Start frame performance monitoring
      performanceMonitor.startFrame(frameId)
      
      // Execute all systems for this frame
      yield* $(scheduler.executeFrame())
      
      // End frame performance monitoring and get summary
      const frameSummary = performanceMonitor.endFrame()
      
      // Log performance issues if detected
      if (frameSummary.totalFrameTime > frameSummary.targetFrameTime * 1.5) {
        console.warn(`Frame ${frameId} exceeded target time: ${frameSummary.totalFrameTime.toFixed(2)}ms (target: ${frameSummary.targetFrameTime.toFixed(2)}ms)`)
        
        if (frameSummary.bottleneckSystem) {
          console.warn(`Bottleneck system: ${frameSummary.bottleneckSystem.value}`)
        }
      }
      
      // Process system communications
      yield* $(globalCommunicationHub.processMessages())
    })

    return {
      executeFrame,
      getSchedulerStats: () => scheduler.getStats(),
      getPerformanceStats: () => performanceMonitor.getFrameHistory(60),
      getCurrentFrameId: () => frameId,
    }
  })
}

/**
 * Complete system initialization for different game modes
 */
export const initializeSystemsForGameMode = (
  gameMode: 'survival' | 'creative' | 'adventure' = 'survival'
) => {
  const profileMap = {
    survival: 'balanced' as const,
    creative: 'quality' as const,
    adventure: 'balanced' as const,
  }

  return Effect.gen(function* ($) {
    // Create scheduler with appropriate profile
    const scheduler = yield* $(createIntegratedSystemScheduler(profileMap[gameMode]))
    
    // Create execution loop
    const executionLoop = yield* $(createSystemExecutionLoop(scheduler))
    
    // Set up communication subscriptions for system coordination
    yield* $(setupSystemCommunication())
    
    console.log(`Systems initialized for ${gameMode} mode with ${profileMap[gameMode]} profile`)
    
    return {
      scheduler,
      executionLoop,
      gameMode,
      profile: profileMap[gameMode],
    }
  })
}

/**
 * Set up inter-system communication subscriptions
 */
const setupSystemCommunication = () => Effect.gen(function* ($) {
  const hub = globalCommunicationHub
  
  // Physics system listens for collision events
  yield* $(hub.subscribe(
    'physics',
    ['collision_detected'],
    (message) => Effect.gen(function* ($) {
      console.debug('Physics system received collision event:', message.payload)
      // Physics system would handle collision response here
    })
  ))
  
  // Render system listens for entity updates
  yield* $(hub.subscribe(
    'render',
    ['entity_created', 'entity_destroyed', 'component_updated'],
    (message) => Effect.gen(function* ($) {
      // Render system would update rendering lists here
      if (message.type === 'entity_created') {
        console.debug('Render system: New entity to render:', message.payload.entityId)
      }
    })
  ))
  
  // Chunk loading system listens for player movement
  yield* $(hub.subscribe(
    'chunk-loading',
    ['player_moved'],
    (message) => Effect.gen(function* ($) {
      // Chunk loading would evaluate if new chunks need loading
      console.debug('Chunk loading system: Player moved, checking chunks')
    })
  ))
})

/**
 * System performance analysis utilities
 */
export const SystemAnalysis = {
  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport: (
    scheduler: SystemScheduler,
    monitor = globalPerformanceMonitor
  ) => Effect.gen(function* ($) {
    const schedulerStats = yield* $(scheduler.getStats())
    const systemMetrics = yield* $(scheduler.getAllMetrics())
    const frameHistory = monitor.getFrameHistory(300) // 5 seconds at 60fps
    const alerts = monitor.getActiveAlerts()
    
    let report = '=== System Performance Report ===\n\n'
    
    // Scheduler statistics
    report += `Total Systems: ${schedulerStats.totalSystems}\n`
    report += `Parallel Groups: ${schedulerStats.parallelGroups}\n`
    report += `Avg Systems per Group: ${schedulerStats.avgSystemsPerGroup.toFixed(1)}\n`
    report += `Enabled Features: ${schedulerStats.enabledFeatures.join(', ')}\n\n`
    
    // Frame performance
    if (frameHistory.length > 0) {
      const avgFrameTime = frameHistory.reduce((sum, f) => sum + f.totalFrameTime, 0) / frameHistory.length
      const worstFrame = frameHistory.reduce((worst, frame) => 
        frame.totalFrameTime > worst.totalFrameTime ? frame : worst
      )
      
      report += `=== Frame Performance ===\n`
      report += `Average Frame Time: ${avgFrameTime.toFixed(2)}ms\n`
      report += `Worst Frame Time: ${worstFrame.totalFrameTime.toFixed(2)}ms (Frame ${worstFrame.frameId})\n`
      report += `Current Quality Level: ${frameHistory[frameHistory.length - 1]?.qualityLevel}\n\n`
    }
    
    // System metrics
    report += `=== System Metrics ===\n`
    for (const [systemId, metrics] of systemMetrics) {
      report += `${systemId}:\n`
      report += `  Executions: ${metrics.executionCount}\n`
      report += `  Avg Time: ${metrics.averageExecutionTime.toFixed(2)}ms\n`
      report += `  Max Time: ${metrics.maxExecutionTime.toFixed(2)}ms\n`
      report += `  Errors: ${metrics.errorCount}\n\n`
    }
    
    // Active alerts
    if (alerts.length > 0) {
      report += `=== Active Performance Alerts ===\n`
      for (const alert of alerts) {
        report += `[${alert.level.toUpperCase()}] ${alert.description}\n`
      }
    }
    
    return report
  }),

  /**
   * Optimize system configuration based on performance data
   */
  optimizeSystemConfiguration: (
    scheduler: SystemScheduler,
    monitor = globalPerformanceMonitor
  ) => Effect.gen(function* ($) {
    const frameHistory = monitor.getFrameHistory(60)
    const systemMetrics = yield* $(scheduler.getAllMetrics())
    
    const recommendations: string[] = []
    
    // Analyze frame performance
    if (frameHistory.length > 0) {
      const avgFrameTime = frameHistory.reduce((sum, f) => sum + f.totalFrameTime, 0) / frameHistory.length
      const targetFrameTime = 16.67 // 60fps
      
      if (avgFrameTime > targetFrameTime * 1.5) {
        recommendations.push('Consider switching to performance profile')
        recommendations.push('Reduce render distance or quality settings')
      }
      
      if (avgFrameTime < targetFrameTime * 0.8) {
        recommendations.push('System has headroom - consider increasing quality settings')
      }
    }
    
    // Analyze system bottlenecks
    for (const [systemId, metrics] of systemMetrics) {
      if (metrics.averageExecutionTime > 10) {
        recommendations.push(`${systemId} system is slow (${metrics.averageExecutionTime.toFixed(2)}ms avg)`)
      }
      
      if (metrics.errorCount > 0) {
        recommendations.push(`${systemId} system has ${metrics.errorCount} errors - investigate`)
      }
    }
    
    return recommendations
  }),
}

/**
 * System debugging utilities
 */
export const SystemDebug = {
  /**
   * Enable debug mode for all systems
   */
  enableDebugMode: () => Effect.gen(function* ($) {
    console.log('Enabling system debug mode...')
    
    // Set up debug message logging
    yield* $(globalCommunicationHub.subscribe(
      'debug',
      ['entity_created', 'entity_destroyed', 'collision_detected', 'block_placed', 'block_destroyed'],
      (message) => Effect.gen(function* ($) {
        console.debug(`[${message.type}] ${message.sender}:`, message.payload)
      })
    ))
    
    return 'Debug mode enabled'
  }),

  /**
   * Log system execution order
   */
  logExecutionOrder: (scheduler: SystemScheduler) => Effect.gen(function* ($) {
    const stats = yield* $(scheduler.getStats())
    console.log('System execution order and parallel groups:')
    console.log(`Total systems: ${stats.totalSystems}`)
    console.log(`Parallel groups: ${stats.parallelGroups}`)
  }),
}

// =============================================================================
// DEFAULT EXPORT: COMPLETE SYSTEM CONFIGURATION
// =============================================================================

/**
 * Default system configuration for quick setup
 */
export const defaultSystemConfiguration = {
  scheduler: createSystemScheduler(),
  performance: globalPerformanceMonitor,
  communication: globalCommunicationHub,
  
  // System variants by profile
  profiles: SystemProfiles,
  
  // Quick initialization
  initialize: initializeSystemsForGameMode,
  
  // Analysis utilities
  analysis: SystemAnalysis,
  debug: SystemDebug,
} as const

export default defaultSystemConfiguration