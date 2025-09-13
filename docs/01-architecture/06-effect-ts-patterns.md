# Effect-TS 利用パターン

TypeScript Minecraftプロジェクトでは、**Effect-TS 3.17+** を全面的に採用し、型安全で合成可能な純粋関数型プログラミングを実践しています。この文書では、プロジェクト全体で遵守すべきEffect-TSの最新パターンを解説します。

## 1. 基本思想: すべてはEffect

あらゆる副作用（ファイルI/O、ネットワーク、DOM操作、乱数生成、現在時刻の取得など）は `Effect` 型でカプセル化します。これにより、副作用を型シグネチャレベルで明示し、プログラムの予測可能性とテスト容易性を高めます。

```typescript
// Effect<SuccessType, ErrorType, RequirementType>
type AppEffect<A, E = never> = Effect.Effect<A, E, AppServices>;

// Schema.Structによるデータ定義（classは使用禁止）
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
});
type Position = Schema.Schema.Type<typeof Position>;
```

## 2. 主要な利用パターン

### 2.1. `Effect.gen` + `yield*` による合成（最新推奨）

**Effect-TS 3.17+ 最新パターン**: `Effect.gen` と `yield*` を使用した線形な処理フローが推奨されます。これにより、非同期処理を同期的に記述でき、可読性が向上します。

```typescript
import { Effect } from "effect";

// ✅ 最新パターン（Effect.gen + yield*）
const complexOperation = Effect.gen(function* () {
  const config = yield* getConfig();
  const data = yield* fetchData(config.apiUrl);
  const processed = yield* processData(data);
  yield* saveResult(processed);
  return processed;
});

// ✅ エラーハンドリングを含む場合
const operationWithErrorHandling = Effect.gen(function* () {
  const config = yield* getConfig();

  // 早期リターンパターン
  if (!config.enabled) {
    return yield* Effect.fail(new ConfigDisabledError());
  }

  const data = yield* fetchData(config.apiUrl).pipe(
    Effect.catchTag("NetworkError", () =>
      Effect.succeed(defaultData)
    )
  );

  return yield* processData(data);
});

// ✅ 並列処理の場合
const parallelOperation = Effect.gen(function* () {
  const [userData, configData, settingsData] = yield* Effect.all([
    fetchUserData(),
    fetchConfigData(),
    fetchSettingsData()
  ], { concurrency: "unbounded" });

  return { userData, configData, settingsData };
});
```

### 2.2. `Schema` によるデータ定義とバリデーション

`class` や `interface` の代わりに `Schema.Struct` を用いて、すべてのデータ構造を定義します。これにより、型定義と実行時バリデーションを同時に実現します。

```typescript
import { Schema } from "effect";

const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
});
type Position = Schema.Schema.Type<typeof Position>;
```

### 2.3. `Context.GenericTag` によるサービス定義（最新パターン）

**Effect-TS 3.17+ 最新パターン**: サービス（依存関係）は `Context.GenericTag` を用いて定義します。`@app/ServiceName` という命名規則を遵守し、プロジェクト内での一貫性を保ちます。

```typescript
import { Context, Effect, Schema } from "effect";

// ✅ 最新パターン（Context.GenericTag）
interface WorldServiceInterface {
  readonly getBlock: (pos: Position) => Effect.Effect<Block, BlockNotFoundError>;
  readonly setBlock: (pos: Position, block: Block) => Effect.Effect<void, BlockSetError>;
  readonly getChunk: (chunkId: ChunkId) => Effect.Effect<Chunk, ChunkNotFoundError>;
  readonly isValidPosition: (pos: Position) => Effect.Effect<boolean, never>;
}

const WorldService = Context.GenericTag<WorldServiceInterface>("@app/WorldService");

// ✅ エラー型の定義
const BlockNotFoundError = Schema.Struct({
  _tag: Schema.Literal("BlockNotFoundError"),
  position: Position,
  message: Schema.String
});
type BlockNotFoundError = Schema.Schema.Type<typeof BlockNotFoundError>;

const BlockSetError = Schema.Struct({
  _tag: Schema.Literal("BlockSetError"),
  position: Position,
  reason: Schema.String
});
type BlockSetError = Schema.Schema.Type<typeof BlockSetError>;
```

### 2.4. `Layer` による依存性注入

サービスの具体的な実装は `Layer` を用いて提供します。これにより、実装とインターフェースが分離され、テスト時にはモック実装に容易に差し替えられます。

