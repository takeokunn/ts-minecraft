import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import { BIOME_PROPERTIES } from './biome-properties'
import { CHUNK_COLUMN_SAMPLE_COUNT } from './noise-primitives'
import {
  assembleBiomeChunkEntries,
  buildBiomeChunkSamplingPlan,
  buildOutsideNeighborBiomeMap,
} from './biome-chunk-assembly'

describe('biome-chunk-assembly', () => {
  it('builds a sampling plan with terrain start and outside-neighbor coordinates', () => {
    const result = buildBiomeChunkSamplingPlan({
      chunkX: 2,
      chunkZ: -1,
      biomeScale: 0.005,
      riverNoiseScale: 0.02,
      riverWorldOffset: 7,
    })

    expect(result.terrainStartX).toBe(2 * CHUNK_SIZE)
    expect(result.terrainStartZ).toBe(-1 * CHUNK_SIZE)
    expect(result.outsideNeighborCoords.length).toBeGreaterThan(0)
    expect(result.batchInputs.tempXs).toHaveLength(CHUNK_COLUMN_SAMPLE_COUNT)
    expect(result.batchInputs.riverXs[0]).toBeCloseTo(result.batchInputs.tempXs[0]! * 4 + 7)
  })

  it('builds an outside-neighbor biome map from aligned coordinate and biome arrays', () => {
    const result = buildOutsideNeighborBiomeMap({
      coords: [
        { key: '0,0', x: 0, z: 0 },
        { key: '1,0', x: 1, z: 0 },
      ],
      biomes: ['PLAINS', 'OCEAN'],
    })

    expect(result.get('0,0')).toBe('PLAINS')
    expect(result.get('1,0')).toBe('OCEAN')
  })

  it('assembles chunk entries from sampled climate data and neighbor biomes', () => {
    const result = assembleBiomeChunkEntries({
      chunkX: 0,
      chunkZ: 0,
      climate: {
        temperature: new Float64Array(Array.from({ length: CHUNK_COLUMN_SAMPLE_COUNT }, () => 0.5)),
        humidity: new Float64Array(Array.from({ length: CHUNK_COLUMN_SAMPLE_COUNT }, () => 0.45)),
        continentalness: new Float64Array(Array.from({ length: CHUNK_COLUMN_SAMPLE_COUNT }, () => -0.05)),
        erosion: new Float64Array(Array.from({ length: CHUNK_COLUMN_SAMPLE_COUNT }, () => 0.7)),
        pv: new Float64Array(Array.from({ length: CHUNK_COLUMN_SAMPLE_COUNT }, () => 0)),
        riverNoise: new Float64Array(Array.from({ length: CHUNK_COLUMN_SAMPLE_COUNT }, () => 0.9)),
      },
      outsideNeighborBiomesByKey: new Map(),
      propsForBiome: (biome) => BIOME_PROPERTIES[biome],
    })

    expect(result).toHaveLength(CHUNK_COLUMN_SAMPLE_COUNT)
    expect(result[0]).toEqual({
      biome: 'PLAINS',
      props: BIOME_PROPERTIES.PLAINS,
    })
  })
})
