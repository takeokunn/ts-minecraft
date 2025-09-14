---
title: "エンティティシステム仕様 - ECS・AI・スポーン管理"
description: "Structure of Arrays ECSによる高性能エンティティ管理、AIステートマシン、動的スポーンシステムの完全仕様。"
category: "specification"
difficulty: "advanced"
tags: ["entity-system", "ecs-architecture", "ai-behavior", "spawn-system", "structure-of-arrays", "performance"]
prerequisites: ["effect-ts-fundamentals", "ecs-concepts", "performance-optimization"]
estimated_reading_time: "20分"
related_patterns: ["optimization-patterns", "state-machine-patterns", "ecs-patterns"]
related_docs: ["./02-player-system.md", "./06-physics-system.md", "../explanations/architecture/05-ecs-integration.md"]
---

# エンティティシステム - エンティティ管理システム

## 概要

エンティティシステムは、TypeScript Minecraftクローンにおける全ての動的オブジェクト（プレイヤー以外）を管理する高性能システムです。Structure of Arrays (SoA) ECSアーキテクチャとEffect-TS 3.17+の最新パターンを活用し、数千のエンティティを効率的に処理しながら、純粋関数型プログラミングの原則を維持します。

本システムは以下の機能を提供します：
- **モブ管理**: 動物・モンスター・NPCの統合管理（100+種類対応）
- **AI実装**: ステートマシンベースの複雑な行動制御
- **スポーンシステム**: バイオーム・時間・難易度に基づく動的出現
- **物理演算**: 重力・衝突・摩擦の統合処理システム
- **アニメーション**: 60FPSでの滑らかなモーション補間
- **パーティクル**: リアルタイムエフェクトシステム

## エンティティコンポーネントシステムアーキテクチャ

### コアECS型

```typescript
import { Effect, Layer, Context, Schema, Match, pipe, Ref, STM, Stream, Queue } from "effect"
import { Brand, Option, ReadonlyArray, HashMap, Chunk } from "effect"
import { ParseResult } from "effect/Schema"

// Entity ID（ブランド型） - 最新パターン
export const EntityId = Schema.String.pipe(
  Schema.uuid(),
  Schema.brand("EntityId")
)
export type EntityId = Schema.Schema.Type<typeof EntityId>

// エンティティタイプ（ブランド型）
export const EntityType = Schema.Literal(
  "player", "zombie", "skeleton", "creeper", "cow", "pig", "sheep",
  "item", "arrow", "fireball", "tnt", "boat", "minecart", "painting"
).pipe(Schema.brand("EntityType"))
export type EntityType = Schema.Schema.Type<typeof EntityType>

// Component基底スキーマ
export const ComponentSchema = Schema.TaggedStruct("Component", {
  _tag: Schema.String
})
export type Component = Schema.Schema.Type<typeof ComponentSchema>

// Entity定義（最新Schemaパターン）
export const EntitySchema = Schema.Struct({
  id: EntityId,
  type: EntityType,
  active: Schema.Boolean,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf
})
export type Entity = Schema.Schema.Type<typeof EntitySchema>

// Entity生成エラー
export const CreateEntityError = Schema.TaggedError("CreateEntityError")({
  entityType: EntityType,
  reason: Schema.String
}) {}

export const EntityNotFoundError = Schema.TaggedError("EntityNotFoundError")({
  entityId: EntityId
}) {}

export const ComponentNotFoundError = Schema.TaggedError("ComponentNotFoundError")({
  entityId: EntityId,
  componentType: Schema.String
}) {}

// Component Storeインターフェース（Effect-TS最新パターン）
export interface ComponentStoreInterface {
  readonly get: <T extends Component>(
    entityId: EntityId,
    componentType: string
  ) => Effect.Effect<T, ComponentNotFoundError, never>

  readonly set: <T extends Component>(
    entityId: EntityId,
    component: T
  ) => Effect.Effect<void, never, never>

  readonly remove: (
    entityId: EntityId,
    componentType: string
  ) => Effect.Effect<void, ComponentNotFoundError, never>

  readonly getAll: <T extends Component>(
    componentType: string
  ) => Effect.Effect<ReadonlyArray<[EntityId, T]>, never, never>

  readonly hasComponent: (
    entityId: EntityId,
    componentType: string
  ) => Effect.Effect<boolean, never, never>

  readonly stream: <T extends Component>(
    componentType: string
  ) => Stream.Stream<[EntityId, T], never, never>
}

// Context Tag（最新パターン）
export const ComponentStore = Context.GenericTag<ComponentStoreInterface>("@minecraft/ComponentStore")
```

## コアコンポーネント

### 位置 & 移動コンポーネント

```typescript
// Vector3型（ブランド型）
export const Vector3 = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
}).pipe(Schema.brand("Vector3"))
export type Vector3 = Schema.Schema.Type<typeof Vector3>

// ChunkPosition型（ブランド型）
export const ChunkPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  z: Schema.Number.pipe(Schema.int())
}).pipe(Schema.brand("ChunkPosition"))
export type ChunkPosition = Schema.Schema.Type<typeof ChunkPosition>

// Positionコンポーネント（TaggedStructパターン）
export const PositionComponent = Schema.TaggedStruct("Position", {
  position: Vector3,
  chunk: ChunkPosition
})
export type PositionComponent = Schema.Schema.Type<typeof PositionComponent>

// Velocityコンポーネント
export const VelocityComponent = Schema.TaggedStruct("Velocity", {
  velocity: Vector3,
  acceleration: Schema.optional(Vector3)
})
export type VelocityComponent = Schema.Schema.Type<typeof VelocityComponent>

// Rotationコンポーネント（制約付きスキーマ）
export const RotationComponent = Schema.TaggedStruct("Rotation", {
  yaw: Schema.Number.pipe(Schema.between(-180, 180)),
  pitch: Schema.Number.pipe(Schema.between(-90, 90)),
  roll: Schema.optional(Schema.Number.pipe(Schema.between(-180, 180)))
})
export type RotationComponent = Schema.Schema.Type<typeof RotationComponent>

// BoundingBoxコンポーネント
export const BoundingBoxComponent = Schema.TaggedStruct("BoundingBox", {
  size: Schema.Struct({
    width: Schema.Number.pipe(Schema.positive()),
    height: Schema.Number.pipe(Schema.positive()),
    depth: Schema.Number.pipe(Schema.positive())
  }),
  offset: Schema.optional(Vector3)
})
export type BoundingBoxComponent = Schema.Schema.Type<typeof BoundingBoxComponent>
```

### 体力 & 戦闘コンポーネント

```typescript
// Health値（ブランド型）
export const Health = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand("Health")
)
export type Health = Schema.Schema.Type<typeof Health>

// Damage値（ブランド型）
export const Damage = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand("Damage")
)
export type Damage = Schema.Schema.Type<typeof Damage>

// Healthコンポーネント（最新パターン）
export const HealthComponent = Schema.TaggedStruct("Health", {
  current: Health,
  max: Health,
  regeneration: Schema.Number,
  invulnerableUntil: Schema.optional(Schema.DateFromSelf),
  lastDamageTime: Schema.optional(Schema.DateFromSelf)
})
export type HealthComponent = Schema.Schema.Type<typeof HealthComponent>

// Combatコンポーネント
export const CombatComponent = Schema.TaggedStruct("Combat", {
  damage: Damage,
  attackSpeed: Schema.Number.pipe(Schema.positive()),
  knockback: Schema.Number.pipe(Schema.nonNegative()),
  range: Schema.Number.pipe(Schema.positive()),
  lastAttack: Schema.optional(Schema.DateFromSelf),
  target: Schema.optional(EntityId)
})
export type CombatComponent = Schema.Schema.Type<typeof CombatComponent>

// Enchantment定義
export const Enchantment = Schema.Struct({
  type: Schema.String,
  level: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.lessThanOrEqualTo(10))
})
export type Enchantment = Schema.Schema.Type<typeof Enchantment>

// Armorコンポーネント
export const ArmorComponent = Schema.TaggedStruct("Armor", {
  defense: Schema.Number.pipe(Schema.nonNegative()),
  toughness: Schema.Number.pipe(Schema.nonNegative()),
  enchantments: Schema.Array(Enchantment),
  durability: Schema.optional(Schema.Struct({
    current: Schema.Number.pipe(Schema.nonNegative()),
    max: Schema.Number.pipe(Schema.positive())
  }))
})
export type ArmorComponent = Schema.Schema.Type<typeof ArmorComponent>
```

### AIコンポーネント

```typescript
// AI動作タイプ（ブランド型）
export const AIBehavior = Schema.Literal(
  "idle", "wander", "follow", "flee", "attack", "patrol",
  "guard", "breed", "sleep", "eat", "swim", "pathfind"
).pipe(Schema.brand("AIBehavior"))
export type AIBehavior = Schema.Schema.Type<typeof AIBehavior>

// AI状態（ブランド型）
export const AIState = Schema.String.pipe(Schema.brand("AIState"))
export type AIState = Schema.Schema.Type<typeof AIState>

// Pathポイント
export const PathPoint = Schema.Struct({
  position: Vector3,
  timestamp: Schema.DateFromSelf
})
export type PathPoint = Schema.Schema.Type<typeof PathPoint>

// AIコンポーネント（最新パターン）
export const AIComponent = Schema.TaggedStruct("AI", {
  enabled: Schema.Boolean,
  behaviors: Schema.Array(AIBehavior),
  currentState: AIState,
  target: Schema.optional(EntityId),
  path: Schema.optional(Schema.Array(PathPoint)),
  memory: Schema.Record(Schema.String, Schema.Unknown),
  lastStateChange: Schema.DateFromSelf,
  stateTimeout: Schema.optional(Schema.Number.pipe(Schema.positive()))
})
export type AIComponent = Schema.Schema.Type<typeof AIComponent>

// Sensorデータ
export const SensorData = Schema.Struct({
  type: Schema.String,
  range: Schema.Number.pipe(Schema.positive()),
  lastUpdate: Schema.DateFromSelf,
  detectedEntities: Schema.Array(EntityId)
})
export type SensorData = Schema.Schema.Type<typeof SensorData>

// Activityスケジュール
export const ActivitySchedule = Schema.Struct({
  time: Schema.Number.pipe(Schema.between(0, 24000)), // Minecraftの1日は24000tick
  activity: Schema.String,
  priority: Schema.Number.pipe(Schema.int(), Schema.between(1, 10))
})
export type ActivitySchedule = Schema.Schema.Type<typeof ActivitySchedule>

// Brainコンポーネント（高度なAI）
export const BrainComponent = Schema.TaggedStruct("Brain", {
  memories: Schema.Record(Schema.String, Schema.Unknown),
  sensors: Schema.Array(SensorData),
  activities: Schema.Array(Schema.String),
  schedule: Schema.optional(Schema.Array(ActivitySchedule)),
  learningRate: Schema.Number.pipe(Schema.between(0, 1)),
  decisionTree: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})
export type BrainComponent = Schema.Schema.Type<typeof BrainComponent>
```

