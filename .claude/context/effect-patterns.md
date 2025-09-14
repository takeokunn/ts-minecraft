# Effect-TS パターンカタログ

## 基本パターン

### Service定義パターン
```typescript
// 1. インターフェース定義
export interface GameLoopService {
  readonly start: () => Effect.Effect<void, GameLoopError>
  readonly stop: () => Effect.Effect<void, never>
  readonly update: (deltaTime: number) => Effect.Effect<void, UpdateError>
}

// 2. Context.GenericTag作成
export const GameLoopService = Context.GenericTag<GameLoopService>("@minecraft/GameLoopService")

// 3. Live実装
export const GameLoopServiceLive = Layer.effect(
  GameLoopService,
  Effect.gen(function* () {
    const config = yield* ConfigService

    return GameLoopService.of({
      start: () => Effect.gen(function* () {
        yield* Logger.info("Starting game loop")
        // 実装
      }),

      stop: () => Effect.sync(() => {
        // クリーンアップ
      }),

      update: (deltaTime) => Effect.gen(function* () {
        yield* validateDeltaTime(deltaTime)
        // 更新処理
      })
    })
  })
)
```

### Schema定義パターン
```typescript
import { Schema } from "@effect/schema"

// 基本型
export const Vector3 = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

// ブランド型
export const PlayerId = Schema.String.pipe(
  Schema.brand("PlayerId")
)

// Union型
export const GameMode = Schema.Literal(
  "survival",
  "creative",
  "adventure",
  "spectator"
)

// 複合型
export const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(16)
  ),
  position: Vector3,
  gameMode: GameMode,
  health: Schema.Number.pipe(
    Schema.between(0, 20)
  )
})
```

### エラー定義パターン
```typescript
// Tagged Error
export const PlayerNotFoundError = Schema.TaggedError("PlayerNotFoundError")({
  playerId: PlayerId,
  timestamp: Schema.Date
})

export const InvalidPositionError = Schema.TaggedError("InvalidPositionError")({
  position: Vector3,
  reason: Schema.String
})

// Union Error
export type PlayerError =
  | PlayerNotFoundError
  | InvalidPositionError

// エラーハンドリング
const handlePlayerOperation = (playerId: PlayerId) =>
  pipe(
    getPlayer(playerId),
    Effect.catchTag("PlayerNotFoundError", (error) =>
      Effect.gen(function* () {
        yield* Logger.warn(`Player not found: ${error.playerId}`)
        return DefaultPlayer
      })
    )
  )
```

### Layer構成パターン
```typescript
// 基本Layer
export const ConfigLayer = Layer.succeed(
  ConfigService,
  ConfigService.of({
    gameConfig: defaultGameConfig,
    serverConfig: defaultServerConfig
  })
)

// 依存Layer
export const GameLoopLayer = Layer.effectContext(
  GameLoopService,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const logger = yield* Logger

    return GameLoopService.of({
      // 実装
    })
  })
)

// Layer合成
export const AppLayer = Layer.mergeAll(
  ConfigLayer,
  LoggerLayer,
  GameLoopLayer,
  WorldServiceLayer,
  PlayerServiceLayer
)

// 実行
export const runApp = pipe(
  mainProgram,
  Effect.provide(AppLayer),
  Effect.runPromise
)
```

## 高度なパターン

### Effect.gen パターン
```typescript
// 基本的なEffect.gen
export const processPlayer = (playerId: PlayerId) =>
  Effect.gen(function* () {
    // サービス取得
    const playerService = yield* PlayerService
    const worldService = yield* WorldService

    // 逐次処理
    const player = yield* playerService.get(playerId)
    const world = yield* worldService.getPlayerWorld(player)

    // 条件分岐
    if (player.health <= 0) {
      yield* playerService.respawn(player)
    }

    // 並行処理
    const [inventory, stats] = yield* Effect.all([
      playerService.getInventory(playerId),
      playerService.getStats(playerId)
    ])

    return { player, world, inventory, stats }
  })
```

