# パフォーマンス最適化ガイド

このドキュメントでは、最新のEffect-TSパターン（2024年版）を活用したts-minecraftプロジェクトでのパフォーマンス最適化の手法、プロファイリング方法、計測・モニタリング技術について説明します。Schema-based型安全性と関数型プログラミングによる最適化戦略を中心に扱います。

## パフォーマンス最適化の基本戦略

### 1. 階層別最適化アプローチ

```typescript
// レイヤーごとの最適化戦略
const optimizationStrategies = {
  domain: {
    // ビジネスロジックの最適化
    - アルゴリズムの効率化
    - データ構造の選択
    - 純粋関数による並列化
  },
  application: {
    // クエリとワークフローの最適化
    - ECSクエリの最適化
    - バッチ処理の活用
    - 並行処理の実装
  },
  infrastructure: {
    // 外部リソースとの統合最適化
    - Worker Poolの活用
    - メモリプールの利用
    - キャッシュ戦略の実装
  }
}
```

### 2. 最新Effect-TSパターンによる最適化

```typescript
import { Match } from "effect"

const PerformanceMetrics = Schema.Struct({
  startTime: Schema.Number,
  endTime: Schema.Number,
  duration: Schema.Number,
  memoryUsage: Schema.Number
})

type PerformanceMetrics = Schema.Schema.Type<typeof PerformanceMetrics>

const CacheConfig = Schema.Struct({
  capacity: Schema.Number.pipe(Schema.positive()),
  ttlMinutes: Schema.Number.pipe(Schema.positive()),
  enableCompression: Schema.Boolean
})

type CacheConfig = Schema.Schema.Type<typeof CacheConfig>

// 純粋関数としての性能測定ロジック
const calculateDuration = (startTime: number, endTime: number): number =>
  Math.max(0, endTime - startTime)

const formatDuration = (duration: number): string =>
  `${duration.toFixed(2)}ms`

// 計算量の多い処理を型安全にキャッシュ化
const expensiveCalculation = (input: ComplexData): Effect.Effect<ProcessedData, CalculationError> =>
  Effect.gen(function* () {
    // 早期リターン: 入力検証
    if (!input || Object.keys(input).length === 0) {
      return yield* Effect.fail({
        _tag: "CalculationError" as const,
        message: "Invalid input data"
      })
    }

    const startTime = yield* Effect.sync(() => performance.now())
    const result = yield* computeHeavyOperation(input)
    const endTime = yield* Effect.sync(() => performance.now())

    const duration = calculateDuration(startTime, endTime)
    const formattedDuration = formatDuration(duration)

    yield* Effect.logInfo(`Calculation completed in ${formattedDuration}`)
    return result
  })

// Schema-basedキャッシュ設定
const createOptimizedCache = (config: CacheConfig): Effect.Effect<Cache.Cache<ProcessedData, ComplexData>, never> =>
  Cache.make({
    capacity: config.capacity,
    timeToLive: Duration.minutes(config.ttlMinutes),
    lookup: expensiveCalculation
  })
```

## プロファイリング方法

### 1. 組み込みプロファイラーの使用

```typescript
// プロファイラーの作成と使用
const profiler = yield* createPerformanceProfiler()

// 計測開始
yield* profiler.start()

// 記録開始
yield* profiler.startRecording()

// 処理実行
for (let i = 0; i < 1000; i++) {
  yield* profiler.update(16.67) // 60 FPS相当
}

// データ取得
const performanceData = yield* profiler.stopRecording()
const analysis = yield* profiler.analyzePerformance()

console.log('Performance Analysis:', analysis)
```

### 2. システム別プロファイリング

```typescript
// 特定システムのプロファイル
const profileSystem = (systemName: string, systemFn: SystemFunction) =>
  Effect.gen(function* () {
    const profiler = yield* ProfilerService
    const sessionId = yield* profiler.startSession(systemName)
    
    try {
      const result = yield* systemFn()
      return result
    } finally {
      yield* profiler.endSession(sessionId)
    }
  })

// 使用例
const optimizedPhysicsSystem = profileSystem('physics-update', physicsUpdateSystem)
```

