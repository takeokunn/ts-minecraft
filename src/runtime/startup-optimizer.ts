import { Effect, Ref, Schedule, Duration, Layer } from 'effect'
import { Context } from 'effect'
import { Profile, Metrics } from '@/core/performance'

/**
 * Advanced Startup Optimization System
 * 
 * Features:
 * - Lazy service initialization
 * - Dependency-aware loading order
 * - Progressive startup with user feedback
 * - Critical path optimization
 * - Async resource preloading
 * - Service health monitoring during startup
 */

/**
 * Service initialization priority and dependencies
 */
export interface ServiceDescriptor {
  readonly name: string
  readonly priority: 'critical' | 'high' | 'normal' | 'low' | 'background'
  readonly dependencies: ReadonlyArray<string>
  readonly estimatedLoadTime: number // milliseconds
  readonly canBeDeferred: boolean
  readonly healthCheck?: () => Effect.Effect<boolean, never, never>
  readonly warmup?: () => Effect.Effect<void, never, never>
}

/**
 * Startup phase definition
 */
export type StartupPhase = 
  | 'bootstrap'      // Core systems only
  | 'critical'       // Essential game systems
  | 'primary'        // Main game features
  | 'secondary'      // Enhanced features
  | 'background'     // Non-essential optimizations

/**
 * Startup progress tracking
 */
export interface StartupProgress {
  readonly phase: StartupPhase
  readonly completedServices: ReadonlyArray<string>
  readonly totalServices: number
  readonly currentService: string | null
  readonly percentage: number
  readonly estimatedTimeRemaining: number
  readonly errors: ReadonlyArray<{ service: string; error: string }>
}

/**
 * Startup optimization configuration
 */
export interface StartupConfig {
  readonly enableProgressReporting: boolean
  readonly enableParallelLoading: boolean
  readonly maxConcurrentServices: number
  readonly timeoutPerService: number
  readonly enableServiceHealthChecks: boolean
  readonly enableWarmupPhase: boolean
  readonly targetBootstrapTime: number // milliseconds
  readonly enableServiceProfiling: boolean
}

export const defaultStartupConfig: StartupConfig = {
  enableProgressReporting: true,
  enableParallelLoading: true,
  maxConcurrentServices: 4,
  timeoutPerService: 10000, // 10 seconds
  enableServiceHealthChecks: true,
  enableWarmupPhase: true,
  targetBootstrapTime: 2000, // 2 seconds for critical systems
  enableServiceProfiling: true
}

/**
 * Service registry for optimized initialization
 */
export interface ServiceRegistry {
  readonly services: Map<string, ServiceDescriptor>
  readonly initializationOrder: ReadonlyArray<ReadonlyArray<string>> // Groups that can run in parallel
  readonly currentPhase: Ref.Ref<StartupPhase>
  readonly progress: Ref.Ref<StartupProgress>
  readonly config: StartupConfig
}

/**
 * Startup optimizer implementation
 */
export interface StartupOptimizer {
  readonly registerService: (descriptor: ServiceDescriptor) => Effect.Effect<void, never, never>
  readonly initializeServices: (phase?: StartupPhase) => Effect.Effect<void, string, never>
  readonly getProgress: () => Effect.Effect<StartupProgress, never, never>
  readonly isServiceReady: (serviceName: string) => Effect.Effect<boolean, never, never>
  readonly waitForService: (serviceName: string, timeout?: number) => Effect.Effect<void, string, never>
  readonly optimizeStartupOrder: () => Effect.Effect<void, never, never>
  readonly generateStartupReport: () => Effect.Effect<string, never, never>
}

/**
 * Default service descriptors for TypeScript Minecraft
 */
