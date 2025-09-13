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
// 1. サービスインターフェースの定義
export interface WorldDomainService {
  readonly validateWorldState: (state: WorldState) => Effect.Effect<boolean, WorldStateError>
  readonly addEntityToWorld: (
    entityId: EntityId,
    entityData: EntityData
  ) => Effect.Effect<void, WorldStateError>
  readonly removeEntityFromWorld: (entityId: EntityId) => Effect.Effect<void, WorldStateError>
  readonly addChunkToWorld: (chunk: Chunk) => Effect.Effect<void, WorldStateError>
  readonly calculateChunkKey: (coordinate: ChunkCoordinate) => string
  readonly validateChunkCoordinate: (
    coordinate: ChunkCoordinate
  ) => Effect.Effect<boolean, InvalidPositionError>
}

// 2. Context.Tag の作成
export const WorldDomainService = Context.GenericTag<WorldDomainService>('WorldDomainService')

// 3. サービス実装レイヤー
export const WorldDomainServiceLive = Layer.effect(
  WorldDomainService,
  Effect.gen(function* () {
    return {
      validateWorldState: (state) =>
        state._tag === 'WorldState' && typeof state.timestamp === 'number' && state.timestamp > 0
          ? Effect.succeed(true)
          : Effect.fail(
              new WorldStateError({
                operation: 'validateWorldState',
                reason: 'Invalid world state structure or timestamp',
                stateVersion: state.timestamp,
              })
            ),

      addEntityToWorld: (entityId, entityData) =>
        Effect.gen(function* () {
          if (!entityId) {
            return yield* Effect.fail(
              new WorldStateError({
                operation: 'addEntityToWorld',
                reason: 'Invalid entity ID provided',
              })
            )
          }

          // スキーマベースのバリデーション
          const validatedEntityData = yield* WorldDomainValidation.validateAndParseEntityData(entityData)
          
          // ビジネスロジックバリデーション
          const validation = yield* WorldDomainValidation.validateEntityData(validatedEntityData)
          if (!validation.isValid && entityData != null) {
            return yield* Effect.fail(
              new WorldStateError({
                operation: 'addEntityToWorld',
                reason: `Entity validation failed: ${validation.type}`,
              })
            )
          }

          return yield* Effect.succeed(undefined)
        }),

      validateChunkCoordinate: (coordinate) =>
        Number.isInteger(coordinate.x) && 
        Number.isInteger(coordinate.z) && 
        Math.abs(coordinate.x) < 30000000 && 
        Math.abs(coordinate.z) < 30000000
          ? Effect.succeed(true)
          : Effect.fail(
              InvalidPositionError({
                position: { x: coordinate.x, y: 0, z: coordinate.z },
                reason: 'Chunk coordinate out of valid bounds or not integer',
                validBounds: {
                  min: { x: -30000000, y: 0, z: -30000000 },
                  max: { x: 30000000, y: 0, z: 30000000 },
                },
              })
            ),
    }
  })
)
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
          const currentHealth = yield* worldService.getPlayerHealth(playerId)
          const newHealth = Math.max(0, currentHealth - damage.amount)
          
          yield* worldService.updatePlayerHealth(playerId, newHealth)
          
          if (newHealth <= 0) {
            yield* worldService.killPlayer(playerId)
            yield* Effect.logInfo(`Player ${playerId} has died`)
          }
        }),
    })
  })
)
```

## レイヤーシステム

### レイヤー構成と合成

```typescript
// src/layers.ts

// 基本レイヤーの定義
export const DomainLayer = Layer.mergeAll(
  WorldDomainServiceLive,
  PlayerDomainServiceLive,
  PhysicsServiceLive,
  ValidationServiceLive
)

export const InfrastructureLayer = Layer.mergeAll(
  ThreeJsAdapterLive,
  WebGLRendererLive,
  ChunkRepositoryLive,
  PerformanceMonitorLive,
  FileSystemLive
)

export const ApplicationLayer = Layer.mergeAll(
  PlayerMoveUseCaseLive,
  ChunkLoadUseCaseLive,
  BlockPlaceUseCaseLive,
  WorldGenerateUseCaseLive
)

// 環境別レイヤー構成
export const createEnvironmentLayer = (environment: 'development' | 'production' | 'test') => {
  const coreLayer = Layer.mergeAll(DomainLayer, InfrastructureLayer, ApplicationLayer)
  
  switch (environment) {
    case 'development':
      return Layer.mergeAll(
        coreLayer,
        DebuggerServiceLive,
        DevToolsLive,
        HotReloadLive
      )
      
    case 'production':
      return Layer.mergeAll(
        coreLayer,
        PerformanceOptimizedLive,
        TelemetryLive,
        ErrorReportingLive
      )
      
    case 'test':
      return Layer.mergeAll(
        MockWorldServiceLive,
        MockRendererLive,
        TestUtilitiesLive
      )
      
    default:
      return coreLayer
  }
}

