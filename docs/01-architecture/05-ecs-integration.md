# ECS (Entity Component System) 統合設計

TypeScript Minecraftプロジェクトでは、**Entity Component System (ECS)** を **Domain-Driven Design (DDD)** および **Effect-TS** と深く統合し、高性能で保守性の高いゲームエンジンを実現しています。

## 1. ECSアーキテクチャの哲学

### 設計原則
1.  **データとロジックの完全分離**: コンポーネントは純粋なデータ (`Schema.Struct`)、システムは純粋関数 (`Effect`) でロジックを実装します。
2.  **合成による柔軟性**: エンティティはコンポーネントの組み合わせによって振る舞いが決まります。継承は使用しません。
3.  **パフォーマンス第一**: Structure of Arrays (SoA) とアーキタイプによるメモリ最適化を徹底します。
4.  **型安全性**: Effect-TSの`Schema`を用いて、コンパイル時および実行時の型安全性を保証します。

### ECSの三要素
-   **エンティティ (Entity):** 単なる一意なID。状態や振る舞いを持ちません。
-   **コンポーネント (Component):** ゲームオブジェクトの状態を表す純粋なデータ構造。`Schema.Struct`で定義されます。
-   **システム (System):** 特定のコンポーネントを持つエンティティの集合に対してロジックを実行する純粋関数。

## 2. コンポーネント設計 (Component Design)

すべてのコンポーネントは`Schema.Struct`を用いて定義され、不変 (immutable) なデータ構造として扱われます。

```typescript
// コンポーネント定義 (Schema使用)
import { Schema, Effect } from "effect"

// ✅ Brand型でコンポーネントIDの型安全性向上
const ComponentId = Schema.String.pipe(Schema.brand("ComponentId"))
type ComponentId = Schema.Schema.Type<typeof ComponentId>

// ✅ Positionコンポーネント - 位置情報
export const PositionComponent = Schema.Struct({
  _tag: Schema.Literal("PositionComponent"),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  // ✅ メタデータ追加
  lastUpdated: Schema.Number.pipe(Schema.brand("Timestamp"))
})
export type PositionComponent = Schema.Schema.Type<typeof PositionComponent>

// ✅ Velocityコンポーネント - 速度情報（物理制約付き）
export const VelocityComponent = Schema.Struct({
  _tag: Schema.Literal("VelocityComponent"),
  dx: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-100), Schema.lessThanOrEqualTo(100)),
  dy: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-100), Schema.lessThanOrEqualTo(100)),
  dz: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-100), Schema.lessThanOrEqualTo(100)),
  // ✅ 物理パラメータ
  friction: Schema.Number.pipe(Schema.nonNegative(), Schema.lessThanOrEqualTo(1)),
  airResistance: Schema.Number.pipe(Schema.nonNegative(), Schema.lessThanOrEqualTo(1))
})
export type VelocityComponent = Schema.Schema.Type<typeof VelocityComponent>

// ✅ 新しいコンポーネントの例を追加
export const HealthComponent = Schema.Struct({
  _tag: Schema.Literal("HealthComponent"),
  current: Schema.Number.pipe(Schema.nonNegative()),
  max: Schema.Number.pipe(Schema.positive()),
  regenerationRate: Schema.Number.pipe(Schema.nonNegative())
})
export type HealthComponent = Schema.Schema.Type<typeof HealthComponent>
```

## 3. システム設計 (System Design)

システムは、特定のコンポーネントを持つエンティティをクエリし、それらのデータに対して操作を行う純粋関数です。副作用はすべて`Effect`型で管理されます。

