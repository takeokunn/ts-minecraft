# 物理システム - 物理システム統合

## 概要

物理システムは、TypeScript Minecraftクローンにおける包括的な物理演算エンジンです。Effect-TS 3.x+の最新アーキテクチャとDomain-Driven Designの原則に基づき、リアルタイム物理シミュレーションを実現します。

### システム責務

- **重力システム**: 物体の自由落下、終端速度、落下ダメージ計算
- **衝突検出エンジン**: AABB、レイキャスト、複合形状の高性能衝突判定
- **エンティティ物理**: プレイヤー、モブ、アイテムの物理挙動
- **ブロック物理**: 重力ブロック、流体、爆発シミュレーション
- **空間最適化**: Spatial Grid/Octreeによる効率的な衝突検出
- **デバッグ可視化**: 物理演算状態のリアルタイム表示

### アーキテクチャ設計原則

- **純粋関数型**: 副作用の完全分離とテスタビリティの確保
- **ドメイン分離**: 物理法則をビジネスロジックから独立
- **高性能**: Structure of Arrays (SoA) とSIMD最適化
- **型安全性**: `Schema.Struct`による実行時検証
- **並行性**: Effect並行処理によるマルチスレッド対応
- **早期リターン**: 条件分岐での計算最適化

## アーキテクチャ概要

```
物理エンジン統合構成:
┌─────────────────────────────────────────┐
│ アプリケーション層                        │
│ - PlayerMoveUseCase                     │
│ - CollisionDetectionWorkflow            │
│ - PhysicsUpdateOrchestrator             │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ ドメイン層                               │
│ - PhysicsDomainService                  │
│ - CollisionSystemService                │
│ - SpatialGridSystemService              │
│ - GravitySystemService                  │
│ - RaycastSystemService                  │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ インフラストラクチャ層                      │
│ - SpatialGridAdapter                    │
│ - PhysicsRepository                     │
│ - SIMDCollisionAdapter                  │
└─────────────────────────────────────────┘
```

## ドメインモデル（最新Effect-TS + DDD）

### 値オブジェクト

```typescript
import { Effect, Layer, Context, Schema, pipe, Match, Option } from "effect"

// Vector3スキーマ定義（最新パターン）
export const Vector3D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
}).pipe(
  Schema.annotations({
    identifier: "Vector3D",
    description: "3次元ベクトル表現"
  })
)

export type Vector3D = Schema.Schema.Type<typeof Vector3D>

// AABB (Axis-Aligned Bounding Box) 統合定義
export const AABB = Schema.Struct({
  _tag: Schema.Literal("AABB"),
  minX: Schema.Number,
  minY: Schema.Number,
  minZ: Schema.Number,
  maxX: Schema.Number,
  maxY: Schema.Number,
  maxZ: Schema.Number
}).pipe(
  Schema.annotations({
    identifier: "AABB",
    description: "軸平行境界ボックス（衝突検知用）"
  })
)

export type AABB = Schema.Schema.Type<typeof AABB>

// 物理定数
export const PhysicsConstants = Schema.Struct({
  gravity: Schema.Number.pipe(Schema.between(-50, 0)),
  terminalVelocity: Schema.Number.pipe(Schema.positive()),
  friction: Schema.Number.pipe(Schema.between(0, 1)),
  airResistance: Schema.Number.pipe(Schema.between(0, 1)),
  bounciness: Schema.Number.pipe(Schema.between(0, 1)),
  timeStep: Schema.Number.pipe(Schema.positive())
}).pipe(
  Schema.annotations({
    identifier: "PhysicsConstants",
    description: "物理演算で使用する定数"
  })
)

export type PhysicsConstants = Schema.Schema.Type<typeof PhysicsConstants>
```

### エンティティ

