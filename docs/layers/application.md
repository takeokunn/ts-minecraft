# Application Layer - ユースケース実装とワークフロー

Application層は、Domain層のビジネスロジックを組み合わせてユースケースを実現する層です。Effect-TSのLayerシステムを活用し、型安全な依存性注入とエラーハンドリングを実現しています。

## 概要

Application層は、ユーザーの要求をDomain層の操作に変換し、ビジネスフローを管理します。この層では、トランザクション管理、ワークフロー制御、クエリの最適化などを担当します。

## ディレクトリ構造

```
src/application/
├── use-cases/         # ユースケース実装
│   ├── player-move.usecase.ts
│   ├── block-place.usecase.ts
│   ├── chunk-load.usecase.ts
│   └── world-generate.usecase.ts
├── workflows/         # 複合ワークフロー
│   ├── chunk-loading.ts
│   ├── world-update.ts
│   └── system-scheduler.ts
├── queries/          # 統合クエリシステム
│   ├── unified-query-system.ts
│   ├── archetype-query.ts
│   └── predefined-queries.ts
├── handlers/         # コマンド・イベントハンドラー
│   ├── command.handler.ts
│   └── event.handler.ts
├── services/         # アプリケーションサービス
└── di/              # 依存性注入設定

## 1. Use Cases（ユースケース）

具体的なビジネス機能を実装するユースケース群。すべてのユースケースは Effect-TS の Context.Tag パターンで定義され、Layer システムによる依存性注入をサポートしています。

### ワールド生成ユースケース

```typescript
// src/application/use-cases/world-generate.usecase.ts
import { Schema, Effect, Context, Layer } from "effect"

// Schemaベースのコマンド定義
const WorldType = Schema.Union(
  Schema.Literal("flat"),
  Schema.Literal("normal"),
  Schema.Literal("amplified"),
  Schema.Literal("debug")
)

const WorldSize = Schema.Union(
  Schema.Literal("small"),
  Schema.Literal("medium"),
  Schema.Literal("large"),
  Schema.Literal("infinite")
)

const WorldGenerateCommand = Schema.Struct({
  seed: Schema.Number.pipe(Schema.int()),
  worldType: WorldType,
  generateStructures: Schema.Boolean,
  worldSize: Schema.optional(WorldSize),
  biomes: Schema.optional(Schema.Array(Schema.String))
})
type WorldGenerateCommand = Schema.Schema.Type<typeof WorldGenerateCommand>

// エラー型定義
const ValidationError = Schema.Struct({
  _tag: Schema.Literal("ValidationError"),
  field: Schema.String,
  message: Schema.String,
  value: Schema.Unknown
})
type ValidationError = Schema.Schema.Type<typeof ValidationError>

const TerrainGenerationError = Schema.Struct({
  _tag: Schema.Literal("TerrainGenerationError"),
  reason: Schema.String,
  chunkCoordinates: Schema.optional(Schema.Struct({ x: Schema.Number, z: Schema.Number })),
  seed: Schema.optional(Schema.Number)
})
type TerrainGenerationError = Schema.Schema.Type<typeof TerrainGenerationError>

const MeshGenerationError = Schema.Struct({
  _tag: Schema.Literal("MeshGenerationError"),
  reason: Schema.String,
  geometryType: Schema.String
})
type MeshGenerationError = Schema.Schema.Type<typeof MeshGenerationError>

const WorldStateError = Schema.Struct({
  _tag: Schema.Literal("WorldStateError"),
  operation: Schema.String,
  reason: Schema.String
})
type WorldStateError = Schema.Schema.Type<typeof WorldStateError>

// サービスインターフェース
export interface WorldGenerateUseCaseService {
  readonly execute: (command: WorldGenerateCommand) => Effect.Effect<
    void,
    ValidationError | TerrainGenerationError | MeshGenerationError | WorldStateError,
    never
  >
  readonly generateBiome: (chunkX: number, chunkZ: number, biomeType: string) => Effect.Effect<
    void,
    ValidationError | TerrainGenerationError | WorldStateError,
    never
  >
}

// 新しい Context.Tag 記法
export const WorldGenerateUseCase = Context.GenericTag<WorldGenerateUseCaseService>("@app/WorldGenerateUseCase")

