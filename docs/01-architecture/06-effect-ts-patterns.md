---
title: "Effect-TS 利用パターン - 関数型プログラミング実践"
description: "Effect-TS 3.17+の最新パターンによる純粋関数型プログラミング実践ガイド。Schema.Struct、Context.GenericTag、Match.valueを活用した高品質コード作成。"
category: "architecture"
difficulty: "advanced"
tags: ["effect-ts", "functional-programming", "schema", "context", "patterns", "best-practices"]
prerequisites: ["typescript-advanced", "effect-ts-fundamentals", "functional-programming-basics"]
estimated_reading_time: "45分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Effect-TS 利用パターン

TypeScript Minecraftプロジェクトでは、**Effect-TS 3.17+** を全面的に採用し、型安全で合成可能な純粋関数型プログラミングを実践しています。この文書では、プロジェクト全体で遵守すべきEffect-TSの最新パターンを解説します。

## 1. 基本思想: すべてはEffect

あらゆる副作用（ファイルI/O、ネットワーク、DOM操作、乱数生成、現在時刻の取得など）は `Effect` 型でカプセル化します。これにより、副作用を型シグネチャレベルで明示し、プログラムの予測可能性とテスト容易性を高めます。

### 1.1 Effect-TSアーキテクチャ概観

以下の図は、Effect-TS 3.17+パターンによる純粋関数型プログラミングアーキテクチャを示しています。

```mermaid
%%{init: {"theme": "neutral", "themeVariables": {"primaryColor": "#4285f4", "primaryTextColor": "#ffffff", "primaryBorderColor": "#ffffff", "lineColor": "#4285f4", "sectionBkgColor": "#f5f7fa", "tertiaryColor": "#f5f7fa"}}}%%
graph TB
    subgraph EffectCore ["Effect コア抽象化"]
        subgraph DataLayer ["データ層 - Schema駆動"]
            SchemaStruct["Schema.Struct<br/>📋 データ定義<br/>型安全・バリデーション"]
            BrandTypes["Brand Types<br/>🏷️ 型安全性強化<br/>PlayerId, EntityId"]
            ValidationLayer["Validation Layer<br/>✅ 実行時検証<br/>decode・encode"]
        end

        subgraph EffectLayer ["Effect管理層"]
            EffectGen["Effect.gen<br/>🔄 合成パターン<br/>yield* + 線形フロー"]
            ErrorHandling["Error Handling<br/>❌ 型安全エラー<br/>catchTag・fail"]
            ResourceMgmt["Resource Management<br/>🔧 リソース管理<br/>acquire・release"]
        end

        subgraph ServiceLayer ["サービス層"]
            ContextTag["Context.GenericTag<br/>🏢 サービス定義<br/>@app/ServiceName"]
            LayerSystem["Layer System<br/>🧱 依存性注入<br/>Layer.effect・provide"]
            ServiceComposition["Service Composition<br/>🔗 合成・組み立て<br/>pipe・compose"]
        end
    end

    subgraph PatternLayer ["パターン適用層"]
        subgraph MatchingLayer ["パターンマッチング"]
            MatchValue["Match.value<br/>🎯 安全なマッチング<br/>網羅性チェック"]
            TaggedUnions["Tagged Unions<br/>📝 判別可能合併型<br/>_tag ベース"]
        end

        subgraph FunctionalLayer ["関数型パターン"]
            PureFunctions["Pure Functions<br/>🧮 純粋関数<br/>副作用分離"]
            ImmutableData["Immutable Data<br/>📚 不変データ<br/>ReadonlyArray・HashMap"]
            EarlyReturn["Early Return<br/>⚡ 早期リターン<br/>ガード節・フェイルファスト"]
        end
    end

    SchemaStruct --> ValidationLayer
    ValidationLayer --> BrandTypes
    BrandTypes --> EffectGen

    EffectGen --> ErrorHandling
    ErrorHandling --> ResourceMgmt
    ResourceMgmt --> ContextTag

    ContextTag --> LayerSystem
    LayerSystem --> ServiceComposition

    ServiceComposition --> MatchValue
    MatchValue --> TaggedUnions
    TaggedUnions --> PureFunctions

    PureFunctions --> ImmutableData
    ImmutableData --> EarlyReturn

    classDef dataStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#0d47a1
    classDef effectStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px,color:#1b5e20
    classDef serviceStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#e65100
    classDef patternStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#4a148c
    classDef functionalStyle fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#880e4f

    class SchemaStruct,BrandTypes,ValidationLayer dataStyle
    class EffectGen,ErrorHandling,ResourceMgmt effectStyle
    class ContextTag,LayerSystem,ServiceComposition serviceStyle
    class MatchValue,TaggedUnions patternStyle
    class PureFunctions,ImmutableData,EarlyReturn functionalStyle
```

### 1.2 Effect-TSデータフロー

以下は、典型的なEffect-TSアプリケーションにおけるデータの流れを示しています。すべての副作用がEffect型で管理され、型安全な合成が実現されています。