```typescript
import { Layer, Effect } from "effect";

// ✅ 最新パターン（Effect.genを使った複雑な初期化）
const makeWorldServiceLive = Effect.gen(function* () {
  // 依存サービスの取得
  const chunkService = yield* ChunkService;
  const blockService = yield* BlockService;

  // 初期化処理
  yield* Effect.log("WorldServiceを初期化中");
  const worldBounds = yield* loadWorldBounds();

  return WorldService.of({
    getBlock: (pos) =>
      Effect.gen(function* () {
        // 早期リターン: 位置検証
        const isValid = yield* isValidPosition(pos, worldBounds);
        if (!isValid) {
          return yield* Effect.fail({
            _tag: "BlockNotFoundError" as const,
            position: pos,
            message: `位置 ${pos.x},${pos.y},${pos.z} は範囲外です`
          });
        }

        // ブロック取得
        const chunk = yield* chunkService.getChunkForPosition(pos);
        const block = yield* blockService.getBlockFromChunk(chunk, pos);
        return block;
      }),

    setBlock: (pos, block) =>
      Effect.gen(function* () {
        // バリデーション
        const isValid = yield* isValidPosition(pos, worldBounds);
        if (!isValid) {
          return yield* Effect.fail({
            _tag: "BlockSetError" as const,
            position: pos,
            reason: "位置が範囲外です"
          });
        }

        // ブロック設置
        yield* blockService.setBlock(pos, block);
        yield* Effect.log(`ブロックを ${pos.x},${pos.y},${pos.z} に設置しました`);
      }),

    getChunk: chunkService.getChunk,
    isValidPosition: (pos) => isValidPosition(pos, worldBounds)
  });
});

const WorldServiceLive = Layer.effect(WorldService, makeWorldServiceLive);

// ✅ テスト用モック実装
const WorldServiceTest = Layer.succeed(
  WorldService,
  WorldService.of({
    getBlock: () => Effect.succeed(testBlock),
    setBlock: () => Effect.void,
    getChunk: () => Effect.succeed(testChunk),
    isValidPosition: () => Effect.succeed(true)
  })
);
```

### 2.5. `Match.value` によるパターンマッチング

**Effect-TS 最新パターン**: `Match.value` を使用してタグ付きユニオンの網羅的なパターンマッチングを行います。`Match.tag` や `Match.tagStartsWith` と組み合わせて使用します。

```typescript
import { Match, Effect } from "effect";

// Schema.Structでタグ付きユニオンを定義
const MoveAction = Schema.Struct({
  _tag: Schema.Literal("Move"),
  direction: Direction,
  playerId: PlayerId
});

const AttackAction = Schema.Struct({
  _tag: Schema.Literal("Attack"),
  targetId: EntityId,
  damage: Schema.Number.pipe(Schema.positive())
});

const UseItemAction = Schema.Struct({
  _tag: Schema.Literal("UseItem"),
  itemId: ItemId,
  playerId: PlayerId
});

const GameAction = Schema.Union(MoveAction, AttackAction, UseItemAction);
type GameAction = Schema.Schema.Type<typeof GameAction>;

// ✅ 最新パターン（Match.value + Match.tag）
const handleAction = (action: GameAction): Effect.Effect<ActionResult, ActionError> =>
  Match.value(action).pipe(
    Match.tag("Move", ({ direction, playerId }) =>
      handleMove(playerId, direction)
    ),
    Match.tag("Attack", ({ targetId, damage }) =>
      handleAttack(targetId, damage)
    ),
    Match.tag("UseItem", ({ itemId, playerId }) =>
      handleItemUse(playerId, itemId)
    ),
    Match.exhaustive
  );

// ✅ 条件付きマッチング（最新パターン）
const processPlayerAction = (playerId: PlayerId, action: GameAction): Effect.Effect<void, ActionError> =>
  Match.value(action).pipe(
    Match.when(
      (action): action is Extract<GameAction, { _tag: "Move" }> => action._tag === "Move",
      ({ direction }) => executeMove(playerId, direction)
    ),
    Match.when(
      (action): action is Extract<GameAction, { _tag: "Attack" }> => action._tag === "Attack",
      ({ targetId, damage }) => executeAttack(playerId, targetId, damage)
    ),
    Match.orElse(() => Effect.fail({
      _tag: "InvalidActionError" as const,
      action,
      message: "アクションは許可されていません"
    }))
  );

// ✅ タグの部分マッチング
const isPlayerAction = (action: GameAction): boolean =>
  Match.value(action).pipe(
    Match.tagStartsWith("Move", () => true),
    Match.tagStartsWith("UseItem", () => true),
    Match.orElse(() => false)
  );
```

### 2.6. タグ付きエラー (`Tagged Errors`)

エラーは `Schema.Struct` を用いてタグ付きユニオン型として定義します。これにより、`Effect.catchTag` を使った型安全なエラーハンドリングが可能になります。

```typescript
import { Schema } from "effect";

// ✅ Schema ベースのエラー定義（改善版）
const NetworkError = Schema.Struct({
  _tag: Schema.Literal("NetworkError"),
  message: Schema.String.pipe(Schema.nonEmpty()),
  code: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  timestamp: Schema.Number.pipe(Schema.brand("Timestamp")),
  retryCount: Schema.optional(Schema.Number.pipe(Schema.nonNegative()))
})
type NetworkError = Schema.Schema.Type<typeof NetworkError>

// ✅ エラーファクトリー関数
const createNetworkError = (
  message: string,
  code: number,
  retryCount?: number
): NetworkError => ({
  _tag: "NetworkError",
  message,
  code,
  timestamp: Date.now() as any,
  retryCount
})

const ValidationError = Schema.Struct({
  _tag: Schema.Literal("ValidationError"),
  field: Schema.String.pipe(Schema.nonEmpty()),
  value: Schema.Unknown,
  constraints: Schema.Array(Schema.String)
})
type ValidationError = Schema.Schema.Type<typeof ValidationError>

type AppError = NetworkError | ValidationError

const operation = Effect.succeed("data").pipe(
  Effect.catchTag("NetworkError", (e) => Effect.log(`ネットワークエラー: ${e.message}`)),
  Effect.catchTag("ValidationError", (e) => Effect.log(`バリデーションエラー: ${e.field}`))
);
```

