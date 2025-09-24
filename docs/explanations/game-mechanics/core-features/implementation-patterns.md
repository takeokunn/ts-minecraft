---
title: '実装パターン - Effect-TS 3.17+具体的実装'
description: 'Effect-TS 3.17+の最新APIを使用したコア機能の具体的実装パターンとコード例。'
category: 'specification'
difficulty: 'advanced'
tags: ['implementation', 'effect-ts', 'patterns', 'code-examples']
prerequisites: ['effect-ts-fundamentals', 'architecture-principles']
estimated_reading_time: '20分'
related_patterns: ['service-patterns', 'error-handling-patterns']
related_docs: ['./00-architecture-principles.md', '../explanations/architecture/06-effect-ts-patterns.md']
---

# 実装パターン

## 概要

本ドキュメントでは、Effect-TS 3.17+の最新APIを使用したコア機能の具体的な実装パターンを示します。Service定義、Schema構築、エラーハンドリング、パフォーマンス最適化の実践的なコード例を提供します。

## 1. Service定義パターン（最新）

### @app/ネームスペース統一パターン

```typescript
// ❌ 古いパターン - classベース (廃止)
// export interface WorldServiceInterface extends ... {}
const WorldService = Context.GenericTag<WorldServiceInterface>('WorldService')

// ✅ 新しいパターン - @app/ネームスペース
export const WorldService = Context.GenericTag<{
  readonly generateChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkGenerationError>
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly unloadChunk: (coord: ChunkCoordinate) => Effect.Effect<void, never>
  readonly getBlockAt: (pos: Position) => Effect.Effect<Option.Option<Block>, never>
  readonly setBlockAt: (pos: Position, block: Block) => Effect.Effect<void, WorldUpdateError>
}>('@app/WorldService')

// レイヤー実装
export const WorldServiceLive = Layer.succeed(
  WorldService,
  WorldService.of({
    generateChunk: (coord) => generateChunkImpl(coord),
    loadChunk: (coord) => loadChunkImpl(coord),
    unloadChunk: (coord) => unloadChunkImpl(coord),
    getBlockAt: (pos) => getBlockAtImpl(pos),
    setBlockAt: (pos, block) => setBlockAtImpl(pos, block),
  })
)
```

## 2. Schema定義パターン（最新）

### 基本スキーマ構築

```typescript
// 基本座標系
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Position = Schema.Schema.Type<typeof Position>

// チャンク座標（整数制約付き）
export const ChunkCoordinate = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int()),
})
export type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinate>

// ブロック定義
export const BlockType = Schema.Literal('air', 'stone', 'dirt', 'wood', 'leaves')
export const Block = Schema.Struct({
  type: BlockType,
  properties: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  metadata: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.min(0), Schema.max(15))),
})
export type Block = Schema.Schema.Type<typeof Block>
```

### 統合エラー定義システム