```mermaid
%%{init: {"theme": "neutral", "themeVariables": {"primaryColor": "#4285f4", "primaryTextColor": "#ffffff", "primaryBorderColor": "#ffffff", "lineColor": "#4285f4", "sectionBkgColor": "#f5f7fa", "tertiaryColor": "#f5f7fa"}}}%%
sequenceDiagram
    participant Client as クライアント
    participant Schema as Schema層
    participant Service as サービス層
    participant Effect as Effect層
    participant Infrastructure as インフラ層

    Note over Client, Infrastructure: プレイヤー移動処理のEffect-TSフロー

    Client->>Schema: 生データ (unknown)
    Schema->>Schema: Schema.decodeUnknown
    alt バリデーション成功
        Schema->>Service: 型安全データ (PlayerAction)
        Service->>Service: Context.GenericTag 解決
        Service->>Effect: Effect.gen フロー開始

        Effect->>Effect: yield* 早期リターン検証
        alt 検証成功
            Effect->>Infrastructure: 副作用実行要求
            Infrastructure->>Infrastructure: 実際のI/O処理
            Infrastructure->>Effect: 結果または失敗
            Effect->>Effect: Effect.catchTag エラーハンドリング
            Effect->>Service: 成功結果
            Service->>Client: 型安全な結果
        else 検証失敗
            Effect->>Service: Effect.fail(ValidationError)
            Service->>Client: 型安全なエラー
        end
    else バリデーション失敗
        Schema->>Client: Schema.DecodeError
    end

    Note over Client, Infrastructure: 全フローが型安全で、<br/>副作用が明示的に管理される
```

```typescript
// Effect<SuccessType, ErrorType, RequirementType>
type AppEffect<A, E = never> = Effect.Effect<A, E, AppServices>;

// Schema.Structによるデータ定義（classは使用禁止）
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(
  Schema.annotations({
    identifier: "Position",
    title: "3D座標",
    description: "ワールド内の3次元座標を表す"
  })
);
type Position = Schema.Schema.Type<typeof Position>;

// ✅ 最新パターン: Context要件の明示的管理
interface AppServices extends WorldService, PlayerService, ChunkService {}
```

## 2. 主要な利用パターン

### 2.1. `Effect.gen` + `yield*` による合成（最新推奨）

**Effect-TS 3.17+ 最新パターン**: `Effect.gen` と `yield*` を使用した線形な処理フローが推奨されます。これにより、非同期処理を同期的に記述でき、可読性が向上します。

```typescript
import { Effect, Schema, Context, Stream, Match } from "effect";

// ✅ 最新パターン（Effect.gen + yield* + Schema統合）
const complexOperation = Effect.gen(function* () {
  const config = yield* getConfig();

  // ✅ Schema検証付きデータ取得
  const data = yield* fetchData(config.apiUrl).pipe(
    Effect.flatMap(raw => Schema.decodeUnknown(DataSchema)(raw))
  );

  const processed = yield* processData(data);
  yield* saveResult(processed);
  return processed;
});

// ✅ 早期リターンパターンと包括的エラーハンドリング
const operationWithErrorHandling = Effect.gen(function* () {
  const config = yield* getConfig();

  // ✅ 早期リターン: 設定検証
  if (!config.enabled) {
    return yield* Effect.fail(
      Schema.encodeSync(ConfigError)({
        _tag: "ConfigDisabledError",
        message: "設定が無効です"
      })
    );
  }

  // ✅ 包括的エラー処理とフォールバック
  const data = yield* fetchData(config.apiUrl).pipe(
    Effect.catchTags({
      NetworkError: (error) =>
        Effect.gen(function* () {
          yield* Effect.log(`ネットワークエラー: ${error.message}, デフォルトデータを使用`);
          return defaultData;
        }),
      TimeoutError: () =>
        Effect.gen(function* () {
          yield* Effect.log("タイムアウト: キャッシュデータを試行");
          return yield* getCachedData().pipe(
            Effect.orElse(() => Effect.succeed(defaultData))
          );
        })
    })
  );

  return yield* processData(data);
});

// ✅ 高度な並列処理とバッチング
const parallelOperation = Effect.gen(function* () {
  // ✅ bindAllで並列実行とエラー処理
  const result = yield* Effect.Do.pipe(
    Effect.bind("timestamp", () => Effect.sync(() => Date.now())),
    Effect.bindAll(
      ({ timestamp }) => ({
        userData: fetchUserData().pipe(
          Effect.timeout("5 seconds"),
          Effect.retry(Schedule.exponential("100 millis", 2).pipe(
            Schedule.compose(Schedule.recurs(3))
          ))
        ),
        configData: fetchConfigData(),
        settingsData: fetchSettingsData()
      }),
      { concurrency: "unbounded", mode: "either" }
    ),
    Effect.tap(({ timestamp }) =>
      Effect.log(`並列操作完了: ${Date.now() - timestamp}ms`)
    )
  );

  // ✅ エラー結果の処理
  const userData = yield* Match.value(result.userData).pipe(
    Match.tag("Right", ({ right }) => Effect.succeed(right)),
    Match.tag("Left", ({ left }) =>
      Effect.gen(function* () {
        yield* Effect.log(`ユーザーデータ取得失敗: ${left}`);
        return yield* getDefaultUserData();
      })
    ),
    Match.exhaustive
  );

  return {
    userData,
    configData: result.configData,
    settingsData: result.settingsData,
    timestamp: result.timestamp
  };
});
```

### 2.2. `Schema` によるデータ定義とバリデーション

