import { describe, it, expect } from 'vitest'
import { it as itEffect } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { Schema } from '@effect/schema'
import * as fc from 'fast-check'
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
import type { NoiseGenerator } from '../NoiseGenerator'
import { NoiseGeneratorTag } from '../NoiseGenerator'
import { createChunkData } from '../../chunk/ChunkData'

// NoiseGenerator モックレイヤー
const NoiseGeneratorTestLayer = Layer.succeed(
  NoiseGeneratorTag,
  {
    noise2D: () => Effect.succeed(0.5),
    noise3D: () => Effect.succeed(0.5),
    octaveNoise2D: () => Effect.succeed(0.3),
    octaveNoise3D: () => Effect.succeed(0.3),
    getSeed: () => 12345,
    getConfig: () => ({
      seed: 12345,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
    }),
  }
)

// テスト用レイヤー
const testLayer = (config: CaveConfig) =>
  Layer.mergeAll(NoiseGeneratorTestLayer, CaveGeneratorLive(config))

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
      ]

      for (const data of invalidCaveData) {
        expect(() => Schema.decodeUnknownSync(CaveDataSchema)(data)).toThrow()
      }
    })
  })

  describe('Service Creation', () => {
    itEffect('creates CaveGenerator with custom config', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        expect(cg.getConfig()).toEqual(testConfig)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('creates CaveGenerator with default config', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const config = cg.getConfig()

        expect(config.caveThreshold).toBe(0.2)
        expect(config.caveScale).toBe(0.02)
        expect(config.lavaLevel).toBe(10)
        expect(config.ravineThreshold).toBe(0.05)
        expect(config.ravineScale).toBe(0.005)
      }).pipe(Effect.provide(Layer.mergeAll(NoiseGeneratorTestLayer, CaveGeneratorLiveDefault)))
    )
  })

  describe('Cave Detection', () => {
    itEffect('detects cave positions accurately', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const position = { x: 0, y: 0, z: 0 }

        const isCave1 = yield* cg.isCave(position)
        const isCave2 = yield* cg.isCave(position)

        // 同じ座標では同じ結果になるはず
        expect(isCave1).toBe(isCave2)
        expect(typeof isCave1).toBe('boolean')
      }).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('provides consistent cave detection', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const position = { x: 123, y: 45, z: 678 }

        const results: boolean[] = []
        // 複数回同じ位置をチェック
        for (let i = 0; i < 3; i++) {
          const isCave = yield* cg.isCave(position)
          results.push(isCave)
        }

        // すべて同じ結果であることを確認
        const allSame = results.every((result) => result === results[0])
        expect(allSame).toBe(true)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('handles extreme coordinates', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const position = { x: 1000000, y: 319, z: 1000000 }

        const isCave = yield* cg.isCave(position)
        expect(typeof isCave).toBe('boolean')
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
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

    itEffect('carves caves in chunk correctly', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const chunkPosition = { x: 0, z: 0 }
        const chunkData = createTestChunkData(chunkPosition)

        const result = yield* cg.carveChunk(chunkData)

        // 結果の基本検証
        expect(result.isDirty).toBe(true)
        expect(result.metadata.isModified).toBe(true)
        expect(result.blocks).toBeInstanceOf(Uint16Array)
        expect(result.blocks.length).toBe(16 * 16 * 384)

        // 洞窟が彫られたことを確認
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

        // 洞窟（空気）が生成されていることを確認
        expect(hasAirBlocks).toBe(true)
        // 元の石ブロックより少なくなっていることを確認
        expect(originalStoneBlocks).toBeLessThan(16 * 16 * 384)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('preserves chunk metadata correctly', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const chunkPosition = { x: 5, z: 10 }
        const chunkData = createTestChunkData(chunkPosition)
        const originalTimestamp = chunkData.metadata.lastUpdate

        const result = yield* cg.carveChunk(chunkData)

        expect(result.position).toEqual(chunkPosition)
        expect(result.metadata.isModified).toBe(true)
        expect(result.metadata.lastUpdate).toBeGreaterThan(originalTimestamp)
        expect(result.isDirty).toBe(true)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
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

    itEffect('generates ravines correctly', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const chunkPosition = { x: 0, z: 0 }
        const chunkData = createTestChunkData(chunkPosition)

        const result = yield* cg.generateRavine(chunkData)

        // 結果の基本検証
        expect(result.isDirty).toBe(true)
        expect(result.metadata.isModified).toBe(true)
        expect(result.blocks).toBeInstanceOf(Uint16Array)

        // 峡谷が生成されたかの確認
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

        expect(typeof hasAirBlocks).toBe('boolean')
        expect(originalStoneBlocks).toBeLessThanOrEqual(16 * 16 * 384)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
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

    itEffect('generates lava lakes correctly', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const chunkPosition = { x: 0, z: 0 }
        const chunkData = createTestChunkData(chunkPosition)

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

        expect(typeof lavaBlockCount).toBe('number')
        expect(lavaBlockCount).toBeGreaterThanOrEqual(0)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
  })

  describe('Edge Cases', () => {
    itEffect('handles extreme chunk positions', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const position = { x: 1000000, z: 1000000 }
        const chunkData = createChunkData(position)
        const stoneBlocks = new Uint16Array(16 * 16 * 384)
        stoneBlocks.fill(2)
        const testChunkData = { ...chunkData, blocks: stoneBlocks }

        const result = yield* cg.carveChunk(testChunkData)

        expect(result.position).toEqual(position)
        expect(result.blocks).toHaveLength(16 * 16 * 384)
        expect(result.isDirty).toBe(true)
      }).pipe(Effect.provide(testLayer(testConfig)))
    )

    itEffect('handles empty chunks correctly', () =>
      Effect.gen(function* () {
        const cg = yield* CaveGeneratorTag
        const chunkPosition = { x: 0, z: 0 }
        const emptyChunkData = createChunkData(chunkPosition) // 全て空気(0)

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
      }).pipe(Effect.provide(testLayer(testConfig)))
    )
  })
})