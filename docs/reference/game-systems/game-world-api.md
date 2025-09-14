---
title: "Game World API Reference"
description: "TypeScript Minecraft Clone World管理システムの完全APIリファレンス。Effect-TS 3.17+による型安全なWorld操作の実装者向けガイド。"
category: "reference"
difficulty: "intermediate"
tags: ["api-reference", "world-management", "effect-ts", "domain-api", "game-world"]
prerequisites: ["effect-ts-basics", "domain-driven-design", "typescript-advanced"]
estimated_reading_time: "15分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Game World API Reference

TypeScript Minecraft Clone World管理システムの完全APIリファレンスです。Effect-TS 3.17+による型安全なWorld操作、Chunk管理、地形生成、プレイヤー配置の実装方法を詳解します。

## 📋 概要

World管理システムは以下の主要な責務を持ちます：

- **World CRUD操作**: ワールドの作成、読み込み、保存、削除
- **Chunk管理**: チャンクの動的ロード・アンロード、生成、最適化
- **地形生成**: バイオーム、構造物、リソース配置の手続き型生成
- **プレイヤー管理**: スポーン位置、ワールド間移動、権限管理
- **永続化**: ワールドデータの効率的なセーブ・ロードシステム

## 🏗️ 主要インターフェース

### WorldService - コアWorld操作

```typescript
import { Effect, Context, Schema } from "effect"

export interface WorldService {
  readonly createWorld: (params: Schema.Schema.Type<typeof CreateWorldParams>) => Effect.Effect<World, WorldCreationError>
  readonly loadWorld: (worldId: WorldId) => Effect.Effect<World, WorldLoadError>
  readonly saveWorld: (worldId: WorldId) => Effect.Effect<void, WorldSaveError>
  readonly deleteWorld: (worldId: WorldId) => Effect.Effect<void, WorldDeleteError>
  readonly getWorldMetadata: (worldId: WorldId) => Effect.Effect<WorldMetadata, WorldNotFoundError>
  readonly updateWorldSettings: (params: Schema.Schema.Type<typeof UpdateWorldSettingsParams>) => Effect.Effect<WorldSettings, WorldUpdateError>
  readonly checkCollision: (position: Position) => Effect.Effect<boolean, CollisionCheckError>
}

export const WorldService = Context.GenericTag<WorldService>("@app/WorldService")
```

### ChunkService - Chunk管理

```typescript
export interface ChunkService {
  readonly generateChunk: (params: Schema.Schema.Type<typeof GenerateChunkParams>) => Effect.Effect<Chunk, ChunkGenerationError>
  readonly loadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly unloadChunk: (coordinate: ChunkCoordinate) => Effect.Effect<void, ChunkUnloadError>
  readonly saveChunk: (chunk: Chunk) => Effect.Effect<void, ChunkSaveError>
  readonly markDirty: (coordinate: ChunkCoordinate) => Effect.Effect<void, never>
  readonly isChunkLoaded: (coordinate: ChunkCoordinate) => Effect.Effect<boolean, never>
  readonly getLoadedChunks: () => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never>
}

export const ChunkService = Context.GenericTag<ChunkService>("@app/ChunkService")
```

### WorldManagementService - 高レベルWorld操作

```typescript
export interface WorldManagementService {
  readonly createNewWorld: (params: Schema.Schema.Type<typeof CreateNewWorldParams>) => Effect.Effect<World, WorldManagementError>
  readonly generateTerrain: (params: Schema.Schema.Type<typeof GenerateTerrainParams>) => Effect.Effect<ReadonlyArray<Chunk>, TerrainGenerationError>
  readonly spawnPlayer: (params: Schema.Schema.Type<typeof SpawnPlayerParams>) => Effect.Effect<Player, PlayerSpawnError>
  readonly transferPlayer: (params: Schema.Schema.Type<typeof TransferPlayerParams>) => Effect.Effect<void, PlayerTransferError>
  readonly getWorldInfo: (worldId: WorldId) => Effect.Effect<WorldInfo, WorldNotFoundError>
  readonly listWorlds: () => Effect.Effect<ReadonlyArray<WorldSummary>, WorldListError>
}

export const WorldManagementService = Context.GenericTag<WorldManagementService>("@app/WorldManagementService")
```

## 📝 メソッド詳細

### World操作メソッド

#### createWorld

新しいワールドを作成します。

