---
title: 'イベントバス仕様 - 疬結合アーキテクチャ・メッセージング'
description: 'システム間通信、イベント伝播、疬結合アーキテクチャの完全仕様。Effect-TSでのリアクティブメッセージング。'
category: 'specification'
difficulty: 'advanced'
tags: ['event-bus', 'messaging', 'loose-coupling', 'reactive-patterns', 'pub-sub', 'event-driven']
prerequisites: ['effect-ts-fundamentals', 'event-driven-patterns', 'reactive-programming', 'pub-sub-concepts']
estimated_reading_time: '15分'
related_patterns: ['event-driven-patterns', 'reactive-patterns', 'integration-patterns']
related_docs: ['./domain-application-apis.md', '../explanations/architecture/06-effect-ts-patterns.md']
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
    playerName: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerLeft'),
    playerId: Schema.String,
    timestamp: Schema.Number,
    reason: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerMoved'),
    playerId: Schema.String,
    from: PositionSchema,
    to: PositionSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerDamaged'),
    playerId: Schema.String,
    damage: Schema.Number,
    source: DamageSourceSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerDied'),
    playerId: Schema.String,
    cause: DeathCauseSchema,
    position: PositionSchema,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('PlayerRespawned'),
    playerId: Schema.String,
    position: PositionSchema,
    timestamp: Schema.Number,
  })
)

export const BlockEventSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('BlockPlaced'),
    position: PositionSchema,
    blockType: BlockTypeSchema,
    placedBy: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('BlockBroken'),
    position: PositionSchema,
    blockType: BlockTypeSchema,
    brokenBy: Schema.String,
    timestamp: Schema.Number,
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
  | {
      readonly _tag: 'PlayerDamaged'
      readonly playerId: string
      readonly damage: number
      readonly source: DamageSource
    }
  | { readonly _tag: 'PlayerDied'; readonly playerId: string; readonly cause: DeathCause; readonly position: Position }
  | { readonly _tag: 'PlayerRespawned'; readonly playerId: string; readonly position: Position }

  // Block Events
  | {
      readonly _tag: 'BlockPlaced'
      readonly position: Position
      readonly blockType: BlockType
      readonly placedBy: string
    }
  | {
      readonly _tag: 'BlockBroken'
      readonly position: Position
      readonly blockType: BlockType
      readonly brokenBy: string
    }
  | {
      readonly _tag: 'BlockUpdated'
      readonly position: Position
      readonly oldState: BlockState
      readonly newState: BlockState
    }
  | { readonly _tag: 'BlockExploded'; readonly positions: ReadonlyArray<Position>; readonly source: ExplosionSource }

  // Chunk Events
  | { readonly _tag: 'ChunkLoaded'; readonly chunkPosition: ChunkPosition; readonly entities: number }
  | { readonly _tag: 'ChunkUnloaded'; readonly chunkPosition: ChunkPosition }
  | { readonly _tag: 'ChunkGenerated'; readonly chunkPosition: ChunkPosition; readonly generationTime: number }
  | { readonly _tag: 'ChunkModified'; readonly chunkPosition: ChunkPosition; readonly modifications: number }

  // Entity Events
  | {
      readonly _tag: 'EntitySpawned'
      readonly entityId: string
      readonly entityType: EntityType
      readonly position: Position
    }
  | { readonly _tag: 'EntityDespawned'; readonly entityId: string; readonly reason: DespawnReason }
  | { readonly _tag: 'EntityMoved'; readonly entityId: string; readonly from: Position; readonly to: Position }
  | {
      readonly _tag: 'EntityDamaged'
      readonly entityId: string
      readonly damage: number
      readonly source: DamageSource
    }

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

export const EventBusService = Context.GenericTag<
  EventBusService,
  {
    // イベント発行
    publish: <E extends GameEvent | SystemEvent>(event: E) => Effect.Effect<void, PublishError>

    // イベント購読
    subscribe: <E extends GameEvent | SystemEvent>(params: {
      filter?: (event: GameEvent | SystemEvent) => event is E
      bufferSize?: number
    }) => Stream.Stream<E, SubscribeError>

    // 特定タグのイベント購読
    subscribeToTag: <Tag extends (GameEvent | SystemEvent)['_tag']>(params: {
      tag: Tag
      bufferSize?: number
    }) => Stream.Stream<Extract<GameEvent | SystemEvent, { _tag: Tag }>, SubscribeError>

    // バッチ発行
    publishBatch: (events: ReadonlyArray<GameEvent | SystemEvent>) => Effect.Effect<void, PublishError>

    // イベント履歴取得
    getHistory: (params: {
      limit?: number
      filter?: (event: GameEvent | SystemEvent) => boolean
    }) => Effect.Effect<ReadonlyArray<GameEvent | SystemEvent>, HistoryError>

    // メトリクス取得
    getMetrics: () => Effect.Effect<EventBusMetrics, MetricsError>
  }
