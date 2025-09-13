---
title: "02 Testing Guide"
description: "02 Testing Guideに関する詳細な説明とガイド。"
category: "guide"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'testing']
prerequisites: ['basic-typescript']
estimated_reading_time: "15分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# テスティングガイド

このドキュメントでは、最新のEffect-TSパターン（2024年版）を活用したts-minecraftプロジェクトでのテスト作成方法について説明します。Schema-basedバリデーション、Property-Based Testing、関数型テストパターンを中心に扱います。

## テスト環境

### 使用ツール

- **Vitest**: メインテストランナー
- **@effect/vitest**: Effect-TSとVitestの統合ライブラリ
- **@effect/test**: Effect-TSのテストユーティリティ
- **happy-dom**: DOMシミュレーション（ブラウザ環境でのテスト用）

### テスト設定

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',  // DOM APIが必要なテスト用
    globals: true,         // describe, it, expect をグローバルで使用
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
```

## 基本的なテスト構造

### Schema-basedテストパターン

```typescript
import { describe, it, expect } from 'vitest'
import { Effect, Exit, Schema } from 'effect'
import { Match } from "effect"

// テスト用のSchema定義（最新Effect-TS 2024パターン）
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number.pipe(Schema.between(0, 320)),
  z: Schema.Number
})

const TestPlayerSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("TestPlayerId"), Schema.nonEmpty()),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
  position: Position,
  health: Schema.Number.pipe(Schema.clamp(0, 100)),
  gameMode: Schema.Union(Schema.Literal("CREATIVE"), Schema.Literal("SURVIVAL"))
})

type TestPlayer = Schema.Schema.Type<typeof TestPlayerSchema>

// テストエラー定義（Schema-based）
const TestError = Schema.Struct({
  _tag: Schema.Literal("TestError"),
  message: Schema.String,
  context: Schema.optional(Schema.String),
  timestamp: Schema.DateTimeUtc
})

type TestError = Schema.Schema.Type<typeof TestError>

// 純粋関数でテストデータ生成
const createValidTestPlayer = (overrides: Partial<TestPlayer> = {}): TestPlayer => {
  const basePlayer: TestPlayer = {
    id: `player-${Date.now()}` as TestPlayer["id"],
    name: "TestPlayer",
    position: { x: 0, y: 64, z: 0 },
    health: 100,
    gameMode: "CREATIVE"
  }
  return { ...basePlayer, ...overrides }
}

// バリデーション用純粋関数（最新Effect-TS 2024パターン）
const validatePlayerData = (data: unknown): Effect.Effect<TestPlayer, TestError, never> =>
  Schema.decodeUnknownEither(TestPlayerSchema)(data).pipe(
    Effect.mapError(parseError => ({
      _tag: "TestError" as const,
      message: `Player validation failed: ${parseError.message}`,
      context: "validatePlayerData",
      timestamp: new Date().toISOString()
    }))
  )

// 早期リターンパターンでの検証
const isValidPlayerForTest = (player: TestPlayer): boolean => {
  if (!player.name || player.name.length === 0) return false
  if (player.health < 0 || player.health > 100) return false
  if (player.position.y < 0 || player.position.y > 320) return false
  return true
}

// サービス定義（Context.GenericTag最新パターン）
interface EntityServiceInterface {
  readonly create: (data: { name: string }) => Effect.Effect<{ id: string; name: string }, TestError>
  readonly update: (id: string, data: Partial<{ name: string }>) => Effect.Effect<void, TestError>
  readonly delete: (id: string) => Effect.Effect<void, TestError>
}

const EntityService = Context.GenericTag<EntityServiceInterface>("@app/EntityService")

