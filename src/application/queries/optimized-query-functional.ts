/**
 * Optimized Query System with Caching and Index Support (Functional Implementation)
 * Provides high-performance queries with automatic optimization and caching
 *
 * FUNCTIONAL IMPLEMENTATION:
 * - Replaces class-based OptimizedQueryService with pure functions
 * - Uses Effect-TS Context.GenericTag and Layer pattern
 * - All async operations use Effect instead of Promise
 * - Uses Ref.Ref for state management
 * - Eliminates mutable class state
 */

import { Context, Effect, Layer, Ref } from 'effect'
import { ComponentName, ComponentOfName } from '@domain/entities/components'
import { EntityId } from '@domain/entities'
import { QueryEntity } from '@application/queries/builder'
import { QueryConfig, QueryMetrics, startQueryContext, finalizeQueryContext } from '@application/queries/builder'
import { QueryCacheService, CacheKeyGenerator, CachedQueryResult, CachedQueryMetrics } from '@application/queries/cache'
import { createArchetypeQuery, ArchetypeSystemUtils } from '@application/queries/archetype-query'

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
 * Component index service interface (functional)
 */
interface ComponentIndexServiceFunctional {
  readonly addEntity: (entity: QueryEntity) => Effect.Effect<void, never, never>
  readonly removeEntity: (entity: QueryEntity) => Effect.Effect<void, never, never>
  readonly getEntitiesWithComponent: (component: ComponentName) => Effect.Effect<ReadonlyArray<QueryEntity>, never, never>
  readonly getEntitiesWithAllComponents: (components: ReadonlyArray<ComponentName>) => Effect.Effect<ReadonlyArray<QueryEntity>, never, never>
  readonly getStats: () => Effect.Effect<
    {
      totalComponents: number
      totalEntities: number
      componentDistribution: Array<{ component: ComponentName; entityCount: number }>
    },
    never,
    never
  >
  readonly clear: () => Effect.Effect<void, never, never>
}

/**
 * Component index context tag (functional)
 */
export const ComponentIndexFunctional = Context.GenericTag<ComponentIndexServiceFunctional>('ComponentIndexFunctional')

/**
 * Functional component index operations
 */
export const addEntityToIndexEffect = (stateRef: Ref.Ref<ComponentIndexData>, entity: QueryEntity): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const components = Object.keys(entity.components) as ComponentName[]
    yield* Ref.update(stateRef, (data) => {
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
  })

export const removeEntityFromIndexEffect = (stateRef: Ref.Ref<ComponentIndexData>, entity: QueryEntity): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    yield* Ref.update(stateRef, (data) => {
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
  })

export const getEntitiesWithComponentEffect = (stateRef: Ref.Ref<ComponentIndexData>, component: ComponentName): Effect.Effect<ReadonlyArray<QueryEntity>, never, never> =>
  Effect.gen(function* () {
    const data = yield* Ref.get(stateRef)
    const entitySet = data.componentToEntities.get(component)
    return entitySet ? Array.from(entitySet) : []
  })

export const getEntitiesWithAllComponentsEffect = (
  stateRef: Ref.Ref<ComponentIndexData>,
  components: ReadonlyArray<ComponentName>,
): Effect.Effect<ReadonlyArray<QueryEntity>, never, never> =>
  Effect.gen(function* () {
    if (components.length === 0) return []

    const data = yield* Ref.get(stateRef)

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
  })

export const getIndexStatsEffect = (
  stateRef: Ref.Ref<ComponentIndexData>,
): Effect.Effect<
  {
    totalComponents: number
    totalEntities: number
    componentDistribution: Array<{ component: ComponentName; entityCount: number }>
  },
  never,
  never
> =>
  Effect.gen(function* () {
    const data = yield* Ref.get(stateRef)
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
  })

export const clearIndexEffect = (stateRef: Ref.Ref<ComponentIndexData>): Effect.Effect<void, never, never> =>
  Ref.set(stateRef, {
    componentToEntities: new Map(),
    entityToComponents: new Map(),
  })

/**
 * Create functional component index service
 */
export const makeComponentIndexService = (stateRef: Ref.Ref<ComponentIndexData>): ComponentIndexServiceFunctional => ({
  addEntity: (entity: QueryEntity) => addEntityToIndexEffect(stateRef, entity),
  removeEntity: (entity: QueryEntity) => removeEntityFromIndexEffect(stateRef, entity),
  getEntitiesWithComponent: (component: ComponentName) => getEntitiesWithComponentEffect(stateRef, component),
  getEntitiesWithAllComponents: (components: ReadonlyArray<ComponentName>) => getEntitiesWithAllComponentsEffect(stateRef, components),
  getStats: () => getIndexStatsEffect(stateRef),
  clear: () => clearIndexEffect(stateRef),
})