```typescript
// エンティティID
export type EntityId = string & { readonly __brand: unique symbol }
export const EntityId = Schema.String.pipe(Schema.brand("EntityId"))

// 剛体エンティティ
export const RigidBody = Schema.Struct({
  entityId: EntityId,
  position: Vector3D,
  velocity: Vector3D,
  acceleration: Vector3D,
  mass: Schema.Number.pipe(Schema.positive()),
  bounds: AABB,
  isStatic: Schema.Boolean,
  hasGravity: Schema.Boolean,
  friction: Schema.Number,
  bounciness: Schema.Number,
  onGround: Schema.Boolean,
  inWater: Schema.Boolean,
  inLava: Schema.Boolean,
  lastUpdate: Schema.DateTimeUtc
}).pipe(
  Schema.annotations({
    identifier: "RigidBody",
    description: "物理演算対象の剛体エンティティ"
  })
)

export type RigidBody = Schema.Schema.Type<typeof RigidBody>

// 衝突情報
export const CollisionInfo = Schema.Struct({
  entityA: EntityId,
  entityB: EntityId,
  contactPoint: Vector3D,
  normal: Vector3D,
  penetration: Schema.Number,
  impulse: Schema.Number,
  timestamp: Schema.DateTimeUtc
}).pipe(
  Schema.annotations({
    identifier: "CollisionInfo",
    description: "衝突検出結果の詳細情報"
  })
)

export type CollisionInfo = Schema.Schema.Type<typeof CollisionInfo>
```

## AABB衝突検知システム

### AABB操作関数（純粋関数・早期リターン最適化）

```typescript
// AABB交差判定アルゴリズム（早期リターン最適化）
export const areAABBsIntersecting = (aabb1: AABB, aabb2: AABB): boolean => {
  // 早期リターンによる最適化
  if (aabb1.minX > aabb2.maxX || aabb1.maxX < aabb2.minX) return false
  if (aabb1.minY > aabb2.maxY || aabb1.maxY < aabb2.minY) return false
  if (aabb1.minZ > aabb2.maxZ || aabb1.maxZ < aabb2.minZ) return false
  return true
}

// AABB作成（純粋関数）
export const createAABB = (position: Vector3D, size: Vector3D): AABB => ({
  _tag: "AABB",
  minX: position.x - size.x / 2,
  minY: position.y - size.y / 2,
  minZ: position.z - size.z / 2,
  maxX: position.x + size.x / 2,
  maxY: position.y + size.y / 2,
  maxZ: position.z + size.z / 2
})

// AABB拡張
export const expandAABB = (aabb: AABB, expansion: number): AABB => ({
  ...aabb,
  minX: aabb.minX - expansion,
  minY: aabb.minY - expansion,
  minZ: aabb.minZ - expansion,
  maxX: aabb.maxX + expansion,
  maxY: aabb.maxY + expansion,
  maxZ: aabb.maxZ + expansion
})

// AABB統合（純粋関数）
export const mergeAABBs = (aabb1: AABB, aabb2: AABB): AABB => ({
  _tag: "AABB",
  minX: Math.min(aabb1.minX, aabb2.minX),
  minY: Math.min(aabb1.minY, aabb2.minY),
  minZ: Math.min(aabb1.minZ, aabb2.minZ),
  maxX: Math.max(aabb1.maxX, aabb2.maxX),
  maxY: Math.max(aabb1.maxY, aabb2.maxY),
  maxZ: Math.max(aabb1.maxZ, aabb2.maxZ)
})

// AABB中心点計算
export const getAABBCenter = (aabb: AABB): Vector3D => ({
  x: (aabb.minX + aabb.maxX) / 2,
  y: (aabb.minY + aabb.maxY) / 2,
  z: (aabb.minZ + aabb.maxZ) / 2
})

// AABB体積計算
export const calculateAABBVolume = (aabb: AABB): number => {
  const width = aabb.maxX - aabb.minX
  const height = aabb.maxY - aabb.minY
  const depth = aabb.maxZ - aabb.minZ
  return width * height * depth
}
```

## 重力シミュレーション

### 物理コンポーネント（最新Schema定義）

