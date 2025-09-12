/**
 * Archetype-based Query System (Functional)
 * Provides high-performance entity querying using archetype patterns with Effect-TS
 */

import { Effect, pipe, Ref, Context, Layer, Data } from 'effect'
import { ComponentName, ComponentOfName } from '@domain/entities/components'
import { EntityId } from '@domain/entities'
import { QueryConfig, QueryMetrics, startQueryContext, finalizeQueryContext, QueryEntity } from '@application/queries/builder'

/**
 * Archetype signature for efficient entity matching
 */
export interface ArchetypeSignature {
  readonly required: ReadonlySet<ComponentName>
  readonly forbidden: ReadonlySet<ComponentName>
  readonly hash: string
}

/**
 * Archetype state interface for functional implementation
 */
export interface ArchetypeState {
  readonly entities: Set<QueryEntity>
  readonly componentMask: bigint
  readonly signature: ArchetypeSignature
}

/**
 * Component indexing state
 */
export interface ComponentIndexingState {
  readonly componentIndices: Map<ComponentName, number>
  readonly nextIndex: number
}

/**
 * Functional archetype operations
 */
export const ArchetypeFunctions = {
  /**
   * Compute component mask for given components
   */
  computeComponentMask: (components: ReadonlySet<ComponentName>) =>
    Effect.gen(function* () {
      const indexingRef = yield* ComponentIndexing
      const indexingState = yield* Ref.get(indexingRef)

      let mask = 0n
      let newIndices = new Map(indexingState.componentIndices)
      let nextIndex = indexingState.nextIndex

      for (const component of components) {
        if (!newIndices.has(component)) {
          newIndices.set(component, nextIndex++)
        }
        const index = newIndices.get(component)
        if (index !== undefined) {
          mask |= 1n << BigInt(index)
        }
      }

      // Update indexing state if needed
      if (nextIndex !== indexingState.nextIndex) {
        yield* Ref.set(indexingRef, {
          componentIndices: newIndices,
          nextIndex,
        })
      }

      return mask
    }),

  /**
   * Create archetype state
   */
  create: (signature: ArchetypeSignature) =>
    Effect.gen(function* () {
      const componentMask = yield* ArchetypeFunctions.computeComponentMask(signature.required)

      return {
        entities: new Set<QueryEntity>(),
        componentMask,
        signature,
      } as ArchetypeState
    }),

  /**
   * Add entity to archetype
   */
  addEntity: (entity: QueryEntity) => (archetype: ArchetypeState) =>
    Effect.succeed({
      ...archetype,
      entities: new Set([...archetype.entities, entity]),
    }),

  /**
   * Remove entity from archetype
   */
  removeEntity: (entity: QueryEntity) => (archetype: ArchetypeState) =>
    Effect.succeed({
      ...archetype,
      entities: new Set([...archetype.entities].filter((e) => e.id !== entity.id)),
    }),

  /**
   * Get all entities from archetype
   */
  getEntities: (archetype: ArchetypeState) => Effect.succeed(Array.from(archetype.entities)),

  /**
   * Check if archetype matches signature
   */
  matches: (signature: ArchetypeSignature) => (archetype: ArchetypeState) =>
    Effect.succeed(() => {
      // Check that all required components are present
      for (const required of signature.required) {
        if (!archetype.signature.required.has(required)) {
          return false
        }
      }

      // Check that no forbidden components are present
      for (const forbidden of signature.forbidden) {
        if (archetype.signature.required.has(forbidden)) {
          return false
        }
      }

      return true
    }).pipe(Effect.map((fn) => fn())),

  /**
   * Fast bit-mask based matching
   */
  matchesMask: (requiredMask: bigint, forbiddenMask: bigint) => (archetype: ArchetypeState) =>
    Effect.succeed(() => {
      // All required components must be present
      if ((archetype.componentMask & requiredMask) !== requiredMask) {
        return false
      }

      // No forbidden components should be present
      if ((archetype.componentMask & forbiddenMask) !== 0n) {
        return false
      }

      return true
    }).pipe(Effect.map((fn) => fn())),

  /**
   * Get archetype size
   */
  getSize: (archetype: ArchetypeState) => Effect.succeed(archetype.entities.size),
}

/**
 * Component indexing service (internal use only)
 */
const ComponentIndexing = Context.GenericTag<Ref.Ref<ComponentIndexingState>>('ComponentIndexing')

const ComponentIndexingLive = Layer.effect(
  ComponentIndexing,
  Ref.make<ComponentIndexingState>({
    componentIndices: new Map(),
    nextIndex: 0,
  }),
)

/**
 * Archetype manager state interface
 */
export interface ArchetypeManagerState {
  readonly archetypes: Map<string, ArchetypeState>
  readonly entityToArchetype: Map<QueryEntity, ArchetypeState>
}

/**
 * Archetype manager service interface
 */
