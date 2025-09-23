---
title: 'パフォーマンス最適化実践ガイド'
description: 'TypeScript MinecraftプロジェクトのEffect-TS 3.17+パターンによる包括的パフォーマンス最適化。プロファイリング、メモリ効率化、並列処理、リアルタイム性能最適化を実装'
category: 'guide'
difficulty: 'advanced'
tags: ['performance', 'optimization', 'effect-ts', 'profiling', 'memory-management', 'concurrency', 'real-time']
prerequisites: ['development-conventions', 'effect-ts-fundamentals', 'testing-guide']
estimated_reading_time: '25分'
related_patterns: ['optimization-patterns-latest', 'service-patterns-catalog']
related_docs: ['./02-testing-guide.md', '../explanations/architecture/06-effect-ts-patterns.md']
---

# パフォーマンス最適化実践ガイド

## 🎯 Problem Statement

リアルタイムゲームエンジンにおけるパフォーマンス課題：

- **フレームドロップ**: 60FPS維持のための厳格な時間制約
- **メモリ圧迫**: 大量のゲームオブジェクトによるGC圧力
- **CPU負荷**: 複雑な物理演算と描画処理の負荷
- **スケーラビリティ**: プレイヤー数・ワールドサイズの増加への対応
- **レスポンシブ性**: ユーザー入力への即座の応答

## 🚀 Solution Approach

Effect-TS 3.17+と最新最適化パターンによる高性能化：

1. **Structure of Arrays (SoA)** - キャッシュ効率の最適化
2. **Worker Pool管理** - CPU集約的処理の分散
3. **メモリプール** - GC圧力の軽減
4. **Batch Processing** - I/O処理の効率化
5. **Performance Budgeting** - リアルタイム制約の管理

## ⚡ Quick Guide (5分)

### パフォーマンス測定セットアップ

- [ ] **ブラウザDevTools** - 基本的なプロファイリング
- [ ] **Performance API** - 正確な時間測定
- [ ] **Memory API** - メモリ使用量監視
- [ ] **Custom Metrics** - ゲーム固有指標
- [ ] **Real-time Monitoring** - 継続的な監視

#### 即座に実行可能なコマンド集

```bash
# プロジェクトビルド + パフォーマンス分析
pnpm build --analyze

# 開発サーバー起動（デバッグモード）
DEBUG=minecraft:performance pnpm dev

# パフォーマンステスト実行
pnpm test:performance

# バンドルサイズ分析
pnpx webpack-bundle-analyzer dist/stats.json

# TypeScript コンパイル時間測定
pnpx tsc --diagnostics

# メモリ使用量プロファイリング
node --inspect --max-old-space-size=4096 dist/main.js

# CPU プロファイリング
node --prof dist/main.js && node --prof-process isolate-*.log > profile.txt

# Three.js のリソース使用量監視
DEBUG=three:* pnpm dev
```

#### 継続的パフォーマンス監視

```bash
# GitHub Actionsでの自動計測
.github/workflows/performance.yml で設定

# Lighthouse CI での定期測定
pnpx lhci autorun

# Bundle Buddy によるバンドル分析
pnpx bundle-buddy dist/main.js
```

### 基本最適化チェックリスト

```typescript
// 1. Effect-TS Schema による型安全チェック
const isValidEntity = Schema.is(EntitySchema)
const parseEntity = Schema.decodeUnknown(EntitySchema)
const validateEntityData = Schema.decodeUnknown(EntityDataSchema)

// 2. 効率的なバッチ処理（型安全）
const processBatch = <T, R, E, Ctx>(
  items: ReadonlyArray<T>,
  processor: (batch: ReadonlyArray<T>) => Effect.Effect<ReadonlyArray<R>, E, Ctx>,
  batchSize: number & Brand.Brand<'BatchSize'> = 100 as any
): Effect.Effect<ReadonlyArray<R>, E, Ctx> =>
  Effect.gen(function* () {
    const results: R[] = []

    // Array.chunksOf + Effect.forEach による並列バッチ処理
    const chunks = Array.chunksOf(items, batchSize)
    const results: R[] = []

    yield* Effect.forEach(
      chunks,
      (batch) =>
        Effect.gen(function* () {
          const batchResults = yield* processor(batch)
          results.push(...batchResults)
        }),
      { concurrency: 'unbounded' } // 並列処理で性能向上
    )

    return results
  })

// 3. メモリ効率的なSoA構造（型安全）
export const ComponentStoreSchema = <T>() =>
  Schema.Struct({
    data: Schema.Union(Schema.instanceOf(Float32Array), Schema.instanceOf(Int32Array), Schema.instanceOf(Uint32Array)),
    indices: Schema.instanceOf(Map<EntityId, number>),
    count: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('ComponentCount')),
    capacity: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('ComponentCapacity')),
  }).pipe(
    Schema.filter(
      (store) => {
        return store.count <= store.capacity && store.indices.size <= store.count
      },
      {
        message: () => 'ComponentStore の整合性チェックに失敗しました',
      }
    ),
    Schema.identifier('ComponentStore'),
    Schema.description('コンポーネント用SoAストレージ')
  )

interface ComponentStore<T> {
  readonly data: Float32Array | Int32Array | Uint32Array
  readonly indices: Map<EntityId, number>
  readonly count: number & Brand.Brand<'ComponentCount'>
  readonly capacity: number & Brand.Brand<'ComponentCapacity'>
}
```

#### デバッグ・プロファイリングコマンド

```bash
# 即座に使用可能なデバッグコマンド

# 1. メモリリーク検出
node --trace-gc --trace-gc-verbose dist/main.js 2>&1 | grep "GC"

# 2. V8 ヒープダンプ生成
node --inspect --heapdump-on-out-of-memory dist/main.js

# 3. Effect-TSトレース有効化
DEBUG=effect:* pnpm dev

# 4. Three.js レンダリング統計
window.performance.mark('render-start')
window.performance.mark('render-end')
window.performance.measure('render-duration', 'render-start', 'render-end')

# 5. Webpackバンドル最適化
pnpx webpack-bundle-analyzer --port 8888

# 6. TypeScript型チェック時間測定
time pnpm typecheck

# 7. ESLint パフォーマンス分析
DEBUG=eslint:cli-engine pnpm lint

# 8. Vitest実行時間プロファイル
pnpm test --reporter=verbose --run
```

## 📋 Detailed Instructions

### Step 0: 即座実行 - パフォーマンス問題の緊急診断

```bash
# 🚨 クリティカル: フレームレート低下の緊急診断
# ブラウザコンソールで即座に実行可能

# 1. FPS監視開始
let frameCount = 0;
let lastTime = performance.now();
const measureFPS = () => {
  frameCount++;
  const currentTime = performance.now();
  pipe(
    currentTime - lastTime >= 1000,
    Match.boolean({
      onTrue: () => {
        console.log(`FPS: ${Math.round(frameCount * 1000 / (currentTime - lastTime))}`);
        frameCount = 0;
        lastTime = currentTime;
      },
      onFalse: () => {}
    })
  )
  requestAnimationFrame(measureFPS);
};
measureFPS();

# 2. メモリ使用量リアルタイム監視
setInterval(() => {
  pipe(
    performance.memory,
    Option.fromNullable,
    Option.match({
      onNone: () => {},
      onSome: (memory) => {
        console.log(`Memory: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`);
      }
    })
  )
}, 1000);

# 3. レンダリングパフォーマンス測定
const stats = renderer.info;
console.log(`Draw Calls: ${stats.render.calls}, Triangles: ${stats.render.triangles}`);

# 4. WebGL コンテキスト情報
const gl = renderer.getContext();
console.log('WebGL Info:', {
  renderer: gl.getParameter(gl.RENDERER),
  vendor: gl.getParameter(gl.VENDOR),
  version: gl.getParameter(gl.VERSION)
});
```

### Step 1: プロファイリングシステムの構築

包括的な性能計測環境を構築：