```typescript
// 速度コンポーネント
export const VelocityComponent = Schema.Struct({
  _tag: Schema.Literal("VelocityComponent"),
  velocity: Vector3D,
  maxSpeed: Schema.Number,
  damping: Schema.Number
}).pipe(
  Schema.annotations({
    identifier: "VelocityComponent",
    description: "エンティティの速度情報"
  })
)

export type VelocityComponent = Schema.Schema.Type<typeof VelocityComponent>

// 重力コンポーネント
export const GravityComponent = Schema.Struct({
  _tag: Schema.Literal("GravityComponent"),
  acceleration: Schema.Number,
  terminalVelocity: Schema.Number,
  enabled: Schema.Boolean
}).pipe(
  Schema.annotations({
    identifier: "GravityComponent",
    description: "重力による加速度情報"
  })
)

export type GravityComponent = Schema.Schema.Type<typeof GravityComponent>

// 衝突コンポーネント
export const ColliderComponent = Schema.Struct({
  _tag: Schema.Literal("ColliderComponent"),
  aabb: AABB,
  isSolid: Schema.Boolean,
  friction: Schema.Number,
  bounciness: Schema.Number
}).pipe(
  Schema.annotations({
    identifier: "ColliderComponent",
    description: "衝突検知用コンポーネント"
  })
)

export type ColliderComponent = Schema.Schema.Type<typeof ColliderComponent>

// 物理マテリアルコンポーネント（physics-engine.mdから統合）
export const PhysicsMaterialComponent = Schema.Struct({
  _tag: Schema.Literal("PhysicsMaterialComponent"),
  staticFriction: Schema.Number,
  dynamicFriction: Schema.Number,
  bounciness: Schema.Number,
  frictionCombine: Schema.Union(
    Schema.Literal("average"),
    Schema.Literal("multiply"),
    Schema.Literal("minimum"),
    Schema.Literal("maximum")
  ),
  bounceCombine: Schema.Union(
    Schema.Literal("average"),
    Schema.Literal("multiply"),
    Schema.Literal("minimum"),
    Schema.Literal("maximum")
  )
}).pipe(
  Schema.annotations({
    identifier: "PhysicsMaterialComponent",
    description: "物理マテリアル特性コンポーネント"
  })
)

export type PhysicsMaterialComponent = Schema.Schema.Type<typeof PhysicsMaterialComponent>

// リジッドボディコンポーネント（physics-engine.mdから統合）
export const RigidBodyComponent = Schema.Struct({
  _tag: Schema.Literal("RigidBodyComponent"),
  mass: Schema.Number,
  isKinematic: Schema.Boolean,
  useGravity: Schema.Boolean,
  drag: Schema.Number,
  angularDrag: Schema.Number
}).pipe(
  Schema.annotations({
    identifier: "RigidBodyComponent",
    description: "剛体物理特性コンポーネント"
  })
)

export type RigidBodyComponent = Schema.Schema.Type<typeof RigidBodyComponent>
```

### 物理計算システム（純粋関数）

```typescript
export const PhysicsSystem = {
  // 重力適用（純粋関数・早期リターン）
  applyGravity: (velocity: Vector3D, gravity: GravityComponent, deltaTime: number): Vector3D => {
    // 早期リターンで不要な計算を回避
    if (!gravity.enabled) return velocity

    const newY = velocity.y - gravity.acceleration * deltaTime
    const clampedY = Math.max(newY, -gravity.terminalVelocity)

    return { ...velocity, y: clampedY }
  },

  // 速度による位置更新
  updatePosition: (position: Vector3D, velocity: Vector3D, deltaTime: number): Vector3D => ({
    x: position.x + velocity.x * deltaTime,
    y: position.y + velocity.y * deltaTime,
    z: position.z + velocity.z * deltaTime
  }),

  // 減衰適用
  applyDamping: (velocity: Vector3D, damping: number, deltaTime: number): Vector3D => {
    const dampingFactor = Math.pow(1 - damping, deltaTime)
    return {
      x: velocity.x * dampingFactor,
      y: velocity.y * dampingFactor,
      z: velocity.z * dampingFactor
    }
  },

  // 最大速度制限（純粋関数・早期リターン）
  limitSpeed: (velocity: Vector3D, maxSpeed: number): Vector3D => {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z)
    // 早期リターンで不要な計算を回避
    if (speed <= maxSpeed) return velocity

    const scale = maxSpeed / Math.max(speed, Number.EPSILON) // ゼロ除算回避
    return {
      x: velocity.x * scale,
      y: velocity.y * scale,
      z: velocity.z * scale
    }
  }
}
```

## レイキャスティングシステム

### レイ定義（最新Schema）

```typescript
export const Ray = Schema.Struct({
  origin: Vector3D,
  direction: Vector3D
}).pipe(
  Schema.annotations({
    identifier: "Ray",
    description: "レイキャスト用レイ定義"
  })
)

export type Ray = Schema.Schema.Type<typeof Ray>

export const RaycastHit = Schema.Struct({
  hit: Schema.Boolean,
  point: Schema.NullishOr(Vector3D),
  distance: Schema.NullishOr(Schema.Number),
  normal: Schema.NullishOr(Vector3D),
  entity: Schema.NullishOr(EntityId)
}).pipe(
  Schema.annotations({
    identifier: "RaycastHit",
    description: "レイキャスト結果"
  })
)

export type RaycastHit = Schema.Schema.Type<typeof RaycastHit>
```

