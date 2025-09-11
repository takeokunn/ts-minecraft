import { Effect, Ref, Schedule, Duration } from 'effect'
import { Context } from 'effect'
import { Profile, Metrics } from '@/core/performance'

/**
 * Advanced Latency Optimization and Frame Timing System
 * 
 * Features:
 * - Input-to-display latency reduction
 * - Frame pacing optimization
 * - Predictive frame scheduling
 * - GPU synchronization optimization
 * - Adaptive V-Sync management
 * - Motion-to-photon latency tracking
 */

/**
 * Latency measurement types
 */
export interface LatencyMeasurement {
  readonly inputToUpdate: number      // Input processing to game state update
  readonly updateToRender: number     // Game state update to render submission
  readonly renderToDisplay: number    // Render submission to display
  readonly totalLatency: number       // End-to-end latency
  readonly timestamp: number
}

/**
 * Frame timing configuration
 */
export interface FrameTimingConfig {
  readonly targetFPS: number
  readonly enableFramePacing: boolean
  readonly enablePredictiveScheduling: boolean
  readonly enableGPUSync: boolean
  readonly adaptiveVSync: boolean
  readonly latencyTarget: number      // Target latency in milliseconds
  readonly inputPollingRate: number   // Hz
  readonly renderAheadFrames: number  // Number of frames to render ahead
}

export const defaultFrameTimingConfig: FrameTimingConfig = {
  targetFPS: 60,
  enableFramePacing: true,
  enablePredictiveScheduling: true,
  enableGPUSync: true,
  adaptiveVSync: true,
  latencyTarget: 20, // 20ms target latency
  inputPollingRate: 1000, // 1000Hz input polling
  renderAheadFrames: 1
}

/**
 * Frame prediction data
 */
export interface FramePrediction {
  readonly predictedFrameTime: number
  readonly confidenceLevel: number // 0-1
  readonly adjustmentFactor: number
  readonly basedOnFrames: number
}

/**
 * GPU timing information
 */
export interface GPUTiming {
  readonly gpuFrameTime: number
  readonly gpuUtilization: number // 0-1
  readonly memoryBandwidth: number // Estimated
  readonly isPresentReady: boolean
}

/**
 * Input timing optimization
 */
export interface InputTiming {
  readonly lastInputTime: number
  readonly inputLag: number
  readonly predictionTime: number
  readonly interpolationFactor: number
}

/**
 * Latency optimizer interface
 */
export interface LatencyOptimizer {
  readonly recordInputEvent: (timestamp: number) => Effect.Effect<void, never, never>
  readonly recordUpdateComplete: (timestamp: number) => Effect.Effect<void, never, never>
  readonly recordRenderSubmit: (timestamp: number) => Effect.Effect<void, never, never>
  readonly recordDisplayPresent: (timestamp: number) => Effect.Effect<void, never, never>
  
  readonly getCurrentLatency: () => Effect.Effect<LatencyMeasurement | null, never, never>
  readonly getLatencyStats: () => Effect.Effect<{
    averageLatency: number
    minLatency: number
    maxLatency: number
    p95Latency: number
    framePacingEfficiency: number
  }, never, never>
  
  readonly predictNextFrameTime: () => Effect.Effect<FramePrediction, never, never>
  readonly optimizeFrameTiming: () => Effect.Effect<void, never, never>
  readonly adjustRenderAhead: (frames: number) => Effect.Effect<void, never, never>
  
  readonly enableLowLatencyMode: () => Effect.Effect<void, never, never>
  readonly disableLowLatencyMode: () => Effect.Effect<void, never, never>
  readonly isLowLatencyMode: () => Effect.Effect<boolean, never, never>
}

/**
 * Create latency optimizer with advanced timing strategies
 */