```typescript
// src/performance/profiler.ts
import { Effect, Context, Layer, Schema, Match, Option, pipe, Brand } from "effect"
import type { ParseError } from "@effect/schema/ParseResult"

// 計測メトリクスの定義
export const PerformanceMetricCategorySchema = Schema.Literal("cpu", "memory", "network", "rendering", "physics")
export const PerformanceMetricUnitSchema = Schema.Literal("ms", "mb", "fps", "ops/sec", "percent")

export const PerformanceMetricSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.brand("MetricName")
  ),
  category: PerformanceMetricCategorySchema,
  value: Schema.Number.pipe(
    Schema.nonnegative(),
    Schema.brand("MetricValue")
  ),
  unit: PerformanceMetricUnitSchema,
  timestamp: Schema.Number.pipe(
    Schema.positive(),
    Schema.brand("Timestamp")
  ),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
}).pipe(
  Schema.identifier("PerformanceMetric"),
  Schema.description("パフォーマンス計測データを表現するスキーマ")
)

export type PerformanceMetric = Schema.Schema.Type<typeof PerformanceMetricSchema>
export type PerformanceMetricCategory = Schema.Schema.Type<typeof PerformanceMetricCategorySchema>
export type PerformanceMetricUnit = Schema.Schema.Type<typeof PerformanceMetricUnitSchema>

// 🚀 コマンドライン実行例
// プロファイラー起動: DEBUG=profiler:* pnpm dev
// メトリクス出力: node -e "console.log(JSON.stringify(metrics, null, 2))" > metrics.json
// 分析実行: pnpm analyze-performance metrics.json

// プロファイラーサービス
export interface ProfilerService {
  readonly startProfiling: (sessionName: string) => Effect.Effect<ProfilingSession, ProfilerError>
  readonly stopProfiling: (sessionId: string) => Effect.Effect<ProfilingResult, ProfilerError>
  readonly recordMetric: (metric: PerformanceMetric) => Effect.Effect<void, never>
  readonly getMetrics: (filter?: MetricFilter) => Effect.Effect<ReadonlyArray<PerformanceMetric>, never>
  readonly startRealTimeMonitoring: (config: MonitoringConfig) => Effect.Effect<void, ProfilerError>
}

export const ProfilerService = Context.GenericTag<ProfilerService>("@minecraft/ProfilerService")

// プロファイリング設定の型安全な定義
export const ProfilingConfigSchema = Schema.Struct({
  enableCPUProfiling: Schema.Boolean,
  enableMemoryProfiling: Schema.Boolean,
  enableNetworkProfiling: Schema.optional(Schema.Boolean),
  sampleRate: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.brand("SampleRate")
  ),
  maxSamples: Schema.optional(Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.brand("MaxSamples")
  )),
  autoStop: Schema.optional(Schema.Boolean),
  outputFormat: Schema.optional(Schema.Literal("json", "csv", "flamegraph"))
}).pipe(
  Schema.identifier("ProfilingConfig"),
  Schema.description("プロファイリングセッションの設定")
)

export const ProfilingSessionIdSchema = Schema.String.pipe(
  Schema.pattern(/^session-\d+-[a-z0-9]+$/),
  Schema.brand("ProfilingSessionId")
)

// プロファイリングセッション
export const ProfilingSessionSchema = Schema.Struct({
  id: ProfilingSessionIdSchema,
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(100),
    Schema.brand("SessionName")
  ),
  startTime: Schema.Number.pipe(
    Schema.positive(),
    Schema.brand("Timestamp")
  ),
  config: ProfilingConfigSchema,
  status: Schema.Literal("active", "completed", "failed", "aborted"),
  endTime: Schema.optional(Schema.Number.pipe(
    Schema.positive(),
    Schema.brand("Timestamp")
  ))
}).pipe(
  Schema.filter((session) => {
    return !session.endTime || session.endTime >= session.startTime
  }, {
    message: () => "終了時刻は開始時刻より後である必要があります"
  }),
  Schema.identifier("ProfilingSession"),
  Schema.description("プロファイリングセッションの定義")
)

export type ProfilingConfig = Schema.Schema.Type<typeof ProfilingConfigSchema>
export type ProfilingSession = Schema.Schema.Type<typeof ProfilingSessionSchema> & {
  measure: <A, E>(
    operation: Effect.Effect<A, E>,
    operationName: string
  ) => Effect.Effect<A, E>
  measure = <A, E>(
    operation: Effect.Effect<A, E>,
    operationName: string
  ): Effect.Effect<A, E> => Effect.gen(function* () {
    const startTime = performance.now()
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0

    const result = yield* operation

    const endTime = performance.now()
    const endMemory = (performance as any).memory?.usedJSHeapSize || 0

    yield* ProfilerService.recordMetric({
      name: operationName,
      category: "cpu",
      value: endTime - startTime,
      unit: "ms",
      timestamp: Date.now(),
      metadata: {
        sessionId: this.id,
        memoryDelta: endMemory - startMemory
      }
    })

    return result
  })
}

// プロファイラーの実装
const makeProfilerServiceLive = Effect.gen(function* () {
  const metrics = new Map<string, PerformanceMetric[]>()
  const sessions = new Map<string, ProfilingSession>()

  return ProfilerService.of({
    startProfiling: (sessionName) => Effect.gen(function* () {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const session = new ProfilingSession({
        id: sessionId,
        name: sessionName,
        startTime: performance.now(),
        config: {
          enableCPUProfiling: true,
          enableMemoryProfiling: true,
          sampleRate: 1000 // 1秒間隔
        }
      })

      sessions.set(sessionId, session)
      yield* Effect.logInfo(`Profiling session started: ${sessionName} (${sessionId})`)

      return session
    }),

    stopProfiling: (sessionId) => Effect.gen(function* () {
      const session = sessions.get(sessionId)

      return yield* pipe(
        session,
        Option.fromNullable,
        Option.match({
          onNone: () => Effect.fail(new ProfilerError({
            operation: "stopProfiling",
            reason: "Session not found",
            sessionId
          })),
          onSome: (sessionValue) => Effect.succeed(sessionValue)
        }),
        Effect.flatMap((sessionValue) => Effect.gen(function* () {

      const endTime = performance.now()
      const duration = endTime - session.startTime
      const sessionMetrics = metrics.get(sessionId) || []

      sessions.delete(sessionId)

      yield* Effect.logInfo(`Profiling session completed: ${session.name} (${duration.toFixed(2)}ms)`)

      return {
        sessionId,
        sessionName: session.name,
        duration,
        totalMetrics: sessionMetrics.length,
        metrics: sessionMetrics,
        summary: generatePerformanceSummary(sessionMetrics)
      }
    }),

    recordMetric: (metric) => Effect.gen(function* () {
      const sessionId = metric.metadata?.sessionId as string || "global"

      pipe(
        metrics.has(sessionId),
        Match.boolean({
          onTrue: () => {},
          onFalse: () => metrics.set(sessionId, [])
        })
      )

      metrics.get(sessionId)!.push(metric)

      // リアルタイム監視への通知
      yield* notifyRealTimeMonitors(metric)
    }),

    getMetrics: (filter) => Effect.gen(function* () {
      const allMetrics = Array.from(metrics.values()).flat()

      return pipe(
        filter,
        Option.fromNullable,
        Option.match({
          onNone: () => allMetrics,
          onSome: (filterValue) => filterValue
        })
      )

      return allMetrics.filter(metric =>
        (!filter.category || metric.category === filter.category) &&
        (!filter.namePattern || metric.name.includes(filter.namePattern)) &&
        (!filter.timeRange || (
          metric.timestamp >= filter.timeRange.start &&
          metric.timestamp <= filter.timeRange.end
        ))
      )
    }),

    startRealTimeMonitoring: (config) => Effect.gen(function* () {
      // リアルタイム監視ループの開始
      yield* Effect.fork(
        realTimeMonitoringLoop(config).pipe(
          Effect.forever,
          Effect.catchAll(error =>
            Effect.logError(`Real-time monitoring error: ${error}`)
          )
        )
      )

      yield* Effect.logInfo("Real-time performance monitoring started")
    })
  })
})

export const ProfilerServiceLive = Layer.effect(ProfilerService, makeProfilerServiceLive)

// リアルタイム監視ループ
const realTimeMonitoringLoop = (config: MonitoringConfig) => Effect.gen(function* () {
  // フレームレート測定
  const fps = yield* measureFrameRate()
  yield* ProfilerService.recordMetric({
    name: "frame-rate",
    category: "rendering",
    value: fps,
    unit: "fps",
    timestamp: Date.now()
  })

  // メモリ使用量測定
  yield* pipe(
    (performance as any).memory,
    Option.fromNullable,
    Option.match({
      onNone: () => Effect.unit,
      onSome: (memoryInfo) => ProfilerService.recordMetric({
        name: "heap-used",
      category: "memory",
      value: memoryInfo.usedJSHeapSize / 1024 / 1024, // MB
      unit: "mb",
      timestamp: Date.now()
    })
  }

  // CPU使用率の推定（簡易版）
  const cpuUsage = yield* estimateCPUUsage()
  yield* ProfilerService.recordMetric({
    name: "cpu-usage",
    category: "cpu",
    value: cpuUsage,
    unit: "percent",
    timestamp: Date.now()
  })

  // 指定間隔で待機
  yield* Effect.sleep(`${config.intervalMs} millis`)
})
```

### Step 2: Structure of Arrays (SoA) 最適化

キャッシュ効率を最大化するデータ構造：

