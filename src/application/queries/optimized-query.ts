/**
 * Optimized Query System with Caching and Index Support
 * Provides high-performance queries with automatic optimization and caching
 */

import { Context, Effect, Layer, Ref } from 'effect'
import { ComponentName, ComponentOfName } from '@domain/entities/components'
import { EntityId } from '@domain/entities'
import { QueryEntity } from '@application/queries/builder'
import { QueryConfig, QueryMetrics, startQueryContext, finalizeQueryContext } from '@application/queries/builder'
import { QueryCache, globalQueryCacheLayer, CacheKeyGenerator, CachedQueryResult, CachedQueryMetrics } from '@application/queries/cache'
import { ArchetypeQuery } from '@application/queries/archetype-query'

/**
 * Query execution plan for optimization
 */
interface QueryPlan {
  useArchetypes: boolean
  useCache: boolean
  cacheKey: string | undefined
  estimatedCost: number
  indexStrategy: 'none' | 'component' | 'spatial' | 'hybrid'
}

/**
 * Component index data structure
 */
interface ComponentIndexData {
  readonly componentToEntities: Map<ComponentName, Set<QueryEntity>>
  readonly entityToComponents: Map<QueryEntity, Set<ComponentName>>
}

/**
 * Component index service interface
 */
interface ComponentIndexService {
  readonly addEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly removeEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly getEntitiesWithComponent: (component: ComponentName) => Effect.Effect<ReadonlyArray<QueryEntity>>
  readonly getEntitiesWithAllComponents: (components: ReadonlyArray<ComponentName>) => Effect.Effect<ReadonlyArray<QueryEntity>>
  readonly getStats: Effect.Effect<{
    totalComponents: number
    totalEntities: number
    componentDistribution: Array<{ component: ComponentName; entityCount: number }>
  }>
  readonly clear: Effect.Effect<void>
}

/**
 * Component index context tag
 */
const ComponentIndex = Context.GenericTag<ComponentIndexService>('ComponentIndex')

/**
 * Create component index implementation
 */
const componentIndexLive = Layer.effect(
  ComponentIndex,
  Effect.gen(function* () {
    const index = yield* Ref.make<ComponentIndexData>({
      componentToEntities: new Map(),
      entityToComponents: new Map(),
    })

    return ComponentIndex.of({
      addEntity: (entity: QueryEntity) =>
        Effect.gen(function* () {
          const components = Object.keys(entity.components) as ComponentName[]
          yield* Ref.update(index, (data) => {
            const newEntityToComponents = new Map(data.entityToComponents)
            const newComponentToEntities = new Map(data.componentToEntities)

            newEntityToComponents.set(entity, new Set(components))

            for (const component of components) {
              if (!newComponentToEntities.has(component)) {
                newComponentToEntities.set(component, new Set())
              }
              newComponentToEntities.get(component)!.add(entity)
            }

            return {
              componentToEntities: newComponentToEntities,
              entityToComponents: newEntityToComponents,
            }
          })
        }),

      removeEntity: (entity: QueryEntity) =>
        Effect.gen(function* () {
          yield* Ref.update(index, (data) => {
            const components = data.entityToComponents.get(entity)
            if (!components) return data

            const newEntityToComponents = new Map(data.entityToComponents)
            const newComponentToEntities = new Map(data.componentToEntities)

            for (const component of components) {
              const entitySet = newComponentToEntities.get(component)
              if (entitySet) {
                entitySet.delete(entity)
                if (entitySet.size === 0) {
                  newComponentToEntities.delete(component)
                }
              }
            }

            newEntityToComponents.delete(entity)

            return {
              componentToEntities: newComponentToEntities,
              entityToComponents: newEntityToComponents,
            }
          })
        }),

      getEntitiesWithComponent: (component: ComponentName) =>
        Effect.gen(function* () {
          const data = yield* Ref.get(index)
          const entitySet = data.componentToEntities.get(component)
          return entitySet ? Array.from(entitySet) : []
        }),

      getEntitiesWithAllComponents: (components: ReadonlyArray<ComponentName>) =>
        Effect.gen(function* () {
          if (components.length === 0) return []

          const data = yield* Ref.get(index)
          
          // Sort components by entity count (rarest first)
          const sortedComponents = [...components].sort((a, b) => {
            const aSize = data.componentToEntities.get(a)?.size || 0
            const bSize = data.componentToEntities.get(b)?.size || 0
            return aSize - bSize
          })

          let candidateEntities: Set<QueryEntity> | undefined

          for (const component of sortedComponents) {
            const entitiesWithComponent = data.componentToEntities.get(component)

            if (!entitiesWithComponent || entitiesWithComponent.size === 0) {
              return [] // Early exit if any component has no entities
            }

            if (!candidateEntities) {
              candidateEntities = new Set(entitiesWithComponent)
            } else {
              // Intersect with current candidates
              candidateEntities = new Set([...candidateEntities].filter((entity) => entitiesWithComponent.has(entity)))
            }

            // Early exit if intersection becomes empty
            if (candidateEntities.size === 0) {
              return []
            }
          }

          return candidateEntities ? Array.from(candidateEntities) : []
        }),

      getStats: Effect.gen(function* () {
        const data = yield* Ref.get(index)
        return {
          totalComponents: data.componentToEntities.size,
          totalEntities: data.entityToComponents.size,
          componentDistribution: Array.from(data.componentToEntities.entries())
            .map(([component, entities]) => ({
              component,
              entityCount: entities.size,
            }))
            .sort((a, b) => b.entityCount - a.entityCount),
        }
      }),

      clear: Effect.gen(function* () {
        yield* Ref.set(index, {
          componentToEntities: new Map(),
          entityToComponents: new Map(),
        })
      }),
    })
  })
)