### レイキャスティング実装

```typescript
export const RaycastSystem = {
  // レイとAABBの交差判定
  rayIntersectsAABB: (ray: Ray, aabb: AABB): RaycastHit => {
    const invDir = {
      x: 1 / ray.direction.x,
      y: 1 / ray.direction.y,
      z: 1 / ray.direction.z
    }

    const t1 = (aabb.minX - ray.origin.x) * invDir.x
    const t2 = (aabb.maxX - ray.origin.x) * invDir.x
    const t3 = (aabb.minY - ray.origin.y) * invDir.y
    const t4 = (aabb.maxY - ray.origin.y) * invDir.y
    const t5 = (aabb.minZ - ray.origin.z) * invDir.z
    const t6 = (aabb.maxZ - ray.origin.z) * invDir.z

    const tMin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6))
    const tMax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6))

    if (tMax < 0 || tMin > tMax) {
      return { hit: false, point: null, distance: null, normal: null, entity: null }
    }

    const distance = tMin >= 0 ? tMin : tMax
    const hitPoint = {
      x: ray.origin.x + ray.direction.x * distance,
      y: ray.origin.y + ray.direction.y * distance,
      z: ray.origin.z + ray.direction.z * distance
    }

    return {
      hit: true,
      point: hitPoint,
      distance,
      normal: null, // 法線計算は別途実装
      entity: null
    }
  }
}
```

## Service層定義（最新Context.GenericTag）

### 物理ドメインサービス

```typescript
// PhysicsDomainServiceインターフェース
interface PhysicsDomainServiceInterface {
  readonly updatePhysics: (entities: ReadonlyArray<string>, deltaTime: number) => Effect.Effect<void, PhysicsError>
  readonly performCollisionDetection: (entities: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<CollisionInfo>, CollisionError>
  readonly resolveCollisions: (collisions: ReadonlyArray<CollisionInfo>) => Effect.Effect<void, CollisionError>
}

export const PhysicsDomainService = Context.GenericTag<PhysicsDomainServiceInterface>("@minecraft/PhysicsDomainService")

// SpatialGridSystemServiceインターフェース
interface SpatialGridSystemServiceInterface {
  readonly insertEntity: (entityId: string, aabb: AABB) => Effect.Effect<void, never>
  readonly removeEntity: (entityId: string) => Effect.Effect<void, never>
  readonly queryRange: (aabb: AABB) => Effect.Effect<Set<string>, never>
  readonly clear: () => Effect.Effect<void, never>
}

export const SpatialGridSystemService = Context.GenericTag<SpatialGridSystemServiceInterface>("@minecraft/SpatialGridSystemService")

// CollisionSystemServiceインターフェース
interface CollisionSystemServiceInterface {
  readonly broadPhaseDetection: (entities: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<[string, string]>, CollisionError>
  readonly narrowPhaseDetection: (entityPairs: ReadonlyArray<[string, string]>) => Effect.Effect<ReadonlyArray<CollisionInfo>, CollisionError>
  readonly resolveCollision: (collision: CollisionInfo) => Effect.Effect<void, CollisionError>
}

export const CollisionSystemService = Context.GenericTag<CollisionSystemServiceInterface>("@minecraft/CollisionSystemService")
```

### エラー定義（最新Schema）

```typescript
export class PhysicsError extends Schema.TaggedError("PhysicsError")<{
  readonly message: string
  readonly entityId?: string
  readonly timestamp: Date
}> {}

export class CollisionError extends Schema.TaggedError("CollisionError")<{
  readonly message: string
  readonly entities: ReadonlyArray<string>
  readonly timestamp: Date
}> {}

export type PhysicsError = Schema.Schema.Type<typeof PhysicsError>
export type CollisionError = Schema.Schema.Type<typeof CollisionError>
```

## 空間グリッド最適化システム

### 空間グリッド構造（最新Schema）

```typescript
export const SpatialCell = Schema.Struct({
  entities: Schema.Set(EntityId),
  lastUpdate: Schema.DateTimeUtc
}).pipe(
  Schema.annotations({
    identifier: "SpatialCell",
    description: "空間分割セル"
  })
)

export type SpatialCell = Schema.Schema.Type<typeof SpatialCell>

export const SpatialGrid = Schema.Struct({
  cellSize: Schema.Number,
  cells: Schema.Map(Schema.String, SpatialCell),
  bounds: AABB
}).pipe(
  Schema.annotations({
    identifier: "SpatialGrid",
    description: "空間分割グリッド構造"
  })
)

export type SpatialGrid = Schema.Schema.Type<typeof SpatialGrid>
```