```typescript
// エラー定義 - Effect-TS 3.x標準化パターン
export namespace CoreSystemErrors {
  export const ChunkGenerationError = Schema.TaggedError('CoreSystemErrors.ChunkGenerationError', {
    chunkX: Schema.Number,
    chunkZ: Schema.Number,
    biome: Schema.String,
    generationStep: Schema.String,
    seed: Schema.Number,
    underlyingError: Schema.optional(Schema.Unknown),
    performance: Schema.Struct({
      startTime: Schema.Number,
      duration: Schema.Number,
      memoryUsed: Schema.Number,
    }),
    timestamp: Schema.Number,
  })
  export interface ChunkGenerationError extends Schema.Schema.Type<typeof ChunkGenerationError> {}

  export const WorldUpdateError = Schema.TaggedError('CoreSystemErrors.WorldUpdateError', {
    position: Position,
    updateType: Schema.String,
    reason: Schema.String,
    previousValue: Schema.optional(Schema.Unknown),
    newValue: Schema.optional(Schema.Unknown),
    affectedEntities: Schema.Array(Schema.String),
    rollbackPossible: Schema.Boolean,
    timestamp: Schema.Number,
  })
  export interface WorldUpdateError extends Schema.Schema.Type<typeof WorldUpdateError> {}

  export const PlayerMovementError = Schema.TaggedError('CoreSystemErrors.PlayerMovementError', {
    playerId: Schema.String,
    currentPosition: Position,
    targetPosition: Position,
    movementType: Schema.String,
    reason: Schema.String,
    collisionDetails: Schema.optional(
      Schema.Struct({
        collisionType: Schema.String,
        obstaclePosition: Position,
        obstacleType: Schema.String,
      })
    ),
    validationFailures: Schema.Array(Schema.String),
    timestamp: Schema.Number,
  })
  export interface PlayerMovementError extends Schema.Schema.Type<typeof PlayerMovementError> {}

  export const SystemPerformanceError = Schema.TaggedError('CoreSystemErrors.SystemPerformanceError', {
    systemName: Schema.String,
    frameTime: Schema.Number,
    maxAllowedTime: Schema.Number,
    cpuUsage: Schema.Number,
    memoryUsage: Schema.Number,
    entityCount: Schema.Number,
    chunkCount: Schema.Number,
    performanceMetrics: Schema.Record(Schema.String, Schema.Number),
    timestamp: Schema.Number,
  })
  export interface SystemPerformanceError extends Schema.Schema.Type<typeof SystemPerformanceError> {}

  export const ECSSystemError = Schema.TaggedError('CoreSystemErrors.ECSSystemError', {
    systemName: Schema.String,
    componentTypes: Schema.Array(Schema.String),
    entityCount: Schema.Number,
    processingStage: Schema.String,
    reason: Schema.String,
    failedEntityId: Schema.optional(Schema.String),
    recoveryAction: Schema.optional(Schema.String),
    timestamp: Schema.Number,
  })
  export interface ECSSystemError extends Schema.Schema.Type<typeof ECSSystemError> {}

  export const SoAOptimizationError = Schema.TaggedError('CoreSystemErrors.SoAOptimizationError', {
    arrayType: Schema.String,
    arraySize: Schema.Number,
    expectedSize: Schema.Number,
    memoryLayout: Schema.String,
    alignmentIssue: Schema.Boolean,
    performanceImpact: Schema.Number,
    suggestedFix: Schema.String,
    timestamp: Schema.Number,
  })
  export interface SoAOptimizationError extends Schema.Schema.Type<typeof SoAOptimizationError> {}
}

export type CoreSystemError =
  | CoreSystemErrors.ChunkGenerationError
  | CoreSystemErrors.WorldUpdateError
  | CoreSystemErrors.PlayerMovementError
  | CoreSystemErrors.SystemPerformanceError
  | CoreSystemErrors.ECSSystemError
  | CoreSystemErrors.SoAOptimizationError
```

## 3. 早期リターンパターン

### バリデーション主導の実装