/**
 * Component index layer (functional)
 */
export const componentIndexFunctionalLive = Layer.effect(
  ComponentIndexFunctional,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<ComponentIndexData>({
      componentToEntities: new Map(),
      entityToComponents: new Map(),
    })

    return makeComponentIndexService(stateRef)
  }),
)

/**
 * Optimized query service interface (functional)
 */
export interface OptimizedQueryServiceFunctional<T extends ReadonlyArray<ComponentName>> {
  readonly execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<CachedQueryResult<ReadonlyArray<QueryEntity>>, never, never>
  readonly name: string
  readonly components: T
  readonly forbiddenComponents: ReadonlyArray<ComponentName>
  readonly clearExecutionPlan: () => Effect.Effect<void, never, never>
}

/**
 * Optimized query state
 */
interface OptimizedQueryState {
  cachedPlan?: QueryPlan
}

/**
 * Create execution plan effect
 */
export const createExecutionPlanEffect = <T extends ReadonlyArray<ComponentName>>(
  stateRef: Ref.Ref<OptimizedQueryState>,
  config: QueryConfig<T>,
  entities?: ReadonlyArray<EntityId>,
): Effect.Effect<QueryPlan, never, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    if (state.cachedPlan) {
      return state.cachedPlan
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
      plan.cacheKey = CacheKeyGenerator.forComponents(config.withComponents, config.withoutComponents, CacheKeyGenerator.hashPredicate(config.predicate))
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

    yield* Ref.update(stateRef, (s) => ({ ...s, cachedPlan: plan }))
    return plan
  })

/**
 * Execute query with component index effect
 */
export const executeWithComponentIndexEffect = <T extends ReadonlyArray<ComponentName>>(
  componentIndex: ComponentIndexServiceFunctional,
  config: QueryConfig<T>,
  context: { metrics: QueryMetrics },
): Effect.Effect<QueryEntity[], never, never> =>
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

/**
 * Execute hybrid strategy effect
 */
export const executeHybridStrategyEffect = <T extends ReadonlyArray<ComponentName>>(
  componentIndex: ComponentIndexServiceFunctional,
  config: QueryConfig<T>,
  entities: ReadonlyArray<QueryEntity> | undefined,
  context: { metrics: QueryMetrics },
): Effect.Effect<QueryEntity[], never, never> =>
  Effect.gen(function* () {
    // Use component index for initial filtering if no entity list provided
    if (!entities) {
      return yield* executeWithComponentIndexEffect(componentIndex, config, context)
    }

    // Use archetype query for provided entity list
    const archetypeQuery = yield* createArchetypeQuery(config)
    const archetypeResult = yield* archetypeQuery.execute(entities)
    context.metrics.entitiesScanned += archetypeResult.metrics.entitiesScanned
    context.metrics.entitiesMatched += archetypeResult.metrics.entitiesMatched

    return [...archetypeResult.entities]
  })

/**
 * Apply predicate effect
 */
export const applyPredicateEffect = <T extends ReadonlyArray<ComponentName>>(
  entities: QueryEntity[],
  config: QueryConfig<T>,
  _context: { metrics: QueryMetrics },
): Effect.Effect<QueryEntity[], never, never> =>
  Effect.gen(function* () {
    if (!config.predicate) return entities

    const result: QueryEntity[] = []
    const batchSize = 100 // Process in batches to avoid blocking

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize)

      const batchResults = yield* Effect.forEach(
        batch,
        (entity) =>
          Effect.gen(function* () {
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
              return yield* Effect.promise(async () => config.predicate!(typedProxy))
            } catch (error) {
              yield* Effect.logWarning(`Predicate error for entity ${entity.id}: ${error}`)
              return false
            }
          }),
        { concurrency: 'unbounded' },
      )

      // Add entities that passed the predicate
      for (let j = 0; j < batch.length; j++) {
        const entity = batch[j]
        if (batchResults[j] && entity !== undefined) {
          result.push(entity)
        }
      }
    }

    return result
  })

/**
 * Create optimized query service implementation (functional)
 */