// テスト用Layer（make関数パターン）
const makeEntityServiceTest = Effect.gen(function* () {
  return EntityService.of({
    create: (data) => Effect.gen(function* () {
      // 早期リターン: バリデーション
      if (!data.name || data.name.trim().length === 0) {
        return yield* Effect.fail({
          _tag: "TestError" as const,
          message: "Name is required",
          context: "EntityService.create",
          timestamp: new Date().toISOString()
        })
      }

      return {
        id: `entity-${Date.now()}`,
        name: data.name
      }
    }),

    update: (id, data) => Effect.gen(function* () {
      if (data.name && data.name.trim().length === 0) {
        return yield* Effect.fail({
          _tag: "TestError" as const,
          message: "Invalid name for update",
          context: "EntityService.update",
          timestamp: new Date().toISOString()
        })
      }
    }),

    delete: () => Effect.succeed(void 0)
  })
})

const EntityServiceTest = Layer.effect(EntityService, makeEntityServiceTest)

describe('EntityService with latest Effect-TS patterns', () => {
  it('should validate player data with early return pattern', async () => {
    const validPlayer = createValidTestPlayer()

    // 早期リターン: データ検証
    if (!isValidPlayerForTest(validPlayer)) {
      throw new Error("Test setup failed: invalid player data")
    }

    const program = Effect.gen(function* () => {
      const service = yield* EntityService
      const entity = yield* service.create({ name: validPlayer.name })
      return entity
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(EntityServiceTest))
    )

    expect(result.name).toBe(validPlayer.name)
    expect(result.id).toBeDefined()
    expect(result.id).toMatch(/^entity-\d+$/)
  })

  it('should handle validation errors with Schema-based error handling', async () => {
    const program = Effect.gen(function* () => {
      const service = yield* EntityService
      return yield* service.create({ name: "" }) // 無効な名前
    })

    const exit = await Effect.runPromiseExit(
      program.pipe(Effect.provide(EntityServiceTest))
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
      const error = exit.cause.error as TestError
      expect(error._tag).toBe('TestError')
      expect(error.message).toBe('Name is required')
      expect(error.context).toBe('EntityService.create')
      expect(error.timestamp).toBeDefined()
    }
  })

  it('should validate player schema with proper error details', async () => {
    const invalidPlayerData = {
      id: "", // 無効なID
      name: "ValidName",
      position: { x: 0, y: -10, z: 0 }, // 無効なY座標
      health: 150, // 無効なヘルス
      gameMode: "INVALID_MODE" // 無効なゲームモード
    }

    const exit = await Effect.runPromiseExit(
      validatePlayerData(invalidPlayerData)
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })
})
```

### テストユーティリティ関数

```typescript
// テスト実行のヘルパー関数
const runServiceTest = <A, E>(effect: Effect.Effect<A, E, ServiceType>) =>
  Effect.runPromise(effect.pipe(Effect.provide(ServiceTestLayer)))

const runServiceTestExit = <A, E>(effect: Effect.Effect<A, E, ServiceType>) =>
  Effect.runPromiseExit(effect.pipe(Effect.provide(ServiceTestLayer)))

// 使用例
describe('ServiceTests', () => {
  it('should process data correctly', async () => {
    const result = await runServiceTest(
      Effect.gen(function* () {
        const service = yield* ServiceType
        return yield* service.processData(testData)
      })
    )
    
    expect(result).toEqual(expectedResult)
  })
})
```

## Layerとモックの作成

### テスト用Layer（最新Effect-TS 2024パターン）

```typescript
import { Layer, Effect, Context, Schema } from 'effect'

// データベースエンティティSchema
const DatabaseEntity = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("EntityId")),
  name: Schema.String.pipe(Schema.nonEmpty()),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc
})

type DatabaseEntity = Schema.Schema.Type<typeof DatabaseEntity>

// データベースエラーSchema
const DatabaseError = Schema.Struct({
  _tag: Schema.Literal("DatabaseError"),
  message: Schema.String,
  operation: Schema.String,
  entityId: Schema.optional(Schema.String),
  timestamp: Schema.DateTimeUtc
})

type DatabaseError = Schema.Schema.Type<typeof DatabaseError>

