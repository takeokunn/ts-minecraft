import type { ComponentTypeName } from '@domain/entities/types'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import { Clock, Context, Data, Effect, HashMap, Layer, Match, Option, pipe, Ref, Schema, Stream } from 'effect'
import type { ComponentDefinition } from './component-definition'
import { ComponentRegistryService } from './component-registry'
import {
  createArchetypeManager,
  createComponentStorage,
  EntityPool,
  type ComponentStorage,
  type EntityId,
  type EntityMetadata,
  type EntityPoolError,
} from './entity'
import type { SystemError } from './system'
import { SystemRegistryService } from './system-registry'

// =====================================
// Entity Manager Errors
// =====================================

export const EntityManagerError = Data.taggedEnum('EntityManagerError')({
  EntityNotFound: Data.struct<{ readonly entityId: EntityId; readonly operation: Option.Option<string> }>(),
  ComponentNotFound: Data.struct<{
    readonly componentType: ComponentTypeName
    readonly entityId: Option.Option<EntityId>
  }>(),
  InvalidComponentType: Data.struct<{
    readonly componentType: ComponentTypeName
    readonly details: Option.Option<string>
  }>(),
  EntityLimitReached: Data.struct<{ readonly limit: number }>(),
  ComponentAlreadyExists: Data.struct<{ readonly entityId: EntityId; readonly componentType: ComponentTypeName }>(),
})

