# Effect-TS実装ガイドライン

## 目的

このドキュメントは、Phase1/Phase2/Phase3で確立したEffect-TSの実装パターンを統合し、プロジェクト全体で一貫した高品質なコードを保証するためのガイドラインです。

## 1. 遅延評価原則

### 1.1 Effect.runSync使用禁止

**現状**: 2箇所（目標達成、96.4%削減完了）

**原則**: `Effect.runSync`はモジュール初期化時に使用してはならない

#### ❌ 禁止パターン

```typescript
// モジュールトップレベルでの即時評価
const config = Effect.runSync(loadConfig())

export const service = {
  getData: () => Effect.runSync(fetchData()),
}
```

#### ✅ 推奨パターン

**Pattern A: Effect返却への変更**

```typescript
// Effect を返す関数パターン
export const makeConfig = (): Effect.Effect<Config, ConfigError> => loadConfig()

export const service = {
  getData: (): Effect.Effect<Data, DataError> => fetchData(),
}
```

**Pattern B: 同期版ヘルパー作成**

```typescript
// 同期版と非同期版を両方提供
export const getHelperSync = (): T => {
  /* 同期実装 */
}
export const getHelper = (): Effect.Effect<T> => Effect.succeed(getHelperSync())
```

**Pattern C: Layer統合**

```typescript
export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const config = yield* loadConfig()
    return ConfigService.of({ config })
  })
)
```

#### 例外: 意図的なヘルパー

```typescript
// 物理定数のデコード専用ヘルパー（初期化時の定数読み込みに限定）
export const decodeConstant =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (input: unknown): A =>
    Effect.runSync(decodeWith(schema)(input))
```

**条件**: 以下すべてを満たす場合のみ許容

- 定数デコード専用
- 失敗時は即座にエラーを投げる設計意図が明確
- 代替案がない

### 1.2 Schema.decodeUnknownSync禁止

**現状**: 94箇所残存（優先度：高）

#### ❌ 禁止パターン

```typescript
// モジュール初期化時の同期デコード
const config = Schema.decodeUnknownSync(ConfigSchema)(rawConfig)
```

#### ✅ 推奨パターン

```typescript
// Layer内でEffect.genを使用
export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    const config = yield* Schema.decodeUnknown(ConfigSchema)(rawConfig)
    return ConfigService.of({ config })
  })
)
```

## 2. 型安全性原則

### 2.1 unknown使用制限

**現状**: 326箇所（目標300以下達成、19.7%削減完了）

#### ✅ 正当なunknown使用

**型ガード関数（約200箇所）**

```typescript
// 型安全性の基盤
export const isPlayerInput = (value: unknown): value is PlayerInput => Schema.is(PlayerInputSchema)(value)
```

**デコーダ関数（約50箇所）**

```typescript
// 外部入力の安全な処理
export const decodeCommand = (input: unknown): Effect.Effect<Command, DecodeError> =>
  Schema.decodeUnknown(CommandSchema)(input)
```

**エラーハンドリング（約20箇所）**

```typescript
// 標準的なTypeScriptエラーハンドリング
try {
  // ...
} catch (error: unknown) {
  return Effect.fail(toErrorCause(error))
}
```

#### ❌ 削減対象のunknown

**Pattern A: ErrorCauseSchemaへの置換**

```typescript
// Before
effect: Effect.Effect<A, unknown>

// After
effect: Effect.Effect<A, E>
```

**Pattern B: JsonValue/JsonRecord型の使用**

```typescript
// Before
context?: unknown

// After
context?: JsonRecord
```

**Pattern C: 具体的な型への昇格**

```typescript
// Before
fromValue: unknown, toValue: unknown

// After
fromValue: number, toValue: number
```

**Pattern D: 未使用パラメータの削除**

```typescript
// Before
function process(data: Data, _unused: unknown) {}

// After
function process(data: Data) {}
```

### 2.2 型アサーション禁止

**原則**: `as Type`の使用は最小限に留める

#### ❌ 禁止パターン

```typescript
const data = response as UserData
```

#### ✅ 推奨パターン

