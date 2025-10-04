import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { ChunkFactoryService } from '../chunk-factory'
import { ChunkCompleteLayer } from '../index'
import { SerializationFormat } from '../../domain-service'

// テストデータファクトリー
const createValidPosition = () => ({ x: 50, z: 75 })
const createValidBlocks = () => new Uint16Array(16 * 16 * 256).fill(10)
const createValidMetadata = () => ({
  biomeId: 2,
  lightLevel: 14,
  timestamp: Date.now()
})

const createSerializedChunkData = async () => {
  const chunk = {
    position: createValidPosition(),
    blocks: createValidBlocks(),
    metadata: createValidMetadata(),
    isDirty: false
  }

  return await Effect.gen(function* () {
    const { ChunkSerializationService } = yield* import('../../domain-service')
    const serialization = yield* ChunkSerializationService
    return yield* serialization.serialize(chunk, SerializationFormat.Binary())
  }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)
}

describe('ChunkFactoryService', () => {
  describe('createValidatedChunk', () => {
    it('有効なパラメータでチャンクを作成できる', async () => {
      const position = createValidPosition()
      const blocks = createValidBlocks()
      const metadata = createValidMetadata()

      const chunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createValidatedChunk(position, blocks, metadata)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(chunk.position).toEqual(position)
      expect(chunk.blocks).toEqual(blocks)
      expect(chunk.metadata).toEqual(metadata)
      expect(chunk.isDirty).toBe(true) // 新規作成のため
    })

    it('無効な位置でエラーを返す', async () => {
      const invalidPosition = { x: -2147483649, z: 0 }
      const blocks = createValidBlocks()
      const metadata = createValidMetadata()

      const result = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createValidatedChunk(invalidPosition, blocks, metadata)
      }).pipe(
        Effect.provide(ChunkCompleteLayer),
        Effect.flip,
        Effect.runPromise
      )

      expect(result.message).toContain('チャンクX座標が範囲外です')
    })

    it('無効なブロックデータでエラーを返す', async () => {
      const position = createValidPosition()
      const invalidBlocks = new Uint16Array(100) // 無効なサイズ
      const metadata = createValidMetadata()

      const result = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createValidatedChunk(position, invalidBlocks, metadata)
      }).pipe(
        Effect.provide(ChunkCompleteLayer),
        Effect.flip,
        Effect.runPromise
      )

      expect(result.message).toContain('チャンクデータサイズが不正です')
    })

    it('無効なメタデータでエラーを返す', async () => {
      const position = createValidPosition()
      const blocks = createValidBlocks()
      const invalidMetadata = {
        biomeId: -1, // 無効
        lightLevel: 15,
        timestamp: Date.now()
      }

      const result = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createValidatedChunk(position, blocks, invalidMetadata)
      }).pipe(
        Effect.provide(ChunkCompleteLayer),
        Effect.flip,
        Effect.runPromise
      )

      expect(result.message).toContain('無効なバイオームID')
    })
  })

  describe('createOptimizedChunk', () => {
    it('最適化されたチャンクを作成できる', async () => {
      const position = createValidPosition()
      const blocks = new Uint16Array(16 * 16 * 256).fill(1) // 高冗長性
      const metadata = createValidMetadata()

      const chunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createOptimizedChunk(position, blocks, metadata)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(chunk.position).toEqual(position)
      expect(chunk.metadata.optimized).toBe(true)
      expect(chunk.metadata.createdAt).toBeDefined()
      expect(chunk.metadata.redundancyEliminated).toBe(true)
    })

    it('最適化後もデータ整合性を保つ', async () => {
      const position = createValidPosition()
      const blocks = createValidBlocks()
      const metadata = createValidMetadata()

      const chunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createOptimizedChunk(position, blocks, metadata)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(chunk.blocks).toBeInstanceOf(Uint16Array)
      expect(chunk.blocks.length).toBe(16 * 16 * 256)
      expect(chunk.position).toEqual(position)
    })
  })

  describe('createEmptyChunk', () => {
    it('空のチャンクを作成できる', async () => {
      const position = createValidPosition()

      const chunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createEmptyChunk(position)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(chunk.position).toEqual(position)
      expect(chunk.blocks.every(block => block === 0)).toBe(true)
      expect(chunk.metadata.biomeId).toBe(1) // デフォルトバイオーム
      expect(chunk.metadata.lightLevel).toBe(15) // 最大光レベル
    })

    it('指定したブロックIDで埋められたチャンクを作成できる', async () => {
      const position = createValidPosition()
      const fillBlockId = 42

      const chunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createEmptyChunk(position, fillBlockId)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(chunk.blocks.every(block => block === fillBlockId)).toBe(true)
    })
  })

  describe('createChunkFromSerialized', () => {
    it('シリアライズデータからチャンクを復元できる', async () => {
      const serializedData = await createSerializedChunkData()
      const format = SerializationFormat.Binary()

      const chunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createChunkFromSerialized(serializedData, format)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(chunk.position.x).toBe(50)
      expect(chunk.position.z).toBe(75)
      expect(chunk.blocks).toBeInstanceOf(Uint16Array)
      expect(chunk.metadata.restoredAt).toBeDefined()
      expect(chunk.metadata.restoredFrom).toBe('Binary')
    })

    it('破損したシリアライズデータでエラーを返す', async () => {
      const corruptedData = new Uint8Array([1, 2, 3, 4, 5]) // 明らかに無効
      const format = SerializationFormat.Binary()

      const result = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createChunkFromSerialized(corruptedData, format)
      }).pipe(
        Effect.provide(ChunkCompleteLayer),
        Effect.flip,
        Effect.runPromise
      )

      expect(result.message).toContain('シリアライズデータから復元したチャンクの検証に失敗')
    })
  })

  describe('cloneChunk', () => {
    it('チャンクをクローンできる', async () => {
      const originalChunk = {
        position: createValidPosition(),
        blocks: createValidBlocks(),
        metadata: createValidMetadata(),
        isDirty: false
      }

      const clonedChunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.cloneChunk(originalChunk)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(clonedChunk.position).toEqual(originalChunk.position)
      expect(clonedChunk.blocks).toEqual(originalChunk.blocks)
      expect(clonedChunk.blocks).not.toBe(originalChunk.blocks) // 異なるインスタンス
      expect(clonedChunk.isDirty).toBe(true) // クローンは常にdirty
      expect(clonedChunk.metadata.clonedAt).toBeDefined()
      expect(clonedChunk.metadata.originalTimestamp).toBe(originalChunk.metadata.timestamp)
    })

    it('検証なしでクローンできる', async () => {
      const originalChunk = {
        position: createValidPosition(),
        blocks: createValidBlocks(),
        metadata: createValidMetadata(),
        isDirty: false
      }

      const clonedChunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.cloneChunk(originalChunk, { validate: false })
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(clonedChunk.metadata.clonedAt).toBeDefined()
    })

    it('最適化付きでクローンできる', async () => {
      const originalChunk = {
        position: createValidPosition(),
        blocks: new Uint16Array(16 * 16 * 256).fill(1), // 高冗長性
        metadata: createValidMetadata(),
        isDirty: false
      }

      const clonedChunk = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.cloneChunk(originalChunk, { optimize: true })
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(clonedChunk.metadata.optimizedAt).toBeDefined()
    })
  })

  describe('createChunkAggregate', () => {
    it('チャンクデータから集約を作成できる', async () => {
      const chunkData = {
        position: createValidPosition(),
        blocks: createValidBlocks(),
        metadata: createValidMetadata(),
        isDirty: false
      }

      const aggregate = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createChunkAggregate(chunkData)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(aggregate.id).toBeDefined()
      expect(aggregate.position).toEqual(chunkData.position)
      expect(aggregate.data).toEqual(chunkData)
      expect(typeof aggregate.getBlock).toBe('function')
      expect(typeof aggregate.setBlock).toBe('function')
      expect(typeof aggregate.fillRegion).toBe('function')
    })

    it('集約のブロック操作が動作する', async () => {
      const chunkData = {
        position: createValidPosition(),
        blocks: createValidBlocks(),
        metadata: createValidMetadata(),
        isDirty: false
      }

      const result = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        const aggregate = yield* factory.createChunkAggregate(chunkData)

        // ブロック取得
        const blockId = yield* aggregate.getBlock(8 as any, 64 as any, 8 as any)

        // ブロック設定
        const updatedAggregate = yield* aggregate.setBlock(8 as any, 64 as any, 8 as any, 99 as any)

        return { originalBlockId: blockId, updatedAggregate }
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(result.originalBlockId).toBe(10) // 元のfillブロック
      expect(result.updatedAggregate.data.isDirty).toBe(true)
    })

    it('集約の境界チェックが動作する', async () => {
      const chunkData = {
        position: createValidPosition(),
        blocks: createValidBlocks(),
        metadata: createValidMetadata(),
        isDirty: false
      }

      const result = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        const aggregate = yield* factory.createChunkAggregate(chunkData)

        // 範囲外アクセス
        return yield* aggregate.getBlock(-1 as any, 0 as any, 0 as any)
      }).pipe(
        Effect.provide(ChunkCompleteLayer),
        Effect.flip,
        Effect.runPromise
      )

      expect(result.message).toContain('X座標が範囲外です')
    })

    it('集約のリージョン操作が動作する', async () => {
      const chunkData = {
        position: createValidPosition(),
        blocks: createValidBlocks(),
        metadata: createValidMetadata(),
        isDirty: false
      }

      const updatedAggregate = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        const aggregate = yield* factory.createChunkAggregate(chunkData)

        // 2x2x2の領域を埋める
        return yield* aggregate.fillRegion(
          0 as any, 0 as any, 0 as any, // 開始点
          1 as any, 1 as any, 1 as any, // 終了点
          77 as any // ブロックID
        )
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(updatedAggregate.data.isDirty).toBe(true)

      // 埋めた領域のブロックを確認
      const blockAt000 = await Effect.gen(function* () {
        return yield* updatedAggregate.getBlock(0 as any, 0 as any, 0 as any)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(blockAt000).toBe(77)
    })

    it('集約のユーティリティメソッドが動作する', async () => {
      const emptyChunkData = {
        position: createValidPosition(),
        blocks: new Uint16Array(16 * 16 * 256).fill(0),
        metadata: createValidMetadata(),
        isDirty: false
      }

      const aggregate = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createChunkAggregate(emptyChunkData)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(aggregate.isEmpty()).toBe(true)
      expect(aggregate.getMemoryUsage()).toBeGreaterThan(0)

      const dirtyAggregate = aggregate.markDirty()
      expect(dirtyAggregate.data.isDirty).toBe(true)

      const cleanAggregate = dirtyAggregate.markClean()
      expect(cleanAggregate.data.isDirty).toBe(false)

      const updatedAggregate = aggregate.updateMetadata({ lightLevel: 5 })
      expect(updatedAggregate.data.metadata.lightLevel).toBe(5)
      expect(updatedAggregate.data.isDirty).toBe(true)
    })
  })

  describe('createBatchChunks', () => {
    it('複数のチャンクを一度に作成できる', async () => {
      const specifications = [
        { position: { x: 0, z: 0 } },
        { position: { x: 16, z: 0 }, fillBlockId: 5 },
        {
          position: { x: 0, z: 16 },
          blocks: createValidBlocks(),
          metadata: createValidMetadata()
        }
      ]

      const chunks = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createBatchChunks(specifications)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(chunks).toHaveLength(3)

      // 1つ目: デフォルト設定
      expect(chunks[0].position).toEqual({ x: 0, z: 0 })
      expect(chunks[0].blocks.every(block => block === 0)).toBe(true)

      // 2つ目: カスタムfillBlockId
      expect(chunks[1].position).toEqual({ x: 16, z: 0 })
      expect(chunks[1].blocks.every(block => block === 5)).toBe(true)

      // 3つ目: カスタムブロックとメタデータ
      expect(chunks[2].position).toEqual({ x: 0, z: 16 })
      expect(chunks[2].blocks).toEqual(createValidBlocks())
    })

    it('大量のチャンクを効率的に作成できる', async () => {
      const chunkCount = 100
      const specifications = Array.from({ length: chunkCount }, (_, i) => ({
        position: { x: i % 10, z: Math.floor(i / 10) },
        fillBlockId: i % 5 + 1
      }))

      const startTime = Date.now()
      const chunks = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createBatchChunks(specifications)
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)
      const endTime = Date.now()

      expect(chunks).toHaveLength(chunkCount)
      expect(endTime - startTime).toBeLessThan(5000) // 5秒以内

      // ランダムサンプリングで検証
      const randomIndex = Math.floor(Math.random() * chunkCount)
      const expectedFillId = randomIndex % 5 + 1
      expect(chunks[randomIndex].blocks.every(block => block === expectedFillId)).toBe(true)
    })
  })

  describe('統合テスト', () => {
    it('ファクトリーとドメインサービスの連携が正しく動作する', async () => {
      const result = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService

        // 1. 最適化されたチャンクを作成
        const position = createValidPosition()
        const blocks = new Uint16Array(16 * 16 * 256).fill(1) // 高冗長性
        const metadata = createValidMetadata()

        const optimizedChunk = yield* factory.createOptimizedChunk(position, blocks, metadata)

        // 2. 集約を作成
        const aggregate = yield* factory.createChunkAggregate(optimizedChunk)

        // 3. 集約をクローン
        const clonedChunk = yield* factory.cloneChunk(aggregate.data, { optimize: true })

        return { optimizedChunk, aggregate, clonedChunk }
      }).pipe(Effect.provide(ChunkCompleteLayer), Effect.runPromise)

      expect(result.optimizedChunk.metadata.optimized).toBe(true)
      expect(result.aggregate.id).toBeDefined()
      expect(result.clonedChunk.metadata.clonedAt).toBeDefined()
      expect(result.clonedChunk.metadata.optimizedAt).toBeDefined()
    })

    it('エラー状況でも適切にハンドリングする', async () => {
      const invalidSpecifications = [
        { position: { x: -2147483649, z: 0 } }, // 無効な位置
        { position: { x: 0, z: 0 } } // 有効な位置
      ]

      const result = await Effect.gen(function* () {
        const factory = yield* ChunkFactoryService
        return yield* factory.createBatchChunks(invalidSpecifications)
      }).pipe(
        Effect.provide(ChunkCompleteLayer),
        Effect.flip,
        Effect.runPromise
      )

      // バッチ処理で一つでも失敗すると全体が失敗する
      expect(result.message).toContain('チャンクX座標が範囲外です')
    })
  })
})