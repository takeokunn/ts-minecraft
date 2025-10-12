# Effect-TS移行ガイド

## 概要

このガイドは、従来のTypeScriptコードをEffect-TS準拠に移行するための実践的な手順を提供します。プロジェクトで実際に実施した移行パターンを基に、具体的なBefore/After例を示します。

## 🎯 移行フロー

### Phase 1: エラー定義のSchema.TaggedError化

**対象**: `throw new Error`・`Promise.reject`・エラークラス

**手順**:

1. Schema.TaggedStruct定義
2. エラー型エクスポート
3. Factory関数作成
4. 型ガード関数追加
5. 既存コード更新

### Phase 2: Promise→Effectへの変換

**対象**: `async/await`・`Promise<T>`・`.then()/.catch()`

**手順**:

1. Promise返却関数をEffect返却に変更
2. `async/await` → `Effect.gen` + `yield*`
3. `.then()` → `Effect.flatMap`
4. `.catch()` → `Effect.catchAll`

### Phase 3: Layer/Service設計

**対象**: グローバル変数・シングルトン・DIコンテナ

**手順**:

1. Service interface定義
2. Layer実装
3. Context.Tag定義
4. 依存性注入

### Phase 4: テストのTestServices対応

**対象**: テストコード

**手順**:

1. TestContext導入
2. TestClock/TestRandom適用
3. Mock Layer作成

## 📝 パターン別移行例

### Pattern 1: throw → Effect.fail

#### Before

```typescript
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero')
  }
  return a / b
}
```

#### After

```typescript
import { Effect, Schema } from 'effect'

class DivisionByZeroError extends Schema.TaggedError<DivisionByZeroError>()('DivisionByZero', {
  dividend: Schema.Number,
  divisor: Schema.Number,
}) {}

const divide = (a: number, b: number): Effect.Effect<number, DivisionByZeroError> =>
  b === 0 ? Effect.fail(new DivisionByZeroError({ dividend: a, divisor: b })) : Effect.succeed(a / b)
```

**プロジェクト実装例**: [Camera Aggregate Errors](../../src/domain/camera/aggregate/errors.ts)

### Pattern 2: Promise → Effect

#### Before

```typescript
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`)
    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch user: ${error}`)
  }
}
```

#### After

```typescript
import { Effect, Schema } from 'effect'

class UserFetchError extends Schema.TaggedError<UserFetchError>()('UserFetchError', {
  userId: Schema.String,
  cause: Schema.Unknown,
}) {}

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})
type User = Schema.Schema.Type<typeof UserSchema>

const fetchUser = (id: string): Effect.Effect<User, UserFetchError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(`/api/users/${id}`),
      catch: (error) => new UserFetchError({ userId: id, cause: error }),
    })

    const data = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) => new UserFetchError({ userId: id, cause: error }),
    })

    return yield* Schema.decodeUnknown(UserSchema)(data).pipe(
      Effect.mapError((error) => new UserFetchError({ userId: id, cause: error }))
    )
  })
```

**プロジェクト実装例**: [Chunk Serializer](../../src/domain/chunk/domain_service/chunk_serializer/service.ts)

### Pattern 3: class → Service

#### Before

```typescript
class Logger {
  private prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  log(message: string): void {
    console.log(`[${this.prefix}] ${message}`)
  }
}

const logger = new Logger('App')
logger.log('Started')
```

#### After

```typescript
import { Effect, Context, Layer } from 'effect'

// Service interface
interface Logger {
  readonly log: (message: string) => Effect.Effect<void>
}

// Context.Tag
const Logger = Context.GenericTag<Logger>('Logger')

// Live implementation
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    return Logger.of({
      log: (message) => Effect.logInfo(message),
    })
  })
)

// Usage
const program = Effect.gen(function* () {
  const logger = yield* Logger
  yield* logger.log('Started')
})

Effect.runPromise(program.pipe(Effect.provide(LoggerLive)))
```

**プロジェクト実装例**: [Camera Services](../../src/domain/camera/service.ts)

### Pattern 4: JSON.parse → Schema.parseJson

#### Before

```typescript
function parseConfig(jsonString: string): Config {
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    throw new Error(`Invalid JSON: ${error}`)
  }
}
```

#### After

