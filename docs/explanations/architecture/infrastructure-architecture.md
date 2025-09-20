---
title: '01 Infrastructure Apis'
description: '01 Infrastructure Apisに関する詳細な説明とガイド。'
category: 'specification'
difficulty: 'intermediate'
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: '10分'
---

# Infrastructure Layer API仕様

## 概要

Infrastructure層の外部システム連携API仕様です。Effect-TSのAdapterパターンを使用し、外部依存を抽象化した設計を定義します。

## Storage APIs

### World Storage API

```typescript
export const WorldStorageAdapter = Context.GenericTag<{
  save: (params: { worldId: string; data: WorldData }) => Effect.Effect<void, StorageError>

  load: (worldId: string) => Effect.Effect<WorldData, StorageError | NotFoundError>

  delete: (worldId: string) => Effect.Effect<void, StorageError>

  list: () => Effect.Effect<ReadonlyArray<WorldMetadata>, StorageError>

  exists: (worldId: string) => Effect.Effect<boolean, StorageError>
}>('@app/WorldStorageAdapter')
```

### Chunk Storage API

```typescript
export const ChunkStorageAdapter = Context.GenericTag<{
  saveChunk: (params: { worldId: string; chunk: ChunkData }) => Effect.Effect<void, StorageError>

  loadChunk: (params: {
    worldId: string
    position: ChunkPosition
  }) => Effect.Effect<Option.Option<ChunkData>, StorageError>

  saveRegion: (params: { worldId: string; region: RegionData }) => Effect.Effect<void, StorageError>

  loadRegion: (params: {
    worldId: string
    regionPos: RegionPosition
  }) => Effect.Effect<Option.Option<RegionData>, StorageError>

  // バッチ操作
  saveBatch: (params: { worldId: string; chunks: ReadonlyArray<ChunkData> }) => Effect.Effect<void, StorageError>
}>('@app/ChunkStorageAdapter')
```

### Player Data Storage API

```typescript
export const PlayerStorageAdapter = Context.GenericTag<{
  savePlayer: (playerData: PlayerData) => Effect.Effect<void, StorageError>

  loadPlayer: (playerId: string) => Effect.Effect<Option.Option<PlayerData>, StorageError>

  deletePlayer: (playerId: string) => Effect.Effect<void, StorageError>

  saveStats: (params: { playerId: string; stats: PlayerStats }) => Effect.Effect<void, StorageError>

  loadStats: (playerId: string) => Effect.Effect<Option.Option<PlayerStats>, StorageError>
}>('PlayerStorageAdapter')
```

## Rendering APIs

### WebGL Renderer API

```typescript
export interface WebGLRendererAdapter {
  readonly _: unique symbol
}

export const WebGLRendererAdapter = Context.GenericTag<
  WebGLRendererAdapter,
  {
    initialize: (params: { canvas: HTMLCanvasElement; options?: RendererOptions }) => Effect.Effect<void, RendererError>

    render: (params: { scene: SceneData; camera: CameraData }) => Effect.Effect<void, RendererError>

    createMesh: (params: { geometry: GeometryData; material: MaterialData }) => Effect.Effect<MeshId, RendererError>

    updateMesh: (params: { meshId: MeshId; updates: MeshUpdate }) => Effect.Effect<void, RendererError>

    disposeMesh: (meshId: MeshId) => Effect.Effect<void, RendererError>

    setRenderTarget: (target: RenderTarget | null) => Effect.Effect<void, RendererError>

    screenshot: () => Effect.Effect<Uint8Array, RendererError>
  }
>('WebGLRendererAdapter')
```

### Texture Management API

```typescript
export interface TextureAdapter {
  readonly _: unique symbol
}

export const TextureAdapter = Context.GenericTag<
  TextureAdapter,
  {
    loadTexture: (params: { url: string; options?: TextureOptions }) => Effect.Effect<TextureId, TextureError>

    loadTextureAtlas: (params: { url: string; mapping: AtlasMapping }) => Effect.Effect<TextureAtlasId, TextureError>

    createTexture: (params: {
      data: Uint8Array | ImageData
      width: number
      height: number
    }) => Effect.Effect<TextureId, TextureError>

    disposeTexture: (textureId: TextureId) => Effect.Effect<void, TextureError>

    updateTexture: (params: {
      textureId: TextureId
      data: Uint8Array | ImageData
      offset?: { x: number; y: number }
    }) => Effect.Effect<void, TextureError>
  }
>('TextureAdapter')
```

## Network APIs

### WebSocket Adapter API

```typescript
export interface WebSocketAdapter {
  readonly _: unique symbol
}

export const WebSocketAdapter = Context.GenericTag<
  WebSocketAdapter,
  {
    connect: (params: { url: string; protocols?: string[] }) => Effect.Effect<ConnectionId, NetworkError>

    disconnect: (connectionId: ConnectionId) => Effect.Effect<void, NetworkError>

    send: (params: { connectionId: ConnectionId; data: Uint8Array | string }) => Effect.Effect<void, NetworkError>

    receive: (connectionId: ConnectionId) => Stream.Stream<MessageEvent, NetworkError>

    getState: (connectionId: ConnectionId) => Effect.Effect<ConnectionState, NetworkError>
  }
>('WebSocketAdapter')
```

### HTTP Client API

```typescript
export interface HttpClientAdapter {
  readonly _: unique symbol
}

export const HttpClientAdapter = Context.GenericTag<
  HttpClientAdapter,
  {
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

    download: (params: { url: string; onProgress?: (progress: number) => void }) => Effect.Effect<Uint8Array, HttpError>

    upload: (params: {
      url: string
      file: File
      onProgress?: (progress: number) => void
    }) => Effect.Effect<void, HttpError>
  }
>('HttpClientAdapter')
```