```typescript
// システム定義
import { Effect, Context, Schema, ReadonlyArray } from "effect"

// ✅ EntityIDのBrand型定義
const EntityId = Schema.String.pipe(Schema.brand("EntityId"))
type EntityId = Schema.Schema.Type<typeof EntityId>

// ✅ SystemErrorの定義
const SystemError = Schema.Struct({
  _tag: Schema.Literal("SystemError"),
  systemName: Schema.String,
  entityId: Schema.optional(EntityId),
  reason: Schema.String
})
type SystemError = Schema.Schema.Type<typeof SystemError>

// ✅ Systemインターフェースの改善
export interface System {
  readonly name: string
  readonly requiredComponents: ReadonlyArray<string>
  readonly update: (deltaTime: number) => Effect.Effect<void, SystemError>
  readonly priority: number // ✅ 実行優先度追加
}

// ✅ ComponentStoreサービス定義
interface ComponentStoreInterface {
  readonly getComponent: <T>(entityId: EntityId, componentType: string) => Effect.Effect<T, SystemError>
  readonly setComponent: <T>(entityId: EntityId, componentType: string, component: T) => Effect.Effect<void, SystemError>
  readonly hasComponent: (entityId: EntityId, componentType: string) => Effect.Effect<boolean, SystemError>
}

const ComponentStore = Context.GenericTag<ComponentStoreInterface>("@app/ComponentStore")

// ✅ EntityQueryサービス定義
interface EntityQueryInterface {
  readonly queryEntities: (componentTypes: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<EntityId>, SystemError>
}

const EntityQuery = Context.GenericTag<EntityQueryInterface>("@app/EntityQuery")

// ✅ 純粋関数で移動計算（PBTテスト可能）
const calculateNewPosition = (
  position: PositionComponent,
  velocity: VelocityComponent,
  deltaTime: number
): PositionComponent => {
  // ✅ 物理制約を適用
  const friction = Math.pow(velocity.friction, deltaTime)
  const airResistance = Math.pow(velocity.airResistance, deltaTime)

  return {
    _tag: "PositionComponent",
    x: position.x + velocity.dx * deltaTime * friction * airResistance,
    y: position.y + velocity.dy * deltaTime * airResistance,
    z: position.z + velocity.dz * deltaTime * friction * airResistance,
    lastUpdated: Date.now() as any
  }
}

// ✅ 早期リターンパターンの活用
const validateMovementSystem = (
  deltaTime: number,
  entities: ReadonlyArray<EntityId>
): boolean => {
  // 早期リターン: deltaTimeが異常
  if (deltaTime <= 0 || deltaTime > 1) return false
  // 早期リターン: エンティティが空
  if (entities.length === 0) return false
  return true
}

// ✅ 改善されたMovement System
export const createMovementSystem = (): System => ({
  name: "MovementSystem",
  requiredComponents: ["PositionComponent", "VelocityComponent"],
  priority: 100, // 高優先度
  update: (deltaTime) =>
    Effect.gen(function* () {
      const entityQuery = yield* EntityQuery
      const componentStore = yield* ComponentStore

      const entities = yield* entityQuery.queryEntities(["PositionComponent", "VelocityComponent"])

      // 早期リターン: 入力検証
      if (!validateMovementSystem(deltaTime, entities)) {
        return yield* Effect.fail({
          _tag: "SystemError" as const,
          systemName: "MovementSystem",
          reason: "無効な入力パラメータ"
        })
      }

      // ✅ 並列処理でパフォーマンス向上
      yield* Effect.all(
        ReadonlyArray.map(entities, (entityId) =>
          Effect.gen(function* () {
            try {
              const position = yield* componentStore.getComponent<PositionComponent>(entityId, "PositionComponent")
              const velocity = yield* componentStore.getComponent<VelocityComponent>(entityId, "VelocityComponent")

              const newPosition = calculateNewPosition(position, velocity, deltaTime)
              yield* componentStore.setComponent(entityId, "PositionComponent", newPosition)
            } catch (error) {
              yield* Effect.fail({
                _tag: "SystemError" as const,
                systemName: "MovementSystem",
                entityId,
                reason: `エンティティの更新に失敗: ${error}`
              })
            }
          })
        ),
        { concurrency: "unbounded" }
      )
    })
})
```

## 4. パフォーマンス最適化

### 4.1. Structure of Arrays (SoA)

パフォーマンスを最大化するため、コンポーネントデータはStructure of Arrays (SoA) 形式でメモリに格納されます。これにより、キャッシュ効率が劇的に向上し、SIMD (Single Instruction, Multiple Data) による並列処理が可能になります。

