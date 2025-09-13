# TypeScript Minecraft Clone アーキテクチャ概要

## 重要: 外部パッケージ使用時の確認プロセス

**Effect-TSやその他の外部パッケージを使用する際は、必ずContext7を通じて最新のAPIとベストプラクティスを確認すること**

```typescript
// 例: Effect-TSの使用前に確認
// 1. Context7で "effect" を検索
// 2. 最新のAPIパターンを確認（Effect.gen, Schema, Layer, pipe）
// 3. 公式ドキュメントと照合
```

## 1. プロジェクトビジョン

TypeScript Minecraft Cloneは、以下の3つの設計パラダイムを**厳密に**統合した、次世代のボクセルサンドボックスゲームエンジンです：

- **Domain-Driven Design (DDD)**: ビジネスロジックの明確な境界と表現力豊かなドメインモデル
- **Entity Component System (ECS)**: 高性能でスケーラブルなゲームオブジェクト管理
- **Effect-TS**: 純粋関数型プログラミングによる完全な副作用管理

## 2. 統合アーキテクチャモデル

### 2.1 厳密な三位一体の設計

```
┌─────────────────────────────────────────────────────────────┐
│                     Pure Functional Core                      │
│                        (Effect-TS)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Domain-Driven Design                    │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │      Entity Component System                  │  │   │
│  │  │   • Entities (Pure IDs)                      │  │   │
│  │  │   • Components (Immutable Data)              │  │   │
│  │  │   • Systems (Effect Functions)               │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │   • Aggregates (Consistency Boundaries)             │   │
│  │   • Value Objects (Immutable)                       │   │
│  │   • Domain Services (Pure Functions)                │   │
│  └─────────────────────────────────────────────────────┘   │
│   • Effect Types (Effect<A, E, R>)                          │
│   • Layer System (Dependency Injection)                     │
│   • Schema (Type-safe Validation)                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Effect-TSによる厳密な型システム

```typescript
import { Effect, Layer, Schema, pipe, Option, Either, Match, Context } from "effect"

// すべての操作はEffect型で表現
type Operation<A, E = never, R = never> = Effect.Effect<A, E, R>

// スキーマによる完全な型定義
export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export type Position = Schema.Schema.Type<typeof Position>

// レイヤーによる依存性注入
export interface WorldService {
  readonly generateChunk: (coord: ChunkCoordinate) => Effect.Effect<Chunk, GenerationError>
  readonly saveWorld: (world: World) => Effect.Effect<void, SaveError>
}

export const WorldService = Context.GenericTag<WorldService>("@app/WorldService")

export const WorldServiceLive = Layer.effect(
  WorldService,
  Effect.gen(function* () {
    const storage = yield* StorageService

    return {
      generateChunk: (coord) =>
        pipe(
          generateTerrain(coord),
          Effect.flatMap(placeStructures),
          Effect.flatMap(populateEntities)
        ),

      saveWorld: (world) =>
        Effect.gen(function* () {
          yield* validateWorld(world)
          yield* storage.save(world)
          yield* Effect.log("World saved successfully")
        })
    }
  })
)
```

## 3. DDD境界づけられたコンテキスト

### 3.1 コアドメイン

```typescript
// World Management Context - 世界管理の中核
export interface WorldAggregate {
  readonly id: WorldId
  readonly chunks: ReadonlyMap<ChunkId, Chunk>
  readonly invariants: WorldInvariants
}

// 不変条件の厳密な管理
export const WorldInvariants = {
  chunkContinuity: (world: WorldAggregate): Effect.Effect<void, InvariantViolation> =>
    Effect.gen(function* () {
      for (const [id, chunk] of world.chunks) {
        const adjacent = getAdjacentChunks(world, chunk.coordinate)
        if (!validateBoundaries(chunk, adjacent)) {
          return yield* Effect.fail(new InvariantViolation({
            type: "ChunkDiscontinuity",
            chunkId: id
          }))
        }
      }
    }),

  entityLimit: (world: WorldAggregate): Effect.Effect<void, InvariantViolation> =>
    Effect.gen(function* () {
      const entityCount = countEntities(world)
      if (entityCount > MAX_ENTITIES) {
        return yield* Effect.fail(new InvariantViolation({
          type: "EntityLimitExceeded",
          count: entityCount,
          limit: MAX_ENTITIES
        }))
      }
    })
}

