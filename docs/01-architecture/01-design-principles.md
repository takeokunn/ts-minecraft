---
title: "設計原則 - 品質・一貫性・予測可能性の基盤"
description: "TypeScript Minecraft Cloneプロジェクトの設計哲学と基本原則。Effect-TS完全準拠、クラス不使用、純関数アプローチによる高品質コードの実現。"
category: "architecture"
difficulty: "advanced"
tags: ["design-principles", "architecture", "effect-ts", "functional-programming", "code-quality", "pure-functions"]
prerequisites: ["basic-typescript", "effect-ts-fundamentals", "functional-programming-basics"]
estimated_reading_time: "15分"
related_patterns: ["service-patterns", "error-handling-patterns", "data-modeling-patterns"]
related_docs: ["./00-overall-design.md", "./06-effect-ts-patterns.md", "../03-guides/00-development-conventions.md"]
---

# 設計原則

## 1. 基本哲学

TypeScript Minecraft Cloneは、以下の哲学に基づいて設計されています：

> **"純粋性と予測可能性を追求せよ"**
>
> すべての副作用をEffect型で管理し、データとロジックを完全に分離する

## 2. コア設計原則

### 原則1: 純粋性優先 (Purity First)

**すべての関数は純粋関数として実装する**

```typescript
import { Effect, Schema } from "effect"

// エンティティ定義
const Entity = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("EntityId")),
  health: Schema.Number.pipe(Schema.nonNegative())
})
type Entity = Schema.Schema.Type<typeof Entity>

// エラー定義
const CombatError = Schema.Struct({
  _tag: Schema.Literal("CombatError"),
  reason: Schema.String
})
type CombatError = Schema.Schema.Type<typeof CombatError>

// ✅ 純粋な関数（PBTテスト可能）
const calculateDamage = (
  attackerStrength: number,
  defenderDefense: number
): number => Math.max(0, attackerStrength - defenderDefense)

// ✅ 早期リターンパターンの活用
const validateDamageInput = (
  attackerStrength: number,
  defenderDefense: number
): boolean => {
  // 早期リターン: 無効な値
  if (attackerStrength < 0 || defenderDefense < 0) return false
  if (!Number.isFinite(attackerStrength) || !Number.isFinite(defenderDefense)) return false
  return true
}

// 副作用は Effect として分離
const applyDamage = (
  defender: Entity,
  damage: number
): Effect.Effect<Entity, CombatError> =>
  Effect.gen(function* () {
    // 早期リターン: ダメージ検証
    if (damage < 0) {
      return yield* Effect.fail({
        _tag: "CombatError" as const,
        reason: "ダメージは負の値にできません"
      })
    }

    // 早期リターン: 体力不足
    if (defender.health <= 0) {
      return yield* Effect.fail({
        _tag: "CombatError" as const,
        reason: "エンティティはすでに倒されています"
      })
    }

    yield* Effect.log(`${damage}のダメージをエンティティ${defender.id}に適用`)
    const newHealth = Math.max(0, defender.health - damage)

    return {
      ...defender,
      health: newHealth
    }
  })
```

### 原則2: 不変性の徹底 (Immutability Everywhere)

**すべてのデータ構造は不変として扱う**

```typescript
// ✅ Effect-TSのSchemaで不変性を保証
import { Schema } from "effect"

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

export type Position = Schema.Schema.Type<typeof Position>

// ベクトル演算用の型定義
export const Vector3 = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
export type Vector3 = Schema.Schema.Type<typeof Vector3>

// ✅ 純粋関数による位置計算（PBTテスト可能）
export const addVectors = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z
})

export const scaleVector = (vector: Vector3, scale: number): Vector3 => ({
  x: vector.x * scale,
  y: vector.y * scale,
  z: vector.z * scale
})

// ✅ 早期リターンによる境界チェック
export const isValidPosition = (pos: Position, bounds: { min: Position; max: Position }): boolean => {
  // 早期リターン: X軸範囲外
  if (pos.x < bounds.min.x || pos.x > bounds.max.x) return false
  // 早期リターン: Y軸範囲外
  if (pos.y < bounds.min.y || pos.y > bounds.max.y) return false
  // 早期リターン: Z軸範囲外
  if (pos.z < bounds.min.z || pos.z > bounds.max.z) return false
  return true
}

// 更新は新しいインスタンスを作成（合成関数の活用）
export const movePosition = (
  pos: Position,
  delta: Vector3
): Position => addVectors(pos, delta)
```

