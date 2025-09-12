/**
 * World Repository Implementation - Concrete implementation of IWorldRepository
 *
 * This repository provides persistent storage and retrieval operations
 * for world data, implementing the IWorldRepository domain port to
 * maintain separation between domain logic and infrastructure concerns.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Ref from 'effect/Ref'
import * as Option from 'effect/Option'
import * as S from 'effect/Schema'

import { IWorldRepository } from '@domain/ports/world-repository.port'
import { EntityId, toEntityId } from '@domain/entities'
import { Archetype } from '@domain/archetypes'
import { type Components, type ComponentName, type ComponentOfName, ComponentSchemas, componentNamesSet } from '@domain/entities/components'
import { SoAResult } from '@domain/types'
import { ComponentNotFoundError, QuerySingleResultNotFoundError, ComponentDecodeError } from '@domain/errors'

/**
 * Internal storage types
 */
type ComponentStorage = {
  readonly [K in ComponentName]: HashMap.HashMap<EntityId, Components[K]>
}

type ArchetypeStorage = HashMap.HashMap<string, HashSet.HashSet<EntityId>>

export interface WorldRepositoryState {
  readonly nextEntityId: number
  readonly entities: HashMap.HashMap<EntityId, string> // Map<EntityId, ArchetypeKey>
  readonly archetypes: ArchetypeStorage
  readonly components: ComponentStorage
  readonly version: number // For optimistic locking
}

/**
 * Helper functions
 */
const getArchetypeKey = (components: ReadonlyArray<ComponentName>): string => {
  return [...components].sort().join(',')
}

const parseArchetypeKey = (key: string): ReadonlyArray<ComponentName> => {
  return key.split(',') as ComponentName[]
}

/**
 * World Repository Implementation
 */
