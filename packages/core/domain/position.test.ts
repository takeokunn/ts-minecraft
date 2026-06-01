import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Schema } from 'effect'
import { PositionSchema } from './position'

describe('PositionSchema', () => {
  it('accepts { x: 0, y: 0, z: 0 }', () => {
    const result = Schema.decodeUnknownEither(PositionSchema)({ x: 0, y: 0, z: 0 })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts arbitrary finite coordinates', () => {
    const result = Schema.decodeUnknownEither(PositionSchema)({ x: 1.5, y: -100, z: 64.25 })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects NaN in x', () => {
    const result = Schema.decodeUnknownEither(PositionSchema)({ x: NaN, y: 0, z: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects Infinity in y', () => {
    const result = Schema.decodeUnknownEither(PositionSchema)({ x: 0, y: Infinity, z: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects -Infinity in z', () => {
    const result = Schema.decodeUnknownEither(PositionSchema)({ x: 0, y: 0, z: -Infinity })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects missing fields', () => {
    const result = Schema.decodeUnknownEither(PositionSchema)({ x: 1, y: 2 })
    expect(Either.isLeft(result)).toBe(true)
  })
})
