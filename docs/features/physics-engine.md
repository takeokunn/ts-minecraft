# 物理エンジン

TypeScript Minecraftの物理エンジンは、リアルタイム衝突検知、重力シミュレーション、及び空間最適化を提供する。Effect-TSを活用した関数型アプローチにより、予測可能で堅牢な物理計算を実現している。

## アーキテクチャ概要

```
物理エンジン構成:
┌─────────────────────────────────────────┐
│ アプリケーション層                        │
│ - PlayerMoveUseCase                     │
│ - CollisionDetectionWorkflow            │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ ドメイン層                               │
│ - PhysicsDomainService                  │
│ - CollisionSystemService                │
│ - SpatialGridSystemService              │
│ - PhysicsComponents                     │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ インフラストラクチャ層                      │
│ - SpatialGridAdapter                    │
│ - PhysicsRepository                     │
└─────────────────────────────────────────┘
```

## AABB衝突検知

### AABB (Axis-Aligned Bounding Box) 定義

```typescript
const AABB = Schema.Struct({
  _tag: Schema.Literal("AABB"),
  minX: Schema.Number,
  minY: Schema.Number,
  minZ: Schema.Number,
  maxX: Schema.Number,
  maxY: Schema.Number,
  maxZ: Schema.Number,
})

type AABB = Schema.Schema.Type<typeof AABB>
```

### 交差判定アルゴリズム

```typescript
// 純粋関数で早期リターン最適化
const areAABBsIntersecting = (aabb1: AABB, aabb2: AABB): boolean => {
  if (aabb1.minX > aabb2.maxX || aabb1.maxX < aabb2.minX) return false
  if (aabb1.minY > aabb2.maxY || aabb1.maxY < aabb2.minY) return false
  if (aabb1.minZ > aabb2.maxZ || aabb1.maxZ < aabb2.minZ) return false
  return true
}
```

### AABB操作関数

```typescript
// AABB作成（純粋関数）
const createAABB = (position: Vector3, size: Vector3): AABB => ({
  _tag: "AABB",
  minX: position.x - size.x / 2,
  minY: position.y - size.y / 2,
  minZ: position.z - size.z / 2,
  maxX: position.x + size.x / 2,
  maxY: position.y + size.y / 2,
  maxZ: position.z + size.z / 2,
})

// AABB拡張
const expandAABB = (aabb: AABB, expansion: number): AABB => ({
  ...aabb,
  minX: aabb.minX - expansion,
  minY: aabb.minY - expansion,
  minZ: aabb.minZ - expansion,
  maxX: aabb.maxX + expansion,
  maxY: aabb.maxY + expansion,
  maxZ: aabb.maxZ + expansion,
})

// AABB統合（純粋関数）
const mergeAABBs = (aabb1: AABB, aabb2: AABB): AABB => ({
  _tag: "AABB",
  minX: Math.min(aabb1.minX, aabb2.minX),
  minY: Math.min(aabb1.minY, aabb2.minY),
  minZ: Math.min(aabb1.minZ, aabb2.minZ),
  maxX: Math.max(aabb1.maxX, aabb2.maxX),
  maxY: Math.max(aabb1.maxY, aabb2.maxY),
  maxZ: Math.max(aabb1.maxZ, aabb2.maxZ),
})

// AABB中心点計算
const getAABBCenter = (aabb: AABB): Vector3 => ({
  x: (aabb.minX + aabb.maxX) / 2,
  y: (aabb.minY + aabb.maxY) / 2,
  z: (aabb.minZ + aabb.maxZ) / 2,
})

// AABB体積計算
const calculateAABBVolume = (aabb: AABB): number => {
  const width = aabb.maxX - aabb.minX
  const height = aabb.maxY - aabb.minY
  const depth = aabb.maxZ - aabb.minZ
  return width * height * depth
}
```

## 重力と速度計算

### 物理コンポーネント

```typescript
// Vector3スキーマ定義
const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

// 速度コンポーネント
const VelocityComponent = Schema.Struct({
  _tag: Schema.Literal("VelocityComponent"),
  velocity: Vector3Schema,
  maxSpeed: Schema.Number,
  damping: Schema.Number,
})
type VelocityComponent = Schema.Schema.Type<typeof VelocityComponent>

// 重力コンポーネント
const GravityComponent = Schema.Struct({
  _tag: Schema.Literal("GravityComponent"),
  acceleration: Schema.Number,
  terminalVelocity: Schema.Number,
  enabled: Schema.Boolean,
})
type GravityComponent = Schema.Schema.Type<typeof GravityComponent>

// 衝突コンポーネント
const ColliderComponent = Schema.Struct({
  _tag: Schema.Literal("ColliderComponent"),
  aabb: AABB,
  isSolid: Schema.Boolean,
  friction: Schema.Number,
  bounciness: Schema.Number,
})
type ColliderComponent = Schema.Schema.Type<typeof ColliderComponent>
```

