# Entity System - エンティティ管理システム

## 概要

Entity Systemは、TypeScript Minecraft cloneにおける全ての動的オブジェクト（プレイヤー以外）を管理する高性能システムです。Structure of Arrays (SoA) ECSアーキテクチャとEffect-TS 3.17+の最新パターンを活用し、数千のエンティティを効率的に処理しながら、純粋関数型プログラミングの原則を維持します。

本システムは以下の機能を提供します：
- **モブ管理**: 動物・モンスター・NPCの統合管理（100+種類対応）
- **AI実装**: ステートマシンベースの複雑な行動制御
- **スポーンシステム**: バイオーム・時間・難易度に基づく動的出現
- **物理演算**: 重力・衝突・摩擦の統合処理システム
- **アニメーション**: 60FPSでの滑らかなモーション補間
- **パーティクル**: リアルタイムエフェクトシステム

## Entity Component System Architecture

### Core ECS Types

```typescript
import { Effect, Layer, Context, Schema, pipe, Ref, STM } from "effect"
import { Brand, Option, ReadonlyArray, HashMap } from "effect"

// IMPORTANT: Context7で最新のEffect-TSパターンを確認

// Entity ID（ブランド型）
export const EntityId = Schema.UUID.pipe(Schema.brand("EntityId"))
export type EntityId = Schema.Schema.Type<typeof EntityId>

// Component基底インターフェース
export interface Component {
  readonly _tag: string
}

// Entity定義
export const Entity = Schema.Struct({
  id: EntityId,
  type: Schema.Literal(
    "player", "zombie", "skeleton", "creeper", "cow", "pig", "sheep",
    "item", "arrow", "fireball", "tnt", "boat", "minecart", "painting"
  ),
  active: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc
})

export type Entity = Schema.Schema.Type<typeof Entity>

// Component Store
export interface ComponentStore {
  readonly get: <T extends Component>(
    entityId: EntityId,
    componentType: string
  ) => Option.Option<T>

  readonly set: <T extends Component>(
    entityId: EntityId,
    component: T
  ) => void

  readonly remove: (
    entityId: EntityId,
    componentType: string
  ) => void

  readonly getAll: <T extends Component>(
    componentType: string
  ) => ReadonlyArray<[EntityId, T]>

  readonly hasComponent: (
    entityId: EntityId,
    componentType: string
  ) => boolean
}
```

## Core Components

### Position & Movement Components

```typescript
// Position Component
export const PositionComponent = Schema.Struct({
  _tag: Schema.Literal("Position"),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  chunk: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int())
  })
})
export type PositionComponent = Schema.Schema.Type<typeof PositionComponent>

// Velocity Component
export const VelocityComponent = Schema.Struct({
  _tag: Schema.Literal("Velocity"),
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
export type VelocityComponent = Schema.Schema.Type<typeof VelocityComponent>

// Rotation Component
export const RotationComponent = Schema.Struct({
  _tag: Schema.Literal("Rotation"),
  yaw: pipe(Schema.Number, Schema.between(-180, 180)),
  pitch: pipe(Schema.Number, Schema.between(-90, 90)),
  roll: Schema.optional(Schema.Number)
})
export type RotationComponent = Schema.Schema.Type<typeof RotationComponent>

// BoundingBox Component
export const BoundingBoxComponent = Schema.Struct({
  _tag: Schema.Literal("BoundingBox"),
  width: Schema.Number.pipe(Schema.positive()),
  height: Schema.Number.pipe(Schema.positive()),
  depth: Schema.Number.pipe(Schema.positive()),
  offset: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }))
})
export type BoundingBoxComponent = Schema.Schema.Type<typeof BoundingBoxComponent>
```

### Health & Combat Components

