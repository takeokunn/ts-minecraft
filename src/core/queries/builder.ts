/**
 * Modern Query Builder System for TypeScript Minecraft
 * Provides fluent API for entity queries with optimization and caching
 */

import { ComponentName, ComponentOfName } from '@/core/components'
import { ArchetypeQuery } from './archetype-query'
import { OptimizedQuery } from './optimized-query'
import { EntityId } from '@/domain/entities'

/**
 * Entity interface for query system
 * Represents an entity with components for query operations
 */
export interface QueryEntity {
  readonly id: EntityId
  readonly components: Record<ComponentName, unknown>
}

/**
 * Predicate function type for entity filtering
 */
export type EntityPredicate<T extends ReadonlyArray<ComponentName>> = (entity: {
  get<K extends T[number]>(componentName: K): ComponentOfName<K>
  has<K extends ComponentName>(componentName: K): boolean
  id: EntityId
}) => boolean

/**
 * Query configuration for building optimized queries
 */
export interface QueryConfig<T extends ReadonlyArray<ComponentName>> {
  name: string
  withComponents: T
  withoutComponents?: ReadonlyArray<ComponentName>
  predicate?: EntityPredicate<T>
  cacheKey?: string
  priority?: number
}

/**
 * Fluent Query Builder Interface
 */
export interface QueryBuilder<T extends ReadonlyArray<ComponentName> = readonly []> {
  with<K extends ComponentName>(...components: K[]): QueryBuilder<readonly [...T, ...K[]]>
  without(...components: ComponentName[]): QueryBuilder<T>
  where(predicate: EntityPredicate<T>): QueryBuilder<T>
  named(name: string): QueryBuilder<T>
  priority(level: number): QueryBuilder<T>
  build(): ArchetypeQuery<T>
  buildOptimized(): OptimizedQuery<T>
}

/**
 * Internal query builder implementation
 */
class QueryBuilderImpl<T extends ReadonlyArray<ComponentName>> implements QueryBuilder<T> {
  private config: Partial<QueryConfig<T>>

  constructor(config: Partial<QueryConfig<T>> = {}) {
    this.config = {
      withComponents: (config.withComponents || []) as T,
      withoutComponents: [],
      priority: 5,
      ...config,
    }
  }

  with<K extends ComponentName>(...components: K[]): QueryBuilder<readonly [...T, ...K[]]> {
    const newWithComponents = [...(this.config.withComponents || []), ...components] as readonly [...T, ...K[]]
    
    return new QueryBuilderImpl<readonly [...T, ...K[]]>({
      ...this.config,
      withComponents: newWithComponents,
    })
  }

  without(...components: ComponentName[]): QueryBuilder<T> {
    return new QueryBuilderImpl<T>({
      ...this.config,
      withoutComponents: [...(this.config.withoutComponents || []), ...components],
    })
  }

  where(predicate: EntityPredicate<T>): QueryBuilder<T> {
    return new QueryBuilderImpl<T>({
      ...this.config,
      predicate,
    })
  }

  named(name: string): QueryBuilder<T> {
    return new QueryBuilderImpl<T>({
      ...this.config,
      name,
    })
  }

  priority(level: number): QueryBuilder<T> {
    return new QueryBuilderImpl<T>({
      ...this.config,
      priority: level,
    })
  }

  build(): ArchetypeQuery<T> {
    const config = this.validateConfig()
    return new ArchetypeQuery(config)
  }

  buildOptimized(): OptimizedQuery<T> {
    const config = this.validateConfig()
    return new OptimizedQuery(config)
  }

  private validateConfig(): QueryConfig<T> {
    if (!this.config.withComponents || this.config.withComponents.length === 0) {
      throw new Error('Query must specify at least one component with with()')
    }

    if (!this.config.name) {
      // Auto-generate name from components
      const componentsList = [...this.config.withComponents].sort().join('-')
      const withoutList = this.config.withoutComponents?.length 
        ? `-without-${[...this.config.withoutComponents].sort().join('-')}`
        : ''
      this.config.name = `query-${componentsList}${withoutList}`
    }

    return this.config as QueryConfig<T>
  }
}

/**
 * Create a new query builder instance
 */
export function query(): QueryBuilder<readonly []> {
  return new QueryBuilderImpl<readonly []>()
}