## エンティティマネージャー

### エンティティ管理サービス

```typescript
// EntityManagerインターフェース（最新Effect-TSパターン）
export interface EntityManagerInterface {
  readonly createEntity: (
    type: EntityType,
    components: ReadonlyArray<Component>
  ) => Effect.Effect<EntityId, CreateEntityError, never>

  readonly destroyEntity: (
    id: EntityId
  ) => Effect.Effect<void, EntityNotFoundError, never>

  readonly getEntity: (
    id: EntityId
  ) => Effect.Effect<Entity, EntityNotFoundError, never>

  readonly addComponent: <T extends Component>(
    entityId: EntityId,
    component: T
  ) => Effect.Effect<void, EntityNotFoundError, never>

  readonly removeComponent: (
    entityId: EntityId,
    componentType: string
  ) => Effect.Effect<void, ComponentNotFoundError, never>

  readonly getComponent: <T extends Component>(
    entityId: EntityId,
    componentType: string
  ) => Effect.Effect<T, ComponentNotFoundError, never>

  readonly query: (
    ...componentTypes: string[]
  ) => Effect.Effect<ReadonlyArray<EntityId>, never, never>

  readonly queryWithComponents: <T extends Component[]>(
    ...componentTypes: string[]
  ) => Effect.Effect<ReadonlyArray<[EntityId, T]>, never, never>

  // Streamベースのリアルタイムクエリ
  readonly watchEntities: (
    ...componentTypes: string[]
  ) => Stream.Stream<[EntityId, ReadonlyArray<Component>], never, never>

  // エンティティライフサイクルイベント
  readonly entityEvents: Stream.Stream<EntityEvent, never, never>

  // バッチ処理
  readonly batchUpdate: <T>(
    entities: ReadonlyArray<EntityId>,
    updater: (entityId: EntityId) => Effect.Effect<T, never, never>
  ) => Effect.Effect<ReadonlyArray<T>, never, never>
}

// エンティティイベント定義
export const EntityEvent = Schema.Union(
  Schema.TaggedStruct("EntityCreated", {
    entityId: EntityId,
    entityType: EntityType,
    timestamp: Schema.DateFromSelf
  }),
  Schema.TaggedStruct("EntityDestroyed", {
    entityId: EntityId,
    timestamp: Schema.DateFromSelf
  }),
  Schema.TaggedStruct("ComponentAdded", {
    entityId: EntityId,
    componentType: Schema.String,
    timestamp: Schema.DateFromSelf
  }),
  Schema.TaggedStruct("ComponentRemoved", {
    entityId: EntityId,
    componentType: Schema.String,
    timestamp: Schema.DateFromSelf
  })
)
export type EntityEvent = Schema.Schema.Type<typeof EntityEvent>

// Context Tag（最新パターン）
export const EntityManager = Context.GenericTag<EntityManagerInterface>("@minecraft/EntityManager")

// Live実装作成関数（最新Effect-TSパターン）
const makeEntityManager = Effect.gen(function* () {
  // サービス依存関係
  const componentStore = yield* ComponentStore
  const spatialIndex = yield* SpatialIndex

  // ステート管理（STMでアトミックに操作）
  const entities = yield* Ref.make(new Map<EntityId, Entity>())
  const archetypes = yield* Ref.make(new Map<string, Set<EntityId>>())
  const eventQueue = yield* Queue.unbounded<EntityEvent>()

  // アーキタイプ管理
  const archetypeManager = yield* createArchetypeManager(archetypes)

    const createEntity = (
      type: EntityType,
      components: ReadonlyArray<Component>
    ) => Effect.gen(function* () {
      // Entity ID生成（UUIDブランド型）
      const id = yield* Effect.sync(() => Schema.decodeSync(EntityId)(crypto.randomUUID()))
      const now = new Date()

      const entity = yield* Effect.sync(() =>
        Schema.decodeSync(EntitySchema)({
          id,
          type,
          active: true,
          createdAt: now,
          updatedAt: now
        })
      )

      // STMトランザクションで原子的更新
      yield* STM.commit(
        STM.gen(function* () {
          // エンティティ登録
          yield* STM.update(entities, (map) => new Map(map).set(id, entity))

          // コンポーネント追加（バッチ処理）
          yield* pipe(
            components,
            Array.map((component) => STM.commit(componentStore.set(id, component))),
            STM.all
          )

          // アーキタイプ更新
          const componentTypes = components.map(c => c._tag)
          yield* archetypeManager.addEntity(id, componentTypes)
        })
      )

      // イベント発行（非同期）
      const event = {
        _tag: "EntityCreated" as const,
        entityId: id,
        entityType: type,
        timestamp: now
      }
      yield* Queue.offer(eventQueue, event)

      // 空間インデックス登録（Positionコンポーネントがある場合）
      const positionComponent = components.find(c => c._tag === "Position") as PositionComponent | undefined
      if (positionComponent) {
        yield* spatialIndex.insert(id, positionComponent.position)
      }

      return id
    })

    const destroyEntity = (id: EntityId) =>
      Effect.gen(function* () {
        // 早期リターン: エンティティ存在確認
        const entitiesMap = yield* Ref.get(entities)
        const entity = entitiesMap.get(id)
        if (!entity) {
          return yield* Effect.fail(new EntityNotFoundError({ entityId: id }))
        }

        // STMトランザクションで原子的削除
        yield* STM.commit(
          STM.gen(function* () {
            // エンティティ削除
            yield* STM.update(entities, (map) => {
              const newMap = new Map(map)
              newMap.delete(id)
              return newMap
            })

            // コンポーネント全削除
            const componentTypes = ["Position", "Velocity", "Health", "AI", "Combat", "Armor"]
            yield* pipe(
              componentTypes,
              Array.map((componentType) =>
                STM.commit(componentStore.remove(id, componentType).pipe(
                  Effect.ignore // コンポーネントがない場合は無視
                ))
              ),
              STM.all
            )

            // アーキタイプから削除
            yield* archetypeManager.removeEntity(id)
          })
        )

        // 空間インデックスから削除
        yield* spatialIndex.remove(id)

        // イベント発行
        const event = {
          _tag: "EntityDestroyed" as const,
          entityId: id,
          timestamp: new Date()
        }
        yield* Queue.offer(eventQueue, event)
      })

    const query = (...componentTypes: string[]) =>
      Effect.gen(function* () {
        // アーキタイプベースの高速クエリ
        return yield* archetypeManager.query(componentTypes)
      })

    const watchEntities = (...componentTypes: string[]) =>
      Stream.fromQueue(eventQueue).pipe(
        Stream.filter((event) =>
          event._tag === "EntityCreated" ||
          event._tag === "ComponentAdded"
        ),
        Stream.mapEffect((event) =>
          query(...componentTypes).pipe(
            Effect.map(entityIds =>
              entityIds.map(id => [id, []] as [EntityId, ReadonlyArray<Component>])
            )
          )
        ),
        Stream.flatten
      )

    const batchUpdate = <T>(
      entityIds: ReadonlyArray<EntityId>,
      updater: (entityId: EntityId) => Effect.Effect<T, never, never>
    ) => Effect.forEach(entityIds, updater, { concurrency: "unbounded", batching: true })

    const queryWithComponents = <T extends Component[]>(
      ...componentTypes: string[]
    ) => Effect.gen(function* () {
      const entityIds = yield* query(...componentTypes)
      const results: [EntityId, T][] = []

      yield* pipe(
        entityIds,
        Array.map((id) =>
          Effect.gen(function* () {
            const components = yield* pipe(
              componentTypes,
              Array.map((type) => componentStore.get(id, type)),
              Effect.all
            )

            return Match.value(components.every(Option.isSome)).pipe(
              Match.when(true, () => Option.some([
                id,
                components.map(Option.getOrThrow) as T
              ] as [EntityId, T])),
              Match.when(false, () => Option.none()),
              Match.exhaustive
            )
          })
        ),
        Effect.all,
        Effect.map(Array.filterMap((x) => x))
      )

      return results
    })

    return EntityManager.of({
      createEntity,
      destroyEntity,
      getEntity: (id) => Effect.gen(function* () {
        const entitiesMap = yield* Ref.get(entities)
        const entity = entitiesMap.get(id)

        return entity
          ? Effect.succeed(entity)
          : Effect.fail(new EntityNotFoundError({ entityId: id }))
      }).pipe(Effect.flatten),

      addComponent: (entityId, component) =>
        Effect.gen(function* () {
          // 早期リターン: エンティティ存在確認
          yield* getEntity(entityId)

          // STMでアトミックにコンポーネント追加
          yield* STM.commit(
            STM.gen(function* () {
              yield* STM.commit(componentStore.set(entityId, component))
              yield* archetypeManager.addComponent(entityId, component._tag)
            })
          )

          // イベント発行
          const event = {
            _tag: "ComponentAdded" as const,
            entityId,
            componentType: component._tag,
            timestamp: new Date()
          }
          yield* Queue.offer(eventQueue, event)
        }),

      removeComponent: (entityId, componentType) =>
        Effect.gen(function* () {
          yield* STM.commit(
            STM.gen(function* () {
              yield* STM.commit(componentStore.remove(entityId, componentType))
              yield* archetypeManager.removeComponent(entityId, componentType)
            })
          )

          // イベント発行
          const event = {
            _tag: "ComponentRemoved" as const,
            entityId,
            componentType,
            timestamp: new Date()
          }
          yield* Queue.offer(eventQueue, event)
        }),

      getComponent: (entityId, componentType) =>
        componentStore.get(entityId, componentType),

      query,
      queryWithComponents,
      watchEntities,
      entityEvents: Stream.fromQueue(eventQueue),
      batchUpdate
    })
  })

// Live Layer（依存関係あり）
export const EntityManagerLive = Layer.effect(
  EntityManager,
  makeEntityManager
).pipe(
  Layer.provide(ComponentStoreLive),
  Layer.provide(SpatialIndexLive)
)
```

## エンティティシステム

### 移動システム

