import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Schema } from 'effect'
import { GameModeService, DEFAULT_GAME_MODE, GameModeSchema } from '@ts-minecraft/game'

describe('application/game-mode/game-mode-service', () => {
  it.effect('defaults to survival', () =>
    Effect.gen(function* () {
      const svc = yield* GameModeService
      expect(yield* svc.get()).toBe('survival')
      expect(DEFAULT_GAME_MODE).toBe('survival')
    }).pipe(Effect.provide(GameModeService.Default)),
  )

  it.effect('set switches mode and isCreative/isSurvival reflect it', () =>
    Effect.gen(function* () {
      const svc = yield* GameModeService
      expect(yield* svc.isSurvival()).toBe(true)
      expect(yield* svc.isCreative()).toBe(false)
      yield* svc.set('creative')
      expect(yield* svc.get()).toBe('creative')
      expect(yield* svc.isCreative()).toBe(true)
      expect(yield* svc.isSurvival()).toBe(false)
      yield* svc.set('survival')
      expect(yield* svc.isSurvival()).toBe(true)
    }).pipe(Effect.provide(GameModeService.Default)),
  )

  it.effect('spectator mode: isSpectator true, isCreative/isSurvival false', () =>
    Effect.gen(function* () {
      const svc = yield* GameModeService
      yield* svc.set('spectator')
      expect(yield* svc.get()).toBe('spectator')
      expect(yield* svc.isSpectator()).toBe(true)
      expect(yield* svc.isCreative()).toBe(false)
      expect(yield* svc.isSurvival()).toBe(false)
    }).pipe(Effect.provide(GameModeService.Default)),
  )
})

describe('GameModeSchema — validation', () => {
  it('accepts "survival"', () => {
    expect(Schema.decodeUnknownSync(GameModeSchema)('survival')).toBe('survival')
  })

  it('accepts "creative"', () => {
    expect(Schema.decodeUnknownSync(GameModeSchema)('creative')).toBe('creative')
  })

  it('accepts "spectator"', () => {
    expect(Schema.decodeUnknownSync(GameModeSchema)('spectator')).toBe('spectator')
  })

  it('rejects "hardcore"', () => {
    expect(() => Schema.decodeUnknownSync(GameModeSchema)('hardcore')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => Schema.decodeUnknownSync(GameModeSchema)('')).toThrow()
  })

  it('rejects a number', () => {
    expect(() => Schema.decodeUnknownSync(GameModeSchema)(0)).toThrow()
  })

  it('Schema.is returns true for "survival" and "creative"', () => {
    expect(Schema.is(GameModeSchema)('survival')).toBe(true)
    expect(Schema.is(GameModeSchema)('creative')).toBe(true)
  })

  it('Schema.is returns false for unknown strings', () => {
    expect(Schema.is(GameModeSchema)('adventure')).toBe(false)
  })
})