```typescript
import { Schema } from "effect"

// ✅ Structure of Arrays (SoA) の型安全な定義
const ComponentStorage = Schema.Struct({
  // ✅ Position SoA - SIMD最適化対応
  positions: Schema.Struct({
    x: Schema.instanceOf(Float32Array),        // [x1, x2, x3, ...]
    y: Schema.instanceOf(Float32Array),        // [y1, y2, y3, ...]
    z: Schema.instanceOf(Float32Array),        // [z1, z2, z3, ...]
    lastUpdated: Schema.instanceOf(Float64Array) // [t1, t2, t3, ...]
  }),

  // ✅ Velocity SoA - 物理演算最適化
  velocities: Schema.Struct({
    dx: Schema.instanceOf(Float32Array),       // [dx1, dx2, dx3, ...]
    dy: Schema.instanceOf(Float32Array),       // [dy1, dy2, dy3, ...]
    dz: Schema.instanceOf(Float32Array),       // [dz1, dz2, dz3, ...]
    friction: Schema.instanceOf(Float32Array), // [f1, f2, f3, ...]
    airResistance: Schema.instanceOf(Float32Array) // [ar1, ar2, ar3, ...]
  }),

  // ✅ Health SoA - ゲームプレイ最適化
  health: Schema.Struct({
    current: Schema.instanceOf(Float32Array),     // [h1, h2, h3, ...]
    max: Schema.instanceOf(Float32Array),         // [max1, max2, max3, ...]
    regenerationRate: Schema.instanceOf(Float32Array) // [rr1, rr2, rr3, ...]
  }),

  // ✅ メタデータ
  entityCount: Schema.Number.pipe(Schema.nonNegative()),
  capacity: Schema.Number.pipe(Schema.positive()),
  version: Schema.Number.pipe(Schema.nonNegative()) // ✅ バージョン管理
})
export type ComponentStorage = Schema.Schema.Type<typeof ComponentStorage>

// ✅ 純粋関数でSoA操作（PBTテスト可能）
export const createComponentStorage = (capacity: number): ComponentStorage => ({
  positions: {
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    z: new Float32Array(capacity),
    lastUpdated: new Float64Array(capacity)
  },
  velocities: {
    dx: new Float32Array(capacity),
    dy: new Float32Array(capacity),
    dz: new Float32Array(capacity),
    friction: new Float32Array(capacity).fill(0.98), // デフォルト摩擦
    airResistance: new Float32Array(capacity).fill(0.99) // デフォルト空気抵抗
  },
  health: {
    current: new Float32Array(capacity).fill(100), // デフォルト体力
    max: new Float32Array(capacity).fill(100),
    regenerationRate: new Float32Array(capacity).fill(1)
  },
  entityCount: 0,
  capacity,
  version: 1
})

// ✅ SIMD最適化対応のバッチ処理
export const updatePositionsBatch = (
  storage: ComponentStorage,
  deltaTime: number,
  startIndex: number = 0,
  batchSize: number = 64 // ✅ キャッシュラインに最適化
): ComponentStorage => {
  const endIndex = Math.min(startIndex + batchSize, storage.entityCount)
  const currentTime = Date.now()

  // ✅ 不変性維持のため新しいストレージ作成
  const newStorage: ComponentStorage = {
    ...storage,
    positions: {
      x: new Float32Array(storage.positions.x),
      y: new Float32Array(storage.positions.y),
      z: new Float32Array(storage.positions.z),
      lastUpdated: new Float64Array(storage.positions.lastUpdated)
    },
    version: storage.version + 1
  }

  // ✅ ベクトル化可能なバッチ処理（SIMD最適化）
  for (let i = startIndex; i < endIndex; i++) {
    const friction = Math.pow(storage.velocities.friction[i], deltaTime)
    const airResistance = Math.pow(storage.velocities.airResistance[i], deltaTime)

    newStorage.positions.x[i] += storage.velocities.dx[i] * deltaTime * friction * airResistance
    newStorage.positions.y[i] += storage.velocities.dy[i] * deltaTime * airResistance
    newStorage.positions.z[i] += storage.velocities.dz[i] * deltaTime * friction * airResistance
    newStorage.positions.lastUpdated[i] = currentTime
  }

  return newStorage
}
```

### 4.2. アーキタイプ (Archetypes)

同じコンポーネントの組み合わせを持つエンティティは、「アーキタイプ」としてグループ化されます。システムはアーキタイプ単位で処理を行うため、条件分岐が不要になり、非常に高速なイテレーションが可能です。