## Audio APIs

### Audio Engine API

```typescript
export interface AudioEngineAdapter {
  readonly _: unique symbol
}

export const AudioEngineAdapter = Context.GenericTag<
  AudioEngineAdapter,
  {
    initialize: () => Effect.Effect<void, AudioError>

    loadSound: (params: { url: string; type: 'effect' | 'music' | 'ambient' }) => Effect.Effect<SoundId, AudioError>

    playSound: (params: { soundId: SoundId; options?: PlayOptions }) => Effect.Effect<PlaybackId, AudioError>

    stopSound: (playbackId: PlaybackId) => Effect.Effect<void, AudioError>

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
  }
>('AudioEngineAdapter')
```

## Input APIs

### Input Handler API

```typescript
export interface InputAdapter {
  readonly _: unique symbol
}

export const InputAdapter = Context.GenericTag<
  InputAdapter,
  {
    startCapture: (params: { element: HTMLElement; options?: InputCaptureOptions }) => Effect.Effect<void, InputError>

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

    setPointerLock: (locked: boolean) => Effect.Effect<void, InputError>

    vibrate: (params: { pattern: number | number[] }) => Effect.Effect<void, InputError>
  }
>('InputAdapter')
```

## Performance Monitoring APIs

### Metrics Collector API

```typescript
export interface MetricsAdapter {
  readonly _: unique symbol
}

export const MetricsAdapter = Context.GenericTag<
  MetricsAdapter,
  {
    recordMetric: (params: {
      name: string
      value: number
      tags?: Record<string, string>
    }) => Effect.Effect<void, MetricsError>

    startTimer: (name: string) => Effect.Effect<TimerId, MetricsError>

    stopTimer: (timerId: TimerId) => Effect.Effect<Duration, MetricsError>

    recordFPS: (fps: number) => Effect.Effect<void, MetricsError>

    getMetrics: (params: {
      name?: string
      timeRange?: TimeRange
    }) => Effect.Effect<ReadonlyArray<MetricData>, MetricsError>

    createHistogram: (params: { name: string; buckets: number[] }) => Effect.Effect<HistogramId, MetricsError>

    recordHistogramValue: (params: { histogramId: HistogramId; value: number }) => Effect.Effect<void, MetricsError>
  }
>('MetricsAdapter')
```

## WebWorker APIs

### Worker Pool API

```typescript
export interface WorkerPoolAdapter {
  readonly _: unique symbol
}

export const WorkerPoolAdapter = Context.GenericTag<
  WorkerPoolAdapter,
  {
    createPool: (params: { workerScript: string; poolSize: number }) => Effect.Effect<PoolId, WorkerError>

    execute: <T, P>(params: {
      poolId: PoolId
      task: WorkerTask<P>
      payload: P
      schema: Schema.Schema<T>
    }) => Effect.Effect<T, WorkerError | ParseError>

    broadcast: <P>(params: { poolId: PoolId; message: P }) => Effect.Effect<void, WorkerError>

    terminatePool: (poolId: PoolId) => Effect.Effect<void, WorkerError>

    getPoolStats: (poolId: PoolId) => Effect.Effect<PoolStats, WorkerError>
  }
>('WorkerPoolAdapter')
```

## Cache APIs

### Cache Adapter API

```typescript
export interface CacheAdapter {
  readonly _: unique symbol
}

export const CacheAdapter = Context.GenericTag<
  CacheAdapter,
  {
    get: <T>(params: { key: string; schema: Schema.Schema<T> }) => Effect.Effect<Option.Option<T>, CacheError>

    set: <T>(params: { key: string; value: T; ttl?: Duration }) => Effect.Effect<void, CacheError>

    delete: (key: string) => Effect.Effect<void, CacheError>

    clear: () => Effect.Effect<void, CacheError>

    has: (key: string) => Effect.Effect<boolean, CacheError>

    size: () => Effect.Effect<number, CacheError>
  }
>('CacheAdapter')
```

## Advanced Storage Systems

### Distributed Storage Architecture