export const makeOptimizedQueryService = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
  componentIndex: ComponentIndexServiceFunctional,
  queryCache: QueryCacheService,
  stateRef: Ref.Ref<OptimizedQueryState>,
): OptimizedQueryServiceFunctional<T> => ({
  execute: (entities?: ReadonlyArray<QueryEntity>) =>
    Effect.gen(function* () {
      const plan = yield* createExecutionPlanEffect(
        stateRef,
        config,
        entities?.map((entity) => entity.id),
      )
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
          resultEntities = yield* executeWithComponentIndexEffect(componentIndex, config, context)
          break
        case 'hybrid':
          resultEntities = yield* executeHybridStrategyEffect(componentIndex, config, entities, context)
          break
        default:
          const archetypeQuery = yield* createArchetypeQuery(config)
          const archetypeResult = yield* archetypeQuery.execute(entities)
          resultEntities = [...archetypeResult.entities]
          // Merge metrics
          context.metrics.entitiesScanned += archetypeResult.metrics.entitiesScanned
          context.metrics.entitiesMatched += archetypeResult.metrics.entitiesMatched
          break
      }

      // Apply predicate filtering if present
      if (config.predicate) {
        resultEntities = yield* applyPredicateEffect(resultEntities, config, context)
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
  clearExecutionPlan: () => Ref.update(stateRef, (s) => ({ ...s, cachedPlan: undefined })),
})

/**
 * Create an optimized query implementation (functional)
 */
export const createOptimizedQueryFunctional = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
): Effect.Effect<OptimizedQueryServiceFunctional<T>, never, ComponentIndexServiceFunctional | QueryCacheService> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexFunctional
    const queryCache = yield* Context.GenericTag<QueryCacheService>('QueryCache')
    const stateRef = yield* Ref.make<OptimizedQueryState>({})

    return makeOptimizedQueryService(config, componentIndex, queryCache, stateRef)
  })

/**
 * Add entity to optimization indices (functional)
 */
export const addEntityToOptimizationIndicesFunctional = (entity: QueryEntity): Effect.Effect<void, never, ComponentIndexServiceFunctional> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexFunctional
    yield* componentIndex.addEntity(entity)
    yield* ArchetypeSystemUtils.addEntity(entity)
  })

/**
 * Remove entity from optimization indices (functional)
 */
export const removeEntityFromOptimizationIndicesFunctional = (entity: QueryEntity): Effect.Effect<void, never, ComponentIndexServiceFunctional> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexFunctional
    yield* componentIndex.removeEntity(entity)
    yield* ArchetypeSystemUtils.removeEntity(entity)
  })

/**
 * Update entity in optimization indices (functional)
 */
export const updateEntityInOptimizationIndicesFunctional = (entity: QueryEntity): Effect.Effect<void, never, ComponentIndexServiceFunctional> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexFunctional
    yield* componentIndex.removeEntity(entity)
    yield* componentIndex.addEntity(entity)
    yield* ArchetypeSystemUtils.removeEntity(entity)
    yield* ArchetypeSystemUtils.addEntity(entity)
  })

/**
 * Get comprehensive query optimization statistics (functional)
 */
export const getOptimizationStatsFunctional = (): Effect.Effect<
  {
    componentIndex: {
      totalComponents: number
      totalEntities: number
      componentDistribution: Array<{ component: ComponentName; entityCount: number }>
    }
    archetypes: any
    cache: any
  },
  never,
  ComponentIndexServiceFunctional | QueryCacheService
> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexFunctional
    const queryCache = yield* Context.GenericTag<QueryCacheService>('QueryCache')

    return {
      componentIndex: yield* componentIndex.getStats(),
      archetypes: yield* ArchetypeSystemUtils.getStats(),
      cache: yield* queryCache.getStats,
    }
  })

/**
 * Reset all optimization indices (functional)
 */
export const resetOptimizationIndicesFunctional = (): Effect.Effect<void, never, ComponentIndexServiceFunctional | QueryCacheService> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexFunctional
    const queryCache = yield* Context.GenericTag<QueryCacheService>('QueryCache')

    yield* componentIndex.clear()
    // Note: ArchetypeSystemUtils doesn't have a reset method yet - would need to be added if needed
    yield* queryCache.clear
  })

/**
 * Invalidate cache entries for specific components (functional)
 */
export const invalidateOptimizationCacheFunctional = (modifiedComponents: ComponentName[]): Effect.Effect<number, never, QueryCacheService> =>
  Effect.gen(function* () {
    const queryCache = yield* Context.GenericTag<QueryCacheService>('QueryCache')
    return yield* queryCache.invalidate(modifiedComponents)
  })

/**
 * Optimized query layer that provides component index and query cache (functional)
 */
export const optimizedQueryFunctionalLayer = componentIndexFunctionalLive
