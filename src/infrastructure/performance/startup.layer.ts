import { Effect, Context, Layer, Ref, Duration } from 'effect'

/**
 * Startup phase tracking
 */
export type StartupPhase = 
  | 'initializing'
  | 'loading-config'
  | 'registering-services'
  | 'loading-resources'
  | 'warming-caches'
  | 'optimizing'
  | 'ready'

/**
 * Startup metrics for each phase
 */
export interface StartupPhaseMetrics {
  readonly phase: StartupPhase
  readonly startTime: number
  readonly endTime?: number
  readonly duration?: number
  readonly memoryBefore: number
  readonly memoryAfter?: number
  readonly memoryDelta?: number
  readonly operations: number
  readonly errors: number
}

/**
 * Startup optimization configuration
 */
export interface StartupConfig {
  readonly enableCodeSplitting: boolean
  readonly enableLazyLoading: boolean
  readonly enableResourcePreloading: boolean
  readonly enableCacheWarming: boolean
  readonly enableJITCompilation: boolean
  readonly enableTreeShaking: boolean
  readonly parallelInitialization: boolean
  readonly maxConcurrency: number
  readonly timeoutMs: number
}

/**
 * Critical path item for startup optimization
 */
export interface CriticalPathItem {
  readonly id: string
  readonly name: string
  readonly dependencies: string[]
  readonly estimatedDuration: number
  readonly priority: 'critical' | 'high' | 'medium' | 'low'
  readonly canDefer: boolean
  readonly execute: Effect.Effect<void, Error, never>
}

/**
 * Startup statistics
 */
export interface StartupStats {
  readonly totalDuration: number
  readonly criticalPathDuration: number
  readonly parallelismEfficiency: number
  readonly memoryUsage: number
  readonly cacheHitRate: number
  readonly deferredOperations: number
  readonly failedOperations: number
}

/**
 * Startup Optimizer Service for dependency injection
 */
export const StartupOptimizerService = Context.GenericTag<{
  readonly startPhase: (phase: StartupPhase) => Effect.Effect<void, never, never>
  readonly endPhase: (phase: StartupPhase) => Effect.Effect<void, never, never>
  readonly getCurrentPhase: () => Effect.Effect<StartupPhase, never, never>
  readonly getPhaseMetrics: () => Effect.Effect<StartupPhaseMetrics[], never, never>
  readonly getStats: () => Effect.Effect<StartupStats, never, never>
  
  readonly registerCriticalPath: (items: CriticalPathItem[]) => Effect.Effect<void, never, never>
  readonly executeCriticalPath: () => Effect.Effect<void, Error, never>
  readonly optimizeStartup: () => Effect.Effect<void, Error, never>
  
  readonly enableCodeSplitting: () => Effect.Effect<void, never, never>
  readonly preloadCriticalResources: (resources: string[]) => Effect.Effect<void, Error, never>
  readonly warmCaches: () => Effect.Effect<void, never, never>
  readonly deferNonCritical: () => Effect.Effect<void, never, never>
  
  readonly markReady: () => Effect.Effect<void, never, never>
  readonly isReady: () => Effect.Effect<boolean, never, never>
  readonly waitForReady: () => Effect.Effect<void, never, never>
}>('StartupOptimizerService')

/**
 * Create startup optimizer service implementation
 */
