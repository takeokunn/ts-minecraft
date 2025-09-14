---
title: "07 Integration Patterns"
description: "07 Integration Patternsに関する詳細な説明とガイド。"
category: "reference"
difficulty: "advanced"
tags: ["typescript", "minecraft"]
prerequisites: ["basic-typescript", "effect-ts-fundamentals"]
estimated_reading_time: "25分"
---


# System Integration Patterns

Effect-TSを使用したシステム間統合パターン。外部システム、サービス間通信、データ永続化、イベント処理などの統合ポイントにおける実装パターンを提供します。

## Pattern 1: Service-to-Service Communication

**使用場面**: 異なるドメインサービス間の通信

**実装**:
```typescript
// 通信エラーの定義
export const ServiceCommunicationError = Schema.TaggedError("ServiceCommunicationError")({
  sourceService: Schema.String,
  targetService: Schema.String,
  operation: Schema.String,
  reason: Schema.String,
  timestamp: Schema.Number
})

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

export const EventBusError = Schema.TaggedError("EventBusError")({
  operation: Schema.String,
  reason: Schema.String,
  eventType: Schema.optional(Schema.String),
  timestamp: Schema.Number
})

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
export const MessageQueueError = Schema.TaggedError("MessageQueueError")({
  operation: Schema.String,
  queueName: Schema.String,
  reason: Schema.String,
  timestamp: Schema.Number
})

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
import { NodeHttpClient } from "@effect/platform-node"
import { Config, Brand, Chunk, Match } from "effect"
import { Schedule, Duration, Queue, Stream, Fiber, ConfigProvider } from "effect"

// HTTP クライアント設定のブランド型
type ApiConfig = {
  readonly baseUrl: string
  readonly apiKey: string
  readonly timeout: Duration.Duration
  readonly retryPolicy: {
    readonly maxRetries: number
    readonly baseDelay: Duration.Duration
  }
  readonly circuitBreaker: {
    readonly failureThreshold: number
    readonly resetTimeout: Duration.Duration
  }
  readonly healthCheck: {
    readonly interval: Duration.Duration
    readonly timeout: Duration.Duration
  }
} & Brand.Brand<"ApiConfig">

// API レスポンスのブランド型
type PlayerDataResponse = {
  readonly playerId: string
  readonly position: { x: number, y: number, z: number }
  readonly inventory: ReadonlyArray<{ itemId: string, count: number }>
  readonly lastSeen: Date
  readonly serverStatus: "online" | "offline" | "maintenance"
} & Brand.Brand<"PlayerDataResponse">

export const HttpIntegrationError = Schema.TaggedError("HttpIntegrationError")({
  endpoint: Schema.String,
  method: Schema.String,
  statusCode: Schema.optional(Schema.Number),
  message: Schema.String,
  timestamp: Schema.Number
})

// HTTP クライアント設定スキーマ（拡張版）
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
  }),
  circuitBreaker: Schema.Struct({
    failureThreshold: Schema.Number.pipe(Schema.int(), Schema.between(1, 20)),
    resetTimeout: Schema.transformOrFail(
      Schema.Number,
      Schema.instanceOf(Duration.Duration),
      {
        strict: true,
        decode: (ms) => Effect.succeed(Duration.millis(ms)),
        encode: (duration) => Effect.succeed(Duration.toMillis(duration))
      }
    )
  }),
  healthCheck: Schema.Struct({
    interval: Schema.transformOrFail(
      Schema.Number,
      Schema.instanceOf(Duration.Duration),
      {
        strict: true,
        decode: (ms) => Effect.succeed(Duration.millis(ms)),
        encode: (duration) => Effect.succeed(Duration.toMillis(duration))
      }
    ),
    timeout: Schema.transformOrFail(
      Schema.Number,
      Schema.instanceOf(Duration.Duration),
      {
        strict: true,
        decode: (ms) => Effect.succeed(Duration.millis(ms)),
        encode: (duration) => Effect.succeed(Duration.toMillis(duration))
      }
    )
  })
}).pipe(
  Schema.brand("ApiConfig")
)

// プレイヤーデータレスポンスのスキーマ（拡張版）
const PlayerDataResponseSchema = Schema.Struct({
  playerId: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.message(() => "Player ID must contain only alphanumeric characters and hyphens")
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Number.pipe(Schema.finite(), Schema.between(0, 256)),
    z: Schema.Number.pipe(Schema.finite())
  }),
  inventory: Schema.Array(Schema.Struct({
    itemId: Schema.String.pipe(Schema.nonEmpty()),
    count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64))
  })).pipe(
    Schema.maxItems(40),
    Schema.message(() => "Inventory cannot exceed 40 items")
  ),
  lastSeen: Schema.DateTimeUtc,
  serverStatus: Schema.Union(
    Schema.Literal("online"),
    Schema.Literal("offline"),
    Schema.Literal("maintenance")
  )
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

// 拡張レート制限付きHTTPクライアント（ヘルスチェック機能付き）
const makeRateLimitedHttpClient = (config: ApiConfig) => Effect.gen(function* () {
  // レート制限キュー（1秒間に10リクエストまで）
  const rateLimitQueue = yield* Queue.bounded<void>(10)
  const healthStatus = yield* Ref.make({ isHealthy: true, lastCheck: Date.now() })

  // トークン補充ファイバー
  const tokenRefillFiber = yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        yield* Effect.sleep(Duration.millis(100))
        yield* Queue.offer(rateLimitQueue, void 0).pipe(
          Effect.ignore
        )
      })
    )
  )

  // ヘルスチェックファイバー
  const healthCheckFiber = yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        yield* Effect.sleep(config.healthCheck.interval)

        const healthCheckResult = yield* Effect.timeout(
          HttpClient.make().get(`${config.baseUrl}/health`),
          config.healthCheck.timeout
        ).pipe(
          Effect.match({
            onFailure: () => false,
            onSuccess: (response) => response.status >= 200 && response.status < 300
          })
        )

        yield* Ref.update(healthStatus, (status) => ({
          isHealthy: healthCheckResult,
          lastCheck: Date.now()
        }))

        if (!healthCheckResult) {
          yield* Effect.logWarn("Health check failed for API endpoint", {
            baseUrl: config.baseUrl,
            timestamp: Date.now()
          })
        }
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
        "User-Agent": "Minecraft-TS/1.0",
        "X-Request-ID": `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
    ),
    // ヘルスチェック確認
    HttpClient.tapRequest(() => Effect.gen(function* () {
      const status = yield* Ref.get(healthStatus)
      if (!status.isHealthy && Date.now() - status.lastCheck < Duration.toMillis(config.healthCheck.interval)) {
        return yield* Effect.fail(new HttpIntegrationError({
          endpoint: "health-check",
          method: "PRE_REQUEST",
          message: "Service is unhealthy, aborting request",
          timestamp: Date.now()
        }))
      }
      yield* Queue.take(rateLimitQueue)
    })),
    // エクスポネンシャルバックオフ付きリトライ
    HttpClient.retry(
      Schedule.exponential(config.retryPolicy.baseDelay, 1.5).pipe(
        Schedule.compose(Schedule.recurs(config.retryPolicy.maxRetries)),
        Schedule.intersect(Schedule.spaced(Duration.seconds(1)))
      )
    )
  )

  return {
    client: baseClient,
    cleanup: () => Effect.all([
      Fiber.interrupt(tokenRefillFiber),
      Fiber.interrupt(healthCheckFiber)
    ], { concurrency: "unbounded" })
  }
})