```typescript
// Movementエラー定義
export const MovementError = Schema.TaggedError("MovementError")({
  entityId: EntityId,
  reason: Schema.String
}) {}

export const CollisionError = Schema.TaggedError("CollisionError")({
  entityId: EntityId,
  position: Vector3,
  collisionType: Schema.String
}) {}

// MovementSystemインターフェース（最新パターン）
export interface MovementSystemInterface {
  readonly update: (
    deltaTime: number
  ) => Effect.Effect<void, never, never>

  readonly moveEntity: (
    entityId: EntityId,
    velocity: Vector3
  ) => Effect.Effect<void, MovementError, never>

  readonly teleportEntity: (
    entityId: EntityId,
    position: Vector3
  ) => Effect.Effect<void, MovementError, never>

  // Streamベースの移動イベント
  readonly movementEvents: Stream.Stream<MovementEvent, never, never>

  // バッチ移動処理
  readonly batchMove: (
    movements: ReadonlyArray<{ entityId: EntityId; velocity: Vector3 }>
  ) => Effect.Effect<void, MovementError, never>
}

// 移動イベント定義
export const MovementEvent = Schema.Union(
  Schema.TaggedStruct("EntityMoved", {
    entityId: EntityId,
    from: Vector3,
    to: Vector3,
    velocity: Vector3,
    timestamp: Schema.DateFromSelf
  }),
  Schema.TaggedStruct("CollisionDetected", {
    entityId: EntityId,
    position: Vector3,
    normal: Vector3,
    timestamp: Schema.DateFromSelf
  })
)
export type MovementEvent = Schema.Schema.Type<typeof MovementEvent>

// Context Tag（最新パターン）
export const MovementSystem = Context.GenericTag<MovementSystemInterface>("@minecraft/MovementSystem")

// Live実装作成関数（最新Effect-TSパターン）
const makeMovementSystem = Effect.gen(function* () {
  // 依存サービス
  const entityManager = yield* EntityManager
  const physicsService = yield* PhysicsService
  const worldService = yield* WorldService
  const spatialIndex = yield* SpatialIndex

  // イベントキュー
  const movementEventQueue = yield* Queue.unbounded<MovementEvent>()

    const update = (deltaTime: number) =>
      Effect.gen(function* () {
        // Position + Velocityを持つエンティティをストリーム処理
        const movableEntities = yield* entityManager.queryWithComponents<
          [PositionComponent, VelocityComponent]
        >("Position", "Velocity")

        // バッチ処理でパフォーマンス最適化
        yield* Effect.forEach(
          Chunk.fromIterable(movableEntities),
          ([entityId, [position, velocity]]) =>
            updateEntityPosition(entityId, position, velocity, deltaTime),
          {
            concurrency: "inherit",
            batching: true,
            discard: true
          }
        )
      })

    const updateEntityPosition = (
      entityId: EntityId,
      position: PositionComponent,
      velocity: VelocityComponent,
      deltaTime: number
    ) => Effect.gen(function* () {
      // 純粋関数: 新位置計算
      const calculateNewPosition = (
        currentPos: Vector3,
        vel: Vector3,
        dt: number
      ): Vector3 => ({
        x: currentPos.x + vel.x * dt,
        y: currentPos.y + vel.y * dt,
        z: currentPos.z + vel.z * dt
      })

      // 純粋関数: 重力適用
      const applyGravity = (vel: Vector3, dt: number): Vector3 => ({
        ...vel,
        y: vel.y - 9.81 * dt // Minecraftの重力加速度
      })

      const currentPos = position.position
      const currentVel = velocity.velocity
      const newPosition = calculateNewPosition(currentPos, currentVel, deltaTime)
      const newVelocity = applyGravity(currentVel, deltaTime)

      // 早期リターン: BoundingBox取得
      const boundingBox = yield* entityManager.getComponent<BoundingBoxComponent>(
        entityId,
        "BoundingBox"
      ).pipe(
        Effect.orElse(() =>
          Effect.succeed({
            _tag: "BoundingBox" as const,
            size: { width: 0.6, height: 1.8, depth: 0.6 }
          } as BoundingBoxComponent)
        )
      )

      // 衝突検知
      const collision = yield* physicsService.checkCollision(newPosition, boundingBox)

      // Match.valueパターンで衝突処理
      yield* Match.value(collision).pipe(
        Match.when(
          (c) => c.hasCollision,
          (c) => resolveEntityCollision(entityId, currentPos, newPosition, newVelocity, c)
        ),
        Match.orElse(() => updateEntityComponents(entityId, newPosition, newVelocity))
      )
    })
    }

    const resolveEntityCollision = (
      entityId: EntityId,
      oldPosition: Vector3,
      newPosition: Vector3,
      velocity: Vector3,
      collision: CollisionResult
    ) => Effect.gen(function* () {
      // 衝突解決
      const resolvedPosition = yield* physicsService.resolveCollision(
        oldPosition,
        newPosition,
        collision
      )

      // 速度調整（地面衝突時はY速度リセット）
      const adjustedVelocity = collision.axis === "y" && velocity.y < 0
        ? { ...velocity, y: 0 }
        : velocity

      // コンポーネント更新（STMでアトミック）
      yield* STM.commit(
        STM.gen(function* () {
          yield* STM.commit(updateEntityComponents(entityId, resolvedPosition, adjustedVelocity))
        })
      )

      // 衝突イベント発行
      const collisionEvent = {
        _tag: "CollisionDetected" as const,
        entityId,
        position: resolvedPosition,
        normal: collision.normal,
        timestamp: new Date()
      }
      yield* Queue.offer(movementEventQueue, collisionEvent)
    })

    const updateEntityComponents = (
      entityId: EntityId,
      position: Vector3,
      velocity: Vector3
    ) => Effect.gen(function* () {
      // チャンク位置計算
      const chunkPos = {
        x: Math.floor(position.x / 16),
        z: Math.floor(position.z / 16)
      }

      // Positionコンポーネント更新
      const newPositionComponent = {
        _tag: "Position" as const,
        position,
        chunk: chunkPos
      } as PositionComponent

      // Velocityコンポーネント更新
      const newVelocityComponent = {
        _tag: "Velocity" as const,
        velocity
      } as VelocityComponent

      // コンポーネント同時更新（STMでアトミック）
      yield* STM.commit(
        STM.gen(function* () {
          yield* STM.commit(entityManager.addComponent(entityId, newPositionComponent))
          yield* STM.commit(entityManager.addComponent(entityId, newVelocityComponent))
        })
      )

      // 空間インデックス更新
      yield* spatialIndex.update(entityId, position)

      // 移動イベント発行
      const moveEvent = {
        _tag: "EntityMoved" as const,
        entityId,
        from: position, // TODO: 前の位置を保持
        to: position,
        velocity,
        timestamp: new Date()
      }
      yield* Queue.offer(movementEventQueue, moveEvent)
    })

    const moveEntity = (entityId: EntityId, velocity: Vector3) =>
      Effect.gen(function* () {
        // 早期リターン: エンティティ存在確認
        yield* entityManager.getEntity(entityId)

        // Velocityコンポーネント更新
        const velocityComponent = {
          _tag: "Velocity" as const,
          velocity
        } as VelocityComponent

        yield* entityManager.addComponent(entityId, velocityComponent)
      }).pipe(
        Effect.mapError(
          (error) =>
            new MovementError({
              entityId,
              reason: `Failed to set velocity: ${error}`
            })
        )
      )

    const teleportEntity = (entityId: EntityId, position: Vector3) =>
      Effect.gen(function* () {
        // 早期リターン: エンティティ存在確認
        yield* entityManager.getEntity(entityId)

        // チャンク位置計算
        const chunkPos = {
          x: Math.floor(position.x / 16),
          z: Math.floor(position.z / 16)
        }

        const positionComponent = {
          _tag: "Position" as const,
          position,
          chunk: chunkPos
        } as PositionComponent

        yield* entityManager.addComponent(entityId, positionComponent)
        yield* spatialIndex.update(entityId, position)
      }).pipe(
        Effect.mapError(
          (error) =>
            new MovementError({
              entityId,
              reason: `Failed to teleport: ${error}`
            })
        )
      )

    const batchMove = (
      movements: ReadonlyArray<{ entityId: EntityId; velocity: Vector3 }>
    ) =>
      Effect.forEach(
        movements,
        ({ entityId, velocity }) => moveEntity(entityId, velocity),
        { concurrency: "unbounded", batching: true, discard: true }
      )

    return MovementSystem.of({
      update,
      moveEntity,
      teleportEntity,
      movementEvents: Stream.fromQueue(movementEventQueue),
      batchMove
    })
  })

// Live Layer
export const MovementSystemLive = Layer.effect(
  MovementSystem,
  makeMovementSystem
)
```

### AIシステム

