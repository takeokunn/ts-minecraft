# テスティングガイド

このドキュメントでは、ts-minecraftプロジェクトでのテスト作成方法とEffect-TSを使ったテストパターンについて説明します。

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

### Effect-TSでの単体テスト

```typescript
import { describe, it, expect } from 'vitest'
import { Effect, Exit } from 'effect'

describe('EntityService', () => {
  it('should create entity successfully', async () => {
    const program = Effect.gen(function* () {
      const service = yield* EntityService
      const entity = yield* service.create({ name: "test" })
      return entity
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(EntityServiceTest))
    )

    expect(result.name).toBe("test")
    expect(result.id).toBeDefined()
  })

  it('should handle errors properly', async () => {
    const program = Effect.gen(function* () {
      const service = yield* EntityService
      return yield* service.create({ name: "" }) // 無効な名前
    })

    const exit = await Effect.runPromiseExit(
      program.pipe(Effect.provide(EntityServiceTest))
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(exit.cause._tag).toBe('Fail')
    }
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

### テスト用Layer

```typescript
import { Layer } from 'effect'

// プロダクション用Layer
const DatabaseServiceLive = Layer.succeed(DatabaseService, {
  find: (id) => Effect.succeed(/* 実際のDB処理 */),
  save: (entity) => Effect.succeed(/* 実際のDB処理 */),
})

// テスト用Layer
const DatabaseServiceTest = Layer.succeed(DatabaseService, {
  find: (id) => Effect.succeed(createMockEntity(id)),
  save: (entity) => Effect.succeed(void 0),
})

// モック環境サービス
const createMockEnvironmentService = (mode: string = 'test') =>
  Layer.succeed(EnvironmentService, {
    getMode: Effect.succeed(mode),
    isDevelopment: Effect.succeed(mode === 'development'),
    isProduction: Effect.succeed(mode === 'production'),
    isTest: Effect.succeed(mode === 'test'),
  })
```

### 動的モック作成

```typescript
import { vi } from 'vitest'

const createMockRenderService = (customBehavior: Partial<RenderService> = {}) => {
  const mockService: RenderService = {
    render: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn().mockResolvedValue(undefined),
    ...customBehavior, // カスタムな振る舞いを上書き
  }
  
  return Layer.succeed(RenderService, mockService)
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
    const mockService = Layer.succeed(RiskyService, {
      riskyOperation: () => Effect.fail(new NetworkError("Connection failed"))
    })
    
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
    
    const mockService = Layer.succeed(RiskyService, {
      riskyOperation: () => Effect.fail(new UnexpectedError("Critical failure"))
    })
    
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
    
    const mockService = Layer.succeed(ProcessingService, {
      processItem: (item) => Effect.succeed(`processed-${item}`)
    })
    
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
    
    const mockService = Layer.succeed(AsyncService, {
      slowOperation: () => Effect.delay(Effect.succeed("slow"), "100 millis"),
      fastOperation: () => Effect.succeed("fast"),
    })
    
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
    
    const mockService = Layer.succeed(SlowService, {
      slowOperation: () => Effect.delay(Effect.succeed("result"), "100 millis")
    })
    
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
    
    const mockService = Layer.succeed(UnreliableService, {
      unreliableOperation: () => {
        attempts++
        if (attempts < 3) {
          return Effect.fail(new TransientError("Temporary failure"))
        }
        return Effect.succeed("success")
      }
    })
    
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(mockService))
    )
    
    expect(result).toBe("success")
    expect(attempts).toBe(3)
  })
})
```

## Property-Based Testing

### @effect/testを使ったPBT

```typescript
import { Gen } from "@effect/test"

describe('Position Value Object Properties', () => {
  const positionGen = Gen.struct({
    x: Gen.number,
    y: Gen.number,
    z: Gen.number,
  })
  
  it('distance calculation should be commutative', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Gen.sample(positionGen, 100).pipe(
          Effect.forEach((pos1) =>
            Gen.sample(positionGen, 10).pipe(
              Effect.forEach((pos2) => {
                const dist1 = calculateDistance(pos1, pos2)
                const dist2 = calculateDistance(pos2, pos1)
                expect(dist1).toBeCloseTo(dist2)
                return Effect.succeed(void 0)
              })
            )
          )
        )
      })
    )
  })

  it('moving and moving back should return to original position', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Gen.sample(positionGen, 50).pipe(
          Effect.forEach((originalPos) =>
            Gen.sample(positionGen, 10).pipe(
              Effect.forEach((offset) => {
                const moved = movePosition(originalPos, offset)
                const movedBack = movePosition(moved, negatePosition(offset))
                
                expect(movedBack.x).toBeCloseTo(originalPos.x)
                expect(movedBack.y).toBeCloseTo(originalPos.y)  
                expect(movedBack.z).toBeCloseTo(originalPos.z)
                
                return Effect.succeed(void 0)
              })
            )
          )
        )
      })
    )
  })
})
```

### カスタムジェネレータ

```typescript
// エンティティのジェネレータ
const entityGen = Gen.struct({
  id: Gen.string,
  position: Gen.struct({
    x: Gen.number,
    y: Gen.number,
    z: Gen.number,
  }),
  velocity: Gen.struct({
    x: Gen.number.pipe(Gen.between(-10, 10)),
    y: Gen.number.pipe(Gen.between(-10, 10)),
    z: Gen.number.pipe(Gen.between(-10, 10)),
  }),
  health: Gen.number.pipe(Gen.between(0, 100)),
})

// チャンクのジェネレータ
const chunkGen = Gen.struct({
  coordinate: Gen.struct({
    x: Gen.int.pipe(Gen.between(-100, 100)),
    z: Gen.int.pipe(Gen.between(-100, 100)),
  }),
  blocks: Gen.array(Gen.int.pipe(Gen.between(0, 255)), { minLength: 4096, maxLength: 4096 })
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