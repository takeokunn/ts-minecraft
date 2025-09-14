---
title: "Core APIs - Effect-TS 3.17+完全リファレンス"
description: "Effect-TS 3.17+コアAPI完全リファレンス。Schema、Context、Effect、パターンマッチングの詳細仕様とMinecraft Clone特化実装例。型安全・関数型プログラミングの実践的活用ガイド。"
category: "api-reference"
difficulty: "intermediate-advanced"
tags: ["effect-ts", "schema-api", "context-api", "effect-api", "pattern-matching", "type-safety", "functional-programming"]
prerequisites: ["typescript-advanced", "functional-programming-basics", "effect-ts-fundamentals"]
estimated_reading_time: "30-45分"
last_updated: "2025-09-14"
version: "2.0.0"
learning_path: "Level 3-5 - Effect-TS完全マスタリー"
search_keywords:
  primary: ["effect-schema", "context-generictag", "effect-gen", "match-value"]
  secondary: ["data-validation", "dependency-injection", "error-handling", "type-inference"]
  context: ["minecraft-apis", "game-development", "production-ready"]
---

# 🔌 Core APIs - Effect-TS 3.17+完全マスタリー

## 🧭 スマートナビゲーション

> **📍 現在位置**: Reference → API Reference → **Core APIs**
> **🎯 最終目標**: Effect-TS 3.17+完全習得・実践活用
> **⏱️ 所要時間**: 30-45分（中級〜上級者向け）
> **👤 対象**: 中級〜上級TypeScript開発者・関数型プログラミング実践者

**⚡ TypeScript Minecraft Clone開発を支えるEffect-TS基盤技術の完全理解**

## 📊 Core APIs体系マップ

```mermaid
mindmap
  root((Core APIs))
    Schema API
      [Data Validation]
      [Type Transformation]
      [Error Handling]
      [Composition Patterns]
    Context API
      [Dependency Injection]
      [Service Management]
      [Layer System]
      [Resource Handling]
    Effect API
      [Side Effect Management]
      [Error Control]
      [Resource Safety]
      [Concurrency]
    Pattern Matching
      [Type Discrimination]
      [Control Flow]
      [Union Types]
      [Exhaustive Checks]
```

## 🔍 Schema API - 型安全データ処理の中核

### 📋 基本Schema定義パターン

#### ✅ **基本型Schema**

```typescript
import { Schema, ParseResult } from "effect";

/**
 * 基本プリミティブ型Schema定義
 * @description Effect-TS 3.17+で使用される基本的な型Schema
 * @since 3.17.0
 */

// 文字列型Schema
export const StringSchema: Schema.Schema<string, string, never> = Schema.String;

/**
 * 数値型Schema
 * @description 任意の数値を検証・変換するSchema
 * @example
 * ```typescript
 * const result = Schema.decodeSync(NumberSchema)(42); // 42
 * const invalid = Schema.decodeSync(NumberSchema)("abc"); // throws ParseError
 * ```
 */
export const NumberSchema: Schema.Schema<number, unknown, never> = Schema.Number;

/**
 * 真偽値型Schema
 * @description boolean値の検証・変換Schema
 * @example
 * ```typescript
 * const result = Schema.decodeSync(BooleanSchema)(true); // true
 * const fromString = Schema.decodeSync(BooleanSchema)("true"); // throws ParseError (strict)
 * ```
 */
export const BooleanSchema: Schema.Schema<boolean, unknown, never> = Schema.Boolean;

/**
 * BigInt型Schema
 * @description 大整数値の検証・変換Schema
 * @example
 * ```typescript
 * const result = Schema.decodeSync(BigIntSchema)(123n); // 123n
 * const fromNumber = Schema.decodeSync(BigIntSchema)(123); // 123n (auto-converted)
 * ```
 */
export const BigIntSchema: Schema.Schema<bigint, unknown, never> = Schema.BigInt;

/**
 * Date型Schema
 * @description 日付の検証・変換Schema（文字列からの自動変換対応）
 * @example
 * ```typescript
 * const date = Schema.decodeSync(DateSchema)(new Date()); // Date object
 * const fromString = Schema.decodeSync(DateSchema)("2024-01-01"); // Date object
 * const fromTimestamp = Schema.decodeSync(DateSchema)(1704067200000); // Date object
 * ```
 */
export const DateSchema: Schema.Schema<Date, unknown, never> = Schema.Date;

/**
 * リテラル型Schema
 * @description 特定の値のみを許可する制限されたUnion型
 * @example
 * ```typescript
 * const stone = Schema.decodeSync(BlockType)("stone"); // "stone"
 * const invalid = Schema.decodeSync(BlockType)("invalid"); // throws ParseError
 * ```
 */
export const BlockType: Schema.Schema<"stone" | "grass" | "dirt" | "wood", unknown, never> =
  Schema.Literal("stone", "grass", "dirt", "wood");

type BlockType = Schema.Schema.Type<typeof BlockType>;
```

