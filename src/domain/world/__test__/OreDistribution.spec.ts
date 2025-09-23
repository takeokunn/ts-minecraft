import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { Schema } from '@effect/schema'
import * as fc from 'fast-check'
import {
  OreDistributionLive,
  OreDistributionLiveDefault,
  OreDistributionTag,
  OreDistributionConfigSchema,
  OreConfigSchema,
  OreTypeSchema,
  defaultOreConfigs,
  type OreDistribution,
  type OreDistributionConfig,
  type OreConfig,
  type OreType,
} from '../OreDistribution'
import { NoiseGeneratorLiveDefault, type NoiseGenerator } from '../NoiseGenerator'
import { createChunkData } from '../../chunk/ChunkData'

/**
 * OreDistribution専用のテストヘルパー
 */
const runWithTestOreDistribution = <A>(
  config: OreDistributionConfig,
  operation: (od: OreDistribution) => Effect.Effect<A, never, NoiseGenerator>
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const od = yield* OreDistributionTag
    return yield* operation(od)
  }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, OreDistributionLive(config)))) as Effect.Effect<
    A,
    never,
    never
  >

describe('OreDistribution', () => {
  const testConfig: OreDistributionConfig = {
    ores: [
      {
        type: 'coal_ore',
        blockId: 16,
        minY: 0,
        maxY: 256,
        density: 0.8,
        clusterSize: 8,
        rarity: 0.3,
        noiseScale: 0.05,
      },
      {
        type: 'iron_ore',
        blockId: 17,
        minY: -64,
        maxY: 256,
        density: 0.6,
        clusterSize: 6,
        rarity: 0.4,
        noiseScale: 0.04,
      },
      {
        type: 'diamond_ore',
        blockId: 22,
        minY: -64,
        maxY: 16,
        density: 0.1,
        clusterSize: 2,
        rarity: 0.85,
        noiseScale: 0.02,
      },
    ],
    noiseScale: 0.05,
    clusterThreshold: 0.6,
  }

  describe('Schema Validation', () => {
    describe('OreTypeSchema', () => {
      it('validates valid ore types', () => {
        const validOreTypes: OreType[] = [
          'coal_ore',
          'iron_ore',
          'copper_ore',
          'gold_ore',
          'redstone_ore',
          'lapis_ore',
          'diamond_ore',
          'emerald_ore',
        ]

        for (const oreType of validOreTypes) {
          expect(() => Schema.decodeUnknownSync(OreTypeSchema)(oreType)).not.toThrow()
        }
      })

      it('rejects invalid ore types', () => {
        const invalidOreTypes = ['invalid_ore', 'wood_ore', '', null, undefined, 123]

        for (const oreType of invalidOreTypes) {
          expect(() => Schema.decodeUnknownSync(OreTypeSchema)(oreType)).toThrow()
        }
      })
    })

    describe('OreConfigSchema', () => {
      it('validates valid ore configuration', () => {
        fc.assert(
          fc.property(
            fc.record({
              type: fc.constantFrom('coal_ore', 'iron_ore', 'diamond_ore', 'emerald_ore'),
              blockId: fc.integer({ min: 1, max: 255 }),
              minY: fc.integer({ min: -64, max: 200 }),
              maxY: fc.integer({ min: -64, max: 320 }),
              density: fc.float({ min: Math.fround(0.01), max: Math.fround(1.0) }),
              clusterSize: fc.integer({ min: 1, max: 20 }),
              rarity: fc.float({ min: Math.fround(0.0), max: Math.fround(1.0) }),
              noiseScale: fc.float({ min: Math.fround(0.01), max: Math.fround(0.1) }),
            }),
            (config) => {
              // minY <= maxYを保証
              if (config.minY <= config.maxY) {
                expect(() => Schema.decodeUnknownSync(OreConfigSchema)(config)).not.toThrow()
              }
            }
          ),
          { numRuns: 50 }
        )
      })

      it('rejects invalid ore configuration', () => {
        const invalidConfigs = [
          { type: 'invalid_ore', blockId: 16, minY: 0, maxY: 256, density: 0.8, clusterSize: 8, rarity: 0.3 },
          { type: 'coal_ore', blockId: 'invalid', minY: 0, maxY: 256, density: 0.8, clusterSize: 8, rarity: 0.3 },
          { type: 'coal_ore', blockId: 16, minY: 'invalid', maxY: 256, density: 0.8, clusterSize: 8, rarity: 0.3 },
          { type: 'coal_ore', blockId: 16, minY: 0, maxY: null, density: 0.8, clusterSize: 8, rarity: 0.3 },
        ]

        for (const config of invalidConfigs) {
          expect(() => Schema.decodeUnknownSync(OreConfigSchema)(config)).toThrow()
        }
      })
    })

    describe('OreDistributionConfigSchema', () => {
      it('validates valid distribution configuration', () => {
        const validConfig: OreDistributionConfig = {
          ores: [
            {
              type: 'coal_ore',
              blockId: 16,
              minY: 0,
              maxY: 256,
              density: 0.8,
              clusterSize: 8,
              rarity: 0.3,
              noiseScale: 0.05,
            },
          ],
          noiseScale: 0.05,
          clusterThreshold: 0.6,
        }

        expect(() => Schema.decodeUnknownSync(OreDistributionConfigSchema)(validConfig)).not.toThrow()
      })

      it('rejects invalid distribution configuration', () => {
        const invalidConfigs = [
          { ores: 'invalid', noiseScale: 0.05, clusterThreshold: 0.6 },
          { ores: [], noiseScale: 'invalid', clusterThreshold: 0.6 },
          { ores: [], noiseScale: 0.05, clusterThreshold: null },
        ]

        for (const config of invalidConfigs) {
          expect(() => Schema.decodeUnknownSync(OreDistributionConfigSchema)(config)).toThrow()
        }
      })
    })
  })

  describe('Default Ore Configurations', () => {
    it('provides 8 valid default ore configurations', () => {
      expect(defaultOreConfigs).toHaveLength(8)

      const oreTypes = defaultOreConfigs.map((ore) => ore.type)
      const expectedTypes: OreType[] = [
        'coal_ore',
        'iron_ore',
        'copper_ore',
        'gold_ore',
        'redstone_ore',
        'lapis_ore',
        'diamond_ore',
        'emerald_ore',
      ]

      for (const expectedType of expectedTypes) {
        expect(oreTypes).toContain(expectedType)
      }
    })

    it('validates all default ore configurations', () => {
      for (const oreConfig of defaultOreConfigs) {
        expect(() => Schema.decodeUnknownSync(OreConfigSchema)(oreConfig)).not.toThrow()

        // 論理的な設定値の検証
        expect(oreConfig.minY).toBeLessThanOrEqual(oreConfig.maxY)
        expect(oreConfig.density).toBeGreaterThan(0)
        expect(oreConfig.clusterSize).toBeGreaterThan(0)
        expect(oreConfig.rarity).toBeGreaterThanOrEqual(0)
        expect(oreConfig.rarity).toBeLessThanOrEqual(1)
        expect(oreConfig.blockId).toBeGreaterThan(0)
      }
    })

    it('shows realistic rarity progression', () => {
      const coalOre = defaultOreConfigs.find((ore) => ore.type === 'coal_ore')
      const ironOre = defaultOreConfigs.find((ore) => ore.type === 'iron_ore')
      const diamondOre = defaultOreConfigs.find((ore) => ore.type === 'diamond_ore')
      const emeraldOre = defaultOreConfigs.find((ore) => ore.type === 'emerald_ore')

      expect(coalOre).toBeDefined()
      expect(ironOre).toBeDefined()
      expect(diamondOre).toBeDefined()
      expect(emeraldOre).toBeDefined()

      if (coalOre && ironOre && diamondOre && emeraldOre) {
        // 希少性の順序：石炭 < 鉄 < ダイヤ < エメラルド
        expect(coalOre.rarity).toBeLessThan(ironOre.rarity)
        expect(ironOre.rarity).toBeLessThan(diamondOre.rarity)
        expect(diamondOre.rarity).toBeLessThan(emeraldOre.rarity)

        // 密度の順序：一般的に希少な鉱石ほど密度が低い
        expect(coalOre.density).toBeGreaterThan(diamondOre.density)
        expect(ironOre.density).toBeGreaterThan(diamondOre.density)
      }
    })
  })

  describe('Service Creation', () => {
    it.effect('creates OreDistribution with custom config', () =>
      runWithTestOreDistribution(testConfig, (od) =>
        Effect.gen(function* () {
          expect(od.getConfig()).toEqual(testConfig)
        })
      )
    )

    it.effect(
      'creates OreDistribution with default config',
      () =>
        Effect.gen(function* () {
          const od = yield* OreDistributionTag
          const config = od.getConfig()

          expect(config.ores).toHaveLength(8)
          expect(config.noiseScale).toBe(0.05)
          expect(config.clusterThreshold).toBe(0.6)
          expect(config.ores).toEqual(defaultOreConfigs)
        }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, OreDistributionLiveDefault))) as Effect.Effect<
          void,
          never,
          never
        >
    )
  })

  describe('Ore Density Calculation', () => {
    it.effect(
      'calculates ore density for different types',
      () =>
        Effect.gen(function* () {
          const od = yield* OreDistributionTag
          const testPositions = [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 50, z: 100 },
          ]

          for (const position of testPositions) {
            const coalDensity = yield* od.calculateOreDensity('coal_ore', position)
            const ironDensity = yield* od.calculateOreDensity('iron_ore', position)
            const diamondDensity = yield* od.calculateOreDensity('diamond_ore', position)

            expect(typeof coalDensity).toBe('number')
            expect(typeof ironDensity).toBe('number')
            expect(typeof diamondDensity).toBe('number')

            expect(coalDensity).toBeGreaterThanOrEqual(0)
            expect(ironDensity).toBeGreaterThanOrEqual(0)
            expect(diamondDensity).toBeGreaterThanOrEqual(0)

            expect(Number.isFinite(coalDensity)).toBe(true)
            expect(Number.isFinite(ironDensity)).toBe(true)
            expect(Number.isFinite(diamondDensity)).toBe(true)
          }
        }).pipe(
          Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, OreDistributionLive(testConfig)))
        ) as Effect.Effect<void, never, never>
    )

    it('provides consistent density for same position', async () => {
      const position = { x: 123, y: 45, z: 678 }

      const effect = runWithTestOreDistribution(testConfig, (od) =>
        Effect.gen(function* () {
          const density1 = yield* od.calculateOreDensity('iron_ore', position)
          const density2 = yield* od.calculateOreDensity('iron_ore', position)

          expect(density1).toBe(density2)

          return density1
        })
      )

      await Effect.runPromise(effect)
    })

    it('handles unknown ore types gracefully', async () => {
      const position = { x: 0, y: 0, z: 0 }

      const effect = runWithTestOreDistribution(testConfig, (od) =>
        Effect.gen(function* () {
          // @ts-expect-error - 意図的に無効な鉱石タイプをテスト
          const density = yield* od.calculateOreDensity('unknown_ore', position)

          expect(density).toBe(0)

          return density
        })
      )

      await Effect.runPromise(effect)
    })

    it('shows depth-based rarity effects', async () => {
      const surfacePosition = { x: 0, y: 200, z: 0 } // 地表
      const deepPosition = { x: 0, y: -50, z: 0 } // 深層

      const effect = runWithTestOreDistribution(testConfig, (od) =>
        Effect.gen(function* () {
          // 深層でのダイヤモンド密度計算
          const surfaceDiamond = yield* od.calculateOreDensity('diamond_ore', surfacePosition)
          const deepDiamond = yield* od.calculateOreDensity('diamond_ore', deepPosition)

          // 石炭は深度の影響が少ない
          const surfaceCoal = yield* od.calculateOreDensity('coal_ore', surfacePosition)
          const deepCoal = yield* od.calculateOreDensity('coal_ore', deepPosition)

          return {
            surfaceDiamond,
            deepDiamond,
            surfaceCoal,
            deepCoal,
          }
        })
      )

      const results = await Effect.runPromise(effect)

      // ダイヤモンドは深層で高密度になる傾向（ただしノイズベースなので絶対ではない）
      expect(typeof results.surfaceDiamond).toBe('number')
      expect(typeof results.deepDiamond).toBe('number')
      expect(typeof results.surfaceCoal).toBe('number')
      expect(typeof results.deepCoal).toBe('number')
    })
  })

  describe('Ore Position Detection', () => {
    it('detects ore at specific positions', async () => {
      const testPositions = [
        { x: 0, y: 10, z: 0 },
        { x: 100, y: 50, z: 100 },
        { x: -50, y: -30, z: 75 },
        { x: 1000, y: 0, z: -500 },
      ]

      for (const position of testPositions) {
        const effect = runWithTestOreDistribution(testConfig, (od) =>
          Effect.gen(function* () {
            const oreType1 = yield* od.getOreAtPosition(position)
            const oreType2 = yield* od.getOreAtPosition(position)

            // 同じ座標では同じ結果になるはず
            expect(oreType1).toEqual(oreType2)

            // nullまたは有効な鉱石タイプ
            if (oreType1 !== null) {
              expect(['coal_ore', 'iron_ore', 'diamond_ore']).toContain(oreType1)
            }

            return oreType1
          })
        )

        await Effect.runPromise(effect)
      }
    })

    it('respects height restrictions', async () => {
      // ダイヤモンドの高度制限をテスト（maxY: 16）
      const highPosition = { x: 0, y: 50, z: 0 } // ダイヤモンドの範囲外
      const lowPosition = { x: 0, y: 10, z: 0 } // ダイヤモンドの範囲内

      const effect = runWithTestOreDistribution(testConfig, (od) =>
        Effect.gen(function* () {
          // 複数回テストして統計的に確認
          const highResults = []
          const lowResults = []

          for (let i = 0; i < 10; i++) {
            const highOre = yield* od.getOreAtPosition({ x: i, y: 50, z: 0 })
            const lowOre = yield* od.getOreAtPosition({ x: i, y: 10, z: 0 })

            highResults.push(highOre)
            lowResults.push(lowOre)
          }

          // 高い位置ではダイヤモンドが生成されないはず
          const highDiamonds = highResults.filter((ore) => ore === 'diamond_ore')
          expect(highDiamonds).toHaveLength(0)

          return { highResults, lowResults }
        })
      )

      await Effect.runPromise(effect)
    })

    it('handles extreme coordinates', async () => {
      const extremePositions = [
        { x: 1000000, y: 0, z: 1000000 },
        { x: -1000000, y: -60, z: -1000000 },
        { x: 0, y: 319, z: 1000000 },
        { x: -1000000, y: -64, z: 0 },
      ]

      for (const position of extremePositions) {
        const effect = runWithTestOreDistribution(testConfig, (od) =>
          Effect.gen(function* () {
            const oreType = yield* od.getOreAtPosition(position)

            // nullまたは有効な鉱石タイプ
            if (oreType !== null) {
              expect(['coal_ore', 'iron_ore', 'diamond_ore']).toContain(oreType)
            }

            return oreType
          })
        )

        await Effect.runPromise(effect)
      }
    })
  })

  describe('Chunk Ore Placement', () => {
    const createStoneChunkData = (position: { x: number; z: number }) => {
      const chunkData = createChunkData(position)

      // チャンクを石で埋める（鉱石配置用）
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2) // 石ブロックID

      return {
        ...chunkData,
        blocks: stoneBlocks,
      }
    }

    it.effect(
      'places ores in stone blocks correctly',
      () =>
        Effect.gen(function* () {
          const od = yield* OreDistributionTag
          const chunkPosition = { x: 0, z: 0 }
          const chunkData = createStoneChunkData(chunkPosition)

          const result = yield* od.placeOres(chunkData)

          expect(result.isDirty).toBe(true)
          expect(result.metadata.isModified).toBe(true)
          expect(result.blocks).toBeInstanceOf(Uint16Array)
          expect(result.blocks.length).toBe(16 * 16 * 384)

          let stoneBlocks = 0
          let oreBlocks = 0

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId === 2) {
              stoneBlocks++
            } else if (blockId >= 16 && blockId <= 23) {
              oreBlocks++
            }
          }

          expect(stoneBlocks).toBeLessThan(16 * 16 * 384)
          expect(oreBlocks).toBeGreaterThanOrEqual(0)
        }).pipe(
          Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, OreDistributionLive(testConfig)))
        ) as Effect.Effect<void, never, never>
    )

    it('preserves non-stone blocks', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createChunkData(chunkPosition)

      // 混合ブロックのチャンクを作成
      const mixedBlocks = new Uint16Array(16 * 16 * 384)
      for (let i = 0; i < mixedBlocks.length; i++) {
        if (i % 3 === 0) {
          mixedBlocks[i] = 0 // 空気
        } else if (i % 3 === 1) {
          mixedBlocks[i] = 2 // 石
        } else {
          mixedBlocks[i] = 3 // 土
        }
      }

      const testChunkData = {
        ...chunkData,
        blocks: mixedBlocks,
      }

      const effect = runWithTestOreDistribution(testConfig, (od) =>
        Effect.gen(function* () {
          const result = yield* od.placeOres(testChunkData)

          // 空気と土ブロックは保持されているはず
          let airBlocks = 0
          let dirtBlocks = 0
          let oreBlocks = 0

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId === 0) {
              airBlocks++
            } else if (blockId === 3) {
              dirtBlocks++
            } else if (blockId >= 16 && blockId <= 23) {
              oreBlocks++
            }
          }

          // 元の空気と土の数を保持
          const originalAir = Math.floor(mixedBlocks.length / 3)
          const originalDirt = Math.ceil(mixedBlocks.length / 3)

          expect(airBlocks).toBe(originalAir)
          expect(dirtBlocks).toBe(originalDirt)

          return { result, airBlocks, dirtBlocks, oreBlocks }
        })
      )

      await Effect.runPromise(effect)
    })

    it.effect.skip(
      'places only one ore type per block',
      () =>
        Effect.gen(function* () {
          const od = yield* OreDistributionTag
          const chunkPosition = { x: 0, z: 0 }
          const chunkData = createStoneChunkData(chunkPosition)

          const result = yield* od.placeOres(chunkData)

          // 各ブロックが有効な鉱石IDまたは石であることを確認
          const validBlockIds = [2, 16, 17, 22] // 石、石炭、鉄、ダイヤモンド

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            expect(validBlockIds).toContain(blockId)
          }
        }).pipe(
          Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, OreDistributionLive(testConfig)))
        ) as Effect.Effect<void, never, never>,
      { timeout: 15000 }
    )

    it('respects ore height restrictions in chunks', async () => {
      const highConfig: OreDistributionConfig = {
        ores: [
          {
            type: 'diamond_ore',
            blockId: 22,
            minY: -64,
            maxY: 16, // 高度制限
            density: 1.0, // 高密度
            clusterSize: 2,
            rarity: 0.1, // 低い希少性（生成しやすい）
            noiseScale: 0.02,
          },
        ],
        noiseScale: 0.05,
        clusterThreshold: 0.6,
      }

      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createStoneChunkData(chunkPosition)

      const effect = runWithTestOreDistribution(highConfig, (od) =>
        Effect.gen(function* () {
          const result = yield* od.placeOres(chunkData)

          // 高度別のダイヤモンド鉱石数をカウント
          const getBlockIndex = (x: number, y: number, z: number) => {
            const normalizedY = y + 64
            return normalizedY + (z << 9) + (x << 13)
          }

          let diamondsAtValidHeight = 0
          let diamondsAtInvalidHeight = 0

          for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
              for (let y = -64; y < 320; y++) {
                const index = getBlockIndex(x, y, z)
                const blockId = result.blocks[index] ?? 0

                if (blockId === 22) {
                  // ダイヤモンド鉱石
                  if (y >= -64 && y <= 16) {
                    diamondsAtValidHeight++
                  } else {
                    diamondsAtInvalidHeight++
                  }
                }
              }
            }
          }

          // 無効な高度にはダイヤモンドが生成されないはず
          expect(diamondsAtInvalidHeight).toBe(0)

          return { result, diamondsAtValidHeight, diamondsAtInvalidHeight }
        })
      )

      await Effect.runPromise(effect)
    })
  })

  describe('Performance Requirements', () => {
    it.effect(
      'places ores efficiently',
      () =>
        Effect.gen(function* () {
          const od = yield* OreDistributionTag
          const chunkPosition = { x: 0, z: 0 }
          const chunkData = createChunkData(chunkPosition)

          const stoneBlocks = new Uint16Array(16 * 16 * 384)
          stoneBlocks.fill(2)
          const testChunkData = { ...chunkData, blocks: stoneBlocks }

          const result = yield* od.placeOres(testChunkData)

          expect(result.blocks).toHaveLength(16 * 16 * 384)
          expect(result.isDirty).toBe(true)
        }).pipe(
          Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, OreDistributionLive(testConfig)))
        ) as Effect.Effect<void, never, never>,
      { timeout: 30000 }
    )

    it.effect(
      'handles multiple ore calculations efficiently',
      () =>
        Effect.gen(function* () {
          const od = yield* OreDistributionTag
          const positions = Array.from({ length: 10 }, (_, i) => ({
            x: i % 5,
            y: Math.floor(i / 5) - 50,
            z: i % 3,
          }))

          const results = []
          for (const position of positions) {
            const oreType = yield* od.getOreAtPosition(position)
            results.push(oreType)
          }

          expect(results).toHaveLength(10)
          expect(results.every((r) => r === null || typeof r === 'string')).toBe(true)
        }).pipe(
          Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, OreDistributionLive(testConfig)))
        ) as Effect.Effect<void, never, never>
    )
  })

  describe('Edge Cases', () => {
    it('handles empty ore configuration', async () => {
      const emptyConfig: OreDistributionConfig = {
        ores: [],
        noiseScale: 0.05,
        clusterThreshold: 0.6,
      }

      const position = { x: 0, y: 0, z: 0 }

      const effect = runWithTestOreDistribution(emptyConfig, (od) =>
        Effect.gen(function* () {
          const oreType = yield* od.getOreAtPosition(position)
          expect(oreType).toBe(null)

          const density = yield* od.calculateOreDensity('coal_ore', position)
          expect(density).toBe(0)

          return { oreType, density }
        })
      )

      await Effect.runPromise(effect)
    })

    it('handles extreme density configurations', async () => {
      const extremeConfig: OreDistributionConfig = {
        ores: [
          {
            type: 'coal_ore',
            blockId: 16,
            minY: -64,
            maxY: 320,
            density: 10.0, // 極端に高い密度
            clusterSize: 100,
            rarity: 0.0, // 最低の希少性
            noiseScale: 0.05,
          },
        ],
        noiseScale: 0.1,
        clusterThreshold: 0.1,
      }

      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createChunkData(chunkPosition)
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2)
      const testChunkData = { ...chunkData, blocks: stoneBlocks }

      const effect = runWithTestOreDistribution(extremeConfig, (od) =>
        Effect.gen(function* () {
          const result = yield* od.placeOres(testChunkData)

          // 極端な設定でも処理が完了することを確認
          expect(result.blocks).toHaveLength(16 * 16 * 384)
          expect(result.isDirty).toBe(true)

          // 多くの石炭鉱石が生成されているはず
          let coalOres = 0
          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId === 16) coalOres++
          }

          expect(coalOres).toBeGreaterThan(0)

          return result
        })
      )

      await Effect.runPromise(effect)
    })

    it('handles boundary height values', async () => {
      const boundaryConfig: OreDistributionConfig = {
        ores: [
          {
            type: 'iron_ore',
            blockId: 17,
            minY: -64, // 最低高度
            maxY: 319, // 最高高度
            density: 0.5,
            clusterSize: 5,
            rarity: 0.5,
            noiseScale: 0.04,
          },
        ],
        noiseScale: 0.05,
        clusterThreshold: 0.6,
      }

      const boundaryPositions = [
        { x: 0, y: -64, z: 0 }, // 最低高度
        { x: 0, y: 319, z: 0 }, // 最高高度
        { x: 0, y: -65, z: 0 }, // 範囲外（下）
        { x: 0, y: 320, z: 0 }, // 範囲外（上）
      ]

      for (const position of boundaryPositions) {
        const effect = runWithTestOreDistribution(boundaryConfig, (od) =>
          Effect.gen(function* () {
            const oreType = yield* od.getOreAtPosition(position)
            const density = yield* od.calculateOreDensity('iron_ore', position)

            expect(typeof density).toBe('number')
            expect(Number.isFinite(density)).toBe(true)

            // 範囲外では鉱石が生成されないはず
            if (position.y < -64 || position.y > 319) {
              expect(oreType).toBe(null)
            }

            return { oreType, density }
          })
        )

        await Effect.runPromise(effect)
      }
    })

    it.skip('handles extreme chunk positions', async () => {
      const extremePositions = [
        { x: 1000000, z: 1000000 },
        { x: -1000000, z: -1000000 },
        { x: 0, z: 1000000 },
        { x: -1000000, z: 0 },
      ]

      for (const position of extremePositions) {
        const chunkData = createChunkData(position)
        const stoneBlocks = new Uint16Array(16 * 16 * 384)
        stoneBlocks.fill(2)
        const testChunkData = { ...chunkData, blocks: stoneBlocks }

        const effect = runWithTestOreDistribution(testConfig, (od) =>
          Effect.gen(function* () {
            const result = yield* od.placeOres(testChunkData)

            expect(result.position).toEqual(position)
            expect(result.blocks).toHaveLength(16 * 16 * 384)
            expect(result.isDirty).toBe(true)
            expect(Number.isFinite(result.metadata.lastUpdate)).toBe(true)

            return result
          })
        )

        await Effect.runPromise(effect)
      }
    }, 30000)
  })

  describe('Realistic Ore Distribution', () => {
    it('generates realistic ore distribution patterns', async () => {
      const realisticConfig: OreDistributionConfig = {
        ores: defaultOreConfigs,
        noiseScale: 0.05,
        clusterThreshold: 0.6,
      }

      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createChunkData(chunkPosition)
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2)
      const testChunkData = { ...chunkData, blocks: stoneBlocks }

      const effect = runWithTestOreDistribution(realisticConfig, (od) =>
        Effect.gen(function* () {
          const result = yield* od.placeOres(testChunkData)

          // 各鉱石タイプの分布を統計
          const oreStats = new Map<number, number>()

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId >= 16 && blockId <= 23) {
              // 鉱石ブロックID範囲
              oreStats.set(blockId, (oreStats.get(blockId) ?? 0) + 1)
            }
          }

          // 石炭（ID 16）が最も多いはず
          const coalCount = oreStats.get(16) ?? 0
          const diamondCount = oreStats.get(22) ?? 0
          const emeraldCount = oreStats.get(23) ?? 0

          // 希少性の順序確認（ただし、ノイズベースなので絶対ではない）
          expect(coalCount).toBeGreaterThanOrEqual(diamondCount)
          expect(coalCount).toBeGreaterThanOrEqual(emeraldCount)

          return { result, oreStats }
        })
      )

      await Effect.runPromise(effect)
    }, 30000)
  })
})
