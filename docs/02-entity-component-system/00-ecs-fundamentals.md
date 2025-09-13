# ECS基礎概念

## 1. Entity Component System とは

Entity Component System (ECS) は、ゲームオブジェクトを**Entity（エンティティ）**、**Component（コンポーネント）**、**System（システム）**の3つの要素に分離する、データ指向のアーキテクチャパターンです。

### 従来のOOPアプローチの問題点

```typescript
// ❌ 従来の継承ベースの設計（アンチパターン）
// GameObject -> Character -> Player
// GameObject -> Character -> Enemy -> FlyingEnemy
// GameObject -> Character -> Enemy -> SwimmingEnemy
// GameObject -> Character -> Enemy -> ??? // 多重継承の問題！

// クラス継承は柔軟性が低く、変更に弱い
```

### ECSアプローチの解決策

```typescript
// ✅ ECSによる合成ベースの設計
type Entity = EntityId

interface PositionComponent { x: number; y: number; z: number }
interface VelocityComponent { dx: number; dy: number; dz: number }
interface HealthComponent { current: number; max: number }
interface FlyingComponent { altitude: number; maxAltitude: number }
interface SwimmingComponent { underwaterTime: number; maxUnderwater: number }

// エンティティは必要なコンポーネントを自由に組み合わせる
const flyingSwimmingEnemy = createEntity([
  PositionComponent,
  VelocityComponent,
  HealthComponent,
  FlyingComponent,
  SwimmingComponent
])
```

## 2. ECSの三要素

### 2.1 Entity（エンティティ）

エンティティは単なる識別子（ID）です。データや振る舞いを持ちません。

```typescript
// エンティティの定義
export type EntityId = Branded<string, "EntityId">

export const EntityId = {
  generate: (): Effect.Effect<EntityId> =>
    Effect.sync(() => Brand.nominal<EntityId>()(uuid())),

  fromString: (value: string): Effect.Effect<EntityId, ValidationError> =>
    validateUuid(value).pipe(
      Effect.map(Brand.nominal<EntityId>())
    )
}

// エンティティマネージャー
export interface EntityManager {
  create: () => Effect.Effect<EntityId, CreationError>
  destroy: (id: EntityId) => Effect.Effect<void, DestructionError>
  exists: (id: EntityId) => Effect.Effect<boolean>
  count: () => Effect.Effect<number>
}
```

### 2.2 Component（コンポーネント）

コンポーネントは純粋なデータ構造です。ロジックを含みません。

```typescript
// コンポーネントの定義原則

// 1. 純粋なデータ構造
export interface PositionComponent {
  readonly x: number
  readonly y: number
  readonly z: number
}

// 2. 単一責任
export interface VelocityComponent {
  readonly dx: number
  readonly dy: number
  readonly dz: number
}

// 3. 直交性（独立性）
export interface HealthComponent {
  readonly current: number
  readonly max: number
}

// ❌ アンチパターン：複数の責任
type BadComponent = {
  position: { x: number; y: number; z: number }
  velocity: { dx: number; dy: number; dz: number }
  health: number
  mana: number
}

// ❌ アンチパターン：ロジックを含む
type BadComponent2 = {
  health: number
  takeDamage: (amount: number) => void // ロジックはシステムに
}
```

### 2.3 System（システム）

システムはコンポーネントを操作する純粋関数です。

```typescript
// システムの定義
export interface System<TComponents extends ComponentSet> {
  readonly name: SystemName
  readonly requiredComponents: ReadonlyArray<ComponentType>
  readonly update: (
    entities: ReadonlyArray<EntityId>,
    components: TComponents,
    deltaTime: number
  ) => Effect.Effect<void, SystemError>
}

// 移動システムの実装
export const MovementSystem: System<{
  position: ComponentStore<PositionComponent>
  velocity: ComponentStore<VelocityComponent>
}> = {
  name: "Movement",
  requiredComponents: ["Position", "Velocity"],

  update: (entities, { position, velocity }, deltaTime) =>
    Effect.gen(function* () {
      for (const entity of entities) {
        const pos = yield* position.get(entity)
        const vel = yield* velocity.get(entity)

        const newPosition = {
          x: pos.x + vel.dx * deltaTime,
          y: pos.y + vel.dy * deltaTime,
          z: pos.z + vel.dz * deltaTime
        }

        yield* position.set(entity, newPosition)
      }
    })
}
```

## 3. コンポーネントストレージ戦略

### 3.1 Array of Structures (AoS) - 非推奨

```typescript
// ❌ キャッシュ効率が悪い
interface EntityData {
  position: PositionComponent
  velocity: VelocityComponent
  health: HealthComponent
}

const entities: EntityData[] = []

// データがメモリ上で分散
// [pos1, vel1, health1] [pos2, vel2, health2] ...
```