const createStartupOptimizerServiceImpl = (
  config: StartupConfig
): Effect.Effect<Context.Tag.Service<typeof StartupOptimizerService>, never, never> =>
  Effect.gen(function* () {
    const currentPhase = yield* Ref.make<StartupPhase>('initializing')
    const phaseMetrics = yield* Ref.make<StartupPhaseMetrics[]>([])
    const criticalPath = yield* Ref.make<CriticalPathItem[]>([])
    const deferredOperations = yield* Ref.make<Effect.Effect<void, Error, never>[]>([])
    const isReadyRef = yield* Ref.make(false)
    const startupStartTime = yield* Effect.sync(() => performance.now())

    const getMemoryUsage = (): number => {
      if (typeof performance !== 'undefined' && performance.memory) {
        return performance.memory.usedJSHeapSize
      }
      return 0
    }

    const findPhaseMetrics = (phase: StartupPhase) =>
      Effect.gen(function* () {
        const metrics = yield* Ref.get(phaseMetrics)
        return metrics.find(m => m.phase === phase)
      })

    const addOrUpdatePhaseMetrics = (phaseMetric: StartupPhaseMetrics) =>
      Ref.update(phaseMetrics, metrics => {
        const existing = metrics.findIndex(m => m.phase === phaseMetric.phase)
        if (existing >= 0) {
          const updated = [...metrics]
          updated[existing] = phaseMetric
          return updated
        } else {
          return [...metrics, phaseMetric]
        }
      })

    const topologicalSort = (items: CriticalPathItem[]): CriticalPathItem[] => {
      const visited = new Set<string>()
      const result: CriticalPathItem[] = []
      const itemMap = new Map(items.map(item => [item.id, item]))

      const visit = (itemId: string) => {
        if (visited.has(itemId)) return
        visited.add(itemId)

        const item = itemMap.get(itemId)
        if (!item) return

        // Visit dependencies first
        for (const depId of item.dependencies) {
          visit(depId)
        }

        result.push(item)
      }

      items.forEach(item => visit(item.id))
      return result
    }

    const executeCriticalPathOptimized = (items: CriticalPathItem[]) =>
      Effect.gen(function* () {
        const sortedItems = topologicalSort(items)
        const criticalItems = sortedItems.filter(item => 
          item.priority === 'critical' || item.priority === 'high'
        )
        const deferableItems = sortedItems.filter(item => item.canDefer)

        // Execute critical path items first
        if (config.parallelInitialization && criticalItems.length > 1) {
          // Execute in parallel batches respecting dependencies
          const batches: CriticalPathItem[][] = []
          const processed = new Set<string>()

          while (processed.size < criticalItems.length) {
            const batch = criticalItems.filter(item =>
              !processed.has(item.id) &&
              item.dependencies.every(dep => processed.has(dep))
            )

            if (batch.length === 0) break // Circular dependency or error

            batches.push(batch.slice(0, config.maxConcurrency))
            batch.forEach(item => processed.add(item.id))
          }

          for (const batch of batches) {
            yield* Effect.forEach(batch, item => item.execute, { 
              concurrency: config.maxConcurrency 
            })
          }
        } else {
          // Sequential execution
          for (const item of criticalItems) {
            yield* item.execute
          }
        }

        // Defer non-critical items
        yield* Ref.update(deferredOperations, ops => [
          ...ops,
          ...deferableItems.map(item => item.execute)
        ])
      })

    return {
      startPhase: (phase: StartupPhase) =>
        Effect.gen(function* () {
          yield* Ref.set(currentPhase, phase)
          const startTime = performance.now()
          const memoryBefore = getMemoryUsage()

          const phaseMetric: StartupPhaseMetrics = {
            phase,
            startTime,
            memoryBefore,
            operations: 0,
            errors: 0
          }

          yield* addOrUpdatePhaseMetrics(phaseMetric)
          yield* Effect.logInfo(`Starting phase: ${phase}`)
        }),

      endPhase: (phase: StartupPhase) =>
        Effect.gen(function* () {
          const endTime = performance.now()
          const memoryAfter = getMemoryUsage()
          const existingMetric = yield* findPhaseMetrics(phase)

          if (existingMetric) {
            const updatedMetric: StartupPhaseMetrics = {
              ...existingMetric,
              endTime,
              duration: endTime - existingMetric.startTime,
              memoryAfter,
              memoryDelta: memoryAfter - existingMetric.memoryBefore
            }

            yield* addOrUpdatePhaseMetrics(updatedMetric)
            yield* Effect.logInfo(
              `Completed phase: ${phase} in ${updatedMetric.duration?.toFixed(2)}ms`
            )
          }
        }),

      getCurrentPhase: () => Ref.get(currentPhase),

      getPhaseMetrics: () => Ref.get(phaseMetrics),

      getStats: () =>
        Effect.gen(function* () {
          const metrics = yield* Ref.get(phaseMetrics)
          const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0)
          const criticalMetrics = metrics.filter(m => 
            m.phase === 'loading-config' || 
            m.phase === 'registering-services'
          )
          const criticalPathDuration = criticalMetrics.reduce((sum, m) => sum + (m.duration || 0), 0)
          
          return {
            totalDuration,
            criticalPathDuration,
            parallelismEfficiency: criticalPathDuration > 0 ? totalDuration / criticalPathDuration : 1,
            memoryUsage: getMemoryUsage(),
            cacheHitRate: 0.8, // Placeholder - would be calculated from cache stats
            deferredOperations: (yield* Ref.get(deferredOperations)).length,
            failedOperations: metrics.reduce((sum, m) => sum + m.errors, 0)
          }
        }),

      registerCriticalPath: (items: CriticalPathItem[]) =>
        Ref.set(criticalPath, items),

      executeCriticalPath: () =>
        Effect.gen(function* () {
          const items = yield* Ref.get(criticalPath)
          yield* executeCriticalPathOptimized(items)
        }),

      optimizeStartup: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('🚀 Starting optimized startup sequence')

          // Phase 1: Critical initialization
          yield* Effect.gen(function* () {
            const service = yield* StartupOptimizerService
            yield* service.startPhase('loading-config')
            // Load only critical configuration
            yield* service.endPhase('loading-config')
          })

          // Phase 2: Service registration (parallel where possible)
          yield* Effect.gen(function* () {
            const service = yield* StartupOptimizerService
            yield* service.startPhase('registering-services')
            yield* service.executeCriticalPath()
            yield* service.endPhase('registering-services')
          })

          // Phase 3: Resource loading (with preloading)
          if (config.enableResourcePreloading) {
            yield* Effect.gen(function* () {
              const service = yield* StartupOptimizerService
              yield* service.startPhase('loading-resources')
              yield* service.preloadCriticalResources([
                'shaders/basic.vert',
                'shaders/basic.frag',
                'textures/atlas.png'
              ])
              yield* service.endPhase('loading-resources')
            })
          }

          // Phase 4: Cache warming
          if (config.enableCacheWarming) {
            yield* Effect.gen(function* () {
              const service = yield* StartupOptimizerService
              yield* service.startPhase('warming-caches')
              yield* service.warmCaches()
              yield* service.endPhase('warming-caches')
            })
          }

          // Phase 5: JIT optimization
          if (config.enableJITCompilation) {
            yield* Effect.gen(function* () {
              const service = yield* StartupOptimizerService
              yield* service.startPhase('optimizing')
              // Trigger JIT compilation of hot paths
              yield* Effect.sleep(Duration.millis(100)) // Allow JIT to kick in
              yield* service.endPhase('optimizing')
            })
          }

          // Phase 6: Mark ready and defer non-critical operations
          yield* Effect.gen(function* () {
            const service = yield* StartupOptimizerService
            yield* service.startPhase('ready')
            yield* service.markReady()
            yield* service.deferNonCritical()
            yield* service.endPhase('ready')
          })

          yield* Effect.logInfo('✅ Startup optimization completed')
        }),

      enableCodeSplitting: () =>
        Effect.gen(function* () {
          if (config.enableCodeSplitting) {
            yield* Effect.logInfo('Enabling code splitting for lazy loading')
            // Implementation would integrate with bundler
          }
        }),

      preloadCriticalResources: (resources: string[]) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`Preloading ${resources.length} critical resources`)
          
          // Parallel resource loading
          yield* Effect.forEach(
            resources,
            resource => Effect.gen(function* () {
              yield* Effect.logDebug(`Loading resource: ${resource}`)
              // Simulate resource loading
              yield* Effect.sleep(Duration.millis(50))
            }),
            { concurrency: config.maxConcurrency }
          )
        }),

      warmCaches: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('Warming up caches')
          
          // Simulate cache warming operations
          const warmupOperations = [
            'shader-cache',
            'texture-cache', 
            'mesh-cache',
            'material-cache'
          ]

          yield* Effect.forEach(
            warmupOperations,
            operation => Effect.gen(function* () {
              yield* Effect.logDebug(`Warming cache: ${operation}`)
              yield* Effect.sleep(Duration.millis(25))
            }),
            { concurrency: 4 }
          )
        }),

      deferNonCritical: () =>
        Effect.gen(function* () {
          const deferred = yield* Ref.get(deferredOperations)
          
          if (deferred.length > 0) {
            yield* Effect.logInfo(`Deferring ${deferred.length} non-critical operations`)
            
            // Execute deferred operations in background
            Effect.runFork(
              Effect.gen(function* () {
                yield* Effect.sleep(Duration.seconds(1)) // Wait for app to be stable
                
                yield* Effect.forEach(
                  deferred,
                  operation => operation.pipe(Effect.catchAll(() => Effect.succeed(undefined as void))),
                  { concurrency: 2 }
                )
                
                yield* Effect.logInfo('Completed deferred operations')
              })
            )
          }
        }),

      markReady: () =>
        Effect.gen(function* () {
          yield* Ref.set(isReadyRef, true)
          yield* Effect.logInfo('🎯 Application startup complete and ready')
        }),

      isReady: () => Ref.get(isReadyRef),

      waitForReady: () =>
        Effect.gen(function* () {
          while (!(yield* Ref.get(isReadyRef))) {
            yield* Effect.sleep(Duration.millis(10))
          }
        })
    }
  })

