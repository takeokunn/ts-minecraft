---
title: "01 Infrastructure Apis"
description: "01 Infrastructure Apisに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "10分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Infrastructure Layer API仕様

## 概要

Infrastructure層の外部システム連携API仕様です。Effect-TSのAdapterパターンを使用し、外部依存を抽象化した設計を定義します。

## Storage APIs

### World Storage API

```typescript
export const WorldStorageAdapter = Context.GenericTag<{
  save: (params: {
    worldId: string
    data: WorldData
  }) => Effect.Effect<void, StorageError>

  load: (
    worldId: string
  ) => Effect.Effect<WorldData, StorageError | NotFoundError>

  delete: (
    worldId: string
  ) => Effect.Effect<void, StorageError>

  list: () => Effect.Effect<ReadonlyArray<WorldMetadata>, StorageError>

  exists: (
    worldId: string
  ) => Effect.Effect<boolean, StorageError>
}>("@app/WorldStorageAdapter")
```

### Chunk Storage API

```typescript
export const ChunkStorageAdapter = Context.GenericTag<{
  saveChunk: (params: {
    worldId: string
    chunk: ChunkData
  }) => Effect.Effect<void, StorageError>

  loadChunk: (params: {
    worldId: string
    position: ChunkPosition
  }) => Effect.Effect<Option.Option<ChunkData>, StorageError>

  saveRegion: (params: {
    worldId: string
    region: RegionData
  }) => Effect.Effect<void, StorageError>

  loadRegion: (params: {
    worldId: string
    regionPos: RegionPosition
  }) => Effect.Effect<Option.Option<RegionData>, StorageError>

  // バッチ操作
  saveBatch: (params: {
    worldId: string
    chunks: ReadonlyArray<ChunkData>
  }) => Effect.Effect<void, StorageError>
}>("@app/ChunkStorageAdapter")
```

### Player Data Storage API

```typescript
export const PlayerStorageAdapter = Context.GenericTag<{
  savePlayer: (
    playerData: PlayerData
  ) => Effect.Effect<void, StorageError>

  loadPlayer: (
    playerId: string
  ) => Effect.Effect<Option.Option<PlayerData>, StorageError>

  deletePlayer: (
    playerId: string
  ) => Effect.Effect<void, StorageError>

  saveStats: (params: {
    playerId: string
    stats: PlayerStats
  }) => Effect.Effect<void, StorageError>

  loadStats: (
    playerId: string
  ) => Effect.Effect<Option.Option<PlayerStats>, StorageError>
}>('PlayerStorageAdapter')
```

## Rendering APIs

### WebGL Renderer API

```typescript
export interface WebGLRendererAdapter {
  readonly _: unique symbol
}

export const WebGLRendererAdapter = Context.GenericTag<WebGLRendererAdapter, {
  initialize: (params: {
    canvas: HTMLCanvasElement
    options?: RendererOptions
  }) => Effect.Effect<void, RendererError>

  render: (params: {
    scene: SceneData
    camera: CameraData
  }) => Effect.Effect<void, RendererError>

  createMesh: (params: {
    geometry: GeometryData
    material: MaterialData
  }) => Effect.Effect<MeshId, RendererError>

  updateMesh: (params: {
    meshId: MeshId
    updates: MeshUpdate
  }) => Effect.Effect<void, RendererError>

  disposeMesh: (
    meshId: MeshId
  ) => Effect.Effect<void, RendererError>

  setRenderTarget: (
    target: RenderTarget | null
  ) => Effect.Effect<void, RendererError>

  screenshot: () => Effect.Effect<Uint8Array, RendererError>
}>('WebGLRendererAdapter')
```

### Texture Management API

```typescript
export interface TextureAdapter {
  readonly _: unique symbol
}

export const TextureAdapter = Context.GenericTag<TextureAdapter, {
  loadTexture: (params: {
    url: string
    options?: TextureOptions
  }) => Effect.Effect<TextureId, TextureError>

  loadTextureAtlas: (params: {
    url: string
    mapping: AtlasMapping
  }) => Effect.Effect<TextureAtlasId, TextureError>

  createTexture: (params: {
    data: Uint8Array | ImageData
    width: number
    height: number
  }) => Effect.Effect<TextureId, TextureError>

  disposeTexture: (
    textureId: TextureId
  ) => Effect.Effect<void, TextureError>

  updateTexture: (params: {
    textureId: TextureId
    data: Uint8Array | ImageData
    offset?: { x: number; y: number }
  }) => Effect.Effect<void, TextureError>
}>('TextureAdapter')
```

## Network APIs

### WebSocket Adapter API

```typescript
export interface WebSocketAdapter {
  readonly _: unique symbol
}

export const WebSocketAdapter = Context.GenericTag<WebSocketAdapter, {
  connect: (params: {
    url: string
    protocols?: string[]
  }) => Effect.Effect<ConnectionId, NetworkError>

  disconnect: (
    connectionId: ConnectionId
  ) => Effect.Effect<void, NetworkError>

  send: (params: {
    connectionId: ConnectionId
    data: Uint8Array | string
  }) => Effect.Effect<void, NetworkError>

  receive: (
    connectionId: ConnectionId
  ) => Stream.Stream<MessageEvent, NetworkError>

  getState: (
    connectionId: ConnectionId
  ) => Effect.Effect<ConnectionState, NetworkError>
}>('WebSocketAdapter')
```

