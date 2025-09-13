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
      return yield* Effect.fail(new CalculationError({
        message: "Invalid input data"
      }))
    }

    const startTime = yield* Effect.sync(() => performance.now())
    const result = yield* computeHeavyOperation(input)
    const endTime = yield* Effect.sync(() => performance.now())

    const duration = calculateDuration(startTime, endTime)
    const formattedDuration = formatDuration(duration)

    yield* Effect.logInfo(`Calculation completed in ${formattedDuration}`)
    return result
  })

// Schema-basedキャッシュ設定（最新Effect-TSパターン）
interface OptimizedCacheInterface {
  readonly get: (key: string) => Effect.Effect<ProcessedData | null, CacheError>
  readonly set: (key: string, value: ProcessedData) => Effect.Effect<void, CacheError>
  readonly clear: () => Effect.Effect<void, never>
  readonly size: () => Effect.Effect<number, never>
}

const OptimizedCache = Context.GenericTag<OptimizedCacheInterface>("@app/OptimizedCache")

class CacheError extends Schema.TaggedError("CacheError")<{
  operation: string
  message: string
  key?: string
  timestamp: Date
}> {}

class CalculationError extends Schema.TaggedError("CalculationError")<{
  message: string
}> {}

const makeOptimizedCache = (config: CacheConfig) => Effect.gen(function* () {
  const cache = yield* Cache.make({
    capacity: config.capacity,
    timeToLive: Duration.minutes(config.ttlMinutes),
    lookup: (key: string) => Effect.gen(function* () {
      yield* Effect.log(`Cache miss for key: ${key}`)
      const inputData = yield* reconstructInputFromKey(key)
      return yield* expensiveCalculation(inputData)
    })
  })

  return OptimizedCache.of({
    get: (key: string) => Effect.gen(function* () {
      const result = yield* Cache.get(cache, key).pipe(Effect.either)
      return Either.isLeft(result) ? null : result.right
    }),

    set: (key: string, value: ProcessedData) => Cache.set(cache, key, value),
    clear: () => Cache.clear(cache),
    size: () => Cache.size(cache)
  })
})

const OptimizedCacheLive = Layer.effect(OptimizedCache,
  Effect.gen(function* () {
    const config: CacheConfig = { capacity: 1000, ttlMinutes: 30, enableCompression: true }
    return yield* makeOptimizedCache(config)
  })
)
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

## 高度なECSクエリ最適化

### 1. クエリプリコンパイル

```typescript
// クエリのコンパイル時最適化
const precompiledQueries = Effect.gen(function* () {
  // ビットマスクベースの高速マッチング
  const querySignatures = new Map<string, bigint>()

  // コンポーネントを事前にビットマスクへ変換
  const componentMasks = {
    Position: 1n << 0n,
    Velocity: 1n << 1n,
    Rotation: 1n << 2n,
    Mesh: 1n << 3n,
    Collider: 1n << 4n,
    Health: 1n << 5n,
  }

  // クエリをビットマスクとして事前計算
  const compileQuery = (components: string[]): bigint => {
    return components.reduce((mask, comp) =>
      mask | (componentMasks[comp] || 0n), 0n
    )
  }

  // よく使用されるクエリを事前コンパイル
  querySignatures.set('movable', compileQuery(['Position', 'Velocity']))
  querySignatures.set('renderable', compileQuery(['Position', 'Mesh']))
  querySignatures.set('collidable', compileQuery(['Position', 'Collider']))

  return querySignatures
})

// SIMDを活用した並列クエリ処理
const simdOptimizedQuery = (entities: Entity[], signature: bigint) =>
  Effect.gen(function* () {
    const results = []
    const entityCount = entities.length

    // 4エンティティずつ並列処理（SIMD風）
    for (let i = 0; i < entityCount; i += 4) {
      const batch = entities.slice(i, Math.min(i + 4, entityCount))
      const matches = batch.filter(e =>
        (e.componentMask & signature) === signature
      )
      results.push(...matches)
    }

    return results
  })
```

### 2. スパース配列とインデックス最適化

```typescript
// スパース配列による高速アクセス
const SparseComponentArray = <T>() => {
  const dense: T[] = []
  const sparse: number[] = new Array(MAX_ENTITIES).fill(-1)
  let size = 0

  return {
    insert: (entityId: number, component: T) => {
      if (sparse[entityId] === -1) {
        sparse[entityId] = size
        dense[size] = component
        size++
      } else {
        dense[sparse[entityId]] = component
      }
    },

    get: (entityId: number): T | undefined => {
      const index = sparse[entityId]
      return index !== -1 ? dense[index] : undefined
    },

    remove: (entityId: number) => {
      const index = sparse[entityId]
      if (index !== -1 && index < size - 1) {
        // スワップして削除（O(1)）
        dense[index] = dense[size - 1]
        const movedEntityId = Object.keys(sparse).find(
          key => sparse[Number(key)] === size - 1
        )
        if (movedEntityId) {
          sparse[Number(movedEntityId)] = index
        }
      }
      sparse[entityId] = -1
      size--
    },

    iterate: () => dense.slice(0, size)
  }
}
```

## WASM統合による計算高速化

### 1. 物理演算のWASM化

```typescript
// AssemblyScriptで記述された物理演算モジュール
const PhysicsWASM = Effect.gen(function* () {
  const wasmModule = yield* loadWASMModule('/wasm/physics.wasm')

  // 共有メモリバッファの設定
  const sharedMemory = new SharedArrayBuffer(16 * 1024 * 1024) // 16MB
  const memoryView = new Float32Array(sharedMemory)

  return {
    // 高速な衝突検出
    detectCollisions: (positions: Float32Array, radii: Float32Array) => {
      const ptr = wasmModule.exports.allocate(positions.byteLength)
      const radiusPtr = wasmModule.exports.allocate(radii.byteLength)

      // データをWASMメモリにコピー
      new Float32Array(wasmModule.exports.memory.buffer, ptr)
        .set(positions)
      new Float32Array(wasmModule.exports.memory.buffer, radiusPtr)
        .set(radii)

      // WASM側で衝突検出実行
      const resultPtr = wasmModule.exports.detectCollisions(
        ptr, radiusPtr, positions.length / 3
      )

      // 結果を取得
      const resultCount = wasmModule.exports.getCollisionCount()
      const results = new Float32Array(
        wasmModule.exports.memory.buffer,
        resultPtr,
        resultCount * 2
      )

      wasmModule.exports.free(ptr)
      wasmModule.exports.free(radiusPtr)

      return Array.from(results)
    },

    // ベクトル演算の高速化
    vectorBatchOperation: (vectors: Float32Array, operation: 'normalize' | 'cross' | 'dot') => {
      const ptr = wasmModule.exports.allocate(vectors.byteLength)
      new Float32Array(wasmModule.exports.memory.buffer, ptr).set(vectors)

      switch (operation) {
        case 'normalize':
          wasmModule.exports.batchNormalize(ptr, vectors.length / 3)
          break
        case 'cross':
          wasmModule.exports.batchCross(ptr, vectors.length / 3)
          break
        case 'dot':
          return wasmModule.exports.batchDot(ptr, vectors.length / 3)
      }

      const result = new Float32Array(
        wasmModule.exports.memory.buffer, ptr, vectors.length
      )
      return Float32Array.from(result)
    }
  }
})
```

### 2. メッシュ生成のWASM最適化

```typescript
// Greedy MeshingアルゴリズムのWASM実装
const MeshGeneratorWASM = Effect.gen(function* () {
  const wasmModule = yield* loadWASMModule('/wasm/mesh-generator.wasm')

  return {
    generateChunkMesh: (voxelData: Uint8Array, chunkSize: number) =>
      Effect.gen(function* () {
        const dataPtr = wasmModule.exports.allocate(voxelData.byteLength)
        new Uint8Array(wasmModule.exports.memory.buffer, dataPtr)
          .set(voxelData)

        // WASM側でメッシュ生成
        const meshPtr = wasmModule.exports.generateGreedyMesh(
          dataPtr, chunkSize, chunkSize, chunkSize
        )

        const vertexCount = wasmModule.exports.getVertexCount()
        const indexCount = wasmModule.exports.getIndexCount()

        // 頂点データとインデックスを取得
        const vertices = new Float32Array(
          wasmModule.exports.memory.buffer,
          meshPtr,
          vertexCount * 8 // position(3) + normal(3) + uv(2)
        )

        const indices = new Uint32Array(
          wasmModule.exports.memory.buffer,
          meshPtr + vertices.byteLength,
          indexCount
        )

        wasmModule.exports.free(dataPtr)

        return {
          vertices: Float32Array.from(vertices),
          indices: Uint32Array.from(indices),
          vertexCount,
          indexCount
        }
      })
  }
})
```

## 高度なレンダリング最適化

### 1. Temporal LOD (時間的詳細度制御)

```typescript
// フレームレートに基づく動的LOD調整
const TemporalLODSystem = Effect.gen(function* () {
  const lodHistory = yield* Ref.make<number[]>([])
  const targetFrameTime = 16.67 // 60 FPS

  const calculateTemporalLOD = (
    baseLoD: number,
    frameTime: number,
    entityVelocity: number
  ) => Effect.gen(function* () {
    const history = yield* Ref.get(lodHistory)

    // フレーム時間の移動平均
    const avgFrameTime = history.length > 0
      ? history.reduce((a, b) => a + b, 0) / history.length
      : frameTime

    // パフォーマンスに基づくLOD調整
    let adjustedLoD = baseLoD

    if (avgFrameTime > targetFrameTime * 1.5) {
      // フレームレートが低い場合、LODを下げる
      adjustedLoD = Math.min(baseLoD + 1, 3)
    } else if (avgFrameTime < targetFrameTime * 0.8) {
      // フレームレートに余裕がある場合、LODを上げる
      adjustedLoD = Math.max(baseLoD - 1, 0)
    }

    // 高速移動中のエンティティは低詳細度
    if (entityVelocity > 10) {
      adjustedLoD = Math.min(adjustedLoD + 1, 3)
    }

    // 履歴を更新
    yield* Ref.update(lodHistory, h =>
      [...h.slice(-9), frameTime].slice(0, 10)
    )

    return adjustedLoD
  })

  return { calculateTemporalLOD }
})
```

### 2. Hierarchical Z-Buffer Occlusion