```typescript
// バリデーション付き処理関数 - Effect-TS 3.x最新パターン
const processPlayerMovement = (
  playerId: string,
  currentPosition: Position,
  targetPosition: unknown,
  movementType: string = 'walk'
): Effect.Effect<Position, CoreSystemErrors.PlayerMovementError> =>
  Effect.gen(function* () {
    // 早期リターン: プレイヤーID検証
    if (!playerId.trim()) {
      return yield* Effect.fail(
        new CoreSystemErrors.PlayerMovementError({
          playerId,
          currentPosition,
          targetPosition: { x: 0, y: 0, z: 0 }, // デフォルト値
          movementType,
          reason: '無効なプレイヤーID - 空文字列は許可されません',
          validationFailures: ['playerId.empty'],
          timestamp: Date.now(),
        })
      )
    }

    // Schema バリデーション - 最新API使用
    const validPosition = yield* Schema.decodeUnknown(Position)(targetPosition).pipe(
      Effect.mapError(
        (error) =>
          new CoreSystemErrors.PlayerMovementError({
            playerId,
            currentPosition,
            targetPosition: { x: 0, y: 0, z: 0 },
            movementType,
            reason: `座標バリデーション失敗: ${error.message}`,
            validationFailures: [
              `schema.validation.failed`,
              `field: ${error.path?.join('.') || 'unknown'}`,
              `expected: Position`,
              `actual: ${typeof targetPosition}`,
            ],
            timestamp: Date.now(),
          })
      )
    )

    // 距離制限チェック
    const distance = calculateDistance(currentPosition, validPosition)
    const maxDistance = getMaxMovementDistance(movementType)

    if (distance > maxDistance) {
      return yield* Effect.fail(
        new CoreSystemErrors.PlayerMovementError({
          playerId,
          currentPosition,
          targetPosition: validPosition,
          movementType,
          reason: `移動距離が制限を超過: ${distance.toFixed(2)}m > ${maxDistance}m`,
          validationFailures: [
            `movement.distance.exceeded`,
            `distance: ${distance}`,
            `max_allowed: ${maxDistance}`,
            `movement_type: ${movementType}`,
          ],
          timestamp: Date.now(),
        })
      )
    }

    // 衝突検出
    const collision = yield* checkCollision(currentPosition, validPosition)

    if (collision.detected) {
      return yield* Effect.fail(
        new CoreSystemErrors.PlayerMovementError({
          playerId,
          currentPosition,
          targetPosition: validPosition,
          movementType,
          reason: `移動経路上に障害物を検出: ${collision.obstacleType}`,
          collisionDetails: {
            collisionType: collision.type,
            obstaclePosition: collision.position,
            obstacleType: collision.obstacleType,
          },
          validationFailures: [
            `movement.collision.detected`,
            `obstacle_type: ${collision.obstacleType}`,
            `collision_position: ${JSON.stringify(collision.position)}`,
          ],
          timestamp: Date.now(),
        })
      )
    }

    // ビジネスロジック実行
    const playerService = yield* PlayerService
    return yield* playerService.movePlayer(playerId, validPosition, movementType)
  })
```

## 4. パフォーマンス最適化実装

### SIMD最適化ベクトル計算

```typescript
// 純粋関数による距離計算 - SIMD最適化対応
const calculateDistance = (from: Position, to: Position): number => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z

  // SIMD対応プロセッサでの高速計算
  if (typeof Float32Array !== 'undefined') {
    const vec = new Float32Array([dx, dy, dz, 0])
    return Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2])
  }

  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// ベクトル演算の最適化関数群
const VectorMath = {
  distance: calculateDistance,

  distanceBatch: (pairs: ReadonlyArray<[Position, Position]>): ReadonlyArray<number> => {
    // バッチ処理による効率化
    const results = new Array(pairs.length)
    for (let i = 0; i < pairs.length; i++) {
      results[i] = calculateDistance(pairs[i][0], pairs[i][1])
    }
    return results
  },

  normalize: (vec: Position): Position => {
    const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z)
    return length > 0
      ? {
          x: vec.x / length,
          y: vec.y / length,
          z: vec.z / length,
        }
      : { x: 0, y: 0, z: 0 }
  },
}

// 移動タイプ別の最大距離取得
const getMaxMovementDistance = (movementType: string): number => {
  switch (movementType) {
    case 'walk':
      return 4.3
    case 'sprint':
      return 5.6
    case 'fly':
      return 11.0
    case 'teleport':
      return 1000.0
    default:
      return 4.3
  }
}

// 衝突検出の型安全な実装
interface CollisionResult {
  readonly detected: boolean
  readonly type: string
  readonly position: Position
  readonly obstacleType: string
}

const checkCollision = (from: Position, to: Position): Effect.Effect<CollisionResult, never> =>
  Effect.succeed({
    detected: false,
    type: 'none',
    position: from,
    obstacleType: 'none',
  }) // 簡略実装
```

## 5. Layer構成パターン

### 階層的依存関係管理

```typescript
// コア機能の統合Layer
export const CoreFeaturesLayer = Layer.mergeAll(
  WorldSystemLayer,
  PlayerSystemLayer,
  BlockSystemLayer,
  EntitySystemLayer,
  RenderingSystemLayer,
  PhysicsSystemLayer,
  ChunkSystemLayer,
  InventorySystemLayer,
  CraftingSystemLayer,
  SceneSystemLayer
).pipe(Layer.provide(ConfigLayer), Layer.provide(LoggingLayer), Layer.provide(MetricsLayer))

// 開発・テスト用の軽量Layer
export const CoreFeaturesTestLayer = Layer.mergeAll(
  TestWorldSystemLayer,
  TestPlayerSystemLayer,
  TestPhysicsSystemLayer,
  TestSceneSystemLayer
).pipe(Layer.provide(TestConfigLayer))
```

