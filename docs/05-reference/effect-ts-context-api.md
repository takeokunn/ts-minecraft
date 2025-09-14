---
title: "Effect-TS 3.17+ Context API完全リファレンス - Context.GenericTag + Layer統合"
description: "Effect-TS 3.17+ Context APIの完全リファレンス。Context.GenericTag、Schema.Struct統合、Match.value活用、モダン依存性注入パターン。"
category: "reference"
difficulty: "advanced"
tags: ["effect-ts", "context", "dependency-injection", "layer", "modular-design", "context-generic-tag", "schema-struct", "match-patterns"]
prerequisites: ["effect-ts-basics", "schema-patterns", "context-patterns"]
estimated_reading_time: "35分"
dependencies: ["@effect/schema", "@effect/match"]
status: "complete"
---

# Effect-TS Context API リファレンス

## 概要

Effect-TS Context APIは、軽量で型安全な依存性注入メカニズムを提供します。サービスを直接参照することなく、計算を通じて依存関係を透過的に渡すことができます。Layerシステムと組み合わせることで、モジュラーで構成可能な依存関係の管理を実現します。

### Context APIの利点

- **型安全性**: コンパイル時に依存関係が検証される
- **モジュラー設計**: 依存関係を細かく分割して管理
- **テスタビリティ**: モック実装への簡単な切り替え
- **構成性**: Layerを組み合わせた複雑な依存関係グラフの構築

## 基本API

### Context.GenericTag - 現代的なサービス定義

Effect-TS 3.17+では、`Context.GenericTag`を使用してより型安全で表現力豊かなサービスタグを定義します。

```typescript
import { Context, Schema, Effect, Match } from "effect"

// Schema.Structを使用した型安全なエンティティ定義
const User = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("UserId")),
  name: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  status: Schema.Literal("active", "inactive", "pending"),
  createdAt: Schema.Date,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})

const CreateUser = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})

class UserServiceError extends Schema.TaggedError<UserServiceError>()("UserServiceError", {
  reason: Schema.Literal("not-found", "duplicate-email", "invalid-status"),
  userId: Schema.String.pipe(Schema.optional()),
  details: Schema.String
}) {}

// Context.GenericTagによる基本サービス定義
class UserService extends Context.GenericTag("UserService")<{
  findById: (id: string) => Effect.Effect<typeof User.Type, UserServiceError>
  create: (user: typeof CreateUser.Type) => Effect.Effect<typeof User.Type, UserServiceError>
  updateStatus: (id: string, status: "active" | "inactive" | "pending") => Effect.Effect<typeof User.Type, UserServiceError>
  findByEmail: (email: string) => Effect.Effect<typeof User.Type, UserServiceError>
  list: (filters?: { status?: "active" | "inactive" | "pending" }) => Effect.Effect<typeof User.Type[], never>
}>() {}

// より複雑なデータベースサービス
class DatabaseService extends Context.GenericTag("DatabaseService")<{
  query: <T>(sql: string, params?: unknown[]) => Effect.Effect<T[], DatabaseError>
  transaction: <A, E>(operation: Effect.Effect<A, E, DatabaseService>) => Effect.Effect<A, E | DatabaseError>
  healthCheck: () => Effect.Effect<boolean, DatabaseError>
  migrate: (version: string) => Effect.Effect<void, DatabaseError>
}>() {}

// キャッシュサービス（ジェネリック対応）
class CacheService extends Context.GenericTag("CacheService")<{
  get: <T>(key: string, schema: Schema.Schema<T>) => Effect.Effect<T | null, CacheError>
  set: <T>(key: string, value: T, ttl?: number) => Effect.Effect<void, CacheError>
  delete: (key: string) => Effect.Effect<boolean, CacheError>
  invalidatePattern: (pattern: string) => Effect.Effect<number, CacheError>
}>() {}
```

### Layer.effect - Context.GenericTag実装パターン

Context.GenericTagサービスの実装をLayerとして定義します。

