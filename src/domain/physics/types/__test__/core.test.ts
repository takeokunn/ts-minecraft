import { it } from '@effect/vitest'
import { Effect, Either, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import {
  AABBSchema,
  Vector3Schema,
  decodeWith,
  positiveFloat,
  parsePositiveFloat,
  vector3,
} from '../core'

describe('Core types', () => {
  it('decodes vector3 constants', () => {
    const vector = vector3({ x: 1, y: -2, z: 3 })
    expect(vector.x).toBe(1)
  })

  it.effect('fails on invalid decode', () =>
    Effect.matchEffect(
      decodeWith(Vector3Schema)({ x: 'a', y: 0, z: 0 }),
      {
        onFailure: (error) => Effect.sync(() => expect(error._tag).toBe('SchemaViolation')),
        onSuccess: () => Effect.fail(new Error('expected failure')),
      }
    )
  )

  it.effect.prop('positiveFloat enforces positivity', [fc.float({ min: 0.001, max: 100 })], ([value]) =>
    Effect.sync(() => expect(positiveFloat(value)).toBeGreaterThan(0))
  )

  it.effect('parsePositiveFloat rejects non-positive', () =>
    Effect.matchEffect(
      parsePositiveFloat(-1),
      {
        onFailure: (error) => Effect.sync(() => expect(error._tag).toBe('SchemaViolation')),
        onSuccess: () => Effect.fail(new Error('expected failure')),
      }
    )
  )
})
