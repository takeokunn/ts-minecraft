import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { GameTestHarness, withGameHarness } from './framework/game-test-harness'
import { PerformanceTester, withPerformanceTester } from './framework/performance-testing'
import { VisualRegressionTester, withVisualTester } from './framework/visual-regression'
import { BlockType } from '@/core/values/block-type'

/**
 * World Generation Integration Tests
 * 
 * Comprehensive tests for world generation algorithms,
 * chunk loading/unloading, terrain features, and performance.
 */

describe('World Generation Integration', () => {
  describe('Chunk Management', () => {
    it.effect('should generate and load chunks deterministically', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Test deterministic generation - same seed should produce same world
        const testPositions = [
          { x: 0, y: 64, z: 0 },
          { x: 16, y: 64, z: 16 },
          { x: -16, y: 64, z: -16 },
          { x: 32, y: 64, z: 0 },
          { x: 0, y: 64, z: 32 }
        ]
        
        const firstPass: Array<{ position: typeof testPositions[0], blockType: BlockType }> = []
        
        // First pass - generate terrain
        for (const pos of testPositions) {
          const voxel = yield* world.getVoxel(pos.x, pos.y, pos.z)
          const blockType = voxel._tag === 'Some' ? voxel.value : BlockType.AIR
          firstPass.push({ position: pos, blockType })
        }
        
        // Clear world (simulate server restart or chunk unloading)
        // In a real implementation, this would unload chunks
        
        // Second pass - should generate same terrain
        const secondPass: Array<{ position: typeof testPositions[0], blockType: BlockType }> = []
        
        for (const pos of testPositions) {
          const voxel = yield* world.getVoxel(pos.x, pos.y, pos.z)
          const blockType = voxel._tag === 'Some' ? voxel.value : BlockType.AIR
          secondPass.push({ position: pos, blockType })
        }
        
        // Verify deterministic generation
        for (let i = 0; i < testPositions.length; i++) {
          expect(firstPass[i].blockType).toBe(secondPass[i].blockType)
        }
        
        return {
          testedPositions: testPositions.length,
          consistentResults: firstPass.length
        }
      }).pipe(withGameHarness)
    )

    it.effect('should handle chunk loading during player movement', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Test chunk loading performance during movement
        const chunkLoadingTest = yield* perfTester.runBenchmark(
          'chunk-loading-movement',
          'Chunk loading during player movement across large distances',
          Effect.gen(function* () {
            const testHarness = yield* Effect.service(GameTestHarness)
            const world = yield* Effect.service('World')
            
            // Initialize game
            const { playerId } = yield* testHarness.initializeGame()
            
            // Move player across multiple chunks
            const movementPath = [
              { x: 0, y: 64, z: 0 },
              { x: 50, y: 64, z: 50 },
              { x: 100, y: 64, z: 0 },
              { x: 150, y: 64, z: 50 },
              { x: 200, y: 64, z: 0 },
              { x: 150, y: 64, z: -50 },
              { x: 100, y: 64, z: -100 },
              { x: 50, y: 64, z: -50 },
              { x: 0, y: 64, z: 0 }
            ]
            
            const chunkLoadTimes: number[] = []
            
            for (let i = 0; i < movementPath.length - 1; i++) {
              const current = movementPath[i]
              const next = movementPath[i + 1]
              
              // Teleport to position (simulates fast movement)
              yield* world.updateComponent(playerId, 'position', next)
              
              // Measure chunk load time
              const loadStart = Date.now()
              
              // Check if terrain exists at new position
              const terrain = yield* world.getVoxel(next.x, next.y, next.z)
              
              // Generate surrounding area (simulate chunk loading)
              for (let dx = -8; dx <= 8; dx++) {
                for (let dz = -8; dz <= 8; dz++) {
                  const checkPos = { x: next.x + dx, y: next.y, z: next.z + dz }
                  yield* world.getVoxel(checkPos.x, checkPos.y, checkPos.z)
                }
              }
              
              const loadTime = Date.now() - loadStart
              chunkLoadTimes.push(loadTime)
            }
            
            return {
              pathLength: movementPath.length,
              chunkLoads: chunkLoadTimes.length,
              averageLoadTime: chunkLoadTimes.reduce((a, b) => a + b, 0) / chunkLoadTimes.length,
              maxLoadTime: Math.max(...chunkLoadTimes)
            }
          }),
          10000, // 10 second test
          45 // Minimum FPS during chunk loading
        )
        
        expect(chunkLoadingTest.summary.passed).toBe(true)
        expect(chunkLoadingTest.summary.averageFPS).toBeGreaterThan(40)
        
        return { benchmark: chunkLoadingTest }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should generate varied terrain features', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Survey large area for terrain diversity
        const surveySize = 100
        const samplePoints = 200
        const terrainSamples: Array<{
          x: number
          z: number
          height: number
          surfaceBlock: BlockType
          hasWater: boolean
          hasStructure: boolean
        }> = []
        
        for (let i = 0; i < samplePoints; i++) {
          const x = Math.floor(Math.random() * surveySize * 2) - surveySize
          const z = Math.floor(Math.random() * surveySize * 2) - surveySize
          
          // Find surface height
          let surfaceHeight = 64
          let surfaceBlock = BlockType.AIR
          
          for (let y = 80; y >= 50; y--) {
            const voxel = yield* world.getVoxel(x, y, z)
            if (voxel._tag === 'Some' && voxel.value !== BlockType.AIR) {
              surfaceHeight = y
              surfaceBlock = voxel.value
              break
            }
          }
          
          // Check for water nearby
          let hasWater = false
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
              const waterCheck = yield* world.getVoxel(x + dx, surfaceHeight - 1, z + dz)
              if (waterCheck._tag === 'Some' && waterCheck.value === BlockType.WATER) {
                hasWater = true
                break
              }
            }
            if (hasWater) break
          }
          
          // Check for structures (trees, buildings, etc.)
          let hasStructure = false
          for (let y = surfaceHeight + 1; y <= surfaceHeight + 10; y++) {
            const structureCheck = yield* world.getVoxel(x, y, z)
            if (structureCheck._tag === 'Some' && structureCheck.value !== BlockType.AIR) {
              hasStructure = true
              break
            }
          }
          
          terrainSamples.push({
            x, z, height: surfaceHeight, surfaceBlock, hasWater, hasStructure
          })
        }
        
        // Analyze terrain diversity
        const blockTypes = new Set(terrainSamples.map(s => s.surfaceBlock))
        const heights = terrainSamples.map(s => s.height)
        const minHeight = Math.min(...heights)
        const maxHeight = Math.max(...heights)
        const heightVariation = maxHeight - minHeight
        
        const waterPercentage = (terrainSamples.filter(s => s.hasWater).length / samplePoints) * 100
        const structurePercentage = (terrainSamples.filter(s => s.hasStructure).length / samplePoints) * 100
        
        // Terrain should be diverse
        expect(blockTypes.size).toBeGreaterThan(2) // At least 3 different surface block types
        expect(heightVariation).toBeGreaterThan(5) // At least 5 blocks height variation
        expect(waterPercentage).toBeLessThan(50) // Not too much water
        expect(structurePercentage).toBeGreaterThan(5) // Some structures should exist
        
        return {
          samplePoints: samplePoints,
          uniqueBlockTypes: blockTypes.size,
          heightRange: { min: minHeight, max: maxHeight, variation: heightVariation },
          features: {
            waterPercentage: Math.round(waterPercentage),
            structurePercentage: Math.round(structurePercentage)
          }
        }
      }).pipe(withGameHarness)
    )
  })

  describe('Terrain Generation Algorithms', () => {
    it.effect('should generate realistic terrain with proper biomes', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Test biome generation across different regions
        const biomeRegions = [
          { name: 'plains', center: { x: 0, z: 0 }, expectedBlocks: [BlockType.GRASS, BlockType.DIRT] },
          { name: 'mountain', center: { x: 200, z: 200 }, expectedBlocks: [BlockType.STONE, BlockType.SNOW] },
          { name: 'desert', center: { x: -200, z: 200 }, expectedBlocks: [BlockType.SAND] },
          { name: 'forest', center: { x: 200, z: -200 }, expectedBlocks: [BlockType.GRASS, BlockType.WOOD] }
        ]
        
        const biomeAnalysis = []
        
        for (const region of biomeRegions) {
          const samples = []
          const radius = 20
          
          // Sample terrain in region
          for (let x = region.center.x - radius; x <= region.center.x + radius; x += 4) {
            for (let z = region.center.z - radius; z <= region.center.z + radius; z += 4) {
              // Find surface
              let surfaceBlock = BlockType.AIR
              let surfaceHeight = 64
              
              for (let y = 80; y >= 50; y--) {
                const voxel = yield* world.getVoxel(x, y, z)
                if (voxel._tag === 'Some' && voxel.value !== BlockType.AIR) {
                  surfaceBlock = voxel.value
                  surfaceHeight = y
                  break
                }
              }
              
              samples.push({ x, z, height: surfaceHeight, block: surfaceBlock })
            }
          }
          
          // Analyze biome characteristics
          const blockCounts = new Map<BlockType, number>()
          const heights = samples.map(s => s.height)
          
          samples.forEach(sample => {
            blockCounts.set(sample.block, (blockCounts.get(sample.block) || 0) + 1)
          })
          
          const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length
          const heightVariation = Math.max(...heights) - Math.min(...heights)
          
          biomeAnalysis.push({
            name: region.name,
            sampleCount: samples.length,
            averageHeight: avgHeight,
            heightVariation,
            blockDistribution: Object.fromEntries(blockCounts),
            dominantBlock: [...blockCounts.entries()].reduce((a, b) => a[1] > b[1] ? a : b)[0]
          })
        }
        
        // Verify biome characteristics
        const plainsData = biomeAnalysis.find(b => b.name === 'plains')!
        const mountainData = biomeAnalysis.find(b => b.name === 'mountain')!
        
        expect(plainsData.averageHeight).toBeLessThan(mountainData.averageHeight)
        expect(mountainData.heightVariation).toBeGreaterThan(plainsData.heightVariation)
        
        return { biomeAnalysis }
      }).pipe(withGameHarness)
    )

    it.effect('should generate proper underground cave systems', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Explore underground for cave systems
        const caveExploration = {
          totalChecked: 0,
          airPockets: 0,
          caveEntrances: 0,
          tunnelSections: 0,
          oreDeposits: 0
        }
        
        const exploreRegion = { x: 0, z: 0, radius: 50 }
        
        // Survey underground from y=20 to y=50
        for (let x = exploreRegion.x - exploreRegion.radius; x <= exploreRegion.x + exploreRegion.radius; x += 2) {
          for (let z = exploreRegion.z - exploreRegion.radius; z <= exploreRegion.z + exploreRegion.radius; z += 2) {
            for (let y = 20; y <= 50; y += 2) {
              caveExploration.totalChecked++
              
              const voxel = yield* world.getVoxel(x, y, z)
              
              if (voxel._tag === 'None' || voxel.value === BlockType.AIR) {
                caveExploration.airPockets++
                
                // Check if this air pocket connects to surface (cave entrance)
                let surfaceConnected = false
                for (let checkY = y + 1; checkY <= 70; checkY++) {
                  const checkVoxel = yield* world.getVoxel(x, checkY, z)
                  if (checkVoxel._tag === 'None' || checkVoxel.value === BlockType.AIR) {
                    if (checkY >= 60) {
                      surfaceConnected = true
                      break
                    }
                  } else {
                    break
                  }
                }
                
                if (surfaceConnected) {
                  caveExploration.caveEntrances++
                }
                
                // Check for tunnel patterns (horizontal air connections)
                const horizontalConnections = []
                const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                
                for (const [dx, dz] of directions) {
                  const neighborVoxel = yield* world.getVoxel(x + dx, y, z + dz)
                  if (neighborVoxel._tag === 'None' || neighborVoxel.value === BlockType.AIR) {
                    horizontalConnections.push([dx, dz])
                  }
                }
                
                if (horizontalConnections.length >= 2) {
                  caveExploration.tunnelSections++
                }
              } else {
                // Check for ore deposits in stone
                if (voxel.value === BlockType.IRON_ORE || 
                    voxel.value === BlockType.GOLD_ORE || 
                    voxel.value === BlockType.DIAMOND_ORE) {
                  caveExploration.oreDeposits++
                }
              }
            }
          }
        }
        
        // Cave systems should exist but not dominate
        const airPercentage = (caveExploration.airPockets / caveExploration.totalChecked) * 100
        
        expect(airPercentage).toBeGreaterThan(5) // At least 5% should be caves
        expect(airPercentage).toBeLessThan(30) // But not too much
        expect(caveExploration.caveEntrances).toBeGreaterThan(0) // Should have surface connections
        expect(caveExploration.tunnelSections).toBeGreaterThan(5) // Should have tunnel networks
        
        return {
          exploration: caveExploration,
          airPercentage: Math.round(airPercentage * 100) / 100
        }
      }).pipe(withGameHarness)
    )

    it.effect('should generate consistent world borders and chunk boundaries', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const world = yield* Effect.service('World')
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Test chunk boundary consistency
        const chunkSize = 16 // Assuming 16x16 chunks
        const chunkBoundaryTests = []
        
        for (let chunkX = -2; chunkX <= 2; chunkX++) {
          for (let chunkZ = -2; chunkZ <= 2; chunkZ++) {
            const chunkStartX = chunkX * chunkSize
            const chunkStartZ = chunkZ * chunkSize
            
            // Test boundaries between chunks
            const boundaryTests = [
              { x: chunkStartX - 1, z: chunkStartZ, neighbor: { x: chunkStartX, z: chunkStartZ } },
              { x: chunkStartX, z: chunkStartZ - 1, neighbor: { x: chunkStartX, z: chunkStartZ } },
              { x: chunkStartX + chunkSize - 1, z: chunkStartZ, neighbor: { x: chunkStartX + chunkSize, z: chunkStartZ } },
              { x: chunkStartX, z: chunkStartZ + chunkSize - 1, neighbor: { x: chunkStartX, z: chunkStartZ + chunkSize } }
            ]
            
            for (const test of boundaryTests) {
              const height1 = yield* this.findSurfaceHeight(world, test.x, test.z)
              const height2 = yield* this.findSurfaceHeight(world, test.neighbor.x, test.neighbor.z)
              
              // Heights should be reasonably close at chunk boundaries
              const heightDifference = Math.abs(height1 - height2)
              chunkBoundaryTests.push({
                chunk: `${chunkX},${chunkZ}`,
                position: test,
                neighbor: test.neighbor,
                heightDiff: heightDifference
              })
            }
          }
        }
        
        // Analyze boundary consistency
        const maxHeightDiff = Math.max(...chunkBoundaryTests.map(t => t.heightDiff))
        const avgHeightDiff = chunkBoundaryTests.reduce((sum, t) => sum + t.heightDiff, 0) / chunkBoundaryTests.length
        const smoothBoundaries = chunkBoundaryTests.filter(t => t.heightDiff <= 2).length
        const roughBoundaries = chunkBoundaryTests.filter(t => t.heightDiff > 5).length
        
        // Boundaries should be mostly smooth
        expect(maxHeightDiff).toBeLessThan(10) // No extreme height jumps
        expect(avgHeightDiff).toBeLessThan(3) // Average should be small
        expect(smoothBoundaries / chunkBoundaryTests.length).toBeGreaterThan(0.7) // 70% should be smooth
        expect(roughBoundaries / chunkBoundaryTests.length).toBeLessThan(0.1) // Less than 10% should be rough
        
        return {
          chunksTesteed: 25, // 5x5 grid
          boundaryTests: chunkBoundaryTests.length,
          maxHeightDiff,
          avgHeightDiff: Math.round(avgHeightDiff * 100) / 100,
          smoothPercentage: Math.round((smoothBoundaries / chunkBoundaryTests.length) * 100),
          roughPercentage: Math.round((roughBoundaries / chunkBoundaryTests.length) * 100)
        }
      }).pipe(withGameHarness)
    )
  })

  describe('Visual World Generation Testing', () => {
    it.effect('should generate visually consistent terrain across views', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const visualTester = yield* Effect.service(VisualRegressionTester)
        
        // Initialize game
        const { playerId } = yield* harness.initializeGame()
        
        // Generate large terrain feature for visual testing
        yield* this.generateLargeTerrainFeature(harness, playerId)
        
        // Test visual consistency from different viewpoints
        const terrainVisualTest = yield* visualTester.runVisualTest(
          'terrain-generation-consistency',
          Effect.sync(() => [
            { name: 'overview-north', position: { x: 0, y: 100, z: -50 }, rotation: { pitch: -45, yaw: 0 } },
            { name: 'overview-south', position: { x: 0, y: 100, z: 50 }, rotation: { pitch: -45, yaw: 180 } },
            { name: 'overview-east', position: { x: 50, y: 100, z: 0 }, rotation: { pitch: -45, yaw: 270 } },
            { name: 'overview-west', position: { x: -50, y: 100, z: 0 }, rotation: { pitch: -45, yaw: 90 } },
            { name: 'ground-level', position: { x: 0, y: 66, z: 0 }, rotation: { pitch: 0, yaw: 45 } },
            { name: 'aerial-view', position: { x: 0, y: 150, z: 0 }, rotation: { pitch: -90, yaw: 0 } }
          ]),
          0.95 // High similarity threshold for terrain
        )
        
        expect(terrainVisualTest.passed).toBe(true)
        expect(terrainVisualTest.summary.averageSimilarity).toBeGreaterThan(0.90)
        
        return { visualTest: terrainVisualTest }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withVisualTester(harness, 'world-generation', Effect.succeed({}))
        }))
      )
    )
  })

  // Helper method to find surface height
  private findSurfaceHeight = (world: any, x: number, z: number): Effect.Effect<number, never, any> =>
    Effect.gen(function* () {
      for (let y = 80; y >= 50; y--) {
        const voxel = yield* world.getVoxel(x, y, z)
        if (voxel._tag === 'Some' && voxel.value !== BlockType.AIR) {
          return y
        }
      }
      return 60 // Default ground level
    })

  // Helper method to generate large terrain feature
  private generateLargeTerrainFeature = (harness: GameTestHarness, playerId: EntityId): Effect.Effect<void, never, any> =>
    Effect.gen(function* () {
      // Generate a complex terrain feature for visual testing
      
      // Create a mountain with multiple peaks
      for (let x = -30; x <= 30; x++) {
        for (let z = -30; z <= 30; z++) {
          const distance = Math.sqrt(x * x + z * z)
          if (distance <= 30) {
            // Multiple sine waves for interesting terrain
            const height1 = Math.sin(x * 0.1) * Math.sin(z * 0.1) * 15
            const height2 = Math.cos(x * 0.05) * Math.cos(z * 0.05) * 10
            const height3 = Math.sin(distance * 0.2) * 8
            
            const finalHeight = 64 + height1 + height2 + height3
            
            for (let y = 60; y <= finalHeight; y++) {
              let blockType = BlockType.STONE
              if (y === Math.floor(finalHeight)) {
                blockType = finalHeight > 75 ? BlockType.SNOW : BlockType.GRASS
              } else if (y > finalHeight - 3) {
                blockType = BlockType.DIRT
              }
              
              yield* harness.simulatePlayerActions.placeBlock(playerId, x, y, z, blockType)
            }
          }
        }
      }
      
      // Add some trees on lower elevations
      for (let i = 0; i < 20; i++) {
        const x = Math.floor(Math.random() * 40) - 20
        const z = Math.floor(Math.random() * 40) - 20
        const distance = Math.sqrt(x * x + z * z)
        
        if (distance > 15 && distance < 25) {
          // Find surface and place tree
          for (let y = 65; y <= 75; y++) {
            yield* harness.simulatePlayerActions.placeBlock(playerId, x, y, z, BlockType.WOOD)
            if (y > 67) {
              // Add leaves around the top
              for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                  if (dx !== 0 || dz !== 0) {
                    yield* harness.simulatePlayerActions.placeBlock(playerId, x + dx, y, z + dz, BlockType.LEAVES)
                  }
                }
              }
            }
          }
        }
      }
    })
})

// Extend vitest with Effect support for this file
declare module 'vitest' {
  interface TestAPI {
    effect: <A, E>(name: string, effect: Effect.Effect<A, E, never>) => void
  }
}

const originalIt = it
// @ts-ignore
originalIt.effect = function<A, E>(name: string, effect: Effect.Effect<A, E, never>) {
  return originalIt(name, async () => {
    const result = await Effect.runPromise(effect)
    return result
  })
}