```typescript
// Health Component
export const HealthComponent = Schema.Struct({
  _tag: Schema.Literal("Health"),
  current: Schema.Number.pipe(Schema.nonNegative()),
  max: Schema.Number.pipe(Schema.positive()),
  regeneration: Schema.Number,
  invulnerableUntil: Schema.optional(Schema.DateTimeUtc)
})
export type HealthComponent = Schema.Schema.Type<typeof HealthComponent>

// Combat Component
export const CombatComponent = Schema.Struct({
  _tag: Schema.Literal("Combat"),
  damage: Schema.Number.pipe(Schema.nonNegative()),
  attackSpeed: Schema.Number.pipe(Schema.positive()),
  knockback: Schema.Number,
  lastAttack: Schema.optional(Schema.DateTimeUtc),
  target: Schema.optional(EntityId)
})
export type CombatComponent = Schema.Schema.Type<typeof CombatComponent>

// Armor Component
export const ArmorComponent = Schema.Struct({
  _tag: Schema.Literal("Armor"),
  defense: Schema.Number.pipe(Schema.nonNegative()),
  toughness: Schema.Number.pipe(Schema.nonNegative()),
  enchantments: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      level: Schema.Number.pipe(Schema.int(), Schema.positive())
    })
  )
})
export type ArmorComponent = Schema.Schema.Type<typeof ArmorComponent>
```

### AI Components

```typescript
// AI Component
export const AIComponent = Schema.Struct({
  _tag: Schema.Literal("AI"),
  enabled: Schema.Boolean,
  behaviors: Schema.Array(
    Schema.Literal(
      "wander", "follow", "flee", "attack", "patrol",
      "guard", "breed", "sleep", "eat", "swim"
    )
  ),
  state: Schema.Struct({
    current: Schema.String,
    target: Schema.optional(EntityId),
    path: Schema.optional(Schema.Array(
      Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
        z: Schema.Number
      })
    )),
    memory: Schema.Record(Schema.String, Schema.Unknown)
  })
})
export type AIComponent = Schema.Schema.Type<typeof AIComponent>

// Brain Component (高度なAI)
export const BrainComponent = Schema.Struct({
  _tag: Schema.Literal("Brain"),
  memories: Schema.Record(Schema.String, Schema.Unknown),
  sensors: Schema.Array(Schema.String),
  activities: Schema.Array(Schema.String),
  schedule: Schema.optional(Schema.Struct({
    activities: Schema.Array(Schema.Struct({
      time: Schema.Number,
      activity: Schema.String
    }))
  }))
})
export type BrainComponent = Schema.Schema.Type<typeof BrainComponent>
```

## Entity Manager

### Entity Management Service