```typescript
// =============================================================================
// 分散ストレージアーキテクチャ
// =============================================================================

// ストレージクラスタ管理
export const StorageClusterAdapter = Context.GenericTag<{
  readonly selectNode: (key: string) => Effect.Effect<StorageNodeId, ClusterError>
  readonly replicateData: (params: {
    key: string
    data: unknown
    replicationFactor: number
  }) => Effect.Effect<ReadonlyArray<StorageNodeId>, ReplicationError>
  readonly readWithFallback: (params: {
    key: string
    preferredNodes: ReadonlyArray<StorageNodeId>
  }) => Effect.Effect<unknown, StorageError>
  readonly getClusterHealth: () => Effect.Effect<ClusterHealth, HealthCheckError>
}>()('StorageClusterAdapter')

export const StorageClusterAdapterLive = Layer.effect(
  StorageClusterAdapter,
  Effect.gen(function* () {
    const nodeRegistry = yield* Ref.make(new Map<StorageNodeId, StorageNode>())
    const hashRing = yield* Ref.make<ConsistentHashRing>(new ConsistentHashRing())

    return {
      selectNode: (key) =>
        Effect.gen(function* () {
          const ring = yield* Ref.get(hashRing)
          const nodeId = ring.getNode(key)

          if (!nodeId) {
            yield* Effect.fail(
              new ClusterError({
                message: 'No available nodes in cluster',
                key,
                availableNodes: ring.getNodes(),
              })
            )
          }

          return nodeId
        }),

      replicateData: (params) =>
        Effect.gen(function* () {
          const ring = yield* Ref.get(hashRing)
          const nodes = ring.getReplicationNodes(params.key, params.replicationFactor)

          const replications = yield* Effect.all(
            nodes.map((nodeId) =>
              StorageNodeClient.pipe(
                Effect.flatMap((client) =>
                  client.store({
                    nodeId,
                    key: params.key,
                    data: params.data,
                  })
                )
              )
            ),
            { concurrency: params.replicationFactor }
          )

          return nodes
        }),

      readWithFallback: (params) =>
        Effect.gen(function* () {
          for (const nodeId of params.preferredNodes) {
            const result = yield* StorageNodeClient.pipe(
              Effect.flatMap((client) =>
                client.retrieve({
                  nodeId,
                  key: params.key,
                })
              ),
              Effect.option
            )

            if (Option.isSome(result)) {
              return result.value
            }
          }

          yield* Effect.fail(
            new StorageError({
              message: 'Data not found in any preferred nodes',
              key: params.key,
              triedNodes: params.preferredNodes,
            })
          )
        }),

      getClusterHealth: () =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(nodeRegistry)
          const nodes = Array.from(registry.values())

          const healthChecks = yield* Effect.all(
            nodes.map((node) =>
              StorageNodeClient.pipe(
                Effect.flatMap((client) => client.healthCheck(node.id)),
                Effect.map((health) => ({ nodeId: node.id, health })),
                Effect.catchAll((error) =>
                  Effect.succeed({
                    nodeId: node.id,
                    health: { status: 'unhealthy', error: error.message },
                  })
                )
              )
            ),
            { concurrency: 10 }
          )

          return {
            totalNodes: nodes.length,
            healthyNodes: healthChecks.filter((h) => h.health.status === 'healthy').length,
            nodeStatuses: healthChecks,
          }
        }),
    }
  })
)

// 一貫性ハッシュリング実装
export interface ConsistentHashRing {
  readonly ring: ReadonlyMap<number, StorageNodeId>
  readonly sortedHashes: ReadonlyArray<number>
  readonly virtualNodes: number
  readonly addNode: (nodeId: StorageNodeId) => ConsistentHashRing
  readonly removeNode: (nodeId: StorageNodeId) => ConsistentHashRing
  readonly getNode: (key: string) => Option.Option<StorageNodeId>
  readonly getReplicationNodes: (key: string, count: number) => ReadonlyArray<StorageNodeId>
  readonly getNodes: () => ReadonlyArray<StorageNodeId>
}

export const createConsistentHashRing = (virtualNodes: number = 150): ConsistentHashRing => {
  const ring = new Map<number, StorageNodeId>()
  const sortedHashes: number[] = []

  const hash = (input: string): number => {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 32bit整数に変換
    }
    return Math.abs(hash)
  }

  const rebuildSortedHashes = (ringMap: Map<number, StorageNodeId>): number[] =>
    Array.from(ringMap.keys()).sort((a, b) => a - b)

  const findNextIndex = (targetHash: number, hashes: readonly number[]): number => {
    for (let i = 0; i < hashes.length; i++) {
      if (hashes[i] >= targetHash) {
        return i
      }
    }
    return 0 // 最初にラップアラウンド
  }

  const getUniqueNodes = (ringMap: ReadonlyMap<number, StorageNodeId>): ReadonlyArray<StorageNodeId> =>
    Array.from(new Set(ringMap.values()))

  return {
    ring,
    sortedHashes,
    virtualNodes,

    addNode: (nodeId: StorageNodeId) => {
      const newRing = new Map(ring)
      for (let i = 0; i < virtualNodes; i++) {
        const nodeHash = hash(`${nodeId}-${i}`)
        newRing.set(nodeHash, nodeId)
      }
      const newSortedHashes = rebuildSortedHashes(newRing)
      return createConsistentHashRingFromState(newRing, newSortedHashes, virtualNodes)
    },

    removeNode: (nodeId: StorageNodeId) => {
      const newRing = new Map(ring)
      for (let i = 0; i < virtualNodes; i++) {
        const nodeHash = hash(`${nodeId}-${i}`)
        newRing.delete(nodeHash)
      }
      const newSortedHashes = rebuildSortedHashes(newRing)
      return createConsistentHashRingFromState(newRing, newSortedHashes, virtualNodes)
    },

    getNode: (key: string) => {
      if (sortedHashes.length === 0) return Option.none()

      const keyHash = hash(key)
      const index = findNextIndex(keyHash, sortedHashes)
      const targetHash = sortedHashes[index]
      return Option.fromNullable(ring.get(targetHash))
    },

    getReplicationNodes: (key: string, count: number) => {
      if (sortedHashes.length === 0) return []

      const keyHash = hash(key)
      const startIndex = findNextIndex(keyHash, sortedHashes)
      const nodes = new Set<StorageNodeId>()
      let currentIndex = startIndex
      const uniqueNodes = getUniqueNodes(ring)

      while (nodes.size < count && nodes.size < uniqueNodes.length) {
        const nodeId = ring.get(sortedHashes[currentIndex])
        if (nodeId) nodes.add(nodeId)
        currentIndex = (currentIndex + 1) % sortedHashes.length
      }

      return Array.from(nodes)
    },

    getNodes: () => getUniqueNodes(ring),
  }
}

const createConsistentHashRingFromState = (
  ring: Map<number, StorageNodeId>,
  sortedHashes: number[],
  virtualNodes: number
): ConsistentHashRing => ({
  ring,
  sortedHashes,
  virtualNodes,
  addNode: createConsistentHashRing(virtualNodes).addNode,
  removeNode: createConsistentHashRing(virtualNodes).removeNode,
  getNode: createConsistentHashRing(virtualNodes).getNode,
  getReplicationNodes: createConsistentHashRing(virtualNodes).getReplicationNodes,
  getNodes: createConsistentHashRing(virtualNodes).getNodes,
})
```

### Database Connection Pool

