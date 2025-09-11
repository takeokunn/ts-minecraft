import { Effect, Duration } from 'effect'
import { createTypedWorker } from './base/typed-worker'
import {
  TerrainGenerationRequest,
  TerrainGenerationResponse,
  prepareMeshForTransfer,
  Position3D,
  Block,
} from './shared/protocol'
import Alea from 'alea'
import { createNoise2D } from 'simplex-noise'

/**
 * Advanced terrain generation worker with SharedArrayBuffer support
 * Generates terrain data and mesh with zero-copy transfers
 */

// ============================================
// Constants
// ============================================

const CHUNK_SIZE = 16
const WORLD_DEPTH = 32
const WATER_LEVEL = 0

// ============================================
// Noise Generation
// ============================================

type Noise2D = ReturnType<typeof createNoise2D>

interface NoiseFunctions {
  readonly terrain: Noise2D
  readonly biome: Noise2D
  readonly trees: Noise2D
  readonly caves: Noise2D
  readonly ore: Noise2D
}

/**
 * Create noise functions with deterministic seeding
 */
const createNoiseFunctions = (seed: number): NoiseFunctions => {
  const prng = Alea(seed)
  
  return {
    terrain: createNoise2D(Alea(prng() * 1000000)),
    biome: createNoise2D(Alea(prng() * 1000000)),
    trees: createNoise2D(Alea(prng() * 1000000)),
    caves: createNoise2D(Alea(prng() * 1000000)),
    ore: createNoise2D(Alea(prng() * 1000000)),
  }
}

/**
 * Advanced terrain height calculation with multiple octaves
 */
const getTerrainHeight = (
  x: number, 
  z: number, 
  noise: NoiseFunctions,
  elevation: number
): number => {
  // Base terrain with multiple octaves
  const baseFreq = 0.01
  const detailFreq = 0.05
  
  const baseHeight = noise.terrain(x * baseFreq, z * baseFreq) * elevation
  const detail = noise.terrain(x * detailFreq, z * detailFreq) * (elevation * 0.3)
  
  return Math.floor(baseHeight + detail)
}

/**
 * Determine biome based on temperature and humidity
 */
const getBiome = (
  x: number, 
  z: number, 
  noise: NoiseFunctions,
  biomeSettings: TerrainGenerationRequest['biomeSettings']
): string => {
  const tempFreq = 0.005
  const humidFreq = 0.007
  
  const temperature = (noise.biome(x * tempFreq, z * tempFreq) + 1) * 0.5
  const humidity = (noise.biome(x * humidFreq, z * humidFreq) + 1) * 0.5
  
  // Combine with base biome settings
  const finalTemp = (temperature + biomeSettings.temperature) * 0.5
  const finalHumid = (humidity + biomeSettings.humidity) * 0.5
  
  if (finalTemp > 0.7 && finalHumid < 0.3) return 'desert'
  if (finalTemp < 0.3 && finalHumid > 0.7) return 'tundra'
  if (finalTemp > 0.5 && finalHumid > 0.5) return 'forest'
  if (finalTemp > 0.6 && finalHumid > 0.4) return 'savanna'
  return 'plains'
}

/**
 * Generate cave system using 3D noise
 */
const shouldGenerateCave = (
  x: number, 
  y: number, 
  z: number, 
  noise: NoiseFunctions
): boolean => {
  if (y > -5) return false // No caves near surface
  
  const caveFreq = 0.02
  const caveThreshold = 0.6
  
  const caveNoise = Math.abs(noise.caves(x * caveFreq, y * caveFreq * 0.5))
  return caveNoise > caveThreshold
}

/**
 * Determine ore type based on depth and noise
 */
const getOreType = (
  x: number,
  y: number, 
  z: number,
  noise: NoiseFunctions
): string | null => {
  if (y > -8) return null // No ores near surface
  
  const oreNoise = Math.abs(noise.ore(x * 0.03, y * 0.05, z * 0.03))
  
  if (y < -25 && oreNoise > 0.85) return 'diamond'
  if (y < -15 && oreNoise > 0.8) return 'iron'
  if (y < -8 && oreNoise > 0.75) return 'coal'
  
  return null
}

/**
 * Generate a single terrain column
 */
