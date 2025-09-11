/**
 * Archetype-based Query System
 * Provides high-performance entity querying using archetype patterns
 */

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
 * Archetype-based entity group for O(1) query matching
 */
export class Archetype {
  private entities: Set<QueryEntity> = new Set()
  private componentMask: bigint
  private static componentIndices: Map<ComponentName, number> = new Map()
  private static nextIndex = 0

  constructor(public readonly signature: ArchetypeSignature) {
    this.componentMask = this.computeComponentMask(signature.required)
  }

  private computeComponentMask(components: ReadonlySet<ComponentName>): bigint {
    let mask = 0n
    for (const component of components) {
      if (!Archetype.componentIndices.has(component)) {
        Archetype.componentIndices.set(component, Archetype.nextIndex++)
      }
      const index = Archetype.componentIndices.get(component)
      if (index !== undefined) {
        mask |= 1n << BigInt(index)
      }
    }
    return mask
  }

  /**
   * Add entity to this archetype
   */
  addEntity(entity: QueryEntity): void {
    this.entities.add(entity)
  }

  /**
   * Remove entity from this archetype
   */
  removeEntity(entity: QueryEntity): void {
    this.entities.delete(entity)
  }

  /**
   * Get all entities in this archetype
   */
  getEntities(): ReadonlyArray<QueryEntity> {
    return Array.from(this.entities)
  }

  /**
   * Check if this archetype matches the given signature
   */
  matches(signature: ArchetypeSignature): boolean {
    // Check that all required components are present
    for (const required of signature.required) {
      if (!this.signature.required.has(required)) {
        return false
      }
    }

    // Check that no forbidden components are present
    for (const forbidden of signature.forbidden) {
      if (this.signature.required.has(forbidden)) {
        return false
      }
    }

    return true
  }

  /**
   * Fast bit-mask based matching
   */
  matchesMask(requiredMask: bigint, forbiddenMask: bigint): boolean {
    // All required components must be present
    if ((this.componentMask & requiredMask) !== requiredMask) {
      return false
    }

    // No forbidden components should be present
    if ((this.componentMask & forbiddenMask) !== 0n) {
      return false
    }

    return true
  }

  get size(): number {
    return this.entities.size
  }
}

/**
 * Archetype manager for efficient entity organization
 */
export class ArchetypeManager {
  private archetypes: Map<string, Archetype> = new Map()
  private entityToArchetype: Map<QueryEntity, Archetype> = new Map()

  /**
   * Create archetype signature from component sets
   */
  createSignature(required: ReadonlyArray<ComponentName>, forbidden: ReadonlyArray<ComponentName> = []): ArchetypeSignature {
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
   * Get or create archetype for given signature
   */
  getOrCreateArchetype(signature: ArchetypeSignature): Archetype {
    let archetype = this.archetypes.get(signature.hash)

    if (!archetype) {
      archetype = new Archetype(signature)
      this.archetypes.set(signature.hash, archetype)
    }

    return archetype
  }

  /**
   * Add entity to appropriate archetype
   */
  addEntity(entity: QueryEntity): void {
    // Remove from current archetype if exists
    this.removeEntity(entity)

    // Determine entity's archetype based on components
    const componentNames = Object.keys(entity.components) as ComponentName[]
    const signature = this.createSignature(componentNames, [])
    const archetype = this.getOrCreateArchetype(signature)

    archetype.addEntity(entity)
    this.entityToArchetype.set(entity, archetype)
  }

  /**
   * Remove entity from its archetype
   */
  removeEntity(entity: QueryEntity): void {
    const currentArchetype = this.entityToArchetype.get(entity)
    if (currentArchetype) {
      currentArchetype.removeEntity(entity)
      this.entityToArchetype.delete(entity)
    }
  }

  /**
   * Find all archetypes matching the given signature
   */
  findMatchingArchetypes(signature: ArchetypeSignature): ReadonlyArray<Archetype> {
    const matching: Archetype[] = []

    for (const archetype of this.archetypes.values()) {
      if (archetype.matches(signature)) {
        matching.push(archetype)
      }
    }

    return matching
  }

  /**
   * Get all entities across all archetypes
   */
  getAllEntities(): ReadonlyArray<EntityId> {
    const entities: EntityId[] = []

    for (const archetype of this.archetypes.values()) {
      entities.push(...archetype.getEntities().map((entity) => entity.id))
    }

    return entities
  }

  /**
   * Get archetype statistics
   */
  getStats() {
    return {
      totalArchetypes: this.archetypes.size,
      totalEntities: this.entityToArchetype.size,
      archetypeDistribution: Array.from(this.archetypes.entries()).map(([hash, archetype]) => ({
        hash,
        entityCount: archetype.size,
        components: Array.from(archetype.signature.required),
      })),
    }
  }
}

/**
 * High-performance archetype-based query
 */
export class ArchetypeQuery<T extends ReadonlyArray<ComponentName>> {
  private signature: ArchetypeSignature
  private static archetypeManager = new ArchetypeManager()