export const createLatencyOptimizer = (
  config: FrameTimingConfig = defaultFrameTimingConfig
): Effect.Effect<LatencyOptimizer, never, never> =>
  Effect.gen(function* () {
    // Timing state
    const latencyMeasurements = yield* Ref.make<ReadonlyArray<LatencyMeasurement>>([])
    const currentFrame = yield* Ref.make({
      inputTime: 0,
      updateTime: 0,
      renderTime: 0,
      displayTime: 0
    })
    
    // Frame prediction state
    const frameHistory = yield* Ref.make<ReadonlyArray<number>>([])
    const framePrediction = yield* Ref.make<FramePrediction>({
      predictedFrameTime: 1000 / config.targetFPS,
      confidenceLevel: 0.5,
      adjustmentFactor: 1.0,
      basedOnFrames: 0
    })
    
    // GPU timing state (simulated)
    const _gpuTiming = yield* Ref.make({
      gpuFrameTime: 1000 / config.targetFPS,
      gpuUtilization: 0.7,
      memoryBandwidth: 0.8,
      isPresentReady: true
    })
    
    // Low latency mode state
    const lowLatencyMode = yield* Ref.make(false)
    
    // Frame pacing state
    const lastFrameTime = yield* Ref.make(performance.now())
    const frameDebt = yield* Ref.make(0) // Accumulated timing debt
    
    // Calculate frame prediction based on history
    const calculateFramePrediction = (history: ReadonlyArray<number>): FramePrediction => {
      if (history.length < 3) {
        return {
          predictedFrameTime: 1000 / config.targetFPS,
          confidenceLevel: 0.1,
          adjustmentFactor: 1.0,
          basedOnFrames: history.length
        }
      }
      
      // Use exponential weighted moving average
      const weights = history.map((_, i) => Math.pow(0.9, history.length - 1 - i))
      const totalWeight = weights.reduce((sum, w) => sum + w, 0)
      
      const weightedAverage = history.reduce((sum, time, i) => 
        sum + time * weights[i], 0) / totalWeight
      
      // Calculate variance for confidence
      const variance = history.reduce((sum, time) => 
        sum + Math.pow(time - weightedAverage, 2), 0) / history.length
      
      const confidenceLevel = Math.max(0.1, 1 - (variance / (weightedAverage * weightedAverage)))
      
      // Calculate trend for adjustment
      const recent = history.slice(-5)
      const older = history.slice(-10, -5)
      const recentAvg = recent.length > 0 ? recent.reduce((sum, t) => sum + t, 0) / recent.length : weightedAverage
      const olderAvg = older.length > 0 ? older.reduce((sum, t) => sum + t, 0) / older.length : weightedAverage
      
      const adjustmentFactor = olderAvg > 0 ? recentAvg / olderAvg : 1.0
      
      return {
        predictedFrameTime: weightedAverage,
        confidenceLevel: Math.min(0.95, confidenceLevel),
        adjustmentFactor,
        basedOnFrames: history.length
      }
    }
    
    // Optimal frame pacing calculation
    const calculateOptimalFrameTiming = (prediction: FramePrediction, debt: number): number => {
      const targetFrameTime = 1000 / config.targetFPS
      const predictedTime = prediction.predictedFrameTime
      
      // Adjust for frame debt (accumulated timing error)
      const debtAdjustment = debt * 0.1 // Gradual debt payback
      
      // Confidence-based adjustment
      const confidenceWeight = prediction.confidenceLevel
      const adjustedTime = (predictedTime * confidenceWeight) + 
                          (targetFrameTime * (1 - confidenceWeight))
      
      return Math.max(0, adjustedTime - debtAdjustment)
    }
    
    return {
      recordInputEvent: (timestamp: number) =>
        Effect.gen(function* () {
          yield* Ref.update(currentFrame, frame => ({
            ...frame,
            inputTime: timestamp
          }))
          
          yield* Metrics.recordGauge('latency.input_timestamp', timestamp, 'ms')
        }),
      
      recordUpdateComplete: (timestamp: number) =>
        Effect.gen(function* () {
          yield* Ref.update(currentFrame, frame => ({
            ...frame,
            updateTime: timestamp
          }))
          
          const frame = yield* Ref.get(currentFrame)
          if (frame.inputTime > 0) {
            const inputToUpdate = timestamp - frame.inputTime
            yield* Metrics.recordTimer('latency.input_to_update', inputToUpdate)
          }
        }),
      
      recordRenderSubmit: (timestamp: number) =>
        Effect.gen(function* () {
          yield* Ref.update(currentFrame, frame => ({
            ...frame,
            renderTime: timestamp
          }))
          
          const frame = yield* Ref.get(currentFrame)
          if (frame.updateTime > 0) {
            const updateToRender = timestamp - frame.updateTime
            yield* Metrics.recordTimer('latency.update_to_render', updateToRender)
          }
        }),
      
      recordDisplayPresent: (timestamp: number) =>
        Effect.gen(function* () {
          yield* Ref.update(currentFrame, frame => ({
            ...frame,
            displayTime: timestamp
          }))
          
          const frame = yield* Ref.get(currentFrame)
          
          // Calculate complete latency measurement
          if (frame.inputTime > 0 && frame.updateTime > 0 && frame.renderTime > 0) {
            const measurement: LatencyMeasurement = {
              inputToUpdate: frame.updateTime - frame.inputTime,
              updateToRender: frame.renderTime - frame.updateTime,
              renderToDisplay: timestamp - frame.renderTime,
              totalLatency: timestamp - frame.inputTime,
              timestamp
            }
            
            yield* Ref.update(latencyMeasurements, measurements => {
              const newMeasurements = [...measurements, measurement]
              return newMeasurements.slice(-100) // Keep last 100 measurements
            })
            
            yield* Metrics.recordTimer('latency.total', measurement.totalLatency)
            yield* Metrics.recordTimer('latency.render_to_display', measurement.renderToDisplay)
            
            // Reset frame for next measurement
            yield* Ref.set(currentFrame, {
              inputTime: 0,
              updateTime: 0,
              renderTime: 0,
              displayTime: 0
            })
          }
        }),
      
      getCurrentLatency: () =>
        Effect.gen(function* () {
          const measurements = yield* Ref.get(latencyMeasurements)
          return measurements.length > 0 ? measurements[measurements.length - 1] : null
        }),
      
      getLatencyStats: () =>
        Effect.gen(function* () {
          const measurements = yield* Ref.get(latencyMeasurements)
          
          if (measurements.length === 0) {
            return {
              averageLatency: 0,
              minLatency: 0,
              maxLatency: 0,
              p95Latency: 0,
              framePacingEfficiency: 0
            }
          }
          
          const latencies = measurements.map(m => m.totalLatency).sort((a, b) => a - b)
          const sum = latencies.reduce((sum, l) => sum + l, 0)
          
          const p95Index = Math.floor(latencies.length * 0.95)
          
          // Calculate frame pacing efficiency
          const targetFrameTime = 1000 / config.targetFPS
          const frameTimes = measurements.map(m => m.updateToRender + m.renderToDisplay)
          const frameTimeVariance = frameTimes.reduce((sum, time) => 
            sum + Math.pow(time - targetFrameTime, 2), 0) / frameTimes.length
          const framePacingEfficiency = Math.max(0, 1 - (frameTimeVariance / (targetFrameTime * targetFrameTime)))
          
          return {
            averageLatency: sum / latencies.length,
            minLatency: latencies[0],
            maxLatency: latencies[latencies.length - 1],
            p95Latency: latencies[p95Index],
            framePacingEfficiency
          }
        }),
      
      predictNextFrameTime: () =>
        Effect.gen(function* () {
          const history = yield* Ref.get(frameHistory)
          const prediction = calculateFramePrediction(history)
          
          yield* Ref.set(framePrediction, prediction)
          return prediction
        }),
      
      optimizeFrameTiming: () =>
        Effect.gen(function* () {
          if (!config.enableFramePacing) return
          
          yield* Profile.start('frame_timing_optimization')
          
          const now = performance.now()
          const lastTime = yield* Ref.get(lastFrameTime)
          const actualFrameTime = now - lastTime
          const targetFrameTime = 1000 / config.targetFPS
          
          // Update frame history
          yield* Ref.update(frameHistory, history => {
            const newHistory = [...history, actualFrameTime]
            return newHistory.slice(-60) // Keep last 60 frames
          })
          
          // Update frame debt
          const frameError = actualFrameTime - targetFrameTime
          yield* Ref.update(frameDebt, debt => debt + frameError)
          
          // Calculate optimal timing for next frame
          const prediction = yield* framePrediction.get
          const debt = yield* Ref.get(frameDebt)
          const optimalTiming = calculateOptimalFrameTiming(prediction, debt)
          
          // Apply frame pacing if enabled
          if (config.enableFramePacing && optimalTiming > 0) {
            const waitTime = Math.max(0, optimalTiming - 2) // 2ms buffer for scheduling
            if (waitTime > 0.5) { // Only wait if significant
              yield* Effect.sleep(Duration.millis(waitTime))
            }
          }
          
          yield* Ref.set(lastFrameTime, performance.now())
          
          // Record metrics
          yield* Metrics.recordTimer('frame.actual_time', actualFrameTime)
          yield* Metrics.recordTimer('frame.optimal_time', optimalTiming)
          yield* Metrics.recordGauge('frame.debt', debt, 'ms')
          yield* Metrics.recordGauge('frame.prediction_confidence', prediction.confidenceLevel, 'ratio')
          
          yield* Profile.end('frame_timing_optimization')
        }),
      
      adjustRenderAhead: (frames: number) =>
        Effect.gen(function* () {
          const clampedFrames = Math.max(0, Math.min(frames, 3)) // 0-3 frames ahead
          
          yield* Effect.logInfo(`Adjusting render ahead to ${clampedFrames} frames`)
          yield* Metrics.recordGauge('frame.render_ahead', clampedFrames, 'frames')
          
          // Simulate render ahead adjustment
          // In a real implementation, this would adjust the graphics pipeline
        }),
      
      enableLowLatencyMode: () =>
        Effect.gen(function* () {
          yield* Ref.set(lowLatencyMode, true)
          yield* Effect.logInfo('Low latency mode enabled')
          
          // Implement low latency optimizations
          yield* Metrics.recordGauge('frame.low_latency_mode', 1, 'boolean')
          
          // In a real implementation:
          // - Reduce render ahead frames
          // - Increase input polling rate
          // - Disable VSync if adaptive
          // - Prioritize latency over visual quality
        }),
      
      disableLowLatencyMode: () =>
        Effect.gen(function* () {
          yield* Ref.set(lowLatencyMode, false)
          yield* Effect.logInfo('Low latency mode disabled')
          
          yield* Metrics.recordGauge('frame.low_latency_mode', 0, 'boolean')
        }),
      
      isLowLatencyMode: () => Ref.get(lowLatencyMode)
    }
  })