>('EventBusService')
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
      bufferSize: 0,
    })

    return {
      publish: (event) =>
        Effect.gen(function* () {
          yield* PubSub.publish(pubsub, event)
          yield* Ref.update(history, (h) => Array.append(h, event).pipe(Array.takeRight(1000)))
          yield* Ref.update(metrics, (m) => ({
            ...m,
            totalPublished: m.totalPublished + 1,
          }))
        }),

      subscribe: ({ filter, bufferSize = 100 }) =>
        Stream.fromPubSub(pubsub, { maxChunkSize: bufferSize }).pipe(filter ? Stream.filter(filter) : identity),

      subscribeToTag: ({ tag, bufferSize = 100 }) =>
        Stream.fromPubSub(pubsub, { maxChunkSize: bufferSize }).pipe(
          Stream.filter((event): event is Extract<GameEvent | SystemEvent, { _tag: typeof tag }> => event._tag === tag)
        ),

      publishBatch: (events) =>
        Effect.gen(function* () {
          yield* Effect.all(
            events.map((event) => PubSub.publish(pubsub, event)),
            { concurrency: 'unbounded' }
          )
        }),

      getHistory: ({ limit = 100, filter }) =>
        Effect.gen(function* () {
          const all = yield* Ref.get(history)
          const filtered = filter ? all.filter(filter) : all
          return Array.takeRight(filtered, limit)
        }),

      getMetrics: () => Ref.get(metrics),
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

export const EventHandlerRegistry = Context.GenericTag<
  EventHandlerRegistry,
  {
    register: <E extends GameEvent | SystemEvent>(handler: EventHandler<E>) => Effect.Effect<void, RegistrationError>

    unregister: (handlerId: string) => Effect.Effect<void, UnregistrationError>

    getHandlers: <Tag extends (GameEvent | SystemEvent)['_tag']>(
      tag: Tag
    ) => Effect.Effect<ReadonlyArray<EventHandler<Extract<GameEvent | SystemEvent, { _tag: Tag }>>>, never>
  }
>('EventHandlerRegistry')
```

### Handler実装例

```typescript
// Block破壊イベントハンドラー
export const BlockBreakHandler: EventHandler<Extract<GameEvent, { _tag: 'BlockBroken' }>> = {
  _: Symbol.for('BlockBreakHandler'),
  eventTag: 'BlockBroken',
  priority: 100,
  handle: (event) =>
    Effect.gen(function* () {
      const worldService = yield* WorldService
      const inventoryService = yield* InventoryService

      // ドロップアイテムの計算
      const drops = yield* worldService.calculateDrops({
        blockType: event.blockType,
        tool: yield* inventoryService.getHeldItem(event.brokenBy),
      })

      // アイテムのスポーン
      yield* Effect.all(
        drops.map((item) =>
          worldService.spawnItem({
            item,
            position: event.position,
          })
        )
      )

      // 統計更新
      yield* Effect.logInfo(`Block broken: ${event.blockType} at ${event.position}`)
    }),
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

      dispatch: (event: Event) =>
        Effect.gen(function* () {
          const currentState = yield* Ref.get(stateRef)
          const newState = reducer(currentState, event)
          yield* Ref.set(stateRef, newState)
          yield* Ref.update(events, Array.append(event))
          yield* EventBusService.pipe(Effect.flatMap((bus) => bus.publish(event)))
        }),

      getEvents: () => Ref.get(events),

      replay: (fromEvents: ReadonlyArray<Event>) =>
        Effect.gen(function* () {
          const newState = fromEvents.reduce(reducer, initialState)
          yield* Ref.set(stateRef, newState)
          yield* Ref.set(events, fromEvents)
        }),
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

    return yield* stream.pipe(Stream.groupedWithin(100, params.window), Stream.map(params.combine))
  })
}