// 依存サービスのインターフェース定義
interface WorldDomainService {
  readonly initializeWorld: (terrain: unknown) => Effect.Effect<void, WorldStateError, never>
}
const WorldDomainService = Context.GenericTag<WorldDomainService>("@app/WorldDomainService")

interface TerrainGenerationDomainService {
  readonly generateTerrain: (seed: number) => Effect.Effect<unknown, TerrainGenerationError, never>
  readonly generateBiome: (chunkX: number, chunkZ: number, biomeType: string) => Effect.Effect<void, TerrainGenerationError, never>
}
const TerrainGenerationDomainService = Context.GenericTag<TerrainGenerationDomainService>("@app/TerrainGenerationDomainService")

export const WorldGenerateUseCaseLive = Layer.effect(
  WorldGenerateUseCase,
  Effect.gen(function* () {
    const worldService = yield* WorldDomainService
    const terrainService = yield* TerrainGenerationDomainService

    return {
      execute: (command: WorldGenerateCommand) => Effect.gen(function* () {
        // 早期リターン: Schema バリデーション
        const validated = yield* Schema.decodeUnknown(WorldGenerateCommand)(command).pipe(
          Effect.mapError((error) => ({
            _tag: "ValidationError" as const,
            field: "WorldGenerateCommand",
            message: "Command validation failed",
            value: command
          }))
        )

        // 早期リターン: シード値検証
        if (validated.seed < 0) {
          return yield* Effect.fail({
            _tag: "ValidationError" as const,
            field: "seed",
            message: "Seed must be non-negative",
            value: validated.seed
          })
        }

        // 基本地形生成
        const terrain = yield* terrainService.generateTerrain(validated.seed)

        // ワールド初期化
        yield* worldService.initializeWorld(terrain)
        yield* Effect.logInfo(`World generated with seed: ${validated.seed}, type: ${validated.worldType}`)
      }),

      generateBiome: (chunkX: number, chunkZ: number, biomeType: string) => Effect.gen(function* () {
        // 早期リターン: パラメータ検証
        if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) {
          return yield* Effect.fail({
            _tag: "ValidationError" as const,
            field: "chunkCoordinates",
            message: "Chunk coordinates must be integers",
            value: { chunkX, chunkZ }
          })
        }

        if (!biomeType || biomeType.length === 0) {
          return yield* Effect.fail({
            _tag: "ValidationError" as const,
            field: "biomeType",
            message: "Biome type cannot be empty",
            value: biomeType
          })
        }

        yield* terrainService.generateBiome(chunkX, chunkZ, biomeType)
        yield* Effect.logInfo(`Generated biome '${biomeType}' at chunk (${chunkX}, ${chunkZ})`)
      })
    }
  })
)
```

**機能:**
- シード値に基づく地形生成
- バイオーム配置
- 構造物生成（村、ダンジョン等）
- 初期ワールド状態構築

### プレイヤー移動ユースケース

```typescript
// src/application/use-cases/player-move.usecase.ts
// Schemaベースのプレイヤー移動コマンド
const Direction = Schema.Struct({
  x: Schema.Number.pipe(Schema.between(-1, 1)),
  y: Schema.Number.pipe(Schema.between(-1, 1)),
  z: Schema.Number.pipe(Schema.between(-1, 1))
})

const PlayerMovementCommand = Schema.Struct({
  entityId: Schema.String.pipe(Schema.brand("EntityId")),
  direction: Direction,
  deltaTime: Schema.Number.pipe(Schema.positive()),
  sprint: Schema.Boolean,
  sneak: Schema.Boolean
})
type PlayerMovementCommand = Schema.Schema.Type<typeof PlayerMovementCommand>

// 追加のエラー型定義
const EntityNotFoundError = Schema.Struct({
  _tag: Schema.Literal("EntityNotFoundError"),
  entityId: Schema.String,
  message: Schema.String
})
type EntityNotFoundError = Schema.Schema.Type<typeof EntityNotFoundError>