/**
 * Latency optimizer service tag
 */
export class LatencyOptimizerService extends Context.Tag('LatencyOptimizerService')<
  LatencyOptimizerService,
  LatencyOptimizer
>() {}

/**
 * Advanced input prediction system
 */
export const createInputPredictor = () =>
  Effect.gen(function* () {
    const inputHistory = yield* Ref.make<ReadonlyArray<{
      timestamp: number
      position: { x: number; y: number }
      velocity: { x: number; y: number }
    }>>([])
    
    return {
      recordInput: (timestamp: number, position: { x: number; y: number }) =>
        Effect.gen(function* () {
          const history = yield* Ref.get(inputHistory)
          
          // Calculate velocity if we have previous input
          let velocity = { x: 0, y: 0 }
          if (history.length > 0) {
            const prev = history[history.length - 1]
            const dt = (timestamp - prev.timestamp) / 1000 // Convert to seconds
            if (dt > 0) {
              velocity = {
                x: (position.x - prev.position.x) / dt,
                y: (position.y - prev.position.y) / dt
              }
            }
          }
          
          const inputData = { timestamp, position, velocity }
          
          yield* Ref.update(inputHistory, history => {
            const newHistory = [...history, inputData]
            return newHistory.slice(-10) // Keep last 10 inputs
          })
        }),
      
      predictInput: (predictionTime: number) =>
        Effect.gen(function* () {
          const history = yield* Ref.get(inputHistory)
          
          if (history.length < 2) {
            return history.length > 0 ? history[0].position : { x: 0, y: 0 }
          }
          
          const latest = history[history.length - 1]
          const predictedPosition = {
            x: latest.position.x + latest.velocity.x * predictionTime,
            y: latest.position.y + latest.velocity.y * predictionTime
          }
          
          return predictedPosition
        })
    }
  })

