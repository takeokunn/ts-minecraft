import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { GameModeService, GameModeServiceLive, DEFAULT_GAME_MODE } from './game-mode-service'

describe('application/game-mode/game-mode-service', () => {
  it.effect('defaults to survival', () =>
    Effect.gen(function* () {
      const svc = yield* GameModeService
      expect(yield* svc.get()).toBe('survival')
      expect(DEFAULT_GAME_MODE).toBe('survival')
    }).pipe(Effect.provide(GameModeServiceLive)),
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
    }).pipe(Effect.provide(GameModeServiceLive)),
  )
})
