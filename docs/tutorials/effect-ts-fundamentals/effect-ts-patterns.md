---
title: 'Effect-TS 利用パターン - コアパターン集'
description: 'Effect-TS 3.17+の最新パターンとベストプラクティス。Layer構成、Service設計、エラーハンドリングの実践的パターン。'
category: 'architecture'
difficulty: 'intermediate'
tags: ['effect-ts', 'patterns', 'functional-programming', 'layer', 'service']
prerequisites: ['effect-ts-fundamentals']
estimated_reading_time: '15分'
---

# Effect-TS利用パターン

## 概要

本ドキュメントでは、基礎概念を学んだ後の実践的なパターン集を提供します。Layer構成、サービス組み合わせ、パフォーマンス最適化、Brand型の活用など、実際の開発で必要になる応用パターンを学習できます。

> 📚 **学習前提**: このドキュメントは [Effect-TS 基礎](./effect-ts-basics.md) と [Effect-TS サービス](./effect-ts-services.md) の内容を理解していることを前提としています。
>
> 🔗 **関連チュートリアル**: [基本コンポーネント作成](../basic-game-development/basic-components.md) でBrand型を使った実際のMinecraftドメインモデルの例を参照してください。

### 学習の流れ

1. **基礎概念** → [Effect-TS 基礎](./effect-ts-basics.md)
2. **サービス層** → [Effect-TS サービス](./effect-ts-services.md)
3. **実践パターン** → **このドキュメント**
4. **エラーハンドリング** → [Effect-TSエラーハンドリング](./effect-ts-error-handling.md)
5. **テスト戦略** → [Effect-TSテスト](./effect-ts-testing.md)

---

## 0. Brand型による型安全な設計パターン

### 0.1 ドメイン固有識別子のパターン

Brand型は同じプリミティブ型でも意味的に異なる値を型レベルで区別するため、Minecraftのような複雑なドメインで特に威力を発揮します。

```typescript
import { Schema, Brand, Effect, Option } from 'effect'

// ✅ ゲーム内の各概念を明確に分離
export const EntityId = Schema.String.pipe(
  Schema.uuid(),
  Schema.brand('EntityId'),
  Schema.annotations({
    title: 'Entity ID',
    description: 'Unique identifier for any game entity',
  })
)
export type EntityId = Schema.Schema.Type<typeof EntityId>

export const WorldId = Schema.String.pipe(
  Schema.pattern(/^world_[a-z0-9_]+$/),
  Schema.brand('WorldId'),
  Schema.annotations({
    title: 'World ID',
    description: 'Unique identifier for a game world',
    examples: ['world_survival', 'world_creative_build'],
  })
)
export type WorldId = Schema.Schema.Type<typeof WorldId>

// ✅ 値オブジェクトのBrand型応用
export const Coordinate = Schema.Number.pipe(Schema.finite(), Schema.brand('Coordinate'))
export type Coordinate = Schema.Schema.Type<typeof Coordinate>

export const GamePosition = Schema.Struct({
  x: Coordinate,
  y: Coordinate,
  z: Coordinate,
  worldId: WorldId,
}).pipe(Schema.brand('GamePosition'))
export type GamePosition = Schema.Schema.Type<typeof GamePosition>
```

### 0.2 Brand型を活用したサービス設計

```typescript
// Brand型によりコンパイル時に誤用を防ぐサービス設計
export class EntityManagerService extends Context.Tag("@minecraft/domain/EntityManagerService")<
  EntityManagerService,
  {
    readonly spawn: (worldId: WorldId, position: GamePosition) => Effect.Effect<EntityId, SpawnError>
    readonly despawn: (entityId: EntityId) => Effect.Effect<void, DespawnError>
    readonly move: (entityId: EntityId, newPosition: GamePosition) => Effect.Effect<void, MoveError>
    readonly getPosition: (entityId: EntityId) => Effect.Effect<Option.Option<GamePosition>, never>
  }
>() {}

// 実装でのBrand型活用
export const EntityManagerServiceLive = Layer.effect(
  EntityManagerService,
  Effect.gen(function* () {
    const storage = yield* EntityStorageService

    return EntityManagerService.of({
      spawn: (worldId, position) =>
        Effect.gen(function* () {
          // Brand型により、worldIdとpositionの関係が型レベルで保証される
          if (position.worldId !== worldId) {
            return yield* Effect.fail(new WorldMismatchError({ worldId, position }))
          }

          const entityId = yield* generateEntityId()
          yield* storage.store(entityId, { position, worldId })
          return entityId
        }),

      move: (entityId, newPosition) =>
        Effect.gen(function* () {
          const currentData = yield* storage.get(entityId)
          return yield* Option.match(currentData, {
            onNone: () => Effect.fail(new EntityNotFoundError({ entityId })),
            onSome: (data) =>
              // 同じワールド内でのみ移動可能
              data.worldId === newPosition.worldId
                ? storage.update(entityId, { ...data, position: newPosition })
                : Effect.fail(
                    new CrossWorldMoveError({ entityId, fromWorld: data.worldId, toWorld: newPosition.worldId })
                  ),
          })
        }),

      // 他の実装...
    })
  })
)
```