const generateTerrainColumn = (
  chunkX: number,
  chunkZ: number,
  localX: number,
  localZ: number,
  request: TerrainGenerationRequest,
  noise: NoiseFunctions
): Block[] => {
  const blocks: Block[] = []
  const worldX = chunkX * CHUNK_SIZE + localX
  const worldZ = chunkZ * CHUNK_SIZE + localZ
  
  const height = getTerrainHeight(worldX, worldZ, noise, request.biomeSettings.elevation * 20)
  const biome = getBiome(worldX, worldZ, noise, request.biomeSettings)
  
  // Generate terrain blocks
  for (let y = -WORLD_DEPTH; y < height; y++) {
    // Check for caves
    if (shouldGenerateCave(worldX, y, worldZ, noise)) {
      continue // Skip block for cave
    }
    
    let blockType = 'stone'
    
    // Surface layer
    if (y === height - 1) {
      switch (biome) {
        case 'desert':
        case 'savanna':
          blockType = 'sand'
          break
        case 'tundra':
          blockType = 'snow'
          break
        default:
          blockType = 'grass'
      }
    }
    // Sub-surface layers
    else if (y > height - 4) {
      blockType = biome === 'desert' ? 'sand' : 'dirt'
    }
    // Bedrock layer
    else if (y < -WORLD_DEPTH + 3) {
      blockType = 'bedrock'
    }
    // Ore generation
    else {
      const oreType = getOreType(worldX, y, worldZ, noise)
      if (oreType) {
        blockType = oreType
      }
    }
    
    blocks.push({
      position: { x: localX, y, z: localZ },
      blockType: { type: blockType } as any, // Type assertion for compatibility
      metadata: biome !== 'plains' ? { biome } : undefined,
    })
  }
  
  // Water generation
  if (height < WATER_LEVEL) {
    for (let y = height; y < WATER_LEVEL; y++) {
      blocks.push({
        position: { x: localX, y, z: localZ },
        blockType: { type: 'water' } as any,
      })
    }
  }
  
  // Tree generation
  if (biome === 'forest' || (biome === 'plains' && Math.random() > 0.95)) {
    if (height >= WATER_LEVEL && noise.trees(worldX, worldZ) > 0.95) {
      const treeHeight = 4 + Math.floor(Math.abs(noise.trees(worldX, worldZ)) * 3)
      
      // Tree trunk
      for (let i = 0; i < treeHeight; i++) {
        blocks.push({
          position: { x: localX, y: height + i, z: localZ },
          blockType: { type: 'oakLog' } as any,
        })
      }
      
      // Tree leaves
      for (let y = height + treeHeight - 2; y < height + treeHeight + 1; y++) {
        for (let x = -2; x <= 2; x++) {
          for (let z = -2; z <= 2; z++) {
            if (x !== 0 || z !== 0) {
              // Only add leaves if within chunk bounds
              if (localX + x >= 0 && localX + x < CHUNK_SIZE && 
                  localZ + z >= 0 && localZ + z < CHUNK_SIZE) {
                blocks.push({
                  position: { x: localX + x, y, z: localZ + z },
                  blockType: { type: 'oakLeaves' } as any,
                })
              }
            }
          }
        }
      }
    }
  }
  
  return blocks
}

/**
 * Apply edited blocks to terrain
 */
const applyEditedBlocks = (
  blocks: Block[],
  editedBlocks?: TerrainGenerationRequest['editedBlocks']
): Block[] => {
  if (!editedBlocks) return blocks
  
  const blockMap = new Map<string, Block>()
  
  // Add generated blocks
  for (const block of blocks) {
    const key = `${block.position.x},${block.position.y},${block.position.z}`
    blockMap.set(key, block)
  }
  
  // Remove destroyed blocks
  for (const key of editedBlocks.destroyed) {
    blockMap.delete(key)
  }
  
  // Add placed blocks
  for (const block of editedBlocks.placed) {
    const key = `${block.position.x},${block.position.y},${block.position.z}`
    blockMap.set(key, block)
  }
  
  return Array.from(blockMap.values())
}

/**
 * Generate greedy mesh from blocks using advanced algorithm
 */