### 3. メモリプロファイリング

```typescript
const memoryProfile = Effect.gen(function* () {
  const startMemory = yield* getMemoryUsage
  
  // 大量のオブジェクトを作成
  const largeData = yield* createLargeDataSet(10000)
  
  const peakMemory = yield* getMemoryUsage
  
  // データを解放
  yield* releaseLargeDataSet(largeData)
  
  const endMemory = yield* getMemoryUsage
  
  return {
    memoryGrowth: peakMemory - startMemory,
    memoryLeaked: endMemory - startMemory,
    efficiency: (peakMemory - startMemory) / largeData.length
  }
})

const getMemoryUsage = Effect.sync(() => {
  if (typeof performance !== 'undefined' && performance.memory) {
    return performance.memory.usedJSHeapSize / 1024 / 1024 // MB
  }
  return 0
})
```

## Worker活用による最適化

### 1. 計算集約的処理のWorker化

```typescript
// メッシュ生成をWorkerで実行
const generateMeshWithWorker = (chunkData: ChunkData) =>
  Effect.gen(function* () {
    const workerManager = yield* WorkerManager
    const startTime = yield* Effect.sync(() => performance.now())
    
    // Worker Poolを使って並列処理
    const meshData = yield* workerManager.executeTask({
      type: 'mesh-generation',
      payload: {
        chunkData,
        algorithm: 'greedy',
        optimizations: {
          enableVertexWelding: true,
          enableIndexOptimization: true,
        }
      }
    })
    
    const duration = yield* Effect.sync(() => performance.now() - startTime)
    yield* Effect.logInfo(`Mesh generated in ${duration.toFixed(2)}ms`)
    
    return meshData
  })
```

### 2. Worker Pool最適化

```typescript
// Worker Pool設定の最適化
const optimizedWorkerPoolConfig = {
  // CPUコア数に基づく動的設定
  meshWorkers: Math.min(navigator.hardwareConcurrency, 4),
  computeWorkers: Math.max(1, navigator.hardwareConcurrency - 2),
  
  // 専用Workerの設定
  dedicatedPhysicsWorker: true,
  dedicatedRenderWorker: false,
  
  // バックプレッシャー制御
  maxQueueSize: 100,
  timeoutMs: 5000,
}

const WorkerPoolLive = WorkerPoolService.Live(optimizedWorkerPoolConfig)
```

## メモリ最適化

### 1. オブジェクトプールの活用

```typescript
// Vector3オブジェクトプール
const vector3Pool = yield* ObjectPool.create(
  () => ({ x: 0, y: 0, z: 0 }), // ファクトリー関数
  (vector) => { // リセット関数
    vector.x = 0
    vector.y = 0
    vector.z = 0
  },
  {
    initialSize: 1000,
    maxSize: 10000,
    expandBy: 100,
  }
)

// 使用例
const calculateDistance = (pos1: Position, pos2: Position) =>
  Effect.gen(function* () {
    const temp = yield* vector3Pool.acquire()
    
    temp.x = pos1.x - pos2.x
    temp.y = pos1.y - pos2.y
    temp.z = pos1.z - pos2.z
    
    const distance = Math.sqrt(temp.x * temp.x + temp.y * temp.y + temp.z * temp.z)
    
    yield* vector3Pool.release(temp)
    return distance
  })
```

### 2. メモリプールの実装

```typescript
// 大きなバッファ用のメモリプール
const chunkDataPool = yield* MemoryPool.create({
  itemSize: 65536, // 64KB chunks
  initialCount: 50,
  maxCount: 500,
  growthFactor: 1.5,
})

// チャンクデータの効率的な管理
const processChunk = (chunkCoordinate: ChunkCoordinate) =>
  Effect.gen(function* () {
    const buffer = yield* chunkDataPool.acquire()
    
    try {
      // バッファを使ってチャンクデータを処理
      const processedData = yield* processChunkData(buffer, chunkCoordinate)
      return processedData
    } finally {
      yield* chunkDataPool.release(buffer)
    }
  })
```

