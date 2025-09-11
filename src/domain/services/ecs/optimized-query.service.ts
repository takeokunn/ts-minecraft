/**
 * Optimized Query Execution System (Effect-TS Implementation)
 * High-performance query execution with indexing, caching, and parallel processing
 */

import { 
  Effect, 
  Context, 
  Layer, 
  HashMap, 
  HashSet, 
  ReadonlyArray, 
  Option, 
  pipe, 
  Ref, 
  Cache, 
  Duration,
  Fiber,
  FiberRef,
  Chunk,
  Stream,
  Schedule,
  Metric
} from 'effect'
import * as S from 'effect/Schema'
import { EntityId, ComponentName, Entity, QueryMetrics } from './archetype-query.service'

// ============================================================================
// Schema Definitions
// ============================================================================

export const IndexType = S.Literal('hash', 'btree', 'spatial', 'bitmap')
export type IndexType = S.Schema.Type<typeof IndexType>

export const Index = S.Struct({
  name: S.String,
  type: IndexType,
  componentName: ComponentName,
  field: S.optional(S.String),
  stats: S.Struct({
    size: S.Number,
    hits: S.Number,
    misses: S.Number,
    lastUsed: S.Number
  })
})
export type Index = S.Schema.Type<typeof Index>

export const QueryOptimization = S.Struct({
  type: S.Literal('index', 'cache', 'parallel', 'batch', 'stream'),
  description: S.String,
  estimatedSpeedup: S.Number
})
export type QueryOptimization = S.Schema.Type<typeof QueryOptimization>

export const ExecutionPlan = S.Struct({
  queryId: S.String,
  steps: S.Array(S.Struct({
    operation: S.String,
    estimatedCost: S.Number,
    useIndex: S.optional(S.String),
    parallel: S.Boolean
  })),
  totalCost: S.Number,
  optimizations: S.Array(QueryOptimization),
  estimatedTime: S.Number
})
export type ExecutionPlan = S.Schema.Type<typeof ExecutionPlan>

// ============================================================================
// Index Management Service
// ============================================================================

export interface IndexService {
  readonly createIndex: (
    name: string,
    type: IndexType,
    componentName: ComponentName,
    field?: string
  ) => Effect.Effect<void>
  
  readonly dropIndex: (name: string) => Effect.Effect<void>
  
  readonly lookupIndex: <T>(
    indexName: string,
    key: unknown
  ) => Effect.Effect<ReadonlyArray<EntityId>>
  
  readonly updateIndex: (
    indexName: string,
    entityId: EntityId,
    oldValue: unknown,
    newValue: unknown
  ) => Effect.Effect<void>
  
  readonly getIndexStats: () => Effect.Effect<ReadonlyArray<Index>>
  
  readonly optimizeIndices: () => Effect.Effect<void>
}

export const IndexService = Context.GenericTag<IndexService>('IndexService')

// ============================================================================
// Query Optimizer Service
// ============================================================================

export interface QueryOptimizerService {
  readonly analyze: (
    queryId: string,
    components: ReadonlyArray<ComponentName>,
    conditions?: ReadonlyArray<any>
  ) => Effect.Effect<ExecutionPlan>
  
  readonly optimize: (plan: ExecutionPlan) => Effect.Effect<ExecutionPlan>
  
  readonly selectIndex: (
    component: ComponentName,
    field?: string
  ) => Effect.Effect<Option.Option<string>>
  
  readonly estimateCost: (
    operation: string,
    entityCount: number
  ) => Effect.Effect<number>
  
  readonly getStatistics: () => Effect.Effect<{
    totalQueries: number
    averageExecutionTime: number
    cacheHitRate: number
    indexUsageRate: number
  }>
}

export const QueryOptimizerService = Context.GenericTag<QueryOptimizerService>('QueryOptimizerService')

// ============================================================================
// Parallel Query Executor
// ============================================================================

export interface ParallelQueryExecutor {
  readonly execute: <T>(
    tasks: ReadonlyArray<Effect.Effect<T>>,
    options?: {
      concurrency?: number
      batchSize?: number
      timeout?: Duration.Duration
    }
  ) => Effect.Effect<ReadonlyArray<T>>
  
  readonly stream: <T>(
    source: Stream.Stream<T>,
    transform: (item: T) => Effect.Effect<T>,
    options?: {
      bufferSize?: number
      concurrency?: number
    }
  ) => Stream.Stream<T>
  
  readonly mapReduce: <T, R>(
    items: ReadonlyArray<T>,
    mapper: (item: T) => Effect.Effect<R>,
    reducer: (acc: R, item: R) => R,
    initial: R,
    options?: {
      concurrency?: number
    }
  ) => Effect.Effect<R>
}

export const ParallelQueryExecutor = Context.GenericTag<ParallelQueryExecutor>('ParallelQueryExecutor')

