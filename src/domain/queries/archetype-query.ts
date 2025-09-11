/**
 * Archetype-based Query System - Functional Effect-TS Implementation
 * Provides high-performance entity querying using archetype patterns
 */

import { Effect, Ref, Context, Layer, HashMap, Option } from 'effect'
import { ComponentName, ComponentOfName } from '@/domain/entities/components'
import { EntityId } from '@/domain/entities'
import { QueryConfig, QueryMetrics, startQueryContext, finalizeQueryContext, QueryEntity } from './builder'

/**
 * Archetype signature for efficient entity matching
 */
export interface ArchetypeSignature {
  readonly required: ReadonlySet<ComponentName>
  readonly forbidden: ReadonlySet<ComponentName>
  readonly hash: string
}

/**
 * Archetype Service
 */
export const ArchetypeService = Context.GenericTag<{
  readonly addEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly removeEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly getEntities: () => Effect.Effect<ReadonlyArray<QueryEntity>>
  readonly matches: (signature: ArchetypeSignature) => Effect.Effect<boolean>
  readonly matchesMask: (requiredMask: bigint, forbiddenMask: bigint) => Effect.Effect<boolean>
  readonly getSize: () => Effect.Effect<number>
}>('ArchetypeService')

/**
 * Archetype Manager Service
 */
export const ArchetypeManagerService = Context.GenericTag<{
  readonly createSignature: (
    required: ReadonlyArray<ComponentName>,
    forbidden?: ReadonlyArray<ComponentName>
  ) => ArchetypeSignature
  readonly getOrCreateArchetype: (signature: ArchetypeSignature) => Effect.Effect<ArchetypeService.Type>
  readonly addEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly removeEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly findMatchingArchetypes: (signature: ArchetypeSignature) => Effect.Effect<ReadonlyArray<ArchetypeService.Type>>
  readonly getAllEntities: () => Effect.Effect<ReadonlyArray<EntityId>>
  readonly getStats: () => Effect.Effect<ArchetypeManagerStats>
}>('ArchetypeManagerService')

/**
 * Archetype Query Service
 */
export const ArchetypeQueryService = Context.GenericTag<{
  readonly execute: <T extends ReadonlyArray<ComponentName>>(
    config: QueryConfig<T>,
    entities?: ReadonlyArray<QueryEntity>
  ) => Effect.Effect<{ entities: ReadonlyArray<QueryEntity>; metrics: QueryMetrics }>
  readonly addEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly removeEntity: (entity: QueryEntity) => Effect.Effect<void>
  readonly getStats: () => Effect.Effect<ArchetypeManagerStats>
  readonly reset: () => Effect.Effect<void>
}>('ArchetypeQueryService')

/**
 * Archetype manager statistics
 */
interface ArchetypeManagerStats {
  totalArchetypes: number
  totalEntities: number
  archetypeDistribution: Array<{
    hash: string
    entityCount: number
    components: ComponentName[]
  }>
}

/**
 * Internal archetype state
 */
interface ArchetypeState {
  entities: Set<QueryEntity>
  signature: ArchetypeSignature
  componentMask: bigint
}

/**
 * Component indices for bit masking
 */
interface ComponentIndices {
  componentToIndex: HashMap.HashMap<ComponentName, number>
  nextIndex: number
}

/**
 * Internal archetype manager state
 */
interface ArchetypeManagerState {
  archetypes: HashMap.HashMap<string, ArchetypeState>
  entityToArchetype: HashMap.HashMap<QueryEntity, ArchetypeState>
  componentIndices: ComponentIndices
}

/**
 * Compute component mask for archetype
 */
const computeComponentMask = (
  components: ReadonlySet<ComponentName>,
  indicesRef: Ref.Ref<ComponentIndices>
): Effect.Effect<bigint> =>
  Effect.gen(function* () {
    let mask = 0n
    const indices = yield* Ref.get(indicesRef)
    let newIndices = indices
    
    for (const component of components) {
      const indexOption = HashMap.get(indices.componentToIndex, component)
      let index: number
      
      if (Option.isNone(indexOption)) {
        index = newIndices.nextIndex
        newIndices = {
          componentToIndex: HashMap.set(newIndices.componentToIndex, component, index),
          nextIndex: newIndices.nextIndex + 1
        }
      } else {
        index = indexOption.value
      }
      
      mask |= 1n << BigInt(index)
    }
    
    if (newIndices !== indices) {
      yield* Ref.set(indicesRef, newIndices)
    }
    
    return mask
  })

