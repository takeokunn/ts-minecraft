/**
 * Terrain Generation Worker
 * Dedicated worker for generating terrain chunks with advanced algorithms
 */

import { Effect, Duration } from 'effect'
import { createTypedWorker, type TypedWorkerConfig, type WorkerHandlerContext } from '@infrastructure/workers/base/typed-worker'
import {
  TerrainGenerationRequest,
  TerrainGenerationResponse,
  ChunkData,
  Position3D,
  Block,
  createDefaultBiome,
  createDefaultNoiseSettings,
  createTransferableMeshData,
  PerformanceMetrics,
} from '@infrastructure/workers/unified/protocols/terrain.protocol'

/**
 * Simple noise function for terrain generation
 * In a real implementation, this would use more sophisticated noise algorithms
 */
function simpleNoise(x: number, y: number, z: number, seed: number): number {
  const n = Math.sin(x * 0.1 + seed) * Math.cos(y * 0.1 + seed) * Math.sin(z * 0.1 + seed)
  return (n + 1) / 2 // Normalize to 0-1
}

/**
 * Generate height map for chunk
 */
function generateHeightMap(chunkX: number, chunkZ: number, seed: number, noiseSettings: any): number[] {
  const heightMap: number[] = []
  const chunkSize = 16

  for (let z = 0; z < chunkSize; z++) {
    for (let x = 0; x < chunkSize; x++) {
      const worldX = chunkX * chunkSize + x
      const worldZ = chunkZ * chunkSize + z

      let height = 0
      let amplitude = 1
      let frequency = noiseSettings.scale

      for (let octave = 0; octave < noiseSettings.octaves; octave++) {
        height += simpleNoise(worldX * frequency, 0, worldZ * frequency, seed) * amplitude
        amplitude *= noiseSettings.persistence
        frequency *= noiseSettings.lacunarity
      }

      height = Math.floor(height * noiseSettings.heightMultiplier + noiseSettings.baseHeight)
      height = Math.max(1, Math.min(255, height))

      heightMap.push(height)
    }
  }

  return heightMap
}

/**
 * Generate blocks for chunk based on height map
 */
function generateBlocks(chunkX: number, chunkZ: number, heightMap: number[], biome: any, features: any): Block[] {
  const blocks: Block[] = []
  const chunkSize = 16
  const maxHeight = 256

  for (let y = 0; y < maxHeight; y++) {
    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const heightIndex = z * chunkSize + x
        const terrainHeight = heightMap[heightIndex]
        const worldX = chunkX * chunkSize + x
        const worldY = y
        const worldZ = chunkZ * chunkSize + z

        let blockType: any = 'air'

        if (y === 0) {
          blockType = 'bedrock'
        } else if (y <= terrainHeight - 4) {
          blockType = 'stone'

          // Add ore generation
          if (features.generateOres) {
            const oreNoise = simpleNoise(worldX, worldY, worldZ, 12345)
            if (oreNoise > 0.95 && y < 64) blockType = 'coal_ore'
            else if (oreNoise > 0.98 && y < 32) blockType = 'iron_ore'
            else if (oreNoise > 0.995 && y < 16) blockType = 'diamond_ore'
          }
        } else if (y <= terrainHeight - 1) {
          blockType = 'dirt'
        } else if (y === terrainHeight) {
          // Surface block based on biome
          switch (biome.type) {
            case 'desert':
              blockType = 'sand'
              break
            case 'ocean':
              blockType = 'sand'
              break
            case 'swamp':
              blockType = 'dirt'
              break
            default:
              blockType = 'grass'
              break
          }
        } else if (y <= 62 && biome.type === 'ocean') {
          blockType = 'water'
        }

        if (blockType !== 'air') {
          const position: Position3D = { x: worldX, y: worldY, z: worldZ }
          blocks.push({
            position,
            blockType,
            lightLevel: y > terrainHeight ? 15 : Math.max(0, 15 - (terrainHeight - y)),
          })
        }
      }
    }
  }

  return blocks
}

/**
 * Main terrain generation handler
 */
const terrainGenerationHandler = (request: TerrainGenerationRequest, context: WorkerHandlerContext): Effect.Effect<TerrainGenerationResponse, never, never> =>
  Effect.gen(function* () {
    const startTime = performance.now()

    const { coordinates, seed, biome, noise, features, options } = request

    // Generate height map
    const heightMap = generateHeightMap(coordinates.x, coordinates.z, seed, noise)

    // Generate blocks
    const blocks = generateBlocks(coordinates.x, coordinates.z, heightMap, biome, features)

    // Create biome map (simplified - single biome for entire chunk)
    const biomeMap = new Array(16 * 16).fill(biome.type)

    // Generate chunk data
    const chunkData: ChunkData = {
      coordinates,
      blocks,
      heightMap,
      biomeMap,
      generationTime: performance.now() - startTime,
      blockCount: blocks.length,
      timestamp: Date.now(),
      edgeBoundaries: {
        north: blocks.filter((b) => b.position.z === coordinates.z * 16),
        south: blocks.filter((b) => b.position.z === coordinates.z * 16 + 15),
        east: blocks.filter((b) => b.position.x === coordinates.x * 16 + 15),
        west: blocks.filter((b) => b.position.x === coordinates.x * 16),
      },
    }

    // Generate mesh data if requested
    let meshData
    if (options?.generateMeshData) {
      // Simplified mesh generation - in reality this would be much more complex
      const positions: number[] = []
      const normals: number[] = []
      const uvs: number[] = []
      const indices: number[] = []

      let vertexIndex = 0
      for (const block of blocks) {
        // Add 6 faces for each block (simplified)
        const { x, y, z } = block.position

        // Front face
        positions.push(x, y, z, x + 1, y, z, x + 1, y + 1, z, x, y + 1, z)
        normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1)
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1)
        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3)
        vertexIndex += 4
      }

      meshData = createTransferableMeshData({ positions, normals, uvs, indices })
    }

    const metrics: PerformanceMetrics = {
      totalTime: performance.now() - startTime,
      terrainGenerationTime: performance.now() - startTime,
      meshGenerationTime: meshData ? 0 : undefined,
      blocksGenerated: blocks.length,
      featuresGenerated: 0,
    }

    return {
      chunkData,
      meshData,
      metrics,
      success: true,
      workerId: `terrain-worker-${context.messageId}`,
      workerCapabilities: context.capabilities,
    } as TerrainGenerationResponse
  })

/**
 * Terrain worker configuration
 */
const terrainWorkerConfig: TypedWorkerConfig<TerrainGenerationRequest, TerrainGenerationResponse> = {
  name: 'terrain-generation-worker',
  inputSchema: TerrainGenerationRequest,
  outputSchema: TerrainGenerationResponse,
  handler: terrainGenerationHandler,
  timeout: Duration.seconds(30),
}

// Initialize the typed worker
Effect.runPromise(createTypedWorker(terrainWorkerConfig))
