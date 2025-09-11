import { Effect, Ref } from 'effect'
import { Metrics } from './metrics'

/**
 * FPS counter and frame drop detection system
 * Monitors rendering performance and detects frame rate issues
 */

export interface FrameData {
  readonly timestamp: number
  readonly frameTime: number // time since last frame in ms
  readonly fps: number // calculated FPS for this frame
}

export interface FrameDropEvent {
  readonly timestamp: number
  readonly expectedFrameTime: number
  readonly actualFrameTime: number
  readonly droppedFrames: number
  readonly severity: 'minor' | 'moderate' | 'severe'
}

export interface FPSStats {
  readonly currentFPS: number
  readonly averageFPS: number
  readonly minFPS: number
  readonly maxFPS: number
  readonly p1FPS: number // 1st percentile (worst frames)
  readonly p5FPS: number // 5th percentile
  readonly p95FPS: number // 95th percentile
  readonly p99FPS: number // 99th percentile
  readonly frameDrops: number
  readonly totalFrames: number
  readonly unstableFrames: number // frames outside acceptable range
  readonly averageFrameTime: number
}

export interface FPSCounterConfig {
  readonly targetFPS: number
  readonly sampleSize: number // number of frames to keep for calculations
  readonly frameDropThreshold: number // ms over target frame time to consider a drop
  readonly enableFrameDropDetection: boolean
  readonly enableMetricsReporting: boolean
  readonly unstableThreshold: number // FPS variance threshold
}

export interface FPSCounterState {
  readonly frames: ReadonlyArray<FrameData>
  readonly frameDrops: ReadonlyArray<FrameDropEvent>
  readonly isRunning: boolean
  readonly startTime: number
  readonly lastFrameTime: number
  readonly frameCount: number
}

let fpsCounterState: Ref.Ref<FPSCounterState> | null = null
let fpsConfig: FPSCounterConfig = {
  targetFPS: 60,
  sampleSize: 300, // 5 seconds at 60fps
  frameDropThreshold: 5, // 5ms over target
  enableFrameDropDetection: true,
  enableMetricsReporting: true,
  unstableThreshold: 10, // ±10 FPS variance
}

/**
 * Initialize the FPS counter
 */
export const initializeFPSCounter = (config?: Partial<FPSCounterConfig>): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    fpsConfig = { ...fpsConfig, ...config }

    fpsCounterState = yield* Ref.make<FPSCounterState>({
      frames: [],
      frameDrops: [],
      isRunning: false,
      startTime: 0,
      lastFrameTime: 0,
      frameCount: 0,
    })

    yield* Effect.log('FPS counter initialized')
  })

/**
 * Calculate FPS from frame time
 */
const calculateFPS = (frameTime: number): number => {
  if (frameTime === 0) return 0
  return Math.round(1000 / frameTime)
}

/**
 * Detect frame drops
 */
const detectFrameDrop = (frameTime: number, targetFrameTime: number): FrameDropEvent | null => {
  if (!fpsConfig.enableFrameDropDetection) return null

  const threshold = targetFrameTime + fpsConfig.frameDropThreshold

  if (frameTime > threshold) {
    const droppedFrames = Math.floor(frameTime / targetFrameTime) - 1
    const severity: FrameDropEvent['severity'] = frameTime > targetFrameTime * 3 ? 'severe' : frameTime > targetFrameTime * 2 ? 'moderate' : 'minor'

    return {
      timestamp: Date.now(),
      expectedFrameTime: targetFrameTime,
      actualFrameTime: frameTime,
      droppedFrames,
      severity,
    }
  }

  return null
}

/**
 * Update FPS calculations
 */
