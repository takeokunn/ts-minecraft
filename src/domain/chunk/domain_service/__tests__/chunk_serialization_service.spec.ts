import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'
import { provideLayers } from '../../../../testing/effect'
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
    it.effect('Binary形式でシリアライゼーション・デシリアライゼーションできる', () =>
      provideLayers(
        Effect.gen(function* () {
          const originalChunk = createTestChunkData()
          const format = SerializationFormat.Binary()
          const service = yield* ChunkSerializationService

          // シリアライゼーション
          const serialized = yield* service.serialize(originalChunk, format)

          // デシリアライゼーション
          const deserialized = yield* service.deserialize(serialized, format)

          expect(serialized).toBeInstanceOf(Uint8Array)
          expect(serialized.length).toBeGreaterThan(0)

          // デシリアライズされたデータの検証
          expect(deserialized.position.x).toBe(originalChunk.position.x)
          expect(deserialized.position.z).toBe(originalChunk.position.z)
          expect(deserialized.isDirty).toBe(originalChunk.isDirty)
          expect(deserialized.metadata.biomeId).toBe(originalChunk.metadata.biomeId)
          expect(deserialized.blocks.length).toBe(originalChunk.blocks.length)
        }),
        TestLayer
      )
    )

    it.effect('JSON形式でシリアライゼーション・デシリアライゼーションできる', () =>
      provideLayers(
        Effect.gen(function* () {
          const originalChunk = createTestChunkData()
          const format = SerializationFormat.JSON({ pretty: true })
          const service = yield* ChunkSerializationService

          const serialized = yield* service.serialize(originalChunk, format)
          const deserialized = yield* service.deserialize(serialized, format)

          // JSONとして解析可能か確認
          const jsonString = new TextDecoder().decode(serialized)
          const parsedJson = JSON.parse(jsonString)

          expect(parsedJson.position.x).toBe(originalChunk.position.x)
          expect(parsedJson.position.z).toBe(originalChunk.position.z)

          // デシリアライズされたデータの検証
          expect(deserialized.position.x).toBe(originalChunk.position.x)
          expect(deserialized.position.z).toBe(originalChunk.position.z)
          expect(deserialized.blocks).toBeInstanceOf(Uint16Array)
        }),
        TestLayer
      )
    )

    it.effect('圧縮形式でシリアライゼーション・デシリアライゼーションできる', () =>
      provideLayers(
        Effect.gen(function* () {
          const originalChunk = createTestChunkData()
          const format = SerializationFormat.Compressed('gzip')
          const service = yield* ChunkSerializationService

          const serialized = yield* service.serialize(originalChunk, format)
          const deserialized = yield* service.deserialize(serialized, format)

          expect(serialized).toBeInstanceOf(Uint8Array)
          expect(deserialized.position.x).toBe(originalChunk.position.x)
          expect(deserialized.position.z).toBe(originalChunk.position.z)
        }),
        TestLayer
      )
    )
  })

  describe('compress and decompress', () => {
    it.effect('gzipで圧縮・解凍できる', () =>
      provideLayers(
        Effect.gen(function* () {
          const testData = new TextEncoder().encode('Hello, World! '.repeat(100))
          const service = yield* ChunkSerializationService

          const compressed = yield* service.compress(testData, 'gzip')
          const decompressed = yield* service.decompress(compressed, 'gzip')

          expect(compressed.length).toBeLessThanOrEqual(testData.length) // 圧縮されている
          expect(Array.from(decompressed)).toEqual(Array.from(testData)) // 元データと一致
        }),
        TestLayer
      )
    )

    it.effect('deflateで圧縮・解凍できる', () =>
      provideLayers(
        Effect.gen(function* () {
          const testData = new TextEncoder().encode('Test data for deflate compression')
          const service = yield* ChunkSerializationService

          const compressed = yield* service.compress(testData, 'deflate')
          const decompressed = yield* service.decompress(compressed, 'deflate')

          expect(Array.from(decompressed)).toEqual(Array.from(testData))
        }),
        TestLayer
      )
    )
  })

  describe('calculateChecksum', () => {
    it.effect('SHA-256チェックサムを計算できる', () =>
      provideLayers(
        Effect.gen(function* () {
          const testData = new TextEncoder().encode('test data')
          const service = yield* ChunkSerializationService

          const checksum = yield* service.calculateChecksum(testData, 'SHA-256')

          expect(checksum).toMatch(/^[a-f0-9]{64}$/) // SHA-256は64文字の16進数
        }),
        TestLayer
      )
    )

    it.effect('SHA-1チェックサムを計算できる', () =>
      provideLayers(
        Effect.gen(function* () {
          const testData = new TextEncoder().encode('test data')
          const service = yield* ChunkSerializationService

          const checksum = yield* service.calculateChecksum(testData, 'SHA-1')

          expect(checksum).toMatch(/^[a-f0-9]{40}$/) // SHA-1は40文字の16進数
        }),
        TestLayer
      )
    )

    it.effect('同じデータは同じチェックサムを生成する', () =>
      provideLayers(
        Effect.gen(function* () {
          const testData = new TextEncoder().encode('consistent data')
          const service = yield* ChunkSerializationService

          const checksum1 = yield* service.calculateChecksum(testData)
          const checksum2 = yield* service.calculateChecksum(testData)

          expect(checksum1).toBe(checksum2)
        }),
        TestLayer
      )
    )
  })

  describe('estimateSize', () => {
    it.effect('Binary形式のサイズを推定できる', () =>
      provideLayers(
        Effect.gen(function* () {
          const chunk = createTestChunkData()
          const format = SerializationFormat.Binary()
          const service = yield* ChunkSerializationService

          const estimatedSize = yield* service.estimateSize(chunk, format)

          expect(estimatedSize).toBeGreaterThan(0)
          expect(typeof estimatedSize).toBe('number')
        }),
        TestLayer
      )
    )

    it.effect('JSON形式のサイズを推定できる', () =>
      provideLayers(
        Effect.gen(function* () {
          const chunk = createTestChunkData()
          const format = SerializationFormat.JSON()
          const service = yield* ChunkSerializationService

          const estimatedSize = yield* service.estimateSize(chunk, format)

          expect(estimatedSize).toBeGreaterThan(0)
        }),
        TestLayer
      )
    )

    it.effect('圧縮形式は非圧縮形式より小さい推定サイズを返す', () =>
      provideLayers(
        Effect.gen(function* () {
          const chunk = createTestChunkData()
          const binaryFormat = SerializationFormat.Binary()
          const compressedFormat = SerializationFormat.Compressed('gzip')
          const service = yield* ChunkSerializationService

          const binarySize = yield* service.estimateSize(chunk, binaryFormat)
          const compressedSize = yield* service.estimateSize(chunk, compressedFormat)

          expect(compressedSize).toBeLessThanOrEqual(binarySize)
        }),
        TestLayer
      )
    )
  })

  describe('validateSerialization', () => {
    it.effect('正しいシリアライゼーションを検証できる', () =>
      provideLayers(
        Effect.gen(function* () {
          const originalChunk = createTestChunkData()
          const format = SerializationFormat.Binary()
          const service = yield* ChunkSerializationService

          const serialized = yield* service.serialize(originalChunk, format)
          const isValid = yield* service.validateSerialization(originalChunk, serialized, format)

          expect(isValid).toBe(true)
        }),
        TestLayer
      )
    )

    it.effect('破損したシリアライゼーションを検出できる', () =>
      provideLayers(
        Effect.gen(function* () {
          const originalChunk = createTestChunkData()
          const format = SerializationFormat.Binary()
          const service = yield* ChunkSerializationService

          const serialized = yield* service.serialize(originalChunk, format)

          // データを意図的に破損
          const corruptedData = new Uint8Array(serialized)
          corruptedData[10] = corruptedData[10] ^ 0xff // ビット反転

          // エラーが発生することを期待
          const result = yield* Effect.flip(service.validateSerialization(originalChunk, corruptedData, format))

          expect(result._tag).toBe('ChunkSerializationError')
        }),
        TestLayer
      )
    )
  })

  describe('エラーハンドリング', () => {
    it.effect('無効なアルゴリズムで圧縮エラーを処理する', () =>
      provideLayers(
        Effect.gen(function* () {
          const testData = new Uint8Array([1, 2, 3])
          const service = yield* ChunkSerializationService

          const result = yield* Effect.flip(service.compress(testData, 'invalid-algorithm' as any))

          expect(result._tag).toBe('ChunkSerializationError')
        }),
        TestLayer
      )
    )

    it.effect('不正なJSONデータでデシリアライゼーションエラーを処理する', () =>
      provideLayers(
        Effect.gen(function* () {
          const invalidJson = new TextEncoder().encode('{ invalid json }')
          const format = SerializationFormat.JSON()
          const service = yield* ChunkSerializationService

          const result = yield* Effect.flip(service.deserialize(invalidJson, format))

          expect(result._tag).toBe('ChunkSerializationError')
        }),
        TestLayer
      )
    )
  })
})
