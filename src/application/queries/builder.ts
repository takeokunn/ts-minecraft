/**
 * Modern Query Builder System (Functional) for TypeScript Minecraft
 * Provides fluent API for entity queries with optimization and caching using Effect-TS
 */

import { Effect, pipe } from 'effect'
import { ComponentName, ComponentOfName } from '@domain/entities/components'
import { createArchetypeQuery, type ArchetypeQueryService } from '@application/queries/archetype-query'
import type { OptimizedQueryService } from '@application/queries/optimized-query'
import { EntityId } from '@domain/entities'

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
 * Fluent Query Builder Interface (Functional)
 */
export interface QueryBuilder<T extends ReadonlyArray<ComponentName> = readonly []> {
  with<K extends ComponentName>(...components: K[]): QueryBuilder<readonly [...T, ...K[]]>
  without(...components: ComponentName[]): QueryBuilder<T>
  where(predicate: EntityPredicate<T>): QueryBuilder<T>
  named(name: string): QueryBuilder<T>
  priority(level: number): QueryBuilder<T>
  build(): Effect.Effect<ArchetypeQueryService<T>>
  buildOptimized(): Effect.Effect<OptimizedQueryService<T>>
}

/**
 * Functional query builder implementation
 */
const createQueryBuilderImpl = <T extends ReadonlyArray<ComponentName>>(
  config: Partial<QueryConfig<T>> = {}
): QueryBuilder<T> => {
  const currentConfig: Partial<QueryConfig<T>> = {
    withComponents: (config.withComponents || []) as T,
    withoutComponents: [],
    priority: 5,
    ...config,
  }

  const validateConfig = (cfg: Partial<QueryConfig<T>>): QueryConfig<T> => {
    if (!cfg.withComponents || cfg.withComponents.length === 0) {
      throw new Error('Query must specify at least one component with with()')
    }

    if (!cfg.name) {
      // Auto-generate name from components
      const componentsList = [...cfg.withComponents].sort().join('-')
      const withoutList = cfg.withoutComponents?.length ? `-without-${[...cfg.withoutComponents].sort().join('-')}` : ''
      cfg.name = `query-${componentsList}${withoutList}`
    }

    return cfg as QueryConfig<T>
  }

  return {
    with: <K extends ComponentName>(...components: K[]) => {
      const newWithComponents = [...(currentConfig.withComponents || []), ...components] as readonly [...T, ...K[]]
      return createQueryBuilderImpl<readonly [...T, ...K[]]>({
        ...currentConfig,
        withComponents: newWithComponents,
      })
    },

    without: (...components: ComponentName[]) => {
      return createQueryBuilderImpl<T>({
        ...currentConfig,
        withoutComponents: [...(currentConfig.withoutComponents || []), ...components],
      })
    },

    where: (predicate: EntityPredicate<T>) => {
      return createQueryBuilderImpl<T>({
        ...currentConfig,
        predicate,
      })
    },

    named: (name: string) => {
      return createQueryBuilderImpl<T>({
        ...currentConfig,
        name,
      })
    },

    priority: (level: number) => {
      return createQueryBuilderImpl<T>({
        ...currentConfig,
        priority: level,
      })
    },

    build: () => {
      const validatedConfig = validateConfig(currentConfig)
      return createArchetypeQuery(validatedConfig)
    },

    buildOptimized: () => {
      // This would need to be implemented with proper OptimizedQueryService creation
      return Effect.fail(new Error('buildOptimized() requires OptimizedQueryService implementation'))
    }
  }
}

/**
 * Create a new query builder instance
 */
