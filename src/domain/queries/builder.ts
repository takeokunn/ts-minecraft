/**
 * Modern Query Builder System - Functional Effect-TS Implementation
 * Provides fluent API for entity queries with optimization and caching
 */

import { Effect, Context, Layer } from 'effect'
import { ComponentName, ComponentOfName } from '@/domain/entities/components'
import { ArchetypeQueryService } from './archetype-query'
import { OptimizedQueryService } from './optimized-query'
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
 * Query Builder Service
 */
export const QueryBuilderService = Context.GenericTag<{
  readonly createQuery: () => QueryBuilder<readonly []>
  readonly withComponents: <T extends ReadonlyArray<ComponentName>, K extends ComponentName[]>(
    builder: QueryBuilder<T>,
    ...components: K
  ) => QueryBuilder<readonly [...T, ...K]>
  readonly withoutComponents: <T extends ReadonlyArray<ComponentName>>(
    builder: QueryBuilder<T>,
    ...components: ComponentName[]
  ) => QueryBuilder<T>
  readonly withPredicate: <T extends ReadonlyArray<ComponentName>>(
    builder: QueryBuilder<T>,
    predicate: EntityPredicate<T>
  ) => QueryBuilder<T>
  readonly withName: <T extends ReadonlyArray<ComponentName>>(
    builder: QueryBuilder<T>,
    name: string
  ) => QueryBuilder<T>
  readonly withPriority: <T extends ReadonlyArray<ComponentName>>(
    builder: QueryBuilder<T>,
    priority: number
  ) => QueryBuilder<T>
  readonly buildArchetype: <T extends ReadonlyArray<ComponentName>>(
    builder: QueryBuilder<T>
  ) => Effect.Effect<{ execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<{ entities: ReadonlyArray<QueryEntity>; metrics: QueryMetrics }> }>
  readonly buildOptimized: <T extends ReadonlyArray<ComponentName>>(
    builder: QueryBuilder<T>
  ) => Effect.Effect<{ execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<any> }>
}>('QueryBuilderService')

/**
 * Fluent Query Builder Interface
 */
export interface QueryBuilder<T extends ReadonlyArray<ComponentName> = readonly []> {
  readonly config: Partial<QueryConfig<T>>
  with<K extends ComponentName>(...components: K[]): QueryBuilder<readonly [...T, ...K[]]>
  without(...components: ComponentName[]): QueryBuilder<T>
  where(predicate: EntityPredicate<T>): QueryBuilder<T>
  named(name: string): QueryBuilder<T>
  priority(level: number): QueryBuilder<T>
  build(): Effect.Effect<{ execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<{ entities: ReadonlyArray<QueryEntity>; metrics: QueryMetrics }> }>
  buildOptimized(): Effect.Effect<{ execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<any> }>
}

/**
 * Internal query builder implementation
 */
