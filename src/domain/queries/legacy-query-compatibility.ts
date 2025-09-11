/**
 * Domain-Level Legacy Query Compatibility
 * 
 * This module provides legacy compatibility functions for domain queries.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

import { ComponentName } from '@/domain/entities/components'

/**
 * Legacy Query interface for backward compatibility
 */
export interface LegacyQuery<T extends ReadonlyArray<ComponentName> = ReadonlyArray<ComponentName>> {
  readonly name: string
  readonly components: T
  readonly set: ReadonlySet<ComponentName>
}

/**
 * Legacy query result type for backward compatibility
 */
export type LegacyQueryResult<T extends ReadonlyArray<ComponentName>> = {
  [K in keyof T]: T[K] extends ComponentName ? ComponentName : T[K]
}

/**
 * Create legacy query for backward compatibility
 * @deprecated Use the new query builder API instead
 */
export const createQuery = <T extends ReadonlyArray<ComponentName>>(name: string, components: T): LegacyQuery<T> => {
  const set = new Set(components)
  return {
    name,
    components,
    set,
  }
}