/**
 * ECS World - エンティティ、コンポーネント、システムの統合管理
 *
 * ECSアーキテクチャの中心となるコンテナ
 * パフォーマンス最適化のためのStructure of Arrays (SoA)パターンを採用
 */

import { Context, Data, Effect, Layer, Ref, Schema, Match, Option, pipe } from 'effect'
import { SystemRegistryService, SystemRegistryServiceLive, SystemRegistryError } from './SystemRegistry.js'
import type { System, SystemPriority } from './System.js'
import { SystemError } from './System.js'

/**
 * エンティティID - ブランド型で型安全性を確保
 */
export const EntityId = Schema.String.pipe(Schema.brand('EntityId'))
export type EntityId = Schema.Schema.Type<typeof EntityId>

/**
 * ワールドエラー
 */
export const WorldError = Schema.TaggedError('WorldError')({
  message: Schema.String,
  entityId: Schema.optional(EntityId),
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
  id: EntityId,
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
    const systemRegistry = yield* SystemRegistryService

    // 初期状態
    const initialState: WorldState = {
      entities: new Map(),
      components: new Map(),
      entityIdCounter: 0,
      stats: {
        entityCount: 0,
        componentCount: 0,
        systemCount: 0,
        frameTime: 0,
        fps: 60,
      },
    }

    const stateRef = yield* Ref.make(initialState)
    let lastUpdateTime = Date.now()

    /**
     * エンティティIDを生成
     */
    const generateEntityId = (): EntityId => {
      const state = Effect.runSync(Ref.get(stateRef))
      const id = `entity_${state.entityIdCounter}` as EntityId
      Effect.runSync(
        Ref.update(stateRef, (s) => ({
          ...s,
          entityIdCounter: s.entityIdCounter + 1,
        }))
      )
      return id
    }

    /**
     * 新しいエンティティを作成
     */
    const createEntity = (name?: string, tags: readonly string[] = []) =>
      Effect.gen(function* () {
        const id = generateEntityId()

        const metadata: EntityMetadata = {
          id,
          name: name ?? undefined,
          tags: [...tags],
          createdAt: Date.now(),
          active: true,
        }

        yield* Ref.update(stateRef, (state) => {
          const newEntities = new Map(state.entities)
          newEntities.set(id, metadata)

          return {
            ...state,
            entities: newEntities,
            stats: {
              ...state.stats,
              entityCount: newEntities.size,
            },
          }
        })

        yield* Effect.logDebug(`Entity created: ${id}`)
        return id
      })

    /**
     * エンティティを削除
     */
    const destroyEntity = (id: EntityId) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        if (!state.entities.has(id)) {
          yield* Effect.fail({
            _tag: 'WorldError',
            message: `Entity not found: ${id}`,
            entityId: id,
          } satisfies WorldError)
        }

        yield* Ref.update(stateRef, (s) => {
          const newEntities = new Map(s.entities)
          newEntities.delete(id)

          // すべてのコンポーネントストレージからエンティティを削除
          const newComponents = new Map(s.components)
          for (const [type, storage] of newComponents) {
            const newData = new Map(storage.data)
            newData.delete(id)
            newComponents.set(type, { ...storage, data: newData })
          }

          return {
            ...s,
            entities: newEntities,
            components: newComponents,
            stats: {
              ...s.stats,
              entityCount: newEntities.size,
            },
          }
        })

        yield* Effect.logDebug(`Entity destroyed: ${id}`)
      })

    /**
     * コンポーネントを追加
     */
    const addComponent = <T>(entityId: EntityId, componentType: string, component: T) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        if (!state.entities.has(entityId)) {
          yield* Effect.fail({
            _tag: 'WorldError',
            message: `Entity not found: ${entityId}`,
            entityId,
          } satisfies WorldError)
        }

        yield* Ref.update(stateRef, (s) => {
          const newComponents = new Map(s.components)

          // 既存のストレージを取得または新規作成
          const existingStorage = newComponents.get(componentType)
          const storage: ComponentStorage = existingStorage ?? {
            type: componentType,
            data: new Map(),
          }

          const newData = new Map(storage.data)
          newData.set(entityId, component)

          newComponents.set(componentType, { ...storage, data: newData })

          // コンポーネント総数を計算
          let totalComponents = 0
          for (const stor of newComponents.values()) {
            totalComponents += stor.data.size
          }

          return {
            ...s,
            components: newComponents,
            stats: {
              ...s.stats,
              componentCount: totalComponents,
            },
          }
        })
      })

    /**
     * コンポーネントを削除
     */
    const removeComponent = (entityId: EntityId, componentType: string) =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (state) => {
          const storage = state.components.get(componentType)

          return pipe(
            Option.fromNullable(storage),
            Option.flatMap((storage) =>
              pipe(
                storage.data.has(entityId),
                Match.value,
                Match.when(false, () => Option.none()),
                Match.orElse(() => Option.some(storage))
              )
            ),
            Option.match({
              onNone: () => state,
              onSome: (storage) => {
                const newData = new Map(storage.data)
                newData.delete(entityId)

                const newComponents = new Map(state.components)
                const components =
                  newData.size === 0
                    ? (() => {
                        newComponents.delete(componentType)
                        return newComponents
                      })()
                    : (() => {
                        newComponents.set(componentType, { ...storage, data: newData })
                        return newComponents
                      })()

                // コンポーネント総数を計算
                let totalComponents = 0
                for (const stor of components.values()) {
                  totalComponents += stor.data.size
                }

                return {
                  ...state,
                  components,
                  stats: {
                    ...state.stats,
                    componentCount: totalComponents,
                  },
                }
              },
            })
          )
        })
      })

    /**
     * コンポーネントを取得
     */
    const getComponent = <T>(entityId: EntityId, componentType: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        return pipe(
          Option.fromNullable(state.components.get(componentType)),
          Option.match({
            onNone: () => null,
            onSome: (storage) =>
              pipe(
                Option.fromNullable(storage.data.get(entityId)),
                Option.match({
                  onNone: () => null,
                  onSome: (component) => component as T,
                })
              ),
          })
        )
      })

    /**
     * コンポーネントの存在確認
     */
    const hasComponent = (entityId: EntityId, componentType: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        return yield* pipe(
          Option.fromNullable(state.components.get(componentType)),
          Option.match({
            onNone: () => Effect.succeed(false),
            onSome: (storage) => Effect.succeed(storage.data.has(entityId)),
          })
        )
      })

    /**
     * 特定のコンポーネントを持つエンティティを取得
     */
    const getEntitiesWithComponent = (componentType: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        return yield* pipe(
          Option.fromNullable(state.components.get(componentType)),
          Option.match({
            onNone: () => Effect.succeed([]),
            onSome: (storage) =>
              Effect.succeed(
                Array.from(storage.data.keys()).filter((id) => {
                  const metadata = state.entities.get(id)
                  return metadata?.active ?? false
                })
              ),
          })
        )
      })

    /**
     * 複数のコンポーネントを持つエンティティを取得
     */
    const getEntitiesWithComponents = (componentTypes: readonly string[]) =>
      Effect.gen(function* () {
        // コンポーネントタイプがない場合は空配列を返す
        if (componentTypes.length === 0) {
          return []
        }

        const state = yield* Ref.get(stateRef)

        // 最初のコンポーネントを持つエンティティから開始
        const firstComponentType = componentTypes[0]
        if (!firstComponentType) {
          return []
        }

        const firstStorage = state.components.get(firstComponentType)
        if (!firstStorage) {
          return []
        }

        let entities = Array.from(firstStorage.data.keys())

        // 残りのコンポーネントでフィルタリング
        for (let i = 1; i < componentTypes.length; i++) {
          const componentType = componentTypes[i]
          if (!componentType) {
            entities = []
            break
          }

          const storage = state.components.get(componentType)
          if (!storage) {
            entities = []
            break
          }

          entities = entities.filter((id) => storage.data.has(id))
        }

        // アクティブなエンティティのみを返す
        return entities.filter((id) => {
          const metadata = state.entities.get(id)
          return metadata?.active ?? false
        })
      })

    /**
     * タグでエンティティを検索
     */
    const getEntitiesByTag = (tag: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return Array.from(state.entities.entries())
          .filter(([, metadata]) => metadata.active && metadata.tags.includes(tag))
          .map(([id]) => id)
      })

    /**
     * すべてのエンティティを取得
     */
    const getAllEntities = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return Array.from(state.entities.keys())
    })

    /**
     * エンティティのメタデータを取得
     */
    const getEntityMetadata = (id: EntityId) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return pipe(Option.fromNullable(state.entities.get(id)), Option.getOrNull)
      })

    /**
     * システムを登録
     */
    const registerSystem = (system: System, priority?: SystemPriority, order?: number) =>
      Effect.gen(function* () {
        yield* systemRegistry.register(system, priority, order)

        // システム数を更新
        const systems = yield* systemRegistry.getSystems
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          stats: {
            ...state.stats,
            systemCount: systems.length,
          },
        })).pipe(Effect.asVoid)
      })

    /**
     * システムを削除
     */
    const unregisterSystem = (name: string) =>
      Effect.gen(function* () {
        yield* systemRegistry.unregister(name)

        // システム数を更新
        const systems = yield* systemRegistry.getSystems
        yield* Ref.update(stateRef, (state) => ({
          ...state,
          stats: {
            ...state.stats,
            systemCount: systems.length,
          },
        })).pipe(Effect.asVoid)
      })

    /**
     * ワールドを更新
     */
    const update = (deltaTime: number) =>
      Effect.gen(function* () {
        const startTime = Date.now()

        // Worldインスタンスを作成
        const world: World = {
          createEntity,
          destroyEntity,
          addComponent,
          removeComponent,
          getComponent,
          hasComponent,
          getEntitiesWithComponent,
          getEntitiesWithComponents,
          getEntitiesByTag,
          getAllEntities,
          getEntityMetadata,
          registerSystem,
          unregisterSystem,
          update,
          getStats,
          clear,
          batchGetComponents,
          setEntityActive,
        }

        // すべてのシステムを実行
        yield* systemRegistry.update(world, deltaTime)

        // 統計を更新
        const frameTime = Date.now() - startTime
        const fps = 1000 / (Date.now() - lastUpdateTime)
        lastUpdateTime = Date.now()

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          stats: {
            ...state.stats,
            frameTime,
            fps: Math.round(fps),
          },
        })).pipe(Effect.asVoid)
      })

    /**
     * 統計情報を取得
     */
    const getStats = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.stats
    })

    /**
     * ワールドをクリア
     */
    const clear = Effect.gen(function* () {
      yield* systemRegistry.clear
      yield* Ref.set(stateRef, initialState).pipe(Effect.asVoid)
      yield* Effect.logInfo('World cleared')
    })

    /**
     * コンポーネントの一括取得
     */
    const batchGetComponents = <T>(componentType: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        return yield* pipe(
          Option.fromNullable(state.components.get(componentType)),
          Option.match({
            onNone: () => Effect.succeed(new Map<EntityId, T>()),
            onSome: (storage) => {
              // アクティブなエンティティのみをフィルタリング
              const activeComponents = new Map<EntityId, T>()
              for (const [id, component] of storage.data) {
                const metadata = pipe(Option.fromNullable(state.entities.get(id)), Option.getOrNull)

                if (metadata && metadata.active) {
                  activeComponents.set(id, component as T)
                }
              }

              return Effect.succeed(activeComponents)
            },
          })
        )
      })

    /**
     * エンティティの有効/無効を切り替え
     */
    const setEntityActive = (id: EntityId, active: boolean) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        if (!state.entities.has(id)) {
          yield* Effect.fail({
            _tag: 'WorldError',
            message: `Entity not found: ${id}`,
            entityId: id,
          } satisfies WorldError)
        }

        yield* Ref.update(stateRef, (s) => {
          return pipe(
            Option.fromNullable(s.entities.get(id)),
            Option.match({
              onNone: () => s,
              onSome: (metadata) => {
                const newMetadata = { ...metadata, active }
                const newEntities = new Map(s.entities)
                newEntities.set(id, newMetadata)

                return {
                  ...s,
                  entities: newEntities,
                }
              },
            })
          )
        })
      })

    return World.of({
      createEntity,
      destroyEntity,
      addComponent,
      removeComponent,
      getComponent,
      hasComponent,
      getEntitiesWithComponent,
      getEntitiesWithComponents,
      getEntitiesByTag,
      getAllEntities,
      getEntityMetadata,
      registerSystem,
      unregisterSystem,
      update,
      getStats,
      clear,
      batchGetComponents,
      setEntityActive,
    })
  })
).pipe(Layer.provide(SystemRegistryServiceLive))
