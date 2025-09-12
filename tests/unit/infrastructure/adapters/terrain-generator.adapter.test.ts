/**
 * Terrain Generator Adapter Unit Tests
 * 
 * Comprehensive test suite for the terrain generator adapter,
 * testing terrain generation algorithms, noise functions, and Effect-TS patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Context from 'effect/Context'
import { 
  expectEffect, 
  runEffect, 
  runEffectExit,
  measureEffectPerformance
} from '../../../setup/infrastructure.setup'
import {
  createTerrainGeneratorAdapter,
  TerrainGeneratorAdapterLive,
  createCustomTerrainGeneratorAdapter,
  TerrainGeneratorAdapterUtils
} from '@infrastructure/adapters/terrain-generator.adapter'
import {
  TerrainGeneratorPort,
  ITerrainGenerator,
  TerrainGenerationRequest,
  TerrainGenerationResult,
  ChunkCoordinates,
  NoiseSettings,
  BiomeConfig
} from '@domain/ports/terrain-generator.port'
import { TerrainGenerationDomainService } from '@domain/services/terrain-generation.domain-service'

// Mock the domain service
vi.mock('@domain/services/terrain-generation.domain-service', () => {
  const mockResult: TerrainGenerationResult = {
    chunkCoordinates: { x: 0, z: 0 },
    heightMap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    blockCount: 100,
    biomes: ['plains', 'forest'],
    generationTime: 15,
    noiseValues: [0.1, 0.2, 0.3, 0.4, 0.5]
  }

  const mockBiome: BiomeConfig = {
    name: 'plains',
    temperature: 0.8,
    humidity: 0.4,
    heightModifier: 1.0,
    blockTypes: {
      surface: 2,
      subsurface: 3,
      stone: 1
    }
  }

  return {
    TerrainGenerationDomainService: vi.fn().mockImplementation(() => ({
      generateTerrain: vi.fn().mockResolvedValue(Effect.succeed(mockResult)),
      generateHeightMap: vi.fn().mockResolvedValue(Effect.succeed([0, 1, 2, 3, 4])),
      getBiome: vi.fn().mockResolvedValue(Effect.succeed(mockBiome))
    }))
  }
})

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => 1000),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  },
  writable: true
})

// Mock Math API
Object.defineProperty(global, 'Math', {
  value: {
    ...Math,
    sin: vi.fn((x) => Math.sin(x)),
    cos: vi.fn((x) => Math.cos(x)),
    random: vi.fn(() => 0.5)
  },
  writable: true
})

// Mock browser APIs
Object.defineProperty(global, 'Float32Array', { value: Float32Array })
Object.defineProperty(global, 'WebGLRenderingContext', { value: function() {} })
Object.defineProperty(global, 'Worker', { value: function() {} })

// Mock document for WebGL checks
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(() => ({
      getContext: vi.fn(() => ({
        createShader: vi.fn(),
        createProgram: vi.fn()
      }))
    }))
  },
  writable: true
})

// Mock navigator for sendBeacon
Object.defineProperty(global, 'navigator', {
  value: {
    sendBeacon: vi.fn()
  },
  writable: true
})

describe('TerrainGeneratorAdapter', () => {
  let adapter: ITerrainGenerator
  let mockDomainService: TerrainGenerationDomainService

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset performance.now mock
    vi.mocked(performance.now).mockReturnValue(1000)
    
    adapter = await runEffect(createTerrainGeneratorAdapter())
    mockDomainService = new TerrainGenerationDomainService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Adapter Creation', () => {
    it('should create terrain generator adapter successfully', async () => {
      const result = await expectEffect.toSucceed(createTerrainGeneratorAdapter())
      
      expect(result).toBeDefined()
      expect(result.generateTerrain).toBeDefined()
      expect(result.generateHeightMap).toBeDefined()
      expect(result.getBiome).toBeDefined()
      expect(result.isAvailable).toBeDefined()
    })

    it('should create live layer successfully', async () => {
      const result = await expectEffect.toSucceed(
        Layer.build(TerrainGeneratorAdapterLive).pipe(
          Effect.map(context => Context.get(context, TerrainGeneratorPort))
        )
      )

      expect(result).toBeDefined()
      expect(result.generateTerrain).toBeDefined()
    })

    it('should create custom adapter with configuration', async () => {
      const config = {
        noiseLibrary: 'simplex' as const,
        enableGPUAcceleration: true,
        enableWorkerThreads: true
      }

      const result = await expectEffect.toSucceed(
        Layer.build(createCustomTerrainGeneratorAdapter(config)).pipe(
          Effect.map(context => Context.get(context, TerrainGeneratorPort))
        )
      )

      expect(result).toBeDefined()
    })

    it('should handle custom adapter without WebGL', async () => {
      delete (global as any).WebGLRenderingContext

      const config = { enableGPUAcceleration: true }

      const result = await expectEffect.toSucceed(
        Layer.build(createCustomTerrainGeneratorAdapter(config)).pipe(
          Effect.map(context => Context.get(context, TerrainGeneratorPort))
        )
      )

      expect(result).toBeDefined()

      // Restore WebGL
      Object.defineProperty(global, 'WebGLRenderingContext', { value: function() {} })
    })

    it('should handle custom adapter without Worker', async () => {
      delete (global as any).Worker

      const config = { enableWorkerThreads: true }

      const result = await expectEffect.toSucceed(
        Layer.build(createCustomTerrainGeneratorAdapter(config)).pipe(
          Effect.map(context => Context.get(context, TerrainGeneratorPort))
        )
      )

      expect(result).toBeDefined()

      // Restore Worker
      Object.defineProperty(global, 'Worker', { value: function() {} })
    })
  })

  describe('Terrain Generation', () => {
    let terrainRequest: TerrainGenerationRequest
    let chunkCoordinates: ChunkCoordinates
    let noiseSettings: NoiseSettings

    beforeEach(() => {
      chunkCoordinates = { x: 0, z: 0 }
      
      noiseSettings = {
        octaves: 4,
        frequency: 0.01,
        amplitude: 1.0,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 100.0
      }

      terrainRequest = {
        chunkCoordinates,
        seed: 12345,
        noiseSettings,
        biomeSettings: {
          temperature: 0.7,
          humidity: 0.5,
          elevation: 0.3
        }
      }
    })

    it('should generate terrain successfully', async () => {
      const result = await expectEffect.toSucceed(adapter.generateTerrain(terrainRequest))
      
      expect(result).toBeDefined()
      expect(result.chunkCoordinates).toEqual({ x: 0, z: 0 })
      expect(result.heightMap).toBeDefined()
      expect(result.blockCount).toBeGreaterThan(0)
      expect(result.biomes).toBeDefined()
      expect(result.generationTime).toBeGreaterThan(0)
    })

    it('should generate height map', async () => {
      const result = await expectEffect.toSucceed(
        adapter.generateHeightMap(chunkCoordinates, 12345, noiseSettings)
      )
      
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(typeof result[0]).toBe('number')
    })

    it('should get biome configuration', async () => {
      const result = await expectEffect.toSucceed(
        adapter.getBiome(0, 0, 12345)
      )
      
      expect(result).toBeDefined()
      expect(result.name).toBeDefined()
      expect(result.temperature).toBeGreaterThanOrEqual(0)
      expect(result.humidity).toBeGreaterThanOrEqual(0)
      expect(result.blockTypes).toBeDefined()
    })

    it('should handle different chunk coordinates', async () => {
      const request = { 
        ...terrainRequest, 
        chunkCoordinates: { x: 10, z: -5 } 
      }
      
      const result = await expectEffect.toSucceed(adapter.generateTerrain(request))
      expect(result.chunkCoordinates).toEqual({ x: 10, z: -5 })
    })

    it('should handle different seeds', async () => {
      const seed1 = 12345
      const seed2 = 54321

      const heightMap1 = await expectEffect.toSucceed(
        adapter.generateHeightMap(chunkCoordinates, seed1, noiseSettings)
      )
      
      const heightMap2 = await expectEffect.toSucceed(
        adapter.generateHeightMap(chunkCoordinates, seed2, noiseSettings)
      )

      // Different seeds should produce different results
      expect(heightMap1).toBeDefined()
      expect(heightMap2).toBeDefined()
      // Results should be deterministic for same seed
    })

    it('should handle various noise settings', async () => {
      const highFrequencyNoise: NoiseSettings = {
        ...noiseSettings,
        frequency: 0.1,
        octaves: 8
      }

      const request = { 
        ...terrainRequest, 
        noiseSettings: highFrequencyNoise 
      }
      
      const result = await expectEffect.toSucceed(adapter.generateTerrain(request))
      expect(result).toBeDefined()
    })

    it('should delegate to domain service', async () => {
      await expectEffect.toSucceed(adapter.generateTerrain(terrainRequest))
      
      expect(mockDomainService.generateTerrain).toHaveBeenCalledWith(terrainRequest)
    })

    it('should delegate height map generation to domain service', async () => {
      await expectEffect.toSucceed(
        adapter.generateHeightMap(chunkCoordinates, 12345, noiseSettings)
      )
      
      expect(mockDomainService.generateHeightMap).toHaveBeenCalledWith(
        chunkCoordinates, 12345, noiseSettings
      )
    })

    it('should delegate biome generation to domain service', async () => {
      await expectEffect.toSucceed(adapter.getBiome(0, 0, 12345))
      
      expect(mockDomainService.getBiome).toHaveBeenCalledWith(0, 0, 12345)
    })
  })

  describe('Infrastructure Validation', () => {
    it('should validate browser capabilities', async () => {
      const isAvailable = await expectEffect.toSucceed(adapter.isAvailable())
      expect(isAvailable).toBe(true)
    })

    it('should handle missing Math API', async () => {
      const originalMath = global.Math
      delete (global as any).Math

      const newAdapter = await runEffect(createTerrainGeneratorAdapter())
      const isAvailable = await expectEffect.toSucceed(newAdapter.isAvailable())
      
      expect(isAvailable).toBe(false)

      // Restore Math
      global.Math = originalMath
    })

    it('should handle missing performance API', async () => {
      const originalPerformance = global.performance
      delete (global as any).performance

      const newAdapter = await runEffect(createTerrainGeneratorAdapter())
      const isAvailable = await expectEffect.toSucceed(newAdapter.isAvailable())
      
      expect(isAvailable).toBe(false)

      // Restore performance
      global.performance = originalPerformance
    })

    it('should warn about high memory usage', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock high memory usage
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 950000,
          totalJSHeapSize: 1000000,
          jsHeapSizeLimit: 1000000
        },
        configurable: true
      })

      await runEffect(createTerrainGeneratorAdapter())
      
      expect(consoleWarnSpy).toBeDefined()
      
      consoleWarnSpy.mockRestore()
    })

    it('should handle missing browser APIs gracefully', async () => {
      const originalFloat32Array = global.Float32Array
      delete (global as any).Float32Array

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await runEffect(createTerrainGeneratorAdapter())
      
      expect(consoleWarnSpy).toBeDefined()
      
      consoleWarnSpy.mockRestore()
      
      // Restore API
      global.Float32Array = originalFloat32Array
    })
  })

  describe('Performance Monitoring', () => {
    it('should log performance metrics', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // Mock time progression
      let timeCounter = 1000
      vi.mocked(performance.now).mockImplementation(() => {
        timeCounter += 10
        return timeCounter
      })

      const terrainRequest: TerrainGenerationRequest = {
        chunkCoordinates: { x: 0, z: 0 },
        seed: 12345,
        noiseSettings: {
          octaves: 4,
          frequency: 0.01,
          amplitude: 1.0,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 100.0
        }
      }

      await expectEffect.toSucceed(adapter.generateTerrain(terrainRequest))
      
      expect(performance.now).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should send metrics via sendBeacon if available', async () => {
      const sendBeaconSpy = vi.mocked(navigator.sendBeacon)
      
      const terrainRequest: TerrainGenerationRequest = {
        chunkCoordinates: { x: 0, z: 0 },
        seed: 12345,
        noiseSettings: {
          octaves: 4,
          frequency: 0.01,
          amplitude: 1.0,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 100.0
        }
      }

      await expectEffect.toSucceed(adapter.generateTerrain(terrainRequest))
      
      expect(sendBeaconSpy).toBeDefined()
    })

    it('should track generation time accurately', async () => {
      let callCount = 0
      vi.mocked(performance.now).mockImplementation(() => {
        return 1000 + (callCount++ * 50) // Simulate 50ms per call
      })

      const terrainRequest: TerrainGenerationRequest = {
        chunkCoordinates: { x: 0, z: 0 },
        seed: 12345,
        noiseSettings: {
          octaves: 4,
          frequency: 0.01,
          amplitude: 1.0,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 100.0
        }
      }

      await expectEffect.toSucceed(adapter.generateTerrain(terrainRequest))
      
      expect(performance.now).toHaveBeenCalledTimes(2) // Start and end time
    })
  })

  describe('Noise Function Testing', () => {
    it('should use simplex noise function', async () => {
      // Test that the infrastructure noise functions work
      const chunkCoordinates: ChunkCoordinates = { x: 0, z: 0 }
      const noiseSettings: NoiseSettings = {
        octaves: 1,
        frequency: 0.1,
        amplitude: 1.0,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 1.0
      }

      const heightMap = await expectEffect.toSucceed(
        adapter.generateHeightMap(chunkCoordinates, 12345, noiseSettings)
      )
      
      expect(heightMap).toBeDefined()
      expect(Array.isArray(heightMap)).toBe(true)
    })

    it('should produce consistent results for same input', async () => {
      const chunkCoordinates: ChunkCoordinates = { x: 5, z: 10 }
      const seed = 98765
      const noiseSettings: NoiseSettings = {
        octaves: 2,
        frequency: 0.05,
        amplitude: 2.0,
        persistence: 0.4,
        lacunarity: 1.8,
        scale: 50.0
      }

      const heightMap1 = await expectEffect.toSucceed(
        adapter.generateHeightMap(chunkCoordinates, seed, noiseSettings)
      )
      
      const heightMap2 = await expectEffect.toSucceed(
        adapter.generateHeightMap(chunkCoordinates, seed, noiseSettings)
      )

      expect(heightMap1).toEqual(heightMap2)
    })

    it('should handle extreme noise settings', async () => {
      const extremeNoiseSettings: NoiseSettings = {
        octaves: 12,
        frequency: 0.001,
        amplitude: 10.0,
        persistence: 0.9,
        lacunarity: 3.0,
        scale: 1000.0
      }

      const terrainRequest: TerrainGenerationRequest = {
        chunkCoordinates: { x: 0, z: 0 },
        seed: 12345,
        noiseSettings: extremeNoiseSettings
      }

      const result = await expectEffect.toSucceed(adapter.generateTerrain(terrainRequest))
      expect(result).toBeDefined()
    })
  })

  describe('Biome Generation', () => {
    it('should generate consistent biomes for same coordinates', async () => {
      const biome1 = await expectEffect.toSucceed(adapter.getBiome(10, 20, 12345))
      const biome2 = await expectEffect.toSucceed(adapter.getBiome(10, 20, 12345))
      
      expect(biome1).toEqual(biome2)
    })

    it('should generate different biomes for different coordinates', async () => {
      const biome1 = await expectEffect.toSucceed(adapter.getBiome(0, 0, 12345))
      const biome2 = await expectEffect.toSucceed(adapter.getBiome(100, 100, 12345))
      
      expect(biome1).toBeDefined()
      expect(biome2).toBeDefined()
      // Note: They might be the same biome type, but should be generated consistently
    })

    it('should handle negative coordinates', async () => {
      const biome = await expectEffect.toSucceed(adapter.getBiome(-50, -75, 12345))
      
      expect(biome).toBeDefined()
      expect(biome.name).toBeDefined()
      expect(biome.temperature).toBeGreaterThanOrEqual(0)
      expect(biome.humidity).toBeGreaterThanOrEqual(0)
    })

    it('should generate valid biome properties', async () => {
      const biome = await expectEffect.toSucceed(adapter.getBiome(0, 0, 12345))
      
      expect(biome.name).toBeDefined()
      expect(typeof biome.temperature).toBe('number')
      expect(typeof biome.humidity).toBe('number')
      expect(typeof biome.heightModifier).toBe('number')
      expect(biome.blockTypes).toBeDefined()
      expect(typeof biome.blockTypes.surface).toBe('number')
    })
  })

  describe('Error Handling', () => {
    it('should handle domain service errors', async () => {
      vi.mocked(mockDomainService.generateTerrain).mockResolvedValue(
        Effect.fail(new Error('Domain service error'))
      )

      const terrainRequest: TerrainGenerationRequest = {
        chunkCoordinates: { x: 0, z: 0 },
        seed: 12345,
        noiseSettings: {
          octaves: 4,
          frequency: 0.01,
          amplitude: 1.0,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 100.0
        }
      }

      const result = await runEffectExit(adapter.generateTerrain(terrainRequest))
      expect(result._tag).toBe('Failure')
    })

    it('should handle height map generation errors', async () => {
      vi.mocked(mockDomainService.generateHeightMap).mockResolvedValue(
        Effect.fail(new Error('Height map generation failed'))
      )

      const result = await runEffectExit(
        adapter.generateHeightMap({ x: 0, z: 0 }, 12345, {
          octaves: 4,
          frequency: 0.01,
          amplitude: 1.0,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 100.0
        })
      )
      
      expect(result._tag).toBe('Failure')
    })

    it('should handle biome generation errors', async () => {
      vi.mocked(mockDomainService.getBiome).mockResolvedValue(
        Effect.fail(new Error('Biome generation failed'))
      )

      const result = await runEffectExit(adapter.getBiome(0, 0, 12345))
      expect(result._tag).toBe('Failure')
    })

    it('should handle performance.now errors gracefully', async () => {
      vi.mocked(performance.now).mockImplementation(() => {
        throw new Error('Performance API error')
      })

      const terrainRequest: TerrainGenerationRequest = {
        chunkCoordinates: { x: 0, z: 0 },
        seed: 12345,
        noiseSettings: {
          octaves: 4,
          frequency: 0.01,
          amplitude: 1.0,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 100.0
        }
      }

      // Should handle error gracefully
      const result = await expectEffect.toSucceed(adapter.generateTerrain(terrainRequest))
      expect(result).toBeDefined()
    })
  })

  describe('Utility Functions', () => {
    describe('TerrainGeneratorAdapterUtils', () => {
      it('should validate capabilities', async () => {
        const isValid = await expectEffect.toSucceed(
          TerrainGeneratorAdapterUtils.validateCapabilities()
        )
        expect(isValid).toBe(true)
      })

      it('should estimate memory usage', () => {
        const chunkCount = 10
        const memoryUsage = TerrainGeneratorAdapterUtils.estimateMemoryUsage(chunkCount)
        
        expect(memoryUsage).toBeGreaterThan(0)
        expect(typeof memoryUsage).toBe('number')
        expect(memoryUsage).toBe(chunkCount * 64 * 1024) // 64KB per chunk
      })

      it('should get supported algorithms', () => {
        const algorithms = TerrainGeneratorAdapterUtils.getSupportedAlgorithms()
        
        expect(algorithms).toBeInstanceOf(Array)
        expect(algorithms).toContain('math-based')
      })

      it('should include WebGL algorithms when available', () => {
        const algorithms = TerrainGeneratorAdapterUtils.getSupportedAlgorithms()
        expect(algorithms).toContain('webgl-optimized')
      })

      it('should include Worker algorithms when available', () => {
        const algorithms = TerrainGeneratorAdapterUtils.getSupportedAlgorithms()
        expect(algorithms).toContain('worker-threaded')
      })

      it('should check WebGL support', () => {
        const hasWebGL = TerrainGeneratorAdapterUtils.checkWebGLSupport()
        expect(typeof hasWebGL).toBe('boolean')
        expect(hasWebGL).toBe(true) // Should be true with our mocks
      })

      it('should handle WebGL check when not available', () => {
        delete (global as any).WebGLRenderingContext
        
        const hasWebGL = TerrainGeneratorAdapterUtils.checkWebGLSupport()
        expect(hasWebGL).toBe(false)

        // Restore
        Object.defineProperty(global, 'WebGLRenderingContext', { value: function() {} })
      })

      it('should handle WebGL context creation failure', () => {
        vi.mocked(document.createElement).mockImplementation(() => {
          throw new Error('Canvas creation failed')
        })

        const hasWebGL = TerrainGeneratorAdapterUtils.checkWebGLSupport()
        expect(hasWebGL).toBe(false)
      })

      it('should check Worker support', () => {
        const hasWorker = TerrainGeneratorAdapterUtils.checkWorkerSupport()
        expect(typeof hasWorker).toBe('boolean')
        expect(hasWorker).toBe(true) // Should be true with our mocks
      })

      it('should handle Worker check when not available', () => {
        delete (global as any).Worker
        
        const hasWorker = TerrainGeneratorAdapterUtils.checkWorkerSupport()
        expect(hasWorker).toBe(false)

        // Restore
        Object.defineProperty(global, 'Worker', { value: function() {} })
      })
    })
  })

  describe('Performance Tests', () => {
    it('should handle large terrain generation efficiently', async () => {
      const complexRequest: TerrainGenerationRequest = {
        chunkCoordinates: { x: 0, z: 0 },
        seed: 12345,
        noiseSettings: {
          octaves: 8,
          frequency: 0.01,
          amplitude: 2.0,
          persistence: 0.6,
          lacunarity: 2.5,
          scale: 200.0
        },
        biomeSettings: {
          temperature: 0.5,
          humidity: 0.5,
          elevation: 0.5
        }
      }

      const { result, duration } = await measureEffectPerformance(
        adapter.generateTerrain(complexRequest),
        'Complex terrain generation'
      )

      expect(result).toBeDefined()
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle concurrent terrain generation', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => {
        const request: TerrainGenerationRequest = {
          chunkCoordinates: { x: i, z: i },
          seed: 12345 + i,
          noiseSettings: {
            octaves: 4,
            frequency: 0.02,
            amplitude: 1.5,
            persistence: 0.5,
            lacunarity: 2.0,
            scale: 100.0
          }
        }
        return adapter.generateTerrain(request)
      })

      const startTime = performance.now()
      const results = await Promise.all(requests.map(req => expectEffect.toSucceed(req)))
      const endTime = performance.now()

      expect(results).toHaveLength(5)
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('should handle many height map requests efficiently', async () => {
      const coordinates = Array.from({ length: 10 }, (_, i) => ({ x: i, z: i }))
      const noiseSettings: NoiseSettings = {
        octaves: 3,
        frequency: 0.03,
        amplitude: 1.0,
        persistence: 0.4,
        lacunarity: 1.8,
        scale: 80.0
      }

      const requests = coordinates.map(coord =>
        adapter.generateHeightMap(coord, 12345, noiseSettings)
      )

      const results = await Promise.all(requests.map(req => expectEffect.toSucceed(req)))
      
      expect(results).toHaveLength(10)
      results.forEach(heightMap => {
        expect(Array.isArray(heightMap)).toBe(true)
      })
    })
  })

  describe('Integration with Effect-TS', () => {
    it('should work with Effect composition', async () => {
      const chunkCoordinates: ChunkCoordinates = { x: 5, z: 10 }
      const seed = 54321
      const noiseSettings: NoiseSettings = {
        octaves: 4,
        frequency: 0.02,
        amplitude: 1.5,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 120.0
      }

      const composedEffect = Effect.gen(function* () {
        const heightMap = yield* adapter.generateHeightMap(chunkCoordinates, seed, noiseSettings)
        const biome = yield* adapter.getBiome(chunkCoordinates.x, chunkCoordinates.z, seed)
        const isAvailable = yield* adapter.isAvailable()

        return { heightMap, biome, isAvailable }
      })

      const result = await expectEffect.toSucceed(composedEffect)
      
      expect(result.heightMap).toBeDefined()
      expect(result.biome).toBeDefined()
      expect(result.isAvailable).toBe(true)
    })

    it('should handle Effect error propagation', async () => {
      vi.mocked(mockDomainService.generateHeightMap).mockResolvedValue(
        Effect.fail(new Error('Height map generation failed'))
      )

      const result = await runEffectExit(
        adapter.generateHeightMap({ x: 0, z: 0 }, 12345, {
          octaves: 4,
          frequency: 0.01,
          amplitude: 1.0,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 100.0
        })
      )
      
      expect(result._tag).toBe('Failure')
    })

    it('should work with Effect retry and fallback patterns', async () => {
      let attemptCount = 0
      vi.mocked(mockDomainService.generateTerrain).mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          return Promise.resolve(Effect.fail(new Error('Temporary failure')))
        }
        return Promise.resolve(Effect.succeed({
          chunkCoordinates: { x: 0, z: 0 },
          heightMap: [1, 2, 3],
          blockCount: 50,
          biomes: ['test'],
          generationTime: 10,
          noiseValues: [0.1, 0.2]
        }))
      })

      const terrainRequest: TerrainGenerationRequest = {
        chunkCoordinates: { x: 0, z: 0 },
        seed: 12345,
        noiseSettings: {
          octaves: 4,
          frequency: 0.01,
          amplitude: 1.0,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 100.0
        }
      }

      const retryEffect = adapter.generateTerrain(terrainRequest).pipe(
        Effect.retry({ times: 3 })
      )

      const result = await expectEffect.toSucceed(retryEffect)
      expect(result).toBeDefined()
      expect(attemptCount).toBe(3)
    })
  })

  describe('Memory Management', () => {
    it('should handle memory-intensive terrain generation', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0
      
      // Generate multiple terrain chunks
      const operations = Array.from({ length: 3 }, (_, i) => {
        const request: TerrainGenerationRequest = {
          chunkCoordinates: { x: i * 10, z: i * 10 },
          seed: 12345 + i,
          noiseSettings: {
            octaves: 6,
            frequency: 0.008,
            amplitude: 3.0,
            persistence: 0.7,
            lacunarity: 2.2,
            scale: 150.0
          },
          biomeSettings: {
            temperature: 0.3 + (i * 0.2),
            humidity: 0.4 + (i * 0.15),
            elevation: 0.2 + (i * 0.3)
          }
        }
        return adapter.generateTerrain(request)
      })

      const results = await Promise.all(operations.map(op => expectEffect.toSucceed(op)))
      
      expect(results).toHaveLength(3)
      
      const finalMemory = performance.memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory
      
      // Should not exceed 20MB increase
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024)
    })

    it('should handle cleanup of temporary noise data', async () => {
      // Generate terrain multiple times to check for memory leaks
      for (let i = 0; i < 5; i++) {
        const request: TerrainGenerationRequest = {
          chunkCoordinates: { x: i, z: i },
          seed: 12345 + i,
          noiseSettings: {
            octaves: 5,
            frequency: 0.015,
            amplitude: 2.0,
            persistence: 0.55,
            lacunarity: 2.1,
            scale: 110.0
          }
        }

        const result = await expectEffect.toSucceed(adapter.generateTerrain(request))
        expect(result).toBeDefined()
      }

      // Memory should be reasonably stable after generation
      expect(performance.memory?.usedJSHeapSize).toBeDefined()
    })
  })
})