```typescript
// AIエラー定義
export const AIError = Schema.TaggedError("AIError")({
  entityId: EntityId,
  reason: Schema.String,
  state: Schema.optional(AIState)
}) {}

export const PathfindingError = Schema.TaggedError("PathfindingError")({
  entityId: EntityId,
  from: Vector3,
  to: Vector3,
  reason: Schema.String
}) {}

// AISystemインターフェース（最新Effect-TSパターン）
export interface AISystemInterface {
  readonly update: (
    deltaTime: number
  ) => Effect.Effect<void, never, never>

  readonly setTarget: (
    entityId: EntityId,
    targetId: EntityId
  ) => Effect.Effect<void, AIError, never>

  readonly clearTarget: (
    entityId: EntityId
  ) => Effect.Effect<void, AIError, never>

  readonly setState: (
    entityId: EntityId,
    state: AIState
  ) => Effect.Effect<void, AIError, never>

  // StreamベースのAIイベント
  readonly aiEvents: Stream.Stream<AIEvent, never, never>

  // AIパフォーマンスメトリクス
  readonly getMetrics: Effect.Effect<AIMetrics, never, never>
}

// AIイベント定義
export const AIEvent = Schema.Union(
  Schema.TaggedStruct("AIStateChanged", {
    entityId: EntityId,
    fromState: AIState,
    toState: AIState,
    timestamp: Schema.DateFromSelf
  }),
  Schema.TaggedStruct("TargetAcquired", {
    entityId: EntityId,
    targetId: EntityId,
    distance: Schema.Number.pipe(Schema.positive()),
    timestamp: Schema.DateFromSelf
  }),
  Schema.TaggedStruct("PathCalculated", {
    entityId: EntityId,
    pathLength: Schema.Number.pipe(Schema.int(), Schema.positive()),
    timestamp: Schema.DateFromSelf
  })
)
export type AIEvent = Schema.Schema.Type<typeof AIEvent>

// AIメトリクス
export const AIMetrics = Schema.Struct({
  activeAIEntities: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageUpdateTime: Schema.Number.pipe(Schema.positive()),
  pathfindingRequests: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  stateTransitions: Schema.Number.pipe(Schema.int(), Schema.nonNegative())
})
export type AIMetrics = Schema.Schema.Type<typeof AIMetrics>

// Context Tag（最新パターン）
export const AISystem = Context.GenericTag<AISystemInterface>("@minecraft/AISystem")

// Live実装作成関数（最新Effect-TSパターン）
const makeAISystem = Effect.gen(function* () {
  // 依存サービス
  const entityManager = yield* EntityManager
  const pathfindingService = yield* PathfindingService
  const movementSystem = yield* MovementSystem
  const spatialIndex = yield* SpatialIndex

  // AIイベントキューとメトリクス
  const aiEventQueue = yield* Queue.unbounded<AIEvent>()
  const metricsRef = yield* Ref.make<AIMetrics>({
    activeAIEntities: 0,
    averageUpdateTime: 0,
    pathfindingRequests: 0,
    stateTransitions: 0
  })

    const update = (deltaTime: number) =>
      Effect.gen(function* () {
        const startTime = Date.now()

        // AIエンティティ取得（Streamベース）
        const aiEntities = yield* entityManager.queryWithComponents<
          [AIComponent, PositionComponent]
        >("AI", "Position")

        // アクティブAI数更新
        yield* Ref.update(metricsRef, metrics => ({
          ...metrics,
          activeAIEntities: aiEntities.length
        }))

        // バッチAI更新（コンカレンシー制限）
        yield* Effect.forEach(
          Chunk.fromIterable(aiEntities),
          ([entityId, [ai, position]]) =>
            updateAI(entityId, ai, position, deltaTime),
          {
            concurrency: 8, // AI処理の並列度を制限
            batching: true,
            discard: true
          }
        )

        // パフォーマンスメトリクス更新
        const endTime = Date.now()
        yield* Ref.update(metricsRef, metrics => ({
          ...metrics,
          averageUpdateTime: (metrics.averageUpdateTime + (endTime - startTime)) / 2
        }))
      })

    const updateAI = (
      entityId: EntityId,
      ai: AIComponent,
      position: PositionComponent,
      deltaTime: number
    ) => Effect.gen(function* () {
      // 早期リターン: AI無効化チェック
      if (!ai.enabled) {
        return
      }

      // タイムアウトチェック
      const now = Date.now()
      const stateAge = now - ai.lastStateChange.getTime()
      if (ai.stateTimeout && stateAge > ai.stateTimeout * 1000) {
        yield* setState(entityId, "idle" as AIState)
        return
      }

      // Match.valueパターンで状態処理（最新パターン）
      yield* Match.value(ai.currentState).pipe(
        Match.when("idle", () => handleIdleState(entityId, ai, position)),
        Match.when("wander", () => handleWanderState(entityId, ai, position, deltaTime)),
        Match.when("follow", () => handleFollowState(entityId, ai, position, deltaTime)),
        Match.when("attack", () => handleAttackState(entityId, ai, position, deltaTime)),
        Match.when("flee", () => handleFleeState(entityId, ai, position, deltaTime)),
        Match.when("pathfind", () => handlePathfindState(entityId, ai, position, deltaTime)),
        Match.orElse((unknownState) =>
          Effect.gen(function* () {
            console.warn(`不明なAI状態: ${unknownState}`)
            yield* setState(entityId, "idle" as AIState)
          })
        )
      )
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          console.error(`AI更新エラー (Entity ${entityId}):`, error)
          yield* setState(entityId, "idle" as AIState)
        })
      )
    )

    const handleWanderState = (
      entityId: EntityId,
      ai: AIComponent,
      position: PositionComponent,
      deltaTime: number
    ) => Effect.gen(function* () {
      // 早期リターン: パス確認
      if (!ai.path || ai.path.length === 0) {
        // ランダムな目的地生成
        const wanderRadius = 15
        const target: Vector3 = {
          x: position.position.x + (Math.random() - 0.5) * wanderRadius * 2,
          y: position.position.y,
          z: position.position.z + (Math.random() - 0.5) * wanderRadius * 2
        }

        // パスファインディングリクエスト
        const path = yield* pathfindingService.findPath(
          position.position,
          target
        ).pipe(
          Effect.orElse(() => Effect.succeed([])),
          Effect.tap(() => Ref.update(metricsRef, m => ({ ...m, pathfindingRequests: m.pathfindingRequests + 1 })))
        )

        if (path.length > 0) {
          const pathPoints = path.map(pos => ({
            position: pos,
            timestamp: new Date()
          }))

          const updatedAI = {
            ...ai,
            path: pathPoints
          }
          yield* entityManager.addComponent(entityId, updatedAI)

          // パスイベント発行
          const pathEvent = {
            _tag: "PathCalculated" as const,
            entityId,
            pathLength: path.length,
            timestamp: new Date()
          }
          yield* Queue.offer(aiEventQueue, pathEvent)
        }
      }

      // パスに沿って移動
      if (ai.path && ai.path.length > 0) {
        const nextPoint = ai.path[0]
        const distance = calculateDistance(position.position, nextPoint.position)

        if (distance < 1.0) {
          // 次のポイントへ進む
          const updatedAI = {
            ...ai,
            path: ai.path.slice(1)
          }
          yield* entityManager.addComponent(entityId, updatedAI)
        } else {
          // 方向計算と移動
          const direction = normalize({
            x: nextPoint.position.x - position.position.x,
            y: 0,
            z: nextPoint.position.z - position.position.z
          })

          const wanderSpeed = 2.0
          yield* movementSystem.moveEntity(entityId, {
            x: direction.x * wanderSpeed,
            y: -0.1, // 軽い重力
            z: direction.z * wanderSpeed
          })
        }
      }
    })

    const handleAttackState = (
      entityId: EntityId,
      ai: AIComponent,
      position: PositionComponent,
      deltaTime: number
    ) => Effect.gen(function* () {
      // 早期リターン: ターゲット確認
      if (!ai.target) {
        yield* setState(entityId, "idle" as AIState)
        return
      }

      // ターゲット位置取得
      const targetPosition = yield* entityManager.getComponent<PositionComponent>(
        ai.target,
        "Position"
      ).pipe(
        Effect.orElse(() =>
          Effect.gen(function* () {
            // ターゲット消失時の処理
            yield* clearTarget(entityId)
            return yield* Effect.fail(new AIError({
              entityId,
              reason: "ターゲットエンティティが見つかりません"
            }))
          })
        )
      )

      const distance = calculateDistance(position.position, targetPosition.position)
      const attackRange = 2.5
      const chaseRange = 16.0
      const loseTargetRange = 32.0

      // Match.valueパターンで距離による動作分岐
      yield* Match.value(distance).pipe(
        Match.when(
          (d) => d <= attackRange,
          () => Effect.gen(function* () {
            // 攻撃実行
            yield* performAttack(entityId, ai.target!)
          })
        ),
        Match.when(
          (d) => d > attackRange && d <= chaseRange,
          () => Effect.gen(function* () {
            // 追跡モード
            const path = yield* pathfindingService.findPath(
              position.position,
              targetPosition.position
            ).pipe(Effect.orElse(() => Effect.succeed([])))

            if (path.length > 0) {
              const pathPoints = path.map(pos => ({
                position: pos,
                timestamp: new Date()
              }))

              const updatedAI = { ...ai, path: pathPoints }
              yield* entityManager.addComponent(entityId, updatedAI)
              yield* setState(entityId, "pathfind" as AIState)
            }
          })
        ),
        Match.orElse(() => Effect.gen(function* () {
          // 範囲外 - ターゲットをクリア
          yield* clearTarget(entityId)
        }))
      )
    })

    const handlePathfindState = (
      entityId: EntityId,
      ai: AIComponent,
      position: PositionComponent,
      deltaTime: number
    ) => Effect.gen(function* () {
      // パスフォロー処理
      if (!ai.path || ai.path.length === 0) {
        yield* setState(entityId, "idle" as AIState)
        return
      }

      const nextPoint = ai.path[0]
      const distance = calculateDistance(position.position, nextPoint.position)

      if (distance < 1.0) {
        // 次のポイントへ
        const updatedAI = {
          ...ai,
          path: ai.path.slice(1)
        }
        yield* entityManager.addComponent(entityId, updatedAI)

        // パス完了チェック
        if (updatedAI.path.length === 0) {
          yield* setState(entityId, ai.target ? "attack" as AIState : "wander" as AIState)
        }
      } else {
        // パスに沿って移動
        const direction = normalize({
          x: nextPoint.position.x - position.position.x,
          y: 0,
          z: nextPoint.position.z - position.position.z
        })

        const moveSpeed = ai.target ? 4.0 : 2.0 // 攻撃時は高速
        yield* movementSystem.moveEntity(entityId, {
          x: direction.x * moveSpeed,
          y: -0.1,
          z: direction.z * moveSpeed
        })
      }
    })

    const setState = (entityId: EntityId, newState: AIState) =>
      Effect.gen(function* () {
        const ai = yield* entityManager.getComponent<AIComponent>(entityId, "AI")
        const oldState = ai.currentState

        const updatedAI = {
          ...ai,
          currentState: newState,
          lastStateChange: new Date()
        }
        yield* entityManager.addComponent(entityId, updatedAI)

        // 状態変更イベント発行
        const stateEvent = {
          _tag: "AIStateChanged" as const,
          entityId,
          fromState: oldState,
          toState: newState,
          timestamp: new Date()
        }
        yield* Queue.offer(aiEventQueue, stateEvent)

        // メトリクス更新
        yield* Ref.update(metricsRef, m => ({
          ...m,
          stateTransitions: m.stateTransitions + 1
        }))
      }).pipe(
        Effect.mapError((error) =>
          new AIError({
            entityId,
            reason: `Failed to set AI state: ${error}`,
            state: newState
          })
        )
      )

    const setTarget = (entityId: EntityId, targetId: EntityId) =>
      Effect.gen(function* () {
        const ai = yield* entityManager.getComponent<AIComponent>(entityId, "AI")
        const targetPos = yield* entityManager.getComponent<PositionComponent>(
          targetId,
          "Position"
        )
        const entityPos = yield* entityManager.getComponent<PositionComponent>(
          entityId,
          "Position"
        )

        const distance = calculateDistance(entityPos.position, targetPos.position)

        const updatedAI = {
          ...ai,
          target: targetId,
          currentState: "attack" as AIState,
          lastStateChange: new Date()
        }
        yield* entityManager.addComponent(entityId, updatedAI)

        // ターゲット取得イベント
        const targetEvent = {
          _tag: "TargetAcquired" as const,
          entityId,
          targetId,
          distance,
          timestamp: new Date()
        }
        yield* Queue.offer(aiEventQueue, targetEvent)
      }).pipe(
        Effect.mapError((error) =>
          new AIError({
            entityId,
            reason: `Failed to set target: ${error}`
          })
        )
      )

    const clearTarget = (entityId: EntityId) =>
      Effect.gen(function* () {
        const ai = yield* entityManager.getComponent<AIComponent>(entityId, "AI")

        const updatedAI = {
          ...ai,
          target: undefined,
          currentState: "idle" as AIState,
          path: undefined,
          lastStateChange: new Date()
        }
        yield* entityManager.addComponent(entityId, updatedAI)
      }).pipe(
        Effect.mapError((error) =>
          new AIError({
            entityId,
            reason: `Failed to clear target: ${error}`
          })
        )
      )

    const getMetrics = Effect.gen(function* () {
      return yield* Ref.get(metricsRef)
    })

    return AISystem.of({
      update,
      setTarget,
      clearTarget,
      setState,
      aiEvents: Stream.fromQueue(aiEventQueue),
      getMetrics
    })
  })

// Live Layer（依存関係あり）
export const AISystemLive = Layer.effect(
  AISystem,
  makeAISystem
).pipe(
  Layer.provide(EntityManagerLive),
  Layer.provide(PathfindingServiceLive),
  Layer.provide(MovementSystemLive),
  Layer.provide(SpatialIndexLive)
)
```