### 2.7. 不変データ構造

すべてのデータ構造は不変 (immutable) として扱います。状態を変更する場合は、常に新しいインスタンスを作成します。`HashMap`, `HashSet`, `List` などの永続データ構造を積極的に利用します。

```typescript
import { HashMap } from "effect";

const addItem = (inventory: HashMap.HashMap<string, number>, item: string, count: number) =>
  HashMap.set(inventory, item, (HashMap.get(inventory, item).pipe(Option.getOrElse(() => 0)) + count));
```

### 2.8. 純粋関数の分離と早期リターンパターン

**2024年最新パターン**: 副作用と純粋関数を明確に分離し、早期リターンパターンを活用してネストを浅く保ちます。

```typescript
// ✅ 純粋関数として分離
const calculateDistance = (from: Position, to: Position): number =>
  Math.sqrt(
    Math.pow(to.x - from.x, 2) +
    Math.pow(to.y - from.y, 2) +
    Math.pow(to.z - from.z, 2)
  )

const isValidPosition = (position: Position, worldBounds: WorldBounds): boolean =>
  position.x >= worldBounds.min.x && position.x <= worldBounds.max.x &&
  position.y >= worldBounds.min.y && position.y <= worldBounds.max.y &&
  position.z >= worldBounds.min.z && position.z <= worldBounds.max.z

// ✅ 早期リターンによるネスト削減（改善版）
const MAX_MOVE_DISTANCE = 100 // 定数定義

// MoveError定義
const MoveError = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("PlayerCannotMoveError"),
    playerId: Schema.String,
    reason: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("MoveDistanceTooFarError"),
    playerId: Schema.String,
    attemptedDistance: Schema.Number,
    maxDistance: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("InvalidPositionError"),
    position: Position,
    bounds: Schema.Unknown
  })
)
type MoveError = Schema.Schema.Type<typeof MoveError>

const movePlayer = (playerId: string, targetPosition: Position): Effect.Effect<void, MoveError> =>
  Effect.gen(function* () {
    const player = yield* getPlayer(playerId)

    // 早期リターン: プレイヤーが移動可能でない場合
    if (!player.canMove) {
      return yield* Effect.fail({
        _tag: "PlayerCannotMoveError" as const,
        playerId,
        reason: "プレイヤーは移動できません"
      })
    }

    // 早期リターン: 距離が無効な場合
    const distance = calculateDistance(player.position, targetPosition)
    if (distance > MAX_MOVE_DISTANCE) {
      return yield* Effect.fail({
        _tag: "MoveDistanceTooFarError" as const,
        playerId,
        attemptedDistance: distance,
        maxDistance: MAX_MOVE_DISTANCE
      })
    }

    const bounds = yield* getWorldBounds()

    // 早期リターン: 位置が無効な場合
    if (!isValidPosition(targetPosition, bounds)) {
      return yield* Effect.fail({
        _tag: "InvalidPositionError" as const,
        position: targetPosition,
        bounds
      })
    }

    // メイン処理
    yield* updatePlayerPosition(playerId, targetPosition)
    yield* Effect.log(`プレイヤー ${playerId} が ${targetPosition.x},${targetPosition.y},${targetPosition.z} に移動しました`)
  })

// ✅ ReadonlyArray操作の活用（改善版）
const processEntities = (entities: ReadonlyArray<Entity>): Effect.Effect<ReadonlyArray<ProcessedEntity>, ProcessError> =>
  Effect.gen(function* () {
    // 早期リターン: エンティティが空
    if (entities.length === 0) {
      yield* Effect.log("処理するエンティティがありません")
      return []
    }

    // ✅ 関数型パイプラインでデータ処理
    const activeEntities = ReadonlyArray.filter(entities, entity => entity.active)

    // 早期リターン: アクティブなエンティティがない
    if (activeEntities.length === 0) {
      yield* Effect.log("アクティブなエンティティが見つかりません")
      return []
    }

    yield* Effect.log(`${entities.length}個中${activeEntities.length}個のアクティブなエンティティを処理中`)

    // ✅ バッチ処理でパフォーマンス向上
    const batchSize = 50
    const batches = ReadonlyArray.chunksOf(activeEntities, batchSize)
    const results: ProcessedEntity[] = []

    for (const batch of batches) {
      const batchResults = yield* Effect.all(
        ReadonlyArray.map(batch, entity => processEntity(entity)),
        { concurrency: "unbounded" }
      )
      results.push(...batchResults)
    }

    return results
  })
```

### 2.9. Brand型とSchema検証の活用

```typescript
// ✅ Brand型による型安全性の向上
export const PlayerId = Schema.String.pipe(Schema.brand("PlayerId"))
export type PlayerId = Schema.Schema.Type<typeof PlayerId>

export const Health = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("Health")
)
export type Health = Schema.Schema.Type<typeof Health>

// ✅ 実行時検証と組み合わせ
const validatePlayerData = (input: unknown): Effect.Effect<PlayerData, ValidationError> =>
  Schema.decodeUnknownEither(PlayerData)(input).pipe(
    Effect.mapError(error => new ValidationError({ cause: error }))
  )
```

## 3. アンチパターン（絶対に避けるべきパターン）

