import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { Schema } from '@effect/schema'
import * as fc from 'fast-check'
import {
  expectEffectSuccess,
  expectEffectDuration,
  itEffectWithLayer,
} from '../../../test/unified-test-helpers'
import {
  BiomeGenerator,
  BiomeGeneratorLive,
  BiomeGeneratorLiveDefault,
  BiomeConfigSchema,
  ClimateDataSchema,
  type BiomeConfig,
  type ClimateData,
} from '../BiomeGenerator'
import { NoiseGenerator, NoiseGeneratorLiveDefault } from '../NoiseGenerator'
import type { BiomeType, Vector3 } from '../types'

/**
 * BiomeGenerator専用のテストヘルパー
 * Context7準拠のLayer-basedテストパターン
 */
const TestLayer = Layer.mergeAll(
  NoiseGeneratorLiveDefault,
  BiomeGeneratorLiveDefault
)

const runWithTestBiome = <A>(
  config: BiomeConfig,
  operation: (bg: BiomeGenerator) => Effect.Effect<A, never, NoiseGenerator>
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const bg = yield* BiomeGenerator
    return yield* operation(bg)
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        NoiseGeneratorLiveDefault,
        BiomeGeneratorLive(config)
      )
    )
  ) as Effect.Effect<A, never, never>
/**
 * @effect/vitest統合用のBiomeGeneratorテストヘルパー
 * Effect.genパターンによる決定論的テスト
 */
const testWithBiome = <A>(
  name: string,
  config: BiomeConfig,
  operation: (bg: BiomeGenerator) => Effect.Effect<A, never, NoiseGenerator>,
  timeout?: number
) => {
  it(name, async () => {
    const testEffect = Effect.gen(function* () {
      const bg = yield* BiomeGenerator
      return yield* operation(bg)
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          NoiseGeneratorLiveDefault,
          BiomeGeneratorLive(config)
        )
      )
    ) as Effect.Effect<A, never, never>

    await expectEffectSuccess(testEffect, timeout)
  })
}