```typescript
// Schema.decodeUnknownを使用
const data = yield * Schema.decodeUnknown(UserDataSchema)(response)

// Brandで型ガード
const id = yield * UserId.make(value)

// Option/Eitherで安全に変換
const result = Option.fromNullable(value)
```

## 3. Effect境界厳密化

### 3.1 console.log禁止

**現状**: 105箇所残存（目標50箇所以下）

#### ❌ 禁止パターン

```typescript
console.log('Loading data...')
console.error('Failed:', error)
```

#### ✅ 推奨パターン

```typescript
// Effect.log*を使用
yield * Effect.logDebug('Loading data...')
yield * Effect.logError('Failed:', error)

// 構造化ログ
yield * Effect.logInfo('Data loaded', { count: data.length })
```

### 3.2 Math.random禁止

**現状**: 0箇所（Phase2で完全削減達成）

#### ❌ 禁止パターン

```typescript
const value = Math.random() * 100
```

#### ✅ 推奨パターン

```typescript
// Random サービスを使用
const value = yield * Random.nextIntBetween(0, 100)
```

### 3.3 JSON.parse直接使用禁止

**現状**: 50箇所残存（目標25箇所以下）

#### ❌ 禁止パターン

```typescript
const data = JSON.parse(jsonString)
```

#### ✅ 推奨パターン

```typescript
// Schema.parseJsonを使用
const data = yield * Schema.parseJson(DataSchema)(jsonString)
```

### 3.4 throw new Error禁止

**現状**: 0箇所（Phase3で完全削減達成）

#### ❌ 禁止パターン

```typescript
throw new Error('Invalid configuration')
```

#### ✅ 推奨パターン

```typescript
// Effect.failを使用
return Effect.fail(ConfigError.invalidConfiguration('Invalid configuration'))
```

### 3.5 Duration統一化

**現状**: 0箇所（Phase3で完全削減達成）

#### ❌ 禁止パターン

```typescript
yield * Effect.sleep('500 millis')
yield * Effect.sleep('1 second')
yield * Effect.sleep(`${Math.random() * 10 + 5} millis`)
```

#### ✅ 推奨パターン

```typescript
// Duration.millis/secondsを使用
yield * Effect.sleep(Duration.millis(500))
yield * Effect.sleep(Duration.seconds(1))

// Randomと組み合わせ
const randomDelay = yield * Random.nextIntBetween(5, 15)
yield * Effect.sleep(Duration.millis(randomDelay))
```

## 4. Layer設計原則

### 4.1 Layer.effect vs Layer.scoped判断フロー

```
Layer内でリソース生成？
├─ 外部リソース（ファイル、ネットワーク、WebGL）
│  └─ ✅ Layer.scoped + Effect.acquireRelease
├─ 長時間Fiber（Effect.forever等）
│  └─ ✅ Layer.scoped + Effect.forkScoped
├─ Pool
│  └─ ✅ Layer.scoped（Poolは自動的にScoped）
├─ Ref.make
│  └─ ❌ Layer.effect（GC管理で十分）
├─ Queue.unbounded
│  └─ ❌ Layer.effect（GC管理で十分）
└─ Queue.bounded
   ├─ 実行中Effectの早期中断が必要？
   │  ├─ YES → ✅ Layer.scoped + shutdown
   │  └─ NO  → ❌ Layer.effect（GC管理で十分）
   └─ デフォルト: Layer.effect
```

### 4.2 Ref.make（GC管理）

#### ✅ Layer.effectで十分

```typescript
export const CameraStateRepositoryLive = Layer.effect(
  CameraStateRepository,
  Effect.gen(function* () {
    const storageRef = yield* Ref.make(initialState)  // ← GC管理
    return CameraStateRepository.of({
      save: (camera) => Ref.update(storageRef, ...),
      findById: (id) => Ref.get(storageRef),
    })
  })
)
```

**理由**:

- Refは不変データ構造のEffect-TS Ref型
- JavaScriptのGCで自動管理
- リソースリーク無し
- 明示的finalizerは過剰設計

### 4.3 Queue.unbounded（GC管理）

#### ✅ Layer.effectで十分

```typescript
export const AudioServiceLive = Layer.effect(
  AudioService,
  Effect.gen(function* () {
    const eventQueue = yield* Queue.unbounded() // ← GC管理
    return AudioService.of({ eventQueue })
  })
)
```