### 物理計算システム

```typescript
const PhysicsSystem = {
  // 重力適用（純粋関数）
  applyGravity: (velocity: Vector3, gravity: GravityComponent, deltaTime: number): Vector3 => {
    // 早期リターンで不要な計算を回避
    if (!gravity.enabled) return velocity

    const newY = velocity.y - gravity.acceleration * deltaTime
    const clampedY = Math.max(newY, -gravity.terminalVelocity)

    return { ...velocity, y: clampedY }
  },

  // 速度による位置更新
  updatePosition: (position: Vector3, velocity: Vector3, deltaTime: number): Vector3 => ({
    x: position.x + velocity.x * deltaTime,
    y: position.y + velocity.y * deltaTime,
    z: position.z + velocity.z * deltaTime,
  }),

  // 減衰適用
  applyDamping: (velocity: Vector3, damping: number, deltaTime: number): Vector3 => {
    const dampingFactor = Math.pow(1 - damping, deltaTime)
    return {
      x: velocity.x * dampingFactor,
      y: velocity.y * dampingFactor,
      z: velocity.z * dampingFactor,
    }
  },

  // 最大速度制限（純粋関数）
  limitSpeed: (velocity: Vector3, maxSpeed: number): Vector3 => {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z)
    // 早期リターンで不要な計算を回避
    if (speed <= maxSpeed) return velocity

    const scale = maxSpeed / Math.max(speed, Number.EPSILON) // ゼロ除算回避
    return {
      x: velocity.x * scale,
      y: velocity.y * scale,
      z: velocity.z * scale,
    }
  }
}
```

### 物理更新ループ

```typescript
const PhysicsDomainService = {
  updatePhysics: (entities: ReadonlyArray<EntityId>, deltaTime: number) =>
    Effect.gen(function* () {
      // 重力適用
      for (const entityId of entities) {
        const velocity = yield* getComponent(entityId, 'velocity')
        const gravity = yield* getComponent(entityId, 'gravity')
        
        if (velocity && gravity) {
          const newVelocity = PhysicsSystem.applyGravity(velocity.velocity, gravity, deltaTime)
          yield* updateComponent(entityId, 'velocity', { ...velocity, velocity: newVelocity })
        }
      }

      // 衝突検知
      yield* performCollisionDetection(entities)

      // 位置更新
      for (const entityId of entities) {
        const position = yield* getComponent(entityId, 'position')
        const velocity = yield* getComponent(entityId, 'velocity')
        
        if (position && velocity) {
          const newPosition = PhysicsSystem.updatePosition(position.position, velocity.velocity, deltaTime)
          yield* updateComponent(entityId, 'position', { ...position, position: newPosition })
        }
      }
    })
}
```

## レイキャスティング

### レイ定義

```typescript
interface Ray {
  readonly origin: Vector3
  readonly direction: Vector3
}

interface RaycastHit {
  readonly hit: boolean
  readonly point?: Vector3
  readonly distance?: number
  readonly normal?: Vector3
  readonly entity?: EntityId
}
```

### レイキャスティング実装

```typescript
const RaycastSystem = {
  // レイとAABBの交差判定
  rayIntersectsAABB: (ray: Ray, aabb: AABB): RaycastHit => {
    const invDir = {
      x: 1 / ray.direction.x,
      y: 1 / ray.direction.y,
      z: 1 / ray.direction.z,
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
      return { hit: false }
    }

    const distance = tMin >= 0 ? tMin : tMax
    const hitPoint = {
      x: ray.origin.x + ray.direction.x * distance,
      y: ray.origin.y + ray.direction.y * distance,
      z: ray.origin.z + ray.direction.z * distance,
    }

    return {
      hit: true,
      point: hitPoint,
      distance,
    }
  },

  // ブロックレイキャスティング
  raycastBlocks: (ray: Ray, maxDistance: number): Effect.Effect<RaycastHit> =>
    Effect.gen(function* () {
      const worldRepository = yield* WorldRepositoryPort
      let currentDistance = 0
      const stepSize = 0.1

      while (currentDistance < maxDistance) {
        const currentPoint = {
          x: ray.origin.x + ray.direction.x * currentDistance,
          y: ray.origin.y + ray.direction.y * currentDistance,
          z: ray.origin.z + ray.direction.z * currentDistance,
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

      return { hit: false }
    })
}
```

## Spatial Gridによる最適化

### Spatial Grid構造