```typescript
// =============================================================================
// データベース接続プール
// =============================================================================

// 接続プール管理
export const DatabaseConnectionPool = Context.GenericTag<{
  readonly acquire: () => Effect.Effect<DatabaseConnection, ConnectionError>
  readonly release: (connection: DatabaseConnection) => Effect.Effect<void>
  readonly execute: <T>(query: DatabaseQuery<T>) => Effect.Effect<T, QueryError>
  readonly transaction: <T>(operations: ReadonlyArray<DatabaseOperation>) => Effect.Effect<T, TransactionError>
  readonly getPoolStats: () => Effect.Effect<PoolStats>
}>()('DatabaseConnectionPool')

export const DatabaseConnectionPoolLive = Layer.scoped(
  DatabaseConnectionPool,
  Effect.gen(function* () {
    const poolConfig = {
      minConnections: 5,
      maxConnections: 20,
      acquireTimeoutMs: 30000,
      idleTimeoutMs: 300000,
      maxLifetimeMs: 3600000,
    }

    // 接続プールの実装
    const availableConnections = yield* Queue.bounded<DatabaseConnection>(poolConfig.maxConnections)
    const busyConnections = yield* Ref.make(new Set<DatabaseConnection>())
    const connectionCount = yield* Ref.make(0)
    const poolStats = yield* Ref.make<PoolStats>({
      totalConnections: 0,
      availableConnections: 0,
      busyConnections: 0,
      totalAcquired: 0,
      totalReleased: 0,
      averageAcquireTime: 0,
    })

    // 初期接続を作成
    yield* Effect.all(
      Array.from({ length: poolConfig.minConnections }, () =>
        createConnection().pipe(
          Effect.flatMap((conn) => Queue.offer(availableConnections, conn)),
          Effect.tap(() => Ref.update(connectionCount, (c) => c + 1))
        )
      )
    )

    // 定期的なヘルスチェック
    yield* Effect.forkDaemon(
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep(Duration.seconds(30))

          // アイドル接続のヘルスチェック
          const connections = yield* Queue.takeAll(availableConnections)
          const healthyConnections = yield* Effect.all(
            Array.fromIterable(connections).map((conn) =>
              healthCheckConnection(conn).pipe(Effect.map((healthy) => ({ connection: conn, healthy })))
            )
          )

          // 健康な接続のみプールに戻す
          for (const { connection, healthy } of healthyConnections) {
            if (healthy) {
              yield* Queue.offer(availableConnections, connection)
            } else {
              yield* closeConnection(connection)
              yield* Ref.update(connectionCount, (c) => c - 1)
            }
          }

          // 必要に応じて新しい接続を作成
          const currentCount = yield* Ref.get(connectionCount)
          if (currentCount < poolConfig.minConnections) {
            const needed = poolConfig.minConnections - currentCount
            yield* Effect.all(
              Array.from({ length: needed }, () =>
                createConnection().pipe(
                  Effect.flatMap((conn) => Queue.offer(availableConnections, conn)),
                  Effect.tap(() => Ref.update(connectionCount, (c) => c + 1))
                )
              )
            )
          }
        }
      })
    )

    return {
      acquire: () =>
        Effect.gen(function* () {
          const startTime = Date.now()

          const connection = yield* Queue.take(availableConnections).pipe(
            Effect.timeout(Duration.millis(poolConfig.acquireTimeoutMs)),
            Effect.catchTag('TimeoutException', () =>
              Effect.fail(
                new ConnectionError({
                  message: 'Connection acquire timeout',
                  timeoutMs: poolConfig.acquireTimeoutMs,
                })
              )
            )
          )

          yield* Ref.update(busyConnections, (busy) => new Set([...busy, connection]))

          // 統計情報更新
          const acquireTime = Date.now() - startTime
          yield* Ref.update(poolStats, (stats) => ({
            ...stats,
            totalAcquired: stats.totalAcquired + 1,
            averageAcquireTime:
              (stats.averageAcquireTime * (stats.totalAcquired - 1) + acquireTime) / stats.totalAcquired,
          }))

          return connection
        }),

      release: (connection) =>
        Effect.gen(function* () {
          yield* Ref.update(busyConnections, (busy) => {
            const newBusy = new Set(busy)
            newBusy.delete(connection)
            return newBusy
          })

          yield* Queue.offer(availableConnections, connection)

          yield* Ref.update(poolStats, (stats) => ({
            ...stats,
            totalReleased: stats.totalReleased + 1,
          }))
        }),

      execute: (query) =>
        Effect.gen(function* () {
          const connection = yield* DatabaseConnectionPool.pipe(Effect.flatMap((pool) => pool.acquire()))

          const result = yield* executeQuery(connection, query).pipe(
            Effect.ensuring(DatabaseConnectionPool.pipe(Effect.flatMap((pool) => pool.release(connection))))
          )

          return result
        }),

      transaction: (operations) =>
        Effect.gen(function* () {
          const connection = yield* DatabaseConnectionPool.pipe(Effect.flatMap((pool) => pool.acquire()))

          const result = yield* Effect.gen(function* () {
            yield* beginTransaction(connection)

            const results = yield* Effect.all(
              operations.map((op) => executeOperation(connection, op)),
              { discard: true }
            ).pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  yield* rollbackTransaction(connection)
                  yield* Effect.fail(error)
                })
              )
            )

            yield* commitTransaction(connection)
            return results
          }).pipe(Effect.ensuring(DatabaseConnectionPool.pipe(Effect.flatMap((pool) => pool.release(connection)))))

          return result
        }),

      getPoolStats: () =>
        Effect.gen(function* () {
          const stats = yield* Ref.get(poolStats)
          const busy = yield* Ref.get(busyConnections)
          const availableCount = yield* Queue.size(availableConnections)

          return {
            ...stats,
            totalConnections: yield* Ref.get(connectionCount),
            availableConnections: availableCount,
            busyConnections: busy.size,
          }
        }),
    }
  })
)
```