describe('BiomeGenerator', () => {
  const testConfig: BiomeConfig = {
    temperatureScale: 0.002,
    humidityScale: 0.003,
    mountainThreshold: 80,
    oceanDepth: 10,
    riverWidth: 8,
  }

  describe('BiomeConfigSchema', () => {
    it('validates valid biome configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperatureScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.01) }),
            humidityScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.01) }),
            mountainThreshold: fc.integer({ min: 50, max: 150 }),
            oceanDepth: fc.integer({ min: 5, max: 30 }),
            riverWidth: fc.integer({ min: 4, max: 16 }),
          }),
          (config) => {
            expect(() => Schema.decodeUnknownSync(BiomeConfigSchema)(config)).not.toThrow()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('rejects invalid configuration', () => {
      const invalidConfigs = [
        { temperatureScale: 'invalid', humidityScale: 0.003, mountainThreshold: 80, oceanDepth: 10, riverWidth: 8 },
        { temperatureScale: 0.002, humidityScale: null, mountainThreshold: 80, oceanDepth: 10, riverWidth: 8 },
        { temperatureScale: 0.002, humidityScale: 0.003, mountainThreshold: 'invalid', oceanDepth: 10, riverWidth: 8 },
        { temperatureScale: 0.002, humidityScale: 0.003, mountainThreshold: 80, oceanDepth: -5, riverWidth: 8 },
      ]

      for (const config of invalidConfigs) {
        expect(() => Schema.decodeUnknownSync(BiomeConfigSchema)(config)).toThrow()
      }
    })
  })

  describe('ClimateDataSchema', () => {
    it('validates valid climate data', () => {
      fc.assert(
        fc.property(
          fc.record({
            temperature: fc.float({ min: -1.0, max: 1.0 }),
            humidity: fc.float({ min: -1.0, max: 1.0 }),
            elevation: fc.float({ min: -100, max: 200 }),
          }),
          (climate) => {
            expect(() => Schema.decodeUnknownSync(ClimateDataSchema)(climate)).not.toThrow()
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('Service Creation', () => {
    it('creates BiomeGenerator with custom config', async () => {
      const testEffect = Effect.gen(function* () {
        const bg = yield* BiomeGenerator
        expect(bg.getConfig()).toEqual(testConfig)
      })

      await expectEffectSuccess(
        testEffect.pipe(
          Effect.provide(
            Layer.mergeAll(
              NoiseGeneratorLiveDefault,
              BiomeGeneratorLive(testConfig)
            )
          )
        )
      )
    })

    it('creates BiomeGenerator with default config', async () => {
      const testEffect = Effect.gen(function* () {
        const bg = yield* BiomeGenerator
        const config = bg.getConfig()

        expect(config.temperatureScale).toBe(0.002)
        expect(config.humidityScale).toBe(0.003)
        expect(config.mountainThreshold).toBe(80)
        expect(config.oceanDepth).toBe(10)
        expect(config.riverWidth).toBe(8)
      })

      await expectEffectSuccess(
        testEffect.pipe(
          Effect.provide(
            Layer.mergeAll(
              NoiseGeneratorLiveDefault,
              BiomeGeneratorLiveDefault
            )
          )
        )
      )
    })
  })

  describe('Climate Data Generation', () => {
    it('generates valid climate data for coordinates', async () => {
      const testCoords = [
        { x: 0, z: 0 },
        { x: 100, z: 100 },
        { x: -50, z: 75 },
        { x: 1000, z: -500 },
      ]

      for (const { x, z } of testCoords) {
        const effect = runWithTestBiome(testConfig, (bg) =>
          Effect.gen(function* () {
            const climate = yield* bg.getClimateData(x, z)

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

            return climate
          })
        )

        await expectEffectSuccess(effect)
      }
    })

    it('provides consistent climate data for same coordinates', async () => {
      const x = 123
      const z = 456

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const climate1 = yield* bg.getClimateData(x, z)
          const climate2 = yield* bg.getClimateData(x, z)

          expect(climate1).toEqual(climate2)

          return climate1
        })
      )

      await expectEffectSuccess(effect)
    })

    it('generates different climate data for different coordinates', async () => {
      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const climate1 = yield* bg.getClimateData(0, 0)
          const climate2 = yield* bg.getClimateData(1000, 1000)

          // 大きく離れた座標では異なる気候になるはず
          expect(climate1).not.toEqual(climate2)

          return { climate1, climate2 }
        })
      )

      await expectEffectSuccess(effect)
    })
  })

  describe('Biome Determination', () => {
    it('determines correct biomes based on climate', async () => {
      const testCases: Array<{ climate: ClimateData; expectedBiomes: BiomeType[] }> = [
        {
          climate: { temperature: -0.8, humidity: 0.5, elevation: 50 },
          expectedBiomes: ['snowy_tundra'],
        },
        {
          climate: { temperature: 0.8, humidity: -0.6, elevation: 50 },
          expectedBiomes: ['desert'],
        },
        {
          climate: { temperature: 0.8, humidity: 0.6, elevation: 50 },
          expectedBiomes: ['jungle'],
        },
        {
          climate: { temperature: 0.0, humidity: 0.0, elevation: 50 },
          expectedBiomes: ['plains', 'forest'],
        },
        {
          climate: { temperature: 0.0, humidity: 0.8, elevation: 50 },
          expectedBiomes: ['swamp'],
        },
        {
          climate: { temperature: 0.0, humidity: 0.0, elevation: 100 },
          expectedBiomes: ['mountains'],
        },
        {
          climate: { temperature: 0.0, humidity: 0.0, elevation: -20 },
          expectedBiomes: ['ocean'],
        },
      ]

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const results = testCases.map(({ climate, expectedBiomes }) => {
            const biome = bg.determineBiome(climate)
            return {
              climate,
              biome,
              isExpected: expectedBiomes.includes(biome),
            }
          })

          return results
        })
      )

      const results = await expectEffectSuccess(effect)

      for (const result of results) {
        expect(result.isExpected).toBe(true)
      }
    })

    it('handles extreme climate values', async () => {
      const extremeClimateData: ClimateData[] = [
        { temperature: -1.0, humidity: -1.0, elevation: -100 },
        { temperature: 1.0, humidity: 1.0, elevation: 200 },
        { temperature: 0.0, humidity: 0.0, elevation: 0 },
      ]

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const biomes = extremeClimateData.map(climate => bg.determineBiome(climate))

          // すべて有効なバイオームタイプを返すはず
          for (const biome of biomes) {
            expect(typeof biome).toBe('string')
            expect(biome.length).toBeGreaterThan(0)
          }

          return biomes
        })
      )

      await expectEffectSuccess(effect)
    })
  })

  describe('Biome Position-Based Generation', () => {
    it('generates biomes for 3D positions', async () => {
      const testPositions: Vector3[] = [
        { x: 0, y: 64, z: 0 },
        { x: 100, y: 80, z: 100 },
        { x: -50, y: 120, z: 75 },
        { x: 1000, y: 40, z: -500 },
      ]

      for (const position of testPositions) {
        const effect = runWithTestBiome(testConfig, (bg) =>
          Effect.gen(function* () {
            const biome = yield* bg.getBiome(position)

            expect(typeof biome).toBe('string')
            expect(biome.length).toBeGreaterThan(0)

            // 有効なバイオームタイプであることを確認
            const validBiomes = [
              'plains', 'desert', 'forest', 'jungle', 'swamp', 'taiga',
              'snowy_tundra', 'mountains', 'ocean', 'river', 'beach',
              'mushroom_fields', 'savanna', 'badlands', 'nether', 'end', 'void'
            ]
            expect(validBiomes).toContain(biome)

            return biome
          })
        )

        await expectEffectSuccess(effect)
      }
    })

    it('provides consistent biomes for same position', async () => {
      const position: Vector3 = { x: 123, y: 64, z: 456 }

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const biome1 = yield* bg.getBiome(position)
          const biome2 = yield* bg.getBiome(position)

          expect(biome1).toBe(biome2)

          return biome1
        })
      )

      await expectEffectSuccess(effect)
    })
  })

  describe('Biome Map Generation', () => {
    it('generates valid 16x16 biome map', async () => {
      const chunkX = 0
      const chunkZ = 0

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const biomeMap = yield* bg.generateBiomeMap(chunkX, chunkZ)

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

          return biomeMap
        })
      )

      await expectEffectSuccess(effect)
    })

    it('generates consistent biome maps for same chunk', async () => {
      const chunkX = 5
      const chunkZ = 10

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const biomeMap1 = yield* bg.generateBiomeMap(chunkX, chunkZ)
          const biomeMap2 = yield* bg.generateBiomeMap(chunkX, chunkZ)

          expect(biomeMap1).toEqual(biomeMap2)

          return { biomeMap1, biomeMap2 }
        })
      )

      await expectEffectSuccess(effect)
    })

    it('generates different biome maps for different chunks', async () => {
      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const biomeMap1 = yield* bg.generateBiomeMap(0, 0)
          const biomeMap2 = yield* bg.generateBiomeMap(10, 10)

          // 異なるチャンクでは異なるバイオーム分布になる可能性が高い
          expect(biomeMap1).not.toEqual(biomeMap2)

          return { biomeMap1, biomeMap2 }
        })
      )

      await expectEffectSuccess(effect)
    })

    it('generates biome maps efficiently', async () => {
      const chunkX = 0
      const chunkZ = 0

      const effect = runWithTestBiome(testConfig, (bg) => bg.generateBiomeMap(chunkX, chunkZ))

      // バイオームマップ生成は100ms以内で完了するべき
      await expectEffectDuration(effect, 0, 100)
    })
  })

  describe('Performance Requirements', () => {
    it('generates climate data efficiently', async () => {
      const effect = runWithTestBiome(testConfig, (bg) => bg.getClimateData(100, 200))

      // 気候データ生成は10ms以内
      await expectEffectDuration(effect, 0, 10)
    })

    it('determines biomes efficiently', async () => {
      const climate: ClimateData = { temperature: 0.5, humidity: 0.3, elevation: 70 }

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.sync(() => bg.determineBiome(climate))
      )

      // バイオーム判定は1ms以内（同期処理）
      await expectEffectDuration(effect, 0, 1)
    })

    it('handles batch biome generation', async () => {
      const positions: Vector3[] = Array.from({ length: 100 }, (_, i) => ({
        x: i * 10,
        y: 64,
        z: i * 10,
      }))

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const biomes = []
          for (const position of positions) {
            const biome = yield* bg.getBiome(position)
            biomes.push(biome)
          }
          return biomes
        })
      )

      // 100個のバイオーム生成は200ms以内
      const biomes = await expectEffectDuration(effect, 0, 200)
      expect(biomes).toHaveLength(100)
    })
  })

  describe('Edge Cases', () => {
    it('handles extreme coordinates', async () => {
      const extremeCoords = [
        { x: Number.MAX_SAFE_INTEGER, z: Number.MAX_SAFE_INTEGER },
        { x: -Number.MAX_SAFE_INTEGER, z: -Number.MAX_SAFE_INTEGER },
        { x: 0, z: Number.MAX_SAFE_INTEGER },
        { x: -Number.MAX_SAFE_INTEGER, z: 0 },
      ]

      for (const { x, z } of extremeCoords) {
        const effect = runWithTestBiome(testConfig, (bg) =>
          Effect.gen(function* () {
            const climate = yield* bg.getClimateData(x, z)
            const position: Vector3 = { x, y: 64, z }
            const biome = yield* bg.getBiome(position)

            expect(Number.isFinite(climate.temperature)).toBe(true)
            expect(Number.isFinite(climate.humidity)).toBe(true)
            expect(Number.isFinite(climate.elevation)).toBe(true)
            expect(typeof biome).toBe('string')

            return { climate, biome }
          })
        )

        await expectEffectSuccess(effect)
      }
    })

    it('handles boundary elevation values', async () => {
      const boundaryElevations = [
        testConfig.mountainThreshold - 1,
        testConfig.mountainThreshold,
        testConfig.mountainThreshold + 1,
        -testConfig.oceanDepth - 1,
        -testConfig.oceanDepth,
        -testConfig.oceanDepth + 1,
      ]

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const results = boundaryElevations.map(elevation => {
            const climate: ClimateData = { temperature: 0, humidity: 0, elevation }
            const biome = bg.determineBiome(climate)
            return { elevation, biome }
          })

          return results
        })
      )

      const results = await expectEffectSuccess(effect)

      for (const result of results) {
        expect(typeof result.biome).toBe('string')
        expect(result.biome.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Biome Distribution Statistics', () => {
    it('generates reasonable biome distribution', async () => {
      const sampleSize = 1000

      const effect = runWithTestBiome(testConfig, (bg) =>
        Effect.gen(function* () {
          const biomes: BiomeType[] = []

          for (let i = 0; i < sampleSize; i++) {
            const x = (Math.random() - 0.5) * 2000 // -1000 to 1000
            const z = (Math.random() - 0.5) * 2000
            const position: Vector3 = { x, y: 64, z }
            const biome = yield* bg.getBiome(position)
            biomes.push(biome)
          }

          return biomes
        })
      )

      const biomes = await expectEffectSuccess(effect)

      // バイオーム分布の統計
      const biomeCount = new Map<BiomeType, number>()
      for (const biome of biomes) {
        biomeCount.set(biome, (biomeCount.get(biome) ?? 0) + 1)
      }

      // 最低でも3種類以上のバイオームが生成されているはず
      expect(biomeCount.size).toBeGreaterThanOrEqual(3)

      // どのバイオームも全体の95%を超えないはず（多様性の確保）
      for (const count of biomeCount.values()) {
        expect(count / sampleSize).toBeLessThan(0.95)
      }
    })
  })
})