// ============================================================================
// Index Service Implementation
// ============================================================================

export const IndexServiceLive = Layer.effect(
  IndexService,
  Effect.gen(function* () {
    // Index storage
    const indices = yield* Ref.make(HashMap.empty<string, {
      type: IndexType
      componentName: ComponentName
      field?: string
      data: HashMap.HashMap<unknown, HashSet.HashSet<EntityId>>
      stats: {
        size: number
        hits: number
        misses: number
        lastUsed: number
      }
    }>())
    
    const createIndex = (
      name: string,
      type: IndexType,
      componentName: ComponentName,
      field?: string
    ) =>
      Effect.gen(function* () {
        const existing = yield* Ref.get(indices)
        
        if (HashMap.has(existing, name)) {
          return yield* Effect.fail(new Error(`Index ${name} already exists`))
        }
        
        yield* Ref.update(indices, map =>
          HashMap.set(map, name, {
            type,
            componentName,
            field,
            data: HashMap.empty(),
            stats: {
              size: 0,
              hits: 0,
              misses: 0,
              lastUsed: Date.now()
            }
          })
        )
      })
    
    const dropIndex = (name: string) =>
      Effect.gen(function* () {
        yield* Ref.update(indices, map => HashMap.remove(map, name))
      })
    
    const lookupIndex = <T>(indexName: string, key: unknown) =>
      Effect.gen(function* () {
        const indexMap = yield* Ref.get(indices)
        const index = HashMap.get(indexMap, indexName)
        
        return yield* Option.match(index, {
          onNone: () => {
            // Update miss stats
            yield* Ref.update(indices, map =>
              HashMap.modify(map, indexName, idx => {
                if (idx) {
                  idx.stats.misses++
                  idx.stats.lastUsed = Date.now()
                }
                return idx
              })
            )
            return Effect.succeed([] as ReadonlyArray<EntityId>)
          },
          onSome: idx => {
            const entities = HashMap.get(idx.data, key)
            
            // Update hit stats
            yield* Ref.update(indices, map =>
              HashMap.modify(map, indexName, index => {
                if (index) {
                  index.stats.hits++
                  index.stats.lastUsed = Date.now()
                }
                return index
              })
            )
            
            return Effect.succeed(
              Option.match(entities, {
                onNone: () => [] as ReadonlyArray<EntityId>,
                onSome: set => Array.from(set)
              })
            )
          }
        })
      })
    
    const updateIndex = (
      indexName: string,
      entityId: EntityId,
      oldValue: unknown,
      newValue: unknown
    ) =>
      Effect.gen(function* () {
        yield* Ref.update(indices, map =>
          HashMap.modify(map, indexName, index => {
            if (!index) return index
            
            // Remove from old value
            if (oldValue !== undefined) {
              const oldSet = HashMap.get(index.data, oldValue)
              if (Option.isSome(oldSet)) {
                index.data = HashMap.set(
                  index.data,
                  oldValue,
                  HashSet.remove(oldSet.value, entityId)
                )
              }
            }
            
            // Add to new value
            if (newValue !== undefined) {
              const newSet = Option.getOrElse(
                HashMap.get(index.data, newValue),
                () => HashSet.empty<EntityId>()
              )
              index.data = HashMap.set(
                index.data,
                newValue,
                HashSet.add(newSet, entityId)
              )
            }
            
            index.stats.size = HashMap.size(index.data)
            index.stats.lastUsed = Date.now()
            
            return index
          })
        )
      })
    
    const getIndexStats = () =>
      Effect.gen(function* () {
        const indexMap = yield* Ref.get(indices)
        
        return pipe(
          HashMap.entries(indexMap),
          ReadonlyArray.fromIterable,
          ReadonlyArray.map(([name, idx]) => ({
            name,
            type: idx.type,
            componentName: idx.componentName,
            field: idx.field,
            stats: idx.stats
          }))
        )
      })
    
    const optimizeIndices = () =>
      Effect.gen(function* () {
        const indexMap = yield* Ref.get(indices)
        const now = Date.now()
        const staleThreshold = 60000 // 1 minute
        
        // Remove stale indices
        const activeIndices = pipe(
          HashMap.entries(indexMap),
          ReadonlyArray.fromIterable,
          ReadonlyArray.filter(([_, idx]) => 
            now - idx.stats.lastUsed < staleThreshold
          )
        )
        
        yield* Ref.set(indices, HashMap.fromIterable(activeIndices))
      })
    
    return {
      createIndex,
      dropIndex,
      lookupIndex,
      updateIndex,
      getIndexStats,
      optimizeIndices
    }
  })
)

// ============================================================================
// Query Optimizer Implementation
// ============================================================================