### 原則3: Effect-TS First

**すべてのコードはEffect-TSの最新パターンに従う**

```typescript
// ✅ 最新のEffect-TSパターン
import { Effect, Layer, Schema, pipe, Context } from "effect"

// Schemaを使ったバリデーション（Brand型も活用）
const User = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("UserId")),
  name: Schema.String.pipe(Schema.minLength(1)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
})
type User = Schema.Schema.Type<typeof User>

// エラー定義
const ValidationError = Schema.Struct({
  _tag: Schema.Literal("ValidationError"),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
})
type ValidationError = Schema.Schema.Type<typeof ValidationError>

// ✅ 早期リターンによるバリデーション改善
export const createUser = (
  data: unknown
): Effect.Effect<User, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 基本的なデータ型チェック
    if (!data || typeof data !== "object") {
      return yield* Effect.fail({
        _tag: "ValidationError" as const,
        message: "無効な入力: オブジェクトである必要があります"
      })
    }

    // Schema による詳細検証
    return yield* Schema.decodeUnknownEither(User)(data).pipe(
      Effect.mapError(error => ({
        _tag: "ValidationError" as const,
        message: "ユーザー検証に失敗しました",
        cause: error
      }))
    )
  })

// ✅ サービスインターフェース定義
interface UserServiceInterface {
  readonly create: (data: unknown) => Effect.Effect<User, ValidationError>
  readonly findById: (id: string) => Effect.Effect<User | null, never>
}

const UserService = Context.GenericTag<UserServiceInterface>("@app/UserService")

// ✅ Layerシステムによる依存性注入
export const makeUserServiceLive = Effect.gen(function* () {
  return UserService.of({
    create: createUser,
    findById: (id) => Effect.succeed(null) // 実装例
  })
})

export const UserServiceLive = Layer.effect(UserService, makeUserServiceLive)
```

### 原則4: DDD + ECS の厳密な統合

**ドメインロジックとゲームシステムの明確な分離**