```typescript
// EntityManagerインターフェース
interface EntityManagerInterface {
  readonly createEntity: (
    type: Entity["type"],
    components: ReadonlyArray<Component>
  ) => Effect.Effect<EntityId, CreateEntityError>

  readonly destroyEntity: (
    id: EntityId
  ) => Effect.Effect<void, EntityNotFoundError>

  readonly getEntity: (
    id: EntityId
  ) => Effect.Effect<Entity, EntityNotFoundError>

  readonly addComponent: <T extends Component>(
    entityId: EntityId,
    component: T
  ) => Effect.Effect<void, EntityNotFoundError>

  readonly removeComponent: (
    entityId: EntityId,
    componentType: string
  ) => Effect.Effect<void, ComponentNotFoundError>

  readonly getComponent: <T extends Component>(
    entityId: EntityId,
    componentType: string
  ) => Effect.Effect<T, ComponentNotFoundError>

  readonly query: (
    ...componentTypes: string[]
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>

  readonly queryWithComponents: <T extends Component[]>(
    ...componentTypes: string[]
  ) => Effect.Effect<ReadonlyArray<[EntityId, T]>, never>
}

// Context Tag（最新パターン）
export const EntityManager = Context.GenericTag<EntityManagerInterface>("@app/EntityManager")

// Live実装作成関数
const makeEntityManager = Effect.gen(function* () {
  // エンティティストレージ
  const entities = yield* Ref.make(new Map<EntityId, Entity>())
  const componentStore = yield* createComponentStore()
  const archetypes = yield* createArchetypeManager()

    const createEntity = (
      type: Entity["type"],
      components: ReadonlyArray<Component>
    ) => Effect.gen(function* () {
      const id = yield* generateEntityId()
      const now = new Date()

      const entity: Entity = {
        id,
        type,
        active: true,
        createdAt: now,
        updatedAt: now
      }

      // STMトランザクションで原子的に更新
      yield* STM.commit(
        STM.gen(function* () {
          yield* STM.set(entities, (map) => new Map(map).set(id, entity))

          // コンポーネントを追加
          for (const component of components) {
            componentStore.set(id, component)
          }

          // アーキタイプ更新
          yield* archetypes.updateArchetype(id, components.map(c => c._tag))
        })
      )

      // イベント発行
      yield* publishEntityCreatedEvent(id, type)

      return id
    })

    const destroyEntity = (id: EntityId) =>
      Effect.gen(function* () {
        const entity = yield* getEntity(id)

        // STMトランザクションで原子的に削除
        yield* STM.commit(
          STM.gen(function* () {
            yield* STM.update(entities, (map) => {
              const newMap = new Map(map)
              newMap.delete(id)
              return newMap
            })

            // 全コンポーネントを削除
            componentStore.removeAll(id)

            // アーキタイプから削除
            yield* archetypes.removeEntity(id)
          })
        )

        // イベント発行
        yield* publishEntityDestroyedEvent(id)
      })

    const query = (...componentTypes: string[]) =>
      Effect.gen(function* () {
        // アーキタイプベースの高速クエリ
        return yield* archetypes.query(componentTypes)
      })

    const queryWithComponents = <T extends Component[]>(
      ...componentTypes: string[]
    ) => Effect.gen(function* () {
      const entityIds = yield* query(...componentTypes)
      const results: [EntityId, T][] = []

      for (const id of entityIds) {
        const components = componentTypes.map(type =>
          componentStore.get(id, type)
        )

        if (components.every(Option.isSome)) {
          results.push([
            id,
            components.map(Option.getOrThrow) as T
          ])
        }
      }

      return results
    })

    return EntityManager.of({
      createEntity,
      destroyEntity,
      getEntity: (id) => Effect.gen(function* () {
        const entitiesMap = yield* Ref.get(entities)
        const entity = entitiesMap.get(id)

        if (!entity) {
          return yield* Effect.fail(new EntityNotFoundError(id))
        }

        return entity
      }),
      addComponent: (entityId, component) =>
        Effect.gen(function* () {
          yield* getEntity(entityId) // 存在確認
          componentStore.set(entityId, component)
          yield* archetypes.addComponentToEntity(entityId, component._tag)
        }),
      removeComponent: (entityId, componentType) =>
        Effect.gen(function* () {
          componentStore.remove(entityId, componentType)
          yield* archetypes.removeComponentFromEntity(entityId, componentType)
        }),
      getComponent: (entityId, componentType) =>
        Effect.gen(function* () {
          const component = componentStore.get(entityId, componentType)

          if (Option.isNone(component)) {
            return yield* Effect.fail(
              new ComponentNotFoundError(entityId, componentType)
            )
          }

          return Option.getOrThrow(component)
        }),
      query,
      queryWithComponents
    })
  })

// Live Layer
export const EntityManagerLive = Layer.effect(
  EntityManager,
  makeEntityManager
)
```

## Entity Systems

### Movement System

