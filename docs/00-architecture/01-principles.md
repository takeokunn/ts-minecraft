# 設計原則

## 重要: 外部パッケージ使用時の確認プロセス

**Effect-TSやその他の外部パッケージを使用する際は、必ずContext7を通じて最新のAPIとベストプラクティスを確認すること**

```typescript
// 例: Effect-TSの使用前に確認
// 1. Context7で "effect" を検索
// 2. 最新のAPIパターンを確認
// 3. Schema, Layer, Effect.gen, pipe の使用方法を確認
```

## 1. 基本哲学

TypeScript Minecraft Cloneは、以下の哲学に基づいて設計されています：

> **"純粋性と予測可能性を追求せよ"**
>
> すべての副作用をEffect型で管理し、データとロジックを完全に分離する

## 2. コア設計原則

### 原則1: 純粋性優先 (Purity First)

**すべての関数は純粋関数として実装する**

```typescript
// ✅ 純粋な関数
const calculateDamage = (
  attackerStrength: number,
  defenderDefense: number
): number => Math.max(0, attackerStrength - defenderDefense)

// 副作用は Effect として分離
const applyDamage = (
  defender: Entity,
  damage: number
): Effect.Effect<Entity, CombatError> =>
  Effect.gen(function* () {
    yield* Effect.log(`Applying ${damage} damage`)
    return { ...defender, health: defender.health - damage }
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

// 更新は新しいインスタンスを作成
export const movePosition = (
  pos: Position,
  delta: Position
): Position => ({
  x: pos.x + delta.x,
  y: pos.y + delta.y,
  z: pos.z + delta.z
})
```

### 原則3: Effect-TS First

**すべてのコードはEffect-TSの最新パターンに従う**

```typescript
// ✅ 最新のEffect-TSパターン
import { Effect, Layer, Schema, pipe } from "effect"

// Schemaを使ったバリデーション
const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String
})

// Effect.genを使った合成
export const createUser = (
  data: unknown
): Effect.Effect<User, ValidationError> =>
  Effect.gen(function* () {
    const validated = yield* Schema.decodeUnknown(User)(data)
    return validated
  })

// Layerシステムによる依存性注入
export const UserServiceLive = Layer.succeed(
  UserService,
  {
    create: createUser
  }
)
```

### 原則4: DDD + ECS の厳密な統合

**ドメインロジックとゲームシステムの明確な分離**

```typescript
// DDDドメインモデル
export interface WorldAggregate {
  readonly id: WorldId
  readonly chunks: ReadonlyMap<ChunkId, Chunk>
  readonly invariants: WorldInvariants
}

// ECSコンポーネント（純粋データ）
export interface PositionComponent {
  readonly x: number
  readonly y: number
  readonly z: number
}

// ECSシステム（純粋関数）
export const movementSystem = (
  entities: ReadonlyArray<EntityId>,
  positions: ComponentStore<PositionComponent>,
  velocities: ComponentStore<VelocityComponent>,
  deltaTime: number
): Effect.Effect<void, SystemError> =>
  Effect.gen(function* () {
    for (const id of entities) {
      const pos = yield* positions.get(id)
      const vel = yield* velocities.get(id)
      yield* positions.set(id, {
        x: pos.x + vel.dx * deltaTime,
        y: pos.y + vel.dy * deltaTime,
        z: pos.z + vel.dz * deltaTime
      })
    }
  })
```

### 原則5: 最小限のレイヤー構成

**必要最小限のレイヤーのみを使用**

```typescript
// シンプルな3層構成
export const AppLayers = {
  // ドメイン層: ビジネスロジックとECS
  Domain: Layer.mergeAll(
    WorldServiceLive,
    EntitySystemLive,
    ComponentStoreLive
  ),

  // インフラ層: 外部システムとの統合
  Infrastructure: Layer.mergeAll(
    ThreeJSRendererLive,
    WebGPUAdapterLive,
    IndexedDBStorageLive
  ),

  // アプリケーション層: 統合と実行
  Application: pipe(
    Layer.mergeAll(Domain, Infrastructure),
    Layer.provide(GameLoopServiceLive)
  )
}
```

