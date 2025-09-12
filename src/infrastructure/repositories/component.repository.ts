/**
 * Component Repository Implementation - Specialized repository for component operations
 *
 * This repository provides component-specific operations and optimizations,
 * focusing on component lifecycle management, bulk component operations,
 * and component queries with type safety and validation.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Ref from 'effect/Ref'
import * as Option from 'effect/Option'
import * as Array from 'effect/Array'
import * as Schema from 'effect/Schema'

import { EntityId } from '@domain/entities'
import { type Components, type ComponentName, type ComponentOfName, ComponentSchemas, componentNamesSet } from '@domain/entities/components'
import { ComponentDecodeError } from '@domain/errors'

/**
 * Component metadata for tracking usage and performance
 */
export interface ComponentMetadata {
  readonly componentName: ComponentName
  readonly entityCount: number
  readonly totalSize: number
  readonly averageSize: number
  readonly lastUpdated: number
  readonly createdAt: number
  readonly version: number
}

/**
 * Component usage statistics
 */
export interface ComponentStats {
  readonly totalComponents: number
  readonly componentsByType: Record<ComponentName, number>
  readonly memoryUsage: Record<ComponentName, number>
  readonly mostUsedComponents: ReadonlyArray<{ name: ComponentName; count: number }>
  readonly leastUsedComponents: ReadonlyArray<{ name: ComponentName; count: number }>
}

/**
 * Component query options
 */
export interface ComponentQueryOptions {
  readonly includeTypes?: ReadonlyArray<ComponentName>
  readonly excludeTypes?: ReadonlyArray<ComponentName>
  readonly entityIds?: ReadonlyArray<EntityId>
  readonly limit?: number
  readonly offset?: number
}

/**
 * Component change tracking
 */
export interface ComponentChange {
  readonly entityId: EntityId
  readonly componentName: ComponentName
  readonly changeType: 'added' | 'updated' | 'removed'
  readonly previousValue?: unknown
  readonly newValue?: unknown
  readonly timestamp: number
}

/**
 * Component Repository interface
 */
export interface IComponentRepository {
  // Component operations
  readonly addComponent: <T extends ComponentName>(entityId: EntityId, componentName: T, component: ComponentOfName<T>) => Effect.Effect<boolean, ComponentDecodeError, never>
  readonly updateComponent: <T extends ComponentName>(entityId: EntityId, componentName: T, component: ComponentOfName<T>) => Effect.Effect<boolean, ComponentDecodeError, never>
  readonly removeComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<boolean, never, never>
  readonly getComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<Option.Option<ComponentOfName<T>>, never, never>
  readonly hasComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<boolean, never, never>

  // Bulk operations
  readonly addComponents: (entityId: EntityId, components: Record<string, unknown>) => Effect.Effect<number, ComponentDecodeError, never>
  readonly updateComponents: (entityId: EntityId, components: Record<string, unknown>) => Effect.Effect<number, ComponentDecodeError, never>
  readonly removeComponents: (entityId: EntityId, componentNames: ReadonlyArray<ComponentName>) => Effect.Effect<number, never, never>
  readonly getComponents: (entityId: EntityId, componentNames?: ReadonlyArray<ComponentName>) => Effect.Effect<Record<ComponentName, unknown>, never, never>

  // Query operations
  readonly findEntitiesByComponent: <T extends ComponentName>(componentName: T) => Effect.Effect<ReadonlyArray<{ entityId: EntityId; component: ComponentOfName<T> }>, never, never>
  readonly findComponentsByEntity: (entityId: EntityId) => Effect.Effect<Record<ComponentName, unknown>, never, never>
  readonly queryComponents: <T extends ComponentName>(componentName: T, predicate: (component: ComponentOfName<T>) => boolean) => Effect.Effect<ReadonlyArray<{ entityId: EntityId; component: ComponentOfName<T> }>, never, never>

  // Component metadata and statistics
  readonly getComponentMetadata: (componentName: ComponentName) => Effect.Effect<Option.Option<ComponentMetadata>, never, never>
  readonly getComponentStats: () => Effect.Effect<ComponentStats, never, never>
  readonly getComponentCount: (componentName?: ComponentName) => Effect.Effect<number, never, never>

