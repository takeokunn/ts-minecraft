import { Brand, Context, Data, Effect, Layer, Option, pipe, Schema, Match } from 'effect'
import { BrandedTypes, EntityCount, EntityCapacity } from '../../shared/types/branded'

// =====================================
// Entity ID Type
// =====================================

export type EntityId = number & Brand.Brand<'EntityId'>
export const EntityId = Brand.nominal<EntityId>()

// =====================================
// Entity Pool (高速エンティティID管理)
// =====================================

export interface EntityPoolError {
  readonly _tag: 'EntityPoolError'
  readonly reason: 'pool_exhausted' | 'invalid_entity_id' | 'entity_not_allocated'
  readonly message: string
}

export const EntityPoolError = (
  reason: 'pool_exhausted' | 'invalid_entity_id' | 'entity_not_allocated',
  message: string
): EntityPoolError => ({
  _tag: 'EntityPoolError',
  reason,
  message,
})

export const isEntityPoolError = (error: unknown): error is EntityPoolError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'EntityPoolError'

export interface EntityPool {
  readonly allocate: () => Effect.Effect<EntityId, EntityPoolError>
  readonly deallocate: (id: EntityId) => Effect.Effect<void, EntityPoolError>
  readonly isAllocated: (id: EntityId) => Effect.Effect<boolean, never>
  readonly reset: () => Effect.Effect<void, never>
  readonly getStats: () => Effect.Effect<EntityPoolStats, never>
}

export const EntityPoolStats = Schema.Struct({
  totalCapacity: Schema.Number,
  allocatedCount: Schema.Number,
  freeCount: Schema.Number,
  recycledCount: Schema.Number,
})

export type EntityPoolStats = Schema.Schema.Type<typeof EntityPoolStats>

// =====================================
// Structure of Arrays Component Storage
// =====================================

export interface ComponentArray<T> {
  readonly data: T[]
  readonly entityToIndex: Map<EntityId, number>
  readonly indexToEntity: EntityId[]
  size: number // mutable for performance
}

export const createComponentStorage = <T>() => {
  const array: ComponentArray<T> = {
    data: [],
    entityToIndex: new Map(),
    indexToEntity: [],
    size: 0,
  }

  const insert = (entity: EntityId, component: T): Effect.Effect<void, never> =>
    Effect.sync(() => {
      pipe(
        array.entityToIndex.has(entity),
        Match.value,
        Match.when(true, () => {
          // 既存のコンポーネントを更新
          const index = array.entityToIndex.get(entity)!
          array.data[index] = component
        }),
        Match.orElse(() => {
          // 新しいコンポーネントを追加
          const newIndex = array.size
          array.data[newIndex] = component
          array.entityToIndex.set(entity, newIndex)
          array.indexToEntity[newIndex] = entity
          array.size++
        })
      )
    })

  const remove = (entity: EntityId): Effect.Effect<boolean, never> =>
    Effect.sync(() =>
      pipe(
        Option.fromNullable(array.entityToIndex.get(entity)),
        Option.match({
          onNone: () => false,
          onSome: (index) => {
            const lastIndex = array.size - 1

            pipe(
              index !== lastIndex,
              Match.value,
              Match.when(true, () => {
                // 最後の要素で削除された要素を上書き（配列の穴を防ぐ）
                const lastEntity = array.indexToEntity[lastIndex]
                const lastData = array.data[lastIndex]

                pipe(
                  Option.fromNullable(lastEntity),
                  Option.flatMap((entity) =>
                    Option.fromNullable(lastData).pipe(Option.map((data) => ({ entity, data })))
                  ),
                  Option.match({
                    onNone: () => {},
                    onSome: ({ entity: lastEntity, data: lastData }) => {
                      array.data[index] = lastData
                      array.indexToEntity[index] = lastEntity
                      array.entityToIndex.set(lastEntity, index)
                    },
                  })
                )
              }),
              Match.orElse(() => {})
            )

            // 最後の要素を削除
            array.data.length--
            array.indexToEntity.length--
            array.entityToIndex.delete(entity)
            array.size--

            return true
          },
        })
      )
    )

  const get = (entity: EntityId): Effect.Effect<Option.Option<T>, never> =>
    Effect.sync(() =>
      pipe(
        Option.fromNullable(array.entityToIndex.get(entity)),
        Option.flatMap((index) =>
          pipe(
            index < array.size,
            Match.value,
            Match.when(true, () =>
              pipe(
                Option.fromNullable(array.data[index]),
                Option.match({
                  onNone: () => Option.none<T>(),
                  onSome: (value) => Option.some(value),
                })
              )
            ),
            Match.orElse(() => Option.none<T>())
          )
        )
      )
    )

  const has = (entity: EntityId): Effect.Effect<boolean, never> => Effect.sync(() => array.entityToIndex.has(entity))

  const clear = (): Effect.Effect<void, never> =>
    Effect.sync(() => {
      array.data.length = 0
      array.entityToIndex.clear()
      array.indexToEntity.length = 0
      array.size = 0
    })

  // 高速イテレーション用
  const iterate = <R, E>(f: (entity: EntityId, component: T) => Effect.Effect<void, E, R>): Effect.Effect<void, E, R> =>
    Effect.forEach(
      Array.from({ length: array.size }, (_, i) => i),
      (index) => {
        const entity = array.indexToEntity[index]
        const component = array.data[index]

        return pipe(
          Option.fromNullable(entity),
          Option.flatMap((e) => Option.fromNullable(component).pipe(Option.map((c) => ({ entity: e, component: c })))),
          Option.match({
            onNone: () => Effect.void,
            onSome: ({ entity, component }) => f(entity, component),
          })
        )
      },
      { discard: true }
    ) as Effect.Effect<void, E, R>

  // バッチ取得（高速）
  const getAll = (): Effect.Effect<ReadonlyArray<[EntityId, T]>, never> =>
    Effect.sync(() => {
      const result: [EntityId, T][] = []
      for (let i = 0; i < array.size; i++) {
        const entity = array.indexToEntity[i]
        const data = array.data[i]

        pipe(
          Option.fromNullable(entity),
          Option.flatMap((e) => Option.fromNullable(data).pipe(Option.map((d) => ({ entity: e, data: d })))),
          Option.match({
            onNone: () => {},
            onSome: ({ entity, data }) => {
              result.push([entity, data])
            },
          })
        )
      }
      return result
    })

  // データ配列への直接アクセス（最高速だが注意が必要）
  const getRawData = (): Effect.Effect<
    { readonly data: ReadonlyArray<T>; readonly entities: ReadonlyArray<EntityId> },
    never
  > =>
    Effect.sync(() => ({
      data: array.data.slice(0, array.size),
      entities: array.indexToEntity.slice(0, array.size),
    }))

  const getStats = (): Effect.Effect<{ size: EntityCount; capacity: EntityCapacity }, never> =>
    Effect.sync(() => ({
      size: BrandedTypes.createEntityCount(array.size),
      capacity: BrandedTypes.createEntityCapacity(array.data.length),
    }))

  return {
    insert,
    remove,
    get,
    has,
    clear,
    iterate,
    getAll,
    getRawData,
    getStats,
  }
}