### 3. ガベージコレクション最適化

```typescript
// GCプレッシャーを減らす戦略
const reduceGCPressure = Effect.gen(function* () {
  // 長寿命オブジェクトの事前割り当て
  const preallocatedBuffers = Array.from({ length: 100 }, () => 
    new Float32Array(1000)
  )
  
  // 再利用可能なワークスペース
  const workspace = {
    tempVectors: Array.from({ length: 50 }, () => ({ x: 0, y: 0, z: 0 })),
    tempMatrices: Array.from({ length: 10 }, () => new Float32Array(16)),
  }
  
  return { preallocatedBuffers, workspace }
})
```

## レンダリング最適化

### 1. LOD（Level of Detail）システム

```typescript
const calculateLOD = (entity: Entity, cameraPosition: Position) =>
  Effect.gen(function* () {
    const distance = yield* calculateDistance(entity.position, cameraPosition)
    
    if (distance < 50) return 0  // 高詳細
    if (distance < 200) return 1 // 中詳細
    if (distance < 500) return 2 // 低詳細
    return 3 // 最低詳細またはカリング
  })

// LODに基づくメッシュ選択
const selectMeshByLOD = (entity: Entity, lodLevel: number) =>
  Effect.gen(function* () {
    const meshAssets = yield* MeshRepository.getByEntity(entity.id)
    return meshAssets.lod[lodLevel] || meshAssets.lod[0]
  })
```

### 2. 描画呼び出し最適化

```typescript
// インスタンス描画でドローコールを削減
const batchSimilarMeshes = (entities: Entity[]) =>
  Effect.gen(function* () {
    const meshGroups = new Map<string, Entity[]>()
    
    // メッシュタイプごとにエンティティをグループ化
    for (const entity of entities) {
      const meshType = entity.components.mesh.type
      if (!meshGroups.has(meshType)) {
        meshGroups.set(meshType, [])
      }
      meshGroups.get(meshType)!.push(entity)
    }
    
    // インスタンス描画のデータを準備
    const instancedDrawCalls = Array.from(meshGroups.entries()).map(
      ([meshType, entityGroup]) => ({
        meshType,
        instances: entityGroup.length,
        transformMatrices: entityGroup.map(e => e.components.transform.matrix)
      })
    )
    
    return instancedDrawCalls
  })
```

### 3. カリング最適化

```typescript
// フラスタムカリング
const frustumCulling = (entities: Entity[], frustum: Frustum) =>
  Effect.gen(function* () {
    const visibleEntities = []
    
    for (const entity of entities) {
      const bounds = yield* calculateEntityBounds(entity)
      const isVisible = yield* frustum.intersectsBounds(bounds)
      
      if (isVisible) {
        visibleEntities.push(entity)
      }
    }
    
    yield* Effect.logDebug(`Culled ${entities.length - visibleEntities.length} entities`)
    return visibleEntities
  })

// オクリュージョンカリング
const occlusionCulling = (entities: Entity[], camera: Camera) =>
  Effect.gen(function* () {
    const occluders = yield* getOccluders(entities)
    const visibleEntities = []
    
    for (const entity of entities) {
      const isOccluded = yield* checkOcclusion(entity, occluders, camera)
      
      if (!isOccluded) {
        visibleEntities.push(entity)
      }
    }
    
    return visibleEntities
  })
```

## ECSクエリの最適化

### 1. Structure of Arrays (SoA) クエリ

