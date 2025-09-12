/**
 * Advanced Query Builder System (Effect-TS Implementation)
 * Provides fluent API for building complex ECS queries with optimizations
 */

import { Effect, Context, Layer, pipe, Option, ReadonlyArray, Duration, Chunk, Stream } from 'effect'
import * as S from '@effect/schema/Schema'
import { EntityId, ComponentName, Entity, QueryService, ArchetypeService, QueryMetrics } from '@domain/services/ecs/archetype-query.service'
import { ComponentService } from '@domain/services/ecs/component.service'

// ============================================================================
// Value validation utilities
// ============================================================================

// Schema definitions for query value validation
const QueryValueSchema = S.Union(
  S.String,
  S.Number,
  S.Boolean,
  S.Null,
  S.Array(S.Unknown),
  S.Record(S.String, S.Unknown),
  S.Unknown
)

const validateQueryValue = (value: unknown): Effect.Effect<unknown, never, never> => {
  return Effect.gen(function* () {
    try {
      const validated = S.parseSync(QueryValueSchema)(value)
      return validated
    } catch {
      // Fall back to original logic if schema validation fails
      if (value == null) return null
      if (Array.isArray(value)) return value
      if (typeof value === 'object') return value
      return value
    }
  })
}

const validateFieldValue = (entity: Entity, field: string): Effect.Effect<unknown, never, never> => {
  return Effect.gen(function* () {
    try {
      const fieldParts = field.split('.')
      let current: unknown = entity

      for (const part of fieldParts) {
        if (current == null) return null

        // Use schema validation for safer type checking
        const objectSchema = S.Record(S.String, S.Unknown)
        const parseResult = S.parseSync(objectSchema)(current)
        
        if (typeof parseResult === 'object' && parseResult !== null && part in parseResult) {
          current = (parseResult as Record<string, unknown>)[part]
        } else {
          return null
        }
      }

      // Validate the final value using our query value schema
      const validatedResult = yield* validateQueryValue(current)
      return validatedResult
    } catch {
      return null
    }
  })
}

const validateConditionValue = (value: unknown, operator: QueryCondition['operator'], expected: unknown): Effect.Effect<boolean, never, never> => {
  return Effect.gen(function* () {
    try {
      const validatedValue = yield* validateQueryValue(value)
      const validatedExpected = yield* validateQueryValue(expected)

      switch (operator) {
        case '=':
          return validatedValue === validatedExpected
        case '!=':
          return validatedValue !== validatedExpected
        case '>':
          return typeof validatedValue === 'number' && typeof validatedExpected === 'number' ? validatedValue > validatedExpected : false
        case '<':
          return typeof validatedValue === 'number' && typeof validatedExpected === 'number' ? validatedValue < validatedExpected : false
        case '>=':
          return typeof validatedValue === 'number' && typeof validatedExpected === 'number' ? validatedValue >= validatedExpected : false
        case '<=':
          return typeof validatedValue === 'number' && typeof validatedExpected === 'number' ? validatedValue <= validatedExpected : false
        case 'IN':
          return Array.isArray(validatedExpected) ? validatedExpected.includes(validatedValue) : false
        case 'NOT_IN':
          return Array.isArray(validatedExpected) ? !validatedExpected.includes(validatedValue) : true
        case 'CONTAINS':
          if (typeof validatedValue === 'string' && typeof validatedExpected === 'string') {
            return validatedValue.includes(validatedExpected)
          }
          if (Array.isArray(validatedValue)) {
            return validatedValue.includes(validatedExpected)
          }
          return false
        default:
          return false
      }
    } catch {
      return false
    }
  })
}

// ============================================================================
// Schema Definitions
// ============================================================================

export const QueryOperator = S.Literal('AND', 'OR', 'NOT', 'XOR')
export type QueryOperator = S.Schema.Type<typeof QueryOperator>