---

## 1. 高度なLayer構成パターン

### 1.1 複雑なLayer依存関係の管理

```typescript
import { Effect, Layer, Context } from 'effect'

// 複数の依存関係を持つ高度なサービス
export class AdvancedGameService extends Context.Tag("@minecraft/application/AdvancedGameService")<
  AdvancedGameService,
  {
    readonly processComplexGameLogic: (input: GameInput) => Effect.Effect<GameResult, GameError>
  }
>() {}

// 複数Layer合成による高度な依存性注入
export const AdvancedGameServiceLive = Layer.effect(
  AdvancedGameService,
  Effect.gen(function* () {
    // 複数の依存サービスを取得
    const worldService = yield* WorldService
    const playerService = yield* PlayerService
    const physicsEngine = yield* PhysicsEngine
    const eventBus = yield* EventBus

    // 初期化ロジック
    yield* Effect.log('Advanced Game Service を初期化中...')

    return AdvancedGameService.of({
      processComplexGameLogic: (input) =>
        Effect.gen(function* () {
          // 複数サービスを組み合わせた複雑な処理
          const worldState = yield* worldService.getCurrentState()
          const playerActions = yield* playerService.processInput(input)
          const physicsUpdate = yield* physicsEngine.simulate(worldState, playerActions)

          yield* eventBus.publish({ type: 'GameStateUpdated', data: physicsUpdate })

          return { success: true, newState: physicsUpdate }
        }),
    })
  })
)

// 環境固有のLayer構成
const TestEnvironmentLayers = Layer.mergeAll(MockWorldService, MockPlayerService, MockPhysicsEngine, InMemoryEventBus)

const ProductionEnvironmentLayers = Layer.mergeAll(
  LiveWorldService,
  LivePlayerService,
  LivePhysicsEngine,
  RedisEventBus
)
```

> 🔗 **基本的なサービス定義**: Context.Tag（class-based）の基本的な使い方は [Effect-TS サービス](./effect-ts-services.md) を参照してください。

## 2. 高度なエラー回復パターン

> 🔗 **基本的なエラーハンドリング**: 構造化エラーとタグ付きエラーの基礎は [Effect-TS エラーハンドリング](./effect-ts-error-handling.md) を参照してください。

### 2.1 複合エラー回復戦略

```typescript
// より高度な回復戦略の組み合わせ
const resilientGameOperation = <A>(operation: Effect.Effect<A, GameError>): Effect.Effect<A, GameError> =>
  pipe(
    operation,
    // 1. 一次回復: 短時間リトライ
    Effect.retry(Schedule.exponential('50 millis').pipe(Schedule.recurs(2))),
    // 2. 二次回復: キャッシュフォールバック
    Effect.catchTag('NetworkError', () => loadFromCache()),
    // 3. 三次回復: デグレード機能
    Effect.catchAll(() => provideDegradedService())
  )

// サーキットブレーカーパターン
const withCircuitBreaker = <A, E>(
  effect: Effect.Effect<A, E>,
  threshold: number = 5
): Effect.Effect<A, E | CircuitBreakerError> =>
  Effect.gen(function* () {
    const failures = yield* Ref.make(0)
    const isOpen = yield* Ref.make(false)

    return yield* pipe(
      Ref.get(isOpen),
      Effect.flatMap((open) =>
        open
          ? Effect.fail(new CircuitBreakerError())
          : pipe(
              effect,
              Effect.tapError(() =>
                pipe(
                  Ref.update(failures, (n) => n + 1),
                  Effect.flatMap(() => Ref.get(failures)),
                  Effect.flatMap((count) => (count >= threshold ? Ref.set(isOpen, true) : Effect.unit))
                )
              ),
              Effect.tap(() => Ref.set(failures, 0))
            )
      )
    )
  })
```

## 3. Schema活用パターン

### 3.1 バリデーション統合

```typescript
import { Schema } from 'effect'

// APIリクエストのスキーマ
const CreateUserRequest = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  age: Schema.Number.pipe(Schema.int(), Schema.between(0, 150)),
})

// バリデーション付きAPI処理
const createUser = (request: unknown) =>
  Effect.gen(function* () {
    const validatedRequest = yield* Schema.decodeUnknown(CreateUserRequest)(request)
    const userService = yield* UserService

    return yield* userService.create(validatedRequest)
  })
```

### 3.2 データ変換パイプライン

```typescript
// 変換チェーン
const processUserData = (rawData: unknown) =>
  pipe(
    rawData,
    Schema.decodeUnknown(RawUserSchema),
    Effect.flatMap(normalizeUserData),
    Effect.flatMap(validateBusinessRules),
    Effect.flatMap(enrichUserData)
  )

const normalizeUserData = (user: RawUser): Effect.Effect<NormalizedUser, NormalizationError> =>
  Effect.succeed({
    ...user,
    name: user.name.trim().toLowerCase(),
    email: user.email.toLowerCase(),
  })
```

## 4. 並行性パターン

