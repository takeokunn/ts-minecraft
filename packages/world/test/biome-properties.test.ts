import { describe, expect, it } from 'vitest'
import { BIOME_PROPERTIES } from '@ts-minecraft/world/domain/biome-properties'
import type { BiomeType } from '@ts-minecraft/world/domain/biome'

// ─── BIOME_PROPERTIES ─────────────────────────────────────────────────────────
describe('BIOME_PROPERTIES', () => {
  const ALL_BIOMES: BiomeType[] = [
    'PLAINS', 'DESERT', 'FOREST', 'OCEAN', 'MOUNTAINS',
    'SNOW', 'SWAMP', 'JUNGLE', 'BEACH', 'RIVER', 'TAIGA', 'SAVANNA',
  ]

  it('has an entry for every biome type', () => {
    for (const biome of ALL_BIOMES) {
      expect(BIOME_PROPERTIES[biome]).toBeDefined()
    }
  })

  it('all temperature values are in [0, 1]', () => {
    for (const biome of ALL_BIOMES) {
      const { temperature } = BIOME_PROPERTIES[biome]
      expect(temperature).toBeGreaterThanOrEqual(0)
      expect(temperature).toBeLessThanOrEqual(1)
    }
  })

  it('all humidity values are in [0, 1]', () => {
    for (const biome of ALL_BIOMES) {
      const { humidity } = BIOME_PROPERTIES[biome]
      expect(humidity).toBeGreaterThanOrEqual(0)
      expect(humidity).toBeLessThanOrEqual(1)
    }
  })

  it('all treeDensity values are in [0, 1]', () => {
    for (const biome of ALL_BIOMES) {
      const { treeDensity } = BIOME_PROPERTIES[biome]
      expect(treeDensity).toBeGreaterThanOrEqual(0)
      expect(treeDensity).toBeLessThanOrEqual(1)
    }
  })

  it('DESERT has treeDensity 0 (no trees in desert)', () => {
    expect(BIOME_PROPERTIES.DESERT.treeDensity).toBe(0)
  })

  it('JUNGLE has the highest treeDensity', () => {
    const jungle = BIOME_PROPERTIES.JUNGLE.treeDensity
    for (const biome of ALL_BIOMES) {
      expect(jungle).toBeGreaterThanOrEqual(BIOME_PROPERTIES[biome].treeDensity)
    }
  })

  it('SNOW biome has a low temperature', () => {
    expect(BIOME_PROPERTIES.SNOW.temperature).toBeLessThan(0.3)
  })

  it('DESERT biome has a high temperature', () => {
    expect(BIOME_PROPERTIES.DESERT.temperature).toBeGreaterThan(0.8)
  })

  it('SNOW surface block is SNOW', () => {
    expect(BIOME_PROPERTIES.SNOW.surfaceBlock).toBe('SNOW')
  })

  it('DESERT surface block is SAND', () => {
    expect(BIOME_PROPERTIES.DESERT.surfaceBlock).toBe('SAND')
  })
})
