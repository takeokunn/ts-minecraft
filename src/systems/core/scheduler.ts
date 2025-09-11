/**
 * System Scheduler - Next-Generation Parallel Execution Manager
 * 
 * Features:
 * - Dependency-based system ordering
 * - Parallel execution of independent systems
 * - Frame rate adaptive scheduling
 * - Performance monitoring and optimization
 * - Effect-TS integration with fiber-based concurrency
 */

import { Effect, pipe, Duration, Fiber, Ref, Array, HashMap, Option, Clock as EffectClock } from 'effect'
import { Clock, World } from '@/runtime/services'
import { QueryProfiler } from '@/core/queries'

/**
 * System execution priority levels
 */
export type SystemPriority = 'critical' | 'high' | 'normal' | 'low' | 'background'

/**
 * System execution phase
 */
export type SystemPhase = 'input' | 'update' | 'physics' | 'collision' | 'render' | 'cleanup'

/**
 * System configuration metadata
 */
export interface SystemConfig {
  readonly id: string
  readonly name: string
  readonly priority: SystemPriority
  readonly phase: SystemPhase
  readonly dependencies: readonly string[]
  readonly conflicts: readonly string[]
  readonly maxExecutionTime: Duration.Duration
  readonly enableProfiling: boolean
}

/**
 * System execution context
 */
export interface SystemContext {
  readonly deltaTime: number
  readonly frameId: number
  readonly phase: SystemPhase
  readonly priority: SystemPriority
}

/**
 * System execution metrics
 */
export interface SystemMetrics {
  readonly systemId: string
  readonly executionCount: number
  readonly totalExecutionTime: number
  readonly averageExecutionTime: number
  readonly maxExecutionTime: number
  readonly lastExecutionTime: number
  readonly errorCount: number
  readonly lastError: Option.Option<Error>
}

/**
 * System function signature
 */
export type SystemFunction = (context: SystemContext) => Effect.Effect<void, Error, World | Clock>

/**
 * Registered system information
 */
export interface RegisteredSystem {
  readonly config: SystemConfig
  readonly system: SystemFunction
  readonly metrics: SystemMetrics
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  readonly targetFPS: number
  readonly maxFrameTime: Duration.Duration
  readonly enableProfiling: boolean
  readonly enableParallelExecution: boolean
  readonly maxConcurrency: number
}

/**
 * System Scheduler implementation
 */
export class SystemScheduler {
  private systems = new Map<string, RegisteredSystem>()
  private executionOrder: string[] = []
  private parallelGroups: string[][] = []
  private metricsRef: Ref.Ref<Map<string, SystemMetrics>>
  private frameIdRef: Ref.Ref<number>
  private config: SchedulerConfig

  constructor(config: SchedulerConfig) {
    this.config = config
    this.metricsRef = Ref.unsafeMake(new Map())
    this.frameIdRef = Ref.unsafeMake(0)
  }

  /**
   * Register a system with the scheduler
   */
  registerSystem(
    config: SystemConfig,
    system: SystemFunction
  ): Effect.Effect<void> {
    return Effect.gen(this, function* ($) {
      const initialMetrics: SystemMetrics = {
        systemId: config.id,
        executionCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        lastExecutionTime: 0,
        errorCount: 0,
        lastError: Option.none(),
      }

      const registeredSystem: RegisteredSystem = {
        config,
        system,
        metrics: initialMetrics,
      }

      this.systems.set(config.id, registeredSystem)

      // Rebuild execution order and parallel groups
      yield* $(this.rebuildExecutionPlan())
    })
  }

  /**
   * Unregister a system
   */
  unregisterSystem(systemId: string): Effect.Effect<void> {
    return Effect.gen(this, function* ($) {
      this.systems.delete(systemId)
      yield* $(this.rebuildExecutionPlan())
    })
  }

  /**
   * Execute all systems for one frame
   */
  executeFrame(): Effect.Effect<void, Error, World | Clock> {
    return Effect.gen(this, function* ($) {
      const clock = yield* $(Clock)
      const deltaTime = yield* $(Ref.get(clock.deltaTime))
      const frameId = yield* $(Ref.get(this.frameIdRef))

      // Update frame ID
      yield* $(Ref.update(this.frameIdRef, n => n + 1))

      // Execute systems by phase
      const phases: SystemPhase[] = ['input', 'update', 'physics', 'collision', 'render', 'cleanup']

      for (const phase of phases) {
        yield* $(this.executePhase(phase, deltaTime, frameId))
      }
    })
  }