const updateFPS = (currentTime: number): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!fpsCounterState) return

    const state = yield* Ref.get(fpsCounterState)

    if (!state.isRunning) return

    const frameTime = state.lastFrameTime > 0 ? currentTime - state.lastFrameTime : 0
    const fps = calculateFPS(frameTime)

    const frameData: FrameData = {
      timestamp: currentTime,
      frameTime,
      fps,
    }

    // Update frames array (keep only last N frames)
    const frames = [...state.frames, frameData]
    const trimmedFrames = frames.length > fpsConfig.sampleSize ? frames.slice(-fpsConfig.sampleSize) : frames

    // Detect frame drops
    const targetFrameTime = 1000 / fpsConfig.targetFPS
    const frameDrop = frameTime > 0 ? detectFrameDrop(frameTime, targetFrameTime) : null

    const frameDrops = frameDrop
      ? [...state.frameDrops, frameDrop].slice(-100) // Keep last 100 drops
      : state.frameDrops

    yield* Ref.set(fpsCounterState, {
      frames: trimmedFrames,
      frameDrops,
      isRunning: true,
      startTime: state.startTime,
      lastFrameTime: currentTime,
      frameCount: state.frameCount + 1,
    })

    // Report metrics
    if (fpsConfig.enableMetricsReporting && frameTime > 0) {
      yield* Metrics.recordGauge('fps.current', fps, 'fps')
      yield* Metrics.recordTimer('frame.time', frameTime)

      if (frameDrop) {
        yield* Metrics.increment('frame.drops', {
          severity: frameDrop.severity,
          dropped_count: frameDrop.droppedFrames.toString(),
        })
      }
    }

    // Log severe frame drops
    if (frameDrop && frameDrop.severity === 'severe') {
      yield* Effect.logWarning(`Severe frame drop detected: ${frameTime.toFixed(2)}ms (${frameDrop.droppedFrames} frames dropped)`)
    }
  })

/**
 * Main FPSCounter API
 */
