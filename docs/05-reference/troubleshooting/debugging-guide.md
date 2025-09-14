---
title: "デバッグガイド - 包括的デバッグ戦略"
description: "TypeScript Minecraftプロジェクトの20の高度なデバッグ技術と実践的トラブルシューティング手法。Effect-TS、Three.js、WebGL デバッグ。"
category: "troubleshooting"
difficulty: "advanced"
tags: ["debugging", "troubleshooting", "effect-ts", "three.js", "webgl", "performance-analysis", "tracing"]
prerequisites: ["typescript-intermediate", "debugging-fundamentals", "effect-ts-fundamentals"]
estimated_reading_time: "30分"
related_patterns: ["error-handling-patterns", "service-patterns"]
related_docs: ["./effect-ts-troubleshooting.md", "./performance-issues.md", "./runtime-errors.md"]
status: "complete"
---

# デバッグガイド

> **包括的デバッグ戦略**: TypeScript Minecraft プロジェクトのための20の高度なデバッグ技術と実践的トラブルシューティング手法

TypeScript Minecraft プロジェクトにおけるEffect-TSベースの高度なデバッグ技術、実用的なトラブルシューティング手法、そしてパフォーマンス分析ツールを詳細に解説します。特にEffect-TS 3.17+、Three.js、WebGLの組み合わせにおけるデバッグのベストプラクティスを重点的に紹介します。

## Effect-TSデバッグ技術

### Effect.withSpan による分散トレーシング

#### 基本的な使用方法
```typescript
import * as Effect from "effect/Effect"
import * as Tracer from "effect/Tracer"

// スパンの作成と実行
const loadChunkWithTracing = (coordinate: ChunkCoordinate) =>
  pipe(
    loadChunk(coordinate),
    Effect.withSpan("load-chunk", {
      attributes: {
        "chunk.x": coordinate.x,
        "chunk.z": coordinate.z,
        "chunk.dimension": coordinate.dimension
      }
    })
  )

// ネストしたスパンによる詳細トレーシング
const generateWorld = (seed: number) =>
  pipe(
    Effect.gen(function* () {
      yield* Effect.log("Starting world generation")

      const terrain = yield* pipe(
        generateTerrain(seed),
        Effect.withSpan("generate-terrain", { attributes: { seed } })
      )

      const structures = yield* pipe(
        generateStructures(terrain),
        Effect.withSpan("generate-structures")
      )

      const entities = yield* pipe(
        spawnEntities(terrain),
        Effect.withSpan("spawn-entities")
      )

      return new World(terrain, structures, entities)
    }),
    Effect.withSpan("generate-world", {
      attributes: { seed }
    })
  )
```

#### トレースの可視化
```typescript
// カスタムトレーサーの設定
const consoleTracer = Tracer.make({
  span: (name, options) => {
    const startTime = Date.now()
    console.group(`🔍 ${name}`)

    if (options.attributes) {
      console.table(options.attributes)
    }

    return Effect.acquireRelease(
      Effect.sync(() => ({
        name,
        startTime,
        attributes: options.attributes
      })),
      (span) => Effect.sync(() => {
        const duration = Date.now() - span.startTime
        console.log(`⏱️  ${span.name}: ${duration}ms`)
        console.groupEnd()
      })
    )
  }
})

// プログラムでのトレーサー使用
const tracedProgram = pipe(
  generateWorld(12345),
  Effect.provide(Layer.succeed(Tracer.Tracer, consoleTracer))
)
```

### Effect.log による構造化ログ

#### ログレベルとコンテキスト
```typescript
// 構造化ログの実装
const logPlayerAction = (playerId: PlayerId, action: PlayerAction) =>
  Effect.logInfo("Player action executed", {
    playerId: playerId.value,
    action: action.type,
    timestamp: new Date().toISOString(),
    metadata: action.metadata
  })

// 条件付きログ
const debugChunkLoad = (coordinate: ChunkCoordinate) =>
  pipe(
    Effect.logDebug("Loading chunk", { coordinate }),
    Effect.when(DEBUG_CHUNKS)
  )

// エラー情報付きログ
const logPlayerError = (error: PlayerError) =>
  pipe(
    Effect.logError("Player operation failed", {
      errorType: error._tag,
      playerId: error.playerId,
      stackTrace: error.stack
    }),
    Effect.zipLeft(Effect.fail(error))
  )
```

