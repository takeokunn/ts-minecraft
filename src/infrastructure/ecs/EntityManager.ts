import { Context, Data, Effect, HashMap, Layer, Option, pipe, Match, Stream, Predicate } from 'effect'
import { Schema } from '@effect/schema'
import type { SystemError } from './System'
import { SystemRegistryService, type SystemRegistryError } from './SystemRegistry'
import {
  type EntityId,
  type EntityMetadata,
  EntityPool,
  type EntityPoolError,
  createComponentStorage,
  type ComponentStorage,
  createArchetypeManager,
  type ArchetypeManager,
} from './Entity'
import { ComponentTypeName, BrandedTypes } from '../../shared/types/branded'

// =====================================
// Entity Manager Errors
// =====================================

/**
 * EntityManager操作のエラー - Schema.TaggedError パターン
 */
export const EntityManagerErrorReason = Schema.Literal(
  'ENTITY_NOT_FOUND',
  'COMPONENT_NOT_FOUND',
  'INVALID_COMPONENT_TYPE',
  'ENTITY_LIMIT_REACHED',
  'COMPONENT_ALREADY_EXISTS'
)
export type EntityManagerErrorReason = Schema.Schema.Type<typeof EntityManagerErrorReason>

// Define EntityId schema for error reporting
const EntityIdSchema = Schema.Number.pipe(Schema.brand('EntityId'))

export interface EntityManagerError {
  readonly _tag: 'EntityManagerError'
  readonly message: string
  readonly reason: EntityManagerErrorReason
  readonly entityId?: number
  readonly componentType?: ComponentTypeName
}

export const EntityManagerError = (
  message: string,
  reason: EntityManagerErrorReason,
  entityId?: number,
  componentType?: ComponentTypeName
): EntityManagerError => ({
  _tag: 'EntityManagerError',
  message,
  reason,
  ...(entityId !== undefined && { entityId }),
  ...(componentType !== undefined && { componentType }),
})

export const isEntityManagerError: Predicate.Refinement<unknown, EntityManagerError> = (
  error
): error is EntityManagerError => Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'EntityManagerError'

/**
 * EntityManagerError作成ヘルパー
 */
export const createEntityManagerError = {
  entityNotFound: (entityId: EntityId, operation?: string) =>
    EntityManagerError(
      `Entity ${entityId} not found${operation ? ` during ${operation}` : ''}`,
      'ENTITY_NOT_FOUND',
      entityId
    ),
  componentNotFound: (componentType: ComponentTypeName, entityId?: EntityId) =>
    EntityManagerError(
      `Component type ${componentType} not found${entityId ? ` on entity ${entityId}` : ''}`,
      'COMPONENT_NOT_FOUND',
      entityId,
      componentType
    ),
  invalidComponentType: (componentType: ComponentTypeName, details?: string) =>
    EntityManagerError(
      `Invalid component type: ${componentType}${details ? ` - ${details}` : ''}`,
      'INVALID_COMPONENT_TYPE',
      undefined,
      componentType
    ),
  entityLimitReached: (limit: number) => EntityManagerError(`Entity limit reached: ${limit}`, 'ENTITY_LIMIT_REACHED'),
  componentAlreadyExists: (entityId: EntityId, componentType: ComponentTypeName) =>
    EntityManagerError(
      `Component ${componentType} already exists on entity ${entityId}`,
      'COMPONENT_ALREADY_EXISTS',
      entityId,
      componentType
    ),
}

// =====================================
// Entity Manager Stats
// =====================================

export const EntityManagerStats = Schema.Struct({
  totalEntities: Schema.Number,
  activeEntities: Schema.Number,
  totalComponents: Schema.Number,
  componentTypes: Schema.Number,
  archetypeCount: Schema.Number,
  memoryUsage: Schema.optional(Schema.Number),
})

export type EntityManagerStats = Schema.Schema.Type<typeof EntityManagerStats>

// =====================================
// Component Type Registry
// =====================================

interface ComponentTypeInfo {
  readonly name: string
  readonly storage: ComponentStorage<unknown>
  readonly count: number
}

// =====================================
// Entity Manager Interface
// =====================================

