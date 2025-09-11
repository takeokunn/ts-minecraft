import { Layer, Effect, Ref } from 'effect'
import { TerrainGenerator } from '@/infrastructure/services/terrain-generator.service'
import { ChunkCoordinates } from '@/domain/value-objects/coordinates/chunk-coordinates.value'
import { TypedWorkerManager } from '@/infrastructure/services/typed-worker-manager.service'
import { WASMIntegrationService } from './wasm-integration'

// --- Enhanced Configuration ---

const CONFIG = {
  USE_WASM: true,
  USE_WORKERS: true,
  CACHE_ENABLED: true,
  PREFETCH_ENABLED: true,
  STREAMING_ENABLED: true,
  NOISE_OCTAVES: 6,
  NOISE_PERSISTENCE: 0.5,
  NOISE_LACUNARITY: 2.0,
  NOISE_SCALE: 0.01,
  SEA_LEVEL: 62,
  MAX_HEIGHT: 256,
  CHUNK_SIZE: 16,
  CACHE_SIZE: 512,
  PREFETCH_DISTANCE: 2,
  WORKER_POOL_SIZE: 4,
} as const

// --- Enhanced Types ---

/**
 * Terrain generation parameters
 */
export interface TerrainGenParams {
  seed: number
  octaves: number
  persistence: number
  lacunarity: number
  scale: number
  seaLevel: number
  maxHeight: number
  biomeInfluence: number
  caveGeneration: boolean
  oreGeneration: boolean
}

/**
 * Biome definition
 */
export interface BiomeDefinition {
  id: string
  name: string
  temperature: number
  humidity: number
  elevation: number
  blockDistribution: {
    surface: string
    subsurface: string
    stone: string
    liquid: string
  }
  vegetationDensity: number
  structureSpawnRate: number
}

/**
 * Enhanced chunk data with metadata
 */
export interface EnhancedChunkData {
  coordinates: ChunkCoordinates
  blocks: Uint8Array
  heightMap: number[]
  biomes: string[]
  structures: Array<{ type: string; position: [number, number, number] }>
  caves: Array<{ position: [number, number, number]; radius: number }>
  ores: Array<{ type: string; position: [number, number, number] }>
  metadata: {
    generationTime: number
    compressionRatio: number
    version: string
    checksum: string
  }
}

/**
 * Terrain cache entry
 */
export interface TerrainCacheEntry {
  data: EnhancedChunkData
  lastAccessed: number
  accessCount: number
  isCompressed: boolean
  memoryUsage: number
}

/**
 * Terrain generator state
 */
export interface TerrainGeneratorState {
  params: TerrainGenParams
  biomes: Map<string, BiomeDefinition>
  cache: Map<string, TerrainCacheEntry>
  prefetchQueue: Array<{ coords: ChunkCoordinates; priority: number }>
  stats: {
    chunksGenerated: number
    cacheHits: number
    cacheMisses: number
    wasmUsage: number
    averageGenerationTime: number
    memoryUsage: number
  }
}

// --- Biome Definitions ---

const BIOMES: Record<string, BiomeDefinition> = {
  plains: {
    id: 'plains',
    name: 'Plains',
    temperature: 0.8,
    humidity: 0.4,
    elevation: 0.0,
    blockDistribution: {
      surface: 'grass',
      subsurface: 'dirt',
      stone: 'stone',
      liquid: 'water',
    },
    vegetationDensity: 0.3,
    structureSpawnRate: 0.01,
  },
  desert: {
    id: 'desert',
    name: 'Desert',
    temperature: 2.0,
    humidity: 0.0,
    elevation: 0.1,
    blockDistribution: {
      surface: 'sand',
      subsurface: 'sand',
      stone: 'sandstone',
      liquid: 'water',
    },
    vegetationDensity: 0.02,
    structureSpawnRate: 0.005,
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    temperature: 0.7,
    humidity: 0.8,
    elevation: 0.1,
    blockDistribution: {
      surface: 'grass',
      subsurface: 'dirt',
      stone: 'stone',
      liquid: 'water',
    },
    vegetationDensity: 0.8,
    structureSpawnRate: 0.02,
  },
  mountains: {
    id: 'mountains',
    name: 'Mountains',
    temperature: 0.2,
    humidity: 0.3,
    elevation: 0.8,
    blockDistribution: {
      surface: 'stone',
      subsurface: 'stone',
      stone: 'stone',
      liquid: 'water',
    },
    vegetationDensity: 0.1,
    structureSpawnRate: 0.001,
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    temperature: 0.5,
    humidity: 1.0,
    elevation: -0.5,
    blockDistribution: {
      surface: 'water',
      subsurface: 'sand',
      stone: 'stone',
      liquid: 'water',
    },
    vegetationDensity: 0.05,
    structureSpawnRate: 0.001,
  },
}