```typescript
// 高性能なSoAクエリの使用
const updatePositionsOptimized = (world: World, deltaTime: number) =>
  Effect.gen(function* () {
    // SoAクエリで連続メモリアクセス
    const query = world.querySoA(['Position', 'Velocity'])
    
    // ベクトル化された処理が可能
    query.forEach(({ position, velocity }, index) => {
      position.x[index] += velocity.x[index] * deltaTime
      position.y[index] += velocity.y[index] * deltaTime
      position.z[index] += velocity.z[index] * deltaTime
    })
    
    yield* Effect.logDebug(`Updated ${query.length} entities`)
  })
```

### 2. アーキタイプ最適化

```typescript
// アーキタイプベースの効率的なクエリ
const optimizedArchetypeQuery = (world: World) =>
  Effect.gen(function* () {
    // ビットマスクでの高速マッチング
    const movableEntities = world.queryArchetype({
      include: ['Position', 'Velocity'],
      exclude: ['Static', 'Frozen'],
      signature: computeArchetypeSignature(['Position', 'Velocity'])
    })
    
    // アーキタイプごとにバッチ処理
    for (const archetype of movableEntities.archetypes) {
      yield* processArchetypeBatch(archetype)
    }
  })
```

### 3. クエリキャッシュ

```typescript
// 頻繁に使用されるクエリをキャッシュ
const QueryCache = Cache.make({
  capacity: 50,
  timeToLive: Duration.seconds(1),
  lookup: (query: QueryDescriptor) => executeQuery(query)
})

const getCachedQuery = (queryDesc: QueryDescriptor) =>
  Effect.gen(function* () {
    const cache = yield* QueryCache
    return yield* cache.get(queryDesc)
  })
```

## 計測とモニタリング

### 1. リアルタイム性能監視

```typescript
// パフォーマンスメトリクスの収集
const performanceMonitor = Effect.gen(function* () {
  const metricsRef = yield* Ref.make({
    frameTime: 0,
    fps: 0,
    memoryUsage: 0,
    drawCalls: 0,
    triangles: 0,
  })
  
  const monitor = {
    startFrame: Effect.gen(function* () {
      const startTime = yield* Effect.sync(() => performance.now())
      yield* Ref.set(frameStartTimeRef, startTime)
    }),
    
    endFrame: Effect.gen(function* () {
      const startTime = yield* Ref.get(frameStartTimeRef)
      const endTime = yield* Effect.sync(() => performance.now())
      const frameTime = endTime - startTime
      const fps = 1000 / frameTime
      
      yield* Ref.update(metricsRef, metrics => ({
        ...metrics,
        frameTime,
        fps,
        memoryUsage: getMemoryUsage()
      }))
    }),
    
    getMetrics: Ref.get(metricsRef)
  }
  
  return monitor
})
```

### 2. パフォーマンスアラート

```typescript
// 性能劣化の検知とアラート
const performanceAlertSystem = Effect.gen(function* () {
  const thresholds = {
    minFPS: 30,
    maxFrameTime: 33.33, // ms
    maxMemoryUsage: 1024, // MB
    maxDrawCalls: 1000,
  }
  
  const checkPerformance = (metrics: PerformanceMetrics) =>
    Effect.gen(function* () {
      const alerts = []
      
      if (metrics.fps < thresholds.minFPS) {
        alerts.push(`Low FPS: ${metrics.fps.toFixed(1)}`)
      }
      
      if (metrics.frameTime > thresholds.maxFrameTime) {
        alerts.push(`High frame time: ${metrics.frameTime.toFixed(2)}ms`)
      }
      
      if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
        alerts.push(`High memory usage: ${metrics.memoryUsage.toFixed(1)}MB`)
      }
      
      if (alerts.length > 0) {
        yield* Effect.logWarn(`Performance alerts: ${alerts.join(', ')}`)
        yield* triggerOptimizations(alerts)
      }
    })
    
  return { checkPerformance }
})
```

### 3. 自動最適化システム

