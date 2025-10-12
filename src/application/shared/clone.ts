import { Effect } from 'effect'

/**
 * immutable clone utility
 * falls back to JSON serialization when structuredClone is not available
 */
export const clone = <A>(value: A): Effect.Effect<A> =>
  Effect.sync(() => {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value)
    }
    return JSON.parse(JSON.stringify(value)) as A
  })