**理由**:

- Queue.unboundedは内部でJavaScriptのArrayを使用
- Layerがアンマウントされた時点でQueueオブジェクトへの参照が失われる
- JavaScriptのGCが自動的にメモリ解放
- Queue.shutdownは実行中のEffectを中断するための機能であり、メモリリーク防止ではない

### 4.4 外部リソース管理

#### ✅ Layer.scoped必須

```typescript
// WebGLコンテキスト
export const WebGLRendererServiceLive = Layer.scoped(
  WebGLRendererService,
  Effect.gen(function* () {
    const resource = yield* Resource.manual(
      Effect.acquireRelease(createRenderer(params), (renderer) => Effect.sync(() => renderer.dispose()))
    )
    return WebGLRendererService.of({ resource })
  })
)

// ファイルハンドル、ネットワーク接続も同様
```

### 4.5 長時間実行Fiber

#### ✅ Layer.scoped + Effect.forkScoped

```typescript
export const MonitoringServiceLive = Layer.scoped(
  MonitoringService,
  Effect.gen(function* () {
    const fiber = yield* monitoringLoop.pipe(
      Effect.forkScoped // ← Scope終了時に自動interrupt
    )
    return MonitoringService.of({ fiber })
  })
)
```

## 5. 実装パターン集

### Pattern 1: Effect返却

```typescript
// ❌ 即時実行
const result = Effect.runSync(compute())

// ✅ Effect返却
const makeResult = (): Effect.Effect<Result, ComputeError> => compute()
```

### Pattern 2: JSON Schema統合

```typescript
// ❌ 直接パース
const data = JSON.parse(jsonString)

// ✅ Schema.parseJson
const data = yield * Schema.parseJson(DataSchema)(jsonString)
```

### Pattern 3: Platform抽象化

```typescript
// ❌ 直接アクセス
const now = Date.now()
const random = Math.random()
console.log('Message')

// ✅ Effect境界
const now = yield * Clock.currentTimeMillis
const random = yield * Random.next
yield * Effect.logInfo('Message')
```

### Pattern 4: エラーハンドリング

```typescript
// ❌ throw
throw new Error('Failed')

// ✅ Effect.fail with TaggedError
return Effect.fail(OperationError.failed({ message: 'Failed' }))
```

### Pattern 5: 型安全な変換

```typescript
// ❌ 型アサーション
const id = value as UserId

// ✅ Brand/Schema
const id = yield * UserId.make(value)
// または
const id = yield * Schema.decodeUnknown(UserIdSchema)(value)
```

## 6. 品質基準

### 6.1 現状数値（Phase3完了時点）

| 項目                     | 現状 | 目標 | 達成率  |
| ------------------------ | ---- | ---- | ------- |
| Effect.runSync           | 2    | 2    | ✅ 100% |
| unknown                  | 326  | 300  | ✅ 100% |
| console.log              | 105  | 50   | 🚧 48%  |
| Math.random              | 0    | 0    | ✅ 100% |
| throw new Error          | 0    | 0    | ✅ 100% |
| Duration文字列           | 0    | 0    | ✅ 100% |
| Schema.decodeUnknownSync | 94   | 50   | 🚧 47%  |

### 6.2 次期目標（Phase4以降）

- console.log: 105箇所 → 50箇所以下
- Schema.decodeUnknownSync: 94箇所 → 50箇所以下
- JSON.parse: 50箇所 → 25箇所以下

## 7. CI/Lintルール統合

プロジェクトでは以下のCI/Lintルールで品質を自動チェックします：

### 7.1 CI自動チェック（`.github/workflows/effect-ts-check.yml`）

- Effect.runSync: 2箇所以下
- unknown: 350箇所以下
- console使用: 100箇所以下
- Math.random: 0箇所

### 7.2 Biomeルール（`biome.json`）

- `noConsoleLog: error`
- `noExtraBooleanCast: error`

## 8. トラブルシューティング

### 8.1 Effect.runSyncを削減したい

1. **Effectを返す関数に変更**: Pattern A参照
2. **Layer.effectへ統合**: Pattern C参照
3. **同期版ヘルパー作成**: Pattern B参照（最終手段）

