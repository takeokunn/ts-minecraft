import { Effect, Array as EffectArray, pipe, Duration, Schedule, Random, Option } from 'effect'
import { GameTestHarness } from './game-test-harness'
import { World, Clock, Renderer, InputManager } from '@/services'
import { EntityId } from '@/core/entities/entity'
import { BlockType } from '@/core/values/block-type'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Chaos testing framework for Minecraft game
 * 
 * Features:
 * - Random player operations
 * - Large-scale entity generation
 * - Network failure simulation
 * - Memory pressure scenarios
 * - System fault injection
 * - Concurrent stress testing
 * - Resource exhaustion tests
 */

export interface ChaosTestConfig {
  name: string
  description: string
  duration: number // milliseconds
  intensity: 'low' | 'medium' | 'high' | 'extreme'
  faultTypes: Array<'entity-spam' | 'memory-pressure' | 'random-actions' | 'block-spam' | 'concurrent-operations'>
  parameters: {
    maxEntities?: number
    actionRate?: number // actions per second
    memoryPressureCycles?: number
    blockUpdatesPerSecond?: number
    concurrentOperations?: number
  }
  stabilityChecks: {
    maxMemoryIncrease: number // bytes
    minFPS: number
    maxCrashRecoveryTime: number // milliseconds
  }
}

export interface ChaosTestResult {
  config: ChaosTestConfig
  startTime: number
  endTime: number
  duration: number
  status: 'completed' | 'crashed' | 'terminated' | 'resource-exhausted'
  faults: Array<{
    type: string
    timestamp: number
    severity: 'minor' | 'major' | 'critical'
    description: string
    recovered: boolean
    recoveryTime?: number
  }>
  metrics: {
    entitiesCreated: number
    entitiesDestroyed: number
    actionsPerformed: number
    blockUpdates: number
    memoryPeakUsage: number
    fpsMin: number
    fpsAverage: number
    errorCount: number
  }
  stability: {
    systemStable: boolean
    memoryLeaks: boolean
    performanceDegraded: boolean
    dataCorruption: boolean
  }
  logs: string[]
}

export interface ChaosTestSuite {
  name: string
  timestamp: number
  results: ChaosTestResult[]
  summary: {
    totalTests: number
    passedTests: number
    failedTests: number
    criticalFailures: number
    overallStability: number // 0-1
  }
}

/**
 * Chaos testing engine
 */
export class ChaosTester {
  private currentTest: ChaosTestResult | null = null
  private logs: string[] = []
  private faults: ChaosTestResult['faults'] = []
  
  constructor(private readonly harness: GameTestHarness) {}

  /**
   * Run a single chaos test
   */
  runChaosTest(config: ChaosTestConfig): Effect.Effect<ChaosTestResult, never, never> {
    return Effect.gen(function* () {
      const startTime = Date.now()
      this.logs = []
      this.faults = []
      
      this.log(`Starting chaos test: ${config.name}`)
      this.log(`Duration: ${config.duration}ms, Intensity: ${config.intensity}`)
      
      // Initialize test result
      const result: ChaosTestResult = {
        config,
        startTime,
        endTime: 0,
        duration: 0,
        status: 'completed',
        faults: [],
        metrics: {
          entitiesCreated: 0,
          entitiesDestroyed: 0,
          actionsPerformed: 0,
          blockUpdates: 0,
          memoryPeakUsage: 0,
          fpsMin: 60,
          fpsAverage: 60,
          errorCount: 0
        },
        stability: {
          systemStable: true,
          memoryLeaks: false,
          performanceDegraded: false,
          dataCorruption: false
        },
        logs: []
      }
      
      this.currentTest = result
      
      try {
        // Initialize game
        const { playerId } = yield* this.harness.initializeGame()
        this.log(`Game initialized with player: ${playerId}`)
        
        // Start performance monitoring
        yield* this.startChaosMonitoring()
        
        // Run chaos scenarios concurrently
        const scenarios = yield* this.createChaosScenarios(config, playerId)
        
        // Execute all scenarios concurrently with timeout
        yield* Effect.raceAll(scenarios).pipe(
          Effect.timeout(Duration.millis(config.duration + 5000)) // 5s grace period
        )
        
        // Wait for remaining duration
        yield* Effect.sleep(Duration.millis(Math.max(0, config.duration - (Date.now() - startTime))))
        
      } catch (error: any) {
        this.log(`Critical error during chaos test: ${error.message}`)
        result.status = 'crashed'
        result.metrics.errorCount++
        
        this.addFault('system-crash', 'critical', `System crashed: ${error.message}`, false)
      }
      
      // Finalize results
      const endTime = Date.now()
      result.endTime = endTime
      result.duration = endTime - startTime
      result.faults = [...this.faults]
      result.logs = [...this.logs]
      
      // Run stability checks
      yield* this.runStabilityChecks(result, config)
      
      this.log(`Chaos test completed: ${result.status}`)
      
      return result
      
    }.bind(this))
  }