```typescript
// src/performance/soa-optimization.ts
import { Effect } from "effect"

// エンティティコンポーネントのSoA構造
export const PositionStoreSchema = Schema.Struct({
  x: Schema.instanceOf(Float32Array).pipe(
    Schema.description("X座標のFloat32Array配列")
  ),
  y: Schema.instanceOf(Float32Array).pipe(
    Schema.description("Y座標のFloat32Array配列")
  ),
  z: Schema.instanceOf(Float32Array).pipe(
    Schema.description("Z座標のFloat32Array配列")
  ),
  count: Schema.Number.pipe(
    Schema.int(),
    Schema.nonnegative(),
    Schema.brand("EntityCount")
  ),
  capacity: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.brand("StoreCapacity")
  )
}).pipe(
  Schema.filter((store) => {
    const expectedLength = store.capacity
    return store.x.length === expectedLength &&
           store.y.length === expectedLength &&
           store.z.length === expectedLength &&
           store.count <= store.capacity
  }, {
    message: () => "PositionStore配列の長さとカウントが一致しません"
  }),
  Schema.identifier("PositionStore"),
  Schema.description("位置コンポーネントのStructure of Arrays格納")
)

export const VelocityStoreSchema = Schema.Struct({
  x: Schema.instanceOf(Float32Array).pipe(
    Schema.description("X速度のFloat32Array配列")
  ),
  y: Schema.instanceOf(Float32Array).pipe(
    Schema.description("Y速度のFloat32Array配列")
  ),
  z: Schema.instanceOf(Float32Array).pipe(
    Schema.description("Z速度のFloat32Array配列")
  ),
  count: Schema.Number.pipe(
    Schema.int(),
    Schema.nonnegative(),
    Schema.brand("EntityCount")
  ),
  capacity: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.brand("StoreCapacity")
  )
}).pipe(
  Schema.filter((store) => {
    const expectedLength = store.capacity
    return store.x.length === expectedLength &&
           store.y.length === expectedLength &&
           store.z.length === expectedLength &&
           store.count <= store.capacity
  }, {
    message: () => "VelocityStore配列の長さとカウントが一致しません"
  }),
  Schema.identifier("VelocityStore"),
  Schema.description("速度コンポーネントのStructure of Arrays格納")
)

export const HealthStoreSchema = Schema.Struct({
  current: Schema.instanceOf(Float32Array).pipe(
    Schema.description("現在ヘルスのFloat32Array配列")
  ),
  maximum: Schema.instanceOf(Float32Array).pipe(
    Schema.description("最大ヘルスのFloat32Array配列")
  ),
  count: Schema.Number.pipe(
    Schema.int(),
    Schema.nonnegative(),
    Schema.brand("EntityCount")
  ),
  capacity: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.brand("StoreCapacity")
  )
}).pipe(
  Schema.filter((store) => {
    const expectedLength = store.capacity
    return store.current.length === expectedLength &&
           store.maximum.length === expectedLength &&
           store.count <= store.capacity
  }, {
    message: () => "HealthStore配列の長さとカウントが一致しません"
  }),
  Schema.identifier("HealthStore"),
  Schema.description("ヘルスコンポーネントのStructure of Arrays格納")
)

export type PositionStore = Schema.Schema.Type<typeof PositionStoreSchema>
export type VelocityStore = Schema.Schema.Type<typeof VelocityStoreSchema>
export type HealthStore = Schema.Schema.Type<typeof HealthStoreSchema>

// SoA操作ユーティリティ
export const SoAOperations = {
  // ベクトル化された位置更新
  updatePositions: (
    positions: PositionStore,
    velocities: VelocityStore,
    deltaTime: number
  ): Effect.Effect<void, never> => Effect.gen(function* () {
    const count = Math.min(positions.count, velocities.count)

    // SIMD最適化可能なループ
    // Array.range + Effect.forEach による並列SIMD処理
    yield* Effect.forEach(
      Array.range(0, count),
      (i) => Effect.gen(function* () {
        positions.x[i] += velocities.x[i] * deltaTime
        positions.y[i] += velocities.y[i] * deltaTime
        positions.z[i] += velocities.z[i] * deltaTime
      }),
      { concurrency: 'unbounded' } // 計算集約的処理の並列化
    )
  }),

  // バッチでの距離計算
  calculateDistancesBatch: (
    positions1: PositionStore,
    positions2: PositionStore,
    results: Float32Array
  ): Effect.Effect<void, never> => Effect.gen(function* () {
    const count = Math.min(positions1.count, positions2.count, results.length)

    // Array.range + Effect.forEach による並列距離計算
    yield* Effect.forEach(
      Array.range(0, count),
      (i) => Effect.gen(function* () {
        const dx = positions1.x[i] - positions2.x[i]
        const dy = positions1.y[i] - positions2.y[i]
        const dz = positions1.z[i] - positions2.z[i]

        results[i] = Math.sqrt(dx * dx + dy * dy + dz * dz)
      }),
      { concurrency: 'unbounded' } // CPU集約的な数学計算の並列化
    )
  }),

  // 範囲クエリの最適化
  findEntitiesInRange: (
    positions: PositionStore,
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    resultIndices: Uint32Array
  ): Effect.Effect<number, never> => Effect.gen(function* () {
    let resultCount = 0
    const radiusSquared = radius * radius

    // Effect.loop による条件付き反復処理（早期終了対応）
    let currentIndex = 0

    yield* Effect.loop(
      { index: currentIndex, resultCount },
      ({ index, resultCount }) => index < positions.count && resultCount < resultIndices.length,
      ({ index, resultCount }) => Effect.gen(function* () {
        const dx = positions.x[index] - centerX
        const dy = positions.y[index] - centerY
        const dz = positions.z[index] - centerZ

        const distanceSquared = dx * dx + dy * dy + dz * dz

        const newResultCount = yield* pipe(
          distanceSquared <= radiusSquared,
          Match.boolean({
            onTrue: () => Effect.gen(function* () {
              resultIndices[resultCount] = index
              return resultCount + 1
            }),
            onFalse: () => Effect.succeed(resultCount)
          })
        )

        return { index: index + 1, resultCount: newResultCount }
      })
    ).pipe(Effect.map(({ resultCount }) => resultCount))

    return resultCount
  }),

  // メモリ効率的な圧縮
  compactStore: <T extends { count: number; capacity: number }>(
    store: T & { [K in keyof T]: T[K] extends TypedArray ? T[K] : T[K] }
  ): Effect.Effect<T, never> => Effect.gen(function* () {
    return yield* pipe(
      store.count >= store.capacity * 0.75,
      Match.boolean({
        onTrue: () => Effect.succeed(store), // 75%以上使用されている場合は圧縮しない
        onFalse: () => Effect.gen(function* () {
          // 圧縮処理を続行

          // 使用されている部分のみを新しい配列にコピー
          const newCapacity = Math.max(store.count, Math.floor(store.capacity / 2))

          // TypedArrayの各プロパティを圧縮
          const compactedStore = { ...store }
          // Record.fromEntries + Effect.forEach による型安全な変換
          yield* Effect.forEach(
            Object.entries(store),
            ([key, value]) => Effect.gen(function* () {
              yield* pipe(
                value instanceof Float32Array || value instanceof Uint32Array,
                Match.boolean({
                  onTrue: () => Effect.gen(function* () {
                    const newArray = new (value.constructor as any)(newCapacity)
                    newArray.set(value.subarray(0, store.count))
                    ;(compactedStore as any)[key] = newArray
                  }),
                  onFalse: () => Effect.unit
                })
              )
            }),
            { concurrency: 'unbounded' }
          )

          ;(compactedStore as any).capacity = newCapacity

          yield* Effect.logDebug(`Store compacted: ${store.capacity} -> ${newCapacity} (${store.count} active)`)
          return compactedStore
        })
      })
    )
  })
}

// ECS エンティティデータの型安全な定義
export const EntityIdSchema = Schema.String.pipe(
  Schema.pattern(/^entity-[a-f0-9-]+$/),
  Schema.brand("EntityId")
)

export const EntityDataSchema = Schema.Struct({
  id: EntityIdSchema,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  velocity: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })),
  health: Schema.optional(Schema.Struct({
    current: Schema.Number.pipe(Schema.nonnegative()),
    maximum: Schema.Number.pipe(Schema.positive())
  }))
}).pipe(
  Schema.filter((entity) => {
    return !entity.health || entity.health.current <= entity.health.maximum
  }, {
    message: () => "現在のヘルスが最大ヘルスを超えています"
  }),
  Schema.identifier("EntityData"),
  Schema.description("エンティティの初期化データ")
)

export const SystemErrorSchema = Schema.TaggedError("SystemError")({
  operation: Schema.String,
  entityId: Schema.optional(EntityIdSchema),
  reason: Schema.String,
  timestamp: Schema.Number.pipe(Schema.brand("Timestamp"))
})

export type EntityId = Schema.Schema.Type<typeof EntityIdSchema>
export type EntityData = Schema.Schema.Type<typeof EntityDataSchema>
export type SystemError = Schema.Schema.Type<typeof SystemErrorSchema>

// SoA ECSシステムの実装例
export interface SoAEntitySystem {
  private positions: PositionStore
  private velocities: VelocityStore
  private healths: HealthStore
  private entityIndices: Map<EntityId, number>

  constructor(initialCapacity: number = 10000) {
    this.positions = {
      x: new Float32Array(initialCapacity),
      y: new Float32Array(initialCapacity),
      z: new Float32Array(initialCapacity),
      count: 0,
      capacity: initialCapacity
    }

    this.velocities = {
      x: new Float32Array(initialCapacity),
      y: new Float32Array(initialCapacity),
      z: new Float32Array(initialCapacity),
      count: 0,
      capacity: initialCapacity
    }

    this.healths = {
      current: new Float32Array(initialCapacity),
      maximum: new Float32Array(initialCapacity),
      count: 0,
      capacity: initialCapacity
    }
  }

  addEntity = (entityId: EntityId, initialData: EntityData): Effect.Effect<number, SystemError> =>
    Effect.gen(function* () {
      yield* pipe(
        this.positions.count >= this.positions.capacity,
        Match.boolean({
          onTrue: () => this.expandCapacity(),
          onFalse: () => Effect.unit
        })
      )

      const index = this.positions.count

      // コンポーネントデータの設定
      this.positions.x[index] = initialData.position.x
      this.positions.y[index] = initialData.position.y
      this.positions.z[index] = initialData.position.z

      pipe(
        initialData.velocity,
        Option.fromNullable,
        Option.match({
          onNone: () => {},
          onSome: (velocity) => {
            this.velocities.x[index] = velocity.x
            this.velocities.y[index] = velocity.y
            this.velocities.z[index] = velocity.z
            this.velocities.count++
          }
        })
      )

      pipe(
        initialData.health,
        Option.fromNullable,
        Option.match({
          onNone: () => {},
          onSome: (health) => {
            this.healths.current[index] = health.current
            this.healths.maximum[index] = health.maximum
            this.healths.count++
          }
        })
      )

      this.entityIndices.set(entityId, index)
      this.positions.count++

      return index
    })

  updateSystem = (deltaTime: number): Effect.Effect<void, SystemError> =>
    Effect.gen(function* () {
      // 物理更新（位置 += 速度 * 時間）
      yield* SoAOperations.updatePositions(this.positions, this.velocities, deltaTime)

      // ヘルス回復の処理
      yield* this.processHealthRegeneration(deltaTime)

      // 衝突検出の最適化処理
      yield* this.processCollisionDetection()
    })

  private expandCapacity = (): Effect.Effect<void, SystemError> =>
    Effect.gen(function* () {
      const newCapacity = this.positions.capacity * 2

      // 各TypedArrayを拡張
      this.positions = yield* this.expandTypedArrayStore(this.positions, newCapacity)
      this.velocities = yield* this.expandTypedArrayStore(this.velocities, newCapacity)
      this.healths = yield* this.expandTypedArrayStore(this.healths, newCapacity)

      yield* Effect.logInfo(`Entity system capacity expanded to ${newCapacity}`)
    })

  private expandTypedArrayStore = <T extends { capacity: number }>(
    store: T,
    newCapacity: number
  ): Effect.Effect<T, SystemError> =>
    Effect.gen(function* () {
      const expandedStore = { ...store }

      // Record.fromEntries + Effect.forEach によるタイプ配列拡張
      yield* Effect.forEach(
        Object.entries(store),
        ([key, value]) => Effect.gen(function* () {
          if (value instanceof Float32Array || value instanceof Uint32Array) {
            const newArray = new (value.constructor as any)(newCapacity)
            newArray.set(value)
            ;(expandedStore as any)[key] = newArray
          }
        }),
        { concurrency: 3 } // I/O集約的でないため制限付き並列
      )

      ;(expandedStore as any).capacity = newCapacity
      return expandedStore
    })
}
```