```typescript
// Schema定義
export const CreateWorldParams = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => "ワールド名は必須です" }),
    Schema.maxLength(32, { message: () => "ワールド名は32文字以下にしてください" })
  ),
  seed: Schema.Number.pipe(Schema.int()),
  gameMode: Schema.Union(
    Schema.Literal("survival"),
    Schema.Literal("creative"),
    Schema.Literal("adventure"),
    Schema.Literal("spectator")
  ),
  difficulty: Schema.Union(
    Schema.Literal("peaceful"),
    Schema.Literal("easy"),
    Schema.Literal("normal"),
    Schema.Literal("hard")
  ),
  spawnPosition: Schema.optional(PositionSchema),
  allowCheats: Schema.Boolean,
  generateStructures: Schema.Boolean
}).pipe(
  Schema.annotations({
    identifier: "CreateWorldParams",
    description: "ワールド作成パラメータ"
  })
)

// 使用例
const createNewWorld = Effect.gen(function* () {
  const worldService = yield* WorldService

  const world = yield* worldService.createWorld({
    name: "新しい世界",
    seed: 12345,
    gameMode: "survival",
    difficulty: "normal",
    allowCheats: false,
    generateStructures: true
  })

  yield* Effect.log(`ワールド作成完了: ${world.name} (ID: ${world.id})`)
  return world
})
```

#### loadWorld

既存のワールドを読み込みます。

```typescript
// 使用例
const loadExistingWorld = (worldId: WorldId) => Effect.gen(function* () {
  const worldService = yield* WorldService

  const world = yield* worldService.loadWorld(worldId)

  // ワールド設定の表示
  yield* Effect.log(`ワールド読み込み完了: ${world.metadata.name}`)
  yield* Effect.log(`ゲームモード: ${world.settings.gameMode}`)
  yield* Effect.log(`最終プレイ: ${new Date(world.metadata.lastPlayed).toISOString()}`)

  return world
})
```

#### saveWorld

ワールドデータを永続化します。

```typescript
// 使用例
const saveWorldData = (worldId: WorldId) => Effect.gen(function* () {
  const worldService = yield* WorldService

  yield* worldService.saveWorld(worldId)
  yield* Effect.log(`ワールドを保存しました: ${worldId}`)
})
```

### Chunk操作メソッド

#### generateChunk

指定座標にチャンクを生成します。

```typescript
// Schema定義
export const GenerateChunkParams = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
  seed: Schema.Number.pipe(Schema.int()),
  biomeType: Schema.optional(Schema.String),
  generateStructures: Schema.Boolean
}).pipe(
  Schema.annotations({
    identifier: "GenerateChunkParams",
    description: "チャンク生成パラメータ"
  })
)

// 使用例
const generateNewChunk = (x: number, z: number, seed: number) => Effect.gen(function* () {
  const chunkService = yield* ChunkService

  const chunk = yield* chunkService.generateChunk({
    x,
    z,
    seed,
    generateStructures: true
  })

  yield* Effect.log(`チャンク生成完了: (${x}, ${z})`)
  yield* Effect.log(`ブロック数: ${chunk.blocks.length}`)
  yield* Effect.log(`バイオーム: ${chunk.biome}`)

  return chunk
})
```

#### loadChunk

チャンクを読み込みます（キャッシュまたは生成）。

```typescript
// 使用例
const loadChunkSafely = (coordinate: ChunkCoordinate) => Effect.gen(function* () {
  const chunkService = yield* ChunkService

  // チャンクが既に読み込まれているかチェック
  const isLoaded = yield* chunkService.isChunkLoaded(coordinate)

  if (isLoaded) {
    yield* Effect.log(`チャンクは既に読み込み済み: (${coordinate.x}, ${coordinate.z})`)
    return
  }

  // チャンクを読み込み
  const chunk = yield* chunkService.loadChunk(coordinate)

  yield* Effect.log(`チャンク読み込み完了: (${coordinate.x}, ${coordinate.z})`)
  return chunk
})
```

### World管理メソッド

#### generateTerrain

指定範囲の地形を生成します。

```typescript
// Schema定義
export const GenerateTerrainParams = Schema.Struct({
  center: ChunkCoordinateSchema,
  radius: Schema.Number.pipe(
    Schema.int(),
    Schema.positive({ message: () => "半径は正の値である必要があります" }),
    Schema.lessThanOrEqualTo(16, { message: () => "半径は16以下である必要があります" })
  ),
  biomeDistribution: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Number.pipe(Schema.between(0, 1))
  })),
  structureDensity: Schema.Number.pipe(Schema.between(0, 1))
}).pipe(
  Schema.annotations({
    identifier: "GenerateTerrainParams",
    description: "地形生成パラメータ"
  })
)

// 使用例
const generateSpawnArea = (spawnPoint: Position) => Effect.gen(function* () {
  const worldManagement = yield* WorldManagementService

  const spawnChunk = {
    x: Math.floor(spawnPoint.x / 16),
    z: Math.floor(spawnPoint.z / 16)
  }

  const chunks = yield* worldManagement.generateTerrain({
    center: spawnChunk,
    radius: 3, // 7x7チャンク範囲
    structureDensity: 0.3
  })

  yield* Effect.log(`スポーンエリア生成完了: ${chunks.length}チャンク`)
  return chunks
})
```

