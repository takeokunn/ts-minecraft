---
title: "07 Integration Patterns"
description: "07 Integration Patternsに関する詳細な説明とガイド。"
category: "reference"
difficulty: "advanced"
tags: ['typescript', 'minecraft']
prerequisites: ['basic-typescript', 'effect-ts-fundamentals']
estimated_reading_time: "25分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# System Integration Patterns

Effect-TSを使用したシステム間統合パターン。外部システム、サービス間通信、データ永続化、イベント処理などの統合ポイントにおける実装パターンを提供します。

## Pattern 1: Service-to-Service Communication

**使用場面**: 異なるドメインサービス間の通信

**実装**:
```typescript
// 通信エラーの定義
export class ServiceCommunicationError extends Schema.TaggedError("ServiceCommunicationError")<{
  readonly sourceService: string
  readonly targetService: string
  readonly operation: string
  readonly reason: string
  readonly timestamp: number
}> {}

// プレイヤーサービス → インベントリサービス間通信
export interface PlayerInventoryBridge {
  readonly syncInventoryChanges: (playerId: string, changes: InventoryChange[]) => Effect.Effect<void, ServiceCommunicationError>
  readonly requestInventoryState: (playerId: string) => Effect.Effect<InventoryState, ServiceCommunicationError>
}

export const PlayerInventoryBridge = Context.GenericTag<PlayerInventoryBridge>("@minecraft/PlayerInventoryBridge")

const makePlayerInventoryBridge = Effect.gen(function* () {
  const playerService = yield* PlayerService
  const inventoryService = yield* InventoryService
  const eventBus = yield* EventBusService

  return PlayerInventoryBridge.of({
    syncInventoryChanges: (playerId, changes) => Effect.gen(function* () {
      // プレイヤーの存在確認
      const player = yield* playerService.getPlayer(playerId).pipe(
        Effect.catchTag("PlayerNotFoundError", (error) =>
          Effect.fail(new ServiceCommunicationError({
            sourceService: "PlayerService",
            targetService: "InventoryService",
            operation: "syncInventoryChanges",
            reason: `Player not found: ${error.message}`,
            timestamp: Date.now()
          }))
        )
      )

      // インベントリ更新と並行してイベント発行
      yield* Effect.all([
        inventoryService.applyChanges(playerId, changes),
        eventBus.publish({
          _tag: "InventoryChanged",
          playerId,
          changes,
          timestamp: Date.now()
        })
      ], { concurrency: 2 })
    }),

    requestInventoryState: (playerId) => Effect.gen(function* () {
      return yield* inventoryService.getInventoryState(playerId).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new ServiceCommunicationError({
            sourceService: "PlayerService",
            targetService: "InventoryService",
            operation: "requestInventoryState",
            reason: error.message,
            timestamp: Date.now()
          }))
        )
      )
    })
  })
})

export const PlayerInventoryBridgeLive = Layer.effect(PlayerInventoryBridge, makePlayerInventoryBridge)
```

## Pattern 2: Event-Driven Architecture

**使用場面**: 疎結合なシステム間でのイベント駆動通信

**実装**:
```typescript
// イベント定義
const GameEventSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("PlayerMoved"),
    playerId: Schema.String,
    oldPosition: PositionSchema,
    newPosition: PositionSchema,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("BlockPlaced"),
    playerId: Schema.String,
    position: PositionSchema,
    blockType: Schema.String,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("ChunkGenerated"),
    coordinate: ChunkCoordinateSchema,
    timestamp: Schema.Number
  })
)

type GameEvent = Schema.Schema.Type<typeof GameEventSchema>

export class EventBusError extends Schema.TaggedError("EventBusError")<{
  readonly operation: string
  readonly reason: string
  readonly eventType?: string
  readonly timestamp: number
}> {}

export interface EventBusService {
  readonly publish: (event: GameEvent) => Effect.Effect<void, EventBusError>
  readonly subscribe: <T extends GameEvent["_tag"]>(
    eventType: T,
    handler: (event: Extract<GameEvent, { _tag: T }>) => Effect.Effect<void, never>
  ) => Effect.Effect<void, EventBusError>
}

export const EventBusService = Context.GenericTag<EventBusService>("@minecraft/EventBusService")

const makeEventBusService = Effect.gen(function* () {
  const subscribers = yield* Ref.make(new Map<string, Array<(event: GameEvent) => Effect.Effect<void, never>>>())

  return EventBusService.of({
    publish: (event) => Effect.gen(function* () {
      const currentSubscribers = yield* Ref.get(subscribers)
      const eventHandlers = currentSubscribers.get(event._tag) || []

      if (eventHandlers.length === 0) {
        return
      }

      // 全サブスクライバーに並列でイベント配信
      yield* Effect.forEach(eventHandlers,
        (handler) => handler(event).pipe(
          Effect.catchAll((error) =>
            Effect.logError(`Event handler failed for ${event._tag}`, error)
          )
        ),
        { concurrency: "unbounded" }
      )
    }),

    subscribe: (eventType, handler) => Effect.gen(function* () {
      yield* Ref.update(subscribers, (current) => {
        const existing = current.get(eventType) || []
        return new Map(current).set(eventType, [...existing, handler as any])
      })
    })
  })
})

export const EventBusServiceLive = Layer.effect(EventBusService, makeEventBusService)

// イベントハンドラーの実装例
const chunkEventHandler = Effect.gen(function* () {
  const eventBus = yield* EventBusService
  const renderService = yield* RenderService

  yield* eventBus.subscribe("BlockPlaced", (event) => Effect.gen(function* () {
    const chunkCoord = worldToChunk(event.position)
    yield* renderService.markChunkForRegeneration(chunkCoord)
    yield* Effect.logInfo(`Chunk ${chunkCoord.x},${chunkCoord.z} marked for regeneration due to block placement`)
  }))

  yield* eventBus.subscribe("ChunkGenerated", (event) => Effect.gen(function* () {
    yield* renderService.generateMeshForChunk(event.coordinate)
    yield* Effect.logInfo(`Mesh generated for chunk ${event.coordinate.x},${event.coordinate.z}`)
  }))
})
```

## Pattern 3: Message Queue Integration

**使用場面**: 非同期処理とメッセージキューイング

**実装**:
```typescript
export class MessageQueueError extends Schema.TaggedError("MessageQueueError")<{
  readonly operation: string
  readonly queueName: string
  readonly reason: string
  readonly timestamp: number
}> {}

const MessageSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  payload: Schema.Unknown,
  priority: Schema.Number.pipe(Schema.int(), Schema.between(0, 10)),
  retryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxRetries: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  createdAt: Schema.Number,
  processAt: Schema.Number
})

type Message = Schema.Schema.Type<typeof MessageSchema>

export interface MessageQueueService {
  readonly enqueue: (queueName: string, message: Omit<Message, "id" | "createdAt">) => Effect.Effect<string, MessageQueueError>
  readonly dequeue: (queueName: string) => Effect.Effect<Option.Option<Message>, MessageQueueError>
  readonly ack: (queueName: string, messageId: string) => Effect.Effect<void, MessageQueueError>
  readonly nack: (queueName: string, messageId: string, delay?: number) => Effect.Effect<void, MessageQueueError>
}

export const MessageQueueService = Context.GenericTag<MessageQueueService>("@minecraft/MessageQueueService")

const makeMessageQueueService = Effect.gen(function* () {
  const queues = yield* Ref.make(new Map<string, Queue.Queue<Message>>())

  return MessageQueueService.of({
    enqueue: (queueName, messageData) => Effect.gen(function* () {
      const messageId = crypto.randomUUID()
      const message: Message = {
        ...messageData,
        id: messageId,
        createdAt: Date.now()
      }

      yield* Ref.update(queues, (current) => {
        const queue = current.get(queueName) || Queue.empty<Message>()
        const updatedQueue = Queue.enqueue(queue, message)
        return new Map(current).set(queueName, updatedQueue)
      })

      return messageId
    }),

    dequeue: (queueName) => Effect.gen(function* () {
      const currentQueues = yield* Ref.get(queues)
      const queue = currentQueues.get(queueName)

      if (!queue || Queue.isEmpty(queue)) {
        return Option.none()
      }

      const dequeued = Queue.dequeue(queue)
      yield* Ref.update(queues, (current) =>
        new Map(current).set(queueName, dequeued[1])
      )

      return Option.some(dequeued[0])
    }),

    ack: (queueName, messageId) => Effect.gen(function* () {
      yield* Effect.logDebug(`Message ${messageId} acknowledged from queue ${queueName}`)
    }),

    nack: (queueName, messageId, delay = 5000) => Effect.gen(function* () {
      yield* Effect.sleep(Duration.millis(delay))
      yield* Effect.logWarn(`Message ${messageId} requeued to ${queueName} after ${delay}ms delay`)
    })
  })
})

export const MessageQueueServiceLive = Layer.effect(MessageQueueService, makeMessageQueueService)

// 使用例: チャンク生成の非同期処理
const enqueueChunkGeneration = (coordinates: ChunkCoordinate[]) => Effect.gen(function* () {
  const messageQueue = yield* MessageQueueService

  yield* Effect.forEach(coordinates, (coord) =>
    messageQueue.enqueue("chunk-generation", {
      type: "GenerateChunk",
      payload: coord,
      priority: 5,
      retryCount: 0,
      maxRetries: 3,
      processAt: Date.now()
    }),
    { concurrency: 10 }
  )
})
```

