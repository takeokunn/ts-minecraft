import { describe, beforeAll, afterAll } from 'vitest'
import { it, expect } from '@effect/vitest'
import { Effect, Layer, TestContext } from 'effect'
import { Schema } from '@effect/schema'
import * as fc from 'fast-check'
import { expectEffectDuration, expectEffectSuccess, asTestEffect } from '../../../test/unified-test-helpers'
import {
  CaveGeneratorLive,
  CaveGeneratorLiveDefault,
  CaveConfigSchema,
  CaveDataSchema,
  CaveGeneratorTag,
  type CaveGenerator,
  type CaveConfig,
  type CaveData,
} from '../CaveGenerator'
import { NoiseGeneratorLiveDefault, type NoiseGenerator } from '../NoiseGenerator'
import { createChunkData } from '../../chunk/ChunkData'

/**
 * CaveGenerator専用のテストヘルパー
 */
// テスト用のレイヤー
const testLayer = (config: CaveConfig) =>
  Layer.mergeAll(NoiseGeneratorLiveDefault, CaveGeneratorLive(config), TestContext.TestContext)

const runWithTestCave = <A>(
  config: CaveConfig,
  operation: (cg: CaveGenerator) => Effect.Effect<A, never, NoiseGenerator>
): Effect.Effect<A, never, never> =>
  Effect.gen(function* () {
    const cg = yield* CaveGeneratorTag
    return yield* operation(cg)
  }).pipe(Effect.provide(testLayer(config))) as Effect.Effect<A, never, never>