```typescript
// 階層的Zバッファによる高度なオクルージョンカリング
const HierarchicalZBuffer = Effect.gen(function* () {
  const mipLevels = 5
  const zBufferPyramid: Float32Array[] = []

  // Zバッファピラミッドの構築
  const buildZPyramid = (depthTexture: WebGLTexture) =>
    Effect.gen(function* () {
      for (let level = 0; level < mipLevels; level++) {
        const size = Math.pow(2, mipLevels - level)
        zBufferPyramid[level] = new Float32Array(size * size)

        // 各レベルでの最大深度値を計算
        if (level === 0) {
          // ベースレベル：元の深度テクスチャから読み取り
          yield* readDepthTexture(depthTexture, zBufferPyramid[0])
        } else {
          // 上位レベル：4ピクセルの最大値を取る
          const prevLevel = zBufferPyramid[level - 1]
          const prevSize = Math.pow(2, mipLevels - level + 1)

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const idx = y * size + x
              const prevIdx = (y * 2) * prevSize + (x * 2)

              zBufferPyramid[level][idx] = Math.max(
                prevLevel[prevIdx],
                prevLevel[prevIdx + 1],
                prevLevel[prevIdx + prevSize],
                prevLevel[prevIdx + prevSize + 1]
              )
            }
          }
        }
      }
    })

  // バウンディングボックスのオクルージョンテスト
  const testOcclusion = (boundingBox: BoundingBox, viewProjectionMatrix: Matrix4) =>
    Effect.gen(function* () {
      // バウンディングボックスをスクリーン空間に変換
      const screenBounds = yield* transformToScreenSpace(
        boundingBox, viewProjectionMatrix
      )

      // 適切なミップレベルを選択
      const boxSize = Math.max(
        screenBounds.maxX - screenBounds.minX,
        screenBounds.maxY - screenBounds.minY
      )
      const mipLevel = Math.floor(Math.log2(boxSize))

      // 選択したレベルでオクルージョンテスト
      const pyramidLevel = Math.min(mipLevel, mipLevels - 1)
      const levelSize = Math.pow(2, mipLevels - pyramidLevel)

      const minX = Math.floor(screenBounds.minX * levelSize)
      const maxX = Math.ceil(screenBounds.maxX * levelSize)
      const minY = Math.floor(screenBounds.minY * levelSize)
      const maxY = Math.ceil(screenBounds.maxY * levelSize)

      // バウンディングボックス内の最小深度値
      const boxMinDepth = screenBounds.minZ

      // Zバッファの最大深度値と比較
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = y * levelSize + x
          if (zBufferPyramid[pyramidLevel][idx] >= boxMinDepth) {
            return false // 見える可能性がある
          }
        }
      }

      return true // 完全に隠れている
    })

  return { buildZPyramid, testOcclusion }
})
```

### 3. Variable Rate Shading (VRS)

```typescript
// 可変レートシェーディングによるGPU負荷削減
const VariableRateShading = Effect.gen(function* () {
  const shadingRates = {
    '1x1': 0, // フル解像度
    '1x2': 1, // 水平方向半分
    '2x1': 2, // 垂直方向半分
    '2x2': 3, // 1/4解像度
    '2x4': 4, // 1/8解像度
    '4x2': 5, // 1/8解像度
    '4x4': 6  // 1/16解像度
  }

  // エンティティごとのシェーディングレート決定
  const calculateShadingRate = (
    entity: Entity,
    cameraPosition: Position,
    frameTime: number
  ) => Effect.gen(function* () {
    const distance = yield* calculateDistance(entity.position, cameraPosition)
    const velocity = entity.components.velocity?.magnitude || 0

    // 距離に基づく基本レート
    let rate = '1x1'
    if (distance > 500) rate = '4x4'
    else if (distance > 200) rate = '2x2'
    else if (distance > 100) rate = '1x2'

    // 速度が高い場合はレートを下げる
    if (velocity > 20) {
      rate = rate === '1x1' ? '2x2' : '4x4'
    }

    // フレームレートが低い場合は全体的にレートを下げる
    if (frameTime > 20) {
      rate = '2x2'
    }

    return shadingRates[rate]
  })

  // VRSマップの生成
  const generateVRSMap = (entities: Entity[], camera: Camera) =>
    Effect.gen(function* () {
      const vrsMap = new Uint8Array(256 * 256) // 16x16タイルごと

      for (const entity of entities) {
        const screenPos = yield* worldToScreen(entity.position, camera)
        const tileX = Math.floor(screenPos.x / 16)
        const tileY = Math.floor(screenPos.y / 16)

        if (tileX >= 0 && tileX < 256 && tileY >= 0 && tileY < 256) {
          const rate = yield* calculateShadingRate(
            entity, camera.position, 16.67
          )
          vrsMap[tileY * 256 + tileX] = rate
        }
      }

      return vrsMap
    })

  return { calculateShadingRate, generateVRSMap }
})
```

## メモリアクセスパターンの最適化

### 1. データ局所性の最大化

```typescript
// キャッシュフレンドリーなデータレイアウト
const CacheOptimizedStorage = <T extends Record<string, any>>() => {
  // Structure of Arrays (SoA) for better cache utilization
  const createSoAStorage = (capacity: number, fields: (keyof T)[]) => {
    const storage: Record<keyof T, ArrayBuffer> = {} as any
    const typeMap: Record<keyof T, 'f32' | 'i32' | 'u8'> = {} as any

    fields.forEach(field => {
      // 型に応じて適切な配列を割り当て
      if (field.toString().includes('position') ||
          field.toString().includes('velocity')) {
        storage[field] = new ArrayBuffer(capacity * 3 * 4) // Vec3
        typeMap[field] = 'f32'
      } else if (field.toString().includes('id')) {
        storage[field] = new ArrayBuffer(capacity * 4) // int32
        typeMap[field] = 'i32'
      } else {
        storage[field] = new ArrayBuffer(capacity) // byte
        typeMap[field] = 'u8'
      }
    })

    return {
      storage,
      typeMap,

      // プリフェッチヒント付きアクセス
      prefetchRead: (index: number, field: keyof T) => {
        // x86_64の場合、プリフェッチ命令をトリガー
        const offset = index * (typeMap[field] === 'f32' ? 12 :
                               typeMap[field] === 'i32' ? 4 : 1)
        // @ts-ignore - 実際の実装では専用のプリフェッチAPIを使用
        if (typeof __builtin_prefetch !== 'undefined') {
          __builtin_prefetch(storage[field], offset, 0)
        }
      },

      // ベクトル化可能な一括更新
      batchUpdate: (indices: number[], field: keyof T, values: number[]) => {
        const view = typeMap[field] === 'f32' ?
          new Float32Array(storage[field]) :
          typeMap[field] === 'i32' ?
          new Int32Array(storage[field]) :
          new Uint8Array(storage[field])

        // SIMD最適化が可能な連続メモリアクセス
        for (let i = 0; i < indices.length; i++) {
          view[indices[i]] = values[i]
        }
      }
    }
  }

  return createSoAStorage
}
```

### 2. メモリプールとアロケータ最適化

```typescript
// カスタムメモリアロケータ
const OptimizedMemoryAllocator = Effect.gen(function* () {
  // サイズクラス別のメモリプール
  const sizePools = new Map<number, {
    free: ArrayBuffer[],
    used: Set<ArrayBuffer>
  }>()

  // 2の累乗サイズにアラインメント
  const alignSize = (size: number): number => {
    return Math.pow(2, Math.ceil(Math.log2(size)))
  }

  const allocate = (size: number) => Effect.gen(function* () {
    const alignedSize = alignSize(size)

    if (!sizePools.has(alignedSize)) {
      sizePools.set(alignedSize, {
        free: [],
        used: new Set()
      })
    }

    const pool = sizePools.get(alignedSize)!

    // プールから取得または新規作成
    let buffer: ArrayBuffer
    if (pool.free.length > 0) {
      buffer = pool.free.pop()!
      yield* Effect.logDebug(`Reused buffer of size ${alignedSize}`)
    } else {
      buffer = new ArrayBuffer(alignedSize)
      yield* Effect.logDebug(`Allocated new buffer of size ${alignedSize}`)
    }

    pool.used.add(buffer)
    return buffer
  })

  const free = (buffer: ArrayBuffer) => Effect.gen(function* () {
    const size = buffer.byteLength
    const pool = sizePools.get(size)

    if (pool && pool.used.has(buffer)) {
      pool.used.delete(buffer)
      pool.free.push(buffer)

      // メモリをゼロクリア（セキュリティとデバッグ用）
      new Uint8Array(buffer).fill(0)

      yield* Effect.logDebug(`Freed buffer of size ${size}`)
    }
  })

  // メモリデフラグメンテーション
  const defragment = () => Effect.gen(function* () {
    for (const [size, pool] of sizePools.entries()) {
      // 未使用バッファが多すぎる場合は解放
      if (pool.free.length > pool.used.size * 2 && pool.free.length > 10) {
        const toRemove = pool.free.length - pool.used.size
        pool.free.splice(0, toRemove)
        yield* Effect.logInfo(`Defragmented ${toRemove} buffers of size ${size}`)
      }
    }
  })

  return { allocate, free, defragment }
})
```

## Effect-TSレベルの最適化

### 1. Fiberの効率的な管理