### 3.1. クラスベースの設計（使用禁止）
```typescript
// ❌ 絶対に避けるべきパターン - classの使用
// class PlayerManager {
//   constructor(private worldService: WorldService) {}
//
//   async movePlayer(id: string, pos: Position): Promise<void> {
//     // 実装...
//   }
// }

// ❌ Data.Classの使用（古いパターン）
// import { Data } from "effect";
// class Player extends Data.Class<{ id: string; name: string }> {}

// ✅ 正しいEffect-TSパターン
const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String,
  position: Position,
  health: Health
});
type Player = Schema.Schema.Type<typeof Player>;

interface PlayerServiceInterface {
  readonly movePlayer: (id: PlayerId, pos: Position) => Effect.Effect<void, MoveError>
  readonly getPlayer: (id: PlayerId) => Effect.Effect<Option.Option<Player>, never>
  readonly updatePlayerPosition: (id: PlayerId, position: Position) => Effect.Effect<void, MoveError>
}

export const PlayerService = Context.GenericTag<PlayerServiceInterface>("@app/PlayerService");
```

### 3.2. 古いAPIパターンの使用（避けるべき）
```typescript
// ❌ 避けるべきパターン - Context.Tag（古いAPI）
// const OldService = Context.Tag<OldServiceInterface>("@app/OldService");

// ❌ Data.TaggedErrorの使用（古いAPI）
// class NetworkError extends Data.TaggedError("NetworkError")<{
//   message: string;
// }> {}

// ❌ Data.Classの使用（古いAPI）
// class Player extends Data.Class<{ id: string; name: string }> {}

// ✅ 正しい最新パターン - Context.GenericTag
interface NewServiceInterface {
  readonly processData: (data: unknown) => Effect.Effect<ProcessedData, ValidationError>
  readonly validateInput: (input: unknown) => Effect.Effect<boolean, never>
}

export const NewService = Context.GenericTag<NewServiceInterface>("@app/NewService");

// ✅ Schema.TaggedErrorによる最新のエラー定義
export class NetworkError extends Schema.TaggedError("NetworkError")<{
  readonly message: string
  readonly code: number
  readonly timestamp: number
  readonly retryCount?: number
}> {}

// ✅ Schema.Structでデータ定義
const Player = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("PlayerId")),
  name: Schema.String.pipe(Schema.nonEmpty()),
  position: Position,
  health: Health
}).pipe(
  Schema.annotations({
    identifier: "Player",
    description: "プレイヤーエンティティ"
  })
);
type Player = Schema.Schema.Type<typeof Player>;
```

### 3.3. if/else/switchの多用
```typescript
// ❌ 避けるべきパターン - if/else/switch
const processCommand = (command: Command) => {
  if (command.type === "move") {
    return handleMove(command);
  } else if (command.type === "attack") {
    return handleAttack(command);
  } else {
    return handleDefault(command);
  }
};

// ✅ Match.valueを使用（改善版）
const Command = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal("Move"), direction: Vector3, playerId: PlayerId }),
  Schema.Struct({ _tag: Schema.Literal("Attack"), targetId: EntityId, damage: Schema.Number.pipe(Schema.positive()) }),
  Schema.Struct({ _tag: Schema.Literal("UseItem"), itemId: ItemId, targetPosition: Schema.optional(Position) }),
  Schema.Struct({ _tag: Schema.Literal("Chat"), message: Schema.String.pipe(Schema.nonEmpty()) })
)
type Command = Schema.Schema.Type<typeof Command>

const CommandError = Schema.Struct({
  _tag: Schema.Literal("CommandError"),
  command: Command,
  reason: Schema.String
})
type CommandError = Schema.Schema.Type<typeof CommandError>

// ✅ 単一責務のハンドラー関数
const handleMoveCommand = ({ direction, playerId }: { direction: Vector3; playerId: PlayerId }) =>
  Effect.gen(function* () {
    yield* Effect.log(`プレイヤー ${playerId} を移動中`)
    yield* movePlayer(playerId, direction)
  })

const handleAttackCommand = ({ targetId, damage }: { targetId: EntityId; damage: number }) =>
  Effect.gen(function* () {
    yield* Effect.log(`ターゲット ${targetId} に ${damage} ダメージで攻撃中`)
    yield* attackEntity(targetId, damage)
  })

const handleUseItemCommand = ({ itemId, targetPosition }: { itemId: ItemId; targetPosition?: Position }) =>
  Effect.gen(function* () {
    yield* Effect.log(`アイテム ${itemId} を使用中${targetPosition ? ` at ${targetPosition.x},${targetPosition.y},${targetPosition.z}` : ""}`)
    yield* useItem(itemId, targetPosition)
  })

const handleChatCommand = ({ message }: { message: string }) =>
  Effect.gen(function* () {
    yield* Effect.log(`チャット: ${message}`)
    yield* broadcastMessage(message)
  })

// ✅ 改善されたコマンド処理
const processCommand = (command: Command): Effect.Effect<void, CommandError> =>
  Match.value(command).pipe(
    Match.tag("Move", handleMoveCommand),
    Match.tag("Attack", handleAttackCommand),
    Match.tag("UseItem", handleUseItemCommand),
    Match.tag("Chat", handleChatCommand),
    Match.exhaustive
  ).pipe(
    Effect.catchAll(error =>
      Effect.gen(function* () {
        yield* Effect.log(`コマンド処理失敗: ${error}`)
        return yield* Effect.fail({
          _tag: "CommandError" as const,
          command,
          reason: String(error)
        })
      })
    )
  )
```