export type EntityManagerError = Data.taggedEnum.Infer<typeof EntityManagerError>

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
  readonly addComponent: <A>(
    entityId: EntityId,
    definition: ComponentDefinition<A>,
    component: A
  ) => Effect.Effect<void, EntityManagerError>
  readonly removeComponent: <A>(
    entityId: EntityId,
    definition: ComponentDefinition<A>
  ) => Effect.Effect<void, EntityManagerError>
  readonly getComponent: <A>(
    entityId: EntityId,
    definition: ComponentDefinition<A>
  ) => Effect.Effect<Option.Option<A>, EntityManagerError>
  readonly hasComponent: <A>(entityId: EntityId, definition: ComponentDefinition<A>) => Effect.Effect<boolean, never>
  readonly getEntityComponents: (
    entityId: EntityId
  ) => Effect.Effect<ReadonlyMap<ComponentDefinition<unknown>, unknown>, EntityManagerError>

  // クエリ
  readonly getEntitiesWithComponent: <A>(
    definition: ComponentDefinition<A>
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>
  readonly getEntitiesWithComponents: (
    definitions: ReadonlyArray<ComponentDefinition<unknown>>
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>
  readonly getEntitiesByTag: (tag: string) => Effect.Effect<ReadonlyArray<EntityId>, never>
  readonly getAllEntities: () => Effect.Effect<ReadonlyArray<EntityId>, never>

  // バッチ操作（高速）
  readonly batchGetComponents: <A>(
    definition: ComponentDefinition<A>
  ) => Effect.Effect<ReadonlyArray<[EntityId, A]>, EntityManagerError>
  readonly iterateComponents: <A, R, E>(
    definition: ComponentDefinition<A>,
    f: (entity: EntityId, component: A) => Effect.Effect<void, E, R>
  ) => Effect.Effect<void, E | EntityManagerError, R>

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
  const componentRegistry = yield* ComponentRegistryService

  const componentDefinitions = yield* componentRegistry.definitions
  const definitionIndex = componentDefinitions.reduce(
    (map, definition) => HashMap.set(map, definition.type, definition),
    HashMap.empty<ComponentTypeName, ComponentDefinition<unknown>>()
  )

  const lookupDefinition = (
    componentType: ComponentTypeName,
    context: string
  ): Effect.Effect<ComponentDefinition<unknown>, EntityManagerError> =>
    pipe(
      HashMap.get(definitionIndex, componentType),
      Option.match({
        onNone: () =>
          Effect.fail(
            EntityManagerErrorFactory.invalidComponentType(componentType, `${context}: 未登録コンポーネント`)
          ),
        onSome: (definition) => Effect.succeed(definition),
      })
    )

  const decodeComponent = <A>(
    definition: ComponentDefinition<A>,
    value: unknown,
    context: string
  ): Effect.Effect<A, EntityManagerError> =>
    definition
      .validate(value)
      .pipe(
        Effect.mapError((error) =>
          EntityManagerErrorFactory.invalidComponentType(
            definition.type,
            `${context}: ${TreeFormatter.formatErrorSync(error)}`
          )
        )
      )

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

      const createdAt = yield* Clock.currentTimeMillis

      const metadata: EntityMetadata = {
        id,
        name,
        tags: [...tags],
        active: true,
        createdAt,
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
        { concurrency: 4 }
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
  const addComponent = <A>(entityId: EntityId, definition: ComponentDefinition<A>, component: A) =>
    Effect.gen(function* () {
      yield* pipe(
        entities.has(entityId),
        Match.value,
        Match.when(false, () => Effect.fail(EntityManagerErrorFactory.entityNotFound(entityId, 'addComponent'))),
        Match.orElse(() => Effect.void)
      )

      const componentType = definition.type
      const storage = getOrCreateStorage(componentType)
      const components = yield* pipe(
        Option.fromNullable(entityComponents.get(entityId)),
        Option.match({
          onNone: () => Effect.succeed(new Set<ComponentTypeName>()),
          onSome: (value) => Effect.succeed(value),
        })
      )

      yield* pipe(
        components.has(componentType),
        Match.value,
        Match.when(true, () => storage.insert(entityId, component)),
        Match.orElse(() =>
          Effect.gen(function* () {
            yield* storage.insert(entityId, component)
            components.add(componentType)
            entityComponents.set(entityId, components)
            yield* archetypeManager.moveEntity(entityId, components)
          })
        )
      )
    })

  // コンポーネント削除
  const removeComponent = <A>(entityId: EntityId, definition: ComponentDefinition<A>) =>
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
      const componentType = definition.type
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
  const getComponent = <A>(entityId: EntityId, definition: ComponentDefinition<A>) =>
    Effect.gen(function* () {
      const componentType = definition.type

      return yield* pipe(
        Option.fromNullable(componentStorages.get(componentType)),
        Option.match({
          onNone: () => Effect.succeed(Option.none<A>()),
          onSome: (storage) =>
            storage.get(entityId).pipe(
              Effect.flatMap((maybeValue) =>
                pipe(
                  maybeValue,
                  Option.match({
                    onNone: () => Effect.succeed(Option.none<A>()),
                    onSome: (value) =>
                      decodeComponent(definition, value, 'getComponent').pipe(
                        Effect.map((validated) => Option.some(validated))
                      ),
                  })
                )
              )
            ),
        })
      )
    })

  // コンポーネント存在確認
  const hasComponent = <A>(entityId: EntityId, definition: ComponentDefinition<A>) =>
    Effect.gen(function* () {
      return yield* pipe(
        Option.fromNullable(componentStorages.get(definition.type)),
        Option.match({
          onNone: () => Effect.succeed(false),
          onSome: (storage) => storage.has(entityId),
        })
      )
    })

  // エンティティのすべてのコンポーネント取得
  const getEntityComponents = (entityId: EntityId) =>
    Effect.gen(function* () {
      const result = new Map<ComponentDefinition<unknown>, unknown>()
      const components = yield* pipe(
        Option.fromNullable(entityComponents.get(entityId)),
        Option.match({
          onNone: () => Effect.succeed(new Set<ComponentTypeName>()),
          onSome: (value) => Effect.succeed(value),
        })
      )

      yield* Effect.forEach(
        Array.from(components),
        (componentType) =>
          Effect.gen(function* () {
            const definition = yield* lookupDefinition(componentType, 'getEntityComponents')

            yield* pipe(
              Option.fromNullable(componentStorages.get(componentType)),
              Option.match({
                onNone: () => Effect.void,
                onSome: (storage) =>
                  storage.get(entityId).pipe(
                    Effect.flatMap((maybeValue) =>
                      pipe(
                        maybeValue,
                        Option.match({
                          onNone: () => Effect.void,
                          onSome: (value) =>
                            decodeComponent(definition, value, 'getEntityComponents').pipe(
                              Effect.flatMap((validated) =>
                                Effect.sync(() => {
                                  result.set(definition, validated)
                                })
                              )
                            ),
                        })
                      )
                    )
                  ),
              })
            )
          }),
        { concurrency: 4 }
      )

      return result
    })

  // クエリ：コンポーネントを持つエンティティ
  const getEntitiesWithComponent = <A>(definition: ComponentDefinition<A>) =>
    Effect.gen(function* () {
      return yield* pipe(
        Option.fromNullable(componentStorages.get(definition.type)),
        Option.match({
          onNone: () => Effect.succeed([]),
          onSome: (storage) => storage.getAll().pipe(Effect.map((all) => all.map(([entity]) => entity))),
        })
      )
    })

  // クエリ：複数コンポーネントを持つエンティティ（AND）
  const getEntitiesWithComponents = (definitions: ReadonlyArray<ComponentDefinition<unknown>>) =>
    Effect.gen(function* () {
      return yield* pipe(
        definitions.length === 0,
        Match.value,
        Match.when(true, () => Effect.succeed([])),
        Match.orElse(() =>
          Effect.gen(function* () {
            const firstDefinition = definitions[0]!
            const initialEntities = yield* getEntitiesWithComponent(firstDefinition)
            const resultRef = yield* Ref.make(initialEntities)

            yield* Effect.forEach(
              definitions.slice(1),
              (definition) =>
                Effect.gen(function* () {
                  const current = yield* Ref.get(resultRef)

                  yield* pipe(
                    current.length === 0,
                    Match.value,
                    Match.when(true, () => Effect.void),
                    Match.orElse(() =>
                      Effect.gen(function* () {
                        const evaluations = yield* Effect.forEach(
                          current,
                          (entityId) =>
                            hasComponent(entityId, definition).pipe(Effect.map((has) => ({ entityId, has }))),
                          { concurrency: 4 }
                        )

                        const filtered = evaluations.filter(({ has }) => has).map(({ entityId }) => entityId)

                        yield* Ref.set(resultRef, filtered)
                      })
                    ),
                    Match.exhaustive
                  )
                }),
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
  const batchGetComponents = <A>(definition: ComponentDefinition<A>) =>
    Effect.gen(function* () {
      return yield* pipe(
        Option.fromNullable(componentStorages.get(definition.type)),
        Option.match({
          onNone: () => Effect.succeed([]),
          onSome: (storage) =>
            storage.getAll().pipe(
              Effect.flatMap((entries) =>
                Effect.forEach(
                  entries,
                  ([entityId, value]) =>
                    decodeComponent(definition, value, 'batchGetComponents').pipe(
                      Effect.map((component) => {
                        const entry: readonly [EntityId, A] = [entityId, component]
                        return entry
                      })
                    ),
                  { concurrency: 4 }
                )
              )
            ),
        })
      )
    })

  // コンポーネントイテレーション（高速）
  const iterateComponents = <A, R, E>(
    definition: ComponentDefinition<A>,
    f: (entity: EntityId, component: A) => Effect.Effect<void, E, R>
  ): Effect.Effect<void, E | EntityManagerError, R> =>
    Effect.gen(function* () {
      yield* pipe(
        Option.fromNullable(componentStorages.get(definition.type)),
        Option.match({
          onNone: () => Effect.void,
          onSome: (storage) =>
            storage
              .getAll()
              .pipe(
                Effect.flatMap((entries) =>
                  Effect.forEach(
                    entries,
                    ([entityId, value]) =>
                      decodeComponent(definition, value, 'iterateComponents').pipe(
                        Effect.flatMap((component) => f(entityId, component))
                      ),
                    { concurrency: 4 }
                  ).pipe(Effect.asVoid)
                )
              ),
        })
      )
    })

  // システム更新
  const update = (deltaTime: number): Effect.Effect<void, SystemError | EntityManagerError> =>
    Effect.gen(function* () {
      // すべての登録されたシステムを実行
      // Note: SystemRegistryService doesn't have executeSystems method
      // This is a placeholder実装
      return yield* Effect.void
    })

  // 統計情報
  const getStats = () =>
    Effect.gen(function* (): Effect.Effect<EntityManagerStats, never> {
      const componentCounts = yield* Effect.forEach(
        Array.from(componentStorages.values()),
        (storage) => storage.getStats().pipe(Effect.map((stats) => Number(stats.size))),
        { concurrency: 4 }
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
        concurrency: 4,
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