```typescript
interface SpatialGrid {
  readonly cellSize: number
  readonly cells: Map<string, Set<EntityId>>
}

const SpatialGridSystem = {
  // エンティティをグリッドに挿入
  insertEntity: (grid: SpatialGrid, entityId: EntityId, aabb: AABB): SpatialGrid => {
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
          const cell = newCells.get(cellKey) || new Set()
          cell.add(entityId)
          newCells.set(cellKey, cell)
        }
      }
    }

    return { ...grid, cells: newCells }
  },

  // 範囲内のエンティティ取得
  queryRange: (grid: SpatialGrid, aabb: AABB): Set<EntityId> => {
    const entities = new Set<EntityId>()
    
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
            cell.forEach(id => entities.add(id))
          }
        }
      }
    }

    return entities
  }
}
```

### 衝突最適化システム

```typescript
const spatialGridSystem = Effect.gen(function* () {
  const worldRepository = yield* WorldRepositoryPort
  const spatialGrid = yield* SpatialGridPort

  // グリッドクリア
  yield* spatialGrid.clear()

  // 位置と衝突コンポーネントを持つエンティティを取得
  const queryResult = yield* worldRepository.query(['position', 'collider'])
  const entities = queryResult.entities

  // エンティティをSpatial Gridに挿入
  yield* Effect.forEach(
    entities,
    (entityId) => {
      const position = queryResult.getComponent(entityId, 'position')
      const collider = queryResult.getComponent(entityId, 'collider')

      if (position && collider) {
        const aabb = createAABB(position, collider)
        return spatialGrid.insert(entityId, aabb)
      }
      return Effect.void
    },
    { discard: true, concurrency: 'unbounded' }
  )
})
```

## 物理コンポーネント

### コンポーネント定義

```typescript
// リジッドボディコンポーネント
interface RigidBodyComponent {
  readonly _tag: 'RigidBodyComponent'
  readonly mass: number
  readonly isKinematic: boolean
  readonly useGravity: boolean
  readonly drag: number
  readonly angularDrag: number
}

// 物理マテリアルコンポーネント
interface PhysicsMaterialComponent {
  readonly _tag: 'PhysicsMaterialComponent' 
  readonly staticFriction: number
  readonly dynamicFriction: number
  readonly bounciness: number
  readonly frictionCombine: 'average' | 'multiply' | 'minimum' | 'maximum'
  readonly bounceCombine: 'average' | 'multiply' | 'minimum' | 'maximum'
}
```

### コンポーネントファクトリ

```typescript
const PhysicsComponentFactories = {
  createRigidBody: (options: Partial<RigidBodyComponent> = {}): RigidBodyComponent => ({
    _tag: 'RigidBodyComponent',
    mass: options.mass ?? 1.0,
    isKinematic: options.isKinematic ?? false,
    useGravity: options.useGravity ?? true,
    drag: options.drag ?? 0.0,
    angularDrag: options.angularDrag ?? 0.05,
  }),

  createVelocity: (initialVelocity: Vector3 = { x: 0, y: 0, z: 0 }): VelocityComponent => ({
    _tag: 'VelocityComponent',
    velocity: initialVelocity,
    maxSpeed: 50.0,
    damping: 0.99,
  }),

  createCollider: (size: Vector3): ColliderComponent => ({
    _tag: 'ColliderComponent',
    aabb: createAABB({ x: 0, y: 0, z: 0 }, size),
    isSolid: true,
    friction: 0.6,
    bounciness: 0.0,
  })
}
```

## パフォーマンス最適化

### 最適化戦略

1. **Spatial Partitioning**: O(n²) から O(n) への衝突検知最適化
2. **Broad Phase Detection**: AABB による粗い衝突判定
3. **Narrow Phase Detection**: 詳細な衝突解決
4. **Sleep System**: 静止オブジェクトの計算スキップ

### 統計とモニタリング

```typescript
interface PhysicsStats {
  readonly totalEntities: number
  readonly activeEntities: number
  readonly collisionChecks: number
  readonly collisionHits: number
  readonly averageFrameTime: number
  readonly spatialGridCells: number
  readonly memoryUsage: number
}
```

### パフォーマンス設定

```typescript
const PhysicsConfig = {
  // Spatial Grid設定
  spatialGridCellSize: 4.0,
  
  // 物理更新設定
  fixedTimeStep: 1/60,        // 60 FPS
  maxSubSteps: 3,
  
  // 衝突設定
  collisionMargin: 0.01,
  maxCollisionIterations: 10,
  
  // 最適化設定
  sleepThreshold: 0.1,
  sleepTimeThreshold: 1.0,
}
```

この物理エンジンは、Effect-TSの型安全性とパフォーマンスを活かし、リアルタイムゲームに必要な物理計算を効率的に処理する。Spatial Gridによる空間分割とAABB衝突検知により、多数のオブジェクトでも高いパフォーマンスを維持している。