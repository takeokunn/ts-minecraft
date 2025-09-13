---
title: "02 Event Bus Specification"
description: "02 Event Bus Specificationに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "15分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Event Bus仕様

## 概要

ゲーム内イベントシステムの仕様定義です。Effect-TSのPubSubとStreamを活用した、型安全で高性能なイベント駆動アーキテクチャを実現します。

## Event Type定義

### Game Events (Tagged Union)

```typescript
// Schema-based ゲームイベント定義（型安全性向上）
export const PlayerEventSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('PlayerJoined'),
    playerId: Schema.String,
    timestamp: Schema.Number,
    playerName: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerLeft'),
    playerId: Schema.String,
    timestamp: Schema.Number,
    reason: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerMoved'),
    playerId: Schema.String,
    from: PositionSchema,
    to: PositionSchema,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerDamaged'),
    playerId: Schema.String,
    damage: Schema.Number,
    source: DamageSourceSchema,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerDied'),
    playerId: Schema.String,
    cause: DeathCauseSchema,
    position: PositionSchema,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerRespawned'),
    playerId: Schema.String,
    position: PositionSchema,
    timestamp: Schema.Number
  })
)

export const BlockEventSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('BlockPlaced'),
    position: PositionSchema,
    blockType: BlockTypeSchema,
    placedBy: Schema.String,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal('BlockBroken'),
    position: PositionSchema,
    blockType: BlockTypeSchema,
    brokenBy: Schema.String,
    timestamp: Schema.Number
  })
)

export const GameEventSchema = Schema.Union(
  PlayerEventSchema,
  BlockEventSchema
  // ... 他のイベントスキーマ
)

export type GameEvent =
  // Player Events
  | { readonly _tag: 'PlayerJoined'; readonly playerId: string; readonly timestamp: number }
  | { readonly _tag: 'PlayerLeft'; readonly playerId: string; readonly timestamp: number }
  | { readonly _tag: 'PlayerMoved'; readonly playerId: string; readonly from: Position; readonly to: Position }
  | { readonly _tag: 'PlayerDamaged'; readonly playerId: string; readonly damage: number; readonly source: DamageSource }
  | { readonly _tag: 'PlayerDied'; readonly playerId: string; readonly cause: DeathCause; readonly position: Position }
  | { readonly _tag: 'PlayerRespawned'; readonly playerId: string; readonly position: Position }

  // Block Events
  | { readonly _tag: 'BlockPlaced'; readonly position: Position; readonly blockType: BlockType; readonly placedBy: string }
  | { readonly _tag: 'BlockBroken'; readonly position: Position; readonly blockType: BlockType; readonly brokenBy: string }
  | { readonly _tag: 'BlockUpdated'; readonly position: Position; readonly oldState: BlockState; readonly newState: BlockState }
  | { readonly _tag: 'BlockExploded'; readonly positions: ReadonlyArray<Position>; readonly source: ExplosionSource }

  // Chunk Events
  | { readonly _tag: 'ChunkLoaded'; readonly chunkPosition: ChunkPosition; readonly entities: number }
  | { readonly _tag: 'ChunkUnloaded'; readonly chunkPosition: ChunkPosition }
  | { readonly _tag: 'ChunkGenerated'; readonly chunkPosition: ChunkPosition; readonly generationTime: number }
  | { readonly _tag: 'ChunkModified'; readonly chunkPosition: ChunkPosition; readonly modifications: number }

  // Entity Events
  | { readonly _tag: 'EntitySpawned'; readonly entityId: string; readonly entityType: EntityType; readonly position: Position }
  | { readonly _tag: 'EntityDespawned'; readonly entityId: string; readonly reason: DespawnReason }
  | { readonly _tag: 'EntityMoved'; readonly entityId: string; readonly from: Position; readonly to: Position }
  | { readonly _tag: 'EntityDamaged'; readonly entityId: string; readonly damage: number; readonly source: DamageSource }

  // Inventory Events
  | { readonly _tag: 'ItemPickedUp'; readonly playerId: string; readonly item: ItemStack; readonly position: Position }
  | { readonly _tag: 'ItemDropped'; readonly playerId: string; readonly item: ItemStack; readonly position: Position }
  | { readonly _tag: 'ItemCrafted'; readonly playerId: string; readonly item: ItemStack; readonly recipe: Recipe }
  | { readonly _tag: 'ItemUsed'; readonly playerId: string; readonly item: ItemStack; readonly target?: Position }

  // World Events
  | { readonly _tag: 'WorldSaved'; readonly worldId: string; readonly timestamp: number }
  | { readonly _tag: 'WorldLoaded'; readonly worldId: string; readonly timestamp: number }
  | { readonly _tag: 'WeatherChanged'; readonly oldWeather: Weather; readonly newWeather: Weather }
  | { readonly _tag: 'TimeChanged'; readonly time: number; readonly isDay: boolean }
```

