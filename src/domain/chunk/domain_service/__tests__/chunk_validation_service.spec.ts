import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { ChunkBoundsError } from '../../aggregate/chunk'
import { ChunkDataValidationError } from '../../aggregate/chunk_data'
import { ChunkValidationService, ChunkValidationServiceLive } from '../chunk_validator'

// テスト用のレイヤー
const TestLayer = ChunkValidationServiceLive

// テストデータファクトリー
const createValidChunkPosition = () => ({ x: 0, z: 0 })
const createValidChunkData = () => new Uint16Array(16 * 16 * 256).fill(1)
const createValidChunkMetadata = () => ({
  biomeId: 1,
  lightLevel: 15,
  timestamp: Date.now(),
})

const createValidChunkData = () => ({
  position: createValidChunkPosition(),
  blocks: createValidChunkData(),
  metadata: createValidChunkMetadata(),
  isDirty: false,
})

describe('ChunkValidationService', () => {
  describe('validatePosition', () => {
    it('有効な位置を検証できる', async () => {
      const position = createValidChunkPosition()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validatePosition(position)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result).toEqual(position)
    })

    it('無効なX座標でエラーを返す', async () => {
      const position = { x: -2147483649, z: 0 } // 範囲外

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validatePosition(position)
      }).pipe(
        Effect.provide(TestLayer),
        Effect.flip, // エラーを成功として扱う
        Effect.runPromise
      )

      expect(result).toBeInstanceOf(ChunkBoundsError)
      expect(result.message).toContain('チャンクX座標が範囲外です')
    })

    it('無効なZ座標でエラーを返す', async () => {
      const position = { x: 0, z: 2147483648 } // 範囲外

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validatePosition(position)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkBoundsError)
      expect(result.message).toContain('チャンクZ座標が範囲外です')
    })
  })

  describe('validateData', () => {
    it('有効なUint16Arrayデータを検証できる', async () => {
      const data = createValidChunkData()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateData(data)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result).toBe(data)
    })

    it('無効なデータ型でエラーを返す', async () => {
      const data = new Array(16 * 16 * 256).fill(1) as any // Array instead of Uint16Array

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateData(data)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkDataValidationError)
      expect(result.message).toContain('Uint16Array型である必要があります')
    })

    it('無効なデータサイズでエラーを返す', async () => {
      const data = new Uint16Array(100) // サイズが小さすぎる

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateData(data)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkDataValidationError)
      expect(result.message).toContain('チャンクデータサイズが不正です')
    })
  })

  describe('validateMetadata', () => {
    it('有効なメタデータを検証できる', async () => {
      const metadata = createValidChunkMetadata()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateMetadata(metadata)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result).toEqual(metadata)
    })

    it('無効なバイオームIDでエラーを返す', async () => {
      const metadata = { ...createValidChunkMetadata(), biomeId: -1 }

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateMetadata(metadata)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkDataValidationError)
      expect(result.message).toContain('無効なバイオームID')
    })

    it('無効な光レベルでエラーを返す', async () => {
      const metadata = { ...createValidChunkMetadata(), lightLevel: 16 }

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateMetadata(metadata)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkDataValidationError)
      expect(result.message).toContain('無効な光レベル')
    })

    it('無効なタイムスタンプでエラーを返す', async () => {
      const metadata = { ...createValidChunkMetadata(), timestamp: -1 }

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateMetadata(metadata)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkDataValidationError)
      expect(result.message).toContain('無効なタイムスタンプ')
    })
  })

  describe('validateIntegrity', () => {
    it('有効なチャンクデータの整合性を検証できる', async () => {
      const chunk = createValidChunkData()

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateIntegrity(chunk)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result).toBe(true)
    })

    it('無効なチャンクデータで整合性エラーを返す', async () => {
      const chunk = {
        ...createValidChunkData(),
        blocks: new Uint16Array(100), // 無効なサイズ
      }

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateIntegrity(chunk)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkDataValidationError)
    })
  })

  describe('validateChecksum', () => {
    it('有効なチェックサムを検証できる', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])

      // 先にチェックサムを計算
      const expectedChecksum = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        const serialization = yield* import('../chunk_serializer').then((m) => m.ChunkSerializationService)
        return yield* serialization.calculateChecksum(data)
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            TestLayer,
            import('../chunk_serializer').then((m) => m.ChunkSerializationServiceLive)
          )
        ),
        Effect.runPromise
      )

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateChecksum(data, expectedChecksum)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result).toBe(true)
    })

    it('無効なチェックサムでエラーを返す', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const wrongChecksum = 'invalid_checksum'

      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateChecksum(data, wrongChecksum)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkDataValidationError)
      expect(result.message).toContain('チェックサムが一致しません')
    })
  })

  describe('validateChunkBounds', () => {
    it('有効な座標を検証できる', async () => {
      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateChunkBounds(8, 128, 8)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result).toBe(true)
    })

    it('境界座標を検証できる', async () => {
      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateChunkBounds(0, 0, 0)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result).toBe(true)
    })

    it('最大境界座標を検証できる', async () => {
      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateChunkBounds(15, 255, 15)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise)

      expect(result).toBe(true)
    })

    it('範囲外のX座標でエラーを返す', async () => {
      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateChunkBounds(-1, 0, 0)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkBoundsError)
      expect(result.message).toContain('X座標が範囲外です')
    })

    it('範囲外のY座標でエラーを返す', async () => {
      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateChunkBounds(0, 256, 0)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkBoundsError)
      expect(result.message).toContain('Y座標が範囲外です')
    })

    it('範囲外のZ座標でエラーを返す', async () => {
      const result = await Effect.gen(function* () {
        const service = yield* ChunkValidationService
        return yield* service.validateChunkBounds(0, 0, 16)
      }).pipe(Effect.provide(TestLayer), Effect.flip, Effect.runPromise)

      expect(result).toBeInstanceOf(ChunkBoundsError)
      expect(result.message).toContain('Z座標が範囲外です')
    })
  })
})
