/**
 * Archetype Query System
 * 
 * This module provides optimized archetype-based queries for ECS performance.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

import * as Data from 'effect/Data'
import * as Option from 'effect/Option'
import { globalRegistry } from '@domain/entities/components/registry'
import type { ArchetypeInfo, StorageLayout, QueryResult } from '@domain/entities/components/registry'

/**
 * Archetype query builder for optimized component access
 */
export class ArchetypeQuery {
  private requiredComponents: readonly string[] = []
  private optionalComponents: readonly string[] = []
  private excludedComponents: readonly string[] = []

  static create(): ArchetypeQuery {
    return new ArchetypeQuery()
  }

  /**
   * Add required components to the query
   */
  with<T extends string>(...componentIds: T[]): ArchetypeQuery {
    return Data.struct({
      ...this,
      requiredComponents: [...this.requiredComponents, ...componentIds],
    })
  }

  /**
   * Add optional components to the query
   */
  maybe<T extends string>(...componentIds: T[]): ArchetypeQuery {
    return Data.struct({
      ...this,
      optionalComponents: [...this.optionalComponents, ...componentIds],
    })
  }

  /**
   * Exclude components from the query
   */
  without<T extends string>(...componentIds: T[]): ArchetypeQuery {
    return Data.struct({
      ...this,
      excludedComponents: [...this.excludedComponents, ...componentIds],
    })
  }

  /**
   * Execute the query and return results
   */
  execute(): ArchetypeQueryResult {
    const registry = globalRegistry
    const archetype = registry.getArchetype(this.requiredComponents)

    // Filter entities that don't have excluded components
    const filteredEntities = archetype.entities.filter((entityId) => {
      return !this.excludedComponents.some((componentId) => registry.query([componentId]).hasComponent(entityId, componentId))
    })

    return {
      entities: filteredEntities,
      archetype,
      getComponent: <T>(entityId: number, componentId: string) => registry.query([componentId]).getComponent<T>(entityId, componentId),
      hasComponent: (entityId: number, componentId: string) => registry.query([componentId]).hasComponent(entityId, componentId),
      requiredComponents: this.requiredComponents,
      optionalComponents: this.optionalComponents,
      storageLayout: archetype.storageLayout,
    }
  }
}

export interface ArchetypeQueryResult {
  readonly entities: readonly number[]
  readonly archetype: ArchetypeInfo
  readonly getComponent: <T>(entityId: number, componentId: string) => Option.Option<T>
  readonly hasComponent: (entityId: number, componentId: string) => boolean
  readonly requiredComponents: readonly string[]
  readonly optionalComponents: readonly string[]
  readonly storageLayout: StorageLayout
}

/**
 * High-level query interface
 */
export const query = (components: readonly string[]): QueryResult => globalRegistry.query(components)

/**
 * Create archetype query builder
 */
export const createArchetypeQuery = (): ArchetypeQuery => ArchetypeQuery.create()