#### spawnPlayer

プレイヤーをワールドにスポーンさせます。

```typescript
// Schema定義
export const SpawnPlayerParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand(PlayerId)),
  worldId: Schema.String.pipe(Schema.brand(WorldId)),
  spawnType: Schema.Union(
    Schema.Literal("world_spawn"),
    Schema.Literal("bed_spawn"),
    Schema.Literal("random_spawn"),
    Schema.Literal("custom_spawn")
  ),
  customPosition: Schema.optional(PositionSchema),
  gameMode: Schema.optional(GameModeSchema)
}).pipe(
  Schema.annotations({
    identifier: "SpawnPlayerParams",
    description: "プレイヤースポーンパラメータ"
  })
)

// 使用例
const spawnNewPlayer = (playerId: PlayerId, worldId: WorldId) => Effect.gen(function* () {
  const worldManagement = yield* WorldManagementService

  const player = yield* worldManagement.spawnPlayer({
    playerId,
    worldId,
    spawnType: "world_spawn"
  })

  yield* Effect.log(`プレイヤースポーン完了: ${playerId}`)
  yield* Effect.log(`位置: (${player.position.x}, ${player.position.y}, ${player.position.z})`)

  return player
})
```

## 💡 使用例

### 基本的なワールド作成フロー

```typescript
import { Effect, Layer } from "effect"

// 完全なワールド作成フロー
const createCompleteWorld = Effect.gen(function* () {
  const worldService = yield* WorldService
  const worldManagement = yield* WorldManagementService
  const chunkService = yield* ChunkService

  // 1. 新しいワールドを作成
  const world = yield* worldService.createWorld({
    name: "冒険の世界",
    seed: Date.now(),
    gameMode: "survival",
    difficulty: "normal",
    allowCheats: false,
    generateStructures: true
  })

  // 2. スポーンエリアの地形生成
  const spawnChunks = yield* worldManagement.generateTerrain({
    center: { x: 0, z: 0 },
    radius: 4,
    structureDensity: 0.4
  })

  // 3. プレイヤーのスポーン
  const player = yield* worldManagement.spawnPlayer({
    playerId: "player_001" as PlayerId,
    worldId: world.id,
    spawnType: "world_spawn"
  })

  // 4. 初期状態の保存
  yield* worldService.saveWorld(world.id)

  yield* Effect.log("ワールド作成完了！")
  return { world, player, spawnChunks }
})
```

### 動的チャンクロード

```typescript
// プレイヤー移動に応じた動的チャンクロード
const dynamicChunkLoading = (playerPosition: Position, loadRadius: number = 3) => Effect.gen(function* () {
  const chunkService = yield* ChunkService

  // プレイヤー周辺のチャンク座標を計算
  const playerChunk = {
    x: Math.floor(playerPosition.x / 16),
    z: Math.floor(playerPosition.z / 16)
  }

  const chunksToLoad: ChunkCoordinate[] = []
  for (let x = -loadRadius; x <= loadRadius; x++) {
    for (let z = -loadRadius; z <= loadRadius; z++) {
      chunksToLoad.push({
        x: playerChunk.x + x,
        z: playerChunk.z + z
      })
    }
  }

  // 必要なチャンクを並列ロード
  const loadedChunks = yield* Effect.all(
    chunksToLoad.map(coord =>
      chunkService.loadChunk(coord).pipe(
        Effect.catchTag("ChunkLoadError", (error) =>
          Effect.gen(function* () {
            yield* Effect.log(`チャンクロード失敗、生成します: (${coord.x}, ${coord.z})`)
            return yield* chunkService.generateChunk({
              x: coord.x,
              z: coord.z,
              seed: getCurrentWorldSeed(),
              generateStructures: true
            })
          })
        )
      )
    ),
    { concurrency: 4 }
  )

  // 不要なチャンクのアンロード
  const currentlyLoaded = yield* chunkService.getLoadedChunks()
  const chunksToUnload = currentlyLoaded.filter(coord => {
    const distance = Math.max(
      Math.abs(coord.x - playerChunk.x),
      Math.abs(coord.z - playerChunk.z)
    )
    return distance > loadRadius + 1 // 1チャンク分の余裕
  })

  yield* Effect.all(
    chunksToUnload.map(coord => chunkService.unloadChunk(coord)),
    { concurrency: 2 }
  )

  return loadedChunks
})
```