export function query(): QueryBuilder<readonly []> {
  return createQueryBuilderImpl<readonly []>()
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
 * SoA Query service interface
 */
export interface SoAQueryService<T extends ReadonlyArray<ComponentName>> {
  readonly components: T
  readonly name: string
  readonly execute: (entities: ReadonlyArray<QueryEntity>) => Effect.Effect<SoAQueryResult<T>>
}

/**
 * Create Structure of Arrays Query for high-performance bulk operations
 */
export const createSoAQuery = <T extends ReadonlyArray<ComponentName>>(
  components: T,
  name: string = `soa-${components.join('-')}`
): SoAQueryService<T> => {
  const execute = (entities: ReadonlyArray<QueryEntity>) =>
    Effect.gen(function* () {
      const matchingEntities: QueryEntity[] = []
      const componentArrays: Record<string, unknown[]> = {}

      // Initialize component arrays
      for (const componentName of components) {
        componentArrays[componentName] = []
      }

      // Filter and collect matching entities and their components
      for (const entity of entities) {
        const hasAllComponents = components.every((comp) => entity.components[comp] !== undefined)

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

  return {
    components,
    name,
    execute
  }
}

/**
 * Create SoA query for bulk operations
 */
export function soaQuery<T extends ReadonlyArray<ComponentName>>(...components: T): SoAQueryService<T> {
  return createSoAQuery(components)
}

/**
 * Array of Structures Query for traditional entity iteration
 */
export interface AoSQueryResult<T extends ReadonlyArray<ComponentName>> {
  entities: ReadonlyArray<{
    entity: QueryEntity
    components: {
      [K in keyof T]: T[K] extends ComponentName ? ComponentOfName<T[K]> : never
    }
  }>
  length: number
}

/**
 * AoS Query service interface
 */
export interface AoSQueryService<T extends ReadonlyArray<ComponentName>> {
  readonly components: T
  readonly name: string
  readonly execute: (entities: ReadonlyArray<QueryEntity>) => Effect.Effect<AoSQueryResult<T>>
}

/**
 * Create Array of Structures Query for entity-centric operations
 */
export const createAoSQuery = <T extends ReadonlyArray<ComponentName>>(
  components: T,
  name: string = `aos-${components.join('-')}`
): AoSQueryService<T> => {
  const execute = (entities: ReadonlyArray<QueryEntity>) =>
    Effect.gen(function* () {
      const result: Array<{
        entity: QueryEntity
        components: any
      }> = []

      for (const entity of entities) {
        const hasAllComponents = components.every((comp) => entity.components[comp] !== undefined)

        if (hasAllComponents) {
          const entityComponents: Record<string, unknown> = {}

          for (const componentName of components) {
            entityComponents[componentName] = entity.components[componentName]
          }

          result.push({
            entity,
            components: entityComponents as Record<ComponentName, unknown>,
          })
        }
      }

      return {
        entities: result,
        length: result.length,
      }
    })

  return {
    components,
    name,
    execute
  }
}

/**
 * Create AoS query for entity-centric operations
 */
export function aosQuery<T extends ReadonlyArray<ComponentName>>(...components: T): AoSQueryService<T> {
  return createAoSQuery(components)
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
 * Functional query builder utilities
 */
export const QueryBuilderUtils = {
  /**
   * Create initial query builder state
   */
  createState: <T extends ReadonlyArray<ComponentName> = readonly []>(): QueryBuilderState<T> => ({
    config: {
      withComponents: [] as unknown as T,
      withoutComponents: [],
      priority: 5,
    },
  }),

  /**
   * Add required components to state
   */
  withComponents: <T extends ReadonlyArray<ComponentName>, K extends ComponentName[]>(
    state: QueryBuilderState<T>,
    ...components: K
  ): QueryBuilderState<readonly [...T, ...K]> => ({
    config: {
      ...state.config,
      withComponents: [...(state.config.withComponents || []), ...components] as readonly [...T, ...K],
    },
  }),

  /**
   * Add forbidden components to state
   */
  withoutComponents: <T extends ReadonlyArray<ComponentName>>(
    state: QueryBuilderState<T>,
    ...components: ComponentName[]
  ): QueryBuilderState<T> => ({
    config: {
      ...state.config,
      withoutComponents: [...(state.config.withoutComponents || []), ...components],
    },
  }),

  /**
   * Add predicate to state
   */
  withPredicate: <T extends ReadonlyArray<ComponentName>>(
    state: QueryBuilderState<T>,
    predicate: EntityPredicate<T>
  ): QueryBuilderState<T> => ({
    config: {
      ...state.config,
      predicate,
    },
  }),

  /**
   * Set query name
   */
  withName: <T extends ReadonlyArray<ComponentName>>(
    state: QueryBuilderState<T>,
    name: string
  ): QueryBuilderState<T> => ({
    config: {
      ...state.config,
      name,
    },
  }),

  /**
   * Set query priority
   */
  withPriority: <T extends ReadonlyArray<ComponentName>>(
    state: QueryBuilderState<T>,
    priority: number
  ): QueryBuilderState<T> => ({
    config: {
      ...state.config,
      priority,
    },
  }),

  /**
   * Validate query configuration
   */
  validateConfig: <T extends ReadonlyArray<ComponentName>>(config: Partial<QueryConfig<T>>) =>
    Effect.gen(function* () {
      if (!config.withComponents || config.withComponents.length === 0) {
        yield* Effect.fail(new Error('Query must specify at least one component with with()'))
      }

      if (!config.name) {
        // Auto-generate name from components
        const componentsList = [...config.withComponents!].sort().join('-')
        const withoutList = config.withoutComponents?.length ? `-without-${[...config.withoutComponents].sort().join('-')}` : ''
        config.name = `query-${componentsList}${withoutList}`
      }

      return config as QueryConfig<T>
    }),

  /**
   * Execute query with given configuration
   */
  executeQuery: <T extends ReadonlyArray<ComponentName>>(
    config: QueryConfig<T>,
    entities?: ReadonlyArray<QueryEntity>
  ) =>
    Effect.gen(function* () {
      const query = yield* createArchetypeQuery(config)
      return yield* query.execute(entities)
    }),

  /**
   * Create entity proxy for component access
   */
  createEntityProxy: <T extends ReadonlyArray<ComponentName>>(entity: QueryEntity): EntityProxy<T> => ({
    get: <K extends ComponentName>(componentName: K) => {
      return entity.components[componentName] as ComponentOfName<K>
    },
    has: <K extends ComponentName>(componentName: K) => {
      return entity.components[componentName] !== undefined
    },
    id: entity.id,
  })
}

/**
 * Create entity proxy for component access (convenience function)
 */
export function createEntityProxy<T extends ReadonlyArray<ComponentName>>(entity: QueryEntity): EntityProxy<T> {
  return QueryBuilderUtils.createEntityProxy(entity)
}
