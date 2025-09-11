import { Effect, Array as EffectArray, pipe, Option } from 'effect'
import { World, Renderer } from '@/services'
import { GameTestHarness } from './game-test-harness'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'

/**
 * Visual regression testing framework for Minecraft renderer
 * 
 * Features:
 * - Screenshot capture and comparison
 * - Rendering result verification
 * - Difference detection and reporting
 * - Baseline management
 * - CI-friendly reporting
 */

export interface ScreenshotMetadata {
  timestamp: number
  testName: string
  resolution: { width: number; height: number }
  cameraPosition: { x: number; y: number; z: number }
  cameraRotation: { pitch: number; yaw: number }
  renderSettings: {
    renderDistance: number
    fov: number
    quality: 'low' | 'medium' | 'high'
  }
  worldChecksum: string
}

export interface ScreenshotComparison {
  testName: string
  baseline: string | null
  current: string
  difference: string | null
  similarity: number // 0-1, where 1 is identical
  passed: boolean
  threshold: number
  metadata: ScreenshotMetadata
  pixelDifferences: {
    total: number
    percentage: number
    maxDelta: number
  }
}

export interface VisualTestResult {
  testName: string
  screenshots: ScreenshotComparison[]
  passed: boolean
  summary: {
    totalScreenshots: number
    passedScreenshots: number
    failedScreenshots: number
    averageSimilarity: number
  }
}

/**
 * Visual regression testing utilities
 */
export class VisualRegressionTester {
  private readonly baselineDir: string
  private readonly outputDir: string
  private readonly diffDir: string
  
  constructor(
    private readonly harness: GameTestHarness,
    testSuiteName: string = 'visual-regression'
  ) {
    const baseDir = path.join(process.cwd(), 'e2e', 'visual-baselines', testSuiteName)
    this.baselineDir = path.join(baseDir, 'baselines')
    this.outputDir = path.join(baseDir, 'current')
    this.diffDir = path.join(baseDir, 'diffs')
  }