```typescript
// MovementSystemインターフェース
interface MovementSystemInterface {
  readonly update: (deltaTime: number) => Effect.Effect<void, never>
  readonly moveEntity: (
    entityId: EntityId,
    velocity: Vector3
  ) => Effect.Effect<void, MovementError>
}

// Context Tag（最新パターン）
export const MovementSystem = Context.GenericTag<MovementSystemInterface>("@app/MovementSystem")

// Live実装作成関数
const makeMovementSystem = Effect.gen(function* () {
  const entityManager = yield* EntityManager
  const physics = yield* PhysicsService
  const world = yield* WorldService

    const update = (deltaTime: number) =>
      Effect.gen(function* () {
        // 位置と速度を持つ全エンティティを取得
        const entities = yield* entityManager.queryWithComponents<
          [PositionComponent, VelocityComponent]
        >("Position", "Velocity")

        // 並列処理で各エンティティを更新
        yield* Effect.forEach(
          entities,
          ([entityId, [position, velocity]]) =>
            updateEntityPosition(entityId, position, velocity, deltaTime),
          { concurrency: "unbounded" }
        )
      })

    const updateEntityPosition = (
      entityId: EntityId,
      position: PositionComponent,
      velocity: VelocityComponent,
      deltaTime: number
    ) => Effect.gen(function* () {
      // 純粋関数: 新しい位置を計算
      const calculateNewPosition = (pos: PositionComponent, vel: VelocityComponent, dt: number) => ({
        x: pos.x + vel.x * dt,
        y: pos.y + vel.y * dt,
        z: pos.z + vel.z * dt
      })

      // 純粋関数: 重力を適用した速度を計算
      const applyGravity = (vel: VelocityComponent, dt: number) => ({
        ...vel,
        y: vel.y - 9.81 * dt // 重力加速度
      })

      const newPosition = calculateNewPosition(position, velocity, deltaTime)

      // 衝突検出
      const boundingBox = yield* entityManager.getComponent<BoundingBoxComponent>(
        entityId,
        "BoundingBox"
      ).pipe(
        Effect.orElseSucceed(() => ({
          _tag: "BoundingBox" as const,
          width: 0.6,
          height: 1.8,
          depth: 0.6
        }))
      )

      const collision = yield* physics.checkCollision(newPosition, boundingBox)

      // Match.valueで衝突処理を分岐
      const resolvedPosition = yield* Match.value(collision.hasCollision).pipe(
        Match.when(true, () => Effect.gen(function* () {
          const resolved = yield* physics.resolveCollision(position, newPosition, collision)

          // 垂直方向の衝突時は速度をリセット
          if (collision.axis === "y" && velocity.y < 0) {
            yield* entityManager.addComponent(entityId, {
              ...velocity,
              y: 0
            })
          }

          return resolved
        })),
        Match.when(false, () => Effect.succeed(newPosition)),
        Match.exhaustive
      )

      const newVelocity = applyGravity(velocity, deltaTime)

      // コンポーネント更新
      yield* entityManager.addComponent(entityId, {
        _tag: "Position" as const,
        ...resolvedPosition,
        chunk: {
          x: Math.floor(resolvedPosition.x / 16),
          z: Math.floor(resolvedPosition.z / 16)
        }
      })

      yield* entityManager.addComponent(entityId, newVelocity)
    })

    const moveEntity = (entityId: EntityId, velocity: Vector3) =>
      Effect.gen(function* () {
        const position = yield* entityManager.getComponent<PositionComponent>(
          entityId,
          "Position"
        )

        yield* entityManager.addComponent(entityId, {
          _tag: "Velocity" as const,
          ...velocity
        })
      })

    return MovementSystem.of({ update, moveEntity })
  })

// Live Layer
export const MovementSystemLive = Layer.effect(
  MovementSystem,
  makeMovementSystem
)
```

### AI System