## エンティティファクトリ

### エンティティ作成パターン

```typescript
// エンティティアーキタイプ定義（Schemaベース）
export const PlayerArchetype = Schema.Struct({
  _tag: Schema.Literal("PlayerArchetype"),
  name: Schema.String,
  level: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  experience: Schema.Number.pipe(Schema.nonNegative()),
  gameMode: Schema.Literal("survival", "creative", "adventure", "spectator")
})
export type PlayerArchetype = Schema.Schema.Type<typeof PlayerArchetype>

export const MobArchetype = Schema.Struct({
  _tag: Schema.Literal("MobArchetype"),
  mobType: EntityType,
  health: Health,
  damage: Damage,
  speed: Schema.Number.pipe(Schema.positive()),
  behaviors: Schema.Array(AIBehavior),
  hostileToPlayer: Schema.Boolean
})
export type MobArchetype = Schema.Schema.Type<typeof MobArchetype>

export const ItemArchetype = Schema.Struct({
  _tag: Schema.Literal("ItemArchetype"),
  itemId: Schema.String,
  stackSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  pickupDelay: Schema.Number.pipe(Schema.nonNegative()),
  despawnTime: Schema.Number.pipe(Schema.positive())
})
export type ItemArchetype = Schema.Schema.Type<typeof ItemArchetype>

// EntityFactoryインターフェース（最新Effect-TSパターン）
export interface EntityFactoryInterface {
  readonly createPlayer: (
    archetype: PlayerArchetype,
    position: Vector3
  ) => Effect.Effect<EntityId, CreateEntityError, never>

  readonly createMob: (
    archetype: MobArchetype,
    position: Vector3
  ) => Effect.Effect<EntityId, CreateEntityError, never>

  readonly createItem: (
    archetype: ItemArchetype,
    position: Vector3,
    velocity?: Vector3
  ) => Effect.Effect<EntityId, CreateEntityError, never>

  readonly createProjectile: (
    projectileType: EntityType,
    position: Vector3,
    velocity: Vector3,
    owner: EntityId
  ) => Effect.Effect<EntityId, CreateEntityError, never>

  // バッチ生成
  readonly batchCreate: (
    requests: ReadonlyArray<{
      type: EntityType
      archetype: unknown
      position: Vector3
    }>
  ) => Effect.Effect<ReadonlyArray<EntityId>, CreateEntityError, never>

  // アーキタイプファクトリ
  readonly getArchetypeFactory: <T>(
    type: EntityType
  ) => Effect.Effect<(config: unknown) => T, CreateEntityError, never>
}

// Context Tag（最新パターン）
export const EntityFactory = Context.GenericTag<EntityFactoryInterface>("@minecraft/EntityFactory")

// Live実装作成関数（Schemaベースアーキタイプ）
const makeEntityFactory = Effect.gen(function* () {
  const entityManager = yield* EntityManager

  // アーキタイプファクトリマップ
  const archetypeFactories = new Map<EntityType, (config: unknown) => unknown>()

    const createPlayer = (archetype: PlayerArchetype, position: Vector3) =>
      Effect.gen(function* () {
        // プレイヤーコンポーネント群をSchemaで定義
        const components: Component[] = [
          {
            _tag: "Position",
            position,
            chunk: {
              x: Math.floor(position.x / 16),
              z: Math.floor(position.z / 16)
            }
          } as PositionComponent,
          {
            _tag: "Velocity",
            velocity: { x: 0, y: 0, z: 0 }
          } as VelocityComponent,
          {
            _tag: "Rotation",
            yaw: 0,
            pitch: 0
          } as RotationComponent,
          {
            _tag: "BoundingBox",
            size: { width: 0.6, height: 1.8, depth: 0.6 }
          } as BoundingBoxComponent,
          {
            _tag: "Health",
            current: 20 as Health,
            max: 20 as Health,
            regeneration: 0.1
          } as HealthComponent,
          {
            _tag: "PlayerData",
            ...archetype
          } as any // PlayerDataコンポーネントは別途定義が必要
        ]

        return yield* entityManager.createEntity(
          "player" as EntityType,
          components
        )
      })

    const createMob = (archetype: MobArchetype, position: Vector3) =>
      Effect.gen(function* () {
        // Mobサイズ定義（タイプごと）
        const sizeConfig = getMobSizeConfig(archetype.mobType)

        const components: Component[] = [
          {
            _tag: "Position",
            position,
            chunk: {
              x: Math.floor(position.x / 16),
              z: Math.floor(position.z / 16)
            }
          } as PositionComponent,
          {
            _tag: "Velocity",
            velocity: { x: 0, y: 0, z: 0 }
          } as VelocityComponent,
          {
            _tag: "Rotation",
            yaw: Math.random() * 360 - 180,
            pitch: 0
          } as RotationComponent,
          {
            _tag: "BoundingBox",
            size: sizeConfig
          } as BoundingBoxComponent,
          {
            _tag: "Health",
            current: archetype.health,
            max: archetype.health,
            regeneration: 0
          } as HealthComponent,
          {
            _tag: "AI",
            enabled: true,
            behaviors: archetype.behaviors,
            currentState: "idle" as AIState,
            target: undefined,
            path: undefined,
            memory: {},
            lastStateChange: new Date()
          } as AIComponent,
          {
            _tag: "Combat",
            damage: archetype.damage,
            attackSpeed: archetype.speed,
            knockback: 0.4,
            range: 2.0
          } as CombatComponent
        ]

        return yield* entityManager.createEntity(
          archetype.mobType,
          components
        )
      })

    const createItem = (
      archetype: ItemArchetype,
      position: Vector3,
      velocity: Vector3 = { x: 0, y: 0, z: 0 }
    ) => Effect.gen(function* () {
      const components: Component[] = [
        {
          _tag: "Position",
          position,
          chunk: {
            x: Math.floor(position.x / 16),
            z: Math.floor(position.z / 16)
          }
        } as PositionComponent,
        {
          _tag: "Velocity",
          velocity
        } as VelocityComponent,
        {
          _tag: "BoundingBox",
          size: { width: 0.25, height: 0.25, depth: 0.25 }
        } as BoundingBoxComponent,
        {
          _tag: "ItemData",
          ...archetype
        } as any, // ItemDataコンポーネントは別途定義が必要
        {
          _tag: "Pickup",
          delay: archetype.pickupDelay,
          canPickup: true,
          despawnTime: Date.now() + archetype.despawnTime * 1000
        } as any // Pickupコンポーネントは別途定義が必要
      ]

      return yield* entityManager.createEntity(
        "item" as EntityType,
        components
      )
    })

    const createProjectile = (
      projectileType: EntityType,
      position: Vector3,
      velocity: Vector3,
      owner: EntityId
    ) => Effect.gen(function* () {
      const components: Component[] = [
        {
          _tag: "Position",
          position,
          chunk: {
            x: Math.floor(position.x / 16),
            z: Math.floor(position.z / 16)
          }
        } as PositionComponent,
        {
          _tag: "Velocity",
          velocity
        } as VelocityComponent,
        {
          _tag: "BoundingBox",
          size: { width: 0.25, height: 0.25, depth: 0.25 }
        } as BoundingBoxComponent,
        {
          _tag: "Projectile",
          owner,
          damage: 4 as Damage,
          lifespan: 1200, // 60秒
          createdAt: new Date()
        } as any // Projectileコンポーネントは別途定義が必要
      ]

      return yield* entityManager.createEntity(
        projectileType,
        components
      )
    })

    const batchCreate = (
      requests: ReadonlyArray<{
        type: EntityType
        archetype: unknown
        position: Vector3
      }>
    ) => Effect.gen(function* () {
      return yield* Effect.forEach(
        requests,
        (request) => {
          // タイプごとのファクトリ関数を呼び出し
          return Match.value(request.type).pipe(
            Match.when("player", () => createPlayer(request.archetype as PlayerArchetype, request.position)),
            Match.when("zombie", "skeleton", "creeper", () => createMob(request.archetype as MobArchetype, request.position)),
            Match.when("item", () => createItem(request.archetype as ItemArchetype, request.position)),
            Match.orElse(() => Effect.fail(new CreateEntityError({
              entityType: request.type,
              reason: `Unknown entity type: ${request.type}`
            })))
          )
        },
        {
          concurrency: "unbounded",
          batching: true
        }
      )
    })

    const getArchetypeFactory = <T>(type: EntityType) =>
      Effect.gen(function* () {
        const factory = archetypeFactories.get(type)
        if (!factory) {
          return yield* Effect.fail(new CreateEntityError({
            entityType: type,
            reason: `No archetype factory found for type: ${type}`
          }))
        }
        return factory as (config: unknown) => T
      })

    // サイズ設定ヘルパー
    const getMobSizeConfig = (mobType: EntityType) => {
      return Match.value(mobType).pipe(
        Match.when("zombie", "skeleton", () => ({ width: 0.6, height: 1.8, depth: 0.6 })),
        Match.when("creeper", () => ({ width: 0.6, height: 1.7, depth: 0.6 })),
        Match.when("cow", "pig", () => ({ width: 0.9, height: 1.4, depth: 0.9 })),
        Match.when("sheep", () => ({ width: 0.9, height: 1.3, depth: 0.9 })),
        Match.orElse(() => ({ width: 0.6, height: 1.8, depth: 0.6 }))
      )
    }

    return EntityFactory.of({
      createPlayer,
      createMob,
      createItem,
      createProjectile,
      batchCreate,
      getArchetypeFactory
    })
  })

// Live Layer（依存関係あり）
export const EntityFactoryLive = Layer.effect(
  EntityFactory,
  makeEntityFactory
).pipe(
  Layer.provide(EntityManagerLive)
)
```

## Structure of Arrays (SoA) ECS実装

### SoAアーキテクチャ概要

Structure of Arrays (SoA) パターンは、コンポーネントデータを型ごとに配列で管理し、メモリ効率とキャッシュ効率を最大化する実装手法です。

