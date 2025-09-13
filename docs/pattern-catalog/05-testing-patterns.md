---
title: "Testing Patterns"
category: "Pattern Catalog"
complexity: "high"
dependencies:
  - "effect"
  - "@effect/vitest"
  - "vitest"
ai_tags:
  - "unit-testing"
  - "integration-testing"
  - "test-doubles"
  - "property-testing"
implementation_time: "2-4 hours"
skill_level: "advanced"
last_pattern_update: "2025-09-14"
---

# Testing Patterns

Effect-TSアプリケーションにおけるテストのベストプラクティス集

## Pattern 1: Basic Service Testing

**使用場面**: サービスの単体テスト

**実装**:
```typescript
import { Effect, Layer, Context, TestContext } from "effect"
import { describe, it, expect } from "@effect/vitest"

// テスト対象のサービス
export const ChunkService = Context.GenericTag<{
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, ChunkSaveError>
}>("@minecraft/ChunkService")

// モックストレージサービス
const MockStorageService = Context.GenericTag<{
  readonly get: (key: string) => Effect.Effect<Option.Option<string>>
  readonly set: (key: string, value: string) => Effect.Effect<void>
}>("@minecraft/MockStorageService")

// テスト用のChunkService実装
const TestChunkServiceLive = Layer.effect(
  ChunkService,
  Effect.gen(function* () {
    const storage = yield* MockStorageService

    return {
      loadChunk: (coord) =>
        Effect.gen(function* () {
          const key = `chunk_${coord.x}_${coord.z}`
          const data = yield* storage.get(key)

          if (Option.isNone(data)) {
            return yield* Effect.fail(new ChunkLoadError({
              coordinate: coord,
              reason: "Chunk not found"
            }))
          }

          return JSON.parse(data.value) as Chunk
        }),

      saveChunk: (chunk) =>
        Effect.gen(function* () {
          const key = `chunk_${chunk.coordinate.x}_${chunk.coordinate.z}`
          yield* storage.set(key, JSON.stringify(chunk))
        })
    }
  })
)

// モックストレージの実装
const MockStorageLive = Layer.effect(
  MockStorageService,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, string>())

    return {
      get: (key) =>
        Ref.get(store).pipe(
          Effect.map(map => Option.fromNullable(map.get(key)))
        ),

      set: (key, value) =>
        Ref.update(store, map => new Map(map).set(key, value))
    }
  })
)

// テスト実装
describe("ChunkService", () => {
  it.effect("should load and save chunks correctly", () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService

      const testChunk: Chunk = {
        coordinate: { x: 0, z: 0 },
        blocks: [],
        entities: [],
        lastModified: new Date()
      }

      // チャンク保存のテスト
      yield* chunkService.saveChunk(testChunk)

      // チャンク読み込みのテスト
      const loadedChunk = yield* chunkService.loadChunk({ x: 0, z: 0 })

      expect(loadedChunk.coordinate).toEqual(testChunk.coordinate)
      expect(loadedChunk.blocks).toEqual(testChunk.blocks)
    }).pipe(
      Effect.provide(TestChunkServiceLive),
      Effect.provide(MockStorageLive)
    )
  )

  it.effect("should handle chunk not found error", () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService

      const result = yield* chunkService.loadChunk({ x: 999, z: 999 }).pipe(
        Effect.either
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(ChunkLoadError)
      }
    }).pipe(
      Effect.provide(TestChunkServiceLive),
      Effect.provide(MockStorageLive)
    )
  )
})
```

## Pattern 2: TestClock for Time-based Testing

**使用場面**: 時間に依存するロジックのテスト

