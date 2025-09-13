---
title: "03 Data Modeling Patterns"
description: "TypeScript Minecraft プロジェクトにおけるDDD原則に基づくデータモデリングパターンの実装ガイド。Effect-TS 3.17+とSchema.Structを活用した型安全なドメインモデル設計。"
category: "pattern"
difficulty: "intermediate"
tags: ["ddd", "data-modeling", "schema", "effect-ts", "domain-design", "patterns"]
prerequisites: ["effect-ts-fundamentals", "ddd-basics", "schema-design"]
estimated_reading_time: "25分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# データモデリングパターン

## 概要

このドキュメントでは、TypeScript Minecraftプロジェクトで使用されているDDD（ドメイン駆動設計）原則に基づくデータモデリングパターンを説明します。Effect-TS 3.17+とSchema.Structを活用した型安全で実行時検証可能なドメインモデル設計のベストプラクティスを提示します。

### プロジェクトのモデリング原則

1. **Schema駆動設計**: すべてのデータ構造を`Schema.Struct`で定義
2. **型安全性**: Branded TypesとBrand関数による実行時型検証
3. **不変性**: すべてのデータ構造は不変として扱う
4. **純粋関数分離**: 副作用と純粋計算を明確に分離
5. **関数型合成**: 小さく焦点を絞った関数の組み合わせ

---

## パターン1: Entity/Value Objectパターン

### 問題の文脈

DDD設計において、エンティティ（識別子を持つドメインオブジェクト）と値オブジェクト（等価性で判定される不変オブジェクト）を明確に区別し、型安全性を保ちながら実装する必要があります。

### 解決策

Effect-TSの`Schema.Struct`とBranded Typesを使用して、エンティティと値オブジェクトを型レベルで区別し、実行時検証を組み込みます。

### Schema定義例

```typescript
import { Schema, Brand } from "effect";

// ✅ Value Objects（値オブジェクト）
const Position = Schema.Struct({
  x: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(-30_000_000),
    Schema.lessThanOrEqualTo(30_000_000)
  ),
  y: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(-64),
    Schema.lessThanOrEqualTo(320)
  ),
  z: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(-30_000_000),
    Schema.lessThanOrEqualTo(30_000_000)
  )
}).pipe(
  Schema.annotations({
    identifier: "Position",
    title: "3D座標",
    description: "ワールド内の3次元座標を表現する値オブジェクト"
  })
);
type Position = Schema.Schema.Type<typeof Position>;

const Rotation = Schema.Struct({
  yaw: Schema.Number.pipe(Schema.between(-180, 180)),
  pitch: Schema.Number.pipe(Schema.between(-90, 90))
}).pipe(
  Schema.annotations({
    identifier: "Rotation",
    title: "回転角度",
    description: "エンティティの向きを表す値オブジェクト"
  })
);
type Rotation = Schema.Schema.Type<typeof Rotation>;

// ✅ Entity Identifiers（エンティティ識別子）
const PlayerId = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  Schema.brand("PlayerId")
);
type PlayerId = Schema.Schema.Type<typeof PlayerId>;

const EntityId = Schema.String.pipe(
  Schema.uuid(),
  Schema.brand("EntityId")
);
type EntityId = Schema.Schema.Type<typeof EntityId>;

// ✅ Entity（エンティティ）
const Player = Schema.Struct({
  id: PlayerId,  // エンティティの識別子
  name: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(16),
    Schema.pattern(/^[a-zA-Z0-9_]+$/),
    Schema.brand("PlayerName")
  ),
  position: Position,    // 値オブジェクトの埋め込み
  rotation: Rotation,    // 値オブジェクトの埋め込み
  health: Schema.Number.pipe(
    Schema.between(0, 20),
    Schema.brand("Health")
  ),
  gameMode: Schema.Literal("survival", "creative", "adventure", "spectator")
}).pipe(
  Schema.annotations({
    identifier: "Player",
    title: "プレイヤーエンティティ",
    description: "ゲーム内のプレイヤーを表すエンティティ"
  })
);
type Player = Schema.Schema.Type<typeof Player>;
```