## Pattern 4: HTTP Client Integration with Effect

**使用場面**: REST API、WebSocketなどの外部システム連携

**実装**:
```typescript
import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import { Config, Brand, Chunk } from "effect"
import { Schedule, Duration, Queue, Stream, Fiber } from "effect"

// HTTP クライアント設定のブランド型
type ApiConfig = {
  readonly baseUrl: string
  readonly apiKey: string
  readonly timeout: Duration.Duration
  readonly retryPolicy: {
    readonly maxRetries: number
    readonly baseDelay: Duration.Duration
  }
}

// API レスポンスのブランド型
type PlayerDataResponse = {
  readonly playerId: string
  readonly position: { x: number, y: number, z: number }
  readonly inventory: ReadonlyArray<{ itemId: string, count: number }>
} & Brand.Brand<"PlayerDataResponse">

export class HttpIntegrationError extends Schema.TaggedError("HttpIntegrationError")<{
  readonly endpoint: string
  readonly method: string
  readonly statusCode?: number
  readonly message: string
  readonly timestamp: number
}> {}

// HTTP クライアント設定
const ApiConfigSchema = Schema.Struct({
  baseUrl: Schema.String.pipe(
    Schema.startsWith("http"),
    Schema.message(() => "Base URL must start with http or https")
  ),
  apiKey: Schema.String.pipe(
    Schema.minLength(1),
    Schema.message(() => "API key is required")
  ),
  timeout: Schema.transformOrFail(
    Schema.Number,
    Schema.instanceOf(Duration.Duration),
    {
      strict: true,
      decode: (ms) => Effect.succeed(Duration.millis(ms)),
      encode: (duration) => Effect.succeed(Duration.toMillis(duration))
    }
  ),
  retryPolicy: Schema.Struct({
    maxRetries: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
    baseDelay: Schema.transformOrFail(
      Schema.Number,
      Schema.instanceOf(Duration.Duration),
      {
        strict: true,
        decode: (ms) => Effect.succeed(Duration.millis(ms)),
        encode: (duration) => Effect.succeed(Duration.toMillis(duration))
      }
    )
  })
})

// プレイヤーデータレスポンスのスキーマ
const PlayerDataResponseSchema = Schema.Struct({
  playerId: Schema.String,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  inventory: Schema.Array(Schema.Struct({
    itemId: Schema.String,
    count: Schema.Number.pipe(Schema.int(), Schema.positive())
  }))
}).pipe(
  Schema.brand("PlayerDataResponse")
)

// HTTP クライアントサービス
export interface HttpIntegrationService {
  readonly getPlayerData: (playerId: string) => Effect.Effect<PlayerDataResponse, HttpIntegrationError>
  readonly updatePlayerPosition: (
    playerId: string,
    position: { x: number, y: number, z: number }
  ) => Effect.Effect<void, HttpIntegrationError>
  readonly batchGetPlayers: (
    playerIds: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<PlayerDataResponse>, HttpIntegrationError>
}

export const HttpIntegrationService = Context.GenericTag<HttpIntegrationService>("@minecraft/HttpIntegrationService")

// レート制限付きHTTP クライアント
const makeRateLimitedHttpClient = (config: ApiConfig) => Effect.gen(function* () {
  // レート制限キュー（1秒間に10リクエストまで）
  const rateLimitQueue = yield* Queue.bounded<void>(10)
  const tokenRefillFiber = yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        yield* Effect.sleep(Duration.millis(100)) // 100msごとにトークンを補充
        yield* Queue.offer(rateLimitQueue, void 0).pipe(
          Effect.ignore // キューが満杯の場合は無視
        )
      })
    )
  )

  const baseClient = HttpClient.make().pipe(
    // タイムアウト設定
    HttpClient.withTimeout(config.timeout),
    // デフォルトヘッダー設定
    HttpClient.mapRequest(
      HttpClientRequest.setHeaders({
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Minecraft-TS/1.0"
      })
    ),
    // リクエスト前にレート制限をチェック
    HttpClient.tapRequest(() => Queue.take(rateLimitQueue)),
    // リトライポリシーを適用
    HttpClient.retry(
      Schedule.exponential(config.retryPolicy.baseDelay).pipe(
        Schedule.compose(Schedule.recurs(config.retryPolicy.maxRetries)),
        Schedule.intersect(Schedule.spaced(Duration.seconds(1))) // 最小1秒間隔
      )
    ),
    // 一時的なエラーのリトライ
    HttpClient.retryTransient({
      while: (error) => {
        if (error._tag === "ResponseError") {
          const status = error.response.status
          return status >= 500 || status === 429 // サーバーエラーまたはレート制限
        }
        return error._tag === "RequestError" // ネットワークエラー
      },
      times: config.retryPolicy.maxRetries
    })
  )

  return { client: baseClient, cleanup: () => Fiber.interrupt(tokenRefillFiber) }
})

// サーキットブレーカー実装
class CircuitBreaker {
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: Duration.Duration = Duration.seconds(30)
  ) {}

  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED"
  private failureCount = 0
  private lastFailureTime = 0

  execute<A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E | HttpIntegrationError> {
    return Effect.gen(function* () {
      // 回路が開いている場合
      if (this.state === "OPEN") {
        const now = Date.now()
        if (now - this.lastFailureTime < Duration.toMillis(this.resetTimeout)) {
          return yield* Effect.fail(new HttpIntegrationError({
            endpoint: "circuit-breaker",
            method: "EXECUTE",
            message: "Circuit breaker is OPEN",
            timestamp: now
          }))
        }
        this.state = "HALF_OPEN"
      }

      return yield* effect.pipe(
        Effect.tap(() => Effect.sync(() => {
          // 成功時は失敗カウントをリセット
          this.failureCount = 0
          this.state = "CLOSED"
        })),
        Effect.catchAll((error) => Effect.sync(() => {
          this.failureCount++
          this.lastFailureTime = Date.now()

          if (this.failureCount >= this.failureThreshold) {
            this.state = "OPEN"
          }

          return Effect.fail(error)
        }).pipe(Effect.flatten))
      )
    }.bind(this))
  }
}

// HTTP サービス実装
const makeHttpIntegrationService = Effect.gen(function* () {
  const config = yield* Config.nested("api", Schema.decodeUnknown(ApiConfigSchema))
  const { client, cleanup } = yield* makeRateLimitedHttpClient(config)
  const circuitBreaker = new CircuitBreaker()

  // クリーンアップを登録
  yield* Effect.addFinalizer(() => Effect.sync(cleanup))

  const executeWithCircuitBreaker = <A, E>(
    effect: Effect.Effect<A, E>
  ): Effect.Effect<A, E | HttpIntegrationError> => {
    return circuitBreaker.execute(effect)
  }

  return HttpIntegrationService.of({
    getPlayerData: (playerId) => {
      const request = HttpClientRequest.get(`${config.baseUrl}/players/${playerId}`)

      return executeWithCircuitBreaker(
        client.execute(request).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(PlayerDataResponseSchema)),
          Effect.mapError((error) => new HttpIntegrationError({
            endpoint: `/players/${playerId}`,
            method: "GET",
            statusCode: "response" in error ? error.response.status : undefined,
            message: error.message ?? "Unknown error",
            timestamp: Date.now()
          })),
          // レスポンスの早期返却パターン
          Effect.timeout(Duration.seconds(5))
        )
      )
    },

    updatePlayerPosition: (playerId, position) => {
      const request = HttpClientRequest.patch(`${config.baseUrl}/players/${playerId}/position`).pipe(
        HttpClientRequest.schemaBodyJson(Schema.Struct({
          x: Schema.Number,
          y: Schema.Number,
          z: Schema.Number
        }))
      )(position)

      return executeWithCircuitBreaker(
        client.execute(request).pipe(
          Effect.flatMap((response) => {
            return response.status >= 200 && response.status < 300
              ? Effect.succeed(void 0)
              : Effect.fail(new HttpIntegrationError({
                  endpoint: `/players/${playerId}/position`,
                  method: "PATCH",
                  statusCode: response.status,
                  message: `HTTP ${response.status}`,
                  timestamp: Date.now()
                }))
          }),
          Effect.timeout(Duration.seconds(3))
        )
      )
    },

    batchGetPlayers: (playerIds) => {
      // ストリームを使ったバッチ処理（並行度制限付き）
      return Stream.fromIterable(playerIds).pipe(
        Stream.mapEffect(
          (playerId) => {
            const request = HttpClientRequest.get(`${config.baseUrl}/players/${playerId}`)
            return executeWithCircuitBreaker(
              client.execute(request).pipe(
                Effect.flatMap(HttpClientResponse.schemaBodyJson(PlayerDataResponseSchema)),
                Effect.mapError((error) => new HttpIntegrationError({
                  endpoint: `/players/${playerId}`,
                  method: "GET",
                  statusCode: "response" in error ? error.response.status : undefined,
                  message: error.message ?? "Unknown error",
                  timestamp: Date.now()
                }))
              )
            )
          },
          { concurrency: 5 } // 並行度を5に制限
        ),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )
    }
  })
})

export const HttpIntegrationServiceLive = Layer.scoped(
  HttpIntegrationService,
  makeHttpIntegrationService
)

// WebSocket 統合（Effect Stream 使用）
export interface WebSocketService {
  readonly connect: (url: string) => Stream.Stream<unknown, HttpIntegrationError>
  readonly send: (message: unknown) => Effect.Effect<void, HttpIntegrationError>
}

export const WebSocketService = Context.GenericTag<WebSocketService>("@minecraft/WebSocketService")

const makeWebSocketService = Effect.gen(function* () {
  let currentWebSocket: WebSocket | null = null

  return WebSocketService.of({
    connect: (url) => Stream.async<unknown, HttpIntegrationError>((emit) => {
      const ws = new WebSocket(url)
      currentWebSocket = ws

      ws.onopen = () => {
        Effect.runFork(Effect.logInfo(`WebSocket connected to ${url}`))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          emit.single(data)
        } catch (error) {
          emit.fail(new HttpIntegrationError({
            endpoint: url,
            method: "RECEIVE",
            message: `Failed to parse message: ${error}`,
            timestamp: Date.now()
          }))
        }
      }

      ws.onerror = (error) => {
        emit.fail(new HttpIntegrationError({
          endpoint: url,
          method: "CONNECT",
          message: `WebSocket error: ${error}`,
          timestamp: Date.now()
        }))
      }

      ws.onclose = () => {
        emit.end()
      }

      return Effect.sync(() => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      })
    }),

    send: (message) => Effect.gen(function* () {
      if (!currentWebSocket || currentWebSocket.readyState !== WebSocket.OPEN) {
        return yield* Effect.fail(new HttpIntegrationError({
          endpoint: currentWebSocket?.url || "unknown",
          method: "SEND",
          message: "WebSocket is not connected",
          timestamp: Date.now()
        }))
      }

      return yield* Effect.try({
        try: () => currentWebSocket.send(JSON.stringify(message)),
        catch: (error) => new HttpIntegrationError({
          endpoint: currentWebSocket.url,
          method: "SEND",
          message: `Failed to send message: ${error}`,
          timestamp: Date.now()
        })
      })
    })
  })
})

export const WebSocketServiceLive = Layer.effect(WebSocketService, makeWebSocketService)

// マルチプレイヤー同期の実装例（改良版）
const multiplayerSync = Effect.gen(function* () {
  const wsService = yield* WebSocketService
  const eventBus = yield* EventBusService

  // WebSocket ストリームから受信
  const incomingStream = wsService.connect("ws://localhost:8080/multiplayer")

  // 受信メッセージをイベントとして処理
  yield* Effect.fork(
    incomingStream.pipe(
      Stream.mapEffect((data) => Effect.gen(function* () {
        const event = yield* Schema.decodeUnknown(GameEventSchema)(data)
        yield* eventBus.publish(event)
        yield* Effect.logInfo("Received multiplayer event", { eventType: event._tag })
      })),
      Stream.runDrain
    )
  )

  // ローカルイベントをWebSocket に送信
  yield* eventBus.subscribe("PlayerMoved", (event) =>
    wsService.send(event).pipe(
      Effect.catchAll((error) =>
        Effect.logError("Failed to send player move event", error)
      )
    )
  )
})
```

