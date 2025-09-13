# Effect-TS 使用パターン

TypeScript Minecraftプロジェクトでは、**Effect-TS** を中心とした関数型プログラミングパラダイムを採用し、型安全で合成可能なプログラムの構築を実現しています。このドキュメントでは、プロジェクトで使用されているEffect-TSの主要パターンと実装手法について詳説します。

## Effect-TS の基本概念

### Effect型の基本構造

```typescript
// Effect<Success, Error, Requirements>
type Effect<A, E = never, R = never> = ...

// 成功値: A, エラー型: E, 依存性: R
const simpleEffect: Effect<string, Error, never> = Effect.succeed("Hello")
const failingEffect: Effect<never, CustomError, never> = Effect.fail(new CustomError())
const dependentEffect: Effect<string, Error, ServiceA> = Effect.gen(function* () {
  const service = yield* ServiceA
  return service.getValue()
})
```

### 基本的なEffect操作パターン

```typescript
// 1. 基本的な値の生成
const successEffect = Effect.succeed(42)
const failureEffect = Effect.fail(new Error("Something went wrong"))
const asyncEffect = Effect.promise(() => fetch('/api/data'))

// 2. Effect.gen を使った合成
const complexOperation = Effect.gen(function* () {
  const value1 = yield* getFirstValue()
  const value2 = yield* getSecondValue(value1)
  const result = yield* processValues(value1, value2)
  return result
})

// 3. エラーハンドリング
const safeOperation = complexOperation.pipe(
  Effect.catchTag('NetworkError', (error) => 
    Effect.logWarning(`Network failed: ${error.message}`).pipe(
      Effect.andThen(Effect.succeed(defaultValue))
    )
  ),
  Effect.catchTag('ValidationError', (error) =>
    Effect.fail(new UserInputError({ cause: error }))
  ),
  Effect.catchAll((error) =>
    Effect.logError(`Unexpected error: ${error}`).pipe(
      Effect.andThen(Effect.fail(new SystemError({ cause: error })))
    )
  )
)
```

## サービス定義パターン

### Context.Tag を使用したサービス定義

