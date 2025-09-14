---
title: "開発規約 - Effect-TS 3.17+準拠コーディングガイド"
description: "Effect-TS 3.17+最新パターンによるSchema-first開発、純粋関数型プログラミング、完全型安全性を実現するための包括的コーディング規約とベストプラクティス"
category: "guide"
difficulty: "intermediate"
tags: ["development-conventions", "effect-ts", "schema", "functional-programming", "coding-standards", "best-practices", "typescript"]
prerequisites: ["basic-typescript", "effect-ts-fundamentals"]
estimated_reading_time: "25分"
related_patterns: ["service-patterns-catalog", "error-handling-patterns", "effect-ts-test-patterns"]
related_docs: ["../01-architecture/06-effect-ts-patterns.md", "./02-testing-guide.md"]
---

# 開発規約

## 🎯 Problem Statement

従来のTypeScript開発では以下の課題が発生しやすく、大規模なゲーム開発では深刻な問題となります：

- **実行時エラー**: `any`や`as`の乱用による型安全性の破綻
- **データ不整合**: validationの欠如によるバグの混入
- **メモリリーク**: classベースの開発におけるリソース管理の困難さ
- **デバッグの困難さ**: エラーハンドリングの不統一
- **パフォーマンス問題**: 非効率なデータ構造の使用

## 🚀 Solution Approach

Effect-TS 3.17+とSchema-firstアプローチにより、以下を実現します：

1. **完全な型安全性** - Schemaベースの実行時バリデーション
2. **関数型パラダイム** - 不変データ構造とpure function
3. **統一されたエラーハンドリング** - TaggedErrorによる構造化エラー
4. **高パフォーマンス** - Structure of Arrays (SoA) パターン
5. **テスタビリティ** - Layer-based dependency injection

## ⚡ Quick Guide (5分)

### 即座に適用可能なチェックリスト

- [ ] **Schema優先**: すべてのデータ型はSchema.Structで定義
- [ ] **class禁止**: `class`キーワードは使用しない（Effect ServicesとTaggedErrorのみ例外）
- [ ] **不変性**: オブジェクトのミューテーションを行わない
- [ ] **早期リターン**: バリデーション失敗時は即座にEffect.fail
- [ ] **ErrorFactory**: エラー生成にファクトリー関数を使用

### 基本パターンのクイックリファレンス

```typescript
// ✅ Schema-first データモデル
const Player = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("PlayerId")),
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  health: Schema.Number.pipe(Schema.clamp(0, 100))
})

// ✅ Service定義
interface PlayerService {
  readonly move: (id: PlayerId, newPos: Position) => Effect.Effect<void, PlayerError>
}
const PlayerService = Context.GenericTag<PlayerService>("@minecraft/PlayerService")

// ✅ Error定義
class PlayerNotFoundError extends Schema.TaggedError("PlayerNotFoundError")<{
  readonly playerId: PlayerId
  readonly timestamp: number
}> {}
```

## 📋 Detailed Instructions

### Step 1: プロジェクトセットアップ

```bash
# Effect-TS 3.17+ と関連ライブラリのインストール
npm install effect @effect/schema @effect/platform
npm install -D @effect/vitest fast-check
```

### Step 2: Schema-first データモデリング

すべてのデータ構造はSchema.Structで定義し、型安全なバリデーションを実現：

```typescript
import { Schema, Effect, Context, Layer } from "effect"

// 1. ブランド型による型安全性確保
const PlayerId = Schema.String.pipe(Schema.brand("PlayerId"))
const ChunkId = Schema.String.pipe(Schema.brand("ChunkId"))
const Health = Schema.Number.pipe(Schema.clamp(0, 100), Schema.brand("Health"))

// 2. 構造化されたデータ型
const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

// 3. 複合エンティティの定義
const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(50)),
  position: Position,
  health: Health,
  inventory: Schema.Array(ItemSchema),
  level: Schema.Number.pipe(Schema.int(), Schema.positive())
})

// 4. 型エクスポート
export type Player = Schema.Schema.Type<typeof Player>
export type PlayerId = Schema.Schema.Type<typeof PlayerId>
export type Position = Schema.Schema.Type<typeof Position>
```