## Pattern 5: Database Integration with Effect SQL

**使用場面**: データの永続化とクエリ処理

**実装**:
```typescript
import { SqlClient, SqlError, Connection } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { Config } from "effect"

// データベース設定のブランド型
type DatabaseConfig = {
  readonly connectionString: string
  readonly maxConnections: number
  readonly connectionTimeoutMillis: number
  readonly acquireTimeoutMillis: number
} & Brand.Brand<"DatabaseConfig">

export class ChunkStorageError extends Schema.TaggedError("ChunkStorageError")<{
  readonly operation: string
  readonly coordinate?: ChunkCoordinate
  readonly table?: string
  readonly query?: string
  readonly message: string
  readonly timestamp: number
}> {}

// データベース設定スキーマ
const DatabaseConfigSchema = Schema.Struct({
  connectionString: Schema.String.pipe(
    Schema.minLength(1),
    Schema.message(() => "Connection string is required")
  ),
  maxConnections: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 100),
    Schema.message(() => "Max connections must be between 1 and 100")
  ),
  connectionTimeoutMillis: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.message(() => "Connection timeout must be positive")
  ),
  acquireTimeoutMillis: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.message(() => "Acquire timeout must be positive")
  )
}).pipe(
  Schema.brand("DatabaseConfig")
)

// チャンクデータのスキーマ（データベース用）
const ChunkRowSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.positive()),
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
  data: Schema.String, // JSONとしてシリアライズされたチャンクデータ
  created_at: Schema.DateTimeUtc,
  updated_at: Schema.DateTimeUtc,
  version: Schema.Number.pipe(Schema.int(), Schema.nonNegative())
}).pipe(
  Schema.brand("ChunkRow")
)

type ChunkRow = Schema.Schema.Type<typeof ChunkRowSchema>

// チャンク検索結果のスキーマ
const ChunkSearchResultSchema = Schema.Struct({
  chunks: Schema.Array(ChunkRowSchema),
  totalCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  hasMore: Schema.Boolean
}).pipe(
  Schema.brand("ChunkSearchResult")
)

type ChunkSearchResult = Schema.Schema.Type<typeof ChunkSearchResultSchema>

// リポジトリパターンの実装
export interface ChunkRepository {
  readonly save: (chunk: ChunkData) => Effect.Effect<void, ChunkStorageError>
  readonly load: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<ChunkData>, ChunkStorageError>
  readonly loadBatch: (coordinates: ReadonlyArray<ChunkCoordinate>) => Effect.Effect<ReadonlyArray<ChunkData>, ChunkStorageError>
  readonly delete: (coordinate: ChunkCoordinate) => Effect.Effect<void, ChunkStorageError>
  readonly search: (
    center: ChunkCoordinate,
    radius: number,
    limit?: number
  ) => Effect.Effect<ChunkSearchResult, ChunkStorageError>
  readonly optimisticUpdate: (
    coordinate: ChunkCoordinate,
    updateFn: (data: ChunkData) => ChunkData,
    expectedVersion: number
  ) => Effect.Effect<ChunkData, ChunkStorageError>
}

export const ChunkRepository = Context.GenericTag<ChunkRepository>("@minecraft/ChunkRepository")

// SQLite実装（実本格的な実装）
const makeChunkRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // テーブル初期化
  yield* sql.withTransaction(
    sql`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        x INTEGER NOT NULL,
        z INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 0,
        UNIQUE(x, z)
      )
    `.pipe(
      Effect.catchTag("SqlError", (error) =>
        Effect.fail(new ChunkStorageError({
          operation: "createTable",
          table: "chunks",
          message: `Failed to create chunks table: ${error.message}`,
          timestamp: Date.now()
        }))
      )
    )
  )

  // インデックス作成
  yield* sql.withTransaction(
    sql`CREATE INDEX IF NOT EXISTS idx_chunks_coordinates ON chunks(x, z)`.pipe(
      Effect.catchTag("SqlError", (error) =>
        Effect.fail(new ChunkStorageError({
          operation: "createIndex",
          table: "chunks",
          message: `Failed to create index: ${error.message}`,
          timestamp: Date.now()
        }))
      )
    )
  )

  return ChunkRepository.of({
    save: (chunk) => Effect.gen(function* () {
      const serializedData = JSON.stringify(chunk)

      yield* sql.withTransaction(
        sql`
          INSERT INTO chunks (x, z, data, updated_at, version)
          VALUES (${chunk.coordinate.x}, ${chunk.coordinate.z}, ${serializedData}, CURRENT_TIMESTAMP, 0)
          ON CONFLICT(x, z) DO UPDATE SET
            data = ${serializedData},
            updated_at = CURRENT_TIMESTAMP,
            version = version + 1
        `.pipe(
          Effect.mapError((error: SqlError) => new ChunkStorageError({
            operation: "save",
            coordinate: chunk.coordinate,
            table: "chunks",
            message: `Failed to save chunk: ${error.message}`,
            timestamp: Date.now()
          }))
        )
      )
    }),

    load: (coordinate) => Effect.gen(function* () {
      const results = yield* sql`
        SELECT data FROM chunks
        WHERE x = ${coordinate.x} AND z = ${coordinate.z}
        LIMIT 1
      `.pipe(
        Effect.mapError((error: SqlError) => new ChunkStorageError({
          operation: "load",
          coordinate,
          table: "chunks",
          query: `SELECT data FROM chunks WHERE x = ${coordinate.x} AND z = ${coordinate.z}`,
          message: `Failed to load chunk: ${error.message}`,
          timestamp: Date.now()
        }))
      )

      if (results.length === 0) {
        return Option.none()
      }

      const chunkData = yield* Effect.try({
        try: () => JSON.parse(results[0].data) as ChunkData,
        catch: (error) => new ChunkStorageError({
          operation: "load",
          coordinate,
          message: `Failed to parse chunk data: ${error}`,
          timestamp: Date.now()
        })
      })

      return Option.some(chunkData)
    }),

    loadBatch: (coordinates) => Effect.gen(function* () {
      if (coordinates.length === 0) {
        return []
      }

      // バッチクエリで効率的に複数チャンクを取得
      const placeholders = coordinates.map(() => "(?, ?)").join(", ")
      const params = coordinates.flatMap(coord => [coord.x, coord.z])

      const results = yield* sql`
        SELECT x, z, data FROM chunks
        WHERE (x, z) IN (${sql.in(coordinates.map(c => [c.x, c.z]))})
      `.pipe(
        Effect.mapError((error: SqlError) => new ChunkStorageError({
          operation: "loadBatch",
          table: "chunks",
          message: `Failed to load chunks batch: ${error.message}`,
          timestamp: Date.now()
        }))
      )

      return yield* Effect.forEach(results, (row) =>
        Effect.try({
          try: () => JSON.parse(row.data) as ChunkData,
          catch: (error) => new ChunkStorageError({
            operation: "loadBatch",
            coordinate: { x: row.x, z: row.z },
            message: `Failed to parse chunk data: ${error}`,
            timestamp: Date.now()
          })
        })
      )
    }),

    delete: (coordinate) => Effect.gen(function* () {
      yield* sql.withTransaction(
        sql`
          DELETE FROM chunks
          WHERE x = ${coordinate.x} AND z = ${coordinate.z}
        `.pipe(
          Effect.mapError((error: SqlError) => new ChunkStorageError({
            operation: "delete",
            coordinate,
            table: "chunks",
            message: `Failed to delete chunk: ${error.message}`,
            timestamp: Date.now()
          }))
        )
      )
    }),

    search: (center, radius, limit = 100) => Effect.gen(function* () {
      const results = yield* sql`
        SELECT *, COUNT(*) OVER() as total_count
        FROM chunks
        WHERE x BETWEEN ${center.x - radius} AND ${center.x + radius}
          AND z BETWEEN ${center.z - radius} AND ${center.z + radius}
        ORDER BY
          ABS(x - ${center.x}) + ABS(z - ${center.z}) ASC
        LIMIT ${limit + 1}
      `.pipe(
        Effect.mapError((error: SqlError) => new ChunkStorageError({
          operation: "search",
          coordinate: center,
          table: "chunks",
          message: `Failed to search chunks: ${error.message}`,
          timestamp: Date.now()
        }))
      )

      const hasMore = results.length > limit
      const chunks = results.slice(0, limit)
      const totalCount = chunks.length > 0 ? chunks[0].total_count : 0

      const parsedChunks = yield* Effect.forEach(chunks, (row) =>
        Effect.try({
          try: () => ({
            id: row.id,
            x: row.x,
            z: row.z,
            data: row.data,
            created_at: row.created_at,
            updated_at: row.updated_at,
            version: row.version
          } as ChunkRow),
          catch: (error) => new ChunkStorageError({
            operation: "search",
            message: `Failed to parse search result: ${error}`,
            timestamp: Date.now()
          })
        })
      )

      return {
        chunks: parsedChunks,
        totalCount,
        hasMore
      } as ChunkSearchResult
    }),

    // 楽観的ロック付きアップデート
    optimisticUpdate: (coordinate, updateFn, expectedVersion) => Effect.gen(function* () {
      return yield* sql.withTransaction(
        Effect.gen(function* () {
          // 現在のデータを取得
          const current = yield* sql`
            SELECT data, version FROM chunks
            WHERE x = ${coordinate.x} AND z = ${coordinate.z}
            FOR UPDATE
          `.pipe(
            Effect.mapError((error: SqlError) => new ChunkStorageError({
              operation: "optimisticUpdate",
              coordinate,
              table: "chunks",
              message: `Failed to load for update: ${error.message}`,
              timestamp: Date.now()
            }))
          )

          if (current.length === 0) {
            return yield* Effect.fail(new ChunkStorageError({
              operation: "optimisticUpdate",
              coordinate,
              message: "Chunk not found",
              timestamp: Date.now()
            }))
          }

          const currentRow = current[0]
          if (currentRow.version !== expectedVersion) {
            return yield* Effect.fail(new ChunkStorageError({
              operation: "optimisticUpdate",
              coordinate,
              message: `Version conflict: expected ${expectedVersion}, got ${currentRow.version}`,
              timestamp: Date.now()
            }))
          }

          const currentData = yield* Effect.try({
            try: () => JSON.parse(currentRow.data) as ChunkData,
            catch: (error) => new ChunkStorageError({
              operation: "optimisticUpdate",
              coordinate,
              message: `Failed to parse current data: ${error}`,
              timestamp: Date.now()
            })
          })

          const updatedData = updateFn(currentData)
          const serializedData = JSON.stringify(updatedData)
          const newVersion = currentRow.version + 1

          yield* sql`
            UPDATE chunks SET
              data = ${serializedData},
              updated_at = CURRENT_TIMESTAMP,
              version = ${newVersion}
            WHERE x = ${coordinate.x} AND z = ${coordinate.z}
              AND version = ${expectedVersion}
          `.pipe(
            Effect.mapError((error: SqlError) => new ChunkStorageError({
              operation: "optimisticUpdate",
              coordinate,
              table: "chunks",
              message: `Failed to update chunk: ${error.message}`,
              timestamp: Date.now()
            }))
          )

          return updatedData
        })
      )
    })
  })
})

// 設定からレイヤーを作成
const makeDatabaseLayer = Effect.gen(function* () {
  const config = yield* Config.nested("database", Schema.decodeUnknown(DatabaseConfigSchema))

  return SqliteClient.layer({
    filename: config.connectionString,
    poolConfig: {
      max: config.maxConnections,
      min: 1,
      acquireTimeout: Duration.millis(config.acquireTimeoutMillis),
      idleTimeout: Duration.minutes(5)
    }
  })
})

export const DatabaseLive = Layer.unwrapEffect(makeDatabaseLayer)
export const ChunkRepositoryLive = Layer.effect(ChunkRepository, makeChunkRepository).pipe(
  Layer.provide(DatabaseLive)
)

// 使用例: トランザクション付きバッチ処理
const saveChunksBatch = (chunks: ReadonlyArray<ChunkData>) => Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const repository = yield* ChunkRepository

  return yield* sql.withTransaction(
    Effect.forEach(chunks, (chunk) => repository.save(chunk), {
      concurrency: 1 // トランザクション内では並行実行しない
    })
  )
})

// 使用例: 楽観的ロックを使った安全な更新
const updateChunkSafely = (
  coordinate: ChunkCoordinate,
  updateFn: (data: ChunkData) => ChunkData
) => Effect.gen(function* () {
  const repository = yield* ChunkRepository

  return yield* Effect.retry(
    Effect.gen(function* () {
      const maybeChunk = yield* repository.load(coordinate)

      if (Option.isNone(maybeChunk)) {
        return yield* Effect.fail(new ChunkStorageError({
          operation: "updateChunkSafely",
          coordinate,
          message: "Chunk not found",
          timestamp: Date.now()
        }))
      }

      // バージョンを取得するため再度データベースから読み取り
      const sql = yield* SqlClient.SqlClient
      const versionResult = yield* sql`
        SELECT version FROM chunks
        WHERE x = ${coordinate.x} AND z = ${coordinate.z}
      `

      if (versionResult.length === 0) {
        return yield* Effect.fail(new ChunkStorageError({
          operation: "updateChunkSafely",
          coordinate,
          message: "Chunk disappeared during update",
          timestamp: Date.now()
        }))
      }

      const currentVersion = versionResult[0].version
      return yield* repository.optimisticUpdate(coordinate, updateFn, currentVersion)
    }),
    Schedule.exponential(Duration.millis(100)).pipe(
      Schedule.compose(Schedule.recurs(3))
    )
  )
})
```

