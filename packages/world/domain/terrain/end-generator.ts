import { Effect } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import { blockTypeToIndex } from '@ts-minecraft/core'
import type { Chunk } from '../chunk'
import type { ChunkFactory } from './generator-types'
import { applyEndCityStructure, shouldGenerateEndCity } from './end-city-generator'
import { chunkBlockIndexUnchecked } from './math'

// The End main island: a roughly circular END_STONE plateau at y=63-64.
// The island radius in world blocks. Chunks outside this radius are void.
const END_ISLAND_RADIUS = 55
// Height of the flat END_STONE surface
const END_SURFACE_Y = 64

// Obsidian pillar positions relative to the island center (0, 0).
// Pillars are spaced every 40 blocks on a circle of radius 43.
const PILLAR_POSITIONS: ReadonlyArray<{ readonly x: number; readonly z: number; readonly height: number }> = [
  { x:  43, z:   0, height: 76 }, { x:  30, z:  30, height: 79 },
  { x:   0, z:  43, height: 82 }, { x: -30, z:  30, height: 85 },
  { x: -43, z:   0, height: 79 }, { x: -30, z: -30, height: 73 },
  { x:   0, z: -43, height: 76 }, { x:  30, z: -30, height: 82 },
]
const PILLAR_RADIUS = 3  // cross-section radius of each obsidian pillar

export const generateEndTerrain = (
  chunkService: ChunkFactory,
  coord: ChunkCoord,
): Effect.Effect<Chunk, never> =>
  Effect.gen(function* () {
    const chunk = yield* chunkService.createChunk(coord)
    const blocks = chunk.blocks
    const baseX = coord.x * CHUNK_SIZE
    const baseZ = coord.z * CHUNK_SIZE

    const endStoneIndex = blockTypeToIndex('END_STONE')
    const obsidianIndex = blockTypeToIndex('OBSIDIAN')
    const endPortalIndex = blockTypeToIndex('END_PORTAL')

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseZ + lz
        const dist2 = wx * wx + wz * wz

        // Main island: circular END_STONE plateau
        if (dist2 <= END_ISLAND_RADIUS * END_ISLAND_RADIUS) {
          // Surface layer
          blocks[chunkBlockIndexUnchecked(lx, END_SURFACE_Y, lz)] = endStoneIndex
          // Solid fill below surface
          for (let y = END_SURFACE_Y - 1; y >= END_SURFACE_Y - 5; y--) {
            blocks[chunkBlockIndexUnchecked(lx, y, lz)] = endStoneIndex
          }
        }

        // Obsidian pillars (tall columns)
        for (const pillar of PILLAR_POSITIONS) {
          const dx = wx - pillar.x
          const dz = wz - pillar.z
          if (dx * dx + dz * dz <= PILLAR_RADIUS * PILLAR_RADIUS) {
            for (let y = END_SURFACE_Y; y <= Math.min(pillar.height, CHUNK_HEIGHT - 1); y++) {
              blocks[chunkBlockIndexUnchecked(lx, y, lz)] = obsidianIndex
            }
          }
        }

        // Return END_PORTAL at island center (3×3 portal at y=64)
        const absCx = Math.abs(wx)
        const absCz = Math.abs(wz)
        if (absCx <= 1 && absCz <= 1) {
          blocks[chunkBlockIndexUnchecked(lx, END_SURFACE_Y, lz)] = endPortalIndex
        }
      }
    }

    if (shouldGenerateEndCity(coord)) applyEndCityStructure(blocks, coord)

    return { ...chunk, blocks }
  })
