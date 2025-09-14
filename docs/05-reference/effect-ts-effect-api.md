---
title: "Effect-TS Effect APIリファレンス - Effect型完全ガイド"
description: "Effect-TS Effect APIの完全リファレンス。Effect型の作成、合成、実行、エラーハンドリング、並行処理パターン。"
category: "reference"
difficulty: "intermediate"
tags: ["effect-ts", "effect-api", "functional-programming", "async", "error-handling"]
prerequisites: ["effect-ts-basics"]
estimated_reading_time: "35分"
dependencies: []
status: "complete"
---

# Effect-TS Effect API リファレンス

## 概要

Effect型は、Effect-TSフレームワークの中核となる型で、副作用、エラー、依存関係を型安全に管理するためのモナディック構造です。

### Effect型の定義

```typescript
Effect<A, E, R>
```

**型パラメータ**:
- `A`: 成功時の戻り値の型
- `E`: エラー時の型（失敗の型）
- `R`: 実行に必要な環境・依存関係の型

この3つの型パラメータにより、Effectは実行可能な計算を完全に記述します。

## 基本操作

### Effect.gen - 手続き的記述

`Effect.gen`はgenerator構文を使用して、Effect操作を手続き的に記述できます：

```typescript
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // yield* でEffect値を取り出し
  const user = yield* fetchUser("123")
  const profile = yield* fetchProfile(user.id)

  // 通常のTypeScript値として扱える
  return {
    name: user.name,
    email: profile.email
  }
})
```

### Effect.succeed / Effect.fail - 基本的なEffect作成

```typescript
// 成功値を持つEffectを作成
const successEffect = Effect.succeed(42)
// Type: Effect<number, never, never>

// 失敗値を持つEffectを作成
const failureEffect = Effect.fail("Something went wrong")
// Type: Effect<never, string, never>

// 同期的な計算をEffectに変換
const syncEffect = Effect.sync(() => Math.random())
// Type: Effect<number, never, never>
```

### pipe - 関数合成

`pipe`を使用してEffect操作をチェーンできます：

```typescript
import { pipe } from "effect"

const result = pipe(
  Effect.succeed(42),
  Effect.map(x => x * 2),
  Effect.flatMap(x => Effect.succeed(x.toString()))
)
```

### map - 値の変換

成功値を変換する場合に使用：

```typescript
const doubled = pipe(
  Effect.succeed(21),
  Effect.map(x => x * 2) // Effect<number, never, never>
)
```

### flatMap - Effect操作のチェーン

Effect操作を連鎖させる場合に使用：

```typescript
const fetchUserData = (id: string) => pipe(
  fetchUser(id),
  Effect.flatMap(user => fetchProfile(user.profileId)),
  Effect.map(profile => ({ user, profile }))
)
```

## 並列処理

### Effect.all - 並列実行

複数のEffectを並列で実行：

```typescript
// 配列の場合
const results = Effect.all([
  fetchUser("1"),
  fetchUser("2"),
  fetchUser("3")
]) // Effect<[User, User, User], FetchError, UserService>

// オブジェクトの場合
const data = Effect.all({
  user: fetchUser("123"),
  posts: fetchPosts("123"),
  comments: fetchComments("123")
}) // Effect<{user: User, posts: Post[], comments: Comment[]}, ...>

// 並列度を制御
const controlledResults = Effect.all(
  [fetchUser("1"), fetchUser("2"), fetchUser("3")],
  { concurrency: 2 } // 最大2つまで並列実行
)
```

### Effect.forEach - 配列の並列処理

配列の各要素に対してEffect操作を並列実行：

```typescript
const userIds = ["1", "2", "3"]

// デフォルトは並列実行
const users = Effect.forEach(userIds, id => fetchUser(id))

// 並列度を制限（最大2つまで同時実行）
const limitedUsers = Effect.forEach(
  userIds,
  id => fetchUser(id),
  { concurrency: 2 }
)

// 順次実行
const sequentialUsers = Effect.forEach(
  userIds,
  id => fetchUser(id),
  { concurrency: 1 }
)
```

## エラー処理

