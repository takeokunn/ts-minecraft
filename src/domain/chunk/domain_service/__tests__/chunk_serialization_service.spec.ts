import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { ChunkSerializationService, ChunkSerializationServiceLive, SerializationFormat } from '../chunk_serializer'

// テスト用のレイヤー
const TestLayer = ChunkSerializationServiceLive

// テストデータファクトリー
const createTestChunkData = () => ({
  position: { x: 10, z: 20 },
  blocks: new Uint16Array(16 * 16 * 256).fill(42),
  metadata: {
    biome: 'plains',
    lightLevel: 12,
    isModified: false,
    lastUpdate: 1700000000000,
    heightMap: Array.from({ length: 16 * 16 }, () => 64),
    generationVersion: 1,
    features: [],
    structureReferences: {},
  },
  isDirty: false,
})

describe('ChunkSerializationService', () => {
  describe('serialize and deserialize', () => {
    it('Binary形式でシリアライゼーション・デシリアライゼーションできる', async () => {
      const originalChunk = createTestChunkData()
      const format = SerializationFormat.Binary()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        // シリアライゼーション
        const serialized = yield* service.serialize(originalChunk, format)

        // デシリアライゼーション
        const deserialized = yield* service.deserialize(serialized, format)

        return { serialized, deserialized }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.serialized).toBeInstanceOf(Uint8Array)
      expect(result.serialized.length).toBeGreaterThan(0)

      // デシリアライズされたデータの検証
      expect(result.deserialized.position.x).toBe(originalChunk.position.x)
      expect(result.deserialized.position.z).toBe(originalChunk.position.z)
      expect(result.deserialized.isDirty).toBe(originalChunk.isDirty)
      expect(result.deserialized.metadata.biomeId).toBe(originalChunk.metadata.biomeId)
      expect(result.deserialized.blocks.length).toBe(originalChunk.blocks.length)
    })

    it('JSON形式でシリアライゼーション・デシリアライゼーションできる', async () => {
      const originalChunk = createTestChunkData()
      const format = SerializationFormat.JSON({ pretty: true })

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        const serialized = yield* service.serialize(originalChunk, format)
        const deserialized = yield* service.deserialize(serialized, format)

        return { serialized, deserialized }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      // JSONとして解析可能か確認
      const jsonString = new TextDecoder().decode(result.serialized)
      const parsedJson = JSON.parse(jsonString)

      expect(parsedJson.position.x).toBe(originalChunk.position.x)
      expect(parsedJson.position.z).toBe(originalChunk.position.z)

      // デシリアライズされたデータの検証
      expect(result.deserialized.position.x).toBe(originalChunk.position.x)
      expect(result.deserialized.position.z).toBe(originalChunk.position.z)
      expect(result.deserialized.blocks).toBeInstanceOf(Uint16Array)
    })

    it('圧縮形式でシリアライゼーション・デシリアライゼーションできる', async () => {
      const originalChunk = createTestChunkData()
      const format = SerializationFormat.Compressed('gzip')

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        const serialized = yield* service.serialize(originalChunk, format)
        const deserialized = yield* service.deserialize(serialized, format)

        return { serialized, deserialized }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.serialized).toBeInstanceOf(Uint8Array)
      expect(result.deserialized.position.x).toBe(originalChunk.position.x)
      expect(result.deserialized.position.z).toBe(originalChunk.position.z)
    })
  })

  describe('compress and decompress', () => {
    it('gzipで圧縮・解凍できる', async () => {
      const testData = new TextEncoder().encode('Hello, World! '.repeat(100))

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        const compressed = yield* service.compress(testData, 'gzip')
        const decompressed = yield* service.decompress(compressed, 'gzip')

        return { compressed, decompressed }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.compressed.length).toBeLessThanOrEqual(testData.length) // 圧縮されている
      expect(Array.from(result.decompressed)).toEqual(Array.from(testData)) // 元データと一致
    })

    it('deflateで圧縮・解凍できる', async () => {
      const testData = new TextEncoder().encode('Test data for deflate compression')

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        const compressed = yield* service.compress(testData, 'deflate')
        const decompressed = yield* service.decompress(compressed, 'deflate')

        return { compressed, decompressed }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(Array.from(result.decompressed)).toEqual(Array.from(testData))
    })
  })

  describe('calculateChecksum', () => {
    it('SHA-256チェックサムを計算できる', async () => {
      const testData = new TextEncoder().encode('test data')

      const checksum = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService
        return yield* service.calculateChecksum(testData, 'SHA-256')
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(checksum).toMatch(/^[a-f0-9]{64}$/) // SHA-256は64文字の16進数
    })

    it('SHA-1チェックサムを計算できる', async () => {
      const testData = new TextEncoder().encode('test data')

      const checksum = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService
        return yield* service.calculateChecksum(testData, 'SHA-1')
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(checksum).toMatch(/^[a-f0-9]{40}$/) // SHA-1は40文字の16進数
    })

    it('同じデータは同じチェックサムを生成する', async () => {
      const testData = new TextEncoder().encode('consistent data')

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        const checksum1 = yield* service.calculateChecksum(testData)
        const checksum2 = yield* service.calculateChecksum(testData)

        return { checksum1, checksum2 }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.checksum1).toBe(result.checksum2)
    })
  })

  describe('estimateSize', () => {
    it('Binary形式のサイズを推定できる', async () => {
      const chunk = createTestChunkData()
      const format = SerializationFormat.Binary()

      const estimatedSize = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService
        return yield* service.estimateSize(chunk, format)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(estimatedSize).toBeGreaterThan(0)
      expect(typeof estimatedSize).toBe('number')
    })

    it('JSON形式のサイズを推定できる', async () => {
      const chunk = createTestChunkData()
      const format = SerializationFormat.JSON()

      const estimatedSize = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService
        return yield* service.estimateSize(chunk, format)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(estimatedSize).toBeGreaterThan(0)
    })

    it('圧縮形式は非圧縮形式より小さい推定サイズを返す', async () => {
      const chunk = createTestChunkData()
      const binaryFormat = SerializationFormat.Binary()
      const compressedFormat = SerializationFormat.Compressed('gzip')

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        const binarySize = yield* service.estimateSize(chunk, binaryFormat)
        const compressedSize = yield* service.estimateSize(chunk, compressedFormat)

        return { binarySize, compressedSize }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result.compressedSize).toBeLessThanOrEqual(result.binarySize)
    })
  })

  describe('validateSerialization', () => {
    it('正しいシリアライゼーションを検証できる', async () => {
      const originalChunk = createTestChunkData()
      const format = SerializationFormat.Binary()

      const isValid = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        const serialized = yield* service.serialize(originalChunk, format)
        return yield* service.validateSerialization(originalChunk, serialized, format)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(isValid).toBe(true)
    })

    it('破損したシリアライゼーションを検出できる', async () => {
      const originalChunk = createTestChunkData()
      const format = SerializationFormat.Binary()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService

        const serialized = yield* service.serialize(originalChunk, format)

        // データを意図的に破損
        const corruptedData = new Uint8Array(serialized)
        corruptedData[10] = corruptedData[10] ^ 0xff // ビット反転

        return yield* service.validateSerialization(originalChunk, corruptedData, format)
      }).pipe(
        Effect.provide(TestLayer),
        Effect.flip, // エラーを期待
        Effect.runPromise
      )

      expect(result._tag).toBe('ChunkSerializationError')
    })
  })

  describe('エラーハンドリング', () => {
    it('無効なアルゴリズムで圧縮エラーを処理する', async () => {
      const testData = new Uint8Array([1, 2, 3])

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService
        return yield* service.compress(testData, 'invalid-algorithm' as any)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result._tag).toBe('ChunkSerializationError')
    })

    it('不正なJSONデータでデシリアライゼーションエラーを処理する', async () => {
      const invalidJson = new TextEncoder().encode('{ invalid json }')
      const format = SerializationFormat.JSON()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkSerializationService
        return yield* service.deserialize(invalidJson, format)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result._tag).toBe('ChunkSerializationError')
    })
  })
})