### HTTP Client API

```typescript
export interface HttpClientAdapter {
  readonly _: unique symbol
}

export const HttpClientAdapter = Context.GenericTag<HttpClientAdapter, {
  get: <T>(params: {
    url: string
    headers?: Record<string, string>
    schema: Schema.Schema<T>
  }) => Effect.Effect<T, HttpError | ParseError>

  post: <T, B>(params: {
    url: string
    body: B
    headers?: Record<string, string>
    schema: Schema.Schema<T>
  }) => Effect.Effect<T, HttpError | ParseError>

  download: (params: {
    url: string
    onProgress?: (progress: number) => void
  }) => Effect.Effect<Uint8Array, HttpError>

  upload: (params: {
    url: string
    file: File
    onProgress?: (progress: number) => void
  }) => Effect.Effect<void, HttpError>
}>('HttpClientAdapter')
```

## Audio APIs

### Audio Engine API

```typescript
export interface AudioEngineAdapter {
  readonly _: unique symbol
}

export const AudioEngineAdapter = Context.GenericTag<AudioEngineAdapter, {
  initialize: () => Effect.Effect<void, AudioError>

  loadSound: (params: {
    url: string
    type: 'effect' | 'music' | 'ambient'
  }) => Effect.Effect<SoundId, AudioError>

  playSound: (params: {
    soundId: SoundId
    options?: PlayOptions
  }) => Effect.Effect<PlaybackId, AudioError>

  stopSound: (
    playbackId: PlaybackId
  ) => Effect.Effect<void, AudioError>

  setVolume: (params: {
    category: 'master' | 'effect' | 'music' | 'ambient'
    volume: number
  }) => Effect.Effect<void, AudioError>

  play3DSound: (params: {
    soundId: SoundId
    position: Position
    options?: Play3DOptions
  }) => Effect.Effect<PlaybackId, AudioError>

  updateListenerPosition: (params: {
    position: Position
    orientation: Orientation
  }) => Effect.Effect<void, AudioError>
}>('AudioEngineAdapter')
```

## Input APIs

### Input Handler API

```typescript
export interface InputAdapter {
  readonly _: unique symbol
}

export const InputAdapter = Context.GenericTag<InputAdapter, {
  startCapture: (params: {
    element: HTMLElement
    options?: InputCaptureOptions
  }) => Effect.Effect<void, InputError>

  stopCapture: () => Effect.Effect<void, InputError>

  onKeyDown: () => Stream.Stream<KeyboardEvent, never>
  onKeyUp: () => Stream.Stream<KeyboardEvent, never>
  onMouseMove: () => Stream.Stream<MouseEvent, never>
  onMouseDown: () => Stream.Stream<MouseEvent, never>
  onMouseUp: () => Stream.Stream<MouseEvent, never>
  onWheel: () => Stream.Stream<WheelEvent, never>
  onTouchStart: () => Stream.Stream<TouchEvent, never>
  onTouchMove: () => Stream.Stream<TouchEvent, never>
  onTouchEnd: () => Stream.Stream<TouchEvent, never>

  setPointerLock: (
    locked: boolean
  ) => Effect.Effect<void, InputError>

  vibrate: (params: {
    pattern: number | number[]
  }) => Effect.Effect<void, InputError>
}>('InputAdapter')
```

## Performance Monitoring APIs

### Metrics Collector API

```typescript
export interface MetricsAdapter {
  readonly _: unique symbol
}

export const MetricsAdapter = Context.GenericTag<MetricsAdapter, {
  recordMetric: (params: {
    name: string
    value: number
    tags?: Record<string, string>
  }) => Effect.Effect<void, MetricsError>

  startTimer: (
    name: string
  ) => Effect.Effect<TimerId, MetricsError>

  stopTimer: (
    timerId: TimerId
  ) => Effect.Effect<Duration, MetricsError>

  recordFPS: (
    fps: number
  ) => Effect.Effect<void, MetricsError>

  getMetrics: (params: {
    name?: string
    timeRange?: TimeRange
  }) => Effect.Effect<ReadonlyArray<MetricData>, MetricsError>

  createHistogram: (params: {
    name: string
    buckets: number[]
  }) => Effect.Effect<HistogramId, MetricsError>

  recordHistogramValue: (params: {
    histogramId: HistogramId
    value: number
  }) => Effect.Effect<void, MetricsError>
}>('MetricsAdapter')
```

## WebWorker APIs

### Worker Pool API