## Pattern 6: File System Integration

**使用場面**: ファイル操作、設定読み込み、アセット管理

**実装**:
```typescript
export class FileSystemError extends Schema.TaggedError("FileSystemError")<{
  readonly operation: string
  readonly path: string
  readonly reason: string
  readonly timestamp: number
}> {}

export interface FileSystemService {
  readonly readFile: (path: string) => Effect.Effect<string, FileSystemError>
  readonly writeFile: (path: string, content: string) => Effect.Effect<void, FileSystemError>
  readonly exists: (path: string) => Effect.Effect<boolean, FileSystemError>
  readonly createDirectory: (path: string) => Effect.Effect<void, FileSystemError>
  readonly listDirectory: (path: string) => Effect.Effect<string[], FileSystemError>
}

export const FileSystemService = Context.GenericTag<FileSystemService>("@minecraft/FileSystemService")

const makeFileSystemService = Effect.succeed(
  FileSystemService.of({
    readFile: (path) => Effect.gen(function* () {
      return yield* Effect.async<string, FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.readFile(path, 'utf8', (err, data) => {
            if (err) {
              resume(Effect.fail(new FileSystemError({
                operation: "readFile",
                path,
                reason: err.message,
                timestamp: Date.now()
              })))
            } else {
              resume(Effect.succeed(data))
            }
          })
        })
      })
    }),

    writeFile: (path, content) => Effect.gen(function* () {
      return yield* Effect.async<void, FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.writeFile(path, content, 'utf8', (err) => {
            if (err) {
              resume(Effect.fail(new FileSystemError({
                operation: "writeFile",
                path,
                reason: err.message,
                timestamp: Date.now()
              })))
            } else {
              resume(Effect.succeed(void 0))
            }
          })
        })
      })
    }),

    exists: (path) => Effect.gen(function* () {
      return yield* Effect.async<boolean, FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.access(path, (err) => {
            resume(Effect.succeed(!err))
          })
        })
      })
    }),

    createDirectory: (path) => Effect.gen(function* () {
      return yield* Effect.async<void, FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.mkdir(path, { recursive: true }, (err) => {
            if (err) {
              resume(Effect.fail(new FileSystemError({
                operation: "createDirectory",
                path,
                reason: err.message,
                timestamp: Date.now()
              })))
            } else {
              resume(Effect.succeed(void 0))
            }
          })
        })
      })
    }),

    listDirectory: (path) => Effect.gen(function* () {
      return yield* Effect.async<string[], FileSystemError>((resume) => {
        import('fs').then(fs => {
          fs.readdir(path, (err, files) => {
            if (err) {
              resume(Effect.fail(new FileSystemError({
                operation: "listDirectory",
                path,
                reason: err.message,
                timestamp: Date.now()
              })))
            } else {
              resume(Effect.succeed(files))
            }
          })
        })
      })
    })
  })
)

export const FileSystemServiceLive = Layer.effect(FileSystemService, makeFileSystemService)

// 設定ファイル管理の実装例
const ConfigSchema = Schema.Struct({
  renderDistance: Schema.Number.pipe(Schema.int(), Schema.between(2, 32)),
  maxFPS: Schema.Number.pipe(Schema.int(), Schema.between(30, 240)),
  enableShadows: Schema.Boolean,
  textureQuality: Schema.Union(
    Schema.Literal("low"),
    Schema.Literal("medium"),
    Schema.Literal("high")
  )
})

type Config = Schema.Schema.Type<typeof ConfigSchema>

export interface ConfigService {
  readonly loadConfig: () => Effect.Effect<Config, FileSystemError>
  readonly saveConfig: (config: Config) => Effect.Effect<void, FileSystemError>
}

export const ConfigService = Context.GenericTag<ConfigService>("@minecraft/ConfigService")

const makeConfigService = Effect.gen(function* () {
  const fs = yield* FileSystemService
  const configPath = "./config/game.json"

  return ConfigService.of({
    loadConfig: () => Effect.gen(function* () {
      const exists = yield* fs.exists(configPath)

      if (!exists) {
        // デフォルト設定を作成
        const defaultConfig: Config = {
          renderDistance: 16,
          maxFPS: 60,
          enableShadows: true,
          textureQuality: "high"
        }
        yield* fs.createDirectory("./config")
        yield* fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
        return defaultConfig
      }

      const content = yield* fs.readFile(configPath)
      return Schema.decodeUnknownSync(ConfigSchema)(JSON.parse(content))
    }),

    saveConfig: (config) => Effect.gen(function* () {
      yield* fs.createDirectory("./config")
      yield* fs.writeFile(configPath, JSON.stringify(config, null, 2))
    })
  })
})

export const ConfigServiceLive = Layer.effect(ConfigService, makeConfigService)
```