/**
 * Default startup configuration
 */
export const defaultStartupConfig: StartupConfig = {
  enableCodeSplitting: true,
  enableLazyLoading: true,
  enableResourcePreloading: true,
  enableCacheWarming: true,
  enableJITCompilation: true,
  enableTreeShaking: true,
  parallelInitialization: true,
  maxConcurrency: 4,
  timeoutMs: 30000
}

/**
 * Startup Optimizer Service Layer implementation
 */
export const StartupOptimizerServiceLive = (config: StartupConfig = defaultStartupConfig) =>
  Layer.effect(
    StartupOptimizerService,
    createStartupOptimizerServiceImpl(config)
  )

/**
 * Startup utilities
 */
export const withStartupPhase = <R, E>(
  phase: StartupPhase,
  effect: Effect.Effect<R, E, never>
): Effect.Effect<R, E, StartupOptimizerService> =>
  Effect.gen(function* () {
    const service = yield* StartupOptimizerService
    yield* service.startPhase(phase)
    
    try {
      const result = yield* effect
      yield* service.endPhase(phase)
      return result
    } catch (error) {
      yield* service.endPhase(phase)
      throw error
    }
  })

/**
 * Create a critical path item
 */
export const createCriticalPathItem = (config: {
  id: string
  name: string
  dependencies?: string[]
  estimatedDuration?: number
  priority?: 'critical' | 'high' | 'medium' | 'low'
  canDefer?: boolean
  execute: Effect.Effect<void, Error, never>
}): CriticalPathItem => ({
  dependencies: [],
  estimatedDuration: 100,
  priority: 'medium',
  canDefer: false,
  ...config
})

/**
 * Measure startup performance
 */
export const measureStartupPerformance = (): Effect.Effect<StartupStats, never, StartupOptimizerService> =>
  Effect.gen(function* () {
    const service = yield* StartupOptimizerService
    return yield* service.getStats()
  })

/**
 * Create an optimized startup sequence
 */
export const createOptimizedStartup = (
  criticalPath: CriticalPathItem[],
  config?: Partial<StartupConfig>
) =>
  Effect.gen(function* () {
    const service = yield* StartupOptimizerService
    yield* service.registerCriticalPath(criticalPath)
    yield* service.optimizeStartup()
  })