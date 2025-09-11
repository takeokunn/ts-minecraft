/**
 * Optimized Query System - Functional Effect-TS Implementation
 * Provides high-performance queries with automatic optimization and caching
 */

import { Effect, Ref, Context, Layer, HashMap, Option } from 'effect'
import { ComponentName, ComponentOfName } from '@/domain/entities/components'
import { EntityId } from '@/domain/entities'
import { QueryEntity } from './builder'
import { QueryConfig, QueryMetrics, startQueryContext, finalizeQueryContext } from './builder'
import { QueryCacheService, CacheKeyGeneratorService, CachedQueryResult, CachedQueryMetrics } from './cache'
import { ArchetypeQueryService } from './archetype-query'

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
 * Component Index Service
 */
export const ComponentIndexService = Context.GenericTag<{
  readonly addEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly removeEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly getEntitiesWithComponent: (component: ComponentName) => Effect.Effect<ReadonlyArray<QueryEntity>>
  readonly getEntitiesWithAllComponents: (components: ReadonlyArray<ComponentName>) => Effect.Effect<ReadonlyArray<QueryEntity>>
  readonly getStats: () => Effect.Effect<ComponentIndexStats>
  readonly clear: () => Effect.Effect<void>
}>('ComponentIndexService')

/**
 * Component index statistics
 */
interface ComponentIndexStats {
  totalComponents: number
  totalEntities: number
  componentDistribution: Array<{
    component: ComponentName
    entityCount: number
  }>
}

/**
 * Internal component index state
 */
interface ComponentIndexState {
  componentToEntities: HashMap.HashMap<ComponentName, Set<QueryEntity>>
  entityToComponents: HashMap.HashMap<QueryEntity, Set<ComponentName>>
}

/**
 * Add entity to component indices
 */
const addEntityToIndex = (
  entity: QueryEntity,
  indexRef: Ref.Ref<ComponentIndexState>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(indexRef)
    const components = Object.keys(entity.components) as ComponentName[]
    const componentSet = new Set(components)
    
    let newComponentToEntities = HashMap.set(state.componentToEntities, entity, componentSet)
    let newEntityToComponents = state.entityToComponents
    
    for (const component of components) {
      const existingEntities = HashMap.get(newEntityToComponents, component)
      const entitySet = Option.isSome(existingEntities) ? existingEntities.value : new Set<QueryEntity>()
      entitySet.add(entity)
      newEntityToComponents = HashMap.set(newEntityToComponents, component, entitySet)
    }
    
    yield* Ref.set(indexRef, {
      componentToEntities: newComponentToEntities,
      entityToComponents: newEntityToComponents
    })
  })

/**
 * Remove entity from component indices
 */
const removeEntityFromIndex = (
  entity: QueryEntity,
  indexRef: Ref.Ref<ComponentIndexState>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(indexRef)
    const componentsOption = HashMap.get(state.componentToEntities, entity)
    
    if (Option.isNone(componentsOption)) return
    
    const components = componentsOption.value
    let newEntityToComponents = state.entityToComponents
    
    for (const component of components) {
      const entitySetOption = HashMap.get(newEntityToComponents, component)
      if (Option.isSome(entitySetOption)) {
        const entitySet = entitySetOption.value
        entitySet.delete(entity)
        
        if (entitySet.size === 0) {
          newEntityToComponents = HashMap.remove(newEntityToComponents, component)
        } else {
          newEntityToComponents = HashMap.set(newEntityToComponents, component, entitySet)
        }
      }
    }
    
    yield* Ref.set(indexRef, {
      componentToEntities: HashMap.remove(state.componentToEntities, entity),
      entityToComponents: newEntityToComponents
    })
  })

/**
 * Get entities that have a specific component
 */
const getEntitiesWithComponent = (
  component: ComponentName,
  indexRef: Ref.Ref<ComponentIndexState>
): Effect.Effect<ReadonlyArray<QueryEntity>> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(indexRef)
    const entitySetOption = HashMap.get(state.entityToComponents, component)
    return Option.isSome(entitySetOption) ? Array.from(entitySetOption.value) : []
  })

/**
 * Get intersection of entities having all required components
 */