```typescript
import { Effect, Layer, Schedule, Match } from "effect"

class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  operation: Schema.String,
  message: Schema.String,
  cause: Schema.Unknown.pipe(Schema.optional())
}) {}

class CacheError extends Schema.TaggedError<CacheError>()("CacheError", {
  operation: Schema.String,
  key: Schema.String,
  message: Schema.String
}) {}

// UserServiceの実装（Context.GenericTag.of使用）
const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const cache = yield* CacheService

    return UserService.of({
      findById: (id: string) =>
        Effect.gen(function* () {
          // キャッシュから取得を試行
          const cached = yield* cache.get(`user:${id}`, User).pipe(
            Effect.catchAll(() => Effect.succeed(null))
          )

          if (cached) {
            return cached
          }

          // データベースから取得
          const rows = yield* db.query("SELECT * FROM users WHERE id = ?", [id])

          return yield* Match.value(rows).pipe(
            Match.when(rows => rows.length === 0, () =>
              Effect.fail(new UserServiceError({
                reason: "not-found",
                userId: id,
                details: `User with id ${id} not found`
              }))
            ),
            Match.orElse(rows =>
              Effect.gen(function* () {
                const user = yield* Schema.decodeUnknown(User)(rows[0])

                // キャッシュに保存
                yield* cache.set(`user:${id}`, user, 300).pipe(
                  Effect.catchAll(() => Effect.void)
                )

                return user
              })
            )
          )
        }),

      create: (userData: typeof CreateUser.Type) =>
        Effect.gen(function* () {
          // 重複メールチェック
          const existingUser = yield* Effect.exit(
            db.query("SELECT id FROM users WHERE email = ?", [userData.email])
          )

          if (Exit.isSuccess(existingUser) && existingUser.value.length > 0) {
            return yield* Effect.fail(new UserServiceError({
              reason: "duplicate-email",
              details: `Email ${userData.email} already exists`
            }))
          }

          // 新規ユーザー作成
          const newUser = {
            ...userData,
            id: generateId() as typeof User.Type.id,
            status: "active" as const,
            createdAt: new Date()
          }

          yield* db.transaction(
            db.query(
              "INSERT INTO users (id, name, email, status, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)",
              [newUser.id, newUser.name, newUser.email, newUser.status, newUser.createdAt, JSON.stringify(newUser.metadata)]
            )
          )

          // キャッシュを更新
          yield* cache.set(`user:${newUser.id}`, newUser, 300).pipe(
            Effect.catchAll(() => Effect.void)
          )

          return newUser
        }).pipe(
          Effect.retry(Schedule.recurs(3))
        ),

      updateStatus: (id: string, status: "active" | "inactive" | "pending") =>
        Effect.gen(function* () {
          const user = yield* UserService.findById(id)

          const updatedUser = { ...user, status }

          yield* db.query(
            "UPDATE users SET status = ? WHERE id = ?",
            [status, id]
          )

          // キャッシュを無効化
          yield* cache.delete(`user:${id}`)

          return updatedUser
        }),

      findByEmail: (email: string) =>
        Effect.gen(function* () {
          const rows = yield* db.query("SELECT * FROM users WHERE email = ?", [email])

          return yield* Match.value(rows).pipe(
            Match.when(rows => rows.length === 0, () =>
              Effect.fail(new UserServiceError({
                reason: "not-found",
                details: `User with email ${email} not found`
              }))
            ),
            Match.orElse(rows => Schema.decodeUnknown(User)(rows[0]))
          )
        }),

      list: (filters) =>
        Effect.gen(function* () {
          const whereClause = filters?.status ? "WHERE status = ?" : ""
          const params = filters?.status ? [filters.status] : []

          const rows = yield* db.query(`SELECT * FROM users ${whereClause}`, params)

          return yield* Effect.forEach(
            rows,
            row => Schema.decodeUnknown(User)(row),
            { concurrency: 10 }
          )
        })
    })
  })
)
```

## サービス定義パターン

### 1. Context.GenericTag型サービス - Schema統合パターン