### Step 3: Worker Pool最適化

CPU集約的処理の並列化：

```typescript
// src/performance/worker-pool.ts
import { Effect, Context, Layer, Queue } from 'effect'

// Workerタスクの型安全な定義
export const WorkerTaskTypeSchema = Schema.Literal('mesh-generation', 'pathfinding', 'physics', 'lighting')
export const WorkerTaskPrioritySchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 10),
  Schema.brand('TaskPriority')
)

export const WorkerTaskIdSchema = Schema.String.pipe(
  Schema.pattern(/^task-[a-zA-Z0-9-]+$/),
  Schema.brand('WorkerTaskId')
)

export const WorkerIdSchema = Schema.String.pipe(Schema.pattern(/^worker-[a-zA-Z0-9-]+$/), Schema.brand('WorkerId'))

// 具体的なタスクデータのスキーマ
export const MeshGenerationDataSchema = Schema.Struct({
  chunkCoords: Schema.Array(Schema.Number).pipe(Schema.minItems(3), Schema.maxItems(3)),
  blockData: Schema.instanceOf(Uint16Array),
  lightingData: Schema.optional(Schema.instanceOf(Uint8Array)),
})

export const PathfindingDataSchema = Schema.Struct({
  start: Schema.Array(Schema.Number).pipe(Schema.minItems(3), Schema.maxItems(3)),
  end: Schema.Array(Schema.Number).pipe(Schema.minItems(3), Schema.maxItems(3)),
  obstacles: Schema.Array(Schema.Array(Schema.Number)),
  maxDistance: Schema.Number.pipe(Schema.positive()),
})

// タスクデータのTaggedUnion
export const WorkerTaskDataSchema = Schema.TaggedUnion('type', {
  'mesh-generation': Schema.Struct({
    type: Schema.Literal('mesh-generation'),
    data: MeshGenerationDataSchema,
  }),
  pathfinding: Schema.Struct({
    type: Schema.Literal('pathfinding'),
    data: PathfindingDataSchema,
  }),
  physics: Schema.Struct({
    type: Schema.Literal('physics'),
    data: Schema.Record(Schema.String, Schema.Unknown), // 物理計算用の汎用データ
  }),
  lighting: Schema.Struct({
    type: Schema.Literal('lighting'),
    data: Schema.Record(Schema.String, Schema.Unknown), // ライティング計算用の汎用データ
  }),
})

export const WorkerTaskSchema = Schema.Struct({
  id: WorkerTaskIdSchema,
  type: WorkerTaskTypeSchema,
  data: WorkerTaskDataSchema,
  priority: WorkerTaskPrioritySchema,
  timeout: Schema.Number.pipe(Schema.positive(), Schema.brand('TaskTimeout')),
  retryCount: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('TaskRetryCount')),
  createdAt: Schema.Number.pipe(Schema.positive(), Schema.brand('Timestamp')),
}).pipe(Schema.identifier('WorkerTask'), Schema.description('WebWorkerで実行されるタスクの型安全な定義'))

export type WorkerTask = Schema.Schema.Type<typeof WorkerTaskSchema>
export type WorkerTaskType = Schema.Schema.Type<typeof WorkerTaskTypeSchema>
export type WorkerTaskData = Schema.Schema.Type<typeof WorkerTaskDataSchema>

// Worker結果の型安全な定義
export const WorkerResultSchema = Schema.Struct({
  taskId: WorkerTaskIdSchema,
  success: Schema.Boolean,
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.String.pipe(Schema.maxLength(1000), Schema.brand('ErrorMessage'))),
  executionTime: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('ExecutionTime')),
  workerId: WorkerIdSchema,
  completedAt: Schema.Number.pipe(Schema.positive(), Schema.brand('Timestamp')),
  memoryUsage: Schema.optional(Schema.Number.pipe(Schema.nonnegative(), Schema.brand('MemoryUsage'))),
}).pipe(Schema.identifier('WorkerResult'), Schema.description('WebWorkerタスク実行結果の型安全な定義'))

export type WorkerResult = Schema.Schema.Type<typeof WorkerResultSchema>

// Worker Pool 関連の型定義
export const PoolStatusSchema = Schema.Struct({
  totalWorkers: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('WorkerCount')),
  availableWorkers: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('AvailableWorkerCount')),
  busyWorkers: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('BusyWorkerCount')),
  pendingTasks: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('PendingTaskCount')),
  statistics: Schema.Struct({
    totalTasks: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
    completedTasks: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
    failedTasks: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
    averageExecutionTime: Schema.Number.pipe(Schema.nonnegative()),
    workerUtilization: Schema.Record(Schema.String, Schema.Number),
  }),
}).pipe(
  Schema.filter(
    (status) => {
      return (
        status.totalWorkers === status.availableWorkers + status.busyWorkers &&
        status.statistics.totalTasks === status.statistics.completedTasks + status.statistics.failedTasks
      )
    },
    {
      message: () => 'PoolStatus の整合性チェックに失敗しました',
    }
  ),
  Schema.identifier('PoolStatus'),
  Schema.description('ワーカープールの状態情報')
)

export const WorkerErrorSchema = Schema.TaggedError('WorkerError')({
  operation: Schema.String,
  workerId: Schema.optional(WorkerIdSchema),
  taskId: Schema.optional(WorkerTaskIdSchema),
  reason: Schema.String,
  timestamp: Schema.Number.pipe(Schema.brand('Timestamp')),
})

export type PoolStatus = Schema.Schema.Type<typeof PoolStatusSchema>
export type WorkerError = Schema.Schema.Type<typeof WorkerErrorSchema>

// Worker Pool サービス
export interface WorkerPoolService {
  readonly submitTask: (task: WorkerTask) => Effect.Effect<WorkerResult, WorkerError>
  readonly submitBatch: (tasks: ReadonlyArray<WorkerTask>) => Effect.Effect<ReadonlyArray<WorkerResult>, WorkerError>
  readonly getPoolStatus: Effect.Effect<PoolStatus, never>
  readonly adjustPoolSize: (newSize: number & Brand.Brand<'WorkerCount'>) => Effect.Effect<void, WorkerError>
  readonly shutdown: Effect.Effect<void, never>
  readonly validateTask: (task: unknown) => Effect.Effect<WorkerTask, ParseError>
  readonly validateResult: (result: unknown) => Effect.Effect<WorkerResult, ParseError>
}

export const WorkerPoolService = Context.GenericTag<WorkerPoolService>('@minecraft/WorkerPoolService')

// Worker Pool の実装
const makeWorkerPoolService = Effect.gen(function* () {
  // Worker管理
  const workers = new Map<string, Worker>()
  const availableWorkers = yield* Queue.bounded<string>(10)
  const pendingTasks = yield* Queue.unbounded<WorkerTask>()
  const taskResults = new Map<string, WorkerResult>()

  // 統計情報
  const stats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    workerUtilization: new Map<string, number>(),
  }

  // Workerの作成
  const createWorker = (workerId: string, workerType: string): Effect.Effect<Worker, WorkerError> =>
    Effect.gen(function* () {
      const workerScript = getWorkerScript(workerType)

      const worker = new Worker(workerScript, {
        type: 'module',
        name: workerId,
      })

      // Worker初期化の待機
      yield* Effect.async<void, WorkerError>((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'ready') {
            worker.removeEventListener('message', handleMessage)
            resolve(Effect.succeed(void 0))
          }
        }

        const handleError = (error: ErrorEvent) => {
          worker.removeEventListener('error', handleError)
          resolve(
            Effect.fail(
              new WorkerError({
                operation: 'createWorker',
                workerId,
                reason: error.message,
              })
            )
          )
        }

        worker.addEventListener('message', handleMessage)
        worker.addEventListener('error', handleError)

        // 初期化メッセージを送信
        worker.postMessage({ type: 'initialize', config: getWorkerConfig() })
      })

      workers.set(workerId, worker)
      yield* Queue.offer(availableWorkers, workerId)

      yield* Effect.logInfo(`Worker created: ${workerId} (${workerType})`)
      return worker
    })

  // タスク実行
  const executeTask = (task: WorkerTask): Effect.Effect<WorkerResult, WorkerError> =>
    Effect.gen(function* () {
      // 利用可能なWorkerを取得（優先度順）
      const workerId = yield* Queue.take(availableWorkers)
      const worker = workers.get(workerId)

      yield* pipe(
        worker,
        Option.fromNullable,
        Option.match({
          onNone: () =>
            Effect.gen(function* () {
              yield* Queue.offer(availableWorkers, workerId) // Workerを戻す
              return yield* Effect.fail(
                new WorkerError({
                  operation: 'executeTask',
                  workerId,
                  reason: 'Worker not found',
                })
              )
            }),
          onSome: () => Effect.unit,
        })
      )

      const startTime = performance.now()

      // タスクをWorkerに送信し、結果を待機
      const result = yield* Effect.async<WorkerResult, WorkerError>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(
            Effect.fail(
              new WorkerError({
                operation: 'executeTask',
                workerId,
                reason: `Task timeout after ${task.timeout}ms`,
                taskId: task.id,
              })
            )
          )
        }, task.timeout)

        const handleMessage = (event: MessageEvent) => {
          if (event.data.taskId === task.id) {
            clearTimeout(timeout)
            worker.removeEventListener('message', handleMessage)

            const executionTime = performance.now() - startTime
            const result: WorkerResult = {
              ...event.data,
              executionTime,
              workerId,
            }

            resolve(Effect.succeed(result))
          }
        }

        const handleError = (error: ErrorEvent) => {
          clearTimeout(timeout)
          worker.removeEventListener('error', handleError)
          resolve(
            Effect.fail(
              new WorkerError({
                operation: 'executeTask',
                workerId,
                reason: error.message,
                taskId: task.id,
              })
            )
          )
        }

        worker.addEventListener('message', handleMessage)
        worker.addEventListener('error', handleError)

        // タスクを送信
        worker.postMessage({
          type: 'task',
          ...task,
        })
      })

      // Workerを利用可能プールに戻す
      yield* Queue.offer(availableWorkers, workerId)

      // 統計情報の更新
      stats.completedTasks++
      stats.totalTasks++

      const currentAvg = stats.averageExecutionTime
      const count = stats.completedTasks
      stats.averageExecutionTime = (currentAvg * (count - 1) + result.executionTime) / count

      // Workerの利用率を更新
      const currentUtilization = stats.workerUtilization.get(workerId) || 0
      stats.workerUtilization.set(workerId, currentUtilization + result.executionTime)

      return result
    })

  return WorkerPoolService.of({
    submitTask: (task) =>
      Effect.gen(function* () {
        stats.totalTasks++

        // 高優先度タスクの場合は即座に実行
        return yield* pipe(
          task.priority <= 2,
          Match.boolean({
            onTrue: () => executeTask(task),
            onFalse: () =>
              Effect.gen(function* () {
                // 通常の優先度の場合はキューに追加
                yield* Queue.offer(pendingTasks, task)

                // キューからタスクを取得して実行
                const queuedTask = yield* Queue.take(pendingTasks)
                return yield* executeTask(queuedTask)
              }),
          })
        )
      }),

    submitBatch: (tasks) =>
      Effect.gen(function* () {
        // 優先度でソート
        const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority)

        // 並列実行（利用可能なWorker数に制限）
        const results = yield* Effect.all(
          sortedTasks.map((task) => executeTask(task)),
          { concurrency: workers.size, batching: true }
        )

        return results
      }),

    getPoolStatus: Effect.gen(function* () {
      const availableCount = yield* Queue.size(availableWorkers)
      const pendingCount = yield* Queue.size(pendingTasks)

      return {
        totalWorkers: workers.size,
        availableWorkers: availableCount,
        busyWorkers: workers.size - availableCount,
        pendingTasks: pendingCount,
        statistics: {
          ...stats,
          workerUtilization: Object.fromEntries(stats.workerUtilization),
        },
      }
    }),

    adjustPoolSize: (newSize) =>
      Effect.gen(function* () {
        const currentSize = workers.size

        yield* pipe(
          { newSize, currentSize },
          Match.value({
            when: ({ newSize, currentSize }) => newSize > currentSize,
            then: ({ newSize, currentSize }) =>
              Effect.gen(function* () {
                // Workerを追加
                const addCount = newSize - currentSize
                yield* Effect.forEach(
                  Array.from({ length: addCount }, (_, i) => `worker-${currentSize + i}`),
                  (workerId) => createWorker(workerId, 'general'),
                  { concurrency: 3 }
                )
              }),
          }),
          Match.when(
            ({ newSize, currentSize }) => newSize < currentSize,
            ({ newSize, currentSize }) =>
              Effect.gen(function* () {
                // Workerを削除
                const removeCount = currentSize - newSize
                const workersToRemove = Array.from(workers.keys()).slice(-removeCount)

                yield* Effect.forEach(
                  workersToRemove,
                  (workerId) =>
                    Effect.gen(function* () {
                      const worker = workers.get(workerId)
                      yield* pipe(
                        worker,
                        Option.fromNullable,
                        Option.match({
                          onNone: () => Effect.unit,
                          onSome: (w) =>
                            Effect.gen(function* () {
                              w.terminate()
                              workers.delete(workerId)
                              yield* Effect.logInfo(`Worker terminated: ${workerId}`)
                            }),
                        })
                      )
                    }),
                  { concurrency: 'unbounded' }
                )
              })
          ),
          Match.orElse(() => Effect.unit)
        )

        yield* Effect.logInfo(`Worker pool size adjusted: ${currentSize} -> ${newSize}`)
      }),

    shutdown: Effect.gen(function* () {
      // すべてのWorkerを終了
      yield* Effect.forEach(Array.from(workers.values()), (worker) => Effect.sync(() => worker.terminate()), {
        concurrency: 'unbounded',
      })

      workers.clear()
      yield* Effect.logInfo('Worker pool shutdown completed')
    }),
  })
})

export const WorkerPoolServiceLive = Layer.effect(WorkerPoolService, makeWorkerPoolService)
```