const getEntitiesWithAllComponents = (
  components: ReadonlyArray<ComponentName>,
  indexRef: Ref.Ref<ComponentIndexState>
): Effect.Effect<ReadonlyArray<QueryEntity>> =>
  Effect.gen(function* () {
    if (components.length === 0) return []
    
    const state = yield* Ref.get(indexRef)
    
    // Sort components by entity count (rarest first)
    const componentSizes = components.map(comp => ({
      component: comp,
      size: HashMap.get(state.entityToComponents, comp).pipe(
        Option.map(set => set.size),
        Option.getOrElse(() => 0)
      )
    })).sort((a, b) => a.size - b.size)
    
    let candidateEntities: Set<QueryEntity> | undefined
    
    for (const { component } of componentSizes) {
      const entitiesOption = HashMap.get(state.entityToComponents, component)
      
      if (Option.isNone(entitiesOption) || entitiesOption.value.size === 0) {
        return [] // Early exit if any component has no entities
      }
      
      const entitiesWithComponent = entitiesOption.value
      
      if (!candidateEntities) {
        candidateEntities = new Set(entitiesWithComponent)
      } else {
        // Intersect with current candidates
        candidateEntities = new Set([...candidateEntities].filter(entity => 
          entitiesWithComponent.has(entity)
        ))
      }
      
      // Early exit if intersection becomes empty
      if (candidateEntities.size === 0) {
        return []
      }
    }
    
    return candidateEntities ? Array.from(candidateEntities) : []
  })

/**
 * Get statistics about component distribution
 */
const getIndexStats = (
  indexRef: Ref.Ref<ComponentIndexState>
): Effect.Effect<ComponentIndexStats> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(indexRef)
    
    const componentDistribution = HashMap.toEntries(state.entityToComponents)
      .map(([component, entities]) => ({
        component,
        entityCount: entities.size
      }))
      .sort((a, b) => b.entityCount - a.entityCount)
    
    return {
      totalComponents: HashMap.size(state.entityToComponents),
      totalEntities: HashMap.size(state.componentToEntities),
      componentDistribution
    }
  })

/**
 * Clear all indices
 */
const clearIndex = (indexRef: Ref.Ref<ComponentIndexState>): Effect.Effect<void> =>
  Ref.set(indexRef, {
    componentToEntities: HashMap.empty(),
    entityToComponents: HashMap.empty()
  })

/**
 * Component Index Service Implementation
 */
export const ComponentIndexServiceLive = Layer.effect(
  ComponentIndexService,
  Effect.gen(function* () {
    const indexRef = yield* Ref.make<ComponentIndexState>({
      componentToEntities: HashMap.empty(),
      entityToComponents: HashMap.empty()
    })
    
    return ComponentIndexService.of({
      addEntity: (entity) => addEntityToIndex(entity, indexRef),
      removeEntity: (entity) => removeEntityFromIndex(entity, indexRef),
      getEntitiesWithComponent: (component) => getEntitiesWithComponent(component, indexRef),
      getEntitiesWithAllComponents: (components) => getEntitiesWithAllComponents(components, indexRef),
      getStats: () => getIndexStats(indexRef),
      clear: () => clearIndex(indexRef)
    })
  })
)

/**
 * Optimized Query Service
 */
export const OptimizedQueryService = Context.GenericTag<{
  readonly execute: <T extends ReadonlyArray<ComponentName>>(
    config: QueryConfig<T>,
    entities?: ReadonlyArray<QueryEntity>
  ) => Effect.Effect<CachedQueryResult<ReadonlyArray<QueryEntity>>>
  readonly addEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly removeEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly updateEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly getOptimizationStats: () => Effect.Effect<OptimizationStats>
  readonly reset: () => Effect.Effect<void>
  readonly invalidateCache: (modifiedComponents: ComponentName[]) => Effect.Effect<number>
}>('OptimizedQueryService')

/**
 * Optimization statistics
 */
interface OptimizationStats {
  componentIndex: ComponentIndexStats
  archetypes: any // Will be defined when archetype-query is converted
  cache: any // Cache stats
}

/**
 * Internal optimized query state
 */
