import { Effect, Ref, Queue, Option, Schedule, Duration } from 'effect'
import { Stats, Clock, DeltaTime } from '@/runtime/services'
import { FPSCounter, Profile, withFPSTracking } from '@/core/performance'

/**
 * Advanced game loop configuration for optimal performance
 */
export interface GameLoopConfig {
  readonly targetFPS: number
  readonly fixedTimeStep: number
  readonly maxFrameSkip: number
  readonly enableInterpolation: boolean
  readonly enableAdaptiveQuality: boolean
  readonly priorityThreshold: number
  readonly enableFramePacing: boolean
  readonly enableLatencyReduction: boolean
  readonly adaptiveTimestep: boolean
  readonly frameSmoothing: number // 0-1, amount of frame time smoothing
  readonly cpuBudget: number // ms, total CPU budget per frame
  readonly gpuBudget: number // ms, GPU budget for rendering
}

export const defaultGameLoopConfig: GameLoopConfig = {
  targetFPS: 60,
  fixedTimeStep: 1000 / 60, // 16.67ms
  maxFrameSkip: 5,
  enableInterpolation: true,
  enableAdaptiveQuality: true,
  priorityThreshold: 20, // ms
  enableFramePacing: true,
  enableLatencyReduction: true,
  adaptiveTimestep: true,
  frameSmoothing: 0.1, // 10% smoothing
  cpuBudget: 14, // ms, leave 2ms for browser overhead
  gpuBudget: 10 // ms, conservative GPU budget
}

/**
 * System priority levels for workload distribution
 */
export type SystemPriority = 'critical' | 'high' | 'normal' | 'low'

export interface PrioritizedSystem<E, R> {
  readonly system: Effect.Effect<void, E, R>
  readonly priority: SystemPriority
  readonly maxExecutionTime?: number
  readonly canSkip?: boolean
  readonly name?: string
}

/**
 * Frame state for interpolation and timing
 */
interface FrameState {
  readonly accumulator: number
  readonly currentTime: number
  readonly frameTime: number
  readonly smoothedFrameTime: number
  readonly alpha: number // interpolation alpha
  readonly frameCount: number
  readonly skippedFrames: number
  readonly averageFrameTimes: ReadonlyArray<number>
  readonly cpuUsage: number // 0-1, current frame CPU usage
  readonly gpuUsage: number // 0-1, estimated GPU usage
  readonly lagSpike: boolean // true if frame was significantly longer
  readonly adaptiveTimestep: number // dynamic timestep adjustment
}

/**
 * Task queue for workload distribution
 */
interface TaskQueue<E, R> {
  readonly critical: Queue.Queue<PrioritizedSystem<E, R>>
  readonly high: Queue.Queue<PrioritizedSystem<E, R>>
  readonly normal: Queue.Queue<PrioritizedSystem<E, R>>
  readonly low: Queue.Queue<PrioritizedSystem<E, R>>
}

/**
 * Create optimized game loop tick with fixed timestep and interpolation
 */
