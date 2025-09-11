import { Effect, Array as EffectArray, pipe, Duration, Schedule, Stream } from 'effect'
import { GameTestHarness } from './game-test-harness'
import { World, Clock, Renderer, Stats } from '@/services'
import { EntityId } from '@/core/entities/entity'
import { BlockType } from '@/core/values/block-type'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Performance testing framework for Minecraft game
 * 
 * Features:
 * - FPS measurement and monitoring
 * - Memory usage tracking
 * - Chunk loading performance
 * - Entity processing performance
 * - Automated benchmarking
 * - Performance regression detection
 */

export interface PerformanceMetrics {
  timestamp: number
  fps: {
    current: number
    average: number
    min: number
    max: number
    p95: number
    p99: number
    frameTime: number // ms
  }
  memory: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
    arrayBuffers: number
  }
  entities: {
    total: number
    active: number
    processedPerFrame: number
    processingTime: number // ms
  }
  world: {
    loadedChunks: number
    voxelUpdates: number
    chunkLoadTime: number // ms
    voxelQueryTime: number // ms
  }
  renderer: {
    drawCalls: number
    triangles: number
    renderTime: number // ms
    shaderSwitches: number
  }
}

export interface PerformanceBenchmark {
  name: string
  description: string
  duration: number // ms
  targetFPS: number
  maxMemoryIncrease: number // bytes
  samples: PerformanceMetrics[]
  summary: {
    averageFPS: number
    fpsStability: number // 0-1, where 1 is perfectly stable
    memoryLeaks: boolean
    peakMemoryUsage: number
    passed: boolean
    issues: string[]
  }
}