```typescript
// Fiber poolingとスケジューリング最適化
const OptimizedFiberScheduler = Effect.gen(function* () {
  const fiberPool = yield* Ref.make<Fiber.Fiber<any, any>[]>([])
  const maxConcurrency = navigator.hardwareConcurrency || 4

  // 優先度付きファイバー実行
  const scheduleFiber = <R, E, A>(
    effect: Effect.Effect<A, E, R>,
    priority: 'high' | 'normal' | 'low'
  ) => Effect.gen(function* () {
    const pool = yield* Ref.get(fiberPool)

    // 実行中のファイバー数を制限
    if (pool.length >= maxConcurrency) {
      // 優先度に基づいて既存のファイバーを中断
      if (priority === 'high') {
        const lowPriorityFiber = pool.find(f => f.priority === 'low')
        if (lowPriorityFiber) {
          yield* Fiber.interrupt(lowPriorityFiber)
        }
      } else {
        // 低優先度の場合は待機
        yield* Effect.sleep(Duration.millis(10))
      }
    }

    // ファイバーを起動
    const fiber = yield* Effect.fork(effect)
    yield* Ref.update(fiberPool, pool => [...pool, fiber])

    // 完了時にプールから削除
    yield* Fiber.onDone(fiber, () =>
      Ref.update(fiberPool, pool =>
        pool.filter(f => f !== fiber)
      )
    )

    return fiber
  })

  return { scheduleFiber }
})

// バッチ処理の最適化（最新Effect-TS 2024パターン）
interface BatchProcessorInterface {
  readonly processBatch: <A, E, R>(
    items: readonly A[],
    processor: (item: A) => Effect.Effect<R, E>
  ) => Effect.Effect<readonly R[], E>
  readonly processWithConcurrency: <A, E, R>(
    items: readonly A[],
    processor: (item: A) => Effect.Effect<R, E>,
    concurrency: number
  ) => Effect.Effect<readonly R[], E>
}

const BatchProcessor = Context.GenericTag<BatchProcessorInterface>("@app/BatchProcessor")

const BatchConfig = Schema.Struct({
  defaultBatchSize: Schema.Number.pipe(Schema.positive(), Schema.default(100)),
  maxConcurrency: Schema.Number.pipe(Schema.positive(), Schema.default(10)),
  delayBetweenBatches: Schema.Number.pipe(Schema.nonnegative(), Schema.default(0)),
  enableProgressLogging: Schema.Boolean.pipe(Schema.default(false))
})

type BatchConfig = Schema.Schema.Type<typeof BatchConfig>

const makeBatchProcessor = (config: BatchConfig) => Effect.gen(function* () {
  return BatchProcessor.of({
    processBatch: <A, E, R>(
      items: readonly A[],
      processor: (item: A) => Effect.Effect<R, E>
    ) => Effect.gen(function* () {
      const results: R[] = []
      const totalItems = items.length
      let processedCount = 0

      for (let i = 0; i < totalItems; i += config.defaultBatchSize) {
        const batch = items.slice(i, i + config.defaultBatchSize)
        const batchNumber = Math.floor(i / config.defaultBatchSize) + 1
        const totalBatches = Math.ceil(totalItems / config.defaultBatchSize)

        if (config.enableProgressLogging) {
          yield* Effect.log(
            `Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`
          )
        }

        // バッチ内での並列処理（制限付き）
        const batchResults = yield* Effect.all(
          batch.map(processor),
          { concurrency: Math.min(config.maxConcurrency, batch.length) }
        )

        results.push(...batchResults)
        processedCount += batch.length

        // バッチ間でのCPU解放
        if (i + config.defaultBatchSize < totalItems && config.delayBetweenBatches > 0) {
          yield* Effect.sleep(`${config.delayBetweenBatches} millis`)
        }

        if (config.enableProgressLogging) {
          const progress = Math.round((processedCount / totalItems) * 100)
          yield* Effect.log(`Progress: ${progress}% (${processedCount}/${totalItems})`)
        }
      }

      return results
    }),

    processWithConcurrency: <A, E, R>(
      items: readonly A[],
      processor: (item: A) => Effect.Effect<R, E>,
      concurrency: number
    ) => Effect.gen(function* () {
      return yield* Effect.all(
        items.map(processor),
        { concurrency: Math.max(1, Math.min(concurrency, items.length)) }
      )
    })
  })
})

const BatchProcessorLive = Layer.effect(BatchProcessor,
  Effect.gen(function* () {
    const config: BatchConfig = {
      defaultBatchSize: 100,
      maxConcurrency: Math.min(10, navigator.hardwareConcurrency || 4),
      delayBetweenBatches: 1,
      enableProgressLogging: true
    }
    return yield* makeBatchProcessor(config)
  })
)

// 使用例：エンティティのバッチ更新
const updateEntitiesBatch = (entities: readonly Entity[]) => Effect.gen(function* () {
  const batchProcessor = yield* BatchProcessor

  const results = yield* batchProcessor.processBatch(
    entities,
    (entity) => updateEntityWithValidation(entity)
  )

  return results
})
```

### 2. Stream処理の最適化

```typescript
// ストリーム処理の最適化
const optimizedStreamProcessing = <A>(
  stream: Stream.Stream<A, never, never>
) => {
  return stream.pipe(
    // バッファリングで処理効率向上
    Stream.buffer({ capacity: 1000 }),

    // チャンク処理で効率化
    Stream.chunked(100),

    // 並列処理
    Stream.mapConcurrent(10, chunk =>
      Effect.gen(function* () {
        // チャンク単位で処理
        return yield* processChunk(chunk)
      })
    ),

    // バックプレッシャー制御
    Stream.throttle({
      elements: 1000,
      duration: Duration.seconds(1),
      strategy: 'enforce'
    })
  )
}
```

## 起動時間の短縮

### 1. 遅延読み込みとコード分割

```typescript
// モジュールの遅延読み込み
const LazyModuleLoader = Effect.gen(function* () {
  const moduleCache = new Map<string, any>()

  const loadModule = (moduleName: string) =>
    Effect.gen(function* () {
      // キャッシュチェック
      if (moduleCache.has(moduleName)) {
        return moduleCache.get(moduleName)
      }

      // 動的インポート
      const module = yield* Effect.tryPromise({
        try: () => import(`../modules/${moduleName}`),
        catch: (e) => new Error(`Failed to load module: ${moduleName}`)
      })

      moduleCache.set(moduleName, module)
      return module
    })

  // 優先度付きプリロード
  const preloadModules = (modules: Array<{name: string, priority: number}>) =>
    Effect.gen(function* () {
      // 優先度でソート
      const sorted = modules.sort((a, b) => b.priority - a.priority)

      // 高優先度モジュールは即座にロード
      const highPriority = sorted.filter(m => m.priority >= 8)
      yield* Effect.allPar(highPriority.map(m => loadModule(m.name)))

      // 中優先度モジュールは段階的にロード
      const mediumPriority = sorted.filter(m => m.priority >= 5 && m.priority < 8)
      yield* Effect.forEach(mediumPriority, m => loadModule(m.name), {
        concurrency: 2
      })

      // 低優先度モジュールはアイドル時にロード
      const lowPriority = sorted.filter(m => m.priority < 5)
      yield* Effect.fork(
        Effect.forEach(lowPriority, m =>
          Effect.gen(function* () {
            yield* Effect.sleep(Duration.seconds(1))
            return yield* loadModule(m.name)
          }), { concurrency: 1 }
        )
      )
    })

  return { loadModule, preloadModules }
})
```

### 2. リソースの段階的初期化

```typescript
// 段階的初期化による起動時間短縮
const ProgressiveInitialization = Effect.gen(function* () {
  const initPhases = {
    critical: [] as Effect.Effect<any, any, any>[],
    important: [] as Effect.Effect<any, any, any>[],
    optional: [] as Effect.Effect<any, any, any>[]
  }

  const initialize = () => Effect.gen(function* () {
    const startTime = yield* Effect.sync(() => performance.now())

    // フェーズ1: 必須コンポーネントのみ
    yield* Effect.logInfo("Phase 1: Critical initialization")
    yield* Effect.all([
      initializeCore(),
      initializeRenderer(),
      initializeInputSystem()
    ])

    const phase1Time = yield* Effect.sync(() => performance.now() - startTime)
    yield* Effect.logInfo(`Phase 1 completed in ${phase1Time}ms`)

    // ゲームをプレイ可能にする
    yield* enableGameplay()

    // フェーズ2: 重要だが非ブロッキング
    yield* Effect.fork(
      Effect.gen(function* () {
        yield* Effect.logInfo("Phase 2: Important initialization")
        yield* Effect.all([
          initializeAudioSystem(),
          initializePhysicsWorker(),
          loadHighPriorityAssets()
        ])
      })
    )

    // フェーズ3: オプショナル機能
    yield* Effect.fork(
      Effect.gen(function* () {
        yield* Effect.sleep(Duration.seconds(2))
        yield* Effect.logInfo("Phase 3: Optional initialization")
        yield* Effect.all([
          initializeParticleSystem(),
          loadLowPriorityAssets(),
          initializeAchievementSystem()
        ])
      })
    )

    const totalTime = yield* Effect.sync(() => performance.now() - startTime)
    yield* Effect.logInfo(`Game playable in ${totalTime}ms`)
  })

  return { initialize }
})
```

### 3. アセットストリーミング

```typescript
// アセットの段階的ストリーミング
const AssetStreaming = Effect.gen(function* () {
  const assetQueue = yield* Queue.unbounded<AssetRequest>()
  const loadedAssets = yield* Ref.make(new Map<string, any>())

  // アセットローダーワーカー
  const assetLoader = Effect.gen(function* () {
    while (true) {
      const request = yield* Queue.take(assetQueue)

      try {
        const asset = yield* loadAsset(request)
        yield* Ref.update(loadedAssets, map =>
          new Map(map).set(request.id, asset)
        )

        // 低優先度アセットの場合は遅延
        if (request.priority === 'low') {
          yield* Effect.sleep(Duration.millis(100))
        }
      } catch (error) {
        yield* Effect.logError(`Failed to load asset: ${request.id}`)
      }
    }
  })

  // 距離ベースのアセット要求
  const requestAssetsByDistance = (playerPosition: Position) =>
    Effect.gen(function* () {
      const nearbyChunks = yield* getChunksInRadius(playerPosition, 5)

      // 近い順にソートして要求
      nearbyChunks
        .sort((a, b) =>
          distance(a.position, playerPosition) -
          distance(b.position, playerPosition)
        )
        .forEach((chunk, index) => {
          Queue.offer(assetQueue, {
            id: chunk.id,
            type: 'chunk-texture',
            priority: index < 3 ? 'high' : index < 10 ? 'medium' : 'low',
            data: chunk
          })
        })
    })

  return {
    startLoader: Effect.fork(assetLoader),
    requestAssetsByDistance,
    getAsset: (id: string) => Ref.get(loadedAssets).pipe(
      Effect.map(map => map.get(id))
    )
  }
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

## 実装詳細：主要な最適化パターン

### 2. Effect最適化パターンの詳細実装

Effect-TSのオーバーヘッドを最小化しながら、型安全性と関数型の利点を維持する実装パターンです。

```typescript
import { Effect, Chunk, Ref, FiberRef, Match, Schema } from "effect"

// ========================================
// バッチ処理による Effect オーバーヘッド削減
// ========================================