// アグリゲート操作は常にEffect型
export const WorldOperations = {
  loadChunk: (world: WorldAggregate, coord: ChunkCoordinate) =>
    Effect.gen(function* () {
      // トランザクション境界
      yield* Effect.log(`Loading chunk at ${coord.x}, ${coord.z}`)

      const chunk = yield* generateOrLoadChunk(coord)
      const updatedWorld = addChunk(world, chunk)

      // 不変条件チェック
      yield* WorldInvariants.chunkContinuity(updatedWorld)
      yield* WorldInvariants.entityLimit(updatedWorld)

      return updatedWorld
    })
}
```

### 3.2 ECSシステムの厳密な統合

```typescript
// コンポーネントは純粋なデータ（不変）
export const PositionComponent = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export const VelocityComponent = Schema.Struct({
  dx: Schema.Number,
  dy: Schema.Number,
  dz: Schema.Number
})

// システムは純粋関数（Effect型を返す）
export interface System {
  readonly name: string
  readonly requiredComponents: ReadonlyArray<ComponentType>
  readonly update: (deltaTime: number) => Effect.Effect<void, SystemError>
}

export const MovementSystem: System = {
  name: "Movement",
  requiredComponents: ["Position", "Velocity"],

  update: (deltaTime) =>
    Effect.gen(function* () {
      const entities = yield* queryEntities(["Position", "Velocity"])

      yield* Effect.forEach(entities, (entity) =>
        Effect.gen(function* () {
          const pos = yield* getComponent(entity, "Position")
          const vel = yield* getComponent(entity, "Velocity")

          const newPos = {
            x: pos.x + vel.dx * deltaTime,
            y: pos.y + vel.dy * deltaTime,
            z: pos.z + vel.dz * deltaTime
          }

          yield* setComponent(entity, "Position", newPos)
        }),
        { concurrency: "unbounded" }
      )
    })
}
```

## 4. 最小限のレイヤー構成

### 4.1 シンプルな3層アーキテクチャ

```typescript
// ドメイン層 - ビジネスロジック
export const DomainLayer = Layer.mergeAll(
  WorldServiceLive,
  EntityServiceLive,
  CraftingServiceLive
)

// インフラ層 - 外部システム
export const InfrastructureLayer = Layer.mergeAll(
  StorageServiceLive,
  NetworkServiceLive,
  RenderingServiceLive
)

// アプリケーション層 - 統合
export const ApplicationLayer = pipe(
  Layer.mergeAll(DomainLayer, InfrastructureLayer),
  Layer.provide(GameLoopServiceLive)
)

// 実行
export const runGame = pipe(
  gameLoop,
  Effect.provide(ApplicationLayer),
  Effect.runPromise
)
```

## 5. データ指向設計 (Structure of Arrays)

### 5.1 キャッシュ効率的なメモリレイアウト

```typescript
// SoA (Structure of Arrays) による最適化
export interface ComponentStorage {
  // 連続メモリレイアウト
  positions: {
    x: Float32Array  // [x0, x1, x2, ...]
    y: Float32Array  // [y0, y1, y2, ...]
    z: Float32Array  // [z0, z1, z2, ...]
  }

  // SIMD最適化可能
  velocities: {
    dx: Float32Array
    dy: Float32Array
    dz: Float32Array
  }
}