  /**
   * Execute systems in a specific phase
   */
  private executePhase(
    phase: SystemPhase,
    deltaTime: number,
    frameId: number
  ): Effect.Effect<void, Error, World | Clock> {
    return Effect.gen(this, function* ($) {
      const phaseSystems = this.getSystemsForPhase(phase)
      const parallelGroups = this.getParallelGroups(phaseSystems)

      // Execute each parallel group sequentially
      for (const group of parallelGroups) {
        if (this.config.enableParallelExecution && group.length > 1) {
          yield* $(this.executeSystemsInParallel(group, phase, deltaTime, frameId))
        } else {
          yield* $(this.executeSystemsSequentially(group, phase, deltaTime, frameId))
        }
      }
    })
  }

  /**
   * Execute systems in parallel
   */
  private executeSystemsInParallel(
    systemIds: string[],
    phase: SystemPhase,
    deltaTime: number,
    frameId: number
  ): Effect.Effect<void, Error, World | Clock> {
    return Effect.gen(this, function* ($) {
      const fibers = yield* $(
        Effect.forEach(
          systemIds,
          (systemId) => 
            pipe(
              this.executeSystem(systemId, { deltaTime, frameId, phase, priority: 'normal' }),
              Effect.fork
            ),
          { concurrency: Math.min(systemIds.length, this.config.maxConcurrency) }
        )
      )

      // Wait for all fibers to complete
      yield* $(
        Effect.forEach(
          fibers,
          (fiber) => Fiber.await(fiber),
          { concurrency: 'unbounded', discard: true }
        )
      )
    })
  }

  /**
   * Execute systems sequentially
   */
  private executeSystemsSequentially(
    systemIds: string[],
    phase: SystemPhase,
    deltaTime: number,
    frameId: number
  ): Effect.Effect<void, Error, World | Clock> {
    return Effect.gen(this, function* ($) {
      for (const systemId of systemIds) {
        const priority = this.getSystemPriority(systemId)
        yield* $(this.executeSystem(systemId, { deltaTime, frameId, phase, priority }))
      }
    })
  }

  /**
   * Execute a single system with metrics tracking
   */
  private executeSystem(
    systemId: string,
    context: SystemContext
  ): Effect.Effect<void, Error, World | Clock> {
    return Effect.gen(this, function* ($) {
      const registeredSystem = this.systems.get(systemId)
      if (!registeredSystem) {
        return
      }

      const startTime = yield* $(EffectClock.currentTimeMillis)

      try {
        // Execute system with timeout
        yield* $(
          pipe(
            registeredSystem.system(context),
            Effect.timeout(registeredSystem.config.maxExecutionTime),
            Effect.catchTag('TimeoutException', () => 
              Effect.fail(new Error(`System ${systemId} exceeded maximum execution time`))
            )
          )
        )

        const endTime = yield* $(EffectClock.currentTimeMillis)
        const executionTime = endTime - startTime

        // Update metrics
        yield* $(this.updateSystemMetrics(systemId, executionTime, Option.none()))

        // Profile query performance if enabled
        if (this.config.enableProfiling) {
          QueryProfiler.record(`${systemId}_frame_${context.frameId}`, {
            executionTime,
            entitiesScanned: 0, // This would be populated by query system
            entitiesMatched: 0, // This would be populated by query system
          })
        }

      } catch (error) {
        const endTime = yield* $(EffectClock.currentTimeMillis)
        const executionTime = endTime - startTime

        // Update metrics with error
        yield* $(this.updateSystemMetrics(
          systemId, 
          executionTime, 
          Option.some(error instanceof Error ? error : new Error(String(error)))
        ))

        // Re-throw error for handling by scheduler
        throw error
      }
    })
  }

  /**
   * Update system execution metrics
   */
  private updateSystemMetrics(
    systemId: string,
    executionTime: number,
    error: Option.Option<Error>
  ): Effect.Effect<void> {
    return Ref.update(this.metricsRef, metricsMap => {
      const currentMetrics = metricsMap.get(systemId)
      if (!currentMetrics) return metricsMap

      const newMetrics: SystemMetrics = {
        ...currentMetrics,
        executionCount: currentMetrics.executionCount + 1,
        totalExecutionTime: currentMetrics.totalExecutionTime + executionTime,
        averageExecutionTime: (currentMetrics.totalExecutionTime + executionTime) / (currentMetrics.executionCount + 1),
        maxExecutionTime: Math.max(currentMetrics.maxExecutionTime, executionTime),
        lastExecutionTime: executionTime,
        errorCount: Option.isSome(error) ? currentMetrics.errorCount + 1 : currentMetrics.errorCount,
        lastError: Option.isSome(error) ? error : currentMetrics.lastError,
      }

      const updatedMap = new Map(metricsMap)
      updatedMap.set(systemId, newMetrics)
      return updatedMap
    })
  }