### 8.2 unknownを削減したい

1. **型ガード/デコーダか確認**: 正当な使用か判断
2. **JsonRecord/JsonValue使用**: Pattern B参照
3. **具体的な型へ昇格**: Pattern C参照
4. **未使用パラメータ削除**: Pattern D参照

### 8.3 console.logを削減したい

1. **Effect.log\*へ置換**: `Effect.logDebug/logInfo/logError`
2. **構造化ログ**: オブジェクトを第2引数に渡す

## 9. テスト高度化パターン

### 9.1 TestClock - 時間制御

**用途**: 時間依存ロジックのテスト時間短縮・決定性保証

#### ✅ 基本パターン

```typescript
import { Effect, TestClock, TestContext } from 'effect'
import * as assert from 'node:assert'

const test = Effect.gen(function* () {
  const startTime = yield* Clock.currentTimeMillis

  // 1分進める
  yield* TestClock.adjust('1 minute')

  const endTime = yield* Clock.currentTimeMillis

  assert.ok(endTime - startTime >= 60_000)
}).pipe(Effect.provide(TestContext.TestContext))

Effect.runPromise(test)
```

#### ✅ タイムアウトシミュレーション

```typescript
import { Effect, TestClock, Fiber, Option, TestContext } from 'effect'

const test = Effect.gen(function* () {
  const fiber = yield* Effect.sleep('5 minutes').pipe(
    Effect.timeoutTo({
      duration: '1 minute',
      onSuccess: Option.some,
      onTimeout: () => Option.none<void>(),
    }),
    Effect.fork
  )

  // 1分進めてタイムアウト発生
  yield* TestClock.adjust('1 minute')

  const result = yield* Fiber.join(fiber)

  assert.ok(Option.isNone(result))
}).pipe(Effect.provide(TestContext.TestContext))
```

#### ✅ 定期実行のテスト

```typescript
import { Effect, Queue, TestClock, TestContext } from 'effect'

const test = Effect.gen(function* () {
  const queue = yield* Queue.unbounded()

  yield* Queue.offer(queue, undefined).pipe(Effect.delay('60 minutes'), Effect.forever, Effect.fork)

  // 初回実行前は空
  const before = yield* Queue.poll(queue).pipe(Effect.andThen(Option.isNone))

  // 60分進める
  yield* TestClock.adjust('60 minutes')

  // 1回実行される
  const after = yield* Queue.take(queue).pipe(Effect.as(true))

  assert.ok(before && after)
}).pipe(Effect.provide(TestContext.TestContext))
```

**プロジェクト内実装例**:

- [Progressive Loading Scheduler](../../../src/application/world/progressive_loading/loading_scheduler.ts) - TestClockでスケジューラテスト
- [World Generation Pipeline](../../../src/domain/world_generation/domain_service/world_generation_orchestrator/generation_pipeline.ts) - Duration.millis使用

### 9.2 TestRandom - 乱数制御

**用途**: 乱数依存ロジックの決定論的テスト

#### ✅ 基本パターン

```typescript
import { Effect, Random, TestContext } from 'effect'

const program = Effect.gen(function* () {
  const randomValue = yield* Random.nextIntBetween(1, 100)
  return randomValue
}).pipe(Effect.provide(TestContext.TestContext))

// TestContext提供でシード固定・再現可能
```

**プロジェクト内実装例**:

- [Biome Classification](../../../src/domain/biome/domain_service/biome_classification/climate_calculator.ts) - Random.nextIntBetween使用
- [Noise Generation](../../../src/domain/world_generation/domain_service/noise_generation/perlin_noise_service.ts) - Random Service統合

### 9.3 Effect.catchTags - 型安全なエラーハンドリング

**用途**: 複数の異なるエラー型を型安全に処理

#### ✅ 基本パターン

```typescript
import { Effect, Data, Random } from 'effect'

class FooError extends Data.TaggedError('Foo')<{
  message: string
}> {}

class BarError extends Data.TaggedError('Bar')<{
  randomNumber: number
}> {}

const program = Effect.gen(function* () {
  const n = yield* Random.next
  return n > 0.5
    ? 'success'
    : n < 0.2
      ? yield* new FooError({ message: 'Foo occurred' })
      : yield* new BarError({ randomNumber: n })
}).pipe(
  Effect.catchTags({
    Foo: (error) => Effect.succeed(`Handled Foo: ${error.message}`),
    Bar: (error) => Effect.succeed(`Handled Bar: ${error.randomNumber}`),
  })
)
```