### System Events

```typescript
export type SystemEvent =
  | { readonly _tag: 'PerformanceWarning'; readonly metric: string; readonly value: number; readonly threshold: number }
  | { readonly _tag: 'MemoryPressure'; readonly usage: number; readonly available: number }
  | { readonly _tag: 'NetworkLatency'; readonly latency: number; readonly playerId: string }
  | { readonly _tag: 'ErrorOccurred'; readonly error: Error; readonly context: string }
  | { readonly _tag: 'ConfigChanged'; readonly key: string; readonly oldValue: unknown; readonly newValue: unknown }
```

## Event Bus Service

### Core Event Bus API

```typescript
export interface EventBusService {
  readonly _: unique symbol
}

export const EventBusService = Context.GenericTag<EventBusService, {
  // イベント発行
  publish: <E extends GameEvent | SystemEvent>(
    event: E
  ) => Effect.Effect<void, PublishError>

  // イベント購読
  subscribe: <E extends GameEvent | SystemEvent>(params: {
    filter?: (event: GameEvent | SystemEvent) => event is E
    bufferSize?: number
  }) => Stream.Stream<E, SubscribeError>

  // 特定タグのイベント購読
  subscribeToTag: <Tag extends (GameEvent | SystemEvent)['_tag']>(params: {
    tag: Tag
    bufferSize?: number
  }) => Stream.Stream<
    Extract<GameEvent | SystemEvent, { _tag: Tag }>,
    SubscribeError
  >

  // バッチ発行
  publishBatch: (
    events: ReadonlyArray<GameEvent | SystemEvent>
  ) => Effect.Effect<void, PublishError>

  // イベント履歴取得
  getHistory: (params: {
    limit?: number
    filter?: (event: GameEvent | SystemEvent) => boolean
  }) => Effect.Effect<ReadonlyArray<GameEvent | SystemEvent>, HistoryError>

  // メトリクス取得
  getMetrics: () => Effect.Effect<EventBusMetrics, MetricsError>
}>('EventBusService')
```

### Event Bus実装

```typescript
export const EventBusServiceLive = Layer.effect(
  EventBusService,
  Effect.gen(function* () {
    // PubSubの作成
    const pubsub = yield* PubSub.unbounded<GameEvent | SystemEvent>()
    const history = yield* Ref.make<ReadonlyArray<GameEvent | SystemEvent>>([])
    const metrics = yield* Ref.make<EventBusMetrics>({
      totalPublished: 0,
      totalSubscribers: 0,
      eventsPerSecond: 0,
      bufferSize: 0
    })

    return {
      publish: (event) => Effect.gen(function* () {
        yield* PubSub.publish(pubsub, event)
        yield* Ref.update(history, (h) =>
          Array.append(h, event).pipe(Array.takeRight(1000))
        )
        yield* Ref.update(metrics, (m) => ({
          ...m,
          totalPublished: m.totalPublished + 1
        }))
      }),

      subscribe: ({ filter, bufferSize = 100 }) =>
        Stream.fromPubSub(pubsub, { maxChunkSize: bufferSize }).pipe(
          filter ? Stream.filter(filter) : identity
        ),

      subscribeToTag: ({ tag, bufferSize = 100 }) =>
        Stream.fromPubSub(pubsub, { maxChunkSize: bufferSize }).pipe(
          Stream.filter((event): event is Extract<
            GameEvent | SystemEvent,
            { _tag: typeof tag }
          > => event._tag === tag)
        ),

      publishBatch: (events) => Effect.gen(function* () {
        yield* Effect.all(
          events.map(event => PubSub.publish(pubsub, event)),
          { concurrency: 'unbounded' }
        )
      }),

      getHistory: ({ limit = 100, filter }) => Effect.gen(function* () {
        const all = yield* Ref.get(history)
        const filtered = filter ? all.filter(filter) : all
        return Array.takeRight(filtered, limit)
      }),

      getMetrics: () => Ref.get(metrics)
    }
  })
)
```