`class` や `interface` の代わりに `Schema.Struct` を用いて、すべてのデータ構造を定義します。これにより、型定義と実行時バリデーションを同時に実現します。

```typescript
import { Schema, Brand } from "effect";

// ✅ 最新パターン: 包括的Schema定義とバリデーション
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
    title: "Minecraft座標",
    description: "Minecraftワールドの有効な座標範囲内の3D位置"
  })
);
type Position = Schema.Schema.Type<typeof Position>;

// ✅ Brand型による型安全性の向上
const ChunkId = Schema.String.pipe(
  Schema.pattern(/^chunk_-?\d+_-?\d+$/),
  Schema.brand("ChunkId")
);
type ChunkId = Schema.Schema.Type<typeof ChunkId>;

const EntityId = Schema.String.pipe(
  Schema.uuid(),
  Schema.brand("EntityId")
);
type EntityId = Schema.Schema.Type<typeof EntityId>;

// ✅ 複雑なSchema組み合わせ
const Block = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("BlockId")),
  metadata: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(
        Schema.String,
        Schema.Number,
        Schema.Boolean
      )
    })
  ),
  lightLevel: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.lessThanOrEqualTo(15)
  ),
  hardness: Schema.Number.pipe(Schema.nonNegative())
}).pipe(
  Schema.annotations({
    identifier: "Block",
    title: "ブロック",
    description: "Minecraftワールドのブロック定義"
  })
);
type Block = Schema.Schema.Type<typeof Block>;

// ✅ Union型とパターンマッチング連携
const Direction = Schema.Literal("north", "south", "east", "west", "up", "down");
type Direction = Schema.Schema.Type<typeof Direction>;

// ✅ 実行時バリデーション関数
const validatePosition = (input: unknown): Effect.Effect<Position, Schema.ParseError> =>
  Schema.decodeUnknown(Position)(input);

const encodePosition = (position: Position): unknown =>
  Schema.encodeSync(Position)(position);

// ✅ カスタムSchema変換
const Vector3 = Schema.transform(
  Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  Position,
  {
    decode: ({ x, y, z }) => ({ x: Math.round(x), y: Math.round(y), z: Math.round(z) }),
    encode: (position) => position
  }
).pipe(
  Schema.annotations({
    identifier: "Vector3",
    title: "Vector3からPositionへの変換"
  })
);
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
import { Layer, Effect, Context, Resource, ManagedRuntime } from "effect";

// ✅ 最新パターン: リソース管理とスケーラブルな初期化
const makeWorldServiceLive = Effect.gen(function* () {
  // ✅ 依存サービスの取得と型安全性
  const chunkService = yield* ChunkService;
  const blockService = yield* BlockService;
  const logger = yield* Logger;
  const metrics = yield* Metrics;

  // ✅ リソース取得と初期化
  const worldConfig = yield* loadWorldConfig();
  const worldBounds = yield* loadWorldBounds();

  // ✅ ヘルスチェック
  yield* logger.info("WorldServiceを初期化中");
  yield* metrics.incrementCounter("world_service_initializations");

  // ✅ より堅牢なバリデーション関数
  const validatePosition = (pos: Position): Effect.Effect<boolean, never> =>
    Effect.sync(() =>
      pos.x >= worldBounds.min.x && pos.x <= worldBounds.max.x &&
      pos.y >= worldBounds.min.y && pos.y <= worldBounds.max.y &&
      pos.z >= worldBounds.min.z && pos.z <= worldBounds.max.z
    );

  return WorldService.of({
    getBlock: (pos) =>
      Effect.gen(function* () {
        // ✅ 早期リターン: Schema検証
        yield* validatePosition(pos).pipe(
          Effect.filterOrFail(
            (isValid) => isValid,
            () => ({
              _tag: "BlockNotFoundError" as const,
              position: pos,
              message: `座標 ${pos.x},${pos.y},${pos.z} は範囲外です`,
              bounds: worldBounds
            })
          )
        );

        // ✅ メトリクス収集
        yield* metrics.incrementCounter("block_get_requests");

        // ✅ 並列データ取得
        const chunk = yield* chunkService.getChunkForPosition(pos).pipe(
          Effect.timeout("2 seconds"),
          Effect.retry(Schedule.exponential("100 millis").pipe(
            Schedule.compose(Schedule.recurs(3))
          ))
        );

        const block = yield* blockService.getBlockFromChunk(chunk, pos);

        yield* logger.debug(`ブロック取得: ${pos.x},${pos.y},${pos.z} = ${block.id}`);
        return block;
      }),

    setBlock: (pos, block) =>
      Effect.gen(function* () {
        // ✅ 包括的バリデーション
        yield* validatePosition(pos).pipe(
          Effect.filterOrFail(
            (isValid) => isValid,
            () => ({
              _tag: "BlockSetError" as const,
              position: pos,
              reason: "位置が範囲外です",
              bounds: worldBounds
            })
          )
        );

        // ✅ ブロック設置前の状態確認
        const existingBlock = yield* blockService.getBlockFromPosition(pos).pipe(
          Effect.option
        );

        // ✅ アトミックな更新操作
        yield* blockService.setBlock(pos, block).pipe(
          Effect.zipLeft(metrics.incrementCounter("block_set_operations"))
        );

        yield* logger.info(
          `ブロック設置: ${pos.x},${pos.y},${pos.z} ${existingBlock._tag === "Some" ? `(${existingBlock.value.id} → ${block.id})` : `(空 → ${block.id})`}`
        );

        // ✅ 隣接ブロック更新通知
        yield* notifyAdjacentBlocks(pos, block);
      }),

    getChunk: (chunkId) =>
      chunkService.getChunk(chunkId).pipe(
        Effect.tap(() => metrics.incrementCounter("chunk_requests")),
        Effect.timeout("5 seconds")
      ),

    isValidPosition: validatePosition,

    // ✅ 新しいメソッド: バッチ処理
    getBlocks: (positions) =>
      Effect.gen(function* () {
        // ✅ 早期リターン: 空の配列
        if (positions.length === 0) {
          return [];
        }

        yield* metrics.incrementCounter("batch_block_requests");

        // ✅ バッチサイズでの処理
        const batchSize = 50;
        const batches = ReadonlyArray.chunksOf(positions, batchSize);
        const results: Block[] = [];

        for (const batch of batches) {
          const batchResults = yield* Effect.all(
            ReadonlyArray.map(batch, pos => getBlock(pos)),
            { concurrency: "unbounded" }
          );
          results.push(...batchResults);
        }

        return results;
      })
  });
});

// ✅ Layerチェーンによる依存関係管理
const WorldServiceLive = Layer.effect(WorldService, makeWorldServiceLive).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      ChunkServiceLive,
      BlockServiceLive,
      LoggerLive,
      MetricsLive
    )
  )
);

// ✅ 環境別Layer設定
const WorldServiceDev = WorldServiceLive.pipe(
  Layer.provide(Layer.succeed(WorldConfig, developmentConfig))
);

const WorldServiceProd = WorldServiceLive.pipe(
  Layer.provide(Layer.succeed(WorldConfig, productionConfig))
);

// ✅ テスト用Layer（改善版）
const WorldServiceTest = Layer.succeed(
  WorldService,
  WorldService.of({
    getBlock: (pos) => Effect.succeed({
      id: "minecraft:stone" as any,
      metadata: undefined,
      lightLevel: 0,
      hardness: 1.5
    }),
    setBlock: () => Effect.void,
    getChunk: () => Effect.succeed({
      id: "test_chunk" as any,
      position: { x: 0, z: 0 },
      blocks: new Uint8Array(4096),
      entities: []
    }),
    isValidPosition: () => Effect.succeed(true),
    getBlocks: () => Effect.succeed([])
  })
);

// ✅ ManagedRuntimeによる高レベルAPI
export const createWorldRuntime = (environment: "dev" | "prod" | "test" = "dev") => {
  const layer = Match.value(environment).pipe(
    Match.tag("dev", () => WorldServiceDev),
    Match.tag("prod", () => WorldServiceProd),
    Match.tag("test", () => WorldServiceTest),
    Match.exhaustive
  );

  return ManagedRuntime.make(layer);
};
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
import { Effect, Fiber, Stream, Schedule, Duration, STM, TRef, Queue, Scope } from "effect";

// ✅ 最新パターン: 高度なFiber管理とSTMによる状態管理
const GameLoop = Schema.Struct({
  tickRate: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(100)),
  isRunning: Schema.Boolean,
  lastTick: Schema.Number.pipe(Schema.brand("Timestamp")),
  totalTicks: Schema.Number.pipe(Schema.nonNegative()),
  averageDeltaTime: Schema.Number.pipe(Schema.nonNegative())
}).pipe(
  Schema.annotations({
    identifier: "GameLoop",
    title: "ゲームループ状態",
    description: "ゲームループの実行状態とパフォーマンス統計"
  })
);
type GameLoop = Schema.Schema.Type<typeof GameLoop>;

// ✅ STMによる状態管理とアトミックな更新
const createGameLoopState = (): Effect.Effect<{
  gameLoopRef: TRef.TRef<GameLoop>,
  commandQueue: Queue.Queue<GameCommand>,
  supervisorRef: TRef.TRef<Option.Option<Fiber.RuntimeFiber<void, never>>>
}, never> =>
  Effect.gen(function* () {
    const gameLoopRef = yield* TRef.make({
      tickRate: 20,
      isRunning: false,
      lastTick: Date.now() as any,
      totalTicks: 0,
      averageDeltaTime: 16.67
    });

    const commandQueue = yield* Queue.bounded<GameCommand>(1000);
    const supervisorRef = yield* TRef.make(Option.none<Fiber.RuntimeFiber<void, never>>());

    return { gameLoopRef, commandQueue, supervisorRef };
  });

// ✅ 改良されたゲームループ（STM + Stream）
const runGameLoop = (
  tickRate: number,
  gameState: {
    gameLoopRef: TRef.TRef<GameLoop>,
    commandQueue: Queue.Queue<GameCommand>,
    supervisorRef: TRef.TRef<Option.Option<Fiber.RuntimeFiber<void, never>>>
  }
): Effect.Effect<Fiber.RuntimeFiber<void, never>, never> =>
  Effect.gen(function* () {
    // ✅ ゲームループのメインファイバー
    const gameLoopFiber = yield* Effect.fork(
      Stream.fromSchedule(Schedule.fixed(Duration.millis(1000 / tickRate))).pipe(
        Stream.zipWithIndex,
        Stream.mapEffect(([_, tickIndex]) =>
          Effect.gen(function* () {
            const startTime = yield* Effect.sync(() => performance.now());

            // ✅ STMでアトミックな状態更新
            yield* STM.gen(function* () {
              const current = yield* STM.get(gameState.gameLoopRef);
              const newState: GameLoop = {
                ...current,
                lastTick: Date.now() as any,
                totalTicks: current.totalTicks + 1,
                isRunning: true
              };
              yield* STM.set(gameState.gameLoopRef, newState);
            }).pipe(STM.commit);

            // ✅ コマンド処理
            const commands = yield* Queue.takeAll(gameState.commandQueue);
            yield* processCommands(commands);

            // ✅ システム更新
            const deltaTime = yield* Effect.sync(() => performance.now() - startTime);
            yield* processSystemsParallel(deltaTime);

            // ✅ パフォーマンス統計更新
            yield* STM.gen(function* () {
              const current = yield* STM.get(gameState.gameLoopRef);
              const newAverage = (current.averageDeltaTime * 0.9) + (deltaTime * 0.1);
              yield* STM.modify(gameState.gameLoopRef, state => ({
                ...state,
                averageDeltaTime: newAverage
              }));
            }).pipe(STM.commit);

            if (deltaTime > 50) { // 50ms以上の場合は警告
              yield* Effect.log(`長時間の tick 処理: ${deltaTime.toFixed(2)}ms (Tick: ${tickIndex})`);
            }
          })
        ),
        Stream.runDrain
      )
    );

    // ✅ スーパーバイザーに登録
    yield* STM.set(gameState.supervisorRef, Option.some(gameLoopFiber)).pipe(STM.commit);
    yield* Effect.log(`ゲームループ開始 @ ${tickRate} TPS`);

    return gameLoopFiber;
  });

// ✅ 高度な並行システム処理（パイプライン最適化）
const processSystemsParallel = (deltaTime: number): Effect.Effect<void, SystemError> =>
  Effect.gen(function* () {
    // ✅ Stage 1: 独立システムの並行実行
    const stage1Systems = [
      updateInputSystem(deltaTime),
      updateSoundSystem(deltaTime),
      updateParticleSystem(deltaTime),
      updateUISystem(deltaTime)
    ];

    yield* Effect.all(stage1Systems, {
      concurrency: "unbounded",
      batching: true
    });

    // ✅ Stage 2: 物理とMovement（依存関係あり）
    const stage2Systems = [
      updateMovementSystem(deltaTime),
      updatePhysicsSystem(deltaTime)
    ];

    for (const system of stage2Systems) {
      yield* system;
    }

    // ✅ Stage 3: 結果に依存するシステム
    const stage3Systems = [
      updateCollisionSystem(deltaTime),
      updateRenderingSystem(deltaTime),
      updateNetworkingSystem(deltaTime)
    ];

    yield* Effect.all(stage3Systems, {
      concurrency: 3,
      batching: true
    });
  });

// ✅ Stream + STM による高度な入力処理
const processPlayerInputs = (): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // ✅ 入力キューの作成
    const inputQueue = yield* Queue.bounded<PlayerInput>(256);
    const processedInputsRef = yield* TRef.make(0);

    // ✅ 入力収集ストリーム
    const inputCollectorFiber = yield* Effect.fork(
      createInputEventStream().pipe(
        Stream.buffer({ capacity: 64, strategy: "dropping" }),
        Stream.filter(input => validateInput(input)),
        Stream.tap(input => Queue.offer(inputQueue, input)),
        Stream.runDrain
      )
    );

    // ✅ 入力処理ストリーム（バッチ処理）
    yield* Stream.fromQueue(inputQueue).pipe(
      Stream.groupedWithin(10, Duration.millis(16)), // 最大10個または16ms
      Stream.mapEffect(inputs =>
        Effect.gen(function* () {
          if (inputs.length === 0) return;

          // ✅ 入力の前処理とデデュープ
          const dedupedInputs = deduplicateInputs(inputs);

          // ✅ 並列処理
          yield* Effect.all(
            ReadonlyArray.map(dedupedInputs, input =>
              processInput(input).pipe(
                Effect.catchAll(error =>
                  Effect.gen(function* () {
                    yield* Effect.log(`入力処理エラー: ${error}`);
                  })
                )
              )
            ),
            { concurrency: 4 }
          );

          // ✅ 統計更新
          yield* STM.update(processedInputsRef, count => count + inputs.length).pipe(
            STM.commit
          );
        })
      ),
      Stream.runDrain
    );

    // ✅ クリーンアップ
    yield* Fiber.interrupt(inputCollectorFiber);
  });

// ✅ スコープ管理によるリソース管理（改良版）
const withWorldSession = <A, E, R>(
  operation: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.scoped(
    Effect.gen(function* () {
      // ✅ スコープ内でのリソース管理
      yield* Effect.log("ワールドセッションを初期化中");

      // ✅ リソース取得（自動的にスコープで管理される）
      const world = yield* Effect.acquireRelease(
        createWorld(),
        world => Effect.gen(function* () {
          yield* Effect.log("ワールドを保存中");
          yield* saveWorld(world);
        })
      );

      const systems = yield* Effect.acquireRelease(
        initializeSystems(),
        systems => Effect.gen(function* () {
          yield* Effect.log("システムを停止中");
          yield* stopSystems(systems);
        })
      );

      const networkSession = yield* Effect.acquireRelease(
        startNetworkSession(),
        session => Effect.gen(function* () {
          yield* Effect.log("ネットワークセッションを終了中");
          yield* stopNetworkSession(session);
        })
      );

      // ✅ システム開始
      yield* startSystems(systems);
      yield* Effect.log("ワールドセッション開始完了");

      // ✅ 操作実行
      const result = yield* operation;

      yield* Effect.log("ワールドセッション正常終了");
      return result;
    })
  );

// ✅ STM を使った高度な状態管理例
const createSharedGameState = () =>
  Effect.gen(function* () {
    const playersRef = yield* TRef.make(new Map<string, Player>());
    const worldStateRef = yield* TRef.make<WorldState>({
      time: 0,
      weather: "clear",
      difficulty: "normal"
    });
    const metricsRef = yield* TRef.make({
      totalPlayers: 0,
      ticksPerSecond: 0,
      memoryUsage: 0
    });

    // ✅ アトミックなプレイヤー操作
    const addPlayer = (player: Player): Effect.Effect<boolean, never> =>
      STM.gen(function* () {
        const players = yield* STM.get(playersRef);
        if (players.has(player.id)) {
          return false; // 既に存在
        }

        const newPlayers = new Map(players).set(player.id, player);
        yield* STM.set(playersRef, newPlayers);

        // ✅ メトリクス更新も同じトランザクション内
        yield* STM.update(metricsRef, metrics => ({
          ...metrics,
          totalPlayers: newPlayers.size
        }));

        return true;
      }).pipe(STM.commit);

    // ✅ 複合操作（複数の状態を同時に更新）
    const advanceTime = (deltaTime: number): Effect.Effect<void, never> =>
      STM.gen(function* () {
        const worldState = yield* STM.get(worldStateRef);
        const newTime = worldState.time + deltaTime;

        // ✅ 時間に応じた天候変化
        let newWeather = worldState.weather;
        if (newTime > 12000 && worldState.weather === "clear") {
          newWeather = Math.random() > 0.8 ? "rain" : "clear";
        }

        yield* STM.set(worldStateRef, {
          ...worldState,
          time: newTime % 24000, // 24時間サイクル
          weather: newWeather
        });
      }).pipe(STM.commit);

    return {
      addPlayer,
      advanceTime,
      getPlayers: () => STM.get(playersRef).pipe(STM.commit),
      getWorldState: () => STM.get(worldStateRef).pipe(STM.commit),
      getMetrics: () => STM.get(metricsRef).pipe(STM.commit)
    };
  });
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

## 5. 最新Effect-TS統合パターン（2024年最新）

### 5.1. ManagedRuntimeによる統合アプリケーション管理

**Effect-TS 3.17+ 最新パターン**: アプリケーション全体のライフサイクルとリソース管理を統一的に扱います。

```typescript
import { ManagedRuntime, Layer, Effect, Schedule, Duration } from "effect";