#### ⭐ **Minecraft特化Schema実装例**

```typescript
import { Schema, Brand } from "effect";

/**
 * 3D座標位置Schema
 * @description Minecraft仕様に準拠した3次元座標の型安全表現
 * @param x - X座標（整数、範囲制限なし）
 * @param y - Y座標（整数、0-255範囲、Minecraft世界の高さ制限）
 * @param z - Z座標（整数、範囲制限なし）
 * @returns Position型の検証済み座標オブジェクト
 * @throws ParseError Y座標が範囲外、または非整数値の場合
 * @since 1.0.0
 * @example
 * ```typescript
 * const validPos = Schema.decodeSync(PositionSchema)({ x: 10, y: 64, z: -20 });
 * const invalidY = Schema.decodeSync(PositionSchema)({ x: 0, y: 300, z: 0 }); // throws ParseError
 * const floatCoord = Schema.decodeSync(PositionSchema)({ x: 1.5, y: 64, z: 0 }); // throws ParseError
 * ```
 */
export const PositionSchema: Schema.Schema<Position, unknown, never> = Schema.Struct({
  x: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ description: "X coordinate in world space" })
  ),
  y: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 255),
    Schema.annotations({ description: "Y coordinate with Minecraft height limits" })
  ),
  z: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ description: "Z coordinate in world space" })
  )
}).pipe(
  Schema.annotations({
    identifier: "Position",
    title: "3D World Position",
    description: "3D world position with Minecraft constraints"
  })
);

export type Position = Schema.Schema.Type<typeof PositionSchema>;

/**
 * チャンク座標Schema
 * @description チャンク単位での管理に使用される座標
 * @param chunkX - チャンクX座標（整数）
 * @param chunkZ - チャンクZ座標（整数）
 * @returns ChunkCoordinate型の検証済み座標
 * @throws ParseError 非整数値の場合
 * @since 1.0.0
 * @example
 * ```typescript
 * const chunk = Schema.decodeSync(ChunkCoordinateSchema)({ chunkX: 2, chunkZ: -1 });
 * const invalid = Schema.decodeSync(ChunkCoordinateSchema)({ chunkX: 1.5, chunkZ: 0 }); // throws ParseError
 * ```
 */
export const ChunkCoordinateSchema: Schema.Schema<ChunkCoordinate, unknown, never> = Schema.Struct({
  chunkX: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ description: "Chunk X coordinate" })
  ),
  chunkZ: Schema.Number.pipe(
    Schema.int(),
    Schema.annotations({ description: "Chunk Z coordinate" })
  )
}).pipe(
  Schema.annotations({
    identifier: "ChunkCoordinate",
    title: "Chunk Coordinate",
    description: "Coordinate pair for chunk-based world management"
  })
);

export type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinateSchema>;

/**
 * プレイヤー状態Schema
 * @description プレイヤーの完全な状態を表す複合データ構造
 * @param id - プレイヤーのUUID
 * @param username - ユーザー名（3-16文字、英数字と_のみ）
 * @param position - 3D座標位置
 * @param health - 体力（0-20、0.5刻み）
 * @param inventory - インベントリアイテム配列
 * @param gamemode - ゲームモード
 * @returns PlayerState型の検証済みプレイヤーデータ
 * @throws ParseError バリデーション失敗時（無効なUUID、ユーザー名規則違反など）
 * @since 1.0.0
 * @example
 * ```typescript
 * const player = Schema.decodeSync(PlayerStateSchema)({
 *   id: "550e8400-e29b-41d4-a716-446655440000",
 *   username: "Steve",
 *   position: { x: 0, y: 64, z: 0 },
 *   health: 20,
 *   inventory: [],
 *   gamemode: "survival"
 * });
 * ```
 */
export const PlayerStateSchema: Schema.Schema<PlayerState, unknown, never> = Schema.Struct({
  id: Schema.String.pipe(
    Schema.uuid(),
    Schema.brand("PlayerId"),
    Schema.annotations({ description: "Unique player identifier" })
  ),
  username: Schema.String.pipe(
    Schema.minLength(3),
    Schema.maxLength(16),
    Schema.pattern(/^[a-zA-Z0-9_]+$/),
    Schema.annotations({ description: "Player username following Minecraft rules" })
  ),
  position: PositionSchema,
  health: Schema.Number.pipe(
    Schema.between(0, 20),
    Schema.multipleOf(0.5),
    Schema.brand("Health"),
    Schema.annotations({ description: "Player health in half-hearts (0-20)" })
  ),
  inventory: Schema.Array(Schema.suspend(() => ItemStackSchema)),
  gamemode: Schema.Literal("survival", "creative", "spectator").pipe(
    Schema.annotations({ description: "Current game mode" })
  )
}).pipe(
  Schema.annotations({
    identifier: "PlayerState",
    title: "Player State",
    description: "Complete player state representation"
  })
);

export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>;

/**
 * アイテムスタックSchema
 * @description インベントリシステムで使用されるアイテムの束
 * @param itemType - アイテムの種類（文字列ID）
 * @param quantity - 数量（1-64、Minecraftスタック制限）
 * @param metadata - オプションのメタデータ
 * @returns ItemStack型の検証済みアイテムデータ
 * @throws ParseError 数量が範囲外、または非整数の場合
 * @since 1.0.0
 * @example
 * ```typescript
 * const stack = Schema.decodeSync(ItemStackSchema)({
 *   itemType: "minecraft:diamond",
 *   quantity: 32,
 *   metadata: { enchantments: ["sharpness"] }
 * });
 * const invalidStack = Schema.decodeSync(ItemStackSchema)({
 *   itemType: "stone",
 *   quantity: 65 // throws ParseError - exceeds stack limit
 * });
 * ```
 */
export const ItemStackSchema: Schema.Schema<ItemStack, unknown, never> = Schema.Struct({
  itemType: Schema.String.pipe(
    Schema.brand("ItemType"),
    Schema.annotations({ description: "Item type identifier" })
  ),
  quantity: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 64),
    Schema.annotations({ description: "Item quantity with Minecraft stack limits" })
  ),
  metadata: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    }).pipe(
      Schema.annotations({ description: "Optional item metadata" })
    )
  )
}).pipe(
  Schema.annotations({
    identifier: "ItemStack",
    title: "Item Stack",
    description: "Item stack for inventory system"
  })
);

export type ItemStack = Schema.Schema.Type<typeof ItemStackSchema>;
```