```typescript
import { Context, Effect, Layer, Schema, Match } from "effect"

// ログレベルとメタデータの型定義
const LogLevel = Schema.Literal("debug", "info", "warn", "error", "fatal")
const LogEntry = Schema.Struct({
  level: LogLevel,
  message: Schema.String,
  timestamp: Schema.Date,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})

class LoggerError extends Schema.TaggedError<LoggerError>()("LoggerError", {
  operation: Schema.String,
  reason: Schema.String,
  cause: Schema.Unknown.pipe(Schema.optional())
}) {}

// Context.GenericTagによるロガーサービス定義
class Logger extends Context.GenericTag("Logger")<{
  log: (level: typeof LogLevel.Type, message: string, metadata?: Record<string, unknown>) => Effect.Effect<void, LoggerError>
  info: (message: string, metadata?: Record<string, unknown>) => Effect.Effect<void, LoggerError>
  error: (message: string, error?: Error, metadata?: Record<string, unknown>) => Effect.Effect<void, LoggerError>
  debug: (message: string, metadata?: Record<string, unknown>) => Effect.Effect<void, LoggerError>
  warn: (message: string, metadata?: Record<string, unknown>) => Effect.Effect<void, LoggerError>
  fatal: (message: string, error?: Error, metadata?: Record<string, unknown>) => Effect.Effect<void, LoggerError>
  flush: () => Effect.Effect<void, LoggerError>
}>() {}

// 実装（Match.valueと早期リターン使用）
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    return Logger.of({
      log: (level, message, metadata) =>
        Effect.gen(function* () {
          const entry = {
            level,
            message,
            timestamp: new Date(),
            metadata
          }

          const validatedEntry = yield* Schema.encode(LogEntry)(entry).pipe(
            Effect.mapError(cause => new LoggerError({
              operation: "log",
              reason: "Invalid log entry",
              cause
            }))
          )

          // ログレベルに応じた処理
          yield* Match.value(level).pipe(
            Match.when("debug", () => Effect.logDebug(message)),
            Match.when("info", () => Effect.logInfo(message)),
            Match.when("warn", () => Effect.logWarning(message)),
            Match.when("error", () => Effect.logError(message)),
            Match.when("fatal", () => Effect.logFatal(message)),
            Match.exhaustive
          )
        }),

      info: (message, metadata) =>
        Logger.log("info", message, metadata),

      error: (message, error, metadata) =>
        Effect.gen(function* () {
          const enrichedMetadata = {
            ...metadata,
            ...(error && {
              errorName: error.name,
              errorMessage: error.message,
              errorStack: error.stack
            })
          }
          yield* Logger.log("error", message, enrichedMetadata)
        }),

      debug: (message, metadata) =>
        Logger.log("debug", message, metadata),

      warn: (message, metadata) =>
        Logger.log("warn", message, metadata),

      fatal: (message, error, metadata) =>
        Effect.gen(function* () {
          const enrichedMetadata = {
            ...metadata,
            ...(error && {
              errorName: error.name,
              errorMessage: error.message,
              errorStack: error.stack
            })
          }
          yield* Logger.log("fatal", message, enrichedMetadata)
        }),

      flush: () =>
        Effect.void // バッファリングされたログを強制出力（実装に応じて）
    })
  })
)

// 構造化ログ用のヘルパー
const createStructuredLogger = (serviceName: string) =>
  Effect.gen(function* () {
    const logger = yield* Logger

    return {
      logOperation: <A, E>(
        operationName: string,
        operation: Effect.Effect<A, E>
      ) =>
        Effect.gen(function* () {
          yield* logger.info(`Starting ${operationName}`, { service: serviceName, operation: operationName })

          const result = yield* operation.pipe(
            Effect.catchAll(error => {
              return logger.error(`Failed ${operationName}`, error instanceof Error ? error : undefined, {
                service: serviceName,
                operation: operationName
              }).pipe(
                Effect.andThen(Effect.fail(error))
              )
            }),
            Effect.tap(() =>
              logger.info(`Completed ${operationName}`, { service: serviceName, operation: operationName })
            )
          )

          return result
        })
    }
  })
```

### 2. クラス型サービス

```typescript
class ConfigService {
  constructor(
    private readonly config: {
      readonly database: DatabaseConfig
      readonly server: ServerConfig
    }
  ) {}

  getDatabaseConfig = () => Effect.succeed(this.config.database)
  getServerConfig = () => Effect.succeed(this.config.server)
}

class Config extends Context.Tag("Config")<Config, ConfigService>() {}

const ConfigLive = Layer.effect(
  Config,
  Effect.gen(function* () {
    const config = yield* loadConfigFromFile("app.json")
    return new ConfigService(config)
  })
)
```

### 3. ファクトリーパターン

```typescript
interface HttpClientFactory {
  readonly create: (baseUrl: string) => HttpClient
  readonly createWithAuth: (baseUrl: string, token: string) => HttpClient
}

class HttpClientFactory extends Context.Tag("HttpClientFactory")<
  HttpClientFactory,
  HttpClientFactory
>() {}

const HttpClientFactoryLive = Layer.succeed(HttpClientFactory, {
  create: (baseUrl: string) => new HttpClient({ baseUrl }),
  createWithAuth: (baseUrl: string, token: string) =>
    new HttpClient({ baseUrl, headers: { Authorization: `Bearer ${token}` } })
})
```

## Layer合成パターン

### 1. 基本的なLayer合成

```typescript
// 複数のLayerを組み合わせる
const AppLayer = Layer.mergeAll(
  LoggerLive,
  ConfigLive,
  DatabaseServiceLive,
  UserServiceLive
)

// 依存関係のあるLayerの提供
const UserServiceWithDependencies = UserServiceLive.pipe(
  Layer.provide(DatabaseServiceLive),
  Layer.provide(ConfigLive)
)
```