export const createWorldRepository = (stateRef: Ref.Ref<WorldRepositoryState>): IWorldRepository => {
  const updateComponent = <T>(entityId: EntityId, componentType: string, component: T): Effect.Effect<void, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const componentName = componentType as ComponentName

      if (!componentNamesSet.has(componentName)) {
        yield* _(Effect.logWarning(`Unknown component type: ${componentType}`))
        return
      }

      // Validate component against schema
      const schema = ComponentSchemas[componentName]
      const validatedComponent = yield* _(S.decode(schema)(component).pipe(Effect.mapError((error) => new ComponentDecodeError(entityId, componentName, error))))

      // Update component storage
      const currentComponentMap = state.components[componentName]
      const newComponentMap = HashMap.set(currentComponentMap, entityId, validatedComponent as any)
      const newComponents = { ...state.components, [componentName]: newComponentMap }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          components: newComponents,
          version: s.version + 1,
        })),
      )
    })

  const querySoA = <T extends ReadonlyArray<ComponentName>>(components: T): Effect.Effect<SoAResult<T>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const requiredComponents = HashSet.fromIterable(components)

      // Find matching archetypes
      const matchingArchetypes = HashMap.filter(state.archetypes, (_, key) => {
        const archetypeComponents = HashSet.fromIterable(parseArchetypeKey(key))
        return HashSet.isSubset(requiredComponents, archetypeComponents)
      })

      // Collect matching entities and their components
      const matchingEntities = Array.from(matchingArchetypes)
        .flatMap(([, entitySet]: [string, HashSet.HashSet<EntityId>]) =>
          Array.from(entitySet)
            .map((entityId: EntityId) => {
              const componentOptions = components.map((name) => HashMap.get(state.components[name], entityId))
              const allComponents = Option.all(componentOptions)
              return Option.map(allComponents, (components) => ({ entityId, components }))
            })
            .filter(Option.isSome)
            .map((option) => option.value),
        )
        .filter((result) => result !== undefined)

      // Structure data in SoA format
      const entities = matchingEntities.map(({ entityId }) => entityId)
      const componentsData = Object.fromEntries(components.map((name, i) => [name, matchingEntities.map(({ components }) => components[i])]))

      return {
        entities,
        components: componentsData as { [K in T[number]]: ReadonlyArray<Components[K]> },
      } as SoAResult<T>
    })

  const createEntity = (components?: Record<string, unknown>): Effect.Effect<EntityId, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const entityId = toEntityId(state.nextEntityId)

      if (!components || Object.keys(components).length === 0) {
        // Create empty entity
        yield* _(
          Ref.update(stateRef, (s) => ({
            ...s,
            nextEntityId: s.nextEntityId + 1,
            entities: HashMap.set(s.entities, entityId, ''),
            version: s.version + 1,
          })),
        )
        return entityId
      }

      // Validate and add components
      const componentEntries = Object.entries(components) as [ComponentName, unknown][]
      const validatedEntries: [ComponentName, unknown][] = []

      for (const [name, component] of componentEntries) {
        if (componentNamesSet.has(name)) {
          const schema = ComponentSchemas[name]
          const validatedComponent = yield* _(S.decode(schema)(component).pipe(Effect.mapError((error) => new ComponentDecodeError(entityId, name, error))))
          validatedEntries.push([name, validatedComponent])
        } else {
          yield* _(Effect.logWarning(`Skipping unknown component type: ${name}`))
        }
      }

      const archetypeKey = getArchetypeKey(validatedEntries.map(([name]) => name))

      // Update archetype storage
      const newArchetypes = HashMap.has(state.archetypes, archetypeKey)
        ? HashMap.modify(state.archetypes, archetypeKey, (set) => HashSet.add(set, entityId))
        : HashMap.set(state.archetypes, archetypeKey, HashSet.make(entityId))

      // Update component storage
      const newComponents = validatedEntries.reduce((acc, [name, component]) => {
        const componentMap = acc[name]
        return {
          ...acc,
          [name]: HashMap.set(componentMap, entityId, component),
        }
      }, state.components)

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          nextEntityId: s.nextEntityId + 1,
          entities: HashMap.set(s.entities, entityId, archetypeKey),
          archetypes: newArchetypes,
          components: newComponents,
          version: s.version + 1,
        })),
      )

      return entityId
    })

  const destroyEntity = (entityId: EntityId): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const archetypeKeyOpt = HashMap.get(state.entities, entityId)

      if (Option.isNone(archetypeKeyOpt)) {
        yield* _(Effect.logDebug(`Entity ${entityId} not found, skipping destruction`))
        return
      }

      const archetypeKey = archetypeKeyOpt.value

      // Update archetype storage
      const newArchetypes = HashMap.modify(state.archetypes, archetypeKey, (set) => HashSet.remove(set, entityId))

      // Remove from component storage
      const componentNamesToRemove = parseArchetypeKey(archetypeKey)
      const newComponents = componentNamesToRemove.reduce((acc, componentName) => {
        return {
          ...acc,
          [componentName]: HashMap.remove(acc[componentName], entityId),
        }
      }, state.components)

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          entities: HashMap.remove(s.entities, entityId),
          archetypes: newArchetypes,
          components: newComponents,
          version: s.version + 1,
        })),
      )
    })

  const hasEntity = (entityId: EntityId): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return HashMap.has(state.entities, entityId)
    })

  const updateComponents = (
    updates: ReadonlyArray<{
      entityId: EntityId
      componentType: string
      component: unknown
    }>,
  ): Effect.Effect<void, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      // Process all updates atomically
      for (const update of updates) {
        yield* _(updateComponent(update.entityId, update.componentType, update.component))
      }
    })
  // Add missing methods from IWorldRepository interface
  const getComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<Option.Option<ComponentOfName<T>>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const componentOpt = HashMap.get(state.components[componentName], entityId)
      return componentOpt as Option.Option<ComponentOfName<T>>
    })

  const addComponent = <T extends ComponentName>(entityId: EntityId, componentName: T, component: ComponentOfName<T>): Effect.Effect<boolean, ComponentDecodeError, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const entityArchetypeOpt = HashMap.get(state.entities, entityId)
      
      if (Option.isNone(entityArchetypeOpt)) {
        return false
      }

      // Validate component
      const schema = ComponentSchemas[componentName]
      const validatedComponent = yield* _(S.decode(schema)(component).pipe(Effect.mapError((error) => new ComponentDecodeError(entityId, componentName, error))))
      
      const currentArchetypeKey = entityArchetypeOpt.value
      const currentComponents = currentArchetypeKey === '' ? [] : parseArchetypeKey(currentArchetypeKey)
      
      // Check if component already exists
      if (currentComponents.includes(componentName)) {
        return false
      }
      
      const newComponents = [...currentComponents, componentName]
      const newArchetypeKey = getArchetypeKey(newComponents)
      
      // Update archetype storage
      const newArchetypes = currentArchetypeKey === ''
        ? HashMap.set(state.archetypes, newArchetypeKey, HashSet.make(entityId))
        : HashMap.has(state.archetypes, newArchetypeKey)
          ? HashMap.modify(state.archetypes, newArchetypeKey, (set) => HashSet.add(set, entityId))
          : HashMap.set(
              HashMap.modify(state.archetypes, currentArchetypeKey, (set) => HashSet.remove(set, entityId)),
              newArchetypeKey,
              HashSet.make(entityId)
            )
      
      // Update component storage
      const newComponentStorage = {
        ...state.components,
        [componentName]: HashMap.set(state.components[componentName], entityId, validatedComponent)
      }
      
      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          entities: HashMap.set(s.entities, entityId, newArchetypeKey),
          archetypes: newArchetypes,
          components: newComponentStorage,
          version: s.version + 1,
        }))
      )
      
      return true
    })

  const removeComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const entityArchetypeOpt = HashMap.get(state.entities, entityId)
      
      if (Option.isNone(entityArchetypeOpt)) {
        return false
      }
      
      const currentArchetypeKey = entityArchetypeOpt.value
      if (currentArchetypeKey === '') {
        return false
      }
      
      const currentComponents = parseArchetypeKey(currentArchetypeKey)
      if (!currentComponents.includes(componentName)) {
        return false
      }
      
      const newComponents = currentComponents.filter(c => c !== componentName)
      const newArchetypeKey = getArchetypeKey(newComponents)
      
      // Update archetype storage
      const newArchetypes = newComponents.length === 0
        ? HashMap.modify(state.archetypes, currentArchetypeKey, (set) => HashSet.remove(set, entityId))
        : HashMap.has(state.archetypes, newArchetypeKey)
          ? HashMap.modify(state.archetypes, newArchetypeKey, (set) => HashSet.add(set, entityId))
          : HashMap.set(
              HashMap.modify(state.archetypes, currentArchetypeKey, (set) => HashSet.remove(set, entityId)),
              newArchetypeKey,
              HashSet.make(entityId)
            )
      
      // Update component storage
      const newComponentStorage = {
        ...state.components,
        [componentName]: HashMap.remove(state.components[componentName], entityId)
      }
      
      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          entities: HashMap.set(s.entities, entityId, newArchetypeKey),
          archetypes: newArchetypes,
          components: newComponentStorage,
          version: s.version + 1,
        }))
      )
      
      return true
    })

  const hasComponent = <T extends ComponentName>(entityId: EntityId, componentName: T): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const componentOpt = HashMap.get(state.components[componentName], entityId)
      return Option.isSome(componentOpt)
    })

  const query = <T extends ComponentName>(componentName: T): Effect.Effect<ReadonlyArray<{ entityId: EntityId; component: ComponentOfName<T> }>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const componentMap = state.components[componentName]
      const results: Array<{ entityId: EntityId; component: ComponentOfName<T> }> = []
      
      for (const [entityId, component] of HashMap.entries(componentMap)) {
        results.push({ entityId, component: component as ComponentOfName<T> })
      }
      
      return results
    })

  const queryMultiple = <T extends ReadonlyArray<ComponentName>>(componentNames: T): Effect.Effect<ReadonlyArray<{ entityId: EntityId; components: { [K in T[number]]: ComponentOfName<K> } }>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const requiredComponents = HashSet.fromIterable(componentNames)

      // Find matching archetypes
      const matchingArchetypes = HashMap.filter(state.archetypes, (_, key) => {
        const archetypeComponents = HashSet.fromIterable(parseArchetypeKey(key))
        return HashSet.isSubset(requiredComponents, archetypeComponents)
      })

      const results: Array<{ entityId: EntityId; components: { [K in T[number]]: ComponentOfName<K> } }> = []

      for (const [, entitySet] of matchingArchetypes) {
        for (const entityId of entitySet) {
          const componentValues: any = {}
          let hasAllComponents = true
          
          for (const componentName of componentNames) {
            const componentOpt = HashMap.get(state.components[componentName], entityId)
            if (Option.isSome(componentOpt)) {
              componentValues[componentName] = componentOpt.value
            } else {
              hasAllComponents = false
              break
            }
          }
          
          if (hasAllComponents) {
            results.push({ entityId, components: componentValues })
          }
        }
      }
      
      return results
    })

  const querySingle = <T extends ComponentName>(componentName: T, entityId: EntityId): Effect.Effect<ComponentOfName<T>, QuerySingleResultNotFoundError, never> =>
    Effect.gen(function* (_) {
      const componentOpt = yield* _(getComponent(entityId, componentName))
      
      if (Option.isNone(componentOpt)) {
        return yield* _(Effect.fail(new QuerySingleResultNotFoundError(entityId, componentName)))
      }
      
      return componentOpt.value
    })

  // Return the complete implementation
  return {
    updateComponent,
    querySoA,
    createEntity,
    destroyEntity,
    hasEntity,
    updateComponents,
    getComponent,
    addComponent,
    removeComponent,
    hasComponent,
    query,
    queryMultiple,
    querySingle,
  }
}

