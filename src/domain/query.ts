import type { ComponentName } from './components'

/**
 * Defines the structure of a query used to retrieve entities from the world.
 */
export type Query = {
  /** A unique name for the query, primarily for debugging. */
  readonly name: string
  /** An array of component names that an entity must have to match the query. */
  readonly components: readonly ComponentName[]
}

/**
 * Creates a new Query object.
 * @param name The unique name of the query.
 * @param components The list of required component names.
 * @returns A Query object.
 */
export const createQuery = (name: string, components: readonly ComponentName[]): Query => ({
  name,
  components,
})