  constructor(private config: QueryConfig<T>) {
    this.signature = ArchetypeQuery.archetypeManager.createSignature(config.withComponents, config.withoutComponents || [])
  }

  /**
   * Execute query using archetype-based filtering
   */
  execute(entities?: ReadonlyArray<QueryEntity>): {
    entities: ReadonlyArray<QueryEntity>
    metrics: QueryMetrics
  } {
    const context = startQueryContext()

    let resultEntities: QueryEntity[]

    if (entities) {
      // Direct entity filtering (fallback mode)
      resultEntities = this.executeDirectFilter(entities, context)
    } else {
      // Archetype-based querying (optimized mode)
      resultEntities = this.executeArchetypeQuery(context)
    }

    // Apply predicate if specified
    if (this.config.predicate) {
      resultEntities = this.applyPredicate(resultEntities, context)
    }

    context.metrics.entitiesMatched = resultEntities.length
    const metrics = finalizeQueryContext(context)

    return {
      entities: resultEntities,
      metrics,
    }
  }

  private executeArchetypeQuery(context: { metrics: QueryMetrics }): QueryEntity[] {
    const matchingArchetypes = ArchetypeQuery.archetypeManager.findMatchingArchetypes(this.signature)
    const entities: QueryEntity[] = []

    for (const archetype of matchingArchetypes) {
      const archetypeEntities = archetype.getEntities()
      context.metrics.entitiesScanned += archetypeEntities.length
      entities.push(...archetypeEntities)
    }

    return entities
  }

  private executeDirectFilter(entities: ReadonlyArray<QueryEntity>, context: { metrics: QueryMetrics }): QueryEntity[] {
    const result: QueryEntity[] = []

    for (const entity of entities) {
      context.metrics.entitiesScanned++

      // Check required components
      const hasRequired = this.config.withComponents.every((comp) => entity.components[comp] !== undefined)

      if (!hasRequired) continue

      // Check forbidden components
      const hasForbidden = (this.config.withoutComponents || []).some((comp) => entity.components[comp] !== undefined)

      if (hasForbidden) continue

      result.push(entity)
    }

    return result
  }

  private applyPredicate(entities: QueryEntity[], _context: { metrics: QueryMetrics }): QueryEntity[] {
    if (!this.config.predicate) return entities

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
        const typedProxy = entityProxy as unknown as Parameters<NonNullable<typeof this.config.predicate>>[0]
        if (this.config.predicate(typedProxy)) {
          result.push(entity)
        }
      } catch (error) {
        console.warn(`Predicate error for entity ${entity.id}:`, error)
      }
    }

    return result
  }

  /**
   * Add entity to archetype system
   */
  static addEntity(entity: QueryEntity): void {
    ArchetypeQuery.archetypeManager.addEntity(entity)
  }

  /**
   * Remove entity from archetype system
   */
  static removeEntity(entity: QueryEntity): void {
    ArchetypeQuery.archetypeManager.removeEntity(entity)
  }

  /**
   * Get archetype manager statistics
   */
  static getArchetypeStats() {
    return ArchetypeQuery.archetypeManager.getStats()
  }

  /**
   * Reset archetype system (useful for testing)
   */
  static reset(): void {
    ArchetypeQuery.archetypeManager = new ArchetypeManager()
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
  ArchetypeQuery.addEntity(entity)
}

export const removeEntityFromArchetype = (entity: QueryEntity): void => {
  ArchetypeQuery.removeEntity(entity)
}

export const getArchetypeStats = () => {
  return ArchetypeQuery.getArchetypeStats()
}

export const resetArchetypes = (): void => {
  ArchetypeQuery.reset()
}