```typescript
import { Effect, Schema } from 'effect'

const ConfigSchema = Schema.Struct({
  apiUrl: Schema.String,
  timeout: Schema.Number,
})
type Config = Schema.Schema.Type<typeof ConfigSchema>

class ConfigParseError extends Schema.TaggedError<ConfigParseError>()('ConfigParseError', {
  input: Schema.String,
  cause: Schema.Unknown,
}) {}

const parseConfig = (jsonString: string): Effect.Effect<Config, ConfigParseError> =>
  Schema.parseJson(ConfigSchema)(jsonString).pipe(
    Effect.mapError((error) => new ConfigParseError({ input: jsonString, cause: error }))
  )
```

**プロジェクト実装例**: [Inventory Storage Schema](../../src/domain/inventory/repository/inventory_repository/storage_schema.ts)

### Pattern 5: Math.random → Random Service

#### Before

```typescript
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
```

#### After

```typescript
import { Effect, Random } from 'effect'

const randomInt = (min: number, max: number): Effect.Effect<number> => Random.nextIntBetween(min, max + 1)
```

**プロジェクト実装例**: [Biome Classification](../../src/domain/biome/domain_service/biome_classification/climate_calculator.ts)

### Pattern 6: Date.now → Clock Service

#### Before

```typescript
function getTimestamp(): number {
  return Date.now()
}
```

#### After

```typescript
import { Effect, Clock } from 'effect'

const getTimestamp = (): Effect.Effect<number> => Clock.currentTimeMillis
```

**プロジェクト実装例**: [World Generation Session](../../src/domain/world_generation/aggregate/generation_session/session_state.ts)

### Pattern 7: console.log → Effect.log\*

#### Before

```typescript
function processData(data: Data): void {
  console.log('Processing data:', data)
  // ...
  console.error('Failed to process data')
}
```

#### After

```typescript
import { Effect } from 'effect'

const processData = (data: Data): Effect.Effect<void, ProcessError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo('Processing data', { data })
    // ...
    yield* Effect.logError('Failed to process data')
  })
```

**プロジェクト実装例**: [World Generation Orchestrator](../../src/domain/world_generation/domain_service/world_generation_orchestrator/orchestrator.ts)

### Pattern 8: Data.TaggedError → Schema.TaggedStruct

#### Before

```typescript
export class WorldNotFoundError extends Data.TaggedError('WorldNotFoundError')<{
  readonly worldId: WorldId
}> {
  get message() {
    return `World not found: ${this.worldId}`
  }
}
```

#### After

```typescript
import { Schema, Effect } from 'effect'

// Schema定義
export const WorldNotFoundErrorSchema = Schema.TaggedStruct('WorldNotFoundError', {
  worldId: WorldIdSchema,
})

// 型エクスポート
export type WorldNotFoundError = Schema.Schema.Type<typeof WorldNotFoundErrorSchema>

// メッセージ関数
export const getWorldNotFoundErrorMessage = (error: WorldNotFoundError): string => `World not found: ${error.worldId}`

// Factory関数
export const createWorldNotFoundError = (worldId: WorldId): Effect.Effect<WorldNotFoundError, Schema.ParseError> =>
  Schema.decode(WorldNotFoundErrorSchema)({
    _tag: 'WorldNotFoundError' as const,
    worldId,
  })

// 型ガード
export const isWorldNotFoundError = (error: unknown): error is WorldNotFoundError =>
  Schema.is(WorldNotFoundErrorSchema)(error)
```

**プロジェクト実装例**: [World Errors](../../src/domain/world/types/errors/world_errors.ts)

### Pattern 9: Option.getOrElse → Effect化

#### Before

```typescript
import { Option } from 'effect'

function getUserName(user: Option.Option<User>): string {
  return Option.getOrElse(user, () => 'Anonymous').name
}
```

#### After

```typescript
import { Effect, Option } from 'effect'

class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()('UserNotFoundError', {}) {}

const getUserName = (user: Option.Option<User>): Effect.Effect<string, UserNotFoundError> =>
  Option.match(user, {
    onNone: () => Effect.fail(new UserNotFoundError()),
    onSome: (u) => Effect.succeed(u.name),
  })
```

**プロジェクト実装例**: [Chunk Repository Strategy](../../src/domain/chunk/repository/strategy/config_builder_functions.ts)

### Pattern 10: for loop → Effect.forEach

#### Before

```typescript
function processItems(items: Item[]): Result[] {
  const results: Result[] = []
  for (const item of items) {
    results.push(processItem(item))
  }
  return results
}
```

#### After