### 実装例

```typescript
// ✅ 値オブジェクトの操作（純粋関数）
const calculateDistance = (from: Position, to: Position): number =>
  Math.sqrt(
    Math.pow(to.x - from.x, 2) +
    Math.pow(to.y - from.y, 2) +
    Math.pow(to.z - from.z, 2)
  );

const movePosition = (position: Position, deltaX: number, deltaY: number, deltaZ: number): Position => ({
  x: position.x + deltaX,
  y: position.y + deltaY,
  z: position.z + deltaZ
});

// ✅ エンティティの操作（不変更新）
const updatePlayerPosition = (player: Player, newPosition: Position): Player => ({
  ...player,
  position: newPosition
});

const damagePlayer = (player: Player, damage: number): Player => ({
  ...player,
  health: Math.max(0, player.health - damage) as any
});
```

### 利点

- **型安全性**: コンパイル時および実行時の型検証
- **不変性**: 値オブジェクトとエンティティの一貫した不変更新
- **明確な責任**: エンティティの識別性と値オブジェクトの等価性を明確に区別
- **実行時検証**: Schema検証による堅牢なデータ整合性

### 制約

- ランタイム検証のオーバーヘッドが存在する
- Schemaの学習コストが必要
- 複雑な変換処理でパフォーマンス考慮が必要

---

## パターン2: Aggregateパターン

### 問題の文脈

複雑なビジネスルールを持つドメインオブジェクトの集合を一貫性を保ちながら管理し、ドメインの不変条件を維持する必要があります。

### 解決策

集約ルートとしてのエンティティを定義し、関連する値オブジェクトとエンティティを一つのトランザクション境界として管理します。

### Schema定義例

```typescript
// ✅ インベントリアグリゲート
const ItemStack = Schema.Struct({
  itemId: Schema.String.pipe(Schema.brand("ItemId")),
  count: Schema.Number.pipe(Schema.between(1, 64)),
  metadata: Schema.optional(
    Schema.Struct({
      durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
      enchantments: Schema.optional(Schema.Array(Schema.String)),
      customName: Schema.optional(Schema.String)
    })
  )
}).pipe(
  Schema.annotations({
    identifier: "ItemStack",
    title: "アイテムスタック",
    description: "アイテムの数量とメタデータを含む値オブジェクト"
  })
);
type ItemStack = Schema.Schema.Type<typeof ItemStack>;

const Inventory = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("InventoryId")),
  slots: Schema.Array(Schema.Option(ItemStack)).pipe(Schema.maxItems(45)),
  maxSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  selectedSlot: Schema.Number.pipe(Schema.between(0, 8))
}).pipe(
  Schema.annotations({
    identifier: "Inventory",
    title: "インベントリ集約",
    description: "プレイヤーのアイテム管理を行う集約ルート"
  })
);
type Inventory = Schema.Schema.Type<typeof Inventory>;
```

### 実装例

```typescript
// ✅ 集約操作（ビジネスルール実装）
const InventoryOperations = {
  // アイテム追加の不変条件を保証
  addItem: (inventory: Inventory, item: ItemStack): Option.Option<Inventory> => {
    const emptySlotIndex = ReadonlyArray.findIndex(
      inventory.slots,
      slot => Option.isNone(slot)
    );

    // 不変条件チェック
    if (emptySlotIndex === -1) {
      return Option.none(); // インベントリ満杯
    }

    if (item.count > 64 || item.count < 1) {
      return Option.none(); // 無効なアイテム数
    }

    // 不変更新
    const newSlots = ReadonlyArray.modify(
      inventory.slots,
      emptySlotIndex,
      () => Option.some(item)
    );

    return Option.some({
      ...inventory,
      slots: newSlots
    });
  },

  // スタック結合ルール
  canStackItems: (existing: ItemStack, newItem: ItemStack): boolean =>
    existing.itemId === newItem.itemId &&
    existing.count + newItem.count <= 64,

  // アイテム移動の整合性保証
  moveItem: (
    inventory: Inventory,
    fromSlot: number,
    toSlot: number
  ): Option.Option<Inventory> => {
    if (fromSlot < 0 || fromSlot >= inventory.slots.length ||
        toSlot < 0 || toSlot >= inventory.slots.length) {
      return Option.none();
    }

    const fromItem = inventory.slots[fromSlot];
    const toItem = inventory.slots[toSlot];

    if (Option.isNone(fromItem)) {
      return Option.none();
    }

    const newSlots = [...inventory.slots];
    newSlots[fromSlot] = toItem;
    newSlots[toSlot] = fromItem;

    return Option.some({
      ...inventory,
      slots: newSlots
    });
  }
};
```