### 3.2 Structure of Arrays (SoA) - 推奨

```typescript
// ✅ キャッシュ効率が良い
export interface ComponentStorage {
  // 各コンポーネント型ごとに連続したメモリレイアウト
  positions: {
    x: Float32Array  // [x1, x2, x3, ...]
    y: Float32Array  // [y1, y2, y3, ...]
    z: Float32Array  // [z1, z2, z3, ...]
  }

  velocities: {
    dx: Float32Array // [dx1, dx2, dx3, ...]
    dy: Float32Array // [dy1, dy2, dy3, ...]
    dz: Float32Array // [dz1, dz2, dz3, ...]
  }

  healths: {
    current: Uint16Array // [curr1, curr2, curr3, ...]
    max: Uint16Array     // [max1, max2, max3, ...]
  }

  // エンティティIDとインデックスのマッピング
  entityIndices: Map<EntityId, number>
}

// SIMDによる最適化が可能
export const updatePositionsSIMD = (
  storage: ComponentStorage,
  count: number,
  deltaTime: number
): void => {
  // 4つずつ並列処理（SIMD）
  for (let i = 0; i < count; i += 4) {
    // CPUのSIMD命令で4つの位置を同時更新
    storage.positions.x[i] += storage.velocities.dx[i] * deltaTime
    storage.positions.x[i+1] += storage.velocities.dx[i+1] * deltaTime
    storage.positions.x[i+2] += storage.velocities.dx[i+2] * deltaTime
    storage.positions.x[i+3] += storage.velocities.dx[i+3] * deltaTime
  }
}
```

## 4. クエリシステム

### 4.1 基本的なクエリ

```typescript
export interface Query {
  // 必須コンポーネント
  all?: ReadonlyArray<ComponentType>
  // いずれか1つ
  any?: ReadonlyArray<ComponentType>
  // 除外コンポーネント
  none?: ReadonlyArray<ComponentType>
}

// クエリの例
const movableEntities: Query = {
  all: ["Position", "Velocity"],
  none: ["Frozen", "Static"]
}

const damageable: Query = {
  all: ["Health"],
  any: ["Player", "Enemy", "Destructible"]
}
```

### 4.2 最適化されたクエリ実行

```typescript
export interface QueryExecutor {
  execute: <T>(query: Query) => Effect.Effect<QueryResult<T>, QueryError>
}

export interface QueryResult<T> {
  readonly entities: ReadonlyArray<EntityId>
  readonly components: T
  readonly count: number
}

// ビットマスクによる高速クエリ
export interface BitMaskQueryOptimizer {
  readonly componentMasks: ReadonlyMap<ComponentType, bigint>
  readonly entityMasks: ReadonlyMap<EntityId, bigint>
  readonly query: (all: bigint, any: bigint, none: bigint) => ReadonlyArray<EntityId>
}

export const createBitMaskQueryOptimizer = (): BitMaskQueryOptimizer => {
  const componentMasks = new Map<ComponentType, bigint>()
  const entityMasks = new Map<EntityId, bigint>()

  return {
    componentMasks,
    entityMasks,
    query: (all: bigint, any: bigint, none: bigint): ReadonlyArray<EntityId> => {
      const result: EntityId[] = []

      for (const [entity, mask] of entityMasks) {
        // すべての必須コンポーネントを持つ
        if ((mask & all) === all) {
          // 除外コンポーネントを持たない
          if ((mask & none) === 0n) {
            // 任意コンポーネントの少なくとも1つを持つ
            if (any === 0n || (mask & any) !== 0n) {
              result.push(entity)
            }
          }
        }
      }

      return result
    }
  }
}
```

## 5. システム実行順序

### 5.1 依存関係の定義

```typescript
export interface SystemDependencies {
  readonly before?: ReadonlyArray<SystemName>
  readonly after?: ReadonlyArray<SystemName>
  readonly priority?: number
}

export const systemOrder = {
  // 入力システム（最初）
  InputSystem: {
    priority: 1000
  },

  // 物理システム
  MovementSystem: {
    after: ["InputSystem"],
    priority: 900
  },

  CollisionSystem: {
    after: ["MovementSystem"],
    priority: 850
  },

  // ゲームロジック
  CombatSystem: {
    after: ["CollisionSystem"],
    priority: 700
  },

  AISystem: {
    after: ["CombatSystem"],
    priority: 600
  },

  // レンダリング（最後）
  RenderSystem: {
    after: ["AISystem"],
    priority: 100
  }
}
```

### 5.2 並列実行可能なシステムの識別

