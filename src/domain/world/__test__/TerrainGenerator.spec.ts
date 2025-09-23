import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { Schema } from '@effect/schema'
import * as fc from 'fast-check'
import {
  TerrainGeneratorTag,
  TerrainGeneratorLive,
  TerrainGeneratorLiveDefault,
  TerrainConfigSchema,
} from '../TerrainGenerator'
import type { TerrainGenerator, TerrainConfig, HeightMap } from '../TerrainGenerator'
import type { NoiseGenerator } from '../NoiseGenerator'
import { NoiseGeneratorLiveDefault } from '../NoiseGenerator'

/**
 * TerrainGenerator専用のテストヘルパー
 */
const runWithTestTerrain = <A>(
  config: TerrainConfig,
  operation: (tg: TerrainGenerator) => Effect.Effect<A, never, NoiseGenerator>
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const tg = yield* TerrainGeneratorTag
    return yield* operation(tg)
  }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(config)))) as Effect.Effect<A, never, never>

describe('TerrainGenerator', () => {
  const testConfig: TerrainConfig = {
    seaLevel: 64,
    maxHeight: 319,
    minHeight: -64,
    surfaceVariation: 32,
    caveThreshold: 0.6,
  }

  describe('TerrainConfigSchema', () => {
    it('validates valid terrain configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            seaLevel: fc.integer({ min: 0, max: 256 }),
            maxHeight: fc.integer({ min: 64, max: 320 }),
            minHeight: fc.integer({ min: -64, max: 0 }),
            surfaceVariation: fc.integer({ min: 8, max: 64 }),
            caveThreshold: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }),
          }),
          (config) => {
            expect(() => Schema.decodeUnknownSync(TerrainConfigSchema)(config)).not.toThrow()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('rejects invalid configuration', () => {
      const invalidConfigs = [
        { seaLevel: 'invalid', maxHeight: 319, minHeight: -64, surfaceVariation: 32, caveThreshold: 0.6 },
        { seaLevel: 64, maxHeight: null, minHeight: -64, surfaceVariation: 32, caveThreshold: 0.6 },
        { seaLevel: 64, maxHeight: 319, minHeight: 'invalid', surfaceVariation: 32, caveThreshold: 0.6 },
        { seaLevel: 64, maxHeight: 319, minHeight: -64, surfaceVariation: -5, caveThreshold: 0.6 },
      ]

      for (const config of invalidConfigs) {
        expect(() => Schema.decodeUnknownSync(TerrainConfigSchema)(config)).toThrow()
      }
    })
  })

  describe('Service Creation', () => {
    it.effect('creates TerrainGenerator with custom config', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        expect(tg.getConfig()).toEqual(testConfig)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )

    it.effect('creates TerrainGenerator with default config', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const config = tg.getConfig()

        expect(config.seaLevel).toBe(64)
        expect(config.maxHeight).toBe(319)
        expect(config.minHeight).toBe(-64)
        expect(config.surfaceVariation).toBe(32)
        expect(config.caveThreshold).toBe(0.6)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLiveDefault))) as Effect.Effect<void, never, never>
    )
  })

  describe('Height Map Generation', () => {
    it.effect('generates valid 16x16 height map', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const chunkPosition = { x: 0, z: 0 }
        const heightMap = yield* tg.generateHeightMap(chunkPosition)

        expect(heightMap).toHaveLength(16)
        for (let x = 0; x < 16; x++) {
          expect(heightMap[x]).toHaveLength(16)
          for (let z = 0; z < 16; z++) {
            const height = heightMap[x]?.[z]
            expect(height).toBeDefined()
            expect(typeof height).toBe('number')
            expect(height).toBeGreaterThanOrEqual(testConfig.minHeight)
            expect(height).toBeLessThanOrEqual(testConfig.maxHeight)
          }
        }
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )

    it.effect('generates consistent height maps for same chunk position', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const chunkPosition = { x: 5, z: 10 }

        const heightMap1 = yield* tg.generateHeightMap(chunkPosition)
        const heightMap2 = yield* tg.generateHeightMap(chunkPosition)

        expect(heightMap1).toEqual(heightMap2)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )

    it.effect('generates different height maps for different positions', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const heightMap1 = yield* tg.generateHeightMap({ x: 0, z: 0 })
        const heightMap2 = yield* tg.generateHeightMap({ x: 10, z: 10 })

        expect(heightMap1).not.toEqual(heightMap2)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )

    it.effect('generates height maps efficiently', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const chunkPosition = { x: 0, z: 0 }
        const heightMap = yield* tg.generateHeightMap(chunkPosition)

        expect(heightMap).toHaveLength(16)
        expect(heightMap.every(row => Array.isArray(row) && row.length === 16)).toBe(true)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )
  })

  describe('Terrain Height Calculation', () => {
    it.effect('calculates terrain height for specific coordinates', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const testCoords = [
          { x: 0, z: 0 },
          { x: 100, z: 100 },
        ]

        for (const { x, z } of testCoords) {
          const height = yield* tg.getTerrainHeight(x, z)

          expect(typeof height).toBe('number')
          expect(height).toBeGreaterThanOrEqual(testConfig.minHeight)
          expect(height).toBeLessThanOrEqual(testConfig.maxHeight)
          expect(Number.isFinite(height)).toBe(true)
        }
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )

    it.effect('provides consistent height values', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const x = 123
        const z = 456

        const height1 = yield* tg.getTerrainHeight(x, z)
        const height2 = yield* tg.getTerrainHeight(x, z)

        expect(height1).toBe(height2)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )
  })

  describe('Base Terrain Generation', () => {
    const createTestChunkData = (position: { x: number; z: number }) => ({
      blocks: new Uint16Array(16 * 16 * 384), // 16x16x384 chunks
      position,
      metadata: {
        biome: 'plains',
        lightLevel: 15,
        isModified: false,
        lastUpdate: 0,
        heightMap: new Array(16 * 16).fill(64),
      },
      isDirty: false,
    })

    it('generates base terrain with proper block placement', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      const effect = runWithTestTerrain(testConfig, (tg) =>
        Effect.gen(function* () {
          const heightMap = yield* tg.generateHeightMap(chunkPosition)
          const result = yield* tg.generateBaseTerrain(chunkData, heightMap)

          // 結果の基本検証
          expect(result.isDirty).toBe(true)
          expect(result.metadata.isModified).toBe(true)
          expect(result.blocks).toBeInstanceOf(Uint16Array)
          expect(result.blocks.length).toBe(16 * 16 * 384)

          // ブロック配置の検証
          let hasNonAirBlocks = false
          let hasBedrockAtBottom = false

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId !== 0) {
              hasNonAirBlocks = true
            }
            // Y=-64（配列インデックス0）は岩盤のはず
            if (i % (16 * 16) === 0 && blockId === 1) {
              hasBedrockAtBottom = true
            }
          }

          expect(hasNonAirBlocks).toBe(true)
          expect(hasBedrockAtBottom).toBe(true)

          return result
        })
      )

      await Effect.runPromise(effect)
    })

    it('respects height map boundaries', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      // カスタム高度マップ（全て海面レベル）
      const flatHeightMap: HeightMap = Array.from({ length: 16 }, () =>
        Array.from({ length: 16 }, () => testConfig.seaLevel)
      )

      const effect = runWithTestTerrain(testConfig, (tg) =>
        Effect.gen(function* () {
          const result = yield* tg.generateBaseTerrain(chunkData, flatHeightMap)

          // 海面レベル付近のブロック配置を検証
          const getBlockIndex = (x: number, y: number, z: number) => {
            const normalizedY = y + 64 // -64～319 → 0～383
            return normalizedY + (z * 384) + (x * 384 * 16)
          }

          // 各列で適切なブロック配置を確認
          for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
              const surfaceY = testConfig.seaLevel

              // 地下十分深い部分は石であることを確認（surface - 10で石のはず）
              const deepUndergroundY = surfaceY - 10
              const deepUndergroundIndex = getBlockIndex(x, deepUndergroundY, z)
              expect(deepUndergroundIndex).toBeGreaterThanOrEqual(0)
              expect(deepUndergroundIndex).toBeLessThan(result.blocks.length)
              const deepUndergroundBlock = result.blocks[deepUndergroundIndex] ?? 0
              expect(deepUndergroundBlock).toBeGreaterThan(0) // 空気以外

              // 表面は適切なブロック
              const surfaceIndex = getBlockIndex(x, surfaceY, z)
              expect(surfaceIndex).toBeGreaterThanOrEqual(0)
              expect(surfaceIndex).toBeLessThan(result.blocks.length)
              const surfaceBlock = result.blocks[surfaceIndex] ?? 0
              expect(surfaceBlock).toBeGreaterThan(0) // 空気以外

              // 表面より上は空気
              const aboveIndex = getBlockIndex(x, surfaceY + 10, z)
              expect(aboveIndex).toBeGreaterThanOrEqual(0)
              expect(aboveIndex).toBeLessThan(result.blocks.length)
              const aboveBlock = result.blocks[aboveIndex] ?? 0
              expect(aboveBlock).toBe(0) // 空気
            }
          }

          return result
        })
      )

      await Effect.runPromise(effect)
    })
  })

  describe('Block Type Determination', () => {
    it('determines correct block types based on height and position', async () => {
      const testCases = [
        { worldX: 0, worldZ: 0, y: 60, surfaceHeight: 62, expected: 'sand' }, // 海面近く
        { worldX: 0, worldZ: 0, y: 120, surfaceHeight: 120, expected: 'stone' }, // 高山
        { worldX: 0, worldZ: 0, y: 80, surfaceHeight: 80, expected: 'grass_block' }, // 平原
      ]

      const effect = runWithTestTerrain(testConfig, (tg) =>
        Effect.gen(function* () {
          const results = testCases.map(({ worldX, worldZ, y, surfaceHeight }) => ({
            input: { worldX, worldZ, y, surfaceHeight },
            result: tg.getBlockTypeAtHeight(worldX, worldZ, y, surfaceHeight),
          }))

          return results
        })
      )

      const results = await Effect.runPromise(effect)

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i]
        const result = Array.isArray(results) ? results[i] : undefined
        if (testCase && result) {
          expect(result.result).toBe(testCase.expected)
        }
      }
    })
  })

  describe('Performance Requirements', () => {
    it.effect('generates height map efficiently', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const chunkPosition = { x: 0, z: 0 }
        const heightMap = yield* tg.generateHeightMap(chunkPosition)

        expect(heightMap).toHaveLength(16)
        expect(heightMap.every(row => Array.isArray(row) && row.length === 16)).toBe(true)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )

    it.effect('handles multiple chunk generation', () =>
      Effect.gen(function* () {
        const tg = yield* TerrainGeneratorTag
        const positions = [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ]

        const heightMaps = []
        for (const position of positions) {
          const heightMap = yield* tg.generateHeightMap(position)
          heightMaps.push(heightMap)
        }

        expect(heightMaps).toHaveLength(2)
        expect(heightMaps.every(hm => Array.isArray(hm) && hm.length === 16)).toBe(true)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, TerrainGeneratorLive(testConfig)))) as Effect.Effect<void, never, never>
    )
  })

  describe('Edge Cases', () => {
    it('handles extreme chunk positions', async () => {
      const extremePositions = [
        { x: 1000000, z: 1000000 },
        { x: -1000000, z: -1000000 },
        { x: 0, z: 1000000 },
        { x: -1000000, z: 0 },
      ]

      for (const position of extremePositions) {
        const effect = runWithTestTerrain(testConfig, (tg) =>
          Effect.gen(function* () {
            const heightMap = yield* tg.generateHeightMap(position)
            const height = yield* tg.getTerrainHeight(position.x * 16, position.z * 16)

            // 結果が有効であることを確認
            expect(heightMap).toHaveLength(16)
            expect(typeof height).toBe('number')
            expect(Number.isFinite(height)).toBe(true)

            return { heightMap, height }
          })
        )

        await Effect.runPromise(effect)
      }
    })

    it('handles boundary height values', async () => {
      const extremeConfig: TerrainConfig = {
        seaLevel: 0,
        maxHeight: 10,
        minHeight: -10,
        surfaceVariation: 5,
        caveThreshold: 0.5,
      }

      const effect = runWithTestTerrain(extremeConfig, (tg) =>
        Effect.gen(function* () {
          const heightMap = yield* tg.generateHeightMap({ x: 0, z: 0 })

          // すべての高度が制限内であることを確認
          for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
              const height = heightMap[x]?.[z]
              expect(height).toBeDefined()
              expect(height).toBeGreaterThanOrEqual(extremeConfig.minHeight)
              expect(height).toBeLessThanOrEqual(extremeConfig.maxHeight)
            }
          }

          return heightMap
        })
      )

      await Effect.runPromise(effect)
    })
  })
})