export const QueryCondition = S.Struct({
  field: S.String,
  operator: S.Literal('=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT_IN', 'CONTAINS'),
  value: S.Unknown,
})
export type QueryCondition = S.Schema.Type<typeof QueryCondition>

export const QueryNode = S.Struct({
  operator: QueryOperator,
  children: S.Array(S.lazy(() => QueryExpression)),
})
export type QueryNode = S.Schema.Type<typeof QueryNode>

export const QueryExpression = S.Union(
  S.Struct({ type: S.Literal('component'), value: ComponentName }),
  S.Struct({ type: S.Literal('condition'), value: QueryCondition }),
  S.Struct({ type: S.Literal('node'), value: QueryNode }),
)
export type QueryExpression = S.Schema.Type<typeof QueryExpression>

export const QueryPlan = S.Struct({
  expression: QueryExpression,
  estimatedCost: S.Number,
  optimizations: S.Array(S.String),
  cacheable: S.Boolean,
})
export type QueryPlan = S.Schema.Type<typeof QueryPlan>

// ============================================================================
// Query Builder Service
// ============================================================================

export interface QueryBuilderService {
  readonly create: (name: string) => QueryBuilder

  readonly optimize: (expression: QueryExpression) => Effect.Effect<QueryPlan>

  readonly compile: (plan: QueryPlan) => Effect.Effect<CompiledQuery>

  readonly explain: (expression: QueryExpression) => Effect.Effect<string>
}

export const QueryBuilderService = Context.GenericTag<QueryBuilderService>('QueryBuilderService')

// ============================================================================
// Query Builder Interface
// ============================================================================

