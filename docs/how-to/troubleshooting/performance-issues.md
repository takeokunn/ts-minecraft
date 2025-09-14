---
title: "パフォーマンス問題トラブルシューティング - 包括的パフォーマンス最適化"
description: "TypeScript Minecraftプロジェクトのパフォーマンス問題35技術。Effect-TS Fiber、Three.jsレンダリング、WebGL GPUメモリ管理。"
category: "troubleshooting"
difficulty: "advanced"
tags: ["performance", "troubleshooting", "optimization", "memory-management", "webgl", "three.js", "effect-ts"]
prerequisites: ["performance-fundamentals", "webgl-basics", "effect-ts-intermediate"]
estimated_reading_time: "40分"
related_patterns: ["optimization-patterns-latest", "service-patterns"]
related_docs: ["./debugging-guide.md", "./runtime-errors.md", "../../03-guides/05-comprehensive-testing-strategy.md"]
status: "complete"
---

# パフォーマンス問題のトラブルシューティング

> **包括的パフォーマンス最適化**: TypeScript Minecraft プロジェクトのための35の高度なパフォーマンス最適化技術とメモリ管理戦略

TypeScript Minecraft プロジェクトにおけるパフォーマンス問題の精密な検出、深層分析、そして実践的な解決方法を継続的に解説します。Effect-TSのFiberシステム、Three.jsのレンダリングパイプライン、WebGLのGPUメモリ管理、そしてゲームロジックの最適化に特化した包括的ガイドです。

## メモリリーク検出と対処

### メモリリークの症状と検出

#### 症状
- ブラウザタブのメモリ使用量が徐々に増加
- ガベージコレクションが頻繁に発生
- FPSの低下とアプリケーション応答性の悪化

#### Chrome DevTools を使用した検出
```typescript
// メモリ使用量の監視
const monitorMemoryUsage = Effect.schedule(
  Effect.gen(function* () {
    if (performance.memory) {
      const memInfo = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      }

      yield* Effect.logInfo("Memory Usage", memInfo)

      // メモリ使用量が閾値を超えた場合の警告
      if (memInfo.used > memInfo.limit * 0.8) {
        yield* Effect.logWarn("Memory usage is high", { percentage: (memInfo.used / memInfo.limit) * 100 })
      }
    }
  }),
  Schedule.fixed("30 seconds")
)

// ヒープスナップショットのトリガー
const createHeapSnapshot = (label: string) =>
  Effect.sync(() => {
    if (typeof window !== 'undefined' && 'gc' in window) {
      // Force garbage collection (Chrome --enable-precise-memory-info)
      (window as any).gc()
    }
    console.log(`📊 Heap snapshot: ${label}`)
    performance.mark(`heap-${label}`)
  })
```

### 一般的なメモリリーク原因と対策

#### 1. DOM要素の参照保持
```typescript
// ❌ 問題のあるコード - DOM要素への直接参照
interface RenderManager {
  private canvasElement: HTMLCanvasElement

  constructor(canvasId: string) {
    this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement
  }
}

// ✅ 修正後 - 弱参照とEffect管理
const createRenderManager = (canvasId: string) =>
  Effect.gen(function* () {
    const canvasElement = yield* Effect.sync(() =>
      document.getElementById(canvasId) as HTMLCanvasElement
    )

    if (!canvasElement) {
      return yield* Effect.fail(new CanvasNotFoundError({ canvasId }))
    }

    return yield* Effect.acquireRelease(
      Effect.sync(() => ({
        canvas: new WeakRef(canvasElement),
        getCanvas: () => {
          const canvas = new WeakRef(canvasElement).deref()
          if (!canvas) throw new Error("Canvas element was garbage collected")
          return canvas
        }
      })),
      (manager) => Effect.sync(() => {
        // クリーンアップ処理
        console.log("🧹 RenderManager cleaned up")
      })
    )
  })
```

#### 2. イベントリスナーの適切な削除
```typescript
// Effect による適切なイベントリスナー管理
const setupKeyboardHandling = (element: HTMLElement) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // キー処理
      }

      element.addEventListener('keydown', handleKeyDown)
      return { element, handleKeyDown }
    }),
    ({ element, handleKeyDown }) => Effect.sync(() => {
      element.removeEventListener('keydown', handleKeyDown)
      console.log("🧹 Event listener removed")
    })
  )

// 使用例
const keyboardManager = Effect.scoped(
  Effect.gen(function* () {
    const handler = yield* setupKeyboardHandling(document.body)

    // その他の処理...

    return handler
  })
)
```