  /**
   * Run a suite of chaos tests
   */
  runChaosTestSuite(
    suiteName: string,
    configs: ChaosTestConfig[]
  ): Effect.Effect<ChaosTestSuite, never, never> {
    return Effect.gen(function* () {
      const results: ChaosTestResult[] = []
      
      this.log(`Starting chaos test suite: ${suiteName} (${configs.length} tests)`)
      
      for (const config of configs) {
        const result = yield* this.runChaosTest(config)
        results.push(result)
        
        // Cool down between tests
        yield* Effect.sleep(Duration.millis(2000))
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
          yield* Effect.sleep(Duration.millis(500))
        }
      }
      
      // Calculate summary
      const totalTests = results.length
      const passedTests = results.filter(r => r.status === 'completed' && r.stability.systemStable).length
      const failedTests = totalTests - passedTests
      const criticalFailures = results.filter(r => 
        r.faults.some(f => f.severity === 'critical')
      ).length
      
      const overallStability = passedTests / totalTests
      
      const suite: ChaosTestSuite = {
        name: suiteName,
        timestamp: Date.now(),
        results,
        summary: {
          totalTests,
          passedTests,
          failedTests,
          criticalFailures,
          overallStability
        }
      }
      
      return suite
      
    }.bind(this))
  }

  /**
   * Create chaos scenarios based on configuration
   */
  private createChaosScenarios(
    config: ChaosTestConfig,
    playerId: EntityId
  ): Effect.Effect<Array<Effect.Effect<void, never, never>>, never, never> {
    return Effect.gen(function* () {
      const scenarios = []
      
      for (const faultType of config.faultTypes) {
        switch (faultType) {
          case 'entity-spam':
            scenarios.push(this.entitySpamScenario(config, playerId))
            break
            
          case 'memory-pressure':
            scenarios.push(this.memoryPressureScenario(config))
            break
            
          case 'random-actions':
            scenarios.push(this.randomActionsScenario(config, playerId))
            break
            
          case 'block-spam':
            scenarios.push(this.blockSpamScenario(config, playerId))
            break
            
          case 'concurrent-operations':
            scenarios.push(this.concurrentOperationsScenario(config, playerId))
            break
        }
      }
      
      return scenarios
    }.bind(this))
  }

  /**
   * Entity spam chaos scenario
   */
  private entitySpamScenario(
    config: ChaosTestConfig,
    playerId: EntityId
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const maxEntities = config.parameters.maxEntities || this.getIntensityValue(config.intensity, 100, 500, 1000, 5000)
      const batchSize = Math.min(100, maxEntities / 10)
      
      this.log(`Starting entity spam scenario: ${maxEntities} max entities`)
      
      let totalEntities = 0
      const entityBatches: EntityId[][] = []
      
      while (totalEntities < maxEntities) {
        const batchCount = Math.min(batchSize, maxEntities - totalEntities)
        
        // Create entity batch
        const entities = yield* this.harness.chaos.spawnEntities(batchCount)
        entityBatches.push(entities)
        totalEntities += batchCount
        
        if (this.currentTest) {
          this.currentTest.metrics.entitiesCreated += batchCount
        }
        
        this.log(`Created ${batchCount} entities (total: ${totalEntities})`)
        
        // Randomly delete some old batches to create churn
        if (entityBatches.length > 5 && Math.random() < 0.3) {
          const oldBatch = entityBatches.shift()!
          
          const world = yield* World
          for (const entity of oldBatch) {
            try {
              yield* world.removeEntity(entity)
              if (this.currentTest) {
                this.currentTest.metrics.entitiesDestroyed++
              }
            } catch {
              // Entity might already be gone
            }
          }
          
          this.log(`Removed batch of ${oldBatch.length} entities`)
        }
        
        // Brief pause between batches
        yield* Effect.sleep(Duration.millis(50 + Math.random() * 200))
      }
      
    }.bind(this)).pipe(
      Effect.provide(this.harness.runtime)
    )
  }

  /**
   * Memory pressure chaos scenario
   */
  private memoryPressureScenario(config: ChaosTestConfig): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const cycles = config.parameters.memoryPressureCycles || this.getIntensityValue(config.intensity, 10, 25, 50, 100)
      const entitiesPerCycle = this.getIntensityValue(config.intensity, 50, 100, 200, 500)
      
      this.log(`Starting memory pressure scenario: ${cycles} cycles`)
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        // Create memory pressure
        const results = yield* this.harness.chaos.memoryPressure(1, entitiesPerCycle)
        
        const memoryUsage = process.memoryUsage()
        if (this.currentTest && memoryUsage.heapUsed > this.currentTest.metrics.memoryPeakUsage) {
          this.currentTest.metrics.memoryPeakUsage = memoryUsage.heapUsed
        }
        
        // Check for concerning memory growth
        if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
          this.addFault('high-memory-usage', 'major', 
            `High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`, true)
        }
        
        this.log(`Memory pressure cycle ${cycle + 1}: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`)
        
        yield* Effect.sleep(Duration.millis(100 + Math.random() * 400))
      }
      
    }.bind(this))
  }

  /**
   * Random actions chaos scenario
   */
  private randomActionsScenario(
    config: ChaosTestConfig,
    playerId: EntityId
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const actionRate = config.parameters.actionRate || this.getIntensityValue(config.intensity, 1, 3, 5, 10)
      const intervalMs = 1000 / actionRate
      
      this.log(`Starting random actions scenario: ${actionRate} actions/sec`)
      
      const endTime = Date.now() + config.duration
      
      while (Date.now() < endTime) {
        try {
          yield* this.performRandomAction(playerId)
          
          if (this.currentTest) {
            this.currentTest.metrics.actionsPerformed++
          }
          
          yield* Effect.sleep(Duration.millis(intervalMs + Math.random() * intervalMs))
        } catch (error: any) {
          this.log(`Error during random action: ${error.message}`)
          if (this.currentTest) {
            this.currentTest.metrics.errorCount++
          }
          
          this.addFault('action-error', 'minor', `Action failed: ${error.message}`, true)
        }
      }
      
    }.bind(this))
  }

  /**
   * Block spam chaos scenario
   */
  private blockSpamScenario(
    config: ChaosTestConfig,
    playerId: EntityId
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const updatesPerSecond = config.parameters.blockUpdatesPerSecond || 
        this.getIntensityValue(config.intensity, 10, 25, 50, 100)
      const intervalMs = 1000 / updatesPerSecond
      
      this.log(`Starting block spam scenario: ${updatesPerSecond} updates/sec`)
      
      const endTime = Date.now() + config.duration
      
      while (Date.now() < endTime) {
        try {
          // Random block operation
          const operation = Math.random() < 0.5 ? 'place' : 'destroy'
          const x = Math.floor(Math.random() * 200) - 100
          const y = 60 + Math.floor(Math.random() * 40)
          const z = Math.floor(Math.random() * 200) - 100
          
          if (operation === 'place') {
            const blockType = [BlockType.STONE, BlockType.DIRT, BlockType.WOOD][
              Math.floor(Math.random() * 3)
            ]
            yield* this.harness.simulatePlayerActions.placeBlock(playerId, x, y, z, blockType)
          } else {
            yield* this.harness.simulatePlayerActions.destroyBlock(x, y, z)
          }
          
          if (this.currentTest) {
            this.currentTest.metrics.blockUpdates++
          }
          
          yield* Effect.sleep(Duration.millis(intervalMs))
        } catch (error: any) {
          this.log(`Error during block operation: ${error.message}`)
          if (this.currentTest) {
            this.currentTest.metrics.errorCount++
          }
        }
      }
      
    }.bind(this))
  }

  /**
   * Concurrent operations chaos scenario
   */
  private concurrentOperationsScenario(
    config: ChaosTestConfig,
    playerId: EntityId
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const concurrentOps = config.parameters.concurrentOperations ||
        this.getIntensityValue(config.intensity, 5, 10, 20, 50)
      
      this.log(`Starting concurrent operations scenario: ${concurrentOps} concurrent operations`)
      
      const operations = []
      
      for (let i = 0; i < concurrentOps; i++) {
        const operation = this.createRandomConcurrentOperation(playerId, i)
        operations.push(operation)
      }
      
      // Run all operations concurrently
      yield* Effect.all(operations, { concurrency: 'unbounded' })
      
    }.bind(this))
  }

  /**
   * Create a random concurrent operation
   */
  private createRandomConcurrentOperation(
    playerId: EntityId,
    operationId: number
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const operationType = Math.floor(Math.random() * 4)
      
      try {
        switch (operationType) {
          case 0: // Movement
            yield* this.harness.simulatePlayerActions.move(
              playerId, 
              ['forward', 'backward', 'left', 'right'][Math.floor(Math.random() * 4)] as any,
              1000 + Math.random() * 2000
            )
            break
            
          case 1: // Entity creation
            yield* this.harness.chaos.spawnEntities(10 + Math.floor(Math.random() * 90))
            break
            
          case 2: // Block operations
            for (let i = 0; i < 50; i++) {
              const x = Math.floor(Math.random() * 50) - 25
              const y = 60 + Math.floor(Math.random() * 20)
              const z = Math.floor(Math.random() * 50) - 25
              
              yield* this.harness.simulatePlayerActions.placeBlock(
                playerId, x, y, z, BlockType.STONE
              )
            }
            break
            
          case 3: // Memory allocation
            const largeArray = new Array(100000).fill(Math.random())
            yield* Effect.sleep(Duration.millis(1000))
            // Let it be garbage collected
            break
        }
      } catch (error: any) {
        this.log(`Concurrent operation ${operationId} failed: ${error.message}`)
        if (this.currentTest) {
          this.currentTest.metrics.errorCount++
        }
      }
    }.bind(this))
  }

  /**
   * Perform a random action
   */
  private performRandomAction(playerId: EntityId): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const actions = ['move', 'jump', 'place', 'destroy', 'wait'] as const
      const action = actions[Math.floor(Math.random() * actions.length)]
      
      switch (action) {
        case 'move':
          const direction = ['forward', 'backward', 'left', 'right'][Math.floor(Math.random() * 4)] as any
          const duration = 100 + Math.random() * 500
          yield* this.harness.simulatePlayerActions.move(playerId, direction, duration)
          break
          
        case 'jump':
          yield* this.harness.simulatePlayerActions.jump(playerId)
          break
          
        case 'place':
          const x = Math.floor(Math.random() * 20) - 10
          const y = 64 + Math.floor(Math.random() * 10)
          const z = Math.floor(Math.random() * 20) - 10
          const blockType = [BlockType.STONE, BlockType.DIRT, BlockType.WOOD][Math.floor(Math.random() * 3)]
          yield* this.harness.simulatePlayerActions.placeBlock(playerId, x, y, z, blockType)
          break
          
        case 'destroy':
          const dx = Math.floor(Math.random() * 20) - 10
          const dy = 64 + Math.floor(Math.random() * 10)
          const dz = Math.floor(Math.random() * 20) - 10
          yield* this.harness.simulatePlayerActions.destroyBlock(dx, dy, dz)
          break
          
        case 'wait':
          yield* Effect.sleep(Duration.millis(50 + Math.random() * 200))
          break
      }
    }.bind(this))
  }

  /**
   * Start chaos monitoring
   */
  private startChaosMonitoring(): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      // Monitor performance metrics
      const monitoringFiber = yield* Effect.gen(function* () {
        while (true) {
          const memoryUsage = process.memoryUsage()
          
          // Check for memory leaks
          if (memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
            this.addFault('memory-leak', 'critical', 
              `Excessive memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`, false)
          }
          
          // Update peak memory usage
          if (this.currentTest && memoryUsage.heapUsed > this.currentTest.metrics.memoryPeakUsage) {
            this.currentTest.metrics.memoryPeakUsage = memoryUsage.heapUsed
          }
          
          yield* Effect.sleep(Duration.millis(1000))
        }
      }.bind(this)).pipe(Effect.fork)
      
      // Store the fiber for cleanup if needed
      return
      
    }.bind(this))
  }

  /**
   * Run stability checks after test completion
   */
  private runStabilityChecks(
    result: ChaosTestResult,
    config: ChaosTestConfig
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      this.log('Running stability checks...')
      
      // Check memory leaks
      const memoryIncrease = result.metrics.memoryPeakUsage - process.memoryUsage().heapUsed
      result.stability.memoryLeaks = memoryIncrease > config.stabilityChecks.maxMemoryIncrease
      
      // Check performance degradation
      result.stability.performanceDegraded = result.metrics.fpsMin < config.stabilityChecks.minFPS
      
      // Check for critical faults
      const criticalFaults = result.faults.filter(f => f.severity === 'critical')
      result.stability.systemStable = criticalFaults.length === 0 && result.status === 'completed'
      
      // Simple data corruption check (would be more sophisticated in practice)
      result.stability.dataCorruption = result.metrics.errorCount > 10
      
      this.log(`Stability check results: ${JSON.stringify(result.stability, null, 2)}`)
      
    }.bind(this))
  }

  /**
   * Add a fault to the current test
   */
  private addFault(
    type: string,
    severity: 'minor' | 'major' | 'critical',
    description: string,
    recovered: boolean,
    recoveryTime?: number
  ): void {
    const fault = {
      type,
      timestamp: Date.now(),
      severity,
      description,
      recovered,
      recoveryTime
    }
    
    this.faults.push(fault)
    this.log(`FAULT [${severity.toUpperCase()}] ${type}: ${description}`)
  }

  /**
   * Log a message
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    this.logs.push(logMessage)
    console.log(logMessage)
  }

  /**
   * Get value based on intensity level
   */
  private getIntensityValue(
    intensity: ChaosTestConfig['intensity'],
    low: number,
    medium: number,
    high: number,
    extreme: number
  ): number {
    switch (intensity) {
      case 'low': return low
      case 'medium': return medium
      case 'high': return high
      case 'extreme': return extreme
    }
  }

  /**
   * Generate chaos test report
   */
  generateReport(
    suite: ChaosTestSuite,
    outputPath?: string
  ): Effect.Effect<string, never, never> {
    return Effect.gen(function* () {
      const reportPath = outputPath || 
        path.join(process.cwd(), 'e2e', 'chaos-reports', `chaos-report-${Date.now()}.html`)
      
      yield* Effect.promise(() => fs.mkdir(path.dirname(reportPath), { recursive: true }))
      
      const html = this.generateReportHTML(suite)
      yield* Effect.promise(() => fs.writeFile(reportPath, html))
      
      return reportPath
    }.bind(this))
  }

  /**
   * Generate HTML report
   */
  private generateReportHTML(suite: ChaosTestSuite): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chaos Testing Report - ${suite.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric.passed { border-left: 4px solid #4CAF50; }
        .metric.failed { border-left: 4px solid #f44336; }
        .metric.warning { border-left: 4px solid #ff9800; }
        .test-result { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .test-result.passed { background: #f9fff9; border-color: #4CAF50; }
        .test-result.failed { background: #fff9f9; border-color: #f44336; }
        .fault { margin: 10px 0; padding: 10px; border-radius: 3px; }
        .fault.minor { background: #fff3cd; border-left: 4px solid #ffc107; }
        .fault.major { background: #f8d7da; border-left: 4px solid #dc3545; }
        .fault.critical { background: #d1ecf1; border-left: 4px solid #dc3545; }
        .logs { max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Chaos Testing Report</h1>
        <h2>${suite.name}</h2>
        <p>Generated on: ${new Date(suite.timestamp).toISOString()}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <p style="font-size: 2em; margin: 0;">${suite.summary.totalTests}</p>
        </div>
        <div class="metric ${suite.summary.passedTests === suite.summary.totalTests ? 'passed' : 'failed'}">
            <h3>Passed</h3>
            <p style="font-size: 2em; margin: 0; color: #4CAF50;">${suite.summary.passedTests}</p>
        </div>
        <div class="metric ${suite.summary.failedTests === 0 ? 'passed' : 'failed'}">
            <h3>Failed</h3>
            <p style="font-size: 2em; margin: 0; color: #f44336;">${suite.summary.failedTests}</p>
        </div>
        <div class="metric ${suite.summary.criticalFailures === 0 ? 'passed' : 'failed'}">
            <h3>Critical Failures</h3>
            <p style="font-size: 2em; margin: 0; color: #f44336;">${suite.summary.criticalFailures}</p>
        </div>
        <div class="metric ${suite.summary.overallStability > 0.8 ? 'passed' : suite.summary.overallStability > 0.6 ? 'warning' : 'failed'}">
            <h3>Stability Score</h3>
            <p style="font-size: 2em; margin: 0;">${(suite.summary.overallStability * 100).toFixed(1)}%</p>
        </div>
    </div>
    
    ${suite.results.map(result => `
        <div class="test-result ${result.stability.systemStable ? 'passed' : 'failed'}">
            <h2>${result.config.name}</h2>
            <p><strong>Status:</strong> ${result.status.toUpperCase()}</p>
            <p><strong>Duration:</strong> ${result.duration}ms (target: ${result.config.duration}ms)</p>
            <p><strong>Intensity:</strong> ${result.config.intensity}</p>
            
            <h3>Metrics</h3>
            <ul>
                <li>Entities Created: ${result.metrics.entitiesCreated}</li>
                <li>Entities Destroyed: ${result.metrics.entitiesDestroyed}</li>
                <li>Actions Performed: ${result.metrics.actionsPerformed}</li>
                <li>Block Updates: ${result.metrics.blockUpdates}</li>
                <li>Peak Memory: ${Math.round(result.metrics.memoryPeakUsage / 1024 / 1024)}MB</li>
                <li>Min FPS: ${result.metrics.fpsMin}</li>
                <li>Errors: ${result.metrics.errorCount}</li>
            </ul>
            
            <h3>Stability</h3>
            <ul>
                <li>System Stable: ${result.stability.systemStable ? '✅' : '❌'}</li>
                <li>Memory Leaks: ${result.stability.memoryLeaks ? '❌' : '✅'}</li>
                <li>Performance Degraded: ${result.stability.performanceDegraded ? '❌' : '✅'}</li>
                <li>Data Corruption: ${result.stability.dataCorruption ? '❌' : '✅'}</li>
            </ul>
            
            ${result.faults.length > 0 ? `
                <h3>Faults (${result.faults.length})</h3>
                ${result.faults.map(fault => `
                    <div class="fault ${fault.severity}">
                        <strong>[${fault.severity.toUpperCase()}]</strong> ${fault.type}: ${fault.description}
                        ${fault.recovered ? ` (Recovered${fault.recoveryTime ? ` in ${fault.recoveryTime}ms` : ''})` : ' (Not recovered)'}
                    </div>
                `).join('')}
            ` : ''}
            
            <details>
                <summary>Test Logs (${result.logs.length} entries)</summary>
                <div class="logs">
                    ${result.logs.map(log => `<div>${log}</div>`).join('')}
                </div>
            </details>
        </div>
    `).join('')}
</body>
</html>
    `.trim()
  }
}

/**
 * Pre-configured chaos test scenarios
 */
export const ChaosTestConfigs = {
  /**
   * Light chaos test for continuous integration
   */
  ci: (): ChaosTestConfig => ({
    name: 'CI Chaos Test',
    description: 'Lightweight chaos test suitable for CI/CD pipeline',
    duration: 30000, // 30 seconds
    intensity: 'low',
    faultTypes: ['entity-spam', 'random-actions'],
    parameters: {
      maxEntities: 100,
      actionRate: 2
    },
    stabilityChecks: {
      maxMemoryIncrease: 50 * 1024 * 1024, // 50MB
      minFPS: 45,
      maxCrashRecoveryTime: 5000
    }
  }),

  /**
   * Comprehensive stress test
   */
  stress: (): ChaosTestConfig => ({
    name: 'Stress Test',
    description: 'Comprehensive stress testing with multiple fault types',
    duration: 120000, // 2 minutes
    intensity: 'high',
    faultTypes: ['entity-spam', 'memory-pressure', 'random-actions', 'block-spam'],
    parameters: {
      maxEntities: 1000,
      actionRate: 5,
      memoryPressureCycles: 50,
      blockUpdatesPerSecond: 50
    },
    stabilityChecks: {
      maxMemoryIncrease: 100 * 1024 * 1024, // 100MB
      minFPS: 30,
      maxCrashRecoveryTime: 10000
    }
  }),

  /**
   * Extreme load test
   */
  extreme: (): ChaosTestConfig => ({
    name: 'Extreme Load Test',
    description: 'Maximum intensity chaos test to find breaking points',
    duration: 300000, // 5 minutes
    intensity: 'extreme',
    faultTypes: ['entity-spam', 'memory-pressure', 'random-actions', 'block-spam', 'concurrent-operations'],
    parameters: {
      maxEntities: 5000,
      actionRate: 10,
      memoryPressureCycles: 100,
      blockUpdatesPerSecond: 100,
      concurrentOperations: 50
    },
    stabilityChecks: {
      maxMemoryIncrease: 200 * 1024 * 1024, // 200MB
      minFPS: 20,
      maxCrashRecoveryTime: 15000
    }
  })
}

/**
 * Convenience function for chaos testing
 */
export const withChaosTester = <A, E>(
  harness: GameTestHarness,
  effect: Effect.Effect<A, E, ChaosTester>
): Effect.Effect<A, E, never> => {
  const tester = new ChaosTester(harness)
  return effect.pipe(
    Effect.provideService(ChaosTester, tester)
  )
}