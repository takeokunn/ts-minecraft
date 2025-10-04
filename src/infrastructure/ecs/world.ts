/**
 * ECS World - エンティティ、コンポーネント、システムの統合管理
 *
 * ECSアーキテクチャの中心となるコンテナ
 * パフォーマンス最適化のためのStructure of Arrays (SoA)パターンを採用
 */

import { Schema } from '@effect/schema'
import { Clock, Context, Effect, Layer, Match, Option, pipe, Predicate, Ref } from 'effect'
import type { EntityId } from './entity'
import { createEntityId } from './entity'
import type { System, SystemPriority } from './system'
import { SystemError } from './system'
import { SystemRegistryError, SystemRegistryService } from './system-registry'

// EntityIdを再エクスポート
export { type EntityId } from './entity'

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

export const isWorldError: Predicate.Refinement<unknown, WorldError> = (error): error is WorldError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'WorldError'

/**
 * WorldErrorインスタンス作成ヘルパー
 */
const createWorldError = (data: {
  message: string
  entityId?: EntityId
  componentType?: string
  cause?: unknown
}): WorldError => ({
  _tag: 'WorldError' as const,
  ...data,
})

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
export const World = Context.GenericTag<World>('@minecraft/infrastructure/World')

/**
 * ワールドサービスの実装
 */
