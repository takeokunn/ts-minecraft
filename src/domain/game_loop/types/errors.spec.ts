import * as Either from 'effect/Either'
import * as FastCheck from 'effect/FastCheck'
import * as Schema from 'effect/Schema'
import { describe, expect, it } from 'vitest'

import { makeFps, makeTimestamp } from './core'
import {
  InitializationError,
  decodeGameLoopError,
  stringifyGameLoopError,
  toPerformanceError,
  toRuntimeCallbackError,
  toStateTransitionError,
} from './errors'

describe('error ADT', () => {
  it('constructs initialization error', () => {
    const error = InitializationError({ reason: 'config missing' })
    expect(error.reason).toBe('config missing')
  })

  it('decodes serialized errors', () => {
    const fps = Either.getOrElse(makeFps(60), (parseError) => {
      throw new Error(Schema.formatError(parseError))
    })
    const error = toPerformanceError({ metric: 'fps', target: fps, observed: fps })
    const decoded = decodeGameLoopError(error)
    expect(
      Either.getOrElse(decoded, (parseError) => {
        throw new Error(Schema.formatError(parseError))
      })
    ).toEqual(error)
  })

  it('stringifies runtime callback errors and preserves context', async () => {
    const timestamp = Either.getOrElse(makeTimestamp(1000), (parseError) => {
      throw new Error(Schema.formatError(parseError))
    })
    const serialized = stringifyGameLoopError(
      toRuntimeCallbackError({ callbackId: 'cb', causeMessage: 'oops', occurredAt: timestamp })
    )
    const parsed = JSON.parse(serialized) as { readonly callbackId: string }
    expect(parsed.callbackId).toBe('cb')

    await FastCheck.assert(
      FastCheck.property(FastCheck.string(), (message) => {
        const error = toStateTransitionError({ from: 'idle', to: 'running', message })
        const parsedState = JSON.parse(stringifyGameLoopError(error)) as { readonly message: string }
        return parsedState.message === message
      })
    )
  })
})
