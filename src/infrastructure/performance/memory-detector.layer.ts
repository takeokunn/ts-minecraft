import { Effect, Ref, Schedule } from 'effect'
import { Metrics } from './metrics'

/**
 * Memory leak detection system with advanced monitoring capabilities
 * Tracks memory usage patterns and detects potential leaks
 */

export interface MemorySnapshot {
  readonly timestamp: number
  readonly usedJSHeapSize: number
  readonly totalJSHeapSize: number
  readonly jsHeapSizeLimit: number
  readonly percentage: number
}

export interface MemoryLeak {
  readonly id: string
  readonly detectedAt: number
  readonly type: MemoryLeakType
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly description: string
  readonly trend: ReadonlyArray<MemorySnapshot>
  readonly recommendations: ReadonlyArray<string>
}

export type MemoryLeakType = 
  | 'steady_growth'
  | 'memory_spike'
  | 'heap_fragmentation'
  | 'gc_pressure'
  | 'object_retention'

export interface MemoryDetectorConfig {
  readonly sampleInterval: number // milliseconds
  readonly retentionPeriod: number // milliseconds
  readonly growthThreshold: number // bytes per minute
  readonly spikeThreshold: number // percentage increase
  readonly maxMemoryPercentage: number // percentage of heap limit
  readonly enableAutoDetection: boolean
  readonly enableGCMonitoring: boolean
}

export interface ObjectTracker {
  readonly name: string
  readonly count: number
  readonly size: number
  readonly lastSeen: number
}

/**
 * Memory detector state
 */
interface MemoryDetectorState {
  readonly snapshots: ReadonlyArray<MemorySnapshot>
  readonly leaks: ReadonlyArray<MemoryLeak>
  readonly objectTrackers: Map<string, ObjectTracker>
  readonly gcEvents: ReadonlyArray<{ timestamp: number; duration: number; type: string }>
  readonly isMonitoring: boolean
}

let memoryDetectorState: Ref.Ref<MemoryDetectorState> | null = null
let memoryConfig: MemoryDetectorConfig = {
  sampleInterval: 5000, // 5 seconds
  retentionPeriod: 30 * 60 * 1000, // 30 minutes
  growthThreshold: 1024 * 1024, // 1MB per minute
  spikeThreshold: 25, // 25% increase
  maxMemoryPercentage: 80, // 80% of heap limit
  enableAutoDetection: true,
  enableGCMonitoring: true
}

/**
 * Initialize the memory detector
 */
export const initializeMemoryDetector = (config?: Partial<MemoryDetectorConfig>): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    memoryConfig = { ...memoryConfig, ...config }
    
    memoryDetectorState = yield* Ref.make<MemoryDetectorState>({
      snapshots: [],
      leaks: [],
      objectTrackers: new Map(),
      gcEvents: [],
      isMonitoring: false
    })
    
    if (memoryConfig.enableAutoDetection) {
      yield* startMemoryMonitoring()
    }
    
    if (memoryConfig.enableGCMonitoring) {
      yield* setupGCMonitoring()
    }
    
    yield* Effect.log('Memory leak detector initialized')
  })

/**
 * Get current memory snapshot
 */
const getMemorySnapshot = (): MemorySnapshot | null => {
  if (typeof performance === 'undefined' || !(performance as any).memory) {
    return null
  }
  
  const memory = (performance as any).memory
  const timestamp = Date.now()
  const usedJSHeapSize = memory.usedJSHeapSize
  const totalJSHeapSize = memory.totalJSHeapSize
  const jsHeapSizeLimit = memory.jsHeapSizeLimit
  const percentage = (usedJSHeapSize / jsHeapSizeLimit) * 100
  
  return {
    timestamp,
    usedJSHeapSize,
    totalJSHeapSize,
    jsHeapSizeLimit,
    percentage
  }
}

/**
 * Start memory monitoring
 */
const startMemoryMonitoring = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!memoryDetectorState) return
    
    yield* Ref.update(memoryDetectorState, state => ({
      ...state,
      isMonitoring: true
    }))
    
    const collectMemoryData = Effect.gen(function* () {
      const snapshot = getMemorySnapshot()
      if (!snapshot) return
      
      yield* Ref.update(memoryDetectorState!, state => {
        const snapshots = [...state.snapshots, snapshot]
        const cutoff = Date.now() - memoryConfig.retentionPeriod
        const filteredSnapshots = snapshots.filter(s => s.timestamp > cutoff)
        
        return {
          ...state,
          snapshots: filteredSnapshots
        }
      })
      
      // Record metrics
      yield* Metrics.recordGauge('memory.used', snapshot.usedJSHeapSize, 'bytes')
      yield* Metrics.recordGauge('memory.total', snapshot.totalJSHeapSize, 'bytes')
      yield* Metrics.recordGauge('memory.percentage', snapshot.percentage, 'percent')
      
      // Check for leaks
      if (memoryConfig.enableAutoDetection) {
        yield* detectMemoryLeaks()
      }
    })
    
    yield* collectMemoryData.pipe(
      Effect.repeat(
        Schedule.fixed(`${memoryConfig.sampleInterval} millis`)
      ),
      Effect.fork
    )
  })

