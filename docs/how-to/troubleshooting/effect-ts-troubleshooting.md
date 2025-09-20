---
title: 'Effect-TS 3.17+ トラブルシューティング完全ガイド - 最新パターン対応'
description: 'Effect-TS 3.17+ 最新版における30のエラーパターンと実践的解決策。Schema.Struct、Context.GenericTag、Match.value、早期リターン、Property-Based Testing統合エラー対応。'
category: 'troubleshooting'
difficulty: 'advanced'
tags:
  [
    'troubleshooting',
    'effect-ts',
    'debugging',
    'error-handling',
    'performance',
    'schema',
    'context',
    'schema-struct',
    'context-generic-tag',
    'match-patterns',
    'early-return',
    'property-based-testing',
  ]
prerequisites: ['effect-ts-fundamentals', 'schema-patterns', 'context-patterns', 'testing-patterns']
estimated_reading_time: '50分'
related_patterns: ['error-handling-patterns', 'service-patterns', 'testing-patterns', 'optimization-patterns']
related_docs:
  ['./debugging-guide.md', './common-errors.md', './error-resolution.md', '../testing/effect-ts-testing-patterns.md']
status: 'complete'
---

# Effect-TS トラブルシューティング

> **Effect-TS 3.17+完全対応**: TypeScript Minecraft プロジェクトにおける25のEffect-TS特有エラーパターンと段階的解決戦略

Effect-TS 3.17+の最新APIを使用したTypeScript Minecraftプロジェクトにおける包括的なトラブルシューティングガイドです。Schema.Struct、Context.GenericTag、Match.valueなどの新機能特有の問題と、実践的な解決方法を詳細に解説します。

## 🔍 エラー検索システム

### 症状別クイック検索

#### Effect-TS インポートエラー

**検索タグ**: `effect-ts` + `import` + `module-resolution`

```bash
# 典型的エラーメッセージ
"Cannot find module 'effect'"
"Cannot find module '@effect/schema'"
"Module not found: Can't resolve '@effect/platform'"
```

#### Schema バリデーションエラー

**検索タグ**: `schema` + `validation` + `decode`

```bash
# 典型的エラーメッセージ
"ParseError: Missing property"
"Expected string, received number"
"Schema.Struct is not a function"
```

#### Context 依存関係エラー

**検索タグ**: `context` + `dependency-injection` + `layer`

```bash
# 典型的エラーメッセージ
"Context not found"
"Layer composition error"
"Service tag mismatch"
```

#### Match パターンエラー

**検索タグ**: `match` + `pattern-matching` + `type-narrowing`

```bash
# 典型的エラーメッセージ
"Match.value is not a function"
"Exhaustive pattern matching failed"
"Type narrowing unsuccessful"
```

### エラー発生パターン予測

| エラータイプ  | 発生確率 | 典型的トリガー     | 解決時間 |
| ------------- | -------- | ------------------ | -------- |
| Import/Module | 85%      | バージョン更新時   | 2-5分    |
| Schema設定    | 70%      | 新規データ型作成時 | 5-15分   |
| Context管理   | 45%      | サービス追加時     | 10-30分  |
| Match構文     | 25%      | 複雑な分岐処理     | 15-45分  |

## Effect-TS 3.17+ 特有エラーパターン

### Schema.Struct 関連エラー（10パターン）

#### 1. Schema.Struct 未定義エラー

##### 症状

```bash
TS2339: Property 'Struct' does not exist on type 'typeof Schema'.
TS2339: Property 'object' does not exist on type 'typeof Schema'.
```

##### 原因

- Effect-TS 3.16以前からの移行時に発生
- 古い`Schema.object`の使用継続
- インポートパスの問題

##### 段階的解決手順

1. **バージョン確認**

   ```bash
   # 現在のEffect-TSバージョン確認
   pnpm list effect @effect/schema

   # 3.17+であることを確認
   effect@3.17.13
   @effect/schema@0.75.5
   ```

2. **インポート修正**

   ```typescript
   // ❌ 古い書き方
   import { Schema } from '@effect/schema'
   const PlayerSchema = Schema.object({
     id: Schema.string,
     position: Schema.object({
       x: Schema.number,
       y: Schema.number,
       z: Schema.number,
     }),
   })

   // ✅ 正しい書き方（3.17+）
   import { Schema } from '@effect/schema'
   const PlayerSchema = Schema.Struct({
     id: Schema.String,
     position: Schema.Struct({
       x: Schema.Number,
       y: Schema.Number,
       z: Schema.Number,
     }),
   })
   ```