/**
 * GPU synchronization optimizer
 */
export const createGPUSyncOptimizer = () =>
  Effect.gen(function* () {
    const gpuState = yield* Ref.make({
      lastSyncTime: performance.now(),
      pendingFrames: 0,
      estimatedGPUTime: 16.67 // Start with 60fps estimate
    })
    
    return {
      waitForGPU: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(gpuState)
          const now = performance.now()
          
          // Simulate GPU fence/query
          const estimatedWaitTime = Math.max(0, state.estimatedGPUTime - (now - state.lastSyncTime))
          
          if (estimatedWaitTime > 0.5) {
            yield* Effect.sleep(Duration.millis(estimatedWaitTime))
          }
          
          yield* Ref.update(gpuState, s => ({
            ...s,
            lastSyncTime: performance.now(),
            pendingFrames: Math.max(0, s.pendingFrames - 1)
          }))
        }),
      
      submitFrame: () =>
        Effect.gen(function* () {
          yield* Ref.update(gpuState, s => ({
            ...s,
            pendingFrames: s.pendingFrames + 1
          }))
        }),
      
      updateGPUTiming: (gpuTime: number) =>
        Effect.gen(function* () {
          yield* Ref.update(gpuState, s => ({
            ...s,
            estimatedGPUTime: s.estimatedGPUTime * 0.9 + gpuTime * 0.1 // Smooth estimation
          }))
        })
    }
  })