export interface EntityManager {
  // エンティティ管理
  readonly createEntity: (
    name?: string,
    tags?: readonly string[]
  ) => Effect.Effect<EntityId, EntityManagerError | EntityPoolError>
  readonly destroyEntity: (id: EntityId) => Effect.Effect<void, EntityManagerError | EntityPoolError>
  readonly isEntityAlive: (id: EntityId) => Effect.Effect<boolean, never>
  readonly getEntityMetadata: (id: EntityId) => Effect.Effect<Option.Option<EntityMetadata>, never>
  readonly setEntityActive: (id: EntityId, active: boolean) => Effect.Effect<void, EntityManagerError>

  // コンポーネント管理
  readonly addComponent: <T>(
    entityId: EntityId,
    componentType: ComponentTypeName,
    component: T
  ) => Effect.Effect<void, EntityManagerError>
  readonly removeComponent: (
    entityId: EntityId,
    componentType: ComponentTypeName
  ) => Effect.Effect<void, EntityManagerError>
  readonly getComponent: <T>(
    entityId: EntityId,
    componentType: ComponentTypeName
  ) => Effect.Effect<Option.Option<T>, never>
  readonly hasComponent: (entityId: EntityId, componentType: ComponentTypeName) => Effect.Effect<boolean, never>
  readonly getEntityComponents: (entityId: EntityId) => Effect.Effect<ReadonlyMap<ComponentTypeName, unknown>, never>

