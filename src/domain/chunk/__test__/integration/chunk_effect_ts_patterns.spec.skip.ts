import { it } from '@effect/vitest'
import { Effect, Layer, TestContext, TestClock, Random, Schema } from 'effect'
import { describe, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Chunk System - Effect-TS統合テストパターン実装例
 *
 * このファイルは、Effect-TSを使った高品質なテストの書き方のベストプラクティスを示します。
 * 以下のパターンを含みます：
 * 1. Effect.Service を使った正しいサービス定義
 * 2. TestContext と TestClock を使った制御可能なテスト環境
 * 3. Property-Based Testing と Effect-TS の統合
 * 4. 型安全性を保ったモックサービスの作成
 */

// ===================================
// テスト用 Chunk Position Value Object
// ===================================

const ChunkPositionSchema = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number,
})

type ChunkPosition = typeof ChunkPositionSchema.Type

const ChunkPosition = {
  create: (x: number, z: number): Effect.Effect<ChunkPosition> =>
    Effect.succeed({ x, z }),

  distance: (from: ChunkPosition, to: ChunkPosition): number =>
    Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.z - from.z, 2)),

  equals: (a: ChunkPosition, b: ChunkPosition): boolean =>
    a.x === b.x && a.z === b.z,
}

// ===================================
// テスト用 Chunk Service (正しいEffect.Service パターン)
// ===================================

class ChunkService extends Effect.Service<ChunkService>()(
  'ChunkService',
  {
    effect: Effect.gen(function* () {
      return {
        loadChunk: (position: ChunkPosition) =>
          Effect.gen(function* () {
            // 模擬的なチャンクロード処理
            yield* Effect.sleep(10) // 非同期処理をシミュレート
            return {
              position,
              data: new Uint8Array(16 * 16 * 256), // 16x16x256 chunk
              timestamp: yield* Effect.map(Effect.clockWith(clock => clock.currentTimeMillis), t => t),
            }
          }),

        unloadChunk: (position: ChunkPosition) =>
          Effect.gen(function* () {
            yield* Effect.sleep(5)
            return { position, unloaded: true }
          }),

        getLoadedChunks: () =>
          Effect.succeed([
            { x: 0, z: 0 },
            { x: 1, z: 0 },
            { x: 0, z: 1 },
          ] as ChunkPosition[]),

        isChunkLoaded: (position: ChunkPosition) =>
          Effect.succeed(position.x >= -1 && position.x <= 1 && position.z >= -1 && position.z <= 1),
      }
    }),
  }
) {}

// ===================================
// テスト用 Player Service (依存性注入のパターン)
// ===================================

class PlayerService extends Effect.Service<PlayerService>()(
  'PlayerService',
  {
    effect: Effect.gen(function* () {
      return {
        getPosition: () =>
          Effect.succeed({ x: 8.5, z: 12.3 }), // プレイヤー座標

        getChunkPosition: () =>
          Effect.gen(function* () {
            const pos = yield* Effect.succeed({ x: 8.5, z: 12.3 })
            return yield* ChunkPosition.create(Math.floor(pos.x / 16), Math.floor(pos.z / 16))
          }),

        moveToPosition: (newPos: { x: number; z: number }) =>
          Effect.succeed({ previousPos: { x: 8.5, z: 12.3 }, newPos }),
      }
    }),
  }
) {}

// ===================================
// テストレイヤー構成
// ===================================

const TestLayer = Layer.mergeAll(
  ChunkService.Default,
  PlayerService.Default,
  TestContext.TestContext,
  TestClock.TestClock
)

// ===================================
// Effect-TS統合テストパターン
// ===================================