## Event Handlers

### Event Handler定義

```typescript
export interface EventHandler<E extends GameEvent | SystemEvent> {
  readonly _: unique symbol
  readonly eventTag: E['_tag']
  readonly priority: number
  readonly handle: (event: E) => Effect.Effect<void, HandleError>
}

// Handler Registry
export interface EventHandlerRegistry {
  readonly _: unique symbol
}

export const EventHandlerRegistry = Context.GenericTag<EventHandlerRegistry, {
  register: <E extends GameEvent | SystemEvent>(
    handler: EventHandler<E>
  ) => Effect.Effect<void, RegistrationError>

  unregister: (
    handlerId: string
  ) => Effect.Effect<void, UnregistrationError>

  getHandlers: <Tag extends (GameEvent | SystemEvent)['_tag']>(
    tag: Tag
  ) => Effect.Effect<
    ReadonlyArray<EventHandler<Extract<GameEvent | SystemEvent, { _tag: Tag }>>>,
    never
  >
}>('EventHandlerRegistry')
```

### Handler実装例

```typescript
// Block破壊イベントハンドラー
export const BlockBreakHandler: EventHandler<Extract<GameEvent, { _tag: 'BlockBroken' }>> = {
  _: Symbol.for('BlockBreakHandler'),
  eventTag: 'BlockBroken',
  priority: 100,
  handle: (event) => Effect.gen(function* () {
    const worldService = yield* WorldService
    const inventoryService = yield* InventoryService

    // ドロップアイテムの計算
    const drops = yield* worldService.calculateDrops({
      blockType: event.blockType,
      tool: yield* inventoryService.getHeldItem(event.brokenBy)
    })

    // アイテムのスポーン
    yield* Effect.all(
      drops.map(item =>
        worldService.spawnItem({
          item,
          position: event.position
        })
      )
    )

    // 統計更新
    yield* Effect.logInfo(`Block broken: ${event.blockType} at ${event.position}`)
  })
}
```

## Event Patterns

### Event Sourcing Pattern

```typescript
export const createEventSourcedEntity = <State, Event extends GameEvent>(
  initialState: State,
  reducer: (state: State, event: Event) => State
) => {
  return Effect.gen(function* () {
    const stateRef = yield* Ref.make(initialState)
    const events = yield* Ref.make<ReadonlyArray<Event>>([])

    return {
      getState: () => Ref.get(stateRef),

      dispatch: (event: Event) => Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef)
        const newState = reducer(currentState, event)
        yield* Ref.set(stateRef, newState)
        yield* Ref.update(events, Array.append(event))
        yield* EventBusService.pipe(
          Effect.flatMap(bus => bus.publish(event))
        )
      }),

      getEvents: () => Ref.get(events),

      replay: (fromEvents: ReadonlyArray<Event>) => Effect.gen(function* () {
        const newState = fromEvents.reduce(reducer, initialState)
        yield* Ref.set(stateRef, newState)
        yield* Ref.set(events, fromEvents)
      })
    }
  })
}
```

### Event Aggregation Pattern

```typescript
// 複数イベントの集約
export const createEventAggregator = <T>(params: {
  window: Duration
  combine: (events: ReadonlyArray<GameEvent>) => T
}) => {
  return Stream.gen(function* () {
    const bus = yield* EventBusService
    const stream = bus.subscribe({ bufferSize: 1000 })

    return yield* stream.pipe(
      Stream.groupedWithin(100, params.window),
      Stream.map(params.combine)
    )
  })
}

// 使用例：移動イベントの集約
const movementAggregator = createEventAggregator({
  window: Duration.seconds(1),
  combine: (events) => {
    const movements = events.filter(
      (e): e is Extract<GameEvent, { _tag: 'PlayerMoved' }> =>
        e._tag === 'PlayerMoved'
    )
    return {
      playerMovements: movements.length,
      totalDistance: movements.reduce(
        (acc, m) => acc + distance(m.from, m.to),
        0
      )
    }
  }
})
```