```typescript
export interface SystemScheduler {
  // システムの依存グラフを構築
  buildDependencyGraph: (
    systems: ReadonlyArray<System>
  ) => DependencyGraph

  // 並列実行可能なシステムグループを特定
  identifyParallelGroups: (
    graph: DependencyGraph
  ) => ReadonlyArray<SystemGroup>

  // システムを実行
  execute: (
    groups: ReadonlyArray<SystemGroup>
  ) => Effect.Effect<void, SystemError>
}

// 並列実行の例
export const parallelSystemExecution = Effect.gen(function* () {
  const groups = [
    // Group 1: 入力処理（単独）
    [InputSystem],

    // Group 2: 独立した物理システム（並列実行可能）
    [MovementSystem, GravitySystem, WindSystem],

    // Group 3: 衝突検出（単独）
    [CollisionSystem],

    // Group 4: ゲームロジック（並列実行可能）
    [HealthSystem, CombatSystem, AISystem],

    // Group 5: レンダリング（単独）
    [RenderSystem]
  ]

  for (const group of groups) {
    // グループ内のシステムを並列実行
    yield* Effect.all(
      group.map(system => system.update()),
      { concurrency: "unbounded" }
    )
  }
})
```

## 6. ECSとEffect-TSの統合

### 6.1 Effect型によるシステム定義

```typescript
export interface EffectSystem<R, E> {
  readonly name: SystemName
  readonly query: Query
  readonly update: (
    result: QueryResult
  ) => Effect.Effect<void, E, R>
}

// リソース依存を持つシステム
export const NetworkSyncSystem: EffectSystem<NetworkService, NetworkError> = {
  name: "NetworkSync",
  query: { all: ["NetworkId", "Position"] },

  update: (result) =>
    Effect.gen(function* () {
      const network = yield* NetworkService

      for (const entity of result.entities) {
        const position = result.components.position.get(entity)
        yield* network.syncPosition(entity, position)
      }
    })
}
```

### 6.2 Layerによるシステム構成

```typescript
export const ECSLayer = Layer.mergeAll(
  // コンポーネントストレージ
  ComponentStorageLive,

  // エンティティ管理
  EntityManagerLive,

  // クエリシステム
  QueryExecutorLive,

  // システムスケジューラー
  SystemSchedulerLive
)

export const GameSystemsLayer = Layer.mergeAll(
  // コアシステム
  MovementSystemLive,
  CollisionSystemLive,

  // ゲームプレイシステム
  CombatSystemLive,
  AISystemLive,

  // レンダリングシステム
  RenderSystemLive
)

// 完全なECS環境
export const CompleteECSLayer = Layer.provideMerge(
  ECSLayer,
  GameSystemsLayer
)
```

## 7. パフォーマンス最適化

### 7.1 ホットパスの最適化

```typescript
// ホットパス: 頻繁に実行される処理
export const optimizedMovementUpdate = (
  entityCount: number,
  positions: Float32Array,
  velocities: Float32Array,
  deltaTime: number
): void => {
  // ループアンローリング
  const remainder = entityCount % 4
  const limit = entityCount - remainder

  // 4要素ずつ処理（SIMD最適化）
  for (let i = 0; i < limit; i += 4) {
    const dt = deltaTime

    positions[i * 3] += velocities[i * 3] * dt
    positions[i * 3 + 1] += velocities[i * 3 + 1] * dt
    positions[i * 3 + 2] += velocities[i * 3 + 2] * dt

    positions[(i + 1) * 3] += velocities[(i + 1) * 3] * dt
    positions[(i + 1) * 3 + 1] += velocities[(i + 1) * 3 + 1] * dt
    positions[(i + 1) * 3 + 2] += velocities[(i + 1) * 3 + 2] * dt

    positions[(i + 2) * 3] += velocities[(i + 2) * 3] * dt
    positions[(i + 2) * 3 + 1] += velocities[(i + 2) * 3 + 1] * dt
    positions[(i + 2) * 3 + 2] += velocities[(i + 2) * 3 + 2] * dt

    positions[(i + 3) * 3] += velocities[(i + 3) * 3] * dt
    positions[(i + 3) * 3 + 1] += velocities[(i + 3) * 3 + 1] * dt
    positions[(i + 3) * 3 + 2] += velocities[(i + 3) * 3 + 2] * dt
  }

  // 残りの要素を処理
  for (let i = limit; i < entityCount; i++) {
    positions[i * 3] += velocities[i * 3] * deltaTime
    positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime
    positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime
  }
}
```

## 8. まとめ

ECSアーキテクチャにより：
- **柔軟性**: コンポーネントの自由な組み合わせ
- **パフォーマンス**: キャッシュ効率的なデータレイアウト
- **並列性**: システムの独立性による並列実行
- **保守性**: データとロジックの明確な分離

次のドキュメント：
- [01-archetype-system.md](./01-archetype-system.md) - アーキタイプシステムの詳細
- [02-soa-optimization.md](./02-soa-optimization.md) - SoA最適化技術