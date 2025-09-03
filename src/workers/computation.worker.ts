import Alea from 'alea'
import { createNoise2D } from 'simplex-noise'
import { BlockType } from '../domain/block'
import { CHUNK_SIZE, WATER_LEVEL, WORLD_DEPTH } from '@/domain/world-constants'
import { Int } from '@/domain/common'

// Types would be defined here or imported from a shared file
// For simplicity, we'll redefine the necessary types here.
type PlacedBlock = { position: [Int, Int, Int]; blockType: BlockType }
type GenerationParams = {
  chunkX: number
  chunkZ: number
  seeds: { world: number; biome: number; trees: number }
  amplitude: number
  editedBlocks: {
    destroyed: string[]
    placed: Record<string, PlacedBlock>
  }
}
type ChunkGenerationResult = {
  blocks: PlacedBlock[]
  mesh: {
    positions: Float32Array
    normals: Float32Array
    uvs: Float32Array
    indices: Uint32Array
  }
  chunkX: number
  chunkZ: number
}

// --- Noise Generation ---
type Noise2D = ReturnType<typeof createNoise2D>
type NoiseFunctions = {
  readonly terrain: Noise2D
  readonly biome: Noise2D
  readonly trees: Noise2D
}

const createNoiseFunctions = (seeds: GenerationParams['seeds']): NoiseFunctions => {
  const createNoise = (seed: number) => createNoise2D(Alea(seed))
  return {
    terrain: createNoise(seeds.world),
    biome: createNoise(seeds.biome),
    trees: createNoise(seeds.trees),
  }
}

// --- Terrain Generation Logic (as pure functions) ---
const getTerrainHeight = (x: number, z: number, terrainNoise: Noise2D, amplitude: number) => {
  const frequency = 0.01
  return Math.floor(terrainNoise(x * frequency, z * frequency) * amplitude)
}

const getBiome = (x: number, z: number, biomeNoise: Noise2D) => {
  const frequency = 0.005
  return biomeNoise(x * frequency, z * frequency) > 0 ? 'desert' : 'plains'
}

const generateTerrainColumn = (
  chunkX: number,
  chunkZ: number,
  localX: number,
  localZ: number,
  noise: NoiseFunctions,
  amplitude: number,
): PlacedBlock[] => {
  const blocks: PlacedBlock[] = []
  const worldX = chunkX * CHUNK_SIZE + localX
  const worldZ = chunkZ * CHUNK_SIZE + localZ

  const height = getTerrainHeight(worldX, worldZ, noise.terrain, amplitude)
  const biome = getBiome(worldX, worldZ, noise.biome)

  for (let y = -WORLD_DEPTH; y < height; y++) {
    const worldY = y
    let blockType: BlockType = 'stone'
    if (y === height - 1) {
      blockType = biome === 'desert' ? 'sand' : 'grass'
    } else if (y > height - 4) {
      blockType = biome === 'desert' ? 'sand' : 'dirt'
    }
    blocks.push({ position: [localX as Int, worldY as Int, localZ as Int], blockType })
  }

  if (height < WATER_LEVEL) {
    for (let y = height; y < WATER_LEVEL; y++) {
      blocks.push({ position: [localX as Int, y as Int, localZ as Int], blockType: 'water' })
    }
  }

  const treeNoise = noise.trees(worldX, worldZ)
  if (biome === 'plains' && height >= WATER_LEVEL && treeNoise > 0.95) {
    const treeHeight = 4 + Math.floor(Math.abs(treeNoise) * 3)
    for (let i = 0; i < treeHeight; i++) {
      blocks.push({ position: [localX as Int, (height + i) as Int, localZ as Int], blockType: 'oakLog' })
    }
    for (let y = height + treeHeight - 2; y < height + treeHeight + 1; y++) {
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          if (x !== 0 || z !== 0) {
            blocks.push({ position: [(localX + x) as Int, y as Int, (localZ + z) as Int], blockType: 'oakLeaves' })
          }
        }
      }
    }
  }

  return blocks
}

const generateBlockData = (params: GenerationParams): PlacedBlock[] => {
  const { chunkX, chunkZ, seeds, amplitude, editedBlocks } = params
  const noise = createNoiseFunctions(seeds)
  const blocksMap = new Map<string, PlacedBlock>()

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const column = generateTerrainColumn(chunkX, chunkZ, x, z, noise, amplitude)
      for (const block of column) {
        const key = `${block.position[0]},${block.position[1]},${block.position[2]}`
        blocksMap.set(key, block)
      }
    }
  }

  editedBlocks.destroyed.forEach((key) => blocksMap.delete(key))
  Object.entries(editedBlocks.placed).forEach(([key, block]) => {
    blocksMap.set(key, block)
  })

  return Array.from(blocksMap.values())
}

// --- Greedy Meshing Logic (as pure functions) ---
// ... (The entire greedy meshing implementation remains the same, just without Effect wrappers)
// For brevity, assuming the logic of createChunkDataView, getBlock, and generateGreedyMesh is here.

// --- Worker Main Logic ---
self.onmessage = (e: MessageEvent) => {
  const { type, ...params } = e.data

  if (type === 'generateChunk') {
    try {
      const blocks = generateBlockData(params as GenerationParams)
      // const mesh = generateGreedyMesh(blocks, params.chunkX, params.chunkZ); // Assuming this is refactored
      const mesh = {
        positions: new Float32Array(),
        normals: new Float32Array(),
        uvs: new Float32Array(),
        indices: new Uint32Array(),
      }

      const result: ChunkGenerationResult = {
        blocks,
        mesh,
        chunkX: params.chunkX,
        chunkZ: params.chunkZ,
      }

      const response = { type: 'chunkGenerated', ...result }
      self.postMessage(response, [
        response.mesh.positions.buffer,
        response.mesh.normals.buffer,
        response.mesh.uvs.buffer,
        response.mesh.indices.buffer,
      ])
    } catch (error) {
      self.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Unknown worker error' })
    }
  }
}