class QueryBuilderImpl<T extends ReadonlyArray<ComponentName>> implements QueryBuilder<T> {
  constructor(public readonly config: Partial<QueryConfig<T>> = {}) {
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

  build(): Effect.Effect<{ execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<{ entities: ReadonlyArray<QueryEntity>; metrics: QueryMetrics }> }> {
    return Effect.gen(function* () {
      const archetypeQuery = yield* ArchetypeQueryService
      const validatedConfig = validateQueryConfig(this.config)
      
      return {
        execute: (entities?: ReadonlyArray<QueryEntity>) => 
          archetypeQuery.execute(validatedConfig, entities)
      }
    }.bind(this))
  }

  buildOptimized(): Effect.Effect<{ execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<any> }> {
    return Effect.gen(function* () {
      const optimizedQuery = yield* OptimizedQueryService
      const validatedConfig = validateQueryConfig(this.config)
      
      return {
        execute: (entities?: ReadonlyArray<QueryEntity>) => 
          optimizedQuery.execute(validatedConfig, entities)
      }
    }.bind(this))
  }
}

/**
 * Validate query configuration
 */
const validateQueryConfig = <T extends ReadonlyArray<ComponentName>>(
  config: Partial<QueryConfig<T>>
): QueryConfig<T> => {
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
 * Create a new query builder instance
 */
export function query(): QueryBuilder<readonly []> {
  return new QueryBuilderImpl<readonly []>()
}

/**
 * SoA Query Service
 */
export const SoAQueryService = Context.GenericTag<{
  readonly execute: <T extends ReadonlyArray<ComponentName>>(
    components: T,
    entities: ReadonlyArray<QueryEntity>
  ) => Effect.Effect<SoAQueryResult<T>>
}>('SoAQueryService')

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
 * Execute SoA query - returns component arrays for vectorized operations
 */
const executeSoAQuery = <T extends ReadonlyArray<ComponentName>>(
  components: T,
  entities: ReadonlyArray<QueryEntity>
): Effect.Effect<SoAQueryResult<T>> =>
  Effect.gen(function* () {
    const matchingEntities: QueryEntity[] = []
    const componentArrays: Record<string, unknown[]> = {}

    // Initialize component arrays
    for (const componentName of components) {
      componentArrays[componentName] = []
    }

    // Filter and collect matching entities and their components
    for (const entity of entities) {
      const hasAllComponents = components.every(comp => entity.components[comp] !== undefined)
      
      if (hasAllComponents) {
        matchingEntities.push(entity)
        
        // Add components to arrays
        for (const componentName of components) {
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
  })

/**
 * SoA Query Service Implementation
 */
export const SoAQueryServiceLive = Layer.succeed(
  SoAQueryService,
  SoAQueryService.of({
    execute: executeSoAQuery
  })
)

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
  execute(entities: ReadonlyArray<QueryEntity>): Effect.Effect<SoAQueryResult<T>> {
    return executeSoAQuery(this.components, entities)
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
 * AoS Query Service
 */
export const AoSQueryService = Context.GenericTag<{
  readonly execute: <T extends ReadonlyArray<ComponentName>>(
    components: T,
    entities: ReadonlyArray<QueryEntity>
  ) => Effect.Effect<AoSQueryResult<T>>
}>('AoSQueryService')

/**
 * Array of Structures Query result type
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
 * Execute AoS query - returns entities with their component data
 */
const executeAoSQuery = <T extends ReadonlyArray<ComponentName>>(
  components: T,
  entities: ReadonlyArray<QueryEntity>
): Effect.Effect<AoSQueryResult<T>> =>
  Effect.gen(function* () {
    const result: Array<{
      entity: QueryEntity
      components: any
    }> = []

    for (const entity of entities) {
      const hasAllComponents = components.every(comp => entity.components[comp] !== undefined)
      
      if (hasAllComponents) {
        const entityComponents: Record<string, unknown> = {}
        
        for (const componentName of components) {
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
  })

/**
 * AoS Query Service Implementation
 */
export const AoSQueryServiceLive = Layer.succeed(
  AoSQueryService,
  AoSQueryService.of({
    execute: executeAoSQuery
  })
)

/**
 * Array of Structures Query for traditional entity iteration
 */
export class AoSQuery<T extends ReadonlyArray<ComponentName>> {
  constructor(
    public readonly components: T,
    public readonly name: string = `aos-${components.join('-')}`
  ) {}

  /**
   * Execute AoS query - returns entities with their component data
   */
  execute(entities: ReadonlyArray<QueryEntity>): Effect.Effect<AoSQueryResult<T>> {
    return executeAoSQuery(this.components, entities)
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
    return validateQueryConfig(config)
  }

  /**
   * Execute query with given configuration
   */
  static async executeQuery<T extends ReadonlyArray<ComponentName>>(
    config: QueryConfig<T>,
    entities?: ReadonlyArray<QueryEntity>
  ): Promise<{ entities: ReadonlyArray<QueryEntity>; metrics: QueryMetrics }> {
    throw new Error('Legacy QueryBuilder.executeQuery() not supported. Use ArchetypeQueryService or OptimizedQueryService instead.')
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

/**
 * Query Builder Service Implementation
 */
export const QueryBuilderServiceLive = Layer.succeed(
  QueryBuilderService,
  QueryBuilderService.of({
    createQuery: () => query(),
    withComponents: <T extends ReadonlyArray<ComponentName>, K extends ComponentName[]>(
      builder: QueryBuilder<T>,
      ...components: K
    ) => builder.with(...components),
    withoutComponents: <T extends ReadonlyArray<ComponentName>>(
      builder: QueryBuilder<T>,
      ...components: ComponentName[]
    ) => builder.without(...components),
    withPredicate: <T extends ReadonlyArray<ComponentName>>(
      builder: QueryBuilder<T>,
      predicate: EntityPredicate<T>
    ) => builder.where(predicate),
    withName: <T extends ReadonlyArray<ComponentName>>(
      builder: QueryBuilder<T>,
      name: string
    ) => builder.named(name),
    withPriority: <T extends ReadonlyArray<ComponentName>>(
      builder: QueryBuilder<T>,
      priority: number
    ) => builder.priority(priority),
    buildArchetype: <T extends ReadonlyArray<ComponentName>>(
      builder: QueryBuilder<T>
    ) => builder.build(),
    buildOptimized: <T extends ReadonlyArray<ComponentName>>(
      builder: QueryBuilder<T>
    ) => builder.buildOptimized()
  })
)