interface OptimizedQueryState {
  cachedPlans: HashMap.HashMap<string, QueryPlan>
}

/**
 * Create execution plan based on query characteristics
 */
const createExecutionPlan = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
  entities: ReadonlyArray<EntityId> | undefined,
  stateRef: Ref.Ref<OptimizedQueryState>,
  keyGenerator: CacheKeyGeneratorService.Type
): Effect.Effect<QueryPlan> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const planKey = `${config.name}-${entities ? 'entities' : 'all'}`
    const cachedPlanOption = HashMap.get(state.cachedPlans, planKey)
    
    if (Option.isSome(cachedPlanOption)) {
      return cachedPlanOption.value
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
      plan.cacheKey = keyGenerator.forComponents(
        config.withComponents,
        config.withoutComponents,
        keyGenerator.hashPredicate(config.predicate)
      )
    } else {
      plan.cacheKey = keyGenerator.forComponents(
        config.withComponents,
        config.withoutComponents
      )
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
    
    // Cache the plan
    yield* Ref.update(stateRef, state => ({
      ...state,
      cachedPlans: HashMap.set(state.cachedPlans, planKey, plan)
    }))
    
    return plan
  })

/**
 * Execute using component index for fast intersection
 */
const executeWithComponentIndex = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
  context: { metrics: QueryMetrics },
  componentIndex: ComponentIndexService.Type
): Effect.Effect<QueryEntity[]> =>
  Effect.gen(function* () {
    // Get entities with all required components using index
    let candidates = yield* componentIndex.getEntitiesWithAllComponents(config.withComponents)
    
    context.metrics.entitiesScanned += candidates.length
    
    // Filter out entities with forbidden components
    if (config.withoutComponents && config.withoutComponents.length > 0) {
      candidates = candidates.filter(entity => {
        return !config.withoutComponents!.some(comp => 
          entity.components[comp] !== undefined
        )
      })
    }
    
    context.metrics.entitiesMatched += candidates.length
    return [...candidates]
  })

/**
 * Execute using hybrid archetype + component index strategy
 */
const executeHybridStrategy = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
  entities: ReadonlyArray<QueryEntity> | undefined,
  context: { metrics: QueryMetrics },
  componentIndex: ComponentIndexService.Type,
  archetypeQuery: ArchetypeQueryService.Type
): Effect.Effect<QueryEntity[]> =>
  Effect.gen(function* () {
    // Use component index for initial filtering if no entity list provided
    if (!entities) {
      return yield* executeWithComponentIndex(config, context, componentIndex)
    }
    
    // Use archetype query for provided entity list
    const archetypeResult = yield* archetypeQuery.execute(config, entities)
    context.metrics.entitiesScanned += archetypeResult.metrics.entitiesScanned
    context.metrics.entitiesMatched += archetypeResult.metrics.entitiesMatched
    
    return [...archetypeResult.entities]
  })

/**
 * Apply predicate with async support for complex filtering
 */
const applyPredicateAsync = <T extends ReadonlyArray<ComponentName>>(
  entities: QueryEntity[],
  config: QueryConfig<T>,
  _context: { metrics: QueryMetrics }
): Effect.Effect<QueryEntity[]> =>
  Effect.gen(function* () {
    if (!config.predicate) return entities
    
    const result: QueryEntity[] = []
    const batchSize = 100 // Process in batches to avoid blocking
    
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize)
      
      const batchResults = yield* Effect.all(
        batch.map(entity => 
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
              return yield* Effect.promise(() => 
                Promise.resolve(config.predicate!(entityProxy as any))
              )
            } catch (error) {
              console.warn(`Predicate error for entity ${entity.id}:`, error)
              return false
            }
          })
        )
      )
      
      // Add entities that passed the predicate
      for (let j = 0; j < batch.length; j++) {
        if (batchResults[j] && batch[j] !== undefined) {
          result.push(batch[j]!)
        }
      }
      
      // Yield control between batches
      if (i + batchSize < entities.length) {
        yield* Effect.sleep(0)
      }
    }
    
    return result
  })

/**
 * Execute optimized query with automatic performance tuning
 */