  /**
   * Rebuild execution plan based on dependencies and conflicts
   */
  private rebuildExecutionPlan(): Effect.Effect<void> {
    return Effect.sync(() => {
      // Topological sort based on dependencies
      const systemConfigs = Array.fromIterable(this.systems.values()).map(s => s.config)
      this.executionOrder = this.topologicalSort(systemConfigs)
      this.parallelGroups = this.computeParallelGroups(systemConfigs)
    })
  }

  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(systems: SystemConfig[]): string[] {
    const graph = new Map<string, string[]>()
    const inDegree = new Map<string, number>()

    // Initialize graph
    for (const system of systems) {
      graph.set(system.id, [])
      inDegree.set(system.id, 0)
    }

    // Build dependency graph
    for (const system of systems) {
      for (const dep of system.dependencies) {
        if (graph.has(dep)) {
          graph.get(dep)!.push(system.id)
          inDegree.set(system.id, inDegree.get(system.id)! + 1)
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = []
    const result: string[] = []

    for (const [systemId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(systemId)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)

      for (const neighbor of graph.get(current) || []) {
        const newDegree = inDegree.get(neighbor)! - 1
        inDegree.set(neighbor, newDegree)
        
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      }
    }

    return result
  }

  /**
   * Compute parallel execution groups
   */
  private computeParallelGroups(systems: SystemConfig[]): string[][] {
    const groups: string[][] = []
    const processed = new Set<string>()
    
    for (const systemId of this.executionOrder) {
      if (processed.has(systemId)) continue

      const group = [systemId]
      processed.add(systemId)

      // Find systems that can run in parallel
      for (const otherSystemId of this.executionOrder) {
        if (processed.has(otherSystemId)) continue

        const system = systems.find(s => s.id === systemId)!
        const otherSystem = systems.find(s => s.id === otherSystemId)!

        if (this.canRunInParallel(system, otherSystem)) {
          group.push(otherSystemId)
          processed.add(otherSystemId)
        }
      }

      groups.push(group)
    }

    return groups
  }

  /**
   * Check if two systems can run in parallel
   */
  private canRunInParallel(system1: SystemConfig, system2: SystemConfig): boolean {
    // Same phase required for parallel execution
    if (system1.phase !== system2.phase) return false

    // No conflicts
    if (system1.conflicts.includes(system2.id) || system2.conflicts.includes(system1.id)) return false

    // No dependency relationship
    if (system1.dependencies.includes(system2.id) || system2.dependencies.includes(system1.id)) return false

    return true
  }

  /**
   * Get systems for a specific phase
   */
  private getSystemsForPhase(phase: SystemPhase): string[] {
    return this.executionOrder.filter(systemId => {
      const system = this.systems.get(systemId)
      return system && system.config.phase === phase
    })
  }

  /**
   * Get parallel groups for systems
   */
  private getParallelGroups(systemIds: string[]): string[][] {
    return this.parallelGroups.filter(group => 
      group.some(systemId => systemIds.includes(systemId))
    ).map(group => 
      group.filter(systemId => systemIds.includes(systemId))
    ).filter(group => group.length > 0)
  }

  /**
   * Get system priority
   */
  private getSystemPriority(systemId: string): SystemPriority {
    const system = this.systems.get(systemId)
    return system?.config.priority || 'normal'
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(systemId: string): Effect.Effect<Option.Option<SystemMetrics>> {
    return Effect.gen(this, function* ($) {
      const metricsMap = yield* $(Ref.get(this.metricsRef))
      return Option.fromNullable(metricsMap.get(systemId))
    })
  }

  /**
   * Get all system metrics
   */
  getAllMetrics(): Effect.Effect<Map<string, SystemMetrics>> {
    return Ref.get(this.metricsRef)
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): Effect.Effect<void> {
    return Ref.set(this.metricsRef, new Map())
  }

  /**
   * Get scheduler statistics
   */
  getStats(): Effect.Effect<{
    totalSystems: number
    parallelGroups: number
    avgSystemsPerGroup: number
    enabledFeatures: string[]
  }> {
    return Effect.sync(() => ({
      totalSystems: this.systems.size,
      parallelGroups: this.parallelGroups.length,
      avgSystemsPerGroup: this.parallelGroups.length > 0 
        ? this.parallelGroups.reduce((sum, group) => sum + group.length, 0) / this.parallelGroups.length 
        : 0,
      enabledFeatures: [
        ...(this.config.enableProfiling ? ['profiling'] : []),
        ...(this.config.enableParallelExecution ? ['parallel-execution'] : []),
      ]
    }))
  }
}

/**
 * Default scheduler configuration
 */
export const defaultSchedulerConfig: SchedulerConfig = {
  targetFPS: 60,
  maxFrameTime: Duration.millis(16.67), // ~60 FPS
  enableProfiling: true,
  enableParallelExecution: true,
  maxConcurrency: 4,
}

/**
 * Create system scheduler with default configuration
 */
export const createSystemScheduler = (config: Partial<SchedulerConfig> = {}): SystemScheduler => {
  return new SystemScheduler({ ...defaultSchedulerConfig, ...config })
}