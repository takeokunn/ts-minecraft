---
title: "Effect-TS 利用パターン - コアパターン集"
description: "Effect-TS 3.17+の最新パターンとベストプラクティス。Layer構成、Service設計、エラーハンドリングの実践的パターン。"
category: "architecture"
difficulty: "intermediate"
tags: ["effect-ts", "patterns", "functional-programming", "layer", "service"]
prerequisites: ["effect-ts-fundamentals"]
estimated_reading_time: "15分"
last_updated: "2025-09-14"
version: "3.0.0"
---

# Effect-TS利用パターン

## 概要

本ドキュメントでは、Effect-TS 3.17+のコアパターンとベストプラクティスを紹介します。特定の技術や手法に関しては、以下の専門ドキュメントを参照してください。

### 関連ドキュメント
- [PBT関数設計](./06-pbt-function-design.md) - Property-Based Testing対応関数設計
- [fast-checkテストパターン](./06-fast-check-patterns.md) - fast-check具体的実装
- [Effect-TSテスト](./06d-effect-ts-testing.md) - Effect-TSテスト戦略
- [Effect-TSエラーハンドリング](./06c-effect-ts-error-handling.md) - エラー処理パターン

---

## 1. Effect-TSコアパターン

### 1.1 Layer構成パターン

```typescript
import { Effect, Layer, Context } from "effect"

// サービス定義
export const DatabaseService = Context.GenericTag<{
  readonly query: (sql: string) => Effect.Effect<unknown[], DatabaseError>
  readonly transaction: <R, E, A>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | DatabaseError, R>
}>("@app/DatabaseService")

// サービス実装
export const DatabaseServiceLive = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    const pool = yield* createConnectionPool()

    return {
      query: (sql: string) => Effect.tryPromise({
        try: () => pool.query(sql),
        catch: (error) => new DatabaseError({ message: String(error) })
      }),
      transaction: <R, E, A>(effect: Effect.Effect<A, E, R>) =>
        Effect.acquireUseRelease(
          Effect.tryPromise(() => pool.getConnection()),
          (connection) => effect,
          (connection) => Effect.sync(() => connection.release())
        )
    }
  })
)
```

### 1.2 サービス組み合わせ

```typescript
// ユーザーサービス
export const UserService = Context.GenericTag<{
  readonly getById: (id: string) => Effect.Effect<User, NotFoundError>
  readonly create: (data: CreateUserData) => Effect.Effect<User, ValidationError>
}>("@app/UserService")

// メールサービス
export const EmailService = Context.GenericTag<{
  readonly sendWelcome: (user: User) => Effect.Effect<void, EmailError>
}>("@app/EmailService")

// サービスの組み合わせ
export const createUserWithWelcomeEmail = (
  userData: CreateUserData
): Effect.Effect<User, ValidationError | EmailError, UserService | EmailService> =>
  Effect.gen(function* () {
    const userService = yield* UserService
    const emailService = yield* EmailService

    const user = yield* userService.create(userData)
    yield* emailService.sendWelcome(user)

    return user
  })
```

## 2. エラーハンドリングパターン

### 2.1 構造化されたエラー

```typescript
import { Schema } from "@effect/schema"

// タグ付きエラー定義
export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
    value: Schema.Unknown
  }
) {}

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    resource: Schema.String,
    id: Schema.String
  }
) {}

// エラー変換パターン
const handleDatabaseError = (error: unknown): DatabaseError =>
  error instanceof PostgresError
    ? new DatabaseConnectionError({
        code: error.code,
        detail: error.detail
      })
    : new DatabaseUnknownError({
        message: String(error)
      })
```

### 2.2 エラー回復戦略

```typescript
// リトライパターン
const withRetry = <A, E>(
  effect: Effect.Effect<A, E>,
  maxRetries: number = 3
): Effect.Effect<A, E> =>
  pipe(
    effect,
    Effect.retry(
      Schedule.exponential("100 millis").pipe(
        Schedule.compose(Schedule.recurs(maxRetries))
      )
    )
  )

// フォールバックパターン
const withFallback = <A, E>(
  primary: Effect.Effect<A, E>,
  fallback: Effect.Effect<A, E>
): Effect.Effect<A, E> =>
  Effect.catchAll(primary, (_error) => fallback)

// 使用例
const reliableUserGet = (id: string) =>
  pipe(
    getUserFromCache(id),
    withFallback(getUserFromDatabase(id)),
    withRetry(3)
  )
```

## 3. Schema活用パターン

### 3.1 バリデーション統合

```typescript
import { Schema } from "@effect/schema"

// APIリクエストのスキーマ
const CreateUserRequest = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  age: Schema.Number.pipe(Schema.int(), Schema.between(0, 150))
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
    email: user.email.toLowerCase()
  })
```

## 4. 並行性パターン

### 4.1 並列処理

```typescript
// 複数の非同期操作を並列実行
const loadUserDashboard = (userId: string) =>
  Effect.gen(function* () {
    const [user, posts, notifications] = yield* Effect.all([
      userService.getById(userId),
      postService.getByUserId(userId),
      notificationService.getByUserId(userId)
    ], { concurrency: "inherit" })

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
): Effect.Effect<A, E | FileError> =>
  Effect.acquireUseRelease(
    openFile(filename),
    use,
    (handle) => closeFile(handle)
  )

// スコープ付きリソース管理
const processWithResources = Effect.gen(function* () {
  const connection = yield* Effect.acquireRelease(
    createConnection(),
    (conn) => closeConnection(conn)
  )

  const transaction = yield* Effect.acquireRelease(
    beginTransaction(connection),
    (tx) => commitTransaction(tx)
  )

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
      id === "existing"
        ? Effect.succeed({ id, name: "Test User" })
        : Effect.fail(new NotFoundError({ resource: "User", id })),

    create: (data: CreateUserData) =>
      Effect.succeed({
        id: "generated-id",
        ...data,
        createdAt: new Date()
      })
  })
)

// テスト実行
const testUserCreation = Effect.gen(function* () {
  const user = yield* createUser({ name: "John", email: "john@example.com" })
  expect(user.name).toBe("John")
}).pipe(Effect.provide(MockUserService))
```

### 5.2 環境分離

```typescript
// 本番環境のLayer
const ProdLayer = Layer.mergeAll(
  DatabaseServiceLive,
  EmailServiceLive,
  CacheServiceLive
)

// テスト環境のLayer
const TestLayer = Layer.mergeAll(
  MockDatabaseService,
  MockEmailService,
  InMemoryCacheService
)

// 環境に応じた実行
const runWithEnvironment = <A, E>(
  effect: Effect.Effect<A, E>,
  env: "prod" | "test" = "prod"
) => {
  const layer = env === "prod" ? ProdLayer : TestLayer
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
    Effect.withSpan("cached-user-get", { attributes: { userId: id } })
  )

// TTL付きキャッシュ
const userCache = Cache.make({
  capacity: 1000,
  timeToLive: Duration.minutes(5)
})
```

### 6.2 ストリーミング処理

```typescript
import { Stream } from "effect"

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
- [PBT関数設計](./06-pbt-function-design.md) - Property-Based Testing対応設計
- [fast-checkパターン](./06-fast-check-patterns.md) - 具体的なテスト実装
- [Effect-TSテスト](./06d-effect-ts-testing.md) - テスト統合戦略
- [エラーハンドリング](./06c-effect-ts-error-handling.md) - エラー処理詳細

**実装関連**:
- [アーキテクチャ原則](./01-design-principles.md) - 設計思想
- [実装パターン集](../07-pattern-catalog/) - パターンカタログ