**実装**:
```typescript
import { TestClock } from "effect"

describe("TimeBasedService", () => {
  it.effect("should handle timeouts correctly", () =>
    Effect.gen(function* () {
      const testClock = yield* TestClock.TestClock

      // タイムアウト付きの処理をテスト
      const timeoutResult = Effect.gen(function* () {
        yield* Effect.sleep("5 seconds")
        return "completed"
      }).pipe(
        Effect.timeout("3 seconds")
      )

      // タイマーを進める前に処理を開始
      const fiber = yield* Effect.fork(timeoutResult)

      // 3秒進める（タイムアウトが発生するはず）
      yield* testClock.adjust("3 seconds")

      const result = yield* Fiber.await(fiber).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(Effect.TimeoutException)
      }
    }).pipe(
      Effect.provide(TestContext.TestContext)
    )
  )

  it.effect("should process scheduled tasks", () =>
    Effect.gen(function* () {
      const testClock = yield* TestClock.TestClock
      const results = yield* Ref.make<string[]>([])

      // スケジュールされたタスク
      const scheduledTask = Effect.gen(function* () {
        yield* Effect.sleep("1 second")
        yield* Ref.update(results, arr => [...arr, "task1"])

        yield* Effect.sleep("2 seconds")
        yield* Ref.update(results, arr => [...arr, "task2"])
      })

      const fiber = yield* Effect.fork(scheduledTask)

      // 1秒進める
      yield* testClock.adjust("1 second")
      const firstResult = yield* Ref.get(results)
      expect(firstResult).toEqual(["task1"])

      // さらに2秒進める
      yield* testClock.adjust("2 seconds")
      yield* Fiber.await(fiber)

      const finalResult = yield* Ref.get(results)
      expect(finalResult).toEqual(["task1", "task2"])
    }).pipe(
      Effect.provide(TestContext.TestContext)
    )
  )
})
```

## Pattern 3: Property-Based Testing

**使用場面**: 多くの入力パターンでの堅牢性テスト

**実装**:
```typescript
import { Gen } from "effect"

// ジェネレータの定義
const chunkCoordinateGen = Gen.struct({
  x: Gen.int({ min: -1000, max: 1000 }),
  z: Gen.int({ min: -1000, max: 1000 })
})

const blockGen = Gen.struct({
  position: Gen.struct({
    x: Gen.int({ min: 0, max: 15 }),
    y: Gen.int({ min: 0, max: 255 }),
    z: Gen.int({ min: 0, max: 15 })
  }),
  material: Gen.oneOf(
    Gen.constant("stone" as const),
    Gen.constant("dirt" as const),
    Gen.constant("grass" as const)
  ),
  metadata: Gen.struct({
    hardness: Gen.number({ min: 0, max: 10 }),
    luminance: Gen.int({ min: 0, max: 15 }),
    transparency: Gen.boolean
  })
})

const chunkGen = Gen.struct({
  coordinate: chunkCoordinateGen,
  blocks: Gen.array(blockGen, { minLength: 0, maxLength: 100 }),
  entities: Gen.array(Gen.string, { maxLength: 10 })
})

describe("Chunk Property Tests", () => {
  it.effect("chunk serialization should be reversible", () =>
    Effect.gen(function* () {
      yield* Gen.sample(chunkGen, { size: 100 }).pipe(
        Effect.flatMap(chunks =>
          Effect.all(
            chunks.map(chunk =>
              Effect.gen(function* () {
                // シリアライズ → デシリアライズ
                const serialized = JSON.stringify(chunk)
                const deserialized = JSON.parse(serialized)

                // 検証
                expect(deserialized.coordinate).toEqual(chunk.coordinate)
                expect(deserialized.blocks).toEqual(chunk.blocks)
                expect(deserialized.entities).toEqual(chunk.entities)
              })
            )
          )
        )
      )
    })
  )

  it.effect("chunk coordinate hashing should be consistent", () =>
    Effect.gen(function* () {
      yield* Gen.sample(chunkCoordinateGen, { size: 1000 }).pipe(
        Effect.flatMap(coordinates =>
          Effect.gen(function* () {
            const hashMap = new Map<string, ChunkCoordinate>()

            for (const coord of coordinates) {
              const hash = `${coord.x}_${coord.z}`
              const existing = hashMap.get(hash)

              if (existing) {
                expect(existing).toEqual(coord)
              } else {
                hashMap.set(hash, coord)
              }
            }

            // 同じ座標は同じハッシュを生成することを検証
            for (const coord of coordinates) {
              const hash1 = `${coord.x}_${coord.z}`
              const hash2 = `${coord.x}_${coord.z}`
              expect(hash1).toBe(hash2)
            }
          })
        )
      )
    })
  )
})
```

