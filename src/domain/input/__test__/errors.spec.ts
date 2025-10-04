import { describe, expect, it } from '@effect/vitest'
import { Either } from 'effect'
import { fromParseError, queueOverflow } from '../errors'
import { decodeInputEvent } from '../model'

describe('errors', () => {
  it('transforms schema parse errors into domain errors', () => {
    const result = decodeInputEvent({ foo: 'bar' })
    expect(Either.isLeft(result)).toBe(true)
    const error = Either.match(result, {
      onLeft: (parseError) => fromParseError(parseError),
      onRight: () => {
        throw new Error('expected failure')
      },
    })
    expect(error._tag).toBe('InvalidEvent')
    expect(error.issues.length).toBeGreaterThan(0)
  })

  it('creates queue overflow error with pending size', () => {
    const overflow = queueOverflow(5)
    expect(overflow.pending).toBe(5)
  })
})