### 利点

- **一貫性保証**: 集約境界内でのビジネスルール遵守
- **封じ込め**: 複雑なドメインロジックの集約内封じ込め
- **トランザクション境界**: 明確なデータ変更単位
- **不変条件維持**: 集約操作による不変条件の自動保証

### 制約

- 集約の設計が複雑になりがち
- 過度に大きな集約はパフォーマンス問題を引き起こす
- 集約間の整合性管理は別途考慮が必要

---

## パターン3: Repositoryパターン

### 問題の文脈

ドメインオブジェクトの永続化と取得を、ドメインロジックから分離し、型安全で合成可能な方法で実装する必要があります。

### 解決策

Effect-TSの`Context.GenericTag`とLayerシステムを使用して、Repository インターフェースを定義し、実装を依存性注入で提供します。

### Schema定義例

```typescript
// ✅ Repository インターフェース定義
interface PlayerRepositoryInterface {
  readonly findById: (id: PlayerId) => Effect.Effect<Option.Option<Player>, RepositoryError>;
  readonly findByName: (name: string) => Effect.Effect<Option.Option<Player>, RepositoryError>;
  readonly save: (player: Player) => Effect.Effect<void, RepositoryError>;
  readonly delete: (id: PlayerId) => Effect.Effect<void, RepositoryError>;
  readonly findAll: () => Effect.Effect<ReadonlyArray<Player>, RepositoryError>;
}

const PlayerRepository = Context.GenericTag<PlayerRepositoryInterface>(
  "@app/PlayerRepository"
);

// ✅ エラー型定義
const RepositoryError = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("NotFoundError"),
    id: Schema.String,
    entityType: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("DuplicateError"),
    id: Schema.String,
    entityType: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("PersistenceError"),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  })
);
type RepositoryError = Schema.Schema.Type<typeof RepositoryError>;
```

### 実装例

