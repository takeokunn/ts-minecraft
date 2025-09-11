import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { GameTestHarness, withGameHarness, GameTestBuilder } from './framework/game-test-harness'
import { VisualRegressionTester, withVisualTester, VisualTestScenarios } from './framework/visual-regression'
import { PerformanceTester, withPerformanceTester, PerformanceScenarios } from './framework/performance-testing'
import { ChaosTester, withChaosTester, ChaosTestConfigs } from './framework/chaos-testing'
import { BlockType } from '@/core/values/block-type'

/**
 * Comprehensive Integration Test Suite
 * 
 * This test suite demonstrates the usage of all testing frameworks
 * created for the Minecraft TypeScript project. It includes:
 * - E2E game scenarios
 * - Visual regression testing
 * - Performance benchmarking
 * - Chaos testing
 */

describe('Minecraft Integration Test Suite', () => {
  describe('Core Game Functionality', () => {
    it.effect('should handle complete player session', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        
        // Initialize game
        const { playerId, worldStats } = yield* harness.initializeGame()
        expect(worldStats.entityCount).toBe(1) // Only player
        
        // Test player movement
        yield* harness.simulatePlayerActions.move(playerId, 'forward', 1000)
        const isAtNewPosition = yield* harness.verifyWorldState.playerAt(playerId, 0, 64, 4.3, 1.0)
        expect(isAtNewPosition).toBe(true)
        
        // Test block interactions
        yield* harness.simulatePlayerActions.placeBlock(playerId, 5, 64, 5, BlockType.STONE)
        const blockExists = yield* harness.verifyWorldState.blockAt(5, 64, 5, BlockType.STONE)
        expect(blockExists).toBe(true)
        
        // Test jumping and physics
        yield* harness.simulatePlayerActions.jump(playerId)
        const isGrounded = yield* harness.verifyWorldState.playerGrounded(playerId)
        expect(isGrounded).toBe(false) // Should be in air after jump
        
        return { playerId, worldStats }
      }).pipe(withGameHarness)
    )

    it.effect('should maintain world consistency during complex operations', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Create a complex structure
        const structures = [
          { x: 0, y: 65, z: 0, type: BlockType.STONE },
          { x: 1, y: 65, z: 0, type: BlockType.STONE },
          { x: 0, y: 65, z: 1, type: BlockType.STONE },
          { x: 1, y: 65, z: 1, type: BlockType.STONE },
          { x: 0, y: 66, z: 0, type: BlockType.WOOD },
          { x: 1, y: 66, z: 1, type: BlockType.WOOD }
        ]
        
        for (const block of structures) {
          yield* harness.simulatePlayerActions.placeBlock(playerId, block.x, block.y, block.z, block.type)
        }
        
        // Verify all blocks exist
        for (const block of structures) {
          const exists = yield* harness.verifyWorldState.blockAt(block.x, block.y, block.z, block.type)
          expect(exists).toBe(true)
        }
        
        // Test partial destruction
        yield* harness.simulatePlayerActions.destroyBlock(0, 66, 0)
        const destroyed = yield* harness.verifyWorldState.blockAt(0, 66, 0, BlockType.AIR)
        expect(destroyed).toBe(true)
        
        // Verify other blocks still exist
        const stillExists = yield* harness.verifyWorldState.blockAt(1, 66, 1, BlockType.WOOD)
        expect(stillExists).toBe(true)
        
        return { structuresBuilt: structures.length }
      }).pipe(withGameHarness)
    )
  })

  describe('Performance Integration Tests', () => {
    it.effect('should maintain 60 FPS with 1000 entities', () =>
      GameTestBuilder.performance('1000-entity-fps-test', 60)
        .withEntities(1000)
        .test(5000)
        .run().then(result => {
          expect(result.passed).toBe(true)
          expect(result.fps.average).toBeGreaterThan(60)
          expect(result.entityCount).toBe(1000)
        })
    )

    it.effect('should handle entity stress test with performance monitoring', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Run FPS stress test
        const stressResults = yield* perfTester.runFPSStressTest(5000, 100, 3000)
        
        // Find the breaking point
        const breakingPoint = stressResults.find(result => !result.stable)
        const maxStableEntities = breakingPoint 
          ? breakingPoint.entityCount - 100 
          : stressResults[stressResults.length - 1].entityCount
        
        expect(maxStableEntities).toBeGreaterThan(500) // Should handle at least 500 entities
        
        return { maxStableEntities, testResults: stressResults }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should detect memory leaks in entity lifecycle', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Run memory leak test
        const leakTest = yield* perfTester.runMemoryLeakTest(50, 100, 500)
        
        expect(leakTest.leakDetected).toBe(false)
        expect(leakTest.memoryGrowth).toBeLessThan(1024 * 1024) // Less than 1MB per cycle
        
        return { leakTest }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should benchmark chunk loading performance', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Run chunk loading test
        const chunkTest = yield* perfTester.runChunkLoadingTest(16, 20)
        
        expect(chunkTest.averageChunkLoadTime).toBeLessThan(50) // Less than 50ms average
        expect(chunkTest.frameDropsDuringLoading).toBeLessThan(5) // Minimal frame drops
        expect(chunkTest.chunksLoadedPerSecond).toBeGreaterThan(10) // At least 10 chunks/sec
        
        return { chunkTest }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )
  })

  describe('Visual Regression Tests', () => {
    it.effect('should maintain visual consistency across camera angles', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const visualTester = yield* Effect.service(VisualRegressionTester)
        
        // Create test world with recognizable structures
        const { playerId } = yield* harness.initializeGame()
        
        // Build a pyramid for visual testing
        for (let level = 0; level < 5; level++) {
          const size = 5 - level
          for (let x = -size; x <= size; x++) {
            for (let z = -size; z <= size; z++) {
              yield* harness.simulatePlayerActions.placeBlock(
                playerId, x, 65 + level, z, BlockType.STONE
              )
            }
          }
        }
        
        // Test different camera angles
        const visualTest = yield* visualTester.runVisualTest(
          'pyramid-view-test',
          VisualTestScenarios.cameraAngles({ x: 0, y: 70, z: 0 }, 15),
          0.98 // High similarity threshold for regression testing
        )
        
        expect(visualTest.passed).toBe(true)
        expect(visualTest.summary.averageSimilarity).toBeGreaterThan(0.95)
        
        return { visualTest }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withVisualTester(harness, 'integration-tests', Effect.succeed({}))
        }))
      )
    )

    it.effect('should detect rendering changes with lighting conditions', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const visualTester = yield* Effect.service(VisualRegressionTester)
        
        // Initialize with structures
        const { playerId } = yield* harness.initializeGame()
        
        // Create varied landscape
        const structures = [
          { x: 0, y: 65, z: 0, type: BlockType.WOOD },
          { x: 5, y: 67, z: 5, type: BlockType.STONE },
          { x: -3, y: 64, z: 8, type: BlockType.DIRT }
        ]
        
        for (const struct of structures) {
          yield* harness.simulatePlayerActions.placeBlock(
            playerId, struct.x, struct.y, struct.z, struct.type
          )
        }
        
        // Test different lighting conditions
        const lightingTest = yield* visualTester.runVisualTest(
          'lighting-conditions-test',
          VisualTestScenarios.lightingConditions({ x: 0, y: 68, z: 0 }),
          0.90 // Lighting can cause more variation
        )
        
        expect(lightingTest.passed).toBe(true)
        expect(lightingTest.screenshots).toHaveLength(4) // daylight, sunset, night, underground
        
        return { lightingTest }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withVisualTester(harness, 'lighting-tests', Effect.succeed({}))
        }))
      )
    )
  })

  describe('Chaos Testing', () => {
    it.effect('should survive light chaos testing (CI-suitable)', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const chaosTester = yield* Effect.service(ChaosTester)
        
        // Run light chaos test suitable for CI
        const chaosResult = yield* chaosTester.runChaosTest(ChaosTestConfigs.ci())
        
        expect(chaosResult.status).toBe('completed')
        expect(chaosResult.stability.systemStable).toBe(true)
        expect(chaosResult.metrics.errorCount).toBeLessThan(5)
        
        // Should have performed some actions without crashing
        expect(chaosResult.metrics.actionsPerformed).toBeGreaterThan(10)
        expect(chaosResult.metrics.entitiesCreated).toBeGreaterThan(0)
        
        return { chaosResult }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withChaosTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should handle moderate stress testing', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const chaosTester = yield* Effect.service(ChaosTester)
        
        // Run stress test
        const stressConfig = ChaosTestConfigs.stress()
        stressConfig.duration = 60000 // Reduce duration for testing
        
        const stressResult = yield* chaosTester.runChaosTest(stressConfig)
        
        // System should survive but may have some minor issues
        expect(['completed', 'resource-exhausted']).toContain(stressResult.status)
        
        // Should not have critical failures
        const criticalFaults = stressResult.faults.filter(f => f.severity === 'critical')
        expect(criticalFaults.length).toBeLessThan(3)
        
        // Should have performed significant work
        expect(stressResult.metrics.entitiesCreated).toBeGreaterThan(500)
        expect(stressResult.metrics.actionsPerformed).toBeGreaterThan(100)
        
        return { stressResult }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withChaosTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should run comprehensive chaos test suite', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const chaosTester = yield* Effect.service(ChaosTester)
        
        // Create test suite with varying intensities
        const testConfigs = [
          ChaosTestConfigs.ci(),
          {
            ...ChaosTestConfigs.stress(),
            duration: 30000, // Reduced for testing
            intensity: 'medium' as const
          }
        ]
        
        const suite = yield* chaosTester.runChaosTestSuite('integration-chaos-suite', testConfigs)
        
        // At least one test should pass completely
        expect(suite.summary.passedTests).toBeGreaterThan(0)
        
        // Overall stability should be reasonable
        expect(suite.summary.overallStability).toBeGreaterThan(0.5)
        
        // Should not have too many critical failures
        expect(suite.summary.criticalFailures).toBeLessThan(2)
        
        return { suite }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withChaosTester(harness, Effect.succeed({}))
        }))
      )
    )
  })

  describe('Multi-Framework Integration', () => {
    it.effect('should run combined performance and visual regression test', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        const visualTester = yield* Effect.service(VisualRegressionTester)
        
        // Initialize with complex scene
        const { playerId } = yield* harness.initializeGame()
        
        // Build test scene
        for (let i = 0; i < 10; i++) {
          yield* harness.simulatePlayerActions.placeBlock(
            playerId, i, 65, 0, BlockType.STONE
          )
        }
        
        // Spawn some entities for performance impact
        yield* harness.chaos.spawnEntities(100)
        
        // Run performance benchmark
        const perfResult = yield* perfTester.runBenchmark(
          'combined-test-performance',
          'Performance test with visual scene',
          Effect.gen(function* () {
            const h = yield* Effect.service(GameTestHarness)
            yield* h.simulatePlayerActions.move(playerId, 'forward', 2000)
            yield* h.simulatePlayerActions.move(playerId, 'right', 2000)
          }),
          5000,
          50 // Lower FPS target due to entities
        )
        
        // Capture visual state
        const { filePath } = yield* visualTester.captureScreenshot(
          'combined-test-visual',
          { x: 5, y: 70, z: 5 },
          { pitch: -30, yaw: 45 }
        )
        
        expect(perfResult.summary.passed).toBe(true)
        expect(perfResult.summary.averageFPS).toBeGreaterThan(45)
        expect(filePath).toBeTruthy()
        
        return { perfResult, visualCapture: filePath }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          const perfTesterEffect = withPerformanceTester(harness, Effect.succeed({}))
          const visualTesterEffect = withVisualTester(harness, 'combined-tests', Effect.succeed({}))
          
          return yield* Effect.all([perfTesterEffect, visualTesterEffect])
        }))
      )
    )

    it.effect('should generate comprehensive test report', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        const chaosTester = yield* Effect.service(ChaosTester)
        
        // Run multiple test types
        const perfBenchmark = yield* perfTester.runBenchmark(
          'report-performance-test',
          'Performance test for reporting',
          PerformanceScenarios.fpsStability(60, 5000)
        )
        
        const chaosResult = yield* chaosTester.runChaosTest({
          ...ChaosTestConfigs.ci(),
          duration: 15000 // Quick test
        })
        
        // Generate reports
        const perfReport = yield* perfTester.generateReport([perfBenchmark])
        const chaosReportPath = yield* chaosTester.generateReport({
          name: 'integration-test-chaos',
          timestamp: Date.now(),
          results: [chaosResult],
          summary: {
            totalTests: 1,
            passedTests: chaosResult.stability.systemStable ? 1 : 0,
            failedTests: chaosResult.stability.systemStable ? 0 : 1,
            criticalFailures: chaosResult.faults.filter(f => f.severity === 'critical').length,
            overallStability: chaosResult.stability.systemStable ? 1 : 0
          }
        })
        
        expect(perfReport.benchmarks).toHaveLength(1)
        expect(chaosReportPath).toMatch(/\.html$/)
        
        return {
          performanceReport: perfReport,
          chaosReportPath,
          testsPassed: perfBenchmark.summary.passed && chaosResult.stability.systemStable
        }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          const perfTesterEffect = withPerformanceTester(harness, Effect.succeed({}))
          const chaosTesterEffect = withChaosTester(harness, Effect.succeed({}))
          
          return yield* Effect.all([perfTesterEffect, chaosTesterEffect])
        }))
      )
    )
  })
})

// Helper to run Effect-based tests with vitest
declare module 'vitest' {
  interface TestAPI {
    effect: <A, E>(name: string, effect: Effect.Effect<A, E, never>) => void
  }
}

// Extend vitest with Effect support
const originalIt = it
// @ts-ignore
originalIt.effect = function<A, E>(name: string, effect: Effect.Effect<A, E, never>) {
  return originalIt(name, async () => {
    const result = await Effect.runPromise(effect)
    return result
  })
}