export const createOptimizedTick = <E, R>(
  systems: ReadonlyArray<PrioritizedSystem<E, R>>,
  config: GameLoopConfig = defaultGameLoopConfig
) =>
  Effect.gen(function* (_) {
    const stats = yield* _(Stats)
    
    // Initialize frame state
    const frameState = yield* _(Ref.make<FrameState>({
      accumulator: 0,
      currentTime: performance.now(),
      frameTime: config.fixedTimeStep,
      smoothedFrameTime: config.fixedTimeStep,
      alpha: 0,
      frameCount: 0,
      skippedFrames: 0,
      averageFrameTimes: [],
      cpuUsage: 0,
      gpuUsage: 0,
      lagSpike: false,
      adaptiveTimestep: config.fixedTimeStep
    }))
    
    // Create priority-based task queues
    const taskQueue: TaskQueue<E, R> = {
      critical: yield* _(Queue.unbounded<PrioritizedSystem<E, R>>()),
      high: yield* _(Queue.unbounded<PrioritizedSystem<E, R>>()),
      normal: yield* _(Queue.unbounded<PrioritizedSystem<E, R>>()),
      low: yield* _(Queue.unbounded<PrioritizedSystem<E, R>>())
    }
    
    // Distribute systems to appropriate queues
    for (const prioritizedSystem of systems) {
      const queue = taskQueue[prioritizedSystem.priority]
      yield* _(Queue.offer(queue, prioritizedSystem))
    }
    
    return Effect.gen(function* (_) {
      yield* _(stats.begin)
      yield* _(withFPSTracking(() => {}))
      
      const frameStartTime = performance.now()
      const state = yield* _(Ref.get(frameState))
      
      let newTime = frameStartTime
      let rawFrameTime = newTime - state.currentTime
      
      // Frame time smoothing to reduce jitter
      const smoothingFactor = config.frameSmoothing
      const smoothedFrameTime = state.smoothedFrameTime * (1 - smoothingFactor) + 
                                rawFrameTime * smoothingFactor
      
      // Detect lag spikes (frame significantly longer than expected)
      const expectedFrameTime = config.fixedTimeStep
      const lagSpike = rawFrameTime > expectedFrameTime * 2.5
      
      // Cap frame time to prevent spiral of death, but allow for lag spike recovery
      let frameTime = rawFrameTime
      if (frameTime > 250) {
        frameTime = lagSpike ? Math.min(frameTime, expectedFrameTime * 4) : expectedFrameTime
      }
      
      // Adaptive timestep adjustment based on performance
      let adaptiveTimestep = state.adaptiveTimestep
      if (config.adaptiveTimestep) {
        const targetFrameTime = 1000 / config.targetFPS
        const performanceRatio = smoothedFrameTime / targetFrameTime
        
        if (performanceRatio > 1.2) {
          // Performance is poor, increase timestep slightly
          adaptiveTimestep = Math.min(adaptiveTimestep * 1.02, targetFrameTime * 1.5)
        } else if (performanceRatio < 0.8) {
          // Performance is good, decrease timestep slightly
          adaptiveTimestep = Math.max(adaptiveTimestep * 0.98, targetFrameTime * 0.8)
        }
      }
      
      let accumulator = state.accumulator + frameTime
      let updatedFrames = 0
      
      // Enhanced fixed timestep loop with budget tracking
      while (accumulator >= adaptiveTimestep && updatedFrames < config.maxFrameSkip) {
        const stepStartTime = performance.now()
        const stepBudget = config.cpuBudget / (config.maxFrameSkip + 1) // Distribute budget across frames
        
        // Execute critical systems first (always run, no budget limit)
        yield* _(Profile.measure('critical_systems')(
          executeSystemQueue(taskQueue.critical, adaptiveTimestep)
        ))
        
        const afterCritical = performance.now()
        const criticalTime = afterCritical - stepStartTime
        const remainingStepBudget = stepBudget - criticalTime
        
        // Execute high priority systems
        yield* _(Profile.measure('high_priority_systems')(
          executeSystemQueue(taskQueue.high, adaptiveTimestep, Math.max(remainingStepBudget * 0.6, 1))
        ))
        
        const afterHigh = performance.now()
        const highTime = afterHigh - afterCritical
        const remainingBudget = remainingStepBudget - highTime
        
        // Execute normal/low priority systems only if we have budget
        if (remainingBudget > 1) {
          // Execute normal priority systems
          yield* _(Profile.measure('normal_priority_systems')(
            executeSystemQueue(taskQueue.normal, adaptiveTimestep, remainingBudget * 0.7)
          ))
          
          const afterNormal = performance.now()
          const normalTime = afterNormal - afterHigh
          const finalBudget = remainingBudget - normalTime
          
          // Execute low priority systems with remaining budget
          if (finalBudget > 0.5) {
            yield* _(Profile.measure('low_priority_systems')(
              executeSystemQueue(taskQueue.low, adaptiveTimestep, finalBudget)
            ))
          }
        }
        
        accumulator -= adaptiveTimestep
        updatedFrames++
        
        // Break early if we're consuming too much CPU time
        const stepTime = performance.now() - stepStartTime
        if (stepTime > stepBudget * 1.5) {
          yield* _(Effect.logWarning(`Frame step exceeded budget: ${stepTime.toFixed(2)}ms vs ${stepBudget.toFixed(2)}ms`))
          break
        }
      }
      
      // Calculate interpolation alpha for smooth rendering
      const alpha = config.enableInterpolation 
        ? accumulator / adaptiveTimestep 
        : 0
      
      // Calculate frame performance metrics
      const totalFrameTime = performance.now() - frameStartTime
      const cpuUsage = Math.min(totalFrameTime / config.cpuBudget, 1.0)
      const gpuUsage = Math.min(totalFrameTime / config.gpuBudget, 1.0) // Rough estimate
      
      // Update average frame times for trend analysis
      const newFrameTimes = [...state.averageFrameTimes, totalFrameTime].slice(-60) // Keep last 60 frames (1 second at 60fps)
      
      // Update frame state with enhanced metrics
      yield* _(Ref.set(frameState, {
        accumulator,
        currentTime: newTime,
        frameTime: totalFrameTime,
        smoothedFrameTime,
        alpha,
        frameCount: state.frameCount + 1,
        skippedFrames: state.skippedFrames + Math.max(0, updatedFrames - 1),
        averageFrameTimes: newFrameTimes,
        cpuUsage,
        gpuUsage,
        lagSpike,
        adaptiveTimestep
      }))
      
      // Provide interpolation context with enhanced timing data
      yield* _(Effect.provideService(
        Effect.void,
        DeltaTime, 
        { 
          value: adaptiveTimestep, 
          alpha, 
          frameTime: totalFrameTime,
          cpuUsage,
          gpuUsage,
          lagSpike 
        }
      ))
      
      yield* _(stats.end)
    })
  })