### Step 4: メモリプール最適化

GC圧力の軽減とオブジェクト再利用：

```typescript
// src/performance/memory-pool.ts
import { Effect, Context, Layer, Ref } from 'effect'

// メモリプールの型安全な定義
export const MemoryPoolStatsSchema = Schema.Struct({
  available: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('AvailableCount')),
  inUse: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('InUseCount')),
  total: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('TotalCount')),
  utilizationRate: Schema.Number.pipe(Schema.between(0, 1), Schema.brand('UtilizationRate')),
  peakUsage: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('PeakUsage')),
  allocationCount: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('AllocationCount')),
  releaseCount: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('ReleaseCount')),
}).pipe(
  Schema.filter(
    (stats) => {
      return (
        stats.available + stats.inUse === stats.total &&
        stats.utilizationRate === (stats.total > 0 ? stats.inUse / stats.total : 0) &&
        stats.allocationCount >= stats.releaseCount
      )
    },
    {
      message: () => 'MemoryPoolStats の整合性チェックに失敗しました',
    }
  ),
  Schema.identifier('MemoryPoolStats'),
  Schema.description('メモリプールの統計情報')
)

export const MemoryPoolConfigSchema = <A, I, R>(itemSchema: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50), Schema.brand('PoolName')),
    factory: Schema.Function.pipe(Schema.description('オブジェクト生成ファクトリ関数')),
    reset: Schema.Function.pipe(Schema.description('オブジェクトリセット関数')),
    validate: Schema.optional(Schema.Function.pipe(Schema.description('オブジェクト検証関数'))),
    initialSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('InitialSize'))),
    maxSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand('MaxSize'))),
    enableMetrics: Schema.optional(Schema.Boolean),
    warnOnLeak: Schema.optional(Schema.Boolean),
  }).pipe(
    Schema.filter(
      (config) => {
        return !config.maxSize || !config.initialSize || config.initialSize <= config.maxSize
      },
      {
        message: () => 'initialSize は maxSize 以下である必要があります',
      }
    ),
    Schema.identifier('MemoryPoolConfig'),
    Schema.description('メモリプール設定の型安全な定義')
  )

// メモリプールインターフェースの定義
export interface MemoryPool<T> {
  readonly acquire: () => Effect.Effect<T, never, never>
  readonly release: (item: T) => Effect.Effect<void, never, never>
  readonly getStats: () => Effect.Effect<MemoryPoolStats, never, never>
  readonly preAllocate: (count: number) => Effect.Effect<void, never, never>
  readonly clear: () => Effect.Effect<void, never, never>
  readonly validateIntegrity: () => Effect.Effect<boolean, never, never>
}

export type MemoryPoolStats = Schema.Schema.Type<typeof MemoryPoolStatsSchema>
export type MemoryPoolConfig<T> = {
  readonly name: string & Brand.Brand<'PoolName'>
  readonly factory: () => T
  readonly reset: (item: T) => void
  readonly validate?: (item: T) => boolean
  readonly initialSize?: number & Brand.Brand<'InitialSize'>
  readonly maxSize?: number & Brand.Brand<'MaxSize'>
  readonly enableMetrics?: boolean
  readonly warnOnLeak?: boolean
}

// メモリプールの作成関数（型安全）
export const makeMemoryPool = <A, I, R>(
  itemSchema: Schema.Schema<A, I, R>,
  config: MemoryPoolConfig<A>
): Effect.Effect<MemoryPool<A>, never, never> =>
  Effect.gen(function* () {
    const { factory, reset, initialSize = 10, maxSize = 1000 } = config

    // 状態管理用のRef
    const available = yield* Ref.make<T[]>([])
    const inUse = yield* Ref.make(new Set<T>())

    // 初期プールを作成
    const initialItems: T[] = []
    // Array.makeBy + Effect.succeed による初期化配列生成
    const initialItems = Array.makeBy(initialSize, () => factory())
    yield* Ref.set(available, initialItems)

    const acquire = (): Effect.Effect<T, never, never> =>
      Effect.gen(function* () {
        const availableItems = yield* Ref.get(available)
        let item: T

        if (availableItems.length > 0) {
          const [first, ...rest] = availableItems
          item = first
          yield* Ref.set(available, rest)
        } else {
          item = factory()
          yield* Effect.logDebug('Memory pool: created new item (pool exhausted)')
        }

        yield* Ref.update(inUse, (set) => new Set(set).add(item))
        return item
      })

    const release = (item: T): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const currentInUse = yield* Ref.get(inUse)
        if (!currentInUse.has(item)) {
          yield* Effect.logWarning('Memory pool: attempted to release item not in use')
          return
        }

        yield* Ref.update(inUse, (set) => {
          const newSet = new Set(set)
          newSet.delete(item)
          return newSet
        })

        const currentAvailable = yield* Ref.get(available)
        if (currentAvailable.length < maxSize) {
          yield* Ref.update(available, (items) => [...items, item])
        } else {
          // プールが満杯の場合はGCに任せる
          yield* Effect.logDebug('Memory pool: discarded item (pool full)')
        }
      })

    const getStats = (): Effect.Effect<MemoryPoolStats, never, never> =>
      Effect.gen(function* () {
        const availableItems = yield* Ref.get(available)
        const inUseItems = yield* Ref.get(inUse)
        return {
          available: availableItems.length,
          inUse: inUseItems.size,
          total: availableItems.length + inUseItems.size,
        }
      })

    return {
      acquire,
      release,
      getStats,
    }
  })

// ゲーム固有オブジェクトの型定義
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(Schema.identifier('Vector3'), Schema.description('3次元ベクトル'))

export const EntitySchema = Schema.Struct({
  id: EntityIdSchema,
  components: Schema.instanceOf(Map),
  active: Schema.Boolean,
  lastUpdateTime: Schema.optional(Schema.Number.pipe(Schema.brand('Timestamp'))),
}).pipe(Schema.identifier('Entity'), Schema.description('ゲームエンティティ'))

export const ParticleSchema = Schema.Struct({
  position: Vector3Schema,
  velocity: Vector3Schema,
  life: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('ParticleLife')),
  maxLife: Schema.Number.pipe(Schema.positive(), Schema.brand('ParticleMaxLife')),
  size: Schema.Number.pipe(Schema.positive(), Schema.brand('ParticleSize')),
  color: Schema.Struct({
    r: Schema.Number.pipe(Schema.between(0, 1)),
    g: Schema.Number.pipe(Schema.between(0, 1)),
    b: Schema.Number.pipe(Schema.between(0, 1)),
    a: Schema.Number.pipe(Schema.between(0, 1)),
  }),
}).pipe(
  Schema.filter((particle) => particle.life <= particle.maxLife, {
    message: () => 'パーティクルのlifeはmaxLife以下である必要があります',
  }),
  Schema.identifier('Particle'),
  Schema.description('パーティクル効果')
)

export const MeshDataSchema = Schema.Struct({
  vertices: Schema.instanceOf(Float32Array),
  indices: Schema.instanceOf(Uint32Array),
  normals: Schema.instanceOf(Float32Array),
  uvs: Schema.instanceOf(Float32Array),
  vertexCount: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('VertexCount')),
  indexCount: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('IndexCount')),
}).pipe(
  Schema.filter(
    (mesh) => {
      const expectedVertexBytes = mesh.vertexCount * 3 * 4 // 3 floats per vertex
      const expectedIndexBytes = mesh.indexCount * 4 // 1 uint32 per index
      return mesh.vertices.byteLength >= expectedVertexBytes && mesh.indices.byteLength >= expectedIndexBytes
    },
    {
      message: () => 'メッシュデータの配列サイズとカウントが一致しません',
    }
  ),
  Schema.identifier('MeshData'),
  Schema.description('3Dメッシュデータ')
)

export const GlobalPoolStatsSchema = Schema.Struct({
  vector3: MemoryPoolStatsSchema,
  entity: MemoryPoolStatsSchema,
  particle: MemoryPoolStatsSchema,
  meshData: MemoryPoolStatsSchema,
  totalInUse: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('TotalInUse')),
  totalAvailable: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('TotalAvailable')),
  overallUtilization: Schema.Number.pipe(Schema.between(0, 1), Schema.brand('OverallUtilization')),
}).pipe(Schema.identifier('GlobalPoolStats'), Schema.description('全メモリプールの統計情報'))

export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>
export type Entity = Schema.Schema.Type<typeof EntitySchema>
export type Particle = Schema.Schema.Type<typeof ParticleSchema>
export type MeshData = Schema.Schema.Type<typeof MeshDataSchema>
export type GlobalPoolStats = Schema.Schema.Type<typeof GlobalPoolStatsSchema>

// ゲーム固有のオブジェクトプール
export interface MemoryPoolService {
  readonly vector3Pool: MemoryPool<Vector3>
  readonly entityPool: MemoryPool<Entity>
  readonly particlePool: MemoryPool<Particle>
  readonly meshDataPool: MemoryPool<MeshData>
  readonly getGlobalStats: Effect.Effect<GlobalPoolStats, never>
  readonly optimizeAllPools: Effect.Effect<void, never>
  readonly validateAllPools: Effect.Effect<boolean, never>
  readonly clearAllPools: Effect.Effect<void, never>
}

export const MemoryPoolService = Context.GenericTag<MemoryPoolService>('@minecraft/MemoryPoolService')

// Vector3プール（頻繁に使用される）
const createVector3Pool = () =>
  makeMemoryPool(Vector3Schema, {
    name: 'vector3-pool' as any,
    factory: () => ({ x: 0, y: 0, z: 0 }),
    reset: (v) => {
      v.x = 0
      v.y = 0
      v.z = 0
    },
    validate: (v) => typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number',
    initialSize: 100 as any,
    maxSize: 10000 as any,
    enableMetrics: true,
    warnOnLeak: true,
  })

// エンティティプール
const createEntityPool = () =>
  makeMemoryPool(EntitySchema, {
    name: 'entity-pool' as any,
    factory: () => ({
      id: '' as any,
      components: new Map(),
      active: false,
    }),
    reset: (entity) => {
      entity.id = '' as any
      entity.components.clear()
      entity.active = false
      entity.lastUpdateTime = undefined
    },
    validate: (entity) => typeof entity.id === 'string' && entity.components instanceof Map,
    initialSize: 50 as any,
    maxSize: 5000 as any,
    enableMetrics: true,
    warnOnLeak: true,
  })

// パーティクルプール
const createParticlePool = () =>
  makeMemoryPool(ParticleSchema, {
    name: 'particle-pool' as any,
    factory: () => ({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      life: 0 as any,
      maxLife: 1 as any, // positive値が必要
      size: 1 as any,
      color: { r: 1, g: 1, b: 1, a: 1 },
    }),
    reset: (particle) => {
      particle.position.x = particle.position.y = particle.position.z = 0
      particle.velocity.x = particle.velocity.y = particle.velocity.z = 0
      particle.life = 0 as any
      particle.maxLife = 1 as any
      particle.size = 1 as any
      particle.color.r = particle.color.g = particle.color.b = particle.color.a = 1
    },
    validate: (particle) => particle.life <= particle.maxLife && particle.size > 0,
    initialSize: 200 as any,
    maxSize: 20000 as any,
    enableMetrics: true,
    warnOnLeak: true,
  })

// メッシュデータプール
const createMeshDataPool = () =>
  makeMemoryPool(MeshDataSchema, {
    name: 'mesh-data-pool' as any,
    factory: () => ({
      vertices: new Float32Array(0),
      indices: new Uint32Array(0),
      normals: new Float32Array(0),
      uvs: new Float32Array(0),
      vertexCount: 0 as any,
      indexCount: 0 as any,
    }),
    reset: (meshData) => {
      // TypedArrayは再利用のためにクリア
      meshData.vertices.fill(0)
      meshData.indices.fill(0)
      meshData.normals.fill(0)
      meshData.uvs.fill(0)
      meshData.vertexCount = 0 as any
      meshData.indexCount = 0 as any
    },
    validate: (meshData) => {
      const expectedVertexBytes = meshData.vertexCount * 3 * 4
      const expectedIndexBytes = meshData.indexCount * 4
      return meshData.vertices.byteLength >= expectedVertexBytes && meshData.indices.byteLength >= expectedIndexBytes
    },
    initialSize: 10 as any,
    maxSize: 1000 as any,
    enableMetrics: true,
    warnOnLeak: true,
  })

// メモリプールサービスの実装
const makeMemoryPoolService = Effect.gen(function* () {
  const vector3Pool = createVector3Pool()
  const entityPool = createEntityPool()
  const particlePool = createParticlePool()
  const meshDataPool = createMeshDataPool()

  return MemoryPoolService.of({
    vector3Pool,
    entityPool,
    particlePool,
    meshDataPool,

    getGlobalStats: Effect.gen(function* () {
      const [vector3Stats, entityStats, particleStats, meshStats] = yield* Effect.all([
        vector3Pool.getStats(),
        entityPool.getStats(),
        particlePool.getStats(),
        meshDataPool.getStats(),
      ])

      return {
        vector3: vector3Stats,
        entity: entityStats,
        particle: particleStats,
        meshData: meshStats,
        totalInUse: vector3Stats.inUse + entityStats.inUse + particleStats.inUse + meshStats.inUse,
        totalAvailable: vector3Stats.available + entityStats.available + particleStats.available + meshStats.available,
      }
    }),

    optimizeAllPools: Effect.gen(function* () {
      const stats = yield* MemoryPoolService.getGlobalStats()

      // 使用率が低いプールを縮小
      if (stats.vector3.available > stats.vector3.inUse * 3) {
        yield* Effect.logInfo('Optimizing Vector3 pool (high unused ratio)')
        // 実際の最適化ロジックをここに実装
      }

      if (stats.particle.available > stats.particle.inUse * 2) {
        yield* Effect.logInfo('Optimizing Particle pool (high unused ratio)')
      }

      yield* Effect.logInfo('Memory pool optimization completed')
    }),
  })
})

export const MemoryPoolServiceLive = Layer.effect(MemoryPoolService, makeMemoryPoolService)

// 使用例: スコープ付きリソース管理（型安全）
export const withPooledVector3 = <A, E, R>(
  operation: (vector: Vector3) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | MemoryPoolService> =>
  Effect.gen(function* () {
    const pools = yield* MemoryPoolService
    const vector = yield* pools.vector3Pool.acquire()

    try {
      const result = yield* operation(vector)
      return result
    } finally {
      yield* pools.vector3Pool.release(vector)
    }
  })

// バッチ処理用のヘルパー（型安全）
export const withPooledVectors = <A, E, R>(
  count: number & Brand.Brand<'VectorCount'>,
  operation: (vectors: ReadonlyArray<Vector3>) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | MemoryPoolService> =>
  Effect.gen(function* () {
    const pools = yield* MemoryPoolService
    const vectors = yield* Effect.all(Array.from({ length: count }, () => pools.vector3Pool.acquire()))

    try {
      const result = yield* operation(vectors)
      return result
    } finally {
      yield* Effect.all(
        vectors.map((vector) => pools.vector3Pool.release(vector)),
        { concurrency: 'unbounded' }
      )
    }
  })
```