### 🔄 Schema変換・検証パターン

#### ✅ **デコード・エンコード処理**
```typescript
import { Schema, Either, ParseResult } from "effect"

// 安全なデコード処理
const decodePlayerState = (input: unknown): Either.Either<PlayerState, ParseResult.ParseError> =>
  Schema.decodeUnknownEither(PlayerStateSchema)(input)

// 実用例: APIレスポンス処理
const processPlayerData = (apiResponse: unknown) =>
  pipe(
    apiResponse,
    decodePlayerState,
    Either.match({
      onLeft: (error) => {
        console.error("Player data validation failed:", error)
        return null
      },
      onRight: (playerState) => {
        console.log("Player loaded:", playerState.username)
        return playerState
      }
    })
  )

// 同期的デコード（エラー時例外）
const decodePlayerStateSync = (input: unknown): PlayerState =>
  Schema.decodeUnknownSync(PlayerStateSchema)(input)

// エンコード（外部送信用）
const encodePlayerState = (playerState: PlayerState): unknown =>
  Schema.encodeSync(PlayerStateSchema)(playerState)
```

#### 🎯 **高度なSchema合成パターン**
```typescript
// Union型Schema - 判別可能なUnion
export const GameEventSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("block_break"),
    position: PositionSchema,
    blockType: BlockType,
    player: PlayerStateSchema
  }),
  Schema.Struct({
    type: Schema.Literal("player_join"),
    player: PlayerStateSchema,
    timestamp: Schema.Date
  }),
  Schema.Struct({
    type: Schema.Literal("chat_message"),
    player: PlayerStateSchema,
    message: Schema.String.pipe(Schema.maxLength(256)),
    timestamp: Schema.Date
  })
).annotations({
  identifier: "GameEvent"
})

// 再帰的Schema - ツリー構造
export const WorldRegionSchema: Schema.Schema<WorldRegion> = Schema.Struct({
  name: Schema.String,
  bounds: Schema.Struct({
    min: PositionSchema,
    max: PositionSchema
  }),
  chunks: Schema.Array(ChunkCoordinateSchema),
  subRegions: Schema.suspend(() => Schema.Array(WorldRegionSchema))  // 再帰
}).annotations({
  identifier: "WorldRegion"
})

// 条件付きSchema - 複雑なバリデーション
export const BlockPlacementSchema = Schema.Struct({
  position: PositionSchema,
  blockType: BlockType,
  player: PlayerStateSchema
}).pipe(
  Schema.filter(({ position, player }) =>
    // プレイヤーから5ブロック以内の配置のみ許可
    Math.abs(position.x - player.position.x) <= 5 &&
    Math.abs(position.z - player.position.z) <= 5,
    {
      message: () => "Block placement too far from player"
    }
  )
)
```