## Pattern 4: Integration Testing with Test Containers

**使用場面**: データベースや外部サービスとの統合テスト

**実装**:
```typescript
// テスト用データベースレイヤー
const TestDatabaseLive = Layer.scoped(
  DatabaseService,
  Effect.gen(function* () {
    // テスト用インメモリデータベース
    const db = yield* Effect.acquireRelease(
      Effect.sync(() => new Map<string, any>()),
      () => Effect.sync(() => console.log("Cleaning up test database"))
    )

    return {
      query: <T>(sql: string, params: unknown[] = []): Effect.Effect<T[]> =>
        Effect.gen(function* () {
          // モックSQLクエリ処理
          if (sql.includes("SELECT")) {
            const key = params[0] as string
            const result = db.get(key)
            return result ? [result] : []
          }
          return []
        }),

      execute: (sql: string, params: unknown[] = []): Effect.Effect<void> =>
        Effect.gen(function* () {
          if (sql.includes("INSERT")) {
            const [key, value] = params
            db.set(key as string, value)
          } else if (sql.includes("DELETE")) {
            const key = params[0] as string
            db.delete(key as string)
          }
        })
    }
  })
)

describe("Player Repository Integration", () => {
  it.effect("should persist player data correctly", () =>
    Effect.gen(function* () {
      const playerRepo = yield* PlayerRepository

      const testPlayer: Player = {
        id: "test-player-1",
        name: "TestPlayer",
        position: { x: 100, y: 64, z: -50 },
        health: 20,
        inventory: ["sword", "pickaxe", "bread"]
      }

      // プレイヤーを保存
      yield* playerRepo.save(testPlayer)

      // プレイヤーを読み込み
      const loadedPlayer = yield* playerRepo.findById("test-player-1")

      expect(Option.isSome(loadedPlayer)).toBe(true)
      if (Option.isSome(loadedPlayer)) {
        expect(loadedPlayer.value).toEqual(testPlayer)
      }

      // プレイヤーを削除
      yield* playerRepo.delete("test-player-1")

      // 削除の確認
      const deletedPlayer = yield* playerRepo.findById("test-player-1")
      expect(Option.isNone(deletedPlayer)).toBe(true)
    }).pipe(
      Effect.provide(PlayerRepositoryLive),
      Effect.provide(TestDatabaseLive)
    )
  )
})
```

## Pattern 5: Error Testing Patterns

**使用場面**: エラーハンドリングの詳細テスト

**実装**:
```typescript
describe("Error Handling", () => {
  it.effect("should handle network errors appropriately", () =>
    Effect.gen(function* () {
      // ネットワークエラーを模擬するモックサービス
      const FailingNetworkService = Layer.succeed(
        NetworkService,
        {
          fetch: (url: string) =>
            Effect.fail(new NetworkError({
              url,
              statusCode: 500,
              message: "Internal Server Error"
            }))
        }
      )

      const apiService = yield* ApiService

      const result = yield* apiService.fetchPlayerData("player-1").pipe(
        Effect.either,
        Effect.provide(FailingNetworkService)
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(NetworkError)
        expect(result.left.statusCode).toBe(500)
      }
    })
  )

  it.effect("should retry failed operations", () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0)

      // 3回目で成功するサービス
      const RetryableService = Layer.succeed(
        NetworkService,
        {
          fetch: (url: string) =>
            Effect.gen(function* () {
              const currentAttempts = yield* Ref.updateAndGet(attempts, n => n + 1)

              if (currentAttempts < 3) {
                return yield* Effect.fail(new NetworkError({
                  url,
                  statusCode: 503,
                  message: "Service Temporarily Unavailable"
                }))
              }

              return { data: "success" }
            })
        }
      )

      const apiService = yield* ApiService

      const result = yield* apiService.fetchPlayerDataWithRetry("player-1").pipe(
        Effect.provide(RetryableService)
      )

      expect(result.data).toBe("success")

      const finalAttempts = yield* Ref.get(attempts)
      expect(finalAttempts).toBe(3)
    })
  )
})
```

