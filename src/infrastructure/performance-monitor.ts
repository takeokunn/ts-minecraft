import { Effect, Layer, Ref, Schedule, Duration } from 'effect'
import { pipe } from 'effect/Function'

// --- Configuration ---

const CONFIG = {
  MONITORING_ENABLED: true,
  SAMPLE_RATE: 60, // FPS for monitoring
  HISTORY_LENGTH: 300, // 5 seconds at 60fps
  ALERT_THRESHOLDS: {
    lowFPS: 30,
    highMemory: 512 * 1024 * 1024, // 512MB
    highLatency: 100, // ms
    highGCPressure: 10, // GC events per second
  },
  METRICS_EXPORT: true,
  PROFILING_ENABLED: true,
  AUTO_OPTIMIZATION: true,
} as const

// --- Performance Types ---

/**
 * Frame timing information
 */
export interface FrameTiming {
  frameNumber: number
  startTime: number
  endTime: number
  deltaTime: number
  fps: number
  renderTime: number
  updateTime: number
  gpuTime: number
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  jsHeapUsed: number
  jsHeapTotal: number
  jsHeapLimit: number
  wasmMemory: number
  gpuMemory: number
  textureMemory: number
  bufferMemory: number
  totalMemory: number
  memoryPressure: number
}

/**
 * System performance metrics
 */
export interface SystemMetrics {
  cpuUsage: number
  gpuUsage: number
  networkLatency: number
  diskIO: number
  cacheHitRate: number
  threadsActive: number
  workersActive: number
}

/**
 * Rendering performance metrics
 */
export interface RenderingMetrics {
  drawCalls: number
  triangles: number
  vertices: number
  instances: number
  textureBinds: number
  shaderSwitches: number
  culledObjects: number
  visibleObjects: number
  batchedDrawCalls: number
}

/**
 * Game-specific metrics
 */
export interface GameMetrics {
  entitiesTotal: number
  entitiesActive: number
  chunksLoaded: number
  chunksVisible: number
  chunksGenerated: number
  queriesPerSecond: number
  systemUpdatesPerSecond: number
  networkMessages: number
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  id: string
  type: 'warning' | 'error' | 'critical'
  category: 'fps' | 'memory' | 'network' | 'gpu' | 'system'
  message: string
  value: number
  threshold: number
  timestamp: number
  resolved: boolean
}

/**
 * Performance profiling data
 */
export interface ProfilingData {
  functionName: string
  callCount: number
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
  lastCalled: number
  cpuUsage: number
  memoryAllocations: number
}

/**
 * Comprehensive performance state
 */
export interface PerformanceMonitorState {
  isMonitoring: boolean
  frameTimings: FrameTiming[]
  memoryMetrics: MemoryMetrics[]
  systemMetrics: SystemMetrics[]
  renderingMetrics: RenderingMetrics[]
  gameMetrics: GameMetrics[]
  alerts: PerformanceAlert[]
  profilingData: Map<string, ProfilingData>
  currentFrame: number
  lastSampleTime: number
  lastGCTime: number
  gcEvents: number[]
  optimizations: {
    autoGCEnabled: boolean
    memoryPoolingEnabled: boolean
    lodOptimizationEnabled: boolean
    cullingOptimizationEnabled: boolean
  }
}

// --- Memory Monitoring ---

/**
 * Get memory information
 */
const getMemoryInfo = (): MemoryMetrics => {
  const performance_any = performance as any
  const memory = performance_any.memory

  let jsHeapUsed = 0
  let jsHeapTotal = 0
  let jsHeapLimit = 0

  if (memory) {
    jsHeapUsed = memory.usedJSHeapSize || 0
    jsHeapTotal = memory.totalJSHeapSize || 0
    jsHeapLimit = memory.jsHeapSizeLimit || 0
  }

  // Estimate GPU memory (would need WebGPU or WebGL context for real data)
  const estimatedGpuMemory = 0
  const estimatedTextureMemory = 0
  const estimatedBufferMemory = 0
  const estimatedWasmMemory = 0

  const totalMemory = jsHeapUsed + estimatedGpuMemory + estimatedWasmMemory
  const memoryPressure = jsHeapLimit > 0 ? jsHeapUsed / jsHeapLimit : 0

  return {
    jsHeapUsed,
    jsHeapTotal,
    jsHeapLimit,
    wasmMemory: estimatedWasmMemory,
    gpuMemory: estimatedGpuMemory,
    textureMemory: estimatedTextureMemory,
    bufferMemory: estimatedBufferMemory,
    totalMemory,
    memoryPressure,
  }
}