3. **型定義の確認**

   ```typescript
   // 型定義の生成確認
   type Player = Schema.Schema.Type<typeof PlayerSchema>

   // 実行時バリデーション
   const validatePlayer = Schema.decodeUnknownSync(PlayerSchema)
   ```

#### 2. Schema.TaggedError の実装エラー

##### 症状

```bash
TS2345: Argument of type '{ _tag: string; message: string; }' is not assignable to parameter of type 'never'.
```

##### 段階的解決手順

1. **TaggedErrorクラスの定義**

   ```typescript
   // ✅ 正しいTaggedError実装 - 関数型パターン
   export const PlayerNotFoundError = Schema.TaggedError('PlayerNotFoundError')({
     playerId: Schema.String,
     timestamp: Schema.optional(Schema.Number),
   })

   export const ChunkLoadError = Schema.TaggedError('ChunkLoadError')({
     coordinate: Schema.Struct({
       x: Schema.Number,
       z: Schema.Number,
     }),
     reason: Schema.String,
   })
   ```

2. **Error使用パターン**

   ```typescript
   // Effect内でのエラー使用
   const loadPlayer = (id: string): Effect.Effect<Player, PlayerNotFoundError> =>
     Effect.gen(function* () {
       const players = yield* getStoredPlayers
       const player = players.find((p) => p.id === id)

       if (!player) {
         return yield* Effect.fail(new PlayerNotFoundError({ playerId: id, timestamp: Date.now() }))
       }

       return player
     })
   ```

#### 3. Schema.Brand 型エラー

##### 症状

```bash
TS2322: Type 'string' is not assignable to type 'PlayerId'.
TS2345: Argument of type 'PlayerId' is not assignable to parameter of type 'string'.
```

##### 解決方法

```typescript
// ブランド型の正しい定義
export interface PlayerId extends Schema.Brand<string, 'PlayerId'> {}
export const PlayerId = Schema.String.pipe(Schema.brand('PlayerId'))

// 使用例
const createPlayerId = (value: string): Effect.Effect<PlayerId, ParseResult.ParseError> =>
  Schema.decodeUnknown(PlayerId)(value)

// 実際の使用
const processPlayer = Effect.gen(function* () {
  const playerId = yield* createPlayerId('player-123')
  const player = yield* loadPlayer(playerId)
  return player
})
```

### Context.GenericTag 関連エラー（8パターン）

#### 4. Context.Tag 廃止エラー

##### 症状

```bash
TS2339: Property 'Tag' does not exist on type 'typeof Context'.
```

##### 解決手順

```typescript
// ❌ 古い書き方
const WorldService = Context.Tag<WorldService>()

// ✅ 新しい書き方（3.17+）
export interface WorldService {
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Chunk, ChunkError>
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, ChunkError>
}

export const WorldService = Context.GenericTag<WorldService>('@minecraft/WorldService')
```

#### 5. Layer提供エラー

##### 症状

```bash
MissingService: Service not found: @minecraft/WorldService
```

##### 段階的解決手順

1. **Layerの実装**

   ```typescript
   export const WorldServiceLive = Layer.effect(
     WorldService,
     Effect.gen(function* () {
       const chunkStorage = yield* ChunkStorageService
       const chunkGenerator = yield* ChunkGeneratorService

       return WorldService.of({
         loadChunk: (coordinate) =>
           pipe(
             chunkStorage.getChunk(coordinate),
             Effect.catchTag('ChunkNotFoundError', () => chunkGenerator.generateChunk(coordinate))
           ),

         saveChunk: (chunk) => chunkStorage.saveChunk(chunk),
       })
     })
   )
   ```

2. **Layer組み合わせ**

   ```typescript
   export const MainLayer = Layer.mergeAll(
     WorldServiceLive,
     PlayerServiceLive,
     ChunkStorageServiceLive,
     ChunkGeneratorServiceLive
   )
   ```

3. **Effect実行時のLayer提供**

   ```typescript
   const program = Effect.gen(function* () {
     const worldService = yield* WorldService
     const chunk = yield* worldService.loadChunk({ x: 0, z: 0 })
     return chunk
   })

   // Layer提供して実行
   Effect.runPromise(Effect.provide(program, MainLayer))
   ```

