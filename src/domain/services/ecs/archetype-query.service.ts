/**
 * Archetype-based Query System (Effect-TS Implementation)
 * High-performance entity querying using archetype patterns with functional programming
 */

import { Effect, Context, Layer, HashMap, HashSet, ReadonlyArray, Option, pipe, Ref, Cache, Duration } from 'effect'
import * as S from 'effect/Schema'

// ============================================================================
// Schema Definitions
// ============================================================================

export const EntityId = S.String.pipe(S.brand('EntityId'))
export type EntityId = S.Schema.Type<typeof EntityId>

export const ComponentName = S.String.pipe(S.brand('ComponentName'))
export type ComponentName = S.Schema.Type<typeof ComponentName>

export const ComponentData = S.Unknown
export type ComponentData = S.Schema.Type<typeof ComponentData>

export const Entity = S.Struct({
  id: EntityId,
  components: S.Record(ComponentName, ComponentData),
})
export type Entity = S.Schema.Type<typeof Entity>

export const ArchetypeSignature = S.Struct({
  required: S.Array(ComponentName),
  forbidden: S.Array(ComponentName),
  hash: S.String,
})
export type ArchetypeSignature = S.Schema.Type<typeof ArchetypeSignature>

export const Archetype = S.Struct({
  signature: ArchetypeSignature,
  entities: S.Array(EntityId),
  componentMask: S.BigInt,
})
export type Archetype = S.Schema.Type<typeof Archetype>

export const QueryMetrics = S.Struct({
  queryName: S.String,
  entitiesScanned: S.Number,
  entitiesMatched: S.Number,
  executionTimeMs: S.Number,
  cacheHit: S.Boolean,
})
export type QueryMetrics = S.Schema.Type<typeof QueryMetrics>

// ============================================================================
// Error Definitions
// ============================================================================

export class ArchetypeError extends S.TaggedError<ArchetypeError>()('ArchetypeError', {
  message: S.String,
}) {}

export class QueryError extends S.TaggedError<QueryError>()('QueryError', {
  message: S.String,
  queryName: S.optional(S.String),
}) {}

// ============================================================================
// Archetype Service
// ============================================================================

export interface ArchetypeService {
  readonly createSignature: (required: ReadonlyArray<ComponentName>, forbidden?: ReadonlyArray<ComponentName>) => Effect.Effect<ArchetypeSignature>

  readonly addEntity: (entity: Entity) => Effect.Effect<void, ArchetypeError>

  readonly removeEntity: (entityId: EntityId) => Effect.Effect<void>

  readonly findMatchingArchetypes: (signature: ArchetypeSignature) => Effect.Effect<ReadonlyArray<Archetype>>

  readonly getStats: () => Effect.Effect<{
    totalArchetypes: number
    totalEntities: number
    archetypeDistribution: ReadonlyArray<{
      hash: string
      entityCount: number
      components: ReadonlyArray<ComponentName>
    }>
  }>

  readonly clear: () => Effect.Effect<void>
}

export const ArchetypeService = Context.GenericTag<ArchetypeService>('ArchetypeService')

// ============================================================================
// Archetype Service Implementation
// ============================================================================