```typescript
import { Effect } from 'effect'

const processItems = (items: Item[]): Effect.Effect<Result[], ProcessError> =>
  Effect.forEach(items, (item) => processItem(item))
```

**注意**: STMトランザクション内では変換不要（原子性保証のため）

**プロジェクト実装例**: [World State STM](../../src/application/world/world_state_stm.ts) - 変換不要例

## 🔧 トラブルシューティング

### 問題1: 型エラー「Effect.Effect<T, E> is not assignable to T」

**原因**: Effect返却関数をそのまま使用している

**解決策**: `Effect.gen` + `yield*` で値を取り出す

```typescript
// ❌ Bad
const result = getUserName(user) // Type: Effect.Effect<string>

// ✅ Good
const program = Effect.gen(function* () {
  const name = yield* getUserName(user) // Type: string
})
```

### 問題2: 「circular dependency」エラー

**原因**: Schema定義間の循環依存

**解決策**: `Schema.suspend` で遅延評価

```typescript
export const WorldIdSchema = Schema.suspend(() => import('../core').then((m) => m.WorldIdSchema))
```

### 問題3: 「Schema.ParseError」のハンドリング方法

**原因**: Schema.decode/parseJsonが返すエラー型

**解決策**: `Effect.mapError` でカスタムエラーに変換

```typescript
const parseConfig = (input: string): Effect.Effect<Config, ConfigError> =>
  Schema.parseJson(ConfigSchema)(input).pipe(Effect.mapError((error) => new ConfigError({ cause: error })))
```

### 問題4: テストで時間が実際にかかる

**原因**: TestClockを使用していない

**解決策**: TestContext.TestContextを提供

```typescript
import { Effect, TestContext, TestClock } from 'effect'

const test = Effect.gen(function* () {
  yield* Effect.sleep('1 minute')
  yield* TestClock.adjust('1 minute') // 実時間0秒
}).pipe(Effect.provide(TestContext.TestContext))
```

### 問題5: 「Effect<never, Error>」から回復できない

**原因**: `Effect.fail`の戻り値型が`never`

**解決策**: `Effect.gen`内で使用し、型を明示

```typescript
const program = Effect.gen(function* (): Effect.Effect<string, MyError> => {
  if (condition) {
    return yield* Effect.fail(new MyError())
  }
  return "success"
})
```

## 📊 移行チェックリスト

### エラー定義

- [ ] `throw new Error` → `Effect.fail` + `Schema.TaggedError`
- [ ] `Promise.reject` → `Effect.fail`
- [ ] `Data.TaggedError` → `Schema.TaggedStruct` + Factory関数
- [ ] エラー型のUnion定義
- [ ] 型ガード関数追加

### Promise/async

- [ ] `async function` → `Effect.gen`
- [ ] `await` → `yield*`
- [ ] `Promise<T>` → `Effect.Effect<T, E>`
- [ ] `.then()` → `Effect.flatMap`
- [ ] `.catch()` → `Effect.catchAll`

### 副作用

- [ ] `Math.random()` → `Random.next`
- [ ] `Date.now()` → `Clock.currentTimeMillis`
- [ ] `console.*` → `Effect.log*`
- [ ] `JSON.parse` → `Schema.parseJson`
- [ ] `window/navigator` → Platform Service

### Layer/Service

- [ ] グローバル変数 → Service
- [ ] `class` → `interface` + `Context.Tag`
- [ ] シングルトン → Layer
- [ ] 依存性注入 → `Effect.provide`

### テスト

- [ ] 時間依存ロジック → TestClock
- [ ] 乱数テスト → TestRandom
- [ ] Mock → Test Layer
- [ ] `Effect.provide(TestContext.TestContext)`

## 🔗 関連ドキュメント

- [Effect-TS実装ガイドライン](../how-to/development/effect-ts-guidelines.md) - 実装パターン詳細
- [Effect-TS完全準拠ガイドライン](../reference/effect-ts-compliance.md) - 禁止/推奨パターン
- [開発規約](../how-to/development/development-conventions.md) - プロジェクト規約
- [Effect-TSテストガイド](./effect-ts-fundamentals/effect-ts-testing.md) - テスト戦略

## 📚 外部リソース

- [Effect-TS公式ドキュメント](https://effect.website)
- [Effect-TS Migration Guide](https://effect.website/docs/getting-started/migration)
- [Effect Patterns Hub](https://github.com/pauljphilp/effectpatterns) - コミュニティパターン集