// ✅ 統合アプリケーションLayer
const AppLayer = Layer.mergeAll(
  // コアサービス
  WorldServiceLive,
  PlayerServiceLive,
  ChunkServiceLive,

  // インフラストラクチャ
  LoggerLive,
  MetricsLive,
  DatabaseLive,

  // 外部システム
  NetworkServiceLive,
  FileSystemLive
).pipe(
  Layer.provide(ConfigLive),
  Layer.tapError(error =>
    Effect.gen(function* () {
      yield* Effect.logError(`アプリケーション初期化失敗: ${error}`);
      yield* Effect.die(error);
    })
  )
);

// ✅ アプリケーションランタイム
export const AppRuntime = ManagedRuntime.make(AppLayer);

// ✅ 統合ヘルスチェック
const healthCheck = (): Effect.Effect<HealthStatus, HealthCheckError> =>
  Effect.gen(function* () {
    const worldService = yield* WorldService;
    const playerService = yield* PlayerService;
    const networkService = yield* NetworkService;

    // ✅ 並列ヘルスチェック
    const checks = yield* Effect.all([
      worldService.healthCheck().pipe(Effect.timeout("2 seconds")),
      playerService.healthCheck().pipe(Effect.timeout("2 seconds")),
      networkService.healthCheck().pipe(Effect.timeout("2 seconds"))
    ], {
      concurrency: "unbounded",
      mode: "either"
    });

    const healthStatus = analyzeHealthResults(checks);

    yield* Effect.log(`ヘルスチェック完了: ${healthStatus.status}`);
    return healthStatus;
  });