### Message Queue System

```typescript
// =============================================================================
// メッセージキューシステム
// =============================================================================

// メッセージキューインターフェース
export const MessageQueueAdapter = Context.GenericTag<{
  readonly publish: <T>(params: {
    topic: string
    message: T
    options?: PublishOptions
  }) => Effect.Effect<MessageId, PublishError>

  readonly subscribe: <T>(params: {
    topic: string
    consumer: string
    handler: (message: Message<T>) => Effect.Effect<void, MessageHandlerError>
    options?: SubscribeOptions
  }) => Effect.Effect<SubscriptionId, SubscribeError>

  readonly unsubscribe: (subscriptionId: SubscriptionId) => Effect.Effect<void, UnsubscribeError>

  readonly createTopic: (params: { name: string; config: TopicConfig }) => Effect.Effect<void, TopicCreationError>

  readonly getQueueStats: (topic: string) => Effect.Effect<QueueStats, StatsError>
}>()('MessageQueueAdapter')

// Redis Streams実装
export const RedisMessageQueueAdapterLive = Layer.effect(
  MessageQueueAdapter,
  Effect.gen(function* () {
    const redis = yield* RedisClient
    const subscriptions = yield* Ref.make(new Map<SubscriptionId, SubscriptionHandle>())

    return {
      publish: (params) =>
        Effect.gen(function* () {
          const messageId = generateMessageId()
          const serializedMessage = JSON.stringify({
            id: messageId,
            payload: params.message,
            timestamp: Date.now(),
            ...params.options?.metadata,
          })

          yield* redis.xadd(params.topic, messageId, 'data', serializedMessage)

          return messageId
        }),

      subscribe: (params) =>
        Effect.gen(function* () {
          const subscriptionId = generateSubscriptionId()

          // Consumer Group作成
          yield* redis.xgroup('CREATE', params.topic, params.consumer, '$', 'MKSTREAM').pipe(
            Effect.catchTag('RedisError', () => Effect.void) // グループが既に存在する場合
          )

          // メッセージ処理ファイバー
          const processingFiber = yield* Effect.forkDaemon(
            Stream.repeatEffect(
              redis
                .xreadgroup(
                  'GROUP',
                  params.consumer,
                  `consumer-${subscriptionId}`,
                  'COUNT',
                  '10',
                  'BLOCK',
                  '1000',
                  'STREAMS',
                  params.topic,
                  '>'
                )
                .pipe(
                  Effect.flatMap((results) =>
                    Effect.all(
                      results.map(([topic, messages]) =>
                        Effect.all(
                          messages.map(([messageId, fields]) =>
                            Effect.gen(function* () {
                              const messageData = JSON.parse(fields.data)

                              yield* params
                                .handler({
                                  id: messageId,
                                  topic,
                                  payload: messageData.payload,
                                  timestamp: messageData.timestamp,
                                  metadata: messageData.metadata || {},
                                })
                                .pipe(
                                  Effect.catchAll((error) =>
                                    Effect.gen(function* () {
                                      // エラー処理: デッドレターキューまたはリトライ
                                      yield* Effect.logError(`Message handling failed: ${error.message}`)

                                      if (shouldRetry(error, messageData)) {
                                        yield* scheduleRetry(params.topic, messageId, messageData)
                                      } else {
                                        yield* moveToDeadLetterQueue(params.topic, messageId, messageData, error)
                                      }
                                    })
                                  ),
                                  Effect.tap(() =>
                                    // メッセージ確認
                                    redis.xack(params.topic, params.consumer, messageId)
                                  )
                                )
                            })
                          )
                        )
                      )
                    )
                  ),
                  Effect.catchAll((error) => Effect.logError(`Message consumption error: ${error.message}`))
                )
            ).pipe(Stream.runDrain)
          )

          const handle: SubscriptionHandle = {
            id: subscriptionId,
            topic: params.topic,
            consumer: params.consumer,
            fiber: processingFiber,
          }

          yield* Ref.update(subscriptions, (subs) => new Map([...subs, [subscriptionId, handle]]))

          return subscriptionId
        }),

      unsubscribe: (subscriptionId) =>
        Effect.gen(function* () {
          const subs = yield* Ref.get(subscriptions)
          const handle = subs.get(subscriptionId)

          if (!handle) {
            yield* Effect.fail(
              new UnsubscribeError({
                message: 'Subscription not found',
                subscriptionId,
              })
            )
          }

          // ファイバーを停止
          yield* Fiber.interrupt(handle.fiber)

          // 購読を削除
          yield* Ref.update(subscriptions, (subs) => {
            const newSubs = new Map(subs)
            newSubs.delete(subscriptionId)
            return newSubs
          })
        }),

      createTopic: (params) =>
        Effect.gen(function* () {
          // Redis Streamsでは明示的にトピック作成は不要だが、
          // 設定に応じて初期化処理を行う
          if (params.config.retentionMs) {
            yield* redis.xtrim(params.name, 'MAXLEN', '~', params.config.maxMessages || 10000).pipe(
              Effect.catchAll(() => Effect.void) // ストリームが存在しない場合
            )
          }
        }),

      getQueueStats: (topic) =>
        Effect.gen(function* () {
          const info = yield* redis.xinfo('STREAM', topic).pipe(
            Effect.catchTag('RedisError', () =>
              Effect.succeed({
                length: 0,
                'radix-tree-keys': 0,
                'radix-tree-nodes': 0,
                groups: 0,
                'last-generated-id': '0-0',
                'first-entry': null,
                'last-entry': null,
              })
            )
          )

          return {
            messageCount: info.length,
            consumerGroups: info.groups,
            firstMessageId: info['first-entry']?.[0] || null,
            lastMessageId: info['last-generated-id'],
          }
        }),
    }
  })
)

// WebSocket-based実装（リアルタイムプッシュ用）
export const WebSocketMessageQueueAdapterLive = Layer.effect(
  MessageQueueAdapter,
  Effect.gen(function* () {
    const connections = yield* Ref.make(new Map<string, WebSocket>())
    const topicSubscribers = yield* Ref.make(new Map<string, Set<string>>())

    return {
      publish: (params) =>
        Effect.gen(function* () {
          const messageId = generateMessageId()
          const subscribers = yield* Ref.get(topicSubscribers)
          const topicSubs = subscribers.get(params.topic) || new Set()

          const conns = yield* Ref.get(connections)
          const message = {
            id: messageId,
            topic: params.topic,
            payload: params.message,
            timestamp: Date.now(),
          }

          // 購読者にメッセージをプッシュ
          yield* Effect.all(
            Array.from(topicSubs).map((connectionId) => {
              const ws = conns.get(connectionId)
              if (ws && ws.readyState === WebSocket.OPEN) {
                return Effect.promise(() => {
                  ws.send(JSON.stringify(message))
                  return Promise.resolve()
                })
              }
              return Effect.void
            })
          )

          return messageId
        }),

      subscribe: (params) =>
        Effect.gen(function* () {
          const subscriptionId = generateSubscriptionId()

          // WebSocketハンドラーの設定は省略（実装依存）
          // 実際の実装では、WebSocket接続管理とメッセージハンドリングを含める

          return subscriptionId
        }),

      // 他のメソッドも実装...
      unsubscribe: (subscriptionId) => Effect.void,
      createTopic: (params) => Effect.void,
      getQueueStats: (topic) =>
        Effect.succeed({
          messageCount: 0,
          consumerGroups: 0,
          firstMessageId: null,
          lastMessageId: null,
        }),
    }
  })
)
```