// Component更新用のバッチャー
export const ComponentBatcher = Effect.gen(function* () {
  const batchSize = 1000
  const updateQueue = yield* Ref.make<Array<{ entityId: string; component: any }>>(
    []
  )

  // 個別更新をキューに追加
  const queueUpdate = (entityId: string, component: any) =>
    Ref.update(updateQueue, (queue) => [...queue, { entityId, component }])

  // バッチ処理実行
  const flushBatch = Effect.gen(function* () {
    const updates = yield* Ref.getAndSet(updateQueue, [])

    if (updates.length === 0) return

    // 早期リターン: 大量更新の場合は分割
    if (updates.length > batchSize * 2) {
      const chunks = Chunk.fromIterable(updates).pipe(
        Chunk.chunksOf(batchSize)
      )

      // 並列バッチ処理
      yield* Effect.forEach(
        chunks,
        (batch) => processBatchUnsafe(batch.toArray()),
        { concurrency: 4 }
      )
    } else {
      // 単一バッチで処理
      yield* Effect.sync(() => processBatchUnsafe(updates))
    }
  })

  // 最適化された非同期バッチ処理
  const processBatchUnsafe = (updates: Array<{ entityId: string; component: any }>) => {
    // Effectのラッピングなしで直接更新
    updates.forEach(({ entityId, component }) => {
      // 実際のコンポーネントストレージへの書き込み
      // ここではメモリへの直接アクセスを行う
      const storage = getComponentStorage()
      storage.set(entityId, component)
    })
  }

  return { queueUpdate, flushBatch }
})

// ========================================
// Fiber最適化とスケジューリング
// ========================================

export const OptimizedScheduler = Effect.gen(function* () {
  // CPUコア数に基づく並行度制御
  const maxConcurrency = Math.min(navigator.hardwareConcurrency || 4, 8)
  const runningFibers = yield* Ref.make<Set<Fiber.Fiber<any, any>>>(new Set())

  // 優先度付きタスクスケジューリング
  const scheduleWithPriority = <A, E, R>(
    task: Effect.Effect<A, E, R>,
    priority: "high" | "normal" | "low"
  ) =>
    Effect.gen(function* () {
      const fibers = yield* Ref.get(runningFibers)

      // 高優先度タスクの場合、低優先度を中断
      if (priority === "high" && fibers.size >= maxConcurrency) {
        const lowPriorityFiber = Array.from(fibers).find((f) =>
          f.priority === "low"
        )
        if (lowPriorityFiber) {
          yield* Fiber.interrupt(lowPriorityFiber)
          yield* Ref.update(runningFibers, (set) => {
            set.delete(lowPriorityFiber)
            return new Set(set)
          })
        }
      }

      // タスクを適切なスケジューラで実行
      const fiber = yield* Match.value(priority).pipe(
        Match.when("high", () => Effect.forkWithErrorHandler(task)),
        Match.when("normal", () => Effect.fork(task)),
        Match.when("low", () =>
          Effect.fork(task.pipe(Effect.delay(Duration.millis(10))))
        ),
        Match.exhaustive
      )

      // ファイバーを追跡
      yield* Ref.update(runningFibers, (set) => new Set([...set, fiber]))

      // 完了時にクリーンアップ
      yield* Fiber.onDone(fiber, () =>
        Ref.update(runningFibers, (set) => {
          set.delete(fiber)
          return new Set(set)
        })
      )

      return fiber
    })

  return { scheduleWithPriority }
})

// ========================================
// メモ化とキャッシング最適化
// ========================================

export const createOptimizedCache = <K, V>(
  capacity: number,
  computeFn: (key: K) => Effect.Effect<V, never>
) => {
  const cache = new Map<K, { value: V; timestamp: number }>()
  const accessOrder: K[] = []

  return {
    get: (key: K) =>
      Effect.gen(function* () {
        const cached = cache.get(key)
        const now = Date.now()

        // キャッシュヒット
        if (cached && now - cached.timestamp < 60000) {
          // LRU更新
          const index = accessOrder.indexOf(key)
          if (index > -1) {
            accessOrder.splice(index, 1)
          }
          accessOrder.push(key)
          return cached.value
        }

        // キャッシュミス - 計算実行
        const value = yield* computeFn(key)

        // キャパシティチェック
        if (cache.size >= capacity) {
          const lru = accessOrder.shift()
          if (lru) cache.delete(lru)
        }

        cache.set(key, { value, timestamp: now })
        accessOrder.push(key)

        return value
      }),

    // 手動でのキャッシュクリア
    invalidate: (key: K) =>
      Effect.sync(() => {
        cache.delete(key)
        const index = accessOrder.indexOf(key)
        if (index > -1) {
          accessOrder.splice(index, 1)
        }
      })
  }
}

### 4. Worker戦略の改善実装

SharedArrayBufferとWorker Poolを活用した、Zero-Copy通信と並列処理の実装です。

```typescript
import { Effect, Queue, Ref, Fiber, Schema } from "effect"

// ========================================
// SharedArrayBuffer による Zero-Copy 通信
// ========================================

// 共有メモリ構造の定義
const SharedMemoryLayout = {
  // ヘッダー領域（メタデータ）
  HEADER_SIZE: 256,
  // チャンクデータ領域
  CHUNK_SIZE: 16 * 16 * 256, // 16x16x256 ボクセル
  // 結果バッファ領域
  RESULT_SIZE: 65536,
} as const

export const SharedMemoryPool = Effect.gen(function* () {
  // 共有メモリプール
  const bufferPool: SharedArrayBuffer[] = []
  const availableBuffers = yield* Queue.unbounded<SharedArrayBuffer>()

  // 初期化：プールに共有バッファを準備
  const initialize = (poolSize: number = 10) =>
    Effect.gen(function* () {
      const totalSize =
        SharedMemoryLayout.HEADER_SIZE +
        SharedMemoryLayout.CHUNK_SIZE * 4 + // 4チャンク分
        SharedMemoryLayout.RESULT_SIZE

      for (let i = 0; i < poolSize; i++) {
        const buffer = new SharedArrayBuffer(totalSize)
        bufferPool.push(buffer)
        yield* Queue.offer(availableBuffers, buffer)
      }

      yield* Effect.log(`Initialized ${poolSize} shared buffers`)
    })

  // バッファ取得（Zero-Copy）
  const acquireBuffer = () => Queue.take(availableBuffers)

  // バッファ返却
  const releaseBuffer = (buffer: SharedArrayBuffer) =>
    Queue.offer(availableBuffers, buffer)

  // チャンクデータの書き込み（コピーなし）
  const writeChunkData = (
    buffer: SharedArrayBuffer,
    chunkData: Uint8Array,
    offset: number = 0
  ) =>
    Effect.sync(() => {
      const view = new Uint8Array(buffer)
      const dataOffset = SharedMemoryLayout.HEADER_SIZE +
        offset * SharedMemoryLayout.CHUNK_SIZE

      // メタデータ書き込み
      const header = new DataView(buffer)
      header.setUint32(0, chunkData.length, true)
      header.setUint32(4, offset, true)
      header.setFloat64(8, performance.now(), true)

      // チャンクデータ書き込み
      view.set(chunkData, dataOffset)
    })

  return { initialize, acquireBuffer, releaseBuffer, writeChunkData }
})

// ========================================
// 高度な Worker Pool 実装
// ========================================

interface WorkerTask {
  id: string
  type: "mesh-generation" | "physics" | "pathfinding"
  priority: number
  sharedBuffer?: SharedArrayBuffer
  params: Record<string, any>
}

export const AdvancedWorkerPool = Effect.gen(function* () {
  const workers: Worker[] = []
  const taskQueue = yield* Queue.unbounded<WorkerTask>()
  const busyWorkers = yield* Ref.make<Map<Worker, WorkerTask>>(new Map())
  const results = yield* Ref.make<Map<string, any>>(new Map())

  // Worker初期化
  const initializeWorkers = (count: number = navigator.hardwareConcurrency) =>
    Effect.gen(function* () {
      for (let i = 0; i < count; i++) {
        const worker = new Worker("/workers/compute.worker.js", {
          type: "module"
        })

        // Workerメッセージハンドラ
        worker.onmessage = (event) => {
          const { taskId, result, error } = event.data

          Effect.runSync(Effect.gen(function* () {
            // 結果を保存
            if (result) {
              yield* Ref.update(results, (map) =>
                new Map(map).set(taskId, result)
              )
            }

            // Workerを解放
            yield* Ref.update(busyWorkers, (map) => {
              const newMap = new Map(map)
              newMap.delete(worker)
              return newMap
            })

            // 次のタスクを処理
            yield* processNextTask(worker)
          }))
        }

        workers.push(worker)
      }

      yield* Effect.log(`Initialized ${count} workers`)
    })

  // タスクディスパッチャー
  const processNextTask = (worker: Worker) =>
    Effect.gen(function* () {
      const task = yield* Queue.poll(taskQueue).pipe(
        Effect.flatten,
        Effect.orElse(() => Effect.succeed(null))
      )

      if (!task) return

      // Workerにタスクを送信
      yield* Ref.update(busyWorkers, (map) =>
        new Map(map).set(worker, task)
      )

      // SharedArrayBufferを使用する場合
      if (task.sharedBuffer) {
        worker.postMessage({
          id: task.id,
          type: task.type,
          params: task.params,
          sharedBuffer: task.sharedBuffer
        })
      } else {
        // 通常のメッセージング
        worker.postMessage({
          id: task.id,
          type: task.type,
          params: task.params
        })
      }
    })

  // タスク送信（優先度付き）
  const submitTask = (task: WorkerTask) =>
    Effect.gen(function* () {
      yield* Queue.offer(taskQueue, task)

      // アイドルワーカーを探して即座に処理
      const busy = yield* Ref.get(busyWorkers)
      const idleWorker = workers.find((w) => !busy.has(w))

      if (idleWorker) {
        yield* processNextTask(idleWorker)
      }

      return task.id
    })

  // タスク結果取得（ポーリング）
  const getResult = (taskId: string, timeout: number = 5000) =>
    Effect.gen(function* () {
      const startTime = Date.now()

      while (Date.now() - startTime < timeout) {
        const allResults = yield* Ref.get(results)
        const result = allResults.get(taskId)

        if (result) {
          // 結果をクリーンアップ
          yield* Ref.update(results, (map) => {
            const newMap = new Map(map)
            newMap.delete(taskId)
            return newMap
          })
          return result
        }

        // 短いポーリング間隔
        yield* Effect.sleep(Duration.millis(10))
      }

      return yield* Effect.fail(new Error(`Task ${taskId} timed out`))
    })

  return {
    initializeWorkers,
    submitTask,
    getResult
  }
})

// ========================================
// Worker内での処理最適化例
// ========================================

// worker.compute.js の内容
const workerCode = `
// SharedArrayBuffer を使った高速処理
self.onmessage = async (event) => {
  const { id, type, params, sharedBuffer } = event.data

  try {
    let result

    switch (type) {
      case 'mesh-generation':
        result = await generateMeshOptimized(sharedBuffer, params)
        break
      case 'physics':
        result = await simulatePhysics(sharedBuffer, params)
        break
      case 'pathfinding':
        result = await findPath(sharedBuffer, params)
        break
    }

    self.postMessage({ taskId: id, result })
  } catch (error) {
    self.postMessage({ taskId: id, error: error.message })
  }
}