/**
 * Execute systems in a priority queue with budget constraints
 */
const executeSystemQueue = <E, R>(
  queue: Queue.Queue<PrioritizedSystem<E, R>>,
  deltaTime: number,
  budgetMs?: number
): Effect.Effect<void, E, R> =>
  Effect.gen(function* (_) {
    const startTime = performance.now()
    let remainingBudget = budgetMs
    
    while (true) {
      const systemOption = yield* _(Queue.poll(queue))
      
      if (Option.isNone(systemOption)) {
        break // No more systems in queue
      }
      
      const prioritizedSystem = systemOption.value
      
      // Check budget constraints
      if (remainingBudget !== undefined) {
        const elapsed = performance.now() - startTime
        if (elapsed >= remainingBudget) {
          // Re-queue system for next frame if it can be skipped
          if (prioritizedSystem.canSkip !== false) {
            yield* _(Queue.offer(queue, prioritizedSystem))
          }
          break
        }
      }
      
      // Execute system with profiling and error handling
      const systemName = prioritizedSystem.name || 'unnamed_system'
      
      yield* _(
        Profile.measure(`system:${systemName}`)(
          Effect.catchAll(
            prioritizedSystem.system.pipe(
              Effect.provideService(DeltaTime, { value: deltaTime })
            ),
            (e) => Effect.logError(`Error in system ${systemName}`, e)
          )
        )
      )
      
      // Update remaining budget
      if (remainingBudget !== undefined) {
        const systemTime = performance.now() - startTime
        remainingBudget -= systemTime
      }
      
      // Re-queue system for next frame
      yield* _(Queue.offer(queue, prioritizedSystem))
    }
  })

/**
 * Adaptive quality adjustment based on performance metrics
 */
const adaptiveQualityAdjustment = (
  config: Ref.Ref<GameLoopConfig>
): Effect.Effect<void, never, never> =>
  Effect.gen(function* (_) {
    const currentFPS = yield* _(FPSCounter.getCurrentFPS())
    const isStable = yield* _(FPSCounter.isPerformanceStable())
    const currentConfig = yield* _(Ref.get(config))
    
    if (!currentConfig.enableAdaptiveQuality) {
      return
    }
    
    // Adjust quality based on performance
    if (currentFPS < currentConfig.targetFPS * 0.8) {
      // Performance is poor, reduce quality
      const newThreshold = Math.min(
        currentConfig.priorityThreshold * 1.2,
        50 // Max threshold
      )
      
      yield* _(Ref.update(config, cfg => ({
        ...cfg,
        priorityThreshold: newThreshold,
        maxFrameSkip: Math.min(cfg.maxFrameSkip + 1, 10)
      })))
      
      yield* _(Effect.logInfo(`Quality reduced: threshold=${newThreshold}ms`))
    } else if (currentFPS > currentConfig.targetFPS * 0.95 && isStable) {
      // Performance is good, potentially increase quality
      const newThreshold = Math.max(
        currentConfig.priorityThreshold * 0.9,
        10 // Min threshold
      )
      
      yield* _(Ref.update(config, cfg => ({
        ...cfg,
        priorityThreshold: newThreshold,
        maxFrameSkip: Math.max(cfg.maxFrameSkip - 1, 1)
      })))
      
      yield* _(Effect.logInfo(`Quality improved: threshold=${newThreshold}ms`))
    }
  })

/**
 * Enhanced game loop with all optimizations
 */
export const optimizedGameLoop = <E, R>(
  systems: ReadonlyArray<PrioritizedSystem<E, R>>,
  config: GameLoopConfig = defaultGameLoopConfig
) => {
  const tick = createOptimizedTick(systems, config)
  const configRef = Ref.unsafeMake(config)
  
  return Effect.gen(function* (_) {
    const clock = yield* _(Clock)
    const context = yield* _(Effect.context<R | Stats | Clock>())
    
    // Start FPS monitoring
    yield* _(FPSCounter.start())
    
    // Schedule adaptive quality adjustment
    const adaptiveAdjustment = adaptiveQualityAdjustment(configRef).pipe(
      Effect.repeat(Schedule.fixed(Duration.seconds(5))),
      Effect.fork
    )
    yield* _(adaptiveAdjustment)
    
    // Enhanced frame callback with timing control
    const frameCallback = () => 
      Effect.gen(function* (_) {
        const frameStart = performance.now()
        
        yield* _(tick.pipe(Effect.provide(context)))
        
        const frameEnd = performance.now()
        const frameTime = frameEnd - frameStart
        
        // Log long frames
        if (frameTime > config.priorityThreshold) {
          yield* _(Effect.logWarning(`Long frame detected: ${frameTime.toFixed(2)}ms`))
        }
      })
    
    yield* _(clock.onFrame(frameCallback))
  })
}

// Legacy compatibility exports
export const createTick = createOptimizedTick
export const gameLoop = optimizedGameLoop