/**
 * Optimized query service interface
 */
export interface OptimizedQueryService<T extends ReadonlyArray<ComponentName>> {
  readonly execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<CachedQueryResult<ReadonlyArray<QueryEntity>>>
  readonly name: string
  readonly components: T
  readonly forbiddenComponents: ReadonlyArray<ComponentName>
  readonly clearExecutionPlan: Effect.Effect<void>
}

/**
 * Optimized query context tag factory
 */
export const OptimizedQuery = <T extends ReadonlyArray<ComponentName>>(name: string) =>
  Context.GenericTag<OptimizedQueryService<T>>(`OptimizedQuery(${name})`)

/**
 * Create an optimized query implementation
 */
export const createOptimizedQuery = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>
): Effect.Effect<OptimizedQueryService<T>, never, typeof ComponentIndex | typeof QueryCache> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndex
    const queryCache = yield* QueryCache
    const archetypeQuery = new ArchetypeQuery(config)
    const cachedPlan = yield* Ref.make<QueryPlan | undefined>(undefined)

    const createExecutionPlan = (entities?: ReadonlyArray<EntityId>): Effect.Effect<QueryPlan> =>
      Effect.gen(function* () {
        const currentPlan = yield* Ref.get(cachedPlan)
        if (currentPlan) {
          return currentPlan
        }

        const plan: QueryPlan = {
          useArchetypes: true,
          useCache: true,
          cacheKey: undefined,
          estimatedCost: 0,
          indexStrategy: 'hybrid',
        }

        // Determine caching strategy
        if (config.predicate) {
          plan.cacheKey = CacheKeyGenerator.forComponents(
            config.withComponents,
            config.withoutComponents,
            CacheKeyGenerator.hashPredicate(config.predicate)
          )
        } else {
          plan.cacheKey = CacheKeyGenerator.forComponents(config.withComponents, config.withoutComponents)
        }

        // Estimate query cost
        const componentCount = config.withComponents.length
        const hasComplex = Boolean(config.predicate)
        const hasForbidden = (config.withoutComponents?.length || 0) > 0

        plan.estimatedCost = componentCount * 10 + (hasComplex ? 100 : 0) + (hasForbidden ? 20 : 0)

        // Choose indexing strategy based on characteristics
        if (entities) {
          plan.indexStrategy = 'none' // Use direct archetype query for provided entities
        } else if (componentCount <= 2 && !hasForbidden) {
          plan.indexStrategy = 'component' // Use component index for simple queries
        } else {
          plan.indexStrategy = 'hybrid' // Use hybrid approach
        }

        yield* Ref.set(cachedPlan, plan)
        return plan
      })

    const executeWithComponentIndex = (context: { metrics: QueryMetrics }): Effect.Effect<QueryEntity[]> =>
      Effect.gen(function* () {
        // Get entities with all required components using index
        let candidates = yield* componentIndex.getEntitiesWithAllComponents(config.withComponents)

        context.metrics.entitiesScanned += candidates.length

        // Filter out entities with forbidden components
        if (config.withoutComponents && config.withoutComponents.length > 0) {
          candidates = candidates.filter((entity) => {
            const withoutComponents = config.withoutComponents
            if (!withoutComponents) return true
            return !withoutComponents.some((comp) => entity.components[comp] !== undefined)
          })
        }

        context.metrics.entitiesMatched += candidates.length
        return [...candidates]
      })

    const executeHybridStrategy = (
      entities: ReadonlyArray<QueryEntity> | undefined,
      context: { metrics: QueryMetrics }
    ): Effect.Effect<QueryEntity[]> =>
      Effect.gen(function* () {
        // Use component index for initial filtering if no entity list provided
        if (!entities) {
          return yield* executeWithComponentIndex(context)
        }

        // Use archetype query for provided entity list
        const archetypeResult = archetypeQuery.execute(entities)
        context.metrics.entitiesScanned += archetypeResult.metrics.entitiesScanned
        context.metrics.entitiesMatched += archetypeResult.metrics.entitiesMatched

        return [...archetypeResult.entities]
      })

    const applyPredicateAsync = async (
      entities: QueryEntity[],
      _context: { metrics: QueryMetrics }
    ): Promise<QueryEntity[]> => {
      if (!config.predicate) return entities

      const result: QueryEntity[] = []
      const batchSize = 100 // Process in batches to avoid blocking

      for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize)

        const batchResults = await Promise.all(
          batch.map(async (entity) => {
            const entityProxy = {
              get: <K extends ComponentName>(componentName: K) => {
                return entity.components[componentName] as ComponentOfName<K>
              },
              has: <K extends ComponentName>(componentName: K) => {
                return entity.components[componentName] !== undefined
              },
              id: entity.id,
            }

            try {
              const typedProxy = entityProxy as unknown as Parameters<NonNullable<typeof config.predicate>>[0]
              return await Promise.resolve(config.predicate!(typedProxy))
            } catch (error) {
              console.warn(`Predicate error for entity ${entity.id}:`, error)
              return false
            }
          })
        )

        // Add entities that passed the predicate
        for (let j = 0; j < batch.length; j++) {
          const entity = batch[j]
          if (batchResults[j] && entity !== undefined) {
            result.push(entity)
          }
        }

        // Yield control to event loop between batches
        if (i + batchSize < entities.length) {
          await new Promise((resolve) => setImmediate(resolve))
        }
      }

      return result
    }

    return {
      execute: (entities?: ReadonlyArray<QueryEntity>) =>
        Effect.gen(function* () {
          const plan = yield* createExecutionPlan(entities?.map((entity) => entity.id))
          const context = startQueryContext()

          // Try cache first if enabled
          if (plan.useCache && plan.cacheKey) {
            const cachedResult = yield* queryCache.get<ReadonlyArray<EntityId>>(plan.cacheKey)
            if (cachedResult !== undefined) {
              const metrics: CachedQueryMetrics = {
                ...finalizeQueryContext(context),
                cacheKey: plan.cacheKey,
                cacheHit: true,
                cacheInvalidations: 0,
              }

              context.metrics.cacheHits++

              // Convert EntityIds back to QueryEntities if needed
              const entitiesData =
                Array.isArray(cachedResult) && cachedResult.length > 0 && typeof cachedResult[0] === 'object' && 'id' in cachedResult[0]
                  ? (cachedResult as ReadonlyArray<QueryEntity>)
                  : [] // Handle case where cached data is EntityId[]

              return {
                data: entitiesData,
                metrics,
                fromCache: true,
                cacheKey: plan.cacheKey,
              }
            }

            context.metrics.cacheMisses++
          }

          // Execute query based on plan
          let resultEntities: QueryEntity[]

          switch (plan.indexStrategy) {
            case 'component':
              resultEntities = yield* executeWithComponentIndex(context)
              break
            case 'hybrid':
              resultEntities = yield* executeHybridStrategy(entities, context)
              break
            default:
              const archetypeResult = archetypeQuery.execute(entities)
              resultEntities = [...archetypeResult.entities]
              // Merge metrics
              context.metrics.entitiesScanned += archetypeResult.metrics.entitiesScanned
              context.metrics.entitiesMatched += archetypeResult.metrics.entitiesMatched
              break
          }

          // Apply predicate filtering if present
          if (config.predicate) {
            resultEntities = yield* Effect.promise(() => applyPredicateAsync(resultEntities, context))
          }

          // Cache result if caching is enabled
          if (plan.useCache && plan.cacheKey) {
            yield* queryCache.set(plan.cacheKey, resultEntities, [...config.withComponents] as ComponentName[])
          }

          const metrics: CachedQueryMetrics = {
            ...finalizeQueryContext(context),
            ...(plan.cacheKey && { cacheKey: plan.cacheKey }),
            cacheHit: false,
            cacheInvalidations: 0,
          }

          return {
            data: resultEntities,
            metrics,
            fromCache: false,
            ...(plan.cacheKey && { cacheKey: plan.cacheKey }),
          }
        }),

      name: config.name,
      components: config.withComponents,
      forbiddenComponents: config.withoutComponents || [],
      clearExecutionPlan: Ref.set(cachedPlan, undefined),
    }
  })