```typescript
// 1. サービスインターフェースの定義（Schemaベース）

// ドメイン型の定義
const EntityId = Schema.String.pipe(Schema.brand("EntityId"))
type EntityId = Schema.Schema.Type<typeof EntityId>

const WorldState = Schema.Struct({
  _tag: Schema.Literal("WorldState"),
  timestamp: Schema.Number.pipe(Schema.positive()),
  entities: Schema.Record({ key: EntityId, value: Schema.Unknown }),
  chunks: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})
type WorldState = Schema.Schema.Type<typeof WorldState>

const EntityData = Schema.Struct({
  type: Schema.Union(
    Schema.Literal("player"),
    Schema.Literal("npc"),
    Schema.Literal("item"),
    Schema.Literal("block")
  ),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  active: Schema.Boolean
})
type EntityData = Schema.Schema.Type<typeof EntityData>

const ChunkCoordinate = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int())
})
type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinate>

// サービスインターフェース
export interface WorldDomainService {
  readonly validateWorldState: (state: WorldState) => Effect.Effect<boolean, WorldStateError, never>
  readonly addEntityToWorld: (
    entityId: EntityId,
    entityData: EntityData
  ) => Effect.Effect<void, WorldStateError, never>
  readonly removeEntityFromWorld: (entityId: EntityId) => Effect.Effect<void, WorldStateError, never>
  readonly addChunkToWorld: (chunk: unknown) => Effect.Effect<void, WorldStateError, never>
  readonly calculateChunkKey: (coordinate: ChunkCoordinate) => Effect.Effect<string, InvalidPositionError, never>
  readonly validateChunkCoordinate: (
    coordinate: ChunkCoordinate
  ) => Effect.Effect<boolean, InvalidPositionError, never>
}

// 2. 新しい Context.Tag 記法でのサービスタグ作成
export const WorldDomainService = Context.GenericTag<WorldDomainService>("@app/WorldDomainService")

// エラー型の定義
const WorldStateError = Schema.Struct({
  _tag: Schema.Literal("WorldStateError"),
  operation: Schema.String,
  reason: Schema.String,
  stateVersion: Schema.optional(Schema.Number)
})
type WorldStateError = Schema.Schema.Type<typeof WorldStateError>

const InvalidPositionError = Schema.Struct({
  _tag: Schema.Literal("InvalidPositionError"),
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  reason: Schema.String,
  validBounds: Schema.optional(Schema.Struct({
    min: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    max: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })
  }))
})
type InvalidPositionError = Schema.Schema.Type<typeof InvalidPositionError>

// 3. サービス実装レイヤー（Schemaベースバリデーション）
export const WorldDomainServiceLive = Layer.effect(
  WorldDomainService,
  Effect.gen(function* () {
    // バリデーションユーティリティを取得

    return {
      validateWorldState: (state) =>
        Effect.gen(function* () {
          // Schemaベースのバリデーション
          const validatedState = yield* Schema.decodeUnknown(WorldState)(state).pipe(
            Effect.mapError(() => ({
              _tag: "WorldStateError" as const,
              operation: "validateWorldState",
              reason: "Invalid world state schema",
              stateVersion: typeof state === 'object' && state && 'timestamp' in state ? state.timestamp : undefined
            }))
          )

          // 早期リターン: タイムスタンプ検証
          if (validatedState.timestamp <= 0) {
            return yield* Effect.fail({
              _tag: "WorldStateError" as const,
              operation: "validateWorldState",
              reason: "Timestamp must be positive",
              stateVersion: validatedState.timestamp
            })
          }

          return true
        }),

      addEntityToWorld: (entityId, entityData) =>
        Effect.gen(function* () {
          // 早期リターン: EntityID 検証
          if (!entityId || entityId.length === 0) {
            return yield* Effect.fail({
              _tag: "WorldStateError" as const,
              operation: "addEntityToWorld",
              reason: "Invalid or empty entity ID provided"
            })
          }

          // Schemaベースのバリデーション
          const validatedEntityData = yield* Schema.decodeUnknown(EntityData)(entityData).pipe(
            Effect.mapError(() => ({
              _tag: "WorldStateError" as const,
              operation: "addEntityToWorld",
              reason: "Entity data schema validation failed"
            }))
          )

          // ビジネスルール検証
          const isValidPosition = validateEntityPosition(validatedEntityData.position)
          if (!isValidPosition) {
            return yield* Effect.fail({
              _tag: "WorldStateError" as const,
              operation: "addEntityToWorld",
              reason: "Entity position is outside valid world bounds"
            })
          }

          yield* Effect.logInfo(`Entity ${entityId} added to world at position ${JSON.stringify(validatedEntityData.position)}`)
          return yield* Effect.succeed(undefined)
        }),

      removeEntityFromWorld: (entityId) =>
        Effect.gen(function* () {
          if (!entityId || entityId.length === 0) {
            return yield* Effect.fail({
              _tag: "WorldStateError" as const,
              operation: "removeEntityFromWorld",
              reason: "Invalid entity ID"
            })
          }

          yield* Effect.logInfo(`Entity ${entityId} removed from world`)
          return yield* Effect.succeed(undefined)
        }),

      addChunkToWorld: (chunk) =>
        Effect.gen(function* () {
          // チャンクデータのバリデーション（簡単な例）
          if (!chunk || typeof chunk !== 'object') {
            return yield* Effect.fail({
              _tag: "WorldStateError" as const,
              operation: "addChunkToWorld",
              reason: "Invalid chunk data provided"
            })
          }

          return yield* Effect.succeed(undefined)
        }),

      calculateChunkKey: (coordinate) =>
        Effect.gen(function* () {
          const validated = yield* Schema.decodeUnknown(ChunkCoordinate)(coordinate).pipe(
            Effect.mapError(() => ({
              _tag: "InvalidPositionError" as const,
              position: { x: 0, y: 0, z: 0 },
              reason: "Invalid chunk coordinate format"
            }))
          )

          return `${validated.x},${validated.z}`
        }),

      validateChunkCoordinate: (coordinate) =>
        Effect.gen(function* () {
          // 早期リターン: 基本型検証
          if (!Number.isInteger(coordinate.x) || !Number.isInteger(coordinate.z)) {
            return yield* Effect.fail({
              _tag: "InvalidPositionError" as const,
              position: { x: coordinate.x, y: 0, z: coordinate.z },
              reason: "Chunk coordinates must be integers",
              validBounds: {
                min: { x: -30000000, y: 0, z: -30000000 },
                max: { x: 30000000, y: 0, z: 30000000 }
              }
            })
          }

          // 早期リターン: 範囲検証
          const maxBound = 30000000
          if (Math.abs(coordinate.x) >= maxBound || Math.abs(coordinate.z) >= maxBound) {
            return yield* Effect.fail({
              _tag: "InvalidPositionError" as const,
              position: { x: coordinate.x, y: 0, z: coordinate.z },
              reason: "Chunk coordinate out of valid world bounds",
              validBounds: {
                min: { x: -maxBound, y: 0, z: -maxBound },
                max: { x: maxBound, y: 0, z: maxBound }
              }
            })
          }

          return true
        })
    }
  })
)

// 補助関数（単一責務）
const validateEntityPosition = (position: { x: number; y: number; z: number }): boolean => {
  const bounds = { min: -1000, max: 1000 }
  return (
    position.x >= bounds.min && position.x <= bounds.max &&
    position.y >= bounds.min && position.y <= bounds.max &&
    position.z >= bounds.min && position.z <= bounds.max
  )
}
```

### 依存性注入パターン