## 4. プロジェクト固有の実装パターン

### 4.1. ECS (Entity Component System) との統合

```typescript
// コンポーネントのSchema定義
const PositionComponent = Schema.Struct({
  _tag: Schema.Literal("PositionComponent"),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
});

const VelocityComponent = Schema.Struct({
  _tag: Schema.Literal("VelocityComponent"),
  dx: Schema.Number,
  dy: Schema.Number,
  dz: Schema.Number
});

// システムの定義
interface MovementSystemInterface {
  readonly update: (deltaTime: number) => Effect.Effect<void, SystemError>
}

const MovementSystem = Context.GenericTag<MovementSystemInterface>("@app/MovementSystem");

// ✅ ECSとの統合（改善版）
interface MovementSystemInterface {
  readonly name: string
  readonly priority: number
  readonly update: (deltaTime: number) => Effect.Effect<void, SystemError>
  readonly initialize: () => Effect.Effect<void, SystemError>
  readonly cleanup: () => Effect.Effect<void, SystemError>
}

const MovementSystem = Context.GenericTag<MovementSystemInterface>("@app/MovementSystem")

// ✅ World Service定義
interface WorldServiceInterface {
  readonly getEntitiesWithComponents: (components: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<EntityId>, SystemError>
  readonly updateEntity: (entityId: EntityId, updates: Record<string, unknown>) => Effect.Effect<void, SystemError>
}

const WorldService = Context.GenericTag<WorldServiceInterface>("@app/WorldService")

// ✅ 単一責務のエンティティ更新関数
const updateEntityPosition = (
  entityId: EntityId,
  deltaTime: number,
  worldService: WorldServiceInterface
): Effect.Effect<void, SystemError> =>
  Effect.gen(function* () {
    // 早期リターン: deltaTime検証
    if (deltaTime <= 0 || deltaTime > 1) {
      return yield* Effect.fail({
        _tag: "SystemError" as const,
        systemName: "MovementSystem",
        entityId,
        reason: `無効なdeltaTime: ${deltaTime}`
      })
    }

    try {
      // コンポーネント取得と更新処理は簡略化
      yield* worldService.updateEntity(entityId, {
        lastUpdated: Date.now()
      })
    } catch (error) {
      yield* Effect.fail({
        _tag: "SystemError" as const,
        systemName: "MovementSystem",
        entityId,
        reason: `エンティティの更新に失敗: ${error}`
      })
    }
  })

// ✅ 改善されたLayer実装
const makeMovementSystemLive = Effect.gen(function* () => {
  const worldService = yield* WorldService

  return MovementSystem.of({
    name: "MovementSystem",
    priority: 100,

    initialize: () =>
      Effect.gen(function* () {
        yield* Effect.log("MovementSystemを初期化中")
        // 初期化処理
      }),

    cleanup: () =>
      Effect.gen(function* () {
        yield* Effect.log("MovementSystemをクリーンアップ中")
        // クリーンアップ処理
      }),

    update: (deltaTime) =>
      Effect.gen(function* () {
        // 早期リターン: システム入力検証
        if (deltaTime <= 0) {
          yield* Effect.log("MovementSystemの更新をスキップ: 無効なdeltaTime")
          return
        }

        const entities = yield* worldService.getEntitiesWithComponents(["PositionComponent", "VelocityComponent"])

        // 早期リターン: エンティティがない
        if (entities.length === 0) {
          return
        }

        yield* Effect.log(`${entities.length}個のエンティティをMovementSystemで更新中`)

        // ✅ バッチ処理でパフォーマンス向上
        const batchSize = 100
        const batches = ReadonlyArray.chunksOf(entities, batchSize)

        for (const batch of batches) {
          yield* Effect.all(
            ReadonlyArray.map(batch, entityId =>
              updateEntityPosition(entityId, deltaTime, worldService)
            ),
            { concurrency: "unbounded" }
          ).pipe(
            Effect.catchAll(error =>
              Effect.gen(function* () {
                yield* Effect.log(`MovementSystemでのバッチ処理失敗: ${error}`)
                // バッチ失敗でも継続
              })
            )
          )
        }
      })
  })
})

const MovementSystemLive = Layer.effect(MovementSystem, makeMovementSystemLive)
```

### 4.2. Structure of Arrays (SoA) パフォーマンス最適化