// データベースサービスインターフェース
interface DatabaseService {
  readonly find: (id: string) => Effect.Effect<DatabaseEntity, DatabaseError, never>
  readonly save: (entity: Omit<DatabaseEntity, 'id' | 'createdAt' | 'updatedAt'>) => Effect.Effect<DatabaseEntity, DatabaseError, never>
  readonly delete: (id: string) => Effect.Effect<void, DatabaseError, never>
}

const DatabaseService = Context.GenericTag<DatabaseService>("@app/DatabaseService")

// 純粋関数でモックエンティティ作成
const createMockEntity = (id: string, overrides: Partial<DatabaseEntity> = {}): DatabaseEntity => {
  const now = new Date().toISOString()
  return {
    id: id as DatabaseEntity["id"],
    name: `Mock Entity ${id}`,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

// プロダクション用Layer（make関数パターン）
const makeDatabaseServiceLive = Effect.gen(function* () {
  return DatabaseService.of({
    find: (id) => Effect.gen(function* () {
      // 実際のDB処理のシミュレーション
      yield* Effect.log(`Finding entity with id: ${id}`)
      return createMockEntity(id)
    }),

    save: (entity) => Effect.gen(function* () {
      yield* Effect.log(`Saving entity: ${entity.name}`)
      const saved = createMockEntity(
        `saved-${Date.now()}`,
        entity
      )
      return saved
    }),

    delete: () => Effect.gen(function* () {
      yield* Effect.log("Entity deleted successfully")
    })
  })
})

const DatabaseServiceLive = Layer.effect(DatabaseService, makeDatabaseServiceLive)

// テスト用Layer（エラーケースも含む）
const makeDatabaseServiceTest = Effect.gen(function* () {
  return DatabaseService.of({
    find: (id) => Effect.gen(function* () {
      // 早期リターン: 無効なIDチェック
      if (!id || id.trim().length === 0) {
        return yield* Effect.fail({
          _tag: "DatabaseError" as const,
          message: "Invalid entity ID",
          operation: "find",
          entityId: id,
          timestamp: new Date().toISOString()
        })
      }

      return createMockEntity(id)
    }),

    save: (entity) => Effect.gen(function* () {
      // 早期リターン: 必須フィールドチェック
      if (!entity.name || entity.name.trim().length === 0) {
        return yield* Effect.fail({
          _tag: "DatabaseError" as const,
          message: "Entity name is required",
          operation: "save",
          timestamp: new Date().toISOString()
        })
      }

      const saved = createMockEntity(`test-${Date.now()}`, entity)
      return saved
    }),

    delete: (id) => Effect.gen(function* () {
      if (id === 'protected-entity') {
        return yield* Effect.fail({
          _tag: "DatabaseError" as const,
          message: "Cannot delete protected entity",
          operation: "delete",
          entityId: id,
          timestamp: new Date().toISOString()
        })
      }
    })
  })
})

const DatabaseServiceTest = Layer.effect(DatabaseService, makeDatabaseServiceTest)

// 環境サービスSchema
const EnvironmentMode = Schema.Union(
  Schema.Literal("development"),
  Schema.Literal("production"),
  Schema.Literal("test")
)

type EnvironmentMode = Schema.Schema.Type<typeof EnvironmentMode>

interface EnvironmentService {
  readonly getMode: Effect.Effect<EnvironmentMode, never, never>
  readonly isDevelopment: Effect.Effect<boolean, never, never>
  readonly isProduction: Effect.Effect<boolean, never, never>
  readonly isTest: Effect.Effect<boolean, never, never>
}

const EnvironmentService = Context.GenericTag<EnvironmentService>("@app/EnvironmentService")

// 純粋関数でモック環境サービス作成
const createMockEnvironmentService = (mode: EnvironmentMode = 'test') => {
  const makeEnvironmentService = Effect.gen(function* () {
    return EnvironmentService.of({
      getMode: Effect.succeed(mode),
      isDevelopment: Effect.succeed(mode === 'development'),
      isProduction: Effect.succeed(mode === 'production'),
      isTest: Effect.succeed(mode === 'test')
    })
  })

  return Layer.effect(EnvironmentService, makeEnvironmentService)
}
```

### 動的モック作成

```typescript
import { vi } from 'vitest'

const createMockRenderService = (customBehavior: Partial<RenderServiceInterface> = {}) => {
  const makeMockRenderService = Effect.gen(function* () {
    const defaultService: RenderServiceInterface = {
      render: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      resize: vi.fn().mockResolvedValue(undefined)
    }

    return RenderService.of({
      ...defaultService,
      ...customBehavior // カスタムな振る舞いを上書き
    })
  })

  return Layer.effect(RenderService, makeMockRenderService)
}

// 使用例
it('should call render method', async () => {
  const mockRender = vi.fn().mockResolvedValue(undefined)
  const mockLayer = createMockRenderService({ render: mockRender })
  
  await runTest(
    Effect.gen(function* () {
      const render = yield* RenderService
      yield* render.render(sceneData)
    }).pipe(Effect.provide(mockLayer))
  )
  
  expect(mockRender).toHaveBeenCalledWith(sceneData)
})
```

## Effect-TSテストパターン

### エラーハンドリングのテスト

```typescript
describe('Error Handling', () => {
  it('should catch and transform errors', async () => {
    const program = Effect.gen(function* () {
      const service = yield* RiskyService
      return yield* service.riskyOperation().pipe(
        Effect.catchTag("NetworkError", (error) =>
          Effect.succeed("fallback-result")
        )
      )
    })
    
    // ネットワークエラーを発生させるモック
    const mockRiskyService = Effect.gen(function* () {
      return RiskyService.of({
        riskyOperation: () => Effect.fail(new NetworkError("Connection failed"))
      })
    })

    const mockService = Layer.effect(RiskyService, mockRiskyService)
    
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(mockService))
    )
    
    expect(result).toBe("fallback-result")
  })

  it('should propagate unhandled errors', async () => {
    const program = Effect.gen(function* () {
      const service = yield* RiskyService
      return yield* service.riskyOperation()
    })
    
    const mockRiskyService = Effect.gen(function* () {
      return RiskyService.of({
        riskyOperation: () => Effect.fail(new UnexpectedError("Critical failure"))
      })
    })

    const mockService = Layer.effect(RiskyService, mockRiskyService)
    
    const exit = await Effect.runPromiseExit(
      program.pipe(Effect.provide(mockService))
    )
    
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit) && exit.cause._tag === 'Fail') {
      expect(exit.cause.error).toBeInstanceOf(UnexpectedError)
    }
  })
})
```

### 並行処理のテスト

```typescript
describe('Concurrent Operations', () => {
  it('should handle parallel processing correctly', async () => {
    const program = Effect.gen(function* () {
      const service = yield* ProcessingService
      
      // 並列処理の実行
      const results = yield* Effect.allPar([
        service.processItem("item1"),
        service.processItem("item2"),
        service.processItem("item3"),
      ])
      
      return results
    })
    
    const mockProcessingService = Effect.gen(function* () {
      return ProcessingService.of({
        processItem: (item) => Effect.succeed(`processed-${item}`)
      })
    })

    const mockService = Layer.effect(ProcessingService, mockProcessingService)
    
    const results = await Effect.runPromise(
      program.pipe(Effect.provide(mockService))
    )
    
    expect(results).toEqual([
      "processed-item1",
      "processed-item2", 
      "processed-item3"
    ])
  })

  it('should handle racing operations', async () => {
    const program = Effect.gen(function* () {
      const service = yield* AsyncService
      
      return yield* Effect.race(
        service.slowOperation(),
        service.fastOperation()
      )
    })
    
    const mockAsyncService = Effect.gen(function* () {
      return AsyncService.of({
        slowOperation: () => Effect.delay(Effect.succeed("slow"), "100 millis"),
        fastOperation: () => Effect.succeed("fast")
      })
    })

    const mockService = Layer.effect(AsyncService, mockAsyncService)
    
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(mockService))
    )
    
    expect(result).toBe("fast") // 早い方が返される
  })
})
```

### タイムアウトとリトライのテスト

```typescript
describe('Timeout and Retry', () => {
  it('should timeout after specified duration', async () => {
    const program = Effect.gen(function* () {
      const service = yield* SlowService
      return yield* service.slowOperation().pipe(
        Effect.timeout("50 millis")
      )
    })
    
    const mockSlowService = Effect.gen(function* () {
      return SlowService.of({
        slowOperation: () => Effect.delay(Effect.succeed("result"), "100 millis")
      })
    })

    const mockService = Layer.effect(SlowService, mockSlowService)
    
    const exit = await Effect.runPromiseExit(
      program.pipe(Effect.provide(mockService))
    )
    
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('should retry on failure', async () => {
    let attempts = 0
    const program = Effect.gen(function* () {
      const service = yield* UnreliableService
      return yield* service.unreliableOperation().pipe(
        Effect.retry(Schedule.recurs(2)) // 最大3回試行
      )
    })
    
    const mockUnreliableService = Effect.gen(function* () {
      return UnreliableService.of({
        unreliableOperation: () => {
          attempts++
          if (attempts < 3) {
            return Effect.fail(new TransientError("Temporary failure"))
          }
          return Effect.succeed("success")
        }
      })
    })

    const mockService = Layer.effect(UnreliableService, mockUnreliableService)
    
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(mockService))
    )
    
    expect(result).toBe("success")
    expect(attempts).toBe(3)
  })
})
```

## Property-Based Testing

### fast-checkを使ったPBT（最新Effect-TS 2024対応）

```typescript
import * as fc from 'fast-check'
import { Effect, pipe } from 'effect'