const executeOptimizedQuery = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
  entities: ReadonlyArray<QueryEntity> | undefined,
  stateRef: Ref.Ref<OptimizedQueryState>
): Effect.Effect<CachedQueryResult<ReadonlyArray<QueryEntity>>> =>
  Effect.gen(function* () {
    const queryCache = yield* QueryCacheService
    const keyGenerator = yield* CacheKeyGeneratorService
    const componentIndex = yield* ComponentIndexService
    const archetypeQuery = yield* ArchetypeQueryService
    
    const plan = yield* createExecutionPlan(config, entities?.map(entity => entity.id), stateRef, keyGenerator)
    const context = startQueryContext()
    
    // Try cache first if enabled
    if (plan.useCache && plan.cacheKey) {
      const cachedResult = yield* queryCache.get<ReadonlyArray<QueryEntity>>(plan.cacheKey)
      
      if (Option.isSome(cachedResult)) {
        const metrics: CachedQueryMetrics = {
          ...finalizeQueryContext(context),
          cacheKey: plan.cacheKey,
          cacheHit: true,
          cacheInvalidations: 0,
        }
        
        context.metrics.cacheHits++
        
        return {
          data: cachedResult.value,
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
        resultEntities = yield* executeWithComponentIndex(config, context, componentIndex)
        break
      case 'hybrid':
        resultEntities = yield* executeHybridStrategy(config, entities, context, componentIndex, archetypeQuery)
        break
      default:
        const archetypeResult = yield* archetypeQuery.execute(config, entities)
        resultEntities = [...archetypeResult.entities]
        // Merge metrics
        context.metrics.entitiesScanned += archetypeResult.metrics.entitiesScanned
        context.metrics.entitiesMatched += archetypeResult.metrics.entitiesMatched
        break
    }
    
    // Apply predicate filtering if present
    if (config.predicate) {
      resultEntities = yield* applyPredicateAsync(resultEntities, config, context)
    }
    
    // Cache result if caching is enabled
    if (plan.useCache && plan.cacheKey) {
      yield* queryCache.set(
        plan.cacheKey,
        resultEntities,
        [...config.withComponents] as ComponentName[]
      )
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
  })

/**
 * Add entity to optimization indices
 */
const addEntityToOptimization = (
  entity: QueryEntity
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexService
    const archetypeQuery = yield* ArchetypeQueryService
    
    yield* componentIndex.addEntity(entity)
    yield* archetypeQuery.addEntity(entity)
  })

/**
 * Remove entity from optimization indices
 */
const removeEntityFromOptimization = (
  entity: QueryEntity
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexService
    const archetypeQuery = yield* ArchetypeQueryService
    
    yield* componentIndex.removeEntity(entity)
    yield* archetypeQuery.removeEntity(entity)
  })

/**
 * Update entity in optimization indices
 */
const updateEntityInOptimization = (
  entity: QueryEntity
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexService
    const archetypeQuery = yield* ArchetypeQueryService
    
    yield* componentIndex.removeEntity(entity)
    yield* componentIndex.addEntity(entity)
    yield* archetypeQuery.removeEntity(entity)
    yield* archetypeQuery.addEntity(entity)
  })

/**
 * Get comprehensive query optimization statistics
 */
const getOptimizationStats = (): Effect.Effect<OptimizationStats> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexService
    const archetypeQuery = yield* ArchetypeQueryService
    const queryCache = yield* QueryCacheService
    
    return {
      componentIndex: yield* componentIndex.getStats(),
      archetypes: yield* archetypeQuery.getStats(),
      cache: yield* queryCache.getStats(),
    }
  })

/**
 * Reset all optimization indices
 */
const resetOptimization = (): Effect.Effect<void> =>
  Effect.gen(function* () {
    const componentIndex = yield* ComponentIndexService
    const archetypeQuery = yield* ArchetypeQueryService
    const queryCache = yield* QueryCacheService
    
    yield* componentIndex.clear()
    yield* archetypeQuery.reset()
    yield* queryCache.clear()
  })

/**
 * Invalidate cache entries for specific components
 */
const invalidateOptimizationCache = (
  modifiedComponents: ComponentName[]
): Effect.Effect<number> =>
  Effect.gen(function* () {
    const queryCache = yield* QueryCacheService
    return yield* queryCache.invalidate(modifiedComponents)
  })