### Match パターン
```typescript
import { Match } from "effect"

// 基本的なMatch
export const handleAction = (action: PlayerAction) =>
  Match.value(action).pipe(
    Match.tag("Move", ({ position }) =>
      movePlayer(position)
    ),
    Match.tag("Attack", ({ target }) =>
      attackTarget(target)
    ),
    Match.tag("UseItem", ({ item }) =>
      useItem(item)
    ),
    Match.exhaustive
  )

// when条件付きMatch
export const calculateDamage = (weapon: Weapon, target: Entity) =>
  Match.value(weapon).pipe(
    Match.when(
      (w) => w.type === "sword",
      (sword) => sword.damage * 1.5
    ),
    Match.when(
      (w) => w.type === "bow",
      (bow) => bow.damage * (1 + bow.accuracy)
    ),
    Match.orElse(() => 1)
  )
```

### Ref パターン（状態管理）
```typescript
// Ref作成
export const createGameState = () =>
  Effect.gen(function* () {
    const playersRef = yield* Ref.make(new Map<PlayerId, Player>())
    const worldRef = yield* Ref.make(initialWorld)

    return {
      addPlayer: (player: Player) =>
        Ref.update(playersRef, (map) =>
          new Map(map).set(player.id, player)
        ),

      removePlayer: (playerId: PlayerId) =>
        Ref.update(playersRef, (map) => {
          const newMap = new Map(map)
          newMap.delete(playerId)
          return newMap
        }),

      getPlayers: () => Ref.get(playersRef),

      updateWorld: (update: WorldUpdate) =>
        Ref.modify(worldRef, (world) => {
          const newWorld = applyUpdate(world, update)
          return [update.id, newWorld]
        })
    }
  })
```

### Stream パターン
```typescript
import { Stream } from "effect"

// イベントストリーム
export const createEventStream = () =>
  Stream.async<GameEvent>((emit) => {
    const handler = (event: GameEvent) => {
      emit(Effect.succeed(Chunk.of(event)))
    }

    eventBus.on("game-event", handler)

    return Effect.sync(() => {
      eventBus.off("game-event", handler)
    })
  })

// ストリーム処理
export const processEvents = (stream: Stream.Stream<GameEvent>) =>
  pipe(
    stream,
    Stream.filter((event) => event.type === "player_action"),
    Stream.map((event) => processAction(event)),
    Stream.tap((result) => Logger.debug(`Processed: ${result}`)),
    Stream.runDrain
  )
```

### Schedule パターン
```typescript
import { Schedule, Duration } from "effect"

// 固定間隔
export const gameLoopSchedule = Schedule.fixed(Duration.millis(16))

// 指数バックオフ
export const retrySchedule = Schedule.exponential(Duration.seconds(1))

// 条件付きリトライ
export const smartRetry = <A, E>(effect: Effect.Effect<A, E>) =>
  pipe(
    effect,
    Effect.retry(
      Schedule.recurWhile<E>((error) =>
        error._tag === "NetworkError" ||
        error._tag === "TemporaryError"
      ).pipe(
        Schedule.intersect(Schedule.recurs(5))
      )
    )
  )
```

## パフォーマンスパターン

### バッチ処理
```typescript
export const batchUpdate = (updates: ReadonlyArray<Update>) =>
  Effect.gen(function* () {
    // チャンクに分割
    const chunks = Chunk.chunksOf(updates, 100)

    // 並行処理
    yield* Effect.forEach(
      chunks,
      (chunk) => processChunk(chunk),
      { concurrency: 4 }
    )
  })
```

### メモ化
```typescript
const memoizedCalculation = Effect.cached(
  expensiveCalculation,
  Duration.minutes(5)
)
```

### デバウンス
```typescript
export const debouncedSave = Effect.debounce(
  saveWorld,
  Duration.seconds(5)
)
```