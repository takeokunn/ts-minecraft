---
title: "Effect-TS サービス層パターン - 依存性注入とレイヤー管理"
description: "Context.GenericTag、Layer、ManagedRuntimeを活用したサービス層の設計パターンとテスタブルなアーキテクチャの構築方法"
category: "architecture"
difficulty: "intermediate"
tags: ["effect-ts", "services", "dependency-injection", "layer", "context"]
prerequisites: ["effect-ts-basics", "typescript-advanced"]
estimated_reading_time: "25分"
---


# Effect-TS サービス層パターン

## 🎆 Zero-Wait Learning Experience

**⚙️ 学習時間**: 15分 | **🔄 進捗フロー**: [15分 Quick Start] → [30分 Effect-TS基礎] → **[15分 Services & DI]** → [10分 Error Handling] → [15分 Testing]

> 📍 **Navigation**: ← [Effect-TS Basics](./06a-effect-ts-basics.md) | → [Error Handling](./06c-effect-ts-error-handling.md)

このドキュメントでは、TypeScript Minecraftプロジェクトにおける**Effect-TS 3.17+** のサービス層設計パターンを解説します。Context.GenericTag、Layer、ManagedRuntimeを活用した型安全で拡張可能なアーキテクチャを構築する方法を説明します。

> 📖 **関連ドキュメント**: [Effect-TS 基本概念](./06a-effect-ts-basics.md) | [Effect-TS エラーハンドリング](./06c-effect-ts-error-handling.md) | [Effect-TS テスト](./06d-effect-ts-testing.md)

## 1. Context.GenericTag によるサービス定義

**Effect-TS 3.17+ 最新パターン**: サービス（依存関係）は `Context.GenericTag` を用いて定義します。この形式により型安全性を確保し、プロジェクト内での一貫性を保ちます。

### 1.1 基本的なサービス定義

```typescript
// [LIVE_EXAMPLE: service-definition]
// 🏢 Service Layer Architecture - Interactive Example
import { Context, Effect, Schema } from "effect";

// ✅ 最新パターン（Context.GenericTag）
export const WorldService = Context.GenericTag<{
  readonly getBlock: (pos: Position) => Effect.Effect<Block, BlockNotFoundError>;
  readonly setBlock: (pos: Position, block: Block) => Effect.Effect<void, BlockSetError>;
  readonly getChunk: (chunkId: ChunkId) => Effect.Effect<Chunk, ChunkNotFoundError>;
  readonly isValidPosition: (pos: Position) => Effect.Effect<boolean, never>;
}>("@services/WorldService")

// ✅ エラー型の定義（Schema.TaggedError使用）
const BlockNotFoundError = Schema.TaggedError("BlockNotFoundError", {
  position: Position,
  message: Schema.String,
  timestamp: Schema.Number.pipe(Schema.brand("Timestamp"))
});
type BlockNotFoundError = Schema.Schema.Type<typeof BlockNotFoundError>;

const BlockSetError = Schema.TaggedError("BlockSetError", {
  position: Position,
  reason: Schema.String,
  timestamp: Schema.Number.pipe(Schema.brand("Timestamp"))
});
type BlockSetError = Schema.Schema.Type<typeof BlockSetError>;

// ✅ 複合サービスインターフェース
interface PlayerServiceInterface {
  readonly getPlayer: (id: PlayerId) => Effect.Effect<Player, PlayerNotFoundError>;
  readonly updatePosition: (id: PlayerId, pos: Position) => Effect.Effect<Player, PlayerUpdateError>;
  readonly getPlayersInRadius: (center: Position, radius: number) => Effect.Effect<Player[], never>;
  readonly addPlayer: (player: Player) => Effect.Effect<void, PlayerAddError>;
}

export const PlayerService = Context.GenericTag<PlayerServiceInterface>("@minecraft/PlayerService")

// ✅ インベントリサービス
interface InventoryServiceInterface {
  readonly getInventory: (playerId: PlayerId) => Effect.Effect<Inventory, InventoryError>;
  readonly addItem: (playerId: PlayerId, item: Item, quantity: number) => Effect.Effect<Inventory, InventoryError>;
  readonly removeItem: (playerId: PlayerId, itemId: ItemId, quantity: number) => Effect.Effect<Inventory, InventoryError>;
  readonly moveItem: (playerId: PlayerId, fromSlot: number, toSlot: number) => Effect.Effect<Inventory, InventoryError>;
}

export const InventoryService = Context.GenericTag<InventoryServiceInterface>("@minecraft/InventoryService")
```