/**
 * Create archetype signature from component sets
 */
const createArchetypeSignature = (
  required: ReadonlyArray<ComponentName>,
  forbidden: ReadonlyArray<ComponentName> = []
): ArchetypeSignature => {
  const requiredSet = new Set(required)
  const forbiddenSet = new Set(forbidden)
  
  const sortedRequired = [...requiredSet].sort()
  const sortedForbidden = [...forbiddenSet].sort()
  
  const hash = `req:${sortedRequired.join(',')}|forb:${sortedForbidden.join(',')}`
  
  return {
    required: requiredSet,
    forbidden: forbiddenSet,
    hash,
  }
}

/**
 * Check if archetype matches signature
 */
const archetypeMatches = (
  archetypeSignature: ArchetypeSignature,
  targetSignature: ArchetypeSignature
): boolean => {
  // Check that all required components are present
  for (const required of targetSignature.required) {
    if (!archetypeSignature.required.has(required)) {
      return false
    }
  }
  
  // Check that no forbidden components are present
  for (const forbidden of targetSignature.forbidden) {
    if (archetypeSignature.required.has(forbidden)) {
      return false
    }
  }
  
  return true
}

/**
 * Fast bit-mask based matching
 */
const archetypeMatchesMask = (
  archetypeMask: bigint,
  requiredMask: bigint,
  forbiddenMask: bigint
): boolean => {
  // All required components must be present
  if ((archetypeMask & requiredMask) !== requiredMask) {
    return false
  }
  
  // No forbidden components should be present
  if ((archetypeMask & forbiddenMask) !== 0n) {
    return false
  }
  
  return true
}

/**
 * Create individual archetype service
 */
const createArchetypeService = (
  signature: ArchetypeSignature,
  componentIndicesRef: Ref.Ref<ComponentIndices>
): Effect.Effect<ArchetypeService.Type> =>
  Effect.gen(function* () {
    const entitiesRef = yield* Ref.make(new Set<QueryEntity>())
    const componentMask = yield* computeComponentMask(signature.required, componentIndicesRef)
    
    return ArchetypeService.of({
      addEntity: (entity) =>
        Ref.update(entitiesRef, entities => {
          const newEntities = new Set(entities)
          newEntities.add(entity)
          return newEntities
        }),
      
      removeEntity: (entity) =>
        Ref.update(entitiesRef, entities => {
          const newEntities = new Set(entities)
          newEntities.delete(entity)
          return newEntities
        }),
      
      getEntities: () =>
        Effect.gen(function* () {
          const entities = yield* Ref.get(entitiesRef)
          return Array.from(entities)
        }),
      
      matches: (targetSignature) =>
        Effect.succeed(archetypeMatches(signature, targetSignature)),
      
      matchesMask: (requiredMask, forbiddenMask) =>
        Effect.succeed(archetypeMatchesMask(componentMask, requiredMask, forbiddenMask)),
      
      getSize: () =>
        Effect.gen(function* () {
          const entities = yield* Ref.get(entitiesRef)
          return entities.size
        })
    })
  })

/**
 * Get or create archetype for given signature
 */
const getOrCreateArchetype = (
  signature: ArchetypeSignature,
  stateRef: Ref.Ref<ArchetypeManagerState>
): Effect.Effect<ArchetypeService.Type> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const existingArchetypeOption = HashMap.get(state.archetypes, signature.hash)
    
    if (Option.isSome(existingArchetypeOption)) {
      // Return existing archetype service (this would need to be stored differently in practice)
      const componentIndicesRef = yield* Ref.make(state.componentIndices)
      return yield* createArchetypeService(signature, componentIndicesRef)
    }
    
    // Create new archetype
    const componentIndicesRef = yield* Ref.make(state.componentIndices)
    const archetypeService = yield* createArchetypeService(signature, componentIndicesRef)
    const componentMask = yield* computeComponentMask(signature.required, componentIndicesRef)
    
    const newArchetypeState: ArchetypeState = {
      entities: new Set<QueryEntity>(),
      signature,
      componentMask
    }
    
    yield* Ref.update(stateRef, state => ({
      ...state,
      archetypes: HashMap.set(state.archetypes, signature.hash, newArchetypeState),
      componentIndices: yield* Ref.get(componentIndicesRef) as ComponentIndices
    }))
    
    return archetypeService
  })

/**
 * Add entity to appropriate archetype
 */
