import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { BIOME_PROPERTIES } from './biome-properties'
import { CHUNK_COLUMN_SAMPLE_COUNT } from './noise-primitives'
import {
  buildChunkNoiseBatchInputsFromCoords,
  buildBiomeChunkEntries,
  makeBiomeChunkEntry,
  readChunkNoiseInput,
} from './biome-service-helpers'

describe('biome-service-helpers', () => {
  it('returns a missing chunk noise input when coordinates are absent', () => {
    const result = readChunkNoiseInput([], 0)

    expect(Number.isNaN(result.tempX)).toBe(true)
    expect(Number.isNaN(result.humX)).toBe(true)
  })

  it('returns the chunk noise input at the requested index', () => {
    const input = { tempX: 1, tempZ: 2, humX: 3, humZ: 4 }

    expect(readChunkNoiseInput([input], 0)).toBe(input)
  })

  it('builds biome chunk entries from explicit properties', () => {
    const result = makeBiomeChunkEntry('PLAINS', BIOME_PROPERTIES.PLAINS)

    expect(result).toEqual({
      biome: 'PLAINS',
      props: BIOME_PROPERTIES.PLAINS,
    })
  })

  it('builds biome chunk entries from refined biomes and a properties resolver', () => {
    const result = buildBiomeChunkEntries({
      chunkX: 0,
      chunkZ: 0,
      baseBiomes: Array.from({ length: CHUNK_COLUMN_SAMPLE_COUNT }, () => 'PLAINS' as const),
      continentalness: new Float64Array(CHUNK_COLUMN_SAMPLE_COUNT),
      outsideNeighborBiomesByKey: new Map(),
      propsForBiome: (biome) => BIOME_PROPERTIES[biome],
    })

    expect(result).toHaveLength(CHUNK_COLUMN_SAMPLE_COUNT)
    expect(result[0]).toEqual({
      biome: 'PLAINS',
      props: BIOME_PROPERTIES.PLAINS,
    })
  })

  it('maps chunk noise coordinates into batch input arrays', () => {
    const result = buildChunkNoiseBatchInputsFromCoords({
      coords: [
        { tempX: 1, tempZ: 2, humX: 3, humZ: 4 },
        { tempX: -5, tempZ: -6, humX: -7, humZ: -8 },
      ],
      riverScale: 10,
      riverWorldOffset: 100,
    })

    expect(result).toEqual({
      tempXs: [1, -5],
      tempZs: [2, -6],
      humXs: [3, -7],
      humZs: [4, -8],
      riverXs: [110, 50],
      riverZs: [120, 40],
    })
  })
})