// ✅ グレースフルシャットダウン
const gracefulShutdown = (signal: string): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Effect.log(`シャットダウンシグナル受信: ${signal}`);

    // ✅ 段階的シャットダウン
    yield* Effect.log("新しい接続を拒否中...");
    yield* stopAcceptingNewConnections();

    yield* Effect.log("既存の接続を完了待ち...");
    yield* waitForExistingConnections().pipe(
      Effect.timeout("30 seconds"),
      Effect.orElse(() => Effect.log("タイムアウト: 強制終了"))
    );

    yield* Effect.log("リソースクリーンアップ中...");
    yield* AppRuntime.dispose();

    yield* Effect.log("シャットダウン完了");
  });

// ✅ メインアプリケーション
const main = Effect.gen(function* () {
  // ✅ シグナルハンドラー設定
  yield* Effect.addFinalizer(() => gracefulShutdown("CLEANUP"));

  // ✅ ヘルスチェック開始
  const healthCheckFiber = yield* Effect.fork(
    healthCheck().pipe(
      Effect.repeat(Schedule.fixed("30 seconds")),
      Effect.forever
    )
  );

  // ✅ メインゲームループ開始
  const gameState = yield* createGameLoopState();
  const gameLoopFiber = yield* runGameLoop(20, gameState);

  // ✅ アプリケーション実行
  yield* Effect.log("TypeScript Minecraft サーバー開始");
  yield* Effect.never; // 永続実行
});