/**
 * Get system performance info
 */
const getSystemInfo = (): SystemMetrics => {
  // These would require additional APIs or estimation
  return {
    cpuUsage: 0, // Would need Performance Observer or estimation
    gpuUsage: 0, // Would need WebGPU query
    networkLatency: 0, // Would need network ping
    diskIO: 0, // Not available in browser
    cacheHitRate: 0, // Application-specific
    threadsActive: 0, // Would need Worker monitoring
    workersActive: 0, // Application-specific
  }
}

/**
 * Get rendering metrics (placeholder)
 */
const getRenderingInfo = (): RenderingMetrics => {
  return {
    drawCalls: 0,
    triangles: 0,
    vertices: 0,
    instances: 0,
    textureBinds: 0,
    shaderSwitches: 0,
    culledObjects: 0,
    visibleObjects: 0,
    batchedDrawCalls: 0,
  }
}

/**
 * Get game-specific metrics (placeholder)
 */
const getGameInfo = (): GameMetrics => {
  return {
    entitiesTotal: 0,
    entitiesActive: 0,
    chunksLoaded: 0,
    chunksVisible: 0,
    chunksGenerated: 0,
    queriesPerSecond: 0,
    systemUpdatesPerSecond: 0,
    networkMessages: 0,
  }
}

// --- Performance Profiling ---

const profilingMap = new Map<string, { startTime: number; memoryStart: number }>()

/**
 * Start profiling a function
 */
const startProfiling = (functionName: string): void => {
  if (!CONFIG.PROFILING_ENABLED) return

  const startTime = performance.now()
  const memoryStart = (performance as any).memory?.usedJSHeapSize || 0

  profilingMap.set(functionName, { startTime, memoryStart })
}

/**
 * End profiling a function
 */
const endProfiling = (
  functionName: string,
  profilingData: Map<string, ProfilingData>
): void => {
  if (!CONFIG.PROFILING_ENABLED) return

  const endTime = performance.now()
  const memoryEnd = (performance as any).memory?.usedJSHeapSize || 0

  const startData = profilingMap.get(functionName)
  if (!startData) return

  const executionTime = endTime - startData.startTime
  const memoryDelta = memoryEnd - startData.memoryStart

  let profile = profilingData.get(functionName)
  if (!profile) {
    profile = {
      functionName,
      callCount: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      lastCalled: 0,
      cpuUsage: 0,
      memoryAllocations: 0,
    }
  }

  profile.callCount++
  profile.totalTime += executionTime
  profile.averageTime = profile.totalTime / profile.callCount
  profile.minTime = Math.min(profile.minTime, executionTime)
  profile.maxTime = Math.max(profile.maxTime, executionTime)
  profile.lastCalled = endTime
  profile.memoryAllocations += Math.max(0, memoryDelta)

  profilingData.set(functionName, profile)
  profilingMap.delete(functionName)
}

// --- Alert System ---

/**
 * Check for performance alerts
 */
