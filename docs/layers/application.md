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
export interface WorldGenerateCommand {
  readonly seed: number
  readonly worldType: 'flat' | 'normal' | 'amplified' | 'debug'
  readonly generateStructures: boolean
  readonly worldSize?: 'small' | 'medium' | 'large' | 'infinite'
  readonly biomes?: string[]
}

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

export const WorldGenerateUseCase = Context.GenericTag<WorldGenerateUseCaseService>('WorldGenerateUseCase')

export const WorldGenerateUseCaseLive = Layer.effect(
  WorldGenerateUseCase,
  Effect.gen(function* () {
    const worldService = yield* WorldDomainService
    const terrainService = yield* TerrainGenerationDomainService

    return WorldGenerateUseCase.of({
      execute: (command) => Effect.gen(function* () {
        // コマンド検証
        const validated = yield* validateWorldGenerateCommand(command)

        // 基本地形生成
        const terrain = yield* terrainService.generateTerrain(validated.seed)

        // ワールド初期化
        yield* worldService.initializeWorld(terrain)
      }),

      generateBiome: (chunkX, chunkZ, biomeType) => Effect.gen(function* () {
        // バイオーム生成ロジック
        yield* terrainService.generateBiome(chunkX, chunkZ, biomeType)
      })
    })
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
export interface PlayerMovementCommand {
  readonly entityId: string
  readonly direction: { x: number; y: number; z: number }
  readonly deltaTime: number
  readonly sprint: boolean
  readonly sneak: boolean
}

export interface PlayerMoveUseCaseService {
  readonly execute: (command: PlayerMovementCommand) => Effect.Effect<
    void,
    ValidationError | EntityNotFoundError | InvalidPositionError |
    ChunkNotLoadedError | PhysicsSimulationError | CollisionDetectionError,
    never
  >
}

export const PlayerMoveUseCase = Context.GenericTag<PlayerMoveUseCaseService>('PlayerMoveUseCase')

export const PlayerMoveUseCaseLive = Layer.effect(
  PlayerMoveUseCase,
  Effect.gen(function* () {
    const entityService = yield* EntityDomainService
    const physicsService = yield* PhysicsDomainService
    const worldService = yield* WorldDomainService

    return PlayerMoveUseCase.of({
      execute: (command) => Effect.gen(function* () {
        // エンティティ取得
        const entity = yield* entityService.getEntity(EntityId.make(command.entityId))

        // 速度計算
        const velocity = yield* physicsService.calculateVelocity(
          entity,
          command.direction,
          command.deltaTime,
          { sprint: command.sprint, sneak: command.sneak }
        )

        // 衝突検出
        const collision = yield* physicsService.detectCollision(
          entity.position,
          velocity
        )

        // 位置更新
        if (!collision) {
          yield* entityService.updatePosition(entity.id, velocity)
        }

        // チャンク境界チェック
        yield* worldService.checkChunkBoundary(entity.position)
      })
    })
  })
)
```

**機能:**
- 入力に基づく移動計算
- 物理演算（重力、摩擦）
- 衝突検出・応答
- チャンク境界での動的読み込み

### ブロック配置ユースケース

```typescript
// src/application/use-cases/block-place.usecase.ts
export interface BlockInteractionCommand {
  readonly playerId: string
  readonly position: { x: number; y: number; z: number }
  readonly action: 'place' | 'break'
  readonly blockType?: number
  readonly face?: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west'
}

export interface BlockPlaceUseCaseService {
  readonly execute: (command: BlockInteractionCommand) => Effect.Effect<
    void,
    ValidationError | InvalidPositionError | EntityNotFoundError |
    WorldStateError | RaycastError,
    never
  >
}

export const BlockPlaceUseCase = Context.GenericTag<BlockPlaceUseCaseService>('BlockPlaceUseCase')

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
export interface BlockCommand {
  execute(): Effect.Effect<void, CommandError>
  undo(): Effect.Effect<void, CommandError>
  canExecute(): Effect.Effect<boolean>
}

export class PlaceBlockCommand implements BlockCommand {
  constructor(
    private position: Position,
    private blockType: BlockType,
    private replacedBlock?: Block
  ) {}
  
  execute = () => Effect.gen(function* () {
    // 現在のブロック保存（undo用）
    this.replacedBlock = yield* getBlock(this.position)
    
    // ブロック配置
    yield* placeBlock(this.position, this.blockType)
    
    // メッシュ更新
    yield* updateChunkMesh(getChunkCoordinate(this.position))
  })
  
  undo = () => Effect.gen(function* () {
    if (!this.replacedBlock) {
      return yield* Effect.fail(new UndoError("No block to restore"))
    }
    
    // 元のブロック復元
    yield* placeBlock(this.position, this.replacedBlock.type)
    yield* updateChunkMesh(getChunkCoordinate(this.position))
  })
}
```

### プレイヤー移動コマンド

```typescript  
// src/application/commands/player-movement.ts
export class MovePlayerCommand implements BlockCommand {
  constructor(
    private playerId: EntityId,
    private fromPosition: Position,
    private toPosition: Position
  ) {}
  
  execute = () => Effect.gen(function* () {
    yield* setPlayerPosition(this.playerId, this.toPosition)
    yield* updatePlayerChunk(this.playerId, this.toPosition)
  })
  
  undo = () => Effect.gen(function* () {
    yield* setPlayerPosition(this.playerId, this.fromPosition)
    yield* updatePlayerChunk(this.playerId, this.fromPosition)
  })
}
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