// ✅ アプリケーション起動
export const startApplication = () =>
  AppRuntime.runPromise(main).catch(error => {
    console.error("アプリケーション起動失敗:", error);
    process.exit(1);
  });
```

### 5.2. Schema駆動API設計

```typescript
// ✅ API Schema定義
const PlayerActionRequest = Schema.Struct({
  playerId: Schema.String.pipe(Schema.uuid(), Schema.brand("PlayerId")),
  action: Schema.Union(
    Schema.Struct({
      _tag: Schema.Literal("Move"),
      direction: Schema.Literal("north", "south", "east", "west"),
      distance: Schema.Number.pipe(Schema.positive(), Schema.lessThanOrEqualTo(10))
    }),
    Schema.Struct({
      _tag: Schema.Literal("PlaceBlock"),
      position: Position,
      blockType: Schema.String.pipe(Schema.brand("BlockType"))
    }),
    Schema.Struct({
      _tag: Schema.Literal("Chat"),
      message: Schema.String.pipe(Schema.nonEmpty(), Schema.maxLength(256))
    })
  ),
  timestamp: Schema.Number.pipe(Schema.brand("Timestamp"))
}).pipe(
  Schema.annotations({
    identifier: "PlayerActionRequest",
    title: "プレイヤーアクション要求",
    description: "クライアントからのプレイヤーアクション要求"
  })
);