## Pattern 6: Concurrent Testing

**使用場面**: 並行処理の競合状態テスト

**実装**:
```typescript
describe("Concurrent Operations", () => {
  it.effect("should handle concurrent chunk loading safely", () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const loadCounts = yield* Ref.make(new Map<string, number>())

      // 同じチャンクを複数回同時に読み込み
      const coordinate = { x: 0, z: 0 }

      const trackingChunkService = {
        loadChunk: (coord: ChunkCoordinate) =>
          Effect.gen(function* () {
            const key = `${coord.x}_${coord.z}`
            yield* Ref.update(loadCounts, map =>
              new Map(map).set(key, (map.get(key) || 0) + 1)
            )

            // 実際のチャンク読み込み（キャッシュ機能付き）
            return yield* chunkService.loadChunk(coord)
          })
      }

      // 10個の並行リクエスト
      const requests = Array(10).fill(null).map(() =>
        trackingChunkService.loadChunk(coordinate)
      )

      const results = yield* Effect.all(requests, { concurrency: "unbounded" })

      // すべて同じチャンクデータを返すことを確認
      const firstResult = results[0]
      results.forEach(result => {
        expect(result).toEqual(firstResult)
      })

      // 実際の読み込み回数を確認（キャッシュが効いていれば1回のみ）
      const counts = yield* Ref.get(loadCounts)
      const loadCount = counts.get("0_0")
      expect(loadCount).toBe(1) // キャッシュが正常に動作している
    }).pipe(
      Effect.provide(ChunkServiceWithCacheLive)
    )
  )

  it.effect("should handle concurrent player actions without data races", () =>
    Effect.gen(function* () {
      const playerService = yield* PlayerService
      const playerId = "concurrent-test-player"

      // プレイヤーを初期化
      yield* playerService.createPlayer({
        id: playerId,
        name: "ConcurrentPlayer",
        position: { x: 0, y: 64, z: 0 },
        health: 20
      })

      // 複数の並行アクション
      const actions = [
        playerService.movePlayer(playerId, { x: 10, y: 64, z: 0 }),
        playerService.damagePlayer(playerId, 5),
        playerService.healPlayer(playerId, 3),
        playerService.movePlayer(playerId, { x: 20, y: 64, z: 10 }),
        playerService.damagePlayer(playerId, 2)
      ]

      yield* Effect.all(actions, { concurrency: "unbounded" })

      const finalPlayer = yield* playerService.getPlayer(playerId)

      expect(Option.isSome(finalPlayer)).toBe(true)
      if (Option.isSome(finalPlayer)) {
        const player = finalPlayer.value
        // 最終的な位置は最後の移動アクションの結果
        expect(player.position).toEqual({ x: 20, y: 64, z: 10 })
        // ヘルスは初期20 - 5 + 3 - 2 = 16
        expect(player.health).toBe(16)
      }
    }).pipe(
      Effect.provide(PlayerServiceLive),
      Effect.provide(TestDatabaseLive)
    )
  )
})
```

## Pattern 7: Test Utilities and Helpers

**使用場面**: テスト用のヘルパー関数とユーティリティ