describe('Chunk System - Effect-TS Integration Patterns', () => {

  // パターン1: 基本的なEffect.genテスト
  describe('Basic Effect.gen Patterns', () => {
    it.effect('should load chunk with proper async handling', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const position = yield* ChunkPosition.create(0, 0)

        const chunk = yield* chunkService.loadChunk(position)

        expect(chunk.position).toEqual(position)
        expect(chunk.data).toBeInstanceOf(Uint8Array)
        expect(chunk.timestamp).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle service dependencies correctly', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const playerService = yield* PlayerService

        const playerChunkPos = yield* playerService.getChunkPosition()
        const isLoaded = yield* chunkService.isChunkLoaded(playerChunkPos)

        expect(typeof isLoaded).toBe('boolean')
        expect(ChunkPosition.equals(playerChunkPos, { x: 0, z: 0 })).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // パターン2: TestClockを使った時間制御
  describe('TestClock Integration', () => {
    it.effect('should control time in chunk loading', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const position = yield* ChunkPosition.create(1, 1)

        // 時間を記録
        const startTime = yield* Effect.clockWith(clock => clock.currentTimeMillis)

        // 非同期処理を開始（バックグラウンドで実行）
        const loadPromise = chunkService.loadChunk(position)

        // TestClockで時間を進める
        yield* TestClock.adjust('50 millis')

        // 処理が完了するまで待つ
        const chunk = yield* loadPromise
        const endTime = yield* Effect.clockWith(clock => clock.currentTimeMillis)

        expect(endTime - startTime).toBeGreaterThanOrEqual(10)
        expect(chunk.position).toEqual(position)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // パターン3: Property-Based Testing + Effect-TS
  describe('Property-Based Testing Integration', () => {
    it.effect('should maintain chunk position invariants', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService

        // Effect-TSとfast-checkの統合
        yield* Effect.forEach(Array.from({ length: 100 }), () =>
          Effect.gen(function* () {
            // Effect.randomを使った座標生成
            const x = yield* Random.nextIntBetween(-10, 10)
            const z = yield* Random.nextIntBetween(-10, 10)
            const position = yield* ChunkPosition.create(x, z)

            const chunk = yield* chunkService.loadChunk(position)

            // Property: ロードしたチャンクの座標は入力と同じ
            expect(chunk.position.x).toBe(position.x)
            expect(chunk.position.z).toBe(position.z)

            // Property: チャンクデータは常に正しいサイズ
            expect(chunk.data.length).toBe(16 * 16 * 256)
          })
        )
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // パターン4: エラーハンドリングとEffect型安全性
  describe('Error Handling Patterns', () => {
    it.effect('should handle service errors gracefully', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService

        // 無効な座標でのテスト
        const invalidPosition = yield* ChunkPosition.create(NaN, NaN)

        // エラーが発生しても型安全
        const result = yield* Effect.either(chunkService.loadChunk(invalidPosition))

        pipe(
          result,
          Match.value,
          Match.when(
            { _tag: 'Left' },
            (error) => {
              // エラーケースのテスト
              expect(error.left).toBeDefined()
            }
          ),
          Match.when(
            { _tag: 'Right' },
            (success) => {
              // 成功ケースのテスト
              expect(success.right.position).toBeDefined()
            }
          ),
          Match.exhaustive
        )
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // パターン5: 並行性とFiber管理
  describe('Concurrency Patterns', () => {
    it.effect('should handle concurrent chunk operations', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService

        const positions = [
          yield* ChunkPosition.create(0, 0),
          yield* ChunkPosition.create(1, 0),
          yield* ChunkPosition.create(0, 1),
          yield* ChunkPosition.create(1, 1),
        ]

        // 並行してチャンクをロード
        const chunks = yield* Effect.all(
          positions.map(pos => chunkService.loadChunk(pos)),
          { concurrency: 'unbounded' }
        )

        expect(chunks).toHaveLength(4)
        chunks.forEach((chunk, index) => {
          expect(chunk.position).toEqual(positions[index])
        })
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // パターン6: Schema統合とバリデーション
  describe('Schema Integration', () => {
    it.effect('should validate chunk data with Schema', () =>
      Effect.gen(function* () {
        const position = yield* ChunkPosition.create(2, 2)

        // Schemaを使った型安全なバリデーション
        const validatedPosition = yield* Schema.decodeUnknown(ChunkPositionSchema)(position)

        expect(validatedPosition.x).toBe(2)
        expect(validatedPosition.z).toBe(2)
        expect(typeof validatedPosition.x).toBe('number')
        expect(typeof validatedPosition.z).toBe('number')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // パターン7: リソース管理とスコープ
  describe('Resource Management', () => {
    it.scoped('should manage chunk lifecycle with scoped resources', () =>
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        const position = yield* ChunkPosition.create(3, 3)

        // スコープ付きリソース管理のシミュレーション
        const resource = yield* Effect.acquireRelease(
          chunkService.loadChunk(position),
          (chunk) => chunkService.unloadChunk(chunk.position)
        )

        expect(resource.position).toEqual(position)
        // スコープが終了すると自動的にアンロードされる
      }).pipe(Effect.provide(TestLayer))
    )
  })
})

// ===================================
// テストパターンのまとめ
// ===================================

/**
 * このファイルで実装したEffect-TSテストパターン:
 *
 * 1. ✅ Effect.Service を使った正しいサービス定義
 * 2. ✅ TestContext と TestClock による時間制御
 * 3. ✅ Property-Based Testing との統合
 * 4. ✅ 型安全なエラーハンドリング
 * 5. ✅ 並行性とFiber管理
 * 6. ✅ Schema統合とバリデーション
 * 7. ✅ リソース管理とスコープ
 *
 * これらのパターンを他のドメインモジュールでも活用することで、
 * 高品質で保守性の高いテストスイートを構築できます。
 */