// Greedy Meshing with SharedArrayBuffer
async function generateMeshOptimized(buffer, params) {
  const { chunkSize, offset } = params
  const data = new Uint8Array(buffer, offset, chunkSize)

  // メッシュ生成アルゴリズム（簡略化）
  const vertices = []
  const indices = []

  // ボクセルデータを処理
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 256; y++) {
      for (let z = 0; z < 16; z++) {
        const idx = x + y * 16 + z * 16 * 256
        if (data[idx] > 0) {
          // 頂点とインデックスを生成
          // ... 実際のメッシュ生成ロジック
        }
      }
    }
  }

  // 結果を同じSharedArrayBufferに書き込み
  const resultOffset = params.resultOffset
  const resultView = new Float32Array(buffer, resultOffset)
  resultView.set(new Float32Array(vertices))

  return {
    vertexCount: vertices.length / 3,
    indexCount: indices.length
  }
}
`

### 5. レンダリング最適化の実装

Three.jsと統合した高度なレンダリング最適化技術の実装です。

```typescript
import { Effect, Ref, Match } from "effect"
import * as THREE from "three"

// ========================================
// インスタンス描画によるドローコール削減
// ========================================

export const InstancedRenderer = Effect.gen(function* () {
  const instancedMeshes = new Map<string, THREE.InstancedMesh>()
  const scene = yield* getThreeScene() // Three.jsシーンの取得

  // メッシュタイプごとのインスタンス作成
  const createInstancedMesh = (
    meshType: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    maxInstances: number = 10000
  ) =>
    Effect.sync(() => {
      const mesh = new THREE.InstancedMesh(geometry, material, maxInstances)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

      // フラスタムカリングを有効化
      mesh.frustumCulled = true

      instancedMeshes.set(meshType, mesh)
      scene.add(mesh)

      return mesh
    })

  // バッチ更新
  const updateInstances = (
    meshType: string,
    transforms: Array<{ position: THREE.Vector3; rotation: THREE.Quaternion; scale: THREE.Vector3 }>
  ) =>
    Effect.gen(function* () {
      const mesh = instancedMeshes.get(meshType)
      if (!mesh) return

      const matrix = new THREE.Matrix4()

      // 早期リターン: インスタンス数が多すぎる場合
      if (transforms.length > mesh.count) {
        yield* Effect.log(`Warning: Too many instances for ${meshType}`)
        transforms = transforms.slice(0, mesh.count)
      }

      // 行列を一括更新
      transforms.forEach((transform, i) => {
        matrix.compose(transform.position, transform.rotation, transform.scale)
        mesh.setMatrixAt(i, matrix)
      })

      // 実際のインスタンス数を設定
      mesh.count = transforms.length
      mesh.instanceMatrix.needsUpdate = true

      // バウンディングボックスの更新
      if (mesh.boundingSphere) {
        mesh.computeBoundingSphere()
      }
    })

  return { createInstancedMesh, updateInstances }
})

// ========================================
// LOD (Level of Detail) システム
// ========================================

interface LODConfig {
  distances: [number, number, number]
  meshes: [THREE.Mesh, THREE.Mesh, THREE.Mesh]
}

export const LODSystem = Effect.gen(function* () {
  const lodGroups = new Map<string, THREE.LOD>()
  const camera = yield* getCamera()

  // LODグループの作成
  const createLODGroup = (id: string, config: LODConfig) =>
    Effect.sync(() => {
      const lod = new THREE.LOD()

      config.meshes.forEach((mesh, index) => {
        lod.addLevel(mesh, config.distances[index])
      })

      lodGroups.set(id, lod)
      return lod
    })

  // 動的LOD調整（パフォーマンスベース）
  const adaptiveLODUpdate = (frameTime: number) =>
    Effect.gen(function* () {
      const targetFrameTime = 16.67 // 60 FPS
      const performanceRatio = targetFrameTime / frameTime

      // パフォーマンスに基づいてLOD距離を調整
      lodGroups.forEach((lod) => {
        if (performanceRatio < 0.8) {
          // パフォーマンスが悪い場合、LOD距離を短くする
          lod.levels.forEach((level, i) => {
            level.distance *= 0.9
          })
        } else if (performanceRatio > 1.2) {
          // パフォーマンスが良い場合、LOD距離を長くする
          lod.levels.forEach((level, i) => {
            level.distance *= 1.1
          })
        }
      })

      // 全LODグループを更新
      lodGroups.forEach((lod) => {
        lod.update(camera)
      })
    })

  return { createLODGroup, adaptiveLODUpdate }
})

// ========================================
// 高度なカリング最適化
// ========================================

export const AdvancedCulling = Effect.gen(function* () {
  const frustum = new THREE.Frustum()
  const projectionMatrix = new THREE.Matrix4()
  const occlusionQueries = new Map<string, WebGLQuery>()

  // フラスタムカリング（空間分割付き）
  const frustumCullWithSpatialHash = (
    objects: THREE.Object3D[],
    camera: THREE.Camera,
    cellSize: number = 50
  ) =>
    Effect.gen(function* () {
      // フラスタムを更新
      projectionMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
      frustum.setFromProjectionMatrix(projectionMatrix)

      // 空間ハッシュでグループ化
      const spatialHash = new Map<string, THREE.Object3D[]>()

      objects.forEach((obj) => {
        const x = Math.floor(obj.position.x / cellSize)
        const z = Math.floor(obj.position.z / cellSize)
        const key = `${x},${z}`

        if (!spatialHash.has(key)) {
          spatialHash.set(key, [])
        }
        spatialHash.get(key)!.push(obj)
      })

      // セルごとにカリング
      const visibleObjects: THREE.Object3D[] = []

      spatialHash.forEach((cellObjects, key) => {
        // セルの境界ボックスを計算
        const [x, z] = key.split(',').map(Number)
        const cellBounds = new THREE.Box3(
          new THREE.Vector3(x * cellSize, -1000, z * cellSize),
          new THREE.Vector3((x + 1) * cellSize, 1000, (z + 1) * cellSize)
        )

        // セル全体がフラスタム内にあるかチェック
        if (frustum.intersectsBox(cellBounds)) {
          // セル内のオブジェクトを個別にチェック
          cellObjects.forEach((obj) => {
            if (obj.userData.boundingBox) {
              if (frustum.intersectsBox(obj.userData.boundingBox)) {
                visibleObjects.push(obj)
                obj.visible = true
              } else {
                obj.visible = false
              }
            }
          })
        } else {
          // セル全体が見えない場合
          cellObjects.forEach((obj) => {
            obj.visible = false
          })
        }
      })

      yield* Effect.log(`Visible objects: ${visibleObjects.length}/${objects.length}`)
      return visibleObjects
    })

  // GPU オクルージョンクエリ
  const gpuOcclusionCulling = (
    renderer: THREE.WebGLRenderer,
    objects: THREE.Object3D[]
  ) =>
    Effect.gen(function* () {
      const gl = renderer.getContext() as WebGL2RenderingContext
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')

      if (!ext) {
        yield* Effect.log("GPU occlusion queries not supported")
        return objects
      }

      const visibleObjects: THREE.Object3D[] = []

      for (const obj of objects) {
        const queryId = obj.uuid

        // クエリを作成または取得
        if (!occlusionQueries.has(queryId)) {
          const query = gl.createQuery()!
          occlusionQueries.set(queryId, query)
        }

        const query = occlusionQueries.get(queryId)!

        // 前フレームの結果をチェック
        if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
          const pixelsDrawn = gl.getQueryParameter(query, gl.QUERY_RESULT)

          if (pixelsDrawn > 0) {
            visibleObjects.push(obj)
            obj.visible = true
          } else {
            obj.visible = false
          }
        }

        // 新しいクエリを開始
        gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, query)
        // オブジェクトの簡略化されたバウンディングボックスを描画
        renderBoundingBox(obj, renderer)
        gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE)
      }

      return visibleObjects
    })

  return { frustumCullWithSpatialHash, gpuOcclusionCulling }
})

// ========================================
// テクスチャアトラスとバッチング
// ========================================

export const TextureAtlasManager = Effect.gen(function* () {
  const atlases = new Map<string, THREE.Texture>()
  const uvMappings = new Map<string, { u: number; v: number; width: number; height: number }>()

  // アトラス生成
  const createAtlas = (
    textures: Array<{ id: string; image: HTMLImageElement }>,
    atlasSize: number = 4096
  ) =>
    Effect.gen(function* () {
      const canvas = document.createElement('canvas')
      canvas.width = atlasSize
      canvas.height = atlasSize
      const ctx = canvas.getContext('2d')!

      let currentX = 0
      let currentY = 0
      let rowHeight = 0

      textures.forEach(({ id, image }) => {
        // 次の行に移動
        if (currentX + image.width > atlasSize) {
          currentX = 0
          currentY += rowHeight
          rowHeight = 0
        }

        // 画像を描画
        ctx.drawImage(image, currentX, currentY)

        // UV座標を記録
        uvMappings.set(id, {
          u: currentX / atlasSize,
          v: currentY / atlasSize,
          width: image.width / atlasSize,
          height: image.height / atlasSize
        })

        currentX += image.width
        rowHeight = Math.max(rowHeight, image.height)
      })

      // Three.jsテクスチャを作成
      const texture = new THREE.CanvasTexture(canvas)
      texture.generateMipmaps = true
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter

      atlases.set('main', texture)
      yield* Effect.log(`Created texture atlas: ${atlasSize}x${atlasSize}`)

      return texture
    })

  // UV座標の取得
  const getUVMapping = (textureId: string) =>
    Effect.sync(() => uvMappings.get(textureId))

  return { createAtlas, getUVMapping }
})

### 6. ECSクエリの最適化実装

ビットマスクとアーキタイプを活用した高速なECSクエリシステムの実装です。