## 💡 Best Practices

### 1. プロファイリング駆動開発

```typescript
// ✅ 推測ではなく計測に基づく最適化
const optimizeWithProfiling = Effect.gen(function* () {
  const profiler = yield* ProfilerService
  const session = yield* profiler.startProfiling('optimization-session')

  // ベースライン測定
  const baselineResult = yield* session.measure(currentImplementation(), 'baseline-implementation')

  // 最適化版のテスト
  const optimizedResult = yield* session.measure(optimizedImplementation(), 'optimized-implementation')

  const report = yield* profiler.stopProfiling(session.id)

  // 性能改善の検証
  const improvement = ((baselineResult.duration - optimizedResult.duration) / baselineResult.duration) * 100

  // Effect-TS Matchパターンによる改善度評価
  yield* pipe(
    Match.value(improvement),
    Match.when(
      (value) => value < 10,
      (value) => Effect.logWarning(`Optimization showed minimal improvement: ${value.toFixed(2)}%`)
    ),
    Match.orElse((value) => Effect.logInfo(`Optimization successful: ${value.toFixed(2)}% improvement`))
  )

  return report
})
```

### 2. 段階的最適化アプローチ

```typescript
// ✅ 小さな改善を積み重ねる
const incrementalOptimization = Effect.gen(function* () {
  const optimizations = [
    { name: 'data-structure', fn: optimizeDataStructures },
    { name: 'algorithm', fn: optimizeAlgorithms },
    { name: 'memory-allocation', fn: optimizeMemoryAllocation },
    { name: 'cache-efficiency', fn: optimizeCacheEfficiency },
  ]

  let cumulativeImprovement = 0

  // Array.forEach による順次実行（最適化は依存性があるため順次処理が必須）
  yield* Effect.forEach(
    optimizations,
    (optimization) =>
      Effect.gen(function* () {
        const before = yield* measurePerformance()
        yield* optimization.fn()
        const after = yield* measurePerformance()

        const improvement = ((before.duration - after.duration) / before.duration) * 100
        cumulativeImprovement += improvement

        yield* Effect.logInfo(`${optimization.name}: ${improvement.toFixed(2)}% improvement`)
      }),
    { concurrency: 1 } // 順次実行を明示的に指定
  )

  yield* Effect.logInfo(`Total improvement: ${cumulativeImprovement.toFixed(2)}%`)
})
```

