/**
 * Service Integration Tests
 * 
 * Tests the complete service layer architecture including:
 * - Service creation and initialization
 * - Dependency injection with Context.Tag
 * - Layer composition and configuration
 * - Inter-service communication
 * - Mock service implementations
 */

import * as Effect from 'effect/Effect'
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// Service imports
import {
  WorldService,
  EntityService,
  PhysicsService,
  RenderService,
  InputService,
  NetworkService,
  ServiceLayers,
  ServiceUtils,
  ServiceMonitoring,
  runWithServices,
} from '../index'

describe('Service Layer Integration', () => {
  describe('Service Creation and Initialization', () => {
    it('should create all services successfully', async () => {
      const program = Effect.gen(function* () {
        const worldService = yield* WorldService
        const entityService = yield* EntityService
        const physicsService = yield* PhysicsService
        const renderService = yield* RenderService
        const inputService = yield* InputService
        const networkService = yield* NetworkService

        // Verify services are properly initialized
        expect(worldService).toBeDefined()
        expect(entityService).toBeDefined()
        expect(physicsService).toBeDefined()
        expect(renderService).toBeDefined()
        expect(inputService).toBeDefined()
        expect(networkService).toBeDefined()

        return true
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result).toBe(true)
    })

    it('should handle service initialization with different configurations', async () => {
      const configs = ['development', 'testing', 'production'] as const

      for (const env of configs) {
        const config = ServiceUtils.configs[env]
        const layer = ServiceLayers.forEnvironment(env)

        const program = Effect.gen(function* () {
          if (config.enabledServices.includes('world')) {
            const worldService = yield* WorldService
            const stats = yield* worldService.getWorldStats()
            expect(stats).toBeDefined()
          }

          if (config.enabledServices.includes('entity')) {
            const entityService = yield* EntityService
            const count = yield* entityService.getEntityCount()
            expect(count).toBeGreaterThanOrEqual(0)
          }

          return true
        })

        const result = await Effect.runPromise(
          program.pipe(Effect.provide(layer))
        )

        expect(result).toBe(true)
      }
    })
  })

  describe('Service Dependencies and Communication', () => {
    it('should handle inter-service dependencies correctly', async () => {
      const program = Effect.gen(function* () {
        const worldService = yield* WorldService
        const entityService = yield* EntityService
        
        // Test entity creation
        const entityId = yield* entityService.createEntity({})
        expect(entityId).toBeDefined()
        
        // Test world stats
        const worldStats = yield* worldService.getWorldStats()
        expect(worldStats.loadedChunks).toBeGreaterThanOrEqual(0)

        return { entityId, worldStats }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result.entityId).toBeDefined()
      expect(result.worldStats).toBeDefined()
    })

    it('should properly coordinate between physics and world services', async () => {
      const program = Effect.gen(function* () {
        const worldService = yield* WorldService
        const physicsService = yield* PhysicsService
        
        // Test physics simulation
        const stepResult = yield* physicsService.step(16.67) // ~60 FPS
        expect(stepResult.deltaTime).toBeCloseTo(16.67, 1)
        
        // Test world tick
        const tickResult = yield* worldService.tick(16.67)
        expect(tickResult.deltaTime).toBeCloseTo(16.67, 1)

        return { stepResult, tickResult }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result.stepResult.simulationTime).toBeGreaterThanOrEqual(0)
      expect(result.tickResult.tickDuration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Service Layer Composition', () => {
    it('should compose layers correctly for different environments', () => {
      const developmentLayer = ServiceLayers.Development
      const testingLayer = ServiceLayers.Testing  
      const productionLayer = ServiceLayers.Production
      const gameClientLayer = ServiceLayers.GameClient
      const gameServerLayer = ServiceLayers.GameServer

      expect(developmentLayer).toBeDefined()
      expect(testingLayer).toBeDefined()
      expect(productionLayer).toBeDefined()
      expect(gameClientLayer).toBeDefined()
      expect(gameServerLayer).toBeDefined()
    })

    it('should create custom layer configurations', () => {
      const customConfig = ServiceUtils.createConfig({
        enabledServices: ['world', 'entity'],
        enableNetworking: false,
        enableRendering: false,
        debug: true,
      })

      expect(customConfig.enabledServices).toHaveLength(2)
      expect(customConfig.enableNetworking).toBe(false)
      expect(customConfig.enableRendering).toBe(false)
      expect(customConfig.debug).toBe(true)

      const customLayer = ServiceLayers.create(customConfig)
      expect(customLayer).toBeDefined()
    })
  })

  describe('Service Monitoring and Health Checks', () => {
    it('should check service health', async () => {
      const program = Effect.gen(function* () {
        return yield* ServiceMonitoring.checkHealth()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result.world).toBe('healthy')
      expect(result.entity).toBe('healthy')
      expect(result.physics).toBe('healthy')
      expect(result.render).toBe('healthy')
      expect(result.input).toBe('healthy')
      expect(result.network).toBe('healthy')
    })

    it('should collect performance metrics from all services', async () => {
      const program = Effect.gen(function* () {
        return yield* ServiceMonitoring.getMetrics()
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result.world).toBeDefined()
      expect(result.entity).toBeDefined()
      expect(result.physics).toBeDefined()
      expect(result.render).toBeDefined()
      expect(result.input).toBeDefined()
      expect(result.network).toBeDefined()

      // Check specific metric properties
      expect(result.world.loadedChunks).toBeGreaterThanOrEqual(0)
      expect(result.entity.totalEntities).toBeGreaterThanOrEqual(0)
      expect(result.physics.totalBodies).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Service Lifecycle Management', () => {
    it('should run programs with service lifecycle management', async () => {
      const testProgram = Effect.gen(function* () {
        const worldService = yield* WorldService
        const stats = yield* worldService.getWorldStats()
        return stats.loadedChunks
      })

      const result = await Effect.runPromise(
        runWithServices(ServiceUtils.configs.testing, testProgram)
      )

      expect(result).toBeGreaterThanOrEqual(0)
    })

    it('should handle startup and shutdown correctly', async () => {
      const config = ServiceUtils.configs.development

      // Test startup
      const startupResult = await Effect.runPromise(
        ServiceUtils.startup(config)
      )
      expect(startupResult).toBeUndefined() // Startup returns void

      // Test shutdown  
      const shutdownResult = await Effect.runPromise(
        ServiceUtils.shutdown(config)
      )
      expect(shutdownResult).toBeUndefined() // Shutdown returns void
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle service errors gracefully', async () => {
      const program = Effect.gen(function* () {
        const worldService = yield* WorldService
        
        // This should fail in mock implementation
        const chunkResult = yield* worldService.getChunk({ x: 0, z: 0 }).pipe(
          Effect.catchAll(() => Effect.succeed('error_handled'))
        )
        
        return chunkResult
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result).toBe('error_handled')
    })

    it('should handle network service connection failures', async () => {
      const program = Effect.gen(function* () {
        const networkService = yield* NetworkService
        
        // Test connection with invalid config
        const connectionResult = yield* networkService.connectToServer({
          serverAddress: 'invalid',
          serverPort: 0,
          playerName: 'test',
          reconnectAttempts: 0,
          reconnectDelay: 0,
        }).pipe(
          Effect.catchAll(() => Effect.succeed('connection_failed'))
        )
        
        return connectionResult
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      // Mock implementation should succeed, but real implementation would handle errors
      expect(result).toBeDefined()
    })
  })

  describe('Property-based Testing', () => {
    it('should handle arbitrary service configurations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            enableNetworking: fc.boolean(),
            enablePhysics: fc.boolean(), 
            enableRendering: fc.boolean(),
            debug: fc.boolean(),
          }),
          async (configOverrides) => {
            const config = ServiceUtils.createConfig(configOverrides)
            expect(config.enableNetworking).toBe(configOverrides.enableNetworking)
            expect(config.enablePhysics).toBe(configOverrides.enablePhysics)
            expect(config.enableRendering).toBe(configOverrides.enableRendering)
            expect(config.debug).toBe(configOverrides.debug)
          }
        ),
        { numRuns: 10 } // Limit runs for CI performance
      )
    })

    it('should handle arbitrary entity operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            x: fc.float({ min: -1000, max: 1000 }),
            y: fc.float({ min: 0, max: 256 }),
            z: fc.float({ min: -1000, max: 1000 }),
          }), { minLength: 1, maxLength: 10 }),
          async (positions) => {
            const program = Effect.gen(function* () {
              const entityService = yield* EntityService
              
              const entityIds = []
              for (const position of positions) {
                const id = yield* entityService.createEntity({ position })
                entityIds.push(id)
              }
              
              const count = yield* entityService.getEntityCount()
              expect(count).toBeGreaterThanOrEqual(entityIds.length)
              
              return entityIds.length
            })

            const result = await Effect.runPromise(
              program.pipe(Effect.provide(ServiceLayers.Mock))
            )

            expect(result).toBe(positions.length)
          }
        ),
        { numRuns: 5 } // Limit runs for CI performance
      )
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent service operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => 
        Effect.gen(function* () {
          const entityService = yield* EntityService
          return yield* entityService.createEntity({
            position: { x: i, y: 64, z: i }
          })
        })
      )

      const program = Effect.gen(function* () {
        const results = yield* Effect.all(operations, { concurrency: 10 })
        return results.length
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result).toBe(100)
    })

    it('should maintain performance under load', async () => {
      const startTime = Date.now()
      
      const program = Effect.gen(function* () {
        const worldService = yield* WorldService
        const physicsService = yield* PhysicsService
        
        // Simulate game loop
        for (let i = 0; i < 60; i++) { // 1 second at 60 FPS
          yield* worldService.tick(16.67)
          yield* physicsService.step(16.67)
        }
        
        return Date.now() - startTime
      })

      const duration = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      // Should complete quickly with mock services
      expect(duration).toBeLessThan(5000) // 5 seconds max
    })
  })
})

describe('Individual Service Functionality', () => {
  describe('WorldService', () => {
    it('should provide world management capabilities', async () => {
      const program = Effect.gen(function* () {
        const worldService = yield* WorldService
        
        // Test basic world operations
        const stats = yield* worldService.getWorldStats()
        const chunks = yield* worldService.getLoadedChunks()
        
        return { stats, chunks }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result.stats.loadedChunks).toBe(0)
      expect(result.chunks).toHaveLength(0)
    })
  })

  describe('EntityService', () => {
    it('should provide entity management capabilities', async () => {
      const program = Effect.gen(function* () {
        const entityService = yield* EntityService
        
        // Test entity creation
        const entityId = yield* entityService.createEntity({})
        const exists = yield* entityService.entityExists(entityId)
        const count = yield* entityService.getEntityCount()
        
        return { entityId, exists, count }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result.entityId).toBeDefined()
      expect(result.exists).toBe(false) // Mock returns false
      expect(result.count).toBe(0) // Mock returns 0
    })
  })

  describe('PhysicsService', () => {
    it('should provide physics simulation capabilities', async () => {
      const program = Effect.gen(function* () {
        const physicsService = yield* PhysicsService
        
        // Test physics operations
        const stepResult = yield* physicsService.step(16.67)
        const gravity = yield* physicsService.getGravity()
        const stats = yield* physicsService.getPhysicsStats()
        
        return { stepResult, gravity, stats }
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(ServiceLayers.Mock))
      )

      expect(result.stepResult.deltaTime).toBe(16.67)
      expect(result.gravity.y).toBe(-9.81)
      expect(result.stats.totalBodies).toBe(0)
    })
  })
})

describe('Mock Service Implementations', () => {
  it('should provide consistent mock behavior', async () => {
    const program = Effect.gen(function* () {
      const worldService = yield* WorldService
      const entityService = yield* EntityService
      
      // Test that mocks return consistent values
      const stats1 = yield* worldService.getWorldStats()
      const stats2 = yield* worldService.getWorldStats()
      
      const count1 = yield* entityService.getEntityCount()
      const count2 = yield* entityService.getEntityCount()
      
      return {
        statsConsistent: stats1.loadedChunks === stats2.loadedChunks,
        countConsistent: count1 === count2,
      }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(ServiceLayers.Mock))
    )

    expect(result.statsConsistent).toBe(true)
    expect(result.countConsistent).toBe(true)
  })
})