// 使用例：移動イベントの集約
const movementAggregator = createEventAggregator({
  window: Duration.seconds(1),
  combine: (events) => {
    const movements = events.filter((e): e is Extract<GameEvent, { _tag: 'PlayerMoved' }> => e._tag === 'PlayerMoved')
    return {
      playerMovements: movements.length,
      totalDistance: movements.reduce((acc, m) => acc + distance(m.from, m.to), 0),
    }
  },
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

  let transformed = pipeline.pipe(Stream.mapEffect(params.transform))

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
  create: (params: { maxBatchSize: number; maxLatency: Duration }) =>
    Effect.gen(function* () {
      const queue = yield* Queue.unbounded<GameEvent>()
      const bus = yield* EventBusService

      // バッチ処理ファイバー
      yield* Effect.forkDaemon(
        Stream.fromQueue(queue).pipe(
          Stream.groupedWithin(params.maxBatchSize, params.maxLatency),
          Stream.mapEffect((batch) => bus.publishBatch(Array.fromIterable(batch))),
          Stream.runDrain
        )
      )

      return {
        publish: (event: GameEvent) => Queue.offer(queue, event),
      }
    }),
}
```

### Event Priority Queue

```typescript
export const PriorityEventBus = {
  create: () =>
    Effect.gen(function* () {
      const highPriority = yield* Queue.unbounded<GameEvent>()
      const normalPriority = yield* Queue.unbounded<GameEvent>()
      const lowPriority = yield* Queue.unbounded<GameEvent>()

      const process = (queue: Queue.Queue<GameEvent>, priority: number) =>
        Stream.fromQueue(queue).pipe(
          Stream.tap((event) => Effect.logDebug(`Processing ${priority} priority event: ${event._tag}`))
        )

      // 優先度付きストリーム結合
      const merged = Stream.mergeAll([process(highPriority, 1), process(normalPriority, 2), process(lowPriority, 3)], {
        concurrency: 3,
      })

      return {
        publishHigh: (event: GameEvent) => Queue.offer(highPriority, event),
        publishNormal: (event: GameEvent) => Queue.offer(normalPriority, event),
        publishLow: (event: GameEvent) => Queue.offer(lowPriority, event),
        stream: merged,
      }
    }),
}
```

## Monitoring & Debugging

### Advanced Event Processing Patterns

#### Event Sourcing Implementation

```typescript
// =============================================================================
// イベントソーシング実装
// =============================================================================

// Event Store Interface
export const EventStore = Context.GenericTag<{
  readonly append: (params: {
    streamId: string
    events: ReadonlyArray<StoredEvent>
    expectedVersion: number
  }) => Effect.Effect<void, EventStoreError>

  readonly read: (params: {
    streamId: string
    fromVersion?: number
    maxEvents?: number
  }) => Stream.Stream<StoredEvent, EventStoreError>

  readonly readAll: (params: {
    fromPosition?: GlobalPosition
    maxEvents?: number
  }) => Stream.Stream<StoredEvent, EventStoreError>

  readonly subscribe: (params: {
    streamId?: string
    fromPosition?: GlobalPosition
    onEvent: (event: StoredEvent) => Effect.Effect<void>
  }) => Effect.Effect<SubscriptionHandle, EventStoreError>
}>()("EventStore")

// Event Store Types
export interface StoredEvent {
  readonly streamId: string
  readonly version: number
  readonly globalPosition: GlobalPosition
  readonly eventType: string
  readonly eventData: unknown
  readonly metadata: EventMetadata
  readonly timestamp: number
}

export interface EventMetadata {
  readonly correlationId?: string
  readonly causationId?: string
  readonly userId?: string
  readonly source: string
}

export type GlobalPosition = number & Brand.Brand<"GlobalPosition">

// InMemory Event Store実装
export const InMemoryEventStoreLive = Layer.effect(
  EventStore,
  Effect.gen(function* () {
    const streams = yield* Ref.make(new Map<string, StoredEvent[]>())
    const allEvents = yield* Ref.make<StoredEvent[]>([])
    const globalPosition = yield* Ref.make<GlobalPosition>(0 as GlobalPosition)
    const subscriptions = yield* Ref.make(new Map<string, SubscriptionHandle>())

    return {
      append: (params) => Effect.gen(function* () {
        const currentStreams = yield* Ref.get(streams)
        const streamEvents = currentStreams.get(params.streamId) || []

        // 楽観的同時制御チェック
        if (streamEvents.length !== params.expectedVersion) {
          yield* Effect.fail(new ConcurrencyConflictError({
            streamId: params.streamId,
            expectedVersion: params.expectedVersion,
            actualVersion: streamEvents.length
          }))
        }

        // イベントにバージョンとポジションを付与
        const newEvents = params.events.map((event, index) => {
          const version = params.expectedVersion + index + 1
          const currentGlobalPos = yield* Ref.get(globalPosition)
          const newGlobalPos = (currentGlobalPos + 1) as GlobalPosition

          yield* Ref.set(globalPosition, newGlobalPos)

          return {
            streamId: params.streamId,
            version,
            globalPosition: newGlobalPos,
            eventType: event.eventType,
            eventData: event.eventData,
            metadata: event.metadata,
            timestamp: Date.now()
          }
        })

        // ストリームに追加
        const updatedStreamEvents = [...streamEvents, ...newEvents]
        yield* Ref.update(streams, s =>
          new Map([...s, [params.streamId, updatedStreamEvents]])
        )

        // 全イベントに追加
        yield* Ref.update(allEvents, events => [...events, ...newEvents])

        // 購読者に通知
        const subs = yield* Ref.get(subscriptions)
        yield* Effect.all(
          Array.from(subs.values()).map(sub =>
            Effect.all(
              newEvents.map(event => sub.handler(event))
            )
          )
        )
      }),

      read: (params) =>
        Stream.gen(function* () {
          const currentStreams = yield* Ref.get(streams)
          const streamEvents = currentStreams.get(params.streamId) || []

          const fromVersion = params.fromVersion || 0
          const maxEvents = params.maxEvents || streamEvents.length

          const eventsToReturn = streamEvents
            .filter(e => e.version >= fromVersion)
            .slice(0, maxEvents)

          for (const event of eventsToReturn) {
            yield* Stream.succeed(event)
          }
        }),

      readAll: (params) =>
        Stream.gen(function* () {
          const events = yield* Ref.get(allEvents)

          const fromPos = params.fromPosition || (0 as GlobalPosition)
          const maxEvents = params.maxEvents || events.length

          const eventsToReturn = events
            .filter(e => e.globalPosition >= fromPos)
            .slice(0, maxEvents)

          for (const event of eventsToReturn) {
            yield* Stream.succeed(event)
          }
        }),

      subscribe: (params) => Effect.gen(function* () {
        const subscriptionId = generateSubscriptionId()

        const handle: SubscriptionHandle = {
          id: subscriptionId,
          streamId: params.streamId,
          handler: params.onEvent,
          fromPosition: params.fromPosition
        }

        yield* Ref.update(subscriptions, subs =>
          new Map([...subs, [subscriptionId, handle]])
        )

        return handle
      })
    }
  })
)

// Event Sourced Aggregate interface
export interface EventSourcedAggregate<State, Event extends DomainEvent> {
  readonly id: string
  readonly state: State
  readonly version: number
  readonly uncommittedEvents: ReadonlyArray<Event>

  readonly getInitialState: () => State
  readonly apply: (state: State, event: Event) => State
  readonly validate: (event: Event) => Effect.Effect<void, DomainError>
  readonly applyEvent: (event: Event) => Effect.Effect<EventSourcedAggregate<State, Event>, DomainError>
  readonly getUncommittedEvents: () => ReadonlyArray<Event>
  readonly markEventsAsCommitted: () => EventSourcedAggregate<State, Event>
  readonly getState: () => State
  readonly getVersion: () => number
}

// Factory function for creating event sourced aggregates
export const createEventSourcedAggregate = <State, Event extends DomainEvent>(config: {
  readonly id: string
  readonly initialState: State
  readonly getInitialState: () => State
  readonly apply: (state: State, event: Event) => State
  readonly validate: (event: Event) => Effect.Effect<void, DomainError>
  readonly version?: number
  readonly uncommittedEvents?: ReadonlyArray<Event>
}): EventSourcedAggregate<State, Event> => {
  const version = config.version ?? 0
  const uncommittedEvents = config.uncommittedEvents ?? []

  return {
    id: config.id,
    state: config.initialState,
    version,
    uncommittedEvents,
    getInitialState: config.getInitialState,
    apply: config.apply,
    validate: config.validate,

    applyEvent: (event: Event) =>
      Effect.gen(function* () {
        yield* config.validate(event)

        const newState = config.apply(config.initialState, event)
        return createEventSourcedAggregate({
          ...config,
          initialState: newState,
          version: version + 1,
          uncommittedEvents: [...uncommittedEvents, event]
        })
      }),

    getUncommittedEvents: () => [...uncommittedEvents],

    markEventsAsCommitted: () =>
      createEventSourcedAggregate({
        ...config,
        uncommittedEvents: []
      }),

    getState: () => ({ ...config.initialState }),
    getVersion: () => version
  }
}

// Factory function for rebuilding from history
export const fromHistory = <State, Event extends DomainEvent>(
  config: {
    readonly getInitialState: () => State
    readonly apply: (state: State, event: Event) => State
    readonly validate: (event: Event) => Effect.Effect<void, DomainError>
  },
  id: string,
  events: ReadonlyArray<Event>
): EventSourcedAggregate<State, Event> => {
  const initialState = config.getInitialState()
  let state = initialState
  let version = 0

  for (const event of events) {
    state = config.apply(state, event)
    version++
  }

  return createEventSourcedAggregate({
    id,
    initialState: state,
    getInitialState: config.getInitialState,
    apply: config.apply,
    validate: config.validate,
    version,
    uncommittedEvents: []
  })
}

// プレイヤーのEvent Sourced実装
export const createEventSourcedPlayer = (id: string): EventSourcedAggregate<PlayerState, PlayerEvent> => {
  const getInitialState = (): PlayerState => ({
    id,
    name: "",
    position: { x: 0, y: 0, z: 0 } as Position,
    health: { value: 100, max: 100 },
    status: "active",
    inventory: new Map(),
    lastActivity: Date.now()
  })

  const apply = (state: PlayerState, event: PlayerEvent): PlayerState => {
    switch (event._tag) {
      case "PlayerCreated":
        return {
          ...state,
          name: event.playerName,
          position: event.position
        }

      case "PlayerMoved":
        return {
          ...state,
          position: event.to,
          lastActivity: event.timestamp
        }

      case "PlayerDamaged":
        return {
          ...state,
          health: {
            ...state.health,
            value: Math.max(0, state.health.value - event.damage)
          },
          lastActivity: event.timestamp
        }

      case "PlayerDied":
        return {
          ...state,
          status: "dead",
          lastActivity: event.timestamp
        }

      case "PlayerRespawned":
        return {
          ...state,
          status: "active",
          position: event.position,
          health: { value: 100, max: 100 },
          lastActivity: event.timestamp
        }

      default:
        return state
    }
  }

  protected validate(event: PlayerEvent): Effect.Effect<void, DomainError> {
    return Effect.gen(function* () {
      switch (event._tag) {
        case "PlayerMoved":
          if (this.getState().status === "dead") {
            yield* Effect.fail(new InvalidOperationError({
              message: "Dead players cannot move",
              aggregateId: this.id
            }))
          }
          break

        case "PlayerDamaged":
          if (this.getState().health.value <= 0) {
            yield* Effect.fail(new InvalidOperationError({
              message: "Cannot damage dead player",
              aggregateId: this.id
            }))
          }
          break
      }
    })
  }

  // ビジネスメソッド
  create(params: { name: string; position: Position }): Effect.Effect<void, DomainError> {
    return this.applyEvent({
      _tag: "PlayerCreated",
      playerId: this.id,
      playerName: params.name,
      position: params.position,
      timestamp: Date.now()
    })
  }

  move(to: Position): Effect.Effect<void, DomainError> {
    return this.applyEvent({
      _tag: "PlayerMoved",
      playerId: this.id,
      from: this.getState().position,
      to,
      timestamp: Date.now()
    })
  }

  takeDamage(params: { amount: number; source: DamageSource }): Effect.Effect<void, DomainError> {
    return Effect.gen(function* () {
      yield* this.applyEvent({
        _tag: "PlayerDamaged",
        playerId: this.id,
        damage: params.amount,
        source: params.source,
        timestamp: Date.now()
      })

      // 死亡チェック
      if (this.getState().health.value <= 0) {
        yield* this.applyEvent({
          _tag: "PlayerDied",
          playerId: this.id,
          cause: params.source,
          position: this.getState().position,
          timestamp: Date.now()
        })
      }
    })
  }
}
```

#### CQRS (Command Query Responsibility Segregation)

```typescript
// =============================================================================
// CQRS実装パターン
// =============================================================================

// Command Side
export interface Command {
  readonly _tag: string
  readonly aggregateId: string
  readonly correlationId: string
  readonly metadata: CommandMetadata
}

export interface CommandMetadata {
  readonly userId?: string
  readonly timestamp: number
  readonly source: string
}

// Player Commands
export type PlayerCommand =
  | {
      readonly _tag: 'CreatePlayer'
      readonly aggregateId: string
      readonly correlationId: string
      readonly metadata: CommandMetadata
      readonly name: string
      readonly position: Position
    }
  | {
      readonly _tag: 'MovePlayer'
      readonly aggregateId: string
      readonly correlationId: string
      readonly metadata: CommandMetadata
      readonly direction: Direction
      readonly distance: number
    }
  | {
      readonly _tag: 'DamagePlayer'
      readonly aggregateId: string
      readonly correlationId: string
      readonly metadata: CommandMetadata
      readonly amount: number
      readonly source: DamageSource
    }

// Command Handler
export const PlayerCommandHandler = Context.GenericTag<{
  readonly handle: (command: PlayerCommand) => Effect.Effect<void, CommandHandlerError>
}>()('PlayerCommandHandler')

export const PlayerCommandHandlerLive = Layer.succeed(PlayerCommandHandler, {
  handle: (command) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore
      const eventBus = yield* EventBusService

      // Aggregateを読み込み
      const events = yield* eventStore
        .read({
          streamId: command.aggregateId,
        })
        .pipe(Stream.runCollect)

      const domainEvents = Array.fromIterable(events).map((e) => e.eventData as PlayerEvent)
      const player =
        domainEvents.length > 0
          ? EventSourcedPlayer.fromHistory(EventSourcedPlayer, command.aggregateId, domainEvents)
          : new EventSourcedPlayer(command.aggregateId, undefined, 0, [])

      // コマンド処理
      yield* Match.value(command).pipe(
        Match.when({ _tag: 'CreatePlayer' }, (cmd) =>
          player.create({
            name: cmd.name,
            position: cmd.position,
          })
        ),
        Match.when({ _tag: 'MovePlayer' }, (cmd) =>
          Effect.gen(function* () {
            const currentPos = player.getState().position
            const newPos = calculateNewPosition(currentPos, cmd.direction, cmd.distance)
            yield* player.move(newPos)
          })
        ),
        Match.when({ _tag: 'DamagePlayer' }, (cmd) =>
          player.takeDamage({
            amount: cmd.amount,
            source: cmd.source,
          })
        ),
        Match.exhaustive
      )

      // 未確定イベントを永続化
      const uncommittedEvents = player.getUncommittedEvents()
      if (uncommittedEvents.length > 0) {
        const storedEvents = uncommittedEvents.map((event) => ({
          eventType: event._tag,
          eventData: event,
          metadata: {
            correlationId: command.correlationId,
            causationId: command.correlationId,
            source: command.metadata.source,
            userId: command.metadata.userId,
          },
        }))

        yield* eventStore.append({
          streamId: command.aggregateId,
          events: storedEvents,
          expectedVersion: player.getVersion() - uncommittedEvents.length,
        })

        // イベントバスに発行
        yield* Effect.all(uncommittedEvents.map((event) => eventBus.publish(event)))

        player.markEventsAsCommitted()
      }
    }),
})