## ⚠️ Common Pitfalls

### 1. 早すぎる最適化

```typescript
// ❌ 計測前の推測による最適化
const prematureOptimization = () => {
  // 「きっと遅いはず」という推測でコードを複雑化
  const result = complexOptimizedFunction()
  return result
}

// ✅ 計測に基づく必要最小限の最適化
const measuredOptimization = Effect.gen(function* () {
  const profiler = yield* ProfilerService

  // まず現状を計測
  const baseline = yield* profiler.measure(simpleFunction(), 'simple-version')

  // Effect-TS Matchパターンによる条件付き最適化
  return yield* pipe(
    Match.value(baseline.duration),
    Match.when(
      (duration) => duration > PERFORMANCE_THRESHOLD,
      () => profiler.measure(optimizedFunction(), 'optimized-version').pipe(Effect.map((result) => result.result))
    ),
    Match.orElse(() => Effect.succeed(baseline.result))
  )
})
```

### 2. メモリリークの発生

```typescript
// ❌ リソースの適切な解放なし
const memoryLeakExample = Effect.gen(function* () {
  const largeArray = new Float32Array(1000000)
  const result = yield* processLargeData(largeArray)

  // largeArrayが参照され続ける
  return { result, data: largeArray }
})

// ✅ 適切なリソース管理
const properResourceManagement = Effect.gen(function* () {
  const pools = yield* MemoryPoolService
  const buffer = yield* pools.largeBufferPool.acquire()

  try {
    const result = yield* processLargeData(buffer)
    return result
  } finally {
    yield* pools.largeBufferPool.release(buffer)
  }
})
```

## 🔧 Advanced Techniques

### 1. 動的パフォーマンス調整

