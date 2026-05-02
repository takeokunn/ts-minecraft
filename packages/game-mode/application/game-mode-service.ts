import { Effect, Ref, Schema } from 'effect'

/**
 * GameMode — vanilla-Minecraft parity (Phase 1).
 *
 * 'survival' — standard rules (HP, hunger, fall damage, no flight, finite block placement).
 * 'creative' — no HP/hunger, flight enabled, infinite block placement.
 *
 * The canonical source of truth lives on WorldMetadata; sessionProgram pulls the
 * persisted value from storage at session start and seeds this service via `set()`.
 */
export const GameModeSchema = Schema.Literal('survival', 'creative')
export type GameMode = Schema.Schema.Type<typeof GameModeSchema>

export const DEFAULT_GAME_MODE: GameMode = 'survival'

/**
 * GameModeService — Effect-TS service holding the active GameMode for the
 * current world session. Stateless across sessions; sessionProgram owns the
 * write-on-load + write-on-mode-change lifecycle.
 *
 * Methods:
 *   - get()         — read current mode
 *   - set(mode)     — replace current mode (caller persists to WorldMetadata)
 *   - isCreative()  — sugar for `get().pipe(Effect.map((m) => m === 'creative'))`
 *   - isSurvival()  — sugar for `get().pipe(Effect.map((m) => m === 'survival'))`
 */
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
      })),
    ),
  },
) {}

export const GameModeServiceLive = GameModeService.Default