```typescript
// ✅ メモリ実装（テスト用）
const makePlayerRepositoryMemory = Effect.gen(function* () {
  const storage = yield* Ref.make(new Map<string, Player>());

  return PlayerRepository.of({
    findById: (id) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storage);
        const player = store.get(id);
        return Option.fromNullable(player);
      }),

    findByName: (name) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storage);
        const player = Array.from(store.values()).find(p => p.name === name);
        return Option.fromNullable(player);
      }),

    save: (player) =>
      Effect.gen(function* () {
        yield* Ref.update(storage, store =>
          new Map(store).set(player.id, player)
        );
        yield* Effect.log(`プレイヤー ${player.name} を保存しました`);
      }),

    delete: (id) =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storage);
        if (!store.has(id)) {
          return yield* Effect.fail({
            _tag: "NotFoundError" as const,
            id,
            entityType: "Player"
          });
        }

        yield* Ref.update(storage, store => {
          const newStore = new Map(store);
          newStore.delete(id);
          return newStore;
        });
      }),

    findAll: () =>
      Effect.gen(function* () {
        const store = yield* Ref.get(storage);
        return Array.from(store.values());
      })
  });
});

// ✅ データベース実装
const makePlayerRepositoryDatabase = Effect.gen(function* () {
  const db = yield* DatabaseService;

  return PlayerRepository.of({
    findById: (id) =>
      Effect.gen(function* () {
        const query = "SELECT * FROM players WHERE id = ?";
        const result = yield* db.query(query, [id]).pipe(
          Effect.catchTag("QueryError", error =>
            Effect.fail({
              _tag: "PersistenceError" as const,
              message: `Player query failed: ${error.message}`,
              cause: error
            })
          )
        );

        if (result.length === 0) {
          return Option.none();
        }

        const playerData = yield* Schema.decodeUnknown(Player)(result[0]).pipe(
          Effect.mapError(error => ({
            _tag: "PersistenceError" as const,
            message: "Invalid player data format",
            cause: error
          }))
        );

        return Option.some(playerData);
      }),

    save: (player) =>
      Effect.gen(function* () {
        const query = `
          INSERT INTO players (id, name, position_x, position_y, position_z, health, game_mode)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            position_x = excluded.position_x,
            position_y = excluded.position_y,
            position_z = excluded.position_z,
            health = excluded.health,
            game_mode = excluded.game_mode
        `;

        yield* db.execute(query, [
          player.id,
          player.name,
          player.position.x,
          player.position.y,
          player.position.z,
          player.health,
          player.gameMode
        ]).pipe(
          Effect.catchTag("ExecuteError", error =>
            Effect.fail({
              _tag: "PersistenceError" as const,
              message: `Failed to save player: ${error.message}`,
              cause: error
            })
          )
        );
      }),

    // 他のメソッドも同様に実装
    findByName: (name) => /* 実装省略 */ Effect.succeed(Option.none()),
    delete: (id) => /* 実装省略 */ Effect.void,
    findAll: () => /* 実装省略 */ Effect.succeed([])
  });
});

// ✅ Layer定義
export const PlayerRepositoryMemoryLive = Layer.effect(
  PlayerRepository,
  makePlayerRepositoryMemory
);

export const PlayerRepositoryDatabaseLive = Layer.effect(
  PlayerRepository,
  makePlayerRepositoryDatabase
).pipe(
  Layer.provide(DatabaseServiceLive)
);
```

### 利点

- **関心の分離**: ドメインロジックと永続化ロジックの分離
- **テスタビリティ**: 異なる実装を簡単に切り替え可能
- **型安全性**: Effect型による明示的なエラーハンドリング
- **合成可能性**: 他のサービスとの組み合わせが容易

### 制約

- 実装の複雑さが増加
- 抽象化レイヤーのオーバーヘッド
- 複雑なクエリの表現が困難な場合がある

---

## パターン4: Branded Typesパターン

### 問題の文脈

プリミティブ型（string, number等）を使用する際に、異なる概念のデータが誤って混在することを防ぎ、型レベルでドメイン概念を明確に表現する必要があります。

### 解決策

Effect-TSのBrand機能を使用して、プリミティブ型に型レベルのタグを付与し、実行時検証と組み合わせて型安全性を向上させます。

### Schema定義例

```typescript
// ✅ Branded Types定義
const PlayerId = Schema.String.pipe(
  Schema.pattern(/^player_[a-f0-9]{32}$/),
  Schema.brand("PlayerId")
);
type PlayerId = Schema.Schema.Type<typeof PlayerId>;

const ChunkId = Schema.String.pipe(
  Schema.pattern(/^chunk_-?\d+_-?\d+$/),
  Schema.brand("ChunkId")
);
type ChunkId = Schema.Schema.Type<typeof ChunkId>;

const BlockId = Schema.String.pipe(
  Schema.pattern(/^minecraft:[a-z_]+$/),
  Schema.brand("BlockId")
);
type BlockId = Schema.Schema.Type<typeof BlockId>;

// ✅ 数値型のBranded Types
const Health = Schema.Number.pipe(
  Schema.between(0, 20),
  Schema.brand("Health")
);
type Health = Schema.Schema.Type<typeof Health>;

const Experience = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand("Experience")
);
type Experience = Schema.Schema.Type<typeof Experience>;

const Timestamp = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand("Timestamp")
);
type Timestamp = Schema.Schema.Type<typeof Timestamp>;

// ✅ 複合Branded Types
const Coordinate = Schema.Number.pipe(
  Schema.int(),
  Schema.between(-30_000_000, 30_000_000),
  Schema.brand("Coordinate")
);
type Coordinate = Schema.Schema.Type<typeof Coordinate>;

const ChunkPosition = Schema.Struct({
  x: Coordinate,
  z: Coordinate
}).pipe(
  Schema.transform(
    Schema.Struct({ x: Coordinate, z: Coordinate }),
    ChunkId,
    {
      decode: ({ x, z }) => `chunk_${x}_${z}` as ChunkId,
      encode: (chunkId) => {
        const [, x, z] = chunkId.match(/^chunk_(-?\d+)_(-?\d+)$/) || [];
        return {
          x: parseInt(x, 10) as Coordinate,
          z: parseInt(z, 10) as Coordinate
        };
      }
    }
  ),
  Schema.brand("ChunkPosition")
);
type ChunkPosition = Schema.Schema.Type<typeof ChunkPosition>;
```

