import * as Schema from '@effect/schema/Schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect, Either, Option } from 'effect'
import {
  CreateBedInputSchema,
  FurnitureIdSchema,
  decodeCreateBedInput,
  decodeCreateSignInput,
  optionFromNullable,
  toValidationError,
} from '../types.js'

describe('furniture/types', () => {
  it('decodeCreateBedInput succeeds with valid data', () => {
    const input = {
      color: 'red',
      orientation: 'north',
      coordinates: { x: 0, y: 64, z: 0 },
      requestedBy: 'player_abcd1234',
    }

    const result = decodeCreateBedInput(input)
    expect(Either.isRight(result)).toBe(true)
  })

  it('decodeCreateBedInput fails with invalid color', () => {
    const invalid = {
      color: 'invalid',
      orientation: 'north',
      coordinates: { x: 0, y: 64, z: 0 },
      requestedBy: 'player_abcd1234',
    }

    const result = decodeCreateBedInput(invalid)
    expect(Either.isLeft(result)).toBe(true)
  })

  it('optionFromNullable converts null to none', () => {
    const option = optionFromNullable(null)
    expect(Option.isNone(option)).toBe(true)
  })

  it('FurnitureIdSchema rejects unknown format', () => {
    const decode = Schema.decode(FurnitureIdSchema)
    const effect = decode('invalid')
    expect(() => Effect.runSync(effect)).toThrow()
  })

  it('sign input defaults glowing flag', () => {
    const input = {
      style: 'oak',
      text: { lines: ['hello'], alignment: 'left' },
      placedBy: 'player_abcd1234',
      location: { x: 1, y: 70, z: 1 },
    }

    const result = decodeCreateSignInput(input)
    expect(Either.isRight(result)).toBe(true)
    const signInput = result.right
    expect(signInput.glowing ?? false).toBe(false)
  })

  it('toValidationError aggregates issues', () => {
    const effect = Schema.decode(CreateBedInputSchema)({})
    const failure = Effect.runSync(Effect.either(effect))
    if (Either.isLeft(failure)) {
      const error = toValidationError(failure.left)
      expect(error._tag).toBe('Validation')
      expect(error.issues.length).toBeGreaterThan(0)
    } else {
      throw new Error('expected failure')
    }
  })
})
