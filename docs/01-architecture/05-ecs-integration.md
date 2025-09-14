---
title: "ECS統合実装ガイド"
description: "Entity Component SystemとEffect-TSの統合実装方法"
category: "guide"
difficulty: "advanced"
tags: ["ecs", "entity-component-system", "performance", "implementation"]
prerequisites: ["effect-ts-patterns", "design-principles", "data-structures"]
estimated_reading_time: "25分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# ECS統合実装ガイド

## 🧭 ナビゲーション

> **📍 現在位置**: [ホーム](../README.md) → [アーキテクチャ](./README.md) → **ECS統合実装**
>
> **🎯 学習目標**: ECSパターンとEffect-TSの実践的な統合方法
>
> **⏱️ 所要時間**: 25分
>
> **📚 前提知識**: [設計原則](./01-design-principles.md) → [Effect-TSパターン](./06-effect-ts-patterns.md)

### 📋 関連ドキュメント
- **概念説明**: [アーキテクチャ概要](./00-overall-design.md)
- **実装パターン**: [Effect-TSパターン](./06-effect-ts-patterns.md)
- **実践例**: [ECS実装例](../06-examples/README.md)

---

## 1. ECSとEffect-TSの統合アプローチ

### 1.1 基本的な統合構造

```typescript
import { Effect, Context, Layer, Schema } from "effect"

// コンポーネントの定義（Schema駆動）
const PositionComponent = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

const VelocityComponent = Schema.Struct({
  vx: Schema.Number,
  vy: Schema.Number,
  vz: Schema.Number
})

// エンティティの型定義
interface Entity {
  readonly id: EntityId
  readonly components: ComponentMap
}

// システムインターフェース
interface System<R = never, E = never> {
  readonly name: string
  readonly update: (
    entities: ReadonlyArray<Entity>,
    deltaTime: number
  ) => Effect.Effect<ReadonlyArray<Entity>, E, R>
}
```

### 1.2 コンポーネントストレージ最適化

```typescript
// Structure of Arrays (SoA) パターン
class ComponentStorage<T> {
  private dense: T[] = []
  private sparse: Map<EntityId, number> = new Map()

  add(entityId: EntityId, component: T): void {
    const index = this.dense.length
    this.dense.push(component)
    this.sparse.set(entityId, index)
  }

  get(entityId: EntityId): T | undefined {
    const index = this.sparse.get(entityId)
    return index !== undefined ? this.dense[index] : undefined
  }

  remove(entityId: EntityId): void {
    const index = this.sparse.get(entityId)
    if (index !== undefined) {
      // Swap and remove for O(1) deletion
      const lastIndex = this.dense.length - 1
      if (index !== lastIndex) {
        this.dense[index] = this.dense[lastIndex]
        // Update sparse array for swapped element
        const swappedEntityId = this.findEntityByIndex(lastIndex)
        if (swappedEntityId) {
          this.sparse.set(swappedEntityId, index)
        }
      }
      this.dense.pop()
      this.sparse.delete(entityId)
    }
  }

  private findEntityByIndex(index: number): EntityId | undefined {
    for (const [entityId, idx] of this.sparse.entries()) {
      if (idx === index) return entityId
    }
    return undefined
  }

  // イテレータ for システム処理
  *iterate(): Generator<[EntityId, T]> {
    for (const [entityId, index] of this.sparse.entries()) {
      yield [entityId, this.dense[index]]
    }
  }
}
```

## 2. システム実装パターン

### 2.1 純粋関数システム

```typescript
// 移動システム（純粋関数）
const MovementSystem: System = {
  name: "Movement",
  update: (entities, deltaTime) =>
    Effect.succeed(
      entities.map(entity => {
        const position = entity.components.get("Position") as typeof PositionComponent.Type
        const velocity = entity.components.get("Velocity") as typeof VelocityComponent.Type

        if (!position || !velocity) return entity

        const newPosition = {
          x: position.x + velocity.vx * deltaTime,
          y: position.y + velocity.vy * deltaTime,
          z: position.z + velocity.vz * deltaTime
        }

        return {
          ...entity,
          components: new Map([
            ...entity.components,
            ["Position", newPosition]
          ])
        }
      })
    )
}
```