### 実装例

```typescript
// ✅ Branded Types操作関数
const createPlayerId = (rawId: string): Effect.Effect<PlayerId, ValidationError> =>
  Schema.decodeUnknown(PlayerId)(rawId).pipe(
    Effect.mapError(error => ({
      _tag: "ValidationError" as const,
      field: "playerId",
      value: rawId,
      message: "Invalid player ID format"
    }))
  );

const createChunkId = (x: number, z: number): Effect.Effect<ChunkId, ValidationError> =>
  Effect.gen(function* () {
    const coordX = yield* Schema.decodeUnknown(Coordinate)(x);
    const coordZ = yield* Schema.decodeUnknown(Coordinate)(z);

    return `chunk_${coordX}_${coordZ}` as ChunkId;
  });

// ✅ 型安全な操作
const calculateHealthPercentage = (health: Health): number =>
  (health / 20) * 100;

const addExperience = (current: Experience, additional: Experience): Experience =>
  (current + additional) as Experience;

const isRecentTimestamp = (timestamp: Timestamp): boolean =>
  Date.now() - timestamp < 300000; // 5分以内

// ✅ 型ガード関数
const isValidPlayerId = (value: string): value is PlayerId => {
  const result = Schema.decodeUnknownEither(PlayerId)(value);
  return Either.isRight(result);
};

const isValidBlockId = (value: string): value is BlockId => {
  const result = Schema.decodeUnknownEither(BlockId)(value);
  return Either.isRight(result);
};

// ✅ 変換ヘルパー
const playerIdToString = (id: PlayerId): string => id;
const stringToPlayerId = (s: string): Option.Option<PlayerId> => {
  const result = Schema.decodeUnknownEither(PlayerId)(s);
  return Either.match(result, {
    onLeft: () => Option.none(),
    onRight: Option.some
  });
};
```

### 利点

- **型安全性**: コンパイル時に型の誤用を防止
- **実行時検証**: パターンや範囲の動的検証
- **ドメイン表現**: ビジネス概念の型レベル表現
- **リファクタリング安全性**: 型変更時の影響範囲が明確

### 制約

- ランタイム検証のパフォーマンスコスト
- 型変換の複雑さが増加
- デバッグ時の型情報の複雑化

---

## パターン5: Immutable Dataパターン

### 問題の文脈

関数型プログラミングにおいて、データの不変性を保ちながら効率的なデータ操作を行い、予期しない副作用を防ぐ必要があります。

### 解決策

Effect-TSのReadonlyArrayやHashMapなどの不変データ構造を使用し、すべてのデータ操作を不変操作として実装します。

### Schema定義例