## Pattern 7: Third-party Library Integration

**使用場面**: Three.js、物理エンジンなどの外部ライブラリ統合

**実装**:
```typescript
export class ThreeJSError extends Schema.TaggedError("ThreeJSError")<{
  readonly operation: string
  readonly component: string
  readonly message: string
  readonly timestamp: number
}> {}

// Three.jsレンダラーサービス
export interface ThreeJSService {
  readonly initializeRenderer: (canvas: HTMLCanvasElement) => Effect.Effect<THREE.WebGPURenderer, ThreeJSError>
  readonly createScene: () => Effect.Effect<THREE.Scene, ThreeJSError>
  readonly createCamera: (aspect: number) => Effect.Effect<THREE.PerspectiveCamera, ThreeJSError>
  readonly render: (renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, ThreeJSError>
}

export const ThreeJSService = Context.GenericTag<ThreeJSService>("@minecraft/ThreeJSService")

const makeThreeJSService = Effect.succeed(
  ThreeJSService.of({
    initializeRenderer: (canvas) => Effect.gen(function* () {
      return yield* Effect.try({
        try: async () => {
          const renderer = new THREE.WebGPURenderer({
            canvas,
            antialias: true,
            powerPreference: "high-performance"
          })
          await renderer.init()
          return renderer
        },
        catch: (error) => new ThreeJSError({
          operation: "initializeRenderer",
          component: "WebGPURenderer",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: Date.now()
        })
      })
    }),

    createScene: () => Effect.gen(function* () {
      return yield* Effect.sync(() => new THREE.Scene())
    }),

    createCamera: (aspect) => Effect.gen(function* () {
      return yield* Effect.sync(() =>
        new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
      )
    }),

    render: (renderer, scene, camera) => Effect.gen(function* () {
      return yield* Effect.try({
        try: async () => {
          await renderer.renderAsync(scene, camera)
        },
        catch: (error) => new ThreeJSError({
          operation: "render",
          component: "WebGPURenderer",
          message: error instanceof Error ? error.message : "Render failed",
          timestamp: Date.now()
        })
      })
    })
  })
)

export const ThreeJSServiceLive = Layer.effect(ThreeJSService, makeThreeJSService)

// メッシュ生成サービスの実装
export interface MeshGenerationService {
  readonly createChunkMesh: (chunkData: ChunkData) => Effect.Effect<THREE.Mesh, ThreeJSError>
  readonly updateMesh: (mesh: THREE.Mesh, chunkData: ChunkData) => Effect.Effect<void, ThreeJSError>
  readonly disposeMesh: (mesh: THREE.Mesh) => Effect.Effect<void, never>
}

export const MeshGenerationService = Context.GenericTag<MeshGenerationService>("@minecraft/MeshGenerationService")

const makeMeshGenerationService = Effect.gen(function* () {
  const threeJS = yield* ThreeJSService

  return MeshGenerationService.of({
    createChunkMesh: (chunkData) => Effect.gen(function* () {
      return yield* Effect.try({
        try: () => {
          const geometry = new THREE.BufferGeometry()
          const vertices: number[] = []
          const indices: number[] = []

          // チャンクデータからメッシュを生成
          chunkData.blocks.forEach((block, index) => {
            if (block.type !== "air") {
              const x = index % 16
              const y = Math.floor(index / 256)
              const z = Math.floor((index % 256) / 16)

              // ブロックの6面を追加（隣接チェックは省略）
              addBlockFaces(vertices, indices, x, y, z)
            }
          })

          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
          geometry.setIndex(indices)
          geometry.computeVertexNormals()

          const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
          return new THREE.Mesh(geometry, material)
        },
        catch: (error) => new ThreeJSError({
          operation: "createChunkMesh",
          component: "BufferGeometry",
          message: error instanceof Error ? error.message : "Mesh creation failed",
          timestamp: Date.now()
        })
      })
    }),

    updateMesh: (mesh, chunkData) => Effect.gen(function* () {
      // メッシュ更新ロジック
      yield* Effect.sync(() => {
        mesh.geometry.dispose()
        // 新しいジオメトリを作成して置換
      })
    }),

    disposeMesh: (mesh) => Effect.gen(function* () {
      yield* Effect.sync(() => {
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat.dispose())
        } else {
          mesh.material.dispose()
        }
      })
    })
  })
})

export const MeshGenerationServiceLive = Layer.effect(MeshGenerationService, makeMeshGenerationService)

// ヘルパー関数
const addBlockFaces = (vertices: number[], indices: number[], x: number, y: number, z: number) => {
  const startIndex = vertices.length / 3

  // 6面の頂点を追加（簡略版）
  const blockFaces = [
    // Front face
    [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1],
    // Back face
    [x + 1, y, z], [x, y, z], [x, y + 1, z], [x + 1, y + 1, z],
    // Top face
    [x, y + 1, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z], [x, y + 1, z],
    // Bottom face
    [x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1],
    // Right face
    [x + 1, y, z + 1], [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1],
    // Left face
    [x, y, z], [x, y, z + 1], [x, y + 1, z + 1], [x, y + 1, z]
  ]

  blockFaces.forEach(face => {
    vertices.push(...face)
  })

  // インデックスを追加（各面2つの三角形）
  for (let i = 0; i < 6; i++) {
    const faceStart = startIndex + i * 4
    indices.push(
      faceStart, faceStart + 1, faceStart + 2,
      faceStart, faceStart + 2, faceStart + 3
    )
  }
}
```

## Pattern 8: Cross-Layer Communication

**使用場面**: ドメイン層からインフラストラクチャ層への依存関係逆転