// --- Utility Functions ---

/**
 * Generate cache key for chunk coordinates
 */
const getChunkCacheKey = (coords: ChunkCoordinates): string => {
  return `${coords.x},${coords.z}`
}

/**
 * Calculate biome at world coordinates
 */
const calculateBiome = (
  _worldX: number,
  _worldZ: number,
  temperature: number,
  humidity: number,
  elevation: number
): BiomeDefinition => {
  // Simple biome selection based on climate parameters
  if (elevation < -0.3) return BIOMES.ocean
  if (temperature > 1.5 && humidity < 0.2) return BIOMES.desert
  if (temperature < 0.3 && elevation > 0.5) return BIOMES.mountains
  if (humidity > 0.6 && temperature > 0.6) return BIOMES.forest
  return BIOMES.plains
}

/**
 * Generate procedural structures
 */
const generateStructures = (
  chunkX: number,
  chunkZ: number,
  biome: BiomeDefinition,
  seed: number
): Array<{ type: string; position: [number, number, number] }> => {
  const structures: Array<{ type: string; position: [number, number, number] }> = []
  
  // Simple structure generation
  const random = (x: number, z: number) => {
    const hash = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453
    return hash - Math.floor(hash)
  }
  
  for (let x = 0; x < CONFIG.CHUNK_SIZE; x++) {
    for (let z = 0; z < CONFIG.CHUNK_SIZE; z++) {
      const worldX = chunkX * CONFIG.CHUNK_SIZE + x
      const worldZ = chunkZ * CONFIG.CHUNK_SIZE + z
      
      if (random(worldX, worldZ) < biome.structureSpawnRate) {
        structures.push({
          type: biome.id === 'forest' ? 'tree' : 'rock',
          position: [x, 0, z], // Y will be set based on height map
        })
      }
    }
  }
  
  return structures
}

/**
 * Generate cave system
 */
const generateCaves = (
  _chunkX: number,
  _chunkZ: number,
  _seed: number
): Array<{ position: [number, number, number]; radius: number }> => {
  const caves: Array<{ position: [number, number, number]; radius: number }> = []
  
  // Simple cave generation
  const caveCount = Math.floor(Math.random() * 3) + 1
  
  for (let i = 0; i < caveCount; i++) {
    caves.push({
      position: [
        Math.floor(Math.random() * CONFIG.CHUNK_SIZE),
        Math.floor(Math.random() * 40) + 10, // Between y=10 and y=50
        Math.floor(Math.random() * CONFIG.CHUNK_SIZE),
      ],
      radius: Math.random() * 5 + 2, // Radius 2-7
    })
  }
  
  return caves
}

/**
 * Generate ore deposits
 */
const generateOres = (
  _chunkX: number,
  _chunkZ: number,
  _seed: number
): Array<{ type: string; position: [number, number, number] }> => {
  const ores: Array<{ type: string; position: [number, number, number] }> = []
  
  const oreTypes = ['coal', 'iron', 'gold', 'diamond']
  const oreCount = Math.floor(Math.random() * 10) + 5
  
  for (let i = 0; i < oreCount; i++) {
    const oreType = oreTypes[Math.floor(Math.random() * oreTypes.length)]
    ores.push({
      type: oreType,
      position: [
        Math.floor(Math.random() * CONFIG.CHUNK_SIZE),
        Math.floor(Math.random() * 60) + 5, // Between y=5 and y=65
        Math.floor(Math.random() * CONFIG.CHUNK_SIZE),
      ],
    })
  }
  
  return ores
}

/**
 * Compress chunk data
 */
const compressChunkData = (data: EnhancedChunkData): ArrayBuffer => {
  // Simple compression simulation
  const jsonString = JSON.stringify({
    blocks: Array.from(data.blocks),
    heightMap: data.heightMap,
    biomes: data.biomes,
    structures: data.structures,
    caves: data.caves,
    ores: data.ores,
  })
  
  return new TextEncoder().encode(jsonString).buffer
}