export const QueryOptimizerServiceLive = Layer.effect(
  QueryOptimizerService,
  Effect.gen(function* () {
    const indexService = yield* IndexService
    const queryStats = yield* Ref.make({
      totalQueries: 0,
      totalExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      indexHits: 0,
      indexMisses: 0
    })
    
    const analyze = (
      queryId: string,
      components: ReadonlyArray<ComponentName>,
      conditions?: ReadonlyArray<any>
    ) =>
      Effect.gen(function* () {
        const steps: ExecutionPlan['steps'] = []
        const optimizations: QueryOptimization[] = []
        let totalCost = 0
        
        // Step 1: Component filtering
        for (const component of components) {
          const indexName = yield* selectIndex(component)
          const useIndex = Option.isSome(indexName)
          
          const cost = useIndex ? 1 : 10
          totalCost += cost
          
          steps.push({
            operation: `Filter by ${component}`,
            estimatedCost: cost,
            useIndex: useIndex ? indexName.value : undefined,
            parallel: !useIndex
          })
          
          if (useIndex) {
            optimizations.push({
              type: 'index',
              description: `Using index for ${component}`,
              estimatedSpeedup: 10
            })
          }
        }
        
        // Step 2: Condition evaluation
        if (conditions && conditions.length > 0) {
          const conditionCost = conditions.length * 5
          totalCost += conditionCost
          
          steps.push({
            operation: 'Evaluate conditions',
            estimatedCost: conditionCost,
            useIndex: undefined,
            parallel: true
          })
          
          if (conditions.length > 10) {
            optimizations.push({
              type: 'parallel',
              description: 'Parallel condition evaluation',
              estimatedSpeedup: 3
            })
          }
        }
        
        // Suggest caching for expensive queries
        if (totalCost > 50) {
          optimizations.push({
            type: 'cache',
            description: 'Query result caching recommended',
            estimatedSpeedup: 20
          })
        }
        
        return {
          queryId,
          steps,
          totalCost,
          optimizations,
          estimatedTime: totalCost * 0.1 // Rough estimate in ms
        }
      })
    
    const optimize = (plan: ExecutionPlan) =>
      Effect.gen(function* () {
        // Reorder steps for optimal execution
        const optimizedSteps = [...plan.steps].sort((a, b) => {
          // Prioritize indexed operations
          if (a.useIndex && !b.useIndex) return -1
          if (!a.useIndex && b.useIndex) return 1
          
          // Then by cost
          return a.estimatedCost - b.estimatedCost
        })
        
        // Add batching optimization for large queries
        if (plan.totalCost > 100) {
          plan.optimizations.push({
            type: 'batch',
            description: 'Batch processing for large result sets',
            estimatedSpeedup: 2
          })
        }
        
        // Add streaming for very large queries
        if (plan.totalCost > 500) {
          plan.optimizations.push({
            type: 'stream',
            description: 'Stream processing for memory efficiency',
            estimatedSpeedup: 1.5
          })
        }
        
        return {
          ...plan,
          steps: optimizedSteps,
          totalCost: optimizedSteps.reduce((sum, step) => sum + step.estimatedCost, 0)
        }
      })
    
    const selectIndex = (component: ComponentName, field?: string) =>
      Effect.gen(function* () {
        const indices = yield* indexService.getIndexStats()
        
        // Find best matching index
        const matching = indices.filter(idx =>
          idx.componentName === component &&
          (!field || idx.field === field)
        )
        
        if (matching.length === 0) {
          return Option.none()
        }
        
        // Select index with best hit rate
        const best = matching.reduce((a, b) => {
          const aHitRate = a.stats.hits / (a.stats.hits + a.stats.misses + 1)
          const bHitRate = b.stats.hits / (b.stats.hits + b.stats.misses + 1)
          return aHitRate > bHitRate ? a : b
        })
        
        return Option.some(best.name)
      })
    
    const estimateCost = (operation: string, entityCount: number) =>
      Effect.succeed(
        operation === 'scan' ? entityCount :
        operation === 'index_lookup' ? Math.log2(entityCount + 1) :
        operation === 'filter' ? entityCount * 0.1 :
        entityCount * 0.5
      )
    
    const getStatistics = () =>
      Effect.gen(function* () {
        const stats = yield* Ref.get(queryStats)
        
        return {
          totalQueries: stats.totalQueries,
          averageExecutionTime: stats.totalQueries > 0 
            ? stats.totalExecutionTime / stats.totalQueries 
            : 0,
          cacheHitRate: stats.cacheHits + stats.cacheMisses > 0
            ? stats.cacheHits / (stats.cacheHits + stats.cacheMisses)
            : 0,
          indexUsageRate: stats.indexHits + stats.indexMisses > 0
            ? stats.indexHits / (stats.indexHits + stats.indexMisses)
            : 0
        }
      })
    
    return {
      analyze,
      optimize,
      selectIndex,
      estimateCost,
      getStatistics
    }
  })
)