### 空間グリッド操作（純粋関数）

```typescript
export const SpatialGridSystem = {
  // エンティティをグリッドに挿入
  insertEntity: (grid: SpatialGrid, entityId: string, aabb: AABB): SpatialGrid => {
    const minCellX = Math.floor(aabb.minX / grid.cellSize)
    const maxCellX = Math.floor(aabb.maxX / grid.cellSize)
    const minCellY = Math.floor(aabb.minY / grid.cellSize)
    const maxCellY = Math.floor(aabb.maxY / grid.cellSize)
    const minCellZ = Math.floor(aabb.minZ / grid.cellSize)
    const maxCellZ = Math.floor(aabb.maxZ / grid.cellSize)

    const newCells = new Map(grid.cells)

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
          const cellKey = `${x},${y},${z}`
          const existingCell = newCells.get(cellKey) || {
            entities: new Set(),
            lastUpdate: new Date()
          }

          const updatedEntities = new Set(existingCell.entities)
          updatedEntities.add(entityId as EntityId)

          newCells.set(cellKey, {
            entities: updatedEntities,
            lastUpdate: new Date()
          })
        }
      }
    }

    return { ...grid, cells: newCells }
  },

  // 範囲内のエンティティ取得（純粋関数）
  queryRange: (grid: SpatialGrid, aabb: AABB): Set<string> => {
    const entities = new Set<string>()

    const minCellX = Math.floor(aabb.minX / grid.cellSize)
    const maxCellX = Math.floor(aabb.maxX / grid.cellSize)
    const minCellY = Math.floor(aabb.minY / grid.cellSize)
    const maxCellY = Math.floor(aabb.maxY / grid.cellSize)
    const minCellZ = Math.floor(aabb.minZ / grid.cellSize)
    const maxCellZ = Math.floor(aabb.maxZ / grid.cellSize)

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
          const cellKey = `${x},${y},${z}`
          const cell = grid.cells.get(cellKey)
          if (cell) {
            cell.entities.forEach(id => entities.add(id as string))
          }
        }
      }
    }

    return entities
  }
}
```

## 物理更新ループ（最新Effect-TSパターン）

### 物理ドメインサービス実装

```typescript
const makePhysicsDomainService = Effect.gen(function* () {
  const spatialGrid = yield* SpatialGridSystemService
  const collisionSystem = yield* CollisionSystemService

  const updatePhysics = (entities: ReadonlyArray<string>, deltaTime: number) =>
    Effect.gen(function* () {
      // 1. 重力適用
      yield* Effect.forEach(
        entities,
        (entityId) => applyGravityToEntity(entityId, deltaTime),
        { discard: true, concurrency: "unbounded" }
      )

      // 2. 衝突検知
      const collisions = yield* performCollisionDetection(entities)

      // 3. 衝突解決
      yield* Effect.forEach(
        collisions,
        (collision) => collisionSystem.resolveCollision(collision),
        { discard: true, concurrency: 4 }
      )

      // 4. 位置更新
      yield* Effect.forEach(
        entities,
        (entityId) => updateEntityPosition(entityId, deltaTime),
        { discard: true, concurrency: "unbounded" }
      )
    })

  const performCollisionDetection = (entities: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      // Broad Phase: 空間グリッドを使用した高速検索
      const candidatePairs = yield* collisionSystem.broadPhaseDetection(entities)

      // Narrow Phase: 詳細な衝突判定
      const collisions = yield* collisionSystem.narrowPhaseDetection(candidatePairs)

      return collisions
    })

  return PhysicsDomainService.of({
    updatePhysics,
    performCollisionDetection,
    resolveCollisions: (collisions) =>
      Effect.forEach(
        collisions,
        (collision) => collisionSystem.resolveCollision(collision),
        { discard: true, concurrency: 4 }
      )
  })
})

export const PhysicsDomainServiceLive = Layer.effect(PhysicsDomainService, makePhysicsDomainService)
```

## レイキャスティング拡張実装

### ブロックレイキャスティング（Match.value活用）