// 安全なレイヤー取得
export const safeGetAppLayer = (environment: 'development' | 'production' | 'test' = 'development') => {
  try {
    return createEnvironmentLayer(environment)
  } catch (error) {
    return Layer.fail(
      new LayerCompositionError({
        message: `Failed to get app layer for environment: ${environment}`,
        timestamp: Date.now(),
        cause: error,
        layerName: 'AppLayer',
        stage: 'environment_selection',
      })
    )
  }
}

// レイヤーの安全な合成
export const safeMergeAll = (...layers: Layer.Layer<any, any, any>[]) => {
  return Effect.gen(function* () {
    try {
      return Layer.mergeAll(...layers)
    } catch (error) {
      return yield* Layer.fail(
        new LayerCompositionError({
          message: 'Failed to merge layers safely',
          timestamp: Date.now(),
          cause: error,
          layerName: 'MergedLayers',
          stage: 'layer_composition',
        })
      )
    }
  })
}
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
// ドメイン固有エラーの定義
export class WorldStateError extends Data.TaggedError('WorldStateError')<{
  readonly operation: string
  readonly reason: string
  readonly stateVersion?: number
}> {}

export class InvalidPositionError extends Data.TaggedError('InvalidPositionError')<{
  readonly position: Position
  readonly reason: string
  readonly validBounds?: {
    min: Position
    max: Position
  }
}> {}

export class ChunkNotLoadedError extends Data.TaggedError('ChunkNotLoadedError')<{
  readonly coordinates: ChunkCoordinate
  readonly requestedOperation: string
  readonly loadingState: 'not-requested' | 'loading' | 'failed'
}> {}

// エラーハンドリングパターン
const robustOperation = Effect.gen(function* () {
  const worldState = yield* getWorldState()
  const chunk = yield* loadChunk(coordinate)
  const entity = yield* createEntity(entityData)
  
  return { worldState, chunk, entity }
}).pipe(
  // 特定エラーの処理
  Effect.catchTag('ChunkNotLoadedError', (error) =>
    Effect.gen(function* () {
      yield* Effect.logWarning(`Chunk not loaded: ${JSON.stringify(error.coordinates)}`)
      const newChunk = yield* generateNewChunk(error.coordinates)
      return { worldState: defaultWorldState, chunk: newChunk, entity: defaultEntity }
    })
  ),
  
  // 位置エラーの処理
  Effect.catchTag('InvalidPositionError', (error) =>
    Effect.gen(function* () {
      yield* Effect.logError(`Invalid position: ${JSON.stringify(error.position)}`)
      const correctedPosition = yield* correctPosition(error.position, error.validBounds)
      yield* retryWithCorrectedPosition(correctedPosition)
    })
  ),
  
  // その他のエラーの処理
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Effect.logError(`Unexpected error in robust operation: ${error}`)
      yield* sendErrorTelemetry(error)
      return defaultOperationResult
    })
  )
)
```

### エラーの変換と再試行

```typescript
// エラー変換パターン
const convertNetworkError = (effect: Effect.Effect<A, NetworkError, R>) =>
  effect.pipe(
    Effect.mapError((networkError) =>
      new SystemError({
        category: 'network',
        originalError: networkError,
        userMessage: 'ネットワーク接続に問題があります',
        retryable: true,
      })
    )
  )

// 再試行戦略
const withRetry = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  maxRetries: number = 3,
  delay: number = 1000
) =>
  effect.pipe(
    Effect.retry(
      Schedule.exponential(delay).pipe(
        Schedule.intersect(Schedule.recurs(maxRetries))
      )
    ),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Operation failed after ${maxRetries} retries: ${error}`)
        return yield* Effect.fail(
          new OperationFailedError({
            operation: 'retried_operation',
            maxRetries,
            lastError: error,
          })
        )
      })
    )
  )

// タイムアウト付き操作
const withTimeout = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  timeoutMs: number
) =>
  effect.pipe(
    Effect.timeout(timeoutMs),
    Effect.catchTag('TimeoutException', () =>
      Effect.fail(
        new OperationTimeoutError({
          timeoutMs,
          operation: 'timed_operation',
        })
      )
    )
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
import { describe, it, expect } from '@effect/vitest'

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