// Query Side - Read Models
export interface PlayerReadModel {
  readonly id: string
  readonly name: string
  readonly position: Position
  readonly health: Health
  readonly status: PlayerStatus
  readonly lastActivity: number
}

export const PlayerProjectionService = Context.GenericTag<{
  readonly project: (event: PlayerEvent) => Effect.Effect<void, ProjectionError>
  readonly getPlayer: (id: string) => Effect.Effect<Option.Option<PlayerReadModel>, QueryError>
  readonly getPlayers: (filter?: PlayerFilter) => Effect.Effect<ReadonlyArray<PlayerReadModel>, QueryError>
}>()('PlayerProjectionService')

export const PlayerProjectionServiceLive = Layer.effect(
  PlayerProjectionService,
  Effect.gen(function* () {
    const readModels = yield* Ref.make(new Map<string, PlayerReadModel>())

    return {
      project: (event) =>
        Effect.gen(function* () {
          const models = yield* Ref.get(readModels)
          const currentModel = models.get(event.playerId)

          const updatedModel = yield* Match.value(event).pipe(
            Match.when({ _tag: 'PlayerCreated' }, (e) =>
              Effect.succeed({
                id: e.playerId,
                name: e.playerName,
                position: e.position,
                health: { value: 100, max: 100 },
                status: 'active' as PlayerStatus,
                lastActivity: e.timestamp,
              })
            ),
            Match.when({ _tag: 'PlayerMoved' }, (e) => {
              if (!currentModel) {
                return Effect.fail(
                  new ProjectionError({
                    message: 'Cannot project move event without existing player',
                    eventType: e._tag,
                    aggregateId: e.playerId,
                  })
                )
              }
              return Effect.succeed({
                ...currentModel,
                position: e.to,
                lastActivity: e.timestamp,
              })
            }),
            Match.when({ _tag: 'PlayerDamaged' }, (e) => {
              if (!currentModel) {
                return Effect.fail(
                  new ProjectionError({
                    message: 'Cannot project damage event without existing player',
                    eventType: e._tag,
                    aggregateId: e.playerId,
                  })
                )
              }
              return Effect.succeed({
                ...currentModel,
                health: {
                  ...currentModel.health,
                  value: Math.max(0, currentModel.health.value - e.damage),
                },
                lastActivity: e.timestamp,
              })
            }),
            Match.when({ _tag: 'PlayerDied' }, (e) => {
              if (!currentModel) {
                return Effect.fail(
                  new ProjectionError({
                    message: 'Cannot project death event without existing player',
                    eventType: e._tag,
                    aggregateId: e.playerId,
                  })
                )
              }
              return Effect.succeed({
                ...currentModel,
                status: 'dead' as PlayerStatus,
                lastActivity: e.timestamp,
              })
            }),
            Match.when({ _tag: 'PlayerRespawned' }, (e) => {
              if (!currentModel) {
                return Effect.fail(
                  new ProjectionError({
                    message: 'Cannot project respawn event without existing player',
                    eventType: e._tag,
                    aggregateId: e.playerId,
                  })
                )
              }
              return Effect.succeed({
                ...currentModel,
                status: 'active' as PlayerStatus,
                position: e.position,
                health: { value: 100, max: 100 },
                lastActivity: e.timestamp,
              })
            }),
            Match.exhaustive
          )

          yield* Ref.update(readModels, (models) => new Map([...models, [event.playerId, updatedModel]]))
        }),

      getPlayer: (id) =>
        Effect.gen(function* () {
          const models = yield* Ref.get(readModels)
          return Option.fromNullable(models.get(id))
        }),

      getPlayers: (filter) =>
        Effect.gen(function* () {
          const models = yield* Ref.get(readModels)
          let players = Array.from(models.values())

          if (filter?.status) {
            players = players.filter((p) => p.status === filter.status)
          }

          if (filter?.name) {
            players = players.filter((p) => p.name.toLowerCase().includes(filter.name.toLowerCase()))
          }

          return players
        }),
    }
  })
)
```

#### Event Replay and Debugging

```typescript
// =============================================================================
// イベントリプレイとデバッグ機能
// =============================================================================