**実装**:
```typescript
// テスト用ファクトリー関数
export const TestFactories = {
  createChunk: (overrides: Partial<Chunk> = {}): Chunk => ({
    coordinate: { x: 0, z: 0 },
    blocks: [],
    entities: [],
    lastModified: new Date(),
    ...overrides
  }),

  createPlayer: (overrides: Partial<Player> = {}): Player => ({
    id: `player-${Math.random().toString(36).substr(2, 9)}`,
    name: "TestPlayer",
    position: { x: 0, y: 64, z: 0 },
    health: 20,
    inventory: [],
    ...overrides
  }),

  createRandomCoordinate: (): ChunkCoordinate => ({
    x: Math.floor(Math.random() * 200) - 100,
    z: Math.floor(Math.random() * 200) - 100
  })
}

// テスト用アサーション
export const TestAssertions = {
  expectChunkEquals: (actual: Chunk, expected: Chunk) => {
    expect(actual.coordinate).toEqual(expected.coordinate)
    expect(actual.blocks).toEqual(expected.blocks)
    expect(actual.entities).toEqual(expected.entities)
  },

  expectPlayerEquals: (actual: Player, expected: Player) => {
    expect(actual.id).toBe(expected.id)
    expect(actual.name).toBe(expected.name)
    expect(actual.position).toEqual(expected.position)
    expect(actual.health).toBe(expected.health)
  },

  expectErrorOfType: <E extends Error>(
    result: Either.Either<unknown, E>,
    errorType: new (...args: any[]) => E
  ) => {
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(errorType)
    }
  }
}

// テスト用セットアップヘルパー
export const TestSetup = {
  withCleanDatabase: <R, E, A>(effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      // データベースクリーンアップ
      const db = yield* DatabaseService
      yield* db.execute("DELETE FROM players")
      yield* db.execute("DELETE FROM chunks")

      return yield* effect
    }),

  withTestPlayer: <R, E, A>(
    playerData: Partial<Player>,
    effect: (player: Player) => Effect.Effect<A, E, R>
  ) =>
    Effect.gen(function* () {
      const player = TestFactories.createPlayer(playerData)
      const playerService = yield* PlayerService

      yield* playerService.createPlayer(player)

      return yield* effect(player)
    }),

  withLoadedChunk: <R, E, A>(
    coordinate: ChunkCoordinate,
    effect: (chunk: Chunk) => Effect.Effect<A, E, R>
  ) =>
    Effect.gen(function* () {
      const chunk = TestFactories.createChunk({ coordinate })
      const chunkService = yield* ChunkService

      yield* chunkService.saveChunk(chunk)

      return yield* effect(chunk)
    })
}

// 使用例
describe("Test Utilities Example", () => {
  it.effect("should use test utilities effectively", () =>
    TestSetup.withCleanDatabase(
      TestSetup.withTestPlayer(
        { name: "UtilityTestPlayer", health: 15 },
        (player) =>
          TestSetup.withLoadedChunk(
            { x: 5, z: 10 },
            (chunk) =>
              Effect.gen(function* () {
                const playerService = yield* PlayerService

                // プレイヤーをチャンクに移動
                yield* playerService.movePlayer(
                  player.id,
                  { x: chunk.coordinate.x * 16, y: 64, z: chunk.coordinate.z * 16 }
                )

                const updatedPlayer = yield* playerService.getPlayer(player.id)

                expect(Option.isSome(updatedPlayer)).toBe(true)
                if (Option.isSome(updatedPlayer)) {
                  TestAssertions.expectPlayerEquals(
                    updatedPlayer.value,
                    { ...player, position: { x: 80, y: 64, z: 160 } }
                  )
                }
              })
          )
      )
    ).pipe(
      Effect.provide(PlayerServiceLive),
      Effect.provide(ChunkServiceLive),
      Effect.provide(TestDatabaseLive)
    )
  )
})
```

## Performance Testing

**使用場面**: パフォーマンス回帰の検出

**実装**:
```typescript
describe("Performance Tests", () => {
  it.effect("should load chunks within acceptable time limits", () =>
    Effect.gen(function* () {
      const testClock = yield* TestClock.TestClock
      const chunkService = yield* ChunkService

      const coordinates = Array(100).fill(null).map((_, i) => ({
        x: Math.floor(i / 10),
        z: i % 10
      }))

      const startTime = yield* Effect.sync(() => performance.now())

      yield* Effect.all(
        coordinates.map(coord => chunkService.loadChunk(coord)),
        { concurrency: 10 }
      )

      const endTime = yield* Effect.sync(() => performance.now())
      const duration = endTime - startTime

      // 100チャンクの読み込みが1秒以内に完了することを確認
      expect(duration).toBeLessThan(1000)
    }).pipe(
      Effect.provide(ChunkServiceLive),
      Effect.provide(TestContext.TestContext)
    )
  )
})
```