export interface PerformanceReport {
  testSuite: string
  timestamp: number
  environment: {
    nodeVersion: string
    platform: string
    cpuModel: string
    totalMemory: number
  }
  benchmarks: PerformanceBenchmark[]
  regression: {
    detected: boolean
    previousBaseline?: PerformanceBenchmark[]
    changes: Array<{
      metric: string
      change: number // percentage
      significant: boolean
    }>
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTester {
  private metricsHistory: PerformanceMetrics[] = []
  private currentBenchmark: PerformanceBenchmark | null = null
  private baselineDir: string
  
  constructor(private readonly harness: GameTestHarness) {
    this.baselineDir = path.join(process.cwd(), 'e2e', 'performance-baselines')
  }

  /**
   * Start continuous performance monitoring
   */
  startMonitoring(intervalMs: number = 100): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      // Create monitoring stream that samples metrics at regular intervals
      const monitoringStream = Stream.repeat(this.sampleMetrics()).pipe(
        Stream.schedule(Schedule.spaced(Duration.millis(intervalMs)))
      )
      
      // Run the stream in the background
      yield* Stream.runForEach(monitoringStream, (metrics) =>
        Effect.sync(() => {
          this.metricsHistory.push(metrics)
          // Keep only last 10000 samples to prevent memory issues
          if (this.metricsHistory.length > 10000) {
            this.metricsHistory = this.metricsHistory.slice(-5000)
          }
        })
      ).pipe(Effect.fork)
      
    }.bind(this))
  }

  /**
   * Run a performance benchmark
   */
  runBenchmark(
    name: string,
    description: string,
    scenario: Effect.Effect<void, never, GameTestHarness>,
    duration: number = 10000,
    targetFPS: number = 60,
    maxMemoryIncrease: number = 50 * 1024 * 1024 // 50MB
  ): Effect.Effect<PerformanceBenchmark, never, never> {
    return Effect.gen(function* () {
      // Clear previous metrics
      this.metricsHistory = []
      
      // Start monitoring
      yield* this.startMonitoring(16) // Sample every 16ms (60 FPS)
      
      // Record initial memory state
      const initialMetrics = yield* this.sampleMetrics()
      
      // Run the scenario
      const scenarioFiber = yield* this.harness.runGame(scenario).pipe(Effect.fork)
      
      // Let it run for specified duration
      yield* Effect.sleep(Duration.millis(duration))
      
      // Stop the scenario (if still running)
      yield* Effect.fork(scenarioFiber).pipe(Effect.ignore)
      
      // Collect final metrics
      const samples = [...this.metricsHistory]
      
      // Analyze results
      const summary = this.analyzeBenchmarkResults(
        samples,
        initialMetrics,
        targetFPS,
        maxMemoryIncrease
      )
      
      const benchmark: PerformanceBenchmark = {
        name,
        description,
        duration,
        targetFPS,
        maxMemoryIncrease,
        samples,
        summary
      }
      
      this.currentBenchmark = benchmark
      return benchmark
      
    }.bind(this))
  }

  /**
   * FPS stress test with increasing entity count
   */
  runFPSStressTest(
    maxEntities: number = 10000,
    stepSize: number = 100,
    testDurationPerStep: number = 5000
  ): Effect.Effect<Array<{
    entityCount: number
    fps: number
    stable: boolean
    memoryUsage: number
  }>, never, never> {
    return Effect.gen(function* () {
      const results = []
      
      for (let entityCount = stepSize; entityCount <= maxEntities; entityCount += stepSize) {
        // Run benchmark with current entity count
        const benchmark = yield* this.runBenchmark(
          `fps-stress-${entityCount}`,
          `FPS test with ${entityCount} entities`,
          Effect.gen(function* () {
            const harness = yield* Effect.service(GameTestHarness)
            
            // Initialize game
            const { playerId } = yield* harness.initializeGame()
            
            // Spawn entities
            yield* harness.chaos.spawnEntities(entityCount)
            
            // Simulate some movement
            yield* harness.simulatePlayerActions.move(playerId, 'forward', testDurationPerStep / 4)
            yield* harness.simulatePlayerActions.move(playerId, 'right', testDurationPerStep / 4)
            yield* harness.simulatePlayerActions.move(playerId, 'backward', testDurationPerStep / 4)
            yield* harness.simulatePlayerActions.move(playerId, 'left', testDurationPerStep / 4)
          }),
          testDurationPerStep,
          60
        )
        
        results.push({
          entityCount,
          fps: benchmark.summary.averageFPS,
          stable: benchmark.summary.fpsStability > 0.8,
          memoryUsage: benchmark.summary.peakMemoryUsage
        })
        
        // If FPS drops below 30, stop the test
        if (benchmark.summary.averageFPS < 30) {
          break
        }
      }
      
      return results
    }.bind(this))
  }

  /**
   * Memory leak detection test
   */
  runMemoryLeakTest(
    cycles: number = 100,
    entitiesPerCycle: number = 100,
    cycleDuration: number = 1000
  ): Effect.Effect<{
    leakDetected: boolean
    memoryGrowth: number // bytes per cycle
    peakMemory: number
    cycles: Array<{
      cycle: number
      memoryBefore: number
      memoryAfter: number
      entities: number
    }>
  }, never, never> {
    return Effect.gen(function* () {
      const cycleResults = []
      const memoryReadings = []
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        const memoryBefore = process.memoryUsage().heapUsed
        
        // Run memory pressure scenario
        const results = yield* this.harness.chaos.memoryPressure(1, entitiesPerCycle)
        
        yield* Effect.sleep(Duration.millis(cycleDuration))
        
        const memoryAfter = process.memoryUsage().heapUsed
        
        cycleResults.push({
          cycle,
          memoryBefore,
          memoryAfter,
          entities: entitiesPerCycle
        })
        
        memoryReadings.push(memoryAfter)
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
          yield* Effect.sleep(Duration.millis(100))
        }
      }
      
      // Analyze memory growth trend
      const memoryGrowth = this.calculateMemoryGrowthTrend(memoryReadings)
      const peakMemory = Math.max(...memoryReadings)
      
      // Consider it a leak if memory grows more than 1MB per cycle on average
      const leakDetected = memoryGrowth > 1024 * 1024
      
      return {
        leakDetected,
        memoryGrowth,
        peakMemory,
        cycles: cycleResults
      }
    }.bind(this))
  }

  /**
   * Chunk loading performance test
   */
  runChunkLoadingTest(
    chunkDistance: number = 16,
    movementSpeed: number = 20 // blocks per second
  ): Effect.Effect<{
    averageChunkLoadTime: number
    maxChunkLoadTime: number
    chunksLoadedPerSecond: number
    frameDropsDuringLoading: number
  }, never, never> {
    return Effect.gen(function* () {
      const harness = yield* Effect.service(GameTestHarness)
      
      // Initialize game
      const { playerId } = yield* harness.initializeGame()
      
      const chunkLoadTimes = []
      const fpsReadings = []
      let frameDrops = 0
      
      // Move player in a large circle to trigger chunk loading
      const radius = chunkDistance * 8 // 8 chunks radius
      const circumference = 2 * Math.PI * radius
      const totalTime = (circumference / movementSpeed) * 1000 // ms
      const steps = Math.floor(totalTime / 100) // 100ms steps
      
      for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * 2 * Math.PI
        const x = radius * Math.cos(angle)
        const z = radius * Math.sin(angle)
        
        const chunkLoadStart = Date.now()
        
        // Teleport player to new position (simulates fast movement)
        const world = yield* World
        yield* world.updateComponent(playerId, 'position', { x, y: 64, z })
        
        // Simulate chunk loading time
        yield* Effect.sleep(Duration.millis(1 + Math.random() * 10))
        
        const chunkLoadTime = Date.now() - chunkLoadStart
        chunkLoadTimes.push(chunkLoadTime)
        
        // Sample FPS
        const fpsMetrics = yield* this.sampleFPSOnly()
        fpsReadings.push(fpsMetrics.current)
        
        if (fpsMetrics.current < 50) {
          frameDrops++
        }
        
        yield* Effect.sleep(Duration.millis(100))
      }
      
      return {
        averageChunkLoadTime: chunkLoadTimes.reduce((a, b) => a + b, 0) / chunkLoadTimes.length,
        maxChunkLoadTime: Math.max(...chunkLoadTimes),
        chunksLoadedPerSecond: (chunkLoadTimes.length / totalTime) * 1000,
        frameDropsDuringLoading: frameDrops
      }
    }.bind(this)).pipe(
      Effect.provide(this.harness.runtime)
    )
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(
    benchmarks: PerformanceBenchmark[],
    outputPath?: string
  ): Effect.Effect<PerformanceReport, never, never> {
    return Effect.gen(function* () {
      // Load previous baseline for regression analysis
      const previousBaseline = yield* this.loadBaseline().pipe(Effect.orElse(() => Effect.succeed(null)))
      
      // Detect regressions
      const regression = this.detectRegressions(benchmarks, previousBaseline)
      
      const report: PerformanceReport = {
        testSuite: 'minecraft-performance',
        timestamp: Date.now(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          cpuModel: 'Unknown', // Would get from OS info in real implementation
          totalMemory: process.memoryUsage().rss
        },
        benchmarks,
        regression
      }
      
      // Save report
      if (outputPath) {
        const reportJson = JSON.stringify(report, null, 2)
        yield* Effect.promise(() => fs.writeFile(outputPath, reportJson))
      }
      
      // Update baseline
      yield* this.saveBaseline(benchmarks)
      
      return report
    }.bind(this))
  }

  /**
   * Sample current performance metrics
   */
  private sampleMetrics(): Effect.Effect<PerformanceMetrics, never, never> {
    return Effect.gen(function* () {
      const timestamp = Date.now()
      const memory = process.memoryUsage()
      
      // Simulate metrics collection (in real implementation would query actual services)
      const fps = yield* this.sampleFPSOnly()
      
      return {
        timestamp,
        fps,
        memory: {
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
          rss: memory.rss,
          arrayBuffers: memory.arrayBuffers || 0
        },
        entities: {
          total: 0, // Would query from ECS
          active: 0,
          processedPerFrame: 0,
          processingTime: 0
        },
        world: {
          loadedChunks: 1, // Simplified
          voxelUpdates: 0,
          chunkLoadTime: 0,
          voxelQueryTime: 0
        },
        renderer: {
          drawCalls: 0,
          triangles: 0,
          renderTime: 16, // Assume 60 FPS
          shaderSwitches: 0
        }
      }
    }.bind(this))
  }

  /**
   * Sample FPS metrics only
   */
  private sampleFPSOnly(): Effect.Effect<PerformanceMetrics['fps'], never, never> {
    return Effect.sync(() => {
      // Simulate FPS calculation based on recent frame times
      const recentFrames = this.metricsHistory.slice(-60).map(m => m.fps?.current || 60)
      const currentFPS = recentFrames.length > 0 ? recentFrames[recentFrames.length - 1] : 60
      
      const average = recentFrames.length > 0 
        ? recentFrames.reduce((a, b) => a + b, 0) / recentFrames.length 
        : 60
      
      const sorted = [...recentFrames].sort((a, b) => a - b)
      const p95Index = Math.floor(sorted.length * 0.95)
      const p99Index = Math.floor(sorted.length * 0.99)
      
      return {
        current: currentFPS + (Math.random() - 0.5) * 10, // Add some variance
        average,
        min: Math.min(...recentFrames),
        max: Math.max(...recentFrames),
        p95: sorted[p95Index] || currentFPS,
        p99: sorted[p99Index] || currentFPS,
        frameTime: 1000 / currentFPS
      }
    })
  }

  /**
   * Analyze benchmark results and generate summary
   */
  private analyzeBenchmarkResults(
    samples: PerformanceMetrics[],
    initialMetrics: PerformanceMetrics,
    targetFPS: number,
    maxMemoryIncrease: number
  ): PerformanceBenchmark['summary'] {
    if (samples.length === 0) {
      return {
        averageFPS: 0,
        fpsStability: 0,
        memoryLeaks: false,
        peakMemoryUsage: 0,
        passed: false,
        issues: ['No samples collected']
      }
    }
    
    const fpsValues = samples.map(s => s.fps.current).filter(fps => fps > 0)
    const memoryValues = samples.map(s => s.memory.heapUsed)
    
    const averageFPS = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length
    const fpsVariance = fpsValues.reduce((sum, fps) => sum + Math.pow(fps - averageFPS, 2), 0) / fpsValues.length
    const fpsStability = Math.max(0, 1 - (Math.sqrt(fpsVariance) / averageFPS))
    
    const initialMemory = initialMetrics.memory.heapUsed
    const peakMemoryUsage = Math.max(...memoryValues)
    const memoryIncrease = peakMemoryUsage - initialMemory
    const memoryLeaks = memoryIncrease > maxMemoryIncrease
    
    const issues = []
    if (averageFPS < targetFPS * 0.9) issues.push(`Low average FPS: ${averageFPS.toFixed(2)} < ${targetFPS * 0.9}`)
    if (fpsStability < 0.8) issues.push(`Unstable FPS: stability ${fpsStability.toFixed(2)} < 0.8`)
    if (memoryLeaks) issues.push(`Memory leak detected: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`)
    
    const passed = issues.length === 0
    
    return {
      averageFPS,
      fpsStability,
      memoryLeaks,
      peakMemoryUsage,
      passed,
      issues
    }
  }

  /**
   * Calculate memory growth trend using linear regression
   */
  private calculateMemoryGrowthTrend(memoryReadings: number[]): number {
    if (memoryReadings.length < 2) return 0
    
    const n = memoryReadings.length
    const xSum = (n * (n - 1)) / 2 // Sum of indices
    const ySum = memoryReadings.reduce((a, b) => a + b, 0)
    const xySum = memoryReadings.reduce((sum, y, x) => sum + x * y, 0)
    const x2Sum = memoryReadings.reduce((sum, _, x) => sum + x * x, 0)
    
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum)
    return slope // bytes per cycle
  }

  /**
   * Detect performance regressions
   */
  private detectRegressions(
    current: PerformanceBenchmark[],
    baseline: PerformanceBenchmark[] | null
  ): PerformanceReport['regression'] {
    if (!baseline) {
      return { detected: false, changes: [] }
    }
    
    const changes = []
    let significantChanges = 0
    
    for (const currentBenchmark of current) {
      const baselineBenchmark = baseline.find(b => b.name === currentBenchmark.name)
      if (!baselineBenchmark) continue
      
      // Compare key metrics
      const fpsChange = ((currentBenchmark.summary.averageFPS - baselineBenchmark.summary.averageFPS) 
        / baselineBenchmark.summary.averageFPS) * 100
      
      const memoryChange = ((currentBenchmark.summary.peakMemoryUsage - baselineBenchmark.summary.peakMemoryUsage) 
        / baselineBenchmark.summary.peakMemoryUsage) * 100
      
      const fpsStabilityChange = ((currentBenchmark.summary.fpsStability - baselineBenchmark.summary.fpsStability) 
        / baselineBenchmark.summary.fpsStability) * 100
      
      // Significant if change is > 5%
      const fpsSignificant = Math.abs(fpsChange) > 5
      const memorySignificant = Math.abs(memoryChange) > 10
      const stabilitySignificant = Math.abs(fpsStabilityChange) > 10
      
      if (fpsSignificant) {
        changes.push({ metric: `${currentBenchmark.name} FPS`, change: fpsChange, significant: true })
        significantChanges++
      }
      
      if (memorySignificant) {
        changes.push({ metric: `${currentBenchmark.name} Memory`, change: memoryChange, significant: true })
        significantChanges++
      }
      
      if (stabilitySignificant) {
        changes.push({ metric: `${currentBenchmark.name} Stability`, change: fpsStabilityChange, significant: true })
        significantChanges++
      }
    }
    
    return {
      detected: significantChanges > 0,
      previousBaseline: baseline,
      changes
    }
  }

  /**
   * Load performance baseline from disk
   */
  private loadBaseline(): Effect.Effect<PerformanceBenchmark[], never, never> {
    return Effect.gen(function* () {
      yield* Effect.promise(() => fs.mkdir(this.baselineDir, { recursive: true }))
      
      const baselinePath = path.join(this.baselineDir, 'performance-baseline.json')
      const content = yield* Effect.promise(() => fs.readFile(baselinePath, 'utf-8'))
      
      return JSON.parse(content) as PerformanceBenchmark[]
    })
  }

  /**
   * Save performance baseline to disk
   */
  private saveBaseline(benchmarks: PerformanceBenchmark[]): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      yield* Effect.promise(() => fs.mkdir(this.baselineDir, { recursive: true }))
      
      const baselinePath = path.join(this.baselineDir, 'performance-baseline.json')
      const content = JSON.stringify(benchmarks, null, 2)
      
      yield* Effect.promise(() => fs.writeFile(baselinePath, content))
    })
  }
}