```typescript
// フレームレートに基づく動的品質調整
const adaptivePerformanceControl = Effect.gen(function* () {
  const profiler = yield* ProfilerService
  const currentFPS = yield* profiler.getCurrentFPS()

  // Effect-TS Matchパターンによるパフォーマンス調整
  yield* pipe(
    Match.value(currentFPS),
    Match.when(
      (fps) => fps < TARGET_FPS * 0.8,
      () =>
        Effect.gen(function* () {
          // パフォーマンスが低下している場合は品質を下げる
          yield* Effect.logInfo('Reducing quality settings due to low FPS')
          yield* reduceRenderQuality()
          yield* decreaseParticleCount()
          yield* simplifyPhysicsCalculations()
        })
    ),
    Match.when(
      (fps) => fps > TARGET_FPS * 1.1,
      () =>
        Effect.gen(function* () {
          // パフォーマンスに余裕がある場合は品質を上げる
          yield* Effect.logInfo('Increasing quality settings due to high FPS')
          yield* increaseRenderQuality()
          yield* increaseParticleCount()
          yield* enhancePhysicsCalculations()
        })
    ),
    Match.orElse(() => Effect.unit), // 適切な範囲内の場合は何もしない
    Effect.flatten
  )
})
```

### 2. 予測的最適化

```typescript
// 使用パターンに基づく予測的最適化
const predictiveOptimization = Effect.gen(function* () {
  const usagePattern = yield* analyzeUsagePattern()

  if (usagePattern.indicates === 'heavy-computation-ahead') {
    // CPUワーカーを事前に増やす
    yield* WorkerPoolService.adjustPoolSize(usagePattern.recommendedWorkers)

    // メモリプールを事前に拡張
    yield* MemoryPoolService.preAllocate(usagePattern.expectedMemoryUsage)
  }

  if (usagePattern.indicates === 'many-entities-spawning') {
    // エンティティプールの拡張
    yield* expandEntityPools()

    // SoAストレージの事前確保
    yield* preallocateEntityStorage(usagePattern.expectedEntityCount)
  }
})
```

## 📊 パフォーマンス統計とメトリクス

### リアルタイム統計の型安全な定義

```typescript
// パフォーマンス統計の基本型
export const FrameRateStatsSchema = Schema.Struct({
  current: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('FrameRate')),
  average: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('AverageFrameRate')),
  min: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('MinFrameRate')),
  max: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('MaxFrameRate')),
  target: Schema.Number.pipe(Schema.positive(), Schema.brand('TargetFrameRate')),
  frameDrops: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('FrameDropCount')),
}).pipe(
  Schema.filter(
    (stats) => {
      return stats.min <= stats.average && stats.average <= stats.max && stats.current >= 0
    },
    {
      message: () => 'FrameRateStats の統計値が無効です',
    }
  ),
  Schema.identifier('FrameRateStats'),
  Schema.description('フレームレート統計情報')
)

export const MemoryStatsSchema = Schema.Struct({
  heapUsed: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('HeapUsed')),
  heapTotal: Schema.Number.pipe(Schema.positive(), Schema.brand('HeapTotal')),
  heapLimit: Schema.Number.pipe(Schema.positive(), Schema.brand('HeapLimit')),
  external: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('ExternalMemory')),
  rss: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('ResidentSetSize')),
  gcCount: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('GCCount')),
  gcTime: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('GCTime')),
}).pipe(
  Schema.filter(
    (stats) => {
      return stats.heapUsed <= stats.heapTotal && stats.heapTotal <= stats.heapLimit
    },
    {
      message: () => 'MemoryStats のメモリ使用量が無効です',
    }
  ),
  Schema.identifier('MemoryStats'),
  Schema.description('メモリ使用量統計情報')
)

export const RenderingStatsSchema = Schema.Struct({
  drawCalls: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('DrawCalls')),
  triangles: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('TriangleCount')),
  vertices: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('VertexCount')),
  textureMemory: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('TextureMemory')),
  shaderPrograms: Schema.Number.pipe(Schema.int(), Schema.nonnegative(), Schema.brand('ShaderPrograms')),
  renderTime: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('RenderTime')),
}).pipe(Schema.identifier('RenderingStats'), Schema.description('レンダリング統計情報'))

export const SystemPerformanceStatsSchema = Schema.Struct({
  frameRate: FrameRateStatsSchema,
  memory: MemoryStatsSchema,
  rendering: RenderingStatsSchema,
  timestamp: Schema.Number.pipe(Schema.positive(), Schema.brand('Timestamp')),
  sessionDuration: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('SessionDuration')),
}).pipe(Schema.identifier('SystemPerformanceStats'), Schema.description('システム全体のパフォーマンス統計'))

export type FrameRateStats = Schema.Schema.Type<typeof FrameRateStatsSchema>
export type MemoryStats = Schema.Schema.Type<typeof MemoryStatsSchema>
export type RenderingStats = Schema.Schema.Type<typeof RenderingStatsSchema>
export type SystemPerformanceStats = Schema.Schema.Type<typeof SystemPerformanceStatsSchema>

// パフォーマンス閾値の型安全な定義
export const PerformanceThresholdsSchema = Schema.Struct({
  criticalFPS: Schema.Number.pipe(Schema.positive(), Schema.brand('CriticalFPS')),
  warningFPS: Schema.Number.pipe(Schema.positive(), Schema.brand('WarningFPS')),
  maxMemoryUsage: Schema.Number.pipe(Schema.positive(), Schema.brand('MaxMemoryUsage')),
  maxGCTime: Schema.Number.pipe(Schema.positive(), Schema.brand('MaxGCTime')),
  maxRenderTime: Schema.Number.pipe(Schema.positive(), Schema.brand('MaxRenderTime')),
}).pipe(
  Schema.filter(
    (thresholds) => {
      return thresholds.criticalFPS < thresholds.warningFPS
    },
    {
      message: () => 'criticalFPS は warningFPS より小さい必要があります',
    }
  ),
  Schema.identifier('PerformanceThresholds'),
  Schema.description('パフォーマンス閾値設定')
)

export type PerformanceThresholds = Schema.Schema.Type<typeof PerformanceThresholdsSchema>

// アラート生成の型安全な定義
export const PerformanceAlertSchema = Schema.TaggedUnion('severity', {
  critical: Schema.Struct({
    severity: Schema.Literal('critical'),
    metric: PerformanceMetricCategorySchema,
    value: Schema.Number,
    threshold: Schema.Number,
    message: Schema.String,
    timestamp: Schema.Number.pipe(Schema.brand('Timestamp')),
    actionRequired: Schema.Boolean,
  }),
  warning: Schema.Struct({
    severity: Schema.Literal('warning'),
    metric: PerformanceMetricCategorySchema,
    value: Schema.Number,
    threshold: Schema.Number,
    message: Schema.String,
    timestamp: Schema.Number.pipe(Schema.brand('Timestamp')),
    actionRequired: Schema.Boolean,
  }),
  info: Schema.Struct({
    severity: Schema.Literal('info'),
    metric: PerformanceMetricCategorySchema,
    value: Schema.Number,
    message: Schema.String,
    timestamp: Schema.Number.pipe(Schema.brand('Timestamp')),
    actionRequired: Schema.Literal(false),
  }),
}).pipe(Schema.identifier('PerformanceAlert'), Schema.description('パフォーマンスアラート'))

export type PerformanceAlert = Schema.Schema.Type<typeof PerformanceAlertSchema>
```

### 型安全なパフォーマンス監視システム

```typescript
// パフォーマンス監視サービス
export interface PerformanceMonitorService {
  readonly startMonitoring: (config: MonitoringConfig) => Effect.Effect<void, MonitoringError>
  readonly stopMonitoring: Effect.Effect<void, never>
  readonly getCurrentStats: Effect.Effect<SystemPerformanceStats, never>
  readonly getAlertsHistory: (timeRange?: TimeRange) => Effect.Effect<ReadonlyArray<PerformanceAlert>, never>
  readonly setThresholds: (thresholds: PerformanceThresholds) => Effect.Effect<void, never>
  readonly optimizeAutomatically: (
    aggressiveness: OptimizationLevel
  ) => Effect.Effect<OptimizationResult, OptimizationError>
}

// 最適化レベルの型定義
export const OptimizationLevelSchema = Schema.Literal('conservative', 'balanced', 'aggressive')
export type OptimizationLevel = Schema.Schema.Type<typeof OptimizationLevelSchema>

// 最適化結果の型定義
export const OptimizationResultSchema = Schema.Struct({
  appliedOptimizations: Schema.Array(Schema.String),
  performanceImprovement: Schema.Number.pipe(
    Schema.between(-100, 1000), // -100% to 1000%
    Schema.brand('PerformanceImprovement')
  ),
  memoryReduction: Schema.Number.pipe(
    Schema.between(-100, 100), // -100% to 100%
    Schema.brand('MemoryReduction')
  ),
  executionTime: Schema.Number.pipe(Schema.nonnegative(), Schema.brand('OptimizationTime')),
  success: Schema.Boolean,
}).pipe(Schema.identifier('OptimizationResult'), Schema.description('最適化実行結果'))

export type OptimizationResult = Schema.Schema.Type<typeof OptimizationResultSchema>
```

このガイドに従うことで、60FPSを維持する高性能なリアルタイムゲームエンジンを構築できます。すべての型定義はEffect-TS Schemaによって検証され、実行時の型安全性が保証されます。