const checkPerformanceAlerts = (
  frameTimings: FrameTiming[],
  memoryMetrics: MemoryMetrics[],
  systemMetrics: SystemMetrics[],
  existingAlerts: PerformanceAlert[]
): PerformanceAlert[] => {
  const newAlerts: PerformanceAlert[] = []
  const currentTime = Date.now()

  // Check FPS
  if (frameTimings.length > 0) {
    const currentFPS = frameTimings[frameTimings.length - 1].fps
    if (currentFPS < CONFIG.ALERT_THRESHOLDS.lowFPS) {
      newAlerts.push({
        id: `fps-low-${currentTime}`,
        type: currentFPS < 15 ? 'critical' : 'warning',
        category: 'fps',
        message: `Low FPS detected: ${currentFPS.toFixed(1)}`,
        value: currentFPS,
        threshold: CONFIG.ALERT_THRESHOLDS.lowFPS,
        timestamp: currentTime,
        resolved: false,
      })
    }
  }

  // Check Memory
  if (memoryMetrics.length > 0) {
    const currentMemory = memoryMetrics[memoryMetrics.length - 1]
    if (currentMemory.totalMemory > CONFIG.ALERT_THRESHOLDS.highMemory) {
      newAlerts.push({
        id: `memory-high-${currentTime}`,
        type: currentMemory.memoryPressure > 0.9 ? 'critical' : 'warning',
        category: 'memory',
        message: `High memory usage: ${(currentMemory.totalMemory / 1024 / 1024).toFixed(1)}MB`,
        value: currentMemory.totalMemory,
        threshold: CONFIG.ALERT_THRESHOLDS.highMemory,
        timestamp: currentTime,
        resolved: false,
      })
    }
  }

  // Check System
  if (systemMetrics.length > 0) {
    const currentSystem = systemMetrics[systemMetrics.length - 1]
    if (currentSystem.networkLatency > CONFIG.ALERT_THRESHOLDS.highLatency) {
      newAlerts.push({
        id: `latency-high-${currentTime}`,
        type: 'warning',
        category: 'network',
        message: `High network latency: ${currentSystem.networkLatency}ms`,
        value: currentSystem.networkLatency,
        threshold: CONFIG.ALERT_THRESHOLDS.highLatency,
        timestamp: currentTime,
        resolved: false,
      })
    }
  }

  return [...existingAlerts, ...newAlerts].slice(-100) // Keep last 100 alerts
}

// --- Optimization Strategies ---

/**
 * Auto-optimize based on performance metrics
 */
const autoOptimize = (state: PerformanceMonitorState): PerformanceMonitorState => {
  if (!CONFIG.AUTO_OPTIMIZATION) return state

  const newOptimizations = { ...state.optimizations }
  const currentMemory = state.memoryMetrics[state.memoryMetrics.length - 1]
  const currentFrame = state.frameTimings[state.frameTimings.length - 1]

  // Enable aggressive GC if memory pressure is high
  if (currentMemory && currentMemory.memoryPressure > 0.8) {
    newOptimizations.autoGCEnabled = true
  }

  // Enable LOD optimization if FPS is low
  if (currentFrame && currentFrame.fps < 45) {
    newOptimizations.lodOptimizationEnabled = true
    newOptimizations.cullingOptimizationEnabled = true
  }

  // Enable memory pooling if memory fragmentation is detected
  if (currentMemory && currentMemory.jsHeapTotal > currentMemory.jsHeapUsed * 1.5) {
    newOptimizations.memoryPoolingEnabled = true
  }

  return {
    ...state,
    optimizations: newOptimizations,
  }
}

// --- Service Interface ---

export interface PerformanceMonitorService {
  startMonitoring: () => Effect.Effect<void>
  stopMonitoring: () => Effect.Effect<void>
  recordFrameTiming: (timing: FrameTiming) => Effect.Effect<void>
  updateRenderingMetrics: (metrics: Partial<RenderingMetrics>) => Effect.Effect<void>
  updateGameMetrics: (metrics: Partial<GameMetrics>) => Effect.Effect<void>
  startProfiling: (functionName: string) => Effect.Effect<void>
  endProfiling: (functionName: string) => Effect.Effect<void>
  getMetrics: () => Effect.Effect<{
    current: {
      frame: FrameTiming | null
      memory: MemoryMetrics
      system: SystemMetrics
      rendering: RenderingMetrics
      game: GameMetrics
    }
    history: {
      frameTimings: FrameTiming[]
      memoryHistory: MemoryMetrics[]
      systemHistory: SystemMetrics[]
    }
    profiling: Map<string, ProfilingData>
    alerts: PerformanceAlert[]
  }>
  getOptimizationSuggestions: () => Effect.Effect<string[]>
  exportMetrics: () => Effect.Effect<string>
  clearHistory: () => Effect.Effect<void>
}

export const PerformanceMonitorService = Effect.Tag<PerformanceMonitorService>('PerformanceMonitorService')

// --- Service Implementation ---

