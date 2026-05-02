import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import {
  BIOME_PROPERTIES,
  BIOME_SCALE,
  HUMIDITY_WORLD_OFFSET,
  TEMP_COLD, TEMP_HOT,
  HUM_DRY, HUM_WET,
  HUM_VERY_DRY, HUM_VERY_WET,
  RIVER_CENTER, RIVER_HALF_WIDTH,
} from './biome-service.config'
import { BiomePropertiesSchema } from './biome-service'

const BIOME_TYPES = ['PLAINS', 'DESERT', 'FOREST', 'OCEAN', 'MOUNTAINS', 'SNOW', 'SWAMP', 'JUNGLE', 'BEACH', 'RIVER', 'TAIGA', 'SAVANNA'] as const

describe('biome-service.config — data integrity', () => {
  it('BIOME_PROPERTIES has an entry for every BiomeType', () => {
    BIOME_TYPES.forEach((biomeType) => {
      expect(BIOME_PROPERTIES[biomeType]).toBeDefined()
    })
  })

  it('every BIOME_PROPERTIES entry satisfies BiomePropertiesSchema', () => {
    Object.entries(BIOME_PROPERTIES).forEach(([, props]) => {
      expect(() => Schema.decodeUnknownSync(BiomePropertiesSchema)(props)).not.toThrow()
    })
  })

  it('every biome treeDensity is in [0, 1]', () => {
    Object.entries(BIOME_PROPERTIES).forEach(([, props]) => {
      expect(props.treeDensity).toBeGreaterThanOrEqual(0)
      expect(props.treeDensity).toBeLessThanOrEqual(1)
    })
  })

  it('threshold ordering: HUM_VERY_DRY < HUM_DRY < HUM_WET < HUM_VERY_WET', () => {
    expect(HUM_VERY_DRY).toBeLessThan(HUM_DRY)
    expect(HUM_DRY).toBeLessThan(HUM_WET)
    expect(HUM_WET).toBeLessThan(HUM_VERY_WET)
  })

  it('threshold ordering: TEMP_COLD < TEMP_HOT', () => {
    expect(TEMP_COLD).toBeLessThan(TEMP_HOT)
  })

  it('BIOME_SCALE is a small positive number (world-space frequency)', () => {
    expect(BIOME_SCALE).toBeGreaterThan(0)
    expect(BIOME_SCALE).toBeLessThan(0.1)
  })

  it('HUMIDITY_WORLD_OFFSET is large (decorrelates humidity from temperature noise)', () => {
    expect(HUMIDITY_WORLD_OFFSET).toBeGreaterThan(1000)
  })

  it('RIVER_CENTER is 0.5 (midpoint of noise range)', () => {
    expect(RIVER_CENTER).toBe(0.5)
  })

  it('RIVER_HALF_WIDTH is a small positive number', () => {
    expect(RIVER_HALF_WIDTH).toBeGreaterThan(0)
    expect(RIVER_HALF_WIDTH).toBeLessThan(0.2)
  })

  it('constant values match expected values', () => {
    expect(TEMP_COLD).toBe(0.3)
    expect(TEMP_HOT).toBe(0.7)
    expect(HUM_VERY_DRY).toBe(0.15)
    expect(HUM_VERY_WET).toBe(0.85)
  })
})