const PlayerActionResponse = Schema.Struct({
  success: Schema.Boolean,
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.String),
  serverTimestamp: Schema.Number.pipe(Schema.brand("Timestamp"))
});

// ✅ 型安全APIハンドラー
const handlePlayerAction = (
  request: Schema.Schema.Type<typeof PlayerActionRequest>
): Effect.Effect<Schema.Schema.Type<typeof PlayerActionResponse>, ApiError> =>
  Effect.gen(function* () {
    const startTime = yield* Effect.sync(() => Date.now());

    const result = yield* Match.value(request.action).pipe(
      Match.tag("Move", ({ direction, distance }) =>
        movePlayer(request.playerId, direction, distance)
      ),
      Match.tag("PlaceBlock", ({ position, blockType }) =>
        placeBlock(request.playerId, position, blockType)
      ),
      Match.tag("Chat", ({ message }) =>
        sendChatMessage(request.playerId, message)
      ),
      Match.exhaustive
    ).pipe(
      Effect.catchTag("InvalidAction", () =>
        Effect.succeed({ _tag: "ActionRejected" as const })
      )
    );

    return {
      success: true,
      result,
      error: undefined,
      serverTimestamp: Date.now() as any
    };
  }).pipe(
    Effect.catchAll(error =>
      Effect.succeed({
        success: false,
        result: undefined,
        error: String(error),
        serverTimestamp: Date.now() as any
      })
    )
  );