const InvalidPositionError = Schema.Struct({
  _tag: Schema.Literal("InvalidPositionError"),
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  reason: Schema.String
})
type InvalidPositionError = Schema.Schema.Type<typeof InvalidPositionError>

const ChunkNotLoadedError = Schema.Struct({
  _tag: Schema.Literal("ChunkNotLoadedError"),
  chunkCoords: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
  operation: Schema.String
})
type ChunkNotLoadedError = Schema.Schema.Type<typeof ChunkNotLoadedError>

const PhysicsSimulationError = Schema.Struct({
  _tag: Schema.Literal("PhysicsSimulationError"),
  reason: Schema.String,
  entityId: Schema.String
})
type PhysicsSimulationError = Schema.Schema.Type<typeof PhysicsSimulationError>

const CollisionDetectionError = Schema.Struct({
  _tag: Schema.Literal("CollisionDetectionError"),
  reason: Schema.String,
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })
})
type CollisionDetectionError = Schema.Schema.Type<typeof CollisionDetectionError>

export interface PlayerMoveUseCaseService {
  readonly execute: (command: PlayerMovementCommand) => Effect.Effect<
    void,
    ValidationError | EntityNotFoundError | InvalidPositionError |
    ChunkNotLoadedError | PhysicsSimulationError | CollisionDetectionError,
    never
  >
}

export const PlayerMoveUseCase = Context.GenericTag<PlayerMoveUseCaseService>("@app/PlayerMoveUseCase")

// 依存サービスのインターフェース定義
interface EntityDomainService {
  readonly getEntity: (entityId: string) => Effect.Effect<{ id: string; position: { x: number; y: number; z: number } }, EntityNotFoundError, never>
  readonly updatePosition: (entityId: string, velocity: { x: number; y: number; z: number }) => Effect.Effect<void, never, never>
}
const EntityDomainService = Context.GenericTag<EntityDomainService>("@app/EntityDomainService")

interface PhysicsDomainService {
  readonly calculateVelocity: (entity: unknown, direction: { x: number; y: number; z: number }, deltaTime: number, modifiers: { sprint: boolean; sneak: boolean }) => Effect.Effect<{ x: number; y: number; z: number }, PhysicsSimulationError, never>
  readonly detectCollision: (position: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }) => Effect.Effect<boolean, CollisionDetectionError, never>
}
const PhysicsDomainService = Context.GenericTag<PhysicsDomainService>("@app/PhysicsDomainService")

export const PlayerMoveUseCaseLive = Layer.effect(
  PlayerMoveUseCase,
  Effect.gen(function* () {
    const entityService = yield* EntityDomainService
    const physicsService = yield* PhysicsDomainService
    const worldService = yield* WorldDomainService

    return {
      execute: (command: PlayerMovementCommand) => Effect.gen(function* () {
        // 早期リターン: Schema バリデーション
        const validated = yield* Schema.decodeUnknown(PlayerMovementCommand)(command).pipe(
          Effect.mapError((error) => ({
            _tag: "ValidationError" as const,
            field: "PlayerMovementCommand",
            message: "Command validation failed",
            value: command
          }))
        )

        // 早期リターン: デルタタイム検証
        if (validated.deltaTime > 1.0) {
          return yield* Effect.fail({
            _tag: "ValidationError" as const,
            field: "deltaTime",
            message: "Delta time too large",
            value: validated.deltaTime
          })
        }

        // エンティティ取得
        const entity = yield* entityService.getEntity(validated.entityId)

        // 速度計算
        const velocity = yield* physicsService.calculateVelocity(
          entity,
          validated.direction,
          validated.deltaTime,
          { sprint: validated.sprint, sneak: validated.sneak }
        )

        // 衝突検出
        const hasCollision = yield* physicsService.detectCollision(
          entity.position,
          velocity
        )

        // 早期リターン: 衝突なしの場合のみ位置更新
        if (!hasCollision) {
          yield* entityService.updatePosition(entity.id, velocity)
          yield* Effect.logInfo(`Player ${entity.id} moved to new position`)
        } else {
          yield* Effect.logInfo(`Player ${entity.id} movement blocked by collision`)
        }

        // チャンク境界チェック
        yield* checkChunkBoundary(entity.position)
      })
    }
  })
)