```typescript
// 複数のサービスに依存するサービスの実装
export const PlayerDomainServiceLive = Layer.effect(
  PlayerDomainService,
  Effect.gen(function* () {
    const worldService = yield* WorldDomainService
    const physicsService = yield* PhysicsService
    const validationService = yield* ValidationService
    
    return PlayerDomainService.of({
      movePlayer: (playerId, direction, speed) =>
        Effect.gen(function* () {
          // 複数サービスの組み合わせ
          const currentPosition = yield* worldService.getPlayerPosition(playerId)
          const newPosition = yield* physicsService.calculateMovement(currentPosition, direction, speed)
          const isValid = yield* validationService.validatePosition(newPosition)
          
          if (isValid) {
            yield* worldService.updatePlayerPosition(playerId, newPosition)
            yield* Effect.logInfo(`Player ${playerId} moved to ${JSON.stringify(newPosition)}`)
          } else {
            yield* Effect.logWarning(`Invalid movement attempted for player ${playerId}`)
          }
        }),

      damagePlayer: (playerId, damage) =>
        Effect.gen(function* () {
          // 早期リターン: ダメージ量検証
          if (damage.amount < 0) {
            return yield* Effect.fail({
              _tag: "PlayerDamageError" as const,
              playerId,
              reason: "Damage amount cannot be negative"
            })
          }

          const currentHealth = yield* getPlayerHealth(playerId).pipe(
            Effect.catchTag("PlayerNotFoundError", () =>
              Effect.fail({
                _tag: "PlayerDamageError" as const,
                playerId,
                reason: "Player not found"
              })
            )
          )

          const newHealth = Math.max(0, currentHealth - damage.amount)

          yield* updatePlayerHealth(playerId, newHealth)

          if (newHealth <= 0) {
            yield* killPlayer(playerId)
            yield* Effect.logInfo(`Player ${playerId} has died from ${damage.amount} damage`)
          } else {
            yield* Effect.logInfo(`Player ${playerId} took ${damage.amount} damage, health: ${newHealth}`)
          }
        }),

      getPlayerHealth: (playerId) =>
        getPlayerHealth(playerId)
    }
  })
)

// 補助関数（単一責務）
const getPlayerPosition = (playerId: PlayerId): Effect.Effect<{ x: number, y: number, z: number }, PlayerNotFoundError, never> =>
  // モック実装
  Effect.succeed({ x: 0, y: 0, z: 0 })

const updatePlayerPosition = (playerId: PlayerId, position: { x: number, y: number, z: number }): Effect.Effect<void, never, never> =>
  Effect.logInfo(`Updated position for player ${playerId}`)

const getPlayerHealth = (playerId: PlayerId): Effect.Effect<number, PlayerNotFoundError, never> =>
  // モック実装
  Effect.succeed(100)

const updatePlayerHealth = (playerId: PlayerId, health: number): Effect.Effect<void, never, never> =>
  Effect.logInfo(`Updated health for player ${playerId}: ${health}`)

const killPlayer = (playerId: PlayerId): Effect.Effect<void, never, never> =>
  Effect.logInfo(`Player ${playerId} has been killed`)
```

## レイヤーシステム

### レイヤー構成と合成