/**
 * Continuous latency monitoring
 */
export const monitorLatencyPerformance = (): Effect.Effect<void, never, LatencyOptimizerService> =>
  Effect.gen(function* () {
    const optimizer = yield* LatencyOptimizerService
    
    const stats = yield* optimizer.getLatencyStats()
    
    // Log concerning latency metrics
    if (stats.averageLatency > 30) {
      yield* Effect.logWarning(`High average latency: ${stats.averageLatency.toFixed(2)}ms`)
    }
    
    if (stats.p95Latency > 50) {
      yield* Effect.logWarning(`High P95 latency: ${stats.p95Latency.toFixed(2)}ms`)
    }
    
    if (stats.framePacingEfficiency < 0.8) {
      yield* Effect.logWarning(`Poor frame pacing efficiency: ${(stats.framePacingEfficiency * 100).toFixed(1)}%`)
    }
    
    // Auto-enable low latency mode if latency is consistently high
    if (stats.averageLatency > 40 && stats.p95Latency > 60) {
      const isLowLatencyMode = yield* optimizer.isLowLatencyMode()
      if (!isLowLatencyMode) {
        yield* optimizer.enableLowLatencyMode()
        yield* Effect.logInfo('Auto-enabled low latency mode due to high latency')
      }
    }
    
    // Optimize frame timing
    yield* optimizer.optimizeFrameTiming()
    
  }).pipe(
    Effect.repeat(Schedule.fixed(Duration.millis(100))) // Monitor every 100ms
  )