import type { ComponentTypeName } from '@domain/entities/types'
import { Schema } from '@effect/schema'
import { Context, Data, Effect, Layer, Match, Option, pipe, Stream } from 'effect'
import {
  createArchetypeManager,
  createComponentStorage,
  EntityPool,
  type ComponentStorage,
  type EntityId,
  type EntityMetadata,
  type EntityPoolError,
} from './Entity'
import type { SystemError } from './System'
import { SystemRegistryService } from './SystemRegistry'

// =====================================
// Entity Manager Errors
// =====================================

export const EntityManagerError = Data.taggedEnum('EntityManagerError')({
  EntityNotFound: Data.struct<{ readonly entityId: EntityId; readonly operation: Option.Option<string> }>(),
  ComponentNotFound: Data.struct<{
    readonly componentType: ComponentTypeName
    readonly entityId: Option.Option<EntityId>
  }>(),
  InvalidComponentType: Data.struct<{ readonly componentType: ComponentTypeName; readonly details: Option.Option<string> }>(),
  EntityLimitReached: Data.struct<{ readonly limit: number }>(),
  ComponentAlreadyExists: Data.struct<{ readonly entityId: EntityId; readonly componentType: ComponentTypeName }>(),
})

export type EntityManagerError = Data.TaggedEnum.Infer<typeof EntityManagerError>

export const EntityManagerErrorFactory = {
  entityNotFound: (entityId: EntityId, operation?: string) =>
    EntityManagerError.EntityNotFound({ entityId, operation: Option.fromNullable(operation) }),
  componentNotFound: (componentType: ComponentTypeName, entityId?: EntityId) =>
    EntityManagerError.ComponentNotFound({ componentType, entityId: Option.fromNullable(entityId) }),
  invalidComponentType: (componentType: ComponentTypeName, details?: string) =>
    EntityManagerError.InvalidComponentType({ componentType, details: Option.fromNullable(details) }),
  entityLimitReached: (limit: number) => EntityManagerError.EntityLimitReached({ limit }),
  componentAlreadyExists: (entityId: EntityId, componentType: ComponentTypeName) =>
    EntityManagerError.ComponentAlreadyExists({ entityId, componentType }),
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
          onNone: () => Effect.fail(EntityManagerErrorFactory.entityNotFound(id, 'destroy')),
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

      yield* Effect.forEach(
        Array.from(components),
        (componentType) =>
          pipe(
            Option.fromNullable(componentStorages.get(componentType)),
            Option.match({
              onNone: () => Effect.void,
              onSome: (storage) => storage.remove(id),
            })
          ),
        { concurrency: 'unbounded' }
      )

      // タグインデックスから削除
      metadata.tags.forEach((tag) =>
        pipe(
          Option.fromNullable(tagIndex.get(tag)),
          Option.map((tagSet) => tagSet.delete(id))
        )
      )

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
        Match.when(false, () => Effect.fail(EntityManagerErrorFactory.entityNotFound(entityId, 'addComponent'))),
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
          Match.when(false, () => Effect.fail(EntityManagerErrorFactory.entityNotFound(entityId, 'removeComponent'))),
          Match.when(true, () => Effect.succeed(undefined)),
          Match.exhaustive
        )
      )

      // コンポーネントストレージの取得と処理
      const storage = componentStorages.get(componentType)
      yield* pipe(
        Option.fromNullable(storage),
        Option.match({
          onNone: () => Effect.fail(EntityManagerErrorFactory.componentNotFound(componentType, entityId)),
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

      yield* Effect.forEach(
        Array.from(components),
        (componentType) =>
          pipe(
            Option.fromNullable(componentStorages.get(componentType)),
            Option.match({
              onNone: () => Effect.void,
              onSome: (storage) =>
                storage.get(entityId).pipe(
                  Effect.flatMap((component) =>
                    pipe(
                      Option.fromNullable(component),
                      Option.match({
                        onNone: () => Effect.void,
                        onSome: (value) => Effect.sync(() => result.set(componentType, value)),
                      })
                    )
                  )
                ),
            })
          ),
        { concurrency: 'unbounded' }
      )

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

            const resultRef = yield* Ref.make(firstComponent)

            yield* Effect.forEach(
              componentTypes.slice(1),
              (maybeType) =>
                pipe(
                  Option.fromNullable(maybeType),
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (type) =>
                      Effect.gen(function* () {
                        const current = yield* Ref.get(resultRef)
                        if (current.length === 0) {
                          return
                        }

                        const evaluations = yield* Effect.forEach(
                          current,
                          (entityId) =>
                            hasComponent(entityId, type).pipe(
                              Effect.map((has) => ({ entityId, has }))
                            ),
                          { concurrency: 'unbounded' }
                        )

                        const filtered = evaluations
                          .filter(({ has }) => has)
                          .map(({ entityId }) => entityId)

                        yield* Ref.set(resultRef, filtered)
                      }),
                  })
                ),
              { concurrency: 1 }
            )

            return yield* Ref.get(resultRef)
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
    Effect.gen(function* (): Effect.Effect<EntityManagerStats, never> {
      const componentCounts = yield* Effect.forEach(
        Array.from(componentStorages.values()),
        (storage) => storage.getStats().pipe(Effect.map((stats) => Number(stats.size))),
        { concurrency: 'unbounded' }
      )

      const totalComponents = componentCounts.reduce((acc, count) => acc + count, 0)
      const activeEntities = Array.from(entities.values()).filter((entity) => entity.active).length

      return {
        totalEntities: entities.size,
        activeEntities,
        totalComponents,
        componentTypes: componentStorages.size,
        archetypeCount: 0,
      }
    })

  // クリア
  const clear = () =>
    Effect.gen(function* () {
      // すべてのコンポーネントストレージをクリア
      yield* Effect.forEach(Array.from(componentStorages.values()), (storage) => storage.clear(), {
        concurrency: 'unbounded',
      })

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
          onNone: () => Effect.fail(EntityManagerErrorFactory.entityNotFound(id, 'setEntityActive')),
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