```typescript
// src/layers.ts

// モックサービスの定義
const PhysicsServiceLive = Layer.succeed(
  PhysicsService,
  {
    calculateMovement: (position, direction, speed) =>
      Effect.succeed({
        x: position.x + direction.x * speed,
        y: position.y + direction.y * speed,
        z: position.z + direction.z * speed
      })
  }
)

const ValidationServiceLive = Layer.succeed(
  ValidationService,
  {
    validatePosition: (position) =>
      Effect.succeed(
        Math.abs(position.x) < 1000 &&
        Math.abs(position.y) < 1000 &&
        Math.abs(position.z) < 1000
      )
  }
)

// 基本レイヤーの定義（依存関係を明確化）
export const DomainLayer = Layer.mergeAll(
  WorldDomainServiceLive,
  PhysicsServiceLive,
  ValidationServiceLive
).pipe(
  Layer.provide(PlayerDomainServiceLive)
)

// インフラサービスのインターフェース定義
interface ThreeJsAdapter {
  readonly createScene: () => Effect.Effect<unknown, never, never>
}
const ThreeJsAdapter = Context.GenericTag<ThreeJsAdapter>("@app/ThreeJsAdapter")

interface WebGLRenderer {
  readonly render: (scene: unknown) => Effect.Effect<void, never, never>
}
const WebGLRenderer = Context.GenericTag<WebGLRenderer>("@app/WebGLRenderer")

interface ChunkRepository {
  readonly saveChunk: (chunkKey: string, data: unknown) => Effect.Effect<void, never, never>
  readonly loadChunk: (chunkKey: string) => Effect.Effect<unknown, never, never>
}
const ChunkRepository = Context.GenericTag<ChunkRepository>("@app/ChunkRepository")

// モックインフラサービス
const ThreeJsAdapterLive = Layer.succeed(ThreeJsAdapter, {
  createScene: () => Effect.succeed({})
})

const WebGLRendererLive = Layer.succeed(WebGLRenderer, {
  render: (scene) => Effect.logInfo("Rendering scene")
})

const ChunkRepositoryLive = Layer.succeed(ChunkRepository, {
  saveChunk: (key, data) => Effect.logInfo(`Saving chunk: ${key}`),
  loadChunk: (key) => Effect.succeed({})
})

export const InfrastructureLayer = Layer.mergeAll(
  ThreeJsAdapterLive,
  WebGLRendererLive,
  ChunkRepositoryLive
)

// アプリケーションサービスのインターフェース
interface PlayerMoveUseCase {
  readonly execute: (playerId: PlayerId, direction: Direction, speed: number) => Effect.Effect<void, PlayerMovementError, never>
}
const PlayerMoveUseCase = Context.GenericTag<PlayerMoveUseCase>("@app/PlayerMoveUseCase")

interface ChunkLoadUseCase {
  readonly execute: (coordinate: ChunkCoordinate) => Effect.Effect<unknown, never, never>
}
const ChunkLoadUseCase = Context.GenericTag<ChunkLoadUseCase>("@app/ChunkLoadUseCase")

// モックアプリケーションサービス
const PlayerMoveUseCaseLive = Layer.effect(
  PlayerMoveUseCase,
  Effect.gen(function* () {
    const playerService = yield* PlayerDomainService
    return {
      execute: (playerId, direction, speed) =>
        playerService.movePlayer(playerId, direction, speed)
    }
  })
)

const ChunkLoadUseCaseLive = Layer.succeed(ChunkLoadUseCase, {
  execute: (coordinate) => Effect.logInfo(`Loading chunk at ${JSON.stringify(coordinate)}`)
})

export const ApplicationLayer = Layer.mergeAll(
  PlayerMoveUseCaseLive,
  ChunkLoadUseCaseLive
)

// 環境別レイヤー構成（型安全な早期リターン）
type Environment = "development" | "production" | "test"

const EnvironmentSchema = Schema.Union(
  Schema.Literal("development"),
  Schema.Literal("production"),
  Schema.Literal("test")
)

export const createEnvironmentLayer = (
  environment: Environment
): Layer.Layer<never, never, never> => {
  // 早期リターン: 環境値検証
  const validatedEnv = Schema.decodeUnknownSync(EnvironmentSchema)(environment)

  const coreLayer = Layer.mergeAll(DomainLayer, InfrastructureLayer, ApplicationLayer)

  switch (validatedEnv) {
    case "development":
      return Layer.mergeAll(
        coreLayer,
        createDebugLayer()
      )

    case "production":
      return Layer.mergeAll(
        coreLayer,
        createProductionLayer()
      )

    case "test":
      return createTestLayer()

    default:
      // TypeScriptの exhaustive check により、ここには到達しない
      const _exhaustive: never = validatedEnv
      return coreLayer
  }
}

// 環境別レイヤーファクトリー
const createDebugLayer = () => Layer.succeed(
  Context.GenericTag<{ debug: true }>("@app/Debug"),
  { debug: true as const }
)

const createProductionLayer = () => Layer.succeed(
  Context.GenericTag<{ optimized: true }>("@app/Production"),
  { optimized: true as const }
)

const createTestLayer = () => Layer.succeed(
  Context.GenericTag<{ test: true }>("@app/Test"),
  { test: true as const }
)

// レイヤーエラー型定義
const LayerCompositionError = Schema.Struct({
  _tag: Schema.Literal("LayerCompositionError"),
  message: Schema.String,
  timestamp: Schema.Number,
  cause: Schema.Unknown,
  layerName: Schema.String,
  stage: Schema.String
})
type LayerCompositionError = Schema.Schema.Type<typeof LayerCompositionError>

// Effectベースの安全なレイヤー取得
export const safeGetAppLayer = (
  environment: Environment = "development"
): Effect.Effect<Layer.Layer<never, never, never>, LayerCompositionError, never> =>
  Effect.gen(function* () {
    try {
      const layer = createEnvironmentLayer(environment)
      yield* Effect.logInfo(`Successfully created layer for environment: ${environment}`)
      return layer
    } catch (error) {
      return yield* Effect.fail({
        _tag: "LayerCompositionError" as const,
        message: `Failed to get app layer for environment: ${environment}`,
        timestamp: Date.now(),
        cause: error,
        layerName: "AppLayer",
        stage: "environment_selection"
      })
    }
  })

// 型安全なレイヤー合成
export const safeMergeAll = <R1, E1, A1, R2, E2, A2>(
  layer1: Layer.Layer<A1, E1, R1>,
  layer2: Layer.Layer<A2, E2, R2>
): Effect.Effect<Layer.Layer<A1 | A2, E1 | E2, R1 | R2>, LayerCompositionError, never> =>
  Effect.gen(function* () {
    try {
      const mergedLayer = Layer.mergeAll(layer1, layer2)
      yield* Effect.logInfo("Successfully merged layers")
      return mergedLayer
    } catch (error) {
      return yield* Effect.fail({
        _tag: "LayerCompositionError" as const,
        message: "Failed to merge layers safely",
        timestamp: Date.now(),
        cause: error,
        layerName: "MergedLayers",
        stage: "layer_composition"
      })
    }
  })

// 可変長引数版
export const safeMergeMany = (
  ...layers: Layer.Layer<any, any, any>[]
): Effect.Effect<Layer.Layer<any, any, any>, LayerCompositionError, never> =>
  Effect.gen(function* () {
    // 早期リターン: 空配列チェック
    if (layers.length === 0) {
      return yield* Effect.fail({
        _tag: "LayerCompositionError" as const,
        message: "Cannot merge empty layer array",
        timestamp: Date.now(),
        cause: new Error("Empty layers array"),
        layerName: "EmptyLayers",
        stage: "validation"
      })
    }

    try {
      const mergedLayer = Layer.mergeAll(...layers)
      yield* Effect.logInfo(`Successfully merged ${layers.length} layers`)
      return mergedLayer
    } catch (error) {
      return yield* Effect.fail({
        _tag: "LayerCompositionError" as const,
        message: `Failed to merge ${layers.length} layers`,
        timestamp: Date.now(),
        cause: error,
        layerName: "MultiMergedLayers",
        stage: "layer_composition"
      })
    }
  })
```

### リソース管理パターン