describe('Position Value Object Properties', () => {
  // Arbitraryジェネレータの定義
  const positionArbitrary = fc.record({
    x: fc.float({ min: -1000, max: 1000, noNaN: true }),
    y: fc.float({ min: 0, max: 256, noNaN: true }),
    z: fc.float({ min: -1000, max: 1000, noNaN: true })
  })

  it('distance calculation should be commutative', () => {
    fc.assert(
      fc.property(
        positionArbitrary,
        positionArbitrary,
        (pos1, pos2) => {
          const dist1 = calculateDistance(pos1, pos2)
          const dist2 = calculateDistance(pos2, pos1)
          expect(dist1).toBeCloseTo(dist2, 5) // 浮動小数点誤差を考慮
        }
      ),
      { seed: 42, numRuns: 1000 } // 固定シードで決定的なテスト
    )
  })

  it('moving and moving back should return to original position', () => {
    fc.assert(
      fc.property(
        positionArbitrary,
        fc.record({
          x: fc.float({ min: -100, max: 100 }),
          y: fc.float({ min: -50, max: 50 }),
          z: fc.float({ min: -100, max: 100 })
        }),
        (originalPos, offset) => {
          const moved = movePosition(originalPos, offset)
          const movedBack = movePosition(moved, negatePosition(offset))

          expect(movedBack.x).toBeCloseTo(originalPos.x, 5)
          expect(movedBack.y).toBeCloseTo(originalPos.y, 5)
          expect(movedBack.z).toBeCloseTo(originalPos.z, 5)
        }
      ),
      { seed: 123, numRuns: 500 }
    )
  })

  it('distance is always non-negative and satisfies triangle inequality', () => {
    fc.assert(
      fc.property(
        positionArbitrary,
        positionArbitrary,
        positionArbitrary,
        (pos1, pos2, pos3) => {
          const dist12 = calculateDistance(pos1, pos2)
          const dist23 = calculateDistance(pos2, pos3)
          const dist13 = calculateDistance(pos1, pos3)

          // 距離は常に非負
          expect(dist12).toBeGreaterThanOrEqual(0)
          expect(dist23).toBeGreaterThanOrEqual(0)
          expect(dist13).toBeGreaterThanOrEqual(0)

          // 三角不等式
          expect(dist13).toBeLessThanOrEqual(dist12 + dist23 + 0.001) // 浮動小数点誤差許容
        }
      ),
      { seed: 456, numRuns: 200 }
    )
  })
})
```

### カスタムArbitraryジェネレータ（fast-check）

```typescript
// エンティティのArbitrary
const entityArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 36 }).map(s => `entity-${s}`),
  position: fc.record({
    x: fc.float({ min: -30000000, max: 30000000 }),
    y: fc.float({ min: 0, max: 256 }),
    z: fc.float({ min: -30000000, max: 30000000 })
  }),
  velocity: fc.record({
    x: fc.float({ min: -10, max: 10 }),
    y: fc.float({ min: -10, max: 10 }),
    z: fc.float({ min: -10, max: 10 })
  }),
  health: fc.integer({ min: 0, max: 100 }),
  entityType: fc.oneof(
    fc.constant('player'),
    fc.constant('zombie'),
    fc.constant('skeleton'),
    fc.constant('creeper')
  )
})

