import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  buildBiomeScalarSamplingPlan,
  refineScalarBiome,
} from './biome-scalar-assembly'

describe('buildBiomeScalarSamplingPlan', () => {
  it('builds scalar climate and river sample coordinates from world coordinates', () => {
    const result = buildBiomeScalarSamplingPlan({
      x: 16,
      z: 8,
      biomeScale: 0.005,
      humidityWorldOffset: 10000,
      riverNoiseScale: 0.02,
      riverWorldOffset: 2000,
    })

    expect(result).toEqual({
      tempX: 0.08,
      tempZ: 0.04,
      humX: 50.08,
      humZ: 50.04,
      riverX: 2000.32,
      riverZ: 2000.16,
      neighboringCoords: [
        { x: 15, z: 8 },
        { x: 17, z: 8 },
        { x: 16, z: 7 },
        { x: 16, z: 9 },
      ],
    })
  })
})

describe('refineScalarBiome', () => {
  it('refines shoreline PLAINS into BEACH when adjacent to water', () => {
    const result = refineScalarBiome({
      biome: 'PLAINS',
      continentalness: -0.08,
      neighboringBiomes: ['OCEAN', 'PLAINS', 'PLAINS', 'PLAINS'],
    })

    expect(result).toBe('BEACH')
  })

  it('keeps inland biomes unchanged when the beach conditions are not met', () => {
    const result = refineScalarBiome({
      biome: 'FOREST',
      continentalness: 0.4,
      neighboringBiomes: ['PLAINS', 'PLAINS', 'PLAINS', 'PLAINS'],
    })

    expect(result).toBe('FOREST')
  })
})
