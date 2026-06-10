import { Effect, Option, Ref } from 'effect'
import type { ItemType } from '@ts-minecraft/core'
import { resolveFishingCatch, resolveFishingWaitSecs } from '../domain/fishing'

type FishingState =
  | { readonly _tag: 'idle' }
  | { readonly _tag: 'casting'; readonly elapsedSecs: number; readonly targetSecs: number; readonly seed: number; readonly luckLevel: number }

const IDLE: FishingState = { _tag: 'idle' }

export class FishingService extends Effect.Service<FishingService>()(
  '@minecraft/application/FishingService',
  {
    effect: Ref.make<FishingState>(IDLE).pipe(Effect.map((stateRef) => ({
      // Begin a fishing cast. seed should be derived from XP + frame count
      // (deterministic but unique per cast). lureLevel and luckLevel come from
      // rod enchantments and are captured at cast time — valid even if the rod
      // leaves the hotbar before the catch.
      cast: (seed: number, lureLevel = 0, luckLevel = 0): Effect.Effect<void, never> =>
        Ref.set(stateRef, {
          _tag: 'casting',
          elapsedSecs: 0,
          targetSecs: resolveFishingWaitSecs(seed, lureLevel),
          seed,
          luckLevel,
        }),

      // Advance the fishing timer. Returns Some(item) when a catch occurs,
      // resetting to idle. Returns None when still waiting or not fishing.
      tick: (deltaSecs: number): Effect.Effect<Option.Option<ItemType>, never> =>
        Ref.modify(stateRef, (state): [Option.Option<ItemType>, FishingState] => {
          if (state._tag === 'idle') return [Option.none(), state]
          const nextElapsed = state.elapsedSecs + deltaSecs
          if (nextElapsed >= state.targetSecs) {
            const caught = resolveFishingCatch(state.seed + Math.floor(nextElapsed * 100), state.luckLevel)
            return [Option.some(caught), IDLE]
          }
          return [Option.none(), { ...state, elapsedSecs: nextElapsed }]
        }),

      // Cancel an active cast without catching anything.
      cancel: (): Effect.Effect<void, never> =>
        Ref.set(stateRef, IDLE),

      isFishing: (): Effect.Effect<boolean, never> =>
        Ref.get(stateRef).pipe(Effect.map((s) => s._tag === 'casting')),

      // Progress fraction [0, 1] for HUD display.
      getProgress: (): Effect.Effect<number, never> =>
        Ref.get(stateRef).pipe(
          Effect.map((s) =>
            s._tag === 'casting' ? Math.min(1, s.elapsedSecs / s.targetSecs) : 0
          ),
        ),

      reset: (): Effect.Effect<void, never> =>
        Ref.set(stateRef, IDLE),
    }))),
  },
) {}

export const FishingServiceLive = FishingService.Default