// 補助関数
const checkChunkBoundary = (position: { x: number; y: number; z: number }): Effect.Effect<void, ChunkNotLoadedError, never> =>
  Effect.logInfo(`Checking chunk boundary for position: ${JSON.stringify(position)}`)
```

**機能:**
- 入力に基づく移動計算
- 物理演算（重力、摩擦）
- 衝突検出・応答
- チャンク境界での動的読み込み

### ブロック配置ユースケース

```typescript
// src/application/use-cases/block-place.usecase.ts
// ブロック操作コマンドの Schema 定義
const BlockAction = Schema.Union(
  Schema.Literal("place"),
  Schema.Literal("break")
)

const BlockFace = Schema.Union(
  Schema.Literal("top"),
  Schema.Literal("bottom"),
  Schema.Literal("north"),
  Schema.Literal("south"),
  Schema.Literal("east"),
  Schema.Literal("west")
)

const Position = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int())
})

const BlockInteractionCommand = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  position: Position,
  action: BlockAction,
  blockType: Schema.optional(Schema.Number.pipe(Schema.nonnegative())),
  face: Schema.optional(BlockFace)
})
type BlockInteractionCommand = Schema.Schema.Type<typeof BlockInteractionCommand>

// 追加のエラー型
const RaycastError = Schema.Struct({
  _tag: Schema.Literal("RaycastError"),
  reason: Schema.String,
  startPosition: Position,
  direction: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })
})
type RaycastError = Schema.Schema.Type<typeof RaycastError>

export interface BlockPlaceUseCaseService {
  readonly execute: (command: BlockInteractionCommand) => Effect.Effect<
    void,
    ValidationError | InvalidPositionError | EntityNotFoundError |
    WorldStateError | RaycastError,
    never
  >
}

export const BlockPlaceUseCase = Context.GenericTag<BlockPlaceUseCaseService>("@app/BlockPlaceUseCase")

export const BlockPlaceUseCaseLive = Layer.effect(
  BlockPlaceUseCase,
  Effect.gen(function* () {
    const worldService = yield* WorldDomainService
    const entityService = yield* EntityDomainService
    const meshService = yield* MeshGenerationDomainService

    return BlockPlaceUseCase.of({
      execute: (command) => Effect.gen(function* () {
        // プレイヤー検証
        const player = yield* entityService.getEntity(EntityId.make(command.playerId))

        // 位置検証
        const position = Position.make(command.position.x, command.position.y, command.position.z)
        const isValid = yield* worldService.validateBlockPosition(position)

        if (!isValid) {
          return yield* Effect.fail(new InvalidPositionError({ position }))
        }

        if (command.action === 'place' && command.blockType) {
          // ブロック配置
          yield* worldService.placeBlock(position, command.blockType)
        } else if (command.action === 'break') {
          // ブロック破壊
          yield* worldService.removeBlock(position)
        }

        // チャンクメッシュ更新
        const chunkCoord = ChunkCoordinate.fromPosition(position)
        yield* meshService.updateChunkMesh(chunkCoord)
      })
    })
  })
)
```

**機能:**
- ブロック配置可能性検証
- ワールド状態更新
- メッシュ再生成
- 照明計算更新

### チャンク読み込みユースケース

```typescript
// src/application/use-cases/chunk-load.usecase.ts
export interface ChunkLoadCommand {
  coordinate: ChunkCoordinate
  priority: LoadPriority
  generateIfNotExists: boolean
}

export const ChunkLoadUseCase = (command: ChunkLoadCommand) =>
  Effect.gen(function* () {
    // キャッシュ確認
    const cached = yield* getChunkFromCache(command.coordinate)
    
    if (cached) {
      return cached
    }
    
    // ストレージから読み込み
    const stored = yield* loadChunkFromStorage(command.coordinate)
    
    if (stored) {
      yield* cacheChunk(stored)
      return stored
    }
    
    // 生成が必要な場合
    if (command.generateIfNotExists) {
      const generated = yield* generateNewChunk(command.coordinate)
      yield* cacheChunk(generated)
      yield* saveChunkToStorage(generated)
      return generated
    }
    
    return yield* Effect.fail(new ChunkNotFoundError())
  })