### Match.value 関連エラー（4パターン）

#### 6. Match.value 型推論エラー

##### 症状

```bash
TS2345: Argument of type 'unknown' is not assignable to parameter of type 'never'.
```

##### 解決方法

```typescript
// ✅ 正しいMatch.value使用
const processInput = (input: unknown) =>
  pipe(
    input,
    Match.value,
    Match.when(
      (input): input is Player => Schema.is(PlayerSchema)(input),
      (player) => handlePlayer(player)
    ),
    Match.when(
      (input): input is Chunk => Schema.is(ChunkSchema)(input),
      (chunk) => handleChunk(chunk)
    ),
    Match.orElse(() => Effect.fail(new InvalidInputError({ input: JSON.stringify(input) })))
  )
```

#### 7. Match exhaustiveness エラー

##### 症状

```bash
TS2345: Not all code paths return a value.
```

##### 解決方法

```typescript
// 網羅性を保証するMatch
const handleGameEvent = (event: GameEvent) =>
  pipe(
    event,
    Match.value,
    Match.tag('PlayerJoined', (event) => Effect.log(`Player ${event.playerId} joined`)),
    Match.tag('PlayerLeft', (event) => Effect.log(`Player ${event.playerId} left`)),
    Match.tag('ChunkLoaded', (event) => Effect.log(`Chunk ${event.coordinate.x},${event.coordinate.z} loaded`)),
    Match.exhaustive // 全パターンの網羅を強制
  )
```

### Effect 実行エラー（7パターン）

#### 8. Effect.gen内でのyield\*エラー

##### 症状

```bash
TS2345: Argument of type 'Generator<...>' is not assignable to parameter.
```

##### 解決方法

```typescript
// ❌ 古い記法の混在
const problematicEffect = Effect.gen(function* (_) {
  const service = yield* _(SomeService) // 古い記法
  return service
})

// ✅ 3.17+標準記法
const correctEffect = Effect.gen(function* () {
  const service = yield* SomeService
  const result = yield* service.someMethod()
  return result
})
```

#### 9. Fiber Interruption 予期しない中断

##### 症状

```bash
FiberFailure: Interrupted
Error: Effect was interrupted during execution
```

##### 段階的解決手順

1. **中断可能性の考慮**

   ```typescript
   // 中断に対して頑健な処理
   const robustChunkGeneration = Effect.gen(function* () {
     return yield* generateChunk(coordinate).pipe(
       Effect.onInterrupt(() => Effect.log('Chunk generation interrupted, cleaning up...')),
       Effect.ensuring(Effect.sync(() => cleanupResources()))
     )
   })
   ```

2. **Scope による適切な管理**

   ```typescript
   const scopedProcessing = Effect.scoped(
     Effect.gen(function* () {
       const fiber = yield* Effect.forkScoped(
         longRunningTask.pipe(
           Effect.interruptible // 明示的に中断可能化
         )
       )

       const result = yield* Fiber.join(fiber)
       return result
       // scopeの終了時に自動的にfiberがクリーンアップされる
     })
   )
   ```

### バージョン互換性問題（6パターン）

#### 10. 3.16 → 3.17 API変更エラー

##### 主要変更点と対策

1. **Schema API の変更**

   ```bash
   # 一括置換コマンド
   find src -name "*.ts" -exec sed -i 's/Schema\.object(/Schema.Struct(/g' {} \;
   find src -name "*.ts" -exec sed -i 's/Schema\.string/Schema.String/g' {} \;
   find src -name "*.ts" -exec sed -i 's/Schema\.number/Schema.Number/g' {} \;
   ```

2. **Context API の変更**
   ```typescript
   // 移行ヘルパー関数
   const migrateContextTag = <T>(serviceName: string) => {
     // 古い書き方をサポートしつつ新しいAPIに移行
     return Context.GenericTag<T>(serviceName)
   }
   ```

#### 11. 依存関係バージョン競合

##### 症状

```bash
npm ERR! peer dep missing: effect@^3.17.0, required by @effect/schema@^0.75.5
```

##### 解決手順