```typescript
export const RaycastSystem = {
  // ... 既存実装

  // ブロックレイキャスティング（最新Effect-TSパターン）
  raycastBlocks: (ray: Ray, maxDistance: number) =>
    Effect.gen(function* () {
      const worldRepository = yield* WorldRepository
      let currentDistance = 0
      const stepSize = 0.1

      while (currentDistance < maxDistance) {
        const currentPoint = {
          x: ray.origin.x + ray.direction.x * currentDistance,
          y: ray.origin.y + ray.direction.y * currentDistance,
          z: ray.origin.z + ray.direction.z * currentDistance
        }

        // ブロック座標に変換
        const blockX = Math.floor(currentPoint.x)
        const blockY = Math.floor(currentPoint.y)
        const blockZ = Math.floor(currentPoint.z)

        // ブロック存在チェック
        const block = yield* worldRepository.getBlock(blockX, blockY, blockZ)

        // Match.valueでOption型を安全に処理
        const hitResult = Match.value(block).pipe(
          Match.when(Option.isSome, (some) =>
            some.value.isSolid ? Option.some({
              hit: true,
              point: currentPoint,
              distance: currentDistance,
              normal: calculateNormal(currentPoint, { x: blockX, y: blockY, z: blockZ }),
              entity: null
            }) : Option.none()
          ),
          Match.when(Option.isNone, () => Option.none()),
          Match.exhaustive
        )

        if (Option.isSome(hitResult)) {
          return hitResult.value
        }

        currentDistance += stepSize
      }

      return { hit: false, point: null, distance: null, normal: null, entity: null }
    })
}

// 法線ベクトル計算（純粋関数）
const calculateNormal = (hitPoint: Vector3D, blockPos: Vector3D): Vector3D => {
  const relativePos = {
    x: hitPoint.x - blockPos.x,
    y: hitPoint.y - blockPos.y,
    z: hitPoint.z - blockPos.z
  }

  // 最も近い面を特定
  const absX = Math.abs(relativePos.x - 0.5)
  const absY = Math.abs(relativePos.y - 0.5)
  const absZ = Math.abs(relativePos.z - 0.5)

  if (absX > absY && absX > absZ) {
    return { x: relativePos.x > 0.5 ? 1 : -1, y: 0, z: 0 }
  } else if (absY > absZ) {
    return { x: 0, y: relativePos.y > 0.5 ? 1 : -1, z: 0 }
  } else {
    return { x: 0, y: 0, z: relativePos.z > 0.5 ? 1 : -1 }
  }
}
```

## パフォーマンス最適化

### SIMD最適化とSoA（Structure of Arrays）

```typescript
// SoA実装によるSIMD最適化
export const PhysicsArrays = Schema.Struct({
  entityIds: Schema.Array(EntityId),
  positions: Schema.Array(Vector3D),
  velocities: Schema.Array(Vector3D),
  masses: Schema.Array(Schema.Number),
  // ... 他のプロパティ
}).pipe(
  Schema.annotations({
    identifier: "PhysicsArrays",
    description: "SIMD最適化用のStructure of Arrays"
  })
)

export type PhysicsArrays = Schema.Schema.Type<typeof PhysicsArrays>

// SIMD対応の物理演算（WebAssembly連携想定）
export const SIMDPhysicsSystem = {
  // ベクトル化された重力適用
  applyGravityBatch: (arrays: PhysicsArrays, deltaTime: number): PhysicsArrays => {
    // WebAssemblyやSIMD.jsによる高速化実装
    // 実際の実装ではSIMD命令を使用
    return {
      ...arrays,
      velocities: arrays.velocities.map((vel, i) => ({
        ...vel,
        y: vel.y - 9.81 * deltaTime
      }))
    }
  }
}
```

### パフォーマンス設定とモニタリング