// バッチ処理による高速化
export const updatePositionsBatch = (
  storage: ComponentStorage,
  count: number,
  deltaTime: number
): Effect.Effect<void> =>
  Effect.sync(() => {
    // SIMD命令による並列処理
    for (let i = 0; i < count; i += 4) {
      storage.positions.x[i] += storage.velocities.dx[i] * deltaTime
      storage.positions.x[i+1] += storage.velocities.dx[i+1] * deltaTime
      storage.positions.x[i+2] += storage.velocities.dx[i+2] * deltaTime
      storage.positions.x[i+3] += storage.velocities.dx[i+3] * deltaTime
      // y, z座標も同様
    }
  })
```

## 6. エラーハンドリング戦略

### 6.1 型安全なエラー処理

```typescript
// タグ付きエラーインターフェース
export interface ChunkGenerationError {
  readonly _tag: "ChunkGenerationError"
  readonly coordinate: ChunkCoordinate
  readonly reason: string
}

export interface NetworkError {
  readonly _tag: "NetworkError"
  readonly message: string
  readonly code: number
}

export interface ValidationError {
  readonly _tag: "ValidationError"
  readonly field: string
  readonly value: unknown
}

// ユニオン型でエラーを合成
export type GameError =
  | ChunkGenerationError
  | NetworkError
  | ValidationError

// エラーハンドリング
export const handleGameError = <A>(
  effect: Effect.Effect<A, GameError>
): Effect.Effect<Option.Option<A>> =>
  pipe(
    effect,
    Effect.map(Option.some),
    Effect.catchTag("ChunkGenerationError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Chunk generation failed: ${error.reason}`)
        yield* useDefaultChunk(error.coordinate)
        return Option.none()
      })
    ),
    Effect.catchTag("NetworkError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Network error: ${error.message}`)
        yield* retryWithBackoff(effect)
        return Option.none()
      })
    ),
    Effect.catchTag("ValidationError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Validation failed for ${error.field}`)
        return Option.none()
      })
    )
  )
```

## 7. ゲームループの実装

```typescript
export const createGameLoop = (
  systems: ReadonlyArray<System>
): Effect.Effect<never, GameError, GameServices> =>
  Effect.gen(function* () {
    const clock = yield* Clock

    while (true) {
      const startTime = yield* clock.currentTime()
      const deltaTime = yield* clock.deltaTime()

      // システムを順次実行
      yield* Effect.forEach(
        systems,
        (system) => system.update(deltaTime),
        { discard: true }
      )

      // フレームレート制御
      const elapsed = yield* clock.currentTime().pipe(
        Effect.map(t => t - startTime)
      )

      if (elapsed < TARGET_FRAME_TIME) {
        yield* Effect.sleep(TARGET_FRAME_TIME - elapsed)
      }

      yield* Effect.yieldNow()
    }
  })
```

## 8. パフォーマンス最適化

### 8.1 遅延評価とメモ化

```typescript
// 遅延評価
export const lazyChunkGeneration = (
  coord: ChunkCoordinate
): Effect.Effect<Chunk, GenerationError> =>
  Effect.suspend(() =>
    Effect.gen(function* () {
      yield* Effect.log(`Generating chunk at ${coord.x}, ${coord.z}`)
      const terrain = yield* generateTerrain(coord)
      const structures = yield* placeStructures(terrain)
      return createChunk(terrain, structures)
    })
  )

// メモ化
export const memoizedChunkGeneration =
  Effect.cachedFunction(lazyChunkGeneration)
```

## 9. まとめ

このアーキテクチャにより：
- **完全な型安全性**: Effect-TSによる副作用の型レベル管理
- **予測可能性**: 純粋関数と不変データによる決定論的動作
- **高性能**: ECSとSoAによる最適化
- **保守性**: DDDによる明確な境界と責任分離
- **テスト容易性**: 副作用の分離と依存性注入

次のステップ：
- [01-principles.md](./01-principles.md) - 設計原則の詳細
- [../01-domain-driven-design/00-strategic-design.md](../01-domain-driven-design/00-strategic-design.md) - DDD戦略的設計
- [../02-entity-component-system/00-ecs-fundamentals.md](../02-entity-component-system/00-ecs-fundamentals.md) - ECS基礎