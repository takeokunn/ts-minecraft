/**
 * Optimized Query System with Caching and Index Support
 * Provides high-performance queries with automatic optimization and caching
 */

import { ComponentName, ComponentOfName } from '@/core/components'
import { EntityId } from '@/core/entities'
import { QueryEntity } from './builder'
import { QueryConfig, QueryMetrics, startQueryContext, finalizeQueryContext } from './builder'
import { QueryCache, globalQueryCache, CacheKeyGenerator, CachedQueryResult, CachedQueryMetrics } from './cache'
import { ArchetypeQuery } from './archetype-query'

/**
 * Query execution plan for optimization
 */
interface QueryPlan {
  useArchetypes: boolean
  useCache: boolean
  cacheKey?: string
  estimatedCost: number
  indexStrategy: 'none' | 'component' | 'spatial' | 'hybrid'
}

/**
 * Component index for fast lookups
 */
class ComponentIndex {
  private componentToEntities: Map<ComponentName, Set<QueryEntity>> = new Map()
  private entityToComponents: Map<QueryEntity, Set<ComponentName>> = new Map()

  /**
   * Add entity to component indices
   */
  addEntity(entity: QueryEntity): void {
    const components = Object.keys(entity.components) as ComponentName[]
    this.entityToComponents.set(entity, new Set(components))

    for (const component of components) {
      if (!this.componentToEntities.has(component)) {
        this.componentToEntities.set(component, new Set())
      }
      this.componentToEntities.get(component)!.add(entity)
    }
  }

  /**
   * Remove entity from component indices
   */
  removeEntity(entity: QueryEntity): void {
    const components = this.entityToComponents.get(entity)
    if (!components) return

    for (const component of components) {
      const entitySet = this.componentToEntities.get(component)
      if (entitySet) {
        entitySet.delete(entity)
        if (entitySet.size === 0) {
          this.componentToEntities.delete(component)
        }
      }
    }

    this.entityToComponents.delete(entity)
  }

  /**
   * Get entities that have a specific component
   */
  getEntitiesWithComponent(component: ComponentName): ReadonlyArray<QueryEntity> {
    const entitySet = this.componentToEntities.get(component)
    return entitySet ? Array.from(entitySet) : []
  }

  /**
   * Get intersection of entities having all required components
   */
  getEntitiesWithAllComponents(components: ReadonlyArray<ComponentName>): ReadonlyArray<QueryEntity> {
    if (components.length === 0) return []

    // Start with entities having the rarest component (smallest set)
    let candidateEntities: Set<QueryEntity> | undefined

    // Sort components by entity count (rarest first)
    const sortedComponents = [...components].sort((a, b) => {
      const aSize = this.componentToEntities.get(a)?.size || 0
      const bSize = this.componentToEntities.get(b)?.size || 0
      return aSize - bSize
    })

    for (const component of sortedComponents) {
      const entitiesWithComponent = this.componentToEntities.get(component)
      
      if (!entitiesWithComponent || entitiesWithComponent.size === 0) {
        return [] // Early exit if any component has no entities
      }

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
  }

  /**
   * Get statistics about component distribution
   */
  getStats() {
    return {
      totalComponents: this.componentToEntities.size,
      totalEntities: this.entityToComponents.size,
      componentDistribution: Array.from(this.componentToEntities.entries()).map(([component, entities]) => ({
        component,
        entityCount: entities.size,
      })).sort((a, b) => b.entityCount - a.entityCount),
    }
  }

  /**
   * Clear all indices
   */
  clear(): void {
    this.componentToEntities.clear()
    this.entityToComponents.clear()
  }
}

/**
 * Optimized query with automatic performance optimization
 */
export class OptimizedQuery<T extends ReadonlyArray<ComponentName>> {
  private static componentIndex = new ComponentIndex()
  private archetypeQuery: ArchetypeQuery<T>
  private cachedPlan?: QueryPlan

  constructor(
    private config: QueryConfig<T>,
    private cache: QueryCache = globalQueryCache
  ) {
    this.archetypeQuery = new ArchetypeQuery(config)
  }