export const EventReplayService = Context.GenericTag<{
  readonly replayStream: (params: {
    streamId: string
    fromVersion?: number
    toVersion?: number
    speed?: number
  }) => Stream.Stream<ReplayEvent, ReplayError>

  readonly replayAll: (params: {
    fromPosition?: GlobalPosition
    toPosition?: GlobalPosition
    speed?: number
  }) => Stream.Stream<ReplayEvent, ReplayError>

  readonly createSnapshot: (params: {
    streamId: string
    atVersion?: number
  }) => Effect.Effect<AggregateSnapshot, SnapshotError>

  readonly restoreFromSnapshot: (snapshot: AggregateSnapshot) => Effect.Effect<void, RestoreError>
}>()('EventReplayService')

export const EventReplayServiceLive = Layer.succeed(EventReplayService, {
  replayStream: (params) =>
    Stream.gen(function* () {
      const eventStore = yield* EventStore
      const speed = params.speed || 1

      const events = yield* eventStore
        .read({
          streamId: params.streamId,
          fromVersion: params.fromVersion,
        })
        .pipe(
          Stream.filter((event) => !params.toVersion || event.version <= params.toVersion),
          Stream.runCollect
        )

      for (const event of Array.fromIterable(events)) {
        yield* Stream.succeed({
          ...event,
          originalTimestamp: event.timestamp,
          replayTimestamp: Date.now(),
        })

        // 速度調整のための遅延
        if (speed < 1) {
          yield* Stream.fromEffect(Effect.sleep(Duration.millis(1000 / speed)))
        }
      }
    }),

  replayAll: (params) =>
    Stream.gen(function* () {
      const eventStore = yield* EventStore
      const speed = params.speed || 1

      const events = yield* eventStore
        .readAll({
          fromPosition: params.fromPosition,
          maxEvents: params.toPosition ? params.toPosition - (params.fromPosition || (0 as GlobalPosition)) : undefined,
        })
        .pipe(Stream.runCollect)

      let lastTimestamp = 0

      for (const event of Array.fromIterable(events)) {
        // 元のタイミングを再現（速度調整付き）
        if (lastTimestamp > 0) {
          const delay = (event.timestamp - lastTimestamp) / speed
          yield* Stream.fromEffect(Effect.sleep(Duration.millis(Math.max(0, delay))))
        }

        yield* Stream.succeed({
          ...event,
          originalTimestamp: event.timestamp,
          replayTimestamp: Date.now(),
        })

        lastTimestamp = event.timestamp
      }
    }),

  createSnapshot: (params) =>
    Effect.gen(function* () {
      const eventStore = yield* EventStore

      const events = yield* eventStore
        .read({
          streamId: params.streamId,
          maxEvents: params.atVersion,
        })
        .pipe(Stream.runCollect)

      // Aggregateを再構築
      const domainEvents = Array.fromIterable(events).map((e) => e.eventData as PlayerEvent)
      const player = EventSourcedPlayer.fromHistory(EventSourcedPlayer, params.streamId, domainEvents)

      return {
        aggregateId: params.streamId,
        aggregateType: 'Player',
        version: player.getVersion(),
        state: player.getState(),
        timestamp: Date.now(),
      }
    }),

  restoreFromSnapshot: (snapshot) =>
    Effect.gen(function* () {
      // スナップショットからAggregateを復元する実装
      // 実際のプロジェクトでは、適切なAggregateファクトリーを使用
      yield* Effect.logInfo(`Restored aggregate ${snapshot.aggregateId} from snapshot at version ${snapshot.version}`)
    }),
})