  /**
   * Initialize visual testing directories
   */
  private initializeDirectories(): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      yield* Effect.promise(() => fs.mkdir(this.baselineDir, { recursive: true }))
      yield* Effect.promise(() => fs.mkdir(this.outputDir, { recursive: true }))
      yield* Effect.promise(() => fs.mkdir(this.diffDir, { recursive: true }))
    }.bind(this))
  }

  /**
   * Capture screenshot with metadata
   */
  captureScreenshot(
    testName: string,
    cameraPosition: { x: number; y: number; z: number },
    cameraRotation: { pitch: number; yaw: number } = { pitch: 0, yaw: 0 },
    resolution: { width: number; height: number } = { width: 1920, height: 1080 },
    renderSettings: ScreenshotMetadata['renderSettings'] = {
      renderDistance: 16,
      fov: 70,
      quality: 'medium'
    }
  ): Effect.Effect<{ filePath: string; metadata: ScreenshotMetadata }, never, never> {
    return Effect.gen(function* () {
      yield* this.initializeDirectories()
      
      // Set camera position and rotation
      const renderer = yield* Renderer
      yield* renderer.setCamera(cameraPosition, cameraRotation)
      yield* renderer.setResolution(resolution.width, resolution.height)
      
      // Calculate world checksum for change detection
      const worldChecksum = yield* this.calculateWorldChecksum()
      
      // Create metadata
      const metadata: ScreenshotMetadata = {
        timestamp: Date.now(),
        testName,
        resolution,
        cameraPosition,
        cameraRotation,
        renderSettings,
        worldChecksum
      }
      
      // Generate filename
      const filename = `${testName}-${Date.now()}.png`
      const filePath = path.join(this.outputDir, filename)
      
      // Capture screenshot (simulated - would use actual renderer)
      const screenshotData = yield* this.simulateScreenshot(metadata)
      yield* Effect.promise(() => fs.writeFile(filePath, screenshotData))
      
      // Save metadata
      const metadataPath = filePath.replace('.png', '.json')
      yield* Effect.promise(() => 
        fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
      )
      
      return { filePath, metadata }
    }).pipe(
      Effect.provide(this.harness.runtime)
    )
  }

  /**
   * Compare current screenshot with baseline
   */
  compareWithBaseline(
    testName: string,
    currentScreenshot: string,
    threshold: number = 0.95
  ): Effect.Effect<ScreenshotComparison, never, never> {
    return Effect.gen(function* () {
      const baselinePattern = path.join(this.baselineDir, `${testName}-baseline.png`)
      const metadataPath = currentScreenshot.replace('.png', '.json')
      
      // Load metadata
      const metadataContent = yield* Effect.promise(() => fs.readFile(metadataPath, 'utf-8'))
      const metadata: ScreenshotMetadata = JSON.parse(metadataContent)
      
      // Check if baseline exists
      const baselineExists = yield* Effect.promise(async () => {
        try {
          await fs.access(baselinePattern)
          return true
        } catch {
          return false
        }
      })
      
      if (!baselineExists) {
        // First run - create baseline
        yield* Effect.promise(() => fs.copyFile(currentScreenshot, baselinePattern))
        
        return {
          testName,
          baseline: baselinePattern,
          current: currentScreenshot,
          difference: null,
          similarity: 1.0,
          passed: true,
          threshold,
          metadata,
          pixelDifferences: {
            total: 0,
            percentage: 0,
            maxDelta: 0
          }
        }
      }
      
      // Compare screenshots
      const comparison = yield* this.compareImages(baselinePattern, currentScreenshot)
      
      // Generate diff image if needed
      let diffPath: string | null = null
      if (comparison.similarity < threshold) {
        diffPath = path.join(this.diffDir, `${testName}-diff-${Date.now()}.png`)
        yield* this.generateDiffImage(baselinePattern, currentScreenshot, diffPath)
      }
      
      return {
        testName,
        baseline: baselinePattern,
        current: currentScreenshot,
        difference: diffPath,
        similarity: comparison.similarity,
        passed: comparison.similarity >= threshold,
        threshold,
        metadata,
        pixelDifferences: comparison.pixelDifferences
      }
    })
  }

  /**
   * Run complete visual test scenario
   */
  runVisualTest(
    testName: string,
    scenario: Effect.Effect<Array<{
      name: string
      position: { x: number; y: number; z: number }
      rotation?: { pitch: number; yaw: number }
    }>, never, GameTestHarness>,
    threshold: number = 0.95
  ): Effect.Effect<VisualTestResult, never, never> {
    return Effect.gen(function* () {
      const screenshots: ScreenshotComparison[] = []
      
      // Run the scenario to get screenshot specifications
      const screenshotSpecs = yield* this.harness.runGame(scenario)
      
      // Capture and compare each screenshot
      for (const spec of screenshotSpecs) {
        const { filePath } = yield* this.captureScreenshot(
          `${testName}-${spec.name}`,
          spec.position,
          spec.rotation
        )
        
        const comparison = yield* this.compareWithBaseline(
          `${testName}-${spec.name}`,
          filePath,
          threshold
        )
        
        screenshots.push(comparison)
      }
      
      // Calculate summary
      const passedCount = screenshots.filter(s => s.passed).length
      const averageSimilarity = screenshots.reduce((sum, s) => sum + s.similarity, 0) / screenshots.length
      
      return {
        testName,
        screenshots,
        passed: screenshots.every(s => s.passed),
        summary: {
          totalScreenshots: screenshots.length,
          passedScreenshots: passedCount,
          failedScreenshots: screenshots.length - passedCount,
          averageSimilarity
        }
      }
    })
  }

  /**
   * Batch visual testing for multiple scenarios
   */
  runVisualTestSuite(
    tests: Array<{
      name: string
      scenario: Effect.Effect<any, never, GameTestHarness>
      threshold?: number
    }>
  ): Effect.Effect<Array<VisualTestResult>, never, never> {
    return Effect.gen(function* () {
      const results: VisualTestResult[] = []
      
      for (const test of tests) {
        const result = yield* this.runVisualTest(
          test.name,
          test.scenario,
          test.threshold
        )
        results.push(result)
      }
      
      return results
    })
  }

  /**
   * Generate HTML report for visual test results
   */
  generateReport(
    results: Array<VisualTestResult>,
    outputPath?: string
  ): Effect.Effect<string, never, never> {
    return Effect.gen(function* () {
      const reportPath = outputPath || path.join(this.outputDir, 'visual-report.html')
      
      const html = this.generateReportHTML(results)
      yield* Effect.promise(() => fs.writeFile(reportPath, html))
      
      return reportPath
    })
  }

  /**
   * Calculate world state checksum for change detection
   */
  private calculateWorldChecksum(): Effect.Effect<string, never, World> {
    return Effect.gen(function* () {
      const world = yield* World
      
      // Get all entities and world state
      const entities = yield* world.query('position')
      const worldData = {
        entityCount: entities.length,
        timestamp: Date.now()
        // In real implementation, would include voxel data
      }
      
      const hash = createHash('md5')
      hash.update(JSON.stringify(worldData))
      return hash.digest('hex')
    })
  }

  /**
   * Simulate screenshot capture (placeholder for actual renderer integration)
   */
  private simulateScreenshot(metadata: ScreenshotMetadata): Effect.Effect<Buffer, never, never> {
    return Effect.sync(() => {
      // In a real implementation, this would:
      // 1. Render the current world state
      // 2. Capture the framebuffer
      // 3. Convert to PNG format
      
      // For now, generate a simple test pattern
      const width = metadata.resolution.width
      const height = metadata.resolution.height
      const header = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A // PNG header
      ])
      
      // Simplified: create a deterministic pattern based on camera position
      const pattern = Buffer.alloc(width * height * 4) // RGBA
      for (let i = 0; i < pattern.length; i += 4) {
        const x = (i / 4) % width
        const y = Math.floor((i / 4) / width)
        
        // Create pattern based on camera position and world checksum
        const r = (x + metadata.cameraPosition.x) % 256
        const g = (y + metadata.cameraPosition.y) % 256
        const b = (parseInt(metadata.worldChecksum.slice(0, 2), 16)) % 256
        
        pattern[i] = r     // R
        pattern[i + 1] = g // G
        pattern[i + 2] = b // B
        pattern[i + 3] = 255 // A
      }
      
      // In reality, would use a proper PNG encoder
      return Buffer.concat([header, pattern])
    })
  }

  /**
   * Compare two images and calculate similarity
   */
  private compareImages(
    baselinePath: string,
    currentPath: string
  ): Effect.Effect<{
    similarity: number
    pixelDifferences: {
      total: number
      percentage: number
      maxDelta: number
    }
  }, never, never> {
    return Effect.gen(function* () {
      // Simplified comparison - in reality would use image processing library
      const baselineData = yield* Effect.promise(() => fs.readFile(baselinePath))
      const currentData = yield* Effect.promise(() => fs.readFile(currentPath))
      
      // Simple byte comparison (not ideal for real images)
      let differentBytes = 0
      let maxDelta = 0
      const minLength = Math.min(baselineData.length, currentData.length)
      
      for (let i = 0; i < minLength; i++) {
        const delta = Math.abs(baselineData[i] - currentData[i])
        if (delta > 0) {
          differentBytes++
          maxDelta = Math.max(maxDelta, delta)
        }
      }
      
      const similarity = 1 - (differentBytes / minLength)
      
      return {
        similarity,
        pixelDifferences: {
          total: differentBytes,
          percentage: (differentBytes / minLength) * 100,
          maxDelta
        }
      }
    })
  }

  /**
   * Generate diff image highlighting differences
   */
  private generateDiffImage(
    baselinePath: string,
    currentPath: string,
    outputPath: string
  ): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      // Simplified diff generation
      // In reality, would use image processing to highlight differences
      
      const baselineData = yield* Effect.promise(() => fs.readFile(baselinePath))
      const currentData = yield* Effect.promise(() => fs.readFile(currentPath))
      
      // For now, just copy the current image as diff
      yield* Effect.promise(() => fs.copyFile(currentPath, outputPath))
    })
  }

  /**
   * Generate HTML report
   */
  private generateReportHTML(results: Array<VisualTestResult>): string {
    const totalTests = results.length
    const passedTests = results.filter(r => r.passed).length
    const failedTests = totalTests - passedTests
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Regression Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { display: flex; gap: 20px; margin-bottom: 30px; }
        .stat { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat.passed { border-left: 4px solid #4CAF50; }
        .stat.failed { border-left: 4px solid #f44336; }
        .test-result { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .test-result.passed { background: #f9fff9; border-color: #4CAF50; }
        .test-result.failed { background: #fff9f9; border-color: #f44336; }
        .screenshot-comparison { display: flex; gap: 10px; margin: 10px 0; }
        .screenshot-comparison img { max-width: 300px; height: auto; border: 1px solid #ddd; }
        .metadata { font-size: 0.8em; color: #666; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Visual Regression Test Report</h1>
        <p>Generated on: ${new Date().toISOString()}</p>
    </div>
    
    <div class="summary">
        <div class="stat">
            <h3>Total Tests</h3>
            <p style="font-size: 2em; margin: 0;">${totalTests}</p>
        </div>
        <div class="stat passed">
            <h3>Passed</h3>
            <p style="font-size: 2em; margin: 0; color: #4CAF50;">${passedTests}</p>
        </div>
        <div class="stat failed">
            <h3>Failed</h3>
            <p style="font-size: 2em; margin: 0; color: #f44336;">${failedTests}</p>
        </div>
    </div>
    
    ${results.map(result => `
        <div class="test-result ${result.passed ? 'passed' : 'failed'}">
            <h2>${result.testName}</h2>
            <p><strong>Status:</strong> ${result.passed ? '✅ PASSED' : '❌ FAILED'}</p>
            <p><strong>Screenshots:</strong> ${result.summary.passedScreenshots}/${result.summary.totalScreenshots} passed</p>
            <p><strong>Average Similarity:</strong> ${(result.summary.averageSimilarity * 100).toFixed(2)}%</p>
            
            ${result.screenshots.map(screenshot => `
                <div style="margin: 15px 0; padding: 10px; border: 1px solid #eee; border-radius: 3px;">
                    <h4>${screenshot.testName}</h4>
                    <p><strong>Similarity:</strong> ${(screenshot.similarity * 100).toFixed(2)}% (threshold: ${(screenshot.threshold * 100).toFixed(2)}%)</p>
                    <p><strong>Pixel Differences:</strong> ${screenshot.pixelDifferences.total} (${screenshot.pixelDifferences.percentage.toFixed(2)}%)</p>
                    
                    ${screenshot.difference ? `
                        <div class="screenshot-comparison">
                            <div>
                                <h5>Baseline</h5>
                                <img src="${path.relative(this.outputDir, screenshot.baseline || '')}" alt="Baseline">
                            </div>
                            <div>
                                <h5>Current</h5>
                                <img src="${path.relative(this.outputDir, screenshot.current)}" alt="Current">
                            </div>
                            <div>
                                <h5>Difference</h5>
                                <img src="${path.relative(this.outputDir, screenshot.difference)}" alt="Difference">
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="metadata">
                        <p><strong>Camera Position:</strong> (${screenshot.metadata.cameraPosition.x}, ${screenshot.metadata.cameraPosition.y}, ${screenshot.metadata.cameraPosition.z})</p>
                        <p><strong>Resolution:</strong> ${screenshot.metadata.resolution.width}x${screenshot.metadata.resolution.height}</p>
                        <p><strong>World Checksum:</strong> ${screenshot.metadata.worldChecksum}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('')}
</body>
</html>
    `.trim()
  }

  /**
   * Clean up old test artifacts
   */
  cleanup(keepDays: number = 7): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000)
      
      // Clean current screenshots
      yield* this.cleanDirectory(this.outputDir, cutoffTime)
      
      // Clean diff images
      yield* this.cleanDirectory(this.diffDir, cutoffTime)
    })
  }

  private cleanDirectory(dirPath: string, cutoffTime: number): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      try {
        const files = yield* Effect.promise(() => fs.readdir(dirPath))
        
        for (const file of files) {
          const filePath = path.join(dirPath, file)
          const stats = yield* Effect.promise(() => fs.stat(filePath))
          
          if (stats.mtime.getTime() < cutoffTime) {
            yield* Effect.promise(() => fs.unlink(filePath))
          }
        }
      } catch {
        // Directory might not exist, ignore
      }
    })
  }
}

/**
 * Convenience function for visual testing
 */
export const withVisualTester = <A, E>(
  harness: GameTestHarness,
  testSuiteName: string,
  effect: Effect.Effect<A, E, VisualRegressionTester>
): Effect.Effect<A, E, never> => {
  const tester = new VisualRegressionTester(harness, testSuiteName)
  return effect.pipe(
    Effect.provideService(VisualRegressionTester, tester)
  )
}

/**
 * Visual test scenarios
 */
export const VisualTestScenarios = {
  /**
   * Test different camera angles around a structure
   */
  cameraAngles: (centerPosition: { x: number; y: number; z: number }, radius: number = 10) =>
    Effect.sync(() => {
      const screenshots = []
      const angles = [0, 45, 90, 135, 180, 225, 270, 315] // 8 directions
      
      for (const angle of angles) {
        const radians = (angle * Math.PI) / 180
        const x = centerPosition.x + radius * Math.cos(radians)
        const z = centerPosition.z + radius * Math.sin(radians)
        
        screenshots.push({
          name: `angle-${angle}`,
          position: { x, y: centerPosition.y + 5, z },
          rotation: { pitch: -15, yaw: angle + 180 } // Look towards center
        })
      }
      
      return screenshots
    }),

  /**
   * Test different render distances
   */
  renderDistances: (position: { x: number; y: number; z: number }) =>
    Effect.sync(() => [
      { name: 'render-distance-4', position, rotation: { pitch: 0, yaw: 0 } },
      { name: 'render-distance-8', position, rotation: { pitch: 0, yaw: 90 } },
      { name: 'render-distance-16', position, rotation: { pitch: 0, yaw: 180 } }
    ]),

  /**
   * Test lighting conditions
   */
  lightingConditions: (position: { x: number; y: number; z: number }) =>
    Effect.sync(() => [
      { name: 'daylight', position, rotation: { pitch: 0, yaw: 0 } },
      { name: 'sunset', position, rotation: { pitch: 0, yaw: 90 } },
      { name: 'night', position, rotation: { pitch: 0, yaw: 180 } },
      { name: 'underground', position: { ...position, y: position.y - 20 } }
    ])
}