```bash
# 1. 現在のバージョン確認
pnpm list effect @effect/schema

# 2. 正確なバージョンでの再インストール
pnpm add effect@3.17.13 @effect/schema@0.75.5 --save-exact

# 3. package.json でのバージョン固定
{
  "dependencies": {
    "effect": "3.17.13",
    "@effect/schema": "0.75.5"
  },
  "pnpm": {
    "overrides": {
      "effect": "3.17.13"
    }
  }
}
```

### 高度な問題解決パターン

#### 12. Schema.TaggedRequestを使用したリクエスト/レスポンスエラー

##### 症状

```bash
TS2322: Type 'LoadPlayerRequest' is not assignable to type 'never'.
```

##### 解決方法

```typescript
// リクエスト/レスポンスパターンの実装 - 関数型パターン
export const LoadPlayerRequest = Schema.TaggedRequest('LoadPlayerRequest')({
  playerId: Schema.String,
})(
  PlayerSchema, // Success型
  PlayerNotFoundError // Failure型
)

// RequestResolverの実装
export const PlayerRequestResolverLive = Layer.effect(
  RequestResolver.RequestResolver,
  Effect.gen(function* () {
    return RequestResolver.fromEffect((request: LoadPlayerRequest) =>
      Effect.gen(function* () {
        const storage = yield* PlayerStorageService
        return yield* storage.getPlayer(request.playerId)
      })
    )
  })
)
```

### メモリリークと最適化（5パターン）

#### 13. Fiber メモリリーク

##### 症状

- アプリケーションのメモリ使用量が徐々に増加
- GCが実行されてもメモリが解放されない

##### 解決戦略

```typescript
// ❌ メモリリークを引き起こすパターン
const leakyBackground = Effect.gen(function* () {
  const fibers: Fiber.Fiber<any, any>[] = []

  for (let i = 0; i < 1000; i++) {
    const fiber = yield* Effect.fork(heavyComputation(i))
    fibers.push(fiber) // Fiberの参照が溜まり続ける
  }

  // fibersのクリーンアップを忘れがち
})

// ✅ 適切なメモリ管理
const memoryEfficientBackground = Effect.scoped(
  Effect.gen(function* () {
    // 並行実行数を制限
    const semaphore = yield* Semaphore.make(10)

    const results = yield* Effect.forEach(
      Array.from({ length: 1000 }, (_, i) => i),
      (i) =>
        Effect.scoped(
          Effect.gen(function* () {
            yield* Semaphore.take(semaphore)
            const result = yield* heavyComputation(i)
            yield* Semaphore.release(semaphore)
            return result
          })
        ),
      { concurrency: 10 }
    )

    return results
    // スコープ終了時に全リソースが自動クリーンアップ
  })
)
```

#### 14. Schema validation パフォーマンス問題

##### 症状

- 大量データのvalidation時にCPU使用率が急増
- UI フリーズ

##### 最適化手法

```typescript
// ✅ ストリーミングvalidation
const optimizedValidation = <A>(schema: Schema.Schema<A>) => {
  return (data: unknown[]) =>
    Stream.fromIterable(data).pipe(
      Stream.mapEffect((item) => Schema.decodeUnknown(schema)(item), { concurrency: 5 }),
      Stream.buffer({ capacity: 100 }),
      Stream.runCollect
    )
}

// 使用例
const validatePlayers = optimizedValidation(PlayerSchema)
const validatedPlayers = yield * validatePlayers(rawPlayerData)
```

## 実践的デバッグ技法

### Effect トレーシングとログ

#### 15. 構造化ログによるデバッグ

```typescript
// 詳細なトレーシング設定
const createTracedEffect = <A, E>(name: string, effect: Effect.Effect<A, E>) =>
  pipe(
    effect,
    Effect.withSpan(name, {
      attributes: {
        'service.name': 'ts-minecraft',
        'service.version': '1.0.0',
      },
    }),
    Effect.tap((result) =>
      Effect.logInfo(`Effect ${name} completed`, {
        result: JSON.stringify(result, null, 2),
        timestamp: new Date().toISOString(),
      })
    ),
    Effect.tapError((error) =>
      Effect.logError(`Effect ${name} failed`, {
        error: String(error),
        timestamp: new Date().toISOString(),
      })
    )
  )

// 使用例
const tracedChunkLoad = createTracedEffect('load-chunk', loadChunk({ x: 0, z: 0 }))
```

#### 16. Effect.gen のステップバイステップデバッグ