```typescript
import { Effect, ReadonlyArray, Context } from "effect"

// ✅ アーキタイプ定義
const Archetype = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("ArchetypeId")),
  componentTypes: Schema.Array(Schema.String),
  storage: ComponentStorage,
  entityIds: Schema.Array(EntityId),
  count: Schema.Number.pipe(Schema.nonNegative())
})
type Archetype = Schema.Schema.Type<typeof Archetype>

// ✅ クエリ定義
const EntityQuery = Schema.Struct({
  all: Schema.Array(Schema.String),      // 必須コンポーネント
  any: Schema.optional(Schema.Array(Schema.String)), // いずれかのコンポーネント
  none: Schema.optional(Schema.Array(Schema.String)) // 除外コンポーネント
})
type EntityQuery = Schema.Schema.Type<typeof EntityQuery>

// ✅ 純粋関数でアーキタイプマッチング（PBTテスト可能）
const matchesQuery = (archetype: Archetype, query: EntityQuery): boolean => {
  // 早期リターン: all条件チェック
  if (!query.all.every(component => archetype.componentTypes.includes(component))) {
    return false
  }

  // 早期リターン: none条件チェック
  if (query.none && query.none.some(component => archetype.componentTypes.includes(component))) {
    return false
  }

  // 早期リターン: any条件チェック
  if (query.any && !query.any.some(component => archetype.componentTypes.includes(component))) {
    return false
  }

  return true
}

// ✅ アーキタイプサービス定義
interface ArchetypeStoreInterface {
  readonly queryArchetypes: (query: EntityQuery) => Effect.Effect<ReadonlyArray<Archetype>, SystemError>
  readonly getArchetype: (id: string) => Effect.Effect<Archetype | null, SystemError>
}

const ArchetypeStore = Context.GenericTag<ArchetypeStoreInterface>("@app/ArchetypeStore")

// ✅ 改善されたアーキタイプベースクエリ
const createMovableEntitiesQuery = (): EntityQuery => ({
  all: ["PositionComponent", "VelocityComponent"],
  none: ["FrozenComponent", "DisabledComponent"]
})

// ✅ アーキタイプベースの高速処理
export const processMovableArchetypes = (
  deltaTime: number
): Effect.Effect<void, SystemError> =>
  Effect.gen(function* () {
    const archetypeStore = yield* ArchetypeStore
    const query = createMovableEntitiesQuery()
    const archetypes = yield* archetypeStore.queryArchetypes(query)

    // 早期リターン: アーキタイプが空
    if (archetypes.length === 0) {
      yield* Effect.log("移動可能なアーキタイプが見つかりません")
      return
    }

    // ✅ 並列処理でアーキタイプを処理
    yield* Effect.all(
      ReadonlyArray.map(archetypes, (archetype) =>
        Effect.gen(function* () {
          // 早期リターン: エンティティが空
          if (archetype.count === 0) {
            return
          }

          // ✅ SIMD最適化されたバッチ処理
          const batchSize = 64 // キャッシュラインに最適化
          for (let i = 0; i < archetype.count; i += batchSize) {
            const endIndex = Math.min(i + batchSize, archetype.count)

            // バッチ内でベクトル化された処理
            for (let j = i; j < endIndex; j++) {
              const friction = Math.pow(archetype.storage.velocities.friction[j], deltaTime)
              const airResistance = Math.pow(archetype.storage.velocities.airResistance[j], deltaTime)

              // 位置更新（SIMD最適化対応）
              archetype.storage.positions.x[j] += archetype.storage.velocities.dx[j] * deltaTime * friction * airResistance
              archetype.storage.positions.y[j] += archetype.storage.velocities.dy[j] * deltaTime * airResistance
              archetype.storage.positions.z[j] += archetype.storage.velocities.dz[j] * deltaTime * friction * airResistance
              archetype.storage.positions.lastUpdated[j] = Date.now()
            }
          }

          // バージョン更新
          archetype.storage.version += 1
        })
      ),
      { concurrency: "unbounded" }
    )
  })
```

## 5. DDDとの統合

ECSは主にドメイン層とアプリケーション層で利用されます。

-   **ドメイン層:**
    -   コンポーネントの`Schema`を定義します。
    -   エンティティの概念を管理します。
-   **アプリケーション層:**
    -   システムを定義し、ドメインサービスを呼び出してビジネスロジックを実行します。
    -   クエリを実行して、特定のエンティティの集合を取得します。

この統合により、ドメインの関心事とゲームオブジェクトのデータ構造が明確に分離され、コードの保守性と拡張性が向上します。