export const defaultServiceDescriptors: ReadonlyArray<ServiceDescriptor> = [
  // Bootstrap phase - critical core systems
  {
    name: 'MemoryDetector',
    priority: 'critical',
    dependencies: [],
    estimatedLoadTime: 50,
    canBeDeferred: false,
    healthCheck: () => Effect.succeed(true)
  },
  {
    name: 'Profiler',
    priority: 'critical',
    dependencies: ['MemoryDetector'],
    estimatedLoadTime: 30,
    canBeDeferred: false
  },
  {
    name: 'Metrics',
    priority: 'critical',
    dependencies: ['MemoryDetector'],
    estimatedLoadTime: 40,
    canBeDeferred: false
  },
  {
    name: 'FPSCounter',
    priority: 'critical',
    dependencies: ['Metrics'],
    estimatedLoadTime: 20,
    canBeDeferred: false
  },
  
  // Critical phase - essential game systems
  {
    name: 'EnhancedMemoryPool',
    priority: 'critical',
    dependencies: ['MemoryDetector', 'Profiler'],
    estimatedLoadTime: 200,
    canBeDeferred: false,
    warmup: () => Effect.logInfo('Pre-warming memory pools')
  },
  {
    name: 'ResourceManager',
    priority: 'critical',
    dependencies: ['EnhancedMemoryPool'],
    estimatedLoadTime: 150,
    canBeDeferred: false
  },
  {
    name: 'Clock',
    priority: 'critical',
    dependencies: [],
    estimatedLoadTime: 10,
    canBeDeferred: false
  },
  {
    name: 'Stats',
    priority: 'critical',
    dependencies: ['Clock'],
    estimatedLoadTime: 15,
    canBeDeferred: false
  },
  
  // Primary phase - main game features
  {
    name: 'World',
    priority: 'high',
    dependencies: ['EnhancedMemoryPool', 'ResourceManager'],
    estimatedLoadTime: 500,
    canBeDeferred: false,
    healthCheck: () => Effect.succeed(true) // TODO: Implement actual health check
  },
  {
    name: 'Renderer',
    priority: 'high',
    dependencies: ['ResourceManager'],
    estimatedLoadTime: 300,
    canBeDeferred: false
  },
  {
    name: 'InputManager',
    priority: 'high',
    dependencies: [],
    estimatedLoadTime: 100,
    canBeDeferred: false
  },
  {
    name: 'SpatialGrid',
    priority: 'high',
    dependencies: ['World'],
    estimatedLoadTime: 200,
    canBeDeferred: false
  },
  
  // Secondary phase - enhanced features
  {
    name: 'MaterialManager',
    priority: 'normal',
    dependencies: ['Renderer'],
    estimatedLoadTime: 250,
    canBeDeferred: true
  },
  {
    name: 'ComputationWorker',
    priority: 'normal',
    dependencies: ['ResourceManager'],
    estimatedLoadTime: 400,
    canBeDeferred: true
  },
  {
    name: 'UIService',
    priority: 'normal',
    dependencies: ['InputManager'],
    estimatedLoadTime: 150,
    canBeDeferred: true
  },
  {
    name: 'Raycast',
    priority: 'normal',
    dependencies: ['World', 'SpatialGrid'],
    estimatedLoadTime: 100,
    canBeDeferred: true
  },
  
  // Background phase - optimizations
  {
    name: 'PerformanceMonitor',
    priority: 'low',
    dependencies: ['EnhancedMemoryPool', 'ResourceManager', 'FPSCounter'],
    estimatedLoadTime: 100,
    canBeDeferred: true
  },
  {
    name: 'QualityController',
    priority: 'low',
    dependencies: ['PerformanceMonitor'],
    estimatedLoadTime: 50,
    canBeDeferred: true
  },
  {
    name: 'WorkerCoordinator',
    priority: 'background',
    dependencies: ['ComputationWorker'],
    estimatedLoadTime: 200,
    canBeDeferred: true
  }
]

/**
 * Create startup optimizer with dependency resolution
 */