### ワールド間プレイヤー転送

```typescript
// プレイヤーのワールド間移動
const transferPlayerBetweenWorlds = (
  playerId: PlayerId,
  fromWorldId: WorldId,
  toWorldId: WorldId,
  targetPosition?: Position
) => Effect.gen(function* () {
  const worldService = yield* WorldService
  const worldManagement = yield* WorldManagementService

  // 1. 転送元ワールドからプレイヤーを取得
  const fromWorld = yield* worldService.loadWorld(fromWorldId)
  const player = fromWorld.players.get(playerId)

  if (!player) {
    return yield* Effect.fail(new PlayerNotFoundError({
      playerId,
      searchContext: "world_transfer"
    }))
  }

  // 2. 転送元ワールドを保存（プレイヤー位置含む）
  yield* worldService.saveWorld(fromWorldId)

  // 3. 転送先ワールドをロード
  const toWorld = yield* worldService.loadWorld(toWorldId)

  // 4. プレイヤーを転送先にスポーン
  const transferredPlayer = yield* worldManagement.spawnPlayer({
    playerId,
    worldId: toWorldId,
    spawnType: targetPosition ? "custom_spawn" : "world_spawn",
    customPosition: targetPosition
  })

  // 5. 転送先ワールドの周辺チャンクをロード
  yield* dynamicChunkLoading(transferredPlayer.position)

  yield* Effect.log(`プレイヤー転送完了: ${playerId}`)
  yield* Effect.log(`${fromWorldId} → ${toWorldId}`)

  return transferredPlayer
})
```

## ⚠️ エラーケース

### 共通エラーパターンと対処法

#### World作成エラー

```typescript
const handleWorldCreationError = (worldParams: CreateWorldParams) =>
  WorldService.pipe(
    Effect.flatMap(service => service.createWorld(worldParams)),
    Effect.catchTags({
      "WorldSystem.WorldCreationError": (error) => Effect.gen(function* () {
        yield* Effect.log(`ワールド作成失敗: ${error.reason}`)

        // 重複名の場合
        if (error.existingWorldConflict) {
          const newName = `${worldParams.name}_${Date.now()}`
          yield* Effect.log(`代替名で再試行: ${newName}`)
          return yield* service.createWorld({
            ...worldParams,
            name: newName
          })
        }

        // ディスク容量不足の場合
        if (error.diskSpaceRequired > error.diskSpaceAvailable) {
          yield* Effect.log("ディスク容量不足です")
          return yield* Effect.fail(error)
        }

        return yield* Effect.fail(error)
      }),
      "ValidationError": (error) => Effect.gen(function* () {
        yield* Effect.log(`パラメータエラー: ${error.message}`)
        return yield* Effect.fail(error)
      })
    })
  )
```

#### チャンク生成エラー

```typescript
const handleChunkGenerationError = (coordinate: ChunkCoordinate) =>
  ChunkService.pipe(
    Effect.flatMap(service => service.generateChunk({
      x: coordinate.x,
      z: coordinate.z,
      seed: getCurrentWorldSeed(),
      generateStructures: true
    })),
    Effect.catchTags({
      "ChunkSystem.ChunkGenerationError": (error) => Effect.gen(function* () {
        yield* Effect.log(`チャンク生成失敗: (${error.chunkX}, ${error.chunkZ})`)
        yield* Effect.log(`生成ステップ: ${error.generationStep}`)

        // メモリ不足の場合
        if (error.performance.memoryUsed > MAX_CHUNK_MEMORY) {
          yield* Effect.log("メモリ不足によりシンプルな地形を生成します")
          return yield* generateSimpleChunk(coordinate)
        }

        // バイオーム決定エラーの場合
        if (error.generationStep === "biome_determination") {
          yield* Effect.log("デフォルトバイオームで再生成します")
          return yield* generateChunkWithDefaultBiome(coordinate)
        }

        return yield* Effect.fail(error)
      }),
      "BiomeGenerationError": (error) => Effect.gen(function* () {
        yield* Effect.log("バイオーム生成エラー、平原バイオームを使用")
        return yield* generatePlainsBiomeChunk(coordinate)
      })
    }),
    Effect.retry(Schedule.exponential("1 seconds").pipe(
      Schedule.recurs(3)
    ))
  )
```

#### プレイヤースポーンエラー