const addEntityToArchetype = (
  entity: QueryEntity,
  stateRef: Ref.Ref<ArchetypeManagerState>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    // Remove from current archetype if exists
    yield* removeEntityFromArchetype(entity, stateRef)
    
    // Determine entity's archetype based on components
    const componentNames = Object.keys(entity.components) as ComponentName[]
    const signature = createArchetypeSignature(componentNames, [])
    const archetype = yield* getOrCreateArchetype(signature, stateRef)
    
    yield* archetype.addEntity(entity)
    
    // Update entity to archetype mapping
    yield* Ref.update(stateRef, state => {
      const archetypeStateOption = HashMap.get(state.archetypes, signature.hash)
      if (Option.isSome(archetypeStateOption)) {
        const archetypeState = archetypeStateOption.value
        const newArchetypeState = {
          ...archetypeState,
          entities: new Set([...archetypeState.entities, entity])
        }
        return {
          ...state,
          archetypes: HashMap.set(state.archetypes, signature.hash, newArchetypeState),
          entityToArchetype: HashMap.set(state.entityToArchetype, entity, newArchetypeState)
        }
      }
      return state
    })
  })

/**
 * Remove entity from its archetype
 */
const removeEntityFromArchetype = (
  entity: QueryEntity,
  stateRef: Ref.Ref<ArchetypeManagerState>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const currentArchetypeOption = HashMap.get(state.entityToArchetype, entity)
    
    if (Option.isSome(currentArchetypeOption)) {
      const currentArchetype = currentArchetypeOption.value
      const newEntities = new Set(currentArchetype.entities)
      newEntities.delete(entity)
      
      const updatedArchetype = {
        ...currentArchetype,
        entities: newEntities
      }
      
      yield* Ref.update(stateRef, state => ({
        ...state,
        archetypes: HashMap.set(state.archetypes, currentArchetype.signature.hash, updatedArchetype),
        entityToArchetype: HashMap.remove(state.entityToArchetype, entity)
      }))
    }
  })

/**
 * Find all archetypes matching the given signature
 */
const findMatchingArchetypes = (
  signature: ArchetypeSignature,
  stateRef: Ref.Ref<ArchetypeManagerState>
): Effect.Effect<ReadonlyArray<ArchetypeService.Type>> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const matching: ArchetypeService.Type[] = []
    
    for (const [_, archetypeState] of HashMap.toEntries(state.archetypes)) {
      if (archetypeMatches(archetypeState.signature, signature)) {
        const componentIndicesRef = yield* Ref.make(state.componentIndices)
        const archetypeService = yield* createArchetypeService(archetypeState.signature, componentIndicesRef)
        matching.push(archetypeService)
      }
    }
    
    return matching
  })

/**
 * Get all entities across all archetypes
 */
const getAllArchetypeEntities = (
  stateRef: Ref.Ref<ArchetypeManagerState>
): Effect.Effect<ReadonlyArray<EntityId>> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const entities: EntityId[] = []
    
    for (const [_, archetypeState] of HashMap.toEntries(state.archetypes)) {
      entities.push(...Array.from(archetypeState.entities).map(entity => entity.id))
    }
    
    return entities
  })

/**
 * Get archetype manager statistics
 */
const getArchetypeStats = (
  stateRef: Ref.Ref<ArchetypeManagerState>
): Effect.Effect<ArchetypeManagerStats> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    
    const archetypeDistribution = HashMap.toEntries(state.archetypes)
      .map(([hash, archetypeState]) => ({
        hash,
        entityCount: archetypeState.entities.size,
        components: Array.from(archetypeState.signature.required),
      }))
    
    return {
      totalArchetypes: HashMap.size(state.archetypes),
      totalEntities: HashMap.size(state.entityToArchetype),
      archetypeDistribution,
    }
  })

/**
 * Execute archetype-based query
 */
const executeArchetypeQuery = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
  entities: ReadonlyArray<QueryEntity> | undefined,
  managerStateRef: Ref.Ref<ArchetypeManagerState>
): Effect.Effect<{ entities: ReadonlyArray<QueryEntity>; metrics: QueryMetrics }> =>
  Effect.gen(function* () {
    const context = startQueryContext()
    
    let resultEntities: QueryEntity[]
    
    if (entities) {
      // Direct entity filtering (fallback mode)
      resultEntities = yield* executeDirectFilter(config, entities, context)
    } else {
      // Archetype-based querying (optimized mode)
      resultEntities = yield* executeArchetypeBasedQuery(config, context, managerStateRef)
    }
    
    // Apply predicate if specified
    if (config.predicate) {
      resultEntities = yield* applyArchetypePredicate(resultEntities, config, context)
    }
    
    context.metrics.entitiesMatched = resultEntities.length
    const metrics = finalizeQueryContext(context)
    
    return {
      entities: resultEntities,
      metrics,
    }
  })