export interface ComponentStorage<T> {
  readonly insert: (entity: EntityId, component: T) => Effect.Effect<void, never>
  readonly remove: (entity: EntityId) => Effect.Effect<boolean, never>
  readonly get: (entity: EntityId) => Effect.Effect<Option.Option<T>, never>
  readonly has: (entity: EntityId) => Effect.Effect<boolean, never>
  readonly clear: () => Effect.Effect<void, never>
  readonly iterate: <R, E>(
    f: (entity: EntityId, component: T) => Effect.Effect<void, E, R>
  ) => Effect.Effect<void, E, R>
  readonly getAll: () => Effect.Effect<ReadonlyArray<[EntityId, T]>, never>
  readonly getRawData: () => Effect.Effect<
    { readonly data: ReadonlyArray<T>; readonly entities: ReadonlyArray<EntityId> },
    never
  >
  readonly getStats: () => Effect.Effect<{ size: EntityCount; capacity: EntityCapacity }, never>
}

// =====================================
// Entity Metadata
// =====================================

export const EntityMetadata = Schema.Struct({
  id: Schema.Number.pipe(Schema.brand('EntityId')),
  name: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  active: Schema.Boolean,
  createdAt: Schema.Number,
  generation: Schema.Number, // リサイクル世代番号
})

export type EntityMetadata = Schema.Schema.Type<typeof EntityMetadata>

// =====================================
// Entity Pool Service Implementation
// =====================================

const MAX_ENTITIES = 100000 // 最大エンティティ数