export const ArchetypeServiceLive = Layer.effect(
  ArchetypeService,
  Effect.gen(function* () {
    // State management
    const archetypes = yield* Ref.make(HashMap.empty<string, Archetype>())
    const entityToArchetype = yield* Ref.make(HashMap.empty<EntityId, string>())
    const componentIndices = yield* Ref.make(HashMap.empty<ComponentName, number>())
    const nextIndex = yield* Ref.make(0)

    // Helper: Compute component mask for bitwise operations
    const computeComponentMask = (components: ReadonlyArray<ComponentName>): Effect.Effect<bigint> =>
      Effect.gen(function* () {
        let mask = 0n

        for (const component of components) {
          const indices = yield* Ref.get(componentIndices)
          const existingIndex = HashMap.get(indices, component)

          const index = yield* Option.match(existingIndex, {
            onNone: () =>
              Effect.gen(function* () {
                const idx = yield* Ref.getAndUpdate(nextIndex, (n) => n + 1)
                yield* Ref.update(componentIndices, (map) => HashMap.set(map, component, idx))
                return idx
              }),
            onSome: (idx) => Effect.succeed(idx),
          })

          mask |= 1n << BigInt(index)
        }

        return mask
      })

    // Create archetype signature
    const createSignature = (required: ReadonlyArray<ComponentName>, forbidden: ReadonlyArray<ComponentName> = []): Effect.Effect<ArchetypeSignature> =>
      Effect.gen(function* () {
        const sortedRequired = pipe(required, ReadonlyArray.dedupe, ReadonlyArray.sort)
        const sortedForbidden = pipe(forbidden, ReadonlyArray.dedupe, ReadonlyArray.sort)

        const hash = `req:${sortedRequired.join(',')}|forb:${sortedForbidden.join(',')}`

        return {
          required: sortedRequired,
          forbidden: sortedForbidden,
          hash,
        }
      })

    // Get or create archetype
    const getOrCreateArchetype = (signature: ArchetypeSignature): Effect.Effect<Archetype, ArchetypeError> =>
      Effect.gen(function* () {
        const archetypeMap = yield* Ref.get(archetypes)
        const existing = HashMap.get(archetypeMap, signature.hash)

        return yield* Option.match(existing, {
          onNone: () =>
            Effect.gen(function* () {
              const componentMask = yield* computeComponentMask(signature.required)
              const newArchetype: Archetype = {
                signature,
                entities: [],
                componentMask,
              }

              yield* Ref.update(archetypes, (map) => HashMap.set(map, signature.hash, newArchetype))

              return newArchetype
            }),
          onSome: (archetype) => Effect.succeed(archetype),
        })
      })

    // Add entity to archetype
    const addEntity = (entity: Entity): Effect.Effect<void, ArchetypeError> =>
      Effect.gen(function* () {
        // Remove from current archetype if exists
        yield* removeEntity(entity.id)

        // Determine entity's archetype based on components
        const componentNames = Object.keys(entity.components) as ComponentName[]
        const signature = yield* createSignature(componentNames, [])
        const archetype = yield* getOrCreateArchetype(signature)

        // Update archetype with entity
        yield* Ref.update(archetypes, (map) =>
          HashMap.modify(map, signature.hash, (arch) => ({
            ...arch,
            entities: [...arch.entities, entity.id],
          })),
        )

        // Update entity-to-archetype mapping
        yield* Ref.update(entityToArchetype, (map) => HashMap.set(map, entity.id, signature.hash))
      })

    // Remove entity from archetype
    const removeEntity = (entityId: EntityId): Effect.Effect<void> =>
      Effect.gen(function* () {
        const entityMap = yield* Ref.get(entityToArchetype)
        const archetypeHash = HashMap.get(entityMap, entityId)

        yield* Option.match(archetypeHash, {
          onNone: () => Effect.void,
          onSome: (hash) =>
            Effect.gen(function* () {
              // Remove from archetype
              yield* Ref.update(archetypes, (map) =>
                HashMap.modify(map, hash, (arch) => ({
                  ...arch,
                  entities: arch.entities.filter((id) => id !== entityId),
                })),
              )

              // Remove mapping
              yield* Ref.update(entityToArchetype, (map) => HashMap.remove(map, entityId))
            }),
        })
      })

    // Check if archetype matches signature
    const archetypeMatches = (archetype: Archetype, signature: ArchetypeSignature): boolean => {
      const archetypeSet = new Set(archetype.signature.required)

      // Check all required components are present
      for (const required of signature.required) {
        if (!archetypeSet.has(required)) {
          return false
        }
      }

      // Check no forbidden components are present
      for (const forbidden of signature.forbidden) {
        if (archetypeSet.has(forbidden)) {
          return false
        }
      }

      return true
    }

    // Find matching archetypes
    const findMatchingArchetypes = (signature: ArchetypeSignature): Effect.Effect<ReadonlyArray<Archetype>> =>
      Effect.gen(function* () {
        const archetypeMap = yield* Ref.get(archetypes)
        const matching: Archetype[] = []

        for (const archetype of HashMap.values(archetypeMap)) {
          if (archetypeMatches(archetype, signature)) {
            matching.push(archetype)
          }
        }

        return matching
      })

    // Get statistics
    const getStats = () =>
      Effect.gen(function* () {
        const archetypeMap = yield* Ref.get(archetypes)
        const entityMap = yield* Ref.get(entityToArchetype)

        const archetypeDistribution = pipe(
          HashMap.values(archetypeMap),
          ReadonlyArray.fromIterable,
          ReadonlyArray.map((arch) => ({
            hash: arch.signature.hash,
            entityCount: arch.entities.length,
            components: arch.signature.required,
          })),
        )

        return {
          totalArchetypes: HashMap.size(archetypeMap),
          totalEntities: HashMap.size(entityMap),
          archetypeDistribution,
        }
      })

    // Clear all data
    const clear = () =>
      Effect.gen(function* () {
        yield* Ref.set(archetypes, HashMap.empty())
        yield* Ref.set(entityToArchetype, HashMap.empty())
        yield* Ref.set(componentIndices, HashMap.empty())
        yield* Ref.set(nextIndex, 0)
      })

    return {
      createSignature,
      addEntity,
      removeEntity,
      findMatchingArchetypes,
      getStats,
      clear,
    }
  }),
)

// ============================================================================
// Query Service
// ============================================================================

export interface QueryService {
  readonly execute: <T extends ReadonlyArray<ComponentName>>(
    queryName: string,
    required: T,
    forbidden?: ReadonlyArray<ComponentName>,
    predicate?: (entity: Entity) => boolean,
  ) => Effect.Effect<
    {
      entities: ReadonlyArray<Entity>
      metrics: QueryMetrics
    },
    QueryError
  >