/**
 * Setup GC monitoring
 */
const setupGCMonitoring = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    // Note: This is browser-specific and may not work in all environments
    if (typeof (window as any)?.PerformanceObserver === 'undefined') {
      yield* Effect.logInfo('GC monitoring not available in this environment')
      return
    }
    
    try {
      const observer = new (window as any).PerformanceObserver((list: any) => {
        const entries = list.getEntries()
        
        for (const entry of entries) {
          if (entry.entryType === 'measure' && entry.name.includes('gc')) {
            const gcEvent = {
              timestamp: Date.now(),
              duration: entry.duration,
              type: entry.name
            }
            
            Effect.runSync(
              Effect.gen(function* () {
                if (!memoryDetectorState) return
                
                yield* Ref.update(memoryDetectorState, state => {
                  const gcEvents = [...state.gcEvents, gcEvent]
                  const cutoff = Date.now() - memoryConfig.retentionPeriod
                  const filteredEvents = gcEvents.filter(e => e.timestamp > cutoff)
                  
                  return {
                    ...state,
                    gcEvents: filteredEvents
                  }
                })
                
                // Record GC metrics
                yield* Metrics.recordTimer('gc.duration', entry.duration, { type: entry.name })
                yield* Metrics.increment('gc.count', { type: entry.name })
              })
            )
          }
        }
      })
      
      observer.observe({ entryTypes: ['measure'] })
      yield* Effect.log('GC monitoring enabled')
    } catch (error) {
      yield* Effect.logWarning('Failed to setup GC monitoring:', error)
    }
  })

/**
 * Detect memory leaks based on patterns
 */
const detectMemoryLeaks = (): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    if (!memoryDetectorState) return
    
    const state = yield* Ref.get(memoryDetectorState)
    const snapshots = state.snapshots
    
    if (snapshots.length < 10) return // Need enough data points
    
    const newLeaks: MemoryLeak[] = []
    
    // Check for steady growth
    const steadyGrowthLeak = detectSteadyGrowth(snapshots)
    if (steadyGrowthLeak) {
      newLeaks.push(steadyGrowthLeak)
    }
    
    // Check for memory spikes
    const spikeLeak = detectMemorySpike(snapshots)
    if (spikeLeak) {
      newLeaks.push(spikeLeak)
    }
    
    // Check for high memory usage
    const highUsageLeak = detectHighMemoryUsage(snapshots)
    if (highUsageLeak) {
      newLeaks.push(highUsageLeak)
    }
    
    // Check GC pressure
    const gcPressureLeak = detectGCPressure(state.gcEvents)
    if (gcPressureLeak) {
      newLeaks.push(gcPressureLeak)
    }
    
    if (newLeaks.length > 0) {
      yield* Ref.update(memoryDetectorState, currentState => ({
        ...currentState,
        leaks: [...currentState.leaks, ...newLeaks]
      }))
      
      // Log warnings
      for (const leak of newLeaks) {
        yield* Effect.logWarning(`Memory leak detected: ${leak.type} (${leak.severity})`)
        yield* Metrics.increment('memory.leaks.detected', { type: leak.type, severity: leak.severity })
      }
    }
  })

/**
 * Detect steady memory growth
 */
const detectSteadyGrowth = (snapshots: ReadonlyArray<MemorySnapshot>): MemoryLeak | null => {
  if (snapshots.length < 5) return null
  
  const recent = snapshots.slice(-5)
  const oldest = recent[0]
  const newest = recent[recent.length - 1]
  
  if (!oldest || !newest) {
    return null // Not enough data to calculate growth rate
  }
  
  const timeDelta = newest.timestamp - oldest.timestamp
  const memoryDelta = newest.usedJSHeapSize - oldest.usedJSHeapSize
  
  // Calculate growth rate per minute
  const growthPerMinute = (memoryDelta / timeDelta) * 60000
  
  if (growthPerMinute > memoryConfig.growthThreshold) {
    const severity: MemoryLeak['severity'] = 
      growthPerMinute > memoryConfig.growthThreshold * 4 ? 'critical' :
      growthPerMinute > memoryConfig.growthThreshold * 2 ? 'high' : 'medium'
    
    return {
      id: `steady_growth_${Date.now()}`,
      detectedAt: Date.now(),
      type: 'steady_growth',
      severity,
      description: `Memory is steadily growing at ${(growthPerMinute / 1024 / 1024).toFixed(2)}MB per minute`,
      trend: recent,
      recommendations: [
        'Check for unclosed resources (event listeners, intervals, observers)',
        'Review object creation patterns in loops',
        'Ensure proper cleanup in component unmounting',
        'Consider using object pools for frequently created objects'
      ]
    }
  }
  
  return null
}