```typescript
// SoA Component Storageインターフェース
interface SoAComponentStorage {
  readonly allocate: (count: number) => Effect.Effect<void, AllocationError>
  readonly compact: () => Effect.Effect<void, never>
  readonly getComponentArray: <T extends Component>(
    componentType: string
  ) => Option.Option<TypedArray>
  readonly setComponent: <T extends Component>(
    entityIndex: number,
    component: T
  ) => Effect.Effect<void, never>
  readonly getComponent: <T extends Component>(
    entityIndex: number,
    componentType: string
  ) => Option.Option<T>
}

// SoA Position Component Implementation
const createPositionStorage = (capacity: number) =>
  Effect.gen(function* () {
    // TypedArraysによる高速メモリアクセス
    const xArray = new Float32Array(capacity)
    const yArray = new Float32Array(capacity)
    const zArray = new Float32Array(capacity)
    const chunkXArray = new Int32Array(capacity)
    const chunkZArray = new Int32Array(capacity)
    const activeSlots = new Set<number>()

    const setPosition = (index: number, position: PositionComponent) =>
      Effect.sync(() => {
        xArray[index] = position.x
        yArray[index] = position.y
        zArray[index] = position.z
        chunkXArray[index] = position.chunk.x
        chunkZArray[index] = position.chunk.z
        activeSlots.add(index)
      })

    const getPosition = (index: number): Option.Option<PositionComponent> =>
      activeSlots.has(index)
        ? Option.some({
            _tag: "Position" as const,
            x: xArray[index],
            y: yArray[index],
            z: zArray[index],
            chunk: {
              x: chunkXArray[index],
              z: chunkZArray[index]
            }
          })
        : Option.none()

    // SIMD最適化対応の更新処理
    const updatePositionsBatch = (
      indices: ReadonlyArray<number>,
      deltaX: Float32Array,
      deltaY: Float32Array,
      deltaZ: Float32Array
    ) => Effect.sync(() => {
      pipe(
        indices,
        Array.forEachWithIndex((i, idx) => {
          Match.value(activeSlots.has(idx)).pipe(
            Match.when(true, () => {
              xArray[idx] += deltaX[i]
              yArray[idx] += deltaY[i]
              zArray[idx] += deltaZ[i]

              // チャンク位置更新
              chunkXArray[idx] = Math.floor(xArray[idx] / 16)
              chunkZArray[idx] = Math.floor(zArray[idx] / 16)
            }),
            Match.when(false, () => void 0),
            Match.exhaustive
          )
        })
      )
    })

    return { setPosition, getPosition, updatePositionsBatch, activeSlots }
  })
```

### アーキタイプベースクエリシステム

```typescript
// アーキタイプ定義
interface Archetype {
  id: Schema.String
  readonly componentTypes: ReadonlySet<string>
  readonly entities: ReadonlySet<EntityId>
  readonly entityIndexMap: ReadonlyMap<EntityId, number>
}

interface ArchetypeManager {
  readonly createArchetype: (
    componentTypes: ReadonlyArray<string>
  ) => Effect.Effect<Archetype, never>

  readonly addEntityToArchetype: (
    entityId: EntityId,
    archetype: Archetype
  ) => Effect.Effect<void, never>

  readonly queryArchetypes: (
    componentTypes: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<Archetype>, never>

  readonly fastQuery: (
    componentTypes: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>
}

// アーキタイプマネージャー実装
const makeArchetypeManager = Effect.gen(function* () {
  const archetypes = yield* Ref.make(new Map<string, Archetype>())
  const entityArchetypeMap = yield* Ref.make(new Map<EntityId, string>())

  const createArchetypeId = (componentTypes: ReadonlyArray<string>): string =>
    componentTypes.slice().sort().join('|')

  const createArchetype = (componentTypes: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const id = createArchetypeId(componentTypes)
      const existingArchetypes = yield* Ref.get(archetypes)

      if (existingArchetypes.has(id)) {
        return existingArchetypes.get(id)!
      }

      const newArchetype: Archetype = {
        id,
        componentTypes: new Set(componentTypes),
        entities: new Set(),
        entityIndexMap: new Map()
      }

      yield* Ref.update(archetypes, map => new Map(map).set(id, newArchetype))

      return newArchetype
    })

  // O(1) 高速クエリ実装
  const fastQuery = (componentTypes: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const allArchetypes = yield* Ref.get(archetypes)
      const matchingEntities: EntityId[] = []

      const matchingEntities = pipe(
        Array.from(allArchetypes.values()),
        Array.filter((archetype) =>
          componentTypes.every(type =>
            archetype.componentTypes.has(type)
          )
        ),
        Array.flatMap((archetype) => Array.from(archetype.entities))
      )

      return matchingEntities
    })

  return { createArchetype, fastQuery }
})
```

## メモリプールシステム

### エンティティメモリプール

```typescript
interface EntityMemoryPool {
  readonly allocateEntity: () => Effect.Effect<EntityId, AllocationError>
  readonly deallocateEntity: (id: EntityId) => Effect.Effect<void, never>
  readonly getPoolStats: () => Effect.Effect<PoolStats, never>
  readonly compact: () => Effect.Effect<void, never>
}

// メモリプール統計
const PoolStats = Schema.Struct({
  totalCapacity: Schema.Number,
  allocatedCount: Schema.Number,
  freeCount: Schema.Number,
  fragmentationRatio: Schema.Number,
  averageLifetime: Schema.Number
})
type PoolStats = Schema.Schema.Type<typeof PoolStats>

// 高効率メモリプール実装
const makeEntityMemoryPool = (initialCapacity: number = 10000) =>
  Effect.gen(function* () {
    const entities = new Map<EntityId, number>() // Entity -> Index mapping
    const freeIndices = new Set<number>() // 使用可能インデックス
    const allocationTimes = new Map<EntityId, number>() // 割り当て時間

    let nextIndex = 0
    let totalAllocations = 0

    // 初期容量を事前確保
    for (let i = 0; i < initialCapacity; i++) {
      freeIndices.add(i)
    }

    const allocateEntity = (): Effect.Effect<EntityId, AllocationError> =>
      Effect.gen(function* () {
        if (freeIndices.size === 0 && nextIndex >= initialCapacity) {
          return yield* Effect.fail(new AllocationError("プールが枯渇しました"))
        }

        const index = freeIndices.size > 0
          ? Array.from(freeIndices)[0] // 再利用
          : nextIndex++ // 新規割り当て

        if (freeIndices.has(index)) {
          freeIndices.delete(index)
        }

        const entityId = yield* generateEntityId()
        entities.set(entityId, index)
        allocationTimes.set(entityId, Date.now())
        totalAllocations++

        return entityId
      })

    const deallocateEntity = (id: EntityId) =>
      Effect.gen(function* () {
        const index = entities.get(id)
        if (index !== undefined) {
          entities.delete(id)
          allocationTimes.delete(id)
          freeIndices.add(index)
        }
      })

    const getPoolStats = () =>
      Effect.succeed({
        totalCapacity: Math.max(initialCapacity, nextIndex),
        allocatedCount: entities.size,
        freeCount: freeIndices.size,
        fragmentationRatio: freeIndices.size / Math.max(nextIndex, 1),
        averageLifetime: calculateAverageLifetime(allocationTimes)
      } as PoolStats)

    const compact = () =>
      Effect.gen(function* () {
        // ガベージコレクション - フラグメンテーション解消
        const sortedEntities = Array.from(entities.entries())
          .sort((a, b) => a[1] - b[1])

        entities.clear()
        freeIndices.clear()

        let compactIndex = 0
        for (const [entityId, _] of sortedEntities) {
          entities.set(entityId, compactIndex++)
        }

        for (let i = compactIndex; i < nextIndex; i++) {
          freeIndices.add(i)
        }

        nextIndex = compactIndex + freeIndices.size
      })

    return { allocateEntity, deallocateEntity, getPoolStats, compact }
  })
```

## 高度なパフォーマンス最適化

### チャンクベース空間インデックス