  /**
   * Execute optimized query with automatic performance tuning
   */
  async execute(entities?: ReadonlyArray<QueryEntity>): Promise<CachedQueryResult<ReadonlyArray<QueryEntity>>> {
    const plan = this.createExecutionPlan(entities?.map(entity => entity.id))
    const context = startQueryContext()

    // Try cache first if enabled
    if (plan.useCache && plan.cacheKey) {
      const cachedResult = this.cache.get<ReadonlyArray<EntityId>>(plan.cacheKey)
      if (cachedResult) {
        const metrics: CachedQueryMetrics = {
          ...finalizeQueryContext(context),
          cacheKey: plan.cacheKey,
          cacheHit: true,
          cacheInvalidations: 0,
        }
        
        context.metrics.cacheHits++
        
        return {
          data: cachedResult,
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
        resultEntities = this.executeWithComponentIndex(context)
        break
      case 'hybrid':
        resultEntities = this.executeHybridStrategy(entities, context)
        break
      default:
        const archetypeResult = this.archetypeQuery.execute(entities)
        resultEntities = [...archetypeResult.entities]
        // Merge metrics
        context.metrics.entitiesScanned += archetypeResult.metrics.entitiesScanned
        context.metrics.entitiesMatched += archetypeResult.metrics.entitiesMatched
        break
    }

    // Apply predicate filtering if present
    if (this.config.predicate) {
      resultEntities = await this.applyPredicateAsync(resultEntities, context)
    }

    // Cache result if caching is enabled
    if (plan.useCache && plan.cacheKey) {
      this.cache.set(
        plan.cacheKey,
        resultEntities,
        [...this.config.withComponents] as ComponentName[]
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
  }

  /**
   * Execute using component index for fast intersection
   */
  private executeWithComponentIndex(context: { metrics: QueryMetrics }): QueryEntity[] {
    // Get entities with all required components using index
    let candidates = OptimizedQuery.componentIndex.getEntitiesWithAllComponents(
      this.config.withComponents
    )

    context.metrics.entitiesScanned += candidates.length

    // Filter out entities with forbidden components
    if (this.config.withoutComponents && this.config.withoutComponents.length > 0) {
      candidates = candidates.filter(entity => {
        return !this.config.withoutComponents!.some(comp => 
          entity.components[comp] !== undefined
        )
      })
    }

    context.metrics.entitiesMatched += candidates.length
    return [...candidates]
  }

  /**
   * Execute using hybrid archetype + component index strategy
   */
  private executeHybridStrategy(entities: ReadonlyArray<QueryEntity> | undefined, context: { metrics: QueryMetrics }): QueryEntity[] {
    // Use component index for initial filtering if no entity list provided
    if (!entities) {
      return this.executeWithComponentIndex(context)
    }

    // Use archetype query for provided entity list
    const archetypeResult = this.archetypeQuery.execute(entities)
    context.metrics.entitiesScanned += archetypeResult.metrics.entitiesScanned
    context.metrics.entitiesMatched += archetypeResult.metrics.entitiesMatched
    
    return [...archetypeResult.entities]
  }

  /**
   * Apply predicate with async support for complex filtering
   */
  private async applyPredicateAsync(entities: QueryEntity[], _context: { metrics: QueryMetrics }): Promise<QueryEntity[]> {
    if (!this.config.predicate) return entities

    const result: QueryEntity[] = []
    const batchSize = 100 // Process in batches to avoid blocking

    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize)
      
      const batchResults = await Promise.all(batch.map(async entity => {
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
          return await Promise.resolve(this.config.predicate!(entityProxy as any))
        } catch (error) {
          console.warn(`Predicate error for entity ${entity.id}:`, error)
          return false
        }
      }))

      // Add entities that passed the predicate
      for (let j = 0; j < batch.length; j++) {
        if (batchResults[j] && batch[j] !== undefined) {
          result.push(batch[j]!)
        }
      }

      // Yield control to event loop between batches
      if (i + batchSize < entities.length) {
        await new Promise(resolve => setImmediate(resolve))
      }
    }

    return result
  }

  /**
   * Create execution plan based on query characteristics
   */
  private createExecutionPlan(entities?: ReadonlyArray<EntityId>): QueryPlan {
    if (this.cachedPlan) {
      return this.cachedPlan
    }

    const plan: QueryPlan = {
      useArchetypes: true,
      useCache: true,
      estimatedCost: 0,
      indexStrategy: 'hybrid',
    }

    // Determine caching strategy
    if (this.config.predicate) {
      plan.cacheKey = CacheKeyGenerator.forComponents(
        this.config.withComponents,
        this.config.withoutComponents,
        CacheKeyGenerator.hashPredicate(this.config.predicate)
      )
    } else {
      plan.cacheKey = CacheKeyGenerator.forComponents(
        this.config.withComponents,
        this.config.withoutComponents
      )
    }

    // Estimate query cost
    const componentCount = this.config.withComponents.length
    const hasComplex = Boolean(this.config.predicate)
    const hasForbidden = (this.config.withoutComponents?.length || 0) > 0

    plan.estimatedCost = componentCount * 10 + (hasComplex ? 100 : 0) + (hasForbidden ? 20 : 0)

    // Choose indexing strategy based on characteristics
    if (entities) {
      plan.indexStrategy = 'none' // Use direct archetype query for provided entities
    } else if (componentCount <= 2 && !hasForbidden) {
      plan.indexStrategy = 'component' // Use component index for simple queries
    } else {
      plan.indexStrategy = 'hybrid' // Use hybrid approach
    }

    this.cachedPlan = plan
    return plan
  }

  /**
   * Add entity to optimization indices
   */
  static addEntity(entity: QueryEntity): void {
    OptimizedQuery.componentIndex.addEntity(entity)
    ArchetypeQuery.addEntity(entity)
  }

  /**
   * Remove entity from optimization indices
   */
  static removeEntity(entity: QueryEntity): void {
    OptimizedQuery.componentIndex.removeEntity(entity)
    ArchetypeQuery.removeEntity(entity)
  }

  /**
   * Update entity in optimization indices
   */
  static updateEntity(entity: QueryEntity): void {
    OptimizedQuery.componentIndex.removeEntity(entity)
    OptimizedQuery.componentIndex.addEntity(entity)
    ArchetypeQuery.removeEntity(entity)
    ArchetypeQuery.addEntity(entity)
  }

  /**
   * Get comprehensive query optimization statistics
   */
  static getOptimizationStats() {
    return {
      componentIndex: OptimizedQuery.componentIndex.getStats(),
      archetypes: ArchetypeQuery.getArchetypeStats(),
      cache: globalQueryCache.getStats(),
    }
  }

  /**
   * Reset all optimization indices
   */
  static reset(): void {
    OptimizedQuery.componentIndex.clear()
    ArchetypeQuery.reset()
    globalQueryCache.clear()
  }

  /**
   * Invalidate cache entries for specific components
   */
  static invalidateCache(modifiedComponents: ComponentName[]): number {
    return globalQueryCache.invalidate(modifiedComponents)
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

  /**
   * Clear cached execution plan to force reoptimization
   */
  clearExecutionPlan(): void {
    this.cachedPlan = undefined
  }
}

// Convenience functions for test compatibility
export const addEntityToOptimizedQuery = (entity: QueryEntity): void => {
  OptimizedQuery.addEntity(entity)
}

export const removeEntityFromOptimizedQuery = (entity: QueryEntity): void => {
  OptimizedQuery.removeEntity(entity)
}

export const updateEntityInOptimizedQuery = (entity: QueryEntity): void => {
  OptimizedQuery.updateEntity(entity)
}

export const getOptimizationStats = () => {
  return OptimizedQuery.getOptimizationStats()
}

export const invalidateOptimizedQueryCache = (modifiedComponents: ComponentName[]): number => {
  return OptimizedQuery.invalidateCache(modifiedComponents)
}