/**
 * Detect memory spikes
 */
const detectMemorySpike = (snapshots: ReadonlyArray<MemorySnapshot>): MemoryLeak | null => {
  if (snapshots.length < 3) return null
  
  const recent = snapshots.slice(-3)
  const prev = recent[recent.length - 2]
  const curr = recent[recent.length - 1]
  
  if (!prev || !curr) {
    return null
  }
  
  const percentageIncrease = ((curr.usedJSHeapSize - prev.usedJSHeapSize) / prev.usedJSHeapSize) * 100
  
  if (percentageIncrease > memoryConfig.spikeThreshold) {
    const severity: MemoryLeak['severity'] =
      percentageIncrease > 100 ? 'critical' :
      percentageIncrease > 50 ? 'high' : 'medium'
    
    return {
      id: `memory_spike_${Date.now()}`,
      detectedAt: Date.now(),
      type: 'memory_spike',
      severity,
      description: `Memory usage spiked by ${percentageIncrease.toFixed(1)}% (${((curr.usedJSHeapSize - prev.usedJSHeapSize) / 1024 / 1024).toFixed(2)}MB)`,
      trend: recent,
      recommendations: [
        'Check recent operations that might allocate large amounts of memory',
        'Review data loading and caching strategies',
        'Consider lazy loading for large datasets',
        'Investigate synchronous operations that block GC'
      ]
    }
  }
  
  return null
}

/**
 * Detect high memory usage
 */
const detectHighMemoryUsage = (snapshots: ReadonlyArray<MemorySnapshot>): MemoryLeak | null => {
  const latest = snapshots[snapshots.length - 1]
  
  if (!latest) {
    return null
  }
  
  if (latest.percentage > memoryConfig.maxMemoryPercentage) {
    const severity: MemoryLeak['severity'] =
      latest.percentage > 95 ? 'critical' :
      latest.percentage > 90 ? 'high' : 'medium'
    
    return {
      id: `high_usage_${Date.now()}`,
      detectedAt: Date.now(),
      type: 'object_retention',
      severity,
      description: `Memory usage is at ${latest.percentage.toFixed(1)}% of heap limit (${(latest.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB)`,
      trend: snapshots.slice(-5),
      recommendations: [
        'Force garbage collection if possible',
        'Clear caches and temporary data',
        'Review object retention patterns',
        'Consider memory-efficient data structures'
      ]
    }
  }
  
  return null
}

/**
 * Detect GC pressure
 */
const detectGCPressure = (gcEvents: ReadonlyArray<{ timestamp: number; duration: number; type: string }>): MemoryLeak | null => {
  const recentWindow = 60000 // 1 minute
  const now = Date.now()
  const recentEvents = gcEvents.filter(e => e.timestamp > now - recentWindow)
  
  if (recentEvents.length > 10) { // More than 10 GC events per minute
    const avgDuration = recentEvents.reduce((sum, e) => sum + e.duration, 0) / recentEvents.length
    
    const severity: MemoryLeak['severity'] =
      avgDuration > 50 ? 'critical' :
      avgDuration > 20 ? 'high' : 'medium'
    
    return {
      id: `gc_pressure_${Date.now()}`,
      detectedAt: Date.now(),
      type: 'gc_pressure',
      severity,
      description: `High GC pressure: ${recentEvents.length} GC events in the last minute (avg duration: ${avgDuration.toFixed(2)}ms)`,
      trend: [],
      recommendations: [
        'Reduce object allocation frequency',
        'Use object pooling for frequently created/destroyed objects',
        'Optimize data structures to reduce memory churn',
        'Consider using WeakMap/WeakSet for caches'
      ]
    }
  }
  
  return null
}

/**
 * Main MemoryDetector API
 */