```typescript
// 空間インデックスエラー
export const SpatialIndexError = Schema.TaggedError("SpatialIndexError")({
  operation: Schema.String,
  entityId: Schema.optional(EntityId),
  reason: Schema.String
}) {}

// クエリ範囲定義
export const QueryBounds = Schema.Struct({
  min: Vector3,
  max: Vector3
}).pipe(Schema.brand("QueryBounds"))
export type QueryBounds = Schema.Schema.Type<typeof QueryBounds>

// 空間インデックスインターフェース（最新Effect-TSパターン）
export interface SpatialIndexInterface {
  readonly insert: (
    entityId: EntityId,
    position: Vector3,
    boundingBox?: BoundingBoxComponent
  ) => Effect.Effect<void, SpatialIndexError, never>

  readonly remove: (
    entityId: EntityId
  ) => Effect.Effect<void, SpatialIndexError, never>

  readonly update: (
    entityId: EntityId,
    newPosition: Vector3
  ) => Effect.Effect<void, SpatialIndexError, never>

  readonly query: (
    bounds: QueryBounds
  ) => Effect.Effect<ReadonlyArray<EntityId>, SpatialIndexError, never>

  readonly nearbyEntities: (
    position: Vector3,
    radius: number
  ) => Effect.Effect<ReadonlyArray<EntityId>, SpatialIndexError, never>

  // Streamベースの空間クエリ
  readonly watchNearbyEntities: (
    position: Vector3,
    radius: number
  ) => Stream.Stream<ReadonlyArray<EntityId>, SpatialIndexError, never>

  // パフォーマンスメトリクス
  readonly getMetrics: Effect.Effect<SpatialIndexMetrics, never, never>

  // バッチ操作
  readonly batchInsert: (
    entities: ReadonlyArray<{ entityId: EntityId; position: Vector3 }>
  ) => Effect.Effect<void, SpatialIndexError, never>
}

// メトリクス定義
export const SpatialIndexMetrics = Schema.Struct({
  totalEntities: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  totalChunks: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageEntitiesPerChunk: Schema.Number.pipe(Schema.positive()),
  queryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  averageQueryTime: Schema.Number.pipe(Schema.positive())
})
export type SpatialIndexMetrics = Schema.Schema.Type<typeof SpatialIndexMetrics>

// Context Tag
export const SpatialIndex = Context.GenericTag<SpatialIndexInterface>("@minecraft/SpatialIndex")

// 空間ハッシュによる高速近傍検索（STM統合）
const makeSpatialIndex = (chunkSize: number = 16) =>
  Effect.gen(function* () {
    // STMで共有状態管理
    const spatialGrid = yield* Ref.make(new Map<string, Set<EntityId>>())
    const entityPositions = yield* Ref.make(new Map<EntityId, Vector3>())
    const metricsRef = yield* Ref.make<SpatialIndexMetrics>({
      totalEntities: 0,
      totalChunks: 0,
      averageEntitiesPerChunk: 0,
      queryCount: 0,
      averageQueryTime: 0
    })

    // 純粋関数: チャンクキー生成
    const getChunkKey = (x: number, z: number): string =>
      `${Math.floor(x / chunkSize)}:${Math.floor(z / chunkSize)}`

    // 純粋関数: 隣接チャンク取得
    const getAdjacentChunks = (chunkKey: string): string[] => {
      const [x, z] = chunkKey.split(':').map(Number)
      const adjacent = []
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          adjacent.push(`${x + dx}:${z + dz}`)
        }
      }
      return adjacent
    }

    // 純粋関数: 距離計算
    const calculateDistance3D = (pos1: Vector3, pos2: Vector3): number =>
      Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) +
        Math.pow(pos1.y - pos2.y, 2) +
        Math.pow(pos1.z - pos2.z, 2)
      )

    const insert = (
      entityId: EntityId,
      position: Vector3,
      boundingBox?: BoundingBoxComponent
    ) => Effect.gen(function* () {
      const chunkKey = getChunkKey(position.x, position.z)

      // STMでアトミックに更新
      yield* STM.commit(
        STM.gen(function* () {
          // グリッド更新
          yield* STM.update(spatialGrid, (grid) => {
            const newGrid = new Map(grid)
            if (!newGrid.has(chunkKey)) {
              newGrid.set(chunkKey, new Set())
            }
            newGrid.get(chunkKey)!.add(entityId)
            return newGrid
          })

          // 位置更新
          yield* STM.update(entityPositions, (positions) =>
            new Map(positions).set(entityId, position)
          )
        })
      )

      // メトリクス更新
      yield* Ref.update(metricsRef, (metrics) => {
        const grid = Ref.unsafeGet(spatialGrid)
        return {
          ...metrics,
          totalEntities: Ref.unsafeGet(entityPositions).size,
          totalChunks: grid.size,
          averageEntitiesPerChunk: grid.size > 0 ? Ref.unsafeGet(entityPositions).size / grid.size : 0
        }
      })
    }).pipe(
      Effect.mapError((error) =>
        new SpatialIndexError({
          operation: "insert",
          entityId,
          reason: `Failed to insert entity: ${error}`
        })
      )
    )

    const remove = (entityId: EntityId) =>
      Effect.gen(function* () {
        const positions = yield* Ref.get(entityPositions)
        const position = positions.get(entityId)

        if (!position) {
          return yield* Effect.fail(new SpatialIndexError({
            operation: "remove",
            entityId,
            reason: "Entity not found in spatial index"
          }))
        }

        const chunkKey = getChunkKey(position.x, position.z)

        yield* STM.commit(
          STM.gen(function* () {
            yield* STM.update(spatialGrid, (grid) => {
              const newGrid = new Map(grid)
              const chunk = newGrid.get(chunkKey)
              if (chunk) {
                chunk.delete(entityId)
                if (chunk.size === 0) {
                  newGrid.delete(chunkKey)
                }
              }
              return newGrid
            })

            yield* STM.update(entityPositions, (positions) => {
              const newPositions = new Map(positions)
              newPositions.delete(entityId)
              return newPositions
            })
          })
        )
      })

    const update = (entityId: EntityId, newPosition: Vector3) =>
      Effect.gen(function* () {
        // 削除して再挿入
        yield* remove(entityId).pipe(Effect.ignore) // エラーを無視
        yield* insert(entityId, newPosition)
      })

    const nearbyEntities = (position: Vector3, radius: number) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const chunkKey = getChunkKey(position.x, position.z)
        const adjacentChunks = getAdjacentChunks(chunkKey)

        const grid = yield* Ref.get(spatialGrid)
        const positions = yield* Ref.get(entityPositions)
        const nearby: EntityId[] = []

        for (const chunk of adjacentChunks) {
          const entities = grid.get(chunk)
          if (!entities) continue

          for (const entityId of entities) {
            const entityPos = positions.get(entityId)
            if (!entityPos) continue

            const distance = calculateDistance3D(position, entityPos)
            if (distance <= radius) {
              nearby.push(entityId)
            }
          }
        }

        // メトリクス更新
        const endTime = Date.now()
        yield* Ref.update(metricsRef, (metrics) => ({
          ...metrics,
          queryCount: metrics.queryCount + 1,
          averageQueryTime: (metrics.averageQueryTime + (endTime - startTime)) / 2
        }))

        return nearby
      })

    const query = (bounds: QueryBounds) =>
      Effect.gen(function* () {
        const grid = yield* Ref.get(spatialGrid)
        const positions = yield* Ref.get(entityPositions)
        const result: EntityId[] = []

        // 範囲内のチャンクを取得
        const minChunkX = Math.floor(bounds.min.x / chunkSize)
        const maxChunkX = Math.floor(bounds.max.x / chunkSize)
        const minChunkZ = Math.floor(bounds.min.z / chunkSize)
        const maxChunkZ = Math.floor(bounds.max.z / chunkSize)

        for (let x = minChunkX; x <= maxChunkX; x++) {
          for (let z = minChunkZ; z <= maxChunkZ; z++) {
            const chunkKey = `${x}:${z}`
            const entities = grid.get(chunkKey)
            if (!entities) continue

            for (const entityId of entities) {
              const pos = positions.get(entityId)
              if (!pos) continue

              // 範囲チョック
              if (
                pos.x >= bounds.min.x && pos.x <= bounds.max.x &&
                pos.y >= bounds.min.y && pos.y <= bounds.max.y &&
                pos.z >= bounds.min.z && pos.z <= bounds.max.z
              ) {
                result.push(entityId)
              }
            }
          }
        }

        return result
      })

    const watchNearbyEntities = (position: Vector3, radius: number) =>
      Stream.repeatEffect(
        nearbyEntities(position, radius).pipe(
          Effect.delay("100 millis") // 100msごとに更新
        )
      )

    const batchInsert = (
      entities: ReadonlyArray<{ entityId: EntityId; position: Vector3 }>
    ) =>
      Effect.forEach(
        entities,
        ({ entityId, position }) => insert(entityId, position),
        { concurrency: "unbounded", batching: true, discard: true }
      )

    const getMetrics = Effect.gen(function* () {
      return yield* Ref.get(metricsRef)
    })

    return {
      insert,
      remove,
      update,
      query,
      nearbyEntities,
      watchNearbyEntities,
      getMetrics,
      batchInsert
    }
  })

// Live Layer
export const SpatialIndexLive = Layer.effect(
  SpatialIndex,
  makeSpatialIndex(16) // 16ブロックチャンク
)
  })
```

### バッチ処理システム

```typescript
interface BatchProcessor {
  readonly processBatch: <T>(
    items: ReadonlyArray<T>,
    processor: (batch: ReadonlyArray<T>) => Effect.Effect<void, never>,
    batchSize?: number
  ) => Effect.Effect<void, never>

  readonly processParallel: <T>(
    items: ReadonlyArray<T>,
    processor: (item: T) => Effect.Effect<void, never>,
    concurrency?: number
  ) => Effect.Effect<void, never>
}

// 高効率バッチ処理実装
const makeBatchProcessor = Effect.gen(function* () {
  const processBatch = <T>(
    items: ReadonlyArray<T>,
    processor: (batch: ReadonlyArray<T>) => Effect.Effect<void, never>,
    batchSize: number = 1000
  ): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        yield* processor(batch)

        // CPU負荷分散のため少し待機
        if (i + batchSize < items.length) {
          yield* Effect.sleep("1 millis")
        }
      }
    })

  const processParallel = <T>(
    items: ReadonlyArray<T>,
    processor: (item: T) => Effect.Effect<void, never>,
    concurrency: number = 8
  ): Effect.Effect<void, never> =>
    Effect.forEach(items, processor, {
      concurrency: concurrency,
      batching: true
    }).pipe(Effect.asVoid)

  return { processBatch, processParallel }
})

// システム更新での活用例
const updateAllSystems = (deltaTime: number) =>
  Effect.gen(function* () {
    const batchProcessor = yield* makeBatchProcessor
    const entityManager = yield* EntityManager

    // 物理システム - バッチ処理で最適化
    const physicsEntities = yield* entityManager.queryWithComponents(
      "Position", "Velocity", "BoundingBox"
    )

    yield* batchProcessor.processBatch(
      physicsEntities,
      batch => updatePhysicsBatch(batch, deltaTime),
      500 // 500エンティティずつ処理
    )

    // AIシステム - 並列処理で最適化
    const aiEntities = yield* entityManager.queryWithComponents("AI", "Position")

    yield* batchProcessor.processParallel(
      aiEntities,
      ([entityId, components]) => updateAI(entityId, components, deltaTime),
      4 // 4スレッドで並列処理
    )
  })
```

## 実装例: 完全なエンティティ管理フロー

```typescript
// Mine・Attack・Useなどの複雑なエンティティ相互作用の例
const handleBlockBreaking = (
  playerId: EntityId,
  blockPosition: Vector3
): Effect.Effect<void, BlockBreakError> =>
  Effect.gen(function* () {
    const entityManager = yield* EntityManager
    const worldService = yield* WorldService
    const particleSystem = yield* ParticleSystem
    const inventorySystem = yield* InventorySystem

    // 早期リターン: プレイヤー存在確認
    const player = yield* entityManager.getEntity(playerId)
    const playerPos = yield* entityManager.getComponent<PositionComponent>(
      playerId, "Position"
    )

    // 早期リターン: 距離チェック
    const distance = calculateDistance(playerPos, blockPosition)
    if (distance > 5) {
      return yield* Effect.fail(new BlockBreakError("ブロックを壊すには遠すぎます"))
    }

    // 早期リターン: ブロック存在確認
    const block = yield* worldService.getBlock(blockPosition)
    if (!block || block.type === "air") {
      return yield* Effect.fail(new BlockBreakError("壊すブロックがありません"))
    }

    // ブロック破壊エフェクト生成
    yield* particleSystem.createBreakingEffect(blockPosition, block.type)

    // ドロップアイテム生成
    const dropItems = getBlockDrops(block.type)
    for (const item of dropItems) {
      const itemEntity = yield* EntityFactory.createItem(
        item,
        blockPosition,
        {
          x: (Math.random() - 0.5) * 2,
          y: Math.random() * 3 + 1,
          z: (Math.random() - 0.5) * 2
        }
      )

      // アイテムを物理システムに登録
      yield* addToPhysicsWorld(itemEntity)
    }

    // ブロック削除
    yield* worldService.setBlock(blockPosition, { type: "air" })

    // 周囲のエンティティに影響を与える（光源更新等）
    yield* updateNearbyEntities(blockPosition)
  })

// エンティティ相互作用システム
const processEntityInteractions = (deltaTime: number) =>
  Effect.gen(function* () {
    const entityManager = yield* EntityManager
    const spatialIndex = yield* SpatialIndex

    // 近接しているエンティティペアを取得
    const allPositions = yield* entityManager.queryWithComponents<
      [PositionComponent]
    >("Position")

    const interactions: [EntityId, EntityId][] = []

    for (const [entityId, [position]] of allPositions) {
      const nearbyEntities = yield* spatialIndex.nearbyEntities(position, 3)

      for (const nearbyId of nearbyEntities) {
        if (entityId !== nearbyId) {
          interactions.push([entityId, nearbyId])
        }
      }
    }

    // 相互作用処理
    yield* Effect.forEach(
      interactions,
      ([entityA, entityB]) => processInteraction(entityA, entityB),
      { concurrency: 8 }
    )
  })

const processInteraction = (entityA: EntityId, entityB: EntityId) =>
  Effect.gen(function* () {
    const entityManager = yield* EntityManager

    const [entityAData, entityBData] = yield* Effect.all([
      entityManager.getEntity(entityA),
      entityManager.getEntity(entityB)
    ])

    // Match.value パターンで相互作用を処理
    yield* Match.value([entityAData.type, entityBData.type]).pipe(
      Match.when(["player", "item"], () => handlePlayerItemPickup(entityA, entityB)),
      Match.when(["mob", "player"], () => handleMobPlayerInteraction(entityA, entityB)),
      Match.when(["projectile", "mob"], () => handleProjectileHit(entityA, entityB)),
      Match.when(["tnt", "fire"], () => handleTntIgnition(entityA, entityB)),
      Match.orElse(() => Effect.void) // 相互作用なし
    )
  })
```

