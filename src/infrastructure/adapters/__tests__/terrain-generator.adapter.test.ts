/**
 * Terrain Generator Adapter Tests
 * 
 * Comprehensive test suite for TerrainGeneratorAdapter using Effect-TS patterns.
 * Tests terrain generation, height maps, biome generation, and noise functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as TestContext from 'effect/TestContext'

import { 
  TerrainGeneratorAdapter, 
  TerrainGeneratorAdapterLive 
} from '../terrain-generator.adapter'
import type {
  TerrainGenerationRequest,
  ChunkCoordinates,
  NoiseSettings,
  BiomeConfig
} from '@domain/ports/terrain-generator.port'
import { TerrainGenerationDomainServiceLive } from '@domain/services/terrain-generation.domain-service'

// Helper to run effects in test context
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(
    Effect.provide(TerrainGeneratorAdapterLive),
    Effect.provide(TerrainGenerationDomainServiceLive),
    Effect.provide(TestContext.TestContext)
  ))

// Test data factories
const createTestChunkCoordinates = (x = 0, z = 0): ChunkCoordinates => ({
  chunkX: x,
  chunkZ: z
})

const createTestNoiseSettings = (): NoiseSettings => ({
  octaves: 4,
  frequency: 0.01,
  amplitude: 1.0,
  persistence: 0.5,
  lacunarity: 2.0,
  seed: 12345
})

const createTestTerrainGenerationRequest = (
  coordinates: ChunkCoordinates = createTestChunkCoordinates(),
  chunkSize = 16,
  seed = 12345
): TerrainGenerationRequest => ({
  coordinates,
  chunkSize,
  seed,
  noiseSettings: createTestNoiseSettings(),
  biomeSettings: {
    temperatureNoise: createTestNoiseSettings(),
    humidityNoise: createTestNoiseSettings(),
    biomes: ['plains', 'desert', 'forest', 'mountains']
  }
})

describe('TerrainGeneratorAdapter', () => {
  describe('Basic Functionality', () => {
    it('should be available for terrain generation', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter

        const available = yield* adapter.isAvailable()
        expect(available).toBe(true)
      }))
    })

    it('should generate noise values correctly', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const seed = 12345

        const noise1 = yield* adapter.generateNoise(0, 0, 0, seed)
        const noise2 = yield* adapter.generateNoise(1, 0, 0, seed)
        const noise3 = yield* adapter.generateNoise(0, 0, 0, seed) // Same as noise1

        // Noise values should be in valid range [0, 1]
        expect(noise1).toBeGreaterThanOrEqual(0)
        expect(noise1).toBeLessThanOrEqual(1)
        expect(noise2).toBeGreaterThanOrEqual(0)
        expect(noise2).toBeLessThanOrEqual(1)

        // Same coordinates should produce same noise
        expect(noise3).toBe(noise1)

        // Different coordinates should produce different noise (usually)
        expect(noise1).not.toBe(noise2)
      }))
    })

    it('should generate consistent noise with same seed', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const seed = 54321

        // Generate noise at same coordinates with same seed multiple times
        const noiseValues = []
        for (let i = 0; i < 5; i++) {
          const noise = yield* adapter.generateNoise(10, 20, 30, seed)
          noiseValues.push(noise)
        }

        // All values should be identical
        const firstValue = noiseValues[0]
        for (const value of noiseValues) {
          expect(value).toBe(firstValue)
        }
      }))
    })

    it('should generate different noise with different seeds', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const x = 5
        const y = 10
        const z = 15

        const noise1 = yield* adapter.generateNoise(x, y, z, 111)
        const noise2 = yield* adapter.generateNoise(x, y, z, 222)
        const noise3 = yield* adapter.generateNoise(x, y, z, 333)

        // Different seeds should produce different noise values
        expect(noise1).not.toBe(noise2)
        expect(noise2).not.toBe(noise3)
        expect(noise1).not.toBe(noise3)

        // All should still be in valid range
        [noise1, noise2, noise3].forEach(noise => {
          expect(noise).toBeGreaterThanOrEqual(0)
          expect(noise).toBeLessThanOrEqual(1)
        })
      }))
    })
  })

  describe('Height Map Generation', () => {
    it('should generate height map for chunk', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const coordinates = createTestChunkCoordinates(0, 0)
        const seed = 12345
        const noiseSettings = createTestNoiseSettings()

        const heightMap = yield* adapter.generateHeightMap(coordinates, seed, noiseSettings)

        // Height map should have correct size for 16x16 chunk
        expect(heightMap.length).toBe(16 * 16) // 256 values

        // All height values should be valid
        heightMap.forEach(height => {
          expect(typeof height).toBe('number')
          expect(height).toBeGreaterThanOrEqual(0)
          expect(height).toBeLessThan(256) // Reasonable height limit
        })
      }))
    })

    it('should generate consistent height maps for same coordinates', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const coordinates = createTestChunkCoordinates(1, 1)
        const seed = 54321
        const noiseSettings = createTestNoiseSettings()

        const heightMap1 = yield* adapter.generateHeightMap(coordinates, seed, noiseSettings)
        const heightMap2 = yield* adapter.generateHeightMap(coordinates, seed, noiseSettings)

        // Should be identical
        expect(heightMap1).toEqual(heightMap2)
      }))
    })

    it('should generate different height maps for different coordinates', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const seed = 98765
        const noiseSettings = createTestNoiseSettings()

        const heightMap1 = yield* adapter.generateHeightMap(createTestChunkCoordinates(0, 0), seed, noiseSettings)
        const heightMap2 = yield* adapter.generateHeightMap(createTestChunkCoordinates(1, 0), seed, noiseSettings)
        const heightMap3 = yield* adapter.generateHeightMap(createTestChunkCoordinates(0, 1), seed, noiseSettings)

        // Should be different (at least some values)
        expect(heightMap1).not.toEqual(heightMap2)
        expect(heightMap2).not.toEqual(heightMap3)
        expect(heightMap1).not.toEqual(heightMap3)

        // But all should have same length
        expect(heightMap1.length).toBe(heightMap2.length)
        expect(heightMap2.length).toBe(heightMap3.length)
      }))
    })

    it('should respect noise settings parameters', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const coordinates = createTestChunkCoordinates(2, 2)
        const seed = 11111

        // Low amplitude noise settings
        const lowAmplitudeSettings: NoiseSettings = {
          octaves: 1,
          frequency: 0.01,
          amplitude: 0.1, // Very low amplitude
          persistence: 0.5,
          lacunarity: 2.0,
          seed
        }

        // High amplitude noise settings
        const highAmplitudeSettings: NoiseSettings = {
          octaves: 1,
          frequency: 0.01,
          amplitude: 10.0, // High amplitude
          persistence: 0.5,
          lacunarity: 2.0,
          seed
        }

        const lowHeightMap = yield* adapter.generateHeightMap(coordinates, seed, lowAmplitudeSettings)
        const highHeightMap = yield* adapter.generateHeightMap(coordinates, seed, highAmplitudeSettings)

        // Calculate average heights
        const lowAverage = lowHeightMap.reduce((a, b) => a + b, 0) / lowHeightMap.length
        const highAverage = highHeightMap.reduce((a, b) => a + b, 0) / highHeightMap.length

        // High amplitude should generally produce more varied terrain
        const lowVariance = lowHeightMap.reduce((sum, h) => sum + Math.pow(h - lowAverage, 2), 0) / lowHeightMap.length
        const highVariance = highHeightMap.reduce((sum, h) => sum + Math.pow(h - highAverage, 2), 0) / highHeightMap.length

        expect(highVariance).toBeGreaterThan(lowVariance)
      }))
    })
  })

  describe('Biome Generation', () => {
    it('should generate biome for coordinates', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const seed = 33333

        const biome = yield* adapter.getBiome(10, 20, seed)

        expect(biome).toBeDefined()
        expect(typeof biome.name).toBe('string')
        expect(biome.name.length).toBeGreaterThan(0)
        expect(typeof biome.temperature).toBe('number')
        expect(typeof biome.humidity).toBe('number')
        expect(Array.isArray(biome.blocks)).toBe(true)

        // Temperature and humidity should be in reasonable ranges
        expect(biome.temperature).toBeGreaterThanOrEqual(-1)
        expect(biome.temperature).toBeLessThanOrEqual(1)
        expect(biome.humidity).toBeGreaterThanOrEqual(0)
        expect(biome.humidity).toBeLessThanOrEqual(1)
      }))
    })

    it('should generate consistent biomes for same coordinates', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const x = 100
        const z = 200
        const seed = 44444

        const biome1 = yield* adapter.getBiome(x, z, seed)
        const biome2 = yield* adapter.getBiome(x, z, seed)

        // Should be identical
        expect(biome1).toEqual(biome2)
      }))
    })

    it('should generate different biomes for different coordinates', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const seed = 55555

        const biome1 = yield* adapter.getBiome(0, 0, seed)
        const biome2 = yield* adapter.getBiome(100, 0, seed)
        const biome3 = yield* adapter.getBiome(0, 100, seed)
        const biome4 = yield* adapter.getBiome(1000, 1000, seed)

        // Not all biomes should be identical (though some might be due to biome distribution)
        const biomeNames = [biome1.name, biome2.name, biome3.name, biome4.name]
        const uniqueBiomes = new Set(biomeNames)
        
        // Should have at least 2 different biomes out of 4 samples
        expect(uniqueBiomes.size).toBeGreaterThanOrEqual(2)
      }))
    })

    it('should generate valid biome properties', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const seed = 66666

        // Test multiple coordinates to check biome variety
        const coordinates = [
          [0, 0], [100, 0], [0, 100], [100, 100],
          [500, 0], [0, 500], [1000, 1000]
        ]

        for (const [x, z] of coordinates) {
          const biome = yield* adapter.getBiome(x, z, seed)

          // Check all required properties exist
          expect(biome.name).toBeDefined()
          expect(biome.temperature).toBeDefined()
          expect(biome.humidity).toBeDefined()
          expect(biome.blocks).toBeDefined()

          // Check reasonable value ranges
          expect(typeof biome.name).toBe('string')
          expect(biome.name.length).toBeGreaterThan(0)
          expect(typeof biome.temperature).toBe('number')
          expect(typeof biome.humidity).toBe('number')
          expect(Array.isArray(biome.blocks)).toBe(true)
          expect(biome.blocks.length).toBeGreaterThan(0)

          // Blocks should be valid block type strings
          biome.blocks.forEach(block => {
            expect(typeof block).toBe('string')
            expect(block.length).toBeGreaterThan(0)
          })
        }
      }))
    })
  })

  describe('Full Terrain Generation', () => {
    it('should generate complete terrain for chunk', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const request = createTestTerrainGenerationRequest()

        const result = yield* adapter.generateTerrain(request)

        expect(result.success).toBe(true)
        expect(result.chunkData).toBeDefined()

        if (result.chunkData) {
          expect(result.chunkData.chunkX).toBe(request.coordinates.chunkX)
          expect(result.chunkData.chunkZ).toBe(request.coordinates.chunkZ)
          expect(result.chunkData.blocks).toBeDefined()
          expect(result.chunkData.blocks.length).toBe(request.chunkSize ** 3)
          expect(result.chunkData.chunkSize).toBe(request.chunkSize)

          // Should have valid block types
          expect(Array.isArray(result.chunkData.blockTypes)).toBe(true)
          expect(result.chunkData.blockTypes.length).toBeGreaterThan(0)
        }

        expect(result.metadata).toBeDefined()
        expect(result.metadata.generationTimeMs).toBeGreaterThan(0)
        expect(result.metadata.seed).toBe(request.seed)
        expect(result.metadata.chunkSize).toBe(request.chunkSize)
      }))
    })

    it('should generate consistent terrain for same request', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const request = createTestTerrainGenerationRequest(
          createTestChunkCoordinates(3, 3),
          8,
          77777
        )

        const result1 = yield* adapter.generateTerrain(request)
        const result2 = yield* adapter.generateTerrain(request)

        expect(result1.success).toBe(true)
        expect(result2.success).toBe(true)

        // Chunk data should be identical
        expect(result1.chunkData?.blocks).toEqual(result2.chunkData?.blocks)
        expect(result1.chunkData?.blockTypes).toEqual(result2.chunkData?.blockTypes)
      }))
    })

    it('should generate different terrain for different coordinates', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const seed = 88888

        const request1 = createTestTerrainGenerationRequest(createTestChunkCoordinates(0, 0), 8, seed)
        const request2 = createTestTerrainGenerationRequest(createTestChunkCoordinates(5, 0), 8, seed)
        const request3 = createTestTerrainGenerationRequest(createTestChunkCoordinates(0, 5), 8, seed)

        const result1 = yield* adapter.generateTerrain(request1)
        const result2 = yield* adapter.generateTerrain(request2)
        const result3 = yield* adapter.generateTerrain(request3)

        expect(result1.success).toBe(true)
        expect(result2.success).toBe(true)
        expect(result3.success).toBe(true)

        // Block arrays should be different
        expect(result1.chunkData?.blocks).not.toEqual(result2.chunkData?.blocks)
        expect(result2.chunkData?.blocks).not.toEqual(result3.chunkData?.blocks)
        expect(result1.chunkData?.blocks).not.toEqual(result3.chunkData?.blocks)
      }))
    })

    it('should handle different chunk sizes', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const coordinates = createTestChunkCoordinates(1, 1)
        const seed = 99999

        const sizes = [4, 8, 16]
        const results = []

        for (const size of sizes) {
          const request = createTestTerrainGenerationRequest(coordinates, size, seed)
          const result = yield* adapter.generateTerrain(request)
          results.push(result)

          expect(result.success).toBe(true)
          expect(result.chunkData?.blocks.length).toBe(size ** 3)
          expect(result.chunkData?.chunkSize).toBe(size)
        }

        // All should succeed but have different block counts
        const blockCounts = results.map(r => r.chunkData?.blocks.length || 0)
        expect(blockCounts[0]).toBeLessThan(blockCounts[1])
        expect(blockCounts[1]).toBeLessThan(blockCounts[2])
      }))
    })

    it('should include biome information in generated terrain', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const request = createTestTerrainGenerationRequest()

        const result = yield* adapter.generateTerrain(request)

        expect(result.success).toBe(true)
        expect(result.metadata.biomeData).toBeDefined()

        if (result.metadata.biomeData) {
          expect(Array.isArray(result.metadata.biomeData.biomes)).toBe(true)
          expect(result.metadata.biomeData.biomes.length).toBeGreaterThan(0)
          expect(typeof result.metadata.biomeData.dominantBiome).toBe('string')
        }
      }))
    })
  })

  describe('Performance Characteristics', () => {
    it('should complete terrain generation within reasonable time', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const request = createTestTerrainGenerationRequest(
          createTestChunkCoordinates(10, 10),
          16 // Full-size chunk
        )

        const startTime = Date.now()
        const result = yield* adapter.generateTerrain(request)
        const endTime = Date.now()

        const actualTime = endTime - startTime
        const reportedTime = result.metadata.generationTimeMs

        expect(result.success).toBe(true)
        expect(reportedTime).toBeGreaterThan(0)
        expect(reportedTime).toBeLessThan(10000) // Should complete within 10 seconds
        expect(Math.abs(actualTime - reportedTime)).toBeLessThan(100) // Times should be close
      }))
    })

    it('should handle concurrent terrain generation', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter

        // Create multiple different requests
        const requests = [
          createTestTerrainGenerationRequest(createTestChunkCoordinates(0, 0), 8),
          createTestTerrainGenerationRequest(createTestChunkCoordinates(1, 0), 8),
          createTestTerrainGenerationRequest(createTestChunkCoordinates(0, 1), 8),
          createTestTerrainGenerationRequest(createTestChunkCoordinates(1, 1), 8)
        ]

        // Generate all terrain concurrently
        const effects = requests.map(request => adapter.generateTerrain(request))
        const results = yield* Effect.all(effects, { concurrency: 4 })

        // All should succeed
        expect(results.length).toBe(4)
        results.forEach(result => {
          expect(result.success).toBe(true)
          expect(result.chunkData?.blocks.length).toBe(8 ** 3)
        })
      }))
    })

    it('should scale reasonably with chunk size', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const coordinates = createTestChunkCoordinates(0, 0)
        const seed = 123456

        // Test different chunk sizes and measure generation time
        const sizes = [4, 8, 16]
        const times = []

        for (const size of sizes) {
          const request = createTestTerrainGenerationRequest(coordinates, size, seed)
          const result = yield* adapter.generateTerrain(request)
          
          expect(result.success).toBe(true)
          times.push(result.metadata.generationTimeMs)
        }

        // Larger chunks should generally take more time (though this is heuristic)
        // At minimum, they shouldn't take less time
        expect(times[1]).toBeGreaterThanOrEqual(times[0] * 0.5) // Allow some variance
        expect(times[2]).toBeGreaterThanOrEqual(times[1] * 0.5) // Allow some variance
      }))
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid noise settings gracefully', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter

        const invalidNoiseSettings: NoiseSettings = {
          octaves: -1, // Invalid
          frequency: 0,
          amplitude: 0,
          persistence: -0.5,
          lacunarity: 0,
          seed: NaN
        }

        const request: TerrainGenerationRequest = {
          coordinates: createTestChunkCoordinates(),
          chunkSize: 8,
          seed: 12345,
          noiseSettings: invalidNoiseSettings,
          biomeSettings: {
            temperatureNoise: createTestNoiseSettings(),
            humidityNoise: createTestNoiseSettings(),
            biomes: ['plains']
          }
        }

        const result = yield* Effect.exit(adapter.generateTerrain(request))

        // Should handle gracefully, either by failing or by using default values
        if (result._tag === 'Success') {
          // If it succeeds, it should still produce valid terrain
          expect(result.value.success).toBe(true)
        } else {
          // If it fails, it should be a proper error
          expect(result._tag).toBe('Failure')
        }
      }))
    })

    it('should handle invalid chunk size', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter

        const request = createTestTerrainGenerationRequest(
          createTestChunkCoordinates(),
          0 // Invalid chunk size
        )

        const result = yield* Effect.exit(adapter.generateTerrain(request))

        expect(result._tag).toBe('Failure')
      }))
    })

    it('should handle extreme coordinates', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter

        // Test with very large coordinates
        const extremeRequest = createTestTerrainGenerationRequest(
          createTestChunkCoordinates(1000000, -1000000),
          8
        )

        const result = yield* adapter.generateTerrain(extremeRequest)

        // Should handle extreme coordinates gracefully
        expect(result.success).toBe(true)
        expect(result.chunkData?.blocks.length).toBe(8 ** 3)
      }))
    })
  })

  describe('Edge Cases', () => {
    it('should handle minimum chunk size', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter

        const request = createTestTerrainGenerationRequest(
          createTestChunkCoordinates(),
          2 // Very small but valid chunk size
        )

        const result = yield* adapter.generateTerrain(request)

        expect(result.success).toBe(true)
        expect(result.chunkData?.blocks.length).toBe(2 ** 3) // 8 blocks
        expect(result.chunkData?.chunkSize).toBe(2)
      }))
    })

    it('should handle zero coordinates consistently', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter

        // Generate terrain at origin multiple times
        const request = createTestTerrainGenerationRequest(createTestChunkCoordinates(0, 0))

        const results = []
        for (let i = 0; i < 3; i++) {
          const result = yield* adapter.generateTerrain(request)
          results.push(result)
        }

        // All should be identical
        expect(results[0].chunkData?.blocks).toEqual(results[1].chunkData?.blocks)
        expect(results[1].chunkData?.blocks).toEqual(results[2].chunkData?.blocks)
      }))
    })

    it('should produce valid terrain across chunk boundaries', async () => {
      await runTest(Effect.gen(function* () {
        const adapter = yield* TerrainGeneratorAdapter
        const seed = 555555

        // Generate adjacent chunks
        const chunk1 = yield* adapter.generateTerrain(
          createTestTerrainGenerationRequest(createTestChunkCoordinates(0, 0), 4, seed)
        )
        const chunk2 = yield* adapter.generateTerrain(
          createTestTerrainGenerationRequest(createTestChunkCoordinates(1, 0), 4, seed)
        )

        expect(chunk1.success).toBe(true)
        expect(chunk2.success).toBe(true)

        // Both chunks should have valid terrain
        expect(chunk1.chunkData?.blocks.length).toBe(4 ** 3)
        expect(chunk2.chunkData?.blocks.length).toBe(4 ** 3)

        // Chunks should be different but both valid
        expect(chunk1.chunkData?.blocks).not.toEqual(chunk2.chunkData?.blocks)
      }))
    })
  })
})