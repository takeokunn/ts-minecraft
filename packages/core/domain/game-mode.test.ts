import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Schema } from 'effect'
import { GameModeSchema, DEFAULT_GAME_MODE } from './game-mode'

describe('GameModeSchema', () => {
  it('accepts "survival"', () => {
    const result = Schema.decodeUnknownEither(GameModeSchema)('survival')
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts "creative"', () => {
    const result = Schema.decodeUnknownEither(GameModeSchema)('creative')
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects "hardcore"', () => {
    const result = Schema.decodeUnknownEither(GameModeSchema)('hardcore')
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects empty string', () => {
    const result = Schema.decodeUnknownEither(GameModeSchema)('')
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects numbers', () => {
    const result = Schema.decodeUnknownEither(GameModeSchema)(0)
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('DEFAULT_GAME_MODE', () => {
  it('equals "survival"', () => {
    expect(DEFAULT_GAME_MODE).toBe('survival')
  })
})