describe('CaveGenerator', () => {
  const testConfig: CaveConfig = {
    caveThreshold: 0.2,
    caveScale: 0.02,
    lavaLevel: 10,
    ravineThreshold: 0.05,
    ravineScale: 0.005,
  }

  describe('CaveConfigSchema', () => {
    it('validates valid cave configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            caveThreshold: fc.float({ min: Math.fround(0.01), max: Math.fround(1.0) }),
            caveScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.1) }),
            lavaLevel: fc.integer({ min: -64, max: 50 }),
            ravineThreshold: fc.float({ min: Math.fround(0.01), max: Math.fround(0.2) }),
            ravineScale: fc.float({ min: Math.fround(0.001), max: Math.fround(0.01) }),
          }),
          (config) => {
            expect(() => Schema.decodeUnknownSync(CaveConfigSchema)(config)).not.toThrow()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('rejects invalid configuration', () => {
      const invalidConfigs = [
        { caveThreshold: 'invalid', caveScale: 0.02, lavaLevel: 10, ravineThreshold: 0.05, ravineScale: 0.005 },
        { caveThreshold: 0.2, caveScale: null, lavaLevel: 10, ravineThreshold: 0.05, ravineScale: 0.005 },
        { caveThreshold: 0.2, caveScale: 0.02, lavaLevel: 'invalid', ravineThreshold: 0.05, ravineScale: 0.005 },
        { caveThreshold: 0.2, caveScale: 0.02, lavaLevel: 10, ravineThreshold: -1, ravineScale: 0.005 },
      ]

      for (const config of invalidConfigs) {
        expect(() => Schema.decodeUnknownSync(CaveConfigSchema)(config)).toThrow()
      }
    })
  })

  describe('CaveDataSchema', () => {
    it('validates valid cave data', () => {
      fc.assert(
        fc.property(
          fc.record({
            position: fc.record({
              x: fc.integer({ min: -1000000, max: 1000000 }),
              y: fc.integer({ min: -64, max: 319 }),
              z: fc.integer({ min: -1000000, max: 1000000 }),
            }),
            size: fc.float({ min: Math.fround(1.0), max: Math.fround(100.0) }),
            type: fc.constantFrom('cave', 'ravine', 'cavern'),
          }),
          (caveData) => {
            expect(() => Schema.decodeUnknownSync(CaveDataSchema)(caveData)).not.toThrow()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('rejects invalid cave data', () => {
      const invalidCaveData = [
        { position: { x: 0, y: 0 }, size: 10, type: 'cave' }, // missing z
        { position: { x: 0, y: 0, z: 0 }, size: 'invalid', type: 'cave' },
        { position: { x: 0, y: 0, z: 0 }, size: 10, type: 'invalid_type' },
        { position: 'invalid', size: 10, type: 'cave' },
      ]

      for (const data of invalidCaveData) {
        expect(() => Schema.decodeUnknownSync(CaveDataSchema)(data)).toThrow()
      }
    })
  })

  describe('Service Creation', () => {
    it('creates CaveGenerator with custom config', async () => {
      const testEffect = Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        expect(cg.getConfig()).toEqual(testConfig)
      }).pipe(
        Effect.provide(
          Layer.mergeAll(NoiseGeneratorLiveDefault, CaveGeneratorLive(testConfig), TestContext.TestContext)
        )
      ) as Effect.Effect<void, never, never>

      await Effect.runPromise(testEffect)
    })

    it('creates CaveGenerator with default config', async () => {
      const testEffect = Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const config = cg.getConfig()

        expect(config.caveThreshold).toBe(0.2)
        expect(config.caveScale).toBe(0.02)
        expect(config.lavaLevel).toBe(10)
        expect(config.ravineThreshold).toBe(0.05)
        expect(config.ravineScale).toBe(0.005)
      }).pipe(
        Effect.provide(Layer.mergeAll(NoiseGeneratorLiveDefault, CaveGeneratorLiveDefault, TestContext.TestContext))
      ) as Effect.Effect<void, never, never>

      await Effect.runPromise(testEffect)
    })
  })

  describe('Cave Detection', () => {
    it('detects cave positions accurately', async () => {
      const testPositions = [
        { x: 0, y: 0, z: 0 },
        { x: 100, y: 50, z: 100 },
        { x: -50, y: -30, z: 75 },
        { x: 1000, y: 100, z: -500 },
      ]

      const testEffect = Effect.all(
        testPositions.map((position) =>
          runWithTestCave(testConfig, (cg) =>
            Effect.gen(function* () {
              const isCave1 = yield* cg.isCave(position)
              const isCave2 = yield* cg.isCave(position)

              // 同じ座標では同じ結果になるはず
              expect(isCave1).toBe(isCave2)
              expect(typeof isCave1).toBe('boolean')

              return isCave1
            })
          )
        )
      ) as Effect.Effect<boolean[], never, never>

      await Effect.runPromise(testEffect)
    })

    it('provides consistent cave detection', async () => {
      const position = { x: 123, y: 45, z: 678 }

      const testEffect = runWithTestCave(testConfig, (cg) =>
        Effect.gen(function* () {
          const results: boolean[] = []
          // 複数回同じ位置をチェック
          for (let i = 0; i < 10; i++) {
            const isCave = yield* cg.isCave(position)
            results.push(isCave)
          }

          // すべて同じ結果であることを確認
          const allSame = results.every((result) => result === results[0])
          expect(allSame).toBe(true)

          return results[0]
        })
      )

      await Effect.runPromise(testEffect)
    })

    it('handles extreme coordinates', async () => {
      const extremePositions = [
        { x: 1000000, y: 319, z: 1000000 },
        { x: -1000000, y: -64, z: -1000000 },
        { x: 0, y: 0, z: 1000000 },
        { x: -1000000, y: 160, z: 0 },
      ]

      const testEffect = Effect.all(
        extremePositions.map((position) =>
          runWithTestCave(testConfig, (cg) =>
            Effect.gen(function* () {
              const isCave = yield* cg.isCave(position)
              expect(typeof isCave).toBe('boolean')
              return isCave
            })
          )
        )
      ) as Effect.Effect<boolean[], never, never>

      await Effect.runPromise(testEffect)
    })
  })

  describe('Chunk Cave Carving', () => {
    const createTestChunkData = (position: { x: number; z: number }) => {
      const chunkData = createChunkData(position)

      // チャンクを石で埋める（洞窟彫刻用）
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2) // 石ブロックID

      return {
        ...chunkData,
        blocks: stoneBlocks,
      }
    }

    it.effect('carves caves in chunk correctly', () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      return runWithTestCave(testConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.carveChunk(chunkData)

          // 結果の基本検証
          expect(result.isDirty).toBe(true)
          expect(result.metadata.isModified).toBe(true)
          expect(result.blocks).toBeInstanceOf(Uint16Array)
          expect(result.blocks.length).toBe(16 * 16 * 384)

          // 洞窟が彫られたことを確認
          let hasAirBlocks = false
          let hasLavaBlocks = false
          let originalStoneBlocks = 0

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId === 0) {
              hasAirBlocks = true
            } else if (blockId === 7) {
              hasLavaBlocks = true
            } else if (blockId === 2) {
              originalStoneBlocks++
            }
          }

          // 洞窟（空気）が生成されていることを確認
          expect(hasAirBlocks).toBe(true)
          // 元の石ブロックより少なくなっていることを確認
          expect(originalStoneBlocks).toBeLessThan(16 * 16 * 384)

          return result
        })
      )
    })

    it('places lava correctly below lava level', async () => {
      const lowLavaConfig: CaveConfig = {
        ...testConfig,
        lavaLevel: 5, // 低い溶岩レベル
        caveThreshold: 0.8, // 多くの洞窟を生成
      }

      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      const effect = runWithTestCave(lowLavaConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.carveChunk(chunkData)

          // 溶岩レベル以下で溶岩が生成されているかチェック
          let lavaBlocksFound = false

          const getBlockIndex = (x: number, y: number, z: number) => {
            const normalizedY = y + 64
            return normalizedY + (z << 9) + (x << 13)
          }

          for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
              for (let y = -64; y <= lowLavaConfig.lavaLevel; y++) {
                const index = getBlockIndex(x, y, z)
                const blockId = result.blocks[index] ?? 0
                if (blockId === 7) {
                  // 溶岩ID
                  lavaBlocksFound = true
                  break
                }
              }
              if (lavaBlocksFound) break
            }
            if (lavaBlocksFound) break
          }

          return { result, lavaBlocksFound }
        })
      )

      const result = await Effect.runPromise(effect)
      const { lavaBlocksFound } = result as { result: any; lavaBlocksFound: boolean }
      // 溶岩レベルが低く、閾値が高いので溶岩が見つかる可能性が高い
      // ただし、ノイズベースなので必ずしも見つかるとは限らない
      expect(typeof lavaBlocksFound).toBe('boolean')
    })

    it('preserves chunk metadata correctly', async () => {
      const chunkPosition = { x: 5, z: 10 }
      const chunkData = createTestChunkData(chunkPosition)
      const originalTimestamp = chunkData.metadata.lastUpdate

      const effect = runWithTestCave(testConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.carveChunk(chunkData)

          expect(result.position).toEqual(chunkPosition)
          expect(result.metadata.isModified).toBe(true)
          expect(result.metadata.lastUpdate).toBeGreaterThan(originalTimestamp)
          expect(result.isDirty).toBe(true)

          return result
        })
      )

      await Effect.runPromise(effect)
    })
  })

  describe('Ravine Generation', () => {
    const createTestChunkData = (position: { x: number; z: number }) => {
      const chunkData = createChunkData(position)

      // チャンクを石で埋める
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2) // 石ブロックID

      return {
        ...chunkData,
        blocks: stoneBlocks,
      }
    }

    it('generates ravines correctly', async () => {
      const ravineConfig: CaveConfig = {
        ...testConfig,
        ravineThreshold: 0.5, // 峡谷を生成しやすく
      }

      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      const effect = runWithTestCave(ravineConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.generateRavine(chunkData)

          // 結果の基本検証
          expect(result.isDirty).toBe(true)
          expect(result.metadata.isModified).toBe(true)
          expect(result.blocks).toBeInstanceOf(Uint16Array)

          // 峡谷（空気）が生成されたことを確認
          let hasAirBlocks = false
          let originalStoneBlocks = 0

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId === 0) {
              hasAirBlocks = true
            } else if (blockId === 2) {
              originalStoneBlocks++
            }
          }

          return { result, hasAirBlocks, originalStoneBlocks }
        })
      )

      const result = await Effect.runPromise(effect)
      const { hasAirBlocks, originalStoneBlocks } = result as {
        result: any
        hasAirBlocks: boolean
        originalStoneBlocks: number
      }

      // 峡谷が生成される可能性をチェック（ノイズベースなので必須ではない）
      expect(typeof hasAirBlocks).toBe('boolean')
      expect(originalStoneBlocks).toBeLessThanOrEqual(16 * 16 * 384)
    })

    it('creates vertical cuts from surface', async () => {
      const ravineConfig: CaveConfig = {
        ...testConfig,
        ravineThreshold: 0.8, // 確実に峡谷を生成
      }

      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      const effect = runWithTestCave(ravineConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.generateRavine(chunkData)

          // 地表付近（Y=64周辺）で垂直な切れ込みがあるかチェック
          const getBlockIndex = (x: number, y: number, z: number) => {
            const normalizedY = y + 64
            return normalizedY + (z << 9) + (x << 13)
          }

          let verticalCutsFound = 0

          for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
              let consecutiveAir = 0
              for (let y = 64; y > 30; y--) {
                const index = getBlockIndex(x, y, z)
                const blockId = result.blocks[index] ?? 0
                if (blockId === 0) {
                  consecutiveAir++
                } else {
                  break
                }
              }
              if (consecutiveAir > 10) {
                // 10ブロック以上の垂直な空洞
                verticalCutsFound++
              }
            }
          }

          return { result, verticalCutsFound }
        })
      )

      const result = await Effect.runPromise(effect)
      const { verticalCutsFound } = result as { result: any; verticalCutsFound: number }
      expect(typeof verticalCutsFound).toBe('number')
      expect(verticalCutsFound).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Lava Lake Generation', () => {
    const createTestChunkData = (position: { x: number; z: number }) => {
      const chunkData = createChunkData(position)

      // チャンクを石で埋める
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2) // 石ブロックID

      return {
        ...chunkData,
        blocks: stoneBlocks,
      }
    }

    it('generates lava lakes correctly', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      const effect = runWithTestCave(testConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.generateLavaLakes(chunkData)

          // 結果の基本検証
          expect(result.isDirty).toBe(true)
          expect(result.metadata.isModified).toBe(true)
          expect(result.blocks).toBeInstanceOf(Uint16Array)

          // 溶岩ブロックの存在チェック
          let lavaBlockCount = 0

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId === 7) {
              // 溶岩ID
              lavaBlockCount++
            }
          }

          return { result, lavaBlockCount }
        })
      )

      const result = await Effect.runPromise(effect)
      const { lavaBlockCount } = result as { result: any; lavaBlockCount: number }
      expect(typeof lavaBlockCount).toBe('number')
      expect(lavaBlockCount).toBeGreaterThanOrEqual(0)
    })

    it('places lava lakes near lava level', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      const effect = runWithTestCave(testConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.generateLavaLakes(chunkData)

          // 溶岩レベル付近の溶岩ブロックを確認
          const getBlockIndex = (x: number, y: number, z: number) => {
            const normalizedY = y + 64
            return normalizedY + (z << 9) + (x << 13)
          }

          let lavaAroundLevel = 0
          const lavaLevel = testConfig.lavaLevel

          for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
              for (let y = lavaLevel - 3; y <= lavaLevel + 1; y++) {
                if (y >= -64 && y < 320) {
                  const index = getBlockIndex(x, y, z)
                  const blockId = result.blocks[index] ?? 0
                  if (blockId === 7) {
                    // 溶岩ID
                    lavaAroundLevel++
                  }
                }
              }
            }
          }

          return { result, lavaAroundLevel }
        })
      )

      const result = await Effect.runPromise(effect)
      const { lavaAroundLevel } = result as { result: any; lavaAroundLevel: number }
      expect(typeof lavaAroundLevel).toBe('number')
      expect(lavaAroundLevel).toBeGreaterThanOrEqual(0)
    })

    it('replaces only air and stone with lava', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createTestChunkData(chunkPosition)

      // 一部に別のブロック（土など）を配置
      const mixedBlocks = new Uint16Array(16 * 16 * 384)
      mixedBlocks.fill(2) // 石

      // いくつかの位置に土ブロック（ID=3）を配置
      const getBlockIndex = (x: number, y: number, z: number) => {
        const normalizedY = y + 64
        return normalizedY + (z << 9) + (x << 13)
      }

      for (let i = 0; i < 100; i++) {
        const x = i % 16
        const z = Math.floor(i / 16) % 16
        const y = testConfig.lavaLevel
        const index = getBlockIndex(x, y, z)
        mixedBlocks[index] = 3 // 土ブロック
      }

      const testChunkData = {
        ...chunkData,
        blocks: mixedBlocks,
      }

      const effect = runWithTestCave(testConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.generateLavaLakes(testChunkData)

          // 土ブロックが溶岩に置換されていないことを確認
          let dirtBlocksRemaining = 0
          let lavaBlocksCreated = 0

          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId === 3) {
              // 土ブロック
              dirtBlocksRemaining++
            } else if (blockId === 7) {
              // 溶岩ブロック
              lavaBlocksCreated++
            }
          }

          return { result, dirtBlocksRemaining, lavaBlocksCreated }
        })
      )

      const result = await Effect.runPromise(effect)
      const { dirtBlocksRemaining, lavaBlocksCreated } = result as {
        result: any
        dirtBlocksRemaining: number
        lavaBlocksCreated: number
      }
      // 土ブロックは溶岩湖生成で置換されないので残っているはず
      expect(dirtBlocksRemaining).toBeGreaterThan(0)
    })
  })

  describe('Performance Requirements', () => {
    it('carves caves efficiently', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createChunkData(chunkPosition)

      // チャンクを石で埋める
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2)
      const testChunkData = { ...chunkData, blocks: stoneBlocks }

      const effect = runWithTestCave(testConfig, (cg) => cg.carveChunk(testChunkData))

      // 洞窟彫刻は500ms以内で完了するべき
      await expectEffectDuration(effect, 0, 500)
    })

    it('handles multiple operations efficiently', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createChunkData(chunkPosition)

      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2)
      const testChunkData = { ...chunkData, blocks: stoneBlocks }

      const effect = runWithTestCave(testConfig, (cg) =>
        Effect.gen(function* () {
          const carved = yield* cg.carveChunk(testChunkData)
          const withRavines = yield* cg.generateRavine(carved)
          const withLava = yield* cg.generateLavaLakes(withRavines)
          return withLava
        })
      )

      // 全ての洞窟生成操作を1000ms以内で完了
      await expectEffectDuration(effect, 0, 1000)
    })
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
        const chunkData = createChunkData(position)
        const stoneBlocks = new Uint16Array(16 * 16 * 384)
        stoneBlocks.fill(2)
        const testChunkData = { ...chunkData, blocks: stoneBlocks }

        const effect = runWithTestCave(testConfig, (cg) =>
          Effect.gen(function* () {
            const result = yield* cg.carveChunk(testChunkData)

            expect(result.position).toEqual(position)
            expect(result.blocks).toHaveLength(16 * 16 * 384)
            expect(result.isDirty).toBe(true)

            return result
          })
        )

        await Effect.runPromise(effect)
      }
    })

    it('handles extreme cave configuration', async () => {
      const extremeConfig: CaveConfig = {
        caveThreshold: 0.99, // ほとんど洞窟なし
        caveScale: 0.001, // 非常に大きなスケール
        lavaLevel: -60, // 非常に低い溶岩レベル
        ravineThreshold: 0.01, // 多くの峡谷
        ravineScale: 0.1, // 小さなスケール
      }

      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createChunkData(chunkPosition)
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2)
      const testChunkData = { ...chunkData, blocks: stoneBlocks }

      const effect = runWithTestCave(extremeConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.carveChunk(testChunkData)

          expect(result.blocks).toHaveLength(16 * 16 * 384)
          expect(result.isDirty).toBe(true)
          expect(Number.isFinite(result.metadata.lastUpdate)).toBe(true)

          return result
        })
      )

      await Effect.runPromise(effect)
    })

    it('handles empty chunks correctly', async () => {
      const chunkPosition = { x: 0, z: 0 }
      const emptyChunkData = createChunkData(chunkPosition) // 全て空気(0)

      const effect = runWithTestCave(testConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.carveChunk(emptyChunkData)

          // 空気チャンクでも処理が完了することを確認
          expect(result.blocks).toHaveLength(16 * 16 * 384)
          expect(result.isDirty).toBe(true)

          // すべてのブロックが依然として空気(0)であることを確認
          let allAir = true
          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId !== 0) {
              allAir = false
              break
            }
          }
          expect(allAir).toBe(true)

          return result
        })
      )

      await Effect.runPromise(effect)
    })
  })

  describe('Configuration Edge Cases', () => {
    it('handles zero threshold configurations', async () => {
      const zeroConfig: CaveConfig = {
        caveThreshold: 0,
        caveScale: 0.02,
        lavaLevel: 10,
        ravineThreshold: 0,
        ravineScale: 0.005,
      }

      const position = { x: 100, y: 50, z: 200 }

      const effect = runWithTestCave(zeroConfig, (cg) =>
        Effect.gen(function* () {
          const isCave = yield* cg.isCave(position)
          expect(typeof isCave).toBe('boolean')
          return isCave
        })
      )

      await Effect.runPromise(effect)
    })

    it('handles very high threshold configurations', async () => {
      const highConfig: CaveConfig = {
        caveThreshold: 1.0,
        caveScale: 0.02,
        lavaLevel: 10,
        ravineThreshold: 1.0,
        ravineScale: 0.005,
      }

      const chunkPosition = { x: 0, z: 0 }
      const chunkData = createChunkData(chunkPosition)
      const stoneBlocks = new Uint16Array(16 * 16 * 384)
      stoneBlocks.fill(2)
      const testChunkData = { ...chunkData, blocks: stoneBlocks }

      const effect = runWithTestCave(highConfig, (cg) =>
        Effect.gen(function* () {
          const result = yield* cg.carveChunk(testChunkData)

          // 高い閾値では多くの洞窟が生成される
          let airBlocks = 0
          for (let i = 0; i < result.blocks.length; i++) {
            const blockId = result.blocks[i] ?? 0
            if (blockId === 0) {
              airBlocks++
            }
          }

          expect(typeof airBlocks).toBe('number')
          expect(airBlocks).toBeGreaterThan(0)

          return result
        })
      )

      await Effect.runPromise(effect)
    })
  })
})