```typescript
// ✅ TypedArrayを使用した高速なコンポーネントストレージ（改善版）
const CHUNK_SIZE = 16
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE

const LightSource = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
  intensity: Schema.Number.pipe(Schema.nonNegative(), Schema.lessThanOrEqualTo(15)),
  color: Schema.optional(Schema.Struct({
    r: Schema.Number.pipe(Schema.nonNegative(), Schema.lessThanOrEqualTo(1)),
    g: Schema.Number.pipe(Schema.nonNegative(), Schema.lessThanOrEqualTo(1)),
    b: Schema.Number.pipe(Schema.nonNegative(), Schema.lessThanOrEqualTo(1))
  }))
})
type LightSource = Schema.Schema.Type<typeof LightSource>

const ChunkData = Schema.Struct({
  blocks: Schema.instanceOf(Uint8Array),
  metadata: Schema.instanceOf(Uint16Array), // ✅ 16bitでより詳細なメタデータ
  lightLevels: Schema.instanceOf(Uint8Array),
  // ✅ パフォーマンスメタデータ
  lastLightUpdate: Schema.Number.pipe(Schema.brand("Timestamp")),
  version: Schema.Number.pipe(Schema.nonNegative())
})
type ChunkData = Schema.Schema.Type<typeof ChunkData>

// ✅ 純粋関数でバッチ処理最適化
const processLightBatch = (
  lightLevels: Uint8Array,
  startIndex: number,
  lightSources: ReadonlyArray<LightSource>,
  chunkSize: number = CHUNK_SIZE
): void => {
  const endIndex = Math.min(startIndex + 4, lightLevels.length)

  for (let i = startIndex; i < endIndex; i++) {
    // 早期リターン: インデックス範囲チェック
    if (i >= lightLevels.length) break

    // 3D座標への変換
    const x = i % chunkSize
    const y = Math.floor(i / (chunkSize * chunkSize))
    const z = Math.floor((i % (chunkSize * chunkSize)) / chunkSize)

    let maxLightLevel = 0

    // ✅ 光源からの光強度計算
    for (const source of lightSources) {
      const distance = Math.sqrt(
        Math.pow(source.x - x, 2) +
        Math.pow(source.y - y, 2) +
        Math.pow(source.z - z, 2)
      )

      // 早期リターン: 距離が遠い
      if (distance > source.intensity) continue

      const lightLevel = Math.max(0, source.intensity - Math.floor(distance))
      maxLightLevel = Math.max(maxLightLevel, lightLevel)
    }

    lightLevels[i] = Math.min(15, maxLightLevel)
  }
}

// ✅ 改善されたライト更新関数
const updateLightLevels = (
  chunk: ChunkData,
  lightSources: ReadonlyArray<LightSource>
): ChunkData => {
  // 早期リターン: ライトソースがない
  if (lightSources.length === 0) {
    return {
      ...chunk,
      lightLevels: new Uint8Array(chunk.lightLevels.length).fill(0),
      lastLightUpdate: Date.now() as any,
      version: chunk.version + 1
    }
  }

  // ✅ 不変性維持のため新しい配列作成
  const newLightLevels = new Uint8Array(chunk.lightLevels)

  // ✅ SIMD最適化されたバッチ処理（4ブロックずつ）
  for (let i = 0; i < newLightLevels.length; i += 4) {
    processLightBatch(newLightLevels, i, lightSources)
  }

  return {
    ...chunk,
    lightLevels: newLightLevels,
    lastLightUpdate: Date.now() as any,
    version: chunk.version + 1
  }
}

// ✅ 非同期ライト更新関数
const updateLightLevelsAsync = (
  chunk: ChunkData,
  lightSources: ReadonlyArray<LightSource>
): Effect.Effect<ChunkData, never> =>
  Effect.gen(function* () {
    // ✅ Web Workerでの並列処理をシミュレート
    yield* Effect.sleep("1 millis") // メインスレッドをブロックしない
    const result = updateLightLevels(chunk, lightSources)
    yield* Effect.log(`チャンクバージョン ${result.version} のライト更新完了`)
    return result
  })
```

### 4.3. 高度なEffect-TSパターン（Fiber & Stream）

**最新Effect-TSパターン**: Fiber管理とStream処理を活用した高度な非同期パターンです。

```typescript
import { Effect, Fiber, Stream, Schedule, Duration } from "effect";

// ✅ Fiberによる並行処理とキャンセレーション
const GameLoop = Schema.Struct({
  tickRate: Schema.Number.pipe(Schema.positive()),
  isRunning: Schema.Boolean,
  lastTick: Schema.Number.pipe(Schema.brand("Timestamp"))
});
type GameLoop = Schema.Schema.Type<typeof GameLoop>;

// ✅ ゲームループの実装（Fiber使用）
const runGameLoop = (tickRate: number): Effect.Effect<Fiber.RuntimeFiber<void, never>, never> =>
  Effect.gen(function* () {
    const gameLoopFiber = yield* Effect.fork(
      Stream.repeatEffect(
        Effect.gen(function* () {
          yield* processTick();
          yield* Effect.sleep(Duration.millis(1000 / tickRate));
        })
      ).pipe(
        Stream.runDrain
      )
    );

    yield* Effect.log(`ゲームループ開始 @ ${tickRate} TPS`);
    return gameLoopFiber;
  });

// ✅ システム更新の並行実行
const processSystemsParallel = (deltaTime: number): Effect.Effect<void, SystemError> =>
  Effect.gen(function* () {
    // 並行実行可能なシステム
    const independentSystems = [
      updateRenderingSystem(deltaTime),
      updateSoundSystem(deltaTime),
      updateParticleSystem(deltaTime)
    ];

    // 依存関係があるシステム（順次実行）
    const dependentSystems = [
      updateMovementSystem(deltaTime),
      updatePhysicsSystem(deltaTime),
      updateCollisionSystem(deltaTime)
    ];

    // 独立システムを並行実行
    yield* Effect.all(independentSystems, { concurrency: "unbounded" });

    // 依存システムを順次実行
    for (const system of dependentSystems) {
      yield* system;
    }
  });

// ✅ Stream を使った継続的データ処理
const processPlayerInputs = (): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const inputStream = yield* createInputEventStream();

    yield* inputStream.pipe(
      // 入力イベントをバッファリング（16ms間隔）
      Stream.buffer({ capacity: 64, strategy: "dropping" }),

      // 無効な入力をフィルタ
      Stream.filter(input => validateInput(input)),

      // バッチ処理（最大10イベント）
      Stream.chunks,
      Stream.map(chunk => ReadonlyArray.fromIterable(chunk)),
      Stream.filter(batch => batch.length > 0),

      // 並列処理
      Stream.mapEffect(
        batch => Effect.all(
          ReadonlyArray.map(batch, input => processInput(input)),
          { concurrency: 4 }
        )
      ),

      // エラーハンドリング
      Stream.catchAllCause(cause =>
        Stream.fromEffect(
          Effect.gen(function* () {
            yield* Effect.log(`入力処理失敗: ${cause}`);
            return [];
          })
        )
      ),

      // 実行
      Stream.runDrain
    );
  });

// ✅ リソース管理とクリーンアップ
const withWorldSession = <A, E>(
  operation: Effect.Effect<A, E>
): Effect.Effect<A, E> =>
  Effect.acquireUseRelease(
    // リソース取得
    Effect.gen(function* () {
      yield* Effect.log("ワールドセッションを初期化中");
      const world = yield* createWorld();
      const systems = yield* initializeSystems();
      return { world, systems };
    }),

    // リソース使用
    ({ world, systems }) =>
      Effect.gen(function* () {
        yield* startSystems(systems);
        const result = yield* operation;
        return result;
      }),

    // リソース解放
    ({ world, systems }) =>
      Effect.gen(function* () {
        yield* Effect.log("ワールドセッションをクリーンアップ中");
        yield* stopSystems(systems);
        yield* saveWorld(world);
        yield* releaseResources();
      }).pipe(
        Effect.orDie  // クリーンアップは必ず実行
      )
  );
```

