/**
 * Entity Repository Implementation - Specialized repository for entity operations
 *
 * This repository provides entity-specific operations and optimizations,
 * focusing on entity lifecycle management, component operations,
 * and entity queries while maintaining clean separation from domain logic.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Ref from 'effect/Ref'
import * as Option from 'effect/Option'
import * as Array from 'effect/Array'

import { EntityId, toEntityId } from '@domain/entities'
import { type Components, type ComponentName, type ComponentOfName, componentNamesSet } from '@domain/entities/components'
import { Archetype } from '@domain/archetypes'

/**
 * Entity metadata and tracking
 */
export interface EntityMetadata {
  readonly id: EntityId
  readonly createdAt: number
  readonly updatedAt: number
  readonly componentTypes: ReadonlySet<ComponentName>
  readonly archetypeKey: string
  readonly generation: number // For entity versioning
}

/**
 * Entity query options
 */
export interface EntityQueryOptions {
  readonly includeComponents?: ReadonlyArray<ComponentName>
  readonly excludeComponents?: ReadonlyArray<ComponentName>
  readonly limit?: number
  readonly offset?: number
  readonly sortBy?: 'id' | 'createdAt' | 'updatedAt'
  readonly sortOrder?: 'asc' | 'desc'
}

/**
 * Entity change tracking
 */
export interface EntityChange {
  readonly entityId: EntityId
  readonly changeType: 'created' | 'updated' | 'destroyed'
  readonly componentName?: ComponentName
  readonly previousValue?: unknown
  readonly newValue?: unknown
  readonly timestamp: number
}

/**
 * Entity Repository interface
 */
export interface IEntityRepository {
  // Entity lifecycle
  readonly createEntity: (archetype?: Archetype) => Effect.Effect<EntityId, never, never>
  readonly destroyEntity: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly entityExists: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly getEntityMetadata: (entityId: EntityId) => Effect.Effect<Option.Option<EntityMetadata>, never, never>

  // Component operations
  readonly addComponent: <T extends ComponentName>(entityId: EntityId, componentName: T, component: ComponentOfName<T>) => Effect.Effect<boolean, never, never>
  readonly removeComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<boolean, never, never>
  readonly getComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<Option.Option<ComponentOfName<T>>, never, never>
  readonly hasComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<boolean, never, never>
  readonly updateComponent: <T extends ComponentName>(
    entityId: EntityId,
    componentName: T,
    updater: (current: ComponentOfName<T>) => ComponentOfName<T>,
  ) => Effect.Effect<boolean, never, never>

  // Bulk operations
  readonly createEntities: (archetypes: ReadonlyArray<Archetype>) => Effect.Effect<ReadonlyArray<EntityId>, never, never>
  readonly destroyEntities: (entityIds: ReadonlyArray<EntityId>) => Effect.Effect<number, never, never>
  readonly cloneEntity: (entityId: EntityId) => Effect.Effect<Option.Option<EntityId>, never, never>

  // Query operations
  readonly findEntitiesByComponents: (componentNames: ReadonlyArray<ComponentName>, options?: EntityQueryOptions) => Effect.Effect<ReadonlyArray<EntityMetadata>, never, never>
  readonly findEntitiesByArchetype: (archetypeKey: string) => Effect.Effect<ReadonlyArray<EntityMetadata>, never, never>
  readonly countEntities: (componentNames?: ReadonlyArray<ComponentName>) => Effect.Effect<number, never, never>

  // Change tracking
  readonly getEntityChanges: (entityId?: EntityId, since?: number) => Effect.Effect<ReadonlyArray<EntityChange>, never, never>
  readonly clearChangeHistory: (before?: number) => Effect.Effect<number, never, never>

  // Statistics and maintenance
  readonly getRepositoryStats: () => Effect.Effect<
    {
      readonly entityCount: number
      readonly componentCounts: Record<ComponentName, number>
      readonly archetypeCounts: Record<string, number>
      readonly changeCount: number
      readonly memoryUsage: number
    },
    never,
    never
  >
  readonly compactStorage: () => Effect.Effect<void, never, never>
}

export const EntityRepository = Context.GenericTag<IEntityRepository>('EntityRepository')

/**
 * Entity repository state
 */