## 完全なエンティティシステムレイヤー

```typescript
// コンポーネントストアLive実装
const makeComponentStore = Effect.gen(function* () {
  const storage = yield* Ref.make(new Map<string, Map<EntityId, Component>>())
  const eventQueue = yield* Queue.unbounded<{ entityId: EntityId; componentType: string; operation: "add" | "remove" }>()

  const get = <T extends Component>(entityId: EntityId, componentType: string) =>
    Effect.gen(function* () {
      const store = yield* Ref.get(storage)
      const componentMap = store.get(componentType)
      const component = componentMap?.get(entityId)

      return component
        ? Effect.succeed(component as T)
        : Effect.fail(new ComponentNotFoundError({ entityId, componentType }))
    }).pipe(Effect.flatten)

  const set = <T extends Component>(entityId: EntityId, component: T) =>
    Effect.gen(function* () {
      yield* STM.commit(
        STM.update(storage, (store) => {
          const newStore = new Map(store)
          if (!newStore.has(component._tag)) {
            newStore.set(component._tag, new Map())
          }
          newStore.get(component._tag)!.set(entityId, component)
          return newStore
        })
      )

      yield* Queue.offer(eventQueue, {
        entityId,
        componentType: component._tag,
        operation: "add"
      })
    })

  const remove = (entityId: EntityId, componentType: string) =>
    Effect.gen(function* () {
      const store = yield* Ref.get(storage)
      const componentMap = store.get(componentType)

      if (!componentMap?.has(entityId)) {
        return yield* Effect.fail(new ComponentNotFoundError({ entityId, componentType }))
      }

      yield* STM.commit(
        STM.update(storage, (store) => {
          const newStore = new Map(store)
          newStore.get(componentType)?.delete(entityId)
          return newStore
        })
      )

      yield* Queue.offer(eventQueue, {
        entityId,
        componentType,
        operation: "remove"
      })
    })

  const getAll = <T extends Component>(componentType: string) =>
    Effect.gen(function* () {
      const store = yield* Ref.get(storage)
      const componentMap = store.get(componentType)
      return componentMap
        ? Array.from(componentMap.entries()) as ReadonlyArray<[EntityId, T]>
        : []
    })

  const hasComponent = (entityId: EntityId, componentType: string) =>
    Effect.gen(function* () {
      const store = yield* Ref.get(storage)
      return store.get(componentType)?.has(entityId) ?? false
    })

  const stream = <T extends Component>(componentType: string) =>
    Stream.fromQueue(eventQueue).pipe(
      Stream.filter(event => event.componentType === componentType),
      Stream.mapEffect(event =>
        get<T>(event.entityId, componentType).pipe(
          Effect.map(component => [event.entityId, component] as [EntityId, T]),
          Effect.orElse(() => Effect.succeed(null))
        )
      ),
      Stream.filterMap(Option.fromNullable)
    )

  return ComponentStore.of({
    get,
    set,
    remove,
    getAll,
    hasComponent,
    stream
  })
})

export const ComponentStoreLive = Layer.effect(
  ComponentStore,
  makeComponentStore
)

// 統合エンティティシステムレイヤー（最新パターン）
export const EntitySystemLayer = Layer.mergeAll(
  ComponentStoreLive,
  SpatialIndexLive,
  EntityManagerLive,
  MovementSystemLive,
  AISystemLive,
  EntityFactoryLive
).pipe(
  // 外部依存サービス
  Layer.provide(PhysicsServiceLive),
  Layer.provide(WorldServiceLive),
  Layer.provide(PathfindingServiceLive)
)

// メインゲームループ統合
const updateEntitySystems = (deltaTime: number) =>
  Effect.gen(function* () {
    // 並列システム更新
    const movementSystem = yield* MovementSystem
    const aiSystem = yield* AISystem

    yield* Effect.all([
      movementSystem.update(deltaTime),
      aiSystem.update(deltaTime)
    ], {
      concurrency: 2,
      batching: false
    })
  })

// メトリクス収集
const collectSystemMetrics = Effect.gen(function* () {
  const aiSystem = yield* AISystem
  const spatialIndex = yield* SpatialIndex

  const aiMetrics = yield* aiSystem.getMetrics
  const spatialMetrics = yield* spatialIndex.getMetrics

  return {
    ai: aiMetrics,
    spatial: spatialMetrics,
    timestamp: new Date()
  }
})

// システムヘルスチェック
const performSystemHealthCheck = Effect.gen(function* () {
  const entityManager = yield* EntityManager

  // 全エンティティ数取得
  const allPositions = yield* entityManager.query("Position")
  const allAI = yield* entityManager.query("AI")

  return {
    totalEntities: allPositions.length,
    activeAI: allAI.length,
    healthy: allPositions.length > 0,
    lastCheck: new Date()
  }
})

// システムユーティリティ
export const EntitySystemUtils = {
  updateEntitySystems,
  collectSystemMetrics,
  performSystemHealthCheck
}
```

## 性能最適化パターン

### Streamベースリアルタイム処理

```typescript
// エンティティイベントストリームパイプライン
const createEntityEventPipeline = Effect.gen(function* () {
  const entityManager = yield* EntityManager
  const aiSystem = yield* AISystem
  const movementSystem = yield* MovementSystem

  // エンティティ作成イベントストリーム
  const entityCreationStream = entityManager.entityEvents.pipe(
    Stream.filter(event => event._tag === "EntityCreated"),
    Stream.mapEffect((event) => Effect.gen(function* () {
      console.log(`Entity created: ${event.entityId}`)
      // 初期化処理
      return event
    }))
  )

  // AI状態変更ストリーム
  const aiStateStream = aiSystem.aiEvents.pipe(
    Stream.filter(event => event._tag === "AIStateChanged"),
    Stream.mapEffect((event) => Effect.gen(function* () {
      console.log(`AI state changed: ${event.entityId} ${event.fromState} -> ${event.toState}`)
      return event
    }))
  )

  // 移動イベントストリーム
  const movementStream = movementSystem.movementEvents.pipe(
    Stream.filter(event => event._tag === "EntityMoved"),
    Stream.bufferChunks({ n: 100, duration: "10 millis" }), // バッファリング
    Stream.mapEffect((events) => Effect.gen(function* () {
      console.log(`Batch processed ${events.length} movement events`)
      return events
    }))
  )

  // ストリーム結合
  const combinedEventStream = Stream.merge(
    entityCreationStream,
    aiStateStream,
    movementStream
  )

  return combinedEventStream
})

// パフォーマンスモニタリング
const createPerformanceMonitor = Effect.gen(function* () {
  const metricsStream = Stream.repeatEffect(
    collectSystemMetrics.pipe(
      Effect.delay("1 seconds")
    )
  )

  const alertStream = metricsStream.pipe(
    Stream.filter(metrics =>
      metrics.ai.averageUpdateTime > 16 || // 16ms以上の場合アラート
      metrics.spatial.averageQueryTime > 5
    ),
    Stream.mapEffect(metrics => Effect.gen(function* () {
      console.warn("パフォーマンスアラート:", metrics)
      return metrics
    }))
  )

  return {
    metricsStream,
    alertStream
  }
})
```

### メモリ効率最適化

```typescript
// オブジェクトプールパターン
const createEntityObjectPool = <T>(factory: () => T, resetFn: (obj: T) => void) =>
  Effect.gen(function* () {
    const pool = yield* Queue.bounded<T>(1000)
    const activeCount = yield* Ref.make(0)

    const acquire = Effect.gen(function* () {
      const fromPool = yield* Queue.poll(pool)

      return Match.value(fromPool).pipe(
        Match.when(Option.isSome, (obj) => Effect.succeed(obj.value)),
        Match.orElse(() => Effect.sync(() => factory()))
      )
    })

    const release = (obj: T) => Effect.gen(function* () {
      resetFn(obj)
      yield* Queue.offer(pool, obj)
    })

    return { acquire, release }
  })

// TypedArrayベースのComponentストレージ
const createTypedArrayComponentStorage = (capacity: number) =>
  Effect.gen(function* () {
    // Positionコンポーネント用TypedArray
    const positionArrays = {
      x: new Float32Array(capacity),
      y: new Float32Array(capacity),
      z: new Float32Array(capacity),
      chunkX: new Int32Array(capacity),
      chunkZ: new Int32Array(capacity)
    }

    // Velocityコンポーネント用TypedArray
    const velocityArrays = {
      x: new Float32Array(capacity),
      y: new Float32Array(capacity),
      z: new Float32Array(capacity)
    }

    const entityIndexMap = yield* Ref.make(new Map<EntityId, number>())
    const freeIndices = yield* Ref.make(new Set(Array.from({ length: capacity }, (_, i) => i)))

    const allocateIndex = Effect.gen(function* () {
      const free = yield* Ref.get(freeIndices)
      if (free.size === 0) {
        return yield* Effect.fail(new Error("インデックスプールが枯渇しました"))
      }

      const index = free.values().next().value
      yield* Ref.update(freeIndices, (set) => {
        const newSet = new Set(set)
        newSet.delete(index)
        return newSet
      })

      return index
    })

    const setPositionComponent = (index: number, component: PositionComponent) =>
      Effect.sync(() => {
        positionArrays.x[index] = component.position.x
        positionArrays.y[index] = component.position.y
        positionArrays.z[index] = component.position.z
        positionArrays.chunkX[index] = component.chunk.x
        positionArrays.chunkZ[index] = component.chunk.z
      })

    const getPositionComponent = (index: number): PositionComponent => ({
      _tag: "Position",
      position: {
        x: positionArrays.x[index],
        y: positionArrays.y[index],
        z: positionArrays.z[index]
      },
      chunk: {
        x: positionArrays.chunkX[index],
        z: positionArrays.chunkZ[index]
      }
    })

    // SIMD最適化対応のバッチ更新
    const updatePositionsBatch = (
      indices: ReadonlyArray<number>,
      deltaPositions: { x: Float32Array; y: Float32Array; z: Float32Array }
    ) => Effect.sync(() => {
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i]
        positionArrays.x[idx] += deltaPositions.x[i]
        positionArrays.y[idx] += deltaPositions.y[i]
        positionArrays.z[idx] += deltaPositions.z[i]

        // チャンク位置更新
        positionArrays.chunkX[idx] = Math.floor(positionArrays.x[idx] / 16)
        positionArrays.chunkZ[idx] = Math.floor(positionArrays.z[idx] / 16)
      }
    })

    return {
      allocateIndex,
      setPositionComponent,
      getPositionComponent,
      updatePositionsBatch
    }
  })