## 6. テスト実装パターン

### 単体テスト（純粋関数）

```typescript
import { Effect, TestContext, TestClock } from 'effect'
import { describe, test, expect } from '@effect/vitest'

export const WorldSystemTests = describe('WorldSystem', () => {
  test('チャンク生成の純粋性', () =>
    Effect.gen(function* () {
      const coord = { x: 0, z: 0 }

      // 同じ座標での生成は同じ結果を返す
      const chunk1 = yield* generateChunk(coord)
      const chunk2 = yield* generateChunk(coord)

      expect(chunk1).toEqual(chunk2)
    }).pipe(Effect.provide(TestWorldServiceLayer), Effect.provide(TestContext.TestContext)))

  test('ブロック配置のバリデーション', () =>
    Effect.gen(function* () {
      const invalidPos = { x: -1, y: -64, z: 999999 }

      // 無効座標でのブロック配置は失敗する
      const result = yield* setBlockAt(invalidPos, { type: 'stone' }).pipe(Effect.either)

      expect(Either.isLeft(result)).toBe(true)
    }))
})
```

### 統合テスト（システム間連携）

```typescript
export const SystemIntegrationTests = describe('System統合', () => {
  test('プレイヤー移動→チャンクロード→レンダリング連携', () =>
    Effect.gen(function* () {
      const testClock = yield* TestClock.TestClock

      // プレイヤーを新しいチャンクに移動
      const playerService = yield* PlayerService
      yield* playerService.movePlayer('test-player', { x: 256, y: 64, z: 256 })

      // 非同期チャンクロードの完了を待機
      yield* TestClock.adjust('5 seconds')

      // チャンクがロードされていることを確認
      const chunkService = yield* ChunkService
      const chunk = yield* chunkService.getChunk({ x: 16, z: 16 })

      expect(Option.isSome(chunk)).toBe(true)
    }).pipe(
      Effect.provide(CoreFeaturesTestLayer),
      Effect.provide(TestContext.TestContext),
      Effect.provide(TestClock.TestClock)
    ))
})
```

### パフォーマンステスト（最新パターン）