#### 3. Three.js リソースの適切な破棄
```typescript
// テクスチャとジオメトリのメモリ管理
const createManagedTexture = (url: string) =>
  Effect.acquireRelease(
    Effect.async<THREE.Texture, TextureLoadError>((resume) => {
      const loader = new THREE.TextureLoader()

      loader.load(
        url,
        (texture) => resume(Effect.succeed(texture)),
        undefined,
        (error) => resume(Effect.fail(new TextureLoadError({ url, error })))
      )
    }),
    (texture) => Effect.sync(() => {
      texture.dispose()
      console.log(`🧹 Texture disposed: ${texture.name}`)
    })
  )

// ジオメトリの管理
const createManagedGeometry = <T extends THREE.BufferGeometry>(
  geometryFactory: () => T
) =>
  Effect.acquireRelease(
    Effect.sync(geometryFactory),
    (geometry) => Effect.sync(() => {
      geometry.dispose()
      console.log("🧹 Geometry disposed")
    })
  )

// マテリアルの管理
const createManagedMaterial = <T extends THREE.Material>(
  materialFactory: () => T
) =>
  Effect.acquireRelease(
    Effect.sync(materialFactory),
    (material) => Effect.sync(() => {
      material.dispose()
      console.log("🧹 Material disposed")
    })
  )
```

### Effect Fiber のメモリリーク対策

#### Fork されたFiber の適切な管理
```typescript
// ❌ 問題のあるコード - Fiber のリークリスク
const startBackgroundTasks = Effect.gen(function* () {
  // これらのFiberが適切に管理されていない
  yield* Effect.fork(infiniteLoop)
  yield* Effect.fork(periodicTask)
})

// ✅ 修正後 - Scope による適切な管理
const managedBackgroundTasks = Effect.scoped(
  Effect.gen(function* () {
    const backgroundFiber = yield* Effect.forkScoped(infiniteLoop)
    const periodicFiber = yield* Effect.forkScoped(periodicTask)

    // Fiberの監視
    yield* Effect.fork(
      Effect.gen(function* () {
        yield* Effect.sleep("1 minute")
        const bgStatus = yield* Fiber.status(backgroundFiber)
        const periodicStatus = yield* Fiber.status(periodicFiber)

        yield* Effect.logDebug("Fiber Status", {
          background: bgStatus._tag,
          periodic: periodicStatus._tag
        })
      })
    )

    return { backgroundFiber, periodicFiber }
  })
)
```

#### FiberRefs によるメモリ効率の改善
```typescript
import * as FiberRef from "effect/FiberRef"

// 適切なFiberRef使用
const playerContextRef = FiberRef.unsafeMake<Option.Option<Player>>(Option.none())

const withPlayerContext = <A, E>(
  player: Player,
  effect: Effect.Effect<A, E>
): Effect.Effect<A, E> =>
  pipe(
    effect,
    Effect.locally(playerContextRef, Option.some(player))
  )

// 使用後の自動クリーンアップ
const processPlayerAction = (playerId: PlayerId, action: PlayerAction) =>
  Effect.scoped(
    Effect.gen(function* () {
      const player = yield* loadPlayer(playerId)

      return yield* pipe(
        handlePlayerAction(action),
        withPlayerContext(player),
        Effect.ensuring(
          FiberRef.update(playerContextRef, () => Option.none())
        )
      )
    })
  )
```

## Render パフォーマンスの最適化

### フレームレート監視と分析

#### Performance API による詳細測定
```typescript
import * as Stats from "stats.js"

// パフォーマンス監視の設定
const setupPerformanceMonitoring = Effect.gen(function* () {
  const stats = yield* Effect.sync(() => new Stats())

  yield* Effect.sync(() => {
    stats.showPanel(0) // FPS
    document.body.appendChild(stats.dom)
  })

  // フレームごとの測定
  const monitorFrame = Effect.sync(() => {
    stats.begin()
    return stats
  })

  const endFrameMonitoring = (stats: Stats) => Effect.sync(() => {
    stats.end()
  })

  return { monitorFrame, endFrameMonitoring, stats }
})

// レンダリングループでの使用
const optimizedRenderLoop = Effect.gen(function* () {
  const { monitorFrame, endFrameMonitoring } = yield* setupPerformanceMonitoring

  return yield* Effect.forever(
    Effect.gen(function* () {
      const stats = yield* monitorFrame

      // レンダリング処理
      yield* renderScene
      yield* updateEntities
      yield* processPhysics

      yield* endFrameMonitoring(stats)
      yield* Effect.yieldNow()
    })
  )
})
```