### 2. Layer階層の管理

```typescript
// インフラストラクチャ層
const InfraLayer = Layer.mergeAll(
  LoggerLive,
  ConfigLive,
  DatabaseServiceLive
)

// ドメイン層
const DomainLayer = Layer.mergeAll(
  UserServiceLive,
  OrderServiceLive,
  PaymentServiceLive
).pipe(Layer.provide(InfraLayer))

// アプリケーション層
const ApplicationLayer = Layer.mergeAll(
  UserUseCaseLive,
  OrderUseCaseLive
).pipe(Layer.provide(DomainLayer))
```

### 3. 条件付きLayer提供

```typescript
const createAppLayer = (env: "development" | "production") => {
  const baseLayer = Layer.mergeAll(ConfigLive, LoggerLive)

  const dbLayer = env === "development"
    ? InMemoryDatabaseLive
    : PostgresDatabaseLive

  return Layer.mergeAll(baseLayer, dbLayer, UserServiceLive)
}
```

## テスト時のモック作成

### 1. モックサービスの作成

```typescript
// テスト用のモック実装
const MockUserService = Layer.succeed(UserService, {
  findById: (id: string) => Effect.succeed({
    id,
    name: "Test User",
    email: "test@example.com"
  }),
  create: (user: CreateUser) => Effect.succeed({
    ...user,
    id: "mock-id"
  })
})

// テストでの使用
const testProgram = Effect.gen(function* () {
  const userService = yield* UserService
  const user = yield* userService.findById("123")
  return user
}).pipe(Effect.provide(MockUserService))
```

### 2. 部分的なモック

```typescript
// 一部だけモックして他は実際の実装を使用
const PartialMockLayer = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const realService = yield* UserService

    return {
      ...realService,
      // findByIdだけモック化
      findById: (id: string) => Effect.succeed(mockUser)
    }
  })
).pipe(Layer.provide(UserServiceLive))
```

### 3. テストフィクスチャの活用

```typescript
const createTestFixture = <R, E, A>(
  program: Effect.Effect<A, E, R>,
  overrides: Partial<Layer.Layer<R, never, never>> = {}
) => {
  const baseTestLayer = Layer.mergeAll(
    MockUserService,
    MockDatabaseService,
    MockLoggerService
  )

  const testLayer = Object.keys(overrides).length > 0
    ? Layer.mergeAll(baseTestLayer, ...Object.values(overrides))
    : baseTestLayer

  return Effect.provide(program, testLayer)
}
```

## 実装例

### 例1: シンプルなサービス定義

```typescript
import { Context, Effect, Layer } from "effect"

// データベース設定
interface DatabaseConfig {
  readonly host: string
  readonly port: number
  readonly database: string
}

// データベースサービス
class Database extends Context.Tag("Database")<
  Database,
  {
    readonly connect: () => Effect.Effect<void>
    readonly disconnect: () => Effect.Effect<void>
    readonly query: <T>(sql: string) => Effect.Effect<T[]>
  }
>() {}

// 実装
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config

    return {
      connect: () => Effect.logInfo(`Connecting to ${config.database}`),
      disconnect: () => Effect.logInfo("Disconnecting from database"),
      query: <T>(sql: string) => Effect.succeed([] as T[])
    }
  })
)
```

### 例2: HTTPミドルウェア実装

```typescript
import { HttpApiMiddleware, HttpApiSchema } from "@effect/platform"
import { Context, Effect, Layer, Redacted } from "effect"

// 認証サービス
class AuthService extends Context.Tag("AuthService")<
  AuthService,
  {
    readonly verifyToken: (token: string) => Effect.Effect<User>
    readonly hasPermission: (user: User, resource: string) => Effect.Effect<boolean>
  }
>() {}

// 現在のユーザーコンテキスト
class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

// 認証ミドルウェア
class Authentication extends HttpApiMiddleware.Tag<Authentication>()(
  "Authentication",
  {
    provides: CurrentUser,
    failure: UnauthorizedError
  }
) {}

// ミドルウェア実装
const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const authService = yield* AuthService

    return (bearerToken: Redacted.Redacted) =>
      Effect.gen(function* () {
        const token = Redacted.value(bearerToken)
        const user = yield* authService.verifyToken(token)
        return user
      })
  })
).pipe(Layer.provide(AuthServiceLive))
```

### 例3: リポジトリパターン

