import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { it as itEffect } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import { BrandedTypes } from '../../../shared/types/branded'
import {
  BiomeGeneratorTag,
  BiomeGeneratorLive,
  BiomeGeneratorLiveDefault,
  BiomeConfigSchema,
  ClimateDataSchema,
  type BiomeGenerator,
  type BiomeConfig,
  type ClimateData,
} from '../BiomeGenerator'
import type { NoiseGenerator } from '../NoiseGenerator'
import { NoiseGeneratorTag } from '../NoiseGenerator'
import type { BiomeType, Vector3 } from '../types'

// NoiseGenerator モックレイヤー
const NoiseGeneratorTestLayer = Layer.succeed(NoiseGeneratorTag, {
  noise2D: () => Effect.succeed(BrandedTypes.createNoiseValue(0.5)),
  noise3D: () => Effect.succeed(BrandedTypes.createNoiseValue(0.5)),
  octaveNoise2D: () => Effect.succeed(BrandedTypes.createNoiseValue(0.3)),
  octaveNoise3D: () => Effect.succeed(BrandedTypes.createNoiseValue(0.3)),
  getSeed: () => 12345,
  getConfig: () => ({
    seed: 12345,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
  }),
})

// テスト用レイヤー
const testLayer = (config: BiomeConfig) => Layer.mergeAll(NoiseGeneratorTestLayer, BiomeGeneratorLive(config))