```typescript
// スコープ付きリソース管理
export const createWebGLContextLive = Layer.scoped(
  WebGLContext,
  Effect.gen(function* () {
    const canvas = yield* Effect.sync(() => document.createElement('canvas'))
    const context = yield* Effect.sync(() => canvas.getContext('webgl2'))
    
    if (!context) {
      yield* Effect.fail(new WebGLNotSupportedError())
    }
    
    // リソースクリーンアップの登録
    yield* Effect.addFinalizer(() => 
      Effect.sync(() => {
        canvas.remove()
        console.log('WebGL context cleaned up')
      })
    )
    
    return WebGLContext.of({
      canvas,
      context: context!,
      createTexture: (data) => Effect.sync(() => {
        const texture = context!.createTexture()
        // テクスチャ作成処理
        return texture
      }),
      createShader: (source, type) => Effect.sync(() => {
        const shader = context!.createShader(type)
        // シェーダー作成処理
        return shader
      }),
    })
  })
)

// ファイルシステムリソース
export const createFileSystemLive = Layer.effect(
  FileSystemService,
  Effect.gen(function* () {
    return FileSystemService.of({
      readFile: (path) =>
        Effect.gen(function* () {
          const file = yield* Effect.promise(() => 
            fetch(path).then(res => res.text())
          )
          return file
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new FileReadError({ path, cause: error }))
          )
        ),
        
      writeFile: (path, content) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            // ブラウザ環境では localStorage などを使用
            Promise.resolve(localStorage.setItem(path, content))
          )
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new FileWriteError({ path, cause: error }))
          )
        ),
    })
  })
)
```

## エラーハンドリング戦略

### タグ付きエラーシステム

```typescript
// Schemaベースのエラー型定義（classの代わり）

// Position 型定義
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
type Position = Schema.Schema.Type<typeof Position>

// エラー型を Schema で定義
const WorldStateError = Schema.Struct({
  _tag: Schema.Literal("WorldStateError"),
  operation: Schema.String,
  reason: Schema.String,
  stateVersion: Schema.optional(Schema.Number),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
type WorldStateError = Schema.Schema.Type<typeof WorldStateError>

const InvalidPositionError = Schema.Struct({
  _tag: Schema.Literal("InvalidPositionError"),
  position: Position,
  reason: Schema.String,
  validBounds: Schema.optional(Schema.Struct({
    min: Position,
    max: Position
  })),
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
type InvalidPositionError = Schema.Schema.Type<typeof InvalidPositionError>

const ChunkLoadingState = Schema.Union(
  Schema.Literal("not-requested"),
  Schema.Literal("loading"),
  Schema.Literal("failed")
)
type ChunkLoadingState = Schema.Schema.Type<typeof ChunkLoadingState>

const ChunkNotLoadedError = Schema.Struct({
  _tag: Schema.Literal("ChunkNotLoadedError"),
  coordinates: ChunkCoordinate,
  requestedOperation: Schema.String,
  loadingState: ChunkLoadingState,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
type ChunkNotLoadedError = Schema.Schema.Type<typeof ChunkNotLoadedError>

// エラーファクトリー関数（単一責務）
export const createWorldStateError = (
  operation: string,
  reason: string,
  stateVersion?: number
): WorldStateError => ({
  _tag: "WorldStateError",
  operation,
  reason,
  stateVersion,
  timestamp: Date.now()
})

export const createInvalidPositionError = (
  position: Position,
  reason: string,
  validBounds?: { min: Position; max: Position }
): InvalidPositionError => ({
  _tag: "InvalidPositionError",
  position,
  reason,
  validBounds,
  timestamp: Date.now()
})

export const createChunkNotLoadedError = (
  coordinates: ChunkCoordinate,
  requestedOperation: string,
  loadingState: ChunkLoadingState
): ChunkNotLoadedError => ({
  _tag: "ChunkNotLoadedError",
  coordinates,
  requestedOperation,
  loadingState,
  timestamp: Date.now()
})

// 型安全なエラーハンドリングパターン

// 操作結果型
const OperationResult = Schema.Struct({
  worldState: WorldState,
  chunk: Schema.Unknown,
  entity: EntityData
})
type OperationResult = Schema.Schema.Type<typeof OperationResult>

const robustOperation = (
  coordinate: ChunkCoordinate,
  entityData: EntityData
): Effect.Effect<OperationResult, never, never> =>
  Effect.gen(function* () {
    const worldState = yield* getWorldState()
    const chunk = yield* loadChunk(coordinate)
    const entity = yield* createEntity(entityData)

    return { worldState, chunk, entity }
  }).pipe(
    // 特定エラーの処理（早期リターンパターン）
    Effect.catchTag("ChunkNotLoadedError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logWarning(`Chunk not loaded: ${JSON.stringify(error.coordinates)}`)

        // 早期リターン: ローディング状態チェック
        if (error.loadingState === "failed") {
          const defaultChunk = yield* createDefaultChunk(error.coordinates)
          return {
            worldState: yield* getDefaultWorldState(),
            chunk: defaultChunk,
            entity: yield* createDefaultEntity()
          }
        }

        const newChunk = yield* generateNewChunk(error.coordinates)
        return {
          worldState: yield* getWorldState(),
          chunk: newChunk,
          entity: yield* createDefaultEntity()
        }
      })
    ),

    // 位置エラーの処理
    Effect.catchTag("InvalidPositionError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Invalid position: ${JSON.stringify(error.position)}`)

        // 早期リターン: 境界情報がある場合のみ補正
        if (!error.validBounds) {
          return {
            worldState: yield* getDefaultWorldState(),
            chunk: yield* createDefaultChunk(coordinate),
            entity: yield* createDefaultEntity()
          }
        }

        const correctedPosition = yield* correctPosition(error.position, error.validBounds)
        const correctedEntity = { ...entityData, position: correctedPosition }

        return {
          worldState: yield* getWorldState(),
          chunk: yield* loadChunk(coordinate),
          entity: correctedEntity
        }
      })
    ),

    // ワールド状態エラーの処理
    Effect.catchTag("WorldStateError", (error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`World state error in ${error.operation}: ${error.reason}`)
        yield* sendErrorTelemetry(error)

        return {
          worldState: yield* getDefaultWorldState(),
          chunk: yield* createDefaultChunk(coordinate),
          entity: yield* createDefaultEntity()
        }
      })
    ),

    // その他のエラーの処理
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Unexpected error in robust operation: ${JSON.stringify(error)}`)
        yield* sendErrorTelemetry(error)

        return {
          worldState: yield* getDefaultWorldState(),
          chunk: yield* createDefaultChunk(coordinate),
          entity: yield* createDefaultEntity()
        }
      })
    )
  )

// 補助関数（単一責務）
const getWorldState = (): Effect.Effect<WorldState, WorldStateError, never> =>
  Effect.succeed({
    _tag: "WorldState",
    timestamp: Date.now(),
    entities: {},
    chunks: {}
  })

const getDefaultWorldState = (): Effect.Effect<WorldState, never, never> =>
  Effect.succeed({
    _tag: "WorldState",
    timestamp: Date.now(),
    entities: {},
    chunks: {}
  })

const loadChunk = (coordinate: ChunkCoordinate): Effect.Effect<unknown, ChunkNotLoadedError, never> =>
  Effect.fail(createChunkNotLoadedError(coordinate, "loadChunk", "not-requested"))

const createEntity = (entityData: EntityData): Effect.Effect<EntityData, never, never> =>
  Effect.succeed(entityData)

const generateNewChunk = (coordinate: ChunkCoordinate): Effect.Effect<unknown, never, never> =>
  Effect.succeed({ coordinate, blocks: [] })

const createDefaultChunk = (coordinate: ChunkCoordinate): Effect.Effect<unknown, never, never> =>
  Effect.succeed({ coordinate, blocks: [], generated: false })

const createDefaultEntity = (): Effect.Effect<EntityData, never, never> =>
  Effect.succeed({
    type: "item",
    position: { x: 0, y: 0, z: 0 },
    active: false
  })

const correctPosition = (
  position: Position,
  bounds: { min: Position; max: Position }
): Effect.Effect<Position, never, never> =>
  Effect.succeed({
    x: Math.max(bounds.min.x, Math.min(bounds.max.x, position.x)),
    y: Math.max(bounds.min.y, Math.min(bounds.max.y, position.y)),
    z: Math.max(bounds.min.z, Math.min(bounds.max.z, position.z))
  })

const sendErrorTelemetry = (error: unknown): Effect.Effect<void, never, never> =>
  Effect.logInfo(`Telemetry: ${JSON.stringify(error)}`)
```