### 1.2 サービス間の依存関係

```typescript
// ✅ サービス間依存関係の明示的定義
interface GameStateServiceInterface {
  readonly updatePlayerPosition: (playerId: PlayerId, pos: Position) => Effect.Effect<GameState, GameStateError>;
  readonly processPlayerAction: (action: PlayerAction) => Effect.Effect<ActionResult, ActionError>;
  readonly getWorldSnapshot: () => Effect.Effect<WorldSnapshot, never>;
}

interface GameStateServiceInterface extends GameStateService, GameStateServiceInterface {}
const GameStateService = Context.GenericTag<GameStateServiceInterface>("GameStateService")

// ✅ 複数サービスを依存する高レベルサービス
interface GameEngineInterface {
  readonly tick: (deltaTime: number) => Effect.Effect<void, GameEngineError>;
  readonly handlePlayerInput: (playerId: PlayerId, input: PlayerInput) => Effect.Effect<void, InputError>;
  readonly saveWorld: () => Effect.Effect<void, SaveError>;
}

interface GameEngineInterface extends GameEngine, GameEngineInterface {}
const GameEngine = Context.GenericTag<GameEngineInterface>("GameEngine")

// ✅ サービス要件の型安全な合成
type GameServices = WorldService | PlayerService | InventoryService | GameStateService;
type AllGameServices = GameServices | GameEngine;
```

## 2. Layer による依存性注入

サービスの具体的な実装は `Layer` を用いて提供します。これにより、実装とインターフェースが分離され、テスト時にはモック実装に容易に差し替えられます。

### 2.1 基本的なLayer実装

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
        // ✅ 早期リターン: 空の配列（Match.valueパターン）
        yield* pipe(
          Match.value(positions.length === 0),
          Match.when(true, () => Effect.succeed([] as Block[])),
          Match.orElse(() => Effect.unit)
        )

        yield* metrics.incrementCounter("batch_block_requests");

        // ✅ バッチサイズでの処理
        const batchSize = 50;
        const batches = ReadonlyArray.chunksOf(positions, batchSize);
        const results: Block[] = [];

        // Effect.forEachパターンで各バッチを処理
        const allResults = yield* Effect.forEach(
          batches,
          (batch) => Effect.all(
            ReadonlyArray.map(batch, pos => getBlock(pos)),
            { concurrency: "unbounded" }
          )
        );
        const results = allResults.flat();

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
```

### 2.2 環境別Layer設定

```typescript
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
```

### 2.3 複雑なLayer依存関係

```typescript
// ✅ プレイヤーサービスの実装（WorldServiceに依存）
import { Match, pipe, Option, Array } from "effect"