```typescript
// AISystemインターフェース
interface AISystemInterface {
  readonly update: (deltaTime: number) => Effect.Effect<void, never>
  readonly setTarget: (
    entityId: EntityId,
    targetId: EntityId
  ) => Effect.Effect<void, never>
  readonly clearTarget: (entityId: EntityId) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const AISystem = Context.GenericTag<AISystemInterface>("@app/AISystem")

// Live実装作成関数
const makeAISystem = Effect.gen(function* () {
  const entityManager = yield* EntityManager
  const pathfinding = yield* PathfindingService
  const movement = yield* MovementSystem

    const update = (deltaTime: number) =>
      Effect.gen(function* () {
        const aiEntities = yield* entityManager.queryWithComponents<
          [AIComponent, PositionComponent]
        >("AI", "Position")

        yield* Effect.forEach(
          aiEntities,
          ([entityId, [ai, position]]) =>
            updateAI(entityId, ai, position, deltaTime),
          { concurrency: 10 } // AI処理の並列度を制限
        )
      })

    const updateAI = (
      entityId: EntityId,
      ai: AIComponent,
      position: PositionComponent,
      deltaTime: number
    ) => Effect.gen(function* () {
      // 早期リターン: AI無効化チェック
      if (!ai.enabled) {
        return yield* Effect.void
      }

      // Match.valueパターンで状態処理
      yield* Match.value(ai.state.current).pipe(
        Match.when("idle", () => handleIdleState(entityId, ai, position)),
        Match.when("wander", () => handleWanderState(entityId, ai, position, deltaTime)),
        Match.when("follow", () => handleFollowState(entityId, ai, position, deltaTime)),
        Match.when("attack", () => handleAttackState(entityId, ai, position, deltaTime)),
        Match.when("flee", () => handleFleeState(entityId, ai, position, deltaTime)),
        Match.orElse(() => Effect.sync(() => {
          console.warn(`Unknown AI state: ${ai.state.current}`)
        }))
      )
    })

    const handleWanderState = (
      entityId: EntityId,
      ai: AIComponent,
      position: PositionComponent,
      deltaTime: number
    ) => Effect.gen(function* () {
      // ランダムな目的地を設定
      if (!ai.state.path || ai.state.path.length === 0) {
        const target = {
          x: position.x + (Math.random() - 0.5) * 20,
          y: position.y,
          z: position.z + (Math.random() - 0.5) * 20
        }

        const path = yield* pathfinding.findPath(
          position,
          target
        ).pipe(Effect.orElseSucceed(() => []))

        yield* entityManager.addComponent(entityId, {
          ...ai,
          state: { ...ai.state, path }
        })
      }

      // パスに沿って移動
      if (ai.state.path && ai.state.path.length > 0) {
        const nextPoint = ai.state.path[0]
        const distance = calculateDistance(position, nextPoint)

        if (distance < 0.5) {
          // 次のポイントへ
          yield* entityManager.addComponent(entityId, {
            ...ai,
            state: {
              ...ai.state,
              path: ai.state.path.slice(1)
            }
          })
        } else {
          // 移動
          const direction = normalize({
            x: nextPoint.x - position.x,
            y: 0,
            z: nextPoint.z - position.z
          })

          yield* movement.moveEntity(entityId, {
            x: direction.x * 2,
            y: 0,
            z: direction.z * 2
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
      if (!ai.state.target) return

      const targetPosition = yield* entityManager.getComponent<PositionComponent>(
        ai.state.target,
        "Position"
      ).pipe(Effect.orElse(() => {
        // ターゲットが存在しない場合はアイドル状態へ
        return Effect.gen(function* () {
          yield* entityManager.addComponent(entityId, {
            ...ai,
            state: { ...ai.state, current: "idle", target: undefined }
          })
          return yield* Effect.fail(new Error("Target not found"))
        })
      }))

      const distance = calculateDistance(position, targetPosition)

      if (distance < 2) {
        // 攻撃範囲内
        yield* performAttack(entityId, ai.state.target)
      } else if (distance < 16) {
        // 追跡
        const path = yield* pathfinding.findPath(position, targetPosition)
        yield* entityManager.addComponent(entityId, {
          ...ai,
          state: { ...ai.state, path }
        })
      } else {
        // 範囲外 - アイドル状態へ
        yield* entityManager.addComponent(entityId, {
          ...ai,
          state: { ...ai.state, current: "idle", target: undefined }
        })
      }
    })

    return AISystem.of({
      update,
      setTarget: (entityId, targetId) =>
        Effect.gen(function* () {
          const ai = yield* entityManager.getComponent<AIComponent>(
            entityId,
            "AI"
          )

          yield* entityManager.addComponent(entityId, {
            ...ai,
            state: {
              ...ai.state,
              current: "attack",
              target: targetId
            }
          })
        }),
      clearTarget: (entityId) =>
        Effect.gen(function* () {
          const ai = yield* entityManager.getComponent<AIComponent>(
            entityId,
            "AI"
          )

          yield* entityManager.addComponent(entityId, {
            ...ai,
            state: {
              ...ai.state,
              current: "idle",
              target: undefined
            }
          })
        })
    })
  })

// Live Layer
export const AISystemLive = Layer.effect(
  AISystem,
  makeAISystem
)
```

