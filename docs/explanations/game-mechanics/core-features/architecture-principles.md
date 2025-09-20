---
title: 'アーキテクチャ原則 - Effect-TS + ECS設計思想'
description: 'TypeScript Minecraftクローンの設計原則とアーキテクチャパターン。Effect-TS 3.17+とSoA ECSの統合設計。'
category: 'specification'
difficulty: 'intermediate'
tags: ['architecture', 'effect-ts', 'ecs', 'design-principles']
prerequisites: ['effect-ts-fundamentals', 'ecs-basics']
estimated_reading_time: '10分'
related_patterns: ['service-patterns', 'data-modeling-patterns']
related_docs:
  ['../explanations/architecture/05-ecs-integration.md', '../explanations/architecture/06-effect-ts-patterns.md']
---

# アーキテクチャ原則

## 概要

本ドキュメントでは、TypeScript Minecraftクローンの設計原則とアーキテクチャパターンを定義します。Effect-TS 3.17+の最新機能とStructure of Arrays (SoA) ECSアーキテクチャの統合により、パフォーマンスと保守性を両立させています。

## 1. Effect-TS 3.17+最新パターン

### Schema.Struct統一

```typescript
// ❌ 古いパターン - Data.struct (廃止)
// const Position = Data.struct({
//   x: number,
//   y: number,
//   z: number
// })

// ✅ 新しいパターン - Schema.Struct
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Position = Schema.Schema.Type<typeof Position>
```

### @app/ServiceName統一ネームスペース

```typescript
// ❌ 古いパターン - classベース (廃止)
// export interface WorldServiceInterface extends ... {}
const WorldService = Context.GenericTag<WorldServiceInterface>('WorldService')

// ✅ 新しいパターン - @app/ネームスペース
export const WorldService = Context.GenericTag<{
  readonly generateChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkGenerationError>
  readonly loadChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, ChunkLoadError>
  readonly unloadChunk: (coord: ChunkCoordinate) => Effect.Effect<void, never>
}>('@app/WorldService')
```

### Schema.TaggedError統一エラー定義

```typescript
// ✅ Effect-TS 3.x標準化パターン
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
}
```

### Schema.annotations詳細化

```typescript
const BlockType = Schema.Literal('air', 'stone', 'dirt', 'wood', 'leaves').pipe(
  Schema.annotations({
    identifier: 'BlockType',
    title: 'ブロックタイプ',
    description: 'Minecraftの基本ブロックタイプ定義',
    examples: ['stone', 'dirt'],
  })
)
```

## 2. SoA ECS アーキテクチャ統合

### Structure of Arrays (SoA) 最適化

```typescript
// ✅ SoA: メモリ効率を最大化
interface ECSWorld {
  // 各コンポーネントタイプを分離したArray
  readonly positions: Float32Array // [x1,y1,z1,x2,y2,z2,...]
  readonly velocities: Float32Array // [vx1,vy1,vz1,vx2,vy2,vz2,...]
  readonly healths: Uint16Array // [hp1,hp2,hp3,...]
  readonly entityIds: Uint32Array // [id1,id2,id3,...]
}

// バッチ処理による高速化
const updatePositionsBatch = (
  positions: Float32Array,
  velocities: Float32Array,
  deltaTime: number,
  count: number
): void => {
  for (let i = 0; i < count * 3; i += 3) {
    positions[i] += velocities[i] * deltaTime // x
    positions[i + 1] += velocities[i + 1] * deltaTime // y
    positions[i + 2] += velocities[i + 2] * deltaTime // z
  }
}
```

### システムの合成可能性

```typescript
// 小さなシステムの組み合わせによる複雑な処理
const PhysicsSystemPipeline = pipe(
  MovementSystem, // 位置更新
  GravitySystem, // 重力適用
  CollisionSystem, // 衝突検出
  FrictionSystem // 摩擦適用
)

export const runPhysicsFrame = (world: ECSWorld, deltaTime: number) =>
  Effect.gen(function* () {
    const updatedWorld = yield* PhysicsSystemPipeline(world, deltaTime)
    return updatedWorld
  })
```

## 3. 早期リターンパターン

### バリデーション主導設計

```typescript
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
          targetPosition: { x: 0, y: 0, z: 0 },
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

    // ビジネスロジック実行
    const playerService = yield* PlayerService
    return yield* playerService.movePlayer(playerId, validPosition, movementType)
  })
```

## 4. Layer構成パターン

### 階層的依存性注入

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

## 5. パフォーマンス最適化原則

### メモリレイアウト最適化

```typescript
// SoA (Structure of Arrays) による最適化
interface OptimizedComponentArrays {
  // 連続メモリアクセスによるキャッシュ効率向上
  positions: {
    x: Float32Array
    y: Float32Array
    z: Float32Array
  }
  velocities: {
    x: Float32Array
    y: Float32Array
    z: Float32Array
  }
}

// バッチ処理によるSIMD活用
const updatePositionsSIMD = (
  positionsX: Float32Array,
  positionsY: Float32Array,
  positionsZ: Float32Array,
  velocitiesX: Float32Array,
  velocitiesY: Float32Array,
  velocitiesZ: Float32Array,
  deltaTime: number
): void => {
  // TypedArrayの直接操作による高速化
  for (let i = 0; i < positionsX.length; i++) {
    positionsX[i] += velocitiesX[i] * deltaTime
    positionsY[i] += velocitiesY[i] * deltaTime
    positionsZ[i] += velocitiesZ[i] * deltaTime
  }
}
```

### システム並列実行

```typescript
// 独立したシステムの並列実行
const runSystemsInParallel = (world: ECSWorld, deltaTime: number) =>
  Effect.all(
    [
      MovementSystem(world, deltaTime), // CPU集約的
      RenderingSystem(world), // GPU集約的
      AudioSystem(world), // I/O集約的
    ],
    { concurrency: 'inherit' }
  )
```

## 6. 型安全性とエラーハンドリング

### 統合エラー戦略

```typescript
export type CoreSystemError =
  | CoreSystemErrors.ChunkGenerationError
  | CoreSystemErrors.WorldUpdateError
  | CoreSystemErrors.PlayerMovementError
  | CoreSystemErrors.SystemPerformanceError
  | CoreSystemErrors.ECSSystemError
  | CoreSystemErrors.SoAOptimizationError

// エラー分類による処理分岐
const handleCoreError = (error: CoreSystemError) =>
  Match.value(error).pipe(
    Match.tag('CoreSystemErrors.ChunkGenerationError', (err) =>
      Effect.logWarning(`チャンク生成失敗: ${err.chunkX},${err.chunkZ}`)
    ),
    Match.tag('CoreSystemErrors.SystemPerformanceError', (err) =>
      Effect.logError(`パフォーマンス警告: ${err.systemName} ${err.frameTime}ms`)
    ),
    Match.exhaustive
  )
```

## 関連ドキュメント

**設計関連**:

- [DDD戦略的設計](../explanations/architecture/02-ddd-strategic-design.md) - 境界づけられたコンテキスト
- [ECS統合](../explanations/architecture/05-ecs-integration.md) - ECSアーキテクチャ詳細
- [Effect-TSパターン](../explanations/architecture/06-effect-ts-patterns.md) - 関数型パターン集

**実装関連**:

- [PBTテスト戦略](./00-pbt-testing-strategy.md) - Property-Based Testing
- [実装パターン](./00-implementation-patterns.md) - 具体的な実装例
- [パフォーマンス考慮事項](./00-performance-optimization.md) - 最適化手法