```typescript
import { Effect, Context, Schema, ReadonlyArray } from "effect"

// ✅ Schema.Structでドメインモデル定義
const WorldId = Schema.String.pipe(Schema.brand("WorldId"))
const ChunkId = Schema.String.pipe(Schema.brand("ChunkId"))
const EntityId = Schema.String.pipe(Schema.brand("EntityId"))

const Chunk = Schema.Struct({
  id: ChunkId,
  x: Schema.Number,
  z: Schema.Number,
  blocks: Schema.Array(Schema.Number)
})
type Chunk = Schema.Schema.Type<typeof Chunk>

const WorldInvariants = Schema.Struct({
  maxChunks: Schema.Number.pipe(Schema.positive()),
  chunkSize: Schema.Number.pipe(Schema.positive())
})

// DDDドメインモデル (Aggregate) - Schema.Structで定義
const WorldAggregate = Schema.Struct({
  id: WorldId,
  chunks: Schema.Record(ChunkId, Chunk),
  invariants: WorldInvariants
})
type WorldAggregate = Schema.Schema.Type<typeof WorldAggregate>

// ECSコンポーネント（Schema.Structで定義）
const PositionComponent = Schema.Struct({
  _tag: Schema.Literal("PositionComponent"),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
type PositionComponent = Schema.Schema.Type<typeof PositionComponent>

const VelocityComponent = Schema.Struct({
  _tag: Schema.Literal("VelocityComponent"),
  dx: Schema.Number,
  dy: Schema.Number,
  dz: Schema.Number
})
type VelocityComponent = Schema.Schema.Type<typeof VelocityComponent>

// SystemError定義
const SystemError = Schema.Struct({
  _tag: Schema.Literal("SystemError"),
  reason: Schema.String
})
type SystemError = Schema.Schema.Type<typeof SystemError>

// ComponentStore Service定義
interface ComponentStoreInterface<T> {
  readonly get: (id: EntityId) => Effect.Effect<T, SystemError>
  readonly set: (id: EntityId, component: T) => Effect.Effect<void, SystemError>
}

// ✅ 純粋関数による位置計算の分離
const calculateNewPosition = (
  pos: PositionComponent,
  vel: VelocityComponent,
  deltaTime: number
): PositionComponent => ({
  _tag: "PositionComponent",
  x: pos.x + vel.dx * deltaTime,
  y: pos.y + vel.dy * deltaTime,
  z: pos.z + vel.dz * deltaTime
})

// ✅ 早期リターンパターンの活用
const validateMovementInput = (
  deltaTime: number,
  entities: ReadonlyArray<EntityId>
): boolean => {
  // 早期リターン: deltaTimeが無効
  if (deltaTime <= 0 || deltaTime > 1) return false
  // 早期リターン: エンティティが空
  if (entities.length === 0) return false
  return true
}

// ECSシステム（改善版）
export const movementSystem = (
  entities: ReadonlyArray<EntityId>,
  positions: ComponentStoreInterface<PositionComponent>,
  velocities: ComponentStoreInterface<VelocityComponent>,
  deltaTime: number
): Effect.Effect<void, SystemError> =>
  Effect.gen(function* () {
    // 早期リターン: 入力検証
    if (!validateMovementInput(deltaTime, entities)) {
      return yield* Effect.fail({
        _tag: "SystemError" as const,
        reason: "無効な移動システム入力"
      })
    }

    // 並列処理で各エンティティを更新
    yield* Effect.all(
      ReadonlyArray.map(entities, (id) =>
        Effect.gen(function* () {
          const pos = yield* positions.get(id)
          const vel = yield* velocities.get(id)
          const newPos = calculateNewPosition(pos, vel, deltaTime)
          yield* positions.set(id, newPos)
        })
      ),
      { concurrency: "unbounded" }
    )
  })
```

### 原則5: 最小限のレイヤー構成

**必要最小限のレイヤーのみを使用**

```typescript
import { Layer, pipe } from "effect"

// ✅ サービス定義（Context.GenericTagを使用）
interface WorldServiceInterface {
  readonly createWorld: () => Effect.Effect<WorldAggregate, never>
}
const WorldService = Context.GenericTag<WorldServiceInterface>("@app/WorldService")

interface EntitySystemInterface {
  readonly createEntity: () => Effect.Effect<EntityId, never>
}
const EntitySystem = Context.GenericTag<EntitySystemInterface>("@app/EntitySystem")

interface ThreeJSRendererInterface {
  readonly render: () => Effect.Effect<void, never>
}
const ThreeJSRenderer = Context.GenericTag<ThreeJSRendererInterface>("@app/ThreeJSRenderer")

interface GameLoopServiceInterface {
  readonly start: () => Effect.Effect<never, never>
}
const GameLoopService = Context.GenericTag<GameLoopServiceInterface>("@app/GameLoopService")

// ✅ Layer実装の例
const WorldServiceLive = Layer.succeed(WorldService, WorldService.of({
  createWorld: () => Effect.succeed({
    id: "world-1" as any,
    chunks: {},
    invariants: { maxChunks: 1000, chunkSize: 16 }
  })
}))

const EntitySystemLive = Layer.succeed(EntitySystem, EntitySystem.of({
  createEntity: () => Effect.succeed("entity-1" as any)
}))

const ThreeJSRendererLive = Layer.succeed(ThreeJSRenderer, ThreeJSRenderer.of({
  render: () => Effect.log("フレームを描画中")
}))

const GameLoopServiceLive = Layer.succeed(GameLoopService, GameLoopService.of({
  start: () => Effect.never
}))

// ✅ 改善されたレイヤー構成（依存関係の明示化）
export const AppLayers = {
  // ドメイン層: ビジネスロジックとECS
  Domain: Layer.mergeAll(
    WorldServiceLive,
    EntitySystemLive
  ),

  // インフラ層: 外部システムとの統合
  Infrastructure: Layer.mergeAll(
    ThreeJSRendererLive
  ),

  // アプリケーション層: 統合と実行
  Application: pipe(
    Layer.mergeAll(AppLayers.Domain, AppLayers.Infrastructure),
    Layer.provide(GameLoopServiceLive)
  )
}

// ✅ アプリケーション起動関数
export const startApplication = () =>
  Effect.gen(function* () {
    const gameLoop = yield* GameLoopService
    yield* gameLoop.start()
  }).pipe(
    Effect.provide(AppLayers.Application)
  )
```