**実装**:
```typescript
// ドメイン層のポート定義
export interface ChunkStoragePort {
  readonly save: (chunk: ChunkData) => Effect.Effect<void, ChunkStorageError>
  readonly load: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<ChunkData>, ChunkStorageError>
}

export const ChunkStoragePort = Context.GenericTag<ChunkStoragePort>("@minecraft/domain/ChunkStoragePort")

export class ChunkStorageError extends Schema.TaggedError("ChunkStorageError")<{
  readonly operation: string
  readonly coordinate?: ChunkCoordinate
  readonly reason: string
  readonly timestamp: number
}> {}

// ドメインサービスの実装
export interface ChunkDomainService {
  readonly generateChunk: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkGenerationError>
  readonly persistChunk: (chunk: ChunkData) => Effect.Effect<void, ChunkStorageError>
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<ChunkData, ChunkStorageError | ChunkGenerationError>
}

export const ChunkDomainService = Context.GenericTag<ChunkDomainService>("@minecraft/domain/ChunkDomainService")

const makeChunkDomainService = Effect.gen(function* () {
  const chunkStorage = yield* ChunkStoragePort // ポートに依存
  const terrainGenerator = yield* TerrainGeneratorService

  return ChunkDomainService.of({
    generateChunk: (coordinate) => Effect.gen(function* () {
      return yield* terrainGenerator.generate(coordinate)
    }),

    persistChunk: (chunk) => Effect.gen(function* () {
      yield* chunkStorage.save(chunk)
    }),

    loadChunk: (coordinate) => Effect.gen(function* () {
      const existingChunk = yield* chunkStorage.load(coordinate)

      return yield* Match.value(existingChunk).pipe(
        Match.when(Option.isSome, (chunk) => Effect.succeed(chunk.value)),
        Match.when(Option.isNone, () => Effect.gen(function* () {
          const newChunk = yield* terrainGenerator.generate(coordinate)
          yield* chunkStorage.save(newChunk)
          return newChunk
        })),
        Match.exhaustive
      )
    })
  })
})

export const ChunkDomainServiceLive = Layer.effect(ChunkDomainService, makeChunkDomainService)

// インフラストラクチャ層のアダプター実装
const makeFileSystemChunkStorageAdapter = Effect.gen(function* () {
  const fs = yield* FileSystemService

  return ChunkStoragePort.of({
    save: (chunk) => Effect.gen(function* () {
      const filePath = `./world/chunks/chunk_${chunk.coordinate.x}_${chunk.coordinate.z}.json`
      const serializedChunk = JSON.stringify(chunk)

      yield* fs.createDirectory("./world/chunks")
      yield* fs.writeFile(filePath, serializedChunk).pipe(
        Effect.mapError((error) => new ChunkStorageError({
          operation: "save",
          coordinate: chunk.coordinate,
          reason: error.reason,
          timestamp: Date.now()
        }))
      )
    }),

    load: (coordinate) => Effect.gen(function* () {
      const filePath = `./world/chunks/chunk_${coordinate.x}_${coordinate.z}.json`
      const exists = yield* fs.exists(filePath).pipe(
        Effect.mapError((error) => new ChunkStorageError({
          operation: "load",
          coordinate,
          reason: error.reason,
          timestamp: Date.now()
        }))
      )

      if (!exists) {
        return Option.none()
      }

      const content = yield* fs.readFile(filePath).pipe(
        Effect.mapError((error) => new ChunkStorageError({
          operation: "load",
          coordinate,
          reason: error.reason,
          timestamp: Date.now()
        }))
      )

      const chunkData = yield* Effect.try({
        try: () => JSON.parse(content) as ChunkData,
        catch: (error) => new ChunkStorageError({
          operation: "load",
          coordinate,
          reason: `Failed to parse chunk data: ${error}`,
          timestamp: Date.now()
        })
      })

      return Option.some(chunkData)
    })
  })
})

export const FileSystemChunkStorageAdapterLive = Layer.effect(ChunkStoragePort, makeFileSystemChunkStorageAdapter)

// レイヤー構成
export const ChunkManagementLive = Layer.mergeAll(
  FileSystemServiceLive,
  TerrainGeneratorServiceLive
).pipe(
  Layer.provideMerge(FileSystemChunkStorageAdapterLive),
  Layer.provideMerge(ChunkDomainServiceLive)
)
```

## Anti-Patterns (避けるべき統合パターン)

### ❌ Anti-Pattern 1: 直接的な外部依存
```typescript
// これは避ける - 直接的なライブラリ呼び出し
const badService = Effect.gen(function* () {
  const fs = require('fs') // 直接require
  const data = fs.readFileSync('./config.json') // 同期的読み込み
  return JSON.parse(data)
})
```

### ❌ Anti-Pattern 2: Promise混在
```typescript
// これも避ける - PromiseとEffectの混在
const badAsyncService = async () => {
  const result = await Effect.runPromise(someEffect()) // 混在は避ける
  return result
}
```

### ❌ Anti-Pattern 3: エラーハンドリングの欠如
```typescript
// これも不適切 - エラー型の未定義
interface BadService {
  readonly operation: () => Effect.Effect<string, never> // エラー型がnever
}
```

### ❌ Anti-Pattern 4: 循環依存
```typescript
// これは避ける - サービス間の循環依存
const ServiceA = Context.GenericTag<{
  useB: () => Effect.Effect<string, never>
}>("ServiceA")

const ServiceB = Context.GenericTag<{
  useA: () => Effect.Effect<string, never> // 循環依存
}>("ServiceB")
```

## Best Practices

### 1. ポート・アダプターパターンの活用
```typescript
// ドメイン層でポートを定義
export interface DataPort {
  readonly save: (data: unknown) => Effect.Effect<void, DataError>
}

// インフラ層でアダプターを実装
export const FileSystemAdapter: DataPort = /* ... */
export const DatabaseAdapter: DataPort = /* ... */
```

### 2. 統合テストでの依存関係注入
```typescript
// テスト用のモックを提供
export const TestChunkStorageLive = Layer.succeed(
  ChunkStoragePort,
  ChunkStoragePort.of({
    save: () => Effect.succeed(void 0),
    load: () => Effect.succeed(Option.none())
  })
)
```

### 3. 適切なエラー境界の設定
```typescript
// 統合ポイントでエラーを適切に変換
const adaptedService = externalService.operation().pipe(
  Effect.mapError((externalError) => new IntegrationError({
    source: "ExternalService",
    operation: "operation",
    reason: externalError.message,
    timestamp: Date.now()
  }))
)
```

### 4. リソース管理の徹底
```typescript
// Effect.acquireReleaseでリソースを安全に管理
const safeExternalResource = Effect.acquireRelease(
  acquireExternalResource(),
  (resource) => Effect.sync(() => resource.cleanup())
)
```

### 5. 設定による統合方法の切り替え
```typescript
// 環境に応じて統合方法を切り替え
const StorageLayerLive = Config.string("STORAGE_TYPE").pipe(
  Effect.map(storageType => Match.value(storageType).pipe(
    Match.when("filesystem", () => FileSystemStorageLive),
    Match.when("database", () => DatabaseStorageLive),
    Match.when("memory", () => InMemoryStorageLive),
    Match.orElse(() => FileSystemStorageLive)
  )),
  Layer.fromEffect
)
```

## Pattern 9: Telemetry and Observability Integration

**使用場面**: ロギング、メトリクス、分散トレーシング