### 4.4. Property-Based Testing (PBT) 対応パターン

**最新Effect-TSパターン**: すべての関数をProperty-Based Testing（PBT）で検証可能にするため、小さく、純粋で、焦点を絞った関数設計を実践します。

```typescript
import { Schema, Effect, Match, ReadonlyArray } from "effect";

// ✅ PBT対応のためのピュア関数分離
const INVENTORY_MAX_SIZE = 36;

// Schemaによる型安全なデータ定義
const ItemStack = Schema.Struct({
  itemId: Schema.String.pipe(Schema.brand("ItemId")),
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.lessThanOrEqualTo(64)),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
});
type ItemStack = Schema.Schema.Type<typeof ItemStack>;

const Inventory = Schema.Struct({
  slots: Schema.Array(Schema.optional(ItemStack)),
  maxSize: Schema.Number.pipe(Schema.int(), Schema.positive())
});
type Inventory = Schema.Schema.Type<typeof Inventory>;

// ✅ 純粋関数（PBTテスト可能）
const canStackItems = (existing: ItemStack, newStack: ItemStack): boolean =>
  existing.itemId === newStack.itemId &&
  existing.quantity + newStack.quantity <= 64;

const findEmptySlot = (inventory: Inventory): number | undefined =>
  ReadonlyArray.findIndex(inventory.slots, slot => slot === undefined);

const findStackableSlot = (inventory: Inventory, itemStack: ItemStack): number | undefined =>
  ReadonlyArray.findIndex(inventory.slots, slot =>
    slot !== undefined && canStackItems(slot, itemStack)
  );

// ✅ 不変操作（PBTテスト可能）
const addItemToInventory = (
  inventory: Inventory,
  itemStack: ItemStack
): { success: boolean; updatedInventory: Inventory; remainingStack?: ItemStack } => {
  // 早期リターン: インベントリサイズ検証
  if (inventory.slots.length > inventory.maxSize) {
    return { success: false, updatedInventory: inventory };
  }

  // スタック可能なスロットを検索
  const stackableSlotIndex = findStackableSlot(inventory, itemStack);
  if (stackableSlotIndex !== -1) {
    const existingStack = inventory.slots[stackableSlotIndex]!;
    const combinedQuantity = existingStack.quantity + itemStack.quantity;

    if (combinedQuantity <= 64) {
      // 完全にスタック可能
      const newSlots = [...inventory.slots];
      newSlots[stackableSlotIndex] = {
        ...existingStack,
        quantity: combinedQuantity
      };
      return {
        success: true,
        updatedInventory: { ...inventory, slots: newSlots }
      };
    } else {
      // 部分スタック
      const newSlots = [...inventory.slots];
      newSlots[stackableSlotIndex] = {
        ...existingStack,
        quantity: 64
      };
      const remaining = combinedQuantity - 64;
      return {
        success: true,
        updatedInventory: { ...inventory, slots: newSlots },
        remainingStack: { ...itemStack, quantity: remaining }
      };
    }
  }

  // 空のスロットを検索
  const emptySlotIndex = findEmptySlot(inventory);
  if (emptySlotIndex !== -1) {
    const newSlots = [...inventory.slots];
    newSlots[emptySlotIndex] = itemStack;
    return {
      success: true,
      updatedInventory: { ...inventory, slots: newSlots }
    };
  }

  // インベントリが満杯
  return { success: false, updatedInventory: inventory, remainingStack: itemStack };
};

// ✅ Effect内での利用（副作用分離）
const InventoryError = Schema.Struct({
  _tag: Schema.Literal("InventoryError"),
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  reason: Schema.String
});
type InventoryError = Schema.Schema.Type<typeof InventoryError>;

const addItemToPlayerInventory = (
  playerId: string,
  itemStack: ItemStack
): Effect.Effect<boolean, InventoryError> =>
  Effect.gen(function* () {
    const playerInventory = yield* getPlayerInventory(playerId);

    // 純粋関数を呼び出し
    const result = addItemToInventory(playerInventory, itemStack);

    // 早期リターン: 追加失敗
    if (!result.success) {
      return yield* Effect.fail({
        _tag: "InventoryError" as const,
        playerId: playerId as any,
        reason: "インベントリにアイテムを追加できません"
      });
    }

    // インベントリ更新
    yield* updatePlayerInventory(playerId, result.updatedInventory);
    yield* Effect.log(`アイテム ${itemStack.itemId} をプレイヤー ${playerId} に追加しました`);

    // 残りアイテムの処理
    if (result.remainingStack) {
      yield* Effect.log(`${result.remainingStack.quantity}個のアイテムを追加できませんでした`);
      // 地面にドロップする等の処理
      yield* dropItemOnGround(playerId, result.remainingStack);
    }

    return result.success;
  });

// ✅ PBT テスト例（fast-checkライブラリ使用想定）
/*
import fc from "fast-check";

// アイテムスタック生成器
const ItemStackArbitrary = fc.record({
  itemId: fc.string().map(s => s as any),
  quantity: fc.integer({ min: 1, max: 64 }),
  metadata: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined })
});

// インベントリ生成器
const InventoryArbitrary = fc.record({
  slots: fc.array(fc.option(ItemStackArbitrary, { nil: undefined }), { maxLength: 36 }),
  maxSize: fc.constant(36)
});

// Property: インベントリにアイテムを追加しても不変性は保たれる
fc.property(
  InventoryArbitrary,
  ItemStackArbitrary,
  (inventory, itemStack) => {
    const result = addItemToInventory(inventory, itemStack);
    // 元のインベントリは変更されていない
    expect(inventory).toEqual(inventory);
    // 結果のインベントリは有効
    expect(result.updatedInventory.slots.length).toBeLessThanOrEqual(result.updatedInventory.maxSize);
  }
);
*/
```