export const FPSCounter = {
  /**
   * Start FPS monitoring
   */
  start: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!fpsCounterState) return

      const now = performance.now()

      yield* Ref.update(fpsCounterState, (state) => ({
        ...state,
        isRunning: true,
        startTime: now,
        lastFrameTime: now,
        frameCount: 0,
      }))

      yield* Effect.log('FPS monitoring started')
    }),

  /**
   * Stop FPS monitoring
   */
  stop: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!fpsCounterState) return

      yield* Ref.update(fpsCounterState, (state) => ({
        ...state,
        isRunning: false,
      }))

      yield* Effect.log('FPS monitoring stopped')
    }),

  /**
   * Record a frame (call this every frame)
   */
  tick: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      const now = performance.now()
      yield* updateFPS(now)
    }),

  /**
   * Get current FPS statistics
   */
  getStats: (): Effect.Effect<FPSStats, never, never> =>
    Effect.gen(function* () {
      if (!fpsCounterState) {
        return {
          currentFPS: 0,
          averageFPS: 0,
          minFPS: 0,
          maxFPS: 0,
          p1FPS: 0,
          p5FPS: 0,
          p95FPS: 0,
          p99FPS: 0,
          frameDrops: 0,
          totalFrames: 0,
          unstableFrames: 0,
          averageFrameTime: 0,
        }
      }

      const state = yield* Ref.get(fpsCounterState)
      const frames = state.frames.filter((f) => f.frameTime > 0) // Filter out invalid frames

      if (frames.length === 0) {
        return {
          currentFPS: 0,
          averageFPS: 0,
          minFPS: 0,
          maxFPS: 0,
          p1FPS: 0,
          p5FPS: 0,
          p95FPS: 0,
          p99FPS: 0,
          frameDrops: state.frameDrops.length,
          totalFrames: state.frameCount,
          unstableFrames: 0,
          averageFrameTime: 0,
        }
      }

      const fpsList = frames.map((f) => f.fps).sort((a, b) => a - b)
      const frameTimeList = frames.map((f) => f.frameTime)

      const currentFPS = frames[frames.length - 1]?.fps || 0
      const averageFPS = Math.round(fpsList.reduce((sum, fps) => sum + fps, 0) / fpsList.length)
      const minFPS = Math.min(...fpsList)
      const maxFPS = Math.max(...fpsList)

      // Calculate percentiles
      const percentile = (arr: number[], p: number) => {
        const index = Math.floor(((arr.length - 1) * p) / 100)
        return arr[index] || 0
      }

      const p1FPS = percentile(fpsList, 1)
      const p5FPS = percentile(fpsList, 5)
      const p95FPS = percentile(fpsList, 95)
      const p99FPS = percentile(fpsList, 99)

      // Count unstable frames (outside target ± threshold)
      const targetFPS = fpsConfig.targetFPS
      const unstableFrames = fpsList.filter((fps) => Math.abs(fps - targetFPS) > fpsConfig.unstableThreshold).length

      const averageFrameTime = frameTimeList.reduce((sum, time) => sum + time, 0) / frameTimeList.length

      return {
        currentFPS,
        averageFPS,
        minFPS,
        maxFPS,
        p1FPS,
        p5FPS,
        p95FPS,
        p99FPS,
        frameDrops: state.frameDrops.length,
        totalFrames: state.frameCount,
        unstableFrames,
        averageFrameTime,
      }
    }),

  /**
   * Get frame drop events
   */
  getFrameDrops: (severity?: FrameDropEvent['severity']): Effect.Effect<ReadonlyArray<FrameDropEvent>, never, never> =>
    Effect.gen(function* () {
      if (!fpsCounterState) return []

      const state = yield* Ref.get(fpsCounterState)

      if (!severity) return state.frameDrops

      return state.frameDrops.filter((drop) => drop.severity === severity)
    }),

  /**
   * Get recent frame data
   */
  getFrameData: (count?: number): Effect.Effect<ReadonlyArray<FrameData>, never, never> =>
    Effect.gen(function* () {
      if (!fpsCounterState) return []

      const state = yield* Ref.get(fpsCounterState)

      if (!count) return state.frames

      return state.frames.slice(-count)
    }),

  /**
   * Clear frame history
   */
  clear: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!fpsCounterState) return

      yield* Ref.update(fpsCounterState, (state) => ({
        ...state,
        frames: [],
        frameDrops: [],
        frameCount: 0,
      }))

      yield* Effect.log('FPS counter history cleared')
    }),

  /**
   * Check if monitoring is active
   */
  isRunning: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      if (!fpsCounterState) return false

      const state = yield* Ref.get(fpsCounterState)
      return state.isRunning
    }),

  /**
   * Generate FPS report
   */
  generateReport: (): Effect.Effect<string, never, never> =>
    Effect.gen(function* () {
      const stats = yield* FPSCounter.getStats()
      const frameDrops = yield* FPSCounter.getFrameDrops()

      let report = '🎯 FPS Performance Report\n'
      report += '═'.repeat(40) + '\n\n'

      // Current performance
      report += '📊 Current Performance\n'
      report += '─'.repeat(25) + '\n'
      report += `Current FPS: ${stats.currentFPS}\n`
      report += `Average FPS: ${stats.averageFPS}\n`
      report += `Frame Time: ${stats.averageFrameTime.toFixed(2)}ms\n\n`

      // Performance distribution
      report += '📈 Performance Distribution\n'
      report += '─'.repeat(30) + '\n'
      report += `Min FPS: ${stats.minFPS}\n`
      report += `1st %: ${stats.p1FPS} (worst 1%)\n`
      report += `5th %: ${stats.p5FPS}\n`
      report += `95th %: ${stats.p95FPS}\n`
      report += `99th %: ${stats.p99FPS}\n`
      report += `Max FPS: ${stats.maxFPS}\n\n`

      // Frame stability
      report += '🎮 Frame Stability\n'
      report += '─'.repeat(20) + '\n'
      report += `Total Frames: ${stats.totalFrames}\n`
      report += `Unstable Frames: ${stats.unstableFrames} (${((stats.unstableFrames / Math.max(stats.totalFrames, 1)) * 100).toFixed(1)}%)\n`
      report += `Frame Drops: ${stats.frameDrops}\n\n`

      // Frame drop analysis
      if (frameDrops.length > 0) {
        const severeCounts = frameDrops.filter((d) => d.severity === 'severe').length
        const moderateCounts = frameDrops.filter((d) => d.severity === 'moderate').length
        const minorCounts = frameDrops.filter((d) => d.severity === 'minor').length

        report += '🚨 Frame Drop Analysis\n'
        report += '─'.repeat(25) + '\n'
        report += `Severe Drops: ${severeCounts}\n`
        report += `Moderate Drops: ${moderateCounts}\n`
        report += `Minor Drops: ${minorCounts}\n`

        if (severeCounts > 0) {
          const severeDrops = frameDrops.filter((d) => d.severity === 'severe')
          const avgFrameTime = severeDrops.reduce((sum, d) => sum + d.actualFrameTime, 0) / severeDrops.length
          report += `Avg Severe Drop Time: ${avgFrameTime.toFixed(2)}ms\n`
        }

        report += '\n'
      }

      // Performance rating
      const performanceRating =
        stats.averageFPS >= fpsConfig.targetFPS * 0.95 && stats.unstableFrames < stats.totalFrames * 0.05
          ? 'Excellent'
          : stats.averageFPS >= fpsConfig.targetFPS * 0.8 && stats.unstableFrames < stats.totalFrames * 0.1
            ? 'Good'
            : stats.averageFPS >= fpsConfig.targetFPS * 0.6
              ? 'Fair'
              : 'Poor'

      report += `🏆 Overall Rating: ${performanceRating}\n\n`

      // Recommendations
      report += '💡 Recommendations\n'
      report += '─'.repeat(20) + '\n'

      if (stats.averageFPS < fpsConfig.targetFPS * 0.8) {
        report += '• Consider optimizing rendering pipeline\n'
        report += '• Reduce draw calls and polygon count\n'
        report += '• Implement level-of-detail (LOD) systems\n'
      }

      if (stats.frameDrops > stats.totalFrames * 0.05) {
        report += '• Investigate frame drop causes\n'
        report += '• Consider frame pacing techniques\n'
        report += '• Profile JavaScript execution\n'
      }

      if (stats.unstableFrames > stats.totalFrames * 0.1) {
        report += '• Implement frame time smoothing\n'
        report += '• Optimize variable workloads\n'
        report += '• Consider adaptive quality settings\n'
      }

      return report
    }),

  /**
   * Get real-time FPS for display
   */
  getCurrentFPS: (): Effect.Effect<number, never, never> =>
    Effect.gen(function* () {
      const stats = yield* FPSCounter.getStats()
      return stats.currentFPS
    }),

  /**
   * Check if performance is stable
   */
  isPerformanceStable: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      const stats = yield* FPSCounter.getStats()
      const recentFrameDrops = yield* FPSCounter.getFrameDrops('severe')

      // Consider performance stable if:
      // - Average FPS is close to target
      // - Low percentage of unstable frames
      // - No recent severe frame drops
      const fpsStable = stats.averageFPS >= fpsConfig.targetFPS * 0.9
      const framesStable = stats.unstableFrames < stats.totalFrames * 0.05
      const noSevereDrops = recentFrameDrops.length === 0

      return fpsStable && framesStable && noSevereDrops
    }),
}