/**
 * Advanced query builder with SoA (Structure of Arrays) support
 * Optimized for bulk operations on component data
 */
export interface SoAQueryBuilder<T extends ReadonlyArray<ComponentName>> {
  withComponents: T
  build(): SoAQuery<T>
}

/**
 * SoA Query result type - returns arrays of component data
 */
export interface SoAQueryResult<T extends ReadonlyArray<ComponentName>> {
  entities: ReadonlyArray<QueryEntity>
  components: {
    readonly [K in T[number]]: ReadonlyArray<ComponentOfName<K>>
  }
  length: number
}

/**
 * Structure of Arrays Query for high-performance bulk operations
 */
export class SoAQuery<T extends ReadonlyArray<ComponentName>> {
  constructor(
    public readonly components: T,
    public readonly name: string = `soa-${components.join('-')}`
  ) {}

  /**
   * Execute SoA query - returns component arrays for vectorized operations
   */
  execute(entities: ReadonlyArray<QueryEntity>): SoAQueryResult<T> {
    const matchingEntities: QueryEntity[] = []
    const componentArrays: Record<string, unknown[]> = {}

    // Initialize component arrays
    for (const componentName of this.components) {
      componentArrays[componentName] = []
    }

    // Filter and collect matching entities and their components
    for (const entity of entities) {
      const hasAllComponents = this.components.every(comp => entity.components[comp] !== undefined)
      
      if (hasAllComponents) {
        matchingEntities.push(entity)
        
        // Add components to arrays
        for (const componentName of this.components) {
          componentArrays[componentName]!.push(entity.components[componentName])
        }
      }
    }

    return {
      entities: matchingEntities,
      components: componentArrays as unknown as {
        readonly [K in T[number]]: ReadonlyArray<ComponentOfName<K>>
      },
      length: matchingEntities.length,
    }
  }
}

/**
 * Create SoA query for bulk operations
 */
export function soaQuery<T extends ReadonlyArray<ComponentName>>(
  ...components: T
): SoAQuery<T> {
  return new SoAQuery(components)
}

/**
 * Array of Structures Query for traditional entity iteration
 */
export interface AoSQueryResult<T extends ReadonlyArray<ComponentName>> {
  entities: ReadonlyArray<{
    entity: QueryEntity
    components: {
      [K in keyof T]: T[K] extends ComponentName 
        ? ComponentOfName<T[K]>
        : never
    }
  }>
  length: number
}

/**
 * Create AoS query for entity-centric operations
 */
export class AoSQuery<T extends ReadonlyArray<ComponentName>> {
  constructor(
    public readonly components: T,
    public readonly name: string = `aos-${components.join('-')}`
  ) {}

  /**
   * Execute AoS query - returns entities with their component data
   */
  execute(entities: ReadonlyArray<QueryEntity>): AoSQueryResult<T> {
    const result: Array<{
      entity: QueryEntity
      components: any
    }> = []

    for (const entity of entities) {
      const hasAllComponents = this.components.every(comp => entity.components[comp] !== undefined)
      
      if (hasAllComponents) {
        const entityComponents: Record<string, unknown> = {}
        
        for (const componentName of this.components) {
          entityComponents[componentName] = entity.components[componentName]
        }

        result.push({
          entity,
          components: entityComponents as any,
        })
      }
    }

    return {
      entities: result,
      length: result.length,
    }
  }
}

/**
 * Create AoS query for entity-centric operations
 */
export function aosQuery<T extends ReadonlyArray<ComponentName>>(
  ...components: T
): AoSQuery<T> {
  return new AoSQuery(components)
}

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  executionTime: number
  entitiesScanned: number
  entitiesMatched: number
  cacheHits: number
  cacheMisses: number
}

/**
 * Query execution context with performance tracking
 */
export interface QueryContext {
  startTime: number
  metrics: QueryMetrics
}

/**
 * Start query execution context
 */
export function startQueryContext(): QueryContext {
  return {
    startTime: performance.now(),
    metrics: {
      executionTime: 0,
      entitiesScanned: 0,
      entitiesMatched: 0,
      cacheHits: 0,
      cacheMisses: 0,
    },
  }
}

/**
 * Finalize query execution context
 */
export function finalizeQueryContext(context: QueryContext): QueryMetrics {
  context.metrics.executionTime = performance.now() - context.startTime
  return context.metrics
}