  readonly cached: <T extends ReadonlyArray<ComponentName>>(
    queryName: string,
    required: T,
    forbidden?: ReadonlyArray<ComponentName>,
    ttl?: Duration.Duration,
  ) => Effect.Effect<ReadonlyArray<Entity>, QueryError>

  readonly clearCache: () => Effect.Effect<void>
}

export const QueryService = Context.GenericTag<QueryService>('QueryService')

// ============================================================================
// Query Service Implementation
// ============================================================================

export const QueryServiceLive = Layer.effect(
  QueryService,
  Effect.gen(function* () {
    const archetypeService = yield* ArchetypeService
    const entityStore = yield* Ref.make(HashMap.empty<EntityId, Entity>())

    // Create query cache
    const queryCache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.seconds(1),
      lookup: (key: string) =>
        Effect.gen(function* () {
          const [queryName, required, forbidden] = JSON.parse(key)
          const result = yield* executeQuery(queryName, required, forbidden)
          return result.entities
        }),
    })

    // Execute query with metrics
    const executeQuery = <T extends ReadonlyArray<ComponentName>>(
      queryName: string,
      required: T,
      forbidden: ReadonlyArray<ComponentName> = [],
      predicate?: (entity: Entity) => boolean,
    ) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        let entitiesScanned = 0

        // Create signature
        const signature = yield* archetypeService.createSignature(required, forbidden)

        // Find matching archetypes
        const matchingArchetypes = yield* archetypeService.findMatchingArchetypes(signature)

        // Collect entities
        const entities = yield* Ref.get(entityStore)
        const resultEntities: Entity[] = []

        for (const archetype of matchingArchetypes) {
          for (const entityId of archetype.entities) {
            entitiesScanned++
            const entity = HashMap.get(entities, entityId)

            yield* Option.match(entity, {
              onNone: () => Effect.void,
              onSome: (e) => {
                if (!predicate || predicate(e)) {
                  resultEntities.push(e)
                }
                return Effect.void
              },
            })
          }
        }

        const metrics: QueryMetrics = {
          queryName,
          entitiesScanned,
          entitiesMatched: resultEntities.length,
          executionTimeMs: Date.now() - startTime,
          cacheHit: false,
        }

        return {
          entities: resultEntities,
          metrics,
        }
      })

    // Execute with caching
    const cached = <T extends ReadonlyArray<ComponentName>>(
      queryName: string,
      required: T,
      forbidden: ReadonlyArray<ComponentName> = [],
      ttl: Duration.Duration = Duration.seconds(1),
    ) => {
      const cacheKey = JSON.stringify([queryName, required, forbidden])
      return queryCache.get(cacheKey)
    }

    // Clear cache
    const clearCache = () =>
      Effect.gen(function* () {
        yield* queryCache.invalidateAll
      })

    return {
      execute: executeQuery,
      cached,
      clearCache,
    }
  }),
)

// ============================================================================
// Query Builder Pattern
// ============================================================================

export const createQuery = <T extends ReadonlyArray<ComponentName>>(name: string, components: T) => ({
  name,
  components,

  without: (forbidden: ReadonlyArray<ComponentName>) => ({
    name,
    components,
    forbidden,

    where: (predicate: (entity: Entity) => boolean) => ({
      name,
      components,
      forbidden,
      predicate,

      execute: () =>
        Effect.gen(function* () {
          const queryService = yield* QueryService
          return yield* queryService.execute(name, components, forbidden, predicate)
        }),
    }),

    execute: () =>
      Effect.gen(function* () {
        const queryService = yield* QueryService
        return yield* queryService.execute(name, components, forbidden)
      }),
  }),

  where: (predicate: (entity: Entity) => boolean) => ({
    name,
    components,
    predicate,

    execute: () =>
      Effect.gen(function* () {
        const queryService = yield* QueryService
        return yield* queryService.execute(name, components, [], predicate)
      }),
  }),

  execute: () =>
    Effect.gen(function* () {
      const queryService = yield* QueryService
      return yield* queryService.execute(name, components)
    }),

  cached: (ttl?: Duration.Duration) =>
    Effect.gen(function* () {
      const queryService = yield* QueryService
      return yield* queryService.cached(name, components, [], ttl)
    }),
})

// ============================================================================
// Optimized Query Patterns
// ============================================================================

export const parallelQueries = <T extends ReadonlyArray<Effect.Effect<any, any, any>>>(
  queries: T,
): Effect.Effect<
  { [K in keyof T]: T[K] extends Effect.Effect<infer A, any, any> ? A : never },
  T[number] extends Effect.Effect<any, infer E, any> ? E : never,
  T[number] extends Effect.Effect<any, any, infer R> ? R : never
> => Effect.all(queries, { concurrency: 'unbounded' }) as any

export const batchQuery = <T extends ReadonlyArray<ComponentName>>(queries: ReadonlyArray<{ name: string; components: T }>) =>
  Effect.gen(function* () {
    const results = yield* parallelQueries(queries.map((q) => createQuery(q.name, q.components).execute()))

    return results
  })