```typescript
import { Effect, TestClock, TestContext, Clock, Duration, Either, pipe } from 'effect'
import { describe, test, expect } from '@effect/vitest'
import * as fc from '@effect/vitest'

export const PerformanceTests = describe('パフォーマンス', () => {
  test('1000エンティティの物理計算', () =>
    Effect.gen(function* () {
      // テスト用エンティティ生成（Property-Based Testing統合）
      const entityArbitrary = fc.record({
        id: fc.integer({ min: 0, max: 999 }),
        position: fc.record({
          x: fc.float({ min: -1000, max: 1000 }),
          y: fc.float({ min: -64, max: 320 }),
          z: fc.float({ min: -1000, max: 1000 }),
        }),
        velocity: fc.record({
          x: fc.float({ min: -10, max: 10 }),
          y: fc.float({ min: -10, max: 10 }),
          z: fc.float({ min: -10, max: 10 }),
        }),
      })

      const entities = yield* Effect.sync(() => Array.from({ length: 1000 }, () => fc.sample(entityArbitrary, 1)[0]))

      const startTime = yield* Clock.currentTimeMillis

      // 物理システム1フレーム実行 - バッチ処理で最適化
      const physicsSystem = yield* PhysicsSystem
      yield* physicsSystem.updateBatch(entities, {
        concurrency: navigator.hardwareConcurrency || 4,
        batchSize: 100,
      })

      const endTime = yield* Clock.currentTimeMillis
      const duration = endTime - startTime

      // パフォーマンスメトリクス記録
      yield* Metrics.histogram('physics_update_duration').update(duration, {
        entityCount: entities.length.toString(),
      })

      // 16msフレーム内での完了を確認（余裕をもって14ms以下）
      expect(duration).toBeLessThan(14)

      // メモリ使用量チェック
      const memoryUsage = yield* MemoryMonitor.getCurrentUsage()
      expect(memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024) // 100MB以下
    }).pipe(Effect.provide(TestPhysicsSystemLayer), Effect.provide(TestContext.TestContext)))

  test('チャンク生成のスケーラビリティテスト', () =>
    Effect.gen(function* () {
      const testClock = yield* TestClock.TestClock
      const chunkCoords = Array.from({ length: 100 }, (_, i) => ({
        x: Math.floor(i / 10),
        z: i % 10,
      }))

      const startTime = yield* TestClock.currentTimeMillis(testClock)

      // 並列チャンク生成
      yield* Effect.forEach(chunkCoords, (coord) => WorldService.generateChunk(coord), { concurrency: 8 })

      const endTime = yield* TestClock.currentTimeMillis(testClock)
      const totalDuration = endTime - startTime

      // 1チャンク当たり平均50ms以下での生成を確認
      const avgDuration = totalDuration / chunkCoords.length
      expect(avgDuration).toBeLessThan(50)

      // システムリソース使用量確認
      const resourceStats = yield* SystemMonitor.getResourceStats()
      expect(resourceStats.cpuUsage).toBeLessThan(0.8) // CPU使用率80%以下
    }).pipe(
      Effect.provide(TestWorldServiceLayer),
      Effect.provide(TestContext.TestContext),
      Effect.provide(TestClock.TestClock)
    ))

  test('Property-based パフォーマンス特性検証', () =>
    Effect.promise(() =>
      it.prop(
        it.prop(
          Schema.Array(
            fc.record({
              x: fc.integer({ min: -50, max: 50 }),
              z: fc.integer({ min: -50, max: 50 }),
            }),
            { minLength: 1, maxLength: 200 }
          ),
          (coordinates) =>
            pipe(
              ChunkService.loadChunkBatch(coordinates),
              Effect.timeout(Duration.seconds(30)),
              Effect.either,
              Effect.map(Either.isRight)
            )
        )
      )
    ))
})
```

## 7. 実装ベストプラクティス

### Schema活用パターン

```typescript
// 制約付きスキーマ定義
export const MinecraftCoordinate = Schema.Number.pipe(
  Schema.int(),
  Schema.min(-30000000),
  Schema.max(30000000),
  Schema.annotations({
    title: 'Minecraft座標',
    description: 'Minecraftワールドの有効座標範囲内の整数',
  })
)

// 複雑なバリデーション
export const ChunkData = Schema.Struct({
  coordinate: ChunkCoordinate,
  blocks: Schema.Array(Block).pipe(
    Schema.minItems(4096),
    Schema.maxItems(4096),
    Schema.annotations({
      description: '16x16x16ブロックの配列',
    })
  ),
  lightData: Schema.optional(Schema.Array(Schema.Number.pipe(Schema.min(0), Schema.max(15)))),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
})
```

### エラーハンドリングパターン

```typescript
// 統合エラーハンドリング
const handleSystemError = (error: CoreSystemError) =>
  Match.value(error).pipe(
    Match.tag('CoreSystemErrors.ChunkGenerationError', (err) =>
      Effect.logWarning(`チャンク生成失敗: ${err.chunkX},${err.chunkZ} - ${err.reason}`)
    ),
    Match.tag('CoreSystemErrors.SystemPerformanceError', (err) =>
      Effect.logError(`パフォーマンス警告: ${err.systemName} ${err.frameTime}ms`)
    ),
    Match.tag('CoreSystemErrors.PlayerMovementError', (err) => Effect.logInfo(`移動制限: ${err.reason}`)),
    Match.exhaustive
  )
```

## 関連ドキュメント

**設計関連**:

- [アーキテクチャ原則](./00-architecture-principles.md) - 設計思想と原則
- [PBTテスト戦略](./00-pbt-testing-strategy.md) - テスト戦略

**パターン集**:

- [Effect-TSパターン](../explanations/architecture/06-effect-ts-patterns.md) - 関数型パターン
- [サービスパターン](../../explanations/design-patterns/01-service-patterns.md) - サービス実装パターン