#### GPU パフォーマンスの監視
```typescript
// WebGL パフォーマンス拡張の使用
const setupGPUMonitoring = (renderer: THREE.WebGLRenderer) =>
  Effect.gen(function* () {
    const gl = renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')

    if (!ext) {
      yield* Effect.logWarn("GPU timing extension not available")
      return Option.none()
    }

    return Option.some({
      createQuery: () => Effect.sync(() => gl.createQuery()),
      beginQuery: (query: WebGLQuery) => Effect.sync(() => {
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query)
      }),
      endQuery: () => Effect.sync(() => {
        gl.endQuery(ext.TIME_ELAPSED_EXT)
      }),
      getResult: (query: WebGLQuery) => Effect.sync(() => {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)
        if (available) {
          const result = gl.getQueryParameter(query, gl.QUERY_RESULT)
          return Option.some(result / 1000000) // ナノ秒をミリ秒に変換
        }
        return Option.none()
      })
    })
  })
```

### フラストラムカリングの最適化

#### 効率的な可視性判定
```typescript
// チャンクの可視性計算
const isChunkVisible = (
  chunk: Chunk,
  camera: THREE.Camera,
  frustum: THREE.Frustum
): boolean => {
  const boundingBox = new THREE.Box3(
    new THREE.Vector3(chunk.x * 16, 0, chunk.z * 16),
    new THREE.Vector3((chunk.x + 1) * 16, 256, (chunk.z + 1) * 16)
  )

  return frustum.intersectsBox(boundingBox)
}

// 最適化されたレンダリング
const renderVisibleChunks = (
  chunks: Array<Chunk>,
  camera: THREE.Camera
) =>
  Effect.gen(function* () {
    const frustum = yield* Effect.sync(() => {
      const frustum = new THREE.Frustum()
      const matrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
      frustum.setFromProjectionMatrix(matrix)
      return frustum
    })

    const visibleChunks = yield* Effect.sync(() =>
      chunks.filter(chunk => isChunkVisible(chunk, camera, frustum))
    )

    yield* Effect.logDebug("Rendering chunks", {
      total: chunks.length,
      visible: visibleChunks.length,
      culled: chunks.length - visibleChunks.length
    })

    yield* Effect.forEach(visibleChunks, renderChunk)
  })
```

### Level of Detail (LOD) システム

#### 距離に応じた詳細レベル調整
```typescript
// LOD レベルの定義
const LodLevelSchema = Schema.Literal("high", "medium", "low", "hidden")
type LodLevel = Schema.Schema.Type<typeof LodLevelSchema>

// 距離に基づくLOD計算
const calculateLodLevel = (
  entityPosition: Vector3,
  cameraPosition: Vector3,
  lodDistances: { medium: number; low: number; hidden: number }
): LodLevel => {
  const distance = entityPosition.distanceTo(cameraPosition)

  if (distance > lodDistances.hidden) return "hidden"
  if (distance > lodDistances.low) return "low"
  if (distance > lodDistances.medium) return "medium"
  return "high"
}

// LOD対応レンダリング
const renderWithLod = (entity: Entity, camera: THREE.Camera) =>
  Effect.gen(function* () {
    const lodLevel = calculateLodLevel(
      entity.position,
      camera.position,
      { medium: 50, low: 100, hidden: 200 }
    )

    switch (lodLevel) {
      case "high":
        yield* renderHighDetail(entity)
        break
      case "medium":
        yield* renderMediumDetail(entity)
        break
      case "low":
        yield* renderLowDetail(entity)
        break
      case "hidden":
        // レンダリングしない
        break
    }

    yield* Effect.logTrace("Entity rendered", {
      entityId: entity.id,
      lodLevel,
      distance: entity.position.distanceTo(camera.position)
    })
  })
```

## チャンク読み込みの最適化

### 非同期チャンク生成の改善