const makePlayerServiceLive = Effect.gen(function* () {
  const worldService = yield* WorldService;
  const inventoryService = yield* InventoryService;
  const logger = yield* Logger;

  // ✅ プレイヤーデータストア
  const players = yield* Ref.make(new Map<PlayerId, Player>());

  return PlayerService.of({
    getPlayer: (id) =>
      Effect.gen(function* () {
        const playerMap = yield* Ref.get(players);
        const player = playerMap.get(id);

        return yield* pipe(
          Option.fromNullable(player),
          Option.match({
            onNone: () => Effect.fail({
              _tag: "PlayerNotFoundError" as const,
              playerId: id,
              message: `プレイヤー ${id} が見つかりません`
            }),
            onSome: (p) => Effect.succeed(p)
          })
        );
      }),

    updatePosition: (id, newPos) =>
      Effect.gen(function* () {
        // ✅ 位置バリデーション（WorldServiceを使用）
        const isValid = yield* worldService.isValidPosition(newPos);
        yield* pipe(
          Match.value(isValid),
          Match.when(false, () => Effect.fail({
            _tag: "PlayerUpdateError" as const,
            reason: "無効な位置です",
            position: newPos
          })),
          Match.orElse(() => Effect.unit)
        );

        // ✅ プレイヤー更新
        const updatedPlayer = yield* Ref.updateAndGet(players, map => {
          const current = map.get(id);
          return pipe(
            Option.fromNullable(current),
            Option.match({
              onNone: () => map,
              onSome: (curr) => {
                const updated = {
                  ...curr,
                  position: newPos,
                  lastMoved: new Date().toISOString()
                };
                return new Map(map).set(id, updated);
              }
            })
          );
        });

        const player = updatedPlayer.get(id);
        return yield* pipe(
          Option.fromNullable(player),
          Option.match({
            onNone: () => Effect.fail({
              _tag: "PlayerUpdateError" as const,
              reason: "プレイヤーが見つかりません"
            }),
            onSome: (p) => Effect.gen(function* () {
              yield* logger.info(`プレイヤー ${id} が ${newPos.x},${newPos.y},${newPos.z} に移動`);
              return p;
            })
          })
        );
      }),

    getPlayersInRadius: (center, radius) =>
      Effect.gen(function* () {
        const playerMap = yield* Ref.get(players);
        const playersArray = Array.from(playerMap.values());

        const playersInRadius = playersArray.filter(player => {
          const distance = Math.sqrt(
            Math.pow(player.position.x - center.x, 2) +
            Math.pow(player.position.y - center.y, 2) +
            Math.pow(player.position.z - center.z, 2)
          );
          return distance <= radius;
        });

        return playersInRadius;
      }),

    addPlayer: (player) =>
      Effect.gen(function* () {
        const playerMap = yield* Ref.get(players);

        // Match.when による存在チェック - if文を排除
        yield* pipe(
          Match.value(playerMap.has(player.id)),
          Match.when(true, () =>
            Effect.fail({
              _tag: "PlayerAddError" as const,
              reason: "プレイヤーは既に存在します",
              playerId: player.id
            })
          ),
          Match.orElse(() => Effect.succeed(undefined))
        )

        yield* Ref.update(players, map => new Map(map).set(player.id, player));
        yield* logger.info(`プレイヤー ${player.id} が追加されました`);
      })
  });
});

// ✅ PlayerService Layer（依存関係を明示）
const PlayerServiceLive = Layer.effect(PlayerService, makePlayerServiceLive).pipe(
  Layer.provide(WorldServiceLive),
  Layer.provide(InventoryServiceLive),
  Layer.provide(LoggerLive)
);
```

## 3. ManagedRuntime による統合管理

### 3.1 高レベルランタイム構築

```typescript
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

// ✅ ゲーム全体のランタイム構築
const createGameRuntime = (environment: "dev" | "prod" | "test" = "dev") => {
  const baseLayer = Layer.mergeAll(
    WorldServiceLive,
    PlayerServiceLive,
    InventoryServiceLive,
    GameStateServiceLive
  );

  const envLayer = Match.value(environment).pipe(
    Match.tag("dev", () => baseLayer.pipe(Layer.provide(DevConfigLayer))),
    Match.tag("prod", () => baseLayer.pipe(Layer.provide(ProdConfigLayer))),
    Match.tag("test", () => baseLayer.pipe(Layer.provide(TestConfigLayer))),
    Match.exhaustive
  );

  return ManagedRuntime.make(envLayer);
};

// ✅ 使用例：ランタイムを使った実行
export const runGameTick = async (deltaTime: number) => {
  const runtime = createGameRuntime("dev");

  return await runtime.runPromise(
    Effect.gen(function* () {
      const gameEngine = yield* GameEngine;
      yield* gameEngine.tick(deltaTime);
    })
  );
};
```

### 3.2 スコープ管理とリソースクリーンアップ

```typescript
// ✅ スコープ管理によるリソースの適切な解放
const createScopedGameSession = Effect.scoped(
  Effect.gen(function* () {
    // ✅ 管理されたリソースの取得
    const worldService = yield* WorldService;
    const playerService = yield* PlayerService;
    const logger = yield* Logger;

    yield* logger.info("ゲームセッション開始");

    // ✅ ゲームセッションデータの初期化
    const sessionId = crypto.randomUUID();
    const session = yield* Ref.make({
      id: sessionId,
      startTime: new Date(),
      players: new Map<PlayerId, Player>(),
      active: true
    });

    // ✅ クリーンアップハンドラーの登録
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* logger.info(`ゲームセッション ${sessionId} を終了中`);
        yield* Ref.update(session, s => ({ ...s, active: false }));
      })
    );

    return {
      sessionId,
      addPlayer: (player: Player) =>
        Effect.gen(function* () {
          yield* playerService.addPlayer(player);
          yield* Ref.update(session, s => ({
            ...s,
            players: new Map(s.players).set(player.id, player)
          }));
        }),

      removePlayer: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* Ref.update(session, s => {
            const newPlayers = new Map(s.players);
            newPlayers.delete(playerId);
            return { ...s, players: newPlayers };
          });
          yield* logger.info(`プレイヤー ${playerId} がセッションから退出`);
        }),

      getSessionInfo: () =>
        Effect.gen(function* () {
          const sessionData = yield* Ref.get(session);
          return {
            id: sessionData.id,
            startTime: sessionData.startTime,
            playerCount: sessionData.players.size,
            active: sessionData.active
          };
        })
    };
  })
);

