import { describe, it, expect } from 'vitest'
import { Effect, Duration } from 'effect'
import { GameTestHarness, withGameHarness } from './framework/game-test-harness'
import { PerformanceTester, withPerformanceTester } from './framework/performance-testing'
import { BlockType } from '@/core/values/block-type'
import { EntityId } from '@/core/entities/entity'

/**
 * Performance Benchmarks Integration Tests
 * 
 * Realistic performance testing scenarios that simulate
 * actual gameplay conditions and stress the system
 * under various load patterns.
 */

describe('Performance Benchmarks Integration', () => {
  describe('Realistic Gameplay Scenarios', () => {
    it.effect('should maintain performance during active world exploration', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Simulate active world exploration with typical player behavior
        const explorationBenchmark = yield* perfTester.runBenchmark(
          'realistic-world-exploration',
          'Player exploring world with terrain generation, entities, and interactions',
          Effect.gen(function* () {
            const testHarness = yield* Effect.service(GameTestHarness)
            
            // Initialize game with realistic starting conditions
            const { playerId } = yield* testHarness.initializeGame()
            
            // Spawn ambient entities (animals, NPCs)
            const ambientEntities = yield* testHarness.chaos.spawnEntities(200)
            
            // Create varied terrain with structures
            yield* this.generateRealisticTerrain(testHarness, playerId)
            
            // Simulate exploration patterns
            const explorationRoutes = [
              { type: 'walking', distance: 500, speed: 4.3 },
              { type: 'running', distance: 300, speed: 8.6 },
              { type: 'climbing', distance: 100, speed: 2.0 },
              { type: 'swimming', distance: 200, speed: 3.0 },
              { type: 'building', actions: 50, speed: 2.0 }
            ]
            
            for (const route of explorationRoutes) {
              switch (route.type) {
                case 'walking':
                case 'running':
                  const movementTime = (route.distance / route.speed) * 1000
                  yield* testHarness.simulatePlayerActions.move(
                    playerId, 
                    ['forward', 'right', 'backward', 'left'][Math.floor(Math.random() * 4)] as any,
                    movementTime
                  )
                  break
                  
                case 'climbing':
                  for (let i = 0; i < 10; i++) {
                    yield* testHarness.simulatePlayerActions.jump(playerId)
                    yield* testHarness.simulatePlayerActions.move(playerId, 'forward', 200)
                  }
                  break
                  
                case 'swimming':
                  yield* testHarness.simulatePlayerActions.move(playerId, 'forward', 6000)
                  break
                  
                case 'building':
                  for (let i = 0; i < route.actions!; i++) {
                    const x = Math.floor(Math.random() * 20) - 10
                    const y = 65 + Math.floor(Math.random() * 5)
                    const z = Math.floor(Math.random() * 20) - 10
                    yield* testHarness.simulatePlayerActions.placeBlock(
                      playerId, x, y, z, BlockType.STONE
                    )
                  }
                  break
              }
              
              // Simulate realistic pauses
              yield* Effect.sleep(Duration.millis(100 + Math.random() * 500))
            }
            
            return { explorationRoutes: explorationRoutes.length, entitiesActive: ambientEntities.length }
          }),
          60000, // 1 minute exploration
          55 // Target 55 FPS (realistic for gameplay)
        )
        
        expect(explorationBenchmark.summary.passed).toBe(true)
        expect(explorationBenchmark.summary.averageFPS).toBeGreaterThan(50)
        expect(explorationBenchmark.summary.fpsStability).toBeGreaterThan(0.8)
        
        return { benchmark: explorationBenchmark }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should handle large-scale building projects efficiently', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Simulate large construction project (city building)
        const constructionBenchmark = yield* perfTester.runBenchmark(
          'large-scale-construction',
          'Building large structures with thousands of blocks',
          Effect.gen(function* () {
            const testHarness = yield* Effect.service(GameTestHarness)
            
            // Initialize game
            const { playerId } = yield* testHarness.initializeGame()
            
            // Build a large city with various structures
            const cityBlueprints = [
              { name: 'residential_district', blocks: this.generateResidentialDistrict() },
              { name: 'commercial_center', blocks: this.generateCommercialCenter() },
              { name: 'industrial_zone', blocks: this.generateIndustrialZone() },
              { name: 'transportation_network', blocks: this.generateTransportationNetwork() },
              { name: 'public_buildings', blocks: this.generatePublicBuildings() }
            ]
            
            let totalBlocksPlaced = 0
            
            for (const blueprint of cityBlueprints) {
              const districtStart = Date.now()
              
              for (const block of blueprint.blocks) {
                yield* testHarness.simulatePlayerActions.placeBlock(
                  playerId, block.x, block.y, block.z, block.type
                )
                totalBlocksPlaced++
                
                // Simulate realistic building pace with occasional breaks
                if (totalBlocksPlaced % 50 === 0) {
                  yield* Effect.sleep(Duration.millis(50))
                }
              }
              
              const districtTime = Date.now() - districtStart
              console.log(`Built ${blueprint.name}: ${blueprint.blocks.length} blocks in ${districtTime}ms`)
            }
            
            return { 
              totalBlocks: totalBlocksPlaced,
              districts: cityBlueprints.length,
              averageBlocksPerDistrict: totalBlocksPlaced / cityBlueprints.length
            }
          }),
          120000, // 2 minutes for large construction
          45 // Lower FPS target for heavy building
        )
        
        expect(constructionBenchmark.summary.passed).toBe(true)
        expect(constructionBenchmark.summary.averageFPS).toBeGreaterThan(40)
        
        return { benchmark: constructionBenchmark }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should maintain performance during intensive resource gathering', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Simulate intensive mining and resource gathering
        const resourceGatheringBenchmark = yield* perfTester.runBenchmark(
          'intensive-resource-gathering',
          'Mining operations with terrain destruction and item collection',
          Effect.gen(function* () {
            const testHarness = yield* Effect.service(GameTestHarness)
            
            // Initialize game
            const { playerId } = yield* testHarness.initializeGame()
            
            // Create underground mine system
            yield* this.generateUndergroundMines(testHarness, playerId)
            
            // Simulate intensive mining operations
            const miningOperations = [
              { type: 'strip_mining', area: { width: 50, depth: 20, height: 5 } },
              { type: 'shaft_mining', shafts: 10, depth: 30 },
              { type: 'quarry_operation', size: { width: 30, length: 30, depth: 15 } },
              { type: 'tunnel_network', tunnels: 20, length: 100 }
            ]
            
            let blocksDestroyed = 0
            let resourcesGathered = 0
            
            for (const operation of miningOperations) {
              switch (operation.type) {
                case 'strip_mining':
                  for (let x = 0; x < operation.area.width; x++) {
                    for (let z = 0; z < operation.area.width; z++) {
                      for (let y = 0; y < operation.area.height; y++) {
                        yield* testHarness.simulatePlayerActions.destroyBlock(
                          x + 100, 60 - y, z + 100
                        )
                        blocksDestroyed++
                        
                        // Simulate finding resources
                        if (Math.random() < 0.1) {
                          resourcesGathered++
                        }
                      }
                    }
                  }
                  break
                  
                case 'shaft_mining':
                  for (let shaft = 0; shaft < operation.shafts; shaft++) {
                    for (let depth = 0; depth < operation.depth; depth++) {
                      const x = 120 + shaft * 5
                      yield* testHarness.simulatePlayerActions.destroyBlock(x, 60 - depth, 120)
                      blocksDestroyed++
                      
                      // Side tunnels
                      if (depth % 5 === 0) {
                        for (let side = 1; side <= 3; side++) {
                          yield* testHarness.simulatePlayerActions.destroyBlock(x + side, 60 - depth, 120)
                          yield* testHarness.simulatePlayerActions.destroyBlock(x - side, 60 - depth, 120)
                          blocksDestroyed += 2
                        }
                      }
                    }
                  }
                  break
                  
                case 'quarry_operation':
                  for (let x = 0; x < operation.size.width; x++) {
                    for (let z = 0; z < operation.size.length; z++) {
                      for (let y = 0; y < operation.size.depth; y++) {
                        yield* testHarness.simulatePlayerActions.destroyBlock(
                          x + 150, 60 - y, z + 150
                        )
                        blocksDestroyed++
                      }
                    }
                  }
                  break
                  
                case 'tunnel_network':
                  for (let tunnel = 0; tunnel < operation.tunnels; tunnel++) {
                    const angle = (tunnel / operation.tunnels) * Math.PI * 2
                    for (let dist = 0; dist < operation.length; dist++) {
                      const x = 200 + Math.cos(angle) * dist
                      const z = 200 + Math.sin(angle) * dist
                      yield* testHarness.simulatePlayerActions.destroyBlock(
                        Math.floor(x), 55, Math.floor(z)
                      )
                      blocksDestroyed++
                    }
                  }
                  break
              }
              
              // Simulate processing time
              yield* Effect.sleep(Duration.millis(100))
            }
            
            return { 
              blocksDestroyed,
              resourcesGathered,
              miningOperations: miningOperations.length,
              efficiency: resourcesGathered / blocksDestroyed
            }
          }),
          90000, // 1.5 minutes of intensive mining
          50 // Target 50 FPS during heavy destruction
        )
        
        expect(resourceGatheringBenchmark.summary.passed).toBe(true)
        expect(resourceGatheringBenchmark.summary.averageFPS).toBeGreaterThan(45)
        
        return { benchmark: resourceGatheringBenchmark }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )
  })

  describe('Scalability Benchmarks', () => {
    it.effect('should scale performance with increasing entity density', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Test performance scaling with different entity counts
        const entityScalingTests = [
          { entities: 100, targetFPS: 60, description: 'Light entity load' },
          { entities: 500, targetFPS: 55, description: 'Medium entity load' },
          { entities: 1000, targetFPS: 50, description: 'Heavy entity load' },
          { entities: 2000, targetFPS: 45, description: 'Very heavy entity load' },
          { entities: 5000, targetFPS: 30, description: 'Extreme entity load' }
        ]
        
        const scalingResults = []
        
        for (const test of entityScalingTests) {
          const scalingBenchmark = yield* perfTester.runBenchmark(
            `entity-scaling-${test.entities}`,
            test.description,
            Effect.gen(function* () {
              const testHarness = yield* Effect.service(GameTestHarness)
              
              // Initialize game
              const { playerId } = yield* testHarness.initializeGame()
              
              // Spawn entities with varied behaviors
              const entities = yield* testHarness.chaos.spawnEntities(test.entities)
              
              // Simulate entities with different activity levels
              const activeEntities = entities.slice(0, Math.floor(test.entities * 0.3))
              const passiveEntities = entities.slice(Math.floor(test.entities * 0.3))
              
              // Run simulation with entity interactions
              for (let frame = 0; frame < 300; frame++) { // 5 seconds at 60fps
                // Update active entities
                for (const entityId of activeEntities) {
                  if (frame % 10 === 0) { // Update every 10 frames
                    const world = yield* Effect.service('World')
                    const position = yield* world.getComponentUnsafe(entityId, 'position')
                    
                    // Random movement
                    yield* world.updateComponent(entityId, 'position', {
                      x: position.x + (Math.random() - 0.5) * 2,
                      y: position.y,
                      z: position.z + (Math.random() - 0.5) * 2
                    })
                  }
                }
                
                // Player movement
                if (frame % 60 === 0) {
                  yield* testHarness.simulatePlayerActions.move(
                    playerId, 
                    ['forward', 'right', 'backward', 'left'][Math.floor(Math.random() * 4)] as any,
                    500
                  )
                }
                
                yield* Effect.sleep(Duration.millis(16)) // 60 FPS target
              }
              
              return { 
                entitiesSpawned: test.entities,
                activeEntities: activeEntities.length,
                passiveEntities: passiveEntities.length
              }
            }),
            15000, // 15 seconds per test
            test.targetFPS
          )
          
          scalingResults.push({
            entityCount: test.entities,
            targetFPS: test.targetFPS,
            actualFPS: scalingBenchmark.summary.averageFPS,
            passed: scalingBenchmark.summary.passed,
            fpsStability: scalingBenchmark.summary.fpsStability,
            memoryUsage: scalingBenchmark.summary.peakMemoryUsage
          })
        }
        
        // Verify scaling characteristics
        for (let i = 1; i < scalingResults.length; i++) {
          const current = scalingResults[i]
          const previous = scalingResults[i - 1]
          
          // FPS should degrade gracefully, not collapse
          const fpsRatio = current.actualFPS / previous.actualFPS
          expect(fpsRatio).toBeGreaterThan(0.7) // Should retain at least 70% performance
        }
        
        return { scalingResults }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )

    it.effect('should maintain performance with increasing world complexity', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Test performance with increasingly complex worlds
        const complexityLevels = [
          { name: 'simple', blocks: 1000, structures: 5, targetFPS: 60 },
          { name: 'moderate', blocks: 5000, structures: 20, targetFPS: 55 },
          { name: 'complex', blocks: 15000, structures: 50, targetFPS: 50 },
          { name: 'very_complex', blocks: 30000, structures: 100, targetFPS: 45 },
          { name: 'extreme', blocks: 50000, structures: 200, targetFPS: 35 }
        ]
        
        const complexityResults = []
        
        for (const level of complexityLevels) {
          const complexityBenchmark = yield* perfTester.runBenchmark(
            `world-complexity-${level.name}`,
            `World with ${level.blocks} blocks and ${level.structures} structures`,
            Effect.gen(function* () {
              const testHarness = yield* Effect.service(GameTestHarness)
              
              // Initialize game
              const { playerId } = yield* testHarness.initializeGame()
              
              // Generate world with specified complexity
              yield* this.generateComplexWorld(testHarness, playerId, level.blocks, level.structures)
              
              // Test world traversal performance
              const traversalRoutes = [
                { distance: 200, direction: 'north' },
                { distance: 200, direction: 'east' },
                { distance: 200, direction: 'south' },
                { distance: 200, direction: 'west' }
              ]
              
              for (const route of traversalRoutes) {
                yield* testHarness.simulatePlayerActions.move(
                  playerId,
                  route.direction === 'north' ? 'forward' :
                  route.direction === 'east' ? 'right' :
                  route.direction === 'south' ? 'backward' : 'left',
                  (route.distance / 4.3) * 1000 // Time for distance at walking speed
                )
                
                // Simulate chunk loading time
                yield* Effect.sleep(Duration.millis(100))
              }
              
              return {
                worldBlocks: level.blocks,
                structures: level.structures,
                traversalRoutes: traversalRoutes.length
              }
            }),
            30000, // 30 seconds per complexity level
            level.targetFPS
          )
          
          complexityResults.push({
            complexityLevel: level.name,
            blocks: level.blocks,
            structures: level.structures,
            targetFPS: level.targetFPS,
            actualFPS: complexityBenchmark.summary.averageFPS,
            passed: complexityBenchmark.summary.passed,
            memoryUsage: complexityBenchmark.summary.peakMemoryUsage
          })
        }
        
        return { complexityResults }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )
  })

  describe('Stress Testing Scenarios', () => {
    it.effect('should handle peak server load simulation', () =>
      Effect.gen(function* () {
        const harness = yield* Effect.service(GameTestHarness)
        const perfTester = yield* Effect.service(PerformanceTester)
        
        // Simulate peak server conditions
        const peakLoadBenchmark = yield* perfTester.runBenchmark(
          'peak-server-load',
          'Simulating peak server conditions with multiple concurrent operations',
          Effect.gen(function* () {
            const testHarness = yield* Effect.service(GameTestHarness)
            
            // Initialize game
            const { playerId } = yield* testHarness.initializeGame()
            
            // Simulate multiple concurrent operations
            const concurrentOperations = [
              // Large construction project
              Effect.gen(function* () {
                for (let i = 0; i < 1000; i++) {
                  const x = Math.floor(Math.random() * 100) - 50
                  const y = 64 + Math.floor(Math.random() * 20)
                  const z = Math.floor(Math.random() * 100) - 50
                  yield* testHarness.simulatePlayerActions.placeBlock(playerId, x, y, z, BlockType.STONE)
                }
              }),
              
              // Massive entity spawning
              Effect.gen(function* () {
                for (let batch = 0; batch < 20; batch++) {
                  yield* testHarness.chaos.spawnEntities(100)
                  yield* Effect.sleep(Duration.millis(500))
                }
              }),
              
              // Intensive terrain destruction
              Effect.gen(function* () {
                for (let i = 0; i < 500; i++) {
                  const x = Math.floor(Math.random() * 50) + 100
                  const y = 50 + Math.floor(Math.random() * 20)
                  const z = Math.floor(Math.random() * 50) + 100
                  yield* testHarness.simulatePlayerActions.destroyBlock(x, y, z)
                }
              }),
              
              // Rapid player movement
              Effect.gen(function* () {
                for (let i = 0; i < 100; i++) {
                  const direction = ['forward', 'right', 'backward', 'left'][Math.floor(Math.random() * 4)] as any
                  yield* testHarness.simulatePlayerActions.move(playerId, direction, 200)
                  yield* Effect.sleep(Duration.millis(50))
                }
              })
            ]
            
            // Run all operations concurrently
            yield* Effect.all(concurrentOperations, { concurrency: 'unbounded' })
            
            return {
              concurrentOperations: concurrentOperations.length,
              peakLoadSimulated: true
            }
          }),
          45000, // 45 seconds of peak load
          40 // Lower FPS target for extreme stress
        )
        
        expect(peakLoadBenchmark.summary.passed).toBe(true)
        expect(peakLoadBenchmark.summary.averageFPS).toBeGreaterThan(35)
        
        return { benchmark: peakLoadBenchmark }
      }).pipe(
        withGameHarness,
        Effect.provide(Effect.gen(function* () {
          const harness = yield* Effect.service(GameTestHarness)
          return yield* withPerformanceTester(harness, Effect.succeed({}))
        }))
      )
    )
  })

  // Helper methods for generating realistic test scenarios
  
  private generateRealisticTerrain = (harness: GameTestHarness, playerId: EntityId): Effect.Effect<void, never, any> =>
    Effect.gen(function* () {
      // Generate varied biomes with realistic features
      
      // Forest area
      for (let x = -50; x <= 50; x += 5) {
        for (let z = -50; z <= 50; z += 5) {
          if (Math.random() < 0.3) {
            // Tree
            for (let y = 64; y <= 68; y++) {
              yield* harness.simulatePlayerActions.placeBlock(playerId, x, y, z, BlockType.WOOD)
              if (y >= 66) {
                // Leaves
                for (let dx = -2; dx <= 2; dx++) {
                  for (let dz = -2; dz <= 2; dz++) {
                    if (Math.abs(dx) + Math.abs(dz) <= 2) {
                      yield* harness.simulatePlayerActions.placeBlock(playerId, x + dx, y, z + dz, BlockType.LEAVES)
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Water features
      for (let x = 60; x <= 80; x++) {
        for (let z = 60; z <= 80; z++) {
          yield* harness.simulatePlayerActions.placeBlock(playerId, x, 63, z, BlockType.WATER)
        }
      }
      
      // Mountain range
      for (let x = 100; x <= 150; x++) {
        for (let z = 100; z <= 150; z++) {
          const height = 64 + Math.floor(Math.sin((x - 100) * 0.1) * Math.cos((z - 100) * 0.1) * 20)
          for (let y = 64; y <= height; y++) {
            const blockType = y === height ? (height > 75 ? BlockType.SNOW : BlockType.GRASS) : BlockType.STONE
            yield* harness.simulatePlayerActions.placeBlock(playerId, x, y, z, blockType)
          }
        }
      }
    })

  private generateResidentialDistrict = (): Array<{ x: number, y: number, z: number, type: BlockType }> => {
    const blocks = []
    // Generate 10 houses in a residential layout
    for (let house = 0; house < 10; house++) {
      const houseX = (house % 5) * 15
      const houseZ = Math.floor(house / 5) * 15
      
      // House structure
      for (let x = 0; x < 8; x++) {
        for (let z = 0; z < 8; z++) {
          // Foundation
          blocks.push({ x: houseX + x, y: 64, z: houseZ + z, type: BlockType.STONE })
          
          // Walls
          if (x === 0 || x === 7 || z === 0 || z === 7) {
            blocks.push({ x: houseX + x, y: 65, z: houseZ + z, type: BlockType.WOOD })
            blocks.push({ x: houseX + x, y: 66, z: houseZ + z, type: BlockType.WOOD })
          }
          
          // Roof
          if (x > 0 && x < 7 && z > 0 && z < 7) {
            blocks.push({ x: houseX + x, y: 67, z: houseZ + z, type: BlockType.STONE })
          }
        }
      }
    }
    return blocks
  }

  private generateCommercialCenter = (): Array<{ x: number, y: number, z: number, type: BlockType }> => {
    const blocks = []
    // Generate commercial buildings
    for (let building = 0; building < 5; building++) {
      const buildingX = building * 20
      const buildingZ = 100
      
      // Large commercial building
      for (let x = 0; x < 15; x++) {
        for (let z = 0; z < 15; z++) {
          for (let y = 64; y < 70; y++) {
            if (x === 0 || x === 14 || z === 0 || z === 14 || y === 64 || y === 69) {
              blocks.push({ x: buildingX + x, y, z: buildingZ + z, type: BlockType.STONE })
            }
          }
        }
      }
    }
    return blocks
  }

  private generateIndustrialZone = (): Array<{ x: number, y: number, z: number, type: BlockType }> => {
    const blocks = []
    // Generate industrial structures
    for (let factory = 0; factory < 3; factory++) {
      const factoryX = factory * 30
      const factoryZ = 200
      
      // Factory building
      for (let x = 0; x < 25; x++) {
        for (let z = 0; z < 20; z++) {
          for (let y = 64; y < 75; y++) {
            if (x === 0 || x === 24 || z === 0 || z === 19 || y === 64) {
              blocks.push({ x: factoryX + x, y, z: factoryZ + z, type: BlockType.IRON_BLOCK })
            }
          }
        }
      }
      
      // Smokestacks
      for (let stack = 0; stack < 3; stack++) {
        const stackX = factoryX + 5 + stack * 8
        const stackZ = factoryZ + 10
        for (let y = 75; y < 85; y++) {
          blocks.push({ x: stackX, y, z: stackZ, type: BlockType.STONE })
        }
      }
    }
    return blocks
  }

  private generateTransportationNetwork = (): Array<{ x: number, y: number, z: number, type: BlockType }> => {
    const blocks = []
    // Generate roads and pathways
    
    // Main road (horizontal)
    for (let x = -100; x <= 200; x++) {
      for (let z = 49; z <= 51; z++) {
        blocks.push({ x, y: 64, z, type: BlockType.STONE })
      }
    }
    
    // Cross streets (vertical)
    for (let street = 0; street < 10; street++) {
      const streetX = street * 30 - 50
      for (let z = -50; z <= 250; z++) {
        for (let x = streetX - 1; x <= streetX + 1; x++) {
          blocks.push({ x, y: 64, z, type: BlockType.STONE })
        }
      }
    }
    
    return blocks
  }

  private generatePublicBuildings = (): Array<{ x: number, y: number, z: number, type: BlockType }> => {
    const blocks = []
    // Generate city hall, schools, parks, etc.
    
    // City Hall
    for (let x = 0; x < 30; x++) {
      for (let z = 0; z < 30; z++) {
        for (let y = 64; y < 80; y++) {
          if (x === 0 || x === 29 || z === 0 || z === 29 || y === 64 || y === 79) {
            blocks.push({ x: x - 15, y, z: z + 300, type: BlockType.GOLD_BLOCK })
          }
        }
      }
    }
    
    // Park with trees
    for (let tree = 0; tree < 20; tree++) {
      const treeX = (Math.random() - 0.5) * 60
      const treeZ = 350 + (Math.random() - 0.5) * 60
      
      for (let y = 64; y <= 70; y++) {
        blocks.push({ x: Math.floor(treeX), y, z: Math.floor(treeZ), type: BlockType.WOOD })
        if (y >= 67) {
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
              blocks.push({ 
                x: Math.floor(treeX) + dx, 
                y, 
                z: Math.floor(treeZ) + dz, 
                type: BlockType.LEAVES 
              })
            }
          }
        }
      }
    }
    
    return blocks
  }

  private generateUndergroundMines = (harness: GameTestHarness, playerId: EntityId): Effect.Effect<void, never, any> =>
    Effect.gen(function* () {
      // Create underground mine system with ore deposits
      for (let level = 0; level < 20; level++) {
        const y = 50 - level
        
        // Main mining tunnel
        for (let x = 0; x < 100; x++) {
          yield* harness.simulatePlayerActions.destroyBlock(x + 500, y, 500)
          yield* harness.simulatePlayerActions.destroyBlock(x + 500, y + 1, 500)
        }
        
        // Side tunnels every 10 blocks
        if (level % 5 === 0) {
          for (let side = 1; side <= 20; side++) {
            yield* harness.simulatePlayerActions.destroyBlock(520, y, 500 + side)
            yield* harness.simulatePlayerActions.destroyBlock(520, y, 500 - side)
            yield* harness.simulatePlayerActions.destroyBlock(550, y, 500 + side)
            yield* harness.simulatePlayerActions.destroyBlock(550, y, 500 - side)
            yield* harness.simulatePlayerActions.destroyBlock(580, y, 500 + side)
            yield* harness.simulatePlayerActions.destroyBlock(580, y, 500 - side)
          }
        }
        
        // Place some ore deposits
        for (let ore = 0; ore < 10; ore++) {
          const oreX = 500 + Math.floor(Math.random() * 100)
          const oreZ = 480 + Math.floor(Math.random() * 40)
          const oreType = [BlockType.IRON_ORE, BlockType.GOLD_ORE, BlockType.DIAMOND_ORE][Math.floor(Math.random() * 3)]
          yield* harness.simulatePlayerActions.placeBlock(playerId, oreX, y, oreZ, oreType)
        }
      }
    })

  private generateComplexWorld = (harness: GameTestHarness, playerId: EntityId, blockCount: number, structureCount: number): Effect.Effect<void, never, any> =>
    Effect.gen(function* () {
      let blocksPlaced = 0
      let structuresBuilt = 0
      
      // Generate structures
      while (structuresBuilt < structureCount && blocksPlaced < blockCount) {
        const structureType = Math.floor(Math.random() * 4)
        const baseX = Math.floor(Math.random() * 400) - 200
        const baseZ = Math.floor(Math.random() * 400) - 200
        
        switch (structureType) {
          case 0: // Tower
            const towerHeight = 10 + Math.floor(Math.random() * 15)
            for (let y = 64; y < 64 + towerHeight; y++) {
              for (let x = 0; x < 4; x++) {
                for (let z = 0; z < 4; z++) {
                  if (x === 0 || x === 3 || z === 0 || z === 3) {
                    yield* harness.simulatePlayerActions.placeBlock(playerId, baseX + x, y, baseZ + z, BlockType.STONE)
                    blocksPlaced++
                  }
                }
              }
            }
            break
            
          case 1: // Wall
            const wallLength = 20 + Math.floor(Math.random() * 30)
            const wallHeight = 5 + Math.floor(Math.random() * 5)
            for (let x = 0; x < wallLength; x++) {
              for (let y = 64; y < 64 + wallHeight; y++) {
                yield* harness.simulatePlayerActions.placeBlock(playerId, baseX + x, y, baseZ, BlockType.STONE)
                blocksPlaced++
              }
            }
            break
            
          case 2: // Platform
            const platformSize = 10 + Math.floor(Math.random() * 20)
            for (let x = 0; x < platformSize; x++) {
              for (let z = 0; z < platformSize; z++) {
                yield* harness.simulatePlayerActions.placeBlock(playerId, baseX + x, 70, baseZ + z, BlockType.WOOD)
                blocksPlaced++
              }
            }
            break
            
          case 3: // Pyramid
            const pyramidSize = 5 + Math.floor(Math.random() * 10)
            for (let level = 0; level < pyramidSize; level++) {
              const size = pyramidSize - level
              for (let x = 0; x < size; x++) {
                for (let z = 0; z < size; z++) {
                  yield* harness.simulatePlayerActions.placeBlock(
                    playerId, 
                    baseX + x + level, 
                    64 + level, 
                    baseZ + z + level, 
                    BlockType.GOLD_BLOCK
                  )
                  blocksPlaced++
                }
              }
            }
            break
        }
        
        structuresBuilt++
      }
      
      // Fill remaining blocks with terrain variation
      while (blocksPlaced < blockCount) {
        const x = Math.floor(Math.random() * 400) - 200
        const z = Math.floor(Math.random() * 400) - 200
        const y = 64 + Math.floor(Math.random() * 10)
        const blockType = [BlockType.DIRT, BlockType.STONE, BlockType.GRASS][Math.floor(Math.random() * 3)]
        
        yield* harness.simulatePlayerActions.placeBlock(playerId, x, y, z, blockType)
        blocksPlaced++
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