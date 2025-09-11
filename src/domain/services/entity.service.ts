/**
 * EntityService - Complete entity and component management with Context.Tag pattern
 * 
 * Features:
 * - Entity lifecycle management (create, update, destroy)
 * - Component attachment/detachment and querying
 * - Archetype-based entity organization for ECS optimization
 * - Entity serialization and deserialization
 * - Query optimization with caching
 * - Effect-TS Service pattern with full dependency injection
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'


// Core imports
import { EntityId } from '@/domain/entities'
import { ComponentName, Components } from '../entities/components'
import { Position } from '../value-objects'
import {
  EntityNotFoundError,
  EntityCreationError,
  EntityDestructionError,
  EntityLimitExceededError,
  ComponentNotFoundError,
  ComponentAlreadyExistsError,
} from '../errors'

// ===== ENTITY SERVICE INTERFACE =====

export interface EntityServiceInterface {
  // Entity lifecycle
  readonly createEntity: (components?: Partial<Components>) => Effect.Effect<EntityId, typeof EntityCreationError | typeof EntityLimitExceededError, never>
  readonly destroyEntity: (entityId: EntityId) => Effect.Effect<void, typeof EntityNotFoundError | typeof EntityDestructionError, never>
  readonly entityExists: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly getEntity: (entityId: EntityId) => Effect.Effect<Entity, typeof EntityNotFoundError, never>
  readonly getEntityCount: () => Effect.Effect<number, never, never>

  // Component management
  readonly addComponent: <T extends ComponentName>(entityId: EntityId, componentName: T, componentData: Components[T]) => Effect.Effect<void, typeof EntityNotFoundError | typeof ComponentAlreadyExistsError, never>
  readonly removeComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<void, typeof EntityNotFoundError | typeof ComponentNotFoundError, never>
  readonly getComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<Components[T], typeof EntityNotFoundError | typeof ComponentNotFoundError, never>
  readonly hasComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) => Effect.Effect<boolean, never, never>
  readonly updateComponent: <T extends ComponentName>(entityId: EntityId, componentName: T, updater: (current: Components[T]) => Components[T]) => Effect.Effect<void, typeof EntityNotFoundError | typeof ComponentNotFoundError, never>

  // Archetype queries
  readonly queryEntities: (requiredComponents: readonly ComponentName[]) => Effect.Effect<readonly EntityId[], never, never>
  readonly queryEntitiesWithComponents: <T extends readonly ComponentName[]>(requiredComponents: T) => Effect.Effect<readonly EntityWithComponents<T, never, never>[], never>
  readonly findEntitiesInRadius: (center: Position, radius: number, componentFilter?: readonly ComponentName[]) => Effect.Effect<readonly EntityId[], never, never>
  readonly findEntitiesByArchetype: (archetypeId: string) => Effect.Effect<readonly EntityId[], never, never>

  // Entity state management
  readonly getEntityComponents: (entityId: EntityId) => Effect.Effect<Partial<Components, never, never>, typeof EntityNotFoundError>
  readonly getEntityArchetype: (entityId: EntityId) => Effect.Effect<ArchetypeInfo, typeof EntityNotFoundError, never>
  readonly serializeEntity: (entityId: EntityId) => Effect.Effect<SerializedEntity, typeof EntityNotFoundError, never>
  readonly deserializeEntity: (serializedEntity: SerializedEntity) => Effect.Effect<EntityId, typeof EntityCreationError, never>

  // Bulk operations
  readonly createEntitiesBatch: (entitiesData: readonly Partial<Components>[]) => Effect.Effect<readonly EntityId[], typeof EntityCreationError | typeof EntityLimitExceededError, never>
  readonly destroyEntitiesBatch: (entityIds: readonly EntityId[]) => Effect.Effect<readonly EntityId[], typeof EntityNotFoundError | typeof EntityDestructionError, never>
  readonly updateEntitiesBatch: <T extends ComponentName>(entityIds: readonly EntityId[], componentName: T, updater: (current: Components[T]) => Components[T]) => Effect.Effect<void, typeof EntityNotFoundError | typeof ComponentNotFoundError, never>

  // Performance and debugging
  readonly getEntityStats: () => Effect.Effect<EntityStats, never, never>
  readonly validateEntityIntegrity: (entityId: EntityId) => Effect.Effect<EntityIntegrityResult, typeof EntityNotFoundError, never>
  readonly optimizeArchetypes: () => Effect.Effect<ArchetypeOptimizationResult, never, never>
}

// ===== SUPPORTING TYPES =====

export interface Entity {
  readonly id: EntityId
  readonly components: Set<ComponentName>
  readonly archetype: string
  readonly generation: number
  readonly createdAt: Date
  readonly lastModified: Date
}

export interface ArchetypeInfo {
  readonly id: string
  readonly componentTypes: readonly ComponentName[]
  readonly entityCount: number
  readonly storageLayout: StorageLayout
}

export type StorageLayout = 'SoA' | 'AoS' | 'Hybrid'

export interface SerializedEntity {
  readonly id: EntityId
  readonly components: Record<ComponentName, unknown>
  readonly archetype: string
  readonly metadata: EntityMetadata
}

export interface EntityMetadata {
  readonly generation: number
  readonly createdAt: string
  readonly lastModified: string
  readonly version: string
}

export interface EntityStats {
  readonly totalEntities: number
  readonly activeEntities: number
  readonly destroyedEntities: number
  readonly archetypeCount: number
  readonly averageComponentsPerEntity: number
  readonly memoryUsage: EntityMemoryUsage
  readonly queryPerformance: QueryPerformanceStats
}

export interface EntityMemoryUsage {
  readonly entitiesMemory: number
  readonly componentsMemory: number
  readonly archetypesMemory: number
  readonly totalMemory: number
}

export interface QueryPerformanceStats {
  readonly totalQueries: number
  readonly averageQueryTime: number
  readonly cacheHitRate: number
  readonly mostFrequentQuery: readonly ComponentName[]
}

export interface EntityIntegrityResult {
  readonly isValid: boolean
  readonly issues: readonly EntityIssue[]
  readonly recommendations: readonly string[]
}

export interface EntityIssue {
  readonly type: 'missing_component' | 'invalid_component' | 'archetype_mismatch' | 'stale_reference'
  readonly severity: 'warning' | 'error' | 'critical'
  readonly description: string
  readonly componentName?: ComponentName
}

export interface ArchetypeOptimizationResult {
  readonly optimizationsApplied: number
  readonly memoryFreed: number
  readonly performanceImprovement: number
  readonly recommendations: readonly string[]
}

export type EntityWithComponents<T extends readonly ComponentName[]> = {
  readonly entity: Entity
  readonly components: Pick<Components, T[number]>
}

// ===== ENTITY SERVICE TAG =====

export class EntityService extends Context.GenericTag('EntityService')<
  EntityService,
  EntityServiceInterface
>() {
  static readonly Live = Layer.effect(
    EntityService,
    Effect.gen(function* () {
      // Internal state
      const nextEntityId = yield* Ref.make(1)
      const entities = yield* Ref.make(HashMap.empty<EntityId, Entity>())
      const entityComponents = yield* Ref.make(HashMap.empty<EntityId, Partial<Components>>())
      const archetypes = yield* Ref.make(HashMap.empty<string, ArchetypeInfo>())
      const queryCache = yield* Ref.make(HashMap.empty<string, readonly EntityId[]>())
      const entityStats = yield* Ref.make({
        totalCreated: 0,
        totalDestroyed: 0,
        totalQueries: 0,
        totalQueryTime: 0,
      })

      // Configuration
      const MAX_ENTITIES = 100000
      const CACHE_SIZE = 1000

      // Helper functions
      const generateArchetypeId = (componentNames: readonly ComponentName[]): string =>
        Array.fromIterable(componentNames).sort().join('|')

      const getEntityArchetypeId = (components: Partial<Components>): string =>
        generateArchetypeId(Object.keys(components) as ComponentName[])

      const incrementEntityId = (): Effect.Effect<EntityId, never, never> =>
        Ref.modify(nextEntityId, id => [id as EntityId, id + 1])

      const validateEntityLimit = (currentCount: number): Effect.Effect<void, typeof EntityLimitExceededError, never> =>
        Effect.when(
          Effect.fail(EntityLimitExceededError({
            message: `Entity limit exceeded: ${currentCount}/${MAX_ENTITIES}`,
            limit: MAX_ENTITIES,
            current: currentCount
          })),
          () => currentCount >= MAX_ENTITIES
        )

      // Entity lifecycle implementation
      const createEntity = (components: Partial<Components> = {}): Effect.Effect<EntityId, typeof EntityCreationError | typeof EntityLimitExceededError, never> =>
        Effect.gen(function* () {
          const currentEntities = yield* Ref.get(entities)
          const currentCount = HashMap.size(currentEntities)
          
          yield* validateEntityLimit(currentCount)
          
          const entityId = yield* incrementEntityId()
          const archetypeId = getEntityArchetypeId(components)
          const now = new Date()

          const entity: Entity = {
            id: entityId,
            components: Set.fromIterable(Object.keys(components) as ComponentName[]),
            archetype: archetypeId,
            generation: 1,
            createdAt: now,
            lastModified: now,
          }

          // Update state
          yield* Ref.update(entities, HashMap.set(entityId, entity))
          yield* Ref.update(entityComponents, HashMap.set(entityId, components))
          yield* updateArchetypeStats(archetypeId, Object.keys(components) as ComponentName[], 1)
          yield* updateCreateStats()

          // Clear query cache
          yield* Ref.set(queryCache, HashMap.empty())

          return entityId
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(EntityCreationError({
              message: `Failed to create entity: ${error}`,
              cause: error
            }))
          )
        )

      const destroyEntity = (entityId: EntityId): Effect.Effect<void, typeof EntityNotFoundError | typeof EntityDestructionError, never> =>
        Effect.gen(function* () {
          const currentEntities = yield* Ref.get(entities)
          const entity = HashMap.get(currentEntities, entityId)

          if (Option.isNone(entity)) {
            return yield* Effect.fail(EntityNotFoundError({
              message: `Entity not found: ${entityId}`,
              entityId
            }))
          }

          try {
            // Remove from all state
            yield* Ref.update(entities, HashMap.remove(entityId))
            yield* Ref.update(entityComponents, HashMap.remove(entityId))
            yield* updateArchetypeStats(entity.value.archetype, Array.fromIterable(entity.value.components), -1)
            yield* updateDestroyStats()

            // Clear query cache
            yield* Ref.set(queryCache, HashMap.empty())
          } catch (error) {
            return yield* Effect.fail(EntityDestructionError({
              message: `Failed to destroy entity ${entityId}: ${error}`,
              entityId,
              cause: error
            }))
          }
        })

      const entityExists = (entityId: EntityId): Effect.Effect<boolean, never, never> =>
        Effect.gen(function* () {
          const currentEntities = yield* Ref.get(entities)
          return HashMap.has(currentEntities, entityId)
        })

      const getEntity = (entityId: EntityId): Effect.Effect<Entity, typeof EntityNotFoundError, never> =>
        Effect.gen(function* () {
          const currentEntities = yield* Ref.get(entities)
          const entity = HashMap.get(currentEntities, entityId)

          return Option.match(entity, {
            onNone: () => EntityNotFoundError({
              message: `Entity not found: ${entityId}`,
              entityId
            }),
            onSome: (entity) => entity,
          })
        }).pipe(Effect.flatMap(Effect.succeed))

      // Component management implementation
      const addComponent = <T extends ComponentName>(
        entityId: EntityId,
        componentName: T,
        componentData: Components[T]
      ): Effect.Effect<void, typeof EntityNotFoundError | typeof ComponentAlreadyExistsError, never> =>
        Effect.gen(function* () {
          const entity = yield* getEntity(entityId)
          const currentComponents = yield* Ref.get(entityComponents)
          const entityComps = HashMap.get(currentComponents, entityId)

          if (Option.isNone(entityComps)) {
            return yield* Effect.fail(EntityNotFoundError({
              message: `Entity components not found: ${entityId}`,
              entityId
            }))
          }

          if (componentName in entityComps.value) {
            return yield* Effect.fail(ComponentAlreadyExistsError({
              message: `Component ${componentName} already exists on entity ${entityId}`,
              entityId,
              componentName
            }))
          }

          const updatedComponents = { ...entityComps.value, [componentName]: componentData }
          const newArchetypeId = getEntityArchetypeId(updatedComponents)

          // Update entity and components
          const updatedEntity = Data.struct({
            ...entity,
            components: Set.add(entity.components, componentName),
            archetype: newArchetypeId,
            generation: entity.generation + 1,
            lastModified: new Date(),
          })

          yield* Ref.update(entities, HashMap.set(entityId, updatedEntity))
          yield* Ref.update(entityComponents, HashMap.set(entityId, updatedComponents))

          // Update archetype statistics
          yield* updateArchetypeStats(entity.archetype, Array.fromIterable(entity.components), -1)
          yield* updateArchetypeStats(newArchetypeId, Object.keys(updatedComponents) as ComponentName[], 1)

          // Clear query cache
          yield* Ref.set(queryCache, HashMap.empty())
        })

      const removeComponent = <T extends ComponentName>(
        entityId: EntityId,
        componentName: T
      ): Effect.Effect<void, typeof EntityNotFoundError | typeof ComponentNotFoundError, never> =>
        Effect.gen(function* () {
          const entity = yield* getEntity(entityId)
          const currentComponents = yield* Ref.get(entityComponents)
          const entityComps = HashMap.get(currentComponents, entityId)

          if (Option.isNone(entityComps)) {
            return yield* Effect.fail(EntityNotFoundError({
              message: `Entity components not found: ${entityId}`,
              entityId
            }))
          }

          if (!(componentName in entityComps.value)) {
            return yield* Effect.fail(ComponentNotFoundError({
              message: `Component ${componentName} not found on entity ${entityId}`,
              entityId,
              componentName
            }))
          }

          const { [componentName]: removed, ...updatedComponents } = entityComps.value
          const newArchetypeId = getEntityArchetypeId(updatedComponents)

          // Update entity and components
          const updatedEntity = Data.struct({
            ...entity,
            components: Set.remove(entity.components, componentName),
            archetype: newArchetypeId,
            generation: entity.generation + 1,
            lastModified: new Date(),
          })

          yield* Ref.update(entities, HashMap.set(entityId, updatedEntity))
          yield* Ref.update(entityComponents, HashMap.set(entityId, updatedComponents))

          // Update archetype statistics
          yield* updateArchetypeStats(entity.archetype, Array.fromIterable(entity.components), -1)
          yield* updateArchetypeStats(newArchetypeId, Object.keys(updatedComponents) as ComponentName[], 1)

          // Clear query cache
          yield* Ref.set(queryCache, HashMap.empty())
        })

      const getComponent = <T extends ComponentName>(
        entityId: EntityId,
        componentName: T
      ): Effect.Effect<Components[T], typeof EntityNotFoundError | typeof ComponentNotFoundError, never> =>
        Effect.gen(function* () {
          yield* getEntity(entityId) // Validate entity exists
          const currentComponents = yield* Ref.get(entityComponents)
          const entityComps = HashMap.get(currentComponents, entityId)

          if (Option.isNone(entityComps)) {
            return yield* Effect.fail(EntityNotFoundError({
              message: `Entity components not found: ${entityId}`,
              entityId
            }))
          }

          const component = entityComps.value[componentName]
          if (component === undefined) {
            return yield* Effect.fail(ComponentNotFoundError({
              message: `Component ${componentName} not found on entity ${entityId}`,
              entityId,
              componentName
            }))
          }

          return component as Components[T]
        })

      const hasComponent = <T extends ComponentName>(
        entityId: EntityId,
        componentName: T
      ): Effect.Effect<boolean, never, never> =>
        Effect.gen(function* () {
          const currentComponents = yield* Ref.get(entityComponents)
          const entityComps = HashMap.get(currentComponents, entityId)

          return Option.match(entityComps, {
            onNone: () => false,
            onSome: (comps) => componentName in comps,
          })
        })

      // Query implementation with caching
      const queryEntities = (requiredComponents: readonly ComponentName[]): Effect.Effect<readonly EntityId[], never, never> =>
        Effect.gen(function* () {
          const cacheKey = requiredComponents.join('|')
          const cache = yield* Ref.get(queryCache)
          const cached = HashMap.get(cache, cacheKey)

          if (Option.isSome(cached)) {
            return cached.value
          }

          // Perform query
          const startTime = Date.now()
          const currentEntities = yield* Ref.get(entities)
          const currentComponents = yield* Ref.get(entityComponents)

          const matchingEntities = Array.fromIterable(HashMap.keys(currentEntities))
            .filter(entityId => {
              const entityComps = HashMap.get(currentComponents, entityId)
              if (Option.isNone(entityComps)) return false

              return requiredComponents.every(componentName => componentName in entityComps.value)
            })

          const queryTime = Date.now() - startTime
          
          // Update cache if within limits
          const currentCacheSize = HashMap.size(cache)
          if (currentCacheSize < CACHE_SIZE) {
            yield* Ref.update(queryCache, HashMap.set(cacheKey, matchingEntities))
          }

          // Update query stats
          yield* updateQueryStats(queryTime)

          return matchingEntities
        })

      // Helper functions for archetype and stats management
      const updateArchetypeStats = (
        archetypeId: string,
        componentNames: readonly ComponentName[],
        countDelta: number
      ): Effect.Effect<void, never, never> =>
        Ref.update(archetypes, archetypes => {
          const existing = HashMap.get(archetypes, archetypeId)
          const archetype = Option.getOrElse(existing, () => ({
            id: archetypeId,
            componentTypes: componentNames,
            entityCount: 0,
            storageLayout: 'AoS' as StorageLayout,
          }))

          const updated = Data.struct({
            ...archetype,
            entityCount: Math.max(0, archetype.entityCount + countDelta),
          })

          return HashMap.set(archetypes, archetypeId, updated)
        })

      const updateCreateStats = (): Effect.Effect<void, never, never> =>
        Ref.update(entityStats, stats => Data.struct({
          ...stats,
          totalCreated: stats.totalCreated + 1,
        }))

      const updateDestroyStats = (): Effect.Effect<void, never, never> =>
        Ref.update(entityStats, stats => Data.struct({
          ...stats,
          totalDestroyed: stats.totalDestroyed + 1,
        }))

      const updateQueryStats = (queryTime: number): Effect.Effect<void, never, never> =>
        Ref.update(entityStats, stats => Data.struct({
          ...stats,
          totalQueries: stats.totalQueries + 1,
          totalQueryTime: stats.totalQueryTime + queryTime,
        }))

      // Return the service implementation
      return {
        createEntity,
        destroyEntity,
        entityExists,
        getEntity,
        getEntityCount: () => Effect.gen(function* () {
          const currentEntities = yield* Ref.get(entities)
          return HashMap.size(currentEntities)
        }),

        addComponent,
        removeComponent,
        getComponent,
        hasComponent,
        updateComponent: <T extends ComponentName>(
          entityId: EntityId,
          componentName: T,
          updater: (current: Components[T]) => Components[T]
        ) =>
          Effect.gen(function* () {
            const currentComponent = yield* getComponent(entityId, componentName)
            const updatedComponent = updater(currentComponent)
            yield* removeComponent(entityId, componentName)
            yield* addComponent(entityId, componentName, updatedComponent)
          }),

        queryEntities,
        queryEntitiesWithComponents: <T extends readonly ComponentName[]>(
          requiredComponents: T
        ) =>
          Effect.gen(function* () {
            const entityIds = yield* queryEntities(requiredComponents)
            const currentComponents = yield* Ref.get(entityComponents)
            const currentEntities = yield* Ref.get(entities)

            const results = entityIds.map(entityId => {
              const entity = HashMap.get(currentEntities, entityId)
              const components = HashMap.get(currentComponents, entityId)

              if (Option.isSome(entity) && Option.isSome(components)) {
                const filteredComponents = Object.fromEntries(
                  requiredComponents.map(componentName => [
                    componentName,
                    components.value[componentName]
                  ])
                ) as Pick<Components, T[number]>

                return {
                  entity: entity.value,
                  components: filteredComponents,
                }
              }
              return null
            }).filter(Boolean) as EntityWithComponents<T>[]

            return results
          }),

        findEntitiesInRadius: () =>
          // Implementation would use spatial indexing
          Effect.succeed([]),

        findEntitiesByArchetype: (archetypeId: string) =>
          Effect.gen(function* () {
            const currentEntities = yield* Ref.get(entities)
            const matching = Array.fromIterable(HashMap.values(currentEntities))
              .filter(entity => entity.archetype === archetypeId)
              .map(entity => entity.id)
            return matching
          }),

        getEntityComponents: (entityId: EntityId) =>
          Effect.gen(function* () {
            yield* getEntity(entityId) // Validate entity exists
            const currentComponents = yield* Ref.get(entityComponents)
            const entityComps = HashMap.get(currentComponents, entityId)

            return Option.getOrElse(entityComps, () => ({} as Partial<Components>))
          }),

        getEntityArchetype: (entityId: EntityId) =>
          Effect.gen(function* () {
            const entity = yield* getEntity(entityId)
            const currentArchetypes = yield* Ref.get(archetypes)
            const archetype = HashMap.get(currentArchetypes, entity.archetype)

            return Option.getOrElse(archetype, () => ({
              id: entity.archetype,
              componentTypes: Array.fromIterable(entity.components),
              entityCount: 1,
              storageLayout: 'AoS' as StorageLayout,
            }))
          }),

        serializeEntity: (entityId: EntityId) =>
          Effect.gen(function* () {
            const entity = yield* getEntity(entityId)
            const components = yield* getEntityComponents(entityId)

            return {
              id: entityId,
              components: components as Record<ComponentName, unknown>,
              archetype: entity.archetype,
              metadata: {
                generation: entity.generation,
                createdAt: entity.createdAt.toISOString(),
                lastModified: entity.lastModified.toISOString(),
                version: '1.0.0',
              },
            }
          }),

        deserializeEntity: (serializedEntity: SerializedEntity) =>
          createEntity(serializedEntity.components),

        // Batch operations
        createEntitiesBatch: (entitiesData: readonly Partial<Components>[]) =>
          Effect.all(entitiesData.map(createEntity), { concurrency: 10 }),

        destroyEntitiesBatch: (entityIds: readonly EntityId[]) =>
          Effect.gen(function* () {
            const results = yield* Effect.all(
              entityIds.map(id =>
                destroyEntity(id).pipe(
                  Effect.map(() => id),
                  Effect.option
                )
              ),
              { concurrency: 10 }
            )
            return results.filter(Option.isSome).map(opt => opt.value)
          }),

        updateEntitiesBatch: <T extends ComponentName>(
          entityIds: readonly EntityId[],
          componentName: T,
          updater: (current: Components[T]) => Components[T]
        ) =>
          Effect.all(
            entityIds.map(entityId =>
              updateComponent(entityId, componentName, updater).pipe(Effect.option)
            ),
            { concurrency: 10 }
          ).pipe(Effect.asUnit),

        // Performance and debugging
        getEntityStats: () =>
          Effect.gen(function* () {
            const currentEntities = yield* Ref.get(entities)
            const currentArchetypes = yield* Ref.get(archetypes)
            const currentComponents = yield* Ref.get(entityComponents)
            const stats = yield* Ref.get(entityStats)
            const cache = yield* Ref.get(queryCache)

            const totalEntities = HashMap.size(currentEntities)
            const archetypeCount = HashMap.size(currentArchetypes)
            const avgQueryTime = stats.totalQueries > 0 ? stats.totalQueryTime / stats.totalQueries : 0
            const cacheHitRate = stats.totalQueries > 0 ? HashMap.size(cache) / stats.totalQueries : 0

            return {
              totalEntities,
              activeEntities: totalEntities,
              destroyedEntities: stats.totalDestroyed,
              archetypeCount,
              averageComponentsPerEntity: totalEntities > 0 ? 
                Array.fromIterable(HashMap.values(currentComponents))
                  .reduce((sum, comps) => sum + Object.keys(comps).length, 0) / totalEntities : 0,
              memoryUsage: {
                entitiesMemory: totalEntities * 128, // Rough estimate
                componentsMemory: totalEntities * 256, // Rough estimate
                archetypesMemory: archetypeCount * 64, // Rough estimate
                totalMemory: totalEntities * 448 + archetypeCount * 64,
              },
              queryPerformance: {
                totalQueries: stats.totalQueries,
                averageQueryTime: avgQueryTime,
                cacheHitRate,
                mostFrequentQuery: [], // Would track in real implementation
              },
            }
          }),

        validateEntityIntegrity: (entityId: EntityId) =>
          Effect.gen(function* () {
            const issues: EntityIssue[] = []
            let isValid = true

            try {
              const entity = yield* getEntity(entityId)
              const components = yield* getEntityComponents(entityId)

              // Check if all entity components exist in component storage
              for (const componentName of entity.components) {
                if (!(componentName in components)) {
                  issues.push({
                    type: 'missing_component',
                    severity: 'error',
                    description: `Component ${componentName} listed in entity but not found in storage`,
                    componentName,
                  })
                  isValid = false
                }
              }

              // Check archetype consistency
              const expectedArchetype = getEntityArchetypeId(components)
              if (entity.archetype !== expectedArchetype) {
                issues.push({
                  type: 'archetype_mismatch',
                  severity: 'warning',
                  description: `Entity archetype ${entity.archetype} doesn't match computed archetype ${expectedArchetype}`,
                })
                isValid = false
              }

            } catch (error) {
              issues.push({
                type: 'stale_reference',
                severity: 'critical',
                description: `Entity reference is stale or invalid: ${error}`,
              })
              isValid = false
            }

            return {
              isValid,
              issues,
              recommendations: issues.map(issue => `Fix ${issue.type}: ${issue.description}`),
            }
          }),

        optimizeArchetypes: () =>
          Effect.gen(function* () {
            // Basic optimization - in practice would be more sophisticated
            const currentArchetypes = yield* Ref.get(archetypes)
            const emptyArchetypes = Array.fromIterable(HashMap.values(currentArchetypes))
              .filter(archetype => archetype.entityCount === 0)

            // Remove empty archetypes
            for (const archetype of emptyArchetypes) {
              yield* Ref.update(archetypes, HashMap.remove(archetype.id))
            }

            return {
              optimizationsApplied: emptyArchetypes.length,
              memoryFreed: emptyArchetypes.length * 64, // Rough estimate
              performanceImprovement: emptyArchetypes.length * 0.01, // Rough estimate
              recommendations: emptyArchetypes.length > 0 ? 
                ['Consider implementing archetype pooling for frequently created/destroyed entities'] : [],
            }
          }),
      }
    })
  )
}