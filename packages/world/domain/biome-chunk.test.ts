import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { BiomeType } from './biome'
import {
  buildChunkBaseBiomes,
  buildRefinedChunkBiomes,
  collectOutsideChunkNeighborCoords,
} from './biome-chunk'
import { CHUNK_COLUMN_SAMPLE_COUNT } from './noise-primitives'

describe('collectOutsideChunkNeighborCoords', () => {
  it('returns unique outside-edge coordinates for the chunk perimeter', () => {
    const chunkX = 2
    const chunkZ = 3
    const coords = collectOutsideChunkNeighborCoords(chunkX, chunkZ)
    const baseWorldX = chunkX * CHUNK_SIZE
    const baseWorldZ = chunkZ * CHUNK_SIZE

    expect(coords).toHaveLength(4 * CHUNK_SIZE)
    expect(new Set(coords.map(({ key }) => key)).size).toBe(coords.length)

    for (const { x, z } of coords) {
      const isOutsideX = x === baseWorldX - 1 || x === baseWorldX + CHUNK_SIZE
      const isOutsideZ = z === baseWorldZ - 1 || z === baseWorldZ + CHUNK_SIZE
      expect(isOutsideX || isOutsideZ).toBe(true)
    }
  })
})

describe('buildRefinedChunkBiomes', () => {
  it('refines a shoreline column to BEACH when an outside neighbor is OCEAN', () => {
    const baseBiomes: Array<BiomeType> = []
    baseBiomes.length = CHUNK_COLUMN_SAMPLE_COUNT
    baseBiomes.fill('PLAINS')

    const continentalness = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
    continentalness.fill(0.05)

    const outsideNeighborBiomesByKey = new Map<string, BiomeType>([
      ['-1,0', 'OCEAN'],
    ])

    const refined = buildRefinedChunkBiomes({
      chunkX: 0,
      chunkZ: 0,
      baseBiomes,
      continentalness,
      outsideNeighborBiomesByKey,
    })

    expect(refined[0]).toBe('BEACH')
    expect(refined[CHUNK_SIZE + 1]).toBe('PLAINS')
  })
})

describe('buildChunkBaseBiomes', () => {
  it('uses terrain samples through the batch terrain index mapping', () => {
    const temperature = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
    const humidity = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
    const continentalness = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
    const erosion = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
    const pv = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)
    const riverNoise = new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT)

    temperature.fill(0.5)
    humidity.fill(0.45)
    erosion.fill(0.7)
    pv.fill(0.2)
    riverNoise.fill(0.9)
    continentalness.fill(-0.05)
    continentalness[16] = -0.65

    const baseBiomes = buildChunkBaseBiomes({
      temperature,
      humidity,
      continentalness,
      erosion,
      pv,
      riverNoise,
    })

    expect(baseBiomes).toHaveLength(CHUNK_COLUMN_SAMPLE_COUNT)
    expect(baseBiomes[0]).toBe('PLAINS')
    expect(baseBiomes[1]).toBe('OCEAN')
  })
})