// チャンクのArbitrary（Minecraft仕様準拠）
const chunkArbitrary = fc.record({
  coordinate: fc.record({
    x: fc.integer({ min: -100, max: 100 }),
    z: fc.integer({ min: -100, max: 100 })
  }),
  blocks: fc.array(
    fc.integer({ min: 0, max: 255 }),
    { minLength: 16 * 16 * 256, maxLength: 16 * 16 * 256 } // 16x16x256ブロック
  ),
  biome: fc.oneof(
    fc.constant('plains'),
    fc.constant('forest'),
    fc.constant('desert'),
    fc.constant('mountains')
  ),
  lastModified: fc.integer({ min: 0, max: Date.now() })
})

// ブロックタイプのArbitrary
const blockTypeArbitrary = fc.oneof(
  fc.constant('air'),
  fc.constant('stone'),
  fc.constant('dirt'),
  fc.constant('grass'),
  fc.constant('wood'),
  fc.constant('water'),
  fc.constant('lava')
)

// 複雑なゲーム状態のArbitrary
const gameStateArbitrary = fc.record({
  players: fc.array(entityArbitrary, { maxLength: 4 }),
  chunks: fc.array(chunkArbitrary, { maxLength: 9 }), // 3x3チャンク
  timeOfDay: fc.integer({ min: 0, max: 24000 }), // Minecraftの時間サイクル
  weather: fc.oneof(
    fc.constant('clear'),
    fc.constant('rain'),
    fc.constant('storm')
  ),
  difficulty: fc.oneof(
    fc.constant('peaceful'),
    fc.constant('easy'),
    fc.constant('normal'),
    fc.constant('hard')
  )
})
```

## 統合テスト

### レイヤー全体の統合テスト

```typescript
describe('Full Application Integration', () => {
  // テスト用の完全なLayer
  const TestApplicationLayer = Layer.mergeAll(
    ConfigServiceTest,
    DatabaseServiceTest,
    RenderServiceTest,
    PhysicsEngineTest,
    InputServiceTest,
  )

  it('should handle complete game tick cycle', async () => {
    const program = Effect.gen(function* () {
      const game = yield* GameService
      const world = yield* WorldService
      
      // ゲームティックの実行
      yield* game.tick(16) // 16ms = ~60fps
      
      // 状態の確認
      const playerState = yield* world.getPlayerState()
      const worldState = yield* world.getWorldState()
      
      return { playerState, worldState }
    })
    
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestApplicationLayer))
    )
    
    expect(result.playerState).toBeDefined()
    expect(result.worldState).toBeDefined()
  })
})
```

### Worker統合テスト

```typescript
describe('Worker Integration', () => {
  it('should process mesh generation through worker', async () => {
    const program = Effect.gen(function* () {
      const workerManager = yield* WorkerManager
      const chunkData = createTestChunkData()
      
      // Worker経由でメッシュ生成
      const meshData = yield* workerManager.generateMesh(chunkData)
      
      return meshData
    })
    
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(WorkerManagerTest))
    )
    
    expect(result.vertices).toBeDefined()
    expect(result.indices).toBeDefined()
    expect(result.vertices.length).toBeGreaterThan(0)
  })
})
```

## スナップショットテスト

### 設定オブジェクトのスナップショット

```typescript
describe('Configuration Snapshots', () => {
  it('should match development config snapshot', async () => {
    const config = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ConfigService
        return yield* service.getDevelopmentConfig()
      }).pipe(Effect.provide(ConfigServiceTest))
    )
    
    expect(config).toMatchSnapshot()
  })

  it('should match production config snapshot', async () => {
    const config = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ConfigService
        return yield* service.getProductionConfig()
      }).pipe(Effect.provide(ConfigServiceTest))
    )
    
    expect(config).toMatchSnapshot()
  })
})
```

## パフォーマンステスト

### 実行時間の測定

```typescript
describe('Performance Tests', () => {
  it('should generate mesh within acceptable time', async () => {
    const start = performance.now()
    
    await Effect.runPromise(
      Effect.gen(function* () {
        const generator = yield* MeshGenerator
        const largeChunk = createLargeTestChunk(64, 64, 64)
        return yield* generator.generateMesh(largeChunk)
      }).pipe(Effect.provide(MeshGeneratorTest))
    )
    
    const duration = performance.now() - start
    expect(duration).toBeLessThan(100) // 100ms以内
  })

  it('should handle concurrent chunk loading efficiently', async () => {
    const chunkCount = 25 // 5x5 のチャンク
    const chunks = Array.from({ length: chunkCount }, (_, i) => 
      createTestChunk(i % 5, Math.floor(i / 5))
    )
    
    const start = performance.now()
    
    await Effect.runPromise(
      Effect.allPar(
        chunks.map(chunk => 
          Effect.gen(function* () {
            const loader = yield* ChunkLoader
            return yield* loader.loadChunk(chunk.coordinate)
          })
        )
      ).pipe(Effect.provide(ChunkLoaderTest))
    )
    
    const duration = performance.now() - start
    expect(duration).toBeLessThan(500) // 500ms以内で25チャンク
  })
})
```

## テスト実行

### npm scriptでのテスト実行

```bash
# 全テスト実行
pnpm test

