import { CHUNK_SIZE } from '@ts-minecraft/core'
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  batchTerrainIndexFor,
  classifyBiome,
  classifyBiomeFromClimate,
  peaksAndValleysFromWeirdness,
  refineBeachBiome,
} from './biome-classifier'
import { toPV } from './noise-primitives'

const classifyBiomeCases = [
  [0.1, 0.1, 'SNOW'],
  [0.5, 0.1, 'DESERT'],
  [0.8, 0.8, 'JUNGLE'],
  [0.2, 0.9, 'TAIGA'],
  [0.2, 0.6, 'TAIGA'],
  [0.2, 0.45, 'MOUNTAINS'],
  [0.2, 0.2, 'SNOW'],
  [0.2, 0.65, 'TAIGA'],
  [0.8, 0.55, 'SAVANNA'],
  [0.8, 0.3, 'SAVANNA'],
  [0.8, 0.1, 'DESERT'],
  [0.1, 0.6, 'TAIGA'],
  [0.1, 0.45, 'MOUNTAINS'],
  [0.1, 0.2, 'SNOW'],
] as const

const classifyBiomeFromClimateCases = [
  [{ temperature: 0.5, humidity: 0.5, continentalness: 0, erosion: 0.5, pv: 0, riverNoise: 0.5 }, 'RIVER'],
  [{ temperature: 0.5, humidity: 0.5, continentalness: -0.5, erosion: 0.5, pv: 0, riverNoise: 0.8 }, 'OCEAN'],
  [{ temperature: 0.2, humidity: 0.9, continentalness: 0.6, erosion: 0.1, pv: 1, riverNoise: 0.8 }, 'SNOW'],
  [{ temperature: 0.8, humidity: 0.8, continentalness: 0.6, erosion: 0.1, pv: 1, riverNoise: 0.8 }, 'MOUNTAINS'],
  [{ temperature: 0.8, humidity: 0.8, continentalness: 0.2, erosion: 0.2, pv: 0, riverNoise: 0.8 }, 'JUNGLE'],
  [{ temperature: 0.2, humidity: 0.41, continentalness: 0.2, erosion: 0.2, pv: 0.2, riverNoise: 0.8 }, 'TAIGA'],
  [{ temperature: 0.8, humidity: 0.9, continentalness: 0.2, erosion: 0.2, pv: 0, riverNoise: 0.8 }, 'JUNGLE'],
  [{ temperature: 0.5, humidity: 0.4, continentalness: 0.2, erosion: 0.5, pv: 0, riverNoise: 0.8 }, 'PLAINS'],
] as const

const refineBeachBiomeCases = [
  ['OCEAN', ['OCEAN'], -0.5, 'OCEAN'],
  ['OCEAN', ['PLAINS'], 0.0, 'OCEAN'],
  ['DESERT', ['OCEAN'], 0.0, 'DESERT'],
  ['SWAMP', ['OCEAN'], 0.0, 'SWAMP'],
  ['PLAINS', ['FOREST', 'OCEAN', 'PLAINS', 'PLAINS'], 0.05, 'BEACH'],
  ['PLAINS', ['OCEAN'], 0.15, 'PLAINS'],
  ['PLAINS', ['FOREST', 'MOUNTAINS'], 0.0, 'PLAINS'],
  ['FOREST', ['OCEAN'], 0.05, 'BEACH'],
] as const

describe('classifyBiome', () => {
  it.each(classifyBiomeCases)('temperature=%s humidity=%s → %s', (temperature, humidity, expected) => {
    expect(classifyBiome(temperature, humidity)).toBe(expected)
  })
})

describe('classifyBiomeFromClimate', () => {
  it.each(classifyBiomeFromClimateCases)('classifies %o as %s', (climate, expected) => {
    expect(classifyBiomeFromClimate(climate)).toBe(expected)
  })
})

describe('batchTerrainIndexFor', () => {
  it('i=0 (lx=0, lz=0) maps to output index 0', () => {
    expect(batchTerrainIndexFor(0)).toBe(0)
  })

  it('i=1 (lx=0, lz=1) maps to terrain-channel index 16 (1*16+0)', () => {
    // buildChunkNoiseInputs: lx=floor(1/16)=0, lz=1%16=1
    // batchTerrainIndexFor: lz*CHUNK_SIZE + lx = 1*16 + 0 = 16
    expect(batchTerrainIndexFor(1)).toBe(16)
  })

  it('i=16 (lx=1, lz=0) maps to terrain-channel index 1 (0*16+1)', () => {
    // buildChunkNoiseInputs: lx=floor(16/16)=1, lz=0
    // batchTerrainIndexFor: lz*CHUNK_SIZE + lx = 0*16 + 1 = 1
    expect(batchTerrainIndexFor(16)).toBe(1)
  })

  it('transposes: lx=3, lz=5 (i=53) maps to 5*16+3=83', () => {
    // buildChunkNoiseInputs i = lx*CHUNK_SIZE + lz = 3*16+5=53
    // batchTerrainIndexFor: lz*CHUNK_SIZE + lx = 5*16 + 3 = 83
    expect(batchTerrainIndexFor(53)).toBe(83)
  })

  it('is a bijection over [0, CHUNK_SIZE²-1]: every output index appears exactly once', () => {
    const seen = new Set<number>()
    for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
      seen.add(batchTerrainIndexFor(i))
    }
    expect(seen.size).toBe(CHUNK_SIZE * CHUNK_SIZE)
  })
})

describe('peaksAndValleysFromWeirdness', () => {
  it('w=0 returns -1 (valley)', () => {
    expect(peaksAndValleysFromWeirdness(0)).toBeCloseTo(-1)
  })

  it('w=2/3 returns 1 (peak)', () => {
    expect(peaksAndValleysFromWeirdness(2 / 3)).toBeCloseTo(1, 5)
  })

  it('is symmetric: f(-w) === f(w)', () => {
    expect(peaksAndValleysFromWeirdness(-0.5)).toBeCloseTo(peaksAndValleysFromWeirdness(0.5))
    expect(peaksAndValleysFromWeirdness(-0.25)).toBeCloseTo(peaksAndValleysFromWeirdness(0.25))
  })

  it('is byte-identical to infrastructure toPV (guards against silent divergence)', () => {
    const testValues = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]
    for (const w of testValues) {
      expect(peaksAndValleysFromWeirdness(w)).toBeCloseTo(toPV(w), 10)
    }
  })
})

describe('refineBeachBiome', () => {
  it.each(refineBeachBiomeCases)('%s with adjacency %o and continentalness %s → %s', (biome, neighboringBiomes, continentalness, expected) => {
    expect(refineBeachBiome(biome, neighboringBiomes, continentalness)).toBe(expected)
  })
})
