import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'
import { batchTerrainIndexFor, peaksAndValleysFromWeirdness, refineBeachBiome } from './biome-classifier'
import { toPV } from '../infrastructure/primitives'

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
    // batchTerrainIndexFor: lz*CHUNK_SIZE + lx = 5*16+3 = 83
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
  it('OCEAN always returns OCEAN', () => {
    expect(refineBeachBiome('OCEAN', ['OCEAN'], -0.5)).toBe('OCEAN')
    expect(refineBeachBiome('OCEAN', ['PLAINS'], 0.0)).toBe('OCEAN')
  })

  it('DESERT always returns DESERT', () => {
    expect(refineBeachBiome('DESERT', ['OCEAN'], 0.0)).toBe('DESERT')
  })

  it('SWAMP always returns SWAMP', () => {
    expect(refineBeachBiome('SWAMP', ['OCEAN'], 0.0)).toBe('SWAMP')
  })

  it('PLAINS adjacent to OCEAN with low continentalness → BEACH', () => {
    expect(refineBeachBiome('PLAINS', ['FOREST', 'OCEAN', 'PLAINS', 'PLAINS'], 0.05)).toBe('BEACH')
  })

  it('PLAINS adjacent to OCEAN but high continentalness → stays PLAINS', () => {
    expect(refineBeachBiome('PLAINS', ['OCEAN'], 0.15)).toBe('PLAINS')
  })

  it('PLAINS with no adjacent OCEAN → stays PLAINS regardless of continentalness', () => {
    expect(refineBeachBiome('PLAINS', ['FOREST', 'MOUNTAINS'], 0.0)).toBe('PLAINS')
  })

  it('FOREST adjacent to OCEAN with low continentalness → BEACH', () => {
    expect(refineBeachBiome('FOREST', ['OCEAN'], 0.05)).toBe('BEACH')
  })
})
