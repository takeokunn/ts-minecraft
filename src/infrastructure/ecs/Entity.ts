import { Brand, Context, Data, Effect, Option, pipe, Schema } from 'effect'

// =====================================
// Entity ID Type
// =====================================

export type EntityId = number & Brand.Brand<'EntityId'>
export const EntityId = Brand.nominal<EntityId>()

// =====================================
// Entity Pool (高速エンティティID管理)
// =====================================

export class EntityPoolError extends Data.TaggedError('EntityPoolError')<{
  readonly reason: 'pool_exhausted' | 'invalid_entity_id' | 'entity_not_allocated'
  readonly message: string
}> {}

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
  recycledCount: Schema.Number
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

export class ComponentStorage<T> {
  private array: ComponentArray<T> = {
    data: [],
    entityToIndex: new Map(),
    indexToEntity: [],
    size: 0
  }

  insert(entity: EntityId, component: T): Effect.Effect<void, never> {
    return Effect.sync(() => {
      if (this.array.entityToIndex.has(entity)) {
        // 既存のコンポーネントを更新
        const index = this.array.entityToIndex.get(entity)!
        this.array.data[index] = component
      } else {
        // 新しいコンポーネントを追加
        const newIndex = this.array.size
        this.array.data[newIndex] = component
        this.array.entityToIndex.set(entity, newIndex)
        this.array.indexToEntity[newIndex] = entity
        this.array.size++
      }
    })
  }

  remove(entity: EntityId): Effect.Effect<boolean, never> {
    return Effect.sync(() => {
      const index = this.array.entityToIndex.get(entity)
      if (index === undefined) return false

      const lastIndex = this.array.size - 1

      if (index !== lastIndex) {
        // 最後の要素で削除された要素を上書き（配列の穴を防ぐ）
        const lastEntity = this.array.indexToEntity[lastIndex]
        const lastData = this.array.data[lastIndex]
        if (lastEntity !== undefined && lastData !== undefined) {
          this.array.data[index] = lastData
          this.array.indexToEntity[index] = lastEntity
          this.array.entityToIndex.set(lastEntity, index)
        }
      }

      // 最後の要素を削除
      this.array.data.length--
      this.array.indexToEntity.length--
      this.array.entityToIndex.delete(entity)
      this.array.size--

      return true
    })
  }

  get(entity: EntityId): Effect.Effect<Option.Option<T>, never> {
    return Effect.sync(() => {
      const index = this.array.entityToIndex.get(entity)
      if (index !== undefined && index < this.array.size) {
        const value = this.array.data[index]
        return value !== undefined ? Option.some(value) : Option.none()
      }
      return Option.none()
    })
  }

  has(entity: EntityId): Effect.Effect<boolean, never> {
    return Effect.sync(() => this.array.entityToIndex.has(entity))
  }