### catchAll - 全エラーのハンドリング

```typescript
const safeOperation = pipe(
  riskyOperation(),
  Effect.catchAll(error => {
    console.error("エラーが発生:", error)
    return Effect.succeed("デフォルト値")
  })
)

// またはEffect.genを使用
const safeOperationGen = Effect.gen(function* () {
  const result = yield* riskyOperation().pipe(
    Effect.catchAll(error => {
      console.error("エラーが発生:", error)
      return Effect.succeed("デフォルト値")
    })
  )
  return result
})
```

### catchTag - 特定エラーのハンドリング

```typescript
class NetworkError extends Schema.TaggedError<NetworkError>()("NetworkError", {
  message: Schema.String
}) {}

class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  field: Schema.String
}) {}

// 個別のcatchTagを使用
const handleSpecificErrors = pipe(
  operation(),
  Effect.catchTag("NetworkError", error =>
    Effect.succeed("ネットワークエラーを回復")
  ),
  Effect.catchTag("ValidationError", error =>
    Effect.fail(new Error(`バリデーションエラー: ${error.field}`))
  )
)

// catchTagsでまとめて処理
const handleMultipleErrors = pipe(
  operation(),
  Effect.catchTags({
    NetworkError: error => Effect.succeed("ネットワークエラーを回復"),
    ValidationError: error => Effect.fail(new Error(`バリデーションエラー: ${error.field}`))
  })
)
```

### retry - リトライ戦略

```typescript
import { Schedule } from "effect"

// 基本的なリトライ
const simpleRetry = pipe(
  unstableOperation(),
  Effect.retry(Schedule.recurs(3)) // 3回まで再試行
)

// 指数バックオフでリトライ
const exponentialRetry = pipe(
  unstableOperation(),
  Effect.retry(
    Schedule.exponential("100 millis").pipe(
      Schedule.intersect(Schedule.recurs(3))
    )
  )
)

// 条件付きリトライ
const conditionalRetry = pipe(
  unstableOperation(),
  Effect.retry(
    Schedule.recurWhile((error: unknown) =>
      error instanceof NetworkError
    )
  )
)
```

## リソース管理

### acquireRelease - リソースの安全な取得と解放

```typescript
// 基本的なリソース管理
const safeFileOperation = Effect.acquireRelease(
  // リソース取得
  Effect.sync(() => fs.openSync("file.txt", "r")),
  // リソース解放（必ず実行される）
  (fd, exit) => Effect.sync(() => fs.closeSync(fd))
).pipe(
  Effect.flatMap(fd =>
    // リソース使用
    Effect.sync(() => fs.readFileSync(fd, "utf8"))
  )
)

// acquireUseReleaseパターン
const acquireUseReleaseExample = Effect.acquireUseRelease(
  // acquire
  Effect.sync(() => fs.openSync("file.txt", "r")),
  // use
  (fd) => Effect.sync(() => fs.readFileSync(fd, "utf8")),
  // release
  (fd, exit) => Effect.sync(() => fs.closeSync(fd))
)
```

### scoped - スコープベースリソース管理

```typescript
import { Context, Layer } from "effect"

class DatabaseConnection extends Context.Tag("DatabaseConnection")<
  DatabaseConnection,
  {
    query: (sql: string) => Effect.Effect<Row[], DatabaseError>
  }
>() {}

const DatabaseLive = Layer.scoped(
  DatabaseConnection,
  Effect.gen(function* () {
    const connection = yield* Effect.acquireRelease(
      Effect.sync(() => new Database("connection-string")),
      (db) => Effect.sync(() => db.close())
    )

    return {
      query: (sql: string) =>
        Effect.tryPromise({
          try: () => connection.query(sql),
          catch: error => new DatabaseError({ cause: error })
        })
    }
  })
)
```

### tap - 副作用の実行

値を変更せずに副作用を実行：

```typescript
const loggedOperation = pipe(
  fetchUser("123"),
  Effect.tap(user => Effect.log(`取得したユーザー: ${user.name}`)),
  Effect.map(user => user.email)
)

// 複数のtapをチェーン
const multipleActions = pipe(
  computation(),
  Effect.tap(result => Effect.log(`計算結果: ${result}`)),
  Effect.tap(result => validateResult(result)),
  Effect.tap(result => cacheResult(result))
)
```