```

**機能:**
- キャッシュ優先の読み込み戦略
- ストレージからの復元
- 動的チャンク生成
- 非同期バックグラウンド処理

## 2. Workflows（ワークフロー）

複数のユースケースを組み合わせた複合処理。

### チャンク読み込みワークフロー

```typescript
// src/application/workflows/chunk-loading.ts
export const ChunkLoadingWorkflow = Effect.gen(function* () {
  // プレイヤー位置取得
  const players = yield* getAllPlayers()
  
  // 必要チャンク計算
  const requiredChunks = yield* calculateRequiredChunks(players)
  
  // 優先度付きキュー作成
  const loadingQueue = yield* createPriorityQueue(requiredChunks)
  
  // バッチ読み込み実行
  yield* processBatchLoading(loadingQueue)
  
  // 不要チャンク解放
  yield* unloadDistantChunks(players)
})
```

**機能:**
- プレイヤー位置ベースのチャンク管理
- 優先度付き非同期読み込み
- メモリ効率的なアンロード
- バックグラウンド処理

### ワールド更新ワークフロー

```typescript
// src/application/workflows/world-update.ts
export const WorldUpdateWorkflow = (deltaTime: number) =>
  Effect.gen(function* () {
    // 物理演算更新
    yield* updatePhysicsSimulation(deltaTime)
    
    // エンティティ更新
    yield* updateAllEntities(deltaTime)
    
    // 時間進行
    yield* advanceWorldTime(deltaTime)
    
    // 天候更新
    yield* updateWeatherSystem(deltaTime)
    
    // 照明更新
    yield* updateLightingSystem()
    
    // レンダリング準備
    yield* prepareRenderData()
  })
```

**機能:**
- フレームごとの全体更新
- 物理・エンティティ・環境の同期更新
- パフォーマンス最適化
- レンダリング準備

### システムスケジューラー

```typescript
// src/application/workflows/system-scheduler.ts
export const SystemScheduler = Effect.gen(function* () {
  const scheduler = yield* createScheduler()
  
  // 高頻度タスク（60FPS）
  yield* scheduler.scheduleHighFrequency([
    updatePlayerMovement,
    updatePhysics,
    updateRendering
  ])
  
  // 中頻度タスク（10FPS）  
  yield* scheduler.scheduleMediumFrequency([
    updateChunkLoading,
    updateWeather,
    updateLighting
  ])
  
  // 低頻度タスク（1FPS）
  yield* scheduler.scheduleLowFrequency([
    saveWorldState,
    garbageCollection,
    updateStatistics
  ])
})
```

**機能:**
- 頻度別タスクスケジューリング
- パフォーマンス最適化
- リソース管理
- 負荷分散

## 3. Query System（クエリシステム）

高性能なエンティティ検索・データ取得システム。

### 統一クエリシステム

```typescript
// src/application/queries/unified-query-system.ts
export interface UnifiedQueryConfig {
  components: ComponentType[]
  filters?: EntityPredicate[]
  sortBy?: SortConfig
  limit?: number
}

export const createUnifiedQuery = <T>(config: UnifiedQueryConfig) =>
  Effect.gen(function* () {
    // アーキタイプベース検索
    const archetypes = yield* findMatchingArchetypes(config.components)
    
    // エンティティフィルタリング
    const entities = yield* filterEntities(archetypes, config.filters)
    
    // ソート処理
    const sorted = config.sortBy ? yield* sortEntities(entities, config.sortBy) : entities
    
    // 制限適用
    const limited = config.limit ? sorted.slice(0, config.limit) : sorted
    
    return limited
  })