// ============================================================================
// Parallel Query Executor Implementation
// ============================================================================

export const ParallelQueryExecutorLive = Layer.effect(
  ParallelQueryExecutor,
  Effect.gen(function* () {
    const execute = <T>(
      tasks: ReadonlyArray<Effect.Effect<T>>,
      options?: {
        concurrency?: number
        batchSize?: number
        timeout?: Duration.Duration
      }
    ) =>
      Effect.gen(function* () {
        const concurrency = options?.concurrency ?? 10
        const batchSize = options?.batchSize ?? 100
        const timeout = options?.timeout ?? Duration.seconds(30)
        
        // Split into batches
        const batches = Chunk.fromIterable(tasks).pipe(
          Chunk.chunksOf(batchSize)
        )
        
        // Execute batches with concurrency control
        const results = yield* Effect.forEach(
          batches,
          batch =>
            Effect.all(Chunk.toReadonlyArray(batch), { concurrency }),
          { concurrency: 1 } // Process batches sequentially
        ).pipe(
          Effect.timeout(timeout),
          Effect.catchTag('TimeoutException', () =>
            Effect.fail(new Error('Query execution timeout'))
          )
        )
        
        return results.flat()
      })
    
    const stream = <T>(
      source: Stream.Stream<T>,
      transform: (item: T) => Effect.Effect<T>,
      options?: {
        bufferSize?: number
        concurrency?: number
      }
    ) => {
      const bufferSize = options?.bufferSize ?? 1000
      const concurrency = options?.concurrency ?? 10
      
      return source.pipe(
        Stream.buffer({ capacity: bufferSize }),
        Stream.mapEffect(transform, { concurrency }),
        Stream.catchAll(error =>
          Stream.fromEffect(
            Effect.logError(`Stream processing error: ${error}`)
          ).pipe(Stream.drain)
        )
      )
    }
    
    const mapReduce = <T, R>(
      items: ReadonlyArray<T>,
      mapper: (item: T) => Effect.Effect<R>,
      reducer: (acc: R, item: R) => R,
      initial: R,
      options?: {
        concurrency?: number
      }
    ) =>
      Effect.gen(function* () {
        const concurrency = options?.concurrency ?? 10
        
        // Map phase
        const mapped = yield* Effect.forEach(
          items,
          mapper,
          { concurrency }
        )
        
        // Reduce phase
        return mapped.reduce(reducer, initial)
      })
    
    return {
      execute,
      stream,
      mapReduce
    }
  })
)

// ============================================================================
// Optimized Query Execution Layer
// ============================================================================

export const OptimizedQuerySystemLive = Layer.mergeAll(
  IndexServiceLive,
  QueryOptimizerServiceLive,
  ParallelQueryExecutorLive
)

// ============================================================================
// Query Performance Metrics
// ============================================================================

export const queryMetrics = {
  executionTime: Metric.histogram('query_execution_time', {
    description: 'Query execution time in milliseconds',
    boundaries: Chunk.fromIterable([1, 5, 10, 25, 50, 100, 250, 500, 1000])
  }),
  
  resultCount: Metric.histogram('query_result_count', {
    description: 'Number of entities returned by queries',
    boundaries: Chunk.fromIterable([0, 10, 50, 100, 500, 1000, 5000, 10000])
  }),
  
  cacheHits: Metric.counter('query_cache_hits', {
    description: 'Number of query cache hits'
  }),
  
  cacheMisses: Metric.counter('query_cache_misses', {
    description: 'Number of query cache misses'
  })
}

// ============================================================================
// Helper Functions
// ============================================================================

export const withMetrics = <R, E, A>(
  queryName: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    
    try {
      const result = yield* effect
      const duration = Date.now() - startTime
      
      yield* Metric.update(queryMetrics.executionTime, duration)
      
      if (Array.isArray(result)) {
        yield* Metric.update(queryMetrics.resultCount, result.length)
      }
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      yield* Metric.update(queryMetrics.executionTime, duration)
      throw error
    }
  })

export const createOptimizedQuery = (name: string) =>
  Effect.gen(function* () {
    const optimizer = yield* QueryOptimizerService
    const executor = yield* ParallelQueryExecutor
    
    return {
      analyze: (components: ComponentName[]) =>
        optimizer.analyze(name, components),
      
      execute: <T>(effect: Effect.Effect<T>) =>
        withMetrics(name, effect),
      
      parallel: <T>(tasks: ReadonlyArray<Effect.Effect<T>>) =>
        executor.execute(tasks),
      
      stream: <T>(source: Stream.Stream<T>, transform: (item: T) => Effect.Effect<T>) =>
        executor.stream(source, transform)
    }
  })