```typescript
const handlePlayerSpawnError = (params: SpawnPlayerParams) =>
  WorldManagementService.pipe(
    Effect.flatMap(service => service.spawnPlayer(params)),
    Effect.catchTags({
      "PlayerSystem.PlayerSpawnError": (error) => Effect.gen(function* () {
        yield* Effect.log(`プレイヤースポーン失敗: ${error.playerId}`)

        // スポーン地点が危険な場合
        if (error.reason === "unsafe_spawn_location") {
          yield* Effect.log("安全なスポーン地点を検索中...")
          const safePosition = yield* findSafeSpawnLocation(params.worldId)
          return yield* service.spawnPlayer({
            ...params,
            spawnType: "custom_spawn",
            customPosition: safePosition
          })
        }

        // ワールドが見つからない場合
        if (error.reason === "world_not_found") {
          yield* Effect.log("ワールドの再ロードを試行中...")
          yield* WorldService.pipe(
            Effect.flatMap(ws => ws.loadWorld(params.worldId))
          )
          return yield* service.spawnPlayer(params)
        }

        return yield* Effect.fail(error)
      }),
      "ChunkSystem.ChunkLoadError": (error) => Effect.gen(function* () {
        yield* Effect.log("スポーン地点のチャンクが読み込めません")
        yield* Effect.log("スポーン周辺を生成中...")

        const spawnChunk = { x: 0, z: 0 } // デフォルトスポーン
        yield* ChunkService.pipe(
          Effect.flatMap(cs => cs.generateChunk({
            x: spawnChunk.x,
            z: spawnChunk.z,
            seed: getCurrentWorldSeed(),
            generateStructures: true
          }))
        )

        return yield* service.spawnPlayer({
          ...params,
          spawnType: "world_spawn"
        })
      })
    })
  )
```

### パフォーマンス最適化

```typescript
// 大量チャンク操作の最適化
const optimizedMassChunkOperation = (
  coordinates: ReadonlyArray<ChunkCoordinate>,
  operation: "load" | "save" | "generate"
) => Effect.gen(function* () {
  const chunkService = yield* ChunkService

  // バッチサイズ制限
  const BATCH_SIZE = 8
  const batches = chunk(coordinates, BATCH_SIZE)

  for (const batch of batches) {
    yield* Effect.all(
      batch.map(coord => {
        switch (operation) {
          case "load":
            return chunkService.loadChunk(coord)
          case "save":
            return chunkService.saveChunk(/* chunk */)
          case "generate":
            return chunkService.generateChunk({
              x: coord.x,
              z: coord.z,
              seed: getCurrentWorldSeed(),
              generateStructures: true
            })
        }
      }),
      { concurrency: 4 }
    )

    // バッチ間の小休止（メモリ解放）
    yield* Effect.sleep("100 millis")
  }
})

// メモリ使用量監視付きチャンク管理
const memoryAwareChunkManagement = Effect.gen(function* () {
  const chunkService = yield* ChunkService

  const loadedChunks = yield* chunkService.getLoadedChunks()
  const memoryUsage = yield* getMemoryUsage()

  // メモリ使用量が閾値を超えた場合
  if (memoryUsage.used > MEMORY_THRESHOLD) {
    yield* Effect.log("メモリ使用量が高いため、古いチャンクをアンロードします")

    // LRU方式で古いチャンクをアンロード
    const chunksToUnload = yield* getLRUChunks(loadedChunks, 0.3) // 30%をアンロード

    yield* Effect.all(
      chunksToUnload.map(coord => chunkService.unloadChunk(coord)),
      { concurrency: 2 }
    )

    // ガベージコレクション実行
    yield* Effect.sync(() => {
      if (global.gc) {
        global.gc()
      }
    })
  }
})
```

## 🔗 関連ドキュメント

- **[World Data Structure](../02-specifications/03-data-models/00-world-data-structure.md)** - ワールドデータ構造の詳細
- **[Chunk System](../02-specifications/00-core-features/07-chunk-system.md)** - チャンクシステムの実装
- **[Domain APIs](../02-specifications/02-api-design/00-domain-application-apis.md)** - ドメインAPI設計
- **[Effect-TS Patterns](../01-architecture/06-effect-ts-patterns.md)** - Effect-TS使用パターン
- **[Error Handling Guide](../03-guides/04-error-resolution.md)** - エラーハンドリング戦略

## 📖 用語集

- **World (ワールド)**: プレイヤーがプレイする3D空間全体
- **Chunk (チャンク)**: 16x16x256ブロックの管理単位
- **Biome (バイオーム)**: 地形の特性を定義する環境設定
- **Generation (生成)**: 手続き型アルゴリズムによる地形作成
- **Persistence (永続化)**: ワールドデータの保存・復元機能