```

## 6. まとめ

**Effect-TS 3.17+ の最新パターン**を活用することで、以下のメリットを享受できます。

### 必須パターン（Effect-TS 3.17+）
- **✅ Schema.Struct + annotations**: すべてのデータ定義とBrand型による型安全性
- **✅ Context.GenericTag**: サービス定義の統一 (`@app/ServiceName`)
- **✅ Effect.gen + yield***: 非同期処理の線形化と早期リターン
- **✅ Match.value + Match.exhaustive**: 網羅的パターンマッチング
- **✅ Layer.effect + Layer.mergeAll**: 依存性注入の標準化と初期化/クリーンアップ
- **✅ STM + TRef**: アトミックな状態管理と並行制御
- **✅ Stream + Queue**: 高性能データストリーミング
- **✅ ManagedRuntime**: アプリケーションレベルのリソース管理
- **✅ Effect.scoped**: 自動リソース管理
- **✅ ReadonlyArray**: 関数型データ操作とバッチ処理
- **✅ 純粋関数分離**: PBTテスト可能な小さく焦点を絞った関数設計

### 禁止事項（古いAPIと非推奨パターン）
- ❌ **通常のclassキーワードの使用**（Schema.Structと純粋関数で代替）
- ❌ Data.Class, Data.TaggedError（古いAPI - Schema.Struct/Schema.TaggedErrorを使用）
- ❌ Context.Tag（古いAPI - Context.GenericTagを使用）
- ❌ if/else/switchの多用（Match.valueを使用）
- ❌ async/await, Promise（Effect.genを使用）
- ❌ mutableな操作（不変データ構造を使用）
- ❌ 手動リソース管理（Effect.scoped, ManagedRuntimeを使用）
- ❌ グローバル状態（STM + TRefによる管理された状態を使用）

> **重要**: `Schema.TaggedError`は正しいパターンであり継続使用。ただし、通常の`class`キーワードでのビジネスロジック定義は完全禁止。

### 高度なパフォーマンス最適化パターン
- **✅ Effect.all + concurrency**: 並列処理とバッチング最適化
- **✅ Stream.buffer + groupedWithin**: 効率的なデータストリーミング
- **✅ STM transactions**: 高速並行状態管理
- **✅ Schedule strategies**: インテリジェントな再試行とバックオフ
- **✅ Resource pooling**: Effect.acquireReleaseによるリソースプール
- **✅ Structured concurrency**: Fiberベースの並行性管理

### 最新の統合パターン
- **✅ ManagedRuntime**: アプリケーション全体のライフサイクル管理
- **✅ Schema-driven APIs**: 型安全なAPI設計と実行時検証
- **✅ Effect.scoped + Effect.acquireRelease**: 自動リソース管理
- **✅ Layer composition**: モジュラーな依存性注入
- **✅ Error boundaries**: 構造化されたエラーハンドリング
- **✅ Metrics and observability**: ビルトインの監視と計測

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

### テスト戦略（Effect-TS 3.17+ 対応）
- **✅ Property-Based Testing**: 純粋関数の包括的検証
- **✅ Layer-based Testing**: Layer.succeedによるモック注入とテスト環境分離
- **✅ Effect Testing**: Effect.runSyncとEffect.runPromiseによる効果のテスト
- **✅ STM Testing**: トランザクショナルメモリのアトミック性テスト
- **✅ Stream Testing**: ストリーム処理のパイプラインテスト
- **✅ Schema Testing**: データ検証とエンコーディング/デコーディングテスト
- **✅ 統合テスト**: ManagedRuntimeによるエンドツーエンドテスト

```typescript
// ✅ 最新テストパターン例
import { Effect, Layer, TestClock, TestContext } from "effect";

const testWorldService = Layer.succeed(
  WorldService,
  WorldService.of({
    getBlock: () => Effect.succeed(mockBlock),
    setBlock: () => Effect.succeed(void 0)
  })
);

const testLayer = Layer.mergeAll(testWorldService, TestContext.TestContext);

const testEffect = movePlayer("test-player", Position.of(0, 0, 0)).pipe(
  Effect.provide(testLayer)
);

// アサーション
const result = await Effect.runPromise(testEffect);
expect(result.success).toBe(true);
```

## 7. 実践的ガイドライン

### 7.1. 開発ワークフロー
1. **Schema定義**: まずデータ構造をSchema.Structで定義
2. **純粋関数実装**: ビジネスロジックを純粋関数として分離実装
3. **Effect統合**: 副作用を伴う操作をEffect.genで統合
4. **Layer組み立て**: 依存関係をLayerで構成
5. **テスト作成**: 各レイヤーでの単体・統合テスト実装
6. **ManagedRuntime統合**: アプリケーション全体の統合

### 7.2. パフォーマンス考慮事項
- **バッチ処理**: ReadonlyArray.chunksOfとEffect.allを活用
- **並列処理**: concurrency: "unbounded"で最大性能を引き出す
- **ストリーミング**: Stream.bufferでメモリ効率を最適化
- **リソース管理**: Effect.acquireReleaseで確実なクリーンアップ
- **状態管理**: STMで競合状態を排除

### 7.3. エラー戦略
- **構造化エラー**: Schema.TaggedErrorによる型安全なエラー定義
- **エラー境界**: Effect.catchTagsによる包括的エラーハンドリング
- **再試行戦略**: Scheduleによるインテリジェントなリトライ
- **フォールバック**: Effect.orElseによる代替処理

このガイドに従うことで、TypeScript Minecraftプロジェクトは**最新のEffect-TS 3.17+パターン**を活用した、保守性・テスト性・パフォーマンスに優れたコードベースを実現できます。

## 重要な原則（厳守）

### ✅ 採用必須パターン
- **Schema.Struct + Brand型**: すべてのデータ定義
- **Context.GenericTag**: サービス定義統一 (`@app/ServiceName`)
- **Effect.gen + yield***: 非同期処理の標準化
- **Match.value + exhaustive**: パターンマッチング
- **STM + TRef**: 並行状態管理
- **Stream + Queue**: データストリーミング
- **ManagedRuntime**: アプリケーション管理
- **純粋関数分離**: ビジネスロジックの関数型実装

### ❌ 完全禁止パターン
- **通常のclassキーワード**: ビジネスロジックでの使用禁止
- **Data.Class/Data.TaggedError**: 古いAPI、Schema系で代替
- **async/await/Promise**: Effect.genで代替
- **手動リソース管理**: Effect.scopedで代替
- **グローバル状態**: STMによる管理状態で代替

すべての新機能開発および既存コードのリファクタリングは、ここに示されたEffect-TS 3.17+パターンに厳密に従って実行してください。このガイドラインは、プロジェクトの技術的負債を防ぎ、長期的な保守性を保証します。