```typescript
export const PhysicsConfig = Schema.Struct({
  spatialGridCellSize: Schema.Number.pipe(Schema.default(() => 4.0)),
  fixedTimeStep: Schema.Number.pipe(Schema.default(() => 1/60)),
  maxSubSteps: Schema.Number.pipe(Schema.default(() => 3)),
  collisionMargin: Schema.Number.pipe(Schema.default(() => 0.01)),
  maxCollisionIterations: Schema.Number.pipe(Schema.default(() => 10)),
  sleepThreshold: Schema.Number.pipe(Schema.default(() => 0.1)),
  sleepTimeThreshold: Schema.Number.pipe(Schema.default(() => 1.0)),
  // 新たに追加（physics-engine.mdから統合）
  broadPhaseEnabled: Schema.Boolean.pipe(Schema.default(() => true)),
  narrowPhaseEnabled: Schema.Boolean.pipe(Schema.default(() => true)),
  enableSIMD: Schema.Boolean.pipe(Schema.default(() => true)),
  maxEntitiesPerCell: Schema.Number.pipe(Schema.default(() => 16))
}).pipe(
  Schema.annotations({
    identifier: "PhysicsConfig",
    description: "物理エンジン設定"
  })
)

export type PhysicsConfig = Schema.Schema.Type<typeof PhysicsConfig>

export const PhysicsStats = Schema.Struct({
  totalEntities: Schema.Number,
  activeEntities: Schema.Number,
  collisionChecks: Schema.Number,
  collisionHits: Schema.Number,
  averageFrameTime: Schema.Number,
  spatialGridCells: Schema.Number,
  memoryUsage: Schema.Number,
  // 新たに追加（physics-engine.mdから統合）
  broadPhaseTime: Schema.Number,
  narrowPhaseTime: Schema.Number,
  integrationTime: Schema.Number,
  sleepingEntities: Schema.Number
}).pipe(
  Schema.annotations({
    identifier: "PhysicsStats",
    description: "物理エンジン統計情報"
  })
)

export type PhysicsStats = Schema.Schema.Type<typeof PhysicsStats>
```

## コンポーネントファクトリ（最新パターン）

```typescript
export const PhysicsComponentFactories = {
  createRigidBody: (options: Partial<Omit<RigidBody, 'entityId'>> = {}) => (entityId: string): RigidBody =>
    Schema.decodeUnknownSync(RigidBody)({
      entityId,
      position: options.position ?? { x: 0, y: 0, z: 0 },
      velocity: options.velocity ?? { x: 0, y: 0, z: 0 },
      acceleration: options.acceleration ?? { x: 0, y: 0, z: 0 },
      mass: options.mass ?? 1.0,
      bounds: options.bounds ?? createAABB({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }),
      isStatic: options.isStatic ?? false,
      hasGravity: options.hasGravity ?? true,
      friction: options.friction ?? 0.6,
      bounciness: options.bounciness ?? 0.0,
      onGround: options.onGround ?? false,
      inWater: options.inWater ?? false,
      inLava: options.inLava ?? false,
      lastUpdate: new Date()
    }),

  createVelocity: (initialVelocity: Vector3D = { x: 0, y: 0, z: 0 }): VelocityComponent =>
    Schema.decodeUnknownSync(VelocityComponent)({
      _tag: "VelocityComponent",
      velocity: initialVelocity,
      maxSpeed: 50.0,
      damping: 0.99
    }),

  createCollider: (size: Vector3D): ColliderComponent =>
    Schema.decodeUnknownSync(ColliderComponent)({
      _tag: "ColliderComponent",
      aabb: createAABB({ x: 0, y: 0, z: 0 }, size),
      isSolid: true,
      friction: 0.6,
      bounciness: 0.0
    }),

  // physics-engine.mdから統合された新しいファクトリ
  createRigidBodyComponent: (options: Partial<Omit<RigidBodyComponent, '_tag'>> = {}): RigidBodyComponent =>
    Schema.decodeUnknownSync(RigidBodyComponent)({
      _tag: "RigidBodyComponent",
      mass: options.mass ?? 1.0,
      isKinematic: options.isKinematic ?? false,
      useGravity: options.useGravity ?? true,
      drag: options.drag ?? 0.0,
      angularDrag: options.angularDrag ?? 0.05
    }),

  createPhysicsMaterial: (options: Partial<Omit<PhysicsMaterialComponent, '_tag'>> = {}): PhysicsMaterialComponent =>
    Schema.decodeUnknownSync(PhysicsMaterialComponent)({
      _tag: "PhysicsMaterialComponent",
      staticFriction: options.staticFriction ?? 0.6,
      dynamicFriction: options.dynamicFriction ?? 0.6,
      bounciness: options.bounciness ?? 0.0,
      frictionCombine: options.frictionCombine ?? "average",
      bounceCombine: options.bounceCombine ?? "average"
    })
}
```

## まとめ

この統合された物理システムは、以下の最新Effect-TSパターンを適用しています：