/**
 * Entity proxy interface for component access
 */
export interface EntityProxy<T extends ReadonlyArray<ComponentName>> {
  get<K extends T[number]>(componentName: K): ComponentOfName<K>
  has<K extends ComponentName>(componentName: K): boolean
  readonly id: EntityId
}

/**
 * Query builder state for immutable operations
 */
export interface QueryBuilderState<T extends ReadonlyArray<ComponentName>> {
  config: Partial<QueryConfig<T>>
}

/**
 * Static query builder utilities
 */
export class QueryBuilder {
  /**
   * Create initial query builder state
   */
  static createState<T extends ReadonlyArray<ComponentName> = readonly []>(): QueryBuilderState<T> {
    return {
      config: {
        withComponents: [] as unknown as T,
        withoutComponents: [],
        priority: 5,
      },
    }
  }

  /**
   * Add required components to state
   */
  static withComponents<T extends ReadonlyArray<ComponentName>, K extends ComponentName[]>(
    state: QueryBuilderState<T>,
    ...components: K
  ): QueryBuilderState<readonly [...T, ...K]> {
    return {
      config: {
        ...state.config,
        withComponents: [...(state.config.withComponents || []), ...components] as readonly [...T, ...K],
      },
    }
  }

  /**
   * Add forbidden components to state
   */
  static withoutComponents<T extends ReadonlyArray<ComponentName>>(
    state: QueryBuilderState<T>,
    ...components: ComponentName[]
  ): QueryBuilderState<T> {
    return {
      config: {
        ...state.config,
        withoutComponents: [...(state.config.withoutComponents || []), ...components],
      },
    }
  }

  /**
   * Add predicate to state
   */
  static withPredicate<T extends ReadonlyArray<ComponentName>>(
    state: QueryBuilderState<T>,
    predicate: EntityPredicate<T>
  ): QueryBuilderState<T> {
    return {
      config: {
        ...state.config,
        predicate,
      },
    }
  }

  /**
   * Set query name
   */
  static withName<T extends ReadonlyArray<ComponentName>>(
    state: QueryBuilderState<T>,
    name: string
  ): QueryBuilderState<T> {
    return {
      config: {
        ...state.config,
        name,
      },
    }
  }

  /**
   * Set query priority
   */
  static withPriority<T extends ReadonlyArray<ComponentName>>(
    state: QueryBuilderState<T>,
    priority: number
  ): QueryBuilderState<T> {
    return {
      config: {
        ...state.config,
        priority,
      },
    }
  }

  /**
   * Validate query configuration
   */
  static validateConfig<T extends ReadonlyArray<ComponentName>>(
    config: Partial<QueryConfig<T>>
  ): QueryConfig<T> {
    if (!config.withComponents || config.withComponents.length === 0) {
      throw new Error('Query must specify at least one component with with()')
    }

    if (!config.name) {
      // Auto-generate name from components
      const componentsList = [...config.withComponents].sort().join('-')
      const withoutList = config.withoutComponents?.length
        ? `-without-${[...config.withoutComponents].sort().join('-')}`
        : ''
      config.name = `query-${componentsList}${withoutList}`
    }

    return config as QueryConfig<T>
  }

  /**
   * Execute query with given configuration
   */
  static async executeQuery<T extends ReadonlyArray<ComponentName>>(
    config: QueryConfig<T>,
    entities?: ReadonlyArray<QueryEntity>
  ): Promise<{ entities: ReadonlyArray<QueryEntity>; metrics: QueryMetrics }> {
    const query = new ArchetypeQuery(config)
    return query.execute(entities)
  }

  /**
   * Create entity proxy for component access
   */
  static createEntityProxy<T extends ReadonlyArray<ComponentName>>(
    entity: QueryEntity
  ): EntityProxy<T> {
    return {
      get: <K extends ComponentName>(componentName: K) => {
        return entity.components[componentName] as ComponentOfName<K>
      },
      has: <K extends ComponentName>(componentName: K) => {
        return entity.components[componentName] !== undefined
      },
      id: entity.id,
    }
  }
}

/**
 * Create entity proxy for component access (convenience function)
 */
export function createEntityProxy<T extends ReadonlyArray<ComponentName>>(
  entity: QueryEntity
): EntityProxy<T> {
  return QueryBuilder.createEntityProxy(entity)
}