## 🏗️ Context API - 依存性注入システム

### 📋 Context基本パターン

#### ✅ **サービス定義とTag作成**
```typescript
import { Context, Effect, Layer } from "effect"

// WorldService - ワールド管理の抽象化
export interface WorldService {
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, ChunkSaveError>
  readonly generateChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, GenerationError>
  readonly unloadChunk: (coord: ChunkCoordinate) => Effect.Effect<void, never>
}

export const WorldService = Context.GenericTag<WorldService>("WorldService")

// PlayerService - プレイヤー管理
export interface PlayerService {
  readonly getPlayer: (id: string) => Effect.Effect<PlayerState, PlayerNotFoundError>
  readonly updatePlayer: (player: PlayerState) => Effect.Effect<void, PlayerUpdateError>
  readonly movePlayer: (id: string, position: Position) => Effect.Effect<void, MovementError>
}

export const PlayerService = Context.GenericTag<PlayerService>("PlayerService")

// RenderService - レンダリングシステム
export interface RenderService {
  readonly renderFrame: () => Effect.Effect<void, RenderError>
  readonly updateCamera: (position: Position, rotation: Rotation) => Effect.Effect<void, never>
  readonly loadTexture: (path: string) => Effect.Effect<Texture, AssetLoadError>
}

export const RenderService = Context.GenericTag<RenderService>("RenderService")
```