### エラーの変換と再試行

```typescript
// ネットワークエラー・Systemエラー型定義
const NetworkError = Schema.Struct({
  _tag: Schema.Literal("NetworkError"),
  code: Schema.Number,
  message: Schema.String,
  retryable: Schema.Boolean,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
type NetworkError = Schema.Schema.Type<typeof NetworkError>

const SystemError = Schema.Struct({
  _tag: Schema.Literal("SystemError"),
  category: Schema.String,
  originalError: Schema.Unknown,
  userMessage: Schema.String,
  retryable: Schema.Boolean,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
type SystemError = Schema.Schema.Type<typeof SystemError>

// 型安全なエラー変換パターン
const convertNetworkError = <A, R>(
  effect: Effect.Effect<A, NetworkError, R>
): Effect.Effect<A, SystemError, R> =>
  effect.pipe(
    Effect.mapError((networkError): SystemError => ({
      _tag: "SystemError",
      category: "network",
      originalError: networkError,
      userMessage: "ネットワーク接続に問題があります",
      retryable: networkError.retryable,
      timestamp: Date.now()
    }))
  )

// エラーファクトリー
export const createNetworkError = (
  code: number,
  message: string,
  retryable: boolean = true
): NetworkError => ({
  _tag: "NetworkError",
  code,
  message,
  retryable,
  timestamp: Date.now()
})

export const createSystemError = (
  category: string,
  originalError: unknown,
  userMessage: string,
  retryable: boolean = false
): SystemError => ({
  _tag: "SystemError",
  category,
  originalError,
  userMessage,
  retryable,
  timestamp: Date.now()
})

// 操作失敗エラー型
const OperationFailedError = Schema.Struct({
  _tag: Schema.Literal("OperationFailedError"),
  operation: Schema.String,
  maxRetries: Schema.Number,
  lastError: Schema.Unknown,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
type OperationFailedError = Schema.Schema.Type<typeof OperationFailedError>

// 再試行設定型
const RetryConfig = Schema.Struct({
  maxRetries: Schema.Number.pipe(Schema.between(1, 10)),
  initialDelay: Schema.Number.pipe(Schema.positive()),
  maxDelay: Schema.Number.pipe(Schema.positive()),
  exponentialBase: Schema.Number.pipe(Schema.between(1.1, 3.0))
})
type RetryConfig = Schema.Schema.Type<typeof RetryConfig>

// 型安全な再試行戦略
const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  config: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    exponentialBase: 2
  }
): Effect.Effect<A, OperationFailedError | E, R> =>
  Effect.gen(function* () {
    // 早期リターン: 設定検証
    const validatedConfig = yield* Schema.decodeUnknown(RetryConfig)(config).pipe(
      Effect.mapError(() => createOperationFailedError(
        "withRetry",
        0,
        new Error("Invalid retry configuration")
      ))
    )

    return yield* effect.pipe(
      Effect.retry(
        Schedule.exponential(validatedConfig.initialDelay, validatedConfig.exponentialBase).pipe(
          Schedule.intersect(Schedule.recurs(validatedConfig.maxRetries)),
          Schedule.intersect(Schedule.spaced(validatedConfig.maxDelay))
        )
      ),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`Operation failed after ${validatedConfig.maxRetries} retries: ${JSON.stringify(error)}`)
          return yield* Effect.fail(
            createOperationFailedError(
              "retried_operation",
              validatedConfig.maxRetries,
              error
            )
          )
        })
      )
    )
  })

// エラーファクトリー
export const createOperationFailedError = (
  operation: string,
  maxRetries: number,
  lastError: unknown
): OperationFailedError => ({
  _tag: "OperationFailedError",
  operation,
  maxRetries,
  lastError,
  timestamp: Date.now()
})

// タイムアウトエラー型
const OperationTimeoutError = Schema.Struct({
  _tag: Schema.Literal("OperationTimeoutError"),
  timeoutMs: Schema.Number.pipe(Schema.positive()),
  operation: Schema.String,
  timestamp: Schema.Number.pipe(Schema.default(() => Date.now()))
})
type OperationTimeoutError = Schema.Schema.Type<typeof OperationTimeoutError>

// 型安全なタイムアウト付き操作
const withTimeout = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  timeoutMs: number,
  operationName: string = "timed_operation"
): Effect.Effect<A, OperationTimeoutError | E, R> => {
  // 早期リターン: タイムアウト値検証
  if (timeoutMs <= 0) {
    return Effect.fail(createOperationTimeoutError(0, operationName))
  }

  return effect.pipe(
    Effect.timeout(timeoutMs),
    Effect.catchTag("TimeoutException", () =>
      Effect.fail(createOperationTimeoutError(timeoutMs, operationName))
    )
  )
}

// タイムアウトエラーファクトリー
export const createOperationTimeoutError = (
  timeoutMs: number,
  operation: string
): OperationTimeoutError => ({
  _tag: "OperationTimeoutError",
  timeoutMs,
  operation,
  timestamp: Date.now()
})

// 複合的なエラーハンドリング（再試行 + タイムアウト）
const withRetryAndTimeout = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  retryConfig: RetryConfig,
  timeoutMs: number,
  operationName: string
): Effect.Effect<A, OperationFailedError | OperationTimeoutError | E, R> =>
  withTimeout(
    withRetry(effect, retryConfig),
    timeoutMs,
    operationName
  )
```

