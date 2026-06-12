import { Effect, Ref } from 'effect'
import { GameModeSchema, GameMode, DEFAULT_GAME_MODE } from '@ts-minecraft/core'

export { GameModeSchema, DEFAULT_GAME_MODE }
export type { GameMode }

// Canonical source of truth lives on WorldMetadata; sessionProgram pulls from storage
// at session start and seeds this service via set().

// Stateless across sessions: sessionProgram owns write-on-load + write-on-mode-change.
export class GameModeService extends Effect.Service<GameModeService>()(
  '@minecraft/application/GameModeService',
  {
    effect: Effect.gen(function* () {
      const modeRef = yield* Ref.make<GameMode>(DEFAULT_GAME_MODE)
      return {
        get: (): Effect.Effect<GameMode, never> => Ref.get(modeRef),
        set: (mode: GameMode): Effect.Effect<void, never> => Ref.set(modeRef, mode),
        isCreative: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () { const mode = yield* Ref.get(modeRef); return mode === 'creative' }),
        isSurvival: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () { const mode = yield* Ref.get(modeRef); return mode === 'survival' }),
        isSpectator: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () { const mode = yield* Ref.get(modeRef); return mode === 'spectator' }),
      }
    }),
  },
) {}

export const GameModeServiceLive = GameModeService.Default