#### ⭐ **実装Layer定義**
```typescript
// WorldService実装
export const WorldServiceLive: Layer.Layer<WorldService, ConfigError> = Layer.effect(
  WorldService,
  Effect.gen(function* () {
    // 設定とリソース取得
    const config = yield* Config.string("WORLD_PATH")
    const fileSystem = yield* FileSystem

    // チャンクキャッシュ
    const chunkCache = new Map<string, Chunk>()

    return WorldService.of({
      loadChunk: (coord) => Effect.gen(function* () {
        const key = `${coord.chunkX},${coord.chunkZ}`

        // キャッシュチェック
        if (chunkCache.has(key)) {
          return chunkCache.get(key)!
        }

        // ファイルから読み込み
        const chunkPath = `${config}/chunks/${key}.chunk`
        const exists = yield* fileSystem.exists(chunkPath)

        if (exists) {
          const data = yield* fileSystem.readFile(chunkPath)
          const chunk = yield* Schema.decodeUnknown(ChunkSchema)(JSON.parse(data))
          chunkCache.set(key, chunk)
          return chunk
        }

        // 生成
        return yield* generateChunk(coord)
      }),

      saveChunk: (chunk) => Effect.gen(function* () {
        const key = `${chunk.coordinate.chunkX},${chunk.coordinate.chunkZ}`
        const chunkPath = `${config}/chunks/${key}.chunk`
        const data = Schema.encodeSync(ChunkSchema)(chunk)

        yield* fileSystem.writeFile(chunkPath, JSON.stringify(data))
        chunkCache.set(key, chunk)
      }),

      generateChunk: (coord) => Effect.gen(function* () {
        // 地形生成ロジック
        const blocks = generateTerrain(coord)
        const chunk: Chunk = {
          coordinate: coord,
          blocks,
          generated: true,
          modified: false
        }
        return chunk
      }),

      unloadChunk: (coord) => Effect.sync(() => {
        const key = `${coord.chunkX},${coord.chunkZ}`
        chunkCache.delete(key)
      })
    })
  })
)

// PlayerService実装
export const PlayerServiceLive: Layer.Layer<PlayerService, never> = Layer.effect(
  PlayerService,
  Effect.gen(function* () {
    const players = new Map<string, PlayerState>()

    return PlayerService.of({
      getPlayer: (id) => Effect.gen(function* () {
        const player = players.get(id)
        if (!player) {
          return yield* Effect.fail(new PlayerNotFoundError({ playerId: id }))
        }
        return player
      }),

      updatePlayer: (player) => Effect.sync(() => {
        players.set(player.id, player)
      }),

      movePlayer: (id, position) => Effect.gen(function* () {
        const player = yield* getPlayer(id)
        const updatedPlayer = { ...player, position }
        yield* updatePlayer(updatedPlayer)
      })
    })
  })
)

// Layer合成 - 依存関係の組み立て
export const GameLayer = Layer.mergeAll(
  WorldServiceLive,
  PlayerServiceLive,
  RenderServiceLive
).pipe(
  Layer.provide(FileSystemLive),
  Layer.provide(ConfigLive)
)
```

### 🔄 Context使用パターン

#### ✅ **サービス利用の実装例**
```typescript
// ゲームロジック実装 - Contextを活用
export const processPlayerMovement = (
  playerId: string,
  newPosition: Position
): Effect.Effect<void, MovementError | ChunkLoadError, WorldService | PlayerService> =>
  Effect.gen(function* () {
    // 必要なサービス取得
    const worldService = yield* WorldService
    const playerService = yield* PlayerService

    // プレイヤー情報取得
    const player = yield* playerService.getPlayer(playerId)

    // 移動先チャンクの確認・読み込み
    const targetChunk = getChunkCoordinate(newPosition)
    const currentChunk = getChunkCoordinate(player.position)

    if (!isEqual(targetChunk, currentChunk)) {
      // チャンク境界越えの場合、新チャンクを読み込み
      yield* worldService.loadChunk(targetChunk)
    }

    // プレイヤー位置更新
    yield* playerService.movePlayer(playerId, newPosition)
  })

// ゲームメインループ
export const gameLoop: Effect.Effect<void, never, WorldService | PlayerService | RenderService> =
  Effect.gen(function* () {
    const renderService = yield* RenderService

    yield* Effect.forever(
      Effect.gen(function* () {
        // フレームレンダリング
        yield* renderService.renderFrame()

        // 16ms待機（60FPS）
        yield* Effect.sleep("16 millis")
      })
    )
  })

// アプリケーション実行
const runGame = gameLoop.pipe(
  Effect.provide(GameLayer),
  Effect.catchAll((error) =>
    Effect.sync(() => console.error("Game error:", error))
  )
)

Effect.runPromise(runGame)
```

## ⚡ Effect API - 副作用と制御フロー

### 📋 Effect基本パターン