## スキーマ検証パターン

### Effect-TSスキーマとの統合

```typescript
// スキーマ定義
export const PlayerSchema = S.Struct({
  _tag: S.Literal('Player'),
  id: EntityId.schema,
  name: S.String.pipe(S.minLength(1), S.maxLength(50)),
  position: Position.schema,
  velocity: Velocity.schema,
  health: S.Number.pipe(S.between(0, 100)),
  inventory: PlayerInventory.schema,
})

// バリデーション付きファクトリー
export const createValidatedPlayer = (input: unknown): Effect.Effect<Player, ValidationError> =>
  Effect.gen(function* () {
    const decoded = yield* S.decodeUnknown(PlayerSchema)(input).pipe(
      Effect.mapError((parseError) =>
        new ValidationError({
          field: 'player',
          value: input,
          constraint: 'schema_validation',
          message: formatParseError(parseError),
        })
      )
    )
    
    // 追加のビジネスルール検証
    yield* validatePlayerBusinessRules(decoded)
    
    return decoded
  })

// 段階的バリデーション
export const validateAndSanitizeEntityData = (rawData: unknown) =>
  Effect.gen(function* () {
    // 1. 基本スキーマ検証
    const basicData = yield* S.decodeUnknown(BasicEntitySchema)(rawData)
    
    // 2. サニタイゼーション
    const sanitizedData = yield* sanitizeEntityData(basicData)
    
    // 3. 詳細検証
    const validatedData = yield* S.decodeUnknown(DetailedEntitySchema)(sanitizedData)
    
    // 4. ビジネスルール検証
    yield* validateEntityBusinessRules(validatedData)
    
    return validatedData
  })
```

## 並行性・非同期パターン

### Effect.forEach による並列処理

```typescript
// 並列チャンク読み込み
export const loadChunksInParallel = (coordinates: ReadonlyArray<ChunkCoordinate>) =>
  Effect.forEach(
    coordinates,
    (coord) => loadChunk(coord),
    { concurrency: 4 } // 4つの並列実行
  ).pipe(
    Effect.catchSome((errors) => {
      // 部分的な失敗の処理
      const successfulChunks = errors.filter(result => result._tag === 'Success')
      if (successfulChunks.length > 0) {
        return Effect.succeed(successfulChunks)
      }
      return Effect.fail(new ChunkLoadingError({ failedCoordinates: coordinates }))
    })
  )

// 段階的な処理パイプライン
export const processEntitiesInBatches = (entities: ReadonlyArray<Entity>) =>
  Effect.gen(function* () {
    // 1. エンティティの分類
    const categorized = yield* Effect.forEach(
      entities,
      (entity) => categorizeEntity(entity),
      { concurrency: 'unbounded' }
    )
    
    // 2. カテゴリごとの並列処理
    const processingResults = yield* Effect.all({
      players: processPlayers(categorized.players),
      npcs: processNPCs(categorized.npcs),
      items: processItems(categorized.items),
      blocks: processBlocks(categorized.blocks),
    }, { concurrency: true })
    
    // 3. 結果の統合
    return consolidateResults(processingResults)
  })
```