describe('BiomeGenerator', () => {
  const testConfig: BiomeConfig = {
  temperatureScale: 0.002,
  humidityScale: 0.003,
  mountainThreshold: 80,
  oceanDepth: 10,
  riverWidth: 8,
  }
  describe('BiomeConfigSchema', () => {
  it.effect('validates valid biome configuration', () => Effect.gen(function* () {
    // REMOVED: // REMOVED: fc.assert(
    // REMOVED: fc.property(
    // REMOVED: fc.record({
    temperatureScale: // REMOVED: fc.float({ min: Math.fround(0.001), max: Math.fround(0.01)
    ),
    humidityScale: // REMOVED: fc.float({ min: Math.fround(0.001
    }),
    max: Math.fround(0.01)
}),
    mountainThreshold: // REMOVED: fc.integer({ min: 50, max: 150 }),
    oceanDepth: // REMOVED: fc.integer({ min: 5, max: 30 }),
    riverWidth: // REMOVED: fc.integer({ min: 4, max: 16 }),
    }),
    (config) => {
    expect(() => Schema.decodeUnknownSync(BiomeConfigSchema)(config)).not.toThrow()
    ),
    { numRuns: 50 }
    )
    it.effect('rejects invalid configuration', () => Effect.gen(function* () {
    const invalidConfigs = [
    { temperatureScale: 'invalid', humidityScale: 0.003, mountainThreshold: 80, oceanDepth: 10, riverWidth: 8 },
    { temperatureScale: 0.002, humidityScale: null, mountainThreshold: 80, oceanDepth: 10, riverWidth: 8 },
    ]
    for (
    expect(() => Schema.decodeUnknownSync(BiomeConfigSchema)(config)).toThrow()
    ) {$2}
    )
  }) {
    it.effect('validates valid climate data', () => Effect.gen(function* () {
    // REMOVED: // REMOVED: fc.assert(
    // REMOVED: fc.property(
    // REMOVED: fc.record({
    temperature: // REMOVED: fc.float({ min: -1.0, max: 1.0
    }),
    humidity: // REMOVED: fc.float({ min: -1.0, max: 1.0 }),
    elevation: // REMOVED: fc.float({ min: -100, max: 200 }),
    }),
    (climate) => {
    expect(() => Schema.decodeUnknownSync(ClimateDataSchema)(climate)).not.toThrow()
    }
    ),
    { numRuns: 50 }
    )
  }) {
  itEffect('creates BiomeGenerator with custom config', () => Effect.gen(function* () {
  const bg = yield* BiomeGeneratorTag
  expect(bg.getConfig()).toEqual(testConfig)
}).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('creates BiomeGenerator with default config', () => Effect.gen(function* () {
        const bg = yield* BiomeGeneratorTag
        const config = bg.getConfig()

        expect(config.temperatureScale).toBe(0.002)
        expect(config.humidityScale).toBe(0.003)
        expect(config.mountainThreshold).toBe(80)
        expect(config.oceanDepth).toBe(10)
        expect(config.riverWidth).toBe(8)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorTestLayer, BiomeGeneratorLiveDefault)))
    )
  })

  describe('Climate Data Generation', () => {
  itEffect('generates valid climate data for coordinates', () => Effect.gen(function* () {
  const bg = yield* BiomeGeneratorTag
  const climate = yield* bg.getClimateData(0, 0)
  expect(typeof climate.temperature).toBe('number')
  expect(typeof climate.humidity).toBe('number')
  expect(typeof climate.elevation).toBe('number')
  expect(Number.isFinite(climate.temperature)).toBe(true)
  expect(Number.isFinite(climate.humidity)).toBe(true)
  expect(Number.isFinite(climate.elevation)).toBe(true)
  // 値の範囲確認（ノイズなので-1〜1の範囲内であるべき）
  expect(climate.temperature).toBeGreaterThanOrEqual(-1)
  expect(climate.temperature).toBeLessThanOrEqual(1)
  expect(climate.humidity).toBeGreaterThanOrEqual(-1)
  expect(climate.humidity).toBeLessThanOrEqual(1)
}).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('provides consistent climate data for same coordinates', () => Effect.gen(function* () {
        const bg = yield* BiomeGeneratorTag
        const climate1 = yield* bg.getClimateData(123, 456)
        const climate2 = yield* bg.getClimateData(123, 456)

        expect(climate1).toEqual(climate2)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
  })

  describe('Biome Determination', () => {
  itEffect('determines correct biomes based on climate', () => Effect.gen(function* () {
  const bg = yield* BiomeGeneratorTag
  const testCases: Array<{ climate: ClimateData; expectedBiomes: BiomeType[] }> = [
  {
  climate: { temperature: -0.8, humidity: 0.5, elevation: 50 },
  expectedBiomes: ['snowy_tundra'],
  },
  {
  climate: { temperature: 0.8, humidity: -0.6, elevation: 50 },
  expectedBiomes: ['desert'],
  },
  ]
  for (const { climate, expectedBiomes } of testCases) {
  const biome = bg.determineBiome(climate)
  expect(expectedBiomes).toContain(biome)
  }
}).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('handles extreme climate values', () => Effect.gen(function* () {
        const bg = yield* BiomeGeneratorTag

        const extremeClimateData: ClimateData[] = [
          { temperature: -1.0, humidity: -1.0, elevation: -100 },
          { temperature: 1.0, humidity: 1.0, elevation: 200 },
          { temperature: 0.0, humidity: 0.0, elevation: 0 },
        ]

        for (const climate of extremeClimateData) {
          const biome = bg.determineBiome(climate)
          expect(typeof biome).toBe('string')
          expect(biome.length).toBeGreaterThan(0)
        }
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
  })

  describe('Biome Position-Based Generation', () => {
  itEffect('generates biomes for 3D positions', () => Effect.gen(function* () {
  const bg = yield* BiomeGeneratorTag
  const position: Vector3 = { x: 0, y: 64, z: 0 }
  const biome = yield* bg.getBiome(position)
  expect(typeof biome).toBe('string')
  expect(biome.length).toBeGreaterThan(0)
  // 有効なバイオームタイプであることを確認
  const validBiomes = [
  'plains',
  'desert',
  'forest',
  'jungle',
  'swamp',
  'taiga',
  'snowy_tundra',
  'mountains',
  'ocean',
  'river',
  'beach',
  'mushroom_fields',
  'savanna',
  'badlands',
  'nether',
  'end',
  'void',
  ]
  expect(validBiomes).toContain(biome)
}).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('provides consistent biomes for same position', () => Effect.gen(function* () {
        const bg = yield* BiomeGeneratorTag
        const position: Vector3 = { x: 123, y: 64, z: 456 }

        const biome1 = yield* bg.getBiome(position)
        const biome2 = yield* bg.getBiome(position)

        expect(biome1).toBe(biome2)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
  })

  describe('Biome Map Generation', () => {
  itEffect('generates valid 16x16 biome map', () => Effect.gen(function* () {
  const bg = yield* BiomeGeneratorTag
  const biomeMap = yield* bg.generateBiomeMap(0, 0)
  // 16x16の配列であることを確認
  expect(biomeMap).toHaveLength(16)
  for (let x = 0; x < 16; x++) {
  expect(biomeMap[x]).toHaveLength(16)
  for (let z = 0; z < 16; z++) {
  const biome = biomeMap[x]?.[z]
  expect(biome).toBeDefined()
  expect(typeof biome).toBe('string')
  expect(biome?.length).toBeGreaterThan(0)
  }
  }
}).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('generates consistent biome maps for same chunk', () => Effect.gen(function* () {
        const bg = yield* BiomeGeneratorTag
        const biomeMap1 = yield* bg.generateBiomeMap(5, 10)
        const biomeMap2 = yield* bg.generateBiomeMap(5, 10)

        expect(biomeMap1).toEqual(biomeMap2)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
  })
})