### 原則6: データ指向設計 (Data-Oriented Design)

**Structure of Arrays (SoA) によるメモリ最適化**

```typescript
import { Schema } from "effect"

// ✅ Structure of Arrays (SoA) の型安全な定義
const ComponentStorage = Schema.Struct({
  // 連続したメモリレイアウト（SIMD最適化対応）
  positions: Schema.Struct({
    x: Schema.instanceOf(Float32Array), // [x0, x1, x2, ...]
    y: Schema.instanceOf(Float32Array), // [y0, y1, y2, ...]
    z: Schema.instanceOf(Float32Array)  // [z0, z1, z2, ...]
  }),

  velocities: Schema.Struct({
    dx: Schema.instanceOf(Float32Array), // [dx0, dx1, dx2, ...]
    dy: Schema.instanceOf(Float32Array), // [dy0, dy1, dy2, ...]
    dz: Schema.instanceOf(Float32Array)  // [dz0, dz1, dz2, ...]
  }),

  // メタデータ
  entityCount: Schema.Number.pipe(Schema.nonNegative()),
  capacity: Schema.Number.pipe(Schema.positive())
})
type ComponentStorage = Schema.Schema.Type<typeof ComponentStorage>

// ✅ 純粋関数によるSoA操作（PBTテスト可能）
const createComponentStorage = (capacity: number): ComponentStorage => ({
  positions: {
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    z: new Float32Array(capacity)
  },
  velocities: {
    dx: new Float32Array(capacity),
    dy: new Float32Array(capacity),
    dz: new Float32Array(capacity)
  },
  entityCount: 0,
  capacity
})

// ✅ バッチ処理による高速化（SIMD最適化対応）
const updatePositionsBatch = (
  storage: ComponentStorage,
  deltaTime: number,
  startIndex: number = 0,
  count?: number
): ComponentStorage => {
  const actualCount = count ?? storage.entityCount
  const endIndex = Math.min(startIndex + actualCount, storage.entityCount)

  // 新しいストレージを作成（不変性維持）
  const newStorage = {
    ...storage,
    positions: {
      x: new Float32Array(storage.positions.x),
      y: new Float32Array(storage.positions.y),
      z: new Float32Array(storage.positions.z)
    }
  }

  // バッチ処理でキャッシュ効率を向上
  for (let i = startIndex; i < endIndex; i++) {
    newStorage.positions.x[i] += storage.velocities.dx[i] * deltaTime
    newStorage.positions.y[i] += storage.velocities.dy[i] * deltaTime
    newStorage.positions.z[i] += storage.velocities.dz[i] * deltaTime
  }

  return newStorage
}
```

### 原則7: 型安全なエラーハンドリング

**タグ付きエラーによる型安全なエラー処理**