```

### アーキタイプクエリ

```typescript
// src/application/queries/archetype-query.ts
export const ArchetypeQuery = {
  // 位置・物理コンポーネントを持つエンティティ
  movingEntities: createQuery([PositionComponent, VelocityComponent]),
  
  // 描画対象エンティティ
  renderableEntities: createQuery([PositionComponent, MeshComponent]),
  
  // プレイヤーエンティティ
  players: createQuery([PlayerComponent, PositionComponent]),
  
  // 物理演算対象
  physicsEntities: createQuery([PositionComponent, RigidBodyComponent])
}
```

### 定義済みクエリ

```typescript
// src/application/queries/predefined-queries.ts
export const PredefinedQueries = {
  // プレイヤー近くのエンティティ
  getNearbyEntities: (playerPos: Position, radius: number) =>
    createUnifiedQuery({
      components: [PositionComponent],
      filters: [withinRadius(playerPos, radius)]
    }),
  
  // 描画対象チャンク
  getVisibleChunks: (camera: CameraState) =>
    createUnifiedQuery({
      components: [ChunkComponent],
      filters: [withinFrustum(camera.frustum)]
    }),
  
  // 更新が必要なエンティティ
  getDirtyEntities: () =>
    createUnifiedQuery({
      components: [DirtyComponent],
      sortBy: { field: 'priority', order: 'desc' }
    })
}
```

## 4. Command Pattern（コマンドパターン）

操作の実行・元に戻す・やり直し機能を実装。

### ブロック操作コマンド

```typescript
// src/application/commands/block-interaction.ts

// コマンドをtagged unionとして定義
type BlockCommand =
  | { readonly _tag: "PlaceBlock"; readonly position: Position; readonly blockType: BlockType; readonly replacedBlock?: Block }
  | { readonly _tag: "RemoveBlock"; readonly position: Position; readonly originalBlock: Block }
  | { readonly _tag: "ReplaceBlock"; readonly position: Position; readonly newBlockType: BlockType; readonly originalBlock: Block }

// コマンド実行関数
const executeBlockCommand = (command: BlockCommand): Effect.Effect<BlockCommand, CommandError> =>
  Match.value(command).pipe(
    Match.tag("PlaceBlock", ({ position, blockType }) =>
      Effect.gen(function* () {
        // 現在のブロック保存（undo用）
        const replacedBlock = yield* getBlock(position)

        // ブロック配置
        yield* placeBlock(position, blockType)

        // メッシュ更新
        yield* updateChunkMesh(getChunkCoordinate(position))

        // undo情報を含むコマンドを返す
        return { _tag: "PlaceBlock" as const, position, blockType, replacedBlock }
      })
    ),
    Match.tag("RemoveBlock", ({ position, originalBlock }) =>
      Effect.gen(function* () {
        yield* removeBlock(position)
        yield* updateChunkMesh(getChunkCoordinate(position))
        return command
      })
    ),
    Match.tag("ReplaceBlock", ({ position, newBlockType, originalBlock }) =>
      Effect.gen(function* () {
        yield* placeBlock(position, newBlockType)
        yield* updateChunkMesh(getChunkCoordinate(position))
        return command
      })
    ),
    Match.exhaustive
  )

// undo実行関数
const undoBlockCommand = (command: BlockCommand): Effect.Effect<void, CommandError> =>
  Match.value(command).pipe(
    Match.tag("PlaceBlock", ({ position, replacedBlock }) =>
      Effect.gen(function* () {
        if (!replacedBlock) {
          return yield* Effect.fail(new UndoError("No block to restore"))
        }

        // 元のブロック復元
        yield* placeBlock(position, replacedBlock.type)
        yield* updateChunkMesh(getChunkCoordinate(position))
      })
    ),
    Match.tag("RemoveBlock", ({ position, originalBlock }) =>
      Effect.gen(function* () {
        // 削除したブロックを復元
        yield* placeBlock(position, originalBlock.type)
        yield* updateChunkMesh(getChunkCoordinate(position))
      })
    ),
    Match.tag("ReplaceBlock", ({ position, originalBlock }) =>
      Effect.gen(function* () {
        // 元のブロックに戻す
        yield* placeBlock(position, originalBlock.type)
        yield* updateChunkMesh(getChunkCoordinate(position))
      })
    ),
    Match.exhaustive
  )