### andThen - 操作の連鎖

```typescript
// 結果を無視して次の操作を実行
const sequence = pipe(
  initializeSystem(),
  Effect.andThen(loadConfiguration()),
  Effect.andThen(startServices())
)

// 結果を使用して次の操作を実行（flatMapと同じ）
const transform = pipe(
  fetchUser("123"),
  Effect.andThen(user => fetchProfile(user.id))
)
```

## 実装例

### 1. ユーザー認証システム

```typescript
import { Effect, Schema, Context } from "effect"

class AuthError extends Schema.TaggedError<AuthError>()("AuthError", {
  reason: Schema.Literal("invalid-credentials", "user-not-found", "token-expired")
}) {}

class UserService extends Context.Tag("UserService")<
  UserService,
  {
    authenticate: (token: string) => Effect.Effect<User, AuthError>
    findById: (id: string) => Effect.Effect<User, AuthError>
  }
>() {}

const authenticateUser = (token: string) =>
  Effect.gen(function* () {
    const userService = yield* UserService
    const user = yield* userService.authenticate(token)

    // 追加のバリデーション
    if (!user.isActive) {
      yield* Effect.fail(new AuthError({ reason: "user-not-found" }))
    }

    return user
  })
```

### 2. 並列データ取得とキャッシュ

```typescript
import { Effect, Cache, Duration } from "effect"

class ApiService extends Context.Tag("ApiService")<
  ApiService,
  {
    fetchUser: (id: string) => Effect.Effect<User, ApiError>
    fetchPosts: (userId: string) => Effect.Effect<Post[], ApiError>
  }
>() {}

const makeUserProfileService = Effect.gen(function* () {
  const api = yield* ApiService

  // キャッシュを作成（5分間有効）
  const userCache = yield* Cache.make({
    capacity: 100,
    timeToLive: Duration.minutes(5),
    lookup: (id: string) => api.fetchUser(id)
  })

  return {
    getUserProfile: (id: string) =>
      Effect.gen(function* () {
        // 並列でユーザーとポストを取得
        const [user, posts] = yield* Effect.all([
          Cache.get(userCache, id),
          api.fetchPosts(id)
        ])

        return {
          user,
          posts,
          postCount: posts.length
        }
      })
  }
})
```

### 3. バッチ処理システム

```typescript
import { Effect, Queue, Fiber } from "effect"

const batchProcessor = <A, E, R>(
  processor: (items: A[]) => Effect.Effect<void, E, R>,
  batchSize: number = 10,
  timeout: Duration.Duration = Duration.seconds(5)
) =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<A>()
    const batch: A[] = []

    const processBatch = Effect.gen(function* () {
      if (batch.length > 0) {
        const items = batch.splice(0, batch.length)
        yield* processor(items)
      }
    })

    // バッチ処理ループ
    const batchLoop = Effect.gen(function* () {
      while (true) {
        const item = yield* Queue.take(queue).pipe(
          Effect.timeout(timeout),
          Effect.catchAll(() => Effect.succeed(null))
        )

        if (item) {
          batch.push(item)
        }

        if (batch.length >= batchSize || !item) {
          yield* processBatch
        }
      }
    })

    const fiber = yield* Effect.fork(batchLoop)

    return {
      add: (item: A) => Queue.offer(queue, item),
      shutdown: Effect.interrupt(fiber)
    }
  })
```

### 4. 設定ベースのサービス初期化