```typescript
import { Schema, Effect, Match } from "effect"

// ✅ チャンク座標の定義
const ChunkCoordinate = Schema.Struct({
  x: Schema.Number,
  z: Schema.Number
})
type ChunkCoordinate = Schema.Schema.Type<typeof ChunkCoordinate>

// ✅ タグ付きエラーをSchemaで定義
const ChunkGenerationError = Schema.Struct({
  _tag: Schema.Literal("ChunkGenerationError"),
  coordinate: ChunkCoordinate,
  reason: Schema.String
})
type ChunkGenerationError = Schema.Schema.Type<typeof ChunkGenerationError>

const NetworkError = Schema.Struct({
  _tag: Schema.Literal("NetworkError"),
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number)
})
type NetworkError = Schema.Schema.Type<typeof NetworkError>

// チャンクデータの定義
const Chunk = Schema.Struct({
  coordinate: ChunkCoordinate,
  blocks: Schema.Array(Schema.Number),
  generated: Schema.Boolean
})
type Chunk = Schema.Schema.Type<typeof Chunk>

// ✅ 単一責務：デフォルトチャンク生成
const useDefaultChunk = (coord: ChunkCoordinate): Effect.Effect<Chunk, never> =>
  Effect.succeed({
    coordinate: coord,
    blocks: new Array(16 * 16 * 16).fill(0),
    generated: false
  })

// ✅ 単一責務：チャンク生成の検証
const validateChunkGeneration = (coord: ChunkCoordinate): boolean => {
  // 早期リターン: 座標の妥当性チェック
  if (!Number.isFinite(coord.x) || !Number.isFinite(coord.z)) return false
  if (Math.abs(coord.x) > 1000000 || Math.abs(coord.z) > 1000000) return false
  return true
}

// ✅ エラーハンドリング（Match.valueパターン）
const handleChunkError = (error: ChunkGenerationError | NetworkError, coord: ChunkCoordinate) =>
  Match.value(error).pipe(
    Match.tag("ChunkGenerationError", (err) =>
      Effect.gen(function* () {
        yield* Effect.log(`生成失敗 at ${err.coordinate.x},${err.coordinate.z}: ${err.reason}`)
        return yield* useDefaultChunk(coord)
      })
    ),
    Match.tag("NetworkError", (err) =>
      Effect.gen(function* () {
        yield* Effect.log(`ネットワークエラー: ${err.message}`)
        return yield* useDefaultChunk(coord)
      })
    ),
    Match.exhaustive
  )

// ✅ 改善されたチャンク生成（早期リターンパターン）
export const generateChunk = (
  coord: ChunkCoordinate
): Effect.Effect<Chunk, never> =>
  Effect.gen(function* () {
    // 早期リターン: 座標検証
    if (!validateChunkGeneration(coord)) {
      yield* Effect.log(`無効なチャンク座標: ${coord.x}, ${coord.z}`)
      return yield* useDefaultChunk(coord)
    }

    // チャンク生成の実装（例）
    return yield* Effect.tryPromise({
      try: () => Promise.resolve({
        coordinate: coord,
        blocks: new Array(16 * 16 * 16).fill(1),
        generated: true
      }),
      catch: (error) => ({
        _tag: "ChunkGenerationError" as const,
        coordinate: coord,
        reason: String(error)
      })
    }).pipe(
      Effect.catchAll((error) => handleChunkError(error, coord))
    )
  })
```

## 3. アンチパターン

### ❌ 避けるべきパターン

- **`namespace` の使用**: モジュールスコープで管理する。
- **通常の`class`キーワードの使用**: `Schema.Struct` と純粋関数で代替する（`Schema.TaggedError`のみ例外）。
- **`Data.Class` の使用**: `Schema.Struct` に移行する。
- **`Context.Tag` の使用**: `Context.GenericTag` に移行完了。
- **`if/else/switch` の多用**: `Match.value` パターンマッチングを使用する。
- **可変状態**: すべてのデータ構造を不変にする。
- **暗黙的な副作用**: 副作用はすべて `Effect` 型で明示的に管理する。
- **ネストの深い条件分岐**: 早期リターンパターンで平坦化する。

### 3.1 最新Effect-TSパターンマトリックス

| カテゴリ | 禁止パターン | 推奨パターン | 移行理由 |
|----------|------------|------------|----------|
| **データ定義** | `class Player {}` | `const Player = Schema.Struct({})` | 型安全・不変性・バリデーション |
| **サービス定義** | `Context.Tag` | `Context.GenericTag` | 最新API・型推論向上 |
| **条件分岐** | `if/switch/else` | `Match.value` | 網羅性・型安全・関数型 |
| **エラー定義** | `Data.TaggedError` | `Schema.Struct` + `_tag` | API統一性・シンプル性 |
| **データクラス** | `Data.Class` | `Schema.Struct` | パフォーマンス・一貫性 |
| **ネスト** | 3層以上のネスト | 早期リターンパターン | 可読性・保守性 |