```typescript
import { Effect, Chunk, HashMap, Option } from "effect"

// ========================================
// ビットマスクベースの高速クエリ
// ========================================

// コンポーネント型定義
type ComponentType =
  | "Position" | "Velocity" | "Rotation"
  | "Mesh" | "Collider" | "Health"
  | "AI" | "Player" | "Static"

export const BitMaskQuerySystem = Effect.gen(function* () {
  // コンポーネントをビット位置にマッピング
  const componentBits = new Map<ComponentType, bigint>([
    ["Position", 1n << 0n],
    ["Velocity", 1n << 1n],
    ["Rotation", 1n << 2n],
    ["Mesh", 1n << 3n],
    ["Collider", 1n << 4n],
    ["Health", 1n << 5n],
    ["AI", 1n << 6n],
    ["Player", 1n << 7n],
    ["Static", 1n << 8n],
  ])

  // エンティティのマスクストレージ
  const entityMasks = new Map<number, bigint>()

  // クエリのプリコンパイル
  const precompiledQueries = new Map<string, bigint>()

  // コンポーネント追加時にマスク更新
  const addComponent = (entityId: number, component: ComponentType) =>
    Effect.sync(() => {
      const currentMask = entityMasks.get(entityId) || 0n
      const componentBit = componentBits.get(component)!
      entityMasks.set(entityId, currentMask | componentBit)
    })

  // コンポーネント削除時にマスク更新
  const removeComponent = (entityId: number, component: ComponentType) =>
    Effect.sync(() => {
      const currentMask = entityMasks.get(entityId) || 0n
      const componentBit = componentBits.get(component)!
      entityMasks.set(entityId, currentMask & ~componentBit)
    })

  // クエリをプリコンパイル
  const compileQuery = (
    queryId: string,
    required: ComponentType[],
    excluded: ComponentType[] = []
  ) =>
    Effect.sync(() => {
      let includeMask = 0n
      let excludeMask = 0n

      required.forEach((comp) => {
        includeMask |= componentBits.get(comp)!
      })

      excluded.forEach((comp) => {
        excludeMask |= componentBits.get(comp)!
      })

      // クエリマスクを保存
      const queryMask = (includeMask << 32n) | excludeMask
      precompiledQueries.set(queryId, queryMask)

      return queryMask
    })

  // 高速クエリ実行（SIMD風の並列チェック）
  const executeQuery = (queryId: string) =>
    Effect.gen(function* () {
      const queryMask = precompiledQueries.get(queryId)
      if (!queryMask) {
        return yield* Effect.fail(new Error(`Query ${queryId} not found`))
      }

      const includeMask = queryMask >> 32n
      const excludeMask = queryMask & 0xFFFFFFFFn

      const results: number[] = []

      // バッチ処理でエンティティをチェック
      const entities = Array.from(entityMasks.entries())
      const batchSize = 4 // SIMD-like バッチサイズ

      for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, Math.min(i + batchSize, entities.length))

        // 並列チェック（実際のSIMD命令をシミュレート）
        batch.forEach(([entityId, mask]) => {
          const hasRequired = (mask & includeMask) === includeMask
          const hasExcluded = (mask & excludeMask) !== 0n

          if (hasRequired && !hasExcluded) {
            results.push(entityId)
          }
        })
      }

      return results
    })

  return {
    addComponent,
    removeComponent,
    compileQuery,
    executeQuery
  }
})

// ========================================
// アーキタイプベースのストレージ
// ========================================

interface Archetype {
  signature: bigint
  entities: Set<number>
  componentArrays: Map<ComponentType, Float32Array | Uint32Array>
  capacity: number
  count: number
}

export const ArchetypeStorage = Effect.gen(function* () {
  const archetypes = new Map<bigint, Archetype>()
  const entityToArchetype = new Map<number, Archetype>()

  // アーキタイプの作成または取得
  const getOrCreateArchetype = (signature: bigint) =>
    Effect.sync(() => {
      if (archetypes.has(signature)) {
        return archetypes.get(signature)!
      }

      const archetype: Archetype = {
        signature,
        entities: new Set(),
        componentArrays: new Map(),
        capacity: 1000,
        count: 0
      }

      // シグネチャに基づいてコンポーネント配列を事前割り当て
      let bit = 0n
      while (bit < 64n) {
        if ((signature & (1n << bit)) !== 0n) {
          // コンポーネントタイプに応じた配列を作成
          const componentType = getComponentTypeFromBit(bit)
          if (componentType) {
            const array = createComponentArray(componentType, archetype.capacity)
            archetype.componentArrays.set(componentType, array)
          }
        }
        bit++
      }

      archetypes.set(signature, archetype)
      return archetype
    })

  // エンティティをアーキタイプに追加
  const addEntityToArchetype = (entityId: number, signature: bigint) =>
    Effect.gen(function* () {
      const archetype = yield* getOrCreateArchetype(signature)

      // 容量チェック
      if (archetype.count >= archetype.capacity) {
        // 配列を拡張
        yield* expandArchetype(archetype)
      }

      archetype.entities.add(entityId)
      entityToArchetype.set(entityId, archetype)
      archetype.count++

      return archetype
    })

  // アーキタイプの配列を拡張
  const expandArchetype = (archetype: Archetype) =>
    Effect.sync(() => {
      const newCapacity = archetype.capacity * 2

      archetype.componentArrays.forEach((array, componentType) => {
        const ArrayConstructor = array instanceof Float32Array
          ? Float32Array
          : Uint32Array
        const newArray = new ArrayConstructor(newCapacity * getComponentSize(componentType))
        newArray.set(array)
        archetype.componentArrays.set(componentType, newArray)
      })

      archetype.capacity = newCapacity
    })

  // アーキタイプクエリの実行（高速イテレーション）
  const queryArchetypes = (includeMask: bigint, excludeMask: bigint = 0n) =>
    Effect.gen(function* () {
      const matchingArchetypes: Archetype[] = []

      archetypes.forEach((archetype) => {
        const hasRequired = (archetype.signature & includeMask) === includeMask
        const hasExcluded = (archetype.signature & excludeMask) !== 0n

        if (hasRequired && !hasExcluded) {
          matchingArchetypes.push(archetype)
        }
      })

      return matchingArchetypes
    })

  // バッチ処理用のイテレータ
  const createBatchIterator = (archetype: Archetype, batchSize: number = 100) =>
    Effect.gen(function* () {
      const iterations = Math.ceil(archetype.count / batchSize)
      const batches: Array<{ start: number; end: number }> = []

      for (let i = 0; i < iterations; i++) {
        batches.push({
          start: i * batchSize,
          end: Math.min((i + 1) * batchSize, archetype.count)
        })
      }

      return batches
    })

  return {
    getOrCreateArchetype,
    addEntityToArchetype,
    queryArchetypes,
    createBatchIterator
  }
})

// ========================================
// スパース配列による高速アクセス
// ========================================

// ❌ 修正前: クラスベースの実装（非推奨パターン）
// export class SparseSet<T> { ... }

// ✅ 修正後: Effect-TS 3.x関数型パターンによるSparseSet実装
export const SparseSet = Context.GenericTag<{
  readonly insert: <T>(entityId: number, component: T) => Effect.Effect<void, never>
  readonly get: <T>(entityId: number) => Effect.Effect<Option.Option<T>, never>
  readonly remove: (entityId: number) => Effect.Effect<boolean, never>
  readonly iterate: <T>() => Effect.Effect<Array<readonly [number, T]>, never>
  readonly getDenseArray: <T>() => Effect.Effect<ReadonlyArray<T>, never>
  readonly clear: () => Effect.Effect<void, never>
  readonly size: () => Effect.Effect<number, never>
}>("@minecraft/SparseSet")

export const makeSparseSet = <T>(maxEntities: number = 100000) =>
  Effect.gen(function* () {
    const denseRef = yield* Ref.make<T[]>([])
    const sparseRef = yield* Ref.make<number[]>(new Array(maxEntities).fill(-1))
    const sizeRef = yield* Ref.make(0)

    return SparseSet.of({
      insert: (entityId: number, component: T) => Effect.gen(function* () {
        const sparse = yield* Ref.get(sparseRef)
        const dense = yield* Ref.get(denseRef)
        const currentSize = yield* Ref.get(sizeRef)

        if (sparse[entityId] === -1) {
          // 新しいエンティティを追加
          yield* Ref.update(sparseRef, arr => {
            const newArr = [...arr]
            newArr[entityId] = currentSize
            return newArr
          })
          yield* Ref.update(denseRef, arr => {
            const newArr = [...arr]
            newArr[currentSize] = component
            return newArr
          })
          yield* Ref.update(sizeRef, s => s + 1)
        } else {
          // 既存のエンティティを更新
          yield* Ref.update(denseRef, arr => {
            const newArr = [...arr]
            newArr[sparse[entityId]] = component
            return newArr
          })
        }
      }),

      get: (entityId: number) => Effect.gen(function* () {
        const sparse = yield* Ref.get(sparseRef)
        const dense = yield* Ref.get(denseRef)
        const currentSize = yield* Ref.get(sizeRef)

        const index = sparse[entityId]
        return index !== -1 && index < currentSize
          ? Option.some(dense[index])
          : Option.none()
      }),

      remove: (entityId: number) => Effect.gen(function* () {
        const sparse = yield* Ref.get(sparseRef)
        const dense = yield* Ref.get(denseRef)
        const currentSize = yield* Ref.get(sizeRef)

        const index = sparse[entityId]
        if (index === -1 || index >= currentSize) {
          return false
        }

        // スワップして削除（O(1)）
        if (index < currentSize - 1) {
          yield* Ref.update(denseRef, arr => {
            const newArr = [...arr]
            newArr[index] = newArr[currentSize - 1]
            return newArr
          })

          // 移動したエンティティのスパースインデックスを更新
          yield* Ref.update(sparseRef, arr => {
            const newArr = [...arr]
            for (let i = 0; i < newArr.length; i++) {
              if (newArr[i] === currentSize - 1) {
                newArr[i] = index
                break
              }
            }
            newArr[entityId] = -1
            return newArr
          })
        } else {
          yield* Ref.update(sparseRef, arr => {
            const newArr = [...arr]
            newArr[entityId] = -1
            return newArr
          })
        }

        yield* Ref.update(sizeRef, s => s - 1)
        return true
      }),

      iterate: () => Effect.gen(function* () {
        const dense = yield* Ref.get(denseRef)
        const sparse = yield* Ref.get(sparseRef)
        const currentSize = yield* Ref.get(sizeRef)

        const results: Array<readonly [number, T]> = []
        for (let i = 0; i < currentSize; i++) {
          const entityId = sparse.indexOf(i)
          if (entityId !== -1) {
            results.push([entityId, dense[i]] as const)
          }
        }
        return results
      }),

      getDenseArray: () => Effect.gen(function* () {
        const dense = yield* Ref.get(denseRef)
        const currentSize = yield* Ref.get(sizeRef)
        return dense.slice(0, currentSize) as ReadonlyArray<T>
      }),

      clear: () => Effect.gen(function* () {
        yield* Ref.set(denseRef, [])
        yield* Ref.set(sparseRef, new Array(maxEntities).fill(-1))
        yield* Ref.set(sizeRef, 0)
      }),

      size: () => Ref.get(sizeRef)
    })
  })

export const SparseSetLive = <T>(maxEntities?: number) =>
  Layer.effect(SparseSet, makeSparseSet<T>(maxEntities))

// 使用例: 関数型パターンでのSparseSet活用
const useSparseSetExample = Effect.gen(function* () {
  const sparseSet = yield* SparseSet

  // エンティティにコンポーネントを挿入
  yield* sparseSet.insert(42, { health: 100, position: { x: 0, y: 0, z: 0 } })
  yield* sparseSet.insert(100, { health: 50, position: { x: 10, y: 5, z: 20 } })

  // エンティティのコンポーネントを取得
  const component = yield* sparseSet.get(42)
  yield* Effect.log(
    Option.match(component, {
      onNone: () => "Component not found",
      onSome: (comp) => `Health: ${comp.health}`
    })
  )

  // 高速イテレーション
  const entities = yield* sparseSet.iterate()
  yield* Effect.forEach(entities, ([entityId, comp]) =>
    Effect.log(`Entity ${entityId}: Health=${comp.health}`)
  )

  // エンティティを削除
  const removed = yield* sparseSet.remove(42)
  yield* Effect.log(`Removed: ${removed}`)
}).pipe(
  Effect.provide(SparseSetLive())
)

// ========================================
// クエリキャッシュとインデックス
// ========================================

export const QueryCache = Effect.gen(function* () {
  const cache = new Map<string, {
    result: number[]
    timestamp: number
    dependencies: Set<ComponentType>
  }>()

  const indexedQueries = new Map<ComponentType, Set<string>>()

  // クエリ結果のキャッシュ
  const cacheQuery = (
    queryId: string,
    result: number[],
    dependencies: ComponentType[]
  ) =>
    Effect.sync(() => {
      cache.set(queryId, {
        result,
        timestamp: Date.now(),
        dependencies: new Set(dependencies)
      })

      // インデックスを更新
      dependencies.forEach((comp) => {
        if (!indexedQueries.has(comp)) {
          indexedQueries.set(comp, new Set())
        }
        indexedQueries.get(comp)!.add(queryId)
      })
    })

  // コンポーネント変更時にキャッシュを無効化
  const invalidateQueriesForComponent = (component: ComponentType) =>
    Effect.sync(() => {
      const affectedQueries = indexedQueries.get(component) || new Set()

      affectedQueries.forEach((queryId) => {
        cache.delete(queryId)
      })

      return affectedQueries.size
    })

  // キャッシュからクエリ結果を取得
  const getCachedQuery = (queryId: string, maxAge: number = 16) =>
    Effect.gen(function* () {
      const cached = cache.get(queryId)

      if (cached && Date.now() - cached.timestamp < maxAge) {
        return Option.some(cached.result)
      }

      return Option.none()
    })

  return {
    cacheQuery,
    invalidateQueriesForComponent,
    getCachedQuery
  }
})

// ヘルパー関数
function getComponentTypeFromBit(bit: bigint): ComponentType | null {
  const mapping: Record<number, ComponentType> = {
    0: "Position",
    1: "Velocity",
    2: "Rotation",
    3: "Mesh",
    4: "Collider",
    5: "Health",
    6: "AI",
    7: "Player",
    8: "Static"
  }
  return mapping[Number(bit)] || null
}

function getComponentSize(type: ComponentType): number {
  const sizes: Record<ComponentType, number> = {
    Position: 3,
    Velocity: 3,
    Rotation: 4,
    Mesh: 1,
    Collider: 6,
    Health: 1,
    AI: 2,
    Player: 1,
    Static: 1
  }
  return sizes[type] || 1
}

function createComponentArray(
  type: ComponentType,
  capacity: number
): Float32Array | Uint32Array {
  const size = getComponentSize(type)
  const isFloat = ["Position", "Velocity", "Rotation", "Collider"].includes(type)

  return isFloat
    ? new Float32Array(capacity * size)
    : new Uint32Array(capacity * size)
}

### 7. 起動時間短縮の実装

段階的初期化と遅延読み込みによる起動時間の最適化実装です。

```typescript
import { Effect, Queue, Ref, Fiber, Schedule, Duration } from "effect"