```typescript
// デバッグ可能なEffect.gen
const debuggablePlayerLoad = (playerId: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Starting player load: ${playerId}`)

    const storage = yield* PlayerStorageService
    yield* Effect.log(`Got storage service`)

    const player = yield* storage.getPlayer(playerId).pipe(
      Effect.tap(() => Effect.log(`Player found: ${playerId}`)),
      Effect.tapError((error) => Effect.log(`Player load failed: ${playerId}, error: ${error}`))
    )

    yield* Effect.log(`Returning player: ${player.name}`)
    return player
  })
```

### Property-Based Testing 統合エラー（5パターン）

#### 17. Fast-Check Schema.arbitrary 統合エラー

##### 症状

```bash
TS2345: Argument of type 'Arbitrary<unknown>' is not assignable to parameter of type 'Arbitrary<Player>'.
```

##### 解決方法

```typescript
// ✅ 正しいSchema.arbitrary統合
import * as fc from 'fast-check'
import { Schema, Arbitrary } from 'effect'

const Player = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('PlayerId')),
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  level: Schema.Number.pipe(Schema.int(), Schema.between(1, 100)),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
})

// Schema.arbitraryによる型安全なArbitrary生成
const playerArbitrary = Arbitrary.make(Player)

// Property-based test
const testPlayerProperty = fc.property(fc.array(playerArbitrary(fc), { minLength: 1, maxLength: 100 }), (players) => {
  return Effect.gen(function* () {
    // 全プレイヤーがSchema通りであることをテスト
    const validatedPlayers = yield* Effect.forEach(players, (player) => Schema.decodeUnknown(Player)(player), {
      concurrency: 10,
    })

    expect(validatedPlayers.length).toBe(players.length)
    expect(validatedPlayers.every((p) => p.level >= 1 && p.level <= 100)).toBe(true)
  })
})
```

#### 18. @effect/vitest Test.scoped エラー

##### 症状

```bash
Error: Test.scoped is not available in current Effect version
```

##### 解決方法

```typescript
// 現代的なEffect-TS テスト実装
import { Effect, Layer, TestContext, TestClock, TestRandom } from 'effect'
import { it, expect, beforeEach } from 'vitest'

// テスト用Layer構成
const TestLayer = Layer.mergeAll(
  TestContext.TestContext,
  TestClock.TestClock,
  TestRandom.TestRandom,
  MockPlayerServiceLive,
  MockWorldServiceLive
)

// Effect.genを使用したテスト
it('should handle player operations correctly', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      // テスト用のクロックを進める
      const testClock = yield* TestClock.TestClock

      const playerService = yield* PlayerService
      const player = yield* playerService.create({
        name: 'TestPlayer',
        email: 'test@example.com',
      })

      // 時間を進めてタイムアウト処理をテスト
      yield* testClock.adjust(Duration.minutes(5))

      const retrievedPlayer = yield* playerService.findById(player.id)
      expect(retrievedPlayer.name).toBe('TestPlayer')

      return player
    }).pipe(Effect.provide(TestLayer))
  )

  expect(result).toBeDefined()
})
```

### テスト環境でのトラブルシューティング

#### 19. Vitest との統合エラー

##### 症状

```bash
Error: Cannot find module 'effect/test' or its corresponding type declarations.
```

##### 解決方法

```typescript
// test/setup.ts - Effect-TS テスト環境設定
import { Effect, Layer, TestContext } from 'effect'
import { beforeEach } from 'vitest'

// テスト用Layer
const TestLayer = Layer.mergeAll(TestContext.TestContext, TestPlayerServiceLive, TestWorldServiceLive)

// Effect実行ヘルパー
export const runTestEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, TestLayer))

// テスト例
import { it, expect } from '@effect/vitest'

it.effect('should load player correctly', () =>
  Effect.gen(function* () {
    const player = yield* loadPlayer('test-player-id')
    expect(player.name).toBe('TestPlayer')
  })
)
```

#### 18. Schema テストでの型エラー

```typescript
// Schemaテスト用ヘルパー
const testSchema = <A, I>(schema: Schema.Schema<A, I>, validInput: I, invalidInput: unknown) =>
  Effect.gen(function* () {
    // 正常なケース
    const validResult = yield* Schema.decodeUnknown(schema)(validInput)
    expect(validResult).toBeDefined()

    // エラーケース
    const invalidResult = yield* Schema.decodeUnknownEither(schema)(invalidInput)
    expect(Either.isLeft(invalidResult)).toBe(true)
  })