### 適用された最新パターン
- `Schema.Struct` 使用（Data.structから移行済み）
- `Context.GenericTag` によるサービス定義統一
- `Schema.decodeUnknownSync` による型安全な変換
- `Schema.annotations` によるメタデータ付与
- `Schema.Literal`, `Schema.Union`, `Schema.Array` などの最新API
- `Match.value` による関数型条件分岐
- 早期リターンパターンによる最適化
- 純粋関数設計とテスタビリティ確保

### 統合された技術的詳細
- **AABB衝突検知アルゴリズム**: 早期リターン最適化と純粋関数設計
- **レイキャスティングシステム**: ブロックレイキャストとエンティティレイキャスト
- **空間グリッド空間最適化**: Broad PhaseとNarrow Phaseの二段階検出
- **SIMD・SoA最適化対応**: Structure of Arraysによるベクトル化処理
- **パフォーマンスモニタリング**: リアルタイム統計とメモリ使用量監視
- **Sleep System**: 静止オブジェクトの計算スキップ最適化

### physics-engine.mdからの統合内容
以下の技術的詳細がphysics-engine.mdから統合されました：

1. **物理マテリアルシステム**: 摩擦と反発の組み合わせモード
2. **リジッドボディコンポーネント**: 質量、キネマティックモード、ドラッグ設定
3. **拡張パフォーマンス設定**: Broad/Narrow Phase切り替え、SIMD有効化
4. **統計情報の拡張**: 各フェーズの処理時間モニタリング

## パフォーマンス最適化戦略（physics-engine.mdから統合）

### 1. Spatial Partitioning
- **O(n²) から O(n) への衝突検知最適化**
- セルサイズの動的調整とエンティティ密度に基づく最適化

### 2. 二段階検出システム
```typescript
// Broad Phase: 粗い衝突候補の抜き出し
const broadPhaseDetection = (entities: ReadonlyArray<string>) => Effect.gen(function* () {
  const spatialGrid = yield* SpatialGridSystemService
  const candidatePairs: Array<[string, string]> = []

  for (const entityId of entities) {
    const aabb = yield* getEntityAABB(entityId)
    const neighbors = yield* spatialGrid.queryRange(aabb)

    for (const neighborId of neighbors) {
      if (entityId < neighborId) { // 重複回避
        candidatePairs.push([entityId, neighborId])
      }
    }
  }

  return candidatePairs
})

// Narrow Phase: 詳細な衝突判定
const narrowPhaseDetection = (pairs: ReadonlyArray<[string, string]>) => Effect.gen(function* () {
  const collisions: Array<CollisionInfo> = []

  yield* Effect.forEach(
    pairs,
    ([entityA, entityB]) => Effect.gen(function* () {
      const aabbA = yield* getEntityAABB(entityA)
      const aabbB = yield* getEntityAABB(entityB)

      if (areAABBsIntersecting(aabbA, aabbB)) {
        const collision = yield* calculateCollisionDetails(entityA, entityB, aabbA, aabbB)
        collisions.push(collision)
      }
    }),
    { concurrency: 4 }
  )

  return collisions
})
```

### 3. Sleep System
```typescript
const updateSleepState = (entity: RigidBody, deltaTime: number): RigidBody => {
  const speed = Math.sqrt(
    entity.velocity.x * entity.velocity.x +
    entity.velocity.y * entity.velocity.y +
    entity.velocity.z * entity.velocity.z
  )

  // 速度が闾値以下の場合、スリープ状態に移行
  if (speed < 0.1) {
    const sleepTime = entity.sleepTime + deltaTime
    if (sleepTime > 1.0) {
      return { ...entity, isSleeping: true, sleepTime }
    }
    return { ...entity, sleepTime }
  }

  return { ...entity, isSleeping: false, sleepTime: 0 }
}
```

### 4. メモリプールとオブジェクト再利用
```typescript
// オブジェクトプールでメモリ確保コストを減らす
class CollisionInfoPool {
  private pool: CollisionInfo[] = []

  acquire(): CollisionInfo {
    return this.pool.pop() || {
      entityA: "",
      entityB: "",
      contactPoint: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 0 },
      penetration: 0,
      impulse: 0,
      timestamp: new Date()
    }
  }

  release(collision: CollisionInfo): void {
    this.pool.push(collision)
  }
}
```

## まとめ

この統合された物理システムは、**physics-engine.mdの全ての技術的詳細を保持しながら**、Effect-TS 3.x+の最新アーキテクチャパターンとDDD原則を適用しています。Minecraft風ゲームに必要な全ての物理演算機能を提供し、高いパフォーマンスと保守性を実現しています。