#### カスタムロガーの作成
```typescript
import * as Logger from "effect/Logger"

// ファイル出力ロガー
const fileLogger = Logger.make(({ logLevel, message, cause }) => {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level: logLevel._tag,
    message,
    cause: cause ? String(cause) : undefined
  }

  // ファイルへの書き込み (非同期)
  appendFile('debug.log', JSON.stringify(logEntry) + '\n')
})

// ログレベル別の色分け
const coloredLogger = Logger.make(({ logLevel, message }) => {
  const colors = {
    Info: '\x1b[36m',    // シアン
    Warn: '\x1b[33m',    // イエロー
    Error: '\x1b[31m',   // レッド
    Debug: '\x1b[90m',   // グレー
    Fatal: '\x1b[35m'    // マゼンタ
  }

  const color = colors[logLevel._tag] || '\x1b[0m'
  console.log(`${color}[${logLevel._tag}] ${message}\x1b[0m`)
})
```

### Chrome DevTools を使用したEffect デバッグ

#### Performance API との統合
```typescript
// パフォーマンス測定
const measureOperation = <A, E>(
  name: string,
  operation: Effect.Effect<A, E>
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    performance.mark(`${name}-start`)

    const result = yield* operation

    performance.mark(`${name}-end`)
    performance.measure(name, `${name}-start`, `${name}-end`)

    return result
  })

// メモリ使用量の監視
const memorySnapshot = (label: string) =>
  Effect.sync(() => {
    if (performance.memory) {
      console.log(`📊 ${label}:`, {
        used: `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB`,
        total: `${Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)}MB`,
        limit: `${Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)}MB`
      })
    }
  })

// 使用例
const optimizedChunkGeneration = pipe(
  generateChunk(coordinate),
  Effect.tap(() => memorySnapshot("Before chunk generation")),
  (effect) => measureOperation("chunk-generation", effect),
  Effect.tap(() => memorySnapshot("After chunk generation"))
)
```

#### DevTools Console Integration
```typescript
// カスタム console グループ化
const debugGroup = <A, E>(
  groupName: string,
  operation: Effect.Effect<A, E>
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    yield* Effect.sync(() => console.group(`🔧 ${groupName}`))

    try {
      const result = yield* operation
      yield* Effect.sync(() => console.log("✅ Success:", result))
      return result
    } catch (error) {
      yield* Effect.sync(() => console.error("❌ Error:", error))
      throw error
    } finally {
      yield* Effect.sync(() => console.groupEnd())
    }
  })

// ブレークポイント挿入
const debugBreakpoint = (condition: boolean, message?: string) =>
  Effect.when(
    Effect.sync(() => {
      if (message) console.log(`🔍 Debug: ${message}`)
      debugger
    }),
    condition
  )
```

### エディタでの Effect デバッグ