export const EntityPoolLive = Effect.gen(function* () {
  // エンティティプールの状態
  const state = yield* Effect.sync(() => ({
    freeList: Array.from({ length: MAX_ENTITIES }, (_, i) => EntityId(MAX_ENTITIES - 1 - i)),
    allocated: new Set<EntityId>(),
    recycledCount: 0,
    nextId: MAX_ENTITIES,
  }))

  const allocate = () => Effect.gen(function* () {
      return yield* pipe(
        state.freeList.length === 0,
        Match.value,
        Match.when(true, () => Effect.fail(EntityPoolError('pool_exhausted', `Entity pool exhausted. Maximum capacity: ${MAX_ENTITIES}`))
        ),
        Match.orElse(() => Effect.gen(function* () {
            const id = state.freeList.pop()!
            state.allocated.add(id)
            return id
          })
        )
      )
    })

  const deallocate = (id: EntityId) =>
    Effect.gen(function* () {
      return yield* pipe(
        !state.allocated.has(id
    }),
    Match.value,
        Match.when(true, () => Effect.fail(EntityPoolError('entity_not_allocated', `Entity ${id} is not allocated`))),
        Match.orElse(() => Effect.sync(() => {
            state.allocated.delete(id)
            state.freeList.push(id)
            state.recycledCount++
          })
        )
      )
    })

  const isAllocated = (id: EntityId) => Effect.sync(() => state.allocated.has(id))

  const reset = () => Effect.sync(() => {
      state.freeList = Array.from({ length: MAX_ENTITIES }, (_, i) => EntityId(MAX_ENTITIES - 1 - i))
      state.allocated.clear()
      state.recycledCount = 0
    })

  const getStats = () => Effect.sync(
      (): EntityPoolStats => ({
        totalCapacity: MAX_ENTITIES,
        allocatedCount: state.allocated.size,
        freeCount: state.freeList.length,
        recycledCount: state.recycledCount,
      })
    )

  return {
    allocate,
    deallocate,
    isAllocated,
    reset,
    getStats,
  } satisfies EntityPool
})

export const EntityPool = Context.GenericTag<EntityPool>('@minecraft/ecs/EntityPool')

// Convert EntityPool implementation to Layer
export const EntityPoolLayer = Layer.effect(EntityPool, EntityPoolLive)

// =====================================
// Entity Archetype (Component組み合わせ最適化)
// =====================================

export interface Archetype {
  readonly id: number
  readonly componentTypes: ReadonlySet<string>
  readonly entities: Set<EntityId>
}

export const createArchetypeManager = () => {
  const archetypes = new Map<string, Archetype>()
  const entityToArchetype = new Map<EntityId, Archetype>()
  let nextArchetypeId = 0

  const getArchetypeKey = (componentTypes: ReadonlySet<string>): string => {
    return Array.from(componentTypes).sort().join('|')
  }

  const getOrCreateArchetype = (componentTypes: ReadonlySet<string>): Effect.Effect<Archetype, never> =>
    Effect.sync(() => {
      const key = getArchetypeKey(componentTypes)

      return pipe(
        Option.fromNullable(archetypes.get(key)),
        Option.match({
          onNone: () => {
            const archetype: Archetype = {
              id: nextArchetypeId++,
              componentTypes,
              entities: new Set(),
            }
            archetypes.set(key, archetype)
            return archetype
          },
          onSome: (archetype) => archetype,
        })
      )
    })

  const moveEntity = (entity: EntityId, newComponentTypes: ReadonlySet<string>): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      // 古いアーキタイプから削除
      pipe(
        Option.fromNullable(entityToArchetype.get(entity)
    }),
    Option.match({
          onNone: () => {},
          onSome: (oldArchetype) => {
            oldArchetype.entities.delete(entity)
          },
        })
      )

      // 新しいアーキタイプに追加
      const newArchetype = yield* getOrCreateArchetype(newComponentTypes)
      newArchetype.entities.add(entity)
      entityToArchetype.set(entity, newArchetype)
    })

  const removeEntity = (entity: EntityId): Effect.Effect<void, never> =>
    Effect.sync(() => {
      pipe(
        Option.fromNullable(entityToArchetype.get(entity)),
        Option.match({
          onNone: () => {},
          onSome: (archetype) => {
            archetype.entities.delete(entity)
            entityToArchetype.delete(entity)
          },
        })
      )
    })

  const getEntitiesWithArchetype = (componentTypes: ReadonlySet<string>): Effect.Effect<ReadonlySet<EntityId>, never> =>
    Effect.sync(() => {
      const key = getArchetypeKey(componentTypes)

      return pipe(
        Option.fromNullable(archetypes.get(key)),
        Option.match({
          onNone: () => new Set<EntityId>(),
          onSome: (archetype) => new Set(archetype.entities),
        })
      )
    })

  const clear = (): Effect.Effect<void, never> =>
    Effect.sync(() => {
      archetypes.clear()
      entityToArchetype.clear()
      nextArchetypeId = 0
    })

  return {
    getOrCreateArchetype,
    moveEntity,
    removeEntity,
    getEntitiesWithArchetype,
    clear,
  }
}

export interface ArchetypeManager {
  readonly getOrCreateArchetype: (componentTypes: ReadonlySet<string>) => Effect.Effect<Archetype, never>
  readonly moveEntity: (entity: EntityId, newComponentTypes: ReadonlySet<string>) => Effect.Effect<void, never>
  readonly removeEntity: (entity: EntityId) => Effect.Effect<void, never>
  readonly getEntitiesWithArchetype: (
    componentTypes: ReadonlySet<string>
  ) => Effect.Effect<ReadonlySet<EntityId>, never>
  readonly clear: () => Effect.Effect<void, never>
}