**実装**:
```typescript
import { Tracer, Span } from "@effect/opentelemetry"
import { Metric, MetricKeyType } from "effect"
import { Logger, LogLevel } from "effect"

// メトリクス定義（ブランド型）
type HttpRequestMetrics = {
  readonly requestCount: Metric.Counter
  readonly requestDuration: Metric.Histogram
  readonly errorRate: Metric.Counter
} & Brand.Brand<"HttpRequestMetrics">

type DatabaseMetrics = {
  readonly queryCount: Metric.Counter
  readonly queryDuration: Metric.Histogram
  readonly connectionPoolSize: Metric.Gauge
} & Brand.Brand<"DatabaseMetrics">

// テレメトリサービス
export interface TelemetryService {
  readonly recordHttpRequest: (
    method: string,
    endpoint: string,
    statusCode: number,
    duration: Duration.Duration
  ) => Effect.Effect<void, never>
  readonly recordDatabaseQuery: (
    operation: string,
    table: string,
    duration: Duration.Duration,
    success: boolean
  ) => Effect.Effect<void, never>
  readonly createSpan: <A, E, R>(
    name: string,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
  readonly withStructuredLogging: <A, E, R>(
    context: Record<string, unknown>,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>
}

export const TelemetryService = Context.GenericTag<TelemetryService>("@minecraft/TelemetryService")

// メトリクス初期化
const createMetrics = Effect.gen(function* () {
  const httpRequestCount = Metric.counter("http_requests_total", {
    description: "Total number of HTTP requests"
  })

  const httpRequestDuration = Metric.histogram("http_request_duration_seconds", {
    description: "HTTP request duration in seconds"
  })

  const httpErrorRate = Metric.counter("http_errors_total", {
    description: "Total number of HTTP errors"
  })

  const dbQueryCount = Metric.counter("db_queries_total", {
    description: "Total number of database queries"
  })

  const dbQueryDuration = Metric.histogram("db_query_duration_seconds", {
    description: "Database query duration in seconds"
  })

  const dbConnectionPoolSize = Metric.gauge("db_connection_pool_size", {
    description: "Current database connection pool size"
  })

  return {
    http: {
      requestCount: httpRequestCount,
      requestDuration: httpRequestDuration,
      errorRate: httpErrorRate
    } as HttpRequestMetrics,
    database: {
      queryCount: dbQueryCount,
      queryDuration: dbQueryDuration,
      connectionPoolSize: dbConnectionPoolSize
    } as DatabaseMetrics
  }
})

const makeTelemetryService = Effect.gen(function* () {
  const metrics = yield* createMetrics
  const tracer = yield* Tracer.Tracer

  return TelemetryService.of({
    recordHttpRequest: (method, endpoint, statusCode, duration) => Effect.gen(function* () {
      const durationSeconds = Duration.toSeconds(duration)

      yield* metrics.http.requestCount.incrementBy(1, {
        method,
        endpoint,
        status_code: statusCode.toString()
      })

      yield* metrics.http.requestDuration.update(durationSeconds, {
        method,
        endpoint
      })

      if (statusCode >= 400) {
        yield* metrics.http.errorRate.incrementBy(1, {
          method,
          endpoint,
          status_code: statusCode.toString()
        })
      }

      yield* Effect.logInfo("HTTP request completed", {
        method,
        endpoint,
        statusCode,
        durationMs: Duration.toMillis(duration)
      })
    }),

    recordDatabaseQuery: (operation, table, duration, success) => Effect.gen(function* () {
      const durationSeconds = Duration.toSeconds(duration)

      yield* metrics.database.queryCount.incrementBy(1, {
        operation,
        table,
        success: success.toString()
      })

      yield* metrics.database.queryDuration.update(durationSeconds, {
        operation,
        table
      })

      yield* Effect.logDebug("Database query executed", {
        operation,
        table,
        success,
        durationMs: Duration.toMillis(duration)
      })
    }),

    createSpan: (name, effect) => {
      return tracer.span(name)(effect).pipe(
        Effect.tapBoth({
          onFailure: (error) => Effect.logError(`Span ${name} failed`, error),
          onSuccess: () => Effect.logDebug(`Span ${name} completed successfully`)
        })
      )
    },

    withStructuredLogging: (context, effect) => {
      return effect.pipe(
        Effect.annotateLogs(context),
        Effect.tapBoth({
          onFailure: (error) => Effect.logError("Operation failed", { ...context, error }),
          onSuccess: (result) => Effect.logInfo("Operation succeeded", { ...context, result })
        })
      )
    }
  })
})

export const TelemetryServiceLive = Layer.effect(TelemetryService, makeTelemetryService)

// HTTP サービスにテレメトリを追加
const makeObservableHttpIntegrationService = Effect.gen(function* () {
  const baseService = yield* HttpIntegrationService
  const telemetry = yield* TelemetryService

  return HttpIntegrationService.of({
    getPlayerData: (playerId) => {
      return telemetry.createSpan("http.get_player_data",
        telemetry.withStructuredLogging(
          { operation: "getPlayerData", playerId },
          Effect.gen(function* () {
            const startTime = yield* Clock.currentTimeMillis

            return yield* baseService.getPlayerData(playerId).pipe(
              Effect.tap((result) => Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeMillis
                const duration = Duration.millis(endTime - startTime)

                yield* telemetry.recordHttpRequest(
                  "GET",
                  `/players/${playerId}`,
                  200,
                  duration
                )
              })),
              Effect.tapError((error) => Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeMillis
                const duration = Duration.millis(endTime - startTime)
                const statusCode = error.statusCode ?? 500

                yield* telemetry.recordHttpRequest(
                  "GET",
                  `/players/${playerId}`,
                  statusCode,
                  duration
                )
              }))
            )
          })
        )
      )
    },

    updatePlayerPosition: (playerId, position) => {
      return telemetry.createSpan("http.update_player_position",
        telemetry.withStructuredLogging(
          { operation: "updatePlayerPosition", playerId, position },
          Effect.gen(function* () {
            const startTime = yield* Clock.currentTimeMillis

            return yield* baseService.updatePlayerPosition(playerId, position).pipe(
              Effect.tap(() => Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeMillis
                const duration = Duration.millis(endTime - startTime)

                yield* telemetry.recordHttpRequest(
                  "PATCH",
                  `/players/${playerId}/position`,
                  200,
                  duration
                )
              })),
              Effect.tapError((error) => Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeMillis
                const duration = Duration.millis(endTime - startTime)
                const statusCode = error.statusCode ?? 500

                yield* telemetry.recordHttpRequest(
                  "PATCH",
                  `/players/${playerId}/position`,
                  statusCode,
                  duration
                )
              }))
            )
          })
        )
      )
    },

    batchGetPlayers: (playerIds) => {
      return telemetry.createSpan("http.batch_get_players",
        telemetry.withStructuredLogging(
          { operation: "batchGetPlayers", playerCount: playerIds.length },
          baseService.batchGetPlayers(playerIds)
        )
      )
    }
  })
})

// データベースサービスにテレメトリを追加
const makeObservableChunkRepository = Effect.gen(function* () {
  const baseRepository = yield* ChunkRepository
  const telemetry = yield* TelemetryService

  return ChunkRepository.of({
    save: (chunk) => {
      return telemetry.createSpan("db.chunk_save",
        telemetry.withStructuredLogging(
          { operation: "save", coordinate: chunk.coordinate },
          Effect.gen(function* () {
            const startTime = yield* Clock.currentTimeMillis

            return yield* baseRepository.save(chunk).pipe(
              Effect.tap(() => Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeMillis
                const duration = Duration.millis(endTime - startTime)

                yield* telemetry.recordDatabaseQuery("INSERT/UPDATE", "chunks", duration, true)
              })),
              Effect.tapError(() => Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeMillis
                const duration = Duration.millis(endTime - startTime)

                yield* telemetry.recordDatabaseQuery("INSERT/UPDATE", "chunks", duration, false)
              }))
            )
          })
        )
      )
    },

    load: (coordinate) => {
      return telemetry.createSpan("db.chunk_load",
        telemetry.withStructuredLogging(
          { operation: "load", coordinate },
          Effect.gen(function* () {
            const startTime = yield* Clock.currentTimeMillis

            return yield* baseRepository.load(coordinate).pipe(
              Effect.tap((result) => Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeMillis
                const duration = Duration.millis(endTime - startTime)

                yield* telemetry.recordDatabaseQuery("SELECT", "chunks", duration, true)
                yield* Effect.logDebug("Chunk load result", {
                  coordinate,
                  found: Option.isSome(result)
                })
              })),
              Effect.tapError(() => Effect.gen(function* () {
                const endTime = yield* Clock.currentTimeMillis
                const duration = Duration.millis(endTime - startTime)

                yield* telemetry.recordDatabaseQuery("SELECT", "chunks", duration, false)
              }))
            )
          })
        )
      )
    },

    loadBatch: (coordinates) => {
      return telemetry.createSpan("db.chunk_load_batch",
        telemetry.withStructuredLogging(
          { operation: "loadBatch", coordinateCount: coordinates.length },
          baseRepository.loadBatch(coordinates)
        )
      )
    },

    delete: (coordinate) => {
      return telemetry.createSpan("db.chunk_delete",
        telemetry.withStructuredLogging(
          { operation: "delete", coordinate },
          baseRepository.delete(coordinate)
        )
      )
    },

    search: (center, radius, limit) => {
      return telemetry.createSpan("db.chunk_search",
        telemetry.withStructuredLogging(
          { operation: "search", center, radius, limit },
          baseRepository.search(center, radius, limit)
        )
      )
    },

    optimisticUpdate: (coordinate, updateFn, expectedVersion) => {
      return telemetry.createSpan("db.chunk_optimistic_update",
        telemetry.withStructuredLogging(
          { operation: "optimisticUpdate", coordinate, expectedVersion },
          baseRepository.optimisticUpdate(coordinate, updateFn, expectedVersion)
        )
      )
    }
  })
})
```

## Pattern 10: Property-Based Testing for Integration

**使用場面**: 統合ポイントの堅牢性テスト