### 4.1 並列処理

```typescript
// 複数の非同期操作を並列実行
const loadUserDashboard = (userId: string) =>
  Effect.gen(function* () {
    const [user, posts, notifications] = yield* Effect.all(
      [userService.getById(userId), postService.getByUserId(userId), notificationService.getByUserId(userId)],
      { concurrency: 'inherit' }
    )

    return { user, posts, notifications }
  })

// 制限付き並列処理
const processItemsBatch = (items: Item[]) =>
  Effect.all(
    items.map(processItem),
    { concurrency: 5 } // 最大5つまで並列
  )
```

### 4.2 リソース管理

```typescript
// acquireUseReleaseパターン
const withFileHandle = <A, E>(
  filename: string,
  use: (handle: FileHandle) => Effect.Effect<A, E>
): Effect.Effect<A, E | FileError> => Effect.acquireUseRelease(openFile(filename), use, (handle) => closeFile(handle))

// スコープ付きリソース管理
const processWithResources = Effect.gen(function* () {
  const connection = yield* Effect.acquireRelease(createConnection(), (conn) => closeConnection(conn))

  const transaction = yield* Effect.acquireRelease(beginTransaction(connection), (tx) => commitTransaction(tx))

  return yield* processInTransaction(transaction)
})
```

## 5. テストパターン

### 5.1 Mock実装

```typescript
// テスト用Mockサービス
export const MockUserService = Layer.succeed(
  UserService,
  UserService.of({
    getById: (id: string) =>
      id === 'existing'
        ? Effect.succeed({ id, name: 'Test User' })
        : Effect.fail(new NotFoundError({ resource: 'User', id })),

    create: (data: CreateUserData) =>
      Effect.succeed({
        id: 'generated-id',
        ...data,
        createdAt: new Date(),
      }),
  })
)

// テスト実行
const testUserCreation = Effect.gen(function* () {
  const user = yield* createUser({ name: 'John', email: 'john@example.com' })
  expect(user.name).toBe('John')
}).pipe(Effect.provide(MockUserService))
```

### 5.2 環境分離

```typescript
// 本番環境のLayer
const ProdLayer = Layer.mergeAll(DatabaseServiceLive, EmailServiceLive, CacheServiceLive)

// テスト環境のLayer
const TestLayer = Layer.mergeAll(MockDatabaseService, MockEmailService, InMemoryCacheService)

// 環境に応じた実行
const runWithEnvironment = <A, E>(effect: Effect.Effect<A, E>, env: 'prod' | 'test' = 'prod') => {
  const layer = env === 'prod' ? ProdLayer : TestLayer
  return Effect.provide(effect, layer)
}
```

## 6. パフォーマンス最適化

### 6.1 キャッシュパターン

```typescript
// メモ化Cache
const cachedUserGet = (id: string) =>
  pipe(
    Cache.get(userCache, id, () => userService.getById(id)),
    Effect.withSpan('cached-user-get', { attributes: { userId: id } })
  )

// TTL付きキャッシュ
const userCache = Cache.make({
  capacity: 1000,
  timeToLive: Duration.minutes(5),
})
```

### 6.2 ストリーミング処理

```typescript
import { Stream } from 'effect'

// 大量データの効率処理
const processLargeDataset = (items: Stream.Stream<Item>) =>
  pipe(
    items,
    Stream.grouped(100), // 100件ずつバッチ処理
    Stream.mapEffect(processBatch),
    Stream.runCollect
  )

// 無限ストリーム処理
const eventProcessor = pipe(
  Stream.fromQueue(eventQueue),
  Stream.map(parseEvent),
  Stream.filter(isValidEvent),
  Stream.mapEffect(processEvent),
  Stream.runDrain
)
```

## 7. 設計原則まとめ

### 7.1 関数設計チェックリスト

- [ ] **単一責任**: 各関数は1つの明確な責任を持つ
- [ ] **純粋性**: 副作用をEffect型で明示
- [ ] **型安全性**: 入力と出力の型を明確に定義
- [ ] **合成可能性**: 他の関数と組み合わせ可能
- [ ] **テスト容易性**: 単体テストが書きやすい

### 7.2 Effectパターンベストプラクティス

- **早期リターン**: バリデーション失敗時は即座にEffect.fail
- **リソース管理**: acquireUseReleaseパターンを活用
- **エラー型付け**: 具体的なエラー型を定義
- **Layer分離**: 環境別にLayer構成を分ける
- **並行性**: 独立した処理はEffect.allで並列化

## 関連ドキュメント

**専門分野**:

- [Effect-TSテスト](./effect-ts-testing.md) - テスト統合戦略
- [エラーハンドリング](./effect-ts-error-handling.md) - エラー処理詳細
- [高度なパターン](./effect-ts-advanced.md) - アドバンスドパターン
- [マッチングパターン](./effect-ts-match-patterns.md) - Match API利用

**実装関連**:

- [アーキテクチャ原則](../../explanations/architecture/README.md) - 設計思想
- [実装パターン集](../../explanations/design-patterns/README.md) - パターンカタログ