export interface QueryBuilder {
  with(...components: ComponentName[]): QueryBuilder
  without(...components: ComponentName[]): QueryBuilder
  where(field: string, operator: QueryCondition['operator'], value: unknown): QueryBuilder
  and(builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder
  or(builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder
  not(builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder

  // Execution methods
  execute(): Effect.Effect<ReadonlyArray<Entity>>
  stream(): Stream.Stream<Entity>
  count(): Effect.Effect<number>
  exists(): Effect.Effect<boolean>
  first(): Effect.Effect<Option.Option<Entity>>

  // Performance methods
  cached(ttl?: Duration.Duration): Effect.Effect<ReadonlyArray<Entity>>
  parallel(batchSize?: number): Effect.Effect<ReadonlyArray<Entity>>
  lazy(): Effect.Effect<() => Effect.Effect<ReadonlyArray<Entity>>>

  // Analysis methods
  explain(): Effect.Effect<string>
  getCost(): Effect.Effect<number>
  getPlan(): Effect.Effect<QueryPlan>
}

// ============================================================================
// Compiled Query
// ============================================================================

export interface CompiledQuery {
  readonly execute: (entities?: ReadonlyArray<Entity>) => Effect.Effect<ReadonlyArray<Entity>>
  readonly cost: number
  readonly cacheable: boolean
}

// ============================================================================
// Query Builder State
// ============================================================================

interface QueryBuilderState {
  readonly name: string
  readonly expression: QueryExpression | null
  readonly requiredComponents: Set<ComponentName>
  readonly forbiddenComponents: Set<ComponentName>
  readonly conditions: QueryCondition[]
}

// Internal interface that exposes state for internal operations
interface QueryBuilderInternal extends QueryBuilder {
  readonly state: QueryBuilderState
}

const createQueryBuilderState = (name: string): QueryBuilderState => ({
  name,
  expression: null,
  requiredComponents: new Set(),
  forbiddenComponents: new Set(),
  conditions: [],
})

// ============================================================================
// Query Builder Implementation
// ============================================================================

const createQueryBuilder = (state: QueryBuilderState, queryService: QueryService, builderService: QueryBuilderService): QueryBuilderInternal => ({
  state,
  with: (...components: ComponentName[]) => QueryBuilderImpl.with(state, queryService, builderService, ...components),

  without: (...components: ComponentName[]) => QueryBuilderImpl.without(state, queryService, builderService, ...components),

  where: (field: string, operator: QueryCondition['operator'], value: unknown) => QueryBuilderImpl.where(state, queryService, builderService, field, operator, value),

  and: (builder: (q: QueryBuilder) => QueryBuilder) => QueryBuilderImpl.and(state, queryService, builderService, builder),

  or: (builder: (q: QueryBuilder) => QueryBuilder) => QueryBuilderImpl.or(state, queryService, builderService, builder),

  not: (builder: (q: QueryBuilder) => QueryBuilder) => QueryBuilderImpl.not(state, queryService, builderService, builder),

  execute: () => QueryBuilderImpl.execute(state, queryService),
  stream: () => QueryBuilderImpl.stream(state, queryService),
  count: () => QueryBuilderImpl.count(state, queryService),
  exists: () => QueryBuilderImpl.exists(state, queryService),
  first: () => QueryBuilderImpl.first(state, queryService),
  cached: (ttl?: Duration.Duration) => QueryBuilderImpl.cached(state, queryService, ttl),
  parallel: (batchSize?: number) => QueryBuilderImpl.parallel(state, queryService, batchSize),
  lazy: () => QueryBuilderImpl.lazy(state, queryService),
  explain: () => QueryBuilderImpl.explain(state, builderService),
  getCost: () => QueryBuilderImpl.getCost(state, builderService),
  getPlan: () => QueryBuilderImpl.getPlan(state, builderService),
})

const QueryBuilderImpl = {
  with: (state: QueryBuilderState, queryService: QueryService, builderService: QueryBuilderService, ...components: ComponentName[]): QueryBuilder => {
    const newState = {
      ...state,
      requiredComponents: new Set([...state.requiredComponents, ...components]),
    }
    return createQueryBuilder(newState, queryService, builderService)
  },

  without: (state: QueryBuilderState, queryService: QueryService, builderService: QueryBuilderService, ...components: ComponentName[]): QueryBuilder => {
    const newState = {
      ...state,
      forbiddenComponents: new Set([...state.forbiddenComponents, ...components]),
    }
    return createQueryBuilder(newState, queryService, builderService)
  },

  where: (
    state: QueryBuilderState,
    queryService: QueryService,
    builderService: QueryBuilderService,
    field: string,
    operator: QueryCondition['operator'],
    value: unknown,
  ): QueryBuilder => {
    const newState = {
      ...state,
      conditions: [...state.conditions, { field, operator, value }],
    }
    return createQueryBuilder(newState, queryService, builderService)
  },

  and: (state: QueryBuilderState, queryService: QueryService, builderService: QueryBuilderService, builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder => {
    const subQueryState = createQueryBuilderState(state.name + '_and')
    const subQuery = createQueryBuilder(subQueryState, queryService, builderService)
    const builtSubQuery = builder(subQuery)

    const newExpression: QueryExpression = {
      type: 'node',
      value: {
        operator: 'AND',
        children: [QueryBuilderImpl.buildExpression(state), QueryBuilderImpl.buildExpression((builtSubQuery as QueryBuilderInternal).state)],
      },
    }

    const newState = { ...state, expression: newExpression }
    return createQueryBuilder(newState, queryService, builderService)
  },

  or: (state: QueryBuilderState, queryService: QueryService, builderService: QueryBuilderService, builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder => {
    const subQueryState = createQueryBuilderState(state.name + '_or')
    const subQuery = createQueryBuilder(subQueryState, queryService, builderService)
    const builtSubQuery = builder(subQuery)

    const newExpression: QueryExpression = {
      type: 'node',
      value: {
        operator: 'OR',
        children: [QueryBuilderImpl.buildExpression(state), QueryBuilderImpl.buildExpression((builtSubQuery as QueryBuilderInternal).state)],
      },
    }

    const newState = { ...state, expression: newExpression }
    return createQueryBuilder(newState, queryService, builderService)
  },

  not: (state: QueryBuilderState, queryService: QueryService, builderService: QueryBuilderService, builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder => {
    const subQueryState = createQueryBuilderState(state.name + '_not')
    const subQuery = createQueryBuilder(subQueryState, queryService, builderService)
    const builtSubQuery = builder(subQuery)

    const newExpression: QueryExpression = {
      type: 'node',
      value: {
        operator: 'NOT',
        children: [QueryBuilderImpl.buildExpression((builtSubQuery as QueryBuilderInternal).state)],
      },
    }

    const newState = { ...state, expression: newExpression }
    return createQueryBuilder(newState, queryService, builderService)
  },

  buildExpression(state: QueryBuilderState): QueryExpression {
    if (state.expression) return state.expression

    const expressions: QueryExpression[] = []

    // Add component requirements
    state.requiredComponents.forEach((comp) => {
      expressions.push({ type: 'component', value: comp })
    })

    // Add forbidden components as NOT expressions
    state.forbiddenComponents.forEach((comp) => {
      expressions.push({
        type: 'node',
        value: {
          operator: 'NOT',
          children: [{ type: 'component', value: comp }],
        },
      })
    })

    // Add conditions
    state.conditions.forEach((cond) => {
      expressions.push({ type: 'condition', value: cond })
    })

    if (expressions.length === 0) {
      throw new Error('Empty query expression')
    }

    if (expressions.length === 1) {
      return expressions[0]!
    }

    return {
      type: 'node',
      value: {
        operator: 'AND',
        children: expressions,
      },
    }
  },

  execute(state: QueryBuilderState, queryService: QueryService): Effect.Effect<ReadonlyArray<Entity>> {
    return Effect.gen(function* () {
      const required = Array.from(state.requiredComponents)
      const forbidden = Array.from(state.forbiddenComponents)

      const result = yield* queryService.execute(state.name, required, forbidden, QueryBuilderImpl.buildPredicate(state))

      return result.entities
    })
  },

  buildPredicate(state: QueryBuilderState): ((entity: Entity) => boolean) | undefined {
    if (state.conditions.length === 0) return undefined

    return (entity: Entity) => {
      for (const condition of state.conditions) {
        const value = QueryBuilderImpl.getFieldValue(entity, condition.field)

        if (!QueryBuilderImpl.evaluateCondition(value, condition.operator, condition.value)) {
          return false
        }
      }
      return true
    }
  },

  getFieldValue: (entity: Entity, field: string) => Effect.runSync(validateFieldValue(entity, field)),

  evaluateCondition: (value: unknown, operator: QueryCondition['operator'], expected: unknown) => Effect.runSync(validateConditionValue(value, operator, expected)),

  stream(state: QueryBuilderState, queryService: QueryService): Stream.Stream<Entity> {
    return Stream.fromIterableEffect(QueryBuilderImpl.execute(state, queryService))
  },

  count(state: QueryBuilderState, queryService: QueryService): Effect.Effect<number> {
    return Effect.map(QueryBuilderImpl.execute(state, queryService), (entities) => entities.length)
  },

  exists(state: QueryBuilderState, queryService: QueryService): Effect.Effect<boolean> {
    return Effect.map(QueryBuilderImpl.execute(state, queryService), (entities) => entities.length > 0)
  },

  first(state: QueryBuilderState, queryService: QueryService): Effect.Effect<Option.Option<Entity>> {
    return Effect.map(QueryBuilderImpl.execute(state, queryService), (entities) => ReadonlyArray.head(entities))
  },

  cached(state: QueryBuilderState, queryService: QueryService, ttl: Duration.Duration = Duration.seconds(1)): Effect.Effect<ReadonlyArray<Entity>> {
    const required = Array.from(state.requiredComponents)
    const forbidden = Array.from(state.forbiddenComponents)

    return queryService.cached(state.name, required, forbidden, ttl)
  },

  parallel(state: QueryBuilderState, queryService: QueryService, batchSize: number = 100): Effect.Effect<ReadonlyArray<Entity>> {
    return Effect.gen(function* () {
      const entities = yield* QueryBuilderImpl.execute(state, queryService)

      // Process entities in parallel batches
      const batches = Chunk.fromIterable(entities).pipe(Chunk.chunksOf(batchSize))

      const results = yield* Effect.forEach(batches, (batch) => Effect.succeed(Chunk.toReadonlyArray(batch)), { concurrency: 'unbounded' })

      return results.flat()
    })
  },

  lazy(state: QueryBuilderState, queryService: QueryService): Effect.Effect<() => Effect.Effect<ReadonlyArray<Entity>>> {
    const executeQuery = () => QueryBuilderImpl.execute(state, queryService)
    return Effect.succeed(() => executeQuery())
  },

  explain(state: QueryBuilderState, builderService: QueryBuilderService): Effect.Effect<string> {
    return builderService.explain(QueryBuilderImpl.buildExpression(state))
  },

  getCost(state: QueryBuilderState, builderService: QueryBuilderService): Effect.Effect<number> {
    return Effect.gen(function* () {
      const plan = yield* QueryBuilderImpl.getPlan(state, builderService)
      return plan.estimatedCost
    })
  },

  getPlan(state: QueryBuilderState, builderService: QueryBuilderService): Effect.Effect<QueryPlan> {
    return builderService.optimize(QueryBuilderImpl.buildExpression(state))
  },
}

// ============================================================================
// Query Builder Service Implementation
// ============================================================================

export const QueryBuilderServiceLive = Layer.effect(
  QueryBuilderService,
  Effect.gen(function* () {
    const queryService = yield* QueryService
    const archetypeService = yield* ArchetypeService
    const componentService = yield* ComponentService

    const create = (name: string): QueryBuilder => {
      const state = createQueryBuilderState(name)
      return createQueryBuilder(state, queryService, service)
    }

    const optimize = (expression: QueryExpression): Effect.Effect<QueryPlan> =>
      Effect.gen(function* () {
        const optimizations: string[] = []
        let cost = 0
        let cacheable = true

        // Analyze expression complexity
        const analyzeExpression = (expr: QueryExpression, depth: number = 0): void => {
          cost += depth + 1

          switch (expr.type) {
            case 'component':
              // Component checks are cheap
              cost += 1
              break

            case 'condition':
              // Conditions are more expensive
              cost += 5
              if (expr.value.operator === 'CONTAINS') {
                cost += 10 // String operations are expensive
              }
              break

            case 'node':
              // Logical operations
              cost += 2
              if (expr.value.operator === 'OR') {
                cost += 5 // OR is more expensive than AND
                cacheable = false // OR queries are harder to cache
              }
              expr.value.children.forEach((child) => analyzeExpression(child, depth + 1))
              break
          }
        }

        analyzeExpression(expression)

        // Apply optimizations
        if (cost > 20) {
          optimizations.push('Consider using archetype indexing')
        }
        if (cost > 50) {
          optimizations.push('Query is complex - consider caching')
          optimizations.push('Consider breaking into multiple simpler queries')
        }

        return {
          expression,
          estimatedCost: cost,
          optimizations,
          cacheable,
        }
      })

    const compile = (plan: QueryPlan): Effect.Effect<CompiledQuery> =>
      Effect.gen(function* () {
        // Create a compiled query function
        const execute = (entities?: ReadonlyArray<Entity>) =>
          Effect.gen(function* () {
            // This would compile the expression into an optimized execution plan
            // For now, we'll use the regular query service
            const components = extractComponents(plan.expression)
            const result = yield* queryService.execute('compiled_query', components.required, components.forbidden)
            return result.entities
          })

        return {
          execute,
          cost: plan.estimatedCost,
          cacheable: plan.cacheable,
        }
      })

    const explain = (expression: QueryExpression): Effect.Effect<string> =>
      Effect.gen(function* () {
        const plan = yield* optimize(expression)

        const lines: string[] = [
          '=== Query Execution Plan ===',
          `Estimated Cost: ${plan.estimatedCost}`,
          `Cacheable: ${plan.cacheable}`,
          '',
          '--- Expression Tree ---',
          formatExpression(expression, 0),
          '',
        ]

        if (plan.optimizations.length > 0) {
          lines.push('--- Suggested Optimizations ---')
          plan.optimizations.forEach((opt) => lines.push(`• ${opt}`))
        }

        return lines.join('\n')
      })

    // Helper functions
    const extractComponents = (
      expr: QueryExpression,
    ): {
      required: ComponentName[]
      forbidden: ComponentName[]
    } => {
      const required: ComponentName[] = []
      const forbidden: ComponentName[] = []

      const traverse = (e: QueryExpression, negated: boolean = false): void => {
        switch (e.type) {
          case 'component':
            if (negated) {
              forbidden.push(e.value)
            } else {
              required.push(e.value)
            }
            break

          case 'node':
            if (e.value.operator === 'NOT') {
              e.value.children.forEach((child) => traverse(child, !negated))
            } else {
              e.value.children.forEach((child) => traverse(child, negated))
            }
            break
        }
      }

      traverse(expr)
      return { required, forbidden }
    }

    const formatExpression = (expr: QueryExpression, indent: number): string => {
      const prefix = '  '.repeat(indent)

      switch (expr.type) {
        case 'component':
          return `${prefix}COMPONENT: ${expr.value}`

        case 'condition':
          return `${prefix}CONDITION: ${expr.value.field} ${expr.value.operator} ${JSON.stringify(expr.value.value)}`

        case 'node':
          const children = expr.value.children.map((child) => formatExpression(child, indent + 1)).join('\n')
          return `${prefix}${expr.value.operator}:\n${children}`
      }
    }

    const service = {
      create,
      optimize,
      compile,
      explain,
    }

    return service
  }),
)

// ============================================================================
// Query DSL Helpers
// ============================================================================

export const query = (name: string) =>
  Effect.gen(function* () {
    const service = yield* QueryBuilderService
    return service.create(name)
  })

export const find = <T extends ComponentName[]>(...components: T) =>
  Effect.gen(function* () {
    const service = yield* QueryBuilderService
    return service.create('find_query').with(...components)
  })

export const exclude = <T extends ComponentName[]>(...components: T) =>
  Effect.gen(function* () {
    const service = yield* QueryBuilderService
    return service.create('exclude_query').without(...components)
  })

// ============================================================================
// Complex Query Patterns
// ============================================================================

export const spatialQuery = (center: { x: number; y: number; z: number }, radius: number) =>
  Effect.gen(function* () {
    const service = yield* QueryBuilderService
    return service
      .create('spatial_query')
      .with('Position' as ComponentName)
      .where('components.Position.x', '>=', center.x - radius)
      .where('components.Position.x', '<=', center.x + radius)
      .where('components.Position.y', '>=', center.y - radius)
      .where('components.Position.y', '<=', center.y + radius)
      .where('components.Position.z', '>=', center.z - radius)
      .where('components.Position.z', '<=', center.z + radius)
  })

export const tagQuery = (tags: string[]) =>
  Effect.gen(function* () {
    const service = yield* QueryBuilderService
    return service
      .create('tag_query')
      .with('Tags' as ComponentName)
      .where('components.Tags.values', 'IN', tags)
  })

export const hierarchyQuery = (parentId: EntityId) =>
  Effect.gen(function* () {
    const service = yield* QueryBuilderService
    return service
      .create('hierarchy_query')
      .with('Parent' as ComponentName)
      .where('components.Parent.id', '=', parentId)
  })
