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

  it.effect.prop('NotFound errors preserve entity label', [fc.string({ minLength: 1, maxLength: 12 })], ([entity]) =>
    Effect.succeed(PhysicsError.NotFound({ entity, reference: 'ref' })).pipe(
      Effect.map((error) => PhysicsError.match(error, {
        SchemaViolation: () => 'schema',
        ConstraintViolation: () => 'constraint',
        NotFound: (e) => e.entity,
        TemporalAnomaly: () => 'time',
        InvalidTransition: () => 'transition',
      })),
      Effect.tap((label) => Effect.sync(() => expect(label).toBe(entity)))
    )
  )
})
