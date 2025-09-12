import * as S from 'effect/Schema'
import { ChunkCoordinate } from '@domain/value-objects/coordinates/chunk-coordinate.vo'
import { Block } from '@domain/entities/block.entity'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@shared/constants/world'

export const Chunk = S.Struct({
  _tag: S.Literal('Chunk'),
  coordinate: ChunkCoordinate,
  blocks: S.Array(Block),
  biome: S.Literal('plains', 'desert', 'forest', 'mountains', 'ocean', 'taiga', 'swamp'),
  generated: S.Boolean,
  modified: S.Boolean,
  lastUpdate: S.Number,
})
export type Chunk = S.Schema.Type<typeof Chunk>

export const makeEmptyChunk = (coordinate: ChunkCoordinate) =>
  S.decodeSync(Chunk)({
    _tag: 'Chunk',
    coordinate,
    blocks: [],
    biome: 'plains',
    generated: false,
    modified: false,
    lastUpdate: Date.now(),
  })

// Business Logic for Chunk Entity
export const ChunkBusinessLogic = {
  /**
   * Check if chunk is fully loaded and generated
   */
  isReady: (chunk: Chunk): boolean => chunk.generated,

  /**
   * Check if chunk has been modified since generation
   */
  hasChanges: (chunk: Chunk): boolean => chunk.modified,

  /**
   * Check if chunk needs regeneration (too old or corrupted)
   */
  needsRegeneration: (chunk: Chunk, maxAge: number = 3600000): boolean => {
    const age = Date.now() - chunk.lastUpdate
    return age > maxAge || (!chunk.generated && chunk.blocks.length === 0)
  },

  /**
   * Get chunk size constants
   */
  getDimensions: () => ({
    width: CHUNK_SIZE,
    depth: CHUNK_SIZE,
    height: CHUNK_HEIGHT,
    totalBlocks: CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT,
  }),

  /**
   * Calculate block position within chunk from world coordinates
   */
  worldToChunkBlockPosition: (worldX: number, worldY: number, worldZ: number) => ({
    x: worldX - Math.floor(worldX / CHUNK_SIZE) * CHUNK_SIZE,
    y: worldY,
    z: worldZ - Math.floor(worldZ / CHUNK_SIZE) * CHUNK_SIZE,
  }),

  /**
   * Check if coordinates are within chunk bounds
   */
  isValidBlockPosition: (x: number, y: number, z: number): boolean => {
    return x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && z >= 0 && z < CHUNK_SIZE
  },

  /**
   * Calculate chunk's world bounds
   */
  getWorldBounds: (chunk: Chunk) => {
    const startX = chunk.coordinate.x * CHUNK_SIZE
    const startZ = chunk.coordinate.z * CHUNK_SIZE

    return {
      minX: startX,
      maxX: startX + CHUNK_SIZE - 1,
      minY: 0,
      maxY: CHUNK_HEIGHT - 1,
      minZ: startZ,
      maxZ: startZ + CHUNK_SIZE - 1,
    }
  },

  /**
   * Check if a world position falls within this chunk
   */
  containsWorldPosition: (chunk: Chunk, worldX: number, worldZ: number): boolean => {
    const bounds = ChunkBusinessLogic.getWorldBounds(chunk)
    return worldX >= bounds.minX && worldX <= bounds.maxX && worldZ >= bounds.minZ && worldZ <= bounds.maxZ
  },

  /**
   * Get biome-specific generation parameters
   */
  getBiomeParameters: (biome: Chunk['biome']) => {
    const biomeData = {
      plains: { temperature: 0.8, humidity: 0.4, elevation: 64 },
      desert: { temperature: 2.0, humidity: 0.0, elevation: 64 },
      forest: { temperature: 0.7, humidity: 0.8, elevation: 64 },
      mountains: { temperature: 0.2, humidity: 0.3, elevation: 128 },
      ocean: { temperature: 0.5, humidity: 0.9, elevation: 32 },
      taiga: { temperature: 0.25, humidity: 0.8, elevation: 64 },
      swamp: { temperature: 0.8, humidity: 0.9, elevation: 58 },
    }

    return biomeData[biome]
  },

  /**
   * Validate chunk invariants
   */
  validateInvariants: (chunk: Chunk): readonly string[] => {
    const violations: string[] = []

    if (chunk.blocks.length > CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT) {
      violations.push(`Too many blocks: ${chunk.blocks.length} > ${CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT}`)
    }

    if (chunk.lastUpdate <= 0) {
      violations.push('Invalid lastUpdate timestamp')
    }

    if (chunk.generated && chunk.blocks.length === 0) {
      violations.push('Generated chunk cannot have zero blocks')
    }

    // Check for duplicate block positions
    const positions = new Set<string>()
    for (const block of chunk.blocks) {
      const posKey = `${block.position.x},${block.position.y},${block.position.z}`
      if (positions.has(posKey)) {
        violations.push(`Duplicate block at position ${posKey}`)
      }
      positions.add(posKey)
    }

    return violations
  },

  /**
   * Mark chunk as modified and update timestamp
   */
  markModified: (chunk: Chunk): Chunk => {
    return S.decodeSync(Chunk)({
      ...chunk,
      modified: true,
      lastUpdate: Date.now(),
    })
  },

  /**
   * Mark chunk as generated
   */
  markGenerated: (chunk: Chunk): Chunk => {
    return S.decodeSync(Chunk)({
      ...chunk,
      generated: true,
      lastUpdate: Date.now(),
    })
  },
}