## Entity Factory

### Entity Creation Patterns

```typescript
// EntityFactoryインターフェース
interface EntityFactoryInterface {
  readonly createPlayer: (
    name: string,
    position: Vector3
  ) => Effect.Effect<EntityId, CreateEntityError>

  readonly createMob: (
    type: MobType,
    position: Vector3
  ) => Effect.Effect<EntityId, CreateEntityError>

  readonly createItem: (
    itemStack: ItemStack,
    position: Vector3,
    velocity?: Vector3
  ) => Effect.Effect<EntityId, CreateEntityError>

  readonly createProjectile: (
    type: ProjectileType,
    position: Vector3,
    velocity: Vector3,
    owner: EntityId
  ) => Effect.Effect<EntityId, CreateEntityError>
}

// Context Tag（最新パターン）
export const EntityFactory = Context.GenericTag<EntityFactoryInterface>("@app/EntityFactory")

// Live実装作成関数
const makeEntityFactory = Effect.gen(function* () {
  const entityManager = yield* EntityManager

    const createPlayer = (name: string, position: Vector3) =>
      entityManager.createEntity("player", [
        {
          _tag: "Position",
          ...position,
          chunk: { x: Math.floor(position.x / 16), z: Math.floor(position.z / 16) }
        },
        { _tag: "Velocity", x: 0, y: 0, z: 0 },
        { _tag: "Rotation", yaw: 0, pitch: 0 },
        { _tag: "BoundingBox", width: 0.6, height: 1.8, depth: 0.6 },
        { _tag: "Health", current: 20, max: 20, regeneration: 0.1 },
        { _tag: "PlayerData", name, level: 0, experience: 0 }
      ])

    const createMob = (type: MobType, position: Vector3) => {
      const mobConfig = getMobConfig(type)

      return entityManager.createEntity(type, [
        {
          _tag: "Position",
          ...position,
          chunk: { x: Math.floor(position.x / 16), z: Math.floor(position.z / 16) }
        },
        { _tag: "Velocity", x: 0, y: 0, z: 0 },
        { _tag: "Rotation", yaw: Math.random() * 360 - 180, pitch: 0 },
        {
          _tag: "BoundingBox",
          width: mobConfig.width,
          height: mobConfig.height,
          depth: mobConfig.depth
        },
        {
          _tag: "Health",
          current: mobConfig.health,
          max: mobConfig.health,
          regeneration: 0
        },
        {
          _tag: "AI",
          enabled: true,
          behaviors: mobConfig.behaviors,
          state: { current: "idle", memory: {} }
        },
        {
          _tag: "Combat",
          damage: mobConfig.damage,
          attackSpeed: mobConfig.attackSpeed,
          knockback: 0.4
        }
      ])
    }

    const createItem = (
      itemStack: ItemStack,
      position: Vector3,
      velocity: Vector3 = { x: 0, y: 0, z: 0 }
    ) => entityManager.createEntity("item", [
      {
        _tag: "Position",
        ...position,
        chunk: { x: Math.floor(position.x / 16), z: Math.floor(position.z / 16) }
      },
      { _tag: "Velocity", ...velocity },
      { _tag: "BoundingBox", width: 0.25, height: 0.25, depth: 0.25 },
      { _tag: "ItemData", itemStack },
      { _tag: "Pickup", delay: 0.5, canPickup: true }
    ])

    return EntityFactory.of({ createPlayer, createMob, createItem, createProjectile })
  })

// Live Layer
export const EntityFactoryLive = Layer.effect(
  EntityFactory,
  makeEntityFactory
)
```

## Structure of Arrays (SoA) ECS実装