// コマンド実行可能性チェック
const canExecuteBlockCommand = (command: BlockCommand): Effect.Effect<boolean, never> =>
  Match.value(command).pipe(
    Match.tag("PlaceBlock", ({ position, blockType }) =>
      Effect.gen(function* () {
        const isValid = yield* validateBlockPosition(position)
        const hasPermission = yield* checkBlockPlacePermission(position)
        return isValid && hasPermission
      })
    ),
    Match.tag("RemoveBlock", ({ position }) =>
      Effect.gen(function* () {
        const blockExists = yield* blockExistsAt(position)
        const hasPermission = yield* checkBlockRemovePermission(position)
        return blockExists && hasPermission
      })
    ),
    Match.tag("ReplaceBlock", ({ position, newBlockType }) =>
      Effect.gen(function* () {
        const isValid = yield* validateBlockPosition(position)
        const hasPermission = yield* checkBlockReplacePermission(position)
        return isValid && hasPermission
      })
    ),
    Match.exhaustive
  )
```

### プレイヤー移動コマンド

```typescript
// src/application/commands/player-movement.ts

// プレイヤー移動コマンドをtagged unionとして定義
type PlayerMovementCommand =
  | { readonly _tag: "MovePlayer"; readonly playerId: EntityId; readonly fromPosition: Position; readonly toPosition: Position }
  | { readonly _tag: "TeleportPlayer"; readonly playerId: EntityId; readonly fromPosition: Position; readonly toPosition: Position }
  | { readonly _tag: "RotatePlayer"; readonly playerId: EntityId; readonly fromRotation: Rotation; readonly toRotation: Rotation }

// プレイヤー移動コマンド実行関数
const executePlayerMovementCommand = (command: PlayerMovementCommand): Effect.Effect<PlayerMovementCommand, CommandError> =>
  Match.value(command).pipe(
    Match.tag("MovePlayer", ({ playerId, fromPosition, toPosition }) =>
      Effect.gen(function* () {
        // プレイヤー位置更新
        yield* setPlayerPosition(playerId, toPosition)

        // チャンク更新
        yield* updatePlayerChunk(playerId, toPosition)

        // 物理演算更新
        yield* updatePlayerPhysics(playerId, toPosition)

        return command
      })
    ),
    Match.tag("TeleportPlayer", ({ playerId, fromPosition, toPosition }) =>
      Effect.gen(function* () {
        // 瞬間移動（物理演算なし）
        yield* setPlayerPosition(playerId, toPosition)
        yield* updatePlayerChunk(playerId, toPosition)

        // テレポートエフェクト
        yield* playTeleportEffect(playerId, fromPosition, toPosition)

        return command
      })
    ),
    Match.tag("RotatePlayer", ({ playerId, fromRotation, toRotation }) =>
      Effect.gen(function* () {
        // プレイヤー回転更新
        yield* setPlayerRotation(playerId, toRotation)

        // カメラ更新
        yield* updatePlayerCamera(playerId, toRotation)

        return command
      })
    ),
    Match.exhaustive
  )

// プレイヤー移動コマンドのundo関数
const undoPlayerMovementCommand = (command: PlayerMovementCommand): Effect.Effect<void, CommandError> =>
  Match.value(command).pipe(
    Match.tag("MovePlayer", ({ playerId, fromPosition }) =>
      Effect.gen(function* () {
        yield* setPlayerPosition(playerId, fromPosition)
        yield* updatePlayerChunk(playerId, fromPosition)
        yield* updatePlayerPhysics(playerId, fromPosition)
      })
    ),
    Match.tag("TeleportPlayer", ({ playerId, fromPosition }) =>
      Effect.gen(function* () {
        yield* setPlayerPosition(playerId, fromPosition)
        yield* updatePlayerChunk(playerId, fromPosition)
        yield* playTeleportEffect(playerId, fromPosition, fromPosition)
      })
    ),
    Match.tag("RotatePlayer", ({ playerId, fromRotation }) =>
      Effect.gen(function* () {
        yield* setPlayerRotation(playerId, fromRotation)
        yield* updatePlayerCamera(playerId, fromRotation)
      })
    ),
    Match.exhaustive
  )