/**
 * Decompress chunk data
 */
const decompressChunkData = (buffer: ArrayBuffer, coords: ChunkCoordinates) => {
  const jsonString = new TextDecoder().decode(buffer)
  const parsed = JSON.parse(jsonString)
  
  return {
    coordinates: coords,
    blocks: new Uint8Array(parsed.blocks),
    heightMap: parsed.heightMap,
    biomes: parsed.biomes,
    structures: parsed.structures,
    caves: parsed.caves,
    ores: parsed.ores,
    metadata: {
      generationTime: 0,
      compressionRatio: 0,
      version: '1.0.0',
      checksum: '',
    },
  }
}

// --- Enhanced Terrain Generator Implementation ---

export const EnhancedTerrainGeneratorLive = Layer.effect(
  TerrainGenerator,
  Effect.gen(function* () {
    const workerManager = yield* TypedWorkerManager
    const wasmService = yield* WASMIntegrationService
    
    const initialParams: TerrainGenParams = {
      seed: Math.random() * 10000,
      octaves: CONFIG.NOISE_OCTAVES,
      persistence: CONFIG.NOISE_PERSISTENCE,
      lacunarity: CONFIG.NOISE_LACUNARITY,
      scale: CONFIG.NOISE_SCALE,
      seaLevel: CONFIG.SEA_LEVEL,
      maxHeight: CONFIG.MAX_HEIGHT,
      biomeInfluence: 1.0,
      caveGeneration: true,
      oreGeneration: true,
    }
    
    const initialState: TerrainGeneratorState = {
      params: initialParams,
      biomes: new Map(Object.entries(BIOMES)),
      cache: new Map(),
      prefetchQueue: [],
      stats: {
        chunksGenerated: 0,
        cacheHits: 0,
        cacheMisses: 0,
        wasmUsage: 0,
        averageGenerationTime: 0,
        memoryUsage: 0,
      },
    }
    
    const stateRef = yield* Ref.make(initialState)
    
    // Initialize WASM modules for performance
    const initializeWASM = () =>
      Effect.gen(function* () {
        if (!CONFIG.USE_WASM) return
        
        try {
          // Load noise generation WASM module
          const noiseWasmBytes = new Uint8Array([
            // Simplified WASM bytecode for noise generation
            0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
            // Module implementation would be more complex
          ])
          
          yield* wasmService.loadModule('terrain_noise', noiseWasmBytes)
        } catch (error) {
          console.warn('Failed to load WASM modules, falling back to JavaScript:', error)
        }
      })
    
    yield* initializeWASM()
    
    // Background cache optimization
    const startCacheOptimization = () =>
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep(30000) // Optimize every 30 seconds
          yield* Ref.update(stateRef, state => {
            const currentTime = Date.now()
            const CACHE_MAX_AGE = 300000 // 5 minutes
            const newCache = new Map<string, TerrainCacheEntry>()
            let totalMemory = 0
            
            for (const [key, entry] of state.cache) {
              if (currentTime - entry.lastAccessed < CACHE_MAX_AGE || entry.accessCount > 5) {
                newCache.set(key, entry)
                totalMemory += entry.memoryUsage
              }
            }
            
            return {
              ...state,
              cache: newCache,
              stats: {
                ...state.stats,
                memoryUsage: totalMemory,
              },
            }
          })
        }
      }).pipe(Effect.fork)
    
    yield* startCacheOptimization()
    
    return {
      generateChunkTerrain: (coords: ChunkCoordinates) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const cacheKey = getChunkCacheKey(coords)
          
          // Check cache first
          const cachedEntry = state.cache.get(cacheKey)
          if (cachedEntry && CONFIG.CACHE_ENABLED) {
            cachedEntry.lastAccessed = Date.now()
            cachedEntry.accessCount++
            
            yield* Ref.update(stateRef, s => ({
              ...s,
              stats: { ...s.stats, cacheHits: s.stats.cacheHits + 1 }
            }))
            
            return {
              blocks: cachedEntry.data.blocks,
              heightMap: cachedEntry.data.heightMap,
            }
          }
          
          const startTime = Date.now()
          
          // Try WASM generation first, fallback to worker
          let result: any
          
          if (CONFIG.USE_WASM) {
            try {
              // Use WASM for noise generation if available
              const noiseData = yield* wasmService.callFunction(
                'terrain_noise',
                'generate_noise',
                coords.x,
                coords.z,
                state.params.seed,
                state.params.octaves
              ).pipe(Effect.catchAll(() => Effect.succeed(null)))
              
              if (noiseData) {
                yield* Ref.update(stateRef, s => ({
                  ...s,
                  stats: { ...s.stats, wasmUsage: s.stats.wasmUsage + 1 }
                }))
              }
            } catch {
              // Fallback to worker generation
            }
          }
          
          if (!result && CONFIG.USE_WORKERS) {
            // Use worker for terrain generation
            result = yield* workerManager.sendTerrainRequest({
              type: 'generate-terrain',
              coordinates: { x: coords.x, z: coords.z },
              params: state.params,
              features: {
                biomes: true,
                caves: state.params.caveGeneration,
                ores: state.params.oreGeneration,
                structures: true,
              },
            })
          }
          
          if (!result) {
            // Fallback to local generation
            result = yield* generateTerrainLocal(coords, state.params, state.biomes)
          }
          
          const generationTime = Date.now() - startTime
          
          // Create enhanced chunk data
          const chunkData: EnhancedChunkData = {
            coordinates: coords,
            blocks: new Uint8Array(result.blocks || new Array(CONFIG.CHUNK_SIZE ** 3).fill(0)),
            heightMap: result.heightMap || new Array(CONFIG.CHUNK_SIZE ** 2).fill(CONFIG.SEA_LEVEL),
            biomes: result.biomes || ['plains'],
            structures: result.structures || [],
            caves: result.caves || [],
            ores: result.ores || [],
            metadata: {
              generationTime,
              compressionRatio: 1.0,
              version: '1.0.0',
              checksum: generateChecksum(result),
            },
          }
          
          // Cache the result
          if (CONFIG.CACHE_ENABLED) {
            const cacheEntry: TerrainCacheEntry = {
              data: chunkData,
              lastAccessed: Date.now(),
              accessCount: 1,
              isCompressed: false,
              memoryUsage: chunkData.blocks.byteLength + (chunkData.heightMap.length * 8),
            }
            
            yield* Ref.update(stateRef, s => ({
              ...s,
              cache: new Map([...s.cache, [cacheKey, cacheEntry]]),
              stats: {
                ...s.stats,
                chunksGenerated: s.stats.chunksGenerated + 1,
                cacheMisses: s.stats.cacheMisses + 1,
                averageGenerationTime: (s.stats.averageGenerationTime + generationTime) / 2,
                memoryUsage: s.stats.memoryUsage + cacheEntry.memoryUsage,
              },
            }))
          }
          
          return {
            blocks: chunkData.blocks,
            heightMap: chunkData.heightMap,
          }
        }),
      
      getHeightAt: (worldX: number, worldZ: number) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          
          // Simple height calculation using noise
          const noise = generateNoise(worldX, worldZ, state.params.seed, state.params)
          const height = Math.floor(state.params.seaLevel + noise * (state.params.maxHeight - state.params.seaLevel))
          
          return Math.max(0, Math.min(255, height))
        }),
      
      generateHeightMap: (startX: number, startZ: number, width: number, depth: number) =>
        Effect.gen(function* () {
          const heightMap: number[] = []
          
          for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
              const worldX = startX + x
              const worldZ = startZ + z
              const height = yield* Effect.serviceRef.getHeightAt(worldX, worldZ)
              heightMap.push(height)
            }
          }
          
          return heightMap
        }),
      
      getBiomeAt: (worldX: number, worldZ: number) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          
          // Generate climate parameters
          const temperature = generateNoise(worldX * 0.001, worldZ * 0.001, state.params.seed + 1000, state.params)
          const humidity = generateNoise(worldX * 0.001, worldZ * 0.001, state.params.seed + 2000, state.params)
          const elevation = generateNoise(worldX * 0.005, worldZ * 0.005, state.params.seed + 3000, state.params)
          
          const biome = calculateBiome(worldX, worldZ, temperature, humidity, elevation)
          return biome.id
        }),
      
      setSeed: (newSeed: number) =>
        Ref.update(stateRef, state => ({
          ...state,
          params: { ...state.params, seed: newSeed },
          cache: new Map(), // Clear cache when seed changes
        })),
      
      getSeed: () =>
        Ref.get(stateRef).pipe(Effect.map(state => state.params.seed)),
      
      getConfig: () =>
        Ref.get(stateRef).pipe(Effect.map(state => state.params)),
      
      // Enhanced methods
      prefetchChunk: (coords: ChunkCoordinates, priority: number = 1) =>
        Ref.update(stateRef, state => ({
          ...state,
          prefetchQueue: [...state.prefetchQueue, { coords, priority }]
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 100), // Limit queue size
        })),
      
      getStats: () =>
        Ref.get(stateRef).pipe(Effect.map(state => state.stats)),
      
      optimizeCache: () =>
        Ref.update(stateRef, state => {
          // Compress least recently used entries
          const sortedEntries = Array.from(state.cache.entries())
            .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed)
          
          const compressCount = Math.floor(sortedEntries.length * 0.3)
          
          for (let i = 0; i < compressCount; i++) {
            const [_key, entry] = sortedEntries[i]
            if (!entry.isCompressed) {
              const compressed = compressChunkData(entry.data)
              entry.memoryUsage = compressed.byteLength
              entry.isCompressed = true
            }
          }
          
          return state
        }),
    }
  }).pipe(
    Effect.provide(TypedWorkerManager),
    Effect.provide(WASMIntegrationService)
  )
)