```typescript
import { Config, Layer } from "effect"

class DatabaseConfig extends Schema.Struct({
  host: Schema.String,
  port: Schema.Number,
  database: Schema.String,
  maxConnections: Schema.Number.pipe(Schema.optional)
}) {}

const DatabaseConfigLive = Config.all({
  host: Config.string("DB_HOST"),
  port: Config.number("DB_PORT"),
  database: Config.string("DB_NAME"),
  maxConnections: Config.number("DB_MAX_CONNECTIONS").pipe(
    Config.withDefault(10)
  )
})

const DatabaseServiceLive = Layer.effect(
  DatabaseService,
  Effect.gen(function* () {
    const config = yield* DatabaseConfigLive
    const pool = yield* createConnectionPool(config)

    return {
      query: (sql: string) =>
        Effect.gen(function* () {
          const connection = yield* pool.acquire()
          const result = yield* Effect.tryPromise({
            try: () => connection.query(sql),
            catch: error => new DatabaseError({ cause: error })
          })
          yield* pool.release(connection)
          return result
        })
    }
  })
)
```

### 5. ストリーミング処理

```typescript
import { Stream, Sink } from "effect"

const processLargeDataset = (source: Stream.Stream<Data, DataError, DataSource>) =>
  source.pipe(
    // データを変換
    Stream.map(data => transform(data)),

    // エラーを処理
    Stream.catchAll(error =>
      Stream.fromEffect(
        Effect.logError(`データ処理エラー: ${error.message}`)
      ).pipe(Stream.drain)
    ),

    // バッチでグループ化
    Stream.grouped(100),

    // データベースに保存
    Stream.mapEffect(batch =>
      Effect.gen(function* () {
        const db = yield* DatabaseService
        yield* db.insertBatch(batch)
        yield* Effect.log(`${batch.length}件のデータを保存`)
      })
    ),

    // 結果をカウント
    Stream.runFold(0, (acc, _) => acc + 1)
  )
```

## パフォーマンス最適化のヒント

### 1. 適切な並列度の設定

```typescript
// CPUバウンドなタスクの場合
const cpuTasks = Effect.forEach(
  items,
  processItem,
  { concurrency: "unbounded" } // または具体的な数値
)

// I/Oバウンドなタスクの場合
const ioTasks = Effect.forEach(
  items,
  fetchItem,
  { concurrency: 10 } // リソースに応じて調整
)
```

### 2. キャッシュの活用

```typescript
const cachedService = Effect.gen(function* () {
  const cache = yield* Cache.make({
    capacity: 1000,
    timeToLive: Duration.hours(1),
    lookup: expensiveOperation
  })

  return {
    get: (key: string) => Cache.get(cache, key)
  }
})
```

### 3. リソースプールの使用

```typescript
const pooledService = Effect.gen(function* () {
  const pool = yield* Pool.make({
    acquire: createExpensiveResource,
    size: 10
  })

  return {
    useResource: <A>(operation: (resource: Resource) => Effect.Effect<A>) =>
      Pool.get(pool).pipe(
        Effect.flatMap(operation),
        Effect.ensuring(Pool.invalidate(pool, resource))
      )
  }
})
```

### 4. メモ化による計算の最適化

```typescript
const memoizedComputation = Effect.memoize(
  (input: ComplexInput) => expensiveComputation(input)
)

const optimizedProcess = Effect.gen(function* () {
  const compute = yield* memoizedComputation

  // 同じ入力に対する計算は再利用される
  const result1 = yield* compute(input)
  const result2 = yield* compute(input) // キャッシュから取得

  return [result1, result2]
})
```

### 5. Effect.exit - 結果の詳細な制御

```typescript
// 成功・失敗に関係なく結果をExitとして取得
const safeExecution = Effect.gen(function* () {
  const exit = yield* Effect.exit(riskyOperation())

  if (Exit.isSuccess(exit)) {
    console.log("成功:", exit.value)
    return exit.value
  } else {
    console.error("失敗:", exit.cause)
    return null
  }
})

// テストでの使用例
const testResult = Effect.gen(function* () {
  const exit = yield* Effect.exit(divide(4, 2))
  expect(exit).toStrictEqual(Exit.succeed(2))
})
```

## まとめ

Effect-TSのEffect型は、型安全で構成可能な副作用管理を提供します。`Effect.gen`による手続き的記述、`pipe`による関数合成、豊富な並列処理・エラー処理・リソース管理の機能により、堅牢で保守性の高いアプリケーションを構築できます。

適切なパフォーマンス最適化手法を組み合わせることで、スケーラブルで効率的なシステムを実現できます。