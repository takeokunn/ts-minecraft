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
 * Archetype query state
 */
interface ArchetypeQueryState {
  readonly requiredComponents: readonly string[]
  readonly optionalComponents: readonly string[]
  readonly excludedComponents: readonly string[]
}

/**
 * Create an archetype query with empty state
 */
const createArchetypeQueryState = (): ArchetypeQueryState => ({
  requiredComponents: [],
  optionalComponents: [],
  excludedComponents: [],
})

/**
 * Add required components to the query
 */
const withComponents = <T extends string>(
  state: ArchetypeQueryState,
  ...componentIds: T[]
): ArchetypeQueryState => ({
  ...state,
  requiredComponents: [...state.requiredComponents, ...componentIds],
})

/**
 * Add optional components to the query
 */
const maybeComponents = <T extends string>(
  state: ArchetypeQueryState,
  ...componentIds: T[]
): ArchetypeQueryState => ({
  ...state,
  optionalComponents: [...state.optionalComponents, ...componentIds],
})

/**
 * Exclude components from the query
 */
const withoutComponents = <T extends string>(
  state: ArchetypeQueryState,
  ...componentIds: T[]
): ArchetypeQueryState => ({
  ...state,
  excludedComponents: [...state.excludedComponents, ...componentIds],
})

/**
 * Execute the archetype query and return results
 */
const executeArchetypeQuery = (state: ArchetypeQueryState): ArchetypeQueryResult => {
  const registry = globalRegistry
  const archetype = registry.getArchetype(state.requiredComponents)

  // Filter entities that don't have excluded components
  const filteredEntities = archetype.entities.filter((entityId) => {
    return !state.excludedComponents.some((componentId) => 
      registry.query([componentId]).hasComponent(entityId, componentId)
    )
  })

  return {
    entities: filteredEntities,
    archetype,
    getComponent: <T>(entityId: number, componentId: string) => 
      registry.query([componentId]).getComponent<T>(entityId, componentId),
    hasComponent: (entityId: number, componentId: string) => 
      registry.query([componentId]).hasComponent(entityId, componentId),
    requiredComponents: state.requiredComponents,
    optionalComponents: state.optionalComponents,
    storageLayout: archetype.storageLayout,
  }
}

/**
 * Functional archetype query builder
 */
export const ArchetypeQuery = {
  create: createArchetypeQueryState,
  with: withComponents,
  maybe: maybeComponents,
  without: withoutComponents,
  execute: executeArchetypeQuery,
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
export const createArchetypeQuery = () => ArchetypeQuery.create()