```typescript
// エンティティ
interface User {
  readonly id: string
  readonly name: string
  readonly email: string
}

// リポジトリインターフェース
interface UserRepository {
  readonly save: (user: User) => Effect.Effect<User>
  readonly findById: (id: string) => Effect.Effect<Option.Option<User>>
  readonly findAll: () => Effect.Effect<ReadonlyArray<User>>
  readonly delete: (id: string) => Effect.Effect<void>
}

class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  UserRepository
>() {}

// インメモリ実装
const InMemoryUserRepository = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const users = yield* Ref.make<Map<string, User>>(new Map())

    return {
      save: (user: User) =>
        Ref.update(users, map => map.set(user.id, user)).pipe(
          Effect.as(user)
        ),
      findById: (id: string) =>
        Ref.get(users).pipe(
          Effect.map(map => Option.fromNullable(map.get(id)))
        ),
      findAll: () =>
        Ref.get(users).pipe(
          Effect.map(map => Array.from(map.values()))
        ),
      delete: (id: string) =>
        Ref.update(users, map => {
          map.delete(id)
          return map
        }).pipe(Effect.asVoid)
    }
  })
)
```

### 例4: 設定管理

```typescript
// 設定スキーマ
const AppConfig = Schema.Struct({
  server: Schema.Struct({
    port: Schema.Number,
    host: Schema.String
  }),
  database: Schema.Struct({
    url: Schema.String,
    maxConnections: Schema.Number
  }),
  logging: Schema.Struct({
    level: Schema.Literal("debug", "info", "warn", "error")
  })
})

type AppConfig = Schema.Schema.Type<typeof AppConfig>

// 設定サービス
class Config extends Context.Tag("Config")<Config, AppConfig>() {}

// 設定の読み込み
const ConfigLive = Layer.effect(
  Config,
  Effect.gen(function* () {
    const configData = yield* Effect.sync(() =>
      JSON.parse(process.env.APP_CONFIG || "{}")
    )
    return yield* Schema.decodeUnknown(AppConfig)(configData)
  })
)
```

### 例5: イベント駆動アーキテクチャ

```typescript
// イベントタイプ
type DomainEvent =
  | { readonly _tag: "UserCreated"; readonly user: User }
  | { readonly _tag: "UserUpdated"; readonly user: User }
  | { readonly _tag: "UserDeleted"; readonly userId: string }

// イベントバス
interface EventBus {
  readonly publish: (event: DomainEvent) => Effect.Effect<void>
  readonly subscribe: (
    handler: (event: DomainEvent) => Effect.Effect<void>
  ) => Effect.Effect<void>
}

class EventBus extends Context.Tag("EventBus")<EventBus, EventBus>() {}

// イベントバス実装
const EventBusLive = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const handlers = yield* Ref.make<Array<(event: DomainEvent) => Effect.Effect<void>>>([])

    return {
      publish: (event: DomainEvent) =>
        Ref.get(handlers).pipe(
          Effect.flatMap(handlerList =>
            Effect.all(handlerList.map(handler => handler(event)), { concurrency: "unbounded" })
          ),
          Effect.asVoid
        ),
      subscribe: (handler: (event: DomainEvent) => Effect.Effect<void>) =>
        Ref.update(handlers, list => [...list, handler]).pipe(Effect.asVoid)
    }
  })
)

// イベント発行を含むサービス
const UserServiceWithEvents = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const repository = yield* UserRepository
    const eventBus = yield* EventBus

    return {
      create: (userData: CreateUser) =>
        Effect.gen(function* () {
          const user = yield* repository.save({ ...userData, id: generateId() })
          yield* eventBus.publish({ _tag: "UserCreated", user })
          return user
        }),
      update: (id: string, updates: Partial<User>) =>
        Effect.gen(function* () {
          const existingUser = yield* repository.findById(id)
          const updatedUser = { ...existingUser, ...updates }
          yield* repository.save(updatedUser)
          yield* eventBus.publish({ _tag: "UserUpdated", user: updatedUser })
          return updatedUser
        })
    }
  })
).pipe(
  Layer.provide(UserRepository),
  Layer.provide(EventBusLive)
)
```

## まとめ

Effect-TS Context APIを使用することで：

1. **型安全な依存性注入**: コンパイル時に依存関係を検証
2. **モジュラーな設計**: サービスを独立して定義・テスト
3. **柔軟なLayer合成**: 複雑な依存関係グラフを簡単に構築
4. **優れたテスタビリティ**: モック実装への簡単な切り替え
5. **実行時安全性**: 依存関係の不整合を実行前に検出

これらの機能により、保守性が高く、テストしやすい、スケーラブルなアプリケーションを構築できます。