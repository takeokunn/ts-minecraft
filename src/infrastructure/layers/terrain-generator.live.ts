import { Layer, Effect, Ref } from 'effect'
import { TerrainGenerator } from '@/services/world/terrain-generator.service'
import { ChunkCoordinates } from '@/core/values/coordinates/chunk-coordinates.value'
import { WorkerManager } from '@/services/worker/worker-manager.service'
import * as S from 'effect/Schema'

/**
 * TerrainGenerator Live implementation
 * Generates terrain data for chunks using Perlin noise
 */

// Schema definitions for worker communication
const GenerateTerrainRequest = S.Struct({
  type: S.Literal('generate-terrain'),
  coordinates: S.Struct({
    x: S.Number,
    z: S.Number,
  }),
  seed: S.Number,
})

const GenerateTerrainResponse = S.Struct({
  coordinates: S.Struct({
    x: S.Number,
    z: S.Number,
  }),
  blocks: S.Array(S.Number),
  heightMap: S.Array(S.Number),
})

export const TerrainGeneratorLive = Layer.effect(
  TerrainGenerator,
  Effect.gen(function* () {
    const workerManager = yield* WorkerManager
    const seed = yield* Ref.make(Math.random() * 10000)
    
    // Noise parameters
    const config = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 0.01,
      seaLevel: 62,
      maxHeight: 128,
    }
    
    // Generate terrain for a chunk
    const generateChunkTerrain = (coords: ChunkCoordinates) =>
      Effect.gen(function* () {
        const currentSeed = yield* Ref.get(seed)
        
        // Use worker for terrain generation
        const result = yield* workerManager.sendTask(
          'terrain-generation',
          {
            type: 'generate-terrain' as const,
            coordinates: { x: coords.x, z: coords.z },
            seed: currentSeed,
          },
          GenerateTerrainRequest,
          GenerateTerrainResponse
        )
        
        return {
          blocks: new Uint8Array(result.blocks),
          heightMap: result.heightMap,
        }
      })
    
    // Generate height at specific world coordinates
    const getHeightAt = (worldX: number, worldZ: number) =>
      Effect.gen(function* () {
        const currentSeed = yield* Ref.get(seed)
        
        // Simple height calculation (could be optimized with caching)
        const noise = generateNoise(worldX, worldZ, currentSeed)
        const height = Math.floor(config.seaLevel + noise * config.maxHeight)
        
        return Math.max(0, Math.min(255, height))
      })
    
    // Generate a height map for an area
    const generateHeightMap = (
      startX: number,
      startZ: number,
      width: number,
      depth: number
    ) =>
      Effect.gen(function* () {
        const heightMap: number[] = []
        
        for (let z = 0; z < depth; z++) {
          for (let x = 0; x < width; x++) {
            const worldX = startX + x
            const worldZ = startZ + z
            const height = yield* getHeightAt(worldX, worldZ)
            heightMap.push(height)
          }
        }
        
        return heightMap
      })
    
    // Get biome at coordinates
    const getBiomeAt = (worldX: number, worldZ: number) =>
      Effect.gen(function* () {
        const currentSeed = yield* Ref.get(seed)
        
        // Simple biome calculation based on noise
        const temperature = generateNoise(worldX * 0.001, worldZ * 0.001, currentSeed + 1000)
        const humidity = generateNoise(worldX * 0.001, worldZ * 0.001, currentSeed + 2000)
        
        if (temperature < -0.3) return 'tundra'
        if (temperature > 0.3 && humidity < -0.3) return 'desert'
        if (humidity > 0.3) return 'jungle'
        return 'plains'
      })
    
    // Set world seed
    const setSeed = (newSeed: number) =>
      Ref.set(seed, newSeed)
    
    // Get current seed
    const getSeed = () =>
      Ref.get(seed)
    
    // Simple noise function (placeholder - should use proper Perlin noise)
    const generateNoise = (x: number, z: number, seed: number): number => {
      // This is a simplified noise function
      // In production, use a proper Perlin noise implementation
      const hash = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453
      return (hash - Math.floor(hash)) * 2 - 1
    }
    
    return TerrainGenerator.of({
      generateChunkTerrain,
      getHeightAt,
      generateHeightMap,
      getBiomeAt,
      setSeed,
      getSeed,
      getConfig: () => Effect.succeed(config),
    })
  }).pipe(
    Effect.provide(Layer.service(WorkerManager))
  )
)