/**
 * Animation frame helper with FPS tracking
 */
export const withFPSTracking = <T>(callback: () => T): Effect.Effect<T, never, never> =>
  Effect.gen(function* () {
    yield* FPSCounter.tick()
    const result = callback()
    return result
  })

/**
 * Request animation frame with FPS monitoring
 */
export const requestAnimationFrameWithFPS = (callback: () => void): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const animationCallback = () => {
      Effect.runSync(
        Effect.gen(function* () {
          yield* FPSCounter.tick()
          callback()
        }),
      )
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(animationCallback)
    } else {
      // Fallback for non-browser environments
      setTimeout(animationCallback, 1000 / fpsConfig.targetFPS)
    }
  })

/**
 * Create a frame-rate limited loop
 */
export const createFrameLoop = (callback: () => Effect.Effect<void, never, never>, targetFPS: number = fpsConfig.targetFPS): Effect.Effect<() => void, never, never> =>
  Effect.gen(function* () {
    let isRunning = true
    const frameTime = 1000 / targetFPS
    let lastTime = performance.now()

    const loop = () => {
      if (!isRunning) return

      const currentTime = performance.now()
      const deltaTime = currentTime - lastTime

      if (deltaTime >= frameTime) {
        Effect.runSync(
          Effect.gen(function* () {
            yield* FPSCounter.tick()
            yield* callback()
          }),
        )

        lastTime = currentTime - (deltaTime % frameTime)
      }

      requestAnimationFrame(loop)
    }

    requestAnimationFrame(loop)

    // Return stop function
    return () => {
      isRunning = false
    }
  })