### Step 3: Effect Serviceパターンの実装

```typescript
// 1. サービスインターフェースの定義
export interface PlayerService {
  readonly findById: (id: PlayerId) => Effect.Effect<Player | null, PlayerError>
  readonly move: (id: PlayerId, position: Position) => Effect.Effect<void, PlayerError>
  readonly updateHealth: (id: PlayerId, health: Health) => Effect.Effect<void, PlayerError>
  readonly addToInventory: (id: PlayerId, item: Item) => Effect.Effect<void, PlayerError>
}

// 2. Context.GenericTagによるサービス登録
export const PlayerService = Context.GenericTag<PlayerService>("@minecraft/PlayerService")

// 3. サービス実装
const makePlayerServiceLive = Effect.gen(function* () {
  const database = yield* DatabaseService
  const eventBus = yield* EventBusService

  return PlayerService.of({
    findById: (id) => Effect.gen(function* () {
      // 早期リターン: ID検証
      if (!id || id.trim().length === 0) {
        return yield* Effect.fail(createPlayerError({
          _tag: "InvalidInput",
          message: "Player ID cannot be empty",
          playerId: id
        }))
      }

      const player = yield* database.findPlayer(id)
      return player
    }),

    move: (id, position) => Effect.gen(function* () {
      // 位置の妥当性チェック
      const validatedPosition = yield* validatePosition(position)

      yield* database.updatePlayerPosition(id, validatedPosition)
      yield* eventBus.publish({
        type: "PlayerMoved",
        playerId: id,
        newPosition: validatedPosition
      })
    }),

    updateHealth: (id, health) => Effect.gen(function* () {
      yield* database.updatePlayerHealth(id, health)

      // ヘルスが0になった場合の特別処理
      if (health === 0) {
        yield* eventBus.publish({
          type: "PlayerDied",
          playerId: id,
          timestamp: Date.now()
        })
      }
    })
  })
})

export const PlayerServiceLive = Layer.effect(PlayerService, makePlayerServiceLive)
```

### Step 4: エラーハンドリングシステム

```typescript
// 1. TaggedErrorによる構造化エラー
export class PlayerNotFoundError extends Schema.TaggedError("PlayerNotFoundError")<{
  readonly playerId: PlayerId
  readonly searchContext: string
  readonly timestamp: number
}> {}

export class InvalidPositionError extends Schema.TaggedError("InvalidPositionError")<{
  readonly position: Position
  readonly reason: string
  readonly validRange: { min: Position; max: Position }
  readonly timestamp: number
}> {}

export class InventoryFullError extends Schema.TaggedError("InventoryFullError")<{
  readonly playerId: PlayerId
  readonly currentSize: number
  readonly maxSize: number
  readonly attemptedItem: Item
  readonly timestamp: number
}> {}

// 2. Union型でのエラー統合
export type PlayerError =
  | PlayerNotFoundError
  | InvalidPositionError
  | InventoryFullError

// 3. エラーファクトリー関数
export const createPlayerNotFoundError = (params: {
  playerId: PlayerId
  searchContext: string
}) => new PlayerNotFoundError({
  ...params,
  timestamp: Date.now()
})

// 4. エラーハンドリングパターン
const handlePlayerOperation = (playerId: PlayerId) =>
  Effect.gen(function* () {
    const player = yield* PlayerService.findById(playerId).pipe(
      Effect.catchTags({
        "PlayerNotFoundError": (error) => {
          yield* Effect.logWarning(`Player not found: ${error.playerId}`)
          return Effect.succeed(null)
        },
        "DatabaseConnectionError": (error) => {
          yield* Effect.logError(`Database connection failed: ${error.message}`)
          // キャッシュからのフォールバック
          return yield* getCachedPlayer(playerId)
        }
      })
    )

    return player
  })
```

### Step 5: テストパターンの実装