```typescript
// ✅ 不変データ構造の定義
const GameState = Schema.Struct({
  players: Schema.Array(Player),
  world: Schema.Struct({
    chunks: Schema.Array(
      Schema.Struct({
        id: ChunkId,
        blocks: Schema.instanceOf(Uint8Array),
        entities: Schema.Array(EntityId),
        lastModified: Timestamp
      })
    ),
    time: Schema.Number.pipe(Schema.between(0, 24000)),
    weather: Schema.Literal("clear", "rain", "storm", "snow")
  }),
  gameRules: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean)
  })
}).pipe(
  Schema.annotations({
    identifier: "GameState",
    title: "ゲーム状態",
    description: "ゲーム全体の不変状態を表すデータ構造"
  })
);
type GameState = Schema.Schema.Type<typeof GameState>;

// ✅ チャンクデータ（SoAパターン）
const ChunkData = Schema.Struct({
  id: ChunkId,
  blocks: Schema.instanceOf(Uint16Array).pipe(
    Schema.filter(arr => arr.length === 4096, {
      message: "Chunk must contain exactly 4096 blocks (16x16x16)"
    })
  ),
  lightLevels: Schema.instanceOf(Uint8Array).pipe(
    Schema.filter(arr => arr.length === 4096)
  ),
  biomes: Schema.instanceOf(Uint8Array).pipe(
    Schema.filter(arr => arr.length === 256)
  ),
  entities: Schema.Array(EntityId),
  lastUpdate: Timestamp
}).pipe(
  Schema.annotations({
    identifier: "ChunkData",
    title: "チャンクデータ",
    description: "Structure of Arrays パターンによる高効率チャンクデータ"
  })
);
type ChunkData = Schema.Schema.Type<typeof ChunkData>;
```

### 実装例

```typescript
// ✅ 不変データ操作（ReadonlyArray使用）
const GameStateOperations = {
  // プレイヤー追加（不変操作）
  addPlayer: (gameState: GameState, player: Player): GameState => ({
    ...gameState,
    players: ReadonlyArray.append(gameState.players, player)
  }),

  // プレイヤー更新（不変操作）
  updatePlayer: (gameState: GameState, playerId: PlayerId, updater: (player: Player) => Player): Option.Option<GameState> => {
    const index = ReadonlyArray.findIndex(gameState.players, p => p.id === playerId);

    if (index === -1) {
      return Option.none();
    }

    const updatedPlayers = ReadonlyArray.modify(
      gameState.players,
      index,
      updater
    );

    return Option.some({
      ...gameState,
      players: updatedPlayers
    });
  },

  // プレイヤー削除（不変操作）
  removePlayer: (gameState: GameState, playerId: PlayerId): GameState => ({
    ...gameState,
    players: ReadonlyArray.filter(gameState.players, p => p.id !== playerId)
  }),

  // ワールド時間更新
  advanceTime: (gameState: GameState, deltaTime: number): GameState => ({
    ...gameState,
    world: {
      ...gameState.world,
      time: (gameState.world.time + deltaTime) % 24000
    }
  }),

  // 天気変更
  changeWeather: (gameState: GameState, newWeather: GameState["world"]["weather"]): GameState => ({
    ...gameState,
    world: {
      ...gameState.world,
      weather: newWeather
    }
  })
};

// ✅ 効率的なバッチ操作
const BatchOperations = {
  // 複数プレイヤーの位置更新
  updatePlayerPositions: (
    gameState: GameState,
    updates: ReadonlyArray<{ playerId: PlayerId; position: Position }>
  ): GameState => {
    // 更新マップを作成
    const updateMap = new Map(
      updates.map(update => [update.playerId, update.position])
    );

    // 効率的な一括更新
    const updatedPlayers = ReadonlyArray.map(gameState.players, player =>
      updateMap.has(player.id)
        ? { ...player, position: updateMap.get(player.id)! }
        : player
    );

    return {
      ...gameState,
      players: updatedPlayers
    };
  },

  // チャンク内ブロック一括更新（TypedArray最適化）
  updateChunkBlocks: (
    chunk: ChunkData,
    blockUpdates: ReadonlyArray<{ index: number; blockId: number }>
  ): ChunkData => {
    // TypedArrayの効率的な複製
    const newBlocks = new Uint16Array(chunk.blocks);

    // バッチ更新
    for (const update of blockUpdates) {
      if (update.index >= 0 && update.index < 4096) {
        newBlocks[update.index] = update.blockId;
      }
    }

    return {
      ...chunk,
      blocks: newBlocks,
      lastUpdate: Date.now() as Timestamp
    };
  },

  // 範囲内エンティティフィルタリング
  getPlayersInRange: (
    gameState: GameState,
    center: Position,
    radius: number
  ): ReadonlyArray<Player> =>
    ReadonlyArray.filter(
      gameState.players,
      player => calculateDistance(player.position, center) <= radius
    ),

  // 条件による複合フィルタリング
  getPlayersBy: (
    gameState: GameState,
    predicate: (player: Player) => boolean
  ): ReadonlyArray<Player> =>
    ReadonlyArray.filter(gameState.players, predicate)
};

// ✅ HashMap使用の効率的なデータアクセス
import { HashMap } from "effect";

const createPlayerIndex = (players: ReadonlyArray<Player>): HashMap.HashMap<PlayerId, Player> =>
  HashMap.fromIterable(ReadonlyArray.map(players, player => [player.id, player]));

const createChunkIndex = (chunks: ReadonlyArray<ChunkData>): HashMap.HashMap<ChunkId, ChunkData> =>
  HashMap.fromIterable(ReadonlyArray.map(chunks, chunk => [chunk.id, chunk]));

// ✅ 効率的な状態更新パイプライン
const updateGameStatePipeline = (
  initialState: GameState,
  operations: ReadonlyArray<(state: GameState) => GameState>
): GameState =>
  ReadonlyArray.reduce(operations, initialState, (state, operation) => operation(state));

// ✅ 複合操作の例
const complexGameUpdate = (gameState: GameState): GameState =>
  pipe(
    gameState,
    state => GameStateOperations.advanceTime(state, 50), // 時間進行
    state => GameStateOperations.changeWeather(state, "rain"), // 天気変更
    state => BatchOperations.updatePlayerPositions(state, [
      { playerId: "player_123" as PlayerId, position: { x: 10, y: 64, z: 20 } }
    ])
  );
```