export const createStartupOptimizer = (
  config: StartupConfig = defaultStartupConfig
): Effect.Effect<StartupOptimizer, never, never> =>
  Effect.gen(function* () {
    const services = new Map<string, ServiceDescriptor>()
    const readyServices = yield* Ref.make(new Set<string>())
    const currentPhase = yield* Ref.make<StartupPhase>('bootstrap')
    const progress = yield* Ref.make<StartupProgress>({
      phase: 'bootstrap',
      completedServices: [],
      totalServices: 0,
      currentService: null,
      percentage: 0,
      estimatedTimeRemaining: 0,
      errors: []
    })
    
    // Initialize with default services
    for (const descriptor of defaultServiceDescriptors) {
      services.set(descriptor.name, descriptor)
    }
    
    // Topological sort for dependency resolution
    const resolveDependencies = (): ReadonlyArray<ReadonlyArray<string>> => {
      const resolved: string[][] = []
      const visited = new Set<string>()
      const visiting = new Set<string>()
      
      const visit = (serviceName: string): string[] => {
        if (visiting.has(serviceName)) {
          throw new Error(`Circular dependency detected involving ${serviceName}`)
        }
        if (visited.has(serviceName)) {
          return []
        }
        
        visiting.add(serviceName)
        const service = services.get(serviceName)
        if (!service) {
          throw new Error(`Service ${serviceName} not found`)
        }
        
        const dependencies: string[] = []
        for (const dep of service.dependencies) {
          dependencies.push(...visit(dep))
        }
        
        visiting.delete(serviceName)
        visited.add(serviceName)
        dependencies.push(serviceName)
        
        return dependencies
      }
      
      // Group services by phase and priority
      const phases: Record<StartupPhase, string[]> = {
        bootstrap: [],
        critical: [],
        primary: [],
        secondary: [],
        background: []
      }
      
      for (const [name, service] of services) {
        if (service.priority === 'critical' && service.dependencies.length === 0) {
          phases.bootstrap.push(name)
        } else if (service.priority === 'critical') {
          phases.critical.push(name)
        } else if (service.priority === 'high') {
          phases.primary.push(name)
        } else if (service.priority === 'normal') {
          phases.secondary.push(name)
        } else {
          phases.background.push(name)
        }
      }
      
      // Resolve dependencies within each phase
      for (const phase of Object.values(phases)) {
        if (phase.length === 0) continue
        
        const levelGroups: string[][] = []
        const remaining = [...phase]
        
        while (remaining.length > 0) {
          const currentLevel: string[] = []
          
          for (let i = remaining.length - 1; i >= 0; i--) {
            const serviceName = remaining[i]
            const service = services.get(serviceName)!
            
            // Check if all dependencies are already resolved
            const allDepsResolved = service.dependencies.every(dep => 
              resolved.flat().includes(dep) || currentLevel.includes(dep)
            )
            
            if (allDepsResolved) {
              currentLevel.push(serviceName)
              remaining.splice(i, 1)
            }
          }
          
          if (currentLevel.length === 0 && remaining.length > 0) {
            throw new Error(`Cannot resolve dependencies for services: ${remaining.join(', ')}`)
          }
          
          if (currentLevel.length > 0) {
            levelGroups.push(currentLevel)
          }
        }
        
        resolved.push(...levelGroups)
      }
      
      return resolved
    }
    
    return {
      registerService: (descriptor: ServiceDescriptor) =>
        Effect.gen(function* () {
          services.set(descriptor.name, descriptor)
          yield* Effect.logInfo(`Registered service: ${descriptor.name}`)
        }),
      
      initializeServices: (targetPhase: StartupPhase = 'background') =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`Starting service initialization (target phase: ${targetPhase})`)
          
          const startTime = performance.now()
          const initializationOrder = resolveDependencies()
          const totalServices = initializationOrder.flat().length
          
          yield* Ref.update(progress, p => ({
            ...p,
            totalServices,
            estimatedTimeRemaining: Array.from(services.values())
              .reduce((sum, s) => sum + s.estimatedLoadTime, 0)
          }))
          
          let completedCount = 0
          const errors: Array<{ service: string; error: string }> = []
          
          for (const group of initializationOrder) {
            // Determine current phase
            const firstService = services.get(group[0])
            if (!firstService) continue
            
            const phaseOrder: StartupPhase[] = ['bootstrap', 'critical', 'primary', 'secondary', 'background']
            let currentPhaseIndex = 0
            
            if (firstService.priority === 'critical' && firstService.dependencies.length === 0) {
              currentPhaseIndex = 0 // bootstrap
            } else if (firstService.priority === 'critical') {
              currentPhaseIndex = 1 // critical
            } else if (firstService.priority === 'high') {
              currentPhaseIndex = 2 // primary
            } else if (firstService.priority === 'normal') {
              currentPhaseIndex = 3 // secondary
            } else {
              currentPhaseIndex = 4 // background
            }
            
            const phase = phaseOrder[currentPhaseIndex]
            yield* Ref.set(currentPhase, phase)
            
            // Stop if we've reached the target phase
            const targetPhaseIndex = phaseOrder.indexOf(targetPhase)
            if (currentPhaseIndex > targetPhaseIndex) {
              break
            }
            
            yield* Effect.logInfo(`Initializing phase: ${phase} (${group.length} services)`)
            
            // Initialize services in parallel if enabled
            if (config.enableParallelLoading && group.length > 1) {
              const effects = group.map(serviceName => 
                Effect.gen(function* () {
                  const service = services.get(serviceName)!
                  
                  yield* Ref.update(progress, p => ({ 
                    ...p, 
                    currentService: serviceName,
                    phase
                  }))
                  
                  const serviceStartTime = performance.now()
                  
                  try {
                    if (config.enableServiceProfiling) {
                      yield* Profile.start(`service_init:${serviceName}`)
                    }
                    
                    // Simulate service initialization (replace with actual initialization)
                    yield* Effect.sleep(Duration.millis(Math.min(service.estimatedLoadTime, 50)))
                    
                    // Run warmup if configured
                    if (config.enableWarmupPhase && service.warmup) {
                      yield* service.warmup()
                    }
                    
                    // Run health check if configured
                    if (config.enableServiceHealthChecks && service.healthCheck) {
                      const isHealthy = yield* service.healthCheck()
                      if (!isHealthy) {
                        throw new Error(`Health check failed for ${serviceName}`)
                      }
                    }
                    
                    if (config.enableServiceProfiling) {
                      yield* Profile.end(`service_init:${serviceName}`)
                    }
                    
                    const serviceTime = performance.now() - serviceStartTime
                    yield* Metrics.recordTimer('startup.service_init_time', serviceTime, { 
                      service: serviceName, 
                      phase,
                      priority: service.priority
                    })
                    
                    yield* Effect.logInfo(`Initialized ${serviceName} (${serviceTime.toFixed(2)}ms)`)
                    
                  } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    errors.push({ service: serviceName, error: errorMessage })
                    yield* Effect.logError(`Failed to initialize ${serviceName}: ${errorMessage}`)
                  }
                })
              )
              
              // Limit concurrency
              const chunked = []
              for (let i = 0; i < effects.length; i += config.maxConcurrentServices) {
                chunked.push(effects.slice(i, i + config.maxConcurrentServices))
              }
              
              for (const chunk of chunked) {
                yield* Effect.all(chunk, { concurrency: 'unbounded' })
              }
              
            } else {
              // Sequential initialization
              for (const serviceName of group) {
                const service = services.get(serviceName)!
                
                yield* Ref.update(progress, p => ({ 
                  ...p, 
                  currentService: serviceName,
                  phase
                }))
                
                const serviceStartTime = performance.now()
                
                try {
                  if (config.enableServiceProfiling) {
                    yield* Profile.start(`service_init:${serviceName}`)
                  }
                  
                  // Simulate service initialization
                  yield* Effect.sleep(Duration.millis(Math.min(service.estimatedLoadTime, 50)))
                  
                  if (config.enableWarmupPhase && service.warmup) {
                    yield* service.warmup()
                  }
                  
                  if (config.enableServiceHealthChecks && service.healthCheck) {
                    const isHealthy = yield* service.healthCheck()
                    if (!isHealthy) {
                      throw new Error(`Health check failed for ${serviceName}`)
                    }
                  }
                  
                  if (config.enableServiceProfiling) {
                    yield* Profile.end(`service_init:${serviceName}`)
                  }
                  
                  const serviceTime = performance.now() - serviceStartTime
                  yield* Metrics.recordTimer('startup.service_init_time', serviceTime, { 
                    service: serviceName, 
                    phase,
                    priority: service.priority
                  })
                  
                  yield* Effect.logInfo(`Initialized ${serviceName} (${serviceTime.toFixed(2)}ms)`)
                  
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error)
                  errors.push({ service: serviceName, error: errorMessage })
                  yield* Effect.logError(`Failed to initialize ${serviceName}: ${errorMessage}`)
                }
              }
            }
            
            // Update progress
            completedCount += group.length
            const percentage = (completedCount / totalServices) * 100
            const elapsedTime = performance.now() - startTime
            const estimatedTimeRemaining = errors.length === 0 
              ? (elapsedTime / completedCount) * (totalServices - completedCount)
              : 0
            
            yield* Ref.update(progress, p => ({
              ...p,
              completedServices: [...p.completedServices, ...group],
              percentage,
              estimatedTimeRemaining,
              errors
            }))
            
            // Mark services as ready
            yield* Ref.update(readyServices, ready => {
              const newReady = new Set(ready)
              group.forEach(service => newReady.add(service))
              return newReady
            })
          }
          
          const totalTime = performance.now() - startTime
          yield* Metrics.recordTimer('startup.total_time', totalTime, { 
            target_phase: targetPhase,
            services_count: completedCount,
            errors_count: errors.length
          })
          
          if (errors.length > 0) {
            yield* Effect.fail(`Service initialization failed with ${errors.length} errors`)
          }
          
          yield* Effect.logInfo(`Service initialization completed in ${totalTime.toFixed(2)}ms`)
        }),
      
      getProgress: () => Ref.get(progress),
      
      isServiceReady: (serviceName: string) =>
        Effect.gen(function* () {
          const ready = yield* Ref.get(readyServices)
          return ready.has(serviceName)
        }),
      
      waitForService: (serviceName: string, timeout: number = 30000) =>
        Effect.gen(function* () {
          const isReady = yield* Ref.get(readyServices)
          if (isReady.has(serviceName)) {
            return
          }
          
          // Poll for service readiness with timeout
          const checkService = Effect.gen(function* () {
            const ready = yield* Ref.get(readyServices)
            if (ready.has(serviceName)) {
              return true
            }
            yield* Effect.sleep(Duration.millis(100))
            return false
          })
          
          const found = yield* checkService.pipe(
            Effect.repeat(Schedule.whileOutput(ready => !ready)),
            Effect.timeout(Duration.millis(timeout))
          )
          
          if (!found._tag || found._tag === 'None') {
            yield* Effect.fail(`Service ${serviceName} not ready within ${timeout}ms`)
          }
        }),
      
      optimizeStartupOrder: () =>
        Effect.gen(function* () {
          yield* Effect.logInfo('Optimizing startup order based on performance data')
          
          // Analyze timing data and adjust estimated load times
          const measurements = yield* Profile.getMeasurements()
          const serviceTimings = measurements
            .filter(m => m.name.startsWith('service_init:'))
            .reduce((acc, m) => {
              const serviceName = m.name.replace('service_init:', '')
              if (!acc[serviceName]) acc[serviceName] = []
              acc[serviceName].push(m.duration)
              return acc
            }, {} as Record<string, number[]>)
          
          // Update estimated load times based on actual measurements
          for (const [serviceName, timings] of Object.entries(serviceTimings)) {
            const service = services.get(serviceName)
            if (service) {
              const avgTime = timings.reduce((sum, t) => sum + t, 0) / timings.length
              const optimizedService = {
                ...service,
                estimatedLoadTime: Math.max(avgTime * 1.1, service.estimatedLoadTime * 0.5) // Conservative adjustment
              }
              services.set(serviceName, optimizedService)
            }
          }
          
          yield* Effect.logInfo('Startup order optimization completed')
        }),
      
      generateStartupReport: () =>
        Effect.gen(function* () {
          const currentProgress = yield* Ref.get(progress)
          
          let report = '🚀 Startup Performance Report\n'
          report += '═'.repeat(50) + '\n\n'
          
          report += `Phase: ${currentProgress.phase}\n`
          report += `Progress: ${currentProgress.percentage.toFixed(1)}%\n`
          report += `Services: ${currentProgress.completedServices.length}/${currentProgress.totalServices}\n`
          
          if (currentProgress.estimatedTimeRemaining > 0) {
            report += `ETA: ${currentProgress.estimatedTimeRemaining.toFixed(0)}ms\n`
          }
          
          if (currentProgress.currentService) {
            report += `Current: ${currentProgress.currentService}\n`
          }
          
          report += '\n'
          
          if (currentProgress.errors.length > 0) {
            report += '❌ Errors:\n'
            for (const error of currentProgress.errors) {
              report += `  • ${error.service}: ${error.error}\n`
            }
            report += '\n'
          }
          
          report += '✅ Completed Services:\n'
          for (const service of currentProgress.completedServices) {
            report += `  • ${service}\n`
          }
          
          return report
        })
    }
  })

/**
 * Startup optimizer service tag
 */
export class StartupOptimizerService extends Context.Tag('StartupOptimizerService')<
  StartupOptimizerService,
  StartupOptimizer
>() {}

/**
 * Layer for startup optimizer
 */
export const StartupOptimizerLayer = (config?: StartupConfig) =>
  Layer.effect(StartupOptimizerService, createStartupOptimizer(config))

/**
 * Progressive startup with user feedback
 */
export const progressiveStartup = (
  targetPhase: StartupPhase = 'primary',
  onProgress?: (progress: StartupProgress) => void
): Effect.Effect<void, string, StartupOptimizerService> =>
  Effect.gen(function* () {
    const optimizer = yield* StartupOptimizerService
    
    // Start initialization
    const initFiber = yield* Effect.fork(
      optimizer.initializeServices(targetPhase)
    )
    
    // Monitor progress if callback provided
    if (onProgress) {
      const progressMonitor = optimizer.getProgress().pipe(
        Effect.tap(progress => Effect.sync(() => onProgress(progress))),
        Effect.repeat(Schedule.fixed(Duration.millis(100))),
        Effect.fork
      )
      
      yield* progressMonitor
    }
    
    // Wait for completion
    yield* Effect.join(initFiber)
  })