export const WorldLive = Layer.effect(
  World,
  Effect.gen(function* () {
    const initialState: WorldState = {
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
    }

    const stateRef = yield* Ref.make(initialState)
    const initialTime = yield* Clock.currentTimeMillis
    const lastUpdateTimeRef = yield* Ref.make(initialTime)

    /**
     * エンティティIDを生成
     */
    const generateEntityId = () =>
      Ref.modify(stateRef, (state) => {
        const id = createEntityId(state.entityIdCounter)
        return [id, { ...state, entityIdCounter: state.entityIdCounter + 1 }]
      })

    /**
     * 新しいエンティティを作成
     */
    const createEntity = (name?: string, tags: readonly string[] = []) =>
      Effect.gen(function* () {
        const id = yield* generateEntityId()
        const createdAt = yield* Clock.currentTimeMillis

        const metadata: EntityMetadata = {
          id,
          name: name ?? undefined,
          tags: [...tags],
          createdAt,
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

        yield* pipe(
          Match.value(state.entities.has(id)),
          Match.when(false, () =>
            Effect.fail(
              createWorldError({
                message: `Entity not found: ${id}`,
                entityId: id,
              })
            )
          ),
          Match.orElse(() => Effect.void)
        )

        yield* Ref.update(stateRef, (s) => {
          const newEntities = new Map(s.entities)
          newEntities.delete(id)

          const newComponents = Array.from(s.components.entries()).reduce((acc, [type, storage]) => {
            const newData = new Map(storage.data)
            newData.delete(id)
            acc.set(type, { ...storage, data: newData })
            return acc
          }, new Map<string, ComponentStorage>())

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

        yield* pipe(
          Match.value(state.entities.has(entityId)),
          Match.when(false, () =>
            Effect.fail(
              createWorldError({
                message: `Entity not found: ${entityId}`,
                entityId,
              })
            )
          ),
          Match.orElse(() => Effect.void)
        )

        yield* Ref.update(stateRef, (s) => {
          const storage = s.components.get(componentType)
          const baseStorage: ComponentStorage = storage ?? { type: componentType, data: new Map() }
          const updatedData = new Map(baseStorage.data)
          updatedData.set(entityId, component)

          const updatedComponents = new Map(s.components)
          updatedComponents.set(componentType, { ...baseStorage, data: updatedData })

          const totalComponents = Array.from(updatedComponents.values()).reduce(
            (count, stor) => count + stor.data.size,
            0
          )

          return {
            ...s,
            components: updatedComponents,
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
        yield* Ref.update(stateRef, (state) =>
          pipe(
            state.components.get(componentType),
            Option.fromNullable,
            Option.filter((storage) => storage.data.has(entityId)),
            Option.match({
              onNone: () => state,
              onSome: (storage) => {
                const baseComponents = new Map(state.components)
                const nextData = new Map(storage.data)
                nextData.delete(entityId)

                const updatedComponents = pipe(
                  nextData.size === 0 ? Option.some(true) : Option.none<boolean>(),
                  Option.match({
                    onSome: () => {
                      const components = new Map(baseComponents)
                      components.delete(componentType)
                      return components
                    },
                    onNone: () => {
                      const components = new Map(baseComponents)
                      components.set(componentType, { ...storage, data: nextData })
                      return components
                    },
                  })
                )

                const componentCount = Array.from(updatedComponents.values()).reduce(
                  (count, stor) => count + stor.data.size,
                  0
                )

                return {
                  ...state,
                  components: updatedComponents,
                  stats: {
                    ...state.stats,
                    componentCount,
                  },
                }
              },
            })
          )
        )
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
        const result = yield* pipe(
          componentTypes.length,
          Match.value,
          Match.when(0, () => Effect.succeed([])),
          Match.orElse(() => Effect.succeed(null))
        )

        return yield* pipe(
          Option.fromNullable(result),
          Option.match({
            onNone: () =>
              Effect.gen(function* () {
                const state = yield* Ref.get(stateRef)

                // 最初のコンポーネントを持つエンティティから開始
                const firstStorageResult = yield* pipe(
                  Option.fromNullable(state.components.get(componentTypes[0]!)),
                  Option.match({
                    onNone: () => Effect.succeed([]),
                    onSome: (storage) => Effect.succeed(Array.from(storage.data.keys())),
                  })
                )

                let entities = firstStorageResult

                return yield* pipe(
                  entities.length === 0,
                  Match.value,
                  Match.when(true, () => Effect.succeed(entities)),
                  Match.when(false, () =>
                    Effect.succeed(
                      componentTypes.slice(1).reduce(
                        (entities, componentType) =>
                          pipe(
                            Option.fromNullable(state.components.get(componentType)),
                            Option.match({
                              onNone: () => [],
                              onSome: (storage) => entities.filter((id) => storage.data.has(id)),
                            })
                          ),
                        entities
                      )
                    )
                  ),
                  Match.exhaustive,
                  Effect.map((entities) =>
                    entities.filter((id) => {
                      const metadata = state.entities.get(id)
                      return metadata?.active ?? false
                    })
                  )
                )
              }),
            onSome: (value) => Effect.succeed(value),
          })
        )
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
        const startTime = yield* Clock.currentTimeMillis

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

        const endTime = yield* Clock.currentTimeMillis
        const frameTime = endTime - startTime
        const previousUpdateTime = yield* Ref.get(lastUpdateTimeRef)
        const elapsedSinceLast = Math.max(endTime - previousUpdateTime, 1)
        const fps = 1000 / elapsedSinceLast

        yield* Ref.set(lastUpdateTimeRef, endTime)

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
            onSome: (storage) =>
              Array.from(storage.data.entries()).reduce(
                (effectAcc, [id, component]) =>
                  effectAcc.pipe(
                    Effect.map((acc) =>
                      pipe(
                        Option.fromNullable(state.entities.get(id)),
                        Option.flatMap((metadata) => (metadata.active ? Option.some(metadata) : Option.none())),
                        Option.match({
                          onNone: () => acc,
                          onSome: () => acc.set(id, component as T),
                        })
                      )
                    )
                  ),
                Effect.succeed(new Map<EntityId, T>())
              ),
          })
        )
      })

    /**
     * エンティティの有効/無効を切り替え
     */
    const setEntityActive = (id: EntityId, active: boolean) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        yield* pipe(
          Match.value(state.entities.has(id)),
          Match.when(false, () =>
            Effect.fail(
              createWorldError({
                message: `Entity not found: ${id}`,
                entityId: id,
              })
            )
          ),
          Match.orElse(() => Effect.void)
        )

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

    const systemRegistry = yield* SystemRegistryService

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
)