### 2.2 依存性を持つシステム

```typescript
// 物理システム（外部サービス依存）
class PhysicsEngine extends Context.GenericTag("PhysicsEngine")<
  PhysicsEngine,
  {
    readonly calculateCollisions: (
      entities: ReadonlyArray<Entity>
    ) => Effect.Effect<CollisionResult[]>
    readonly applyForces: (
      entity: Entity,
      forces: Force[]
    ) => Entity
  }
>() {}

const PhysicsSystem: System<PhysicsEngine> = {
  name: "Physics",
  update: (entities, deltaTime) =>
    Effect.gen(function* () {
      const physics = yield* PhysicsEngine
      const collisions = yield* physics.calculateCollisions(entities)

      return entities.map(entity => {
        const collision = collisions.find(c => c.entityId === entity.id)
        if (!collision) return entity

        return physics.applyForces(entity, collision.forces)
      })
    })
}
```

## 3. クエリシステム

### 3.1 コンポーネントクエリ

```typescript
class EntityQuery {
  constructor(
    private readonly requiredComponents: Set<string>,
    private readonly excludedComponents: Set<string> = new Set()
  ) {}

  matches(entity: Entity): boolean {
    // 必須コンポーネントをすべて持つか
    for (const component of this.requiredComponents) {
      if (!entity.components.has(component)) return false
    }

    // 除外コンポーネントを持たないか
    for (const component of this.excludedComponents) {
      if (entity.components.has(component)) return false
    }

    return true
  }

  filter(entities: ReadonlyArray<Entity>): ReadonlyArray<Entity> {
    return entities.filter(e => this.matches(e))
  }
}

// クエリビルダー
class QueryBuilder {
  private required: Set<string> = new Set()
  private excluded: Set<string> = new Set()

  with(...components: string[]): this {
    components.forEach(c => this.required.add(c))
    return this
  }

  without(...components: string[]): this {
    components.forEach(c => this.excluded.add(c))
    return this
  }

  build(): EntityQuery {
    return new EntityQuery(this.required, this.excluded)
  }
}

// 使用例
const movableEntities = new QueryBuilder()
  .with("Position", "Velocity")
  .without("Static")
  .build()
```

### 3.2 空間インデックス

```typescript
// 空間ハッシュによる高速検索
class SpatialIndex {
  private grid: Map<string, Set<EntityId>> = new Map()
  private cellSize: number

  constructor(cellSize: number = 16) {
    this.cellSize = cellSize
  }

  private getKey(x: number, y: number, z: number): string {
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    const cz = Math.floor(z / this.cellSize)
    return `${cx},${cy},${cz}`
  }

  insert(entityId: EntityId, position: Position): void {
    const key = this.getKey(position.x, position.y, position.z)
    let cell = this.grid.get(key)
    if (!cell) {
      cell = new Set()
      this.grid.set(key, cell)
    }
    cell.add(entityId)
  }

  remove(entityId: EntityId, position: Position): void {
    const key = this.getKey(position.x, position.y, position.z)
    const cell = this.grid.get(key)
    if (cell) {
      cell.delete(entityId)
      if (cell.size === 0) {
        this.grid.delete(key)
      }
    }
  }

  getNearby(
    position: Position,
    radius: number
  ): Set<EntityId> {
    const result = new Set<EntityId>()
    const cellRadius = Math.ceil(radius / this.cellSize)

    const centerX = Math.floor(position.x / this.cellSize)
    const centerY = Math.floor(position.y / this.cellSize)
    const centerZ = Math.floor(position.z / this.cellSize)

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          const key = `${centerX + dx},${centerY + dy},${centerZ + dz}`
          const cell = this.grid.get(key)
          if (cell) {
            cell.forEach(id => result.add(id))
          }
        }
      }
    }

    return result
  }
}
```

## 4. アーキタイプシステム

### 4.1 アーキタイプ定義