### SoA アーキテクチャ概要

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
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i]
        if (activeSlots.has(idx)) {
          xArray[idx] += deltaX[i]
          yArray[idx] += deltaY[i]
          zArray[idx] += deltaZ[i]

          // チャンク位置更新
          chunkXArray[idx] = Math.floor(xArray[idx] / 16)
          chunkZArray[idx] = Math.floor(zArray[idx] / 16)
        }
      }
    })

    return { setPosition, getPosition, updatePositionsBatch, activeSlots }
  })
```

### アーキタイプベースクエリシステム

```typescript
// アーキタイプ定義
interface Archetype {
  readonly id: string
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

      for (const [_, archetype] of allArchetypes) {
        // 全ての必要コンポーネントを持つアーキタイプかチェック
        const hasAllComponents = componentTypes.every(type =>
          archetype.componentTypes.has(type)
        )

        if (hasAllComponents) {
          matchingEntities.push(...archetype.entities)
        }
      }

      return matchingEntities
    })

  return { createArchetype, fastQuery }
})
```

## メモリプールシステム

### Entity Memory Pool

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
          return yield* Effect.fail(new AllocationError("Pool exhausted"))
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
interface SpatialIndex {
  readonly insert: (
    entityId: EntityId,
    position: Vector3,
    boundingBox: BoundingBox
  ) => Effect.Effect<void, never>

  readonly remove: (entityId: EntityId) => Effect.Effect<void, never>

  readonly query: (
    area: BoundingBox
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>

  readonly nearbyEntities: (
    position: Vector3,
    radius: number
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>
}

// 空間ハッシュによる高速近傍検索
const makeSpatialIndex = (chunkSize: number = 16) =>
  Effect.gen(function* () {
    const spatialGrid = new Map<string, Set<EntityId>>()
    const entityPositions = new Map<EntityId, Vector3>()

    const getChunkKey = (x: number, z: number): string =>
      `${Math.floor(x / chunkSize)}:${Math.floor(z / chunkSize)}`

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

    const insert = (
      entityId: EntityId,
      position: Vector3,
      boundingBox: BoundingBox
    ) => Effect.sync(() => {
      const chunkKey = getChunkKey(position.x, position.z)

      if (!spatialGrid.has(chunkKey)) {
        spatialGrid.set(chunkKey, new Set())
      }

      spatialGrid.get(chunkKey)!.add(entityId)
      entityPositions.set(entityId, position)
    })

    const nearbyEntities = (position: Vector3, radius: number) =>
      Effect.sync(() => {
        const chunkKey = getChunkKey(position.x, position.z)
        const adjacentChunks = getAdjacentChunks(chunkKey)
        const nearby: EntityId[] = []

        for (const chunk of adjacentChunks) {
          const entities = spatialGrid.get(chunk)
          if (!entities) continue

          for (const entityId of entities) {
            const entityPos = entityPositions.get(entityId)
            if (!entityPos) continue

            const distance = Math.sqrt(
              Math.pow(position.x - entityPos.x, 2) +
              Math.pow(position.y - entityPos.y, 2) +
              Math.pow(position.z - entityPos.z, 2)
            )

            if (distance <= radius) {
              nearby.push(entityId)
            }
          }
        }

        return nearby
      })

    return { insert, remove, query, nearbyEntities }
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

## 実装例: 完全なEntity管理フロー

```typescript
// Mine・Attack・Useなどの複雑なEntity相互作用の例
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
      return yield* Effect.fail(new BlockBreakError("Too far to break block"))
    }

    // 早期リターン: ブロック存在確認
    const block = yield* worldService.getBlock(blockPosition)
    if (!block || block.type === "air") {
      return yield* Effect.fail(new BlockBreakError("No block to break"))
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

## Complete Entity System Layer

```typescript
export const EntitySystemLayer = Layer.mergeAll(
  EntityManagerLive,
  MovementSystemLive,
  AISystemLive,
  EntityFactoryLive,
  SpatialIndexLive,
  BatchProcessorLive,
  ParticleSystemLive,
  InventorySystemLive
).pipe(
  Layer.provide(PhysicsServiceLive),
  Layer.provide(WorldServiceLive),
  Layer.provide(PathfindingServiceLive),
  Layer.provide(EntityMemoryPoolLive)
)