export interface ArchetypeManagerService {
  readonly createSignature: (required: ReadonlyArray<ComponentName>, forbidden?: ReadonlyArray<ComponentName>) => Effect.Effect<ArchetypeSignature>
  readonly getOrCreateArchetype: (signature: ArchetypeSignature) => Effect.Effect<ArchetypeState>
  readonly addEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly removeEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly findMatchingArchetypes: (signature: ArchetypeSignature) => Effect.Effect<ReadonlyArray<ArchetypeState>>
  readonly getAllEntities: () => Effect.Effect<ReadonlyArray<EntityId>>
  readonly getStats: () => Effect.Effect<{
    totalArchetypes: number
    totalEntities: number
    archetypeDistribution: Array<{
      hash: string
      entityCount: number
      components: ComponentName[]
    }>
  }>
}

/**
 * Archetype manager service tag
 */
export const ArchetypeManager = Context.GenericTag<ArchetypeManagerService>('ArchetypeManager')

/**
 * Archetype manager implementation
 */
export const ArchetypeManagerLive = Layer.effect(
  ArchetypeManager,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<ArchetypeManagerState>({
      archetypes: new Map(),
      entityToArchetype: new Map(),
    })

    const createSignature = (required: ReadonlyArray<ComponentName>, forbidden: ReadonlyArray<ComponentName> = []) =>
      Effect.succeed({
        required: new Set(required),
        forbidden: new Set(forbidden),
        hash: `req:${[...new Set(required)].sort().join(',')}|forb:${[...new Set(forbidden)].sort().join(',')}`,
      })

    const getOrCreateArchetype = (signature: ArchetypeSignature) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        let archetype = state.archetypes.get(signature.hash)

        if (!archetype) {
          archetype = yield* ArchetypeFunctions.create(signature)
          const newArchetypes = new Map(state.archetypes)
          newArchetypes.set(signature.hash, archetype)

          yield* Ref.set(stateRef, {
            ...state,
            archetypes: newArchetypes,
          })
        }

        return archetype
      })

    const addEntity = (entity: QueryEntity) =>
      Effect.gen(function* () {
        // Remove from current archetype if exists
        yield* removeEntity(entity)

        // Determine entity's archetype based on components
        const componentNames = Object.keys(entity.components) as ComponentName[]
        const signature = yield* createSignature(componentNames, [])
        const archetype = yield* getOrCreateArchetype(signature)

        const updatedArchetype = yield* ArchetypeFunctions.addEntity(entity)(archetype)

        // Update state
        const state = yield* Ref.get(stateRef)
        const newArchetypes = new Map(state.archetypes)
        const newEntityToArchetype = new Map(state.entityToArchetype)

        newArchetypes.set(signature.hash, updatedArchetype)
        newEntityToArchetype.set(entity, updatedArchetype)

        yield* Ref.set(stateRef, {
          archetypes: newArchetypes,
          entityToArchetype: newEntityToArchetype,
        })
      })

    const removeEntity = (entity: QueryEntity) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const currentArchetype = state.entityToArchetype.get(entity)

        if (currentArchetype) {
          const updatedArchetype = yield* ArchetypeFunctions.removeEntity(entity)(currentArchetype)

          const newArchetypes = new Map(state.archetypes)
          const newEntityToArchetype = new Map(state.entityToArchetype)

          newArchetypes.set(currentArchetype.signature.hash, updatedArchetype)
          newEntityToArchetype.delete(entity)

          yield* Ref.set(stateRef, {
            archetypes: newArchetypes,
            entityToArchetype: newEntityToArchetype,
          })
        }
      })

    const findMatchingArchetypes = (signature: ArchetypeSignature) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const matching: ArchetypeState[] = []

        for (const archetype of state.archetypes.values()) {
          const matches = yield* ArchetypeFunctions.matches(signature)(archetype)
          if (matches) {
            matching.push(archetype)
          }
        }

        return matching
      })

    const getAllEntities = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const entities: EntityId[] = []

        for (const archetype of state.archetypes.values()) {
          const archetypeEntities = yield* ArchetypeFunctions.getEntities(archetype)
          entities.push(...archetypeEntities.map((entity) => entity.id))
        }

        return entities
      })

    const getStats = () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        const archetypeDistribution: Array<{
          hash: string
          entityCount: number
          components: ComponentName[]
        }> = []

        for (const [hash, archetype] of state.archetypes.entries()) {
          const size = yield* ArchetypeFunctions.getSize(archetype)
          archetypeDistribution.push({
            hash,
            entityCount: size,
            components: Array.from(archetype.signature.required),
          })
        }

        return {
          totalArchetypes: state.archetypes.size,
          totalEntities: state.entityToArchetype.size,
          archetypeDistribution,
        }
      })

    return {
      createSignature,
      getOrCreateArchetype,
      addEntity,
      removeEntity,
      findMatchingArchetypes,
      getAllEntities,
      getStats,
    } satisfies ArchetypeManagerService
  }),
)