// ✅ セッション使用例
const gameSessionExample = Effect.gen(function* () {
  const runtime = createGameRuntime("dev");

  yield* Effect.scoped(
    Effect.gen(function* () {
      const session = yield* createScopedGameSession;

      // プレイヤー追加
      yield* session.addPlayer({
        id: "player1" as PlayerId,
        name: "TestPlayer",
        position: { x: 0, y: 64, z: 0 },
        health: 100,
        inventory: []
      });

      const sessionInfo = yield* session.getSessionInfo();
      yield* Effect.log(`セッション情報: ${JSON.stringify(sessionInfo)}`);

      // セッション終了時に自動的にクリーンアップされる
    })
  );
});
```

## 4. サービステスト戦略

### 4.1 モックサービスの作成

```typescript
// ✅ テスト用モックサービス
export const createMockWorldService = (config: Partial<WorldServiceInterface> = {}) =>
  Layer.succeed(
    WorldService,
    WorldService.of({
      getBlock: config.getBlock ?? ((pos) =>
        Effect.succeed({
          id: "test:block" as BlockId,
          position: pos,
          metadata: {},
          lightLevel: 15,
          hardness: 1.0
        })
      ),
      setBlock: config.setBlock ?? (() => Effect.void),
      getChunk: config.getChunk ?? ((chunkId) =>
        Effect.succeed({
          id: chunkId,
          position: { x: 0, z: 0 },
          blocks: [],
          entities: []
        })
      ),
      isValidPosition: config.isValidPosition ?? (() => Effect.succeed(true)),
      getBlocks: config.getBlocks ?? (() => Effect.succeed([]))
    })
  );

// ✅ 統合テスト用のレイヤー構築
export const createTestLayer = (overrides: Partial<{
  worldService: Layer.Layer<WorldService>,
  playerService: Layer.Layer<PlayerService>,
  inventoryService: Layer.Layer<InventoryService>
}> = {}) => {
  return Layer.mergeAll(
    overrides.worldService ?? createMockWorldService(),
    overrides.playerService ?? createMockPlayerService(),
    overrides.inventoryService ?? createMockInventoryService(),
    TestLoggerLive,
    TestMetricsLive
  );
};

// ✅ テスト実行例
export const testPlayerMovement = Effect.gen(function* () {
  const playerService = yield* PlayerService;
  const worldService = yield* WorldService;

  // テスト用プレイヤー追加
  const testPlayer: Player = {
    id: "test-player" as PlayerId,
    name: "TestPlayer",
    position: { x: 0, y: 64, z: 0 },
    health: 100,
    inventory: []
  };

  yield* playerService.addPlayer(testPlayer);

  // 位置更新テスト
  const newPosition = { x: 10, y: 64, z: 10 };
  const updatedPlayer = yield* playerService.updatePosition(testPlayer.id, newPosition);

  // アサーション
  assert(updatedPlayer.position.x === 10);
  assert(updatedPlayer.position.z === 10);

  yield* Effect.log("プレイヤー移動テスト成功");
});