/**
 * World Repository Service Tag
 */
export const WorldRepositoryService = Context.GenericTag<IWorldRepository>('WorldRepositoryService')

/**
 * World Repository Layer
 */
export const WorldRepositoryLive = Layer.effect(
  WorldRepositoryService,
  Effect.gen(function* (_) {
    const initialState: WorldRepositoryState = {
      nextEntityId: 0,
      entities: HashMap.empty(),
      archetypes: HashMap.empty(),
      components: Object.fromEntries(Array.from(componentNamesSet).map((name) => [name, HashMap.empty()])) as ComponentStorage,
      version: 0,
    }

    const stateRef = yield* _(Ref.make(initialState))

    return createWorldRepository(stateRef)
  }),
)

/**
 * Utility functions for advanced repository operations
 */
export const WorldRepositoryUtils = {
  /**
   * Create a repository with pre-populated archetypes
   */
  createWithArchetypes: (archetypes: ReadonlyArray<Archetype>) =>
    Effect.gen(function* (_) {
      const repository = yield* _(WorldRepositoryService)

      for (const archetype of archetypes) {
        yield* _(repository.createEntity(archetype))
      }

      return repository
    }),

  /**
   * Export repository state for persistence
   */
  exportState: (repository: IWorldRepository) =>
    Effect.gen(function* (_) {
      // Note: This would require extending IWorldRepository with state access
      // For now, this is a placeholder implementation
      return {
        version: 0,
        entityCount: 0,
        archetypeCount: 0,
        componentCounts: {},
      }
    }),

  /**
   * Perform repository health check
   */
  healthCheck: (repository: IWorldRepository) =>
    Effect.gen(function* (_) {
      // Note: This would require extending IWorldRepository with state access
      // For now, this is a placeholder implementation
      return {
        isHealthy: true,
        entityCount: 0,
        archetypeEntityCount: 0,
        version: 0,
      }
    }),
}
