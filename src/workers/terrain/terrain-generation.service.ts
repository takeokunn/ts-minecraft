import { Effect } from 'effect'
import { GenerateChunkMessage, ChunkGenerationResult } from '../shared/message-types'
import { BlockType } from '@/domain/block-types'
import { createNoise2D } from 'simplex-noise'
import alea from 'alea'

/**
 * Terrain generation logic
 */

const CHUNK_SIZE = 16
const CHUNK_HEIGHT = 256

/**
 * Generate height map for a chunk using simplex noise
 */
const generateHeightMap = (seed: number, chunkX: number, chunkZ: number): number[] => {
  const noise = createNoise2D(alea(seed))
  const heightMap: number[] = []
  
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const worldX = chunkX * CHUNK_SIZE + x
      const worldZ = chunkZ * CHUNK_SIZE + z
      
      // Multi-octave noise for more realistic terrain
      const scale1 = 0.01
      const scale2 = 0.05
      const scale3 = 0.1
      
      const height = 
        noise(worldX * scale1, worldZ * scale1) * 40 +
        noise(worldX * scale2, worldZ * scale2) * 20 +
        noise(worldX * scale3, worldZ * scale3) * 10 +
        64 // Base height
      
      heightMap.push(Math.floor(Math.max(1, Math.min(CHUNK_HEIGHT - 1, height))))
    }
  }
  
  return heightMap
}

/**
 * Generate blocks for a chunk based on height map
 */
const generateBlocks = (heightMap: number[]): BlockType[] => {
  const blocks: BlockType[] = []
  
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const index = z * CHUNK_SIZE + x
        const height = heightMap[index]
        
        let blockType: BlockType
        
        if (y > height) {
          blockType = BlockType.AIR
        } else if (y === height) {
          blockType = height > 62 ? BlockType.GRASS : BlockType.SAND
        } else if (y > height - 4) {
          blockType = height > 62 ? BlockType.DIRT : BlockType.SAND
        } else {
          blockType = BlockType.STONE
        }
        
        // Add water at sea level
        if (blockType === BlockType.AIR && y <= 62) {
          blockType = BlockType.WATER
        }
        
        blocks.push(blockType)
      }
    }
  }
  
  return blocks
}

/**
 * Main terrain generation handler
 */
export const generateTerrain = (message: GenerateChunkMessage): Effect.Effect<ChunkGenerationResult> =>
  Effect.gen(function* () {
    const { seed, coords } = message
    
    // Generate height map
    const heightMap = yield* Effect.sync(() => 
      generateHeightMap(seed, coords.x, coords.z)
    )
    
    // Generate blocks
    const blocks = yield* Effect.sync(() => 
      generateBlocks(heightMap)
    )
    
    return {
      type: 'chunk-generated' as const,
      coords,
      blocks,
      heightMap
    }
  })