**プロジェクト内実装例**:

- [Inventory Domain Service Errors](../../../src/domain/inventory/domain_service/validation_service/service.ts) - TaggedError使用
- [Chunk Repository Errors](../../../src/domain/chunk/repository/types/repository_error.ts) - 複数エラー型定義

### 9.4 Supervisor - Fiberライフサイクル監視

**用途**: バックグラウンドFiberの監視・デバッグ

#### ✅ 基本パターン

```typescript
import { Effect, Fiber, Supervisor } from 'effect'

const program = Effect.gen(function* () {
  const supervisor = yield* Supervisor.track

  const fiber = yield* Effect.sleep('10 seconds').pipe(Effect.supervised(supervisor), Effect.fork)

  // Fiberの監視
  const fibers = yield* supervisor.value

  yield* Fiber.interrupt(fiber)
})
```

**使用場面**:

- 長時間実行Fiberのリーク検出
- バックグラウンドタスクのデバッグ
- Fiberライフサイクルの可視化

### 9.5 Metric/Tracing統合

**用途**: パフォーマンス計測・分散トレーシング

#### ✅ Metric基本パターン

```typescript
import { Metric, Random, Effect } from 'effect'

// Frequency - エラー頻度計測
const errorFrequency = Metric.frequency('error_frequency', {
  description: 'Counts the occurrences of errors.',
})

const task = Effect.gen(function* () {
  const n = yield* Random.nextIntBetween(1, 10)
  return `Error-${n}`
})

const program = Effect.gen(function* () {
  yield* errorFrequency(task).pipe(Effect.repeatN(99))
  const state = yield* Metric.value(errorFrequency)
  console.log('%o', state)
})
```

#### ✅ Timer - レスポンスタイム計測

```typescript
import { Metric, Array, Random, Effect } from 'effect'

const timer = Metric.timerWithBoundaries('response_time', Array.range(1, 10))

const task = Effect.gen(function* () {
  const n = yield* Random.nextIntBetween(1, 10)
  yield* Effect.sleep(`${n} millis`)
})

const program = Effect.gen(function* () {
  yield* Metric.trackDuration(task, timer).pipe(Effect.repeatN(99))
  const state = yield* Metric.value(timer)
  console.log(state)
})
```

#### ✅ Tracing - OpenTelemetry統合

```typescript
import { Effect, NodeSdk } from '@effect/opentelemetry'
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'

const program = Effect.fail('Error!').pipe(Effect.delay('100 millis'), Effect.withSpan('myspan'))

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: 'ts-minecraft' },
  spanProcessor: new BatchSpanProcessor(new ConsoleSpanExporter()),
}))

Effect.runPromiseExit(program.pipe(Effect.provide(NodeSdkLive)))
```

**プロジェクト内実装例**:

- [Performance Monitoring](../../../src/application/world/performance_monitoring/metrics_collector.ts) - メトリクス収集
- [Memory Monitor](../../../src/application/world/progressive_loading/memory_monitor.ts) - パフォーマンス監視

## 10. 関連ドキュメント

- [Effect-TS基礎](../../tutorials/effect-ts-fundamentals/README.md)
- [開発規約](./development-conventions.md)
- [トラブルシューティング](../troubleshooting/effect-ts-troubleshooting.md)
- [Effect-TS完全準拠ガイドライン](../../reference/effect-ts-compliance.md) - 禁止/推奨パターン一覧
- [Effect-TS移行ガイド](../../tutorials/effect-ts-migration-guide.md) - 移行手順・パターン例
- [EXECUTION.md実績レポート](../../project-status/execution-md-status-report.md) - Phase1-3実績

## 11. 参照メモリ

- `effect-runsync-complete-elimination`
- `unknown-reduction-phase3-target-achievement`
- `effect-boundary-strictness-patterns`
- `layer-effect-to-scoped-migration-analysis`