### Advanced WebGL Rendering

```typescript
// =============================================================================
// 高度なWebGLレンダリング実装
// =============================================================================

// シェーダーマネジメント
export const ShaderManager = Context.GenericTag<{
  readonly compileShader: (params: {
    type: 'vertex' | 'fragment'
    source: string
    defines?: Record<string, string | number>
  }) => Effect.Effect<ShaderId, ShaderCompilationError>

  readonly createProgram: (params: {
    vertexShaderId: ShaderId
    fragmentShaderId: ShaderId
    attributes?: Record<string, number>
  }) => Effect.Effect<ProgramId, ProgramLinkError>

  readonly useProgram: (programId: ProgramId) => Effect.Effect<void, RenderError>

  readonly setUniforms: (params: {
    programId: ProgramId
    uniforms: Record<string, UniformValue>
  }) => Effect.Effect<void, RenderError>

  readonly deleteShader: (shaderId: ShaderId) => Effect.Effect<void>
}>()('ShaderManager')

export const ShaderManagerLive = Layer.effect(
  ShaderManager,
  Effect.gen(function* () {
    const gl = yield* WebGLContext
    const shaderCache = yield* Ref.make(new Map<string, ShaderId>())
    const programCache = yield* Ref.make(new Map<string, ProgramId>())

    return {
      compileShader: (params) =>
        Effect.gen(function* () {
          // シェーダーキャッシュをチェック
          const cacheKey = `${params.type}-${params.source}-${JSON.stringify(params.defines || {})}`
          const cache = yield* Ref.get(shaderCache)
          const cached = cache.get(cacheKey)

          if (cached) {
            return cached
          }

          // #defineマクロを適用
          let processedSource = params.source
          if (params.defines) {
            const defineStatements = Object.entries(params.defines)
              .map(([key, value]) => `#define ${key} ${value}`)
              .join('\n')
            processedSource = `${defineStatements}\n${params.source}`
          }

          const shaderType = params.type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER

          const shader = gl.createShader(shaderType)
          if (!shader) {
            yield* Effect.fail(
              new ShaderCompilationError({
                type: params.type,
                message: 'Failed to create shader object',
              })
            )
          }

          gl.shaderSource(shader, processedSource)
          gl.compileShader(shader)

          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader)
            gl.deleteShader(shader)
            yield* Effect.fail(
              new ShaderCompilationError({
                type: params.type,
                message: error || 'Unknown compilation error',
                source: processedSource,
              })
            )
          }

          const shaderId = generateShaderId()
          yield* Ref.update(shaderCache, (cache) => new Map([...cache, [cacheKey, shaderId]]))

          return shaderId
        }),

      createProgram: (params) =>
        Effect.gen(function* () {
          const cacheKey = `${params.vertexShaderId}-${params.fragmentShaderId}`
          const cache = yield* Ref.get(programCache)
          const cached = cache.get(cacheKey)

          if (cached) {
            return cached
          }

          const program = gl.createProgram()
          if (!program) {
            yield* Effect.fail(
              new ProgramLinkError({
                message: 'Failed to create program object',
              })
            )
          }

          // シェーダーをアタッチ
          const vertexShader = yield* getShaderById(params.vertexShaderId)
          const fragmentShader = yield* getShaderById(params.fragmentShaderId)

          gl.attachShader(program, vertexShader)
          gl.attachShader(program, fragmentShader)

          // 属性位置をバインド
          if (params.attributes) {
            Object.entries(params.attributes).forEach(([name, location]) => {
              gl.bindAttribLocation(program, location, name)
            })
          }

          gl.linkProgram(program)

          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program)
            gl.deleteProgram(program)
            yield* Effect.fail(
              new ProgramLinkError({
                message: error || 'Unknown linking error',
                vertexShaderId: params.vertexShaderId,
                fragmentShaderId: params.fragmentShaderId,
              })
            )
          }

          const programId = generateProgramId()
          yield* Ref.update(programCache, (cache) => new Map([...cache, [cacheKey, programId]]))

          return programId
        }),

      useProgram: (programId) =>
        Effect.gen(function* () {
          const program = yield* getProgramById(programId)
          gl.useProgram(program)
        }),

      setUniforms: (params) =>
        Effect.gen(function* () {
          const program = yield* getProgramById(params.programId)

          Object.entries(params.uniforms).forEach(([name, value]) => {
            const location = gl.getUniformLocation(program, name)
            if (location === null) return // ユニフォームが存在しない

            // 型に応じてユニフォームを設定
            if (typeof value === 'number') {
              gl.uniform1f(location, value)
            } else if (Array.isArray(value)) {
              if (value.length === 2) {
                gl.uniform2fv(location, value)
              } else if (value.length === 3) {
                gl.uniform3fv(location, value)
              } else if (value.length === 4) {
                gl.uniform4fv(location, value)
              } else if (value.length === 16) {
                gl.uniformMatrix4fv(location, false, value)
              }
            }
          })
        }),

      deleteShader: (shaderId) =>
        Effect.gen(function* () {
          const shader = yield* getShaderById(shaderId)
          gl.deleteShader(shader)

          // キャッシュからも削除
          yield* Ref.update(shaderCache, (cache) => {
            const newCache = new Map(cache)
            for (const [key, id] of cache.entries()) {
              if (id === shaderId) {
                newCache.delete(key)
              }
            }
            return newCache
          })
        }),
    }
  })
)