// --- Helper Functions ---

/**
 * Generate terrain locally as fallback
 */
const generateTerrainLocal = (
  coords: ChunkCoordinates,
  params: TerrainGenParams,
  biomes: Map<string, BiomeDefinition>
) =>
  Effect.succeed({
    blocks: new Array(CONFIG.CHUNK_SIZE ** 3).fill(0).map((_, i) => {
      const x = i % CONFIG.CHUNK_SIZE
      const y = Math.floor(i / (CONFIG.CHUNK_SIZE ** 2))
      const z = Math.floor((i % (CONFIG.CHUNK_SIZE ** 2)) / CONFIG.CHUNK_SIZE)
      
      const worldX = coords.x * CONFIG.CHUNK_SIZE + x
      const worldZ = coords.z * CONFIG.CHUNK_SIZE + z
      
      const height = generateNoise(worldX, worldZ, params.seed, params)
      const terrainHeight = Math.floor(params.seaLevel + height * (params.maxHeight - params.seaLevel))
      
      if (y <= terrainHeight) {
        if (y === terrainHeight) return 1 // Surface block
        if (y > terrainHeight - 3) return 2 // Subsurface
        return 3 // Stone
      }
      
      return 0 // Air
    }),
    heightMap: new Array(CONFIG.CHUNK_SIZE ** 2).fill(0).map((_, i) => {
      const x = i % CONFIG.CHUNK_SIZE
      const z = Math.floor(i / CONFIG.CHUNK_SIZE)
      const worldX = coords.x * CONFIG.CHUNK_SIZE + x
      const worldZ = coords.z * CONFIG.CHUNK_SIZE + z
      
      const noise = generateNoise(worldX, worldZ, params.seed, params)
      return Math.floor(params.seaLevel + noise * (params.maxHeight - params.seaLevel))
    }),
    biomes: new Array(CONFIG.CHUNK_SIZE ** 2).fill('plains'),
    structures: generateStructures(coords.x, coords.z, biomes.get('plains') ?? { type: 'plains', temperature: 0.5, humidity: 0.5 }, params.seed),
    caves: generateCaves(coords.x, coords.z, params.seed),
    ores: generateOres(coords.x, coords.z, params.seed),
  })

/**
 * Simple noise function (placeholder for proper Perlin noise)
 */
const generateNoise = (x: number, z: number, seed: number, params: TerrainGenParams): number => {
  let noise = 0
  let amplitude = 1
  let frequency = params.scale
  
  for (let i = 0; i < params.octaves; i++) {
    const hash = Math.sin(x * frequency + z * frequency + seed + i * 1000) * 43758.5453
    noise += (hash - Math.floor(hash)) * amplitude * 2 - amplitude
    
    amplitude *= params.persistence
    frequency *= params.lacunarity
  }
  
  return Math.max(-1, Math.min(1, noise))
}

/**
 * Generate checksum for chunk data
 */
const generateChecksum = (data: any): string => {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}

// Export types and configuration
export type { 
  TerrainGeneratorState, 
  TerrainGenParams, 
  BiomeDefinition, 
  EnhancedChunkData, 
  TerrainCacheEntry 
}
export { CONFIG as TerrainGeneratorConfig, BIOMES }