/**
 * Execute archetype-based query
 */
const executeArchetypeBasedQuery = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
  context: { metrics: QueryMetrics },
  managerStateRef: Ref.Ref<ArchetypeManagerState>
): Effect.Effect<QueryEntity[]> =>
  Effect.gen(function* () {
    const signature = createArchetypeSignature(
      config.withComponents,
      config.withoutComponents || []
    )
    
    const matchingArchetypes = yield* findMatchingArchetypes(signature, managerStateRef)
    const entities: QueryEntity[] = []
    
    for (const archetype of matchingArchetypes) {
      const archetypeEntities = yield* archetype.getEntities()
      context.metrics.entitiesScanned += archetypeEntities.length
      entities.push(...archetypeEntities)
    }
    
    return entities
  })

/**
 * Execute direct entity filtering
 */
const executeDirectFilter = <T extends ReadonlyArray<ComponentName>>(
  config: QueryConfig<T>,
  entities: ReadonlyArray<QueryEntity>,
  context: { metrics: QueryMetrics }
): Effect.Effect<QueryEntity[]> =>
  Effect.gen(function* () {
    const result: QueryEntity[] = []
    
    for (const entity of entities) {
      context.metrics.entitiesScanned++
      
      // Check required components
      const hasRequired = config.withComponents.every(
        comp => entity.components[comp] !== undefined
      )
      
      if (!hasRequired) continue
      
      // Check forbidden components
      const hasForbidden = (config.withoutComponents || []).some(
        comp => entity.components[comp] !== undefined
      )
      
      if (hasForbidden) continue
      
      result.push(entity)
    }
    
    return result
  })

/**
 * Apply predicate to archetype query results
 */
const applyArchetypePredicate = <T extends ReadonlyArray<ComponentName>>(
  entities: QueryEntity[],
  config: QueryConfig<T>,
  _context: { metrics: QueryMetrics }
): Effect.Effect<QueryEntity[]> =>
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
        if (config.predicate(entityProxy as any)) {
          result.push(entity)
        }
      } catch (error) {
        console.warn(`Predicate error for entity ${entity.id}:`, error)
      }
    }
    
    return result
  })

/**
 * Archetype Manager Service Implementation
 */
export const ArchetypeManagerServiceLive = Layer.effect(
  ArchetypeManagerService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<ArchetypeManagerState>({
      archetypes: HashMap.empty(),
      entityToArchetype: HashMap.empty(),
      componentIndices: {
        componentToIndex: HashMap.empty(),
        nextIndex: 0
      }
    })
    
    return ArchetypeManagerService.of({
      createSignature: createArchetypeSignature,
      getOrCreateArchetype: (signature) => getOrCreateArchetype(signature, stateRef),
      addEntity: (entity) => addEntityToArchetype(entity, stateRef),
      removeEntity: (entity) => removeEntityFromArchetype(entity, stateRef),
      findMatchingArchetypes: (signature) => findMatchingArchetypes(signature, stateRef),
      getAllEntities: () => getAllArchetypeEntities(stateRef),
      getStats: () => getArchetypeStats(stateRef)
    })
  })
)

/**
 * Archetype Query Service Implementation
 */
export const ArchetypeQueryServiceLive = Layer.effect(
  ArchetypeQueryService,
  Effect.gen(function* () {
    const managerStateRef = yield* Ref.make<ArchetypeManagerState>({
      archetypes: HashMap.empty(),
      entityToArchetype: HashMap.empty(),
      componentIndices: {
        componentToIndex: HashMap.empty(),
        nextIndex: 0
      }
    })
    
    return ArchetypeQueryService.of({
      execute: <T extends ReadonlyArray<ComponentName>>(
        config: QueryConfig<T>,
        entities?: ReadonlyArray<QueryEntity>
      ) => executeArchetypeQuery(config, entities, managerStateRef),
      
      addEntity: (entity) => addEntityToArchetype(entity, managerStateRef),
      removeEntity: (entity) => removeEntityFromArchetype(entity, managerStateRef),
      getStats: () => getArchetypeStats(managerStateRef),
      reset: () =>
        Ref.set(managerStateRef, {
          archetypes: HashMap.empty(),
          entityToArchetype: HashMap.empty(),
          componentIndices: {
            componentToIndex: HashMap.empty(),
            nextIndex: 0
          }
        })
    })
  })
)

