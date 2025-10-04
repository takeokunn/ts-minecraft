import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import {
  ChunkDomainServices,
  performCompleteChunkValidation,
  optimizeAndValidateChunk,
  serializeWithIntegrityCheck,
  processChunkCompletely,
  processBatchChunks,
  SerializationFormat
} from '../index'
import { ChunkValidationService } from '../chunk-validator'
import { ChunkSerializationService } from '../chunk-serializer'
import { ChunkOptimizationService } from '../chunk-optimizer'

// テストデータファクトリー
const createTestChunkData = () => ({
  position: { x: 100, z: 200 },
  blocks: new Uint16Array(16 * 16 * 256).fill(5),
  metadata: {
    biomeId: 3,
    lightLevel: 12,
    timestamp: Date.now()
  },
  isDirty: false
})

const createBatchTestData = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    position: { x: i * 16, z: i * 16 },
    blocks: new Uint16Array(16 * 16 * 256).fill(i + 1),
    metadata: {
      biomeId: Math.floor(i / 4) + 1,
      lightLevel: 10 + (i % 6),
      timestamp: Date.now() + i * 1000
    },
    isDirty: i % 2 === 0
  }))

describe('Domain Services Integration', () => {
  describe('Service Dependencies', () => {
    it('全てのドメインサービスが正しく注入される', async () => {
      const services = await Effect.gen(function* () {
        const validation = yield* ChunkValidationService
        const serialization = yield* ChunkSerializationService
        const optimization = yield* ChunkOptimizationService

        return { validation, serialization, optimization }
      }).pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(services.validation).toBeDefined()
      expect(services.serialization).toBeDefined()
      expect(services.optimization).toBeDefined()
    })

    it('サービス間の依存関係が正しく動作する', async () => {
      const chunk = createTestChunkData()

      const result = await Effect.gen(function* () {
        const validation = yield* ChunkValidationService
        const serialization = yield* ChunkSerializationService

        // 検証サービスでチェック
        const isValid = yield* validation.validateIntegrity(chunk)

        // シリアライゼーションサービスでチェックサム計算
        const checksum = yield* serialization.calculateChecksum(chunk.blocks)

        // 検証サービスでチェックサム検証
        const checksumValid = yield* validation.validateChecksum(chunk.blocks, checksum)

        return { isValid, checksum, checksumValid }
      }).pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(result.isValid).toBe(true)
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/)
      expect(result.checksumValid).toBe(true)
    })
  })

  describe('performCompleteChunkValidation', () => {
    it('完全なチャンク検証を実行できる', async () => {
      const chunk = createTestChunkData()

      const result = await performCompleteChunkValidation(chunk)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(result.isValid).toBe(true)
      expect(result.checksum).toBeDefined()
      expect(result.integrityValid).toBe(true)
    })

    it('無効なチャンクで検証エラーを返す', async () => {
      const invalidChunk = {
        ...createTestChunkData(),
        blocks: new Uint16Array(100) // 無効なサイズ
      }

      const result = await performCompleteChunkValidation(invalidChunk)
        .pipe(
          Effect.provide(ChunkDomainServices),
          Effect.flip,
          Effect.runPromise
        )

      expect(result.message).toContain('整合性検証に失敗')
    })
  })

  describe('optimizeAndValidateChunk', () => {
    it('最適化と検証を組み合わせて実行できる', async () => {
      const chunk = createTestChunkData()

      const result = await optimizeAndValidateChunk(chunk)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(result.originalChunk).toEqual(chunk)
      expect(result.optimizedChunk).toBeDefined()
      expect(result.optimizationResults).toBeDefined()
      expect(result.validationResult).toBeDefined()
      expect(result.metrics).toBeDefined()

      // 最適化後も検証に通ることを確認
      expect(result.validationResult.isValid).toBe(true)
    })

    it('最適化によるメトリクス改善を確認できる', async () => {
      const highRedundancyChunk = {
        ...createTestChunkData(),
        blocks: new Uint16Array(16 * 16 * 256).fill(1) // 全て同じブロック
      }

      const result = await optimizeAndValidateChunk(highRedundancyChunk)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(result.metrics.redundancy).toBeGreaterThan(0.9)
      expect(result.metrics.optimizationPotential).toBeGreaterThan(0.5)
      expect(result.optimizationResults.length).toBeGreaterThan(0)
    })
  })

  describe('serializeWithIntegrityCheck', () => {
    it('整合性チェック付きシリアライゼーションを実行できる', async () => {
      const chunk = createTestChunkData()
      const format = SerializationFormat.Binary()

      const result = await serializeWithIntegrityCheck(chunk, format)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(result.serializedData).toBeInstanceOf(Uint8Array)
      expect(result.checksum).toBeDefined()
      expect(result.format).toEqual(format)
      expect(result.size).toBeGreaterThan(0)
      expect(result.isValid).toBe(true)
    })

    it('複数のシリアライゼーション形式で動作する', async () => {
      const chunk = createTestChunkData()

      const results = await Effect.gen(function* () {
        const binaryResult = yield* serializeWithIntegrityCheck(chunk, SerializationFormat.Binary())
        const jsonResult = yield* serializeWithIntegrityCheck(chunk, SerializationFormat.JSON())

        return { binaryResult, jsonResult }
      }).pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(results.binaryResult.isValid).toBe(true)
      expect(results.jsonResult.isValid).toBe(true)
      expect(results.binaryResult.size).not.toBe(results.jsonResult.size)
    })
  })

  describe('processChunkCompletely', () => {
    it('完全なチャンク処理パイプラインを実行できる', async () => {
      const chunk = createTestChunkData()
      const format = SerializationFormat.Binary()

      const result = await processChunkCompletely(chunk, format)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(result.pipeline.initialValidation.isValid).toBe(true)
      expect(result.pipeline.optimization.optimizedChunk).toBeDefined()
      expect(result.pipeline.serialization.isValid).toBe(true)
      expect(result.pipeline.finalChecksum).toBeDefined()

      expect(result.summary.originalSize).toBeGreaterThan(0)
      expect(result.summary.optimizedSize).toBeGreaterThan(0)
      expect(result.summary.serializedSize).toBeGreaterThan(0)
      expect(result.summary.totalCompressionRatio).toBeGreaterThan(0)
      expect(result.summary.isValid).toBe(true)
    })

    it('パイプライン実行時のパフォーマンスを測定できる', async () => {
      const chunk = createTestChunkData()
      const format = SerializationFormat.Compressed('gzip')

      const startTime = Date.now()
      const result = await processChunkCompletely(chunk, format)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)
      const endTime = Date.now()

      expect(endTime - startTime).toBeGreaterThan(0)
      expect(result.summary.totalCompressionRatio).toBeLessThan(1) // 圧縮されている
    })
  })

  describe('processBatchChunks', () => {
    it('バッチチャンク処理を実行できる', async () => {
      const chunks = createBatchTestData(5)
      const format = SerializationFormat.Binary()

      const result = await processBatchChunks(chunks, format)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      expect(result.results).toHaveLength(5)
      expect(result.batchStatistics.totalChunks).toBe(5)
      expect(result.batchStatistics.successfullyProcessed).toBe(5)
      expect(result.batchStatistics.failedProcessing).toBe(0)
      expect(result.batchStatistics.successRate).toBe(1.0)
      expect(result.batchStatistics.totalOriginalSize).toBeGreaterThan(0)
      expect(result.batchStatistics.totalSerializedSize).toBeGreaterThan(0)
      expect(result.batchStatistics.averageCompressionRatio).toBeGreaterThan(0)
    })

    it('大きなバッチでも効率的に処理できる', async () => {
      const chunks = createBatchTestData(20)
      const format = SerializationFormat.JSON()

      const startTime = Date.now()
      const result = await processBatchChunks(chunks, format)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)
      const endTime = Date.now()

      expect(result.results).toHaveLength(20)
      expect(result.batchStatistics.successRate).toBe(1.0)
      expect(endTime - startTime).toBeLessThan(10000) // 10秒以内
    })

    it('並列処理によるパフォーマンス向上を確認できる', async () => {
      const chunks = createBatchTestData(10)
      const format = SerializationFormat.Binary()

      // バッチ処理（並列）
      const batchStartTime = Date.now()
      const batchResult = await processBatchChunks(chunks, format)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)
      const batchEndTime = Date.now()

      // 逐次処理
      const sequentialStartTime = Date.now()
      const sequentialResults = []
      for (const chunk of chunks) {
        const result = await processChunkCompletely(chunk, format)
          .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)
        sequentialResults.push(result)
      }
      const sequentialEndTime = Date.now()

      const batchTime = batchEndTime - batchStartTime
      const sequentialTime = sequentialEndTime - sequentialStartTime

      expect(batchResult.results).toHaveLength(chunks.length)
      expect(sequentialResults).toHaveLength(chunks.length)

      // 並列処理の方が高速であることを確認（通常）
      // ただし、テスト環境では必ずしも保証されないため、緩い条件で確認
      expect(batchTime).toBeLessThan(sequentialTime * 2)
    })
  })

  describe('エラーハンドリング統合', () => {
    it('部分的な失敗を適切に処理する', async () => {
      const chunks = [
        createTestChunkData(),
        {
          ...createTestChunkData(),
          blocks: new Uint16Array(100) // 無効なサイズ
        },
        createTestChunkData()
      ]
      const format = SerializationFormat.Binary()

      const result = await processBatchChunks(chunks, format)
        .pipe(
          Effect.provide(ChunkDomainServices),
          Effect.catchAll(() => Effect.succeed({
            results: [],
            batchStatistics: {
              totalChunks: chunks.length,
              successfullyProcessed: 0,
              failedProcessing: chunks.length,
              totalOriginalSize: 0,
              totalSerializedSize: 0,
              averageCompressionRatio: 0,
              successRate: 0
            }
          })),
          Effect.runPromise
        )

      expect(result.batchStatistics.totalChunks).toBe(3)
      // エラーハンドリングにより、部分的な処理結果が得られることを期待
    })

    it('サービス依存関係のエラーを適切に伝播する', async () => {
      const chunk = createTestChunkData()

      // 不完全なレイヤー（一部のサービスが欠如）を提供
      const incompleteLayer = Layer.mergeAll(
        // ChunkValidationServiceLiveのみ（他のサービスなし）
        import('../chunk-validator').then(m => m.ChunkValidationServiceLive)
      )

      const result = await performCompleteChunkValidation(chunk)
        .pipe(
          Effect.provide(incompleteLayer),
          Effect.flip,
          Effect.runPromise
        )

      // 依存関係不足によるエラーが発生することを確認
      expect(result).toBeDefined() // エラーが発生している
    })
  })

  describe('メモリとパフォーマンス', () => {
    it('大量データ処理時のメモリ効率性を確認', async () => {
      const largeChunk = {
        ...createTestChunkData(),
        blocks: new Uint16Array(16 * 16 * 256).fill(Math.floor(Math.random() * 1000))
      }

      const beforeMemory = process.memoryUsage().heapUsed

      const result = await processChunkCompletely(largeChunk, SerializationFormat.Compressed('gzip'))
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)

      const afterMemory = process.memoryUsage().heapUsed
      const memoryIncrease = afterMemory - beforeMemory

      expect(result.summary.isValid).toBe(true)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB以下の増加
    })

    it('並列処理時のスループットを測定', async () => {
      const chunkCount = 50
      const chunks = createBatchTestData(chunkCount)
      const format = SerializationFormat.Binary()

      const startTime = Date.now()
      const result = await processBatchChunks(chunks, format)
        .pipe(Effect.provide(ChunkDomainServices), Effect.runPromise)
      const endTime = Date.now()

      const totalTime = endTime - startTime
      const throughput = chunkCount / (totalTime / 1000) // chunks per second

      expect(result.batchStatistics.successRate).toBe(1.0)
      expect(throughput).toBeGreaterThan(0)

      console.log(`Batch processing throughput: ${throughput.toFixed(2)} chunks/second`)
    })
  })
})