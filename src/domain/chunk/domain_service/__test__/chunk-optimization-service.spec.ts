import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { ChunkOptimizationService, ChunkOptimizationServiceLive, OptimizationStrategy } from '../chunk-optimizer'

// テスト用のレイヤー
const TestLayer = ChunkOptimizationServiceLive

// テストデータファクトリー
const createTestChunkData = () => ({
  position: { x: 0, z: 0 },
  blocks: new Uint16Array(16 * 16 * 256).fill(1), // 全て同じブロック（高冗長性）
  metadata: {
    biomeId: 1,
    lightLevel: 15,
    timestamp: Date.now()
  },
  isDirty: false
})

const createVariedChunkData = () => {
  const blocks = new Uint16Array(16 * 16 * 256)
  // 多様なブロックパターンを作成
  for (let i = 0; i < blocks.length; i++) {
    blocks[i] = Math.floor(Math.random() * 100) + 1
  }
  return {
    position: { x: 5, z: 5 },
    blocks,
    metadata: {
      biomeId: 2,
      lightLevel: 10,
      timestamp: Date.now()
    },
    isDirty: true
  }
}

const createHighRedundancyChunkData = () => {
  const blocks = new Uint16Array(16 * 16 * 256)
  // 80%を同じブロック、20%を別のブロックで高い冗長性を作成
  const dominantBlock = 42
  const minorityBlock = 7
  const dominantCount = Math.floor(blocks.length * 0.8)

  blocks.fill(dominantBlock)
  for (let i = 0; i < blocks.length - dominantCount; i++) {
    blocks[dominantCount + i] = minorityBlock
  }

  return {
    position: { x: 10, z: 10 },
    blocks,
    metadata: {
      biomeId: 3,
      lightLevel: 8,
      timestamp: Date.now()
    },
    isDirty: false
  }
}