// ジオメトリバッファ管理
export const GeometryBufferManager = Context.GenericTag<{
  readonly createBuffer: (params: {
    type: 'vertex' | 'index'
    data: Float32Array | Uint16Array
    usage: 'static' | 'dynamic' | 'stream'
  }) => Effect.Effect<BufferId, BufferError>

  readonly updateBuffer: (params: {
    bufferId: BufferId
    data: Float32Array | Uint16Array
    offset?: number
  }) => Effect.Effect<void, BufferError>

  readonly bindBuffer: (params: { bufferId: BufferId; target: 'vertex' | 'index' }) => Effect.Effect<void, BufferError>

  readonly createVertexArray: (params: {
    attributes: ReadonlyArray<{
      bufferId: BufferId
      index: number
      size: number
      type: 'float' | 'int'
      normalized?: boolean
      stride?: number
      offset?: number
    }>
    indexBufferId?: BufferId
  }) => Effect.Effect<VertexArrayId, BufferError>

  readonly deleteBuffer: (bufferId: BufferId) => Effect.Effect<void>
}>()('GeometryBufferManager')

export const GeometryBufferManagerLive = Layer.effect(
  GeometryBufferManager,
  Effect.gen(function* () {
    const gl = yield* WebGLContext
    const bufferRegistry = yield* Ref.make(new Map<BufferId, WebGLBuffer>())
    const vertexArrayRegistry = yield* Ref.make(new Map<VertexArrayId, WebGLVertexArrayObject>())

    return {
      createBuffer: (params) =>
        Effect.gen(function* () {
          const buffer = gl.createBuffer()
          if (!buffer) {
            yield* Effect.fail(
              new BufferError({
                message: 'Failed to create WebGL buffer',
              })
            )
          }

          const target = params.type === 'vertex' ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER

          const usage =
            params.usage === 'static' ? gl.STATIC_DRAW : params.usage === 'dynamic' ? gl.DYNAMIC_DRAW : gl.STREAM_DRAW

          gl.bindBuffer(target, buffer)
          gl.bufferData(target, params.data, usage)
          gl.bindBuffer(target, null)

          const bufferId = generateBufferId()
          yield* Ref.update(bufferRegistry, (registry) => new Map([...registry, [bufferId, buffer]]))

          return bufferId
        }),

      updateBuffer: (params) =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(bufferRegistry)
          const buffer = registry.get(params.bufferId)

          if (!buffer) {
            yield* Effect.fail(
              new BufferError({
                message: 'Buffer not found',
                bufferId: params.bufferId,
              })
            )
          }

          gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

          if (params.offset !== undefined) {
            gl.bufferSubData(gl.ARRAY_BUFFER, params.offset, params.data)
          } else {
            gl.bufferData(gl.ARRAY_BUFFER, params.data, gl.DYNAMIC_DRAW)
          }

          gl.bindBuffer(gl.ARRAY_BUFFER, null)
        }),

      bindBuffer: (params) =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(bufferRegistry)
          const buffer = registry.get(params.bufferId)

          if (!buffer) {
            yield* Effect.fail(
              new BufferError({
                message: 'Buffer not found',
                bufferId: params.bufferId,
              })
            )
          }

          const target = params.target === 'vertex' ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER

          gl.bindBuffer(target, buffer)
        }),

      createVertexArray: (params) =>
        Effect.gen(function* () {
          const vao = gl.createVertexArray()
          if (!vao) {
            yield* Effect.fail(
              new BufferError({
                message: 'Failed to create vertex array object',
              })
            )
          }

          gl.bindVertexArray(vao)

          const bufferRegistry = yield* Ref.get(bufferRegistry)

          // 属性を設定
          for (const attr of params.attributes) {
            const buffer = bufferRegistry.get(attr.bufferId)
            if (!buffer) {
              yield* Effect.fail(
                new BufferError({
                  message: 'Attribute buffer not found',
                  bufferId: attr.bufferId,
                })
              )
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.enableVertexAttribArray(attr.index)

            const type = attr.type === 'float' ? gl.FLOAT : gl.INT
            gl.vertexAttribPointer(
              attr.index,
              attr.size,
              type,
              attr.normalized || false,
              attr.stride || 0,
              attr.offset || 0
            )
          }

          // インデックスバッファを設定
          if (params.indexBufferId) {
            const indexBuffer = bufferRegistry.get(params.indexBufferId)
            if (!indexBuffer) {
              yield* Effect.fail(
                new BufferError({
                  message: 'Index buffer not found',
                  bufferId: params.indexBufferId,
                })
              )
            }
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
          }

          gl.bindVertexArray(null)

          const vaoId = generateVertexArrayId()
          yield* Ref.update(vertexArrayRegistry, (registry) => new Map([...registry, [vaoId, vao]]))

          return vaoId
        }),

      deleteBuffer: (bufferId) =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(bufferRegistry)
          const buffer = registry.get(bufferId)

          if (buffer) {
            gl.deleteBuffer(buffer)
            yield* Ref.update(bufferRegistry, (registry) => {
              const newRegistry = new Map(registry)
              newRegistry.delete(bufferId)
              return newRegistry
            })
          }
        }),
    }
  })
)
```

## Implementation Examples

### Layer構成

```typescript
// Infrastructure Layer実装
export const InfrastructureLayer = Layer.mergeAll(
  WorldStorageAdapterLive,
  ChunkStorageAdapterLive,
  PlayerStorageAdapterLive,
  StorageClusterAdapterLive,
  DatabaseConnectionPoolLive,
  RedisMessageQueueAdapterLive,
  WebGLRendererAdapterLive,
  ShaderManagerLive,
  GeometryBufferManagerLive,
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
export const WorldStorageAdapterLive = Layer.succeed(WorldStorageAdapter, {
  save: (params) =>
    Effect.gen(function* () {
      const db = yield* IndexedDBService
      yield* db.put('worlds', params.data, params.worldId)
    }),

  load: (worldId) =>
    Effect.gen(function* () {
      const db = yield* IndexedDBService
      const data = yield* db.get('worlds', worldId)
      if (!data) {
        yield* Effect.fail(new NotFoundError({ worldId }))
      }
      return data
    }),

  delete: (worldId) =>
    Effect.gen(function* () {
      const db = yield* IndexedDBService
      yield* db.delete('worlds', worldId)
    }),

  list: () =>
    Effect.gen(function* () {
      const db = yield* IndexedDBService
      const keys = yield* db.getAllKeys('worlds')
      const metadataList = yield* Effect.all(keys.map((key) => db.get('world-metadata', key)))
      return metadataList.filter(Boolean)
    }),

  exists: (worldId) =>
    Effect.gen(function* () {
      const db = yield* IndexedDBService
      const data = yield* db.get('worlds', worldId).pipe(Effect.option)
      return Option.isSome(data)
    }),
})
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
    onRetry?: (error: E, attempt: number) => Effect.Effect<void>
  }
) => {
  const config = {
    maxAttempts: 3,
    baseDelay: Duration.millis(100),
    maxDelay: Duration.seconds(5),
    retryableErrors: ['NetworkError', 'StorageError', 'RendererError'],
    ...options,
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
        Schedule.recurs(config.maxAttempts - 1),
        Schedule.tapInput((error, attempt) =>
          config.onRetry
            ? config.onRetry(error, attempt)
            : Effect.logWarn(`Retrying operation, attempt ${attempt}: ${JSON.stringify(error)}`)
        )
      )
    ),
    Effect.tapError((error) => Effect.logError(`Retry exhausted for effect. Final error: ${JSON.stringify(error)}`))
  )
}