  // クエリ
  readonly getEntitiesWithComponent: (componentType: ComponentTypeName) => Effect.Effect<ReadonlyArray<EntityId>, never>
  readonly getEntitiesWithComponents: (
    componentTypes: readonly ComponentTypeName[]
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>
  readonly getEntitiesByTag: (tag: string) => Effect.Effect<ReadonlyArray<EntityId>, never>
  readonly getAllEntities: () => Effect.Effect<ReadonlyArray<EntityId>, never>

  // バッチ操作（高速）
  readonly batchGetComponents: <T>(
    componentType: ComponentTypeName
  ) => Effect.Effect<ReadonlyArray<[EntityId, T]>, never>
  readonly iterateComponents: <T, R, E>(
    componentType: ComponentTypeName,
    f: (entity: EntityId, component: T) => Effect.Effect<void, E, R>
  ) => Effect.Effect<void, E, R>

  // システム実行
  readonly update: (deltaTime: number) => Effect.Effect<void, SystemError | EntityManagerError>

  // 統計・デバッグ
  readonly getStats: () => Effect.Effect<EntityManagerStats, never>
  readonly clear: () => Effect.Effect<void, never>
}

// =====================================
// Entity Manager Implementation
// =====================================

export const EntityManagerLive = Effect.gen(function* () {
  // Dependencies
  const entityPool = yield* EntityPool
  const systemRegistry = yield* SystemRegistryService

  // Internal state
  const entities = new Map<EntityId, EntityMetadata>()
  const componentStorages = new Map<ComponentTypeName, ComponentStorage<unknown>>()
  const entityComponents = new Map<EntityId, Set<ComponentTypeName>>()
  const archetypeManager = createArchetypeManager()
  const tagIndex = new Map<string, Set<EntityId>>()

  let entityGeneration = 0

  // Helper: コンポーネントストレージの取得または作成
  const getOrCreateStorage = (componentType: ComponentTypeName): ComponentStorage<unknown> => {
    return pipe(
      Option.fromNullable(componentStorages.get(componentType)),
      Option.match({
        onNone: () => {
          const storage = createComponentStorage<unknown>()
          componentStorages.set(componentType, storage)
          return storage
        },
        onSome: (storage) => storage,
      })
    )
  }

  // エンティティ作成
  const createEntity = (name?: string, tags: readonly string[] = []) =>
    Effect.gen(function* () {
      const id = yield* entityPool.allocate()

      const metadata: EntityMetadata = {
        id,
        name,
        tags: [...tags],
        active: true,
        createdAt: Date.now(),
        generation: entityGeneration++,
      }

      entities.set(id, metadata)
      entityComponents.set(id, new Set())

      // タグインデックスの更新
      yield* pipe(
        Stream.fromIterable(tags),
        Stream.mapEffect((tag) =>
          Effect.sync(() => {
            pipe(
              Option.fromNullable(tagIndex.get(tag)),
              Option.match({
                onNone: () => {
                  const tagSet = new Set<EntityId>()
                  tagIndex.set(tag, tagSet)
                  tagSet.add(id)
                },
                onSome: (tagSet) => {
                  tagSet.add(id)
                },
              })
            )
          })
        ),
        Stream.runDrain
      )

      // 空のアーキタイプに追加
      yield* archetypeManager.moveEntity(id, new Set())

      return id
    })

  // エンティティ削除
  const destroyEntity = (id: EntityId) =>
    Effect.gen(function* () {
      const metadata = yield* pipe(
        Option.fromNullable(entities.get(id)),
        Option.match({
          onNone: () => Effect.fail(createEntityManagerError.entityNotFound(id, 'destroy')),
          onSome: (metadata) => Effect.succeed(metadata),
        })
      )

      // すべてのコンポーネントを削除
      const components = yield* pipe(
        Option.fromNullable(entityComponents.get(id)),
        Option.match({
          onNone: () => Effect.succeed(new Set<ComponentTypeName>()),
          onSome: (components) => Effect.succeed(components),
        })
      )

      for (const componentType of components) {
        yield* pipe(
          Option.fromNullable(componentStorages.get(componentType)),
          Option.match({
            onNone: () => Effect.succeed(undefined),
            onSome: (storage) => storage.remove(id),
          })
        )
      }

      // タグインデックスから削除
      for (const tag of metadata.tags) {
        pipe(
          Option.fromNullable(tagIndex.get(tag)),
          Option.match({
            onNone: () => undefined,
            onSome: (tagSet) => tagSet.delete(id),
          })
        )
      }

      // アーキタイプから削除
      yield* archetypeManager.removeEntity(id)

      // エンティティデータを削除
      entities.delete(id)
      entityComponents.delete(id)

      // エンティティIDを解放
      yield* entityPool.deallocate(id)
    })

  // コンポーネント追加
  const addComponent = <T>(entityId: EntityId, componentType: ComponentTypeName, component: T) =>
    Effect.gen(function* () {
      yield* pipe(
        entities.has(entityId),
        Match.value,
        Match.when(false, () => Effect.fail(createEntityManagerError.entityNotFound(entityId, 'addComponent'))),
        Match.orElse(() => Effect.succeed(undefined))
      )

      const storage = getOrCreateStorage(componentType)
      const components = yield* pipe(
        Option.fromNullable(entityComponents.get(entityId)),
        Option.match({
          onNone: () => Effect.succeed(new Set<ComponentTypeName>()),
          onSome: (components) => Effect.succeed(components),
        })
      )

      yield* pipe(
        components.has(componentType),
        Match.value,
        Match.when(true, () =>
          Effect.gen(function* () {
            // 既存のコンポーネントを更新
            yield* storage.insert(entityId, component)
          })
        ),
        Match.orElse(() =>
          Effect.gen(function* () {
            // 新しいコンポーネントを追加
            yield* storage.insert(entityId, component)
            components.add(componentType)
            entityComponents.set(entityId, components)

            // アーキタイプを更新
            yield* archetypeManager.moveEntity(entityId, components)
          })
        )
      )
    })

  // コンポーネント削除
  const removeComponent = (entityId: EntityId, componentType: ComponentTypeName) =>
    Effect.gen(function* () {
      // エンティティの存在確認
      yield* pipe(entities.has(entityId), (exists) =>
        Match.value(exists).pipe(
          Match.when(false, () => Effect.fail(createEntityManagerError.entityNotFound(entityId, 'removeComponent'))),
          Match.when(true, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
      )

      // コンポーネントストレージの取得と処理
      const storage = componentStorages.get(componentType)
      yield* pipe(
        Option.fromNullable(storage),
        Option.match({
          onNone: () => Effect.fail(createEntityManagerError.componentNotFound(componentType, entityId)),
          onSome: (s) =>
            Effect.gen(function* () {
              const removed = yield* s.remove(entityId)
              yield* Match.value(removed).pipe(
                Match.when(true, () =>
                  Effect.gen(function* () {
                    const components = yield* pipe(
                      Option.fromNullable(entityComponents.get(entityId)),
                      Option.match({
                        onNone: () => Effect.succeed(new Set<ComponentTypeName>()),
                        onSome: (c) => Effect.succeed(c),
                      })
                    )

                    components.delete(componentType)
                    // アーキタイプを更新
                    yield* archetypeManager.moveEntity(entityId, components)
                  })
                ),
                Match.when(false, () => Effect.succeed(undefined)),
                Match.exhaustive
              )
            }),
        })
      )
    })

  // コンポーネント取得
  const getComponent = <T>(entityId: EntityId, componentType: ComponentTypeName) =>
    Effect.gen(function* () {
      return yield* pipe(
        Option.fromNullable(componentStorages.get(componentType)),
        Option.match({
          onNone: () => Effect.succeed(Option.none<T>()),
          onSome: (storage) => Effect.map(storage.get(entityId), (result) => result as Option.Option<T>),
        })
      )
    })

  // コンポーネント存在確認
  const hasComponent = (entityId: EntityId, componentType: ComponentTypeName) =>
    Effect.gen(function* () {
      return yield* pipe(
        Option.fromNullable(componentStorages.get(componentType)),
        Option.match({
          onNone: () => Effect.succeed(false),
          onSome: (storage) => storage.has(entityId),
        })
      )
    })

  // エンティティのすべてのコンポーネント取得
  const getEntityComponents = (entityId: EntityId) =>
    Effect.gen(function* () {
      const result = new Map<ComponentTypeName, unknown>()
      const components = yield* pipe(
        Option.fromNullable(entityComponents.get(entityId)),
        Option.match({
          onNone: () => Effect.succeed(new Set<ComponentTypeName>()),
          onSome: (components) => Effect.succeed(components),
        })
      )

      for (const componentType of components) {
        const storage = yield* pipe(
          Option.fromNullable(componentStorages.get(componentType)),
          Option.match({
            onNone: () => Effect.succeed(Option.none()),
            onSome: (storage) =>
              Effect.gen(function* () {
                const component = yield* storage.get(entityId)
                return component
              }),
          })
        )

        yield* pipe(
          Option.fromNullable(storage),
          Option.match({
            onNone: () => Effect.succeed(undefined),
            onSome: (component) => {
              result.set(componentType, component)
              return Effect.succeed(undefined)
            },
          })
        )
      }

      return result as ReadonlyMap<ComponentTypeName, unknown>
    })

  // クエリ：コンポーネントを持つエンティティ
  const getEntitiesWithComponent = (componentType: ComponentTypeName) =>
    Effect.gen(function* () {
      return yield* pipe(
        Option.fromNullable(componentStorages.get(componentType)),
        Option.match({
          onNone: () => Effect.succeed([]),
          onSome: (storage) =>
            Effect.gen(function* () {
              const all = yield* storage.getAll()
              return all.map(([entity]) => entity)
            }),
        })
      )
    })

  // クエリ：複数コンポーネントを持つエンティティ（AND）
  const getEntitiesWithComponents = (componentTypes: readonly ComponentTypeName[]) =>
    Effect.gen(function* () {
      return yield* pipe(
        componentTypes.length === 0,
        Match.value,
        Match.when(true, () => Effect.succeed([])),
        Match.orElse(() =>
          Effect.gen(function* () {
            // 最初のコンポーネントを持つエンティティから開始
            const firstComponent = yield* pipe(
              Option.fromNullable(componentTypes[0]),
              Option.match({
                onNone: () => Effect.succeed([]),
                onSome: (componentType) => getEntitiesWithComponent(componentType),
              })
            )

            let result = firstComponent

            // 残りのコンポーネントでフィルタ
            for (let i = 1; i < componentTypes.length; i++) {
              const componentType = yield* pipe(
                Option.fromNullable(componentTypes[i]),
                Option.match({
                  onNone: () => Effect.succeed(null),
                  onSome: (type) => Effect.succeed(type),
                })
              )

              yield* pipe(
                Option.fromNullable(componentType),
                Option.match({
                  onNone: () => Effect.succeed(undefined),
                  onSome: (type) =>
                    Effect.gen(function* () {
                      const filtered: EntityId[] = []

                      for (const entityId of result) {
                        const hasComp = yield* hasComponent(entityId, type)
                        yield* pipe(
                          hasComp,
                          Match.value,
                          Match.when(true, () => {
                            filtered.push(entityId)
                            return Effect.succeed(undefined)
                          }),
                          Match.orElse(() => Effect.succeed(undefined))
                        )
                      }

                      result = filtered
                    }),
                })
              )
            }

            return result
          })
        )
      )
    })

  // クエリ：タグによる検索
  const getEntitiesByTag = (tag: string) =>
    Effect.sync(() => {
      return pipe(
        Option.fromNullable(tagIndex.get(tag)),
        Option.match({
          onNone: () => [],
          onSome: (tagged) => Array.from(tagged),
        })
      )
    })

  // すべてのエンティティ取得
  const getAllEntities = () => Effect.sync(() => Array.from(entities.keys()))

  // バッチコンポーネント取得（高速）
  const batchGetComponents = <T>(componentType: ComponentTypeName) =>
    Effect.gen(function* () {
      return yield* pipe(
        Option.fromNullable(componentStorages.get(componentType)),
        Option.match({
          onNone: () => Effect.succeed([]),
          onSome: (storage) =>
            Effect.gen(function* () {
              const all = yield* storage.getAll()
              return all as ReadonlyArray<[EntityId, T]>
            }),
        })
      )
    })

  // コンポーネントイテレーション（高速）
  const iterateComponents = <T, R, E>(
    componentType: ComponentTypeName,
    f: (entity: EntityId, component: T) => Effect.Effect<void, E, R>
  ): Effect.Effect<void, E, R> =>
    Effect.gen(function* () {
      yield* pipe(
        Option.fromNullable(componentStorages.get(componentType)),
        Option.match({
          onNone: () => Effect.succeed(undefined),
          onSome: (storage) => (storage as ComponentStorage<T>).iterate(f),
        })
      )
    }) as Effect.Effect<void, E, R>

  // システム更新
  const update = (deltaTime: number): Effect.Effect<void, SystemError | EntityManagerError> =>
    Effect.gen(function* () {
      // すべての登録されたシステムを実行
      // Note: SystemRegistryService doesn't have executeSystems method
      // This is a placeholder implementation
      return yield* Effect.void
    }) as Effect.Effect<void, SystemError | EntityManagerError>

  // 統計情報
  const getStats = () =>
    Effect.sync((): EntityManagerStats => {
      let totalComponents = 0
      for (const storage of componentStorages.values()) {
        Effect.runSync(storage.getStats()).size
      }

      return {
        totalEntities: entities.size,
        activeEntities: Array.from(entities.values()).filter((e) => e.active).length,
        totalComponents,
        componentTypes: componentStorages.size,
        archetypeCount: 0, // TODO: archetypeManager.getArchetypeCount()
      }
    })

  // クリア
  const clear = () =>
    Effect.gen(function* () {
      // すべてのコンポーネントストレージをクリア
      for (const storage of componentStorages.values()) {
        yield* storage.clear()
      }

      // すべてのインデックスをクリア
      entities.clear()
      entityComponents.clear()
      tagIndex.clear()
      yield* archetypeManager.clear()

      // エンティティプールをリセット
      yield* entityPool.reset()

      entityGeneration = 0
    })

  // その他のヘルパー関数
  const isEntityAlive = (id: EntityId) => Effect.sync(() => entities.has(id))

  const getEntityMetadata = (id: EntityId) => Effect.sync(() => Option.fromNullable(entities.get(id)))

  const setEntityActive = (id: EntityId, active: boolean) =>
    Effect.gen(function* () {
      yield* pipe(
        Option.fromNullable(entities.get(id)),
        Option.match({
          onNone: () => Effect.fail(createEntityManagerError.entityNotFound(id, 'setEntityActive')),
          onSome: (meta) =>
            Effect.sync(() => {
              // Create new metadata object to maintain immutability
              const updatedMetadata = { ...meta, active }
              entities.set(id, updatedMetadata)
            }),
        })
      )
    })

  return {
    createEntity,
    destroyEntity,
    isEntityAlive,
    getEntityMetadata,
    setEntityActive,
    addComponent,
    removeComponent,
    getComponent,
    hasComponent,
    getEntityComponents,
    getEntitiesWithComponent,
    getEntitiesWithComponents,
    getEntitiesByTag,
    getAllEntities,
    batchGetComponents,
    iterateComponents,
    update,
    getStats,
    clear,
  } satisfies EntityManager
})

export const EntityManager = Context.GenericTag<EntityManager>('@minecraft/infrastructure/EntityManager')

// Convert EntityManager implementation to Layer
export const EntityManagerLayer = Layer.effect(EntityManager, EntityManagerLive)