export const PerformanceMonitorLive = Layer.effect(
  PerformanceMonitorService,
  Effect.gen(function* (_) {
    const initialState: PerformanceMonitorState = {
      isMonitoring: false,
      frameTimings: [],
      memoryMetrics: [],
      systemMetrics: [],
      renderingMetrics: [],
      gameMetrics: [],
      alerts: [],
      profilingData: new Map(),
      currentFrame: 0,
      lastSampleTime: 0,
      lastGCTime: 0,
      gcEvents: [],
      optimizations: {
        autoGCEnabled: false,
        memoryPoolingEnabled: true,
        lodOptimizationEnabled: false,
        cullingOptimizationEnabled: true,
      },
    }

    const stateRef = yield* _(Ref.make(initialState))

    // Background monitoring loop
    const monitoringLoop = Effect.gen(function* () {
      while (true) {
        const state = yield* _(Ref.get(stateRef))
        
        if (!state.isMonitoring) {
          yield* _(Effect.sleep(Duration.millis(100)))
          continue
        }

        const currentTime = performance.now()
        const timeSinceLastSample = currentTime - state.lastSampleTime

        if (timeSinceLastSample >= 1000 / CONFIG.SAMPLE_RATE) {
          // Collect metrics
          const memoryInfo = getMemoryInfo()
          const systemInfo = getSystemInfo()
          const renderingInfo = getRenderingInfo()
          const gameInfo = getGameInfo()

          // Check for GC events
          const newGCEvents = [...state.gcEvents]
          if (memoryInfo.jsHeapUsed < (state.memoryMetrics[state.memoryMetrics.length - 1]?.jsHeapUsed || 0)) {
            newGCEvents.push(currentTime)
          }

          // Keep only recent GC events (last second)
          const recentGCEvents = newGCEvents.filter(time => currentTime - time < 1000)

          // Update state
          yield* _(Ref.update(stateRef, s => {
            const newMemoryMetrics = [...s.memoryMetrics, memoryInfo].slice(-CONFIG.HISTORY_LENGTH)
            const newSystemMetrics = [...s.systemMetrics, systemInfo].slice(-CONFIG.HISTORY_LENGTH)
            const newRenderingMetrics = [...s.renderingMetrics, renderingInfo].slice(-CONFIG.HISTORY_LENGTH)
            const newGameMetrics = [...s.gameMetrics, gameInfo].slice(-CONFIG.HISTORY_LENGTH)

            // Check for alerts
            const newAlerts = checkPerformanceAlerts(
              s.frameTimings,
              newMemoryMetrics,
              newSystemMetrics,
              s.alerts
            )

            // Auto-optimize if needed
            const optimizedState = autoOptimize({
              ...s,
              memoryMetrics: newMemoryMetrics,
              systemMetrics: newSystemMetrics,
              renderingMetrics: newRenderingMetrics,
              gameMetrics: newGameMetrics,
              alerts: newAlerts,
              gcEvents: recentGCEvents,
              lastSampleTime: currentTime,
            })

            return optimizedState
          }))
        }

        yield* _(Effect.sleep(Duration.millis(16))) // ~60 FPS monitoring
      }
    }).pipe(Effect.fork)

    return PerformanceMonitorService.of({
      startMonitoring: () =>
        Effect.gen(function* () {
          yield* _(Ref.update(stateRef, s => ({ ...s, isMonitoring: true })))
          yield* _(monitoringLoop)
          console.log('Performance monitoring started')
        }),

      stopMonitoring: () =>
        Effect.gen(function* () {
          yield* _(Ref.update(stateRef, s => ({ ...s, isMonitoring: false })))
          console.log('Performance monitoring stopped')
        }),

      recordFrameTiming: (timing: FrameTiming) =>
        Effect.gen(function* () {
          yield* _(Ref.update(stateRef, s => ({
            ...s,
            frameTimings: [...s.frameTimings, timing].slice(-CONFIG.HISTORY_LENGTH),
            currentFrame: timing.frameNumber,
          })))
        }),

      updateRenderingMetrics: (metrics: Partial<RenderingMetrics>) =>
        Effect.gen(function* () {
          yield* _(Ref.update(stateRef, s => {
            const lastMetrics = s.renderingMetrics[s.renderingMetrics.length - 1] || getRenderingInfo()
            const updatedMetrics = { ...lastMetrics, ...metrics }
            
            const newRenderingMetrics = [...s.renderingMetrics]
            newRenderingMetrics[newRenderingMetrics.length - 1] = updatedMetrics
            
            return {
              ...s,
              renderingMetrics: newRenderingMetrics,
            }
          }))
        }),

      updateGameMetrics: (metrics: Partial<GameMetrics>) =>
        Effect.gen(function* () {
          yield* _(Ref.update(stateRef, s => {
            const lastMetrics = s.gameMetrics[s.gameMetrics.length - 1] || getGameInfo()
            const updatedMetrics = { ...lastMetrics, ...metrics }
            
            const newGameMetrics = [...s.gameMetrics]
            newGameMetrics[newGameMetrics.length - 1] = updatedMetrics
            
            return {
              ...s,
              gameMetrics: newGameMetrics,
            }
          }))
        }),

      startProfiling: (functionName: string) =>
        Effect.sync(() => startProfiling(functionName)),

      endProfiling: (functionName: string) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          endProfiling(functionName, state.profilingData)
        }),

      getMetrics: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          return {
            current: {
              frame: state.frameTimings[state.frameTimings.length - 1] || null,
              memory: state.memoryMetrics[state.memoryMetrics.length - 1] || getMemoryInfo(),
              system: state.systemMetrics[state.systemMetrics.length - 1] || getSystemInfo(),
              rendering: state.renderingMetrics[state.renderingMetrics.length - 1] || getRenderingInfo(),
              game: state.gameMetrics[state.gameMetrics.length - 1] || getGameInfo(),
            },
            history: {
              frameTimings: state.frameTimings,
              memoryHistory: state.memoryMetrics,
              systemHistory: state.systemMetrics,
            },
            profiling: state.profilingData,
            alerts: state.alerts,
          }
        }),

      getOptimizationSuggestions: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const suggestions: string[] = []

          const currentMemory = state.memoryMetrics[state.memoryMetrics.length - 1]
          const currentFrame = state.frameTimings[state.frameTimings.length - 1]

          if (currentFrame && currentFrame.fps < 30) {
            suggestions.push('Consider reducing render distance or enabling LOD')
            suggestions.push('Enable frustum culling and occlusion culling')
            suggestions.push('Reduce particle effects or post-processing quality')
          }

          if (currentMemory && currentMemory.memoryPressure > 0.8) {
            suggestions.push('Increase garbage collection frequency')
            suggestions.push('Reduce texture quality or enable compression')
            suggestions.push('Implement object pooling for frequently created objects')
          }

          if (state.alerts.filter(a => !a.resolved).length > 5) {
            suggestions.push('Multiple performance issues detected - consider reducing overall quality settings')
          }

          return suggestions
        }),

      exportMetrics: () =>
        Effect.gen(function* () {
          if (!CONFIG.METRICS_EXPORT) {
            return 'Metrics export is disabled'
          }

          const state = yield* _(Ref.get(stateRef))
          
          const exportData = {
            timestamp: Date.now(),
            frameTimings: state.frameTimings.slice(-60), // Last 60 frames
            memoryMetrics: state.memoryMetrics.slice(-60),
            systemMetrics: state.systemMetrics.slice(-60),
            renderingMetrics: state.renderingMetrics.slice(-60),
            gameMetrics: state.gameMetrics.slice(-60),
            alerts: state.alerts.filter(a => !a.resolved),
            profiling: Object.fromEntries(state.profilingData),
            optimizations: state.optimizations,
          }

          return JSON.stringify(exportData, null, 2)
        }),

      clearHistory: () =>
        Effect.gen(function* () {
          yield* _(Ref.update(stateRef, s => ({
            ...s,
            frameTimings: [],
            memoryMetrics: [],
            systemMetrics: [],
            renderingMetrics: [],
            gameMetrics: [],
            alerts: [],
            profilingData: new Map(),
            gcEvents: [],
          })))
        }),
    })
  }),
)

// Export types and configuration
export type { 
  PerformanceMonitorState, 
  FrameTiming, 
  MemoryMetrics, 
  SystemMetrics, 
  RenderingMetrics, 
  GameMetrics, 
  PerformanceAlert, 
  ProfilingData 
}
export { CONFIG as PerformanceMonitorConfig }