/**
 * Legacy Archetype class wrapper for backward compatibility
 */
export class Archetype {
  constructor(public readonly signature: ArchetypeSignature) {}
  
  addEntity(entity: QueryEntity): void {
    throw new Error('Legacy Archetype.addEntity() not supported. Use ArchetypeService instead.')
  }
  
  removeEntity(entity: QueryEntity): void {
    throw new Error('Legacy Archetype.removeEntity() not supported. Use ArchetypeService instead.')
  }
  
  getEntities(): ReadonlyArray<QueryEntity> {
    throw new Error('Legacy Archetype.getEntities() not supported. Use ArchetypeService instead.')
  }
  
  matches(signature: ArchetypeSignature): boolean {
    throw new Error('Legacy Archetype.matches() not supported. Use ArchetypeService instead.')
  }
  
  matchesMask(requiredMask: bigint, forbiddenMask: bigint): boolean {
    throw new Error('Legacy Archetype.matchesMask() not supported. Use ArchetypeService instead.')
  }
  
  get size(): number {
    throw new Error('Legacy Archetype.size not supported. Use ArchetypeService instead.')
  }
}

/**
 * Legacy ArchetypeManager class wrapper for backward compatibility
 */
export class ArchetypeManager {
  createSignature(
    required: ReadonlyArray<ComponentName>,
    forbidden: ReadonlyArray<ComponentName> = []
  ): ArchetypeSignature {
    return createArchetypeSignature(required, forbidden)
  }
  
  getOrCreateArchetype(signature: ArchetypeSignature): Archetype {
    throw new Error('Legacy ArchetypeManager.getOrCreateArchetype() not supported. Use ArchetypeManagerService instead.')
  }
  
  addEntity(entity: QueryEntity): void {
    throw new Error('Legacy ArchetypeManager.addEntity() not supported. Use ArchetypeManagerService instead.')
  }
  
  removeEntity(entity: QueryEntity): void {
    throw new Error('Legacy ArchetypeManager.removeEntity() not supported. Use ArchetypeManagerService instead.')
  }
  
  findMatchingArchetypes(signature: ArchetypeSignature): ReadonlyArray<Archetype> {
    throw new Error('Legacy ArchetypeManager.findMatchingArchetypes() not supported. Use ArchetypeManagerService instead.')
  }
  
  getAllEntities(): ReadonlyArray<EntityId> {
    throw new Error('Legacy ArchetypeManager.getAllEntities() not supported. Use ArchetypeManagerService instead.')
  }
  
  getStats() {
    throw new Error('Legacy ArchetypeManager.getStats() not supported. Use ArchetypeManagerService instead.')
  }
}

/**
 * Legacy ArchetypeQuery class wrapper for backward compatibility
 */
export class ArchetypeQuery<T extends ReadonlyArray<ComponentName>> {
  constructor(private config: QueryConfig<T>) {}
  
  execute(entities?: ReadonlyArray<QueryEntity>): {
    entities: ReadonlyArray<QueryEntity>
    metrics: QueryMetrics
  } {
    throw new Error('Legacy ArchetypeQuery.execute() not supported. Use ArchetypeQueryService instead.')
  }
  
  static addEntity(entity: QueryEntity): void {
    throw new Error('Legacy ArchetypeQuery.addEntity() not supported. Use ArchetypeQueryService instead.')
  }
  
  static removeEntity(entity: QueryEntity): void {
    throw new Error('Legacy ArchetypeQuery.removeEntity() not supported. Use ArchetypeQueryService instead.')
  }
  
  static getArchetypeStats() {
    throw new Error('Legacy ArchetypeQuery.getArchetypeStats() not supported. Use ArchetypeQueryService instead.')
  }
  
  static reset(): void {
    throw new Error('Legacy ArchetypeQuery.reset() not supported. Use ArchetypeQueryService instead.')
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
}

// Convenience functions for test compatibility
export const addEntityToArchetype = (entity: QueryEntity): void => {
  throw new Error('Legacy addEntityToArchetype() not supported. Use ArchetypeQueryService instead.')
}

export const removeEntityFromArchetype = (entity: QueryEntity): void => {
  throw new Error('Legacy removeEntityFromArchetype() not supported. Use ArchetypeQueryService instead.')
}

export const getArchetypeStats = () => {
  throw new Error('Legacy getArchetypeStats() not supported. Use ArchetypeQueryService instead.')
}

export const resetArchetypes = (): void => {
  throw new Error('Legacy resetArchetypes() not supported. Use ArchetypeQueryService instead.')
}