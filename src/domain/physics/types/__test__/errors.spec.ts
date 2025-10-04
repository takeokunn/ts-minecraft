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

  it.effect.prop(
    'NotFound errors preserve entity label',
    [
      fc.string({ minLength: 1, maxLength: 32 }),
      fc.oneof(fc.constant(undefined), fc.string({ minLength: 1, maxLength: 64 })),
    ],
    ([entity, reference]) =>
      Effect.gen(function* () {
        const error = PhysicsError.NotFound({ entity, reference })

        expect(error.entity).toBe(entity)
        expect(error.reference).toBe(reference)

        const matchedEntity = PhysicsError.match(error, {
          SchemaViolation: () => '__schema__',
          ConstraintViolation: () => '__constraint__',
          NotFound: (value) => value.entity,
          TemporalAnomaly: () => '__temporal__',
          InvalidTransition: () => '__transition__',
        })

        expect(matchedEntity).toBe(entity)

        const exit = yield* Effect.either(Effect.fail(error))
        if (Either.isRight(exit)) {
          throw new Error('expected failure')
        }

        const preserved = exit.left as PhysicsError
        expect(preserved._tag).toBe('NotFound')
        expect(preserved.entity).toBe(entity)
        expect(preserved.reference).toBe(reference)
      })
  )
})