```typescript
// アーキタイプ: 同じコンポーネント構成を持つエンティティのグループ
class Archetype {
  private entities: EntityId[] = []
  private componentTypes: Set<string>
  private componentArrays: Map<string, any[]> = new Map()

  constructor(componentTypes: string[]) {
    this.componentTypes = new Set(componentTypes)
    componentTypes.forEach(type => {
      this.componentArrays.set(type, [])
    })
  }

  matches(components: Set<string>): boolean {
    if (components.size !== this.componentTypes.size) return false
    for (const type of components) {
      if (!this.componentTypes.has(type)) return false
    }
    return true
  }

  addEntity(entityId: EntityId, components: Map<string, any>): void {
    const index = this.entities.length
    this.entities.push(entityId)

    for (const [type, array] of this.componentArrays) {
      array.push(components.get(type))
    }
  }

  removeEntity(entityId: EntityId): void {
    const index = this.entities.indexOf(entityId)
    if (index === -1) return

    // Swap and remove
    const lastIndex = this.entities.length - 1
    if (index !== lastIndex) {
      this.entities[index] = this.entities[lastIndex]
      for (const array of this.componentArrays.values()) {
        array[index] = array[lastIndex]
      }
    }

    this.entities.pop()
    for (const array of this.componentArrays.values()) {
      array.pop()
    }
  }

  // キャッシュ効率的なイテレーション
  forEach(
    callback: (entityId: EntityId, components: Map<string, any>) => void
  ): void {
    for (let i = 0; i < this.entities.length; i++) {
      const components = new Map<string, any>()
      for (const [type, array] of this.componentArrays) {
        components.set(type, array[i])
      }
      callback(this.entities[i], components)
    }
  }
}
```

## 5. パフォーマンス最適化

### 5.1 並列処理システム

```typescript
import { Effect, Fiber } from "effect"

class ParallelSystemExecutor {
  async execute(
    systems: System[],
    entities: ReadonlyArray<Entity>,
    deltaTime: number
  ): Effect.Effect<ReadonlyArray<Entity>> {
    // 依存関係のないシステムを並列実行
    const independentSystems = this.findIndependentSystems(systems)

    return Effect.gen(function* () {
      const fibers = independentSystems.map(system =>
        Effect.fork(system.update(entities, deltaTime))
      )

      const results = yield* Effect.all(
        fibers.map(fiber => Fiber.join(fiber))
      )

      // 結果をマージ
      return this.mergeResults(results)
    })
  }

  private findIndependentSystems(systems: System[]): System[][] {
    // システム間の依存関係を解析
    // 読み書きするコンポーネントが重複しないグループに分割
    return [systems] // 簡略化
  }

  private mergeResults(
    results: ReadonlyArray<ReadonlyArray<Entity>>
  ): ReadonlyArray<Entity> {
    // 各システムの結果を統合
    return results[results.length - 1] // 簡略化
  }
}
```

### 5.2 メモリプール

```typescript
class EntityPool {
  private available: Entity[] = []
  private inUse: Set<EntityId> = new Set()
  private nextId: number = 0

  acquire(): Entity {
    if (this.available.length > 0) {
      const entity = this.available.pop()!
      this.inUse.add(entity.id)
      return entity
    }

    const entity: Entity = {
      id: `entity_${this.nextId++}` as EntityId,
      components: new Map()
    }
    this.inUse.add(entity.id)
    return entity
  }

  release(entity: Entity): void {
    if (this.inUse.has(entity.id)) {
      // コンポーネントをクリア
      entity.components.clear()
      this.inUse.delete(entity.id)
      this.available.push(entity)
    }
  }

  releaseAll(): void {
    for (const id of this.inUse) {
      // すべてのエンティティを解放
    }
    this.inUse.clear()
  }
}
```

## 6. 実装のベストプラクティス

### チェックリスト

- [ ] コンポーネントは純粋なデータ構造
- [ ] システムは状態を持たない
- [ ] クエリ結果はキャッシュされている
- [ ] 空間インデックスが適切に更新されている
- [ ] メモリプールを使用している
- [ ] 並列実行可能なシステムは並列化されている

### パフォーマンス指標

- エンティティ数: 10,000+
- フレームレート: 60 FPS
- メモリ使用量: 安定
- GC頻度: 最小限

## 次のステップ

- **実装例**: [ECSサンプル実装](../06-examples/README.md)
- **最適化**: [パフォーマンス最適化](../07-pattern-catalog/06-optimization-patterns.md)
- **テスト**: [ECSテスト戦略](../03-guides/02-testing-guide.md)