/**
 * Clear cached execution plan to force reoptimization
 */
const clearExecutionPlan = (
  queryName: string,
  stateRef: Ref.Ref<OptimizedQueryState>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Ref.update(stateRef, state => ({
      ...state,
      cachedPlans: HashMap.filter(state.cachedPlans, key => !key.startsWith(queryName))
    }))
  })

/**
 * Optimized Query Service Implementation
 */
export const OptimizedQueryServiceLive = Layer.effect(
  OptimizedQueryService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<OptimizedQueryState>({
      cachedPlans: HashMap.empty()
    })
    
    return OptimizedQueryService.of({
      execute: <T extends ReadonlyArray<ComponentName>>(
        config: QueryConfig<T>,
        entities?: ReadonlyArray<QueryEntity>
      ) => executeOptimizedQuery(config, entities, stateRef),
      addEntity: addEntityToOptimization,
      removeEntity: removeEntityFromOptimization,
      updateEntity: updateEntityInOptimization,
      getOptimizationStats,
      reset: resetOptimization,
      invalidateCache: invalidateOptimizationCache
    })
  })
)

/**
 * Legacy OptimizedQuery class wrapper for backward compatibility
 */
export class OptimizedQuery<T extends ReadonlyArray<ComponentName>> {
  constructor(
    private config: QueryConfig<T>
  ) {}
  
  async execute(entities?: ReadonlyArray<QueryEntity>): Promise<CachedQueryResult<ReadonlyArray<QueryEntity>>> {
    throw new Error('Legacy OptimizedQuery.execute() not supported. Use OptimizedQueryService instead.')
  }
  
  static addEntity(entity: QueryEntity): void {
    throw new Error('Legacy OptimizedQuery.addEntity() not supported. Use OptimizedQueryService instead.')
  }
  
  static removeEntity(entity: QueryEntity): void {
    throw new Error('Legacy OptimizedQuery.removeEntity() not supported. Use OptimizedQueryService instead.')
  }
  
  static updateEntity(entity: QueryEntity): void {
    throw new Error('Legacy OptimizedQuery.updateEntity() not supported. Use OptimizedQueryService instead.')
  }
  
  static getOptimizationStats() {
    throw new Error('Legacy OptimizedQuery.getOptimizationStats() not supported. Use OptimizedQueryService instead.')
  }
  
  static reset(): void {
    throw new Error('Legacy OptimizedQuery.reset() not supported. Use OptimizedQueryService instead.')
  }
  
  static invalidateCache(modifiedComponents: ComponentName[]): number {
    throw new Error('Legacy OptimizedQuery.invalidateCache() not supported. Use OptimizedQueryService instead.')
  }
  
  get name(): string {
    return this.config.name
  }
  
  get components(): T {
    return this.config.withComponents
  }
  
  get forbiddenComponents(): ReadonlyArray<ComponentName> {
    return this.config.withoutComponents || []
  }
  
  clearExecutionPlan(): void {
    throw new Error('Legacy OptimizedQuery.clearExecutionPlan() not supported. Use OptimizedQueryService instead.')
  }
}

// Convenience functions for test compatibility
export const addEntityToOptimizedQuery = (entity: QueryEntity): void => {
  throw new Error('Legacy addEntityToOptimizedQuery() not supported. Use OptimizedQueryService instead.')
}

export const removeEntityFromOptimizedQuery = (entity: QueryEntity): void => {
  throw new Error('Legacy removeEntityFromOptimizedQuery() not supported. Use OptimizedQueryService instead.')
}

export const updateEntityInOptimizedQuery = (entity: QueryEntity): void => {
  throw new Error('Legacy updateEntityInOptimizedQuery() not supported. Use OptimizedQueryService instead.')
}

export const getOptimizationStats = () => {
  throw new Error('Legacy getOptimizationStats() not supported. Use OptimizedQueryService instead.')
}

export const invalidateOptimizedQueryCache = (modifiedComponents: ComponentName[]): number => {
  throw new Error('Legacy invalidateOptimizedQueryCache() not supported. Use OptimizedQueryService instead.')
}