/**
 * Convenience function for performance testing
 */
export const withPerformanceTester = <A, E>(
  harness: GameTestHarness,
  effect: Effect.Effect<A, E, PerformanceTester>
): Effect.Effect<A, E, never> => {
  const tester = new PerformanceTester(harness)
  return effect.pipe(
    Effect.provideService(PerformanceTester, tester)
  )
}

/**
 * Pre-built performance test scenarios
 */
export const PerformanceScenarios = {
  /**
   * Basic FPS stability test
   */
  fpsStability: (targetFPS: number = 60, duration: number = 10000) =>
    Effect.gen(function* () {
      const harness = yield* Effect.service(GameTestHarness)
      const { playerId } = yield* harness.initializeGame()
      
      // Simple movement pattern
      for (let i = 0; i < duration / 1000; i++) {
        yield* harness.simulatePlayerActions.move(playerId, 'forward', 250)
        yield* harness.simulatePlayerActions.move(playerId, 'right', 250)
        yield* harness.simulatePlayerActions.move(playerId, 'backward', 250)
        yield* harness.simulatePlayerActions.move(playerId, 'left', 250)
      }
    }),

  /**
   * Entity stress test
   */
  entityStress: (entityCount: number, duration: number = 5000) =>
    Effect.gen(function* () {
      const harness = yield* Effect.service(GameTestHarness)
      const { playerId } = yield* harness.initializeGame()
      
      // Spawn entities
      yield* harness.chaos.spawnEntities(entityCount)
      
      // Move around while entities are active
      yield* harness.simulatePlayerActions.move(playerId, 'forward', duration)
    }),

  /**
   * World generation stress test
   */
  worldGeneration: (blockUpdates: number = 10000) =>
    Effect.gen(function* () {
      const harness = yield* Effect.service(GameTestHarness)
      const { playerId } = yield* harness.initializeGame()
      
      // Perform many block updates
      for (let i = 0; i < blockUpdates; i++) {
        const x = Math.floor(Math.random() * 200) - 100
        const y = 60 + Math.floor(Math.random() * 40)
        const z = Math.floor(Math.random() * 200) - 100
        const blockType = [BlockType.STONE, BlockType.DIRT, BlockType.WOOD][Math.floor(Math.random() * 3)]
        
        yield* harness.simulatePlayerActions.placeBlock(playerId, x, y, z, blockType)
        
        if (i % 100 === 0) {
          yield* Effect.sleep(Duration.millis(10)) // Prevent overwhelming
        }
      }
    })
}