/**
 * Add entity to optimization indices
 */
export const addEntityToOptimizationIndices = (entity: QueryEntity): Effect.Effect<void, never, typeof ComponentIndex> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndex
    yield* componentIndex.addEntity(entity)
    ArchetypeQuery.addEntity(entity)
  })

/**
 * Remove entity from optimization indices
 */
export const removeEntityFromOptimizationIndices = (entity: QueryEntity): Effect.Effect<void, never, typeof ComponentIndex> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndex
    yield* componentIndex.removeEntity(entity)
    ArchetypeQuery.removeEntity(entity)
  })

/**
 * Update entity in optimization indices
 */
export const updateEntityInOptimizationIndices = (entity: QueryEntity): Effect.Effect<void, never, typeof ComponentIndex> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndex
    yield* componentIndex.removeEntity(entity)
    yield* componentIndex.addEntity(entity)
    ArchetypeQuery.removeEntity(entity)
    ArchetypeQuery.addEntity(entity)
  })

/**
 * Get comprehensive query optimization statistics
 */
export const getOptimizationStats = (): Effect.Effect<{
  componentIndex: {
    totalComponents: number
    totalEntities: number
    componentDistribution: Array<{ component: ComponentName; entityCount: number }>
  }
  archetypes: any
  cache: any
}, never, typeof ComponentIndex | typeof QueryCache> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndex
    const queryCache = yield* QueryCache
    
    return {
      componentIndex: yield* componentIndex.getStats,
      archetypes: ArchetypeQuery.getArchetypeStats(),
      cache: yield* queryCache.getStats,
    }
  })

/**
 * Reset all optimization indices
 */
export const resetOptimizationIndices = (): Effect.Effect<void, never, typeof ComponentIndex | typeof QueryCache> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndex
    const queryCache = yield* QueryCache
    
    yield* componentIndex.clear
    ArchetypeQuery.reset()
    yield* queryCache.clear
  })

/**
 * Invalidate cache entries for specific components
 */
export const invalidateOptimizationCache = (modifiedComponents: ComponentName[]): Effect.Effect<number, never, typeof QueryCache> =>
  Effect.gen(function* () {
    const queryCache = yield* QueryCache
    return yield* queryCache.invalidate(modifiedComponents)
  })

/**
 * Optimized query layer that provides component index and query cache
 */
export const optimizedQueryLayer = Layer.mergeAll(componentIndexLive, globalQueryCacheLayer)