export const MemoryDetector = {
  /**
   * Get current memory usage
   */
  getCurrentUsage: (): Effect.Effect<MemorySnapshot | null, never, never> =>
    Effect.succeed(getMemorySnapshot()),
  
  /**
   * Get memory usage history
   */
  getHistory: (windowMs?: number): Effect.Effect<ReadonlyArray<MemorySnapshot>, never, never> =>
    Effect.gen(function* () {
      if (!memoryDetectorState) return []
      
      const state = yield* Ref.get(memoryDetectorState)
      
      if (!windowMs) return state.snapshots
      
      const cutoff = Date.now() - windowMs
      return state.snapshots.filter(s => s.timestamp > cutoff)
    }),
  
  /**
   * Get detected memory leaks
   */
  getLeaks: (severity?: MemoryLeak['severity']): Effect.Effect<ReadonlyArray<MemoryLeak>, never, never> =>
    Effect.gen(function* () {
      if (!memoryDetectorState) return []
      
      const state = yield* Ref.get(memoryDetectorState)
      
      if (!severity) return state.leaks
      
      return state.leaks.filter(leak => leak.severity === severity)
    }),
  
  /**
   * Force a memory leak detection scan
   */
  forceScan: (): Effect.Effect<ReadonlyArray<MemoryLeak>, never, never> =>
    Effect.gen(function* () {
      yield* detectMemoryLeaks()
      return yield* MemoryDetector.getLeaks()
    }),
  
  /**
   * Clear leak history
   */
  clearLeaks: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!memoryDetectorState) return
      
      yield* Ref.update(memoryDetectorState, state => ({
        ...state,
        leaks: []
      }))
      
      yield* Effect.log('Memory leak history cleared')
    }),
  
  /**
   * Start monitoring
   */
  startMonitoring: (): Effect.Effect<void, never, never> =>
    startMemoryMonitoring(),
  
  /**
   * Stop monitoring
   */
  stopMonitoring: (): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!memoryDetectorState) return
      
      yield* Ref.update(memoryDetectorState, state => ({
        ...state,
        isMonitoring: false
      }))
      
      yield* Effect.log('Memory monitoring stopped')
    }),
  
  /**
   * Get monitoring status
   */
  isMonitoring: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      if (!memoryDetectorState) return false
      
      const state = yield* Ref.get(memoryDetectorState)
      return state.isMonitoring
    }),
  
  /**
   * Generate memory report
   */
  generateReport: (): Effect.Effect<string, never, never> =>
    Effect.gen(function* () {
      const current = yield* MemoryDetector.getCurrentUsage()
      const history = yield* MemoryDetector.getHistory(5 * 60 * 1000) // Last 5 minutes
      const leaks = yield* MemoryDetector.getLeaks()
      
      let report = '🧠 Memory Analysis Report\n'
      report += '═'.repeat(50) + '\n\n'
      
      // Current status
      if (current) {
        report += '📊 Current Memory Usage\n'
        report += '─'.repeat(25) + '\n'
        report += `Used: ${(current.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB\n`
        report += `Total: ${(current.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB\n`
        report += `Limit: ${(current.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB\n`
        report += `Usage: ${current.percentage.toFixed(1)}%\n\n`
      }
      
      // Trend analysis
      if (history.length > 1) {
        const oldest = history[0]
        const newest = history[history.length - 1]
        
        if (!oldest || !newest) {
          return report
        }
        
        const timeDelta = newest.timestamp - oldest.timestamp
        const memoryDelta = newest.usedJSHeapSize - oldest.usedJSHeapSize
        const growthRate = (memoryDelta / timeDelta) * 60000 // per minute
        
        report += '📈 Memory Trend (5min)\n'
        report += '─'.repeat(25) + '\n'
        report += `Growth Rate: ${(growthRate / 1024 / 1024).toFixed(3)}MB/min\n`
        report += `Total Change: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB\n\n`
      }
      
      // Leak detection results
      if (leaks.length > 0) {
        report += '🚨 Detected Issues\n'
        report += '─'.repeat(20) + '\n'
        
        for (const leak of leaks) {
          report += `${leak.severity.toUpperCase()}: ${leak.description}\n`
          
          if (leak.recommendations.length > 0) {
            report += '   Recommendations:\n'
            for (const rec of leak.recommendations) {
              report += `   • ${rec}\n`
            }
          }
          
          report += '\n'
        }
      } else {
        report += '✅ No memory leaks detected\n\n'
      }
      
      return report
    }),
  
  /**
   * Track custom objects
   */
  trackObjects: (name: string, count: number, estimatedSize: number = 0): Effect.Effect<void, never, never> =>
    Effect.gen(function* () {
      if (!memoryDetectorState) return
      
      yield* Ref.update(memoryDetectorState, state => {
        const trackers = new Map(state.objectTrackers)
        trackers.set(name, {
          name,
          count,
          size: estimatedSize,
          lastSeen: Date.now()
        })
        
        return {
          ...state,
          objectTrackers: trackers
        }
      })
      
      yield* Metrics.recordGauge(`objects.${name}.count`, count, 'count')
      if (estimatedSize > 0) {
        yield* Metrics.recordGauge(`objects.${name}.size`, estimatedSize, 'bytes')
      }
    }),
  
  /**
   * Get object tracking data
   */
  getObjectTrackers: (): Effect.Effect<ReadonlyArray<ObjectTracker>, never, never> =>
    Effect.gen(function* () {
      if (!memoryDetectorState) return []
      
      const state = yield* Ref.get(memoryDetectorState)
      return Array.from(state.objectTrackers.values())
    })
}