describe('ChunkOptimizationService', () => {
  describe('analyzeEfficiency', () => {
    it('高冗長性チャンクの効率性を正しく分析する', async () => {
      const chunk = createTestChunkData()

      const metrics = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.analyzeEfficiency(chunk)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(metrics.memoryUsage).toBeGreaterThan(0)
      expect(metrics.redundancy).toBeGreaterThan(0.9) // 全て同じブロックなので高い冗長性
      expect(metrics.compressionRatio).toBeGreaterThan(0.9) // 高い圧縮率
      expect(metrics.optimizationPotential).toBeGreaterThan(0.5) // 最適化可能性が高い
      expect(metrics.accessPatterns).toHaveLength(1) // 1種類のブロックのみ
    })

    it('多様なチャンクの効率性を正しく分析する', async () => {
      const chunk = createVariedChunkData()

      const metrics = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.analyzeEfficiency(chunk)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(metrics.redundancy).toBeLessThan(0.5) // 低い冗長性
      expect(metrics.compressionRatio).toBeLessThan(0.5) // 低い圧縮率
      expect(metrics.accessPatterns.length).toBeGreaterThan(10) // 多様なブロック
    })
  })

  describe('optimizeMemory', () => {
    it('メモリ最適化を実行できる', async () => {
      const originalChunk = createTestChunkData()

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.optimizeMemory(originalChunk)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.blocks).toBeInstanceOf(Uint16Array)
      expect(optimizedChunk.blocks.length).toBe(originalChunk.blocks.length)
      expect(optimizedChunk.metadata.optimizedAt).toBeDefined()
      expect(optimizedChunk.metadata.originalBlockCount).toBeDefined()
      expect(optimizedChunk.metadata.optimizedBlockCount).toBeDefined()
    })

    it('最適化後もチャンク構造を維持する', async () => {
      const originalChunk = createVariedChunkData()

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.optimizeMemory(originalChunk)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.position).toEqual(originalChunk.position)
      expect(optimizedChunk.blocks.length).toBe(originalChunk.blocks.length)
      expect(optimizedChunk.isDirty).toBe(originalChunk.isDirty)
    })
  })

  describe('optimizeCompression', () => {
    it('RLE圧縮を適用できる', async () => {
      const chunk = createTestChunkData() // 高冗長性

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.optimizeCompression(chunk, 'rle')
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.metadata.compressed).toBe('rle')
      expect(optimizedChunk.metadata.originalLength).toBe(chunk.blocks.length)
      expect(optimizedChunk.blocks.length).toBeLessThanOrEqual(chunk.blocks.length)
    })

    it('Delta圧縮を適用できる', async () => {
      const chunk = createVariedChunkData()

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.optimizeCompression(chunk, 'delta')
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.metadata.compressed).toBe('delta')
      expect(optimizedChunk.blocks.length).toBe(chunk.blocks.length)
    })

    it('Palette圧縮を適用できる', async () => {
      const chunk = createTestChunkData()

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.optimizeCompression(chunk, 'palette')
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.metadata.compressed).toBe('palette')
      expect(optimizedChunk.metadata.palette).toBeDefined()
    })
  })

  describe('optimizeAccess', () => {
    it('アクセスパターンに基づく最適化を実行できる', async () => {
      const chunk = createVariedChunkData()
      const accessPatterns = [
        { x: 0, y: 0, z: 0, frequency: 100 },
        { x: 1, y: 0, z: 0, frequency: 50 },
        { x: 0, y: 1, z: 0, frequency: 25 }
      ]

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.optimizeAccess(chunk, accessPatterns)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.metadata.accessOptimized).toBe(true)
      expect(optimizedChunk.metadata.optimizationTimestamp).toBeDefined()
    })

    it('アクセスパターンなしでも最適化を実行できる', async () => {
      const chunk = createTestChunkData()

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.optimizeAccess(chunk)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.metadata.accessOptimized).toBe(true)
    })
  })

  describe('suggestOptimizations', () => {
    it('高冗長性チャンクに適切な最適化を提案する', async () => {
      const chunk = createHighRedundancyChunkData()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const metrics = yield* service.analyzeEfficiency(chunk)
        return yield* service.suggestOptimizations(metrics)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      const strategyTags = result.map(strategy => strategy._tag)
      expect(strategyTags).toContain('MemoryOptimization')
      expect(strategyTags).toContain('RedundancyElimination')
    })

    it('多様なチャンクに適切な最適化を提案する', async () => {
      const chunk = createVariedChunkData()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const metrics = yield* service.analyzeEfficiency(chunk)
        return yield* service.suggestOptimizations(metrics)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(Array.isArray(result)).toBe(true)
      // 低冗長性の場合、提案される最適化は少ない
    })
  })

  describe('applyOptimization', () => {
    it('最適化戦略を適用し結果を返す', async () => {
      const chunk = createTestChunkData()
      const strategy = OptimizationStrategy.MemoryOptimization(false)

      const result = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.applyOptimization(chunk, strategy)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.originalSize).toBe(chunk.blocks.byteLength)
      expect(result.optimizedSize).toBeGreaterThan(0)
      expect(result.compressionRatio).toBeGreaterThan(0)
      expect(result.strategy).toEqual(strategy)
      expect(result.timeSpent).toBeGreaterThan(0)
      expect(result.qualityLoss).toBeGreaterThanOrEqual(0)
      expect(result.qualityLoss).toBeLessThanOrEqual(1)
    })

    it('異なる最適化戦略で異なる結果を返す', async () => {
      const chunk = createVariedChunkData()
      const memoryStrategy = OptimizationStrategy.MemoryOptimization(true)
      const compressionStrategy = OptimizationStrategy.CompressionOptimization('rle')

      const result = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService

        const memoryResult = yield* service.applyOptimization(chunk, memoryStrategy)
        const compressionResult = yield* service.applyOptimization(chunk, compressionStrategy)

        return { memoryResult, compressionResult }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.memoryResult.strategy._tag).toBe('MemoryOptimization')
      expect(result.compressionResult.strategy._tag).toBe('CompressionOptimization')
    })
  })

  describe('eliminateRedundancy', () => {
    it('冗長性を除去できる', async () => {
      const chunk = createHighRedundancyChunkData()

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.eliminateRedundancy(chunk, 0.7)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.metadata.redundancyEliminated).toBe(true)
      expect(optimizedChunk.metadata.eliminationThreshold).toBe(0.7)
      expect(optimizedChunk.metadata.eliminationTimestamp).toBeDefined()

      // 冗長性が減少していることを確認
      const uniqueBlocks = new Set(optimizedChunk.blocks).size
      const originalUniqueBlocks = new Set(chunk.blocks).size
      expect(uniqueBlocks).toBeLessThanOrEqual(originalUniqueBlocks)
    })

    it('デフォルト閾値で冗長性除去を実行できる', async () => {
      const chunk = createHighRedundancyChunkData()

      const optimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.eliminateRedundancy(chunk)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(optimizedChunk.metadata.redundancyEliminated).toBe(true)
    })
  })

  describe('defragment', () => {
    it('ブロックIDの断片化を解消できる', async () => {
      // 断片化したブロックIDを持つチャンクを作成
      const chunk = createVariedChunkData()
      const sparseBlocks = new Uint16Array(chunk.blocks.length)

      // 飛び飛びのIDを使用（1, 5, 10, 50, 100など）
      const sparseIds = [1, 5, 10, 50, 100]
      for (let i = 0; i < sparseBlocks.length; i++) {
        sparseBlocks[i] = sparseIds[i % sparseIds.length]
      }

      const fragmentedChunk = { ...chunk, blocks: sparseBlocks }

      const defragmentedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        return yield* service.defragment(fragmentedChunk)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(defragmentedChunk.metadata.defragmented).toBe(true)
      expect(defragmentedChunk.metadata.blockMapping).toBeDefined()
      expect(defragmentedChunk.metadata.defragmentationTimestamp).toBeDefined()

      // デフラグ後のブロックIDは連続している
      const uniqueIds = Array.from(new Set(defragmentedChunk.blocks)).sort((a, b) => a - b)
      for (let i = 0; i < uniqueIds.length; i++) {
        expect(uniqueIds[i]).toBe(i)
      }
    })
  })

  describe('統合テスト', () => {
    it('複数の最適化を順次適用できる', async () => {
      const originalChunk = createHighRedundancyChunkData()

      const fullyOptimizedChunk = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService

        // 1. メモリ最適化
        const memoryOptimized = yield* service.optimizeMemory(originalChunk)

        // 2. 冗長性除去
        const redundancyOptimized = yield* service.eliminateRedundancy(memoryOptimized, 0.8)

        // 3. デフラグメンテーション
        const defragmented = yield* service.defragment(redundancyOptimized)

        return defragmented
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(fullyOptimizedChunk.metadata.optimizedAt).toBeDefined()
      expect(fullyOptimizedChunk.metadata.redundancyEliminated).toBe(true)
      expect(fullyOptimizedChunk.metadata.defragmented).toBe(true)
    })

    it('最適化のパフォーマンスを測定できる', async () => {
      const chunk = createVariedChunkData()

      const performanceResult = await Effect.gen(function* () {
        const service = yield* ChunkOptimizationService

        const startTime = Date.now()

        const metrics = yield* service.analyzeEfficiency(chunk)
        const strategies = yield* service.suggestOptimizations(metrics)

        const results = []
        for (const strategy of strategies) {
          const result = yield* service.applyOptimization(chunk, strategy)
          results.push(result)
        }

        const endTime = Date.now()

        return {
          totalTime: endTime - startTime,
          strategiesApplied: results.length,
          averageTimePerStrategy: results.reduce((sum, r) => sum + r.timeSpent, 0) / results.length
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(performanceResult.totalTime).toBeGreaterThan(0)
      expect(performanceResult.strategiesApplied).toBeGreaterThanOrEqual(0)
    })
  })
})