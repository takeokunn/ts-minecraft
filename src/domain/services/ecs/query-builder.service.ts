/**
 * Advanced Query Builder System (Effect-TS Implementation)
 * Provides fluent API for building complex ECS queries with optimizations
 */

import { Effect, Context, Layer, pipe, Option, ReadonlyArray, Duration, Chunk, Stream } from 'effect'
import * as S from 'effect/Schema'
import { EntityId, ComponentName, Entity, QueryService, ArchetypeService, QueryMetrics } from '@domain/services/ecs/archetype-query.service'
import { ComponentService } from '@domain/services/ecs/component.service'

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
// Query Builder Implementation
// ============================================================================

class QueryBuilderImpl implements QueryBuilder {
  private expression: QueryExpression | null = null
  private requiredComponents: Set<ComponentName> = new Set()
  private forbiddenComponents: Set<ComponentName> = new Set()
  private conditions: QueryCondition[] = []

  constructor(
    private name: string,
    private queryService: QueryService,
    private builderService: QueryBuilderService,
  ) {}

  with(...components: ComponentName[]): QueryBuilder {
    components.forEach((c) => this.requiredComponents.add(c))
    return this
  }

  without(...components: ComponentName[]): QueryBuilder {
    components.forEach((c) => this.forbiddenComponents.add(c))
    return this
  }

  where(field: string, operator: QueryCondition['operator'], value: unknown): QueryBuilder {
    this.conditions.push({ field, operator, value })
    return this
  }

  and(builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder {
    const subQuery = new QueryBuilderImpl(this.name + '_and', this.queryService, this.builderService)
    builder(subQuery)

    const newExpression: QueryExpression = {
      type: 'node',
      value: {
        operator: 'AND',
        children: [this.buildExpression(), subQuery.buildExpression()],
      },
    }

    this.expression = newExpression
    return this
  }

  or(builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder {
    const subQuery = new QueryBuilderImpl(this.name + '_or', this.queryService, this.builderService)
    builder(subQuery)

    const newExpression: QueryExpression = {
      type: 'node',
      value: {
        operator: 'OR',
        children: [this.buildExpression(), subQuery.buildExpression()],
      },
    }

    this.expression = newExpression
    return this
  }

  not(builder: (q: QueryBuilder) => QueryBuilder): QueryBuilder {
    const subQuery = new QueryBuilderImpl(this.name + '_not', this.queryService, this.builderService)
    builder(subQuery)

    const newExpression: QueryExpression = {
      type: 'node',
      value: {
        operator: 'NOT',
        children: [subQuery.buildExpression()],
      },
    }

    this.expression = newExpression
    return this
  }

  private buildExpression(): QueryExpression {
    if (this.expression) return this.expression

    const expressions: QueryExpression[] = []

    // Add component requirements
    this.requiredComponents.forEach((comp) => {
      expressions.push({ type: 'component', value: comp })
    })

    // Add forbidden components as NOT expressions
    this.forbiddenComponents.forEach((comp) => {
      expressions.push({
        type: 'node',
        value: {
          operator: 'NOT',
          children: [{ type: 'component', value: comp }],
        },
      })
    })

    // Add conditions
    this.conditions.forEach((cond) => {
      expressions.push({ type: 'condition', value: cond })
    })

    if (expressions.length === 0) {
      throw new Error('Empty query expression')
    }

    if (expressions.length === 1) {
      return expressions[0]
    }

    return {
      type: 'node',
      value: {
        operator: 'AND',
        children: expressions,
      },
    }
  }

  execute(): Effect.Effect<ReadonlyArray<Entity>> {
    return Effect.gen(function* () {
      const required = Array.from(this.requiredComponents)
      const forbidden = Array.from(this.forbiddenComponents)

      const result = yield* this.queryService.execute(this.name, required, forbidden, this.buildPredicate())

      return result.entities
    })
  }

  private buildPredicate(): ((entity: Entity) => boolean) | undefined {
    if (this.conditions.length === 0) return undefined

    return (entity: Entity) => {
      for (const condition of this.conditions) {
        const value = this.getFieldValue(entity, condition.field)

        if (!this.evaluateCondition(value, condition.operator, condition.value)) {
          return false
        }
      }
      return true
    }
  }

  private getFieldValue(entity: Entity, field: string): unknown {
    const parts = field.split('.')
    let value: any = entity

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part]
      } else {
        return undefined
      }
    }

    return value
  }

  private evaluateCondition(value: unknown, operator: QueryCondition['operator'], expected: unknown): boolean {
    switch (operator) {
      case '=':
        return value === expected
      case '!=':
        return value !== expected
      case '>':
        return Number(value) > Number(expected)
      case '<':
        return Number(value) < Number(expected)
      case '>=':
        return Number(value) >= Number(expected)
      case '<=':
        return Number(value) <= Number(expected)
      case 'IN':
        return Array.isArray(expected) && expected.includes(value)
      case 'NOT_IN':
        return Array.isArray(expected) && !expected.includes(value)
      case 'CONTAINS':
        return String(value).includes(String(expected))
      default:
        return false
    }
  }

  stream(): Stream.Stream<Entity> {
    return Stream.fromIterableEffect(this.execute())
  }

  count(): Effect.Effect<number> {
    return Effect.map(this.execute(), (entities) => entities.length)
  }

  exists(): Effect.Effect<boolean> {
    return Effect.map(this.execute(), (entities) => entities.length > 0)
  }

  first(): Effect.Effect<Option.Option<Entity>> {
    return Effect.map(this.execute(), (entities) => ReadonlyArray.head(entities))
  }

  cached(ttl: Duration.Duration = Duration.seconds(1)): Effect.Effect<ReadonlyArray<Entity>> {
    const required = Array.from(this.requiredComponents)
    const forbidden = Array.from(this.forbiddenComponents)

    return this.queryService.cached(this.name, required, forbidden, ttl)
  }

  parallel(batchSize: number = 100): Effect.Effect<ReadonlyArray<Entity>> {
    return Effect.gen(function* () {
      const entities = yield* this.execute()

      // Process entities in parallel batches
      const batches = Chunk.fromIterable(entities).pipe(Chunk.chunksOf(batchSize))

      const results = yield* Effect.forEach(batches, (batch) => Effect.succeed(Chunk.toReadonlyArray(batch)), { concurrency: 'unbounded' })

      return results.flat()
    })
  }

  lazy(): Effect.Effect<() => Effect.Effect<ReadonlyArray<Entity>>> {
    const executeQuery = this.execute.bind(this)
    return Effect.succeed(() => executeQuery())
  }

  explain(): Effect.Effect<string> {
    return this.builderService.explain(this.buildExpression())
  }

  getCost(): Effect.Effect<number> {
    return Effect.gen(function* () {
      const plan = yield* this.getPlan()
      return plan.estimatedCost
    })
  }

  getPlan(): Effect.Effect<QueryPlan> {
    return this.builderService.optimize(this.buildExpression())
  }
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
      return new QueryBuilderImpl(name, queryService, service)
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