  // Change tracking
  readonly getComponentChanges: (entityId?: EntityId, componentName?: ComponentName, since?: number) => Effect.Effect<ReadonlyArray<ComponentChange>, never, never>
  readonly clearChangeHistory: (before?: number) => Effect.Effect<number, never, never>

  // Validation and maintenance
  readonly validateComponent: <T extends ComponentName>(componentName: T, component: unknown) => Effect.Effect<ComponentOfName<T>, ComponentDecodeError, never>
  readonly validateComponents: (components: Record<string, unknown>) => Effect.Effect<Record<ComponentName, unknown>, ComponentDecodeError, never>
  readonly compactStorage: () => Effect.Effect<void, never, never>
  readonly optimizeIndices: () => Effect.Effect<void, never, never>
}

export const ComponentRepository = Context.GenericTag<IComponentRepository>('ComponentRepository')

/**
 * Component repository state
 */
export interface ComponentRepositoryState {
  readonly components: {
    readonly [K in ComponentName]: HashMap.HashMap<EntityId, Components[K]>
  }
  readonly metadata: HashMap.HashMap<ComponentName, ComponentMetadata>
  readonly changes: Array<ComponentChange>
  readonly maxChangeHistory: number
  readonly entityComponentIndex: HashMap.HashMap<EntityId, HashSet.HashSet<ComponentName>> // Index for fast entity component lookups
}

/**
 * Helper functions
 */
const estimateComponentSize = (component: unknown): number => {
  return JSON.stringify(component).length
}

const calculateComponentStats = (
  components: ComponentRepositoryState['components'],
  metadata: HashMap.HashMap<ComponentName, ComponentMetadata>
): ComponentStats => {
  const componentsByType: Record<ComponentName, number> = {} as any
  const memoryUsage: Record<ComponentName, number> = {} as any

  for (const componentName of componentNamesSet) {
    const count = HashMap.size(components[componentName])
    componentsByType[componentName] = count
    
    const metadataOpt = HashMap.get(metadata, componentName)
    memoryUsage[componentName] = Option.match(metadataOpt, {
      onNone: () => 0,
      onSome: (meta) => meta.totalSize
    })
  }

  const componentEntries = Array.from(componentNamesSet).map(name => ({
    name,
    count: componentsByType[name]
  }))

  const mostUsedComponents = componentEntries
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const leastUsedComponents = componentEntries
    .filter(entry => entry.count > 0)
    .sort((a, b) => a.count - b.count)
    .slice(0, 5)

  return {
    totalComponents: componentEntries.reduce((sum, entry) => sum + entry.count, 0),
    componentsByType,
    memoryUsage,
    mostUsedComponents,
    leastUsedComponents,
  }
}

/**
 * Component Repository Implementation
 */
