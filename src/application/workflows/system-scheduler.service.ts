/**
 * System Scheduler Service - Effect-TS Implementation
 *
 * Converted from class-based implementation to functional Effect-TS service
 * Features:
 * - Dependency-based system ordering
 * - Parallel execution of independent systems
 * - Frame rate adaptive scheduling
 * - Performance monitoring and optimization
 * - Effect-TS integration with fiber-based concurrency
 */

import { Effect, Context, Layer, Ref, Array, Option, Duration, Fiber, Clock as EffectClock, pipe } from 'effect'
import { ClockPort } from '/ports/clock.port'
import { WorldDomainService as World } from '../../domain/services/world-domain.service'

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
export type SystemFunction = (context: SystemContext) => Effect.Effect<void, Error, World | ClockPort>

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
 * Scheduler errors
 */
export class SchedulerError extends Error {
  readonly _tag = 'SchedulerError'
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

/**
 * System Scheduler Service interface
 */
export interface SystemSchedulerService {
  readonly registerSystem: (config: SystemConfig, system: SystemFunction) => Effect.Effect<void>
  readonly unregisterSystem: (systemId: string) => Effect.Effect<void>
  readonly executeFrame: () => Effect.Effect<void, SchedulerError, World | ClockPort>
  readonly getSystemMetrics: (systemId: string) => Effect.Effect<Option.Option<SystemMetrics>>
  readonly getAllMetrics: () => Effect.Effect<Map<string, SystemMetrics>>
  readonly resetMetrics: () => Effect.Effect<void>
  readonly getStats: () => Effect.Effect<{
    totalSystems: number
    parallelGroups: number
    avgSystemsPerGroup: number
    enabledFeatures: string[]
  }>
}

/**
 * System Scheduler Service tag
 */
export const SystemSchedulerService = Context.GenericTag<SystemSchedulerService>('SystemSchedulerService')

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
 * System Scheduler Service Live implementation
 */
export const SystemSchedulerServiceLive = (config: SchedulerConfig = defaultSchedulerConfig) =>
  Layer.effect(
    SystemSchedulerService,
    Effect.gen(function* () {
      const systemsRef = yield* Ref.make<Map<string, RegisteredSystem>>(new Map())
      const executionOrderRef = yield* Ref.make<string[]>([])
      const parallelGroupsRef = yield* Ref.make<string[][]>([])
      const metricsRef = yield* Ref.make<Map<string, SystemMetrics>>(new Map())
      const frameIdRef = yield* Ref.make<number>(0)

      /**
       * Topological sort for dependency resolution
       */
      const topologicalSort = (systems: SystemConfig[]): string[] => {
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
       * Check if two systems can run in parallel
       */
      const canRunInParallel = (system1: SystemConfig, system2: SystemConfig): boolean => {
        // Same phase required for parallel execution
        if (system1.phase !== system2.phase) return false

        // No conflicts
        if (system1.conflicts.includes(system2.id) || system2.conflicts.includes(system1.id)) return false

        // No dependency relationship
        if (system1.dependencies.includes(system2.id) || system2.dependencies.includes(system1.id)) return false

        return true
      }

      /**
       * Compute parallel execution groups
       */
      const computeParallelGroups = (systems: SystemConfig[], executionOrder: string[]): string[][] => {
        const groups: string[][] = []
        const processed = new Set<string>()

        for (const systemId of executionOrder) {
          if (processed.has(systemId)) continue

          const group = [systemId]
          processed.add(systemId)

          // Find systems that can run in parallel
          for (const otherSystemId of executionOrder) {
            if (processed.has(otherSystemId)) continue

            const system = systems.find((s) => s.id === systemId)!
            const otherSystem = systems.find((s) => s.id === otherSystemId)!

            if (canRunInParallel(system, otherSystem)) {
              group.push(otherSystemId)
              processed.add(otherSystemId)
            }
          }

          groups.push(group)
        }

        return groups
      }

      /**
       * Rebuild execution plan based on dependencies and conflicts
       */
      const rebuildExecutionPlan = Effect.gen(function* () {
        const systems = yield* Ref.get(systemsRef)
        const systemConfigs = Array.fromIterable(systems.values()).map((s) => s.config)
        const executionOrder = topologicalSort(systemConfigs)
        const parallelGroups = computeParallelGroups(systemConfigs, executionOrder)

        yield* Ref.set(executionOrderRef, executionOrder)
        yield* Ref.set(parallelGroupsRef, parallelGroups)
      })

      /**
       * Update system execution metrics
       */
      const updateSystemMetrics = (systemId: string, executionTime: number, error: Option.Option<Error>) =>
        Ref.update(metricsRef, (metricsMap) => {
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

      /**
       * Execute a single system with metrics tracking
       */
      const executeSystem = (systemId: string, context: SystemContext) =>
        Effect.gen(function* () {
          const systems = yield* Ref.get(systemsRef)
          const registeredSystem = systems.get(systemId)
          if (!registeredSystem) {
            return
          }

          const startTime = yield* EffectClock.currentTimeMillis

          try {
            // Execute system with timeout
            yield* pipe(
              registeredSystem.system(context),
              Effect.timeout(registeredSystem.config.maxExecutionTime),
              Effect.catchTag('TimeoutException', () => Effect.fail(new SchedulerError(`System ${systemId} exceeded maximum execution time`))),
            )

            const endTime = yield* EffectClock.currentTimeMillis
            const executionTime = endTime - startTime

            // Update metrics
            yield* updateSystemMetrics(systemId, executionTime, Option.none())

            // Profile query performance if enabled
            if (config.enableProfiling) {
              yield* Effect.log(`System ${systemId} executed in ${executionTime}ms`)
            }
          } catch (error) {
            const endTime = yield* EffectClock.currentTimeMillis
            const executionTime = endTime - startTime

            // Update metrics with error
            yield* updateSystemMetrics(systemId, executionTime, Option.some(error instanceof Error ? error : new Error(String(error))))

            // Re-throw error for handling by scheduler
            yield* Effect.fail(new SchedulerError(`System ${systemId} execution failed`, error))
          }
        })

      /**
       * Execute systems in parallel
       */
      const executeSystemsInParallel = (systemIds: string[], phase: SystemPhase, deltaTime: number, frameId: number) =>
        Effect.gen(function* () {
          const fibers = yield* Effect.forEach(systemIds, (systemId) => pipe(executeSystem(systemId, { deltaTime, frameId, phase, priority: 'normal' }), Effect.fork), {
            concurrency: Math.min(systemIds.length, config.maxConcurrency),
          })

          // Wait for all fibers to complete
          yield* Effect.forEach(fibers, (fiber) => Fiber.await(fiber), { concurrency: 'unbounded', discard: true })
        })

      /**
       * Execute systems sequentially
       */
      const executeSystemsSequentially = (systemIds: string[], phase: SystemPhase, deltaTime: number, frameId: number) =>
        Effect.gen(function* () {
          const systems = yield* Ref.get(systemsRef)

          for (const systemId of systemIds) {
            const system = systems.get(systemId)
            const priority = system?.config.priority || 'normal'
            yield* executeSystem(systemId, { deltaTime, frameId, phase, priority })
          }
        })

      /**
       * Get systems for a specific phase
       */
      const getSystemsForPhase = (phase: SystemPhase, executionOrder: string[], systems: Map<string, RegisteredSystem>): string[] => {
        return executionOrder.filter((systemId) => {
          const system = systems.get(systemId)
          return system && system.config.phase === phase
        })
      }

      /**
       * Get parallel groups for systems
       */
      const getParallelGroups = (systemIds: string[], parallelGroups: string[][]): string[][] => {
        return parallelGroups
          .filter((group) => group.some((systemId) => systemIds.includes(systemId)))
          .map((group) => group.filter((systemId) => systemIds.includes(systemId)))
          .filter((group) => group.length > 0)
      }

      /**
       * Execute systems in a specific phase
       */
      const executePhase = (phase: SystemPhase, deltaTime: number, frameId: number) =>
        Effect.gen(function* () {
          const systems = yield* Ref.get(systemsRef)
          const executionOrder = yield* Ref.get(executionOrderRef)
          const parallelGroups = yield* Ref.get(parallelGroupsRef)

          const phaseSystems = getSystemsForPhase(phase, executionOrder, systems)
          const phaseParallelGroups = getParallelGroups(phaseSystems, parallelGroups)

          // Execute each parallel group sequentially
          for (const group of phaseParallelGroups) {
            if (config.enableParallelExecution && group.length > 1) {
              yield* executeSystemsInParallel(group, phase, deltaTime, frameId)
            } else {
              yield* executeSystemsSequentially(group, phase, deltaTime, frameId)
            }
          }
        })

      return SystemSchedulerService.of({
        registerSystem: (config: SystemConfig, system: SystemFunction) =>
          Effect.gen(function* () {
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

            yield* Ref.update(systemsRef, (systems) => {
              const updated = new Map(systems)
              updated.set(config.id, registeredSystem)
              return updated
            })

            // Rebuild execution order and parallel groups
            yield* rebuildExecutionPlan
          }),

        unregisterSystem: (systemId: string) =>
          Effect.gen(function* () {
            yield* Ref.update(systemsRef, (systems) => {
              const updated = new Map(systems)
              updated.delete(systemId)
              return updated
            })
            yield* rebuildExecutionPlan
          }),

        executeFrame: () =>
          Effect.gen(function* () {
            const clock = yield* ClockPort
            const deltaTime = yield* clock.deltaTime()
            const frameId = yield* Ref.get(frameIdRef)

            // Update frame ID
            yield* Ref.update(frameIdRef, (n) => n + 1)

            // Execute systems by phase
            const phases: SystemPhase[] = ['input', 'update', 'physics', 'collision', 'render', 'cleanup']

            for (const phase of phases) {
              yield* executePhase(phase, deltaTime, frameId)
            }
          }),

        getSystemMetrics: (systemId: string) =>
          Effect.gen(function* () {
            const metricsMap = yield* Ref.get(metricsRef)
            return Option.fromNullable(metricsMap.get(systemId))
          }),

        getAllMetrics: () => Ref.get(metricsRef),

        resetMetrics: () => Ref.set(metricsRef, new Map()),

        getStats: () =>
          Effect.gen(function* () {
            const systems = yield* Ref.get(systemsRef)
            const parallelGroups = yield* Ref.get(parallelGroupsRef)

            return {
              totalSystems: systems.size,
              parallelGroups: parallelGroups.length,
              avgSystemsPerGroup: parallelGroups.length > 0 ? parallelGroups.reduce((sum, group) => sum + group.length, 0) / parallelGroups.length : 0,
              enabledFeatures: [...(config.enableProfiling ? ['profiling'] : []), ...(config.enableParallelExecution ? ['parallel-execution'] : [])],
            }
          }),
      })
    }),
  )

/**
 * Create system scheduler service with custom configuration
 */
export const createSystemSchedulerService = (config: Partial<SchedulerConfig> = {}) => SystemSchedulerServiceLive({ ...defaultSchedulerConfig, ...config })