// 使用例（Resource管理との組み合わせ）
export const saveWithRetry = (worldId: string, data: WorldData) =>
  Effect.gen(function* () {
    const adapter = yield* WorldStorageAdapter

    return yield* withRetry(adapter.save({ worldId, data }), {
      maxAttempts: 5,
      baseDelay: Duration.millis(200),
      maxDelay: Duration.seconds(10),
      retryableErrors: ['StorageError', 'FileSystemError'],
      onRetry: (error, attempt) => Effect.logWarn(`World save retry ${attempt} for ${worldId}: ${error.message}`),
    }).pipe(
      Effect.tapBoth({
        onFailure: (error) => Effect.logError(`World save failed permanently: ${error.message}`),
        onSuccess: () => Effect.logInfo(`World ${worldId} saved successfully after retry`),
      })
    )
  })
```

### バッチ処理パターン

```typescript
// チャンクの効率的なバッチ保存
export const saveChunksBatched = (worldId: string, chunks: ReadonlyArray<ChunkData>) =>
  Effect.gen(function* () {
    const adapter = yield* ChunkStorageAdapter

    // チャンクを領域ごとにグループ化
    const grouped = pipe(
      chunks,
      Array.groupBy((chunk) => `${Math.floor(chunk.x / 32)}_${Math.floor(chunk.z / 32)}`)
    )

    // 並列保存（コンカレンシー制限付き）
    yield* Effect.all(
      Object.entries(grouped).map(([region, regionChunks]) =>
        adapter
          .saveBatch({ worldId, chunks: regionChunks })
          .pipe(Effect.retry(Schedule.recurs(3)), Effect.timeout(Duration.seconds(30)))
      ),
      { concurrency: 4, batching: true }
    )
  })

// ストリーミングバッチ処理
export const streamBatchProcessor = <T, R>(params: {
  source: Stream.Stream<T, never>
  batchSize: number
  processor: (batch: ReadonlyArray<T>) => Effect.Effect<void, never, R>
}) => {
  return params.source.pipe(
    Stream.grouped(params.batchSize),
    Stream.mapEffect((batch) => params.processor(Array.fromIterable(batch))),
    Stream.runDrain
  )
}
```

```

```