#### バックグラウンド生成とストリーミング
```typescript
import * as Stream from "effect/Stream"
import * as Queue from "effect/Queue"

// チャンク生成のストリーミング処理
const createChunkGenerationStream = (
  center: ChunkCoordinate,
  radius: number
) =>
  Stream.fromIterable(generateChunkCoordinatesInRadius(center, radius)).pipe(
    Stream.mapEffect((coord) =>
      Effect.gen(function* () {
        // メモリ使用量チェック
        const memUsage = yield* getMemoryUsage

        if (memUsage.percentage > 0.8) {
          yield* Effect.logWarn("High memory usage, throttling chunk generation")
          yield* Effect.sleep("100 millis")
        }

        const chunk = yield* generateChunk(coord).pipe(
          Effect.timeout("5 seconds"),
          Effect.retry(
            Schedule.exponential("100 millis").pipe(
              Schedule.compose(Schedule.recurs(2))
            )
          )
        )

        return { coordinate: coord, chunk }
      }),
      { concurrency: 4 } // 並行生成数を制限
    ),
    Stream.buffer({ capacity: 8 }) // バッファリング
  )

// プリロード戦略
const preloadChunks = (
  player: Player,
  preloadRadius: number
) =>
  Effect.gen(function* () {
    const currentChunk = worldPositionToChunk(player.position)
    const queue = yield* Queue.bounded<ChunkCoordinate>(64)

    // 必要なチャンクをキューに追加
    const requiredChunks = generateChunkCoordinatesInRadius(currentChunk, preloadRadius)
    yield* Effect.forEach(requiredChunks, (coord) => Queue.offer(queue, coord))

    // バックグラウンドでの生成処理
    const backgroundGeneration = Effect.forever(
      Effect.gen(function* () {
        const coord = yield* Queue.take(queue)
        const isLoaded = yield* isChunkLoaded(coord)

        if (!isLoaded) {
          yield* generateChunk(coord).pipe(
            Effect.tapBoth({
              onFailure: (error) => Effect.logError("Chunk generation failed", { coord, error }),
              onSuccess: () => Effect.logDebug("Chunk preloaded", { coord })
            })
          )
        }

        yield* Effect.sleep("50 millis") // レート制限
      })
    )

    return yield* Effect.forkScoped(backgroundGeneration)
  })
```

### メモリ効率的なチャンク管理

#### LRU キャッシュによるチャンク管理
```typescript
// LRU キャッシュの実装
interface LRUChunkCache {
  private maxSize: number
  private cache = new Map<string, { chunk: Chunk; timestamp: number }>()

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get(coordinate: ChunkCoordinate): Option.Option<Chunk> {
    const key = `${coordinate.x},${coordinate.z}`
    const entry = this.cache.get(key)

    if (entry) {
      // アクセス時刻を更新
      entry.timestamp = Date.now()
      return Option.some(entry.chunk)
    }

    return Option.none()
  }

  put(coordinate: ChunkCoordinate, chunk: Chunk): void {
    const key = `${coordinate.x},${coordinate.z}`

    // キャッシュサイズが上限を超える場合、最古のエントリを削除
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]?.[0]

      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, { chunk, timestamp: Date.now() })
  }

  evict(coordinate: ChunkCoordinate): boolean {
    const key = `${coordinate.x},${coordinate.z}`
    return this.cache.delete(key)
  }

  size(): number {
    return this.cache.size
  }
}

// Effect サービスとしての実装
const ChunkCacheServiceLive = Layer.succeed(
  ChunkCacheService,
  {
    cache: new LRUChunkCache(100),

    getChunk: (coordinate) =>
      Effect.sync(() => this.cache.get(coordinate)),

    putChunk: (coordinate, chunk) =>
      Effect.sync(() => this.cache.put(coordinate, chunk)),

    evictChunk: (coordinate) =>
      Effect.sync(() => this.cache.evict(coordinate)),

    getCacheStats: () =>
      Effect.sync(() => ({
        size: this.cache.size(),
        maxSize: 100,
        usage: (this.cache.size() / 100) * 100
      }))
  }
)
```

## Effect Fiber デバッグとパフォーマンス

### Fiber リークの検出

