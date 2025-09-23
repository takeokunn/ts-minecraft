/**
 * ECS World - エンティティ、コンポーネント、システムの統合管理
 *
 * ECSアーキテクチャの中心となるコンテナ
 * パフォーマンス最適化のためのStructure of Arrays (SoA)パターンを採用
 */

import { Context, Data, Effect, Layer, Ref, Schema, Match, Option, pipe } from 'effect'
import { EntityManager } from './EntityManager.js'
import { SystemRegistryService, SystemRegistryServiceLive, SystemRegistryError } from './SystemRegistry.js'
import type { System, SystemPriority } from './System.js'
import { SystemError } from './System.js'
import { type EntityId, EntityId as EntityIdBrand } from './Entity.js'

// EntityIdを再エクスポート
export { type EntityId } from './Entity.js'


/**
 * ワールドエラー
 */
export const WorldError = Schema.TaggedStruct('WorldError', {
  message: Schema.String,
  entityId: Schema.optional(Schema.Number.pipe(Schema.brand('EntityId'))),
  componentType: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export type WorldError = Schema.Schema.Type<typeof WorldError>

/**
 * コンポーネントストレージ - 型消去されたコンポーネントデータ
 */
interface ComponentStorage {
  readonly type: string
  readonly data: Map<EntityId, unknown>
}

/**
 * エンティティメタデータ
 */
export const EntityMetadata = Schema.Struct({
  id: Schema.Number.pipe(Schema.brand('EntityId')),
  name: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  createdAt: Schema.Number,
  active: Schema.Boolean,
})

export type EntityMetadata = Schema.Schema.Type<typeof EntityMetadata>

/**
 * ワールドの統計情報
 */
export const WorldStats = Schema.Struct({
  entityCount: Schema.Number,
  componentCount: Schema.Number,
  systemCount: Schema.Number,
  frameTime: Schema.Number,
  fps: Schema.Number,
  memoryUsage: Schema.optional(Schema.Number),
})

export type WorldStats = Schema.Schema.Type<typeof WorldStats>

/**
 * ワールドの内部状態
 */
interface WorldState {
  readonly entities: Map<EntityId, EntityMetadata>
  readonly components: Map<string, ComponentStorage>
  readonly entityIdCounter: number
  readonly stats: WorldStats
}

/**
 * ワールドサービス - ECSの統合管理
 */
export interface World {
  /**
   * 新しいエンティティを作成
   */
  readonly createEntity: (name?: string, tags?: readonly string[]) => Effect.Effect<EntityId, WorldError>

  /**
   * エンティティを削除
   */
  readonly destroyEntity: (id: EntityId) => Effect.Effect<void, WorldError>

  /**
   * エンティティにコンポーネントを追加
   */
  readonly addComponent: <T>(entityId: EntityId, componentType: string, component: T) => Effect.Effect<void, WorldError>

  /**
   * エンティティからコンポーネントを削除
   */
  readonly removeComponent: (entityId: EntityId, componentType: string) => Effect.Effect<void, WorldError>

  /**
   * エンティティのコンポーネントを取得
   */
  readonly getComponent: <T>(entityId: EntityId, componentType: string) => Effect.Effect<T | null, WorldError>

  /**
   * エンティティが特定のコンポーネントを持っているか確認
   */
  readonly hasComponent: (entityId: EntityId, componentType: string) => Effect.Effect<boolean, never>

  /**
   * 特定のコンポーネントを持つすべてのエンティティを取得
   */
  readonly getEntitiesWithComponent: (componentType: string) => Effect.Effect<readonly EntityId[], never>

  /**
   * 複数のコンポーネントを持つエンティティを取得（AND検索）
   */
  readonly getEntitiesWithComponents: (componentTypes: readonly string[]) => Effect.Effect<readonly EntityId[], never>

  /**
   * タグでエンティティを検索
   */
  readonly getEntitiesByTag: (tag: string) => Effect.Effect<readonly EntityId[], never>

  /**
   * すべてのエンティティIDを取得
   */
  readonly getAllEntities: Effect.Effect<readonly EntityId[], never>

  /**
   * エンティティのメタデータを取得
   */
  readonly getEntityMetadata: (id: EntityId) => Effect.Effect<EntityMetadata | null, never>

  /**
   * システムを登録
   */
  readonly registerSystem: (
    system: System,
    priority?: SystemPriority,
    order?: number
  ) => Effect.Effect<void, SystemRegistryError>

  /**
   * システムを削除
   */
  readonly unregisterSystem: (name: string) => Effect.Effect<void, SystemRegistryError>

  /**
   * ワールドを更新（すべてのシステムを実行）
   */
  readonly update: (deltaTime: number) => Effect.Effect<void, SystemError | WorldError>

  /**
   * ワールドの統計情報を取得
   */
  readonly getStats: Effect.Effect<WorldStats, never>

  /**
   * ワールドをクリア
   */
  readonly clear: Effect.Effect<void, never>

  /**
   * コンポーネントの一括取得（パフォーマンス最適化）
   */
  readonly batchGetComponents: <T>(componentType: string) => Effect.Effect<ReadonlyMap<EntityId, T>, never>

  /**
   * エンティティの有効/無効を切り替え
   */
  readonly setEntityActive: (id: EntityId, active: boolean) => Effect.Effect<void, WorldError>
}

/**
 * ワールドサービスタグ
 */
export const World = Context.GenericTag<World>('@minecraft/ecs/World')

/**
 * ワールドサービスの実装
 */
export const WorldLive = Layer.effect(
  World,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<WorldState>({
      entityIdCounter: 0,
      entities: new Map(),
      components: new Map(),
      stats: {
        entityCount: 0,
        componentCount: 0,
        systemCount: 0,
        frameTime: 0,
        fps: 0,
      },
    })

    const entityManager = yield* EntityManager
    const systemRegistry = yield* SystemRegistryService

    return World.of({
      createEntity: (name?: string, tags?: readonly string[]) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const id = EntityIdBrand(state.entityIdCounter)
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            entityIdCounter: state.entityIdCounter + 1,
          }))

          yield* pipe(
            entityManager.createEntity(id, name, tags),
            Effect.mapError((error) => new WorldError({ message: error.message, cause: error }))
          )
          return id
        }),

      destroyEntity: (id: EntityId) =>
        pipe(
          entityManager.destroyEntity(id),
          Effect.mapError((error) => new WorldError({ message: error.message, cause: error }))
        ),

      addComponent: <T>(entityId: EntityId, componentType: string, component: T) =>
        pipe(
          entityManager.addComponent(entityId, componentType, component),
          Effect.mapError((error) => new WorldError({ message: error.message, cause: error }))
        ),

      removeComponent: (entityId: EntityId, componentType: string) =>
        pipe(
          entityManager.removeComponent(entityId, componentType),
          Effect.mapError((error) => new WorldError({ message: error.message, cause: error }))
        ),

      getComponent: <T>(entityId: EntityId, componentType: string) =>
        pipe(
          entityManager.getComponent<T>(entityId, componentType),
          Effect.map(Option.match({
            onNone: () => null,
            onSome: (component) => component
          }))
        ),

      hasComponent: (entityId: EntityId, componentType: string) =>
        entityManager.hasComponent(entityId, componentType),

      getEntitiesWithComponent: (componentType: string) => entityManager.getEntitiesWithComponent(componentType),

      getEntitiesWithComponents: (componentTypes: readonly string[]) =>
        entityManager.getEntitiesWithComponents(componentTypes),

      getEntitiesByTag: (tag: string) => entityManager.getEntitiesByTag(tag),

      getAllEntities: entityManager.getAllEntities(),

      getEntityMetadata: (id: EntityId) =>
        pipe(
          entityManager.getEntityMetadata(id),
          Effect.map(Option.match({
            onNone: () => null,
            onSome: (metadata) => metadata
          }))
        ),

      registerSystem: (system: System, priority?: SystemPriority, order?: number) =>
        systemRegistry.register(system, priority, order),

      unregisterSystem: (name: string) => systemRegistry.unregister(name),

      update: (deltaTime: number) =>
        pipe(
          systemRegistry.update(deltaTime),
          Effect.mapError((error) => {
            if (error._tag === 'SystemError') {
              return error
            }
            return new WorldError({ message: error.message, cause: error })
          })
        ),

      getStats: Effect.gen(function* () {
        const allEntities = yield* entityManager.getAllEntities()
        const systems = yield* systemRegistry.getSystems

        return {
          entityCount: allEntities.length,
          componentCount: 0, // TODO: 実際のコンポーネント数を計算
          systemCount: systems.length,
          frameTime: 0, // TODO: 実際のフレーム時間を計算
          fps: 0, // TODO: 実際のFPSを計算
        }
      }),

      clear: Effect.gen(function* () {
        yield* entityManager.clear()
        yield* systemRegistry.clear
        yield* Ref.set(stateRef, {
          entityIdCounter: 0,
          entities: new Map(),
          components: new Map(),
          stats: {
            entityCount: 0,
            componentCount: 0,
            systemCount: 0,
            frameTime: 0,
            fps: 0,
          },
        })
      }),

      batchGetComponents: <T>(componentType: string) =>
        pipe(
          entityManager.batchGetComponents<T>(componentType),
          Effect.map(arr => new Map(arr))
        ),

      setEntityActive: (id: EntityId, active: boolean) =>
        pipe(
          entityManager.setEntityActive(id, active),
          Effect.mapError((error) => new WorldError({ message: error.message, cause: error }))
        ),
    })
  })
)
