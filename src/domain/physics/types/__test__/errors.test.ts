import { it } from '@effect/vitest'
import { Either, Effect, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import { PhysicsError, fromParseError } from '../errors'

describe('Physics Errors', () => {
  it('classifies schema violations', () => {
    const result = Schema.decodeUnknownEither(Schema.Number)('not-number')
    if (Either.isRight(result)) {
      throw new Error('expected parse failure')
    }
    const error = fromParseError(result.left)
    expect(error._tag).toBe('SchemaViolation')
    expect(error.message.length).toBeGreaterThan(0)
  })

  it('matches on variants', () => {
    const error = PhysicsError.NotFound({ entity: 'World', reference: 'test' })
    const message = PhysicsError.match(error, {
      SchemaViolation: () => 'schema',
      ConstraintViolation: () => 'constraint',
      NotFound: (e) => `missing ${e.entity}`,
      TemporalAnomaly: () => 'time',
      InvalidTransition: () => 'transition',
    })
    expect(message).toBe('missing World')
  })

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('NotFound errors preserve entity label', () => Effect.unit)
})
