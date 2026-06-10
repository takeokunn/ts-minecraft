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
    effect: Ref.make<GameMode>(DEFAULT_GAME_MODE).pipe(
      Effect.map((modeRef) => ({
        get: (): Effect.Effect<GameMode, never> => Ref.get(modeRef),
        set: (mode: GameMode): Effect.Effect<void, never> => Ref.set(modeRef, mode),
        isCreative: (): Effect.Effect<boolean, never> =>
          Ref.get(modeRef).pipe(Effect.map((mode) => mode === 'creative')),
        isSurvival: (): Effect.Effect<boolean, never> =>
          Ref.get(modeRef).pipe(Effect.map((mode) => mode === 'survival')),
        isSpectator: (): Effect.Effect<boolean, never> =>
          Ref.get(modeRef).pipe(Effect.map((mode) => mode === 'spectator')),
      })),
    ),
  },
) {}

export const GameModeServiceLive = GameModeService.Default