### Event Filtering & Transformation

```typescript
// 高度なイベントフィルタリング
export const createEventPipeline = <In extends GameEvent, Out>(params: {
  source: Stream.Stream<In, never>
  filter?: (event: In) => boolean
  transform: (event: In) => Effect.Effect<Out, TransformError>
  batch?: { size: number; timeout: Duration }
}) => {
  let pipeline = params.source

  if (params.filter) {
    pipeline = pipeline.pipe(Stream.filter(params.filter))
  }

  let transformed = pipeline.pipe(
    Stream.mapEffect(params.transform)
  )

  if (params.batch) {
    transformed = transformed.pipe(
      Stream.groupedWithin(params.batch.size, params.batch.timeout),
      Stream.flatMap(Stream.fromIterable)
    )
  }

  return transformed
}
```

## Performance Optimization

### Event Batching

```typescript
export const BatchedEventPublisher = {
  create: (params: {
    maxBatchSize: number
    maxLatency: Duration
  }) => Effect.gen(function* () {
    const queue = yield* Queue.unbounded<GameEvent>()
    const bus = yield* EventBusService

    // バッチ処理ファイバー
    yield* Effect.forkDaemon(
      Stream.fromQueue(queue).pipe(
        Stream.groupedWithin(
          params.maxBatchSize,
          params.maxLatency
        ),
        Stream.mapEffect(batch =>
          bus.publishBatch(Array.fromIterable(batch))
        ),
        Stream.runDrain
      )
    )

    return {
      publish: (event: GameEvent) => Queue.offer(queue, event)
    }
  })
}
```

### Event Priority Queue

```typescript
export const PriorityEventBus = {
  create: () => Effect.gen(function* () {
    const highPriority = yield* Queue.unbounded<GameEvent>()
    const normalPriority = yield* Queue.unbounded<GameEvent>()
    const lowPriority = yield* Queue.unbounded<GameEvent>()

    const process = (queue: Queue.Queue<GameEvent>, priority: number) =>
      Stream.fromQueue(queue).pipe(
        Stream.tap(event =>
          Effect.logDebug(`Processing ${priority} priority event: ${event._tag}`)
        )
      )

    // 優先度付きストリーム結合
    const merged = Stream.mergeAll([
      process(highPriority, 1),
      process(normalPriority, 2),
      process(lowPriority, 3)
    ], { concurrency: 3 })

    return {
      publishHigh: (event: GameEvent) => Queue.offer(highPriority, event),
      publishNormal: (event: GameEvent) => Queue.offer(normalPriority, event),
      publishLow: (event: GameEvent) => Queue.offer(lowPriority, event),
      stream: merged
    }
  })
}
```

## Monitoring & Debugging

### Event Monitoring

```typescript
export const EventMonitor = {
  create: () => Effect.gen(function* () {
    const eventCounts = yield* Ref.make<Map<string, number>>(new Map())
    const eventLatencies = yield* Ref.make<Map<string, number[]>>(new Map())

    return {
      recordEvent: (event: GameEvent, latency: number) =>
        Effect.all([
          Ref.update(eventCounts, counts => {
            const current = counts.get(event._tag) || 0
            return new Map(counts).set(event._tag, current + 1)
          }),
          Ref.update(eventLatencies, latencies => {
            const current = latencies.get(event._tag) || []
            return new Map(latencies).set(
              event._tag,
              [...current, latency].slice(-100)
            )
          })
        ]),

      getStats: () => Effect.gen(function* () {
        const counts = yield* Ref.get(eventCounts)
        const latencies = yield* Ref.get(eventLatencies)

        return Array.from(counts.entries()).map(([tag, count]) => ({
          eventType: tag,
          count,
          avgLatency: average(latencies.get(tag) || []),
          maxLatency: Math.max(...(latencies.get(tag) || [0]))
        }))
      })
    }
  })
}
```