export const createComponentRepository = (stateRef: Ref.Ref<ComponentRepositoryState>): IComponentRepository => {
  const addComponent = <T extends ComponentName>(entityId: EntityId, componentName: T, component: ComponentOfName<T>): Effect.Effect<boolean, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      
      // Check if component already exists
      const existingComponent = HashMap.get(state.components[componentName], entityId)
      if (Option.isSome(existingComponent)) {
        return false
      }

      // Validate component
      const schema = ComponentSchemas[componentName]
      const validatedComponent = yield* _(Schema.decode(schema)(component).pipe(
        Effect.mapError((error) => new ComponentDecodeError(entityId, componentName, error))
      ))

      const now = Date.now()
      const componentSize = estimateComponentSize(validatedComponent)

      // Update component storage
      const newComponents = {
        ...state.components,
        [componentName]: HashMap.set(state.components[componentName], entityId, validatedComponent as any)
      }

      // Update entity component index
      const currentEntityComponents = HashMap.get(state.entityComponentIndex, entityId) ?? HashSet.empty<ComponentName>()
      const newEntityComponentIndex = HashMap.set(
        state.entityComponentIndex,
        entityId,
        HashSet.add(currentEntityComponents, componentName)
      )

      // Update metadata
      const existingMetadata = HashMap.get(state.metadata, componentName)
      const newMetadata = Option.match(existingMetadata, {
        onNone: (): ComponentMetadata => ({
          componentName,
          entityCount: 1,
          totalSize: componentSize,
          averageSize: componentSize,
          lastUpdated: now,
          createdAt: now,
          version: 1,
        }),
        onSome: (meta): ComponentMetadata => ({
          ...meta,
          entityCount: meta.entityCount + 1,
          totalSize: meta.totalSize + componentSize,
          averageSize: (meta.totalSize + componentSize) / (meta.entityCount + 1),
          lastUpdated: now,
          version: meta.version + 1,
        })
      })

      // Record change
      const change: ComponentChange = {
        entityId,
        componentName,
        changeType: 'added',
        newValue: validatedComponent,
        timestamp: now,
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          components: newComponents,
          entityComponentIndex: newEntityComponentIndex,
          metadata: HashMap.set(s.metadata, componentName, newMetadata),
          changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
        }))
      )

      return true
    })

  const updateComponent = <T extends ComponentName>(entityId: EntityId, componentName: T, component: ComponentOfName<T>): Effect.Effect<boolean, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      
      // Check if component exists
      const existingComponent = HashMap.get(state.components[componentName], entityId)
      if (Option.isNone(existingComponent)) {
        return false
      }

      // Validate component
      const schema = ComponentSchemas[componentName]
      const validatedComponent = yield* _(Schema.decode(schema)(component).pipe(
        Effect.mapError((error) => new ComponentDecodeError(entityId, componentName, error))
      ))

      const now = Date.now()
      const oldSize = estimateComponentSize(existingComponent.value)
      const newSize = estimateComponentSize(validatedComponent)

      // Update component storage
      const newComponents = {
        ...state.components,
        [componentName]: HashMap.set(state.components[componentName], entityId, validatedComponent as any)
      }

      // Update metadata
      const existingMetadata = HashMap.get(state.metadata, componentName)
      const newMetadata = Option.match(existingMetadata, {
        onNone: (): ComponentMetadata => ({
          componentName,
          entityCount: 1,
          totalSize: newSize,
          averageSize: newSize,
          lastUpdated: now,
          createdAt: now,
          version: 1,
        }),
        onSome: (meta): ComponentMetadata => ({
          ...meta,
          totalSize: meta.totalSize - oldSize + newSize,
          averageSize: (meta.totalSize - oldSize + newSize) / meta.entityCount,
          lastUpdated: now,
          version: meta.version + 1,
        })
      })

      // Record change
      const change: ComponentChange = {
        entityId,
        componentName,
        changeType: 'updated',
        previousValue: existingComponent.value,
        newValue: validatedComponent,
        timestamp: now,
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          components: newComponents,
          metadata: HashMap.set(s.metadata, componentName, newMetadata),
          changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
        }))
      )

      return true
    })

  const removeComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      
      // Check if component exists
      const existingComponent = HashMap.get(state.components[componentName], entityId)
      if (Option.isNone(existingComponent)) {
        return false
      }

      const now = Date.now()
      const componentSize = estimateComponentSize(existingComponent.value)

      // Update component storage
      const newComponents = {
        ...state.components,
        [componentName]: HashMap.remove(state.components[componentName], entityId)
      }

      // Update entity component index
      const currentEntityComponents = HashMap.get(state.entityComponentIndex, entityId) ?? HashSet.empty<ComponentName>()
      const newEntityComponentIndex = HashMap.set(
        state.entityComponentIndex,
        entityId,
        HashSet.remove(currentEntityComponents, componentName)
      )

      // Update metadata
      const existingMetadata = HashMap.get(state.metadata, componentName)
      const newMetadata = Option.match(existingMetadata, {
        onNone: () => Option.none<ComponentMetadata>(),
        onSome: (meta): Option.Option<ComponentMetadata> => {
          const newEntityCount = meta.entityCount - 1
          if (newEntityCount === 0) {
            return Option.none()
          }
          return Option.some({
            ...meta,
            entityCount: newEntityCount,
            totalSize: meta.totalSize - componentSize,
            averageSize: (meta.totalSize - componentSize) / newEntityCount,
            lastUpdated: now,
            version: meta.version + 1,
          })
        }
      })

      // Record change
      const change: ComponentChange = {
        entityId,
        componentName,
        changeType: 'removed',
        previousValue: existingComponent.value,
        timestamp: now,
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          components: newComponents,
          entityComponentIndex: newEntityComponentIndex,
          metadata: Option.match(newMetadata, {
            onNone: () => HashMap.remove(s.metadata, componentName),
            onSome: (meta) => HashMap.set(s.metadata, componentName, meta)
          }),
          changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
        }))
      )

      return true
    })

  const getComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<Option.Option<ComponentOfName<T>>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const componentOpt = HashMap.get(state.components[componentName], entityId)
      return componentOpt as Option.Option<ComponentOfName<T>>
    })

  const hasComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return HashMap.has(state.components[componentName], entityId)
    })

  const addComponents = (entityId: EntityId, components: Record<string, unknown>): Effect.Effect<number, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      let addedCount = 0
      const componentEntries = Object.entries(components) as [ComponentName, unknown][]

      for (const [name, component] of componentEntries) {
        if (componentNamesSet.has(name)) {
          const added = yield* _(addComponent(entityId, name, component as any))
          if (added) addedCount++
        } else {
          yield* _(Effect.logWarning(`Skipping unknown component type: ${name}`))
        }
      }

      return addedCount
    })

  const updateComponents = (entityId: EntityId, components: Record<string, unknown>): Effect.Effect<number, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      let updatedCount = 0
      const componentEntries = Object.entries(components) as [ComponentName, unknown][]

      for (const [name, component] of componentEntries) {
        if (componentNamesSet.has(name)) {
          const updated = yield* _(updateComponent(entityId, name, component as any))
          if (updated) updatedCount++
        } else {
          yield* _(Effect.logWarning(`Skipping unknown component type: ${name}`))
        }
      }

      return updatedCount
    })

  const removeComponents = (entityId: EntityId, componentNames: ReadonlyArray<ComponentName>): Effect.Effect<number, never, never> =>
    Effect.gen(function* (_) {
      let removedCount = 0

      for (const componentName of componentNames) {
        const removed = yield* _(removeComponent(entityId, componentName))
        if (removed) removedCount++
      }

      return removedCount
    })

  const getComponents = (entityId: EntityId, componentNames?: ReadonlyArray<ComponentName>): Effect.Effect<Record<ComponentName, unknown>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const result: Record<string, unknown> = {}

      const namesToQuery = componentNames ?? Array.from(componentNamesSet)

      for (const componentName of namesToQuery) {
        const componentOpt = HashMap.get(state.components[componentName], entityId)
        if (Option.isSome(componentOpt)) {
          result[componentName] = componentOpt.value
        }
      }

      return result as Record<ComponentName, unknown>
    })

  const findEntitiesByComponent = <T extends ComponentName>(componentName: T): Effect.Effect<ReadonlyArray<{ entityId: EntityId; component: ComponentOfName<T> }>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const componentMap = state.components[componentName]
      const results: Array<{ entityId: EntityId; component: ComponentOfName<T> }> = []

      for (const [entityId, component] of HashMap.entries(componentMap)) {
        results.push({ entityId, component: component as ComponentOfName<T> })
      }

      return results
    })

  const findComponentsByEntity = (entityId: EntityId): Effect.Effect<Record<ComponentName, unknown>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const result: Record<string, unknown> = {}

      for (const componentName of componentNamesSet) {
        const componentOpt = HashMap.get(state.components[componentName], entityId)
        if (Option.isSome(componentOpt)) {
          result[componentName] = componentOpt.value
        }
      }

      return result as Record<ComponentName, unknown>
    })

  const queryComponents = <T extends ComponentName>(componentName: T, predicate: (component: ComponentOfName<T>) => boolean): Effect.Effect<ReadonlyArray<{ entityId: EntityId; component: ComponentOfName<T> }>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const componentMap = state.components[componentName]
      const results: Array<{ entityId: EntityId; component: ComponentOfName<T> }> = []

      for (const [entityId, component] of HashMap.entries(componentMap)) {
        const typedComponent = component as ComponentOfName<T>
        if (predicate(typedComponent)) {
          results.push({ entityId, component: typedComponent })
        }
      }

      return results
    })

  const getComponentMetadata = (componentName: ComponentName): Effect.Effect<Option.Option<ComponentMetadata>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return HashMap.get(state.metadata, componentName)
    })

  const getComponentStats = (): Effect.Effect<ComponentStats, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return calculateComponentStats(state.components, state.metadata)
    })

  const getComponentCount = (componentName?: ComponentName): Effect.Effect<number, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))

      if (!componentName) {
        let total = 0
        for (const name of componentNamesSet) {
          total += HashMap.size(state.components[name])
        }
        return total
      }

      return HashMap.size(state.components[componentName])
    })

  const getComponentChanges = (entityId?: EntityId, componentName?: ComponentName, since?: number): Effect.Effect<ReadonlyArray<ComponentChange>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      let changes = state.changes

      if (entityId) {
        changes = changes.filter((change) => change.entityId === entityId)
      }

      if (componentName) {
        changes = changes.filter((change) => change.componentName === componentName)
      }

      if (since) {
        changes = changes.filter((change) => change.timestamp >= since)
      }

      return changes
    })

  const clearChangeHistory = (before?: number): Effect.Effect<number, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const cutoff = before ?? Date.now()
      const oldChanges = state.changes.filter((change) => change.timestamp < cutoff)
      const newChanges = state.changes.filter((change) => change.timestamp >= cutoff)

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          changes: newChanges,
        }))
      )

      return oldChanges.length
    })

  const validateComponent = <T extends ComponentName>(componentName: T, component: unknown): Effect.Effect<ComponentOfName<T>, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      const schema = ComponentSchemas[componentName]
      const validatedComponent = yield* _(Schema.decode(schema)(component).pipe(
        Effect.mapError((error) => new ComponentDecodeError(null as any, componentName, error))
      ))
      return validatedComponent as ComponentOfName<T>
    })

  const validateComponents = (components: Record<string, unknown>): Effect.Effect<Record<ComponentName, unknown>, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      const result: Record<string, unknown> = {}
      const componentEntries = Object.entries(components) as [ComponentName, unknown][]

      for (const [name, component] of componentEntries) {
        if (componentNamesSet.has(name)) {
          const validated = yield* _(validateComponent(name, component))
          result[name] = validated
        } else {
          yield* _(Effect.logWarning(`Skipping unknown component type: ${name}`))
        }
      }

      return result as Record<ComponentName, unknown>
    })

  const compactStorage = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      // Remove empty component maps and metadata for components with no instances
      yield* _(
        Ref.update(stateRef, (s) => {
          const newMetadata = HashMap.filter(s.metadata, (meta) => meta.entityCount > 0)
          const newEntityComponentIndex = HashMap.filter(s.entityComponentIndex, (componentSet) => HashSet.size(componentSet) > 0)
          
          return {
            ...s,
            metadata: newMetadata,
            entityComponentIndex: newEntityComponentIndex,
          }
        })
      )
    })

  const optimizeIndices = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      // Rebuild entity component index for consistency
      yield* _(
        Ref.update(stateRef, (s) => {
          let newEntityComponentIndex = HashMap.empty<EntityId, HashSet.HashSet<ComponentName>>()

          for (const componentName of componentNamesSet) {
            const componentMap = s.components[componentName]
            for (const entityId of HashMap.keys(componentMap)) {
              const currentSet = HashMap.get(newEntityComponentIndex, entityId) ?? HashSet.empty<ComponentName>()
              newEntityComponentIndex = HashMap.set(newEntityComponentIndex, entityId, HashSet.add(currentSet, componentName))
            }
          }

          return {
            ...s,
            entityComponentIndex: newEntityComponentIndex,
          }
        })
      )
    })

  // Return the complete implementation
  return {
    addComponent,
    updateComponent,
    removeComponent,
    getComponent,
    hasComponent,
    addComponents,
    updateComponents,
    removeComponents,
    getComponents,
    findEntitiesByComponent,
    findComponentsByEntity,
    queryComponents,
    getComponentMetadata,
    getComponentStats,
    getComponentCount,
    getComponentChanges,
    clearChangeHistory,
    validateComponent,
    validateComponents,
    compactStorage,
    optimizeIndices,
  }
}

/**
 * Component Repository Layer
 */
export const ComponentRepositoryLive = Layer.effect(
  ComponentRepository,
  Effect.gen(function* (_) {
    const initialState: ComponentRepositoryState = {
      components: Object.fromEntries(
        Array.from(componentNamesSet).map((name) => [name, HashMap.empty()])
      ) as ComponentRepositoryState['components'],
      metadata: HashMap.empty(),
      changes: [],
      maxChangeHistory: 5000,
      entityComponentIndex: HashMap.empty(),
    }

    const stateRef = yield* _(Ref.make(initialState))

    return createComponentRepository(stateRef)
  })
)