```typescript
import { describe, it, expect } from "vitest"
import { Effect, Layer, TestContext } from "effect"

// 1. テスト用サービス実装
const TestPlayerServiceLive = Layer.effect(PlayerService,
  Effect.gen(function* () {
    const testPlayers = new Map<PlayerId, Player>()

    return PlayerService.of({
      findById: (id) => Effect.succeed(testPlayers.get(id) || null),
      move: (id, position) => Effect.gen(function* () {
        const player = testPlayers.get(id)
        if (!player) return yield* Effect.fail(createPlayerNotFoundError({ playerId: id, searchContext: "move" }))

        testPlayers.set(id, { ...player, position })
      })
    })
  })
)

// 2. 統合テスト
describe("PlayerService", () => {
  it("should move player to new position", async () => {
    const program = Effect.gen(function* () {
      const service = yield* PlayerService
      const playerId = "player-123" as PlayerId
      const newPosition = { x: 10, y: 0, z: 5 }

      yield* service.move(playerId, newPosition)

      const player = yield* service.findById(playerId)
      expect(player?.position).toEqual(newPosition)
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestPlayerServiceLive))
    )
  })

  // 3. Property-based テスト
  it("should handle any valid position", () =>
    Effect.gen(function* () {
      const service = yield* PlayerService

      yield* Effect.forEach(
        Range(0, 100),
        (i) => Effect.gen(function* () {
          const position = { x: i * 10, y: 0, z: i * 5 }
          const playerId = `player-${i}` as PlayerId

          yield* service.move(playerId, position)

          const player = yield* service.findById(playerId)
          expect(player?.position.x).toBe(position.x)
        })
      )
    }).pipe(Effect.provide(TestPlayerServiceLive))
  )
})
```

## 💡 Best Practices

### 1. 命名規則の統一

```typescript
// ✅ ファイル命名: kebab-case
// player-service.ts, world-generator.ts, chunk-loader.ts

// ✅ 型命名: PascalCase
type PlayerService = { /* ... */ }
interface ChunkLoader { /* ... */ }

// ✅ 変数・関数命名: camelCase
const currentPlayer = { /* ... */ }
const updatePlayerPosition = () => { /* ... */ }

// ✅ 定数命名: UPPER_SNAKE_CASE
const MAX_CHUNK_SIZE = 16
const DEFAULT_PLAYER_HEALTH = 100
```

### 2. インポート順序の標準化

```typescript
// 1. Node.js built-ins
import path from "node:path"

// 2. Third-party libraries
import { Effect, Schema, Context } from "effect"
import * as THREE from "three"

// 3. Internal modules (absolute imports)
import { Player } from "@domain/entities"
import { DatabaseService } from "@infrastructure/services"

// 4. Relative imports
import { validatePosition } from "./validators"
import { PlayerError } from "../errors"
```

### 3. エラー処理のベストプラクティス

```typescript
// ✅ 構造化されたエラー情報
const processPlayerAction = (action: PlayerAction) =>
  Effect.gen(function* () {
    // 段階的なエラーハンドリング
    const validatedAction = yield* validateAction(action).pipe(
      Effect.mapError(error => createValidationError({
        field: "action",
        value: action,
        reason: error.message,
        context: "player_action_processing"
      }))
    )

    const result = yield* executeAction(validatedAction).pipe(
      Effect.retry(Schedule.exponential("1 second").pipe(Schedule.maxDelay("30 seconds"))),
      Effect.catchTag("RetryLimitExceeded", () =>
        Effect.fail(createProcessingError({
          operation: "executeAction",
          input: validatedAction,
          reason: "Retry limit exceeded"
        }))
      )
    )

    return result
  })
```

## ⚠️ Common Pitfalls

### 1. classキーワードの誤用

```typescript
// ❌ 避けるべきパターン
class EntityManager {
  private entities: Entity[] = []

  addEntity(entity: Entity) {
    this.entities.push(entity) // ミューテーション
  }
}

// ✅ 推奨パターン
interface EntityManagerState {
  readonly entities: ReadonlyArray<Entity>
}

const addEntity = (state: EntityManagerState, entity: Entity): EntityManagerState => ({
  ...state,
  entities: [...state.entities, entity]
})
```