# レイヤー別テスト
pnpm test:shared           # 共通機能
pnpm test:infrastructure   # インフラレイヤー
pnpm test:presentation     # プレゼンテーションレイヤー

# カバレッジ付きテスト
pnpm test:coverage

# 特定のファイルのテスト
pnpm test src/domain/entities/entity.test.ts

# ウォッチモード
pnpm test --watch

# UIモード
pnpm test --ui
```

### CI/CDでのテスト

```yaml
# GitHub Actions設定例
- name: Run Tests
  run: |
    pnpm test:all
    pnpm test:coverage
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

## ベストプラクティス

### テスト作成時の注意点

1. **Effect-TSパターンの一貫使用**
   - `Effect.gen` を使った関数型スタイル
   - 適切なエラーハンドリング
   - Layerを使った依存性注入

2. **テストの独立性**
   - 各テストは他のテストに依存しない
   - モックデータの適切な初期化
   - 状態の完全なリセット

3. **命名規則**
   - `should + 期待される動作` 形式
   - 日本語コメントでのテスト意図明記
   - グループ化による構造化

4. **パフォーマンス考慮**
   - 重いテストは専用のスイートに分離
   - 並列実行の活用
   - 適切なタイムアウト設定

このガイドに従うことで、堅牢で保守しやすいテストスイートを構築できます。