// プレイヤー移動コマンド実行可能性チェック
const canExecutePlayerMovementCommand = (command: PlayerMovementCommand): Effect.Effect<boolean, never> =>
  Match.value(command).pipe(
    Match.tag("MovePlayer", ({ playerId, toPosition }) =>
      Effect.gen(function* () {
        const playerExists = yield* playerExistsById(playerId)
        const positionValid = yield* validatePlayerPosition(toPosition)
        const chunkLoaded = yield* isChunkLoadedAt(toPosition)
        return playerExists && positionValid && chunkLoaded
      })
    ),
    Match.tag("TeleportPlayer", ({ playerId, toPosition }) =>
      Effect.gen(function* () {
        const playerExists = yield* playerExistsById(playerId)
        const positionValid = yield* validatePlayerPosition(toPosition)
        const hasPermission = yield* checkTeleportPermission(playerId)
        return playerExists && positionValid && hasPermission
      })
    ),
    Match.tag("RotatePlayer", ({ playerId, toRotation }) =>
      Effect.gen(function* () {
        const playerExists = yield* playerExistsById(playerId)
        const rotationValid = yield* validatePlayerRotation(toRotation)
        return playerExists && rotationValid
      })
    ),
    Match.exhaustive
  )
```

## 5. Handlers（ハンドラー）

コマンド・クエリの実行を仲介するハンドラー群。

### コマンドハンドラー

```typescript
// src/application/handlers/command.handler.ts
export const CommandHandler = {
  execute: <T>(command: Command<T>) =>
    Effect.gen(function* () {
      // 前処理（認証・バリデーション）
      yield* validateCommand(command)
      
      // 実行
      const result = yield* command.execute()
      
      // 後処理（ログ・通知）
      yield* logCommandExecution(command, result)
      yield* notifyCommandComplete(command, result)
      
      return result
    }),
    
  undo: (command: Command) =>
    Effect.gen(function* () {
      yield* validateUndo(command)
      const result = yield* command.undo()
      yield* logCommandUndo(command)
      return result
    })
}
```

### クエリハンドラー

```typescript
// src/application/handlers/query.handler.ts
export const QueryHandler = {
  execute: <T>(query: Query<T>) =>
    Effect.gen(function* () {
      // キャッシュ確認
      const cached = yield* getCachedResult(query)
      
      if (cached) {
        return cached
      }
      
      // クエリ実行
      const result = yield* query.execute()
      
      // キャッシュ保存
      yield* cacheResult(query, result)
      
      return result
    })
}
```

## 6. Dependency Injection（依存性注入）

Effect-TSのLayer・Contextによる依存性管理。

### DIコンテナ設定

```typescript
// src/application/di/container.ts
export const ApplicationLayer = Layer.mergeAll(
  // ユースケース層
  WorldGenerateUseCaseLive,
  PlayerMoveUseCaseLive,
  BlockPlaceUseCaseLive,
  ChunkLoadUseCaseLive,
  
  // ワークフロー層
  ChunkLoadingWorkflowLive,
  WorldUpdateWorkflowLive,
  SystemSchedulerLive,
  
  // ハンドラー層
  CommandHandlerLive,
  QueryHandlerLive,
  
  // クエリシステム層
  UnifiedQuerySystemLive
)
```

### サービス定義

```typescript  
// src/application/di/di-types.ts
export interface ApplicationServices {
  worldGenerate: WorldGenerateUseCaseService
  playerMove: PlayerMoveUseCaseService
  blockPlace: BlockPlaceUseCaseService
  chunkLoad: ChunkLoadUseCaseService
  queryHandler: QueryHandlerService
  commandHandler: CommandHandlerService
}

export const ApplicationServices = Context.GenericTag<ApplicationServices>()
```

## 7. 特徴的な実装パターン

### Effect-TSによる副作用管理
- すべての操作をEffect型で実装
- エラーハンドリングの型安全性
- 関数合成による複雑なワークフロー構築

### CQRSパターン
- コマンドとクエリの責任分離
- 読み書き処理の最適化
- スケーラビリティの向上

### 高性能クエリシステム
- アーキタイプベースの効率的検索
- キャッシュ機構による高速化
- バッチ処理による最適化

### ワークフロー管理
- 複数のユースケースの協調実行
- スケジューリングによる負荷分散
- 非同期処理の適切な制御

Application層は、Domain層のビジネスロジックを活用して具体的なユースケースを実現し、システム全体の振る舞いを制御する重要な層です。