// 高度なサーキットブレーカー実装（統計とメトリクス付き）
interface AdvancedCircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED"
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private lastStateChange = Date.now()

  // 統計情報
  private readonly statistics = {
    totalRequests: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    stateTransitions: 0
  }

  constructor(
    private readonly config: {
      failureThreshold: number
      resetTimeout: Duration.Duration
      successThreshold: number // ハーフオープン時の成功閾値
      timeoutThreshold: Duration.Duration // 統計リセット時間
    }
  ) {}

  execute<A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E | HttpIntegrationError> {
    return Effect.gen(() => {
      this.statistics.totalRequests++
      const now = Date.now()

      // 統計の定期リセット
      if (now - this.lastStateChange > Duration.toMillis(this.config.timeoutThreshold)) {
        this.resetStatistics()
      }

      return Match.value(this.state).pipe(
        Match.when("OPEN", () => Effect.gen(() => {
          if (now - this.lastFailureTime >= Duration.toMillis(this.config.resetTimeout)) {
            this.setState("HALF_OPEN")
            return yield* this.executeWithTracking(effect)
          }

          return yield* Effect.fail(new HttpIntegrationError({
            endpoint: "circuit-breaker",
            method: "EXECUTE",
            message: `Circuit breaker is OPEN. Next retry in ${Duration.toMillis(this.config.resetTimeout) - (now - this.lastFailureTime)}ms`,
            timestamp: now
          }))
        })),
        Match.when("HALF_OPEN", () => Effect.gen(() => {
          return yield* this.executeWithTracking(effect).pipe(
            Effect.tap(() => Effect.sync(() => {
              this.successCount++
              if (this.successCount >= this.config.successThreshold) {
                this.setState("CLOSED")
                this.resetCounters()
              }
            })),
            Effect.tapError(() => Effect.sync(() => {
              this.setState("OPEN")
              this.lastFailureTime = Date.now()
            }))
          )
        })),
        Match.when("CLOSED", () => this.executeWithTracking(effect)),
        Match.exhaustive
      )
    }.bind(this))
  }

  private executeWithTracking<A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> {
    return effect.pipe(
      Effect.tap(() => Effect.sync(() => {
        this.statistics.totalSuccesses++
        if (this.state === "CLOSED") {
          this.failureCount = 0
        }
      })),
      Effect.tapError(() => Effect.sync(() => {
        this.statistics.totalFailures++
        this.failureCount++

        if (this.state === "CLOSED" && this.failureCount >= this.config.failureThreshold) {
          this.setState("OPEN")
          this.lastFailureTime = Date.now()
        }
      }))
    )
  }

  private setState(newState: "CLOSED" | "OPEN" | "HALF_OPEN"): void {
    if (newState !== this.state) {
      this.state = newState
      this.lastStateChange = Date.now()
      this.statistics.stateTransitions++
    }
  }

  private resetCounters(): void {
    this.failureCount = 0
    this.successCount = 0
  }

  private resetStatistics(): void {
    Object.assign(this.statistics, {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      stateTransitions: 0
    })
    this.lastStateChange = Date.now()
  }

  getStatistics() {
    return {
      ...this.statistics,
      currentState: this.state,
      failureRate: this.statistics.totalRequests > 0
        ? this.statistics.totalFailures / this.statistics.totalRequests
        : 0,
      uptime: Date.now() - this.lastStateChange
    }
  }
}


// HTTP サービス実装（ConfigProvider使用）
const makeHttpIntegrationService = Effect.gen(function* () {
  // ConfigProviderを使用した設定読み込み
  const configProvider = yield* ConfigProvider.ConfigProvider
  const config = yield* Config.nested("api", Schema.decodeUnknown(ApiConfigSchema)).pipe(
    Effect.withConfigProvider(configProvider)
  )

  const { client, cleanup } = yield* makeRateLimitedHttpClient(config)
  const circuitBreaker = new AdvancedCircuitBreaker({
    failureThreshold: config.circuitBreaker.failureThreshold,
    resetTimeout: config.circuitBreaker.resetTimeout,
    successThreshold: 3, // ハーフオープン時に3回成功でクローズ
    timeoutThreshold: Duration.minutes(5) // 5分で統計リセット
  })

  // Graceful shutdown対応
  yield* Effect.addFinalizer(() => Effect.gen(function* () {
    yield* Effect.logInfo("Shutting down HTTP client gracefully")
    yield* cleanup
    yield* Effect.logInfo("HTTP client shutdown complete")
  }))

  const executeWithCircuitBreaker = <A, E>(
    effect: Effect.Effect<A, E>
  ): Effect.Effect<A, E | HttpIntegrationError> => {
    return circuitBreaker.execute(effect).pipe(
      Effect.tapError((error) => Effect.gen(function* () {
        const stats = circuitBreaker.getStatistics()
        yield* Effect.logWarn("Circuit breaker execution failed", {
          error: error.message || "Unknown error",
          circuitBreakerState: stats.currentState,
          failureRate: stats.failureRate
        })
      }))
    )
  }

  return HttpIntegrationService.of({
    getPlayerData: (playerId) => {
      const request = HttpClientRequest.get(`${config.baseUrl}/players/${playerId}`).pipe(
        HttpClientRequest.setHeaders({
          "X-Request-Context": "player-data-fetch",
          "X-Player-ID": playerId
        })
      )

      return executeWithCircuitBreaker(
        client.execute(request).pipe(
          Effect.flatMap((response) => Match.value(response.status).pipe(
            Match.when((status) => status >= 200 && status < 300, () =>
              HttpClientResponse.schemaBodyJson(PlayerDataResponseSchema)(response)
            ),
            Match.when(404, () =>
              Effect.fail(new HttpIntegrationError({
                endpoint: `/players/${playerId}`,
                method: "GET",
                statusCode: 404,
                message: `Player ${playerId} not found`,
                timestamp: Date.now()
              }))
            ),
            Match.when((status) => status >= 500, () =>
              Effect.fail(new HttpIntegrationError({
                endpoint: `/players/${playerId}`,
                method: "GET",
                statusCode: response.status,
                message: `Server error: ${response.status}`,
                timestamp: Date.now()
              }))
            ),
            Match.orElse((status) =>
              Effect.fail(new HttpIntegrationError({
                endpoint: `/players/${playerId}`,
                method: "GET",
                statusCode: status,
                message: `HTTP ${status}`,
                timestamp: Date.now()
              }))
            )
          )),
          Effect.timeout(Duration.seconds(5)),
          Effect.retry({
            times: 2,
            while: (error) =>
              error instanceof HttpIntegrationError &&
              error.statusCode &&
              error.statusCode >= 500
          })
        )
      )
    },

    updatePlayerPosition: (playerId, position) => {
      const PositionUpdateSchema = Schema.Struct({
        x: Schema.Number.pipe(Schema.finite()),
        y: Schema.Number.pipe(Schema.finite(), Schema.between(0, 256)),
        z: Schema.Number.pipe(Schema.finite()),
        timestamp: Schema.optional(Schema.DateTimeUtc)
      })

      const validatedPosition = {
        ...position,
        timestamp: new Date()
      }

      return Effect.gen(function* () {
        // リクエスト前のバリデーション
        yield* Schema.decodeUnknown(PositionUpdateSchema)(validatedPosition)

        const request = HttpClientRequest.patch(`${config.baseUrl}/players/${playerId}/position`).pipe(
          HttpClientRequest.schemaBodyJson(PositionUpdateSchema)
        )(validatedPosition)

        return yield* executeWithCircuitBreaker(
          client.execute(request).pipe(
            Effect.flatMap((response) => Match.value(response.status).pipe(
              Match.when((status) => status >= 200 && status < 300, () =>
                Effect.succeed(void 0)
              ),
              Match.when(400, () =>
                Effect.fail(new HttpIntegrationError({
                  endpoint: `/players/${playerId}/position`,
                  method: "PATCH",
                  statusCode: 400,
                  message: "Invalid position data",
                  timestamp: Date.now()
                }))
              ),
              Match.when(409, () =>
                Effect.fail(new HttpIntegrationError({
                  endpoint: `/players/${playerId}/position`,
                  method: "PATCH",
                  statusCode: 409,
                  message: "Position update conflict",
                  timestamp: Date.now()
                }))
              ),
              Match.orElse((status) =>
                Effect.fail(new HttpIntegrationError({
                  endpoint: `/players/${playerId}/position`,
                  method: "PATCH",
                  statusCode: status,
                  message: `HTTP ${status}`,
                  timestamp: Date.now()
                }))
              )
            )),
            Effect.timeout(Duration.seconds(3)),
            Effect.retry({
              times: 1, // 位置更新は冪等でないため少なめ
              while: (error) =>
                error instanceof HttpIntegrationError &&
                error.statusCode === 409 // コンフリクトのみリトライ
            })
          )
        )
      })
    },

    batchGetPlayers: (playerIds) => {
      // より効率的なバッチ処理（エラーハンドリング強化）
      return Effect.gen(function* () {
        if (playerIds.length === 0) {
          return []
        }

        // 大きなバッチを分割（APIレート制限対応）
        const batchSize = 10
        const batches = []
        for (let i = 0; i < playerIds.length; i += batchSize) {
          batches.push(playerIds.slice(i, i + batchSize))
        }

        const results: PlayerDataResponse[] = []
        const errors: Array<{ playerId: string, error: HttpIntegrationError }> = []

        for (const batch of batches) {
          const batchResults = yield* Stream.fromIterable(batch).pipe(
            Stream.mapEffect(
              (playerId) =>
                executeWithCircuitBreaker(
                  client.execute(HttpClientRequest.get(`${config.baseUrl}/players/${playerId}`)).pipe(
                    Effect.flatMap(HttpClientResponse.schemaBodyJson(PlayerDataResponseSchema))
                  )
                ).pipe(
                  Effect.map((data) => ({ success: true as const, playerId, data })),
                  Effect.catchAll((error) =>
                    Effect.succeed({ success: false as const, playerId, error })
                  )
                ),
              { concurrency: 3 } // 控えめな並行度
            ),
            Stream.runCollect
          )

          for (const result of Chunk.toReadonlyArray(batchResults)) {
            if (result.success) {
              results.push(result.data)
            } else {
              errors.push({ playerId: result.playerId, error: result.error })
            }
          }

          // バッチ間の遅延（レート制限対策）
          if (batches.indexOf(batch) < batches.length - 1) {
            yield* Effect.sleep(Duration.millis(200))
          }
        }

        // エラーをログ出力（一部失敗は許容）
        if (errors.length > 0) {
          yield* Effect.logWarn(`Batch player fetch completed with ${errors.length} errors`, {
            totalRequested: playerIds.length,
            successful: results.length,
            failed: errors.length,
            errors: errors.map(e => ({ playerId: e.playerId, message: e.error.message }))
          })
        }

        return results
      })
    }
  })
})