#### アクティブ Fiber の監視
```typescript
import * as FiberRefs from "effect/FiberRefs"
import * as Supervisor from "effect/Supervisor"

// Fiber 監視の設定
const createFiberSupervisor = Effect.gen(function* () {
  const activeFibers = yield* Ref.make(new Set<Fiber.RuntimeFiber<any, any>>())

  const supervisor = Supervisor.track.pipe(
    Supervisor.map((fibers) =>
      Effect.gen(function* () {
        const fiberSet = new Set(fibers)
        yield* Ref.set(activeFibers, fiberSet)

        yield* Effect.logDebug("Active Fibers", {
          count: fiberSet.size,
          fibers: Array.from(fiberSet).map(f => f.id())
        })

        // Fiber リークの警告
        if (fiberSet.size > 50) {
          yield* Effect.logWarn("High number of active fibers detected", {
            count: fiberSet.size
          })
        }
      })
    )
  )

  return { supervisor, activeFibers }
})

// Fiber の定期監視
const monitorFibers = Effect.gen(function* () {
  const { supervisor, activeFibers } = yield* createFiberSupervisor

  return yield* Effect.schedule(
    Effect.gen(function* () {
      const fibers = yield* Ref.get(activeFibers)
      const stuckFibers = []

      for (const fiber of fibers) {
        const status = yield* Fiber.status(fiber)

        if (status._tag === "Suspended" && fiber.id().startsWith("long-running")) {
          stuckFibers.push(fiber.id())
        }
      }

      if (stuckFibers.length > 0) {
        yield* Effect.logWarn("Potentially stuck fibers detected", { stuckFibers })
      }
    }),
    Schedule.fixed("30 seconds")
  )
})
```

### Fiber プール最適化

#### 効率的な並行処理管理
```typescript
// セマフォによる Fiber 数制限
const createManagedFiberPool = (maxConcurrency: number) =>
  Effect.gen(function* () {
    const semaphore = yield* Semaphore.make(maxConcurrency)
    const activeTasks = yield* Ref.make(0)

    const executeWithPool = <A, E>(
      task: Effect.Effect<A, E>
    ): Effect.Effect<A, E> =>
      Effect.gen(function* () {
        yield* Semaphore.take(semaphore)
        yield* Ref.update(activeTasks, n => n + 1)

        const result = yield* task.pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              yield* Ref.update(activeTasks, n => n - 1)
              yield* Semaphore.release(semaphore)
            })
          )
        )

        return result
      })

    const getPoolStatus = Effect.gen(function* () {
      const active = yield* Ref.get(activeTasks)
      const available = yield* Semaphore.available(semaphore)

      return {
        active,
        available,
        maxConcurrency,
        utilization: (active / maxConcurrency) * 100
      }
    })

    return { executeWithPool, getPoolStatus }
  })

// 使用例: チャンク生成での Fiber プール
const optimizedChunkGeneration = Effect.gen(function* () {
  const { executeWithPool, getPoolStatus } = yield* createManagedFiberPool(4)

  const generateChunksInRadius = (center: ChunkCoordinate, radius: number) =>
    Effect.gen(function* () {
      const coordinates = generateChunkCoordinatesInRadius(center, radius)

      const results = yield* Effect.forEach(
        coordinates,
        (coord) => executeWithPool(generateChunk(coord)),
        { batching: true }
      )

      const status = yield* getPoolStatus
      yield* Effect.logInfo("Chunk generation completed", {
        generated: results.length,
        poolUtilization: status.utilization
      })

      return results
    })

  return generateChunksInRadius
})
```

## プロファイリングとベンチマーク

### 自動化されたパフォーマンステスト

#### ベンチマーク スイートの作成
```typescript
// ベンチマーク フレームワーク
const benchmark = <A>(
  name: string,
  operation: Effect.Effect<A>,
  iterations: number = 1000
) =>
  Effect.gen(function* () {
    const times: number[] = []

    // ウォームアップ
    yield* Effect.replicateEffect(operation, 10)

    // 実際の測定
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      yield* operation
      const end = performance.now()
      times.push(end - start)
    }

    // 統計計算
    const sorted = times.sort((a, b) => a - b)
    const mean = times.reduce((a, b) => a + b, 0) / times.length
    const median = sorted[Math.floor(sorted.length / 2)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]

    yield* Effect.logInfo(`Benchmark: ${name}`, {
      iterations,
      mean: `${mean.toFixed(2)}ms`,
      median: `${median.toFixed(2)}ms`,
      p95: `${p95.toFixed(2)}ms`,
      min: `${sorted[0].toFixed(2)}ms`,
      max: `${sorted[sorted.length - 1].toFixed(2)}ms`
    })

    return { name, mean, median, p95, min: sorted[0], max: sorted[sorted.length - 1] }
  })

// パフォーマンス回帰テスト
const runPerformanceTests = Effect.gen(function* () {
  const results = yield* Effect.all([
    benchmark("Chunk Generation", generateRandomChunk()),
    benchmark("Block Placement", placeRandomBlock()),
    benchmark("Player Movement", simulatePlayerMovement()),
    benchmark("Entity Update", updateRandomEntity())
  ])

  // 結果の分析
  const regressions = results.filter(result => result.mean > PERFORMANCE_THRESHOLDS[result.name])

  if (regressions.length > 0) {
    yield* Effect.logError("Performance regressions detected", { regressions })
  } else {
    yield* Effect.logInfo("All performance tests passed", { results })
  }

  return results
})
```