// ========================================
// プログレッシブ初期化システム
// ========================================

interface InitPhase {
  name: string
  priority: "critical" | "important" | "optional"
  dependencies: string[]
  task: Effect.Effect<void, Error>
  estimatedTime: number // ミリ秒
}

export const ProgressiveInitializer = Effect.gen(function* () {
  const phases = yield* Ref.make<Map<string, InitPhase>>(new Map())
  const completedPhases = yield* Ref.make<Set<string>>(new Set())
  const initProgress = yield* Ref.make(0)

  // フェーズの登録
  const registerPhase = (phase: InitPhase) =>
    Ref.update(phases, (map) => new Map(map).set(phase.name, phase))

  // 依存関係の解決
  const resolveDependencies = (phaseName: string): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      const allPhases = yield* Ref.get(phases)
      const completed = yield* Ref.get(completedPhases)
      const phase = allPhases.get(phaseName)

      if (!phase) return false

      // 全ての依存関係が完了しているかチェック
      return phase.dependencies.every((dep) => completed.has(dep))
    })

  // 優先度別の初期化実行
  const executeInitialization = () =>
    Effect.gen(function* () {
      const allPhases = yield* Ref.get(phases)
      const startTime = Date.now()

      // フェーズを優先度でグループ化
      const criticalPhases: InitPhase[] = []
      const importantPhases: InitPhase[] = []
      const optionalPhases: InitPhase[] = []

      allPhases.forEach((phase) => {
        switch (phase.priority) {
          case "critical":
            criticalPhases.push(phase)
            break
          case "important":
            importantPhases.push(phase)
            break
          case "optional":
            optionalPhases.push(phase)
            break
        }
      })

      // Phase 1: Critical（ブロッキング）
      yield* Effect.log("🚀 Phase 1: Critical initialization")
      yield* Effect.forEach(
        criticalPhases,
        (phase) =>
          Effect.gen(function* () {
            const canRun = yield* resolveDependencies(phase.name)
            if (!canRun) {
              return yield* Effect.fail(
                new Error(`Dependencies not met for ${phase.name}`)
              )
            }

            const phaseStart = Date.now()
            yield* phase.task
            const phaseDuration = Date.now() - phaseStart

            yield* Ref.update(completedPhases, (set) => new Set([...set, phase.name]))
            yield* Ref.update(initProgress, (p) => p + 1)
            yield* Effect.log(
              `✅ ${phase.name} completed in ${phaseDuration}ms`
            )
          }),
        { concurrency: 1 } // 順次実行
      )

      const criticalTime = Date.now() - startTime
      yield* Effect.log(`⏱️ Critical phase completed in ${criticalTime}ms`)

      // ゲームをプレイ可能にする
      yield* Effect.sync(() => {
        // UIを有効化、基本的なゲームループを開始
        enableBasicGameplay()
      })

      // Phase 2: Important（非ブロッキング）
      const importantFiber = yield* Effect.fork(
        Effect.gen(function* () {
          yield* Effect.log("⚡ Phase 2: Important initialization (background)")
          yield* Effect.forEach(
            importantPhases,
            (phase) =>
              Effect.gen(function* () {
                const canRun = yield* resolveDependencies(phase.name)
                if (canRun) {
                  yield* phase.task
                  yield* Ref.update(completedPhases, (set) =>
                    new Set([...set, phase.name])
                  )
                  yield* Ref.update(initProgress, (p) => p + 1)
                  yield* Effect.log(`✅ ${phase.name} completed`)
                }
              }),
            { concurrency: 2 } // 並列実行
          )
        })
      )

      // Phase 3: Optional（低優先度）
      yield* Effect.fork(
        Effect.gen(function* () {
          // Important が完了するまで待機
          yield* Fiber.join(importantFiber)
          yield* Effect.sleep(Duration.seconds(1))

          yield* Effect.log("🎯 Phase 3: Optional initialization (idle)")
          yield* Effect.forEach(
            optionalPhases,
            (phase) =>
              Effect.gen(function* () {
                const canRun = yield* resolveDependencies(phase.name)
                if (canRun) {
                  // アイドル時のみ実行
                  yield* Effect.sleep(Duration.millis(100))
                  yield* phase.task
                  yield* Ref.update(completedPhases, (set) =>
                    new Set([...set, phase.name])
                  )
                  yield* Ref.update(initProgress, (p) => p + 1)
                  yield* Effect.log(`✅ ${phase.name} completed`)
                }
              }),
            { concurrency: 1 }
          )
        })
      )

      const totalTime = Date.now() - startTime
      yield* Effect.log(`🎮 Game playable in ${totalTime}ms`)

      return totalTime
    })

  return {
    registerPhase,
    executeInitialization,
    getProgress: () => Ref.get(initProgress)
  }
})

// ========================================
// 動的モジュールローダー
// ========================================

interface ModuleConfig {
  name: string
  path: string
  priority: number // 0-10, 10が最高
  preload: boolean
  dependencies: string[]
}

