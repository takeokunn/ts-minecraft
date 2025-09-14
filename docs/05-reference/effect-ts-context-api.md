---
title: "Effect-TS Context APIリファレンス - 依存性注入完全ガイド"
description: "Effect-TS Context APIの完全リファレンス。軽量で型安全な依存性注入、Layerシステム、モジュラー設計。"
category: "reference"
difficulty: "intermediate"
tags: ["effect-ts", "context", "dependency-injection", "layer", "modular-design"]
prerequisites: ["effect-ts-basics"]
estimated_reading_time: "25分"
dependencies: []
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

### Context.GenericTag

Effect-TS 3.17+では、`Context.GenericTag`を使用してサービスタグを定義します。

```typescript
import { Context } from "effect"

// 基本的なサービスタグの定義
class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly findById: (id: string) => Effect.Effect<User>
    readonly create: (user: CreateUser) => Effect.Effect<User>
  }
>() {}

// より複雑なサービスの例
class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly query: <T>(sql: string, params?: unknown[]) => Effect.Effect<T[]>
    readonly transaction: <T>(fn: () => Effect.Effect<T>) => Effect.Effect<T>
  }
>() {}
```

### Layer.effect

サービスの実装をLayerとして定義します。

```typescript
import { Effect, Layer } from "effect"

// UserServiceの実装
const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* DatabaseService

    return {
      findById: (id: string) =>
        db.query("SELECT * FROM users WHERE id = ?", [id]).pipe(
          Effect.map(rows => rows[0] as User)
        ),
      create: (user: CreateUser) =>
        db.query("INSERT INTO users ...", [user]).pipe(
          Effect.map(() => ({ ...user, id: generateId() }))
        )
    }
  })
)
```

## サービス定義パターン

### 1. インターフェース型サービス

```typescript
interface LoggerService {
  readonly log: (message: string) => Effect.Effect<void>
  readonly error: (error: Error) => Effect.Effect<void>
  readonly debug: (message: string) => Effect.Effect<void>
}

class Logger extends Context.Tag("Logger")<Logger, LoggerService>() {}

// 実装
const LoggerLive = Layer.effect(
  Logger,
  Effect.succeed({
    log: (message: string) => Effect.logInfo(message),
    error: (error: Error) => Effect.logError(error.message),
    debug: (message: string) => Effect.logDebug(message)
  })
)
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