export const HttpIntegrationServiceLive = Layer.scoped(
  HttpIntegrationService,
  makeHttpIntegrationService
).pipe(
  Layer.provide(NodeHttpClient.layerUndici)
)

// WebSocket統合（高度なコネクション管理とハートビート付き）
type WebSocketMessage = {
  readonly type: string
  readonly payload: unknown
  readonly timestamp: Date
  readonly messageId: string
} & Brand.Brand<"WebSocketMessage">

const WebSocketMessageSchema = Schema.Struct({
  type: Schema.String.pipe(Schema.nonEmpty()),
  payload: Schema.Unknown,
  timestamp: Schema.DateTimeUtc,
  messageId: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.message(() => "Message ID must contain only alphanumeric characters and hyphens")
  )
}).pipe(
  Schema.brand("WebSocketMessage")
)

export interface WebSocketService {
  readonly connect: (url: string) => Stream.Stream<WebSocketMessage, HttpIntegrationError>
  readonly send: (message: Omit<WebSocketMessage, "timestamp" | "messageId">) => Effect.Effect<void, HttpIntegrationError>
  readonly disconnect: () => Effect.Effect<void, never>
  readonly getConnectionStatus: () => Effect.Effect<"CONNECTING" | "OPEN" | "CLOSING" | "CLOSED", never>
}

export const WebSocketService = Context.GenericTag<WebSocketService>("@minecraft/WebSocketService")

