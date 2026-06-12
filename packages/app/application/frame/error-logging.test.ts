import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { logErrors } from './error-logging'

describe('logErrors', () => {
  it('passes through the success value', async () => {
    const result = await Effect.runPromise(logErrors(Effect.succeed(42), 'stage'))
    expect(result).toBe(42)
  })

  it('converts a typed error to void without rejecting', async () => {
    const result = await Effect.runPromise(logErrors(Effect.fail(new Error('boom')), 'stage'))
    expect(result).toBeUndefined()
  })

  it('converts a defect to void without rejecting', async () => {
    const result = await Effect.runPromise(logErrors(Effect.die('fatal'), 'stage'))
    expect(result).toBeUndefined()
  })

  it('the returned Effect has type never for its error channel', () => {
    // Compile-time check: logErrors always produces Effect<A | void, never, R>.
    // The fact this type-checks with Effect.runPromise (which requires E=never) is the assertion.
    const safe: Effect.Effect<number | void, never> = logErrors(
      Effect.fail<Error, number>(new Error('typed')) as Effect.Effect<number, Error>,
      'test',
    )
    expect(safe).toBeDefined()
  })
})