```typescript
export interface WorkerPoolAdapter {
  readonly _: unique symbol
}

export const WorkerPoolAdapter = Context.GenericTag<WorkerPoolAdapter, {
  createPool: (params: {
    workerScript: string
    poolSize: number
  }) => Effect.Effect<PoolId, WorkerError>

  execute: <T, P>(params: {
    poolId: PoolId
    task: WorkerTask<P>
    payload: P
    schema: Schema.Schema<T>
  }) => Effect.Effect<T, WorkerError | ParseError>

  broadcast: <P>(params: {
    poolId: PoolId
    message: P
  }) => Effect.Effect<void, WorkerError>

  terminatePool: (
    poolId: PoolId
  ) => Effect.Effect<void, WorkerError>

  getPoolStats: (
    poolId: PoolId
  ) => Effect.Effect<PoolStats, WorkerError>
}>('WorkerPoolAdapter')
```

## Cache APIs

### Cache Adapter API

```typescript
export interface CacheAdapter {
  readonly _: unique symbol
}

export const CacheAdapter = Context.GenericTag<CacheAdapter, {
  get: <T>(params: {
    key: string
    schema: Schema.Schema<T>
  }) => Effect.Effect<Option.Option<T>, CacheError>

  set: <T>(params: {
    key: string
    value: T
    ttl?: Duration
  }) => Effect.Effect<void, CacheError>

  delete: (
    key: string
  ) => Effect.Effect<void, CacheError>

  clear: () => Effect.Effect<void, CacheError>

  has: (
    key: string
  ) => Effect.Effect<boolean, CacheError>

  size: () => Effect.Effect<number, CacheError>
}>('CacheAdapter')
```

## Implementation Examples

### Layer構成

```typescript
// Infrastructure Layer実装
export const InfrastructureLayer = Layer.mergeAll(
  WorldStorageAdapterLive,
  ChunkStorageAdapterLive,
  PlayerStorageAdapterLive,
  WebGLRendererAdapterLive,
  TextureAdapterLive,
  WebSocketAdapterLive,
  HttpClientAdapterLive,
  AudioEngineAdapterLive,
  InputAdapterLive,
  MetricsAdapterLive,
  WorkerPoolAdapterLive,
  CacheAdapterLive
)

// IndexedDB実装例
export const WorldStorageAdapterLive = Layer.succeed(
  WorldStorageAdapter,
  {
    save: (params) => Effect.gen(function* () {
      const db = yield* IndexedDBService
      yield* db.put('worlds', params.data, params.worldId)
    }),

    load: (worldId) => Effect.gen(function* () {
      const db = yield* IndexedDBService
      const data = yield* db.get('worlds', worldId)
      if (!data) {
        yield* Effect.fail(new NotFoundError({ worldId }))
      }
      return data
    }),

    // ... 他のメソッド実装
  }
)
```

### エラーリトライパターン

```typescript
// 高度なリトライパターン（タグ付きエラーとの組み合わせ）
export const withRetry = <R, E, A>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    maxAttempts?: number
    baseDelay?: Duration.Duration
    maxDelay?: Duration.Duration
    retryableErrors?: readonly string[]
  }
) => {
  const config = {
    maxAttempts: 3,
    baseDelay: Duration.millis(100),
    maxDelay: Duration.seconds(5),
    retryableErrors: ["NetworkError", "StorageError", "RendererError"],
    ...options
  }

  return pipe(
    effect,
    Effect.retry(
      Schedule.exponential(config.baseDelay).pipe(
        Schedule.jittered,
        Schedule.whileInput<E>((error) => {
          // タグ付きエラーのリトライ可能性判定
          if (error && typeof error === 'object' && '_tag' in error) {
            return config.retryableErrors.includes(error._tag as string)
          }
          return false
        }),
        Schedule.upTo(config.maxDelay),
        Schedule.recurs(config.maxAttempts - 1)
      )
    ),
    Effect.tapError(error =>
      Effect.logWarn(`Retry exhausted for effect. Final error: ${JSON.stringify(error)}`)
    )
  )
}

// 使用例（Resource管理との組み合わせ）
export const saveWithRetry = (worldId: string, data: WorldData) =>
  Effect.gen(function* () {
    const adapter = yield* WorldStorageAdapter

    return yield* withRetry(
      adapter.save({ worldId, data }),
      {
        maxAttempts: 5,
        baseDelay: Duration.millis(200),
        maxDelay: Duration.seconds(10),
        retryableErrors: ["StorageError", "FileSystemError"]
      }
    ).pipe(
      Effect.tapBoth({
        onFailure: (error) => Effect.logError(`World save failed permanently: ${error.message}`),
        onSuccess: () => Effect.logInfo(`World ${worldId} saved successfully after retry`)
      })
    )
  })
```

### バッチ処理パターン

```typescript
// チャンクの効率的なバッチ保存
export const saveChunksBatched = (
  worldId: string,
  chunks: ReadonlyArray<ChunkData>
) => Effect.gen(function* () {
  const adapter = yield* ChunkStorageAdapter

  // チャンクを領域ごとにグループ化
  const grouped = pipe(
    chunks,
    Array.groupBy(chunk =>
      `${Math.floor(chunk.x / 32)}_${Math.floor(chunk.z / 32)}`
    )
  )

  // 並列保存
  yield* Effect.all(
    Object.entries(grouped).map(([region, regionChunks]) =>
      adapter.saveBatch({ worldId, chunks: regionChunks })
    ),
    { concurrency: 4 }
  )
})
```