### 原則6: データ指向設計 (Data-Oriented Design)

**Structure of Arrays (SoA) によるメモリ最適化**

```typescript
// キャッシュ効率的なデータレイアウト
export interface ComponentStorage {
  // 連続したメモリレイアウト
  positions: {
    x: Float32Array  // [x0, x1, x2, ...]
    y: Float32Array  // [y0, y1, y2, ...]
    z: Float32Array  // [z0, z1, z2, ...]
  }

  velocities: {
    dx: Float32Array
    dy: Float32Array
    dz: Float32Array
  }
}

// SIMD最適化可能な処理
export const updatePositions = (
  storage: ComponentStorage,
  count: number,
  deltaTime: number
): void => {
  for (let i = 0; i < count; i++) {
    storage.positions.x[i] += storage.velocities.dx[i] * deltaTime
    storage.positions.y[i] += storage.velocities.dy[i] * deltaTime
    storage.positions.z[i] += storage.velocities.dz[i] * deltaTime
  }
}
```

### 原則7: エラーハンドリング

**タグ付きエラーによる型安全なエラー処理**

```typescript
import { Schema } from "effect"

// タグ付きエラーの定義
export interface ChunkGenerationError {
  readonly _tag: "ChunkGenerationError"
  readonly coordinate: ChunkCoordinate
  readonly reason: string
}

export const ChunkGenerationError = {
  create: (coordinate: ChunkCoordinate, reason: string): ChunkGenerationError => ({
    _tag: "ChunkGenerationError",
    coordinate,
    reason
  })
}

export interface NetworkError {
  readonly _tag: "NetworkError"
  readonly message: string
  readonly code: number
}

export const NetworkError = {
  create: (message: string, code: number): NetworkError => ({
    _tag: "NetworkError",
    message,
    code
  })
}

// エラーハンドリング
export const generateChunk = (
  coord: ChunkCoordinate
): Effect.Effect<Chunk, ChunkGenerationError | NetworkError> =>
  Effect.gen(function* () {
    const terrain = yield* generateTerrain(coord)
    const structures = yield* placeStructures(coord)
    return createChunk(terrain, structures)
  }).pipe(
    Effect.catchTag("ChunkGenerationError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Generation failed: ${error.reason}`)
        return yield* useDefaultChunk(coord)
      })
    )
  )
```

## 3. アンチパターン

### ❌ 避けるべきパターン

```typescript
// ❌ namespace の使用
namespace GameLogic {
  export function update() { }
}

// ❌ class の使用
class Player {
  private health: number
  takeDamage(amount: number) { }
}

// ❌ 可変状態
let gameState = { score: 0 }
gameState.score += 10

// ❌ 暗黙的な副作用
function saveGame(data: GameData) {
  localStorage.setItem('save', JSON.stringify(data))
  console.log('Saved!')
  return true
}
```

### ✅ 推奨パターン

```typescript
// ✅ モジュールレベルのエクスポート
export const update = () => Effect.Effect<void, UpdateError>

// ✅ インターフェースと関数
export interface Player {
  readonly health: number
}

export const takeDamage = (
  player: Player,
  amount: number
): Player => ({
  ...player,
  health: Math.max(0, player.health - amount)
})

// ✅ 不変データ
export const updateScore = (
  state: GameState,
  delta: number
): GameState => ({
  ...state,
  score: state.score + delta
})

// ✅ 明示的な副作用
export const saveGame = (
  data: GameData
): Effect.Effect<void, SaveError, LocalStorage> =>
  Effect.gen(function* () {
    const storage = yield* LocalStorage
    yield* storage.setItem('save', JSON.stringify(data))
    yield* Effect.log('Game saved')
  })
```

## 4. まとめ

これらの原則により：
- **予測可能性**: 純粋関数による決定論的な動作
- **保守性**: 明確な責任分離と依存性管理
- **パフォーマンス**: データ指向設計による最適化
- **型安全性**: Effect-TSによる完全な型推論
- **テスト容易性**: 副作用の分離による簡単なテスト