### 2. 型安全性の破綻

```typescript
// ❌ 避けるべきパターン
const processData = (data: any) => {
  return data.someProperty as string // 危険なキャスト
}

// ✅ 推奨パターン
const DataSchema = Schema.Struct({
  someProperty: Schema.String
})

const processData = (input: unknown) =>
  Effect.gen(function* () {
    const data = yield* Schema.decodeUnknown(DataSchema)(input)
    return data.someProperty // 型安全
  })
```

### 3. 非効率なパフォーマンスパターン

```typescript
// ❌ 非効率なアプローチ
const updateAllEntities = (entities: Entity[]) => {
  entities.forEach(entity => {
    // 個別に処理（キャッシュ非効率）
    updatePhysics(entity)
    updateRendering(entity)
  })
}

// ✅ 効率的なSoAパターン
const updateAllEntitiesBatched = (world: World) => {
  // バッチ処理でキャッシュ効率を向上
  world.systems.physics.updateAll()
  world.systems.rendering.updateAll()
}
```

## 🔧 Advanced Techniques

### 1. パフォーマンス最適化パターン

```typescript
// Structure of Arrays (SoA) による高速データアクセス
interface ComponentStore<T> {
  readonly data: ReadonlyArray<T>
  readonly indices: ReadonlyMap<EntityId, number>
}

const createComponentStore = <T>(): ComponentStore<T> => ({
  data: [],
  indices: new Map()
})

const batchUpdatePositions = (
  positions: ComponentStore<Position>,
  velocities: ComponentStore<Velocity>
) => Effect.gen(function* () {
  // ベクトル化された処理が可能
  const updatedPositions = positions.data.map((pos, index) => {
    const vel = velocities.data[index]
    return {
      x: pos.x + vel.x,
      y: pos.y + vel.y,
      z: pos.z + vel.z
    }
  })

  return { ...positions, data: updatedPositions }
})
```

### 2. 並行処理パターン

```typescript
// 制御された並行処理
const loadMultipleChunks = (coordinates: ChunkCoordinate[]) =>
  Effect.all(
    coordinates.map(coord => loadChunk(coord)),
    { concurrency: 8, batching: true }
  )

// リソースプールによる制御
const processWithResourcePool = <A, E, R>(
  tasks: ReadonlyArray<Effect.Effect<A, E, R>>,
  poolSize: number
) => Effect.gen(function* () {
  const semaphore = yield* Semaphore.make(poolSize)

  const results = yield* Effect.all(
    tasks.map(task =>
      semaphore.withPermit(task)
    )
  )

  return results
})
```

### 3. 状態管理パターン

```typescript
// STM (Software Transactional Memory) による安全な状態更新
const updatePlayerInventory = (playerId: PlayerId, item: Item) =>
  STM.gen(function* () {
    const inventory = yield* STM.get(playerInventories)
    const currentItems = inventory.get(playerId) || []

    if (currentItems.length >= MAX_INVENTORY_SIZE) {
      return yield* STM.fail(createInventoryFullError({
        playerId,
        currentSize: currentItems.length,
        maxSize: MAX_INVENTORY_SIZE,
        attemptedItem: item
      }))
    }

    const updatedItems = [...currentItems, item]
    yield* STM.set(playerInventories, inventory.set(playerId, updatedItems))

    return updatedItems
  })
```

## 🎯 Decision Trees

```
バリデーションエラーが発生した場合:
├─ データが修正可能？
│  ├─ Yes: 自動修正を試行
│  │      ├─ 修正成功: 処理続行 + 警告ログ
│  │      └─ 修正失敗: エラー報告 + 推奨対処法
│  └─ No: 即座にエラー報告
└─ ユーザー入力エラー？
   ├─ Yes: フレンドリーなエラーメッセージ
   └─ No: 技術的な詳細エラー
```

このガイドに従うことで、保守性が高く、パフォーマンスに優れた、型安全なMinecraftゲームエンジンを構築できます。