// Event Debugging Tools
export const EventDebugger = Context.GenericTag<{
  readonly traceEvent: (event: GameEvent) => Effect.Effect<EventTrace, never>
  readonly analyzeEventFlow: (params: {
    correlationId: string
    timeRange?: { start: number; end: number }
  }) => Effect.Effect<EventFlowAnalysis, AnalysisError>
  readonly detectAnomalies: (params: {
    streamId?: string
    timeRange: { start: number; end: number }
  }) => Effect.Effect<ReadonlyArray<EventAnomaly>, AnalysisError>
}>()('EventDebugger')

export const EventDebuggerLive = Layer.effect(
  EventDebugger,
  Effect.gen(function* () {
    const eventTraces = yield* Ref.make(new Map<string, EventTrace[]>())

    return {
      traceEvent: (event) =>
        Effect.gen(function* () {
          const trace: EventTrace = {
            eventId: generateEventId(),
            eventType: event._tag,
            timestamp: Date.now(),
            payload: event,
            stackTrace: new Error().stack || '',
            memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
            threadId: 'main', // WebWorkerやService Worker対応時に拡張
          }

          yield* Ref.update(eventTraces, (traces) => {
            const eventTypeTraces = traces.get(event._tag) || []
            return new Map([...traces, [event._tag, [...eventTypeTraces, trace]]])
          })

          return trace
        }),

      analyzeEventFlow: (params) =>
        Effect.gen(function* () {
          const eventStore = yield* EventStore

          const events = yield* eventStore
            .readAll({
              fromPosition: 0 as GlobalPosition,
            })
            .pipe(
              Stream.filter(
                (event) =>
                  event.metadata.correlationId === params.correlationId &&
                  (!params.timeRange ||
                    (event.timestamp >= params.timeRange.start && event.timestamp <= params.timeRange.end))
              ),
              Stream.runCollect
            )

          const sortedEvents = Array.fromIterable(events).sort((a, b) => a.timestamp - b.timestamp)

          // イベントフローの分析
          const analysis: EventFlowAnalysis = {
            correlationId: params.correlationId,
            totalEvents: sortedEvents.length,
            duration:
              sortedEvents.length > 1 ? sortedEvents[sortedEvents.length - 1].timestamp - sortedEvents[0].timestamp : 0,
            eventChain: sortedEvents.map((event, index) => ({
              sequence: index + 1,
              eventType: event.eventType,
              streamId: event.streamId,
              timestamp: event.timestamp,
              timeSinceStart: event.timestamp - (sortedEvents[0]?.timestamp || 0),
              timeSincePrevious: index > 0 ? event.timestamp - sortedEvents[index - 1].timestamp : 0,
            })),
            aggregatesInvolved: Array.from(new Set(sortedEvents.map((e) => e.streamId))),
            averageProcessingTime:
              sortedEvents.length > 1
                ? (sortedEvents[sortedEvents.length - 1].timestamp - sortedEvents[0].timestamp) / sortedEvents.length
                : 0,
          }

          return analysis
        }),

      detectAnomalies: (params) =>
        Effect.gen(function* () {
          const eventStore = yield* EventStore

          const events = yield* eventStore
            .readAll({
              fromPosition: 0 as GlobalPosition,
            })
            .pipe(
              Stream.filter(
                (event) =>
                  (!params.streamId || event.streamId === params.streamId) &&
                  event.timestamp >= params.timeRange.start &&
                  event.timestamp <= params.timeRange.end
              ),
              Stream.runCollect
            )

          const sortedEvents = Array.fromIterable(events).sort((a, b) => a.timestamp - b.timestamp)

          const anomalies: EventAnomaly[] = []

          // 異常検出ロジック
          for (let i = 1; i < sortedEvents.length; i++) {
            const current = sortedEvents[i]
            const previous = sortedEvents[i - 1]
            const timeDiff = current.timestamp - previous.timestamp

            // 1. 異常に長い間隔の検出
            if (timeDiff > 60000) {
              // 1分以上
              anomalies.push({
                type: 'LongInterval',
                description: `Long interval detected: ${timeDiff}ms between events`,
                streamId: current.streamId,
                eventType: current.eventType,
                timestamp: current.timestamp,
                severity: 'warning',
                metadata: { intervalMs: timeDiff },
              })
            }

            // 2. 重複イベントの検出
            if (
              current.eventType === previous.eventType &&
              current.streamId === previous.streamId &&
              timeDiff < 100 // 100ms以内
            ) {
              anomalies.push({
                type: 'DuplicateEvent',
                description: 'Potential duplicate event detected',
                streamId: current.streamId,
                eventType: current.eventType,
                timestamp: current.timestamp,
                severity: 'error',
                metadata: { previousEventTimestamp: previous.timestamp },
              })
            }
          }

          // 3. イベント頻度の異常検出
          const eventCounts = new Map<string, number>()
          sortedEvents.forEach((event) => {
            const key = `${event.streamId}-${event.eventType}`
            eventCounts.set(key, (eventCounts.get(key) || 0) + 1)
          })

          eventCounts.forEach((count, key) => {
            if (count > 1000) {
              // 閾値は調整可能
              const [streamId, eventType] = key.split('-', 2)
              anomalies.push({
                type: 'HighFrequency',
                description: `High frequency event detected: ${count} occurrences`,
                streamId,
                eventType,
                timestamp: Date.now(),
                severity: 'warning',
                metadata: { count },
              })
            }
          })

          return anomalies
        }),
    }
  })
)
```

### Event Monitoring

```typescript
export const EventMonitor = {
  create: () =>
    Effect.gen(function* () {
      const eventCounts = yield* Ref.make<Map<string, number>>(new Map())
      const eventLatencies = yield* Ref.make<Map<string, number[]>>(new Map())

      return {
        recordEvent: (event: GameEvent, latency: number) =>
          Effect.all([
            Ref.update(eventCounts, (counts) => {
              const current = counts.get(event._tag) || 0
              return new Map(counts).set(event._tag, current + 1)
            }),
            Ref.update(eventLatencies, (latencies) => {
              const current = latencies.get(event._tag) || []
              return new Map(latencies).set(event._tag, [...current, latency].slice(-100))
            }),
          ]),

        getStats: () =>
          Effect.gen(function* () {
            const counts = yield* Ref.get(eventCounts)
            const latencies = yield* Ref.get(eventLatencies)

            return Array.from(counts.entries()).map(([tag, count]) => ({
              eventType: tag,
              count,
              avgLatency: average(latencies.get(tag) || []),
              maxLatency: Math.max(...(latencies.get(tag) || [0])),
            }))
          }),
      }
    }),
}
```