const makeWebSocketService = Effect.gen(function* () {
  const connectionRef = yield* Ref.make<WebSocket | null>(null)
  const heartbeatFiberRef = yield* Ref.make<Fiber.Fiber<void, never> | null>(null)
  const reconnectAttempts = yield* Ref.make(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = Duration.seconds(5)

  const startHeartbeat = (ws: WebSocket) => Effect.gen(function* () {
    const heartbeatFiber = yield* Effect.fork(
      Effect.forever(
        Effect.gen(function* () {
          if (ws.readyState === WebSocket.OPEN) {
            const heartbeatMessage = {
              type: "heartbeat",
              payload: { timestamp: Date.now() },
              timestamp: new Date(),
              messageId: `heartbeat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
            yield* Effect.try({
              try: () => ws.send(JSON.stringify(heartbeatMessage)),
              catch: () => new Error("Heartbeat send failed")
            })
          }
          yield* Effect.sleep(Duration.seconds(30))
        })
      )
    )
    yield* Ref.set(heartbeatFiberRef, heartbeatFiber)
  })

  const stopHeartbeat = () => Effect.gen(function* () {
    const fiber = yield* Ref.get(heartbeatFiberRef)
    if (fiber) {
      yield* Fiber.interrupt(fiber)
      yield* Ref.set(heartbeatFiberRef, null)
    }
  })

  return WebSocketService.of({
    connect: (url) => Stream.async<WebSocketMessage, HttpIntegrationError>((emit) => {
      const connectWithRetry = () => {
        const ws = new WebSocket(url)

        ws.onopen = () => {
          Effect.runFork(
            Effect.gen(function* () {
              yield* Ref.set(connectionRef, ws)
              yield* Ref.set(reconnectAttempts, 0)
              yield* startHeartbeat(ws)
              yield* Effect.logInfo(`WebSocket connected to ${url}`, {
                url,
                readyState: ws.readyState,
                timestamp: new Date()
              })
            })
          )
        }

        ws.onmessage = (event) => {
          Effect.runFork(
            Effect.gen(function* () {
              try {
                const rawData = JSON.parse(event.data)
                const message = yield* Schema.decodeUnknown(WebSocketMessageSchema)(rawData)
                emit.single(message)
              } catch (error) {
                emit.fail(new HttpIntegrationError({
                  endpoint: url,
                  method: "RECEIVE",
                  message: `Failed to parse message: ${error}`,
                  timestamp: Date.now()
                }))
              }
            })
          )
        }

        ws.onerror = (error) => {
          Effect.runFork(
            Effect.logError("WebSocket error occurred", {
              url,
              error: error.toString(),
              timestamp: new Date()
            })
          )
        }

        ws.onclose = (closeEvent) => {
          Effect.runFork(
            Effect.gen(function* () {
              yield* stopHeartbeat()
              yield* Ref.set(connectionRef, null)

              const attempts = yield* Ref.get(reconnectAttempts)
              if (attempts < maxReconnectAttempts && closeEvent.code !== 1000) {
                yield* Ref.update(reconnectAttempts, n => n + 1)
                yield* Effect.logWarn(`WebSocket disconnected, retrying in ${Duration.toMillis(reconnectDelay)}ms`, {
                  url,
                  code: closeEvent.code,
                  reason: closeEvent.reason,
                  attempt: attempts + 1,
                  maxAttempts: maxReconnectAttempts
                })

                setTimeout(() => connectWithRetry(), Duration.toMillis(reconnectDelay))
              } else {
                emit.end()
              }
            })
          )
        }
      }

      connectWithRetry()

      return Effect.gen(function* () {
        yield* stopHeartbeat()
        const ws = yield* Ref.get(connectionRef)
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          ws.close(1000, "Client disconnect")
        }
      })
    }),

    send: (message) => Effect.gen(function* () {
      const ws = yield* Ref.get(connectionRef)
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return yield* Effect.fail(new HttpIntegrationError({
          endpoint: ws?.url || "unknown",
          method: "SEND",
          message: "WebSocket is not connected",
          timestamp: Date.now()
        }))
      }

      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: new Date(),
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      } as WebSocketMessage

      return yield* Effect.try({
        try: () => ws.send(JSON.stringify(fullMessage)),
        catch: (error) => new HttpIntegrationError({
          endpoint: ws.url,
          method: "SEND",
          message: `Failed to send message: ${error}`,
          timestamp: Date.now()
        })
      })
    }),

    disconnect: () => Effect.gen(function* () {
      yield* stopHeartbeat()
      const ws = yield* Ref.get(connectionRef)
      if (ws) {
        ws.close(1000, "Manual disconnect")
        yield* Ref.set(connectionRef, null)
      }
    }),

    getConnectionStatus: () => Effect.gen(function* () {
      const ws = yield* Ref.get(connectionRef)
      if (!ws) return "CLOSED"

      return Match.value(ws.readyState).pipe(
        Match.when(WebSocket.CONNECTING, () => "CONNECTING" as const),
        Match.when(WebSocket.OPEN, () => "OPEN" as const),
        Match.when(WebSocket.CLOSING, () => "CLOSING" as const),
        Match.when(WebSocket.CLOSED, () => "CLOSED" as const),
        Match.exhaustive
      )
    })
  })
})

export const WebSocketServiceLive = Layer.effect(WebSocketService, makeWebSocketService)

// 高度なマルチプレイヤー同期実装（エラーハンドリングと再接続機能付き）
const multiplayerSync = Effect.gen(function* () {
  const wsService = yield* WebSocketService
  const eventBus = yield* EventBusService
  const config = yield* Config.nested("multiplayer", Schema.Struct({
    serverUrl: Schema.String.pipe(Schema.startsWith("ws")),
    maxRetries: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
    heartbeatInterval: Schema.Number.pipe(Schema.int(), Schema.positive())
  }))

  // コネクション状態の監視
  const connectionMonitor = yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const status = yield* wsService.getConnectionStatus()
        yield* Effect.logDebug("WebSocket connection status", { status })

        if (status === "CLOSED") {
          yield* Effect.logWarn("WebSocket connection lost, will retry on next operation")
        }

        yield* Effect.sleep(Duration.seconds(config.heartbeatInterval))
      })
    )
  )

  // 受信ストリーム処理（エラーハンドリング強化）
  const incomingStream = wsService.connect(config.serverUrl)

  const incomingProcessor = yield* Effect.fork(
    incomingStream.pipe(
      Stream.mapEffect((wsMessage) => Effect.gen(function* () {
        // ハートビートメッセージは除外
        if (wsMessage.type === "heartbeat") {
          return
        }

        // ゲームイベントにデコード
        const gameEvent = yield* Effect.try({
          try: () => Schema.decodeSync(GameEventSchema)(wsMessage.payload),
          catch: (error) => new Error(`Failed to decode game event: ${error}`)
        })

        yield* eventBus.publish(gameEvent)
        yield* Effect.logDebug("Processed multiplayer event", {
          eventType: gameEvent._tag,
          messageId: wsMessage.messageId,
          timestamp: wsMessage.timestamp
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.logError("Failed to process incoming message", {
            error: error.message,
            messageType: wsMessage.type,
            messageId: wsMessage.messageId
          })
        )
      )),
      Stream.retry(
        Schedule.exponential(Duration.seconds(1), 1.5).pipe(
          Schedule.intersect(Schedule.recurs(config.maxRetries))
        )
      ),
      Stream.runDrain
    )
  )

  // 送信イベントの処理（バッファリングと再試行機能付き）
  const eventQueue = yield* Queue.bounded<GameEvent>(100)
  const eventSender = yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const events = yield* Queue.takeAll(eventQueue)

        if (Chunk.isNonEmpty(events)) {
          yield* Effect.forEach(events, (event) =>
            wsService.send({
              type: "game-event",
              payload: event
            }).pipe(
              Effect.retry({
                times: 3,
                while: (error) =>
                  error instanceof HttpIntegrationError &&
                  error.method === "SEND"
              }),
              Effect.timeout(Duration.seconds(5)),
              Effect.catchAll((error) =>
                Effect.logError("Failed to send event after retries", {
                  eventType: event._tag,
                  error: error.message
                })
              )
            ),
            { concurrency: 1 } // 順序保証のため
          )
        }

        yield* Effect.sleep(Duration.millis(100))
      })
    )
  )

  // イベント購読の設定
  yield* eventBus.subscribe("PlayerMoved", (event) =>
    Queue.offer(eventQueue, event).pipe(
      Effect.catchAll((error) =>
        Effect.logWarn("Failed to queue player move event", {
          playerId: event.playerId,
          error: error.message
        })
      )
    )
  )

  yield* eventBus.subscribe("BlockPlaced", (event) =>
    Queue.offer(eventQueue, event).pipe(
      Effect.catchAll((error) =>
        Effect.logWarn("Failed to queue block place event", {
          playerId: event.playerId,
          blockType: event.blockType,
          error: error.message
        })
      )
    )
  )

  // グレースフルシャットダウン
  yield* Effect.addFinalizer(() => Effect.gen(function* () {
    yield* Effect.logInfo("Shutting down multiplayer sync")
    yield* Fiber.interrupt(connectionMonitor)
    yield* Fiber.interrupt(incomingProcessor)
    yield* Fiber.interrupt(eventSender)
    yield* wsService.disconnect()
    yield* Effect.logInfo("Multiplayer sync shutdown complete")
  }))

  yield* Effect.logInfo("Multiplayer synchronization started", {
    serverUrl: config.serverUrl,
    maxRetries: config.maxRetries
  })
})
```

## Pattern 5: Database Integration with Effect SQL

**使用場面**: データの永続化とクエリ処理

**実装**:
```typescript
import { SqlClient, SqlError, Connection } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { Config, ConfigProvider } from "effect"

// データベース設定のブランド型
type DatabaseConfig = {
  readonly connectionString: string
  readonly maxConnections: number
  readonly connectionTimeoutMillis: number
  readonly acquireTimeoutMillis: number
} & Brand.Brand<"DatabaseConfig">

export const ChunkStorageError = Schema.TaggedError("ChunkStorageError")({
  operation: Schema.String,
  coordinate: Schema.optional(Schema.Unknown),
  table: Schema.optional(Schema.String),
  query: Schema.optional(Schema.String),
  message: Schema.String,
  timestamp: Schema.Number
})

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
        SELECT data, version FROM chunks
        WHERE x = ${coordinate.x} AND z = ${coordinate.z}
        LIMIT 1
      `.pipe(
        Effect.mapError((error: SqlError) => new ChunkStorageError({
          operation: "load",
          coordinate,
          table: "chunks",
          query: `SELECT data, version FROM chunks WHERE x = ${coordinate.x} AND z = ${coordinate.z}`,
          message: `Failed to load chunk: ${error.message}`,
          timestamp: Date.now()
        }))
      )

      if (results.length === 0) {
        return Option.none()
      }

      const row = results[0]
      const chunkData = yield* Effect.try({
        try: () => ({
          ...JSON.parse(row.data) as ChunkData,
          version: row.version // バージョン情報を追加
        }),
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

      // バッチサイズで分割（大量のIN句のパフォーマンス問題を回避）
      const batchSize = 100
      const results: ChunkData[] = []

      for (let i = 0; i < coordinates.length; i += batchSize) {
        const batch = coordinates.slice(i, i + batchSize)

        const batchResults = yield* sql`
          SELECT x, z, data, version, updated_at FROM chunks
          WHERE (x, z) IN (${sql.in(batch.map(c => [c.x, c.z]))})
          ORDER BY updated_at DESC
        `.pipe(
          Effect.mapError((error: SqlError) => new ChunkStorageError({
            operation: "loadBatch",
            table: "chunks",
            message: `Failed to load chunks batch: ${error.message}`,
            timestamp: Date.now()
          }))
        )

        const batchChunks = yield* Effect.forEach(batchResults, (row) =>
          Effect.try({
            try: () => ({
              ...JSON.parse(row.data) as ChunkData,
              version: row.version,
              lastUpdated: new Date(row.updated_at)
            }),
            catch: (error) => new ChunkStorageError({
              operation: "loadBatch",
              coordinate: { x: row.x, z: row.z },
              message: `Failed to parse chunk data: ${error}`,
              timestamp: Date.now()
            })
          })
        )

        results.push(...batchChunks)
      }

      return results
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

// 設定からレイヤーを作成（ConfigProvider使用）
const makeDatabaseLayer = Effect.gen(function* () {
  const configProvider = yield* ConfigProvider.ConfigProvider
  const config = yield* Config.nested("database", Schema.decodeUnknown(DatabaseConfigSchema)).pipe(
    Effect.withConfigProvider(configProvider)
  )

  // ヘルスチェック機能付きデータベースレイヤー
  const baseLayer = SqliteClient.layer({
    filename: config.connectionString,
    poolConfig: {
      max: config.maxConnections,
      min: Math.max(1, Math.floor(config.maxConnections / 4)),
      acquireTimeout: Duration.millis(config.acquireTimeoutMillis),
      idleTimeout: Duration.minutes(5),
      // ヘルスチェック設定
      testOnBorrow: true,
      validationQuery: "SELECT 1"
    }
  })

  return baseLayer
})

// データベース接続監視サービス
const makeDatabaseMonitorService = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const healthCheck = () => Effect.gen(function* () {
    const result = yield* sql`SELECT 1 as health_check`.pipe(
      Effect.timeout(Duration.seconds(5)),
      Effect.catchAll(() => Effect.succeed([]))
    )
    return result.length > 0
  })

  // 定期ヘルスチェック
  yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const isHealthy = yield* healthCheck()
        if (!isHealthy) {
          yield* Effect.logWarn("Database health check failed")
        } else {
          yield* Effect.logDebug("Database health check passed")
        }
        yield* Effect.sleep(Duration.seconds(30))
      })
    )
  )

  return { healthCheck }
})

export const DatabaseLive = Layer.unwrapEffect(makeDatabaseLayer)
export const DatabaseMonitorLive = Layer.effect(
  Context.GenericTag<{ healthCheck: () => Effect.Effect<boolean> }>("DatabaseMonitor"),
  makeDatabaseMonitorService
)
export const ChunkRepositoryLive = Layer.effect(ChunkRepository, makeChunkRepository).pipe(
  Layer.provide(Layer.mergeAll(DatabaseLive, DatabaseMonitorLive))
)

// 使用例: トランザクション付きバッチ処理（パフォーマンス最適化）
const saveChunksBatch = (chunks: ReadonlyArray<ChunkData>) => Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const repository = yield* ChunkRepository

  // 大量データの場合はバッチで分割
  const batchSize = 50
  const results = []

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)

    const batchResult = yield* sql.withTransaction(
      Effect.gen(function* () {
        // 一括インサートでパフォーマンス最適化
        const values = batch.map(chunk => `(
          ${chunk.coordinate.x},
          ${chunk.coordinate.z},
          '${JSON.stringify(chunk).replace(/'/g, "''")}',
          CURRENT_TIMESTAMP,
          0
        )`).join(', ')

        yield* sql`
          INSERT INTO chunks (x, z, data, updated_at, version)
          VALUES ${sql.raw(values)}
          ON CONFLICT(x, z) DO UPDATE SET
            data = excluded.data,
            updated_at = CURRENT_TIMESTAMP,
            version = version + 1
        `

        return batch.length
      }).pipe(
        Effect.tapError((error) =>
          Effect.logError(`Batch save failed for ${batch.length} chunks`, {
            batchStartIndex: i,
            error: error.message
          })
        )
      )
    )

    results.push(batchResult)

    // バッチ間の遅延（データベース負荷軽減）
    if (i + batchSize < chunks.length) {
      yield* Effect.sleep(Duration.millis(10))
    }
  }

  const totalSaved = results.reduce((sum, count) => sum + count, 0)
  yield* Effect.logInfo(`Batch save completed`, {
    totalChunks: chunks.length,
    saved: totalSaved,
    batches: results.length
  })

  return totalSaved
})

// 使用例: 高度な楽観的ロックを使った安全な更新（パフォーマンス最適化）
const updateChunkSafely = (
  coordinate: ChunkCoordinate,
  updateFn: (data: ChunkData) => ChunkData
) => Effect.gen(function* () {
  const repository = yield* ChunkRepository
  const maxRetries = 5
  let attempt = 0

  return yield* Effect.retry(
    Effect.gen(function* () {
      attempt++

      return yield* repository.optimisticUpdate(
        coordinate,
        (currentData) => {
          const updated = updateFn(currentData)
          // 更新時刻を記録
          return {
            ...updated,
            metadata: {
              ...updated.metadata,
              lastUpdated: Date.now(),
              updateAttempt: attempt
            }
          }
        },
        attempt === 1 ? 0 : -1 // 初回のみバージョンチェックを実行
      ).pipe(
        Effect.tapBoth({
          onFailure: (error) => Effect.logDebug(`Optimistic update attempt ${attempt} failed`, {
            coordinate,
            error: error.message,
            attempt
          }),
          onSuccess: (result) => Effect.logDebug(`Optimistic update succeeded on attempt ${attempt}`, {
            coordinate,
            version: result.version || "unknown",
            attempt
          })
        })
      )
    }),
    // エクスポネンシャルバックオフとジッターを組み合わせ
    Schedule.exponential(Duration.millis(50), 1.5).pipe(
      Schedule.intersect(Schedule.recurs(maxRetries - 1)),
      Schedule.jittered, // ランダムなジッターで競合状態を緩和
      Schedule.tapInput((input, output) =>
        Effect.logWarn(`Retrying chunk update due to version conflict`, {
          coordinate,
          attempt: input[1] + 1,
          nextDelay: `${Duration.toMillis(output.delay)}ms`
        })
      )
    )
  )
})
```

## Pattern 6: File System Integration

**使用場面**: ファイル操作、設定読み込み、アセット管理

**実装**:
```typescript
export const FileSystemError = Schema.TaggedError("FileSystemError")({
  operation: Schema.String,
  path: Schema.String,
  reason: Schema.String,
  timestamp: Schema.Number
})

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
export const ThreeJSError = Schema.TaggedError("ThreeJSError")({
  operation: Schema.String,
  component: Schema.String,
  message: Schema.String,
  timestamp: Schema.Number
})

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

export const ChunkStorageError = Schema.TaggedError("ChunkStorageError")({
  operation: Schema.String,
  coordinate: Schema.optional(Schema.Unknown),
  reason: Schema.String,
  timestamp: Schema.Number
})

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

## Pattern 9: ConfigProvider Integration

**使用場面**: 環境変数、設定ファイル、動的設定の統合管理

**実装**:
```typescript
import { Config, ConfigProvider, ConfigError } from "effect"
import { NodeFileSystem } from "@effect/platform-node"
import { FileSystem } from "@effect/platform"

// 設定スキーマの定義
const ServerConfigSchema = Schema.Struct({
  host: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9.-]+$/),
    Schema.message(() => "Host must contain only alphanumeric characters, dots, and hyphens")
  ),
  port: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1000, 65535),
    Schema.message(() => "Port must be between 1000 and 65535")
  ),
  database: Schema.Struct({
    url: Schema.String.pipe(Schema.startsWith("sqlite://")),
    maxConnections: Schema.Number.pipe(Schema.int(), Schema.positive()),
    timeout: Schema.Number.pipe(Schema.int(), Schema.positive())
  }),
  redis: Schema.Struct({
    host: Schema.String,
    port: Schema.Number.pipe(Schema.int(), Schema.between(1, 65535)),
    password: Schema.optional(Schema.String)
  }),
  features: Schema.Struct({
    enableMetrics: Schema.Boolean,
    enableTracing: Schema.Boolean,
    enableRateLimiting: Schema.Boolean
  })
}).pipe(
  Schema.brand("ServerConfig")
)

type ServerConfig = Schema.Schema.Type<typeof ServerConfigSchema>

// 複数のConfigProviderを組み合わせる実装
const createConfigProvider = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem

  // 1. 環境変数プロバイダー
  const envProvider = ConfigProvider.fromEnv()

  // 2. JSONファイルプロバイダー
  const jsonFileProvider = Effect.gen(function* () {
    const configExists = yield* fs.exists("./config/app.json")
    if (!configExists) {
      return ConfigProvider.fromMap(new Map()) // 空のプロバイダー
    }

    const configContent = yield* fs.readFileString("./config/app.json")
    const configData = yield* Effect.try({
      try: () => JSON.parse(configContent),
      catch: (error) => new ConfigError.InvalidData([], `Invalid JSON in config file: ${error}`)
    })

    const flattenConfig = (obj: any, prefix = ""): Map<string, string> => {
      const result = new Map<string, string>()

      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          const nested = flattenConfig(value, fullKey)
          nested.forEach((v, k) => result.set(k, v))
        } else {
          result.set(fullKey, String(value))
        }
      }

      return result
    }

    return ConfigProvider.fromMap(flattenConfig(configData))
  })

  // 3. デフォルト値プロバイダー
  const defaultProvider = ConfigProvider.fromMap(new Map([
    ["host", "localhost"],
    ["port", "3000"],
    ["database.maxConnections", "10"],
    ["database.timeout", "5000"],
    ["redis.host", "localhost"],
    ["redis.port", "6379"],
    ["features.enableMetrics", "true"],
    ["features.enableTracing", "false"],
    ["features.enableRateLimiting", "true"]
  ]))

  const fileProvider = yield* jsonFileProvider

  // 優先順位: 環境変数 > JSONファイル > デフォルト値
  return envProvider.pipe(
    ConfigProvider.orElse(() => fileProvider),
    ConfigProvider.orElse(() => defaultProvider)
  )
})

// 設定サービスの実装
export interface ConfigService {
  readonly getServerConfig: () => Effect.Effect<ServerConfig, ConfigError.ConfigError>
  readonly reloadConfig: () => Effect.Effect<ServerConfig, ConfigError.ConfigError>
  readonly watchConfig: () => Stream.Stream<ServerConfig, ConfigError.ConfigError>
}

export const ConfigService = Context.GenericTag<ConfigService>("@minecraft/ConfigService")

const makeConfigService = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const configProviderRef = yield* Ref.make(yield* createConfigProvider)
  const configCache = yield* Ref.make<ServerConfig | null>(null)

  const loadConfig = () => Effect.gen(function* () {
    const provider = yield* Ref.get(configProviderRef)
    const config = yield* Config.nested("minecraft", Schema.decodeUnknown(ServerConfigSchema)).pipe(
      Effect.withConfigProvider(provider)
    )
    yield* Ref.set(configCache, config)
    return config
  })

  // 設定ファイル監視（開発環境用）
  const startConfigWatcher = () => Effect.gen(function* () {
    const watchStream = Stream.async<ServerConfig, ConfigError.ConfigError>((emit) => {
      // ファイル変更監視のモック実装（実際にはNode.jsのfs.watchを使用）
      const interval = setInterval(async () => {
        try {
          const newProvider = await Effect.runPromise(createConfigProvider)
          const newConfig = await Effect.runPromise(
            Config.nested("minecraft", Schema.decodeUnknown(ServerConfigSchema)).pipe(
              Effect.withConfigProvider(newProvider)
            )
          )
          emit.single(newConfig)
        } catch (error) {
          emit.fail(error as ConfigError.ConfigError)
        }
      }, 5000) // 5秒ごとにチェック

      return Effect.sync(() => {
        clearInterval(interval)
      })
    })

    return watchStream
  })

  return ConfigService.of({
    getServerConfig: () => Effect.gen(function* () {
      const cached = yield* Ref.get(configCache)
      if (cached) {
        return cached
      }
      return yield* loadConfig()
    }),

    reloadConfig: () => Effect.gen(function* () {
      yield* Effect.logInfo("Reloading configuration...")
      const newProvider = yield* createConfigProvider
      yield* Ref.set(configProviderRef, newProvider)
      const config = yield* loadConfig()
      yield* Effect.logInfo("Configuration reloaded successfully", {
        host: config.host,
        port: config.port,
        featuresEnabled: Object.entries(config.features)
          .filter(([_, enabled]) => enabled)
          .map(([feature, _]) => feature)
      })
      return config
    }),

    watchConfig: startConfigWatcher
  })
})

export const ConfigServiceLive = Layer.effect(ConfigService, makeConfigService).pipe(
  Layer.provide(NodeFileSystem.layer)
)

// 使用例: 設定に基づく条件付きサービス起動
const startServices = Effect.gen(function* () {
  const configService = yield* ConfigService
  const config = yield* configService.getServerConfig()

  const services = []

  // 基本サーバー（必須）
  services.push(
    Effect.logInfo(`Starting server on ${config.host}:${config.port}`)
  )

  // 条件付きサービス起動
  if (config.features.enableMetrics) {
    services.push(
      Effect.logInfo("Starting metrics collection service")
      // メトリクスサービスの起動ロジック
    )
  }

  if (config.features.enableTracing) {
    services.push(
      Effect.logInfo("Starting distributed tracing service")
      // トレーシングサービスの起動ロジック
    )
  }

  if (config.features.enableRateLimiting) {
    services.push(
      Effect.logInfo("Starting rate limiting service")
      // レート制限サービスの起動ロジック
    )
  }

  yield* Effect.all(services, { concurrency: "unbounded" })

  // 設定変更の監視
  yield* Effect.fork(
    configService.watchConfig().pipe(
      Stream.mapEffect((newConfig) =>
        Effect.logInfo("Configuration updated", {
          timestamp: new Date(),
          changes: {
            host: newConfig.host,
            port: newConfig.port
          }
        })
      ),
      Stream.runDrain
    )
  )
})
```

## Pattern 10: Telemetry and Observability Integration

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

## Pattern 11: Health Check and Circuit Breaker Integration

**使用場面**: システムの可用性とレジリエンスの向上

**実装**:
```typescript
// ヘルスチェック結果の型定義
type HealthStatus = {
  readonly service: string
  readonly status: "healthy" | "unhealthy" | "degraded"
  readonly lastCheck: Date
  readonly responseTime: number
  readonly metadata: Record<string, unknown>
} & Brand.Brand<"HealthStatus">

const HealthStatusSchema = Schema.Struct({
  service: Schema.String.pipe(Schema.nonEmpty()),
  status: Schema.Union(
    Schema.Literal("healthy"),
    Schema.Literal("unhealthy"),
    Schema.Literal("degraded")
  ),
  lastCheck: Schema.DateTimeUtc,
  responseTime: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  metadata: Schema.Record(Schema.String, Schema.Unknown)
}).pipe(
  Schema.brand("HealthStatus")
)

// ヘルスチェックサービス
export interface HealthCheckService {
  readonly checkHealth: (serviceName: string) => Effect.Effect<HealthStatus, never>
  readonly getOverallHealth: () => Effect.Effect<{
    readonly status: "healthy" | "unhealthy" | "degraded"
    readonly services: ReadonlyArray<HealthStatus>
    readonly timestamp: Date
  }, never>
  readonly registerHealthCheck: (
    serviceName: string,
    checkFn: () => Effect.Effect<boolean, unknown>
  ) => Effect.Effect<void, never>
}

export const HealthCheckService = Context.GenericTag<HealthCheckService>("@minecraft/HealthCheckService")

const makeHealthCheckService = Effect.gen(function* () {
  const healthChecks = yield* Ref.make(
    new Map<string, () => Effect.Effect<boolean, unknown>>()
  )
  const healthStatuses = yield* Ref.make(
    new Map<string, HealthStatus>()
  )

  // 定期ヘルスチェック実行
  const runPeriodicHealthChecks = () => Effect.gen(function* () {
    const checks = yield* Ref.get(healthChecks)
    const currentTime = new Date()

    yield* Effect.forEach(
      Array.from(checks.entries()),
      ([serviceName, checkFn]) => Effect.gen(function* () {
        const startTime = Date.now()

        const result = yield* checkFn().pipe(
          Effect.timeout(Duration.seconds(10)),
          Effect.match({
            onFailure: () => false,
            onSuccess: (healthy) => healthy
          })
        )

        const endTime = Date.now()
        const responseTime = endTime - startTime

        const status: HealthStatus = {
          service: serviceName,
          status: result ? "healthy" : "unhealthy",
          lastCheck: currentTime,
          responseTime,
          metadata: {
            checkDuration: responseTime,
            timestamp: currentTime.toISOString()
          }
        } as HealthStatus

        yield* Ref.update(healthStatuses, (statuses) =>
          new Map(statuses).set(serviceName, status)
        )
      }),
      { concurrency: "unbounded" }
    )
  })

  // 定期実行のスケジュール
  yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        yield* runPeriodicHealthChecks()
        yield* Effect.sleep(Duration.seconds(30))
      })
    )
  )

  return HealthCheckService.of({
    checkHealth: (serviceName) => Effect.gen(function* () {
      const statuses = yield* Ref.get(healthStatuses)
      const status = statuses.get(serviceName)

      if (!status) {
        return {
          service: serviceName,
          status: "unhealthy",
          lastCheck: new Date(),
          responseTime: 0,
          metadata: { error: "Service not registered" }
        } as HealthStatus
      }

      return status
    }),

    getOverallHealth: () => Effect.gen(function* () {
      const statuses = yield* Ref.get(healthStatuses)
      const serviceStatuses = Array.from(statuses.values())

      const unhealthyCount = serviceStatuses.filter(s => s.status === "unhealthy").length
      const degradedCount = serviceStatuses.filter(s => s.status === "degraded").length
      const totalServices = serviceStatuses.length

      let overallStatus: "healthy" | "unhealthy" | "degraded"
      if (unhealthyCount === 0 && degradedCount === 0) {
        overallStatus = "healthy"
      } else if (unhealthyCount / totalServices > 0.5) {
        overallStatus = "unhealthy"
      } else {
        overallStatus = "degraded"
      }

      return {
        status: overallStatus,
        services: serviceStatuses,
        timestamp: new Date()
      }
    }),

    registerHealthCheck: (serviceName, checkFn) => Effect.gen(function* () {
      yield* Ref.update(healthChecks, (checks) =>
        new Map(checks).set(serviceName, checkFn)
      )
      yield* Effect.logInfo(`Health check registered for service: ${serviceName}`)
    })
  })
})

export const HealthCheckServiceLive = Layer.effect(HealthCheckService, makeHealthCheckService)

// 統合されたサーキットブレーカー＋ヘルスチェック
interface IntegratedCircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED"
  private failureCount = 0
  private lastFailureTime = 0
  private lastSuccessTime = Date.now()

  constructor(
    private readonly config: {
      failureThreshold: number
      resetTimeout: Duration.Duration
      healthCheckService: HealthCheckService
    }
  ) {}

  execute<A, E>(
    serviceName: string,
    effect: Effect.Effect<A, E>
  ): Effect.Effect<A, E | HttpIntegrationError> {
    return Effect.gen(() => {
      // まずヘルスチェック状態を確認
      const healthStatus = yield* this.config.healthCheckService.checkHealth(serviceName)

      if (healthStatus.status === "unhealthy" && this.state === "CLOSED") {
        this.state = "OPEN"
        this.lastFailureTime = Date.now()
      }

      return Match.value(this.state).pipe(
        Match.when("OPEN", () => Effect.gen(() => {
          const now = Date.now()
          if (now - this.lastFailureTime >= Duration.toMillis(this.config.resetTimeout)) {
            this.state = "HALF_OPEN"
            return yield* this.executeWithTracking(serviceName, effect)
          }

          return yield* Effect.fail(new HttpIntegrationError({
            endpoint: serviceName,
            method: "CIRCUIT_BREAKER",
            message: `Circuit breaker is OPEN for ${serviceName}. Health status: ${healthStatus.status}`,
            timestamp: now
          }))
        })),
        Match.when("HALF_OPEN", () =>
          this.executeWithTracking(serviceName, effect).pipe(
            Effect.tap(() => Effect.sync(() => {
              this.state = "CLOSED"
              this.failureCount = 0
              this.lastSuccessTime = Date.now()
            })),
            Effect.tapError(() => Effect.sync(() => {
              this.state = "OPEN"
              this.lastFailureTime = Date.now()
            }))
          )
        ),
        Match.when("CLOSED", () => this.executeWithTracking(serviceName, effect)),
        Match.exhaustive
      )
    }.bind(this))
  }

  private executeWithTracking<A, E>(
    serviceName: string,
    effect: Effect.Effect<A, E>
  ): Effect.Effect<A, E> {
    return effect.pipe(
      Effect.tap(() => Effect.sync(() => {
        this.failureCount = 0
        this.lastSuccessTime = Date.now()
      })),
      Effect.tapError(() => Effect.sync(() => {
        this.failureCount++
        if (this.failureCount >= this.config.failureThreshold) {
          this.state = "OPEN"
          this.lastFailureTime = Date.now()
        }
      }))
    )
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      uptime: Date.now() - this.lastSuccessTime
    }
  }
}

// 使用例: 統合ヘルスチェック
const setupIntegratedHealthSystem = Effect.gen(function* () {
  const healthService = yield* HealthCheckService
  const httpService = yield* HttpIntegrationService

  // 各サービスのヘルスチェック登録
  yield* healthService.registerHealthCheck("database", () => Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const result = yield* sql`SELECT 1`.pipe(
      Effect.timeout(Duration.seconds(5)),
      Effect.match({
        onFailure: () => false,
        onSuccess: (rows) => rows.length > 0
      })
    )
    return result
  }))

  yield* healthService.registerHealthCheck("external-api", () => Effect.gen(function* () {
    const testResult = yield* httpService.getPlayerData("health-check-test").pipe(
      Effect.timeout(Duration.seconds(10)),
      Effect.match({
        onFailure: () => false,
        onSuccess: () => true
      })
    )
    return testResult
  }))

  yield* healthService.registerHealthCheck("redis", () => Effect.gen(function* () {
    // Redis接続チェックのモック
    return yield* Effect.succeed(true)
  }))

  // 統合サーキットブレーカー初期化
  const circuitBreaker = new IntegratedCircuitBreaker({
    failureThreshold: 5,
    resetTimeout: Duration.seconds(30),
    healthCheckService: healthService
  })

  // 全体ヘルスチェック監視
  yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const overall = yield* healthService.getOverallHealth()

        yield* Effect.logInfo("System health check", {
          overallStatus: overall.status,
          totalServices: overall.services.length,
          healthyServices: overall.services.filter(s => s.status === "healthy").length,
          unhealthyServices: overall.services.filter(s => s.status === "unhealthy").length,
          degradedServices: overall.services.filter(s => s.status === "degraded").length
        })

        if (overall.status !== "healthy") {
          const unhealthyServices = overall.services
            .filter(s => s.status !== "healthy")
            .map(s => `${s.service}: ${s.status}`)
            .join(", ")

          yield* Effect.logWarn(`System health degraded: ${unhealthyServices}`)
        }

        yield* Effect.sleep(Duration.seconds(60))
      })
    )
  )

  return { healthService, circuitBreaker }
})
```

## Pattern 12: Property-Based Testing for Integration

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

## Pattern 13: Graceful Shutdown and Resource Management

**使用場面**: アプリケーションの安全な終了とリソースクリーンアップ

**実装**:
```typescript
// シャットダウンフックの管理
export interface GracefulShutdownService {
  readonly registerShutdownHook: (
    name: string,
    cleanup: () => Effect.Effect<void, never>
  ) => Effect.Effect<void, never>
  readonly shutdown: (signal?: string) => Effect.Effect<void, never>
  readonly isShuttingDown: () => Effect.Effect<boolean, never>
}

export const GracefulShutdownService = Context.GenericTag<GracefulShutdownService>(
  "@minecraft/GracefulShutdownService"
)

const makeGracefulShutdownService = Effect.gen(function* () {
  const shutdownHooks = yield* Ref.make(
    new Map<string, () => Effect.Effect<void, never>>()
  )
  const isShuttingDown = yield* Ref.make(false)
  const shutdownTimeout = Duration.seconds(30)

  // プロセスシグナルハンドラーの設定
  const setupSignalHandlers = () => Effect.gen(function* () {
    const handleSignal = (signal: string) => () => {
      Effect.runFork(
        Effect.gen(function* () {
          yield* Effect.logInfo(`Received ${signal}, initiating graceful shutdown...`)
          yield* shutdown(signal)
        })
      )
    }

    if (typeof process !== 'undefined') {
      process.once('SIGTERM', handleSignal('SIGTERM'))
      process.once('SIGINT', handleSignal('SIGINT'))
      process.once('SIGUSR2', handleSignal('SIGUSR2')) // nodemonなど開発ツール用
    }
  })

  const shutdown = (signal?: string) => Effect.gen(function* () {
    const alreadyShuttingDown = yield* Ref.get(isShuttingDown)
    if (alreadyShuttingDown) {
      yield* Effect.logWarn("Shutdown already in progress")
      return
    }

    yield* Ref.set(isShuttingDown, true)
    const hooks = yield* Ref.get(shutdownHooks)
    const hookEntries = Array.from(hooks.entries())

    yield* Effect.logInfo(`Starting graceful shutdown`, {
      signal: signal || "manual",
      hooksToExecute: hookEntries.length,
      timeout: Duration.toMillis(shutdownTimeout)
    })

    // 全てのシャットダウンフックを並列実行（タイムアウト付き）
    const shutdownResults = yield* Effect.forEach(
      hookEntries,
      ([name, cleanup]) => Effect.gen(function* () {
        const startTime = Date.now()
        yield* Effect.logDebug(`Executing shutdown hook: ${name}`)

        return yield* cleanup().pipe(
          Effect.timeout(Duration.seconds(10)),
          Effect.tap(() => Effect.logDebug(`Shutdown hook completed: ${name}`, {
            duration: Date.now() - startTime
          })),
          Effect.catchAll((error) =>
            Effect.logError(`Shutdown hook failed: ${name}`, { error })
          ),
          Effect.as({ name, success: true })
        )
      }),
      { concurrency: "unbounded" }
    ).pipe(
      Effect.timeout(shutdownTimeout),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError("Shutdown hooks timed out", {
            error,
            timeoutMs: Duration.toMillis(shutdownTimeout)
          })
          return []
        })
      )
    )

    const successful = shutdownResults.filter(r => r.success).length
    const total = hookEntries.length

    yield* Effect.logInfo("Graceful shutdown completed", {
      successful,
      total,
      signal: signal || "manual"
    })

    // Node.jsプロセスの終了
    if (typeof process !== 'undefined') {
      process.exit(0)
    }
  })

  yield* setupSignalHandlers()

  return GracefulShutdownService.of({
    registerShutdownHook: (name, cleanup) => Effect.gen(function* () {
      yield* Ref.update(shutdownHooks, (hooks) =>
        new Map(hooks).set(name, cleanup)
      )
      yield* Effect.logDebug(`Registered shutdown hook: ${name}`)
    }),

    shutdown,

    isShuttingDown: () => Ref.get(isShuttingDown)
  })
})

export const GracefulShutdownServiceLive = Layer.effect(
  GracefulShutdownService,
  makeGracefulShutdownService
)

// リソース管理サービス
export interface ResourceManagerService {
  readonly acquireResource: <R>(
    name: string,
    acquire: () => Effect.Effect<R, never>,
    release: (resource: R) => Effect.Effect<void, never>
  ) => Effect.Effect<R, never>
  readonly getResourceStatus: () => Effect.Effect<{
    readonly totalResources: number
    readonly resources: ReadonlyArray<{
      readonly name: string
      readonly acquired: Date
      readonly status: "active" | "released"
    }>
  }, never>
}

export const ResourceManagerService = Context.GenericTag<ResourceManagerService>(
  "@minecraft/ResourceManagerService"
)

const makeResourceManagerService = Effect.gen(function* () {
  const resources = yield* Ref.make(
    new Map<string, {
      resource: unknown
      release: (resource: unknown) => Effect.Effect<void, never>
      acquired: Date
      status: "active" | "released"
    }>()
  )

  const shutdownService = yield* GracefulShutdownService

  // リソース解放のシャットダウンフック登録
  yield* shutdownService.registerShutdownHook("resource-manager", () =>
    Effect.gen(function* () {
      const currentResources = yield* Ref.get(resources)
      const activeResources = Array.from(currentResources.entries())
        .filter(([_, info]) => info.status === "active")

      yield* Effect.logInfo(`Releasing ${activeResources.length} active resources`)

      yield* Effect.forEach(
        activeResources,
        ([name, info]) => Effect.gen(function* () {
          yield* Effect.logDebug(`Releasing resource: ${name}`)
          yield* info.release(info.resource)
          yield* Ref.update(resources, (res) => {
            const updated = new Map(res)
            const resourceInfo = updated.get(name)
            if (resourceInfo) {
              updated.set(name, { ...resourceInfo, status: "released" })
            }
            return updated
          })
        }),
        { concurrency: 3 } // 同時に3つまでのリソースを解放
      )
    })
  )

  return ResourceManagerService.of({
    acquireResource: (name, acquire, release) => Effect.gen(function* () {
      yield* Effect.logDebug(`Acquiring resource: ${name}`)

      const resource = yield* acquire()
      const resourceInfo = {
        resource,
        release,
        acquired: new Date(),
        status: "active" as const
      }

      yield* Ref.update(resources, (res) =>
        new Map(res).set(name, resourceInfo)
      )

      yield* Effect.logDebug(`Resource acquired: ${name}`, {
        acquiredAt: resourceInfo.acquired
      })

      return resource
    }),

    getResourceStatus: () => Effect.gen(function* () {
      const currentResources = yield* Ref.get(resources)
      const resourceList = Array.from(currentResources.entries()).map(
        ([name, info]) => ({
          name,
          acquired: info.acquired,
          status: info.status
        })
      )

      return {
        totalResources: resourceList.length,
        resources: resourceList
      }
    })
  })
})

export const ResourceManagerServiceLive = Layer.effect(
  ResourceManagerService,
  makeResourceManagerService
).pipe(
  Layer.provide(GracefulShutdownServiceLive)
)

// アプリケーション統合の実装例
const createMinecraftApplication = Effect.gen(function* () {
  const gracefulShutdown = yield* GracefulShutdownService
  const resourceManager = yield* ResourceManagerService
  const configService = yield* ConfigService
  const healthCheck = yield* HealthCheckService

  // 各サービスのシャットダウンフック登録
  yield* gracefulShutdown.registerShutdownHook("config-service", () =>
    Effect.logInfo("Config service shutdown completed")
  )

  yield* gracefulShutdown.registerShutdownHook("health-check", () =>
    Effect.logInfo("Health check service stopped")
  )

  // データベース接続リソースの管理
  const dbConnection = yield* resourceManager.acquireResource(
    "database-connection",
    () => Effect.gen(function* () {
      yield* Effect.logInfo("Establishing database connection")
      // データベース接続の実装
      return { connected: true, connectionId: "db-001" }
    }),
    (connection) => Effect.gen(function* () {
      yield* Effect.logInfo("Closing database connection", { connectionId: connection.connectionId })
      // 接続クローズの実装
    })
  )

  // HTTP サーバーリソースの管理
  const httpServer = yield* resourceManager.acquireResource(
    "http-server",
    () => Effect.gen(function* () {
      const config = yield* configService.getServerConfig()
      yield* Effect.logInfo(`Starting HTTP server on ${config.host}:${config.port}`)
      // サーバー起動の実装
      return { listening: true, port: config.port }
    }),
    (server) => Effect.gen(function* () {
      yield* Effect.logInfo("Stopping HTTP server", { port: server.port })
      // サーバー停止の実装
    })
  )

  // アプリケーション起動完了ログ
  yield* Effect.logInfo("Minecraft TypeScript server started successfully", {
    dbConnectionId: dbConnection.connectionId,
    httpServerPort: httpServer.port,
    pid: typeof process !== 'undefined' ? process.pid : 'unknown'
  })

  // リソース状態の定期監視
  yield* Effect.fork(
    Effect.forever(
      Effect.gen(function* () {
        const resourceStatus = yield* resourceManager.getResourceStatus()
        const healthStatus = yield* healthCheck.getOverallHealth()

        yield* Effect.logDebug("System status check", {
          totalResources: resourceStatus.totalResources,
          activeResources: resourceStatus.resources.filter(r => r.status === "active").length,
          systemHealth: healthStatus.status
        })

        yield* Effect.sleep(Duration.minutes(1))
      })
    )
  )

  return {
    dbConnection,
    httpServer,
    shutdown: () => gracefulShutdown.shutdown("manual")
  }
})
```

この統合パターンカタログを活用することで、TypeScript MinecraftプロジェクトでのEffect-TSを使った堅牢で監視可能、かつ障害に強いシステム間統合を実現できます。各パターンは実際の使用場面に応じて適切に選択し、組み合わせて使用してください。

特に重要なポイント:

1. **ConfigProvider**による設定の一元管理と環境対応
2. **Circuit Breaker**と**Health Check**の統合による障害対応
3. **Graceful Shutdown**による安全なアプリケーション終了
4. **Match.value**を使った型安全なパターンマッチング
5. **Schema**による実行時型検証とブランド型の活用
6. **Effect.retry**とスケジューリングによる堅牢なエラーハンドリング
7. **Stream**を使った効率的な非同期処理
8. **Resource Management**による適切なリソース管理