```typescript
// 性能に基づく自動調整
const adaptiveQualitySystem = Effect.gen(function* () {
  const qualitySettings = yield* Ref.make({
    renderDistance: 500,
    shadowQuality: 'high',
    particleCount: 1000,
    textureQuality: 'high',
  })
  
  const adaptQuality = (performanceMetrics: PerformanceMetrics) =>
    Effect.gen(function* () {
      const currentSettings = yield* Ref.get(qualitySettings)
      
      if (performanceMetrics.fps < 30) {
        // 性能が低い場合は品質を下げる
        yield* Ref.update(qualitySettings, settings => ({
          ...settings,
          renderDistance: Math.max(200, settings.renderDistance * 0.8),
          shadowQuality: 'low',
          particleCount: Math.max(100, settings.particleCount * 0.7),
          textureQuality: 'medium',
        }))
        
        yield* Effect.logInfo('Quality settings reduced due to low performance')
      } else if (performanceMetrics.fps > 50) {
        // 性能に余裕がある場合は品質を上げる
        yield* Ref.update(qualitySettings, settings => ({
          ...settings,
          renderDistance: Math.min(1000, settings.renderDistance * 1.1),
          shadowQuality: 'high',
          particleCount: Math.min(2000, settings.particleCount * 1.1),
          textureQuality: 'high',
        }))
      }
      
      return yield* Ref.get(qualitySettings)
    })
    
  return { adaptQuality, getSettings: Ref.get(qualitySettings) }
})
```

## ベンチマークとテスト

### 1. パフォーマンスベースライン

```typescript
// 基準性能の確立
const establishBaseline = Effect.gen(function* () {
  const benchmarks = []
  
  // Vector操作の基準性能
  const vectorBenchmark = yield* measurePerformance('vector-operations', () =>
    Effect.gen(function* () {
      for (let i = 0; i < 10000; i++) {
        const v1 = { x: Math.random(), y: Math.random(), z: Math.random() }
        const v2 = { x: Math.random(), y: Math.random(), z: Math.random() }
        const result = {
          x: v1.x + v2.x,
          y: v1.y + v2.y,
          z: v1.z + v2.z,
        }
      }
    })
  )
  
  // ECSクエリの基準性能
  const queryBenchmark = yield* measurePerformance('ecs-queries', () =>
    Effect.gen(function* () {
      const world = yield* createTestWorld(1000)
      for (let i = 0; i < 100; i++) {
        yield* world.query(['Position', 'Velocity'])
      }
    })
  )
  
  benchmarks.push(vectorBenchmark, queryBenchmark)
  return benchmarks
})

const measurePerformance = (name: string, operation: () => Effect.Effect<any, any, any>) =>
  Effect.gen(function* () {
    const startTime = yield* Effect.sync(() => performance.now())
    yield* operation()
    const endTime = yield* Effect.sync(() => performance.now())
    
    return {
      name,
      duration: endTime - startTime,
      timestamp: Date.now(),
    }
  })
```

### 2. 回帰テスト

```typescript
// パフォーマンス回帰の検出
describe('Performance Regression Tests', () => {
  it('should maintain mesh generation performance', async () => {
    const chunkData = createLargeTestChunk()
    
    const startTime = performance.now()
    await Effect.runPromise(generateMesh(chunkData))
    const duration = performance.now() - startTime
    
    // 100ms以内で完了する必要がある
    expect(duration).toBeLessThan(100)
  })
  
  it('should handle concurrent chunk loading efficiently', async () => {
    const chunks = Array.from({ length: 25 }, (_, i) => 
      createTestChunk(i % 5, Math.floor(i / 5))
    )
    
    const startTime = performance.now()
    await Effect.runPromise(
      Effect.allPar(chunks.map(loadChunk))
    )
    const duration = performance.now() - startTime
    
    // 500ms以内で25チャンクを読み込む
    expect(duration).toBeLessThan(500)
  })
})
```

このガイドを活用することで、ts-minecraftプロジェクトで効果的なパフォーマンス最適化を実現できます。継続的な計測と改善により、優れたゲーム体験を提供することが可能です。