### メモリ使用量の分析

#### ヒープ分析とリーク検出
```typescript
// メモリ分析ツール
const analyzeMemoryUsage = Effect.gen(function* () {
  const initialMemory = yield* getMemoryUsage

  // 強制的なガベージコレクション（開発環境のみ）
  if (typeof window !== 'undefined' && 'gc' in window) {
    yield* Effect.sync(() => (window as any).gc())
  }

  const afterGCMemory = yield* getMemoryUsage

  const memoryStats = {
    beforeGC: initialMemory,
    afterGC: afterGCMemory,
    potentialLeak: (initialMemory.used - afterGCMemory.used) < (initialMemory.used * 0.1)
  }

  yield* Effect.logInfo("Memory Analysis", memoryStats)

  return memoryStats
})

// WeakRef を使用したオブジェクト追跡
const createMemoryTracker = <T extends object>() => {
  const trackedObjects = new Map<string, WeakRef<T>>()

  return {
    track: (id: string, obj: T) => {
      trackedObjects.set(id, new WeakRef(obj))
    },

    checkAlive: (id: string): boolean => {
      const ref = trackedObjects.get(id)
      return ref ? ref.deref() !== undefined : false
    },

    getAliveCount: (): number => {
      let aliveCount = 0
      for (const [id, ref] of trackedObjects) {
        if (ref.deref() !== undefined) {
          aliveCount++
        } else {
          trackedObjects.delete(id) // クリーンアップ
        }
      }
      return aliveCount
    }
  }
}
```

## 最適化のベストプラクティス

### 1. Effect の適切な合成
```typescript
// ❌ 非効率的な処理
const inefficientProcessing = Effect.gen(function* () {
  const chunks = yield* loadAllChunks
  const processedChunks = []

  for (const chunk of chunks) {
    const processed = yield* processChunk(chunk)
    processedChunks.push(processed)
  }

  return processedChunks
})

// ✅ 効率的な処理
const efficientProcessing = Effect.gen(function* () {
  const chunks = yield* loadAllChunks

  return yield* Effect.forEach(
    chunks,
    processChunk,
    { concurrency: 4, batching: true }
  )
})
```

### 2. 適切なリソース管理
```typescript
// リソースの自動管理
const managedResourceProcessing = Effect.scoped(
  Effect.gen(function* () {
    const textureAtlas = yield* createTextureAtlas
    const chunkRenderer = yield* createChunkRenderer(textureAtlas)

    // リソースを使用した処理
    const result = yield* renderAllChunks(chunkRenderer)

    // スコープ終了時に自動的にクリーンアップされる
    return result
  })
)
```

### 3. キャッシュとメモ化
```typescript
// 計算結果のキャッシュ
const memoizedChunkGeneration = Cache.make({
  capacity: 100,
  timeToLive: Duration.minutes(5),
  lookup: (coordinate: ChunkCoordinate) => generateChunk(coordinate)
})

const getCachedChunk = (coordinate: ChunkCoordinate) =>
  Effect.gen(function* () {
    const cache = yield* memoizedChunkGeneration
    return yield* Cache.get(cache, coordinate)
  })
```

## 関連リソース

- [よくあるエラー](./common-errors.md) - エラー対処法
- [デバッグガイド](./debugging-guide.md) - デバッグ手法
- [ビルド問題](./build-problems.md) - ビルド最適化
- [Chrome DevTools Memory](https://developer.chrome.com/docs/devtools/memory/) - メモリ分析手法