export const DynamicModuleLoader = Effect.gen(function* () {
  const moduleCache = new Map<string, any>()
  const loadingModules = new Map<string, Promise<any>>()
  const moduleRegistry = yield* Ref.make<Map<string, ModuleConfig>>(new Map())

  // モジュール登録
  const registerModule = (config: ModuleConfig) =>
    Ref.update(moduleRegistry, (map) => new Map(map).set(config.name, config))

  // 優先度付きプリロード
  const preloadModules = () =>
    Effect.gen(function* () {
      const registry = yield* Ref.get(moduleRegistry)
      const modules = Array.from(registry.values())
        .filter((m) => m.preload)
        .sort((a, b) => b.priority - a.priority)

      // 高優先度モジュール（8以上）は即座にロード
      const highPriority = modules.filter((m) => m.priority >= 8)
      yield* Effect.forEach(
        highPriority,
        (module) => loadModule(module.name),
        { concurrency: 4 }
      )

      // 中優先度モジュール（5-7）は少し遅延してロード
      const mediumPriority = modules.filter((m) => m.priority >= 5 && m.priority < 8)
      yield* Effect.fork(
        Effect.gen(function* () {
          yield* Effect.sleep(Duration.millis(100))
          yield* Effect.forEach(
            mediumPriority,
            (module) => loadModule(module.name),
            { concurrency: 2 }
          )
        })
      )

      // 低優先度モジュール（5未満）はアイドル時にロード
      const lowPriority = modules.filter((m) => m.priority < 5)
      yield* Effect.fork(
        Effect.gen(function* () {
          yield* Effect.sleep(Duration.seconds(2))
          yield* Effect.forEach(
            lowPriority,
            (module) => loadModule(module.name),
            { concurrency: 1 }
          )
        })
      )
    })

  // モジュールの遅延ロード
  const loadModule = (moduleName: string) =>
    Effect.gen(function* () {
      // キャッシュチェック
      if (moduleCache.has(moduleName)) {
        return moduleCache.get(moduleName)
      }

      // 既にロード中の場合は待機
      if (loadingModules.has(moduleName)) {
        return yield* Effect.promise(() => loadingModules.get(moduleName)!)
      }

      const registry = yield* Ref.get(moduleRegistry)
      const config = registry.get(moduleName)

      if (!config) {
        return yield* Effect.fail(new Error(`Module ${moduleName} not registered`))
      }

      // 依存関係を先にロード
      if (config.dependencies.length > 0) {
        yield* Effect.forEach(
          config.dependencies,
          (dep) => loadModule(dep),
          { concurrency: 2 }
        )
      }

      // モジュールをロード
      const loadPromise = import(config.path).then((module) => {
        moduleCache.set(moduleName, module)
        loadingModules.delete(moduleName)
        return module
      })

      loadingModules.set(moduleName, loadPromise)

      return yield* Effect.promise(() => loadPromise)
    })

  // 使用時ロード（Just-in-Time）
  const requireModule = (moduleName: string) =>
    Effect.gen(function* () {
      const cached = moduleCache.get(moduleName)
      if (cached) return cached

      // 同期的にロードが必要な場合
      yield* Effect.log(`JIT loading module: ${moduleName}`)
      return yield* loadModule(moduleName)
    })

  return {
    registerModule,
    preloadModules,
    loadModule,
    requireModule
  }
})

// ========================================
// アセットストリーミングとプリフェッチ
// ========================================

interface AssetRequest {
  id: string
  url: string
  type: "texture" | "model" | "audio" | "data"
  priority: "immediate" | "high" | "normal" | "low"
  size?: number
}

export const AssetStreamingSystem = Effect.gen(function* () {
  const loadQueue = yield* Queue.bounded<AssetRequest>(100)
  const loadedAssets = yield* Ref.make<Map<string, any>>(new Map())
  const loadingAssets = yield* Ref.make<Set<string>>(new Set())
  const workers = new Array(4).fill(null).map(() => new Worker("/workers/asset-loader.js"))

  // 距離ベースの優先度計算
  const calculatePriority = (
    assetPosition: { x: number; z: number },
    playerPosition: { x: number; z: number }
  ): AssetRequest["priority"] => {
    const distance = Math.sqrt(
      Math.pow(assetPosition.x - playerPosition.x, 2) +
      Math.pow(assetPosition.z - playerPosition.z, 2)
    )

    if (distance < 50) return "immediate"
    if (distance < 100) return "high"
    if (distance < 200) return "normal"
    return "low"
  }

  // プリフェッチングロジック
  const prefetchAssets = (playerPosition: { x: number; z: number }) =>
    Effect.gen(function* () {
      // プレイヤーの移動方向を予測
      const predictedPosition = predictPlayerMovement(playerPosition)

      // 周辺のチャンクを取得
      const nearbyChunks = getNearbyChunks(predictedPosition, 5)

      // アセットリクエストを生成
      const requests: AssetRequest[] = nearbyChunks.map((chunk) => ({
        id: `chunk-${chunk.x}-${chunk.z}`,
        url: `/assets/chunks/${chunk.x}_${chunk.z}.dat`,
        type: "data" as const,
        priority: calculatePriority(chunk, playerPosition)
      }))

      // 優先度順でキューに追加
      const sorted = requests.sort((a, b) => {
        const priorityOrder = { immediate: 0, high: 1, normal: 2, low: 3 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })

      yield* Effect.forEach(sorted, (req) => Queue.offer(loadQueue, req))
    })

  // アセットローダーワーカー
  const assetLoader = Effect.gen(function* () {
    while (true) {
      const request = yield* Queue.take(loadQueue)
      const loading = yield* Ref.get(loadingAssets)

      // 既にロード中の場合はスキップ
      if (loading.has(request.id)) continue

      yield* Ref.update(loadingAssets, (set) => new Set([...set, request.id]))

      // 優先度に応じた遅延
      const delay = Match.value(request.priority).pipe(
        Match.when("immediate", () => 0),
        Match.when("high", () => 10),
        Match.when("normal", () => 50),
        Match.when("low", () => 100),
        Match.exhaustive
      )

      if (delay > 0) {
        yield* Effect.sleep(Duration.millis(delay))
      }

      // Worker を使ってロード
      const workerIndex = Math.floor(Math.random() * workers.length)
      const worker = workers[workerIndex]

      yield* Effect.async<void>((resume) => {
        worker.postMessage({ type: "load", request })

        const handler = (event: MessageEvent) => {
          if (event.data.id === request.id) {
            worker.removeEventListener("message", handler)

            Effect.runSync(Effect.gen(function* () {
              yield* Ref.update(loadedAssets, (map) =>
                new Map(map).set(request.id, event.data.asset)
              )
              yield* Ref.update(loadingAssets, (set) => {
                const newSet = new Set(set)
                newSet.delete(request.id)
                return newSet
              })
            }))

            resume(Effect.succeed(undefined))
          }
        }

        worker.addEventListener("message", handler)
      })
    }
  })

  // 初期化とクリーンアップ
  const initialize = () =>
    Effect.gen(function* () {
      // アセットローダーを起動
      const loaderFibers = yield* Effect.forEach(
        Array(4).fill(null),
        () => Effect.fork(assetLoader),
        { concurrency: "unbounded" }
      )

      // クリーンアップの登録
      yield* Effect.addFinalizer(() =>
        Effect.forEach(loaderFibers, Fiber.interrupt)
      )
    })

  return {
    prefetchAssets,
    getAsset: (id: string) =>
      Ref.get(loadedAssets).pipe(Effect.map((map) => map.get(id))),
    initialize
  }
})

// ========================================
// 初期化フェーズの実装例
// ========================================

export const setupInitializationPhases = () =>
  Effect.gen(function* () {
    const initializer = yield* ProgressiveInitializer
    const moduleLoader = yield* DynamicModuleLoader
    const assetStreamer = yield* AssetStreamingSystem

    // Critical phases - ゲーム起動に必須
    yield* initializer.registerPhase({
      name: "core-systems",
      priority: "critical",
      dependencies: [],
      task: Effect.gen(function* () {
        yield* initializeCore()
        yield* initializeECS()
      }),
      estimatedTime: 50
    })

    yield* initializer.registerPhase({
      name: "renderer",
      priority: "critical",
      dependencies: ["core-systems"],
      task: Effect.gen(function* () {
        yield* initializeRenderer()
        yield* createInitialScene()
      }),
      estimatedTime: 100
    })

    yield* initializer.registerPhase({
      name: "input",
      priority: "critical",
      dependencies: ["core-systems"],
      task: initializeInputSystem(),
      estimatedTime: 20
    })

    // Important phases - ゲーム体験に重要
    yield* initializer.registerPhase({
      name: "physics",
      priority: "important",
      dependencies: ["core-systems"],
      task: Effect.fork(initializePhysics()),
      estimatedTime: 150
    })

    yield* initializer.registerPhase({
      name: "audio",
      priority: "important",
      dependencies: ["core-systems"],
      task: Effect.fork(initializeAudio()),
      estimatedTime: 80
    })

    yield* initializer.registerPhase({
      name: "networking",
      priority: "important",
      dependencies: ["core-systems"],
      task: Effect.fork(initializeNetworking()),
      estimatedTime: 100
    })

    // Optional phases - 追加機能
    yield* initializer.registerPhase({
      name: "achievements",
      priority: "optional",
      dependencies: ["core-systems"],
      task: Effect.fork(initializeAchievements()),
      estimatedTime: 50
    })

    yield* initializer.registerPhase({
      name: "analytics",
      priority: "optional",
      dependencies: ["core-systems"],
      task: Effect.fork(initializeAnalytics()),
      estimatedTime: 30
    })

    // モジュール登録
    yield* moduleLoader.registerModule({
      name: "chunk-generator",
      path: "/modules/chunk-generator.js",
      priority: 9,
      preload: true,
      dependencies: []
    })

    yield* moduleLoader.registerModule({
      name: "mesh-optimizer",
      path: "/modules/mesh-optimizer.js",
      priority: 7,
      preload: true,
      dependencies: ["chunk-generator"]
    })

    yield* moduleLoader.registerModule({
      name: "particle-system",
      path: "/modules/particle-system.js",
      priority: 4,
      preload: false,
      dependencies: ["renderer"]
    })

    // 初期化実行
    const initTime = yield* initializer.executeInitialization()
    yield* moduleLoader.preloadModules()
    yield* assetStreamer.initialize()

    yield* Effect.log(`🎮 Total initialization time: ${initTime}ms`)

    return initTime
  })

// ヘルパー関数（スタブ）
function enableBasicGameplay() {
  console.log("Basic gameplay enabled")
}

function predictPlayerMovement(position: { x: number; z: number }) {
  // 簡単な予測ロジック
  return { x: position.x + 10, z: position.z + 10 }
}

function getNearbyChunks(position: { x: number; z: number }, radius: number) {
  const chunks = []
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      chunks.push({
        x: Math.floor(position.x / 16) + x,
        z: Math.floor(position.z / 16) + z
      })
    }
  }
  return chunks
}

// 初期化関数のスタブ
const initializeCore = () => Effect.log("Core initialized")
const initializeECS = () => Effect.log("ECS initialized")
const initializeRenderer = () => Effect.log("Renderer initialized")
const createInitialScene = () => Effect.log("Initial scene created")
const initializeInputSystem = () => Effect.log("Input system initialized")
const initializePhysics = () => Effect.log("Physics initialized")
const initializeAudio = () => Effect.log("Audio initialized")
const initializeNetworking = () => Effect.log("Networking initialized")
const initializeAchievements = () => Effect.log("Achievements initialized")
const initializeAnalytics = () => Effect.log("Analytics initialized")

このガイドを活用することで、ts-minecraftプロジェクトで効果的なパフォーマンス最適化を実現できます。継続的な計測と改善により、優れたゲーム体験を提供することが可能です。