#### ✅ **基本的なEffect操作**
```typescript
import { Effect, pipe } from "effect"

// 基本Effect作成
const simpleEffect = Effect.sync(() => "Hello World")
const asyncEffect = Effect.promise(() => fetch("/api/data"))
const failingEffect = Effect.fail(new Error("Something went wrong"))

// Effect合成
const composedEffect = Effect.gen(function* () {
  const data = yield* asyncEffect
  const processed = yield* processData(data)
  return processed
})

// エラーハンドリング
const safeEffect = composedEffect.pipe(
  Effect.catchAll((error) =>
    Effect.sync(() => {
      console.error("Error occurred:", error)
      return defaultValue
    })
  )
)
```

#### ⭐ **Minecraft特化Effect実装**
```typescript
// リソース安全な操作
export const renderChunkSafely = (
  chunk: Chunk
): Effect.Effect<void, RenderError, RenderService> =>
  Effect.gen(function* () {
    const renderService = yield* RenderService

    yield* Effect.acquireUseRelease(
      // リソース取得
      Effect.sync(() => renderService.createMesh(chunk)),

      // 使用
      (mesh) => Effect.gen(function* () {
        yield* renderService.addToScene(mesh)
        yield* renderService.renderFrame()
      }),

      // リソース解放
      (mesh) => Effect.sync(() => renderService.disposeMesh(mesh))
    )
  })

// 並行処理 - 複数チャンクの同時読み込み
export const loadChunksParallel = (
  coordinates: ChunkCoordinate[]
): Effect.Effect<Chunk[], ChunkLoadError, WorldService> =>
  Effect.gen(function* () {
    const worldService = yield* WorldService

    // 最大4並行で処理
    yield* Effect.forEach(
      coordinates,
      (coord) => worldService.loadChunk(coord),
      { concurrency: 4 }
    )
  })

// タイムアウト処理
export const loadChunkWithTimeout = (
  coord: ChunkCoordinate
): Effect.Effect<Chunk, ChunkLoadError | TimeoutError, WorldService> =>
  Effect.gen(function* () {
    const worldService = yield* WorldService

    yield* worldService.loadChunk(coord).pipe(
      Effect.timeout("5 seconds"),
      Effect.mapError((error) =>
        error instanceof TimeoutException
          ? new TimeoutError({ operation: "loadChunk", coordinate: coord })
          : error
      )
    )
  })
```

## 🔀 Pattern Matching - 型安全な分岐処理

### 📋 Match基本パターン

#### ✅ **基本的なパターンマッチング**
```typescript
import { Match, pipe } from "effect"

// 値によるマッチング
const processGameEvent = (event: GameEvent) =>
  pipe(
    event,
    Match.value,
    Match.when({ type: "block_break" }, (e) =>
      Effect.gen(function* () {
        console.log(`Block broken at ${e.position.x}, ${e.position.y}, ${e.position.z}`)
        yield* updateWorldState(e)
      })
    ),
    Match.when({ type: "player_join" }, (e) =>
      Effect.gen(function* () {
        console.log(`Player ${e.player.username} joined`)
        yield* notifyOtherPlayers(e.player)
      })
    ),
    Match.when({ type: "chat_message" }, (e) =>
      Effect.gen(function* () {
        console.log(`${e.player.username}: ${e.message}`)
        yield* broadcastMessage(e)
      })
    ),
    Match.exhaustive // 型安全性保証
  )

// 型ガードとの組み合わせ
const processInput = (input: unknown) =>
  pipe(
    input,
    Match.value,
    Match.when(Schema.is(PlayerStateSchema), handlePlayerState),
    Match.when(Schema.is(ChunkCoordinateSchema), handleChunkCoordinate),
    Match.orElse(() => Effect.fail(new InvalidInputError()))
  )
```

