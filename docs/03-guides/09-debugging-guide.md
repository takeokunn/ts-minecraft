# デバッグガイド

## 概要

TypeScript Minecraftプロジェクトのデバッグとトラブルシューティングのためのガイドです。Effect-TS特有のデバッグパターンとパフォーマンス分析手法を解説します。

## Effect-TSデバッグパターン

### Effect実行のトレース

```typescript
// Effect実行のトレース有効化（最新API）
import { Effect, Runtime, Cause, Logger } from 'effect'

// デバッグ用ランタイム
export const DebugRuntime = Runtime.defaultRuntime.pipe(
  Runtime.updateLogger(Logger.stringLogger.pipe(
    Logger.map(message =>
      console.log(`[${new Date().toISOString()}] ${message}`)
    )
  )),
  Runtime.enableTracing
)

// Effect実行のデバッグ（最新パターン）
export const debugEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  label: string
) =>
  effect.pipe(
    Effect.tap((value) =>
      Effect.logInfo(`${label}: Success`, { value })
    ),
    Effect.tapError((error) =>
      Effect.logError(`${label}: Error`, { error })
    ),
    Effect.withSpan(label, {
      attributes: {
        component: 'minecraft',
        layer: 'debug'
      }
    })
  )
```

### エラートレースの詳細化

```typescript
// エラーの詳細トレース
export const traceError = <E>(error: E): string => {
  if (Cause.isCause(error)) {
    return Cause.pretty(error)
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack}`
  }

  return JSON.stringify(error, null, 2)
}

// Effect実行結果の詳細ログ（最新パターン）
export const runWithDetailedLog = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  name: string
) =>
  Effect.gen(function* () {
    const startTime = Date.now()

    const result = yield* Effect.either(effect).pipe(
      Effect.tap((either) => Effect.sync(() => {
        const duration = Date.now() - startTime

        if (Either.isRight(either)) {
          console.log(`✅ ${name} succeeded in ${duration}ms`)
        } else {
          console.error(`❌ ${name} failed in ${duration}ms:`)
          console.error(traceError(either.left))
        }
      }))
    )

    return yield* Effect.fromEither(result)
  })
```

### レイヤー構成のデバッグ

```typescript
// レイヤー依存関係の可視化（最新API）
export const debugLayer = <A, E, R>(
  layer: Layer.Layer<A, E, R>
) => {
  console.log('Layer Dependencies:')
  // Layer.graphは実装状況を要確認

  return layer.pipe(
    Layer.tapContext((context) => Effect.sync(() => {
      console.log('Layer Context:', context)
    })),
    Layer.orDie // 開発時はエラーで停止
  )
}

// サービス呼び出しのインターセプト（最新パターン）
export const interceptService = <S>(
  tag: Context.Tag<S, S>,
  methods: (keyof S)[]
) =>
  Layer.succeed(tag, new Proxy({} as S, {
    get(target, prop) {
      if (methods.includes(prop as keyof S)) {
        return (...args: any[]) => {
          console.log(`📞 ${tag.key}.${String(prop)}`, args)
          const result = target[prop as keyof S](...args)
          console.log(`📞 ${tag.key}.${String(prop)} →`, result)
          return result
        }
      }
      return target[prop as keyof S]
    }
  }))
```

## パフォーマンスプロファイリング

### 実行時間計測

```typescript
import { Effect, Context, Layer, Ref, Schema, Option, Fiber } from "effect"

// パフォーマンス統計型定義
export interface PerformanceStats {
  readonly count: number
  readonly total: number
  readonly average: number
  readonly min: number
  readonly max: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
}

// マーク未発見エラー
export class MarkNotFoundError extends Schema.TaggedError("MarkNotFoundError")<{
  readonly markName: string
  readonly timestamp: number
}> {}

// PerformanceTimerサービス定義
export const PerformanceTimer = Context.GenericTag<{
  readonly mark: (name: string) => Effect.Effect<void, never>
  readonly measure: (name: string, startMark: string, endMark?: string) => Effect.Effect<number, MarkNotFoundError>
  readonly getStats: (name: string) => Effect.Effect<PerformanceStats, never>
  readonly report: () => Effect.Effect<void, never>
  readonly reset: () => Effect.Effect<void, never>
}>("@minecraft/PerformanceTimer")