/**
 * High-performance archetype-based query interface
 */
export interface ArchetypeQueryService<T extends ReadonlyArray<ComponentName>> {
  readonly execute: (entities?: ReadonlyArray<QueryEntity>) => Effect.Effect<{
    entities: ReadonlyArray<QueryEntity>
    metrics: QueryMetrics
  }>
  readonly name: string
  readonly components: T
  readonly forbiddenComponents: ReadonlyArray<ComponentName>
}

/**
 * Create archetype-based query
 */
export const createArchetypeQuery = <T extends ReadonlyArray<ComponentName>>(config: QueryConfig<T>) =>
  Effect.gen(function* () {
    const archetypeManager = yield* ArchetypeManager
    const signature = yield* archetypeManager.createSignature(config.withComponents, config.withoutComponents || [])

    const executeArchetypeQuery = (context: { metrics: QueryMetrics }) =>
      Effect.gen(function* () {
        const matchingArchetypes = yield* archetypeManager.findMatchingArchetypes(signature)
        const entities: QueryEntity[] = []

        for (const archetype of matchingArchetypes) {
          const archetypeEntities = yield* ArchetypeFunctions.getEntities(archetype)
          context.metrics.entitiesScanned += archetypeEntities.length
          entities.push(...archetypeEntities)
        }

        return entities
      })

    const executeDirectFilter = (entities: ReadonlyArray<QueryEntity>, context: { metrics: QueryMetrics }) =>
      Effect.gen(function* () {
        const result: QueryEntity[] = []

        for (const entity of entities) {
          context.metrics.entitiesScanned++

          // Check required components
          const hasRequired = config.withComponents.every((comp) => entity.components[comp] !== undefined)

          if (!hasRequired) continue

          // Check forbidden components
          const hasForbidden = (config.withoutComponents || []).some((comp) => entity.components[comp] !== undefined)

          if (hasForbidden) continue

          result.push(entity)
        }

        return result
      })

    const applyPredicate = (entities: QueryEntity[], _context: { metrics: QueryMetrics }) =>
      Effect.gen(function* () {
        if (!config.predicate) return entities

        const result: QueryEntity[] = []

        for (const entity of entities) {
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
            if (config.predicate!(typedProxy)) {
              result.push(entity)
            }
          } catch (error) {
            console.warn(`Predicate error for entity ${entity.id}:`, error)
          }
        }

        return result
      })

    const execute = (entities?: ReadonlyArray<QueryEntity>) =>
      Effect.gen(function* () {
        const context = startQueryContext()

        let resultEntities: QueryEntity[]

        if (entities) {
          // Direct entity filtering (fallback mode)
          resultEntities = yield* executeDirectFilter(entities, context)
        } else {
          // Archetype-based querying (optimized mode)
          resultEntities = yield* executeArchetypeQuery(context)
        }

        // Apply predicate if specified
        if (config.predicate) {
          resultEntities = yield* applyPredicate(resultEntities, context)
        }

        context.metrics.entitiesMatched = resultEntities.length
        const metrics = finalizeQueryContext(context)

        return {
          entities: resultEntities,
          metrics,
        }
      })

    return {
      execute,
      name: config.name,
      components: config.withComponents,
      forbiddenComponents: config.withoutComponents || [],
    } satisfies ArchetypeQueryService<T>
  })

/**
 * Archetype system utilities - functional interface
 */
export const ArchetypeSystemUtils = {
  /**
   * Add entity to archetype system
   */
  addEntity: (entity: QueryEntity) =>
    Effect.gen(function* () {
      const archetypeManager = yield* ArchetypeManager
      yield* archetypeManager.addEntity(entity)
    }),

  /**
   * Remove entity from archetype system
   */
  removeEntity: (entity: QueryEntity) =>
    Effect.gen(function* () {
      const archetypeManager = yield* ArchetypeManager
      yield* archetypeManager.removeEntity(entity)
    }),

  /**
   * Get archetype system statistics
   */
  getStats: () =>
    Effect.gen(function* () {
      const archetypeManager = yield* ArchetypeManager
      return yield* archetypeManager.getStats()
    }),
}

// Legacy compatibility functions (deprecated - use ArchetypeSystemUtils instead)
export const addEntityToArchetype = (entity: QueryEntity) =>
  pipe(ArchetypeSystemUtils.addEntity(entity), Effect.provide(ArchetypeManagerLive), Effect.provide(ComponentIndexingLive), Effect.runSync)

export const removeEntityFromArchetype = (entity: QueryEntity) =>
  pipe(ArchetypeSystemUtils.removeEntity(entity), Effect.provide(ArchetypeManagerLive), Effect.provide(ComponentIndexingLive), Effect.runSync)

export const getArchetypeStats = () => pipe(ArchetypeSystemUtils.getStats(), Effect.provide(ArchetypeManagerLive), Effect.provide(ComponentIndexingLive), Effect.runSync)