#### デバッガー設定例
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Effect Program",
      "program": "${workspaceFolder}/src/debug/run.ts",
      "runtimeArgs": ["--loader", "tsx/esm"],
      "env": {
        "NODE_OPTIONS": "--enable-source-maps",
        "DEBUG": "*",
        "LOG_LEVEL": "debug"
      },
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"],
      "sourceMaps": true
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/vitest/dist/cli-wrapper.js",
      "args": ["--run", "--reporter=verbose"],
      "env": {
        "NODE_OPTIONS": "--enable-source-maps"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

#### デバッグ用タスク設定例
```json
// デバッグタスク設定ファイルの例
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Debug Build",
      "type": "shell",
      "command": "pnpm",
      "args": ["build", "--mode", "development"],
      "group": "build",
      "presentation": {
        "panel": "dedicated"
      }
    },
    {
      "label": "Type Check with Debug",
      "type": "shell",
      "command": "npx",
      "args": ["tsc", "--noEmit", "--incremental", "--listFiles"],
      "group": "build",
      "presentation": {
        "panel": "shared"
      }
    }
  ]
}
```

## 高度なデバッグパターン

### Effect Fiber のデバッグ

#### Fiber の監視と制御
```typescript
import * as Fiber from "effect/Fiber"
import * as FiberRefs from "effect/FiberRefs"

// Fiber の状態監視
const monitorFiber = <A, E>(fiber: Fiber.Fiber<A, E>) =>
  Effect.gen(function* () {
    const status = yield* Fiber.status(fiber)

    console.log("Fiber Status:", status._tag)

    if (status._tag === "Running") {
      console.log("Fiber is currently executing")
    } else if (status._tag === "Suspended") {
      console.log("Fiber is suspended, waiting for:", status.blockingOn)
    }
  })

// 並行処理のデバッグ
const debugConcurrentOperations = Effect.gen(function* () {
  const operations = [
    loadChunk({ x: 0, z: 0 }),
    loadChunk({ x: 0, z: 1 }),
    loadChunk({ x: 1, z: 0 }),
    loadChunk({ x: 1, z: 1 })
  ]

  const fibers = yield* Effect.forEach(operations, (op) =>
    pipe(
      op,
      Effect.withSpan("chunk-load"),
      Effect.fork
    )
  )

  // 各Fiberの状態を監視
  yield* Effect.forEach(fibers, monitorFiber)

  // すべての処理が完了するまで待機
  const results = yield* Effect.forEach(fibers, Fiber.await)

  return results
})
```

#### Fiber間の通信デバッグ
```typescript
import * as Queue from "effect/Queue"
import * as Ref from "effect/Ref"

// キューの監視機能付きプロデューサー・コンシューマー
const debugQueue = <A>(name: string, queue: Queue.Queue<A>) =>
  Effect.gen(function* () {
    const size = yield* Queue.size(queue)
    const capacity = Queue.capacity(queue)

    yield* Effect.logDebug(`Queue ${name}`, {
      size,
      capacity,
      isFull: size === capacity,
      isEmpty: size === 0
    })
  })

// 状態変更の追跡
const debugRef = <A>(name: string, ref: Ref.Ref<A>) =>
  pipe(
    Ref.get(ref),
    Effect.tap((value) => Effect.logDebug(`Ref ${name}`, { value }))
  )
```

### Schema バリデーションデバッグ

#### 詳細なバリデーションエラー
```typescript
import * as ParseResult from "@effect/schema/ParseResult"
import * as TreeFormatter from "@effect/schema/TreeFormatter"

// カスタムエラーフォーマッター
const debugSchemaValidation = <A, I>(
  schema: Schema.Schema<A, I>,
  input: unknown
): Effect.Effect<A, ParseResult.ParseError> =>
  pipe(
    Schema.decodeUnknown(schema)(input),
    Effect.mapError((error) => {
      // 詳細なエラー情報をログ出力
      const formatted = TreeFormatter.formatError(error)
      console.group("🚫 Schema Validation Failed")
      console.log("Input:", JSON.stringify(input, null, 2))
      console.log("Error:", formatted)
      console.groupEnd()

      return error
    })
  )

// バリデーション過程の可視化
const traceSchemaValidation = <A, I>(schema: Schema.Schema<A, I>) => {
  const tracedSchema = Schema.transformOrFail(
    schema,
    schema,
    {
      decode: (input) => {
        console.log("🔍 Validating:", input)
        return ParseResult.succeed(input)
      },
      encode: (output) => {
        console.log("✅ Validated:", output)
        return ParseResult.succeed(output)
      }
    }
  )

  return tracedSchema
}
```

### パフォーマンス分析とプロファイリング

#### Effect の実行時間測定
```typescript
import * as Duration from "effect/Duration"
import * as Metric from "effect/Metric"

// メトリクスの定義
const chunkLoadDuration = Metric.histogram(
  "chunk_load_duration_ms",
  {
    description: "Time taken to load a chunk",
    boundaries: [1, 10, 100, 1000, 10000]
  }
)

const chunkLoadCounter = Metric.counter(
  "chunk_loads_total",
  { description: "Total number of chunk loads" }
)

// 測定付きの処理
const measuredChunkLoad = (coordinate: ChunkCoordinate) =>
  pipe(
    Effect.timed(loadChunk(coordinate)),
    Effect.tap(([duration, _]) =>
      Metric.increment(chunkLoadCounter)
    ),
    Effect.tap(([duration, _]) =>
      Metric.update(chunkLoadDuration, Duration.toMillis(duration))
    ),
    Effect.map(([_, chunk]) => chunk)
  )

// メトリクスの可視化
const logMetrics = Effect.gen(function* () {
  const loadCount = yield* Metric.value(chunkLoadCounter)
  const loadDurations = yield* Metric.value(chunkLoadDuration)

  console.log("📊 Performance Metrics:", {
    totalLoads: loadCount.count,
    averageDuration: loadDurations.sum / loadDurations.count,
    maxDuration: Math.max(...loadDurations.buckets.map(b => b.boundary))
  })
})
```

#### メモリリーク検出
```typescript
// 弱参照による循環参照検出
const trackReferences = <T extends object>(name: string, obj: T): T => {
  const weakRef = new WeakRef(obj)

  // ガベージコレクション後のチェック
  setTimeout(() => {
    if (weakRef.deref() === undefined) {
      console.log(`✅ ${name} was garbage collected`)
    } else {
      console.warn(`⚠️  ${name} may have a memory leak`)
    }
  }, 5000)

  return obj
}

// Effect リソースの適切な管理
const managedChunkLoader = Effect.gen(function* () {
  const loader = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const loader = new ChunkLoader()
      return trackReferences("ChunkLoader", loader)
    }),
    (loader) => Effect.sync(() => {
      loader.cleanup()
      console.log("🧹 ChunkLoader cleaned up")
    })
  )

  return loader
})
```

## デバッグ用ユーティリティ

### 開発用Effect拡張
```typescript
// デバッグ情報付きのEffect実行
export const runWithDebug = <A, E>(
  effect: Effect.Effect<A, E>,
  options: {
    enableTracing?: boolean
    enableMetrics?: boolean
    enableMemoryTracking?: boolean
  } = {}
): void => {
  const { enableTracing = true, enableMetrics = true, enableMemoryTracking = true } = options

  let program = effect

  if (enableTracing) {
    program = pipe(
      program,
      Effect.provide(Layer.succeed(Tracer.Tracer, consoleTracer))
    )
  }

  if (enableMetrics) {
    program = pipe(
      program,
      Effect.tap(() => logMetrics)
    )
  }

  if (enableMemoryTracking) {
    program = pipe(
      program,
      Effect.tap(() => memorySnapshot("Before execution")),
      Effect.tap((result) => memorySnapshot("After execution"))
    )
  }

  Effect.runPromise(program).catch(console.error)
}

// 条件付きデバッグ
export const debugWhen = <A, E>(
  condition: boolean,
  debugEffect: Effect.Effect<void, never>
) =>
  (effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    condition
      ? pipe(effect, Effect.tap(() => debugEffect))
      : effect
```

### テスト環境での高度なデバッグ

#### テスト専用デバッグレイヤー
```typescript
import { TestContext } from "@effect/test"

// テスト用の詳細ログ
const TestDebugLayer = Layer.succeed(
  Logger.Logger,
  Logger.make(({ message, logLevel, span }) => {
    if (logLevel._tag === "Debug") {
      console.log(`🧪 TEST DEBUG: ${message}`)
      if (span) {
        console.log(`   Span: ${span.name}`)
      }
    }
  })
)

// テスト実行時間の監視
const timeoutWarning = (timeoutMs: number) =>
  pipe(
    Effect.sleep(Duration.millis(timeoutMs)),
    Effect.tap(() => Effect.logWarn(`Test running longer than ${timeoutMs}ms`)),
    Effect.fork
  )

// デバッグ付きテスト実行
export const runTestWithDebug = <A, E>(
  name: string,
  effect: Effect.Effect<A, E>
) =>
  pipe(
    Effect.gen(function* () {
      const warningFiber = yield* timeoutWarning(5000)
      const result = yield* pipe(
        effect,
        Effect.withSpan(`test-${name}`)
      )
      yield* Fiber.interrupt(warningFiber)
      return result
    }),
    Effect.provide(TestDebugLayer),
    Effect.provide(TestContext.TestContext)
  )
```

## 本番環境でのデバッグ

### プロダクション対応ログ
```typescript
// 本番用構造化ログ
const ProductionLogger = Logger.make(({ message, logLevel, cause, spans }) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: logLevel._tag.toLowerCase(),
    message,
    cause: cause ? String(cause) : undefined,
    traceId: spans.length > 0 ? spans[0].traceId : undefined,
    spanId: spans.length > 0 ? spans[0].spanId : undefined,
    service: "ts-minecraft"
  }

  // 構造化ログの出力 (JSON Lines形式)
  console.log(JSON.stringify(logEntry))
})

// エラー監視システムとの統合
const errorReporting = (error: unknown) =>
  Effect.sync(() => {
    // Sentry, LogRocket等の外部サービスへの送信
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.captureException(error)
    }
  })
```

## 関連リソース

- [よくあるエラー](./common-errors.md) - エラー対処法
- [パフォーマンス問題](./performance-issues.md) - パフォーマンス最適化
- [ビルド問題](./build-problems.md) - ビルド設定のデバッグ
- [Effect-TS Observability](https://effect.website/docs/guides/observability) - 公式観測可能性ガイド