**実装**:
```typescript
import * as fc from "fast-check"
import { Gen } from "effect"

// テストデータ生成器
const chunkCoordinateGen = fc.record({
  x: fc.integer({ min: -1000, max: 1000 }),
  z: fc.integer({ min: -1000, max: 1000 })
})

const blockTypeGen = fc.oneof(
  fc.constant("air"),
  fc.constant("stone"),
  fc.constant("dirt"),
  fc.constant("grass"),
  fc.constant("wood")
)

const chunkDataGen = fc.record({
  coordinate: chunkCoordinateGen,
  blocks: fc.array(fc.record({
    type: blockTypeGen,
    position: fc.record({
      x: fc.integer({ min: 0, max: 15 }),
      y: fc.integer({ min: 0, max: 255 }),
      z: fc.integer({ min: 0, max: 15 })
    })
  }), { minLength: 1, maxLength: 4096 }),
  metadata: fc.record({
    biome: fc.oneof(fc.constant("plains"), fc.constant("forest"), fc.constant("desert")),
    generatedAt: fc.date(),
    version: fc.integer({ min: 1, max: 10 })
  })
})

const playerDataResponseGen = fc.record({
  playerId: fc.uuid(),
  position: fc.record({
    x: fc.float({ min: -1000, max: 1000 }),
    y: fc.float({ min: 0, max: 256 }),
    z: fc.float({ min: -1000, max: 1000 })
  }),
  inventory: fc.array(fc.record({
    itemId: fc.oneof(fc.constant("dirt"), fc.constant("stone"), fc.constant("wood")),
    count: fc.integer({ min: 1, max: 64 })
  }))
})

// プロパティベーステスト
const testChunkRepositoryProperties = Effect.gen(function* () {
  const repository = yield* ChunkRepository

  // プロパティ1: 保存したチャンクは必ず読み込める
  yield* Effect.fromPromise(() =>
    fc.assert(
      fc.asyncProperty(chunkDataGen, async (chunkData) => {
        const testEffect = Effect.gen(function* () {
          yield* repository.save(chunkData)
          const loaded = yield* repository.load(chunkData.coordinate)

          // チャンクが正しく保存・読み込みされることを検証
          assert(Option.isSome(loaded))
          assert.deepEqual(loaded.value.coordinate, chunkData.coordinate)
          assert.deepEqual(loaded.value.blocks.length, chunkData.blocks.length)
        })

        await Effect.runPromise(testEffect.pipe(
          Effect.provide(TestChunkRepositoryLive)
        ))
      })
    )
  )

  // プロパティ2: バッチ読み込みの結果は個別読み込みと一致する
  yield* Effect.fromPromise(() =>
    fc.assert(
      fc.asyncProperty(
        fc.array(chunkDataGen, { minLength: 1, maxLength: 10 }),
        async (chunks) => {
          const testEffect = Effect.gen(function* () {
            // 全チャンクを保存
            yield* Effect.forEach(chunks, (chunk) => repository.save(chunk))

            const coordinates = chunks.map(c => c.coordinate)

            // バッチ読み込み
            const batchLoaded = yield* repository.loadBatch(coordinates)

            // 個別読み込み
            const individualLoaded = yield* Effect.forEach(coordinates, (coord) =>
              repository.load(coord).pipe(
                Effect.map(Option.getOrNull)
              )
            )

            // バッチと個別の結果が一致することを検証
            assert.equal(batchLoaded.length, individualLoaded.filter(Boolean).length)
          })

          await Effect.runPromise(testEffect.pipe(
            Effect.provide(TestChunkRepositoryLive)
          ))
        }
      )
    )
  )

  // プロパティ3: 楽観的ロックの整合性
  yield* Effect.fromPromise(() =>
    fc.assert(
      fc.asyncProperty(chunkDataGen, async (initialChunk) => {
        const testEffect = Effect.gen(function* () {
          yield* repository.save(initialChunk)

          const updateFn = (chunk: ChunkData): ChunkData => ({
            ...chunk,
            metadata: {
              ...chunk.metadata,
              version: chunk.metadata.version + 1
            }
          })

          // 初回更新は成功する
          const updated = yield* repository.optimisticUpdate(
            initialChunk.coordinate,
            updateFn,
            0 // 初期バージョン
          )

          // 古いバージョンでの更新は失敗する
          const shouldFail = repository.optimisticUpdate(
            initialChunk.coordinate,
            updateFn,
            0 // 古いバージョン
          )

          const result = yield* Effect.either(shouldFail)
          assert(Either.isLeft(result), "古いバージョンでの更新は失敗するべき")
        })

        await Effect.runPromise(testEffect.pipe(
          Effect.provide(TestChunkRepositoryLive)
        ))
      })
    )
  )
})

// HTTP クライアントのプロパティテスト
const testHttpIntegrationProperties = Effect.gen(function* () {
  const httpService = yield* HttpIntegrationService

  // プロパティ1: 有効なプレイヤーIDに対してはレスポンスまたはエラーが返る
  yield* Effect.fromPromise(() =>
    fc.assert(
      fc.asyncProperty(fc.uuid(), async (playerId) => {
        const testEffect = Effect.gen(function* () {
          const result = yield* Effect.either(httpService.getPlayerData(playerId))

          // 成功またはエラーのいずれかであることを検証
          assert(Either.isLeft(result) || Either.isRight(result))

          if (Either.isRight(result)) {
            // 成功時はプレイヤーIDが一致することを検証
            assert.equal(result.right.playerId, playerId)
          }
        })

        await Effect.runPromise(testEffect.pipe(
          Effect.provide(TestHttpIntegrationServiceLive)
        ))
      })
    )
  )

  // プロパティ2: バッチ取得の結果数は要求数以下
  yield* Effect.fromPromise(() =>
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
        async (playerIds) => {
          const testEffect = Effect.gen(function* () {
            const results = yield* Effect.either(httpService.batchGetPlayers(playerIds))

            if (Either.isRight(results)) {
              // 結果数が要求数以下であることを検証
              assert(results.right.length <= playerIds.length)

              // 重複がないことを検証
              const resultIds = results.right.map(r => r.playerId)
              const uniqueIds = [...new Set(resultIds)]
              assert.equal(resultIds.length, uniqueIds.length)
            }
          })

          await Effect.runPromise(testEffect.pipe(
            Effect.provide(TestHttpIntegrationServiceLive)
          ))
        }
      )
    )
  )
})

// モック実装のファクトリー
const createMockHttpResponse = (playerId: string): PlayerDataResponse => ({
  playerId,
  position: { x: 0, y: 64, z: 0 },
  inventory: []
}) as PlayerDataResponse

const TestHttpIntegrationServiceLive = Layer.succeed(
  HttpIntegrationService,
  HttpIntegrationService.of({
    getPlayerData: (playerId) => Effect.succeed(createMockHttpResponse(playerId)),
    updatePlayerPosition: () => Effect.succeed(void 0),
    batchGetPlayers: (playerIds) => Effect.succeed(
      playerIds.map(createMockHttpResponse)
    )
  })
)

const TestChunkRepositoryLive = Layer.effect(
  ChunkRepository,
  Effect.gen(function* () {
    const storage = yield* Ref.make(new Map<string, ChunkData>())

    return ChunkRepository.of({
      save: (chunk) => Effect.gen(function* () {
        const key = `${chunk.coordinate.x},${chunk.coordinate.z}`
        yield* Ref.update(storage, (map) => new Map(map).set(key, chunk))
      }),

      load: (coordinate) => Effect.gen(function* () {
        const key = `${coordinate.x},${coordinate.z}`
        const map = yield* Ref.get(storage)
        return map.has(key) ? Option.some(map.get(key)!) : Option.none()
      }),

      loadBatch: (coordinates) => Effect.gen(function* () {
        const map = yield* Ref.get(storage)
        return coordinates
          .map(coord => {
            const key = `${coord.x},${coord.z}`
            return map.get(key)
          })
          .filter((chunk): chunk is ChunkData => chunk !== undefined)
      }),

      delete: (coordinate) => Effect.gen(function* () {
        const key = `${coordinate.x},${coordinate.z}`
        yield* Ref.update(storage, (map) => {
          const newMap = new Map(map)
          newMap.delete(key)
          return newMap
        })
      }),

      search: () => Effect.succeed({
        chunks: [],
        totalCount: 0,
        hasMore: false
      } as ChunkSearchResult),

      optimisticUpdate: (coordinate, updateFn, expectedVersion) => Effect.gen(function* () {
        const key = `${coordinate.x},${coordinate.z}`
        const map = yield* Ref.get(storage)
        const chunk = map.get(key)

        if (!chunk) {
          return yield* Effect.fail(new ChunkStorageError({
            operation: "optimisticUpdate",
            coordinate,
            message: "Chunk not found",
            timestamp: Date.now()
          }))
        }

        // 簡単なバージョンチェック（実装による）
        if (chunk.metadata.version !== expectedVersion) {
          return yield* Effect.fail(new ChunkStorageError({
            operation: "optimisticUpdate",
            coordinate,
            message: "Version conflict",
            timestamp: Date.now()
          }))
        }

        const updated = updateFn(chunk)
        yield* Ref.update(storage, (m) => new Map(m).set(key, updated))
        return updated
      })
    })
  })
)
```

## Testing Integration Patterns

### 統合テスト例
```typescript
const integrationTest = Effect.gen(function* () {
  const chunkService = yield* ChunkDomainService
  const coordinate = { x: 0, z: 0 }

  // チャンク生成
  const generatedChunk = yield* chunkService.generateChunk(coordinate)
  assert(generatedChunk.coordinate.x === coordinate.x)

  // チャンク永続化
  yield* chunkService.persistChunk(generatedChunk)

  // チャンク読み込み
  const loadedChunk = yield* chunkService.loadChunk(coordinate)
  assert.deepEqual(loadedChunk.blocks, generatedChunk.blocks)
}).pipe(
  Effect.provide(Layer.mergeAll(
    TestChunkStorageLive,
    TerrainGeneratorServiceLive
  ))
)

Effect.runPromise(integrationTest)

// プロパティベーステストの実行
const runPropertyTests = Effect.gen(function* () {
  yield* testChunkRepositoryProperties
  yield* testHttpIntegrationProperties
  yield* Effect.logInfo("All property-based tests completed successfully")
}).pipe(
  Effect.provide(Layer.mergeAll(
    TelemetryServiceLive,
    TestChunkRepositoryLive,
    TestHttpIntegrationServiceLive
  ))
)

Effect.runPromise(runPropertyTests)
```

この統合パターンカタログを活用することで、TypeScript MinecraftプロジェクトでのEffect-TSを使った堅牢なシステム間統合を実現できます。各パターンは実際の使用場面に応じて適切に選択し、組み合わせて使用してください。