### リアクティブパターン

```typescript
// イベントストリームの処理
export const createEventProcessor = () =>
  Effect.gen(function* () {
    const eventQueue = yield* Queue.unbounded<DomainEvent>()
    const subscribers = yield* Ref.make<Map<string, EventHandler>>(new Map())
    
    // イベント処理ファイバー
    const processingFiber = yield* Effect.fork(
      Effect.forever(
        Effect.gen(function* () {
          const event = yield* Queue.take(eventQueue)
          const currentSubscribers = yield* Ref.get(subscribers)
          
          yield* Effect.forEach(
            Array.from(currentSubscribers.values()),
            (handler) => handler(event),
            { concurrency: 'unbounded' }
          )
        })
      )
    )
    
    yield* Effect.addFinalizer(() => Fiber.interrupt(processingFiber))
    
    return {
      publish: (event: DomainEvent) => Queue.offer(eventQueue, event),
      subscribe: (id: string, handler: EventHandler) =>
        Ref.update(subscribers, (subs) => new Map(subs).set(id, handler)),
      unsubscribe: (id: string) =>
        Ref.update(subscribers, (subs) => {
          const newSubs = new Map(subs)
          newSubs.delete(id)
          return newSubs
        }),
    }
  })

// ゲームループの実装
export const gameLoop = Effect.gen(function* () {
  const lastFrame = yield* Ref.make(Date.now())
  
  yield* Effect.forever(
    Effect.gen(function* () {
      const currentTime = Date.now()
      const previousTime = yield* Ref.get(lastFrame)
      const deltaTime = currentTime - previousTime
      
      // フレーム処理
      yield* updatePhysics(deltaTime)
      yield* updateGameLogic(deltaTime)
      yield* updateRendering()
      
      yield* Ref.set(lastFrame, currentTime)
      
      // フレームレート制御
      yield* Effect.sleep(16) // 60 FPS
    })
  )
})
```

## テスティングパターン

### Effect-TSテストユーティリティ

```typescript
import { describe, it, expect } from "vitest"
import { Schema, Effect, Context, Layer } from "effect"

describe('WorldDomainService', () => {
  it.effect('should validate world state correctly', () =>
    Effect.gen(function* () {
      const service = yield* WorldDomainService
      const validState = createValidWorldState()
      
      const result = yield* service.validateWorldState(validState)
      expect(result).toBe(true)
    }).pipe(Effect.provide(TestWorldDomainServiceLive))
  )
  
  it.effect('should handle invalid entity data', () =>
    Effect.gen(function* () {
      const service = yield* WorldDomainService
      const invalidData = { invalid: 'data' }
      
      const result = yield* service.addEntityToWorld('test-id', invalidData).pipe(
        Effect.either
      )
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(WorldStateError)
      }
    }).pipe(Effect.provide(TestWorldDomainServiceLive))
  )
})

// モックサービスの作成
export const MockWorldDomainServiceLive = Layer.succeed(
  WorldDomainService,
  WorldDomainService.of({
    validateWorldState: () => Effect.succeed(true),
    addEntityToWorld: () => Effect.succeed(undefined),
    removeEntityFromWorld: () => Effect.succeed(undefined),
    // ... その他のモック実装
  })
)

// プロパティベーステスト
describe('Position Operations', () => {
  it.effect('distance should be commutative', () =>
    Effect.gen(function* () {
      yield* fc.assert(
        fc.property(
          fc.record({
            x: fc.float(),
            y: fc.float(),
            z: fc.float(),
          }),
          fc.record({
            x: fc.float(),
            y: fc.float(),
            z: fc.float(),
          }),
          (pos1, pos2) => {
            const dist1 = PositionOps.distance(pos1, pos2)
            const dist2 = PositionOps.distance(pos2, pos1)
            return Math.abs(dist1 - dist2) < 0.0001
          }
        )
      )
    })
  )
})
```

## まとめ

TypeScript MinecraftプロジェクトのEffect-TS使用パターンは、以下の特徴を持ちます：

### 主要な利点
- **型安全性**: コンパイル時と実行時の両方での型チェック
- **合成可能性**: 小さなEffectを組み合わせて複雑な処理を構築
- **エラーハンドリング**: 明示的で型安全なエラー処理
- **リソース管理**: 自動的なリソースクリーンアップ
- **テスト容易性**: 依存性注入による効果的なテスト

### 設計パターン
- **サービス指向**: Context.Tagによる型安全なサービス定義
- **レイヤーアーキテクチャ**: 環境別の柔軟な構成管理
- **スキーマ駆動**: 実行時バリデーションとの統合
- **並行性制御**: 安全で効率的な非同期処理

### パフォーマンス最適化
- **遅延評価**: 必要な時点での計算実行
- **リソースプーリング**: 効率的なメモリ使用
- **並列処理**: 適切な並行性制御
- **キャッシング**: 計算結果の効率的な再利用

この設計により、大規模で複雑なゲームロジックを、安全で保守しやすく、拡張可能な形で実装することができています。