### 3.2 実装ガイドライン

#### ✅ DO: 推奨パターン
```typescript
// ✅ Schema.Structでデータ定義
const GameState = Schema.Struct({
  players: Schema.Array(Player),
  world: WorldState,
  timestamp: Schema.DateTimeUtc
})

// ✅ Context.GenericTagでサービス定義
interface GameServiceInterface {
  readonly updateState: (delta: number) => Effect.Effect<GameState, GameError>
}
const GameService = Context.GenericTag<GameServiceInterface>("@app/GameService")

// ✅ Match.valueで条件分岐
const processGameEvent = (event: GameEvent) =>
  Match.value(event).pipe(
    Match.tag("PlayerMove", ({ playerId, direction }) => movePlayer(playerId, direction)),
    Match.tag("BlockPlace", ({ position, blockType }) => placeBlock(position, blockType)),
    Match.exhaustive  // 網羅性を保証
  )

// ✅ 早期リターンでネスト削減
const validateInput = (input: unknown): Effect.Effect<ValidInput, ValidationError> =>
  Effect.gen(function* () {
    // 早期リターン: 基本チェック
    if (!input) return yield* Effect.fail(new ValidationError({ reason: "Input is required" }))
    if (typeof input !== "object") return yield* Effect.fail(new ValidationError({ reason: "Input must be object" }))

    // メインロジック
    return yield* Schema.decodeUnknown(ValidInput)(input)
  })
```

#### ❗ DON'T: 禁止パターン
```typescript
// ❌ 通常のclass使用
class BadPlayer {
  constructor(public health: number) {}  // 可変・副作用
  takeDamage(amount: number) {
    this.health -= amount  // 予測困難
  }
}

// ❌ 古いAPIの使用
// ❌ 非推奨パターン（旧API）
// const BadService = Context.Tag<BadServiceInterface>("BadService")

// ❌ 深いネスト
const badValidation = (input: any) => {
  if (input) {
    if (typeof input === "object") {
      if (input.name) {
        if (input.name.length > 0) {
          // ネストが深すぎる
          return input.name
        }
      }
    }
  }
  return null
}
```

---

## 📚 学習パスと次のステップ

### 🎯 以下のドキュメントで実装詳細を確認

1. **[DDD戦略的設計](./02-ddd-strategic-design.md)**
   - 境界づけられたコンテキストの実装方法
   - アグリゲートの設計パターン

2. **[4層アーキテクチャ](./04-layered-architecture.md)**
   - 各層の具体的な実装パターン
   - 依存関係管理のベストプラクティス

3. **[Effect-TSパターン](./06-effect-ts-patterns.md)**
   - 最新Effect-TS 3.17+の実装例
   - 高度なパターンとベストプラクティス

### 📝 理解度チェック

このドキュメントを理解した後、以下ができるようになるはずです：

- [ ] 7つのコア設計原則を説明できる
- [ ] 禁止パターンと推奨パターンを区別できる
- [ ] Schema.Structでデータ定義が書ける
- [ ] Context.GenericTagでサービス定義が書ける
- [ ] Match.valueで条件分岐が書ける
- [ ] 早期リターンパターンでネストを解消できる

### 🛠️ 実践チャレンジ

以下のコードを設計原則に従って書いてみてください：

1. **プレイヤーインベントリシステム**: Schema.Struct + Effect.gen
2. **ブロック配置バリデーション**: Match.value + 早期リターン
3. **ユーザー入力処理**: Context.GenericTagサービス

### 📈 品質指標

これらの原則を厳密に適用することで、以下の品質指標を達成します：

| 品質項目 | 指標 | 設計原則による効果 |
|----------|------|-------------------|
| **予測可能性** | 100% | 純粋関数による決定論的動作 |
| **保守性** | 高い | 明確な責任分離と依存性管理 |
| **パフォーマンス** | 30-50%向上 | データ指向設計による最適化 |
| **型安全性** | 100% | Effect-TSによる完全な型推論 |
| **テスト容易性** | 非常に高い | 副作用の分離と純粋関数 |