```

## 予防策とベストプラクティス

### 1. プロジェクト設定の最適化

```json
// tsconfig.json - Effect-TS最適化設定
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  }
}
```

### 2. エラーハンドリングの統一化

```typescript
// 統一エラーハンドリングパターン
const createSafeOperation = <A, E>(
  operation: Effect.Effect<A, E>,
  fallback: (error: E) => A
): Effect.Effect<A, never> =>
  pipe(
    operation,
    Effect.catchAll((error) => Effect.succeed(fallback(error))),
    Effect.tapError((error) => Effect.logError('Operation failed, using fallback', { error }))
  )
```

### 3. メモリ効率的な実装パターン

```typescript
// リソース効率的なStream処理
const efficientDataProcessing = <A, B>(data: A[], processor: (item: A) => Effect.Effect<B, never>) =>
  Stream.fromIterable(data).pipe(
    Stream.grouped(100), // バッチサイズ制限
    Stream.mapEffect(
      (batch) => Effect.all(batch.map(processor)),
      { concurrency: 3 } // 並行数制限
    ),
    Stream.flattenChunks,
    Stream.runCollect
  )
```

### 4. 開発時のデバッグ設定

```typescript
// 開発環境用のロガー設定
const DevLogger = Logger.make(({ logLevel, message, cause, spans }) => {
  const formattedMessage = `[${logLevel._tag}] ${message}`

  if (spans.length > 0) {
    console.group(`🔍 ${spans[0].name}`)
    console.log(formattedMessage)
    if (cause) console.error('Cause:', cause)
    console.groupEnd()
  } else {
    console.log(formattedMessage)
    if (cause) console.error('Cause:', cause)
  }
})

// 開発専用Effect実行
export const runWithDevLogging = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.provide(effect, Layer.succeed(Logger.Logger, DevLogger)))
```

### 5. パフォーマンス監視

```typescript
// Effect実行時間測定
const measureEffect = <A, E>(name: string, effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const start = Date.now()
    const result = yield* effect
    const duration = Date.now() - start

    yield* Effect.logInfo(`Performance: ${name}`, {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })

    return result
  })
```

## トラブルシューティング チェックリスト

### 緊急時対応（5分以内）

- [ ] Effect-TS バージョン確認: `pnpm list effect @effect/schema`
- [ ] TypeScript設定確認: `npx tsc --showConfig`
- [ ] 依存関係の健全性: `pnpm doctor`
- [ ] キャッシュクリア: `rm -rf node_modules/.vite && pnpm install`
- [ ] エラーログの確認: ブラウザDevToolsコンソール

### 詳細診断（15分以内）

- [ ] Schema定義の検証: 正しいSchema.Struct使用
- [ ] Context.GenericTagの適切な実装
- [ ] Layer構成の確認: 必要なサービスが全て提供されているか
- [ ] Effect.genの記法確認: yield\*の正しい使用
- [ ] メモリ使用量の確認: Chrome DevTools Memory タブ

### 根本原因解析（30分以内）

- [ ] 型エラーの詳細分析: TypeScriptログの確認
- [ ] Effect実行フローの追跡: withSpanによるトレース
- [ ] パフォーマンスボトルネックの特定
- [ ] テスト環境との相違点確認
- [ ] バージョン互換性の検証

## 関連リソース

### プロジェクト内ドキュメント

- [よくあるエラー](./common-errors.md) - 一般的なエラーパターン
- [デバッグガイド](./debugging-guide.md) - 高度なデバッグ技術
- [ランタイムエラー](./runtime-errors.md) - 実行時エラー対処法
- [エラーハンドリングパターン](../../explanations/design-patterns/02-error-handling-patterns.md) - プロジェクト固有パターン
- [開発ガイド](./error-resolution.md) - エラー解決プロセス

### Effect-TS 公式リソース

- [Effect-TS 公式ドキュメント](https://effect.website/) - 最新API仕様
- [Schema ガイド](https://effect.website/docs/guides/schema) - Schema使用方法
- [Context ガイド](https://effect.website/docs/guides/context-management) - Context管理
- [Testing ガイド](https://effect.website/docs/guides/testing) - テスト戦略

### デバッグツール

- [Effect Inspector](https://github.com/Effect-TS/effect-inspector) - Effect実行の可視化
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/) - パフォーマンス分析