// テストレイヤーを使った実行
export const runPlayerMovementTest = Effect.provide(
  testPlayerMovement,
  createTestLayer()
);
```

### 4.2 プロパティベーステスト対応

```typescript
// ✅ プロパティベーステスト用のサービス
export const createPropertyTestWorldService = Layer.effect(
  WorldService,
  Effect.gen(function* () {
    // ✅ テスト用の内部状態
    const worldState = yield* Ref.make(new Map<string, Block>());

    const positionToKey = (pos: Position) => `${pos.x},${pos.y},${pos.z}`;

    return {
      getBlock: (pos) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(worldState);
          const key = positionToKey(pos);
          const block = state.get(key);

          // Option.match によるブロック存在チェック - if文不要
          yield* pipe(
            Option.fromNullable(block),
            Option.match({
              onNone: () =>
                Effect.fail({
                  _tag: "BlockNotFoundError" as const,
                  position: pos,
                  message: "ブロックが見つかりません"
                }),
              onSome: () => Effect.succeed(undefined)
            })
          )

          return block;
        }),

      setBlock: (pos, block) =>
        Effect.gen(function* () {
          const key = positionToKey(pos);
          yield* Ref.update(worldState, state => new Map(state).set(key, block));
        }),

      getChunk: (chunkId) =>
        Effect.succeed({
          id: chunkId,
          position: { x: 0, z: 0 },
          blocks: [],
          entities: []
        }),

      isValidPosition: (pos) =>
        Effect.succeed(
          pos.x >= -1000 && pos.x <= 1000 &&
          pos.y >= 0 && pos.y <= 256 &&
          pos.z >= -1000 && pos.z <= 1000
        ),

      getBlocks: (positions) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(worldState);

          // Array.filterMapパターンで有効なブロックのみを取得
          return Array.filterMap(positions, (pos) => {
            const key = positionToKey(pos);
            return Option.fromNullable(state.get(key));
          });
        })
    });
  })
);
```

## 5. サービスパフォーマンス監視

### 5.1 メトリクス統合

```typescript
// ✅ メトリクス付きサービスデコレーター
export const withMetrics = <S>(
  service: Context.Tag<any, S>,
  serviceName: string
) => {
  return <T extends Record<string, (...args: any[]) => Effect.Effect<any, any, any>>>(
    implementation: T
  ): T => {
    const decoratedImplementation = {} as T;

    // Array.forEach を使用 - forループを完全に排除
    pipe(
      Object.entries(implementation),
      Array.forEach(([methodName, method]) => {
        // Match.when で関数チェック - if文を排除
        pipe(
          Match.value(typeof method),
          Match.when("function", () => {
            decoratedImplementation[methodName as keyof T] = ((...args: any[]) =>
          Effect.gen(function* () {
            const metrics = yield* Metrics;
            const startTime = Date.now();

            // メソッド実行前のメトリクス
            yield* metrics.incrementCounter(`${serviceName}.${methodName}.calls`);

            try {
              const result = yield* method(...args);
              const duration = Date.now() - startTime;

              // 成功メトリクス
              yield* metrics.recordHistogram(`${serviceName}.${methodName}.duration`, duration);
              yield* metrics.incrementCounter(`${serviceName}.${methodName}.success`);

              return result;
            } catch (error) {
              const duration = Date.now() - startTime;

              // エラーメトリクス
              yield* metrics.recordHistogram(`${serviceName}.${methodName}.duration`, duration);
              yield* metrics.incrementCounter(`${serviceName}.${methodName}.errors`);

              return yield* Effect.fail(error);
            }
          })
        ) as T[keyof T];
          }),
          Match.orElse(() => undefined)
        )
      })
    )

    return decoratedImplementation;
  };
};

// ✅ 使用例
const makeMonitoredWorldService = Effect.gen(function* () {
  const baseImplementation = yield* makeWorldServiceLive;

  return withMetrics(WorldService, "WorldService")(baseImplementation);
});
```

## まとめ

このドキュメントで解説したサービス層パターンにより、以下が実現されます：

### 🎯 **主要な利点**

1. **型安全性**: Context.Tagによる完全な型安全性
2. **テスタビリティ**: Layer による容易なモック差し替え
3. **保守性**: 明確な依存関係管理と分離
4. **拡張性**: ManagedRuntime による柔軟な構成管理

### 🔧 **実装パターン**

- **Context.Tag** によるサービス定義
- **Layer.effect** による実装の提供
- **Effect.gen** による線形な処理フロー
- **ManagedRuntime** による統合管理
- **Effect.scoped** によるリソース管理

### 📊 **品質管理**

- 包括的なエラーハンドリング
- メトリクスとロギングの統合
- プロパティベーステスト対応
- パフォーマンス監視

これらのパターンを活用することで、堅牢で保守可能なMinecraftクローンのサービス層を構築できます。