## 5. まとめ

**Effect-TS 3.17+ の最新パターン**を活用することで、以下のメリットを享受できます。

### 必須パターン（Effect-TS 3.17+）
- **✅ Schema.Struct**: すべてのデータ定義とBrand型による型安全性
- **✅ Context.GenericTag**: サービス定義の統一 (`@app/ServiceName`)
- **✅ Effect.gen + yield***: 非同期処理の線形化と早期リターン
- **✅ Match.value**: 網羅的パターンマッチングとMatch.exhaustive
- **✅ Layer.effect**: 依存性注入の標準化と初期化/クリーンアップ
- **✅ ReadonlyArray**: 関数型データ操作とバッチ処理
- **✅ 純粋関数分離**: PBTテスト可能な小さく焦点を絞った関数設計

### 禁止事項（古いAPIと非推奨パターン）
- ❌ **通常のclassキーワードの使用**（Schema.Structと純粋関数で代替）
- ❌ Data.Class, Data.TaggedError（古いAPI - Schema.Struct/Schema.TaggedErrorを使用）
- ❌ Context.Tag（古いAPI - Context.GenericTagを使用）
- ❌ if/else/switchの多用（Match.valueを使用）
- ❌ async/await, Promise（Effect.genを使用）
- ❌ mutableな操作（不変データ構造を使用）

> **重要**: `Schema.TaggedError`は正しいパターンであり継続使用。ただし、通常の`class`キーワードでのビジネスロジック定義は完全禁止。

### 関数型プログラミング原則
- **✅ 単一責任**: 一つの関数は一つの責任のみ持つ
- **✅ 不変性**: すべてのデータ構造は不変として扱う
- **✅ 純粋性**: 副作用と純粋計算を明確に分離
- **✅ 合成性**: 小さな関数を組み合わせて複雑な処理を構築
- **✅ 型安全**: Schemaとユニオン型による実行時型検証

### パフォーマンス最適化パターン
- **✅ Structure of Arrays (SoA)**: TypedArrayとSIMD最適化メモリレイアウト
- **✅ バッチ処理**: キャッシュライン最適化とパフォーマンス向上
- **✅ Effect.all + concurrency**: 非同期並列処理とエラーハンドリング
- **✅ アーキタイプベースECS**: 高速クエリとシステム実行
- **✅ Web Worker統合**: CPU集約的処理のオフロード
- **✅ メモリプール**: オブジェクト生成コストの削減

### テスト戦略
- **✅ Property-Based Testing**: 純粋関数の包括的検証
- **✅ レイヤーベーステスト**: Layer.succeedによるモック注入
- **✅ 効果の分離**: 副作用と純粋計算の分離テスト

このガイドに従うことで、TypeScript Minecraftプロジェクトは**最新のEffect-TSパターン**を活用した、保守性・テスト性・パフォーマンスに優れたコードベースを実現できます。

**重要な原則:**
- 通常の`class`キーワードは完全排除（`Schema.TaggedError`のみ例外）
- すべてのビジネスロジックは`Schema.Struct` + 純粋関数で実装
- `Context.GenericTag`による統一されたサービス定義
- `Match.value`による型安全なパターンマッチング

すべての新機能開発および既存コードのリファクタリングは、ここに示されたパターンに厳密に従って実行してください。