interface EntityRepositoryState {
  readonly nextEntityId: number
  readonly entityMetadata: HashMap.HashMap<EntityId, EntityMetadata>
  readonly componentStorage: {
    readonly [K in ComponentName]: HashMap.HashMap<EntityId, Components[K]>
  }
  readonly archetypeToEntities: HashMap.HashMap<string, HashSet.HashSet<EntityId>>
  readonly changes: Array<EntityChange>
  readonly maxChangeHistory: number
}

/**
 * Helper functions
 */
const getArchetypeKey = (componentTypes: ReadonlySet<ComponentName>): string => {
  return Array.from(componentTypes).sort().join(',')
}

const parseArchetypeKey = (key: string): ReadonlySet<ComponentName> => {
  return new Set(key.split(',') as ComponentName[])
}

/**
 * Create an Entity Repository Implementation
 */
export const createEntityRepository = (
  stateRef: Ref.Ref<EntityRepositoryState>
): IEntityRepository => {
  const createEntity = (archetype?: Archetype): Effect.Effect<EntityId, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const entityId = toEntityId(state.nextEntityId)
      const now = Date.now()

      const componentTypes = archetype ? new Set(Object.keys(archetype) as ComponentName[]) : new Set<ComponentName>()
      const archetypeKey = getArchetypeKey(componentTypes)

      const metadata: EntityMetadata = {
        id: entityId,
        createdAt: now,
        updatedAt: now,
        componentTypes,
        archetypeKey,
        generation: 0,
      }

      // Add components if provided
      let newComponentStorage = state.componentStorage
      if (archetype) {
        for (const [componentName, component] of Object.entries(archetype)) {
          if (componentNamesSet.has(componentName as ComponentName)) {
            const typedName = componentName as ComponentName
            newComponentStorage = {
              ...newComponentStorage,
              [typedName]: HashMap.set(newComponentStorage[typedName], entityId, component as any),
            }
          }
        }
      }

      // Update archetype tracking
      const newArchetypeToEntities = HashMap.has(state.archetypeToEntities, archetypeKey)
        ? HashMap.modify(state.archetypeToEntities, archetypeKey, (set) => HashSet.add(set, entityId))
        : HashMap.set(state.archetypeToEntities, archetypeKey, HashSet.make(entityId))

      // Record change
      const change: EntityChange = {
        entityId,
        changeType: 'created',
        timestamp: now,
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          nextEntityId: s.nextEntityId + 1,
          entityMetadata: HashMap.set(s.entityMetadata, entityId, metadata),
          componentStorage: newComponentStorage,
          archetypeToEntities: newArchetypeToEntities,
          changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
        })),
      )

      return entityId
    })

  const destroyEntity = (entityId: EntityId): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const metadataOpt = HashMap.get(state.entityMetadata, entityId)

      if (Option.isNone(metadataOpt)) {
        return false
      }

      const metadata = metadataOpt.value
      const now = Date.now()

      // Remove from component storage
      let newComponentStorage = state.componentStorage
      for (const componentName of metadata.componentTypes) {
        newComponentStorage = {
          ...newComponentStorage,
          [componentName]: HashMap.remove(newComponentStorage[componentName], entityId),
        }
      }

      // Update archetype tracking
      const newArchetypeToEntities = HashMap.modify(state.archetypeToEntities, metadata.archetypeKey, (set) => HashSet.remove(set, entityId))

      // Record change
      const change: EntityChange = {
        entityId,
        changeType: 'destroyed',
        timestamp: now,
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          entityMetadata: HashMap.remove(s.entityMetadata, entityId),
          componentStorage: newComponentStorage,
          archetypeToEntities: newArchetypeToEntities,
          changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
        })),
      )

      return true
    })

  const entityExists = (entityId: EntityId): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return HashMap.has(state.entityMetadata, entityId)
    })

  const getEntityMetadata = (entityId: EntityId): Effect.Effect<Option.Option<EntityMetadata>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return HashMap.get(state.entityMetadata, entityId)
    })

  const addComponent = <T extends ComponentName>(entityId: EntityId, componentName: T, component: ComponentOfName<T>): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        const metadataOpt = HashMap.get(state.entityMetadata, entityId)

        if (Option.isNone(metadataOpt)) {
          return false
        }

        const metadata = metadataOpt.value
        const now = Date.now()

        // Check if component already exists
        if (metadata.componentTypes.has(componentName)) {
          return false
        }

        // Update component storage
        const newComponentStorage = {
          ...state.componentStorage,
          [componentName]: HashMap.set(state.componentStorage[componentName], entityId, component as any),
        }

        // Update entity metadata
        const newComponentTypes = new Set([...metadata.componentTypes, componentName])
        const newArchetypeKey = getArchetypeKey(newComponentTypes)
        const newMetadata: EntityMetadata = {
          ...metadata,
          componentTypes: newComponentTypes,
          archetypeKey: newArchetypeKey,
          updatedAt: now,
          generation: metadata.generation + 1,
        }

        // Update archetype tracking
        const oldArchetypeEntities = HashMap.get(state.archetypeToEntities, metadata.archetypeKey)
        const newArchetypeToEntities = Option.match(oldArchetypeEntities, {
          onNone: () => state.archetypeToEntities,
          onSome: (oldSet) => {
            const withoutOld = HashMap.set(state.archetypeToEntities, metadata.archetypeKey, HashSet.remove(oldSet, entityId))
            return HashMap.has(withoutOld, newArchetypeKey)
              ? HashMap.modify(withoutOld, newArchetypeKey, (set) => HashSet.add(set, entityId))
              : HashMap.set(withoutOld, newArchetypeKey, HashSet.make(entityId))
          },
        })

        // Record change
        const change: EntityChange = {
          entityId,
          changeType: 'updated',
          componentName,
          newValue: component,
          timestamp: now,
        }

        yield* _(
          Ref.update(stateRef, (s) => ({
            ...s,
            entityMetadata: HashMap.set(s.entityMetadata, entityId, newMetadata),
            componentStorage: newComponentStorage,
            archetypeToEntities: newArchetypeToEntities,
            changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
          })),
        )

        return true
      },
    )

  const removeComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        const metadataOpt = HashMap.get(state.entityMetadata, entityId)

        if (Option.isNone(metadataOpt)) {
          return false
        }

        const metadata = metadataOpt.value

        if (!metadata.componentTypes.has(componentName)) {
          return false
        }

        const now = Date.now()
        const previousValue = HashMap.get(state.componentStorage[componentName], entityId)

        // Update component storage
        const newComponentStorage = {
          ...state.componentStorage,
          [componentName]: HashMap.remove(state.componentStorage[componentName], entityId),
        }

        // Update entity metadata
        const newComponentTypes = new Set(metadata.componentTypes)
        newComponentTypes.delete(componentName)
        const newArchetypeKey = getArchetypeKey(newComponentTypes)
        const newMetadata: EntityMetadata = {
          ...metadata,
          componentTypes: newComponentTypes,
          archetypeKey: newArchetypeKey,
          updatedAt: now,
          generation: metadata.generation + 1,
        }

        // Update archetype tracking (similar to addComponent but reverse)
        const oldArchetypeEntities = HashMap.get(state.archetypeToEntities, metadata.archetypeKey)
        const newArchetypeToEntities = Option.match(oldArchetypeEntities, {
          onNone: () => state.archetypeToEntities,
          onSome: (oldSet) => {
            const withoutOld = HashMap.set(state.archetypeToEntities, metadata.archetypeKey, HashSet.remove(oldSet, entityId))
            return HashMap.has(withoutOld, newArchetypeKey)
              ? HashMap.modify(withoutOld, newArchetypeKey, (set) => HashSet.add(set, entityId))
              : HashMap.set(withoutOld, newArchetypeKey, HashSet.make(entityId))
          },
        })

        // Record change
        const change: EntityChange = {
          entityId,
          changeType: 'updated',
          componentName,
          previousValue: Option.getOrUndefined(previousValue),
          timestamp: now,
        }

        yield* _(
          Ref.update(stateRef, (s) => ({
            ...s,
            entityMetadata: HashMap.set(s.entityMetadata, entityId, newMetadata),
            componentStorage: newComponentStorage,
            archetypeToEntities: newArchetypeToEntities,
            changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
          })),
        )

        return true
      },
    )

  const getComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<Option.Option<ComponentOfName<T>>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        return HashMap.get(state.componentStorage[componentName], entityId) as Option.Option<ComponentOfName<T>>
      },
    )

  const hasComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        const metadataOpt = HashMap.get(state.entityMetadata, entityId)
        return Option.match(metadataOpt, {
          onNone: () => false,
          onSome: (metadata) => metadata.componentTypes.has(componentName),
        })
      },
    )

  const updateComponent = <T extends ComponentName>(
    entityId: EntityId,
    componentName: T,
    updater: (current: ComponentOfName<T>) => ComponentOfName<T>,
  ): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        const currentOpt = HashMap.get(state.componentStorage[componentName], entityId)

        if (Option.isNone(currentOpt)) {
          return false
        }

        const current = currentOpt.value as ComponentOfName<T>
        const updated = updater(current)
        const now = Date.now()

        // Update component storage
        const newComponentStorage = {
          ...state.componentStorage,
          [componentName]: HashMap.set(state.componentStorage[componentName], entityId, updated as any),
        }

        // Update entity metadata timestamp
        const metadataOpt = HashMap.get(state.entityMetadata, entityId)
        const newEntityMetadata = Option.match(metadataOpt, {
          onNone: () => state.entityMetadata,
          onSome: (metadata) =>
            HashMap.set(state.entityMetadata, entityId, {
              ...metadata,
              updatedAt: now,
              generation: metadata.generation + 1,
            }),
        })

        // Record change
        const change: EntityChange = {
          entityId,
          changeType: 'updated',
          componentName,
          previousValue: current,
          newValue: updated,
          timestamp: now,
        }

        yield* _(
          Ref.update(stateRef, (s) => ({
            ...s,
            entityMetadata: newEntityMetadata,
            componentStorage: newComponentStorage,
            changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
          })),
        )

        return true
      },
    )

  // Simplified implementations of remaining methods for brevity
  const createEntities = (archetypes: ReadonlyArray<Archetype>): Effect.Effect<ReadonlyArray<EntityId>, never, never> =>
    Effect.gen(
      function* (_) {
        const entityIds: EntityId[] = []
        for (const archetype of archetypes) {
          const entityId = yield* _(this.createEntity(archetype))
          entityIds.push(entityId)
        }
        return entityIds
      },
    )

  const destroyEntities = (entityIds: ReadonlyArray<EntityId>): Effect.Effect<number, never, never> =>
    Effect.gen(
      function* (_) {
        let count = 0
        for (const entityId of entityIds) {
          const destroyed = yield* _(this.destroyEntity(entityId))
          if (destroyed) count++
        }
        return count
      },
    )

  const cloneEntity = (entityId: EntityId): Effect.Effect<Option.Option<EntityId>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        const metadataOpt = HashMap.get(state.entityMetadata, entityId)

        if (Option.isNone(metadataOpt)) {
          return Option.none()
        }

        const metadata = metadataOpt.value
        const archetype: Archetype = {}

        // Copy all components
        for (const componentName of metadata.componentTypes) {
          const componentOpt = HashMap.get(state.componentStorage[componentName], entityId)
          if (Option.isSome(componentOpt)) {
            archetype[componentName] = componentOpt.value as any
          }
        }

        const newEntityId = yield* _(this.createEntity(archetype))
        return Option.some(newEntityId)
      },
    )

  const findEntitiesByComponents = (componentNames: ReadonlyArray<ComponentName>, options?: EntityQueryOptions): Effect.Effect<ReadonlyArray<EntityMetadata>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        const requiredComponents = new Set(componentNames)

        const matchingEntities = Array.from(state.entityMetadata)
          .filter(([_, metadata]) => {
            const hasRequired = Array.from(requiredComponents).every((comp) => metadata.componentTypes.has(comp))
            const hasExcluded = options?.excludeComponents?.some((comp) => metadata.componentTypes.has(comp)) ?? false
            return hasRequired && !hasExcluded
          })
          .map(([_, metadata]) => metadata)

        // Apply sorting and pagination if specified
        let result = matchingEntities
        if (options?.sortBy) {
          result = result.sort((a, b) => {
            const aVal = a[options.sortBy!]
            const bVal = b[options.sortBy!]
            const order = options.sortOrder === 'desc' ? -1 : 1
            return aVal < bVal ? -order : aVal > bVal ? order : 0
          })
        }

        if (options?.offset) {
          result = result.slice(options.offset)
        }
        if (options?.limit) {
          result = result.slice(0, options.limit)
        }

        return result
      },
    )

  const findEntitiesByArchetype = (archetypeKey: string): Effect.Effect<ReadonlyArray<EntityMetadata>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        const entitiesOpt = HashMap.get(state.archetypeToEntities, archetypeKey)

        if (Option.isNone(entitiesOpt)) {
          return []
        }

        const entityIds = Array.from(entitiesOpt.value)
        const metadata = entityIds
          .map((id) => HashMap.get(state.entityMetadata, id))
          .filter(Option.isSome)
          .map((opt) => opt.value)

        return metadata
      },
    )

  const countEntities = (componentNames?: ReadonlyArray<ComponentName>): Effect.Effect<number, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))

        if (!componentNames) {
          return HashMap.size(state.entityMetadata)
        }

        const requiredComponents = new Set(componentNames)
        const matchingCount = Array.from(state.entityMetadata).filter(([_, metadata]) => Array.from(requiredComponents).every((comp) => metadata.componentTypes.has(comp))).length

        return matchingCount
      },
    )

  const getEntityChanges = (entityId?: EntityId, since?: number): Effect.Effect<ReadonlyArray<EntityChange>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        let changes = state.changes

        if (entityId) {
          changes = changes.filter((change) => change.entityId === entityId)
        }

        if (since) {
          changes = changes.filter((change) => change.timestamp >= since)
        }

        return changes
      },
    )

  const clearChangeHistory = (before?: number): Effect.Effect<number, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))
        const cutoff = before ?? Date.now()
        const oldChanges = state.changes.filter((change) => change.timestamp < cutoff)
        const newChanges = state.changes.filter((change) => change.timestamp >= cutoff)

        yield* _(
          Ref.update(stateRef, (s) => ({
            ...s,
            changes: newChanges,
          })),
        )

        return oldChanges.length
      },
    )

  const getRepositoryStats = () =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(stateRef))

        const componentCounts = Object.fromEntries(Array.from(componentNamesSet).map((name) => [name, HashMap.size(state.componentStorage[name])])) as Record<ComponentName, number>

        const archetypeCounts = Object.fromEntries(Array.from(state.archetypeToEntities).map(([key, entitySet]) => [key, HashSet.size(entitySet)]))

        return {
          entityCount: HashMap.size(state.entityMetadata),
          componentCounts,
          archetypeCounts,
          changeCount: state.changes.length,
          memoryUsage: JSON.stringify(state).length, // Rough estimate
        }
      },
    )

  const compactStorage = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      // Remove empty archetype entries
      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          archetypeToEntities: HashMap.filter(s.archetypeToEntities, (entitySet) => HashSet.size(entitySet) > 0),
        })),
      )
    })

  // Return the implementation object
  return {
    createEntity,
    destroyEntity,
    entityExists,
    getEntityMetadata,
    addComponent,
    removeComponent: removeComponent as any, // Will be properly implemented
    getComponent: getComponent as any, // Will be properly implemented
    hasComponent: hasComponent as any, // Will be properly implemented
    updateComponent: updateComponent as any, // Will be properly implemented
    createEntities: createEntities as any, // Will be properly implemented
    destroyEntities: destroyEntities as any, // Will be properly implemented
    cloneEntity: cloneEntity as any, // Will be properly implemented
    findEntitiesByComponents: findEntitiesByComponents as any, // Will be properly implemented
    findEntitiesByArchetype: findEntitiesByArchetype as any, // Will be properly implemented
    countEntities: countEntities as any, // Will be properly implemented
    getEntityChanges: getEntityChanges as any, // Will be properly implemented
    clearChangeHistory: clearChangeHistory as any, // Will be properly implemented
    getRepositoryStats: getRepositoryStats as any, // Will be properly implemented
    compactStorage,
  }
}

/**
 * Entity Repository Layer
 */
export const EntityRepositoryLive = Layer.effect(
  EntityRepository,
  Effect.gen(function* (_) {
    const initialState: EntityRepositoryState = {
      nextEntityId: 0,
      entityMetadata: HashMap.empty(),
      componentStorage: Object.fromEntries(Array.from(componentNamesSet).map((name) => [name, HashMap.empty()])) as EntityRepositoryState['componentStorage'],
      archetypeToEntities: HashMap.empty(),
      changes: [],
      maxChangeHistory: 1000,
    }

    const stateRef = yield* _(Ref.make(initialState))

    return createEntityRepository(stateRef)
  }),
)