  clear(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      this.array = {
        data: [],
        entityToIndex: new Map(),
        indexToEntity: [],
        size: 0
      }
    })
  }

  // 高速イテレーション用
  iterate<R, E>(
    f: (entity: EntityId, component: T) => Effect.Effect<void, E, R>
  ): Effect.Effect<void, E, R> {
    return Effect.forEach(
      Array.from({ length: this.array.size }, (_, i) => i),
      (index) => {
        const entity = this.array.indexToEntity[index]
        const component = this.array.data[index]
        if (entity !== undefined && component !== undefined) {
          return f(entity, component)
        }
        return Effect.void
      },
      { discard: true }
    ) as Effect.Effect<void, E, R>
  }

  // バッチ取得（高速）
  getAll(): Effect.Effect<ReadonlyArray<[EntityId, T]>, never> {
    return Effect.sync(() => {
      const result: [EntityId, T][] = []
      for (let i = 0; i < this.array.size; i++) {
        const entity = this.array.indexToEntity[i]
        const data = this.array.data[i]
        if (entity !== undefined && data !== undefined) {
          result.push([entity, data])
        }
      }
      return result
    })
  }

  // データ配列への直接アクセス（最高速だが注意が必要）
  getRawData(): Effect.Effect<{ readonly data: ReadonlyArray<T>; readonly entities: ReadonlyArray<EntityId> }, never> {
    return Effect.sync(() => ({
      data: this.array.data.slice(0, this.array.size),
      entities: this.array.indexToEntity.slice(0, this.array.size)
    }))
  }

  getStats(): Effect.Effect<{ size: number; capacity: number }, never> {
    return Effect.sync(() => ({
      size: this.array.size,
      capacity: this.array.data.length
    }))
  }
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
  generation: Schema.Number // リサイクル世代番号
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
    nextId: MAX_ENTITIES
  }))

  const allocate = () => Effect.gen(function* () {
    if (state.freeList.length === 0) {
      return yield* Effect.fail(new EntityPoolError({
        reason: 'pool_exhausted',
        message: `Entity pool exhausted. Maximum capacity: ${MAX_ENTITIES}`
      }))
    }

    const id = state.freeList.pop()!
    state.allocated.add(id)
    return id
  })

  const deallocate = (id: EntityId) => Effect.gen(function* () {
    if (!state.allocated.has(id)) {
      return yield* Effect.fail(new EntityPoolError({
        reason: 'entity_not_allocated',
        message: `Entity ${id} is not allocated`
      }))
    }

    state.allocated.delete(id)
    state.freeList.push(id)
    state.recycledCount++
  })

  const isAllocated = (id: EntityId) => Effect.sync(() => state.allocated.has(id))

  const reset = () => Effect.sync(() => {
    state.freeList = Array.from({ length: MAX_ENTITIES }, (_, i) => EntityId(MAX_ENTITIES - 1 - i))
    state.allocated.clear()
    state.recycledCount = 0
  })

  const getStats = () => Effect.sync((): EntityPoolStats => ({
    totalCapacity: MAX_ENTITIES,
    allocatedCount: state.allocated.size,
    freeCount: state.freeList.length,
    recycledCount: state.recycledCount
  }))

  return {
    allocate,
    deallocate,
    isAllocated,
    reset,
    getStats
  } satisfies EntityPool
})

export const EntityPool = Context.GenericTag<EntityPool>('@minecraft/ecs/EntityPool')

// =====================================
// Entity Archetype (Component組み合わせ最適化)
// =====================================

export interface Archetype {
  readonly id: number
  readonly componentTypes: ReadonlySet<string>
  readonly entities: Set<EntityId>
}

export class ArchetypeManager {
  private archetypes = new Map<string, Archetype>()
  private entityToArchetype = new Map<EntityId, Archetype>()
  private nextArchetypeId = 0

  private getArchetypeKey(componentTypes: ReadonlySet<string>): string {
    return Array.from(componentTypes).sort().join('|')
  }

  getOrCreateArchetype(componentTypes: ReadonlySet<string>): Effect.Effect<Archetype, never> {
    return Effect.sync(() => {
      const key = this.getArchetypeKey(componentTypes)
      let archetype = this.archetypes.get(key)

      if (!archetype) {
        archetype = {
          id: this.nextArchetypeId++,
          componentTypes,
          entities: new Set()
        }
        this.archetypes.set(key, archetype)
      }

      return archetype
    })
  }

  moveEntity(
    entity: EntityId,
    newComponentTypes: ReadonlySet<string>
  ): Effect.Effect<void, never> {
    const self = this
    return Effect.gen(function* () {
      // 古いアーキタイプから削除
      const oldArchetype = self.entityToArchetype.get(entity)
      if (oldArchetype) {
        oldArchetype.entities.delete(entity)
      }

      // 新しいアーキタイプに追加
      const newArchetype = yield* self.getOrCreateArchetype(newComponentTypes)
      newArchetype.entities.add(entity)
      self.entityToArchetype.set(entity, newArchetype)
    })
  }

  removeEntity(entity: EntityId): Effect.Effect<void, never> {
    return Effect.sync(() => {
      const archetype = this.entityToArchetype.get(entity)
      if (archetype) {
        archetype.entities.delete(entity)
        this.entityToArchetype.delete(entity)
      }
    })
  }

  getEntitiesWithArchetype(componentTypes: ReadonlySet<string>): Effect.Effect<ReadonlySet<EntityId>, never> {
    return Effect.sync(() => {
      const key = this.getArchetypeKey(componentTypes)
      const archetype = this.archetypes.get(key)
      return archetype ? new Set(archetype.entities) : new Set()
    })
  }

  clear(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      this.archetypes.clear()
      this.entityToArchetype.clear()
      this.nextArchetypeId = 0
    })
  }
}