// 実装
const makePerformanceTimer = Effect.gen(function* () {
  const marksRef = yield* Ref.make(new Map<string, number>())
  const measuresRef = yield* Ref.make(new Map<string, number[]>())

  const calculateStats = (measures: number[]): PerformanceStats => {
    if (measures.length === 0) {
      return {
        count: 0,
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0
      }
    }

    const sorted = [...measures].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: sorted.length,
      total: sum,
      average: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  return PerformanceTimer.of({
    mark: (name) => Effect.gen(function* () {
      const marks = yield* Ref.get(marksRef)
      yield* Ref.set(marksRef, new Map(marks).set(name, performance.now()))
    }),

    measure: (name, startMark, endMark) => Effect.gen(function* () {
      const marks = yield* Ref.get(marksRef)
      const measures = yield* Ref.get(measuresRef)

      const start = marks.get(startMark)
      if (!start) {
        return yield* Effect.fail(new MarkNotFoundError({
          markName: startMark,
          timestamp: Date.now()
        }))
      }

      const end = endMark ? marks.get(endMark) : performance.now()
      const duration = (end || performance.now()) - start

      const existingMeasures = measures.get(name) || []
      const updatedMeasures = new Map(measures).set(name, [...existingMeasures, duration])
      yield* Ref.set(measuresRef, updatedMeasures)

      return duration
    }),

    getStats: (name) => Effect.gen(function* () {
      const measures = yield* Ref.get(measuresRef)
      const measuresList = measures.get(name) || []
      return calculateStats(measuresList)
    }),

    report: () => Effect.gen(function* () {
      const measures = yield* Ref.get(measuresRef)
      const stats = Array.from(measures.keys()).map(name => ({
        name,
        ...calculateStats(measures.get(name) || [])
      }))

      yield* Effect.sync(() => console.table(stats))
    }),

    reset: () => Effect.gen(function* () {
      yield* Ref.set(marksRef, new Map())
      yield* Ref.set(measuresRef, new Map())
    })
  })
})

// Layer提供
export const PerformanceTimerLive = Layer.effect(PerformanceTimer, makePerformanceTimer)

// Effect統合
export const timed = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  name: string
) =>
  Effect.gen(function* () {
    const timer = new PerformanceTimer()
    timer.mark('start')

    const result = yield* effect

    const duration = timer.measure(name, 'start')
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`)

    return result
  })
```

### メモリプロファイリング

```typescript
// メモリスナップショット型定義
export interface MemorySnapshot {
  readonly timestamp: number
  readonly usedJSHeapSize: number
  readonly totalJSHeapSize: number
  readonly jsHeapSizeLimit: number
  readonly delta: number
}

// メモリプロファイリング不可エラー
export class MemoryProfilingUnavailableError extends Schema.TaggedError("MemoryProfilingUnavailableError")<{
  readonly reason: string
  readonly timestamp: number
}> {}

// スナップショット未発見エラー
export class SnapshotNotFoundError extends Schema.TaggedError("SnapshotNotFoundError")<{
  readonly snapshotLabel: string
  readonly availableLabels: ReadonlyArray<string>
  readonly timestamp: number
}> {}

// メモリ比較結果
export interface MemoryComparison {
  readonly label1: string
  readonly label2: string
  readonly absoluteDelta: number
  readonly relativeDelta: number
  readonly currentUsage: number
  readonly formattedDelta: string
  readonly formattedCurrent: string
  readonly percentage: string
}

// MemoryProfilerサービス定義
export const MemoryProfiler = Context.GenericTag<{
  readonly snapshot: (label: string) => Effect.Effect<void, MemoryProfilingUnavailableError>
  readonly compare: (label1: string, label2: string) => Effect.Effect<MemoryComparison, SnapshotNotFoundError>
  readonly report: () => Effect.Effect<void, never>
  readonly getSnapshot: (label: string) => Effect.Effect<Option.Option<MemorySnapshot>, never>
  readonly reset: () => Effect.Effect<void, never>
  readonly getBaseline: () => Effect.Effect<number, never>
}>("@minecraft/MemoryProfiler")

// ユーティリティ関数
const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let size = Math.abs(bytes)
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  const sign = bytes < 0 ? '-' : ''
  return `${sign}${size.toFixed(2)} ${units[unitIndex]}`
}

// 実装
const makeMemoryProfiler = Effect.gen(function* () {
  const baselineRef = yield* Ref.make(0)
  const snapshotsRef = yield* Ref.make(new Map<string, MemorySnapshot>())

  // 初期化時にベースライン設定
  yield* Effect.sync(() => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }).pipe(
    Effect.flatMap(baseline => Ref.set(baselineRef, baseline))
  )

  return MemoryProfiler.of({
    snapshot: (label) => Effect.gen(function* () {
      if (!('memory' in performance)) {
        return yield* Effect.fail(new MemoryProfilingUnavailableError({
          reason: "Browser memory API not available",
          timestamp: Date.now()
        }))
      }

      const baseline = yield* Ref.get(baselineRef)
      const memory = (performance as any).memory
      const snapshot: MemorySnapshot = {
        timestamp: Date.now(),
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        delta: memory.usedJSHeapSize - baseline
      }

      const snapshots = yield* Ref.get(snapshotsRef)
      yield* Ref.set(snapshotsRef, new Map(snapshots).set(label, snapshot))
    }),

    compare: (label1, label2) => Effect.gen(function* () {
      const snapshots = yield* Ref.get(snapshotsRef)
      const snap1 = snapshots.get(label1)
      const snap2 = snapshots.get(label2)

      if (!snap1 || !snap2) {
        const availableLabels = Array.from(snapshots.keys())
        return yield* Effect.fail(new SnapshotNotFoundError({
          snapshotLabel: !snap1 ? label1 : label2,
          availableLabels,
          timestamp: Date.now()
        }))
      }

      const absoluteDelta = snap2.usedJSHeapSize - snap1.usedJSHeapSize
      const relativeDelta = (absoluteDelta / snap1.usedJSHeapSize) * 100

      const comparison: MemoryComparison = {
        label1,
        label2,
        absoluteDelta,
        relativeDelta,
        currentUsage: snap2.usedJSHeapSize,
        formattedDelta: formatBytes(absoluteDelta),
        formattedCurrent: formatBytes(snap2.usedJSHeapSize),
        percentage: `${relativeDelta.toFixed(2)}%`
      }

      // ログ出力
      yield* Effect.sync(() => {
        console.log(`Memory Delta (${label1} → ${label2}):`)
        console.log(`  Absolute: ${comparison.formattedDelta}`)
        console.log(`  Relative: ${comparison.percentage}`)
        console.log(`  Current: ${comparison.formattedCurrent}`)
      })

      return comparison
    }),

    report: () => Effect.gen(function* () {
      const snapshots = yield* Ref.get(snapshotsRef)
      const reportData = Array.from(snapshots.entries()).map(([label, snap]) => ({
        label,
        used: formatBytes(snap.usedJSHeapSize),
        total: formatBytes(snap.totalJSHeapSize),
        limit: formatBytes(snap.jsHeapSizeLimit),
        delta: formatBytes(snap.delta),
        timestamp: new Date(snap.timestamp).toISOString()
      }))

      yield* Effect.sync(() => console.table(reportData))
    }),

    getSnapshot: (label) => Effect.gen(function* () {
      const snapshots = yield* Ref.get(snapshotsRef)
      return Option.fromNullable(snapshots.get(label))
    }),

    reset: () => Effect.gen(function* () {
      yield* Ref.set(snapshotsRef, new Map())

      // ベースラインを現在の値にリセット
      const newBaseline = yield* Effect.sync(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize
        }
        return 0
      })
      yield* Ref.set(baselineRef, newBaseline)
    }),

    getBaseline: () => Ref.get(baselineRef)
  })
})

// Layer提供
export const MemoryProfilerLive = Layer.effect(MemoryProfiler, makeMemoryProfiler)
```

## メモリリーク検出

### WeakMap/WeakSetの活用

```typescript
// 追跡対象オブジェクト情報
export interface TrackedObject {
  readonly label: string
  readonly timestamp: number
  readonly stackTrace: string
}

// リーク検出結果
export interface LeakDetectionResult {
  readonly totalTracked: number
  readonly potentialLeaks: ReadonlyArray<TrackedObject>
  readonly checkTimestamp: number
}

// LeakDetectorサービス定義
export const LeakDetector = Context.GenericTag<{
  readonly track: (obj: object, label: string) => Effect.Effect<void, never>
  readonly startMonitoring: (intervalMs?: number) => Effect.Effect<void, never>
  readonly stopMonitoring: () => Effect.Effect<void, never>
  readonly forceCheck: () => Effect.Effect<LeakDetectionResult, never>
  readonly getTrackedCount: () => Effect.Effect<number, never>
  readonly setThreshold: (threshold: number) => Effect.Effect<void, never>
}>("@minecraft/LeakDetector")

// 実装
const makeLeakDetector = Effect.gen(function* () {
  const trackedMapRef = yield* Ref.make(new WeakMap<object, TrackedObject>())
  const counterRef = yield* Ref.make(0)
  const thresholdRef = yield* Ref.make(100)
  const monitoringRef = yield* Ref.make<boolean>(false)
  const fiberRef = yield* Ref.make<Option.Option<Fiber.Fiber<void, never>>>(Option.none())

  const forceGC = Effect.sync(() => {
    // ガベージコレクション強制（開発環境のみ）
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc()
    }
  })

  const performLeakCheck = Effect.gen(function* () {
    yield* forceGC
    const count = yield* Ref.get(counterRef)
    const threshold = yield* Ref.get(thresholdRef)

    // 実際の実装では、より詳細なリーク検出ロジックが必要
    yield* Effect.log(`Leak detection check: ${count} objects tracked (threshold: ${threshold})`)

    const result: LeakDetectionResult = {
      totalTracked: count,
      potentialLeaks: [], // WeakMapから取得できないため空配列
      checkTimestamp: Date.now()
    }

    if (count > threshold) {
      yield* Effect.logWarning(`Potential memory leak detected: ${count} objects exceed threshold ${threshold}`)
    }

    return result
  })

  const monitoringLoop = Effect.gen(function* () {
    while (yield* Ref.get(monitoringRef)) {
      yield* performLeakCheck
      yield* Effect.sleep(5000) // デフォルト5秒間隔
    }
  })

  return LeakDetector.of({
    track: (obj, label) => Effect.gen(function* () {
      const tracked = yield* Ref.get(trackedMapRef)
      const trackedObject: TrackedObject = {
        label,
        timestamp: Date.now(),
        stackTrace: new Error().stack || ''
      }

      tracked.set(obj, trackedObject)
      yield* Ref.update(counterRef, n => n + 1)

      yield* Effect.log(`Object tracked: ${label} (total: ${yield* Ref.get(counterRef)})`)
    }),

    startMonitoring: (intervalMs = 5000) => Effect.gen(function* () {
      const isMonitoring = yield* Ref.get(monitoringRef)

      if (isMonitoring) {
        yield* Effect.logWarning("Monitoring already started")
        return
      }

      yield* Ref.set(monitoringRef, true)

      const monitoringFiber = yield* Effect.fork(
        Effect.gen(function* () {
          while (yield* Ref.get(monitoringRef)) {
            yield* performLeakCheck
            yield* Effect.sleep(intervalMs)
          }
        })
      )

      yield* Ref.set(fiberRef, Option.some(monitoringFiber))
      yield* Effect.log(`Leak monitoring started with ${intervalMs}ms interval`)
    }),

    stopMonitoring: () => Effect.gen(function* () {
      yield* Ref.set(monitoringRef, false)

      const maybeFiber = yield* Ref.get(fiberRef)
      yield* Option.match(maybeFiber, {
        onNone: () => Effect.unit,
        onSome: fiber => Fiber.interrupt(fiber)
      })

      yield* Ref.set(fiberRef, Option.none())
      yield* Effect.log("Leak monitoring stopped")
    }),

    forceCheck: () => performLeakCheck,

    getTrackedCount: () => Ref.get(counterRef),

    setThreshold: (threshold) => Effect.gen(function* () {
      yield* Ref.set(thresholdRef, threshold)
      yield* Effect.log(`Leak detection threshold set to ${threshold}`)
    })
  })
})

// Layer提供
export const LeakDetectorLive = Layer.effect(LeakDetector, makeLeakDetector)

// Effectリソース管理
export const trackResource = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  label: string
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const resource = { label, created: Date.now() }
      console.log(`🔵 Resource acquired: ${label}`)
      return resource
    }),
    (resource) => effect,
    (resource) =>
      Effect.sync(() => {
        console.log(`🔴 Resource released: ${label}`)
      })
  )
```

### チャンクメモリ管理

```typescript
// チャンク座標型
export interface ChunkCoordinate {
  readonly x: number
  readonly z: number
}

// チャンクメモリ情報
export interface ChunkMemoryInfo {
  readonly x: number
  readonly z: number
  readonly size: number
  readonly lastAccess: number
  readonly accessCount: number
}

// チャンクメモリ統計
export interface ChunkMemoryStats {
  readonly loadedCount: number
  readonly totalMemory: number
  readonly maxMemory: number
  readonly utilizationPercent: number
  readonly averageChunkSize: number
  readonly evictionThreshold: number
}

// LRU退避結果
export interface EvictionResult {
  readonly evictedCount: number
  readonly freedMemory: number
  readonly evictedChunks: ReadonlyArray<ChunkCoordinate>
  readonly remainingMemory: number
}

// メモリ制限超過エラー
export class MemoryLimitExceededError extends Schema.TaggedError("MemoryLimitExceededError")<{
  readonly currentMemory: number
  readonly maxMemory: number
  readonly chunkCoordinate: ChunkCoordinate
  readonly timestamp: number
}> {}

// ChunkMemoryMonitorサービス定義
export const ChunkMemoryMonitor = Context.GenericTag<{
  readonly registerChunk: (coord: ChunkCoordinate, sizeBytes: number) => Effect.Effect<EvictionResult | null, MemoryLimitExceededError>
  readonly unregisterChunk: (coord: ChunkCoordinate) => Effect.Effect<boolean, never>
  readonly accessChunk: (coord: ChunkCoordinate) => Effect.Effect<boolean, never>
  readonly getStats: () => Effect.Effect<ChunkMemoryStats, never>
  readonly forceEviction: (targetUtilization?: number) => Effect.Effect<EvictionResult, never>
  readonly setMaxMemory: (maxMemoryMB: number) => Effect.Effect<void, never>
  readonly clear: () => Effect.Effect<void, never>
}>("@minecraft/ChunkMemoryMonitor")

// 実装
const makeChunkMemoryMonitor = (maxMemoryMB: number = 500) => Effect.gen(function* () {
  const loadedChunksRef = yield* Ref.make(new Map<string, ChunkMemoryInfo>())
  const maxMemoryRef = yield* Ref.make(maxMemoryMB * 1024 * 1024)
  const currentMemoryRef = yield* Ref.make(0)

  const createChunkKey = (coord: ChunkCoordinate): string => `${coord.x},${coord.z}`

  const parseChunkKey = (key: string): ChunkCoordinate => {
    const [x, z] = key.split(',').map(Number)
    return { x, z }
  }

  const performEviction = (targetUtilization: number = 0.8) => Effect.gen(function* () {
    const loadedChunks = yield* Ref.get(loadedChunksRef)
    const currentMemory = yield* Ref.get(currentMemoryRef)
    const maxMemory = yield* Ref.get(maxMemoryRef)
    const targetMemory = maxMemory * targetUtilization

    if (currentMemory <= targetMemory) {
      return {
        evictedCount: 0,
        freedMemory: 0,
        evictedChunks: [],
        remainingMemory: currentMemory
      }
    }

    // LRU順にソート
    const sorted = Array.from(loadedChunks.entries())
      .sort(([, a], [, b]) => a.lastAccess - b.lastAccess)

    let evictedCount = 0
    let freedMemory = 0
    const evictedChunks: ChunkCoordinate[] = []
    let remainingMemory = currentMemory

    const updatedChunks = new Map(loadedChunks)

    for (const [key, info] of sorted) {
      if (remainingMemory <= targetMemory) {
        break
      }

      updatedChunks.delete(key)
      remainingMemory -= info.size
      freedMemory += info.size
      evictedCount++
      evictedChunks.push(parseChunkKey(key))

      yield* Effect.log(`♻️ Evicted chunk ${key} (${formatBytes(info.size)})`)
    }

    yield* Ref.set(loadedChunksRef, updatedChunks)
    yield* Ref.set(currentMemoryRef, remainingMemory)

    yield* Effect.log(`♻️ Total evicted: ${evictedCount} chunks, freed: ${formatBytes(freedMemory)}`)

    return {
      evictedCount,
      freedMemory,
      evictedChunks,
      remainingMemory
    }
  })

  return ChunkMemoryMonitor.of({
    registerChunk: (coord, sizeBytes) => Effect.gen(function* () {
      const key = createChunkKey(coord)
      const loadedChunks = yield* Ref.get(loadedChunksRef)
      const currentMemory = yield* Ref.get(currentMemoryRef)
      const maxMemory = yield* Ref.get(maxMemoryRef)

      let newCurrentMemory = currentMemory

      // 既存チャンクがある場合は置換
      if (loadedChunks.has(key)) {
        const existing = loadedChunks.get(key)!
        newCurrentMemory -= existing.size
      }

      const newChunkInfo: ChunkMemoryInfo = {
        x: coord.x,
        z: coord.z,
        size: sizeBytes,
        lastAccess: Date.now(),
        accessCount: 1
      }

      newCurrentMemory += sizeBytes

      const updatedChunks = new Map(loadedChunks).set(key, newChunkInfo)
      yield* Ref.set(loadedChunksRef, updatedChunks)
      yield* Ref.set(currentMemoryRef, newCurrentMemory)

      // メモリ制限チェック
      if (newCurrentMemory > maxMemory) {
        yield* Effect.log(`⚠️ Memory limit exceeded: ${formatBytes(newCurrentMemory)} > ${formatBytes(maxMemory)}`)
        const evictionResult = yield* performEviction(0.8)
        return evictionResult
      }

      return null
    }),

    unregisterChunk: (coord) => Effect.gen(function* () {
      const key = createChunkKey(coord)
      const loadedChunks = yield* Ref.get(loadedChunksRef)

      if (!loadedChunks.has(key)) {
        return false
      }

      const chunkInfo = loadedChunks.get(key)!
      const updatedChunks = new Map(loadedChunks)
      updatedChunks.delete(key)

      yield* Ref.set(loadedChunksRef, updatedChunks)
      yield* Ref.update(currentMemoryRef, current => current - chunkInfo.size)

      yield* Effect.log(`🗑️ Unregistered chunk ${key} (${formatBytes(chunkInfo.size)})`)
      return true
    }),

    accessChunk: (coord) => Effect.gen(function* () {
      const key = createChunkKey(coord)
      const loadedChunks = yield* Ref.get(loadedChunksRef)

      if (!loadedChunks.has(key)) {
        return false
      }

      const chunkInfo = loadedChunks.get(key)!
      const updatedInfo: ChunkMemoryInfo = {
        ...chunkInfo,
        lastAccess: Date.now(),
        accessCount: chunkInfo.accessCount + 1
      }

      const updatedChunks = new Map(loadedChunks).set(key, updatedInfo)
      yield* Ref.set(loadedChunksRef, updatedChunks)

      return true
    }),

    getStats: () => Effect.gen(function* () {
      const loadedChunks = yield* Ref.get(loadedChunksRef)
      const currentMemory = yield* Ref.get(currentMemoryRef)
      const maxMemory = yield* Ref.get(maxMemoryRef)

      const stats: ChunkMemoryStats = {
        loadedCount: loadedChunks.size,
        totalMemory: currentMemory,
        maxMemory,
        utilizationPercent: (currentMemory / maxMemory) * 100,
        averageChunkSize: loadedChunks.size > 0 ? currentMemory / loadedChunks.size : 0,
        evictionThreshold: maxMemory * 0.8
      }

      return stats
    }),

    forceEviction: (targetUtilization = 0.8) => performEviction(targetUtilization),

    setMaxMemory: (maxMemoryMB) => Effect.gen(function* () {
      const newMaxMemory = maxMemoryMB * 1024 * 1024
      yield* Ref.set(maxMemoryRef, newMaxMemory)
      yield* Effect.log(`📏 Max memory limit set to ${formatBytes(newMaxMemory)}`)

      // 新しい制限を超えている場合は退避実行
      const currentMemory = yield* Ref.get(currentMemoryRef)
      if (currentMemory > newMaxMemory) {
        yield* performEviction(0.8)
      }
    }),

    clear: () => Effect.gen(function* () {
      yield* Ref.set(loadedChunksRef, new Map())
      yield* Ref.set(currentMemoryRef, 0)
      yield* Effect.log("🧹 All chunks cleared from memory")
    })
  })
})

// Layer提供
export const ChunkMemoryMonitorLive = (maxMemoryMB: number = 500) =>
  Layer.effect(ChunkMemoryMonitor, makeChunkMemoryMonitor(maxMemoryMB))
```

## Chrome DevTools統合

### Performance API活用

```typescript
// User Timing API統合
export const measureUserTiming = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  name: string
) =>
  Effect.gen(function* () {
    performance.mark(`${name}-start`)

    const result = yield* effect.pipe(
      Effect.tapBoth({
        onFailure: () =>
          Effect.sync(() => {
            performance.mark(`${name}-error`)
            performance.measure(
              `${name} (failed)`,
              `${name}-start`,
              `${name}-error`
            )
          }),
        onSuccess: () =>
          Effect.sync(() => {
            performance.mark(`${name}-end`)
            performance.measure(
              name,
              `${name}-start`,
              `${name}-end`
            )
          })
      })
    )

    return result
  })

// カスタムDevToolsパネル
export const initializeDevTools = () => {
  if (typeof window !== 'undefined' && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    const devtools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__

    devtools.onCommitFiberRoot = (id: any, root: any) => {
      console.log('Render committed:', root)
    }
  }

  // パフォーマンス観測
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'measure') {
        console.log(`📊 ${entry.name}: ${entry.duration.toFixed(2)}ms`)
      }
    }
  })

  observer.observe({ entryTypes: ['measure'] })
}
```

## 開発ツール設定

### VSCode設定

```json
{
  "launch": {
    "version": "0.2.0",
    "configurations": [
      {
        "type": "node",
        "request": "launch",
        "name": "Debug Minecraft",
        "skipFiles": ["<node_internals>/**"],
        "program": "${workspaceFolder}/src/main.ts",
        "preLaunchTask": "npm: build",
        "outFiles": ["${workspaceFolder}/dist/**/*.js"],
        "env": {
          "NODE_ENV": "development",
          "DEBUG": "minecraft:*",
          "FORCE_COLOR": "1"
        },
        "runtimeArgs": [
          "--inspect",
          "--enable-source-maps",
          "--expose-gc"
        ],
        "console": "integratedTerminal"
      }
    ]
  }
}
```

### Chrome DevTools設定

```typescript
// DevTools拡張
export const setupDevToolsExtension = () => {
  // Redux DevTools統合（状態管理用）
  const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__

  if (devTools) {
    const store = devTools.connect({
      name: 'Minecraft State',
      features: {
        pause: true,
        lock: true,
        persist: true,
        export: true,
        import: 'custom',
        jump: true,
        skip: false,
        reorder: false,
        dispatch: true,
        test: false
      }
    })

    // 状態変更を送信
    store.send('INIT', getInitialState())
  }
}
```

## トラブルシューティング

### よくある問題と解決策

```typescript
// Effect実行エラーの診断
export const diagnoseEffectError = <E>(error: E): DiagnosisResult => {
  const diagnosis: DiagnosisResult = {
    type: 'unknown',
    message: '',
    suggestions: []
  }

  if (Cause.isFailure(error)) {
    const defect = Cause.failureOption(error)
    if (Option.isSome(defect)) {
      diagnosis.type = 'failure'
      diagnosis.message = String(defect.value)
      diagnosis.suggestions.push(
        'Check error handling in Effect chain',
        'Ensure all errors are properly typed'
      )
    }
  }

  if (Cause.isDie(error)) {
    diagnosis.type = 'defect'
    diagnosis.message = 'Unexpected error (Die)'
    diagnosis.suggestions.push(
      'Check for unhandled exceptions',
      'Review Effect.die usage'
    )
  }

  if (Cause.isInterrupted(error)) {
    diagnosis.type = 'interrupted'
    diagnosis.message = 'Effect was interrupted'
    diagnosis.suggestions.push(
      'Check fiber cancellation logic',
      'Review timeout configurations'
    )
  }

  return diagnosis
}

// パフォーマンス問題の診断
export const diagnosePerformance = async (): Promise<PerformanceDiagnosis> => {
  const diagnosis: PerformanceDiagnosis = {
    fps: 0,
    memory: {},
    suggestions: []
  }

  // FPS計測
  let lastTime = performance.now()
  let frames = 0

  const measureFPS = () => {
    frames++
    const currentTime = performance.now()

    if (currentTime >= lastTime + 1000) {
      diagnosis.fps = Math.round((frames * 1000) / (currentTime - lastTime))
      frames = 0
      lastTime = currentTime
    }

    if (diagnosis.fps < 30) {
      diagnosis.suggestions.push(
        'Reduce render distance',
        'Optimize chunk meshing',
        'Enable frustum culling'
      )
    }
  }

  // メモリ診断
  if ('memory' in performance) {
    const memory = (performance as any).memory
    diagnosis.memory = {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit
    }

    const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit
    if (usage > 0.8) {
      diagnosis.suggestions.push(
        'Unload distant chunks',
        'Reduce texture resolution',
        'Clear unused caches'
      )
    }
  }

  return diagnosis
}
```