### 利点

- **予測可能性**: 不変データによる副作用の排除
- **並行安全性**: 複数スレッドでの安全な読み取りアクセス
- **デバッグ容易性**: 状態変化の追跡が容易
- **関数型合成**: パイプライン処理での自然な合成
- **メモリ効率**: 構造共有による効率的なメモリ使用

### 制約

- 学習コストが高い
- 大量データ操作時のパフォーマンス考慮が必要
- GCプレッシャーが高い場合がある

---

## まとめ

この文書では、TypeScript MinecraftプロジェクトにおけるDDD原則に基づく5つの主要なデータモデリングパターンを説明しました。

### パターンの使い分けガイド

1. **Entity/Value Objectパターン**: ドメインオブジェクトの基本設計
2. **Aggregateパターン**: 複雑なビジネスルールとトランザクション境界の管理
3. **Repositoryパターン**: データアクセスとドメインロジックの分離
4. **Branded Typesパターン**: 型安全性とドメイン概念の明確化
5. **Immutable Dataパターン**: 関数型プログラミングによる予測可能なデータ操作

### 実装時の注意点

- すべてのデータ構造は`Schema.Struct`で定義する
- Brand型を積極的に活用して型安全性を向上させる
- 不変性を保ち、純粋関数での操作を心がける
- パフォーマンスが重要な部分では`TypedArray`や`HashMap`を活用する
- Effect-TSの型システムを最大限活用してエラーハンドリングを明示的にする

これらのパターンを適切に組み合わせることで、型安全で保守可能、かつ高性能なドメインモデルを構築できます。

## 関連ドキュメント

- [Effect-TS利用パターン](../../01-architecture/06-effect-ts-patterns.md) - Effect-TS 3.17+の最新パターン詳細
- [DDD戦略的設計](../../01-architecture/02-ddd-strategic-design.md) - ドメイン駆動設計の戦略レベル詳細
- [サービスパターン](./01-service-patterns.md) - サービス層の設計パターン
- [エラーハンドリングパターン](./02-error-handling-patterns.md) - 型安全なエラーハンドリング