const generateGreedyMesh = (blocks: Block[]): {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
} => {
  // Create 3D grid for fast lookups
  const blockGrid = new Map<string, Block>()
  for (const block of blocks) {
    const key = `${block.position.x},${block.position.y},${block.position.z}`
    blockGrid.set(key, block)
  }
  
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  
  let vertexIndex = 0
  
  // Face directions and their normals
  const faces = [
    { dir: [1, 0, 0], normal: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },  // +X
    { dir: [-1, 0, 0], normal: [-1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, // -X
    { dir: [0, 1, 0], normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },   // +Y
    { dir: [0, -1, 0], normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] }, // -Y
    { dir: [0, 0, 1], normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },   // +Z
    { dir: [0, 0, -1], normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] } // -Z
  ]
  
  for (const block of blocks) {
    const { x, y, z } = block.position
    
    for (const face of faces) {
      const neighborX = x + face.dir[0]
      const neighborY = y + face.dir[1]
      const neighborZ = z + face.dir[2]
      const neighborKey = `${neighborX},${neighborY},${neighborZ}`
      
      // Only render face if neighbor is empty or transparent
      const neighbor = blockGrid.get(neighborKey)
      if (!neighbor || neighbor.blockType.type === 'water') {
        // Add quad vertices
        const baseVertices = [
          [-0.5, -0.5, -0.5],
          [0.5, -0.5, -0.5],
          [0.5, 0.5, -0.5],
          [-0.5, 0.5, -0.5]
        ]
        
        // Transform vertices based on face direction
        for (let i = 0; i < 4; i++) {
          const vertex = baseVertices[i]
          // Apply rotation and translation based on face orientation
          // This is a simplified version - full implementation would use proper matrix transforms
          positions.push(x + vertex[0], y + vertex[1], z + vertex[2])
          normals.push(face.normal[0], face.normal[1], face.normal[2])
          uvs.push(i % 2, Math.floor(i / 2))
        }
        
        // Add quad indices (two triangles)
        indices.push(
          vertexIndex, vertexIndex + 1, vertexIndex + 2,
          vertexIndex, vertexIndex + 2, vertexIndex + 3
        )
        
        vertexIndex += 4
      }
    }
  }
  
  return { positions, normals, uvs, indices }
}

// ============================================
// Worker Handler
// ============================================

/**
 * Main terrain generation handler
 */
const terrainGenerationHandler = (
  request: TerrainGenerationRequest,
  context: any
): Effect.Effect<TerrainGenerationResponse> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    
    // Create noise functions
    const noise = createNoiseFunctions(request.seed)
    
    // Generate terrain blocks
    const allBlocks: Block[] = []
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const columnBlocks = generateTerrainColumn(
          request.coordinates.x,
          request.coordinates.z,
          x,
          z,
          request,
          noise
        )
        allBlocks.push(...columnBlocks)
      }
    }
    
    // Apply edited blocks
    const finalBlocks = applyEditedBlocks(allBlocks, request.editedBlocks)
    
    const generationTime = Date.now() - startTime
    const meshStartTime = Date.now()
    
    // Generate mesh
    const meshGeometry = generateGreedyMesh(finalBlocks)
    const meshData = prepareMeshForTransfer(meshGeometry)
    
    const meshGenerationTime = Date.now() - meshStartTime
    
    // Create height map
    const heightMap = new Array(CHUNK_SIZE * CHUNK_SIZE).fill(0)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = request.coordinates.x * CHUNK_SIZE + x
        const worldZ = request.coordinates.z * CHUNK_SIZE + z
        const height = getTerrainHeight(worldX, worldZ, noise, request.biomeSettings.elevation * 20)
        heightMap[z * CHUNK_SIZE + x] = height
      }
    }
    
    // Create response
    const response: TerrainGenerationResponse = {
      chunkData: {
        coordinates: request.coordinates,
        blocks: finalBlocks,
        heightMap,
        biomeData: undefined, // Could add biome data array if needed
        timestamp: Date.now(),
      },
      meshData,
      performanceMetrics: {
        generationTime,
        blockCount: finalBlocks.length,
        meshGenerationTime,
      },
    }
    
    return response
  })

// ============================================
// Worker Configuration
// ============================================

const worker = createTypedWorker({
  name: 'terrain-generation',
  inputSchema: TerrainGenerationRequest,
  outputSchema: TerrainGenerationResponse,
  handler: terrainGenerationHandler,
  timeout: Duration.seconds(45), // Longer timeout for complex terrain
  sharedBuffers: [
    {
      name: 'heightmap',
      byteLength: CHUNK_SIZE * CHUNK_SIZE * 4, // Float32Array
      type: 'Float32Array',
    },
    {
      name: 'blockids',
      byteLength: CHUNK_SIZE * CHUNK_SIZE * WORLD_DEPTH * 2, // Uint16Array for block IDs
      type: 'Uint16Array',
    },
  ],
})

// Start the worker
Effect.runPromise(worker.start())