#### ⭐ **高度なパターンマッチング活用**
```typescript
// Result/Errorパターン
const handleChunkLoadResult = (
  result: Either.Either<Chunk, ChunkLoadError>
) =>
  pipe(
    result,
    Match.value,
    Match.when(Either.isRight, ({ right: chunk }) =>
      Effect.gen(function* () {
        console.log(`Chunk loaded: ${chunk.coordinate.chunkX}, ${chunk.coordinate.chunkZ}`)
        yield* addChunkToWorld(chunk)
      })
    ),
    Match.when(Either.isLeft, ({ left: error }) =>
      Match.value(error).pipe(
        Match.when(
          (err): err is ChunkNotFoundError => err._tag === "ChunkNotFoundError",
          (err) => Effect.gen(function* () {
            console.log("Chunk not found, generating new chunk")
            yield* generateAndSaveChunk(err.coordinate)
          })
        ),
        Match.when(
          (err): err is ChunkCorruptedError => err._tag === "ChunkCorruptedError",
          (err) => Effect.gen(function* () {
            console.error("Chunk corrupted, regenerating")
            yield* regenerateChunk(err.coordinate)
          })
        ),
        Match.orElse((err) => Effect.fail(err))
      )
    ),
    Match.exhaustive
  )

// Option型の処理
const findPlayerAndUpdate = (playerId: string, update: PlayerUpdate) =>
  pipe(
    getPlayerOptional(playerId),
    Match.value,
    Match.when(Option.isSome, ({ value: player }) =>
      updatePlayer({ ...player, ...update })
    ),
    Match.when(Option.isNone, () =>
      Effect.fail(new PlayerNotFoundError({ playerId }))
    ),
    Match.exhaustive
  )
```

## 🎯 実用的活用例・ベストプラクティス

### 🚀 **プロダクション対応パターン**

```typescript
// エラー階層の定義
export class GameError extends Schema.TaggedError<GameError>()("GameError", {
  message: Schema.String,
  timestamp: Schema.DateTimeUtc
}) {}

export class WorldError extends GameError.refine<WorldError>()("WorldError", {
  worldName: Schema.String
}) {}

export class ChunkLoadError extends WorldError.refine<ChunkLoadError>()("ChunkLoadError", {
  coordinate: ChunkCoordinateSchema
}) {}

// 統合されたゲームサービス
export const GameService = Context.GenericTag<{
  readonly startGame: () => Effect.Effect<GameState, GameError>
  readonly stopGame: () => Effect.Effect<void, never>
  readonly processFrame: () => Effect.Effect<void, GameError>
}>()("GameService")

// メインゲームループの実装
export const gameMain = Effect.gen(function* () {
  const gameService = yield* GameService

  // ゲーム開始
  const gameState = yield* gameService.startGame()
  console.log("Game started successfully")

  // メインループ
  yield* Effect.forever(
    gameService.processFrame().pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          console.error("Frame processing error:", error)
          // エラーログ記録
          yield* logError(error)
          // 復旧試行
          yield* attemptRecovery(error)
        })
      )
    )
  )
}).pipe(
  Effect.provide(GameLayer),
  Effect.scoped, // リソース自動管理
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      console.error("Fatal game error:", error)
      yield* cleanup()
      yield* Effect.fail(error)
    })
  )
)
```

## 📊 パフォーマンス考慮事項

### ⚡ **最適化のポイント**

1. **Schema検証の最適化**
   - 頻繁に使用するSchemaはキャッシュ化
   - 部分的検証の活用（`Schema.partial`）
   - バッチ処理での検証（`Effect.forEach`）

2. **Context管理の効率化**
   - Layer合成の最適化
   - 不要なサービス依存の除去
   - リソースプールの活用

3. **Effect合成の最適化**
   - 不要な中間値の削減
   - 並行処理の適切な活用
   - メモリリークの防止

---

### 🏆 **Core APIs完全習得の効果**

**✅ 型安全性**: Schema APIによる100%型安全なデータ処理
**✅ 依存管理**: Context APIによる疎結合アーキテクチャ実現
**✅ エラー制御**: Effect APIによる予測可能なエラーハンドリング
**✅ 制御フロー**: Pattern Matchingによる直感的な分岐処理

**Effect-TS 3.17+を完全マスターして、プロダクションレベルのMinecraft Cloneを構築しましょう！**

---

*📍 現在のドキュメント階層*: **[Home](../../../README.md)** → **[Reference](../README.md)** → **[API Reference](./README.md)** → **Core APIs**